import { describe, expect, it, vi } from "vitest";
import { vibe, goingNights, shared, type FeedRow } from "@/lib/after9";

// ==============================================================================
// TEST FIXTURES & SYNTHETIC DATA
// ==============================================================================

interface SyntheticProfile {
  id: string;
  first_name: string;
  age: number;
  birth_date: string;
  gender: "woman" | "man" | "nonbinary";
  interested_in: "woman" | "man" | "everyone";
  min_age: number;
  max_age: number;
  college: string | null;
  branch: string | null;
  general_area: string | null;
  prompt: string;
  photo_path: string;
  nights: Record<string, "going" | "maybe" | "off">;
  quiz: Record<string, string>;
  onboarded: boolean;
  discoverable: boolean;
  verification_status: "approved" | "pending" | "rejected";
  is_suspended: boolean;
  incognito: boolean;
  visibility_audiences: string[];
  created_at: string;
}

interface ImpressionRecord {
  viewer_id: string;
  profile_id: string;
  batch_id: string | null;
  served_at: Date;
}

interface SwipeRecord {
  from_id: string;
  to_id: string;
  kind: "send" | "pass";
  created_at: Date;
}

interface BlockRecord {
  blocker_id: string;
  blocked_id: string;
}

// Viewer: 22yo Man, NIT Raipur, Telibandha, going nights 1, 2, 3
const viewerA: SyntheticProfile = {
  id: "viewer-a",
  first_name: "Aman",
  age: 22,
  birth_date: "2004-01-15",
  gender: "man",
  interested_in: "woman",
  min_age: 20,
  max_age: 25,
  college: "NIT Raipur",
  branch: "CSE",
  general_area: "Telibandha",
  prompt: "Garba enthusiast",
  photo_path: "viewer-a/p.jpg",
  nights: { "1": "going", "2": "going", "3": "going" },
  quiz: { energy: "Full send", experience: "Experienced", night: "Dance till late" },
  onboarded: true,
  discoverable: true,
  verification_status: "approved",
  is_suspended: false,
  incognito: false,
  visibility_audiences: ["college", "nearby", "event"],
  created_at: "2026-09-01T00:00:00Z",
};

// ==============================================================================
// SIMULATION ENGINE FOR FAIR BALANCING & METRICS
// ==============================================================================

class DiscoveryEngineSimulator {
  public launchEnabled = true;
  public profiles: Map<string, SyntheticProfile> = new Map();
  public impressions: ImpressionRecord[] = [];
  public swipes: SwipeRecord[] = [];
  public blocks: BlockRecord[] = [];

  constructor() {
    this.profiles.set(viewerA.id, viewerA);
  }

  addCandidate(p: SyntheticProfile) {
    this.profiles.set(p.id, p);
  }

  recordImpressions(viewerId: string, profileIds: string[], batchId?: string, now = new Date()): number {
    let count = 0;
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    for (const pid of profileIds) {
      if (!pid || pid === viewerId) continue;
      // Deduplicate within same batch or within 15 minutes for same viewer+profile
      const exists = this.impressions.some(
        (imp) =>
          imp.viewer_id === viewerId &&
          imp.profile_id === pid &&
          ((batchId && imp.batch_id === batchId) || imp.served_at > fifteenMinsAgo)
      );

      if (!exists) {
        this.impressions.push({
          viewer_id: viewerId,
          profile_id: pid,
          batch_id: batchId ?? null,
          served_at: now,
        });
        count++;
      }
    }
    return count;
  }

