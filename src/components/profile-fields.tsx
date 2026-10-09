import { useState, useEffect, useRef } from "react";
import { Dandiya } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { NIGHTS, goingNights, type Attendance } from "@/lib/after9";
import { cn } from "@/lib/utils";
import { validateBirthDate } from "@/lib/after9";

export const fieldInput = "h-14 w-full border-b-2 border-border bg-transparent text-lg outline-none transition-colors duration-200 focus:border-action placeholder:text-muted-foreground/60";

/**
 * India-first DD / MM / YYYY date picker.
 * Avoids American mm/dd/yyyy browser issues, validates 18+ status in real time.
 */
export function IndiaBirthdayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (isoDate: string) => void;
}) {
  const parts = (value || "").split("-");
  const initialYear = parts[0] || "";
  const initialMonth = parts[1] || "";
  const initialDay = parts[2] || "";

  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  // Sync internal state if external value changes (e.g. back navigation)
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      if (y !== year) setYear(y || "");
      if (m !== month) setMonth(m || "");
      if (d !== day) setDay(d || "");
    }
  }, [value]);

  const update = (d: string, m: string, y: string) => {
    setDay(d);
    setMonth(m);
    setYear(y);

    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const paddedDay = d.padStart(2, "0");
      const paddedMonth = m.padStart(2, "0");
      const iso = `${y}-${paddedMonth}-${paddedDay}`;
      onChange(iso);
    } else if (!d && !m && !y) {
      onChange("");
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    update(raw, month, year);
    if (raw.length === 2) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    update(day, raw, year);
    if (raw.length === 2) {
      yearRef.current?.focus();
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    update(day, month, raw);
  };

  const handleMonthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !month) {
      dayRef.current?.focus();
    }
  };

  const handleYearKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !year) {
      monthRef.current?.focus();
    }
  };

  const isComplete = day.length === 2 && month.length === 2 && year.length === 4;
  const isoDate = isComplete ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
  const check = isComplete ? validateBirthDate(isoDate) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground uppercase tracking-wider">
          Date of Birth <span className="font-normal text-action">(DD / MM / YYYY)</span>
        </span>
        <span className="text-[11px] text-muted-foreground">India standard format</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {/* Day input */}
        <div className="relative">
          <input
            ref={dayRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={day}
            onChange={handleDayChange}
            placeholder="DD"
            className={cn(
              "h-13 w-full rounded-xl border border-border bg-background px-3 text-center font-mono text-base font-semibold outline-none transition focus:border-action focus:ring-1 focus:ring-action/30",
              isComplete && check && !check.valid && "border-destructive/60 bg-destructive/5"
            )}
            aria-label="Day (DD)"
          />
          <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-muted-foreground">
            Day
          </span>
        </div>

        {/* Month input */}
        <div className="relative">
          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={month}
            onChange={handleMonthChange}
            onKeyDown={handleMonthKeyDown}
            placeholder="MM"
            className={cn(
              "h-13 w-full rounded-xl border border-border bg-background px-3 text-center font-mono text-base font-semibold outline-none transition focus:border-action focus:ring-1 focus:ring-action/30",
              isComplete && check && !check.valid && "border-destructive/60 bg-destructive/5"
            )}
            aria-label="Month (MM)"
          />
          <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-muted-foreground">
            Month
          </span>
        </div>

        {/* Year input */}
        <div className="relative">
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={year}
            onChange={handleYearChange}
            onKeyDown={handleYearKeyDown}
            placeholder="YYYY"
            className={cn(
              "h-13 w-full rounded-xl border border-border bg-background px-3 text-center font-mono text-base font-semibold outline-none transition focus:border-action focus:ring-1 focus:ring-action/30",
              isComplete && check && !check.valid && "border-destructive/60 bg-destructive/5"
            )}
            aria-label="Year (YYYY)"
          />
          <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-muted-foreground">
            Year
          </span>
        </div>
      </div>

      {/* Validation feedback */}
      <div className="pt-4 min-h-[22px]">
        {isComplete && check ? (
          check.valid ? (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 animate-fade-in">
              <span>✓</span>
              <span>Age: {check.age} years old · Eligible for festival floor</span>
            </p>
          ) : (
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5 animate-fade-in">
              <span>⛔</span>
              <span>{check.error}</span>
            </p>
          )
        ) : (
          <p className="text-[11px] text-muted-foreground">
            You must be at least 18 years old to join After9.
          </p>
        )}
      </div>
    </div>
  );
}

