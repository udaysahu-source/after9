import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Btn, Dandiya, Shell } from "@/components/after9";
import { Choice, NightsPicker, OptionList, PhotoPicker, fieldInput } from "@/components/profile-fields";
import { GENDERS, INTERESTS, QUIZ, ageFrom, goingNights, useMyProfile, usePhotoUrls, type Attendance, type ProfileRow } from "@/lib/after9";
import { verifyProfile } from "@/lib/verify.functions";
import { claimInvite, ensureInvites } from "@/lib/invites.functions";
import { FloorRatioMeter, FloorBalanceModal, fetchFloorRatio, type FloorRatioData } from "@/components/floor-ratio-balancer";
import { useEffect } from "react";
import { Analytics } from "@/lib/launch-analytics";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — After9" },
      { name: "description", content: "A few quick steps to get on the floor." },
      { property: "og:title", content: "Set up your profile — After9" },
      { property: "og:description", content: "A few quick steps to get on the floor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

// basics, college, prompt, photo, quiz×3, nights, safety, tutorial
const TOTAL = 10;

function Onboarding() {
  const { p, save } = useMyProfile();
  const nav = useNavigate();
  const verify = useServerFn(verifyProfile);
  const claim = useServerFn(claimInvite);
  if (!p) return <Shell><div /></Shell>;
  const step = Math.min(p.onboarding_step, TOTAL - 1);
  const next = async (patch: Partial<ProfileRow> = {}) => {
    if (step + 1 >= TOTAL) {
      await save({ ...patch, onboarded: true, onboarding_step: TOTAL });
      const code = localStorage.getItem("after9.invite");
      let chatWith: string | undefined;
      if (code) {
        Analytics.referralRegistered(code);
        const r = await claim({ data: { code, chat: !!localStorage.getItem("after9.chat") } }).catch(() => null);
        if (r && "chatWith" in r) chatWith = r.chatWith;
        localStorage.removeItem("after9.invite"); localStorage.removeItem("after9.chat");
      }
      Analytics.profileCompleted();
      await verify().catch(() => {});
      if (chatWith) nav({ to: "/chat/$id", params: { id: chatWith } });
      else nav({ to: "/discover" });
    } else await save({ ...patch, onboarding_step: step + 1 });
  };
  const back = () => (step === 0 ? nav({ to: "/" }) : save({ onboarding_step: step - 1 }));

  return (
    <Shell maxWidth="default">
      <div className="mx-auto flex w-full max-w-lg items-center gap-4 px-5 pt-5">
        <button onClick={back} className="text-2xl text-primary transition-opacity hover:opacity-80" aria-label="Back">←</button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-action transition-all duration-300" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} /></div>
        <span className="text-xs tabular-nums text-muted-foreground">{step + 1}/{TOTAL}</span>
      </div>
      <div key={step} className="mx-auto flex w-full max-w-lg flex-1 animate-rise flex-col px-5 pb-6 pt-10">
        <Step step={step} p={p} next={next} />
      </div>
    </Shell>
  );
}

function H({ k, t, s }: { k: string; t: string; s?: string }) {
  return (
    <div className="mb-8">
      <p className="mb-3 text-xs font-semibold tracking-widest text-action">{k}</p>
      <h1 className="font-display text-4xl font-extrabold leading-[1] text-primary">{t}</h1>
      {s && <p className="mt-3 text-muted-foreground">{s}</p>}
    </div>
  );
}

function Step({ step, p, next }: { step: number; p: ProfileRow; next: (patch?: Partial<ProfileRow>) => void }) {
  const ensure = useServerFn(ensureInvites);
  const [f, setF] = useState({
    first_name: p.first_name ?? "", birth_date: p.birth_date ?? "", gender: p.gender ?? "", interested_in: p.interested_in,
    college: p.college ?? "", branch: p.branch ?? "", prompt: p.prompt ?? "",
  });
  const [photo, setPhoto] = useState<{ path: string | null; preview?: string }>({ path: p.photo_path });
  const [nights, setNights] = useState((p.nights ?? {}) as Record<string, Attendance>);
  const urls = usePhotoUrls([photo.path]);
  const quiz = (p.quiz ?? {}) as Record<string, string>;

  // Floor ratio balancer state for Step 0
  const [ratio, setRatio] = useState<FloorRatioData | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (step === 0) {
      fetchFloorRatio().then(setRatio);
      ensure()
        .then((r) => {
          if (r?.ok && r.primaryCode) setInviteCode(r.primaryCode);
        })
        .catch(() => {});
    }
  }, [step, ensure]);

  const handleGenderPick = (picked: string) => {
    setF({ ...f, gender: picked });
    // Open balance popup modal on selection if ratio is loaded
    if (ratio) {
      setBalanceModalOpen(true);
    }
  };

  if (step === 0) {
    const age = f.birth_date ? ageFrom(f.birth_date) : 0;
    return (<>
      <H k="ABOUT YOU" t="Let's start with you." />
      <div className="flex flex-col gap-6">
        <input className={fieldInput} placeholder="First name" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
        <label className="text-sm text-muted-foreground">Birthday
          <input type="date" className={fieldInput} value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
        </label>
        {f.birth_date && age < 18 && <p className="text-sm text-destructive">After9 is for adults 18+. Come back when you're 18.</p>}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">I am</p>
            {ratio && (
              <button
                type="button"
                onClick={() => setBalanceModalOpen(true)}
                className="text-xs font-semibold text-action hover:underline"
              >
                ⚖️ Live Floor Balance
              </button>
            )}
          </div>
          <Choice options={GENDERS} value={f.gender} onChange={handleGenderPick} />
          {ratio && (
            <div className="mt-3">
              <FloorRatioMeter ratio={ratio} onOpenModal={() => setBalanceModalOpen(true)} />
            </div>
          )}
        </div>
        <div><p className="mb-2 text-sm text-muted-foreground">Show me</p><Choice options={INTERESTS} value={f.interested_in} onChange={(v) => setF({ ...f, interested_in: v })} /></div>
      </div>
      <Btn className="mt-auto" disabled={!f.first_name.trim() || age < 18 || !f.gender}
        onClick={() => next({ first_name: f.first_name.trim(), birth_date: f.birth_date, gender: f.gender, interested_in: f.interested_in })}>Continue</Btn>

      {ratio && f.gender && (
        <FloorBalanceModal
          open={balanceModalOpen}
          onOpenChange={setBalanceModalOpen}
          gender={f.gender}
          ratio={ratio}
          inviteCode={inviteCode}
          userId={p.id}
        />
      )}
    </>);
  }
  if (step === 1) return (<>
    <H k="CAMPUS" t="Where do you study?" s="Skip the branch if it doesn't apply." />
    <div className="flex flex-col gap-6">
      <input className={fieldInput} placeholder="College" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} />
      <input className={fieldInput} placeholder="Branch · Year (optional)" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} />
    </div>
    <Btn className="mt-auto" disabled={!f.college.trim()} onClick={() => next({ college: f.college.trim(), branch: f.branch.trim() || null })}>Continue</Btn>
  </>);
  if (step === 2) return (<>
    <H k="ONE LINE" t="Garba night isn't complete without…" s="Keep it short. No handles or numbers." />
    <input className={fieldInput} maxLength={70} placeholder="Kachori and rabri at 1:30 AM." value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} />
    <p className="mt-2 text-right text-xs text-muted-foreground">{f.prompt.length}/70</p>
    <Btn className="mt-auto" disabled={f.prompt.trim().length < 3} onClick={() => next({ prompt: f.prompt.trim() })}>Continue</Btn>
  </>);
  if (step === 3) return (<>
    <H k="PHOTO" t="Show your face." s="One clear, solo photo. Our checker makes sure every profile is a real person." />
    <PhotoPicker userId={p.id} url={photo.preview ?? (photo.path ? urls[photo.path] : undefined)} onUploaded={(path, preview) => setPhoto({ path, preview })} />
    <Btn className="mt-auto" disabled={!photo.path} onClick={() => next({ photo_path: photo.path })}>Looks good</Btn>
  </>);
  if (step >= 4 && step <= 6) {
    const q = QUIZ[step - 4]!;
    return (<>
      <H k={`GARBA QUIZ · ${step - 3} OF 3`} t={q.q} />
      <OptionList options={q.options} value={quiz[q.key]} onPick={(o) => next({ quiz: { ...quiz, [q.key]: o } })} />
    </>);
  }
  if (step === 7) return (<>
    <H k="NINE NIGHTS" t="Which nights are you out?" s="Tap to cycle: Going → Maybe → Off." />
    <NightsPicker value={nights} onChange={setNights} />
    <Btn className="mt-auto" disabled={goingNights(nights).length === 0} onClick={() => next({ nights })}>Lock it in</Btn>
  </>);
  if (step === 8) return (<>
    <H k="SAFETY" t="Your floor, your rules." />
    <ul className="flex flex-col gap-5 text-[15px]">
      {[["Real people only.", "Every profile is checked before anyone sees it."], ["Chat unlocks only on a clash.", "Nobody messages you unless you sent a Dandiya back."], ["Block and report in one tap.", "From any chat or card."], ["Meet in the crowd first.", "Garba grounds are public. Keep it that way at first."]].map(([a, b]) => (
        <li key={a} className="border-l-2 border-teal pl-4"><p className="font-semibold">{a}</p><p className="text-muted-foreground">{b}</p></li>
      ))}
    </ul>
    <Btn className="mt-auto" onClick={() => next()}>I'm in</Btn>
  </>);
  return (<>
    <H k="HOW IT WORKS" t="Send a Dandiya." s="Swipe right or tap Send Dandiya. Swipe left to pass. If they send one back — clack — it's a clash, and chat opens." />
    <div className="flex flex-1 items-center justify-center"><Dandiya className="h-32 w-32 animate-clack text-action" /></div>
    <Btn onClick={() => next()}>Start discovering</Btn>
  </>);
}
