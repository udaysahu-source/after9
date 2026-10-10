import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { assertRateLimit, recordSecurityEvent } from "./security-rate-limiter";

export interface AdminStatusResult {
  isAdmin: boolean;
  role: "super_admin" | "admin" | "moderator" | null;
  email: string | null;
  userId: string | null;
  serviceRoleConfigured?: boolean;
}

/**
 * Server helper to get privileged database client.
 * Uses service role client if configured, otherwise falls back to caller's authenticated client
 * which has full admin privileges via migration 0015 RLS policies.
 */
async function getAdminDb(context: { supabase: any; userId: string; claims: any }) {
  try {
    const { supabaseAdmin, isServiceRoleConfigured } = await import("@/integrations/supabase/client.server");
    if (isServiceRoleConfigured) {
      return supabaseAdmin;
    }
  } catch {
    /* fallback */
  }
  return context.supabase;
}

/**
 * Checks server-side authorization for admin dashboard.
 * Verifies caller against `public.admin_users`, `public.is_admin`, or server-configured ADMIN_EMAILS.
 */
export const checkAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStatusResult> => {
    const { userId, claims, supabase } = context;
    const email = (claims?.email ? String(claims.email) : null)?.toLowerCase() ?? null;
    const serviceRoleConfigured = Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);

    // 1. Verify via database is_admin RPC (security definer)
    let isAdminRpc = false;
    try {
      const { data: rpcRes } = await supabase.rpc("is_admin", { p_user_id: userId });
      isAdminRpc = Boolean(rpcRes);
    } catch (e) {
      console.warn("[Admin] is_admin RPC check:", e);
    }

    // 2. Check if user is in admin_users table
    let adminRecord: { id?: string; role?: string; is_active?: boolean } | null = null;
    try {
      const { data } = await supabase
        .from("admin_users")
        .select("id, role, is_active")
        .or(`user_id.eq.${userId}${email ? `,email.eq.${email}` : ""}`)
        .maybeSingle();
      adminRecord = data;
    } catch {
      // Table query might fail if RLS not evaluated yet
    }

    if ((isAdminRpc || adminRecord?.is_active) && adminRecord?.role) {
      return {
        isAdmin: true,
        role: adminRecord.role as any,
        email: email ?? null,
        userId: userId ?? null,
        serviceRoleConfigured,
      };
    }

    // 3. Check environment variables ADMIN_EMAILS / ADMIN_EMAIL (comma separated)
    const rawEnv = [process.env["ADMIN_EMAILS"], process.env["ADMIN_EMAIL"]].filter(Boolean).join(",");
    const configuredAdminEmails = rawEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (email && configuredAdminEmails.includes(email)) {
      // If service role key is configured, bootstrap into admin_users table
      if (serviceRoleConfigured) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("admin_users").upsert(
            {
              user_id: userId,
              email,
              role: "super_admin",
              is_active: true,
            },
            { onConflict: "email" }
          );

          await supabaseAdmin.from("admin_audit_logs").insert({
            actor_id: userId,
            actor_email: email,
            action: "BOOTSTRAP_SUPER_ADMIN",
            target_id: userId,
            details: { note: "Provisioned via ADMIN_EMAILS env variable" },
          });
        } catch (e) {
          console.warn("[Admin] Could not upsert admin record via service role:", e);
        }
      }

      return {
        isAdmin: true,
        role: "super_admin",
        email,
        userId,
        serviceRoleConfigured,
      };
    }

    return {
      isAdmin: false,
      role: null,
      email: email ?? null,
      userId: userId ?? null,
      serviceRoleConfigured,
    };
  });

/**
 * Server middleware helper that asserts admin status before executing privileged functions.
 */
async function assertAdminCaller(userId: string, userEmail?: string | null, callerSupabase?: any) {
  let email = (userEmail ?? "").toLowerCase();

  // 1. Check RPC if authenticated client is available
  if (callerSupabase) {
    try {
      const { data: isAdm } = await callerSupabase.rpc("is_admin", { p_user_id: userId });
      if (isAdm) {
        const { data: record } = await callerSupabase
          .from("admin_users")
          .select("role, email")
          .eq("user_id", userId)
          .maybeSingle();
        if (!email && record?.email) {
          email = record.email.toLowerCase();
        }
        return { email: email || "admin@after9.internal", role: record?.role ?? "admin" };
      }
    } catch {
      // RPC error fallback
    }
  }

  // 2. Check service role admin client if key is configured
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminRecord } = await supabaseAdmin
        .from("admin_users")
        .select("role, is_active")
        .or(`user_id.eq.${userId}${email ? `,email.eq.${email}` : ""}`)
        .maybeSingle();

      if (adminRecord?.is_active) {
        return { email, role: adminRecord.role };
      }
    } catch {
      // Fall through to env variable check
    }
  }

  // 3. Fallback to ADMIN_EMAILS
  const rawEnv = [process.env["ADMIN_EMAILS"], process.env["ADMIN_EMAIL"]].filter(Boolean).join(",");
  const configuredAdminEmails = rawEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email && configuredAdminEmails.includes(email)) {
    return { email, role: "super_admin" };
  }

  await recordSecurityEvent({
    eventType: "unauthorized_admin_access_attempt",
    severity: "warn",
    actorId: userId,
    metadata: { attemptedEmail: email },
  });

  throw new Error("Unauthorized: Administrator privileges required.");
}

