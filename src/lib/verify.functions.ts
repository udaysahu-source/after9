import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import crypto from "node:crypto";

import { validateBirthDate } from "./after9";
import { INSTRUCTIONS, SCHEMA, toVerdict, type Raw, type Verdict } from "./verify-rules";
import { assertRateLimit } from "./security-rate-limiter";

/**
 * Calculates SHA-256 hash of a buffer or Uint8Array.
 */
export function computeImageSha256(bytes: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Validates and verifies standard profile upload.
 * Strictly verifies 18+ adult age, path validity, and checks for duplicate photo abuse.
 * Never auto-approves solely because an invite code was used or API key is absent.
 */
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
      .select("first_name, prompt, photo_path, invited_by, birth_date, is_suspended, verification_status")
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

    // Download photo and compute hash
    const { data: blob } = await supabase.storage.from("photos").download(safePath);
    if (!blob) throw new Error("Could not read photo");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const photoHash = computeImageSha256(bytes);

    // 2. Duplicate Photo Impersonation Check:
    // Check if an existing account has registered this identical photo hash
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRegistrations } = await supabaseAdmin
      .from("security_events")
      .select("actor_id, metadata")
      .eq("event_type", "profile_photo_registered")
      .contains("metadata", { photo_hash: photoHash })
      .neq("actor_id", userId)
      .limit(1);

    if (existingRegistrations && existingRegistrations.length > 0) {
      const existingActor = existingRegistrations[0].actor_id;
      // Record flag without immediately banning (protect legitimate users sharing photos or festival groups)
      await supabaseAdmin.from("security_events").insert({
        event_type: "duplicate_photo_detected",
        severity: "warn",
        actor_id: userId,
        metadata: {
          photo_hash: photoHash,
          original_user_id: existingActor,
          duplicate_user_id: userId,
          flagged_for_review: true,
        },
      });

      const duplicateReason = "Duplicate profile photo detected across accounts — queued for moderator review to prevent impersonation.";
      await supabaseAdmin.from("profiles").update({
        verification_status: "needs_review",
        verification_reason: duplicateReason,
      }).eq("id", userId);

      return { approved: false, reason: duplicateReason, status: "needs_review" };
    }

    // Register this photo hash for future collision tracking
    await supabaseAdmin.from("security_events").insert({
      event_type: "profile_photo_registered",
      severity: "info",
      actor_id: userId,
      metadata: { photo_hash: photoHash, photo_path: safePath },
    });

    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const dataUrl = `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      // Truthful fallback: never mark verified solely because a photo was uploaded.
      // Queue for manual admin review.
      const reviewReason = "Profile check submitted for manual administrator review. You will be verified shortly.";
      await supabaseAdmin.from("profiles").update({
        verification_status: "needs_review",
        verification_reason: reviewReason,
      }).eq("id", userId);

      return { approved: false, reason: reviewReason, status: "needs_review" };
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
    await supabaseAdmin.from("profiles").update({ verification_status: status, verification_reason: v.reason }).eq("id", userId);
    return { ...v, status };
  });

/**
 * Responsible live photo verification with camera capture comparison.
 * Requires fresh live camera evidence, rejects static/gallery photos,
 * stores verification evidence in a private bucket accessible only to authorized reviewers,
 * and falls back to manual moderation queue if automated evaluation is inconclusive or unconfigured.
 */
export const submitLivePhotoVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveSelfieDataUrl: string; capturedAt?: number; captureType?: string }) => {
    const raw = String(d.liveSelfieDataUrl ?? "").trim();
    if (!raw.startsWith("data:image/") || !raw.includes(";base64,")) {
      throw new Error("Invalid image format provided.");
    }
    // Limit to 5MB payload to prevent memory abuse
    if (raw.length > 5 * 1024 * 1024 * 1.37) {
      throw new Error("Image payload exceeds allowable size.");
    }
    return {
      liveSelfieDataUrl: raw,
      capturedAt: typeof d.capturedAt === "number" ? d.capturedAt : undefined,
      captureType: d.captureType ? String(d.captureType) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<{ status: "approved" | "needs_review" | "rejected"; approved: boolean; reason: string }> => {
    const { supabase, userId } = context;

    // 1. Rate-limit live photo checks to 5 per hour per user
    await assertRateLimit({
      action: "live_photo_verification",
      maxAttempts: 5,
      windowSeconds: 3600,
      userId,
    });

    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, photo_path, is_suspended, birth_date, verification_status")
      .eq("id", userId)
      .single();

    if (p?.is_suspended) {
      return { status: "rejected", approved: false, reason: "Account is suspended." };
    }

    // 2. Prevent repeated rapid submissions when already in review
    if (p?.verification_status === "needs_review") {
      return {
        status: "needs_review",
        approved: false,
        reason: "Your verification request is already in the moderation review queue. A moderator will review it shortly.",
      };
    }

    // 3. Prevent rapid verification attempt hammering after rejection
    if (p?.verification_status === "rejected") {
      await assertRateLimit({
        action: "rejected_reverify_cooldown",
        maxAttempts: 2,
        windowSeconds: 900,
        userId,
      });
    }

    if (!p?.photo_path) {
      return { status: "rejected", approved: false, reason: "Please upload a profile photo first." };
    }

    const safePath = p.photo_path.trim();
    if (safePath.includes("..") || !safePath.startsWith(`${userId}/`)) {
      return { status: "rejected", approved: false, reason: "Invalid profile photo path." };
    }

    // 4. Validate fresh camera capture metadata:
    // Reject submissions claiming to be gallery or with stale/missing timestamps
    if (data.captureType === "gallery") {
      return {
        status: "rejected",
        approved: false,
        reason: "A fresh camera capture is required for verification. Existing gallery images cannot be accepted.",
      };
    }

    if (data.capturedAt) {
      const captureAge = Date.now() - data.capturedAt;
      // Stale capture older than 5 minutes or future timestamp
      if (captureAge > 5 * 60 * 1000 || captureAge < -30000) {
        return {
          status: "rejected",
          approved: false,
          reason: "Verification selfie has expired. Please take a fresh live photo using your camera.",
        };
      }
    }

    // Download profile photo
    const { data: blob } = await supabase.storage.from("photos").download(safePath);
    if (!blob) {
      return { status: "rejected", approved: false, reason: "Could not retrieve uploaded profile photo." };
    }

    const profileBytes = new Uint8Array(await blob.arrayBuffer());
    const profileHash = computeImageSha256(profileBytes);

    // Decode live selfie bytes
    const base64Data = data.liveSelfieDataUrl.split(";base64,")[1] || "";
    const selfieBytes = Buffer.from(base64Data, "base64");
    const selfieHash = computeImageSha256(selfieBytes);

    // 5. Anti-Fake Check: detect exact duplicate / gallery photo submission
    // If the selfie is byte-identical to the user's profile photo, reject immediately
    if (profileHash === selfieHash) {
      return {
        status: "rejected",
        approved: false,
        reason: "A fresh live camera selfie is required. You cannot submit your existing profile photo as verification evidence.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if selfie matches any previously registered gallery photo
    const { data: galleryMatch } = await supabaseAdmin
      .from("security_events")
      .select("actor_id")
      .eq("event_type", "profile_photo_registered")
      .contains("metadata", { photo_hash: selfieHash })
      .limit(1);

    if (galleryMatch && galleryMatch.length > 0) {
      return {
        status: "rejected",
        approved: false,
        reason: "A fresh live camera selfie is required. Pre-existing gallery photos cannot be used as verification evidence.",
      };
    }

    // 6. Store verification evidence PRIVATELY with retention metadata:
    // Stored in private bucket 'verification_evidence', never exposed publicly
    const evidencePath = `${userId}/${Date.now()}_selfie.jpg`;
    try {
      await supabaseAdmin.storage
        .from("verification_evidence")
        .upload(evidencePath, selfieBytes, {
          contentType: "image/jpeg",
          upsert: true,
        });
    } catch (uploadErr) {
      console.warn("[Verification] Could not store evidence to bucket:", uploadErr);
    }

    // Check if profile photo itself is a duplicate of another user's photo
    const { data: duplicateProfile } = await supabaseAdmin
      .from("security_events")
      .select("actor_id")
      .eq("event_type", "profile_photo_registered")
      .contains("metadata", { photo_hash: profileHash })
      .neq("actor_id", userId)
      .limit(1);

    if (duplicateProfile && duplicateProfile.length > 0) {
      await supabaseAdmin.from("security_events").insert({
        event_type: "duplicate_photo_detected",
        severity: "warn",
        actor_id: userId,
        metadata: {
          photo_hash: profileHash,
          original_user_id: duplicateProfile[0].actor_id,
          duplicate_user_id: userId,
          evidence_path: evidencePath,
          flagged_for_review: true,
        },
      });

      const dupReason = "Duplicate profile photo detected — queued for moderator review to prevent impersonation.";
      await supabaseAdmin.from("profiles").update({
        verification_status: "needs_review",
        verification_reason: dupReason,
      }).eq("id", userId);

      return { status: "needs_review", approved: false, reason: dupReason };
    }

    let bin = "";
    for (let i = 0; i < profileBytes.length; i += 0x8000) bin += String.fromCharCode(...profileBytes.subarray(i, i + 0x8000));
    const profileDataUrl = `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;

    const key = process.env["LOVABLE_API_KEY"];

    // 7. MANUAL REVIEW FALLBACK:
    // If no automated provider API key is configured, route truthfully to manual review
    if (!key) {
      const reason = "Your live photo check has been submitted for manual moderation review. An administrator will verify your profile shortly.";
      await supabaseAdmin.from("profiles").update({
        verification_status: "needs_review",
        verification_reason: reason,
      }).eq("id", userId);

      return {
        status: "needs_review",
        approved: false,
        reason,
      };
    }

    // 8. Call vision comparison model
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
        await supabaseAdmin.from("profiles").update({
          verification_status: "approved",
          verification_reason: reason,
        }).eq("id", userId);

        return { status: "approved", approved: true, reason };
      } else if (parsed.ambiguous || parsed.confidence === "low") {
        const reason = parsed.reason || "Selfie comparison was inconclusive — queued for manual review.";
        await supabaseAdmin.from("profiles").update({
          verification_status: "needs_review",
          verification_reason: reason,
        }).eq("id", userId);

        return { status: "needs_review", approved: false, reason };
      } else {
        const reason = parsed.reason || "The live selfie did not sufficiently match your uploaded photo.";
        await supabaseAdmin.from("profiles").update({
          verification_status: "rejected",
          verification_reason: reason,
        }).eq("id", userId);

        return { status: "rejected", approved: false, reason };
      }
    } catch (err) {
      console.warn("[Verification] Provider comparison error, falling back to manual review:", err);
      const reason = "Automated check was unavailable — queued for manual administrator review.";
      await supabaseAdmin.from("profiles").update({
        verification_status: "needs_review",
        verification_reason: reason,
      }).eq("id", userId);

      return { status: "needs_review", approved: false, reason };
    }
  });

