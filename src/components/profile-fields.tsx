import { useState, useEffect, useRef } from "react";
import { Dandiya } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { NIGHTS, goingNights, type Attendance } from "@/lib/after9";
import { cn } from "@/lib/utils";
import { validateBirthDate } from "@/lib/after9";
import { Camera, Upload, RefreshCw, X, Check, ShieldCheck } from "lucide-react";

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


/** Validates type/size/dimensions, centre-crops to 3:4, compresses, uploads to private storage. Supports file upload and live camera capture. */
export function PhotoPicker({
  userId,
  url,
  onUploaded,
  onRemove,
  onRequestVerification,
}: {
  userId: string;
  url?: string | null | undefined;
  onUploaded: (path: string, preview: string) => void;
  onRemove?: (() => void) | undefined;
  onRequestVerification?: (() => void) | undefined;
}) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    stopCamera();
    setErr("");
    setCapturedPreview(null);
    setCapturedBlob(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this browser or device.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setCameraStream(stream);
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      console.error("Camera error:", e);
      let message = "Could not access camera. Please allow camera permissions in your browser.";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        message = "Camera permission was denied. Please allow camera access in browser settings.";
      }
      setErr(message);
    }
  };

  const toggleCameraFacing = () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startCamera(next);
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCapturedPreview(null);
    setCapturedBlob(null);
  };

  // Re-attach video stream if ref mounts
  useEffect(() => {
    if (cameraOpen && cameraStream && videoRef.current && !capturedPreview) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen, cameraStream, capturedPreview]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedPreview(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const processAndUploadBlob = (blob: Blob) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width < 400 || img.height < 400) {
        setErr("Photo needs to be at least 400px on each side.");
        return;
      }
      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 1200;
      const ctx = c.getContext("2d");
      if (!ctx) {
        setErr("We couldn't process that photo.");
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const r = Math.max(900 / img.width, 1200 / img.height);
      const w = img.width * r;
      const h = img.height * r;
      ctx.drawImage(img, (900 - w) / 2, (1200 - h) / 2, w, h);
      c.toBlob(
        async (finalBlob) => {
          if (!finalBlob) {
            setErr("We couldn't process that photo.");
            return;
          }
          setBusy(true);
          const path = `${userId}/${Date.now()}.jpg`;
          const { error } = await supabase.storage.from("photos").upload(path, finalBlob, { contentType: "image/jpeg" });
          setBusy(false);
          if (error) {
            setErr(error.message);
            return;
          }
          const preview = URL.createObjectURL(finalBlob);
          onUploaded(path, preview);
          closeCamera();
          if (onRequestVerification) {
            onRequestVerification();
          }
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErr("That image could not be loaded.");
    };
    img.src = objectUrl;
  };

  const confirmCaptured = () => {
    if (capturedBlob) {
      processAndUploadBlob(capturedBlob);
    }
  };

  const pickFile = (f?: File) => {
    setErr("");
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr("Use a JPG, PNG or WebP photo.");
    if (f.size > 10 * 1024 * 1024) return setErr("That photo is over 10 MB.");
    processAndUploadBlob(f);
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* 3:4 Profile Photo Box */}
      <div className="relative flex aspect-[3/4] w-48 sm:w-56 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border/80 bg-card shadow-xs group transition hover:border-action">
        {url ? (
          <img src={url} alt="Your profile" className="h-full w-full object-cover transition duration-300 group-hover:scale-102" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-action group-hover:text-action-foreground">
              <Camera className="h-7 w-7" />
            </span>
            <span className="text-xs font-bold text-foreground">Add Profile Photo</span>
            <span className="text-[10px] text-muted-foreground">Solo portrait · 3:4 ratio</span>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/85 backdrop-blur-xs text-xs font-bold text-foreground">
            <RefreshCw className="h-5 w-5 animate-spin text-action" />
            <span>Processing photo…</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {/* Action Buttons: Camera vs File Upload */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => startCamera("user")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3.5 py-2 font-bold text-action-foreground shadow-xs transition hover:brightness-105 active:scale-95"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{url ? "Take New with Camera" : "Take with Camera"}</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 font-bold text-foreground transition hover:border-primary/60 active:scale-95"
        >
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{url ? "Upload from Files" : "Choose from Files"}</span>
        </button>

        {url && onRemove && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive underline px-2 py-1 transition"
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>

      {/* Direct Live Person Verification Prompt when photo is present */}
      {url && onRequestVerification && (
        <div className="mt-3 flex w-full max-w-xs items-center justify-between rounded-xl border border-action/30 bg-action/10 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-action shrink-0" />
            <span className="font-semibold text-foreground">Live selfie check</span>
          </div>
          <button
            type="button"
            onClick={onRequestVerification}
            className="font-bold text-action underline hover:opacity-80"
          >
            Verify Match
          </button>
        </div>
      )}

      {err && <p className="mt-3 text-center text-xs font-semibold text-destructive animate-fade-in">{err}</p>}

      {/* FULLSCREEN CAMERA CAPTURE VIEWFINDER */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 p-4 text-white sm:p-6 animate-fade-in backdrop-blur-md">
          {/* Viewfinder Top Bar */}
          <div className="flex w-full max-w-md items-center justify-between pt-2">
            <button
              type="button"
              onClick={closeCamera}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              aria-label="Close camera"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-wider text-action">LIVE PHOTO CAPTURE</p>
              <p className="text-[11px] text-white/70">Position your face inside the frame</p>
            </div>
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              aria-label="Flip camera"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Viewfinder Frame (3:4 portrait guide) */}
          <div className="relative my-auto flex aspect-[3/4] w-full max-w-xs sm:max-w-sm items-center justify-center overflow-hidden rounded-3xl border-2 border-white/30 bg-black shadow-2xl">
            {capturedPreview ? (
              <img src={capturedPreview} alt="Captured portrait" className="h-full w-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "h-full w-full object-cover",
                  facingMode === "user" && "-scale-x-100"
                )}
              />
            )}

            {/* Oval Face Guide Overlay */}
            {!capturedPreview && (
              <div className="pointer-events-none absolute inset-x-8 inset-y-12 rounded-[50%] border-2 border-dashed border-white/50" />
            )}
          </div>

          {/* Viewfinder Bottom Controls */}
          <div className="flex w-full max-w-md items-center justify-around pb-6">
            {capturedPreview ? (
              <div className="flex w-full items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={confirmCaptured}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-action px-6 py-3 text-sm font-extrabold text-action-foreground shadow-lg transition hover:brightness-105 active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{busy ? "Uploading…" : "Use Photo ✨"}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-action shadow-xl transition hover:scale-105 active:scale-95"
                  aria-label="Take photo"
                >
                  <div className="h-14 w-14 rounded-full bg-action-foreground/20 border-2 border-white/60" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CompactAgeRangePicker({
  minAge,
  maxAge,
  onChange,
}: {
  minAge: number;
  maxAge: number;
  onChange: (min: number, max: number) => void;
}) {
  const min = Math.max(18, minAge || 18);
  const max = Math.max(min, maxAge || 35);

  const setMin = (val: number) => {
    const clamped = Math.max(18, Math.min(val, max));
    onChange(clamped, max);
  };

  const setMax = (val: number) => {
    const clamped = Math.max(min, Math.min(val, 55));
    onChange(min, clamped);
  };

  const presets = [
    { label: "18 – 24 (Campus)", min: 18, max: 24 },
    { label: "21 – 28 (Young Pros)", min: 21, max: 28 },
    { label: "18 – 35 (Standard)", min: 18, max: 35 },
  ];

  return (
    <div className="space-y-4">
      {/* Visual range preview pill */}
      <div className="rounded-2xl border border-action/30 bg-action/5 p-4 text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-action">
          Selected Discovery Span
        </span>
        <h3 className="font-display text-2xl font-extrabold text-primary mt-0.5">
          {min} – {max} years old
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          Server-enforced: Only eligible adults aged 18+ can join or appear.
        </p>
      </div>

      {/* Two compact controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Min Age Stepper */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block text-center">
            Minimum Age (18+)
          </span>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={min <= 18}
              onClick={() => setMin(min - 1)}
              className="h-9 w-9 rounded-lg border border-border bg-background text-base font-bold text-foreground hover:bg-muted disabled:opacity-30 transition flex items-center justify-center"
            >
              −
            </button>
            <span className="font-mono text-xl font-extrabold text-primary">{min}</span>
            <button
              type="button"
              disabled={min >= max}
              onClick={() => setMin(min + 1)}
              className="h-9 w-9 rounded-lg border border-border bg-background text-base font-bold text-foreground hover:bg-muted disabled:opacity-30 transition flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Max Age Stepper */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block text-center">
            Maximum Age
          </span>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={max <= min}
              onClick={() => setMax(max - 1)}
              className="h-9 w-9 rounded-lg border border-border bg-background text-base font-bold text-foreground hover:bg-muted disabled:opacity-30 transition flex items-center justify-center"
            >
              −
            </button>
            <span className="font-mono text-xl font-extrabold text-primary">{max}</span>
            <button
              type="button"
              disabled={max >= 55}
              onClick={() => setMax(max + 1)}
              className="h-9 w-9 rounded-lg border border-border bg-background text-base font-bold text-foreground hover:bg-muted disabled:opacity-30 transition flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-semibold text-muted-foreground">Quick age presets:</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const active = min === p.min && max === p.max;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.min, p.max)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold border transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