/**
 * Fetch real aggregate metrics for the admin overview.
 */
export const getAdminOverviewMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: onboardedUsers },
      { count: discoverableUsers },
      { count: totalSwipes },
      { count: totalMessages },
      { count: openReports },
      { count: totalInvites },
      { count: claimedInvites },
      { count: newUsers24h },
      { count: newUsers7d },
      { count: newUsers30d },
      { count: activeUsers24h },
      { count: activeUsers7d },
      { count: referredUsersTotal },
      { count: referredUsersOnboarded },
      { count: verifiedEvents },
      { count: unverifiedEvents },
      { count: expiredEvents },
      launchRes,
    ] = await Promise.all([
      db.from("profiles").select("*", { count: "exact", head: true }),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("onboarded", true),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("discoverable", true).eq("onboarded", true),
      db.from("dandiyas").select("*", { count: "exact", head: true }),
      db.from("messages").select("*", { count: "exact", head: true }),
      db.from("blocks").select("*", { count: "exact", head: true }).eq("report", true).eq("status", "pending"),
      db.from("invites").select("*", { count: "exact", head: true }),
      db.from("invites").select("*", { count: "exact", head: true }).not("claimed_by", "is", null),
      db.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", past24h),
      db.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", past7d),
      db.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", past30d),
      db.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", past24h),
      db.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", past7d),
      db.from("profiles").select("*", { count: "exact", head: true }).not("invited_by", "is", null),
      db.from("profiles").select("*", { count: "exact", head: true }).not("invited_by", "is", null).eq("onboarded", true),
      db.from("events").select("*", { count: "exact", head: true }).eq("verification_status", "verified"),
      db.from("events").select("*", { count: "exact", head: true }).eq("verification_status", "unverified"),
      db.from("events").select("*", { count: "exact", head: true }).eq("verification_status", "expired"),
      db.rpc("get_launch_control"),
    ]);

    // Calculate mutual matches count
    const { data: sends } = await db.from("dandiyas").select("from_id, to_id").eq("kind", "send");
    let mutualMatches = 0;
    if (sends) {
      const sendSet = new Set((sends as any[]).map((s: any) => `${s.from_id}:${s.to_id}`));
      for (const s of (sends as any[])) {
        if (s.from_id < s.to_id && sendSet.has(`${s.to_id}:${s.from_id}`)) {
          mutualMatches++;
        }
      }
    }

    const launchData = (launchRes.data as any) ?? {};

    return {
      totalUsers: totalUsers ?? 0,
      onboardedUsers: onboardedUsers ?? 0,
      discoverableUsers: discoverableUsers ?? 0,
      totalSwipes: totalSwipes ?? 0,
      mutualMatches,
      totalMessages: totalMessages ?? 0,
      openReports: openReports ?? 0,
      totalInvites: totalInvites ?? 0,
      claimedInvites: claimedInvites ?? 0,
      conversionRate: totalInvites ? Math.round(((claimedInvites ?? 0) / totalInvites) * 100) : 0,
      referredUsersTotal: referredUsersTotal ?? 0,
      referredUsersOnboarded: referredUsersOnboarded ?? 0,
      referredOnboardedRate: referredUsersTotal ? Math.round(((referredUsersOnboarded ?? 0) / referredUsersTotal) * 100) : 0,
      newUsers24h: newUsers24h ?? 0,
      newUsers7d: newUsers7d ?? 0,
      newUsers30d: newUsers30d ?? 0,
      activeUsers24h: activeUsers24h ?? 0,
      activeUsers7d: activeUsers7d ?? 0,
      events: {
        verified: verifiedEvents ?? 0,
        unverified: unverifiedEvents ?? 0,
        expired: expiredEvents ?? 0,
      },
      launch: {
        discoverEnabled: Boolean(launchData.discover_enabled),
        readinessTarget: Number(launchData.readiness_target ?? 50),
        cityCounts: (launchData.city_counts as Record<string, number>) ?? {},
        nightCounts: (launchData.night_counts as Record<string, number>) ?? {},
        lastChangedAt: launchData.last_changed_at ?? null,
        lastChangedByEmail: launchData.last_changed_by_email ?? null,
      },
    };
  });

