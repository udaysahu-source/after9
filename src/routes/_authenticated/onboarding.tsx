import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Btn, Dandiya, Shell } from "@/components/after9";
import {
  Choice,
  IndiaBirthdayPicker,
  CompactAgeRangePicker,
  NightsPicker,
  PhotoPicker,
  fieldInput,
} from "@/components/profile-fields";
import { ProfileVisibilityMeter } from "@/components/profile-visibility-meter";
import {
  GENDERS,
  INTERESTS,
  validateBirthDate,
  ageFrom,
  goingNights,
  useMyProfile,
  usePhotoUrls,
  type Attendance,
  type ProfileRow,
} from "@/lib/after9";
import { verifyProfile } from "@/lib/verify.functions";
import { claimInvite } from "@/lib/invites.functions";
import { SocialLinksManager } from "@/components/social-links-manager";
import { Analytics } from "@/lib/launch-analytics";
import { toast } from "sonner";
import { Camera, ShieldCheck } from "lucide-react";
import { PhotoVerificationModal } from "@/components/photo-verification-modal";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — After9" },
      { name: "description", content: "A few quick steps to get on the festival floor." },
      { property: "og:title", content: "Set up your profile — After9" },
      { property: "og:description", content: "A few quick steps to get on the festival floor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

// 7 Short, Single-Purpose Screens:
// 0: About you (Name, Birthday, Gender)
// 1: Who do you want to meet? (Women, Men, Everyone)
// 2: Your age range (min_age, max_age 18+)
// 3: Your Garba nights (calendar picker, skippable)
// 4: Who can discover you? (Privacy meter & audiences)
// 5: Your socials (optional handles, private by default, skippable)
// 6: Your profile (photo + short prompt)
const TOTAL = 7;

function Onboarding() {
  const { p, save } = useMyProfile();
  const nav = useNavigate();
  const verify = useServerFn(verifyProfile);
  const claim = useServerFn(claimInvite);

  // Skip onboarding for returning users who have already finished
  useEffect(() => {
    if (p?.onboarded) {
      nav({ to: "/discover" });
    }
  }, [p?.onboarded, nav]);

  if (!p)
    return (
      <Shell>
        <div />
      </Shell>
    );

  const step = Math.min(p.onboarding_step ?? 0, TOTAL - 1);

  const next = async (patch: Partial<ProfileRow> = {}) => {
    if (step + 1 >= TOTAL) {
      const birth = patch.birth_date ?? p.birth_date;
      if (birth) {
        const check = validateBirthDate(birth);
        if (!check.valid || check.age < 18) {
          toast.error(check.error || "After9 is strictly for adults 18+.");
          return;
        }
      }

      await save({ ...patch, onboarded: true, onboarding_step: TOTAL });
      const code = localStorage.getItem("after9.invite");
      let chatWith: string | undefined;
      if (code) {
        Analytics.referralRegistered(code);
        const r = await claim({
          data: { code, chat: !!localStorage.getItem("after9.chat") },
        }).catch(() => null);
        if (r && "chatWith" in r) chatWith = r.chatWith;
        localStorage.removeItem("after9.invite");
        localStorage.removeItem("after9.chat");
      }
      Analytics.profileCompleted();
      await verify().catch(() => {});
      if (chatWith) nav({ to: "/chat/$id", params: { id: chatWith } });
      else nav({ to: "/discover" });
    } else {
      await save({ ...patch, onboarding_step: step + 1 });
    }
  };

  const back = () => (step === 0 ? nav({ to: "/" }) : save({ onboarding_step: step - 1 }));

  return (
    <Shell maxWidth="default">
      <div className="mx-auto flex w-full max-w-lg items-center gap-4 px-4 sm:px-5 pt-4 sm:pt-5">
        <button
          onClick={back}
          className="text-2xl text-primary transition-opacity hover:opacity-80 p-2 touch-tactile active:scale-95"
          aria-label="Back"
        >
          ←
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/80">
          <div
            className="h-full bg-gradient-to-r from-action via-amber-500 to-rose-500 transition-all duration-300 rounded-full"
            style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground font-bold shrink-0">
          Step {step + 1} of {TOTAL}
        </span>
      </div>

      <div
        key={step}
        className="mx-auto flex w-full max-w-lg flex-1 animate-rise flex-col px-4 sm:px-5 pb-8 pt-6 sm:pt-8"
      >
        <Step step={step} p={p} next={next} />
      </div>
    </Shell>
  );
}

function H({ k, t, s, badge }: { k: string; t: string; s?: string; badge?: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      {badge && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-action/15 border border-action/30 px-3 py-1 text-xs font-bold text-action mb-3">
          <span>🪔</span> {badge}
        </div>
      )}
      <p className="mb-1.5 text-xs font-bold tracking-widest text-action uppercase">{k}</p>
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-[1.1] text-primary">
        {t}
      </h1>
      {s && <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s}</p>}
    </div>
  );
}

