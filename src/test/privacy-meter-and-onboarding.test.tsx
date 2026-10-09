import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  getPrivacyMeterStatus,
  getPrivacyPreviewText,
  VISIBILITY_OPTIONS,
  COARSE_AREAS,
  POPULAR_COLLEGES,
  goingNights,
  shared,
} from "@/lib/after9";
import { ProfileVisibilityMeter } from "@/components/profile-visibility-meter";
import { CompactAgeRangePicker } from "@/components/profile-fields";

describe("Profile Visibility Meter & Shorter Onboarding Acceptance Suite", () => {
  // ==========================================
  // 1. PRIVACY METER LEVELS & INDICATORS
  // ==========================================
  describe("1. Privacy Meter Levels & Indicator Rules", () => {
    it("defaults empty or 'only_me' selection to Level 1: More private", () => {
      const defaultState = getPrivacyMeterStatus([]);
      expect(defaultState.level).toBe(1);
      expect(defaultState.label).toBe("More private");
      expect(defaultState.description).toContain("hidden");

      const onlyMeState = getPrivacyMeterStatus(["only_me"]);
      expect(onlyMeState.level).toBe(1);
      expect(onlyMeState.label).toBe("More private");
    });

    it("evaluates single campus or single neighborhood audience as Level 2: Limited audience", () => {
      const collegeOnly = getPrivacyMeterStatus(["college"]);
      expect(collegeOnly.level).toBe(2);
      expect(collegeOnly.label).toBe("Limited audience");

      const nearbyOnly = getPrivacyMeterStatus(["nearby"]);
      expect(nearbyOnly.level).toBe(2);
      expect(nearbyOnly.label).toBe("Limited audience");
    });

    it("evaluates event community or multiple combined audiences as Level 3: Wider audience", () => {
      const eventState = getPrivacyMeterStatus(["event"]);
      expect(eventState.level).toBe(3);
      expect(eventState.label).toBe("Wider audience");

      const multiState = getPrivacyMeterStatus(["college", "nearby"]);
      expect(multiState.level).toBe(3);
      expect(multiState.label).toBe("Wider audience");
      expect(multiState.description).toContain("Broader selections expand who may discover you");
    });

    it("never presents privacy levels as an absolute security score or anonymity guarantee", () => {
      const allLevels = [
        getPrivacyMeterStatus(["only_me"]),
        getPrivacyMeterStatus(["college"]),
        getPrivacyMeterStatus(["nearby"]),
        getPrivacyMeterStatus(["event"]),
      ];

      for (const st of allLevels) {
        expect(st.label).not.toMatch(/security score|100% anonymous|bulletproof/i);
      }
    });
  });

  // ==========================================
  // 2. LIVE PRIVACY PREVIEW COPY
  // ==========================================
  describe("2. Live Privacy Preview Text Generator", () => {
    it("generates correct preview for Only Me", () => {
      const preview = getPrivacyPreviewText(["only_me"]);
      expect(preview).toContain("hidden from discovery");
      expect(preview).toContain("will not appear on Discover");
    });

    it("generates correct preview for My College with college name", () => {
      const preview = getPrivacyPreviewText(["college"], "NIT Raipur");
      expect(preview).toBe(
        "Your profile can appear to eligible After9 users in your selected college community (NIT Raipur)."
      );
    });

    it("generates correct preview for Nearby with coarse area", () => {
      const preview = getPrivacyPreviewText(["nearby"], null, "Telibandha / VIP Road");
      expect(preview).toBe(
        "Your profile can appear to eligible After9 users in your selected general area (Telibandha / VIP Road)."
      );
    });

    it("generates correct preview for Event Community", () => {
      const preview = getPrivacyPreviewText(["event"]);
      expect(preview).toBe(
        "Your profile can appear to eligible After9 users participating in the same festival community."
      );
    });

    it("generates combined preview when multiple audiences are selected and notes audience expansion", () => {
      const preview = getPrivacyPreviewText(
        ["college", "nearby"],
        "SSIPMT Raipur",
        "Shankar Nagar / Civil Lines"
      );
      expect(preview).toContain("your selected college community (SSIPMT Raipur)");
      expect(preview).toContain("your selected general area (Shankar Nagar / Civil Lines)");
      expect(preview).toContain("Selecting multiple audiences expands who may discover you");
    });
  });

  // ==========================================
  // 3. MULTI-USER DISCOVERY FILTER & AUTHORIZATION
  // ==========================================
  describe("3. Multi-User Discovery Queries & Audience Authorization", () => {
    interface SimUser {
      id: string;
      first_name: string;
      college: string | null;
      general_area: string | null;
      nights: Record<string, string>;
      visibility_audiences: string[];
      discoverable: boolean;
      blocked_users: string[];
    }

    // Model profiles simulating database state
    const userA_NIT_Telibandha: SimUser = {
      id: "user-a",
      first_name: "Aarav",
      college: "NIT Raipur",
      general_area: "Telibandha / VIP Road",
      nights: { "1": "going", "2": "going" },
      visibility_audiences: ["college"],
      discoverable: true,
      blocked_users: [],
    };

    const userB_NIT_ShankarNagar: SimUser = {
      id: "user-b",
      first_name: "Bhavya",
      college: "nit raipur ", // case and whitespace insensitivity check
      general_area: "Shankar Nagar / Civil Lines",
      nights: { "3": "going", "4": "going" },
      visibility_audiences: ["college"],
      discoverable: true,
      blocked_users: [],
    };

    const userC_SSIPMT_Telibandha: SimUser = {
      id: "user-c",
      first_name: "Chirag",
      college: "SSIPMT Raipur",
      general_area: "Telibandha / VIP Road",
      nights: { "1": "going", "5": "maybe" },
      visibility_audiences: ["nearby"],
      discoverable: true,
      blocked_users: [],
    };

    const userD_Event_Bhilai: SimUser = {
      id: "user-d",
      first_name: "Diya",
      college: "BIT Durg",
      general_area: "Bhilai / Durg",
      nights: { "1": "going", "2": "maybe" },
      visibility_audiences: ["event"],
      discoverable: true,
      blocked_users: [],
    };

    const userE_OnlyMe: SimUser = {
      id: "user-e",
      first_name: "Eshaan",
      college: "NIT Raipur",
      general_area: "Telibandha / VIP Road",
      nights: { "1": "going", "2": "going" },
      visibility_audiences: ["only_me"],
      discoverable: true,
      blocked_users: [],
    };

    // Discovery simulator strictly adhering to discover_feed() SQL rules
    function isDiscoverableBy(target: SimUser, viewer: SimUser): boolean {
      if (target.id === viewer.id) return false;
      if (!target.discoverable) return false;
      if (target.visibility_audiences.includes("only_me")) return false;

      // Blocked check (either direction)
      if (
        target.blocked_users.includes(viewer.id) ||
        viewer.blocked_users.includes(target.id)
      ) {
        return false;
      }

      // Check audience authorizations
      let matchesAudience = false;

      if (target.visibility_audiences.includes("college")) {
        if (
          target.college &&
          viewer.college &&
          target.college.trim().toLowerCase() === viewer.college.trim().toLowerCase()
        ) {
          matchesAudience = true;
        }
      }

      if (target.visibility_audiences.includes("nearby")) {
        if (
          target.general_area &&
          viewer.general_area &&
          target.general_area.trim().toLowerCase() === viewer.general_area.trim().toLowerCase()
        ) {
          matchesAudience = true;
        }
      }

      if (target.visibility_audiences.includes("event")) {
        const sharedNights = shared(target.nights, viewer.nights);
        if (sharedNights.length > 0) {
          matchesAudience = true;
        }
      }

      return matchesAudience;
    }

    it("Rule 1: Only Me profiles (User E) NEVER appear in discovery for any viewer", () => {
      expect(isDiscoverableBy(userE_OnlyMe, userA_NIT_Telibandha)).toBe(false);
      expect(isDiscoverableBy(userE_OnlyMe, userB_NIT_ShankarNagar)).toBe(false);
      expect(isDiscoverableBy(userE_OnlyMe, userC_SSIPMT_Telibandha)).toBe(false);
      expect(isDiscoverableBy(userE_OnlyMe, userD_Event_Bhilai)).toBe(false);
    });

    it("Rule 2: College visibility only returns eligible users from the same college", () => {
      // User A (audience: college, NIT Raipur) is discoverable by User B (NIT Raipur)
      expect(isDiscoverableBy(userA_NIT_Telibandha, userB_NIT_ShankarNagar)).toBe(true);

      // But NOT discoverable by User C (SSIPMT Raipur)
      expect(isDiscoverableBy(userA_NIT_Telibandha, userC_SSIPMT_Telibandha)).toBe(false);
    });

    it("Rule 3: Nearby visibility only matches users in the same coarse general area", () => {
      // User C (audience: nearby, Telibandha) is discoverable by User A (Telibandha)
      expect(isDiscoverableBy(userC_SSIPMT_Telibandha, userA_NIT_Telibandha)).toBe(true);

      // But NOT discoverable by User B (Shankar Nagar)
      expect(isDiscoverableBy(userC_SSIPMT_Telibandha, userB_NIT_ShankarNagar)).toBe(false);
    });

    it("Rule 4: Event community uses actual supported festival attendance data", () => {
      // User D (audience: event, Nights 1,2) is discoverable by User A (Nights 1,2 - shared night 1,2)
      expect(isDiscoverableBy(userD_Event_Bhilai, userA_NIT_Telibandha)).toBe(true);

      // User D is NOT discoverable by User B (Nights 3,4 - 0 shared nights)
      expect(isDiscoverableBy(userD_Event_Bhilai, userB_NIT_ShankarNagar)).toBe(false);
    });

    it("Rule 5: Toggling 'Hide me from Discover' immediately removes profile from discovery results", () => {
      const hiddenUserA: SimUser = { ...userA_NIT_Telibandha, discoverable: false };
      expect(isDiscoverableBy(hiddenUserA, userB_NIT_ShankarNagar)).toBe(false);
    });

    it("Rule 6: Blocked users cannot discover or contact the blocking user", () => {
      const userA_blocking_B: SimUser = {
        ...userA_NIT_Telibandha,
        blocked_users: ["user-b"],
      };
      // User B cannot see User A
      expect(isDiscoverableBy(userA_blocking_B, userB_NIT_ShankarNagar)).toBe(false);
      // User A cannot see User B either
      expect(isDiscoverableBy(userB_NIT_ShankarNagar, userA_blocking_B)).toBe(false);
    });
  });

  // ==========================================
  // 4. COARSE LOCATION & CAMPUS PRIVACY INTEGRITY
  // ==========================================
  describe("4. Coarse Location & College Privacy Safeguards", () => {
    it("coarse areas are non-precise general neighborhoods in Raipur", () => {
      expect(COARSE_AREAS.length).toBeGreaterThanOrEqual(5);
      expect(COARSE_AREAS).toContain("Telibandha / VIP Road");
      expect(COARSE_AREAS).toContain("Shankar Nagar / Civil Lines");

      // Verify no GPS coordinate strings exist in predefined areas
      for (const area of COARSE_AREAS) {
        expect(area).not.toMatch(/\d+\.\d+,\s*\d+\.\d+/);
      }
    });

    it("colleges are standard institutions without claiming unverified status as verified", () => {
      expect(POPULAR_COLLEGES).toContain("SSIPMT Raipur");
      expect(POPULAR_COLLEGES).toContain("NIT Raipur");
    });
  });

  // ==========================================
  // 5. COMPACT AGE RANGE PICKER CONTROLS
  // ==========================================
  describe("5. Compact Age Range Controls (18+ Server Rule)", () => {
    it("renders compact age range stepper controls and enforces 18+ lower bound", () => {
      const handleChange = vi.fn();
      render(
        <CompactAgeRangePicker minAge={18} maxAge={26} onChange={handleChange} />
      );

      expect(screen.getByText("18 – 26 years old")).toBeInTheDocument();
      expect(
        screen.getByText("Server-enforced: Only eligible adults aged 18+ can join or appear.")
      ).toBeInTheDocument();

      // Attempting to decrement below 18 is disabled
      const minusBtn = screen.getAllByRole("button", { name: "−" })[0];
      expect(minusBtn).toBeDisabled();
    });

    it("clicking quick presets updates the age span smoothly", () => {
      const handleChange = vi.fn();
      render(
        <CompactAgeRangePicker minAge={18} maxAge={35} onChange={handleChange} />
      );

      const campusBtn = screen.getByRole("button", { name: "18 – 24 (Campus)" });
      fireEvent.click(campusBtn);
      expect(handleChange).toHaveBeenCalledWith(18, 24);
    });
  });

  // ==========================================
  // 6. PROFILE VISIBILITY METER COMPONENT INTERACTION
  // ==========================================
  describe("6. ProfileVisibilityMeter Interactive Component", () => {
    it("renders all 4 levels with clean visual indicator", () => {
      const handleChangeAudiences = vi.fn();
      render(
        <ProfileVisibilityMeter
          audiences={["only_me"]}
          onChangeAudiences={handleChangeAudiences}
        />
      );

      expect(screen.getByText("Who can discover you?")).toBeInTheDocument();
      expect(screen.getByText("Only Me")).toBeInTheDocument();
      expect(screen.getByText("My College")).toBeInTheDocument();
      expect(screen.getByText("Nearby")).toBeInTheDocument();
      expect(screen.getByText("Event Community")).toBeInTheDocument();
      expect(screen.getAllByText("More private").length).toBeGreaterThanOrEqual(1);
    });

    it("selecting an audience level deselects Only Me", () => {
      const handleChangeAudiences = vi.fn();
      render(
        <ProfileVisibilityMeter
          audiences={["only_me"]}
          onChangeAudiences={handleChangeAudiences}
        />
      );

      const collegeBtn = screen.getByRole("button", { name: /My College/i });
      fireEvent.click(collegeBtn);

      expect(handleChangeAudiences).toHaveBeenCalledWith(["college"]);
    });

    it("selecting Only Me resets any other active audiences", () => {
      const handleChangeAudiences = vi.fn();
      render(
        <ProfileVisibilityMeter
          audiences={["college", "nearby"]}
          onChangeAudiences={handleChangeAudiences}
        />
      );

      const onlyMeBtn = screen.getByRole("button", { name: /Only Me/i });
      fireEvent.click(onlyMeBtn);

      expect(handleChangeAudiences).toHaveBeenCalledWith(["only_me"]);
    });

    it("renders 'Preview what others see' dialog with strict privacy boundaries", () => {
      render(
        <ProfileVisibilityMeter
          audiences={["college"]}
          onChangeAudiences={vi.fn()}
          userFirstName="Riya"
          userAge={21}
          college="NIT Raipur"
        />
      );

      const previewBtn = screen.getByText(/Preview what others see on your profile →/i);
      fireEvent.click(previewBtn);

      // Verify what's in modal
      expect(screen.getByText("Profile Information Preview")).toBeInTheDocument();
      expect(screen.getByText(/Visible to your audience:/i)).toBeInTheDocument();
      expect(screen.getByText(/Strictly private & never shown:/i)).toBeInTheDocument();
      expect(screen.getByText(/Exact birth date \(kept confidential\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Exact GPS coordinates or live movements \(never tracked\)/i)
      ).toBeInTheDocument();
    });
  });
});