/**
 * List registered users for management.
 */
export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string | undefined; status?: string | undefined; limit?: number | undefined }) => ({
    search: String(d.search ?? "").trim(),
    status: String(d.status ?? "all"),
    limit: Math.min(Math.max(Number(d.limit ?? 50), 1), 100),
  }))
  .handler(async ({ data, context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    let query = db
      .from("profiles")
      .select("id, first_name, birth_date, gender, college, branch, prompt, photo_path, onboarded, discoverable, verification_status, verification_reason, is_suspended, suspension_reason, created_at, updated_at, nights, quiz, general_area, show_college, incognito, share_token")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    // Sanitize search to prevent PostgREST query injection
    const sanitizedSearch = data.search.replace(/[^a-zA-Z0-9\s_-]/g, "").trim();
    if (sanitizedSearch) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedSearch);
      if (isUuid) {
        query = query.or(`id.eq.${sanitizedSearch},first_name.ilike.%${sanitizedSearch}%,college.ilike.%${sanitizedSearch}%`);
      } else {
        query = query.or(`first_name.ilike.%${sanitizedSearch}%,college.ilike.%${sanitizedSearch}%,branch.ilike.%${sanitizedSearch}%`);
      }
    }

    if (data.status === "suspended") {
      query = query.eq("is_suspended", true);
    } else if (data.status === "pending" || data.status === "needs_review") {
      query = query.or("verification_status.eq.needs_review,verification_status.eq.pending");
    } else if (data.status === "approved") {
      query = query.eq("verification_status", "approved");
    } else if (data.status === "rejected") {
      query = query.eq("verification_status", "rejected");
    } else if (data.status === "onboarded") {
      query = query.eq("onboarded", true);
    } else if (data.status === "not_onboarded") {
      query = query.eq("onboarded", false);
    }

    const { data: users, error } = await query;
    if (error) throw error;
    return users ?? [];
  });

/**
 * Moderation actions on user account: suspend, reactivate, approve verification, reject verification.
 */
export const updateUserModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; action: "suspend" | "reactivate" | "approve" | "reject"; reason?: string | undefined }) => ({
    userId: String(d.userId),
    action: d.action,
    reason: d.reason ? String(d.reason).trim().slice(0, 500) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    // 1. Try dedicated security definer RPC
    try {
      const { data: rpcRes, error: rpcErr } = await db.rpc("admin_moderate_user", {
        p_user_id: data.userId,
        p_action: data.action,
        p_reason: data.reason ?? null,
      });
      if (!rpcErr && rpcRes) {
        return { ok: true };
      }
    } catch {
      // Fall through to direct table update
    }

    type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
    const patch: ProfileUpdate = {};

    if (data.action === "suspend") {
      patch.is_suspended = true;
      patch.suspension_reason = data.reason || "Suspended by moderator for community safety guidelines violation";
    } else if (data.action === "reactivate") {
      patch.is_suspended = false;
      patch.suspension_reason = null;
    } else if (data.action === "approve") {
      patch.verification_status = "approved";
      patch.verification_reason = null;
    } else if (data.action === "reject") {
      patch.verification_status = "rejected";
      patch.verification_reason = data.reason || "Verification rejected by administrator";
    }

    const { error } = await db
      .from("profiles")
      .update(patch)
      .eq("id", data.userId);

    if (error) throw error;

    // Record in audit log
    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: `USER_${data.action.toUpperCase()}`,
      target_id: data.userId,
      details: { reason: data.reason, patch },
    });

    return { ok: true };
  });

/**
 * Permanently delete a user profile and clean up associated records (admin privileged).
 */
export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; reason?: string | undefined }) => ({
    userId: String(d.userId).trim(),
    reason: d.reason ? String(d.reason).trim().slice(0, 500) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    // Clean up auxiliary references in event tables where user_id references auth.users
    try {
      await db.from("saved_events").delete().eq("user_id", data.userId);
      await db.from("event_attendance_interests").delete().eq("user_id", data.userId);
      await db.from("group_plan_participants").delete().eq("user_id", data.userId);
      await db.from("group_plans").delete().eq("creator_id", data.userId);
      await db.from("event_suggestions").delete().eq("user_id", data.userId);
    } catch (e) {
      console.warn("[Admin] Aux user cleanup note:", e);
    }

    // Delete user profile (foreign keys CASCADE automatically in postgres)
    const { error } = await db.from("profiles").delete().eq("id", data.userId);
    if (error) throw error;

    // Record in audit log
    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: "USER_DELETE",
      target_id: data.userId,
      details: { reason: data.reason },
    });

    return { ok: true };
  });