export function Choice({ options, value, onChange }: { options: readonly (readonly [string, string])[]; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "touch-tactile h-11 rounded-sm border px-4 text-sm font-medium transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-95",
            value === v
              ? "border-primary bg-primary text-primary-foreground shadow-xs"
              : "border-border hover:border-primary/60 active:bg-muted/40"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function OptionList({ options, value, onPick }: { options: readonly string[]; value?: string | undefined; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={cn(
            "touch-tactile flex h-16 items-center justify-between rounded-sm border px-5 text-left text-lg font-medium transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-[0.98]",
            value === o
              ? "border-action bg-card text-primary shadow-xs"
              : "border-border hover:border-primary/60 active:bg-muted/40"
          )}
        >
          <span>{o}</span>
          {value === o && <Dandiya className="h-5 w-5 text-action animate-scale-in" />}
        </button>
      ))}
    </div>
  );
}

export function NightsPicker({ value, onChange }: { value: Record<string, Attendance>; onChange: (v: Record<string, Attendance>) => void }) {
  const next: Record<Attendance, Attendance> = { off: "going", going: "maybe", maybe: "off" };
  const count = goingNights(value).length;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {NIGHTS.map((x) => {
          const s = value[x.n] ?? "off";
          return (
            <button
              key={x.n}
              type="button"
              onClick={() => onChange({ ...value, [x.n]: next[s] })}
              className={cn(
                "touch-tactile relative flex aspect-square flex-col justify-between rounded-sm border p-3 text-left transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-[0.92] hover:scale-[1.02]",
                s === "going" && "border-primary bg-primary text-primary-foreground shadow-xs",
                s === "maybe" && "border-action bg-card text-primary shadow-xs",
                s === "off" && "border-border text-muted-foreground hover:border-primary/40 active:bg-muted/30"
              )}
            >
              <span className="font-display text-3xl font-extrabold tracking-tight">{x.n}</span>
              <span className="text-[11px] leading-tight font-medium">
                {x.date}
                <br />
                <span className={cn("inline-block mt-0.5", s !== "off" && "font-semibold")}>
                  {s === "off" ? "Off" : s === "going" ? "Going" : "Maybe"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-display text-lg text-primary flex items-center gap-2">
        <span key={count} className="animate-scale-in font-extrabold text-action">
          {count}
        </span>
        <span>of 9 festival nights</span>
      </p>
    </>
  );
}


/** Validates type/size/dimensions, centre-crops to 3:4, compresses, uploads to private storage. */
export function PhotoPicker({ userId, url, onUploaded, onRemove }: { userId: string; url?: string | undefined; onUploaded: (path: string, preview: string) => void; onRemove?: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = (f?: File) => {
    setErr("");
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr("Use a JPG, PNG or WebP photo.");
    if (f.size > 10 * 1024 * 1024) return setErr("That photo is over 10 MB.");
    const img = new Image();
    img.onload = () => {
      if (img.width < 400 || img.height < 400) return setErr("Photo needs to be at least 400px on each side.");
      const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
      const r = Math.max(900 / img.width, 1200 / img.height);
      const w = img.width * r, h = img.height * r;
      c.getContext("2d")!.drawImage(img, (900 - w) / 2, (1200 - h) / 2, w, h);
      c.toBlob(async (blob) => {
        if (!blob) return setErr("We couldn't process that photo.");
        setBusy(true);
        const path = `${userId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
        setBusy(false);
        if (error) return setErr(error.message);
        onUploaded(path, URL.createObjectURL(blob));
      }, "image/jpeg", 0.82);
    };
    img.onerror = () => setErr("That file isn't a readable image.");
    img.src = URL.createObjectURL(f);
  };
  return (
    <div className="flex flex-col items-center">
      <label className="relative flex aspect-[3/4] w-3/4 cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-border bg-card">
        {url ? <img src={url} alt="Your profile" className="h-full w-full object-cover" /> : <span className="font-display text-5xl text-action">+</span>}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm font-semibold">Uploading…</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <div className="mt-3 flex gap-4 text-sm">
        {url && <label className="cursor-pointer font-semibold text-primary">Replace<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>}
        {url && onRemove && <button type="button" className="text-muted-foreground underline" onClick={onRemove}>Remove</button>}
      </div>
      {err && <p className="mt-3 text-center text-sm text-destructive">{err}</p>}
    </div>
  );
}
