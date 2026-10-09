import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** How many invite passes each approved member gets. */
export const INVITE_ALLOCATION = 5;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => "A9-" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** Tops up the caller's invites to the allocation and returns the active primary invite code. */
export const ensureInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // First try the transactional ensure_my_invites RPC
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("ensure_my_invites");
    if (!rpcErr && rpcRes && (rpcRes as any).ok) {
      const res = rpcRes as any;
      return {
        ok: true as const,
        primaryCode: (res.primary_code ?? null) as string | null,
        availableCount: typeof res.available_count === "number" ? res.available_count : 0,
        claimedCount: typeof res.claimed_count === "number" ? res.claimed_count : 0,
        total: typeof res.total_allocation === "number" ? res.total_allocation : INVITE_ALLOCATION,
      };
    }

    // Fallback: Fetch caller's existing active invites
    const { data: existing } = await supabaseAdmin
      .from("invites")
      .select("code, claimed_by, revoked, expires_at")
      .eq("creator_id", userId);

    const validInvites = (existing ?? []).filter((i) => !i.revoked && (!i.expires_at || new Date(i.expires_at) > new Date()));
    const missing = INVITE_ALLOCATION - validInvites.length;
    let newlyCreated: string[] = [];

    if (missing > 0) {
      const expires = new Date(Date.now() + 30 * 864e5).toISOString();
      const rows = Array.from({ length: missing }, () => ({
        code: newCode(),
        creator_id: userId,
        expires_at: expires,
      }));
      await supabaseAdmin.from("invites").insert(rows);
      newlyCreated = rows.map((r) => r.code);
    }

    const available = validInvites.filter((i) => !i.claimed_by).map((i) => i.code);
    // Never fall back to an already-claimed code!
    const primaryCode = available[0] ?? newlyCreated[0] ?? null;

    return {
      ok: true as const,
      primaryCode,
      availableCount: available.length + newlyCreated.length,
      claimedCount: validInvites.filter((i) => i.claimed_by).length,
      total: INVITE_ALLOCATION,
    };
  });

/** Single-use claim, validated on the server. */
export const claimInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; chat?: boolean }) => ({ code: String(d.code ?? "").trim().toUpperCase().slice(0, 20), chat: !!d.chat }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin.from("invites").select("*").eq("code", data.code).maybeSingle();
    if (!inv) return { ok: false, reason: "That code doesn't exist." };
    if (inv.revoked) return { ok: false, reason: "That code was cancelled." };
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { ok: false, reason: "That code has expired." };
    if (inv.creator_id === userId) return { ok: false, reason: "You can't use your own code." };
    if (inv.claimed_by && inv.claimed_by !== userId) return { ok: false, reason: "That code was already used." };
    const { data: me } = await supabaseAdmin.from("profiles").select("invited_by").eq("id", userId).single();
    if (me?.invited_by && me.invited_by !== inv.creator_id) return { ok: false, reason: "You've already joined with an invite." };
    // atomic single-use: only claim if still unclaimed
    const { data: claimed } = await supabaseAdmin.from("invites").update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("code", inv.code).is("claimed_by", null).select("code");
    if (!claimed?.length && inv.claimed_by !== userId) return { ok: false, reason: "That code was already used." };
    await supabaseAdmin.from("profiles").update({ invited_by: inv.creator_id }).eq("id", userId);
    if (data.chat) {
      // Chat link: open a clash straight away so the two of you can talk.
      await supabaseAdmin.from("dandiyas").upsert([
        { from_id: inv.creator_id, to_id: userId, kind: "send" },
        { from_id: userId, to_id: inv.creator_id, kind: "send" },
      ]);
      return { ok: true, reason: "Invite accepted — your chat is open.", chatWith: inv.creator_id };
    }
    return { ok: true, reason: "Invite accepted." };
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The caller's saved friends, each with their assigned invite code and how far they got. */
export const listInviteContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("invite_contacts")
      .select("id, name, email, code, sent_at, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: true });
    const contacts = rows ?? [];
    const codes = contacts.map((c) => c.code).filter(Boolean) as string[];
    const { data: invs } = codes.length
      ? await supabaseAdmin.from("invites").select("code, claimed_by, claimed_at").in("code", codes)
      : { data: [] as { code: string; claimed_by: string | null; claimed_at: string | null }[] };
    const claimerIds = [...new Set((invs ?? []).map((i) => i.claimed_by).filter(Boolean))] as string[];
    const { data: profs } = claimerIds.length
      ? await supabaseAdmin.from("profiles").select("id, onboarded, verification_status").in("id", claimerIds)
      : { data: [] as { id: string; onboarded: boolean; verification_status: string }[] };
    const byCode = new Map((invs ?? []).map((i) => [i.code, i]));
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return contacts.map((c) => {
      const inv = c.code ? byCode.get(c.code) : undefined;
      const friend = inv?.claimed_by ? byId.get(inv.claimed_by) : undefined;
      const stage = !inv?.claimed_at
        ? c.sent_at ? "sent" : "saved"
        : !friend?.onboarded ? "joined"
        : friend.verification_status === "approved" ? "live" : "setting_up";
      return { ...c, stage };
    });
  });

/** Save a friend and reserve one of the caller's unused codes for them. */
export const addInviteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; email: string }) => ({
    name: String(d.name ?? "").trim().slice(0, 60),
    email: String(d.email ?? "").trim().toLowerCase().slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.name) return { ok: false as const, reason: "Add your friend's name." };
    if (!EMAIL_RE.test(data.email)) return { ok: false as const, reason: "That email doesn't look right." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dup } = await supabaseAdmin.from("invite_contacts").select("id").eq("owner_id", userId).eq("email", data.email).maybeSingle();
    if (dup) return { ok: false as const, reason: "That email is already on your list." };
    // reserve an unused, unclaimed code that isn't already assigned to another friend
    const [{ data: taken }, { data: mine }] = await Promise.all([
      supabaseAdmin.from("invite_contacts").select("code").eq("owner_id", userId).not("code", "is", null),
      supabaseAdmin.from("invites").select("code").eq("creator_id", userId).is("claimed_by", null).eq("revoked", false),
    ]);
    const takenSet = new Set((taken ?? []).map((t) => t.code));
    const code = (mine ?? []).find((i) => !takenSet.has(i.code))?.code ?? null;
    const { error } = await supabaseAdmin.from("invite_contacts").insert({ owner_id: userId, name: data.name, email: data.email, code });
    if (error) return { ok: false as const, reason: "Couldn't save that friend — try again." };
    return { ok: true as const, hasCode: !!code };
  });

/** Mark that the invite was shared with this friend. */
export const markInviteSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invite_contacts").update({ sent_at: new Date().toISOString() }).eq("id", data.id).eq("owner_id", context.userId);
    return { ok: true };
  });

export const removeInviteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invite_contacts").delete().eq("id", data.id).eq("owner_id", context.userId);
    return { ok: true };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d.code) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invites").update({ revoked: true }).eq("code", data.code).eq("creator_id", context.userId).is("claimed_by", null);
    return { ok: true };
  });
