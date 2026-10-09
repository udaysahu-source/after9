import { supabase } from "@/integrations/supabase/client";

export type LaunchEventName =
  | "invite_shared"
  | "referral_registered"
  | "profile_completed"
  | "night_selected"
  | "discovery_opened"
  | "eligible_returned"
  | "dandiya_sent"
  | "match_created";

/** Safe, privacy-conscious event logger */
export async function trackEvent(
  eventName: LaunchEventName,
  properties: Record<string, unknown> = {}
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    await supabase.rpc("track_launch_event", {
      event_name: eventName,
      properties: properties as any,
    });
  } catch (err) {
    // Telemetry is non-blocking
    console.debug(`[Analytics] failed to track ${eventName}:`, err);
  }
}

/** Convenience tracker helpers */
export const Analytics = {
  inviteShared: (method: "whatsapp" | "native" | "copy" | "card") =>
    trackEvent("invite_shared", { method }),

  referralRegistered: (code: string) =>
    trackEvent("referral_registered", { code: code.slice(0, 8) }),

  profileCompleted: () =>
    trackEvent("profile_completed", {}),

  nightSelected: (night: number | null) =>
    trackEvent("night_selected", { night: night ?? "all" }),

  discoveryOpened: (state: string, eligibleCount: number, night: number | null) =>
    trackEvent("discovery_opened", { state, eligibleCount, night: night ?? "all" }),

  eligibleReturned: (count: number) =>
    trackEvent("eligible_returned", { count }),

  dandiyaSent: (kind: "send" | "pass") =>
    trackEvent("dandiya_sent", { kind }),

  matchCreated: () =>
    trackEvent("match_created", {}),
};