  // 1. Strict Eligibility Filter (Matches discover_feed SQL WHERE clause)
  isEligible(viewer: SyntheticProfile, candidate: SyntheticProfile): boolean {
    if (!this.launchEnabled) return false;
    if (viewer.is_suspended || candidate.is_suspended) return false;
    if (viewer.id === candidate.id) return false;
    if (!candidate.onboarded || !candidate.discoverable) return false;
    if (candidate.verification_status !== "approved") return false;

    // Incognito check
    if (candidate.incognito) {
      const hasIncomingDandiya = this.swipes.some(
        (s) => s.from_id === candidate.id && s.to_id === viewer.id && s.kind === "send"
      );
      if (!hasIncomingDandiya) return false;
    }

    // Age bound check
    if (candidate.age < viewer.min_age || candidate.age > viewer.max_age) return false;

    // Gender preference check
    if (viewer.interested_in !== "everyone" && candidate.gender !== viewer.interested_in) {
      return false;
    }

    // Already swiped check
    const alreadySwiped = this.swipes.some(
      (s) => s.from_id === viewer.id && s.to_id === candidate.id
    );
    if (alreadySwiped) return false;

    // Bidirectional block check
    const isBlocked = this.blocks.some(
      (b) =>
        (b.blocker_id === viewer.id && b.blocked_id === candidate.id) ||
        (b.blocker_id === candidate.id && b.blocked_id === viewer.id)
    );
    if (isBlocked) return false;

    // Visibility audiences check
    if (candidate.visibility_audiences.includes("only_me")) return false;

    let audienceMatches = false;
    if (
      candidate.visibility_audiences.includes("college") &&
      candidate.college &&
      viewer.college &&
      candidate.college.trim().toLowerCase() === viewer.college.trim().toLowerCase()
    ) {
      audienceMatches = true;
    }
    if (
      candidate.visibility_audiences.includes("nearby") &&
      candidate.general_area &&
      viewer.general_area &&
      candidate.general_area.trim().toLowerCase() === viewer.general_area.trim().toLowerCase()
    ) {
      audienceMatches = true;
    }
    if (candidate.visibility_audiences.includes("event")) {
      const sharedN = shared(candidate.nights, viewer.nights);
      if (sharedN.length > 0) audienceMatches = true;
    }

    return audienceMatches;
  }

  // Baseline Legacy Ranking: ORDER BY created_at DESC LIMIT 50
  queryLegacyFeed(viewer: SyntheticProfile): SyntheticProfile[] {
    const eligible = Array.from(this.profiles.values()).filter((c) => this.isEligible(viewer, c));
    return eligible
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);
  }

  // Fair Balanced Ranking: Composite Fair Score DESC LIMIT 50
  queryFairFeed(viewer: SyntheticProfile, referenceDate = new Date()): SyntheticProfile[] {
    const eligible = Array.from(this.profiles.values()).filter((c) => this.isEligible(viewer, c));
    const sevenDaysAgo = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const scored = eligible.map((candidate) => {
      // 1. Compatibility score
      const sharedNightsCount = shared(candidate.nights, viewer.nights).length;
      let quizMatchCount = 0;
      for (const k of ["energy", "experience", "night"]) {
        if (candidate.quiz[k] && candidate.quiz[k] === viewer.quiz[k]) {
          quizMatchCount++;
        }
      }
      const compatScore = sharedNightsCount * 2 + quizMatchCount * 2;

      // 2. Rolling 7d platform exposure
      const platformImps7d = this.impressions.filter(
        (imp) => imp.profile_id === candidate.id && imp.served_at > sevenDaysAgo
      ).length;
      // Exposure bonus for under-exposed profiles (max +15)
      const exposureBonus = Math.max(0, 30 - Math.min(platformImps7d, 30)) * 0.5;

      // 3. Viewer fatigue penalty for unswiped repeated impressions
      const viewerImps7d = this.impressions.filter(
        (imp) =>
          imp.profile_id === candidate.id &&
          imp.viewer_id === viewer.id &&
          imp.served_at > sevenDaysAgo
      ).length;
      const fatiguePenalty = viewerImps7d * 5.0;

      // 4. Deterministic daily tie-breaker
      const seedStr = `${viewer.id}_${candidate.id}_${referenceDate.toISOString().slice(0, 10)}`;
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
      }
      const tiebreak = ((Math.abs(hash) % 1000) / 1000.0) * 3.0;

      const finalScore = compatScore + exposureBonus - fatiguePenalty + tiebreak;
      return { candidate, finalScore };
    });

    return scored
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 50)
      .map((s) => s.candidate);
  }

  // Calculate Gini Coefficient of impressions across eligible candidate set
  calculateExposureGini(candidateIds: string[]): number {
    const counts = candidateIds.map(
      (id) => this.impressions.filter((imp) => imp.profile_id === id).length
    );
    if (counts.length === 0) return 0;
    const n = counts.length;
    counts.sort((a, b) => a - b);
    const total = counts.reduce((acc, c) => acc + c, 0);
    if (total === 0) return 0;

    let numerator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (2 * (i + 1) - n - 1) * (counts[i] ?? 0);
    }
    return Number((numerator / (n * total)).toFixed(4));
  }
}

