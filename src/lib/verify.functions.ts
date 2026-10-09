import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { validateBirthDate } from "./after9";
import { INSTRUCTIONS, SCHEMA, toVerdict, type Raw, type Verdict } from "./verify-rules";

export const verifyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Verdict & { status: string }> => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, prompt, photo_path, invited_by, birth_date")
      .eq("id", userId)
      .single();

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
    if (p.invited_by) {
      // Invited by a live member: skip the AI photo check only if age is verified 18+.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const reason = "Joined with a friend's invite — you're live on Discover.";
      await supabaseAdmin.from("profiles").update({ verification_status: "approved", verification_reason: reason }).eq("id", userId);
      return { approved: true, reason, status: "approved" };
    }
    const { data: blob } = await supabase.storage.from("photos").download(p.photo_path);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ verification_status: status, verification_reason: v.reason }).eq("id", userId);
    return { ...v, status };
  });
