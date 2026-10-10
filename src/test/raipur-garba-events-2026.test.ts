import { describe, it, expect } from "vitest";
import { GARBA_EVENTS_2026 } from "@/lib/garba-events-data";
import { FALLBACK_RAIPUR_EVENTS, isSafeHttpsUrl } from "@/lib/plan.functions";

describe("Raipur Garba Events 2026 Dataset & Business Logic", () => {
  it("contains exactly 35 event records", () => {
    expect(GARBA_EVENTS_2026).toHaveLength(35);
    expect(FALLBACK_RAIPUR_EVENTS).toHaveLength(35);
  });

  it("ensures all event IDs and slugs are unique and non-empty", () => {
    const ids = GARBA_EVENTS_2026.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(35);

    const slugs = GARBA_EVENTS_2026.map((e) => e.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(35);
  });

  it("ensures all 18 supplied poster bundle images are uploaded to Supabase Storage", () => {
    const uploadedAssetPosters = GARBA_EVENTS_2026.filter((e) => Boolean(e.image_asset_file));
    expect(uploadedAssetPosters).toHaveLength(18);

    uploadedAssetPosters.forEach((e) => {
      expect(e.poster_url).toMatch(/^https:\/\/vjsqakziqyesruxggaik\.supabase\.co\/storage\/v1\/object\/public\/event-posters\//);
      expect(e.image_asset_file).toMatch(/^posters\//);
    });

    // Plus 1 official BookMyShow artwork = 19 total with poster_url
    const totalWithPosterUrl = GARBA_EVENTS_2026.filter((e) => Boolean(e.poster_url));
    expect(totalWithPosterUrl).toHaveLength(19);
  });

  it("ensures events without posters have null poster_url so fallback is shown", () => {
    const eventsWithoutPosters = GARBA_EVENTS_2026.filter((e) => e.poster_url === null);
    expect(eventsWithoutPosters).toHaveLength(16);

    eventsWithoutPosters.forEach((e) => {
      expect(e.poster_url).toBeNull();
    });
  });

  it("distinguishes free entry (0) from unconfirmed prices (null) strictly", () => {
    // Asian News Raas Garba is known free entry (0)
    const asianNews = GARBA_EVENTS_2026.find((e) => e.slug === "asian-news-raas-garba");
    expect(asianNews?.min_price_inr).toBe(0);

    // Beat Pe Garba is ₹800
    const beatPe = GARBA_EVENTS_2026.find((e) => e.slug === "beat-pe-garba");
    expect(beatPe?.min_price_inr).toBe(800);

    // Samta Colony is unknown (null) and must NEVER be 0
    const samta = GARBA_EVENTS_2026.find((e) => e.slug === "samta-colony-raas-garba");
    expect(samta?.min_price_inr).toBeNull();
    expect(samta?.min_price_inr).not.toBe(0);
  });

  it("ensures bookingUrl is only considered valid if it is a safe HTTPS URL", () => {
    const validBookingEvents = GARBA_EVENTS_2026.filter((e) => isSafeHttpsUrl(e.booking_url));
    expect(validBookingEvents.length).toBeGreaterThanOrEqual(4);

    validBookingEvents.forEach((e) => {
      expect(e.booking_url).toMatch(/^https:\/\//);
      expect(e.has_valid_booking_url).toBe(true);
    });
  });

  it("ensures maps_url is populated for venue directions", () => {
    const eventsWithMaps = GARBA_EVENTS_2026.filter((e) => Boolean(e.maps_url));
    expect(eventsWithMaps.length).toBe(35);

    eventsWithMaps.forEach((e) => {
      expect(e.maps_url).toMatch(/https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    });
  });

  it("ensures Instagram handles are formatted and clean", () => {
    const eventsWithIg = GARBA_EVENTS_2026.filter((e) => Boolean(e.instagram_handle));
    expect(eventsWithIg).toHaveLength(16);

    eventsWithIg.forEach((e) => {
      expect(e.instagram_handle).toMatch(/^@/);
      const clean = e.instagram_handle!.replace(/^@/, "");
      expect(clean.length).toBeGreaterThan(0);
    });
  });

  it("ensures initial publication status keeps pending_review events in draft", () => {
    const published = GARBA_EVENTS_2026.filter((e) => e.publication_status === "published");
    const drafts = GARBA_EVENTS_2026.filter((e) => e.publication_status === "draft");

    // Exactly 3 verified / listed events published, 32 pending review kept as drafts
    expect(published).toHaveLength(3);
    expect(drafts).toHaveLength(32);
  });

  it("preserves poster content notes and verification notes for admin inspection", () => {
    const withNotes = GARBA_EVENTS_2026.filter((e) => Boolean(e.poster_content_notes));
    expect(withNotes).toHaveLength(18);

    const withVerification = GARBA_EVENTS_2026.filter((e) => Boolean(e.verification_notes));
    expect(withVerification).toHaveLength(35);
  });
});
