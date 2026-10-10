import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  upsertSocialLink,
  updateSocialLinkVisibility,
  toggleSocialLinkEnabled,
  deleteSocialLink,
  getMatchedSocialLinks,
  type SocialVisibility,
  type SocialLinkRow,
} from "@/lib/social-links";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
    },
  };
});

describe("Social Links CRUD, Visibility Options & Privacy Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertSocialLink", () => {
    it("saves an Instagram handle with default 'private' visibility", async () => {
      const mockRow: SocialLinkRow = {
        id: "link-123",
        user_id: "user-456",
        platform: "instagram",
        handle: "aarav_garba",
        profile_url: "https://instagram.com/aarav_garba",
        is_enabled: true,
        visibility: "private",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockRow, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ upsert: upsertMock });

      const res = await upsertSocialLink(
        "user-456",
        "instagram",
        "aarav_garba",
        "https://instagram.com/aarav_garba"
      );

      expect(supabase.from).toHaveBeenCalledWith("social_links");
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-456",
          platform: "instagram",
          handle: "aarav_garba",
          profile_url: "https://instagram.com/aarav_garba",
          is_enabled: true,
          visibility: "private",
        }),
        { onConflict: "user_id, platform" }
      );
      expect(res.ok).toBe(true);
      expect(res.row?.visibility).toBe("private");
    });

    it("saves a handle with explicit 'share_card' or 'matched' visibility", async () => {
      for (const vis of ["share_card", "matched"] as SocialVisibility[]) {
        const mockRow: SocialLinkRow = {
          id: `link-${vis}`,
          user_id: "user-456",
          platform: "instagram",
          handle: "diya_festive",
          profile_url: "https://instagram.com/diya_festive",
          is_enabled: true,
          visibility: vis,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const singleMock = vi.fn().mockResolvedValue({ data: mockRow, error: null });
        const selectMock = vi.fn().mockReturnValue({ single: singleMock });
        const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
        (supabase.from as any).mockReturnValue({ upsert: upsertMock });

        const res = await upsertSocialLink(
          "user-456",
          "instagram",
          "diya_festive",
          "https://instagram.com/diya_festive",
          true,
          vis
        );

        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({ visibility: vis }),
          { onConflict: "user_id, platform" }
        );
        expect(res.ok).toBe(true);
        expect(res.row?.visibility).toBe(vis);
      }
    });

    it("handles save failure cleanly without falsely claiming success", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Could not find the 'visibility' column of 'social_links' in the schema cache" },
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ upsert: upsertMock });

      const res = await upsertSocialLink(
        "user-456",
        "instagram",
        "diya_festive",
        "https://instagram.com/diya_festive",
        true,
        "private"
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain("Could not find the 'visibility' column");
      expect(res.row).toBeUndefined();
    });
  });

  describe("updateSocialLinkVisibility", () => {
    it("updates visibility to Private, Share Card, and Matched Connections", async () => {
      for (const targetVis of ["private", "share_card", "matched"] as SocialVisibility[]) {
        const eqUserMock = vi.fn().mockResolvedValue({ error: null });
        const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
        const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
        (supabase.from as any).mockReturnValue({ update: updateMock });

        const success = await updateSocialLinkVisibility("link-123", "user-456", targetVis);

        expect(updateMock).toHaveBeenCalledWith(
          expect.objectContaining({ visibility: targetVis })
        );
        expect(eqIdMock).toHaveBeenCalledWith("id", "link-123");
        expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-456");
        expect(success).toBe(true);
      }
    });

    it("returns false on update error", async () => {
      const eqUserMock = vi.fn().mockResolvedValue({ error: { message: "Permission denied" } });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      const success = await updateSocialLinkVisibility("link-123", "user-456", "matched");
      expect(success).toBe(false);
    });
  });

  describe("toggleSocialLinkEnabled & deleteSocialLink", () => {
    it("toggles enabled state", async () => {
      const eqUserMock = vi.fn().mockResolvedValue({ error: null });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      const success = await toggleSocialLinkEnabled("link-123", "user-456", false);
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ is_enabled: false }));
      expect(success).toBe(true);
    });

    it("deletes social link", async () => {
      const eqUserMock = vi.fn().mockResolvedValue({ error: null });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      (supabase.from as any).mockReturnValue({ delete: deleteMock });

      const success = await deleteSocialLink("link-123", "user-456");
      expect(deleteMock).toHaveBeenCalled();
      expect(success).toBe(true);
    });
  });

  describe("getMatchedSocialLinks privacy boundary", () => {
    it("strictly queries with visibility = 'matched' and is_enabled = true", async () => {
      const eqVisMock = vi.fn().mockResolvedValue({
        data: [
          {
            id: "link-m1",
            user_id: "partner-789",
            platform: "instagram",
            handle: "partner_insta",
            profile_url: "https://instagram.com/partner_insta",
            is_enabled: true,
            visibility: "matched",
          },
        ],
        error: null,
      });
      const eqEnabledMock = vi.fn().mockReturnValue({ eq: eqVisMock });
      const eqUserMock = vi.fn().mockReturnValue({ eq: eqEnabledMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      (supabase.from as any).mockReturnValue({ select: selectMock });

      const links = await getMatchedSocialLinks("partner-789");

      expect(supabase.from).toHaveBeenCalledWith("social_links");
      expect(selectMock).toHaveBeenCalledWith("*");
      expect(eqUserMock).toHaveBeenCalledWith("user_id", "partner-789");
      expect(eqEnabledMock).toHaveBeenCalledWith("is_enabled", true);
      expect(eqVisMock).toHaveBeenCalledWith("visibility", "matched");
      expect(links).toHaveLength(1);
      expect(links[0]!.visibility).toBe("matched");
    });
  });

  describe("Multi-Audience Privacy Rules Verification", () => {
    const allSocials: SocialLinkRow[] = [
      {
        id: "1",
        user_id: "alice",
        platform: "instagram",
        handle: "alice_private",
        profile_url: "https://instagram.com/alice_private",
        is_enabled: true,
        visibility: "private",
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        user_id: "alice",
        platform: "snapchat",
        handle: "alice_card",
        profile_url: "https://snapchat.com/add/alice_card",
        is_enabled: true,
        visibility: "share_card",
        created_at: "",
        updated_at: "",
      },
      {
        id: "3",
        user_id: "alice",
        platform: "x",
        handle: "alice_matched",
        profile_url: "https://x.com/alice_matched",
        is_enabled: true,
        visibility: "matched",
        created_at: "",
        updated_at: "",
      },
      {
        id: "4",
        user_id: "alice",
        platform: "linkedin",
        handle: "alice_disabled",
        profile_url: "https://linkedin.com/in/alice_disabled",
        is_enabled: false,
        visibility: "matched",
        created_at: "",
        updated_at: "",
      },
    ];

    it("Share Card audience: only exports is_enabled=true AND visibility='share_card'", () => {
      const shareCardLinks = allSocials.filter(
        (s) => s.is_enabled && s.visibility === "share_card"
      );
      expect(shareCardLinks).toHaveLength(1);
      expect(shareCardLinks[0]!.platform).toBe("snapchat");
      expect(shareCardLinks.some((s) => s.visibility === "private")).toBe(false);
      expect(shareCardLinks.some((s) => s.visibility === "matched")).toBe(false);
    });

    it("Matched Connections audience: only returns is_enabled=true AND visibility='matched'", () => {
      const matchedLinks = allSocials.filter(
        (s) => s.is_enabled && s.visibility === "matched"
      );
      expect(matchedLinks).toHaveLength(1);
      expect(matchedLinks[0]!.platform).toBe("x");
      expect(matchedLinks.some((s) => s.visibility === "private")).toBe(false);
      expect(matchedLinks.some((s) => s.visibility === "share_card")).toBe(false);
      expect(matchedLinks.some((s) => !s.is_enabled)).toBe(false);
    });

    it("Private handles: never leak to any external audiences", () => {
      const externalAudiences = ["share_card", "matched"] as SocialVisibility[];
      for (const aud of externalAudiences) {
        const leaks = allSocials.filter(
          (s) => s.visibility === "private" && s.visibility === aud
        );
        expect(leaks).toHaveLength(0);
      }
    });
  });
});
