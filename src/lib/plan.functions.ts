import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRateLimit } from "./security-rate-limiter";
import { supabase as clientSupabase } from "@/integrations/supabase/client";

/**
 * Validates that an external URL is a safe HTTPS destination.
 * Rejects non-HTTPS schemes (javascript:, data:, file:) and SSRF/local network targets.
 */
export function isSafeHttpsUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://")) return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export interface PlanEventItem {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  venue: string;
  area: string | null;
  address: string | null;
  city: string;
  state: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  dates: string[];
  organizer: string | null;
  poster_url: string | null;
  themes_count: number | null;
  highlights: string[];
  additional_programs: any[];
  contact_verified: string | null;
  entry_rules: string[];
  pass_categories: any[];
  min_price_inr: number | null;
  max_price_inr: number | null;
  ticket_price_range: string | null;
  booking_url: string | null;
  has_valid_booking_url: boolean;
  price_source: string | null;
  verification_status: string;
  publication_status: string;
  is_saved?: boolean;
}

/**
 * Fetch published events with day-wise filtering, locality search, and sorting.
 */
export const listPublicEvents = createServerFn({ method: "GET" })
  .validator((input?: {
    date?: string | undefined;
    city?: string | undefined;
    query?: string | undefined;
    verifiedOnly?: boolean | undefined;
    maxBudget?: number | undefined;
    sortBy?: "time" | "price" | "name" | "date" | undefined;
  }) => ({
    date: input?.date ? String(input.date).trim() : undefined,
    city: input?.city ? String(input.city).trim() : "Raipur",
    query: input?.query ? String(input.query).trim().toLowerCase() : undefined,
    verifiedOnly: Boolean(input?.verifiedOnly),
    maxBudget: input?.maxBudget ? Number(input.maxBudget) : undefined,
    sortBy: input?.sortBy ?? "time",
  }))
  .handler(async ({ data }): Promise<PlanEventItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin ?? clientSupabase;

    let q = db
      .from("events")
      .select("*")
      .eq("is_active", true)
      .eq("publication_status", "published");

    if (data.city) {
      q = q.ilike("city", data.city);
    }

    if (data.verifiedOnly) {
      q = q.eq("verification_status", "verified");
    }

    const { data: rows, error } = await q;
    if (error) {
      console.warn("[Plan] Failed to load events:", error.message);
      return [];
    }

    let items: PlanEventItem[] = (rows ?? []).map((r: any) => {
      let datesArr: string[] = [];
      if (Array.isArray(r.dates)) {
        datesArr = r.dates.map(String);
      } else if (r.start_date && r.end_date) {
        datesArr = [r.start_date, r.end_date];
      }

      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        venue: r.venue,
        area: r.area,
        address: r.address,
        city: r.city,
        state: r.state || "Chhattisgarh",
        start_date: r.start_date,
        end_date: r.end_date,
        start_time: r.start_time,
        end_time: r.end_time,
        dates: datesArr,
        organizer: r.organizer,
        poster_url: r.poster_url,
        themes_count: r.themes_count,
        highlights: Array.isArray(r.highlights) ? r.highlights : [],
        additional_programs: Array.isArray(r.additional_programs) ? r.additional_programs : [],
        contact_verified: r.contact_verified,
        entry_rules: Array.isArray(r.entry_rules) ? r.entry_rules : [],
        pass_categories: Array.isArray(r.pass_categories) ? r.pass_categories : [],
        min_price_inr: r.min_price_inr !== null ? Number(r.min_price_inr) : null,
        max_price_inr: r.max_price_inr !== null ? Number(r.max_price_inr) : null,
        ticket_price_range: r.ticket_price_range,
        booking_url: r.booking_url,
        has_valid_booking_url: isSafeHttpsUrl(r.booking_url),
        price_source: r.price_source,
        verification_status: r.verification_status,
        publication_status: r.publication_status,
      };
    });

    // 1. Day-wise date filter: multi-day events must appear on each applicable day
    if (data.date) {
      const selected = data.date;
      items = items.filter((ev) => {
        if (ev.dates.includes(selected)) return true;
        if (ev.start_date && ev.end_date) {
          return selected >= ev.start_date && selected <= ev.end_date;
        }
        return false;
      });
    }

    // 2. Search query across name, venue, locality/area, organizer
    if (data.query) {
      const q = data.query;
      items = items.filter((ev) => {
        return (
          ev.title.toLowerCase().includes(q) ||
          ev.venue.toLowerCase().includes(q) ||
          (ev.area && ev.area.toLowerCase().includes(q)) ||
          (ev.organizer && ev.organizer.toLowerCase().includes(q))
        );
      });
    }

    // 3. Budget filter (only filters when confirmed prices exist)
    if (data.maxBudget !== undefined && !isNaN(data.maxBudget)) {
      const mb = data.maxBudget;
      items = items.filter((ev) => {
        if (ev.min_price_inr !== null) {
          return ev.min_price_inr <= mb;
        }
        return true; // Keep unknown price events unless user explicitly excludes
      });
    }

    // 4. Sorting
    items.sort((a, b) => {
      if (data.sortBy === "price") {
        const pA = a.min_price_inr ?? 999999;
        const pB = b.min_price_inr ?? 999999;
        return pA - pB;
      }
      if (data.sortBy === "name") {
        return a.title.localeCompare(b.title);
      }
      if (data.sortBy === "date") {
        return (a.start_date || "").localeCompare(b.start_date || "");
      }
      // Default chronological / start time
      const tA = a.start_time || "20:00";
      const tB = b.start_time || "20:00";
      return tA.localeCompare(tB);
    });

    return items;
  });