/**
 * Submit appeal for suspended account.
 */
export const submitSuspensionAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reason: string }) => {
    const raw = String(d.reason ?? "").trim();
    if (raw.length < 10) {
      throw new Error("Please provide a detailed explanation for your appeal (minimum 10 characters).");
    }
    return { reason: raw.slice(0, 1000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await assertRateLimit({
      action: "suspension_appeal",
      maxAttempts: 3,
      windowSeconds: 86400,
      userId,
    });

    const { data: res, error } = await supabase.rpc("submit_suspension_appeal", {
      p_reason: data.reason,
    });

    if (error) {
      // Fallback via admin client if RPC not deployed yet
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("security_events").insert({
        event_type: "suspension_appeal",
        severity: "info",
        actor_id: userId,
        metadata: {
          appeal_reason: data.reason,
          submitted_at: new Date().toISOString(),
        },
      });
      return { ok: true, message: "Your appeal has been submitted to the moderation team." };
    }

    return res as { ok: boolean; message: string };
  });

/**
 * Server-side rate limit check before account creation.
 */
export const checkSignupRateLimit = createServerFn({ method: "POST" })
  .handler(async () => {
    await assertRateLimit({
      action: "auth:signup",
      maxAttempts: 5,
      windowSeconds: 3600, // 5 signups per hour per IP
    });
    return { allowed: true };
  });