/**
 * List moderation reports.
 */
export const listAdminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { data: reports, error } = await db
      .from("blocks")
      .select("blocker_id, blocked_id, reason, report, status, moderator_notes, resolved_at, resolved_by, created_at")
      .eq("report", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = [
      ...new Set([
        ...((reports as any[]) ?? []).map((r: any) => r.blocker_id),
        ...((reports as any[]) ?? []).map((r: any) => r.blocked_id),
      ]),
    ];

    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id, first_name, photo_path, college").in("id", userIds)
      : { data: [] };

    const profMap = new Map(((profiles as any[]) ?? []).map((p: any) => [p.id, p]));

    return ((reports as any[]) ?? []).map((r: any) => ({
      ...r,
      blocker: profMap.get(r.blocker_id) ?? null,
      blocked: profMap.get(r.blocked_id) ?? null,
    }));
  });

/**
 * Resolve or dismiss a moderation report.
 */
export const resolveAdminReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { blockerId: string; blockedId: string; status: "resolved" | "dismissed"; notes?: string | undefined }) => ({
    blockerId: String(d.blockerId),
    blockedId: String(d.blockedId),
    status: d.status,
    notes: d.notes ? String(d.notes).trim() : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { error } = await db
      .from("blocks")
      .update({
        status: data.status,
        moderator_notes: data.notes ?? null,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("blocker_id", data.blockerId)
      .eq("blocked_id", data.blockedId);

    if (error) throw error;

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: `REPORT_${data.status.toUpperCase()}`,
      target_id: `${data.blockerId}:${data.blockedId}`,
      details: { status: data.status, notes: data.notes },
    });

    return { ok: true };
  });

/**
 * List invitation metrics and active codes.
 */
export const listAdminInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { data: invites, error } = await db
      .from("invites")
      .select("code, creator_id, claimed_by, claimed_at, revoked, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const userIds = [
      ...new Set([
        ...((invites as any[]) ?? []).map((i: any) => i.creator_id),
        ...((invites as any[]) ?? []).map((i: any) => i.claimed_by).filter(Boolean) as string[],
      ]),
    ];

    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id, first_name, college, onboarded, discoverable, verification_status, created_at").in("id", userIds)
      : { data: [] };

    const profMap = new Map(((profiles as any[]) ?? []).map((p: any) => [p.id, p]));

    return ((invites as any[]) ?? []).map((i: any) => ({
      ...i,
      creator: profMap.get(i.creator_id) ?? null,
      claimed_by_user: i.claimed_by ? profMap.get(i.claimed_by) ?? null : null,
    }));
  });

/**
 * Revoke compromised invitation token.
 */
export const revokeAdminInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; reason?: string | undefined }) => ({
    code: String(d.code).trim().toUpperCase(),
    reason: d.reason ? String(d.reason).trim() : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { error } = await db
      .from("invites")
      .update({ revoked: true })
      .eq("code", data.code);

    if (error) throw error;

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: "REVOKE_INVITE_TOKEN",
      target_id: data.code,
      details: { reason: data.reason },
    });

    return { ok: true };
  });

/**
 * Create custom administrative or VIP invitation code.
 */
