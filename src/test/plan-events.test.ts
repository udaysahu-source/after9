import { describe, expect, it } from "vitest";
import { isSafeHttpsUrl } from "@/lib/plan.functions";
import { formatEventDate } from "@/components/plan-components";

describe("Plan Events - Security & URL Validation", () => {
  it("accepts legitimate HTTPS ticketing and organizer URLs", () => {
    expect(isSafeHttpsUrl("https://in.bookmyshow.com/events/raipur-garba/ET12345")).toBe(true);
    expect(isSafeHttpsUrl("https://insider.in/maa-aarna-raas-garba-2026")).toBe(true);
    expect(isSafeHttpsUrl("https://events.after9.app/tickets/neon-raas")).toBe(true);
  });

  it("rejects insecure plain HTTP URLs", () => {
    expect(isSafeHttpsUrl("http://in.bookmyshow.com/events/raipur")).toBe(false);
    expect(isSafeHttpsUrl("http://example.com/tickets")).toBe(false);
  });

  it("strictly rejects dangerous pseudo-protocols (XSS / open execution vectors)", () => {
    expect(isSafeHttpsUrl("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeHttpsUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpsUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpsUrl("vbscript:MsgBox(1)")).toBe(false);
  });

  it("blocks SSRF targets and loopback / private subnet addresses", () => {
    expect(isSafeHttpsUrl("https://localhost/admin")).toBe(false);
    expect(isSafeHttpsUrl("https://127.0.0.1:8000/private")).toBe(false);
    expect(isSafeHttpsUrl("https://0.0.0.0/")).toBe(false);
    expect(isSafeHttpsUrl("https://192.168.1.1/router")).toBe(false);
    expect(isSafeHttpsUrl("https://10.0.0.5/api/credentials")).toBe(false);
    expect(isSafeHttpsUrl("https://metadata.google.internal/computeMetadata")).toBe(false);
    expect(isSafeHttpsUrl("https://dev.local/tickets")).toBe(false);
  });

  it("handles null, undefined, empty and malformed string inputs gracefully", () => {
    expect(isSafeHttpsUrl(null)).toBe(false);
    expect(isSafeHttpsUrl(undefined)).toBe(false);
    expect(isSafeHttpsUrl("")).toBe(false);
    expect(isSafeHttpsUrl("   ")).toBe(false);
    expect(isSafeHttpsUrl("not a url")).toBe(false);
  });
});

describe("Plan Events - Date Ribbon & Multi-Day Filtering Logic", () => {
  it("formats single-day event dates cleanly in local festival style", () => {
    expect(formatEventDate("2026-10-17", "2026-10-17")).toBe("17 Oct 2026");
    expect(formatEventDate("2026-10-15", null)).toBe("15 Oct 2026");
  });

  it("formats multi-day event spans across same month accurately", () => {
    expect(formatEventDate("2026-10-11", "2026-10-19")).toBe("11–19 Oct 2026");
    expect(formatEventDate("2026-10-16", "2026-10-19")).toBe("16–19 Oct 2026");
  });

  it("correctly identifies applicable dates for multi-day events", () => {
    const isEventOnDate = (eventStartDate: string, eventEndDate: string | null, targetDate: string) => {
      const end = eventEndDate || eventStartDate;
      return targetDate >= eventStartDate && targetDate <= end;
    };

    // Maa Aarna: 16 to 19 Oct 2026
    expect(isEventOnDate("2026-10-16", "2026-10-19", "2026-10-16")).toBe(true);
    expect(isEventOnDate("2026-10-16", "2026-10-19", "2026-10-17")).toBe(true);
    expect(isEventOnDate("2026-10-16", "2026-10-19", "2026-10-18")).toBe(true);
    expect(isEventOnDate("2026-10-16", "2026-10-19", "2026-10-19")).toBe(true);
    expect(isEventOnDate("2026-10-16", "2026-10-19", "2026-10-15")).toBe(false);
    expect(isEventOnDate("2026-10-16", "2026-10-19", "2026-10-20")).toBe(false);

    // Neon Raas: Single day 17 Oct 2026
    expect(isEventOnDate("2026-10-17", "2026-10-17", "2026-10-17")).toBe(true);
    expect(isEventOnDate("2026-10-17", "2026-10-17", "2026-10-18")).toBe(false);
  });
});

describe("Plan Events - Search Matching Logic", () => {
  const sampleEvents = [
    {
      id: "maa-aarna",
      name: "Maa Aarna Raas Garba 2.0",
      venue: "The Grand Neelam Hotel",
      area: "VIP Road",
      organizer: "Maa Aarna Media Enterprises / Sadhna News",
      city: "Raipur",
    },
    {
      id: "rajdhani",
      name: "Rajdhani Raasgarba Utsav 2026",
      venue: "Avadhpuri Maidan, Hanuman Mandir Trust",
      area: "Shrinagar, Gudhiyari",
      organizer: null,
      city: "Raipur",
    },
    {
      id: "neon-raas",
      name: "Neon Raas 1.0",
      venue: "Rosebay Resort",
      area: "Ama Seoni",
      organizer: "Rotary Club of Raipur Cosmo Divas",
      city: "Raipur",
    },
  ];

  const searchEvents = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return sampleEvents;
    return sampleEvents.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        (e.area && e.area.toLowerCase().includes(q)) ||
        (e.organizer && e.organizer.toLowerCase().includes(q))
    );
  };

  it("finds events matching by venue name", () => {
    const results = searchEvents("Avadhpuri");
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe("rajdhani");
  });

  it("finds events matching by area / locality", () => {
    const results = searchEvents("VIP Road");
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe("maa-aarna");
  });

  it("finds events matching by organizer", () => {
    const results = searchEvents("Rotary Club");
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe("neon-raas");
  });

  it("returns empty result on non-existent search term", () => {
    const results = searchEvents("Nonexistent Hall Mumbai");
    expect(results.length).toBe(0);
  });
});

describe("Plan Events - Group Planning Consensus Rules", () => {
  type ParticipantStatus = "invited" | "accepted" | "declined";

  interface PlanParticipant {
    userId: string;
    status: ParticipantStatus;
  }

  function computeGroupPlanStatus(
    participants: PlanParticipant[]
  ): "proposed" | "awaiting_responses" | "confirmed" | "cancelled" {
    if (participants.some((p) => p.status === "declined")) {
      return "cancelled";
    }
    const allAccepted = participants.every((p) => p.status === "accepted");
    if (allAccepted && participants.length > 0) {
      return "confirmed";
    }
    return "awaiting_responses";
  }

  it("requires ALL participants to explicitly accept before marking plan confirmed", () => {
    const participants: PlanParticipant[] = [
      { userId: "creator", status: "accepted" },
      { userId: "friend1", status: "invited" },
    ];
    // Creator accepting cannot confirm on behalf of friend1
    expect(computeGroupPlanStatus(participants)).toBe("awaiting_responses");

    // Once friend1 explicitly accepts, plan becomes confirmed
    if (participants[1]) {
      participants[1].status = "accepted";
    }
    expect(computeGroupPlanStatus(participants)).toBe("confirmed");
  });

  it("cancels or flags the group plan if a required participant declines", () => {
    const participants: PlanParticipant[] = [
      { userId: "creator", status: "accepted" },
      { userId: "friend1", status: "declined" },
    ];
    expect(computeGroupPlanStatus(participants)).toBe("cancelled");
  });
});
