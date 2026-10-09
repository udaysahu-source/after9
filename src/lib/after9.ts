import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Attendance = "going" | "maybe" | "off";
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type FeedRow = Database["public"]["Functions"]["discover_feed"]["Returns"][number];

// Festival config lives in code; the database only stores night numbers per user.
export const FESTIVAL = { name: "Navratri", year: 2026, city: "Raipur", start: "2026-10-11" };

export const NIGHTS = Array.from({ length: 9 }, (_, i) => {
  const d = new Date(FESTIVAL.start);
  d.setDate(d.getDate() + i);
  return { n: i + 1, date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
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

const urlCache = new Map<string, string>();
/** Private photos → short-lived signed URLs. */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const need = paths.filter((p): p is string => !!p && !urlCache.has(p));
    const done = () => setUrls(Object.fromEntries(paths.filter((p): p is string => !!p && urlCache.has(p)).map((p) => [p, urlCache.get(p)!])));
    if (!need.length) return done();
    supabase.storage.from("photos").createSignedUrls(need, 3600).then(({ data }) => {
      data?.forEach((d) => d.path && d.signedUrl && urlCache.set(d.path, d.signedUrl));
      done();
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
