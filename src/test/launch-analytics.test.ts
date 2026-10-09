import { describe, expect, it, vi, beforeEach } from "vitest";
import { Analytics, trackEvent } from "@/lib/launch-analytics";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("Launch Analytics Tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.rpc as any).mockResolvedValue({ data: true, error: null });
  });

  it("tracks invite_shared with method", async () => {
    await Analytics.inviteShared("whatsapp");
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "invite_shared",
      properties: { method: "whatsapp" },
    });

    await Analytics.inviteShared("copy");
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "invite_shared",
      properties: { method: "copy" },
    });
  });

  it("tracks referral_registered safely without full sensitive details", async () => {
    await Analytics.referralRegistered("A9-TEST1234");
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "referral_registered",
      properties: { code: "A9-TEST1" },
    });
  });

  it("tracks profile_completed", async () => {
    await Analytics.profileCompleted();
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "profile_completed",
      properties: {},
    });
  });

  it("tracks night_selected with night or all", async () => {
    await Analytics.nightSelected(5);
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "night_selected",
      properties: { night: 5 },
    });

    await Analytics.nightSelected(null);
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "night_selected",
      properties: { night: "all" },
    });
  });

  it("tracks discovery_opened with state, count, and night", async () => {
    await Analytics.discoveryOpened("zero_users", 0, null);
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "discovery_opened",
      properties: { state: "zero_users", eligibleCount: 0, night: "all" },
    });

    await Analytics.discoveryOpened("normal", 4, 3);
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "discovery_opened",
      properties: { state: "normal", eligibleCount: 4, night: 3 },
    });
  });

  it("tracks eligible_returned count", async () => {
    await Analytics.eligibleReturned(8);
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "eligible_returned",
      properties: { count: 8 },
    });
  });

  it("tracks dandiya_sent action kind", async () => {
    await Analytics.dandiyaSent("send");
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "dandiya_sent",
      properties: { kind: "send" },
    });

    await Analytics.dandiyaSent("pass");
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "dandiya_sent",
      properties: { kind: "pass" },
    });
  });

  it("tracks match_created", async () => {
    await Analytics.matchCreated();
    expect(supabase.rpc).toHaveBeenCalledWith("track_launch_event", {
      event_name: "match_created",
      properties: {},
    });
  });

  it("does not throw or break the app when RPC fails", async () => {
    (supabase.rpc as any).mockRejectedValue(new Error("Network disconnect"));

    await expect(trackEvent("discovery_opened", {})).resolves.toBeUndefined();
  });
});
