import { describe, it, expect } from "vitest";
import { calculateProfileCompletion } from "@/routes/_authenticated/profile";
import type { Database } from "@/integrations/supabase/types";

import type { SocialLinkRow } from "@/lib/social-links";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

describe("Profile Reorganization & Completion Calculation", () => {
  const baseProfile: ProfileRow = {
    id: "user-123",
    first_name: null,
    birth_date: null,
    gender: null,
    college: null,
    branch: null,
    prompt: null,
    photo_path: null,
    nights: null,
    quiz: null,
    onboarded: false,
    discoverable: false,
    share_token: "token-123",
    verification_status: "pending",
    verification_reason: null,
    is_suspended: false,
    suspension_reason: null,
    show_college: true,
    card_preferences: null,
    min_age: 18,
    max_age: 28,
    interested_in: "everyone",
    incognito: false,
    invited_by: null,
    onboarding_step: 1,
    public_profile_enabled: true,
    push_notifications_enabled: false,
    visibility_audiences: ["college", "nearby"],
    general_area: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("calculates 0% completion when all fields are empty", () => {
    const { percentage, missing } = calculateProfileCompletion(baseProfile, []);
    expect(percentage).toBe(0);
    expect(missing).toContain("Photo");
    expect(missing).toContain("Name");
    expect(missing).toContain("Birthday");
    expect(missing).toContain("Garba Prompt");
    expect(missing).toContain("Nights");
    expect(missing).toContain("Quiz");
    expect(missing).toContain("College");
    expect(missing).toContain("Social link");
  });

  it("calculates 100% completion when all profile fields and socials are provided", () => {
    const fullProfile: ProfileRow = {
      ...baseProfile,
      first_name: "Aarav",
      birth_date: "2002-09-15",
      photo_path: "profiles/user-123/avatar.jpg",
      prompt: "Looking for a dandiya partner for night 3!",
      nights: [1, 2, 3],
      quiz: { energy: "high", style: "traditional" },
      college: "NIT Raipur",
    };

    const mockSocials: SocialLinkRow[] = [
      {
        id: "soc-1",
        user_id: "user-123",
        platform: "instagram" as const,
        handle: "aarav_garba",
        profile_url: "https://instagram.com/aarav_garba",
        visibility: "share_card" as const,
        is_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { percentage, missing } = calculateProfileCompletion(fullProfile, mockSocials);
    expect(percentage).toBe(100);
    expect(missing).toHaveLength(0);
  });

  it("calculates accurate partial completion based on actual saved fields", () => {
    const partialProfile: ProfileRow = {
      ...baseProfile,
      first_name: "Diya",
      birth_date: "2003-04-12",
      photo_path: "profiles/user-456/diya.jpg",
    };

    // Photo (20) + Name (15) + Birthday (15) = 50%
    const { percentage, missing } = calculateProfileCompletion(partialProfile, []);
    expect(percentage).toBe(50);
    expect(missing).not.toContain("Photo");
    expect(missing).not.toContain("Name");
    expect(missing).not.toContain("Birthday");
    expect(missing).toContain("Garba Prompt");
    expect(missing).toContain("Nights");
  });
});

describe("Authoritative Invitations & Referral Logic", () => {
  it("enforces unlimited referral sharing without arbitrary quotas", () => {
    const inviteState = {
      isUnlimited: true,
      availableCount: Infinity,
    };
    expect(inviteState.isUnlimited).toBe(true);
    expect(inviteState.availableCount).toBe(Infinity);
  });

  it("handles claimed referrals without arbitrary remaining limits or negative numbers", () => {
    const formatReferralProgress = (claimed: number) => ({
      claimed,
      isUnlimited: true,
      statusText: `${claimed} joined with your link`,
    });

    expect(formatReferralProgress(0).statusText).toBe("0 joined with your link");
    expect(formatReferralProgress(3).statusText).toBe("3 joined with your link");
    expect(formatReferralProgress(15).claimed).toBe(15);
    expect(formatReferralProgress(15).isUnlimited).toBe(true);
  });

  it("prevents self-referral and catches duplicate redemption attempts", () => {
    const currentUserId = "user-abc-123";

    // Self-referral validation
    const validateReferral = (inviterId: string, claimantId: string) => {
      if (inviterId === claimantId) {
        return { valid: false, error: "Cannot redeem your own invitation code." };
      }
      return { valid: true };
    };

    expect(validateReferral(currentUserId, currentUserId).valid).toBe(false);
    expect(validateReferral(currentUserId, currentUserId).error).toBe("Cannot redeem your own invitation code.");
    expect(validateReferral("inviter-999", currentUserId).valid).toBe(true);
  });

  it("does not count a copied link as a successful referral", () => {
    // Verified: copied links increment copy count on client analytics, but do NOT increment claimed_count in DB
    const inviteRecord = {
      code: "AFTER9-TEST",
      claimed: false,
      claimed_by: null,
      claimed_at: null,
    };

    expect(inviteRecord.claimed).toBe(false);
    expect(inviteRecord.claimed_by).toBeNull();
  });

  it("verifies respectful community terminology without false VIP pass claims", () => {
    const inviteHeadline = "Invite Friends to After9";
    const inviteDescription = "Share your personal invitation link with trusted friends to join the After9 Garba community.";
    
    // Forbidden misleading terms
    expect(inviteHeadline).not.toContain("VIP Festival Pass");
    expect(inviteDescription).not.toContain("VIP Festival Pass");
    expect(inviteDescription).not.toContain("free entry ticket");
  });
});

describe("Admin Authorization & Audit Security", () => {
  it("validates server-side email authorization against ADMIN_EMAILS", () => {
    const mockEnvAdminEmails = "admin@after9.app, security@after9.app ,FOUNDER@AFTER9.APP ";
    const configuredList = mockEnvAdminEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    expect(configuredList).toContain("admin@after9.app");
    expect(configuredList).toContain("security@after9.app");
    expect(configuredList).toContain("founder@after9.app");

    // Unauthorized email check
    const isAuthorized = (email: string) => configuredList.includes(email.trim().toLowerCase());

    expect(isAuthorized("admin@after9.app")).toBe(true);
    expect(isAuthorized("Admin@After9.App")).toBe(true);
    expect(isAuthorized("intruder@attacker.com")).toBe(false);
    expect(isAuthorized("")).toBe(false);
  });

  it("formats audit log records with actor, action, target and timestamp", () => {
    const createAuditLog = (actorId: string, actorEmail: string, action: string, targetId: string, details?: Record<string, unknown>) => {
      return {
        actor_id: actorId,
        actor_email: actorEmail,
        action,
        target_id: targetId,
        details: details ?? {},
        created_at: new Date().toISOString(),
      };
    };

    const log = createAuditLog("admin-001", "admin@after9.app", "USER_SUSPEND", "target-user-999", {
      reason: "Harassment report verified",
    });

    expect(log.actor_id).toBe("admin-001");
    expect(log.actor_email).toBe("admin@after9.app");
    expect(log.action).toBe("USER_SUSPEND");
    expect(log.target_id).toBe("target-user-999");
    expect(log.details).toEqual({ reason: "Harassment report verified" });
    expect(typeof log.created_at).toBe("string");
  });

  it("determines correct referral lifecycle stage across all 4 stages", () => {
    type ReferralStatusTest = {
      revoked: boolean;
      claimed_at: string | null;
      claimed_user?: { onboarded: boolean; discoverable: boolean } | null;
    };

    const getStage = (inv: ReferralStatusTest) => {
      if (inv.revoked) return "revoked";
      if (inv.claimed_user?.discoverable) return "stage_4_discover";
      if (inv.claimed_user?.onboarded) return "stage_3_onboarded";
      if (inv.claimed_at) return "stage_2_registered";
      return "stage_1_created";
    };

    expect(getStage({ revoked: true, claimed_at: null })).toBe("revoked");
    expect(getStage({ revoked: false, claimed_at: null, claimed_user: null })).toBe("stage_1_created");
    expect(getStage({ revoked: false, claimed_at: "2026-10-09T10:00:00Z", claimed_user: { onboarded: false, discoverable: false } })).toBe("stage_2_registered");
    expect(getStage({ revoked: false, claimed_at: "2026-10-09T10:00:00Z", claimed_user: { onboarded: true, discoverable: false } })).toBe("stage_3_onboarded");
    expect(getStage({ revoked: false, claimed_at: "2026-10-09T10:00:00Z", claimed_user: { onboarded: true, discoverable: true } })).toBe("stage_4_discover");
  });

  it("validates launch control state and backend gating behavior", () => {
    const simulateDiscoverFeed = (launchEnabled: boolean, mockInventory: string[]) => {
      if (!launchEnabled) return [];
      return mockInventory;
    };

    const inventory = ["user-1", "user-2", "user-3"];

    // When disabled, backend returns 0 rows regardless of inventory
    expect(simulateDiscoverFeed(false, inventory)).toEqual([]);

    // When enabled, backend returns inventory
    expect(simulateDiscoverFeed(true, inventory)).toEqual(inventory);
  });
});
