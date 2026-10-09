import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface AdminStatusResult {
  isAdmin: boolean;
  role: "super_admin" | "admin" | "moderator" | null;
  email: string | null;
  userId: string | null;
}

/**
 * Checks server-side authorization for admin dashboard.
 * Verifies caller against `public.admin_users` or server-configured ADMIN_EMAILS.
 */
export const checkAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStatusResult> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch user email from auth
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user?.email) {
      return { isAdmin: false, role: null, email: null, userId };
    }

    const email = userData.user.email.toLowerCase();

    // Check if user is in admin_users table
    const { data: adminRecord } = await supabaseAdmin
      .from("admin_users")
      .select("id, role, is_active")
      .or(`user_id.eq.${userId},email.eq.${email}`)
      .maybeSingle();

    if (adminRecord && adminRecord.is_active) {
      if (!adminRecord.id) {
        await supabaseAdmin
          .from("admin_users")
          .update({ user_id: userId })
          .eq("email", email);
      }
      return {
        isAdmin: true,
        role: adminRecord.role as any,
        email,
        userId,
      };
    }

    // Check environment variables ADMIN_EMAILS / ADMIN_EMAIL (comma separated)
    const rawEnv = [process.env["ADMIN_EMAILS"], process.env["ADMIN_EMAIL"]].filter(Boolean).join(",");
    const configuredAdminEmails = rawEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (configuredAdminEmails.includes(email)) {
      // Bootstrap super_admin into admin_users table
      await supabaseAdmin.from("admin_users").upsert(
        {
          user_id: userId,
          email,
          role: "super_admin",
          is_active: true,
        },
        { onConflict: "email" }
      );

      // Log initial bootstrap
      await supabaseAdmin.from("admin_audit_logs").insert({
        actor_id: userId,
        actor_email: email,
        action: "BOOTSTRAP_SUPER_ADMIN",
        target_id: userId,
        details: { note: "Provisioned via ADMIN_EMAILS env variable" },
      });

      return {
        isAdmin: true,
        role: "super_admin",
        email,
        userId,
      };
    }

    return { isAdmin: false, role: null, email, userId };
  });

/**
 * Server middleware helper that asserts admin status before executing privileged functions.
 */
async function assertAdminCaller(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = (userData?.user?.email ?? "").toLowerCase();

  const { data: adminRecord } = await supabaseAdmin
    .from("admin_users")
    .select("role, is_active")
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .maybeSingle();

  if (adminRecord?.is_active) {
    return { email, role: adminRecord.role };
  }

  const rawEnv = [process.env["ADMIN_EMAILS"], process.env["ADMIN_EMAIL"]].filter(Boolean).join(",");
  const configuredAdminEmails = rawEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email && configuredAdminEmails.includes(email)) {
    return { email, role: "super_admin" };
  }

  throw new Error("Unauthorized: Administrator privileges required.");
}

/**
 * Fetch real aggregate metrics for the admin overview.
 */
export const getAdminOverviewMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("onboarded", true),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("discoverable", true).eq("onboarded", true),
      supabaseAdmin.from("dandiyas").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("messages").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("blocks").select("*", { count: "exact", head: true }).eq("report", true).eq("status", "pending"),
      supabaseAdmin.from("invites").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("invites").select("*", { count: "exact", head: true }).not("claimed_by", "is", null),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", past24h),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", past7d),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", past30d),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", past24h),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", past7d),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).not("invited_by", "is", null),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).not("invited_by", "is", null).eq("onboarded", true),
      supabaseAdmin.from("events").select("*", { count: "exact", head: true }).eq("verification_status", "verified"),
      supabaseAdmin.from("events").select("*", { count: "exact", head: true }).eq("verification_status", "unverified"),
      supabaseAdmin.from("events").select("*", { count: "exact", head: true }).eq("verification_status", "expired"),
      supabaseAdmin.rpc("get_launch_control"),
    ]);

    // Calculate mutual matches count
    const { data: sends } = await supabaseAdmin.from("dandiyas").select("from_id, to_id").eq("kind", "send");
    let mutualMatches = 0;
    if (sends) {
      const sendSet = new Set(sends.map((s) => `${s.from_id}:${s.to_id}`));
      for (const s of sends) {
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
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, first_name, birth_date, gender, college, branch, prompt, photo_path, onboarded, discoverable, verification_status, verification_reason, is_suspended, suspension_reason, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.search) {
      query = query.or(`first_name.ilike.%${data.search}%,college.ilike.%${data.search}%,branch.ilike.%${data.search}%`);
    }

    if (data.status === "suspended") {
      query = query.eq("is_suspended", true);
    } else if (data.status === "pending") {
      query = query.eq("verification_status", "pending");
    } else if (data.status === "approved") {
      query = query.eq("verification_status", "approved");
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
    const admin = await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", data.userId);

    if (error) throw error;

    // Record in audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: `USER_${data.action.toUpperCase()}`,
      target_id: data.userId,
      details: { reason: data.reason, patch },
    });

    return { ok: true };
  });

