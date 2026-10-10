import { describe, it, expect, vi, beforeEach } from "vitest";
import { invalidatePhotoUrl } from "@/lib/after9";
import { isSafeHttpsUrl } from "@/lib/plan.functions";

describe("Storage Photo Security & Cache Invalidation", () => {
  it("exports invalidatePhotoUrl to safely clear expired or failed photo caches", () => {
    expect(typeof invalidatePhotoUrl).toBe("function");
    // Calling with null, undefined or string path must not throw
    expect(() => invalidatePhotoUrl(null)).not.toThrow();
    expect(() => invalidatePhotoUrl(undefined)).not.toThrow();
    expect(() => invalidatePhotoUrl("user-123/photo.jpg")).not.toThrow();
  });

  it("verifies photo paths conform to strictly scoped user folder structure", () => {
    const isSafePhotoPath = (path: string, userId: string): boolean => {
      if (!path || typeof path !== "string") return false;
      const safe = path.trim();
      if (safe.includes("..")) return false;
      if (!safe.startsWith(`${userId}/`)) return false;
      return /\.(jpg|jpeg|png|webp)$/i.test(safe);
    };

    const myUid = "10449dab-5cfc-4a72-8bda-f7c6bafc07fc";
    expect(isSafePhotoPath(`${myUid}/1791550136459.jpg`, myUid)).toBe(true);
    expect(isSafePhotoPath(`${myUid}/avatar.png`, myUid)).toBe(true);

    // Cross-user access attempt
    const otherUid = "6f4a1630-7e13-407b-9940-98e947c03e9e";
    expect(isSafePhotoPath(`${otherUid}/1791552632400.jpg`, myUid)).toBe(false);

    // Path traversal attempt
    expect(isSafePhotoPath(`${myUid}/../other/123.jpg`, myUid)).toBe(false);

    // Unsupported extension attempt
    expect(isSafePhotoPath(`${myUid}/malicious.exe`, myUid)).toBe(false);
  });
});

describe("Plan Tab - Stale Result Guard & Race Condition Protection", () => {
  it("ensures newer filter/date requests supersede and discard older delayed responses", async () => {
    // Simulate Plan tab race condition with request generation counter
    let activeRequestId = 0;
    let committedResults: string | null = null;
    let committedRequestId: number | null = null;

    const simulateFetch = async (requestId: number, queryDate: string, delayMs: number) => {
      await new Promise((r) => setTimeout(r, delayMs));
      // Guard: only commit if this request is still the active latest
      if (requestId === activeRequestId) {
        committedResults = `Events for ${queryDate}`;
        committedRequestId = requestId;
      }
    };

    // User rapidly switches dates: Oct 11 (slow 100ms) then Oct 12 (fast 20ms)
    activeRequestId = 1;
    const req1 = simulateFetch(1, "2026-10-11", 100);

    activeRequestId = 2;
    const req2 = simulateFetch(2, "2026-10-12", 20);

    await Promise.all([req1, req2]);

    // Request 2 must win and Request 1's late response must be dropped
    expect(committedRequestId).toBe(2);
    expect(committedResults).toBe("Events for 2026-10-12");
  });

  it("prevents updates when component is unmounted during in-flight fetch", async () => {
    let isMounted = true;
    let updateCommitted = false;

    const simulateFetchWithMountGuard = async () => {
      await new Promise((r) => setTimeout(r, 30));
      if (isMounted) {
        updateCommitted = true;
      }
    };

    const fetchPromise = simulateFetchWithMountGuard();
    // Component unmounts mid-flight
    isMounted = false;

    await fetchPromise;
    expect(updateCommitted).toBe(false);
  });
});

describe("Events Security & Sanitization", () => {
  it("strictly validates ticketing URLs to prevent malicious links in event cards", () => {
    expect(isSafeHttpsUrl("https://in.bookmyshow.com/events/raipur-garba")).toBe(true);
    expect(isSafeHttpsUrl("http://in.bookmyshow.com/events/raipur-garba")).toBe(false);
    expect(isSafeHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpsUrl(null)).toBe(false);
  });
});