/**
 * Fetch single event details by ID or Slug.
 */
export const getEventDetail = createServerFn({ method: "GET" })
  .validator((input: { idOrSlug: string; userId?: string | undefined }) => ({
    idOrSlug: String(input.idOrSlug).trim(),
    userId: input.userId ? String(input.userId).trim() : undefined,
  }))
  .handler(async ({ data }): Promise<{ event: PlanEventItem | null; isSaved: boolean; attendanceStatus: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin ?? clientSupabase;

    // Search by UUID or by slug
    let query = db.from("events").select("*").eq("is_active", true);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.idOrSlug);
    if (isUuid) {
      query = query.eq("id", data.idOrSlug);
    } else {
      query = query.eq("slug", data.idOrSlug);
    }

    const { data: row, error } = await query.maybeSingle();
    if (error || !row) return { event: null, isSaved: false, attendanceStatus: null };

    let isSaved = false;
    let attendanceStatus: string | null = null;

    if (data.userId) {
      const [{ data: savedRow }, { data: interestRow }] = await Promise.all([
        db.from("saved_events").select("id").eq("user_id", data.userId).eq("event_id", row.id).maybeSingle(),
        db.from("event_attendance_interests").select("status").eq("user_id", data.userId).eq("event_id", row.id).maybeSingle(),
      ]);
      isSaved = !!savedRow;
      attendanceStatus = interestRow?.status ?? null;
    }

    const datesArr = Array.isArray(row.dates)
      ? row.dates.map(String)
      : row.start_date && row.end_date
      ? [row.start_date, row.end_date]
      : [];

    return {
      event: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        venue: row.venue,
        area: row.area,
        address: row.address,
        city: row.city,
        state: row.state || "Chhattisgarh",
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        dates: datesArr,
        organizer: row.organizer,
        poster_url: row.poster_url,
        themes_count: row.themes_count,
        highlights: Array.isArray(row.highlights) ? row.highlights : [],
        additional_programs: Array.isArray(row.additional_programs) ? row.additional_programs : [],
        contact_verified: row.contact_verified,
        entry_rules: Array.isArray(row.entry_rules) ? row.entry_rules : [],
        pass_categories: Array.isArray(row.pass_categories) ? row.pass_categories : [],
        min_price_inr: row.min_price_inr !== null ? Number(row.min_price_inr) : null,
        max_price_inr: row.max_price_inr !== null ? Number(row.max_price_inr) : null,
        ticket_price_range: row.ticket_price_range,
        booking_url: row.booking_url,
        has_valid_booking_url: isSafeHttpsUrl(row.booking_url),
        price_source: row.price_source,
        verification_status: row.verification_status,
        publication_status: row.publication_status,
      },
      isSaved,
      attendanceStatus,
    };
  });

/**
 * Toggle saving an event for the user's personal Navratri itinerary.
 */
