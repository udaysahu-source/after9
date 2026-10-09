import { useState } from "react";
import { Dandiya } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { NIGHTS, goingNights, type Attendance } from "@/lib/after9";
import { cn } from "@/lib/utils";

export const fieldInput = "h-14 w-full border-b-2 border-border bg-transparent text-lg outline-none transition-colors duration-200 focus:border-action placeholder:text-muted-foreground/60";

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