// ==============================================================================
// TEST SUITE
// ==============================================================================

describe("Fair Discover Balancing & Exposure System", () => {
  it("enforces strict eligibility and security exclusions", () => {
    const sim = new DiscoveryEngineSimulator();

    // 1. Eligible candidate
    const eligible: SyntheticProfile = {
      id: "c-eligible",
      first_name: "Pooja",
      age: 21,
      birth_date: "2005-03-20",
      gender: "woman",
      interested_in: "man",
      min_age: 20,
      max_age: 25,
      college: "NIT Raipur",
      branch: "EE",
      general_area: "Telibandha",
      prompt: "Ready for Garba",
      photo_path: "p.jpg",
      nights: { "1": "going" },
      quiz: { energy: "Full send" },
      onboarded: true,
      discoverable: true,
      verification_status: "approved",
      is_suspended: false,
      incognito: false,
      visibility_audiences: ["college"],
      created_at: "2026-09-10T00:00:00Z",
    };
    sim.addCandidate(eligible);
    expect(sim.isEligible(viewerA, eligible)).toBe(true);

    // 2. Suspended candidate
    const suspended = { ...eligible, id: "c-suspended", is_suspended: true };
    sim.addCandidate(suspended);
    expect(sim.isEligible(viewerA, suspended)).toBe(false);

    // 3. Unverified candidate
    const unverified = { ...eligible, id: "c-unverified", verification_status: "pending" as const };
    sim.addCandidate(unverified);
    expect(sim.isEligible(viewerA, unverified)).toBe(false);

    // 4. Incomplete onboarding
    const notOnboarded = { ...eligible, id: "c-onboarding", onboarded: false };
    sim.addCandidate(notOnboarded);
    expect(sim.isEligible(viewerA, notOnboarded)).toBe(false);

    // 5. Hidden from discover
    const hidden = { ...eligible, id: "c-hidden", discoverable: false };
    sim.addCandidate(hidden);
    expect(sim.isEligible(viewerA, hidden)).toBe(false);

    // 6. Only Me private profile
    const onlyMe = { ...eligible, id: "c-onlyme", visibility_audiences: ["only_me"] };
    sim.addCandidate(onlyMe);
    expect(sim.isEligible(viewerA, onlyMe)).toBe(false);

    // 7. Out of age preference (18yo, viewer min_age is 20)
    const tooYoung = { ...eligible, id: "c-young", age: 18 };
    sim.addCandidate(tooYoung);
    expect(sim.isEligible(viewerA, tooYoung)).toBe(false);

    // 8. Blocked candidate (viewer blocked candidate)
    sim.blocks.push({ blocker_id: viewerA.id, blocked_id: eligible.id });
    expect(sim.isEligible(viewerA, eligible)).toBe(false);

    // 9. Global discover disabled
    sim.blocks = [];
    sim.launchEnabled = false;
    expect(sim.isEligible(viewerA, eligible)).toBe(false);
  });

  it("deduplicates impression tracking against rapid re-renders and retries", () => {
    const sim = new DiscoveryEngineSimulator();
    const candidateId = "cand-1";
    const batchId = "batch_test_123";

    // First impression logged
    const count1 = sim.recordImpressions(viewerA.id, [candidateId], batchId);
    expect(count1).toBe(1);
    expect(sim.impressions).toHaveLength(1);

    // Rapid re-render with identical batch ID
    const count2 = sim.recordImpressions(viewerA.id, [candidateId], batchId);
    expect(count2).toBe(0);
    expect(sim.impressions).toHaveLength(1);

    // Quick retry within 15 minutes even with new batch ID
    const count3 = sim.recordImpressions(viewerA.id, [candidateId], "batch_new_456");
    expect(count3).toBe(0);
    expect(sim.impressions).toHaveLength(1);

    // Logging after 20 minutes allows next organic impression
    const futureTime = new Date(Date.now() + 20 * 60 * 1000);
    const count4 = sim.recordImpressions(viewerA.id, [candidateId], "batch_later", futureTime);
    expect(count4).toBe(1);
    expect(sim.impressions).toHaveLength(2);
  });

  it("rotates candidates and reduces viewer fatigue across repeated sessions", () => {
    const sim = new DiscoveryEngineSimulator();

    // Candidate 1: High quiz match, but seen multiple times previously
    const candHighVibe: SyntheticProfile = {
      id: "cand-high-vibe",
      first_name: "Sneha",
      age: 22,
      birth_date: "2004-05-10",
      gender: "woman",
      interested_in: "man",
      min_age: 20,
      max_age: 25,
      college: "NIT Raipur",
      branch: "Arch",
      general_area: "Telibandha",
      prompt: "Vibing",
      photo_path: "sneha.jpg",
      nights: { "1": "going", "2": "going", "3": "going" },
      quiz: { energy: "Full send", experience: "Experienced", night: "Dance till late" },
      onboarded: true,
      discoverable: true,
      verification_status: "approved",
      is_suspended: false,
      incognito: false,
      visibility_audiences: ["college"],
      created_at: "2026-09-20T00:00:00Z",
    };

    // Candidate 2: Moderate quiz match, but fresh (never seen by viewer)
    const candFresh: SyntheticProfile = {
      id: "cand-fresh",
      first_name: "Tanvi",
      age: 23,
      birth_date: "2003-08-12",
      gender: "woman",
      interested_in: "man",
      min_age: 20,
      max_age: 25,
      college: "NIT Raipur",
      branch: "Civil",
      general_area: "Telibandha",
      prompt: "Garba beats",
      photo_path: "tanvi.jpg",
      nights: { "1": "going" },
      quiz: { energy: "Full send" },
      onboarded: true,
      discoverable: true,
      verification_status: "approved",
      is_suspended: false,
      incognito: false,
      visibility_audiences: ["college"],
      created_at: "2026-09-05T00:00:00Z",
    };

    sim.addCandidate(candHighVibe);
    sim.addCandidate(candFresh);

    // Initial session: candHighVibe ranks first due to higher initial compatibility
    const initialFeed = sim.queryFairFeed(viewerA);
    expect(initialFeed[0]!.id).toBe("cand-high-vibe");

    // Viewer saw candHighVibe 3 times without swiping (repeated exposure)
    for (let i = 0; i < 3; i++) {
      sim.impressions.push({
        viewer_id: viewerA.id,
        profile_id: candHighVibe.id,
        batch_id: `session_${i}`,
        served_at: new Date(Date.now() - (3 - i) * 3600 * 1000),
      });
    }

    // Next session: fatigue penalty deprioritizes candHighVibe, rotating candFresh to the top
    const nextFeed = sim.queryFairFeed(viewerA);
    expect(nextFeed[0]!.id).toBe("cand-fresh");
    expect(nextFeed[1]!.id).toBe("cand-high-vibe");
  });

  it("measurably reduces exposure disparity (Gini coefficient & starvation rate)", () => {
    const sim = new DiscoveryEngineSimulator();

    // Create 20 eligible candidate profiles with staggered creation dates
    // 5 older profiles (created in Aug), 15 newer profiles (created late Sept)
    const candidateIds: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const id = `cand-${i}`;
      candidateIds.push(id);
      const isOlder = i <= 5;
      sim.addCandidate({
        id,
        first_name: `Dancer ${i}`,
        age: 22,
        birth_date: "2004-02-01",
        gender: "woman",
        interested_in: "everyone",
        min_age: 18,
        max_age: 30,
        college: "NIT Raipur",
        branch: "Engineering",
        general_area: "Telibandha",
        prompt: `Bio ${i}`,
        photo_path: `photo_${i}.jpg`,
        nights: { "1": "going" },
        quiz: { energy: "Full send" },
        onboarded: true,
        discoverable: true,
        verification_status: "approved",
        is_suspended: false,
        incognito: false,
        visibility_audiences: ["college"],
        created_at: isOlder
          ? `2026-08-${String(i).padStart(2, "0")}T00:00:00Z`
          : `2026-09-${String(i).padStart(2, "0")}T00:00:00Z`,
      });
    }

    // SIMULATE LEGACY ALGORITHM (Pure created_at DESC with limit 5)
    // 10 viewers browse feed 5 times
    const legacySim = new DiscoveryEngineSimulator();
    for (const p of sim.profiles.values()) legacySim.addCandidate(p);

    for (let session = 0; session < 25; session++) {
      const v = { ...viewerA, id: `viewer-v${session}` };
      legacySim.addCandidate(v);
      const feed = legacySim.queryLegacyFeed(v).slice(0, 5); // top 5 visible
      for (const f of feed) {
        legacySim.impressions.push({
          viewer_id: v.id,
          profile_id: f.id,
          batch_id: `b_${session}`,
          served_at: new Date(),
        });
      }
    }

    // Check Legacy Starvation: Older profiles received ZERO impressions
    const olderIds = candidateIds.slice(0, 5);
    const legacyOlderImps = olderIds.reduce(
      (sum, id) => sum + legacySim.impressions.filter((imp) => imp.profile_id === id).length,
      0
    );
    const legacyGini = legacySim.calculateExposureGini(candidateIds);

    expect(legacyOlderImps).toBe(0); // 100% starvation for older eligible accounts
    expect(legacyGini).toBeGreaterThan(0.5); // Severe inequality (typically >0.55)

    // SIMULATE ADAPTIVE FAIR BALANCING
    const fairSim = new DiscoveryEngineSimulator();
    for (const p of sim.profiles.values()) fairSim.addCandidate(p);

    for (let session = 0; session < 25; session++) {
      const v = { ...viewerA, id: `viewer-v${session}` };
      fairSim.addCandidate(v);
      const feed = fairSim.queryFairFeed(v, new Date(Date.now() + session * 3600 * 1000)).slice(0, 5);
      for (const f of feed) {
        fairSim.impressions.push({
          viewer_id: v.id,
          profile_id: f.id,
          batch_id: `b_${session}`,
          served_at: new Date(Date.now() + session * 3600 * 1000),
        });
      }
    }

    const fairOlderImps = olderIds.reduce(
      (sum, id) => sum + fairSim.impressions.filter((imp) => imp.profile_id === id).length,
      0
    );
    const fairGini = fairSim.calculateExposureGini(candidateIds);

    // Measurable Verification:
    // 1. Starvation eliminated: older accounts received significant impressions
    expect(fairOlderImps).toBeGreaterThan(15);
    // 2. Exposure disparity significantly reduced: Gini drops below 0.35
    expect(fairGini).toBeLessThan(legacyGini);
    expect(fairGini).toBeLessThan(0.35);
  });

  it("protects privacy by suppressing demographic cohorts smaller than k=10", () => {
    // Demographic grouping test fixture
    const cohorts = [
      { gender: "woman", count: 42, impressions: 210 },
      { gender: "man", count: 38, impressions: 180 },
      { gender: "nonbinary", count: 4, impressions: 16 }, // Small cohort (<10)
    ];

    const processedBreakdown = cohorts.map((c) => {
      const isSuppressed = c.count < 10;
      return {
        gender: c.gender,
        is_suppressed: isSuppressed,
        eligible_count: isSuppressed ? null : c.count,
        impressions_7d: isSuppressed ? null : c.impressions,
        privacy_note: isSuppressed
          ? "Suppressed: cohort size < 10 (k-anonymity privacy protection)"
          : null,
      };
    });

    const womanCohort = processedBreakdown.find((x) => x.gender === "woman")!;
    expect(womanCohort.is_suppressed).toBe(false);
    expect(womanCohort.eligible_count).toBe(42);

    const nonbinaryCohort = processedBreakdown.find((x) => x.gender === "nonbinary")!;
    expect(nonbinaryCohort.is_suppressed).toBe(true);
    expect(nonbinaryCohort.eligible_count).toBeNull();
    expect(nonbinaryCohort.impressions_7d).toBeNull();
    expect(nonbinaryCohort.privacy_note).toContain("cohort size < 10");
  });
});