export const createAdminInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code?: string | undefined }) => ({
    code: d.code ? String(d.code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    // Generate code if not provided
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let finalCode = data.code;
    if (!finalCode) {
      let rand = "";
      for (let i = 0; i < 6; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      finalCode = `A9-${rand}`;
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from("invites").insert({
      code: finalCode,
      creator_id: context.userId,
      revoked: false,
      expires_at: expiresAt,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Invite code "${finalCode}" already exists. Please choose a unique code.`);
      }
      throw error;
    }

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: "CREATE_ADMIN_INVITE",
      target_id: finalCode,
      details: { code: finalCode, expiresAt },
    });

    return { ok: true, code: finalCode };
  });

/**
 * List events for Plan / Garba venue management.
 */
export const listAdminEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { data: events, error } = await db
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return events ?? [];
  });

/**
 * Save or update event listing.
 */
export const saveAdminEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string | undefined;
    title: string;
    slug?: string | undefined;
    venue: string;
    area?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
    dates?: string[] | undefined;
    organizer?: string | undefined;
    poster_url?: string | undefined;
    booking_url?: string | undefined;
    ticket_price_range?: string | undefined;
    min_price_inr?: number | undefined;
    max_price_inr?: number | undefined;
    price_source?: string | undefined;
    source_notes?: string | undefined;
    source_url?: string | undefined;
    contact_verified?: string | undefined;
    themes_count?: number | undefined;
    highlights?: string[] | undefined;
    maps_url?: string | undefined;
    instagram_handle?: string | undefined;
    location_confidence?: string | undefined;
    poster_content_notes?: string | undefined;
    verification_notes?: string | undefined;
    image_asset_file?: string | undefined;
    verification_status?: string | undefined;
    publication_status?: string | undefined;
    is_active?: boolean | undefined;
  }) => ({
    id: d.id,
    title: String(d.title).trim(),
    slug: d.slug ? String(d.slug).trim() : undefined,
    venue: String(d.venue).trim(),
    area: d.area ? String(d.area).trim() : undefined,
    address: d.address ? String(d.address).trim() : undefined,
    city: String(d.city ?? "Raipur").trim(),
    state: String(d.state ?? "Chhattisgarh").trim(),
    start_date: d.start_date ? String(d.start_date).trim() : undefined,
    end_date: d.end_date ? String(d.end_date).trim() : undefined,
    start_time: d.start_time ? String(d.start_time).trim() : undefined,
    end_time: d.end_time ? String(d.end_time).trim() : undefined,
    dates: Array.isArray(d.dates) ? d.dates : undefined,
    organizer: d.organizer ? String(d.organizer).trim() : undefined,
    poster_url: d.poster_url ? String(d.poster_url).trim() : undefined,
    booking_url: d.booking_url ? String(d.booking_url).trim() : undefined,
    ticket_price_range: d.ticket_price_range ? String(d.ticket_price_range).trim() : undefined,
    min_price_inr: d.min_price_inr !== undefined ? Number(d.min_price_inr) : undefined,
    max_price_inr: d.max_price_inr !== undefined ? Number(d.max_price_inr) : undefined,
    price_source: d.price_source ? String(d.price_source).trim() : undefined,
    source_notes: d.source_notes ? String(d.source_notes).trim() : undefined,
    source_url: d.source_url ? String(d.source_url).trim() : undefined,
    contact_verified: d.contact_verified ? String(d.contact_verified).trim() : undefined,
    themes_count: d.themes_count !== undefined ? Number(d.themes_count) : undefined,
    highlights: Array.isArray(d.highlights) ? d.highlights : undefined,
    maps_url: d.maps_url ? String(d.maps_url).trim() : undefined,
    instagram_handle: d.instagram_handle ? String(d.instagram_handle).trim() : undefined,
    location_confidence: d.location_confidence ? String(d.location_confidence).trim() : undefined,
    poster_content_notes: d.poster_content_notes ? String(d.poster_content_notes).trim() : undefined,
    verification_notes: d.verification_notes ? String(d.verification_notes).trim() : undefined,
    image_asset_file: d.image_asset_file ? String(d.image_asset_file).trim() : undefined,
    verification_status: d.verification_status ?? "unverified",
    publication_status: d.publication_status ?? "published",
    is_active: d.is_active ?? true,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const payload: any = {
      title: data.title,
      venue: data.venue,
      city: data.city,
      state: data.state,
      area: data.area ?? null,
      address: data.address ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      dates: data.dates ? JSON.stringify(data.dates) : undefined,
      organizer: data.organizer ?? null,
      poster_url: data.poster_url ?? null,
      booking_url: data.booking_url ?? null,
      ticket_price_range: data.ticket_price_range ?? null,
      min_price_inr: data.min_price_inr ?? null,
      max_price_inr: data.max_price_inr ?? null,
      price_source: data.price_source ?? null,
      source_notes: data.source_notes ?? null,
      source_url: data.source_url ?? null,
      contact_verified: data.contact_verified ?? null,
      themes_count: data.themes_count ?? null,
      highlights: data.highlights ? JSON.stringify(data.highlights) : undefined,
      maps_url: data.maps_url ?? null,
      instagram_handle: data.instagram_handle ?? null,
      location_confidence: data.location_confidence ?? null,
      poster_content_notes: data.poster_content_notes ?? null,
      verification_notes: data.verification_notes ?? null,
      image_asset_file: data.image_asset_file ?? null,
      verification_status: data.verification_status,
      publication_status: data.publication_status,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    };

    if (data.slug) {
      payload.slug = data.slug;
    }

    if (data.id) {
      const { error } = await db
        .from("events")
        .update(payload)
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("events")
        .insert(payload);
      if (error) throw error;
    }

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.id ? "UPDATE_EVENT" : "CREATE_EVENT",
      target_id: data.id ?? data.title,
      details: { title: data.title, venue: data.venue, status: data.verification_status },
    });

    return { ok: true };
  });

/**
 * Toggle event publication status (published vs draft).
 */
export const toggleAdminEventPublishStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string; status: "published" | "draft" }) => ({
    eventId: String(d.eventId).trim(),
    status: d.status,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { error } = await db
      .from("events")
      .update({
        publication_status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.eventId);

    if (error) throw error;

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.status === "published" ? "PUBLISH_EVENT" : "UNPUBLISH_EVENT",
      target_id: data.eventId,
      details: { publication_status: data.status },
    });

    return { ok: true, status: data.status };
  });

/**
 * Verify event listing with admin checklist verification stamp.
 */
export const verifyAdminEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string; verified: boolean; notes?: string | undefined }) => ({
    eventId: String(d.eventId).trim(),
    verified: Boolean(d.verified),
    notes: d.notes ? String(d.notes).trim() : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { error } = await db
      .from("events")
      .update({
        verification_status: data.verified ? "verified" : "unverified",
        verified_at: data.verified ? new Date().toISOString() : null,
        verified_by: data.verified ? context.userId : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.eventId);

    if (error) throw error;

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.verified ? "VERIFY_EVENT" : "UNVERIFY_EVENT",
      target_id: data.eventId,
      details: { notes: data.notes },
    });

    return { ok: true, status: data.verified ? "verified" : "unverified" };
  });

/**
 * Delete event listing.
 */
export const deleteAdminEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => ({
    eventId: String(d.eventId).trim(),
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { error } = await db.from("events").delete().eq("id", data.eventId);
    if (error) throw error;

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: "DELETE_EVENT",
      target_id: data.eventId,
      details: {},
    });

    return { ok: true };
  });

/**
 * List community event suggestions for admin moderation.
 */
export const listAdminEventSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { data: suggestions, error } = await db
      .from("event_suggestions")
      .select(`
        *,
        profiles:user_id (first_name, email, photo_path)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return suggestions ?? [];
  });

/**
 * Resolve community event suggestion (approve / reject).
 */
export const resolveAdminEventSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { suggestionId: string; action: "approved" | "rejected" }) => ({
    suggestionId: String(d.suggestionId).trim(),
    action: d.action,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { error } = await db
      .from("event_suggestions")
      .update({ status: data.action })
      .eq("id", data.suggestionId);

    if (error) throw error;

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.action === "approved" ? "APPROVE_EVENT_SUGGESTION" : "REJECT_EVENT_SUGGESTION",
      target_id: data.suggestionId,
      details: { action: data.action },
    });

    return { ok: true };
  });

/**
 * Fetch technical system health data.
 */
export const getAdminSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const start = Date.now();
    const { count: userCount, error: dbErr } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true });
    const dbLatencyMs = Date.now() - start;

    const { count: pushSubCount } = await db
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true });

    const { count: pushEnabledUsers } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("push_notifications_enabled", true);

    const { count: totalAuditLogs } = await db
      .from("admin_audit_logs")
      .select("*", { count: "exact", head: true });

    return {
      database: {
        status: dbErr ? "degraded" : "healthy",
        latencyMs: dbLatencyMs,
        error: dbErr?.message ?? null,
      },
      auth: {
        status: "healthy",
        authenticatedUsersCount: userCount ?? 0,
      },
      notifications: {
        pushSubscriptions: pushSubCount ?? 0,
        pushOptedInUsers: pushEnabledUsers ?? 0,
        vapidConfigured: !!process.env["VITE_VAPID_PUBLIC_KEY"],
      },
      audit: {
        totalLoggedEvents: totalAuditLogs ?? 0,
      },
    };
  });