function Step({
  step,
  p,
  next,
}: {
  step: number;
  p: ProfileRow;
  next: (patch?: Partial<ProfileRow>) => void;
}) {
  const [f, setF] = useState({
    first_name: p.first_name ?? "",
    birth_date: p.birth_date ?? "",
    gender: p.gender ?? "",
    interested_in: p.interested_in || "everyone",
    min_age: Math.max(18, p.min_age || 18),
    max_age: Math.max(18, p.max_age || 35),
    college: p.college ?? "",
    general_area: (p as any).general_area ?? "",
    visibility_audiences: (p as any).visibility_audiences?.length
      ? (p as any).visibility_audiences
      : ["only_me"],
    prompt: p.prompt ?? "",
  });

  const [photo, setPhoto] = useState<{ path: string | null; preview?: string }>({
    path: p.photo_path,
  });
  const [liveVerificationOpen, setLiveVerificationOpen] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState<string | null>(p.verification_status ?? null);
  const [nights, setNights] = useState((p.nights ?? {}) as Record<string, Attendance>);
  const urls = usePhotoUrls([photo.path]);

  // SCREEN 1 — About you: First name, Birthday, Gender
  if (step === 0) {
    const bCheck = f.birth_date ? validateBirthDate(f.birth_date) : { valid: false, age: 0 };
    const canContinue = f.first_name.trim().length > 0 && f.gender && bCheck.valid;

    return (
      <>
        <H
          badge="Welcome to After9 · Raipur 2026"
          k="STEP 1 · ABOUT YOU"
          t="Let's build your Garba profile"
          s="Find your festival crew and mutual Dandiya clashes across Raipur. Takes under 2 minutes."
        />
        <div className="flex flex-col gap-5 sm:gap-6">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              First name
            </label>
            <input
              className={fieldInput}
              placeholder="Your first name"
              value={f.first_name}
              onChange={(e) => setF({ ...f, first_name: e.target.value })}
            />
          </div>

          <IndiaBirthdayPicker
            value={f.birth_date}
            onChange={(iso) => setF({ ...f, birth_date: iso })}
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              I am
            </p>
            <Choice
              options={GENDERS}
              value={f.gender}
              onChange={(picked) => setF({ ...f, gender: picked })}
            />
          </div>
        </div>

        <Btn
          className="mt-auto pt-4"
          disabled={!canContinue}
          onClick={() =>
            next({
              first_name: f.first_name.trim(),
              birth_date: f.birth_date,
              gender: f.gender,
            })
          }
        >
          Continue
        </Btn>
      </>
    );
  }

  // SCREEN 2 — Who do you want to meet?
  if (step === 1) {
    return (
      <>
        <H
          k="PREFERENCES"
          t="Who do you want to meet?"
          s="We will curate festival circles and dandiya clashes based on your preference."
        />
        <div className="flex flex-col gap-3">
          <Choice
            options={INTERESTS}
            value={f.interested_in}
            onChange={(v) => {
              setF({ ...f, interested_in: v });
            }}
          />
        </div>
        <Btn
          className="mt-auto pt-6"
          disabled={!f.interested_in}
          onClick={() => next({ interested_in: f.interested_in })}
        >
          Continue
        </Btn>
      </>
    );
  }

  // SCREEN 3 — Your age range
  if (step === 2) {
    return (
      <>
        <H
          k="AGE RANGE"
          t="Your age range"
          s="Select the age range of people you want to discover. After9 strictly enforces 18+ on the server."
        />
        <CompactAgeRangePicker
          minAge={f.min_age}
          maxAge={f.max_age}
          onChange={(min, max) => setF({ ...f, min_age: min, max_age: max })}
        />
        <Btn
          className="mt-auto pt-6"
          onClick={() => next({ min_age: f.min_age, max_age: f.max_age })}
        >
          Continue
        </Btn>
      </>
    );
  }

  // SCREEN 4 — Your Garba nights
  if (step === 3) {
    const goingCount = goingNights(nights).length;

    return (
      <>
        <H
          k="GARBA NIGHTS"
          t="Which nights are you going?"
          s="Tap each night to cycle: Going → Maybe → Off. You can skip if your dates are not finalized yet."
        />
        <NightsPicker value={nights} onChange={setNights} />
        <div className="mt-auto pt-6 flex flex-col gap-2">
          <Btn onClick={() => next({ nights })}>
            {goingCount > 0 ? `Lock in ${goingCount} nights` : "Continue"}
          </Btn>
          <button
            type="button"
            onClick={() => next({ nights: {} })}
            className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground py-1 transition"
          >
            Skip for now (I'll decide later) →
          </button>
        </div>
      </>
    );
  }

  // SCREEN 5 — Who can discover you?
  if (step === 4) {
    return (
      <>
        <H
          k="PRIVACY METER"
          t="Who can discover you?"
          s="Choose your discovery audience. New accounts default to Only Me until you choose."
        />
        <div className="flex-1 overflow-y-auto pr-1">
          <ProfileVisibilityMeter
            audiences={f.visibility_audiences}
            onChangeAudiences={(auds) => setF({ ...f, visibility_audiences: auds })}
            college={f.college}
            onChangeCollege={(c) => setF({ ...f, college: c || "" })}
            generalArea={f.general_area}
            onChangeGeneralArea={(a) => setF({ ...f, general_area: a || "" })}
            userFirstName={f.first_name}
            userAge={f.birth_date ? ageFrom(f.birth_date) : 21}
            userPhotoUrl={photo.preview ?? (photo.path ? urls[photo.path] : undefined)}
            userPrompt={f.prompt}
            userNightsCount={goingNights(nights).length}
          />
        </div>
        <Btn
          className="mt-auto pt-6"
          onClick={() =>
            next({
              visibility_audiences: f.visibility_audiences,
              college: f.college.trim() || null,
              general_area: f.general_area.trim() || null,
            } as any)
          }
        >
          Continue
        </Btn>
      </>
    );
  }

  // SCREEN 6 — Your socials
  if (step === 5) {
    return (
      <>
        <H
          k="SOCIALS"
          t="Your socials, your choice"
          s="Add your social profiles if you want. Visibility defaults to strictly private. You can skip anytime."
        />
        <div className="flex-1 overflow-y-auto pr-1">
          <SocialLinksManager userId={p.id} />
        </div>
        <div className="mt-auto pt-6 flex flex-col gap-2">
          <Btn onClick={() => next()}>Continue</Btn>
          <button
            type="button"
            onClick={() => next()}
            className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground py-1 transition"
          >
            Skip for now →
          </button>
        </div>
      </>
    );
  }

  // SCREEN 7 — Your profile: Photo + short prompt
  return (
    <>
      <H
        k="YOUR PROFILE"
        t="Show your face & vibe"
        s="Add a clear solo photo and one short line about your Garba night."
      />
      <div className="flex flex-col gap-6">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            Profile photo (Required for verification)
          </label>
          <PhotoPicker
            userId={p.id}
            url={photo.preview ?? (photo.path ? urls[photo.path] : undefined)}
            onUploaded={(path, preview) => {
              setPhoto({ path, preview });
              setLiveVerificationOpen(true);
            }}
            onRequestVerification={() => setLiveVerificationOpen(true)}
          />

          {photo.path && (
            <div className="mt-3">
              {verifiedStatus === "approved" ? (
                <div className="flex items-center justify-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 p-2.5 text-xs font-bold text-teal-700 dark:text-teal-300 animate-fade-in">
                  <ShieldCheck className="h-4 w-4" /> Live face match verified!
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLiveVerificationOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-action/40 bg-action/10 px-3 py-2 text-xs font-semibold text-action hover:bg-action/20 transition shadow-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <Camera className="h-4 w-4" /> Check face match with camera
                  </span>
                  <span className="font-bold underline">Verify Now</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Garba night isn't complete without…
          </label>
          <input
            className={fieldInput}
            maxLength={70}
            placeholder="Kachori and rabri at 1:30 AM."
            value={f.prompt}
            onChange={(e) => setF({ ...f, prompt: e.target.value })}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{f.prompt.length}/70</p>
        </div>
      </div>

      <Btn
        className="mt-auto pt-6 min-h-[48px] touch-tactile shadow-md hover:shadow-lg transition-all"
        disabled={!photo.path}
        onClick={() =>
          next({
            photo_path: photo.path,
            prompt: f.prompt.trim() || "Ready for Garba!",
          })
        }
      >
        Complete & Enter Festival Floor ✨
      </Btn>

      <PhotoVerificationModal
        open={liveVerificationOpen}
        onOpenChange={setLiveVerificationOpen}
        profilePhotoUrl={photo.preview ?? (photo.path ? urls[photo.path] ?? null : null)}
        onVerificationComplete={(status) => {
          setVerifiedStatus(status);
        }}
      />
    </>
  );
}
