import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMatchInstagramStatus,
  setMatchInstagramConsent,
  saveUserInstagramHandle,
  removeUserInstagramHandle,
  copyInstagramHandle,
  getInstagramProfileUrl,
  openInstagramProfile,
} from "@/lib/instagram-match";
import { validateAndNormalizeSocial } from "@/lib/social-links";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
    },
  };
});

describe("Post-Match Instagram Flow & Consent Exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. VALIDATION AND NORMALIZATION
  // ============================================================================
  describe("1. Instagram Handle Validation and Normalization", () => {
    it("normalizes handles with @ or full profile URLs", () => {
      const h1 = validateAndNormalizeSocial("instagram", "@aarav_garba");
      expect(h1.valid).toBe(true);
      expect(h1.handle).toBe("aarav_garba");
      expect(h1.url).toBe("https://instagram.com/aarav_garba");

      const h2 = validateAndNormalizeSocial("instagram", "https://instagram.com/diya.navratri/");
      expect(h2.valid).toBe(true);
      expect(h2.handle).toBe("diya.navratri");
      expect(h2.url).toBe("https://instagram.com/diya.navratri");
    });

    it("rejects invalid handles with special characters or excessive length", () => {
      const invalidChars = validateAndNormalizeSocial("instagram", "aarav!dandiya$");
      expect(invalidChars.valid).toBe(false);
      expect(invalidChars.error).toContain("letters, numbers, periods, and underscores");

      const tooLong = validateAndNormalizeSocial("instagram", "a".repeat(31));
      expect(tooLong.valid).toBe(false);
    });

    it("formats canonical profile URLs for valid handles only", () => {
      expect(getInstagramProfileUrl("diya_garba")).toBe("https://instagram.com/diya_garba");
      expect(getInstagramProfileUrl("@diya_garba")).toBe("https://instagram.com/diya_garba");
      expect(getInstagramProfileUrl("")).toBeNull();
      expect(getInstagramProfileUrl(null)).toBeNull();
      expect(getInstagramProfileUrl("invalid!handle")).toBeNull();
    });
  });

  // ============================================================================
  // 2. CONSENT LOGIC & BOUNDARY ENFORCEMENT
  // ============================================================================
  describe("2. Two-Way Consent Boundary Enforcement", () => {
    it("does NOT reveal handle if neither user has consented", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          is_match: true,
          my_consent: false,
          partner_consent: false,
          both_consented: false,
          partner_handle: null,
          partner_url: null,
          my_handle: "aarav_garba",
          my_url: "https://instagram.com/aarav_garba",
        },
        error: null,
      });

      const res = await getMatchInstagramStatus("partner-bob");
      expect(res.isMatch).toBe(true);
      expect(res.myConsent).toBe(false);
      expect(res.partnerConsent).toBe(false);
      expect(res.bothConsented).toBe(false);
      expect(res.partnerHandle).toBeNull();
      expect(res.partnerUrl).toBeNull();
    });

    it("does NOT reveal handle if only User A has consented", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          is_match: true,
          my_consent: true,
          partner_consent: false,
          both_consented: false,
          partner_handle: null,
          partner_url: null,
          my_handle: "aarav_garba",
          my_url: "https://instagram.com/aarav_garba",
        },
        error: null,
      });

      const res = await getMatchInstagramStatus("partner-bob");
      expect(res.myConsent).toBe(true);
      expect(res.partnerConsent).toBe(false);
      expect(res.bothConsented).toBe(false);
      expect(res.partnerHandle).toBeNull();
    });

    it("does NOT reveal handle if only User B has consented", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          is_match: true,
          my_consent: false,
          partner_consent: true,
          both_consented: false,
          partner_handle: null,
          partner_url: null,
          my_handle: "aarav_garba",
          my_url: "https://instagram.com/aarav_garba",
        },
        error: null,
      });

      const res = await getMatchInstagramStatus("partner-bob");
      expect(res.myConsent).toBe(false);
      expect(res.partnerConsent).toBe(true);
      expect(res.bothConsented).toBe(false);
      expect(res.partnerHandle).toBeNull();
    });

    it("reveals handle ONLY when BOTH users have explicitly consented", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          is_match: true,
          my_consent: true,
          partner_consent: true,
          both_consented: true,
          partner_handle: "bob_dandiya",
          partner_url: "https://instagram.com/bob_dandiya",
          my_handle: "aarav_garba",
          my_url: "https://instagram.com/aarav_garba",
        },
        error: null,
      });

      const res = await getMatchInstagramStatus("partner-bob");
      expect(res.bothConsented).toBe(true);
      expect(res.partnerHandle).toBe("bob_dandiya");
      expect(res.partnerUrl).toBe("https://instagram.com/bob_dandiya");
    });
  });

  // ============================================================================
  // 3. CONSENT RECORDING & REVOCATION
  // ============================================================================
  describe("3. Recording and Revoking Consent", () => {
    it("calls set_match_social_consent to grant consent", async () => {
      (supabase.rpc as any).mockResolvedValue({ data: true, error: null });

      const res = await setMatchInstagramConsent("partner-bob", true);
      expect(supabase.rpc).toHaveBeenCalledWith("set_match_social_consent", {
        _target_user_id: "partner-bob",
        _platform: "instagram",
        _consent: true,
      });
      expect(res.ok).toBe(true);
    });

    it("calls set_match_social_consent to revoke consent", async () => {
      (supabase.rpc as any).mockResolvedValue({ data: true, error: null });

      const res = await setMatchInstagramConsent("partner-bob", false);
      expect(supabase.rpc).toHaveBeenCalledWith("set_match_social_consent", {
        _target_user_id: "partner-bob",
        _platform: "instagram",
        _consent: false,
      });
      expect(res.ok).toBe(true);
    });
  });

  // ============================================================================
  // 4. BLOCKING & UNMATCHING ISOLATION
  // ============================================================================
  describe("4. Blocked or Unmatched Users Protection", () => {
    it("blocks access to handles if users are not mutual matches or blocked", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          is_match: false,
          my_consent: false,
          partner_consent: false,
          both_consented: false,
          partner_handle: null,
          partner_url: null,
          my_handle: null,
          my_url: null,
        },
        error: null,
      });

      const res = await getMatchInstagramStatus("blocked-user");
      expect(res.isMatch).toBe(false);
      expect(res.partnerHandle).toBeNull();
      expect(res.bothConsented).toBe(false);
    });

    it("returns error if setMatchInstagramConsent is attempted on a blocked user", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Not a mutual clash or user is blocked" },
      });

      const res = await setMatchInstagramConsent("blocked-user", true);
      expect(res.ok).toBe(false);
      expect(res.error).toContain("blocked");
    });
  });

  // ============================================================================
  // 5. HANDLE REMOVAL
  // ============================================================================
  describe("5. Instagram Handle Removal", () => {
    it("removes Instagram handle cleanly", async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: [
          {
            id: "link-insta",
            platform: "instagram",
            handle: "aarav_garba",
          },
        ],
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const deleteEqUser = vi.fn().mockResolvedValue({ error: null });
      const deleteEqId = vi.fn().mockReturnValue({ eq: deleteEqUser });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqId });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "social_links") {
          return {
            select: selectMock,
            delete: deleteMock,
          };
        }
        return {};
      });

      const res = await removeUserInstagramHandle("user-123");
      expect(res.ok).toBe(true);
    });
  });

  // ============================================================================
  // 6. COPY HANDLE ACTION
  // ============================================================================
  describe("6. Copy Handle Action", () => {
    it("copies handle with @ prefix and feedback", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });
      Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });

      const ok = await copyInstagramHandle("diya_patel");
      expect(ok).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith("@diya_patel");
    });

    it("returns false if handle is empty", async () => {
      const ok = await copyInstagramHandle("");
      expect(ok).toBe(false);
    });
  });

  // ============================================================================
  // 7. EXTERNAL PROFILE & BROWSER/APP NAVIGATION
  // ============================================================================
  describe("7. External Instagram Profile & Mobile Browser/App Navigation", () => {
    it("opens Instagram profile with valid URL and returns true", () => {
      const openMock = vi.fn().mockReturnValue({ closed: false });
      window.open = openMock;

      const ok = openInstagramProfile("aarav_garba");
      expect(ok).toBe(true);
      expect(openMock).toHaveBeenCalledWith(
        "https://instagram.com/aarav_garba",
        "_blank",
        "noopener,noreferrer"
      );
    });

    it("falls back to window.location.href when window.open is blocked or returns null", () => {
      window.open = vi.fn().mockReturnValue(null);
      let assignedHref = "";
      Object.defineProperty(window, "location", {
        value: {
          set href(val: string) {
            assignedHref = val;
          },
          get href() {
            return assignedHref;
          },
        },
        writable: true,
      });

      const ok = openInstagramProfile("diya_patel");
      expect(ok).toBe(true);
      expect(assignedHref).toBe("https://instagram.com/diya_patel");
    });

    it("refuses to open when handle is invalid and returns false", () => {
      const openMock = vi.fn();
      window.open = openMock;

      const ok = openInstagramProfile("invalid!handle$");
      expect(ok).toBe(false);
      expect(openMock).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 8. DIRECT URL ACCESS & NON-MATCH PROTECTION
  // ============================================================================
  describe("8. Direct URL Access & Unauthorized Inspection Protection", () => {
    it("protects against direct URL access when users are not matched", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          is_match: false,
          my_consent: false,
          partner_consent: false,
          both_consented: false,
          partner_handle: null,
          partner_url: null,
          my_handle: null,
          my_url: null,
        },
        error: null,
      });

      const res = await getMatchInstagramStatus("arbitrary-stranger-id");
      expect(res.isMatch).toBe(false);
      expect(res.bothConsented).toBe(false);
      expect(res.partnerHandle).toBeNull();
      expect(res.partnerUrl).toBeNull();
    });

    it("handles null RPC response gracefully on network error or unauthorized access", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Permission denied or user blocked" },
      });

      const res = await getMatchInstagramStatus("unauthorized-user");
      expect(res.isMatch).toBe(false);
      expect(res.bothConsented).toBe(false);
      expect(res.partnerHandle).toBeNull();
    });
  });

  // ============================================================================
  // 9. SAVE USER INSTAGRAM HANDLE WITH NORMALIZATION
  // ============================================================================
  describe("9. Save User Instagram Handle with Normalization", () => {
    it("normalizes and saves valid handle with matched visibility", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: "link-1",
          user_id: "user-123",
          platform: "instagram",
          handle: "garba_lover",
          profile_url: "https://instagram.com/garba_lover",
          is_enabled: true,
          visibility: "matched",
        },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ upsert: upsertMock });

      const res = await saveUserInstagramHandle("user-123", "@garba_lover");
      expect(res.ok).toBe(true);
      expect(res.handle).toBe("garba_lover");
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: "instagram",
          handle: "garba_lover",
          profile_url: "https://instagram.com/garba_lover",
          visibility: "matched",
        }),
        expect.anything()
      );
    });

    it("rejects invalid handles before calling database", async () => {
      const res = await saveUserInstagramHandle("user-123", "invalid!user#");
      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