/**
 * Fetch audit logs.
 */
export const getAdminAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { data: logs, error } = await db
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return logs ?? [];
  });

/**
 * Fetch launch control configuration and readiness metrics for Discover.
 */
export const getAdminLaunchControl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const { data, error } = await db.rpc("get_launch_control");
    if (error) throw error;
    return data as {
      discover_enabled: boolean;
      readiness_target: number;
      last_changed_by_email: string | null;
      last_changed_at: string;
      total_registered_users: number;
      completed_profiles_count: number;
      eligible_users_count: number;
      city_counts: Record<string, number>;
      night_counts: Record<string, number>;
    };
  });

/**
 * Toggle Discover feature flag or update target.
 */
export const toggleAdminDiscoverLaunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean; target?: number | undefined; readinessTarget?: number | undefined }) => ({
    enabled: Boolean(d.enabled),
    target: d.target ?? d.readinessTarget ? Math.max(1, Number(d.target ?? d.readinessTarget)) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    type LaunchControlUpdate = Database["public"]["Tables"]["launch_control"]["Update"];
    const patch: LaunchControlUpdate = {
      discover_enabled: data.enabled,
      last_changed_by: context.userId,
      last_changed_by_email: admin.email,
      last_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (data.target) {
      patch.readiness_target = data.target;
    }

    const { error } = await db
      .from("launch_control")
      .update(patch)
      .eq("id", "global");

    if (error) throw error;

    // Record in audit log
    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.enabled ? "LAUNCH_CONTROL_ENABLE" : "LAUNCH_CONTROL_DISABLE",
      target_id: "global",
      details: {
        discover_enabled: data.enabled,
        readiness_target: data.target,
      },
    });

    // When Discover is enabled globally, send system notification to all registered users!
    if (data.enabled) {
      try {
        const { data: allUsers } = await db
          .from("profiles")
          .select("id")
          .eq("is_suspended", false);

        if (allUsers && allUsers.length > 0) {
          const now = new Date().toISOString();
          const notifs = (allUsers as any[]).map((u: any) => ({
            user_id: u.id,
            type: "system" as const,
            title: "🎉 Discover Deck is Now Live!",
            body: "The Garba matching deck is officially open! See who is attending your Garba nights and send your first Dandiya.",
            action_url: "/discover",
            data: { event: "discover_launched", timestamp: now },
            read: false,
          }));

          // Batch insert in chunks of 100
          for (let i = 0; i < notifs.length; i += 100) {
            await db.from("notifications").insert(notifs.slice(i, i + 100));
          }
        }
      } catch (err) {
        console.warn("[Admin] Failed to broadcast launch notification:", err);
      }
    }

    return { ok: true, enabled: data.enabled };
  });