export const toggleSaveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string }) => ({
    eventId: String(d.eventId).trim(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check if already saved
    const { data: existing } = await supabase
      .from("saved_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_id", data.eventId)
      .maybeSingle();

    if (existing) {
      await supabase.from("saved_events").delete().eq("id", existing.id);
      return { saved: false };
    } else {
      await supabase.from("saved_events").insert({
        user_id: userId,
        event_id: data.eventId,
      });
      return { saved: true };
    }
  });

/**
 * List all saved events in user's personal itinerary with full event info.
 */
export const listMySavedEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ saved_at: string; event: PlanEventItem }[]> => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("saved_events")
      .select(`
        created_at,
        events:event_id (*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !rows) return [];

    return rows
      .filter((r: any) => r.events && r.events.is_active)
      .map((r: any) => {
        const ev = r.events;
        const datesArr = Array.isArray(ev.dates)
          ? ev.dates.map(String)
          : ev.start_date && ev.end_date
          ? [ev.start_date, ev.end_date]
          : [];

        return {
          saved_at: r.created_at,
          event: {
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            description: ev.description,
            venue: ev.venue,
            area: ev.area,
            address: ev.address,
            city: ev.city,
            state: ev.state || "Chhattisgarh",
            start_date: ev.start_date,
            end_date: ev.end_date,
            start_time: ev.start_time,
            end_time: ev.end_time,
            dates: datesArr,
            organizer: ev.organizer,
            poster_url: ev.poster_url,
            themes_count: ev.themes_count,
            highlights: Array.isArray(ev.highlights) ? ev.highlights : [],
            additional_programs: Array.isArray(ev.additional_programs) ? ev.additional_programs : [],
            contact_verified: ev.contact_verified,
            entry_rules: Array.isArray(ev.entry_rules) ? ev.entry_rules : [],
            pass_categories: Array.isArray(ev.pass_categories) ? ev.pass_categories : [],
            min_price_inr: ev.min_price_inr !== null ? Number(ev.min_price_inr) : null,
            max_price_inr: ev.max_price_inr !== null ? Number(ev.max_price_inr) : null,
            ticket_price_range: ev.ticket_price_range,
            booking_url: ev.booking_url,
            has_valid_booking_url: isSafeHttpsUrl(ev.booking_url),
            price_source: ev.price_source,
            verification_status: ev.verification_status,
            publication_status: ev.publication_status,
            is_saved: true,
          },
        };
      });
  });

/**
 * Create a group plan associated with an event.
 */
export const createGroupPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    eventId: string;
    planDate: string;
    proposedTime?: string | undefined;
    meetingPoint?: string | undefined;
    notes?: string | undefined;
    invitedUserIds: string[];
  }) => ({
    eventId: String(d.eventId).trim(),
    planDate: String(d.planDate).trim(),
    proposedTime: d.proposedTime ? String(d.proposedTime).trim() : undefined,
    meetingPoint: d.meetingPoint ? String(d.meetingPoint).trim() : "Main Entrance / Ticket Counter",
    notes: d.notes ? String(d.notes).trim() : undefined,
    invitedUserIds: Array.isArray(d.invitedUserIds) ? d.invitedUserIds.filter(Boolean) : [],
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await assertRateLimit({
      action: "create_group_plan",
      maxAttempts: 10,
      windowSeconds: 3600,
      userId,
    });

    // 1. Create the plan record
    const { data: plan, error: planErr } = await supabase
      .from("group_plans")
      .insert({
        creator_id: userId,
        event_id: data.eventId,
        plan_date: data.planDate,
        proposed_time: data.proposedTime ?? "20:00",
        meeting_point: data.meetingPoint,
        notes: data.notes ?? null,
        status: data.invitedUserIds.length > 0 ? "awaiting_responses" : "confirmed",
        safety_acknowledged: true,
      })
      .select()
      .single();

    if (planErr || !plan) {
      throw new Error(planErr?.message || "Failed to create group plan.");
    }

    // 2. Add creator as accepted participant
    await supabase.from("group_plan_participants").insert({
      plan_id: plan.id,
      user_id: userId,
      status: "accepted",
      responded_at: new Date().toISOString(),
    });

    // 3. Add invitees with "invited" status
    if (data.invitedUserIds.length > 0) {
      const participantRows = data.invitedUserIds
        .filter((uid) => uid !== userId)
        .map((uid) => ({
          plan_id: plan.id,
          user_id: uid,
          status: "invited",
        }));

      if (participantRows.length > 0) {
        await supabase.from("group_plan_participants").insert(participantRows);
      }
    }

    return { planId: plan.id, status: plan.status };
  });

/**
 * List all group plans where current user is creator or participant.
 */
export const listMyGroupPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Plans user is in
    const { data: participantRows } = await supabase
      .from("group_plan_participants")
      .select("plan_id, status")
      .eq("user_id", userId);

    const planIds = (participantRows ?? []).map((p: any) => p.plan_id);
    if (planIds.length === 0) return [];

    const { data: plans, error } = await supabase
      .from("group_plans")
      .select(`
        *,
        events:event_id (*),
        participants:group_plan_participants (
          user_id,
          status,
          responded_at,
          profiles:user_id (first_name, photo_path)
        )
      `)
      .in("id", planIds)
      .order("plan_date", { ascending: true });

    if (error || !plans) return [];
    return plans;
  });

/**
 * Respond to group plan invitation (accept / decline / leave).
 */
export const respondToGroupPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { planId: string; response: "accepted" | "declined" | "left" }) => ({
    planId: String(d.planId).trim(),
    response: d.response,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("group_plan_participants")
      .update({
        status: data.response,
        responded_at: new Date().toISOString(),
      })
      .eq("plan_id", data.planId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    // If all participants accepted, confirm plan
    const { data: allParticipants } = await supabase
      .from("group_plan_participants")
      .select("status")
      .eq("plan_id", data.planId);

    if (allParticipants && allParticipants.length > 0) {
      const allAccepted = allParticipants.every((p: any) => p.status === "accepted");
      if (allAccepted) {
        await supabase
          .from("group_plans")
          .update({ status: "confirmed", updated_at: new Date().toISOString() })
          .eq("id", data.planId);
      }
    }

    return { success: true };
  });

/**
 * Community user suggestion for missing Garba events.
 */
export const submitEventSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    name: string;
    city?: string | undefined;
    dates: string;
    venue: string;
    organizer?: string | undefined;
    sourceLink?: string | undefined;
    notes?: string | undefined;
  }) => ({
    name: String(d.name).trim().slice(0, 150),
    city: String(d.city ?? "Raipur").trim().slice(0, 50),
    dates: String(d.dates).trim().slice(0, 100),
    venue: String(d.venue).trim().slice(0, 200),
    organizer: d.organizer ? String(d.organizer).trim().slice(0, 150) : undefined,
    sourceLink: d.sourceLink ? String(d.sourceLink).trim().slice(0, 300) : undefined,
    notes: d.notes ? String(d.notes).trim().slice(0, 500) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await assertRateLimit({
      action: "suggest_event",
      maxAttempts: 5,
      windowSeconds: 3600,
      userId,
    });

    if (data.sourceLink && !isSafeHttpsUrl(data.sourceLink)) {
      throw new Error("Source URL must be a valid secure HTTPS link.");
    }

    const { error } = await supabase.from("event_suggestions").insert({
      user_id: userId,
      name: data.name,
      city: data.city,
      dates: data.dates,
      venue: data.venue,
      organizer: data.organizer ?? null,
      source_link: data.sourceLink ?? null,
      notes: data.notes ?? null,
      status: "pending",
    });

    if (error) throw new Error(error.message);
    return { success: true, message: "Event suggested! Our team will verify and publish it." };
  });

/**
 * Voluntary Attendance Interest with explicit privacy control.
 */
export const setAttendanceInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    eventId: string;
    status: "interested" | "going" | "none";
    visibility?: "mutual_matches" | "friends" | "private" | undefined;
  }) => ({
    eventId: String(d.eventId).trim(),
    status: d.status,
    visibility: d.visibility ?? "mutual_matches",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.status === "none") {
      await supabase
        .from("event_attendance_interests")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", data.eventId);
      return { status: null };
    }

    const { error } = await supabase.from("event_attendance_interests").upsert({
      user_id: userId,
      event_id: data.eventId,
      status: data.status,
      visibility: data.visibility,
    }, { onConflict: "user_id,event_id" });

    if (error) throw new Error(error.message);
    return { status: data.status, visibility: data.visibility };
  });
