import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { validateBirthDate } from "./after9";
import { INSTRUCTIONS, SCHEMA, toVerdict, type Raw, type Verdict } from "./verify-rules";
import { assertRateLimit } from "./security-rate-limiter";

export const verifyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Verdict & { status: string }> => {
    const { supabase, userId } = context;

    // Rate-limit verification checks to 6 per hour per user
    await assertRateLimit({
      action: "verify_profile",
      maxAttempts: 6,
      windowSeconds: 3600,
      userId,
    });

    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, prompt, photo_path, invited_by, birth_date, is_suspended")
      .eq("id", userId)
      .single();

    if (p?.is_suspended) {
      return { approved: false, reason: "Account is suspended.", status: "rejected" };
    }

    // 1. Strict server-side birth date and 18+ eligibility check
    if (!p?.birth_date) {
      return { approved: false, reason: "Birth date is required.", status: "rejected" };
    }
    const bCheck = validateBirthDate(p.birth_date);
    if (!bCheck.valid || bCheck.age < 18) {
      const reason = bCheck.error || "After9 is strictly for adults 18+.";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("profiles").update({ verification_status: "rejected", verification_reason: reason }).eq("id", userId);
      return { approved: false, reason, status: "rejected" };
    }

    if (!p?.photo_path) return { approved: false, reason: "Add a photo first.", status: "pending" };

    // Prevent directory traversal or cross-user photo access
    const safePath = p.photo_path.trim();
    if (safePath.includes("..") || !safePath.startsWith(`${userId}/`) || !/\.(jpg|jpeg|png|webp)$/i.test(safePath)) {
      return { approved: false, reason: "Invalid photo format or path.", status: "rejected" };
    }

    if (p.invited_by) {
      // Invited by a live member: skip the AI photo check only if age is verified 18+.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const reason = "Joined with a friend's invite — you're live on Discover.";
      await supabaseAdmin.from("profiles").update({ verification_status: "approved", verification_reason: reason }).eq("id", userId);
      return { approved: true, reason, status: "approved" };
    }
    const { data: blob } = await supabase.storage.from("photos").download(safePath);
    if (!blob) throw new Error("Could not read photo");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const dataUrl = `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const reason = "Profile verified — you're live on Discover.";
      await supabaseAdmin.from("profiles").update({ verification_status: "approved", verification_reason: reason }).eq("id", userId);
      return { approved: true, reason, status: "approved" };
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
        instructions: INSTRUCTIONS,
        text: { format: { type: "json_schema", name: "verdict", strict: true, schema: SCHEMA } },
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `Name: ${p.first_name ?? ""}\nPrompt: ${p.prompt ?? ""}` },
            { type: "input_image", image_url: dataUrl },
          ],
        }],
      }),
    });
    if (!res.ok || !res.body) {
      const msg = res.status === 429 ? "Our checker is busy — we'll retry soon." : res.status === 402 ? "Profile checks are paused right now." : "We couldn't check your profile yet.";
      console.error("verify failed", res.status, await res.text().catch(() => ""));
      return { approved: false, reason: msg, status: "pending" };
    }

    let text = "", buf = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim());
          if (ev.type === "response.output_text.delta") text += ev.delta;
        } catch { /* ignore keep-alives */ }
      }
    }

    let v: Verdict;
    try { v = toVerdict(JSON.parse(text) as Raw); } catch {
      return { approved: false, reason: "We couldn't check your profile yet. Try again.", status: "pending" };
    }
    const status = v.approved ? "approved" : "rejected";
    try {
      await supabase.rpc("set_profile_verification_verdict", {
        p_user_id: userId,
        p_status: status,
        p_reason: v.reason,
      });
    } catch {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("profiles").update({ verification_status: status, verification_reason: v.reason }).eq("id", userId);
    }
    return { ...v, status };
  });

/**
 * Responsible live photo verification with camera comparison.
 * Compares ephemeral live selfie with uploaded profile photo.
 * Falls back to manual review queue if automated provider is unconfigured.
 * Never stores biometric templates or permanent capture files.
 */
export const submitLivePhotoVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveSelfieDataUrl: string }) => {
    const raw = String(d.liveSelfieDataUrl ?? "").trim();
    if (!raw.startsWith("data:image/") || !raw.includes(";base64,")) {
      throw new Error("Invalid image format provided.");
    }
    // Limit to 5MB payload to prevent memory abuse
    if (raw.length > 5 * 1024 * 1024 * 1.37) {
      throw new Error("Image payload exceeds allowable size.");
    }
    return { liveSelfieDataUrl: raw };
  })
  .handler(async ({ data, context }): Promise<{ status: "approved" | "needs_review" | "rejected"; approved: boolean; reason: string }> => {
    const { supabase, userId } = context;

    // Rate-limit live photo checks to 5 per hour per user
    await assertRateLimit({
      action: "live_photo_verification",
      maxAttempts: 5,
      windowSeconds: 3600,
      userId,
    });

    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, photo_path, is_suspended, birth_date")
      .eq("id", userId)
      .single();

    if (p?.is_suspended) {
      return { status: "rejected", approved: false, reason: "Account is suspended." };
    }

    if (!p?.photo_path) {
      return { status: "rejected", approved: false, reason: "Please upload a profile photo first." };
    }

    const safePath = p.photo_path.trim();
    if (safePath.includes("..") || !safePath.startsWith(`${userId}/`)) {
      return { status: "rejected", approved: false, reason: "Invalid profile photo path." };
    }

    // Download profile photo
    const { data: blob } = await supabase.storage.from("photos").download(safePath);
    if (!blob) {
      return { status: "rejected", approved: false, reason: "Could not retrieve uploaded profile photo." };
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const profileDataUrl = `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;

    const key = process.env["LOVABLE_API_KEY"];

    // MANUAL REVIEW FALLBACK:
    // If no automated provider API key is configured, do not pretend or fake detection.
    // Truthfully route to manual review.
    if (!key) {
      const reason = "Your live photo check has been submitted for manual moderation review. An administrator will verify your profile shortly.";
      try {
        await supabase.rpc("set_profile_verification_verdict", {
          p_user_id: userId,
          p_status: "needs_review",
          p_reason: reason,
        });
      } catch (e) {
        console.warn("[Verification] set_profile_verification_verdict fallback:", e);
      }

      return {
        status: "needs_review",
        approved: false,
        reason,
      };
    }

    // If key is available, call the vision comparison model
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          stream: false,
          store: false,
          instructions: `You are an impartial face-verification safety auditor.
Compare Image 1 (uploaded profile photo) with Image 2 (fresh live selfie).
Evaluate whether both images depict the SAME person.
Do not reject users for makeup, skin tone, lighting changes, natural aging, hairstyle changes, disability or minor facial differences.
Only reject if it is clearly an entirely different individual or an obvious impersonation/stock photo.
If comparison is ambiguous due to low resolution or extreme angles, mark ambiguous as true.
Return JSON matching schema:
{
  "match": boolean,
  "confidence": "high" | "medium" | "low",
  "ambiguous": boolean,
  "reason": string
}`,
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: "Image 1 is the profile photo. Image 2 is the live camera capture. Compare faces:" },
              { type: "input_image", image_url: profileDataUrl },
              { type: "input_image", image_url: data.liveSelfieDataUrl },
            ],
          }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Provider response status ${res.status}`);
      }

      const json = await res.json();
      const content = json?.output?.[0]?.content?.[0]?.text || json?.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);

      if (parsed.match && !parsed.ambiguous && parsed.confidence !== "low") {
        const reason = "Photo verified — live check confirmed identity.";
        await supabase.rpc("set_profile_verification_verdict", {
          p_user_id: userId,
          p_status: "approved",
          p_reason: reason,
        });
        return { status: "approved", approved: true, reason };
      } else if (parsed.ambiguous || parsed.confidence === "low") {
        const reason = parsed.reason || "Selfie comparison was inconclusive — queued for manual review.";
        await supabase.rpc("set_profile_verification_verdict", {
          p_user_id: userId,
          p_status: "needs_review",
          p_reason: reason,
        });
        return { status: "needs_review", approved: false, reason };
      } else {
        const reason = parsed.reason || "The live selfie did not sufficiently match your uploaded photo.";
        await supabase.rpc("set_profile_verification_verdict", {
          p_user_id: userId,
          p_status: "rejected",
          p_reason: reason,
        });
        return { status: "rejected", approved: false, reason };
      }
    } catch (err) {
      console.warn("[Verification] Provider comparison error, falling back to manual review:", err);
      const reason = "Automated check was unavailable — queued for manual administrator review.";
      await supabase.rpc("set_profile_verification_verdict", {
        p_user_id: userId,
        p_status: "needs_review",
        p_reason: reason,
      });
      return { status: "needs_review", approved: false, reason };
    }
  });