/**
 * List moderation reports.
 */
export const listAdminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reports, error } = await supabaseAdmin
      .from("blocks")
      .select("blocker_id, blocked_id, reason, report, status, moderator_notes, resolved_at, resolved_by, created_at")
      .eq("report", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = [
      ...new Set([
        ...(reports ?? []).map((r) => r.blocker_id),
        ...(reports ?? []).map((r) => r.blocked_id),
      ]),
    ];

    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, first_name, photo_path, college").in("id", userIds)
      : { data: [] };

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (reports ?? []).map((r) => ({
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
    const admin = await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
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

    await supabaseAdmin.from("admin_audit_logs").insert({
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
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invites, error } = await supabaseAdmin
      .from("invites")
      .select("code, creator_id, claimed_by, claimed_at, revoked, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const userIds = [
      ...new Set([
        ...(invites ?? []).map((i) => i.creator_id),
        ...(invites ?? []).map((i) => i.claimed_by).filter(Boolean) as string[],
      ]),
    ];

    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, first_name, college, onboarded, discoverable, verification_status, created_at").in("id", userIds)
      : { data: [] };

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (invites ?? []).map((i) => ({
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
    const admin = await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("invites")
      .update({ revoked: true })
      .eq("code", data.code);

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: "REVOKE_INVITE_TOKEN",
      target_id: data.code,
      details: { reason: data.reason },
    });

    return { ok: true };
  });

/**
 * List events for Plan / Garba venue management.
 */
export const listAdminEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: events, error } = await supabaseAdmin
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
    venue: string;
    city?: string | undefined;
    organizer?: string | undefined;
    booking_url?: string | undefined;
    ticket_price_range?: string | undefined;
    price_source?: string | undefined;
    verification_status?: "verified" | "unverified" | "expired" | undefined;
    is_active?: boolean | undefined;
  }) => ({
    id: d.id,
    title: String(d.title).trim(),
    venue: String(d.venue).trim(),
    city: String(d.city ?? "Raipur").trim(),
    organizer: d.organizer ? String(d.organizer).trim() : undefined,
    booking_url: d.booking_url ? String(d.booking_url).trim() : undefined,
    ticket_price_range: d.ticket_price_range ? String(d.ticket_price_range).trim() : undefined,
    price_source: d.price_source ? String(d.price_source).trim() : undefined,
    verification_status: d.verification_status ?? "unverified",
    is_active: d.is_active ?? true,
  }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("events")
        .update({
          title: data.title,
          venue: data.venue,
          city: data.city,
          organizer: data.organizer ?? null,
          booking_url: data.booking_url ?? null,
          ticket_price_range: data.ticket_price_range ?? null,
          price_source: data.price_source ?? null,
          verification_status: data.verification_status,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("events")
        .insert({
          title: data.title,
          venue: data.venue,
          city: data.city,
          organizer: data.organizer ?? null,
          booking_url: data.booking_url ?? null,
          ticket_price_range: data.ticket_price_range ?? null,
          price_source: data.price_source ?? null,
          verification_status: data.verification_status,
          is_active: data.is_active,
        });
      if (error) throw error;
    }

    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.id ? "UPDATE_EVENT" : "CREATE_EVENT",
      target_id: data.id ?? data.title,
      details: { title: data.title, venue: data.venue },
    });

    return { ok: true };
  });

/**
 * Fetch technical system health data.
 */
export const getAdminSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const start = Date.now();
    const { count: userCount, error: dbErr } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true });
    const dbLatencyMs = Date.now() - start;

    const { count: pushSubCount } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true });

    const { count: pushEnabledUsers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("push_notifications_enabled", true);

    const { count: totalAuditLogs } = await supabaseAdmin
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
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: logs, error } = await supabaseAdmin
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
    await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin.rpc("get_launch_control");
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
    const admin = await assertAdminCaller(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const { error } = await supabaseAdmin
      .from("launch_control")
      .update(patch)
      .eq("id", "global");

    if (error) throw error;

    // Record in audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_email: admin.email,
      action: data.enabled ? "LAUNCH_CONTROL_ENABLE" : "LAUNCH_CONTROL_DISABLE",
      target_id: "global",
      details: {
        discover_enabled: data.enabled,
        readiness_target: data.target,
      },
    });

    return { ok: true, enabled: data.enabled };
  });