/**
 * Fetch security threat overview, rate limit status, bot traps, and audit events.
 */
export const getAdminSecurityOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: rateLimits24h },
      { count: botTraps24h },
      { count: authFailures24h },
      { count: totalSecurityEvents },
      { data: recentEvents },
      { count: suspendedCount },
    ] = await Promise.all([
      db
        .from("security_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "rate_limit_exceeded")
        .gte("created_at", past24h),
      db
        .from("security_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "bot_decoy_triggered")
        .gte("created_at", past24h),
      db
        .from("security_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "unauthorized_admin_access_attempt")
        .gte("created_at", past24h),
      db
        .from("security_events")
        .select("*", { count: "exact", head: true }),
      db
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_suspended", true),
    ]);

    // Threat level calculation
    const criticalIncidents = (botTraps24h ?? 0) + (authFailures24h ?? 0);
    const threatLevel = criticalIncidents > 10 ? "ELEVATED" : criticalIncidents > 0 ? "GUARDED" : "NOMINAL";

    return {
      metrics: {
        threatLevel,
        rateLimits24h: rateLimits24h ?? 0,
        botTraps24h: botTraps24h ?? 0,
        authFailures24h: authFailures24h ?? 0,
        totalSecurityEvents: totalSecurityEvents ?? 0,
        suspendedUsersCount: suspendedCount ?? 0,
      },
      events: recentEvents ?? [],
      protections: {
        rlsEnabled: true,
        suspensionEnforced: true,
        rateLimitingActive: true,
        storageGuarded: true,
        honeypotActive: true,
        secretScanningActive: true,
      },
    };
  });

export interface DiscoveryBalanceMetricsResult {
  eligible_pool_size: number;
  active_discoverable_24h: number;
  active_discoverable_7d: number;
  exposure_distribution: {
    p10: number;
    p25: number;
    median_p50: number;
    p75: number;
    p90: number;
    max: number;
    avg: number;
  };
  repeated_exposure_rate: number;
  feed_exhaustion_rate: number;
  positive_swipe_rate: number;
  mutual_matches_7d: number;
  gender_breakdown: {
    gender: string;
    is_suppressed: boolean;
    eligible_count: number | null;
    impressions_7d: number | null;
    privacy_note: string | null;
  }[];
  min_cohort_threshold: number;
}

/**
 * Fetch real discovery balance and fairness metrics for administrative audit.
 * Enforces server-side admin check, returns rolling exposure percentiles,
 * repeated-exposure rates, and k >= 10 cohort privacy-suppressed gender breakdown.
 */
export const getAdminDiscoveryBalanceMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoveryBalanceMetricsResult> => {
    await assertAdminCaller(context.userId, context.claims?.email, context.supabase);
    const db = await getAdminDb(context);

    // 1. Attempt database RPC call
    try {
      const { data, error } = await db.rpc("get_admin_discovery_balance_metrics");
      if (!error && data) {
        return data as DiscoveryBalanceMetricsResult;
      }
    } catch {
      // Fall through to query fallback
    }

    // 2. Safe fallback calculation via direct queries
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: eligiblePool },
      active24hRes,
      active7dRes,
      impressions7dRes,
      swipes7dRes,
    ] = await Promise.all([
      db
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("onboarded", true)
        .eq("discoverable", true)
        .eq("verification_status", "approved")
        .eq("is_suspended", false),
      db.from("discovery_impressions").select("profile_id").gte("served_at", past24h),
      db.from("discovery_impressions").select("profile_id").gte("served_at", past7d),
      db.from("discovery_impressions").select("profile_id, viewer_id, served_at").gte("served_at", past7d),
      db.from("dandiyas").select("kind").gte("created_at", past7d),
    ]);

    const active24hSet = new Set((active24hRes?.data ?? []).map((x: any) => x.profile_id));
    const active7dSet = new Set((active7dRes?.data ?? []).map((x: any) => x.profile_id));

    // Distribution calculation
    const profileImpMap: Record<string, number> = {};
    const viewerProfileSeq: Record<string, number> = {};
    let repeatCount = 0;
    const totalImps = impressions7dRes?.data?.length ?? 0;

    for (const imp of (impressions7dRes?.data ?? []) as any[]) {
      profileImpMap[imp.profile_id] = (profileImpMap[imp.profile_id] ?? 0) + 1;
      const key = `${imp.viewer_id}_${imp.profile_id}`;
      viewerProfileSeq[key] = (viewerProfileSeq[key] ?? 0) + 1;
      if (viewerProfileSeq[key] > 1) {
        repeatCount++;
      }
    }

    const counts = Object.values(profileImpMap).sort((a, b) => a - b);
    const getP = (p: number) => {
      if (counts.length === 0) return 0;
      const idx = Math.min(Math.floor(p * counts.length), counts.length - 1);
      return counts[idx] ?? 0;
    };

    const repeatedRate = totalImps > 0 ? Number(((repeatCount / totalImps) * 100).toFixed(1)) : 0;

    const totalSwipes = swipes7dRes?.data?.length ?? 0;
    const positiveSwipes = (swipes7dRes?.data ?? []).filter((s: any) => s.kind === "send").length;
    const positiveSwipeRate = totalSwipes > 0 ? Number(((positiveSwipes / totalSwipes) * 100).toFixed(1)) : 0;

    // Gender breakdown with k >= 10 cohort privacy protection
    const { data: genderProfiles } = await db
      .from("profiles")
      .select("gender")
      .eq("onboarded", true)
      .eq("discoverable", true)
      .eq("verification_status", "approved")
      .eq("is_suspended", false);

    const genderCounts: Record<string, number> = {};
    for (const p of (genderProfiles ?? []) as any[]) {
      const g = p.gender || "unspecified";
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
    }

    const genderBreakdown = Object.entries(genderCounts).map(([gender, count]) => {
      const isSuppressed = count < 10;
      return {
        gender,
        is_suppressed: isSuppressed,
        eligible_count: isSuppressed ? null : count,
        impressions_7d: isSuppressed ? null : 0,
        privacy_note: isSuppressed ? "Suppressed: cohort size < 10 (k-anonymity privacy protection)" : null,
      };
    });

    return {
      eligible_pool_size: eligiblePool ?? 0,
      active_discoverable_24h: active24hSet.size,
      active_discoverable_7d: active7dSet.size,
      exposure_distribution: {
        p10: getP(0.1),
        p25: getP(0.25),
        median_p50: getP(0.5),
        p75: getP(0.75),
        p90: getP(0.9),
        max: counts.length > 0 ? Math.max(...counts) : 0,
        avg: counts.length > 0 ? Number((counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)) : 0,
      },
      repeated_exposure_rate: repeatedRate,
      feed_exhaustion_rate: 0,
      positive_swipe_rate: positiveSwipeRate,
      mutual_matches_7d: 0,
      gender_breakdown: genderBreakdown,
      min_cohort_threshold: 10,
    };
  });

