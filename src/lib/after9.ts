import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Attendance = "going" | "maybe" | "off";
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type FeedRow = Database["public"]["Functions"]["discover_feed"]["Returns"][number];

// Festival config lives in code; the database only stores night numbers per user.
export const FESTIVAL = { name: "Navratri", year: 2026, city: "Raipur", start: "2026-10-11" };

export const NAVRATRI_THEMES = [
  "Orange (Shailputri)",
  "White (Brahmacharini)",
  "Red (Chandraghanta)",
  "Royal Blue (Kushmanda)",
  "Yellow (Skandamata)",
  "Green (Katyayani)",
  "Grey (Kalaratri)",
  "Purple (Mahagauri)",
  "Peacock Green (Siddhidatri)",
] as const;

export const NIGHTS = Array.from({ length: 9 }, (_, i) => {
  const d = new Date(FESTIVAL.start);
  d.setDate(d.getDate() + i);
  return {
    n: i + 1,
    night: i + 1,
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    theme: NAVRATRI_THEMES[i] || `Theme ${i + 1}`,
  };
});

export const QUIZ = [
  { key: "energy", q: "What's your Garba energy?", options: ["Just vibing", "Know a few moves", "Full send"] },
  { key: "experience", q: "How experienced are you?", options: ["Clueless, teach me", "Beginner", "Comfortable", "Experienced"] },
  { key: "night", q: "Your ideal night?", options: ["Chill + friends", "Dance till late", "Food + dance", "Full festival chaos"] },
] as const;

export const GENDERS = [["woman", "Woman"], ["man", "Man"], ["nonbinary", "Non-binary"]] as const;
export const INTERESTS = [["woman", "Women"], ["man", "Men"], ["everyone", "Everyone"]] as const;

type Nights = Record<string, Attendance>;
export const goingNights = (nights: unknown) =>
  Object.entries((nights ?? {}) as Nights).filter(([, v]) => v !== "off").map(([k]) => Number(k)).sort((a, b) => a - b);
export const shared = (a: unknown, b: unknown) => goingNights(a).filter((n) => goingNights(b).includes(n));

/** Playful, deterministic vibe score: shared quiz answers count double, plus shared nights. */
export function vibe(myQuiz: unknown, myNights: unknown, p: { quiz: unknown; nights: unknown }) {
  const a = (myQuiz ?? {}) as Record<string, string>, b = (p.quiz ?? {}) as Record<string, string>;
  return QUIZ.filter((x) => a[x.key] && a[x.key] === b[x.key]).length * 2 + shared(myNights, p.nights).length;
}

/**
 * Validates birth date for India-first DD/MM/YYYY inputs stored as ISO YYYY-MM-DD.
 * Enforces 18+ adult age eligibility, disallows future dates, checks calendar validity.
 */
export function validateBirthDate(birth: string): {
  valid: boolean;
  age: number;
  error?: string;
} {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    return { valid: false, age: 0, error: "Please enter a complete date (DD/MM/YYYY)." };
  }

  const [yStr, mStr, dStr] = birth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, age: 0, error: "Please enter a valid calendar date." };
  }

  // Check valid day of month (including leap year for Feb)
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { valid: false, age: 0, error: `Invalid date: month ${month} only has ${daysInMonth} days in ${year}.` };
  }

  const birthDate = new Date(year, month - 1, day);
  const now = new Date();

  if (birthDate > now) {
    return { valid: false, age: 0, error: "Birth date cannot be in the future." };
  }

  if (year < 1920) {
    return { valid: false, age: 0, error: "Please enter a valid birth year." };
  }

  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    age--;
  }

  if (age < 18) {
    return {
      valid: false,
      age,
      error: `You must be at least 18 years old to join After9 (current age: ${age}).`,
    };
  }

  return { valid: true, age };
}

export function ageFrom(birth: string): number {
  if (!birth) return 0;
  const check = validateBirthDate(birth);
  return check.age;
}

interface CachedPhotoUrl {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, CachedPhotoUrl>();

/** Invalidate cached signed URL when photo changes, is removed, or fails */
export function invalidatePhotoUrl(path: string | null | undefined) {
  if (path) urlCache.delete(path);
}

/**
 * Resolves private photos into short-lived signed URLs.
 * Automatically refreshes URLs that are expired or expiring within 2 minutes.
 * Does not log or leak signed URLs.
 */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const now = Date.now();
    // Re-sign if not cached or if expiring within 2 minutes (120,000 ms)
    const need = paths.filter((p): p is string => {
      if (!p) return false;
      const cached = urlCache.get(p);
      return !cached || cached.expiresAt <= now + 120_000;
    });

