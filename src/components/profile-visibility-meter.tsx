import { useState } from "react";
import {
  Lock,
  GraduationCap,
  MapPin,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
  Compass,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VISIBILITY_OPTIONS,
  COARSE_AREAS,
  POPULAR_COLLEGES,
  getPrivacyMeterStatus,
  getPrivacyPreviewText,
  type VisibilityAudience,
} from "@/lib/after9";
import { toast } from "sonner";

export interface ProfileVisibilityMeterProps {
  audiences: string[];
  onChangeAudiences: (newAudiences: string[]) => void;
  college?: string | null | undefined;
  onChangeCollege?: ((college: string | null) => void) | undefined;
  generalArea?: string | null | undefined;
  onChangeGeneralArea?: ((area: string | null) => void) | undefined;
  discoverable?: boolean | undefined;
  onToggleDiscoverable?: ((discoverable: boolean) => void) | undefined;
  showPreviewModal?: boolean | undefined;
  userFirstName?: string | null | undefined;
  userAge?: number | null | undefined;
  userPhotoUrl?: string | null | undefined;
  userPrompt?: string | null | undefined;
  userNightsCount?: number | undefined;
  className?: string | undefined;
  isCompact?: boolean | undefined;
}

export function ProfileVisibilityMeter({
  audiences = ["only_me"],
  onChangeAudiences,
  college = "",
  onChangeCollege,
  generalArea = "",
  onChangeGeneralArea,
  discoverable = true,
  onToggleDiscoverable,
  userFirstName = "You",
  userAge,
  userPhotoUrl,
  userPrompt,
  userNightsCount = 0,
  className,
  isCompact = false,
}: ProfileVisibilityMeterProps) {
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showOthersSeeModal, setShowOthersSeeModal] = useState(false);
  const [customCollegeInput, setCustomCollegeInput] = useState(
    college && !POPULAR_COLLEGES.includes(college as (typeof POPULAR_COLLEGES)[number])
      ? college
      : "",
  );

  const meter = getPrivacyMeterStatus(audiences);
  const previewText = getPrivacyPreviewText(audiences, college, generalArea);

  const isSelected = (id: VisibilityAudience) => {
    if (id === "only_me") {
      return !audiences || audiences.length === 0 || audiences.includes("only_me");
    }
    return audiences.includes(id) && !audiences.includes("only_me");
  };

  const toggleAudience = (id: VisibilityAudience) => {
    if (id === "only_me") {
      onChangeAudiences(["only_me"]);
      return;
    }

    // Removing only_me if toggling an audience
    const currentActive = audiences.filter((a) => a !== "only_me");
    let next: string[];

    if (currentActive.includes(id)) {
      next = currentActive.filter((a) => a !== id);
      if (next.length === 0) {
        next = ["only_me"];
      }
    } else {
      next = [...currentActive, id];
    }

    onChangeAudiences(next);
  };

  // Coarse location detector (requests location once, maps to nearest coarse Raipur area, NEVER saves exact GPS)
  const handleDetectRoughArea = () => {
    if (!navigator.geolocation) {
      toast.error("Location access is not supported by your browser. Please select an area manually.");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingLocation(false);
        const { latitude, longitude } = pos.coords;

        // Approximate coarse neighborhood mapping in Raipur / CG region
        let roughArea = "Raipur Central";
        if (latitude > 21.22 && latitude < 21.25 && longitude > 81.65 && longitude < 81.69) {
          roughArea = "Telibandha / VIP Road";
        } else if (latitude >= 21.24 && latitude < 21.27 && longitude > 81.63 && longitude < 81.67) {
          roughArea = "Shankar Nagar / Civil Lines";
        } else if (latitude >= 21.26 && longitude >= 81.64 && longitude <= 81.67) {
          roughArea = "Pandri / Devendra Nagar";
        } else if (latitude < 21.20 && longitude > 81.74) {
          roughArea = "Naya Raipur";
        } else if (longitude < 81.45) {
          roughArea = "Bhilai / Durg";
        } else if (longitude < 81.60) {
          roughArea = "Tatibandh / GE Road";
        }

        if (onChangeGeneralArea) {
          onChangeGeneralArea(roughArea);
          toast.success(`General neighborhood detected: ${roughArea}`);
        }
      },
      (err) => {
        setDetectingLocation(false);
        console.warn("[Location] permission denied or error:", err.message);
        toast.info("Location permission was not granted. You can select your general area manually from the list.");
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  const isMultiple = audiences.filter((a) => a !== "only_me").length > 1;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* 1. Header & Privacy Meter Indicator */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-display text-base sm:text-lg font-bold text-primary">
              Who can discover you?
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose the intended audience for your profile on After9.
            </p>
          </div>

          <div
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-bold shrink-0 tracking-wide",
              meter.level === 1 && "bg-muted text-muted-foreground border border-border",
              meter.level === 2 && "bg-teal/15 text-teal border border-teal/30",
              meter.level === 3 && "bg-action/15 text-action border border-action/30",
            )}
          >
            {meter.label}
          </div>
        </div>

        {/* 3-Level Visual Privacy Meter */}
        <div className="space-y-1.5 pt-1">
          <div className="flex h-2 w-full gap-1.5 overflow-hidden rounded-full bg-muted/60 p-0.5">
            <div
              className={cn(
                "h-full flex-1 rounded-full transition-all duration-300",
                meter.level >= 1 ? "bg-muted-foreground/70" : "bg-transparent",
              )}
            />
            <div
              className={cn(
                "h-full flex-1 rounded-full transition-all duration-300",
                meter.level >= 2 ? "bg-teal" : "bg-transparent",
              )}
            />
            <div
              className={cn(
                "h-full flex-1 rounded-full transition-all duration-300",
                meter.level >= 3 ? "bg-action" : "bg-transparent",
              )}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span className={cn(meter.level === 1 && "font-bold text-foreground")}>
              More private
            </span>
            <span className={cn(meter.level === 2 && "font-bold text-teal")}>
              Limited audience
            </span>
            <span className={cn(meter.level === 3 && "font-bold text-action")}>
              Wider audience
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
          This indicator reflects your chosen audience scope, not a security score or guarantee of
          anonymity.
        </p>
      </div>

      {/* 2. Optional "Hide me from Discover" Master Switch */}
      {onToggleDiscoverable && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="pr-3">
              <div className="flex items-center gap-1.5">
                {!discoverable ? (
                  <EyeOff className="h-4 w-4 text-action" />
                ) : (
                  <Eye className="h-4 w-4 text-teal" />
                )}
                <h4 className="font-display text-sm font-bold text-primary">
                  Hide me from Discover
                </h4>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immediately prevents your profile from appearing in new discovery results.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={!discoverable}
              onClick={() => onToggleDiscoverable(!discoverable)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition",
                !discoverable ? "bg-action" : "bg-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-5 w-5 rounded-full bg-background transition-all shadow-xs",
                  !discoverable ? "left-6" : "left-1",
                )}
              />
            </button>
          </div>

          {!discoverable && (
            <p className="text-[11px] text-action font-semibold pt-1 border-t border-action/20">
              ● Your profile is currently hidden from Discover. Toggle off when you want to be
              discoverable again.
            </p>
          )}
        </div>
      )}

      {/* 3. The Four Audience Level Cards */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Select Discovery Audiences
        </p>

        {VISIBILITY_OPTIONS.map((opt) => {
          const active = isSelected(opt.id);

          return (
            <div
              key={opt.id}
              className={cn(
                "rounded-2xl border transition-all duration-200 overflow-hidden",
                active
                  ? "border-primary bg-card ring-1 ring-primary/20 shadow-xs"
                  : "border-border bg-card/60 hover:border-border hover:bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => toggleAudience(opt.id)}
                className="w-full flex items-start gap-3.5 p-4 text-left"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {opt.id === "only_me" && <Lock className="h-4 w-4" />}
                  {opt.id === "college" && <GraduationCap className="h-4 w-4" />}
                  {opt.id === "nearby" && <MapPin className="h-4 w-4" />}
                  {opt.id === "event" && <Sparkles className="h-4 w-4" />}
                </div>

                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm sm:text-base font-bold text-primary">
                      {opt.title}
                    </span>
                    {active && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {opt.subtitle}
                  </p>
                </div>
              </button>

              {/* Inline Expansion: College Selection */}
              {active && opt.id === "college" && onChangeCollege && (
                <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Select your college:</span>
                    {college && (
                      <button
                        type="button"
                        onClick={() => onChangeCollege("")}
                        className="text-xs text-destructive hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> Remove college
                      </button>
                    )}
                  </div>

                  {/* Quick pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_COLLEGES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onChangeCollege(c)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium border transition",
                          college === c
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:border-primary/50",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  {/* Manual input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Or enter your college name"
                      value={customCollegeInput || (POPULAR_COLLEGES.includes(college as any) ? "" : college || "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCollegeInput(val);
                        onChangeCollege(val);
                      }}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none transition focus:border-action"
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Notice: College membership is self-declared and unverified. Student IDs or
                    institutional email addresses are never requested or exposed to others.
                  </p>
                </div>
              )}

              {/* Inline Expansion: Coarse Area Selection */}
              {active && opt.id === "nearby" && onChangeGeneralArea && (
                <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Select your general area (coarse only):
                    </span>
                    {generalArea && (
                      <button
                        type="button"
                        onClick={() => onChangeGeneralArea("")}
                        className="text-xs text-destructive hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> Clear area
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {COARSE_AREAS.map((area) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => onChangeGeneralArea(area)}
                        className={cn(
                          "rounded-lg p-2 text-left text-xs font-medium border transition",
                          generalArea === area
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:border-primary/50",
                        )}
                      >
                        {area}
                      </button>
                    ))}
                  </div>

                  {/* Detect rough area helper */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={detectingLocation}
                      onClick={handleDetectRoughArea}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition disabled:opacity-50"
                    >
                      <Compass className={cn("h-3.5 w-3.5 text-action", detectingLocation && "animate-spin")} />
                      {detectingLocation ? "Checking rough area…" : "Detect general neighborhood"}
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Privacy Guarantee: Only coarse geographic regions are used for discovery. Exact
                    GPS coordinates, home addresses, or live movements are never tracked, stored, or
                    displayed.
                  </p>
                </div>
              )}

              {/* Inline Expansion: Event Community Info */}
              {active && opt.id === "event" && (
                <div className="border-t border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1 animate-fade-in">
                  <p className="font-semibold text-foreground">
                    Supported Event: Navratri Raipur 2026
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Discoverable by users who share your selected festival nights. Your private
                    attendance choices are never exposed outside this verified crowd.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Multiple Audience Explanation Callout */}
      {isMultiple && (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-action" />
            <span>Broader Discovery Selection</span>
          </p>
          Selecting multiple audiences expands who may discover you to users from your college,
          nearby area, or attending the festival.
        </div>
      )}

      {/* 5. Live Privacy Preview Box */}
      <div className="rounded-2xl border border-action/30 bg-action/5 p-4 space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-action">
          Live Visibility Preview
        </span>
        <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">
          "{previewText}"
        </p>
      </div>

      {/* 6. "Preview what others see" Link / Button */}
      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          onClick={() => setShowOthersSeeModal(true)}
          className="text-xs font-semibold text-action hover:underline inline-flex items-center gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview what others see on your profile →
        </button>
      </div>

      {/* Modal: Preview What Others See */}
      {showOthersSeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="font-display text-lg font-bold text-primary">
                  Profile Information Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOthersSeeModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Here is exactly what eligible users in your chosen discovery audience can see versus
              what remains strictly hidden.
            </p>

            {/* Profile Mock Card */}
            <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-11 rounded-xs bg-muted overflow-hidden shrink-0">
                  {userPhotoUrl ? (
                    <img src={userPhotoUrl} alt="Photo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      Photo
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-display text-base font-extrabold text-primary">
                    {userFirstName}
                    {userAge ? `, ${userAge}` : ""}
                  </h4>
                  {college && (
                    <p className="text-xs text-muted-foreground">{college}</p>
                  )}
                  {generalArea && (
                    <p className="text-xs text-teal font-medium">{generalArea}</p>
                  )}
                </div>
              </div>

              {userPrompt && (
                <div className="rounded-xl bg-card p-2.5 text-xs italic text-foreground border border-border/60">
                  "{userPrompt}"
                </div>
              )}
            </div>

            {/* Visible vs Hidden breakdown */}
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Visible to your audience:
                </p>
                <ul className="space-y-1 text-muted-foreground text-[11px] pl-5 list-disc">
                  <li>First name and calculated age (e.g. {userAge ?? 22})</li>
                  <li>Solo face photo and prompt</li>
                  <li>Festival night attendance numbers</li>
                  {college && <li>Selected college ({college})</li>}
                  {generalArea && <li>Coarse general area ({generalArea})</li>}
                </ul>
              </div>

              <div className="border-t border-border pt-3">
                <p className="font-bold text-destructive mb-1.5 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Strictly private & never shown:
                </p>
                <ul className="space-y-1 text-muted-foreground text-[11px] pl-5 list-disc">
                  <li>Exact birth date (kept confidential)</li>
                  <li>Exact GPS coordinates or live movements (never tracked)</li>
                  <li>Student ID or institutional credentials (never collected)</li>
                  <li>Phone number and email (never displayed)</li>
                  <li>Social handles (remain private unless separate sharing consent is toggled)</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOthersSeeModal(false)}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