    const updateState = () => {
      const activeEntries = paths
        .filter((p): p is string => !!p && urlCache.has(p))
        .map((p) => [p, urlCache.get(p)!.url] as const);
      setUrls(Object.fromEntries(activeEntries));
    };

    if (!need.length) {
      updateState();
      return;
    }

    // 1800s (30m) safe short-lived expiration
    const expiresInSeconds = 1800;
    supabase.storage
      .from("photos")
      .createSignedUrls(need, expiresInSeconds)
      .then(({ data, error }) => {
        if (!error && data) {
          const expiresAt = Date.now() + expiresInSeconds * 1000;
          data.forEach((d) => {
            if (d.path && d.signedUrl) {
              urlCache.set(d.path, { url: d.signedUrl, expiresAt });
            }
          });
        }
        updateState();
      })
      .catch(() => {
        updateState();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export function useMyProfile() {
  const [p, setP] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    setP(data); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const save = async (patch: Partial<ProfileRow>) => {
    if (!p) return { error: new Error("No profile") };
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", p.id).select("*").single();
    if (data) setP(data);
    return { error };
  };
  return { p, loading, save, reload: load };
}

export type VisibilityAudience = "only_me" | "college" | "nearby" | "event";

export const VISIBILITY_OPTIONS = [
  {
    id: "only_me" as VisibilityAudience,
    title: "Only Me",
    subtitle: "My profile is hidden from discovery.",
    audienceType: "private",
    meterLevel: 1,
  },
  {
    id: "college" as VisibilityAudience,
    title: "My College",
    subtitle: "Discoverable by eligible users from my college.",
    audienceType: "limited",
    meterLevel: 2,
  },
  {
    id: "nearby" as VisibilityAudience,
    title: "Nearby",
    subtitle: "Discoverable by eligible users in my selected general area.",
    audienceType: "limited",
    meterLevel: 2,
  },
  {
    id: "event" as VisibilityAudience,
    title: "Event Community",
    subtitle: "Discoverable by eligible users participating in the same supported festival community or event.",
    audienceType: "wider",
    meterLevel: 3,
  },
] as const;

export const COARSE_AREAS = [
  "Telibandha / VIP Road",
  "Shankar Nagar / Civil Lines",
  "Pandri / Devendra Nagar",
  "Samta Colony / Choubey Colony",
  "Tatibandh / GE Road",
  "Bhilai / Durg",
  "Naya Raipur",
  "Raipur Central",
] as const;

export const POPULAR_COLLEGES = [
  "SSIPMT Raipur",
  "NIT Raipur",
  "HNLU Raipur",
  "AIIMS Raipur",
  "IIT Bhilai",
  "BIT Durg",
  "Rungta Bhilai",
  "Govt Engineering College Raipur",
  "Pt. Ravishankar Shukla University",
] as const;

export function getPrivacyMeterStatus(audiences: string[] = []): {
  level: 1 | 2 | 3;
  label: "More private" | "Limited audience" | "Wider audience";
  description: string;
} {
  if (!audiences || audiences.length === 0 || audiences.includes("only_me")) {
    return {
      level: 1,
      label: "More private",
      description: "My profile is hidden from discovery.",
    };
  }

  // If only college OR only nearby is selected
  if (audiences.length === 1 && (audiences.includes("college") || audiences.includes("nearby"))) {
    return {
      level: 2,
      label: "Limited audience",
      description: "Discoverable only within your specific campus or general neighborhood.",
    };
  }

  // Event community or multiple audiences selected
  return {
    level: 3,
    label: "Wider audience",
    description: "Discoverable across your selected communities. Broader selections expand who may discover you.",
  };
}

export function getPrivacyPreviewText(
  audiences: string[] = [],
  college?: string | null,
  area?: string | null,
): string {
  if (!audiences || audiences.length === 0 || audiences.includes("only_me")) {
    return "Your profile is hidden from discovery. You will not appear on Discover while this setting is active.";
  }

  const parts: string[] = [];
  if (audiences.includes("college")) {
    parts.push(college ? `your selected college community (${college})` : "your selected college community");
  }
  if (audiences.includes("nearby")) {
    parts.push(area ? `your selected general area (${area})` : "your selected general area");
  }
  if (audiences.includes("event")) {
    parts.push("the same festival community");
  }

  if (parts.length === 1) {
    if (audiences.includes("college")) {
      return `Your profile can appear to eligible After9 users in ${parts[0]}.`;
    }
    if (audiences.includes("nearby")) {
      return `Your profile can appear to eligible After9 users in ${parts[0]}.`;
    }
    return `Your profile can appear to eligible After9 users participating in ${parts[0]}.`;
  }

  return `Your profile can appear to eligible After9 users across ${parts.join(" and ")}. Selecting multiple audiences expands who may discover you.`;
}
