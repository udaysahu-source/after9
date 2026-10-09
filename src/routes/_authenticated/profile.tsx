import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { BottomNav, Btn, ChatIcon, Dandiya, Shell } from "@/components/after9";
import { Link } from "@tanstack/react-router";
import {
  Choice,
  NightsPicker,
  OptionList,
  PhotoPicker,
  fieldInput,
} from "@/components/profile-fields";
import { supabase } from "@/integrations/supabase/client";
import {
  INTERESTS,
  QUIZ,
  ageFrom,
  goingNights,
  useMyProfile,
  usePhotoUrls,
  type Attendance,
  type ProfileRow,
} from "@/lib/after9";
import { verifyProfile } from "@/lib/verify.functions";
import { claimInvite, ensureInvites, revokeInvite } from "@/lib/invites.functions";
import {
  drawInviteCard,
  drawProfileCard,
  type CardCustomization,
  type ProfileCardData,
} from "@/lib/share-cards";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Ticket,
  Copy,
  Check,
  Share2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { ShareCardStudio } from "@/components/share-card-studio";
import { SocialLinksManager } from "@/components/social-links-manager";
import { getMySocialLinks, type SocialLinkRow } from "@/lib/social-links";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — After9" },
      { name: "description", content: "Edit your After9 profile, nights and who you see." },
      { property: "og:title", content: "Your profile — After9" },
      { property: "og:description", content: "Edit your After9 profile, nights and who you see." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

type Panel = null | "basics" | "photo" | "quiz" | "nights" | "socials" | "privacy";

function Profile() {
  const { p, save, reload } = useMyProfile();
  const nav = useNavigate();
  const verify = useServerFn(verifyProfile);
  const [panel, setPanel] = useState<Panel>(null);
  const [checking, setChecking] = useState(false);
  const [cardStudioOpen, setCardStudioOpen] = useState(false);
  const [socials, setSocials] = useState<SocialLinkRow[]>([]);
  const urls = usePhotoUrls([p?.photo_path]);

  useEffect(() => {
    if (p?.id) {
      getMySocialLinks(p.id).then(setSocials);
    }
  }, [p?.id]);

  if (!p)
    return (
      <Shell>
        <div />
      </Shell>
    );

  const recheck = async () => {
    setChecking(true);
    try {
      await verify();
    } finally {
      await reload();
      setChecking(false);
    }
  };
  const saveAndCheck = async (patch: Partial<ProfileRow>) => {
    await save(patch);
    setPanel(null);
    if ("photo_path" in patch || "prompt" in patch || "first_name" in patch) recheck();
  };
  const status = {
    approved: ["Live", "Your profile is visible on Discover.", "border-teal"],
    pending: [
      "Checking",
      "We're making sure your profile is a real person. Usually a few seconds.",
      "border-action",
    ],
    rejected: [
      "Not live",
      p.verification_reason ?? "Update your photo or prompt and re-check.",
      "border-destructive",
    ],
  }[p.verification_status as "approved" | "pending" | "rejected"] ?? [
    "Checking",
    "",
    "border-action",
  ];

  if (panel) {
    return (
      <Editor
        panel={panel}
        p={p}
        photoUrl={p.photo_path ? urls[p.photo_path] : undefined}
        socials={socials}
        onSocialsChange={setSocials}
        onClose={() => setPanel(null)}
        onSave={saveAndCheck}
        onReload={reload}
      />
    );
  }

  return (
    <Shell maxWidth="wide">
      <main className="flex-1 pb-24 md:pb-28">
        <div className="flex items-end gap-4 px-5 pt-6 md:pt-10">
          <button
            onClick={() => setPanel("photo")}
            className="h-28 w-21 shrink-0 overflow-hidden rounded-xs bg-muted shadow-xs transition-transform hover:scale-105"
            aria-label="Change photo"
          >
            {p.photo_path && urls[p.photo_path] && (
              <img src={urls[p.photo_path]} alt="You" className="h-full w-full object-cover" />
            )}
          </button>
          <div>
            <h1 className="font-display text-3xl font-extrabold text-primary md:text-4xl">
              {p.first_name}
              {p.birth_date ? `, ${ageFrom(p.birth_date)}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              {p.college}
              {p.branch ? ` · ${p.branch}` : ""}
            </p>
            <p className="mt-1 text-sm font-semibold text-teal">
              {goingNights(p.nights).length} of 9 nights
            </p>
            <button
              type="button"
              onClick={() => setCardStudioOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-action transition hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Customize & Share card ↗
            </button>
          </div>
        </div>

        <div className="mt-4 md:mt-8 md:grid md:grid-cols-12 md:gap-8 md:px-5">
          <div className="flex flex-col gap-6 md:col-span-5">
            <div
              className={cn(
                "mx-5 md:mx-0 border-l-2 bg-card px-4 py-3 rounded-xs shadow-2xs",
                status[2],
              )}
            >
              <p className="text-sm font-semibold">{status[0]}</p>
              <p className="text-sm text-muted-foreground">{status[1]}</p>
              {p.verification_status !== "approved" && (
                <button
                  disabled={checking}
                  onClick={recheck}
                  className="mt-2 text-sm font-semibold text-primary"
                >
                  {checking ? "Checking…" : "Check again"}
                </button>
              )}
            </div>

            {/* Concise "Your After9 Card" Section */}
            <YourAfter9CardHero
              p={p}
              photoUrl={p.photo_path ? (urls[p.photo_path] ?? null) : null}
              onOpenStudio={() => setCardStudioOpen(true)}
            />

            <CardStats />
            <ShareStats />

            <div className="mt-2 flex flex-col gap-2 px-5 md:px-0">
              <Btn
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  nav({ to: "/" });
                }}
              >
                Sign out
              </Btn>
              <Btn
                variant="ghost"
                className="text-destructive text-sm"
                onClick={async () => {
                  if (!confirm("Delete your profile, photo and chats? This can't be undone."))
                    return;
                  if (p.photo_path) await supabase.storage.from("photos").remove([p.photo_path]);
                  await supabase.from("profiles").delete().eq("id", p.id);
                  await supabase.auth.signOut();
                  nav({ to: "/" });
                }}
              >
                Delete my profile
              </Btn>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:col-span-7">
            <Section title="PROFILE">
              <Row
                label="Name, college, prompt"
                value={p.prompt ? `"${p.prompt}"` : ""}
                onClick={() => setPanel("basics")}
              />
              <Row label="Photo" value="Replace or remove" onClick={() => setPanel("photo")} />
              <Row
                label="Social links"
                value={
                  socials.filter((s) => s.is_enabled).length > 0
                    ? `${socials
                        .filter((s) => s.is_enabled)
                        .map((s) => s.platform)
                        .join(", ")}`
                    : socials.length > 0
                      ? `${socials.length} added (hidden)`
                      : "Add Instagram, Snapchat & more"
                }
                onClick={() => setPanel("socials")}
              />
              <Row
                label="Garba quiz"
                value={Object.values((p.quiz ?? {}) as Record<string, string>).join(" · ")}
                onClick={() => setPanel("quiz")}
              />
              <Row
                label="My nights"
                value={
                  goingNights(p.nights)
                    .map((n) => `N${n}`)
                    .join(" ") || "None"
                }
                onClick={() => setPanel("nights")}
              />
            </Section>

            <Section title="WHO YOU SEE">
              <div className="py-3">
                <p className="mb-2 text-sm text-muted-foreground">Show me</p>
                <Choice
                  options={INTERESTS}
                  value={p.interested_in}
                  onChange={(v) => save({ interested_in: v })}
                />
              </div>
              <div className="py-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Age range:{" "}
                  <b className="text-foreground">
                    {p.min_age}–{p.max_age}
                  </b>
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={18}
                    max={60}
                    value={p.min_age}
                    className="flex-1 accent-[var(--action)]"
                    onChange={(e) => save({ min_age: Math.min(+e.target.value, p.max_age) })}
                  />
                  <input
                    type="range"
                    min={18}
                    max={60}
                    value={p.max_age}
                    className="flex-1 accent-[var(--action)]"
                    onChange={(e) => save({ max_age: Math.max(+e.target.value, p.min_age) })}
                  />
                </div>
              </div>
            </Section>

            <Invites me={p} onClaimed={recheck} />

            <Section title="PRIVACY">
              <Toggle
                label="Show me on Discover"
                hint="Turn off to take a break. Your clashes stay."
                on={p.discoverable}
                onChange={(v) => save({ discoverable: v })}
              />
              <Toggle
                label="Show my college"
                hint="Hide college and branch on your card."
                on={p.show_college}
                onChange={(v) => save({ show_college: v })}
              />
              <Row
                label="Public card link & sharing"
                value={
                  p.public_profile_enabled ? "Enabled · Token protected" : "Disabled · Private"
                }
                onClick={() => setPanel("privacy")}
              />
              <BlockedList userId={p.id} />
            </Section>
          </div>
        </div>
      </main>
      <BottomNav />

      {/* Share Card Studio Modal */}
      <ShareCardStudio
        open={cardStudioOpen}
        onOpenChange={setCardStudioOpen}
        cardData={{
          photoUrl: p.photo_path ? (urls[p.photo_path] ?? null) : null,
          name: p.first_name ?? "Me",
          age: p.birth_date ? ageFrom(p.birth_date) : null,
          college: p.show_college ? (p.college ?? null) : null,
          branch: p.show_college ? (p.branch ?? null) : null,
          prompt: p.prompt ?? null,
          nights: goingNights(p.nights),
          shareUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/p/${p.share_token}`,
        }}
        socialLinks={socials}
        savedPreferences={(p.card_preferences as Partial<CardCustomization> | null) ?? null}
        userId={p.id}
      />
    </Shell>
  );
}

function YourAfter9CardHero({
  p,
  photoUrl,
  onOpenStudio,
}: {
  p: ProfileRow;
  photoUrl?: string | null | undefined;
  onOpenStudio: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${p.share_token}`;
  const nightsCount = goingNights(p.nights).length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Public card link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Section title="YOUR AFTER9 CARD">
      <div className="overflow-hidden rounded-2xl border border-action/30 bg-gradient-to-br from-card via-card to-action/10 p-4 shadow-sm transition-all hover:border-action/50">
        <div className="flex items-start gap-4">
          {/* 9:16 Mini Card Thumbnail */}
          <button
            type="button"
            onClick={onOpenStudio}
            className="group relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-neutral-900 shadow-md transition-transform active:scale-95 hover:ring-2 hover:ring-action/60"
            aria-label="Open Card Customizer"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-plum text-xl font-bold text-ivory">
                {p.first_name?.[0] ?? "A"}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-1.5 left-1.5 right-1.5 text-left pointer-events-none">
              <p className="font-display text-[9px] font-extrabold leading-tight text-white drop-shadow truncate">
                {p.first_name}
              </p>
              <p className="text-[7px] font-medium text-white/80 truncate">
                {nightsCount} {nightsCount === 1 ? "night" : "nights"}
              </p>
            </div>
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-action/90 text-[8px] text-white shadow">
              ✨
            </span>
          </button>

          {/* Content & Actions */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-action/15 px-2 py-0.5 text-[10px] font-bold text-action uppercase tracking-wide">
                <Sparkles className="h-3 w-3" />
                1080 × 1920 Story Card
              </span>
            </div>

            <h3 className="font-display text-base font-extrabold text-primary leading-snug">
              Your Navratri Story Card
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Clean 1080 × 1920 social card for Instagram Story & WhatsApp. 3 themes, crop
              positioning, and privacy toggles.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3 py-1.5 text-xs font-bold text-action-foreground shadow-xs transition hover:opacity-95 active:scale-98"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Customize & Share
              </button>

              {p.public_profile_enabled && (
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:bg-muted"
                  title="Copy public card link"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 md:px-0">
      <h2 className="mb-1 text-xs font-semibold tracking-widest text-action">{title}</h2>
      {children}
    </section>
  );
}
function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="touch-tactile flex min-h-[48px] w-full items-center justify-between gap-4 border-b border-border py-3.5 px-2 -mx-2 text-left rounded-lg transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <span className="min-w-0 pr-2">
        <span className="block font-medium">{label}</span>
        <span className="line-clamp-1 text-sm text-muted-foreground">{value}</span>
      </span>
      <span className="text-muted-foreground shrink-0 text-lg">›</span>
    </button>
  );
}
function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="touch-tactile flex min-h-[48px] w-full items-center justify-between gap-4 border-b border-border py-3.5 px-2 -mx-2 text-left rounded-lg transition-colors hover:bg-muted/40 active:scale-[0.99]"
      role="switch"
      aria-checked={on}
    >
      <span className="min-w-0 pr-2">
        <span className="block font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          on ? "bg-action" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-background transition-all",
            on ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function BlockedList({ userId }: { userId: string }) {
  const [list, setList] = useState<{ blocked_id: string }[] | null>(null);
  const load = () =>
    supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId)
      .then(({ data }) => setList(data ?? []));
  if (list === null) return <Row label="Blocked people" value="Tap to view" onClick={load} />;
  return (
    <div className="border-b border-border py-3">
      <p className="font-medium">Blocked people</p>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody blocked.</p>
      ) : (
        list.map((b, i) => (
          <div key={b.blocked_id} className="flex items-center justify-between py-1 text-sm">
            <span className="text-muted-foreground">Blocked person {i + 1}</span>
            <button
              className="font-semibold text-primary"
              onClick={async () => {
                await supabase
                  .from("blocks")
                  .delete()
                  .eq("blocker_id", userId)
                  .eq("blocked_id", b.blocked_id);
                load();
              }}
            >
              Unblock
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function Editor({
  panel,
  p,
  photoUrl,
  socials,
  onSocialsChange,
  onClose,
  onSave,
  onReload,
}: {
  panel: Exclude<Panel, null>;
  p: ProfileRow;
  photoUrl?: string | undefined;
  socials: SocialLinkRow[];
  onSocialsChange: (s: SocialLinkRow[]) => void;
  onClose: () => void;
  onSave: (patch: Partial<ProfileRow>) => void;
  onReload: () => Promise<void>;
}) {
  const [f, setF] = useState({
    first_name: p.first_name ?? "",
    college: p.college ?? "",
    branch: p.branch ?? "",
    prompt: p.prompt ?? "",
  });
  const [photo, setPhoto] = useState<{ path: string | null; preview?: string | undefined }>({
    path: p.photo_path,
    preview: photoUrl,
  });
  const [quiz, setQuiz] = useState((p.quiz ?? {}) as Record<string, string>);
  const [nights, setNights] = useState((p.nights ?? {}) as Record<string, Attendance>);

  const title = {
    basics: "Edit profile",
    photo: "Your photo",
    quiz: "Garba quiz",
    nights: "My nights",
    socials: "Social links",
    privacy: "Public card & privacy",
  }[panel];

  const patch: Partial<ProfileRow> =
    panel === "basics"
      ? {
          first_name: f.first_name.trim(),
          college: f.college.trim(),
          branch: f.branch.trim() || null,
          prompt: f.prompt.trim(),
        }
      : panel === "photo"
        ? { photo_path: photo.path }
        : panel === "quiz"
          ? { quiz }
          : { nights };
  const valid =
    panel === "basics"
      ? !!(f.first_name.trim() && f.college.trim() && f.prompt.trim())
      : panel === "photo"
        ? !!photo.path
        : panel === "nights"
          ? goingNights(nights).length > 0
          : true;

  return (
    <Shell maxWidth="default">
      <header className="mx-auto flex w-full max-w-xl items-center gap-4 px-5 pt-5">
        <button onClick={onClose} className="text-2xl text-primary" aria-label="Back">
          ←
        </button>
        <h1 className="font-display text-2xl font-extrabold text-primary">{title}</h1>
      </header>
      <div className="mx-auto flex w-full max-w-xl flex-1 animate-rise flex-col gap-6 px-5 pb-6 pt-8">
        {panel === "basics" && (
          <>
            <input
              className={fieldInput}
              placeholder="First name"
              value={f.first_name}
              onChange={(e) => setF({ ...f, first_name: e.target.value })}
            />
            <input
              className={fieldInput}
              placeholder="College"
              value={f.college}
              onChange={(e) => setF({ ...f, college: e.target.value })}
            />
            <input
              className={fieldInput}
              placeholder="Branch · Year (optional)"
              value={f.branch}
              onChange={(e) => setF({ ...f, branch: e.target.value })}
            />
            <input
              className={fieldInput}
              maxLength={70}
              placeholder="Garba night isn't complete without…"
              value={f.prompt}
              onChange={(e) => setF({ ...f, prompt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Changing your name, prompt or photo re-checks your profile.
            </p>
          </>
        )}
        {panel === "photo" && (
          <PhotoPicker
            userId={p.id}
            url={photo.preview}
            onUploaded={(path, preview) => setPhoto({ path, preview })}
            onRemove={() => setPhoto({ path: null })}
          />
        )}
        {panel === "quiz" &&
          QUIZ.map((q) => (
            <div key={q.key}>
              <p className="mb-2 font-semibold">{q.q}</p>
              <OptionList
                options={q.options}
                value={quiz[q.key]}
                onPick={(o) => setQuiz({ ...quiz, [q.key]: o })}
              />
            </div>
          ))}
        {panel === "nights" && <NightsPicker value={nights} onChange={setNights} />}

        {panel === "socials" && (
          <div className="flex flex-col gap-4">
            <SocialLinksManager userId={p.id} onLinksChanged={onSocialsChange} />
            <Btn className="mt-4" onClick={onClose}>
              Done
            </Btn>
          </div>
        )}

        {panel === "privacy" && (
          <PrivacyPanel p={p} onSave={onSave} onReload={onReload} onClose={onClose} />
        )}

        {panel !== "socials" && panel !== "privacy" && (
          <Btn
            className="mt-auto"
            disabled={!valid}
            onClick={async () => {
              if (panel === "photo" && p.photo_path && p.photo_path !== photo.path)
                await supabase.storage.from("photos").remove([p.photo_path]);
              onSave(patch);
            }}
          >
            Save
          </Btn>
        )}
      </div>
    </Shell>
  );
}

function PrivacyPanel({
  p,
  onSave,
  onReload,
  onClose,
}: {
  p: ProfileRow;
  onSave: (patch: Partial<ProfileRow>) => void;
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  const [publicEnabled, setPublicEnabled] = useState(p.public_profile_enabled);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${p.share_token}`;

  const togglePublic = (enabled: boolean) => {
    setPublicEnabled(enabled);
    onSave({ public_profile_enabled: enabled });
    toast.success(enabled ? "Public profile card enabled!" : "Public profile card disabled.");
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Public card link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate your secret link? Your previous link will immediately stop working."))
      return;
    setRegenerating(true);
    try {
      const { error } = await supabase.rpc("regenerate_share_token");
      if (error) throw error;
      await onReload();
      toast.success("New secret link generated! Previous link revoked.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate link");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Enable toggle */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-primary">Public Profile Card</h3>
            <p className="text-xs text-muted-foreground">
              Allow anyone with your link to view your verified card
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publicEnabled}
            onClick={() => togglePublic(!publicEnabled)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              publicEnabled ? "bg-action" : "bg-border",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-background transition-all",
                publicEnabled ? "left-6" : "left-1",
              )}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
          When enabled, anyone who taps your Instagram Story link can view your safe Navratri card
          without an account. When turned off, the link displays as private.
        </p>
      </div>

      {/* Share Link Box */}
      <div
        className={cn(
          "rounded-2xl border bg-card p-4 space-y-3 transition",
          publicEnabled ? "border-action/40" : "border-border opacity-70",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Your Secret Public URL
          </span>
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              publicEnabled
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-neutral-200 text-neutral-600",
            )}
          >
            {publicEnabled ? "Active" : "Disabled"}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/80 p-3 select-all">
          <p className="font-mono text-xs font-semibold text-primary truncate">{publicUrl}</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!publicEnabled}
            onClick={copyUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Link Copied!" : "Copy Link"}
          </button>

          {publicEnabled && (
            <a
              href={`/p/${p.share_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </a>
          )}
        </div>
      </div>

      {/* Revoke / Regenerate Token */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-action" />
          <h3 className="font-display text-sm font-bold text-primary">Revoke & Regenerate Link</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          If you shared your card previously and want to disable that link completely, click below
          to generate a new opaque token. The old URL will stop working immediately.
        </p>
        <button
          type="button"
          disabled={regenerating}
          onClick={handleRegenerate}
          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
          {regenerating ? "Regenerating…" : "Revoke Old Link & Generate New"}
        </button>
      </div>

      {/* Privacy Guarantee Info Cards */}
      <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 space-y-2.5 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>After9 Privacy Architecture</span>
        </div>
        <ul className="space-y-1.5 text-muted-foreground text-[11px] leading-relaxed">
          <li>
            • <b className="text-foreground">Private by Default:</b> Phone numbers, birth date, and
            exact age are never accessible publicly.
          </li>
          <li>
            • <b className="text-foreground">Opaque Tokens:</b> Internal database IDs are never in
            your URLs. Tokens can be revoked anytime.
          </li>
          <li>
            • <b className="text-foreground">No Search Indexing:</b> Public preview pages include
            strict{" "}
            <code className="text-[10px] bg-card px-1 py-0.5 rounded">noindex, nofollow</code> tags.
          </li>
          <li>
            • <b className="text-foreground">Social Privacy:</b> Handles only display if toggled on
            your card or revealed to mutual Dandiya clashes.
          </li>
        </ul>
      </div>

      <Btn onClick={onClose}>Done</Btn>
    </div>
  );
}

type Invite = {
  code: string;
  revoked: boolean;
  expires_at: string | null;
  claimed_at: string | null;
  friend_name: string | null;
  friend_onboarded: boolean | null;
  friend_status: string | null;
};
function Invites({ me, onClaimed }: { me: ProfileRow; onClaimed: () => void }) {
  const ensure = useServerFn(ensureInvites);
  const claim = useServerFn(claimInvite);
  const revoke = useServerFn(revokeInvite);
  const [list, setList] = useState<Invite[]>([]);
  const [primaryCode, setPrimaryCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState("");
  const [drawingCard, setDrawingCard] = useState(false);

  const load = () =>
    supabase.rpc("my_invites").then(({ data }) => setList((data ?? []) as Invite[]));

  useEffect(() => {
    ensure()
      .then((r) => {
        if (r?.ok && r.primaryCode) setPrimaryCode(r.primaryCode);
        load();
      })
      .catch(() => {
        load();
      });
  }, [ensure]);

  const activeCode =
    primaryCode ?? list.find((i) => !i.claimed_at && !i.revoked)?.code ?? list[0]?.code ?? null;
  const inviteUrl = activeCode ? `${location.origin}/?invite=${activeCode}` : "";

  const copyLink = async (c = activeCode) => {
    if (!c) return;
    const url = `${location.origin}/?invite=${c}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(c);
      toast.success("Invite link copied to clipboard! 📋");
      setTimeout(() => setCopied(""), 2500);
    } catch {
      toast.error("Couldn't copy link. Please copy manually.");
    }
  };

  const shareWhatsApp = (c = activeCode) => {
    if (!c) return;
    const url = `${location.origin}/?invite=${c}`;
    const text = `Hey! Join me on After9 for Navratri & Garba nights. Connect on the floor: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareNative = async (c = activeCode) => {
    if (!c) return;
    const url = `${location.origin}/?invite=${c}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "After9 Festival Invite",
          text: "Join me on After9 for Navratri & Garba nights. Connect on the floor!",
          url,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copyLink(c);
  };

  const shareCard = async (c: string) => {
    setDrawingCard(true);
    try {
      await drawInviteCard(c, `${location.origin}/?invite=${c}&src=card`);
      toast.success("Festival invite card created!");
    } catch {
      toast.error("Could not generate card.");
    } finally {
      setDrawingCard(false);
    }
  };

  const status = (i: Invite) =>
    i.claimed_at
      ? "Used"
      : i.revoked
        ? "Cancelled"
        : i.expires_at && new Date(i.expires_at) < new Date()
          ? "Expired"
          : null;
  const available = list.filter(
    (i) => !i.claimed_at && !i.revoked && (!i.expires_at || new Date(i.expires_at) > new Date()),
  ).length;
  const joined = list.filter((i) => i.claimed_at).length;
  const finished = list.filter((i) => i.friend_onboarded).length;
  const stage = (i: Invite) =>
    !i.friend_onboarded
      ? ["Signed up · setting up", "text-action"]
      : i.friend_status === "approved"
        ? ["Finished setup · live", "text-teal"]
        : ["Finished setup · checking", "text-action"];

  return (
    <Section title="INVITE FRIENDS TO AFTER9">
      {/* Community Invite Hero Card */}
      <div className="my-3 overflow-hidden rounded-2xl border border-action/40 bg-gradient-to-br from-card via-card to-action/10 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/20 text-action">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-action uppercase">
                COMMUNITY INVITES
              </p>
              <h3 className="font-display text-lg font-extrabold text-primary">
                Invite Your Friends
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-action/15 px-3 py-1 text-xs font-bold text-action">
            {available} of {list.length || 5} Invites Left
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Share your personal invite link so your friends can connect with you on After9 during Navratri.
          Keep invites for people you know.
        </p>

        {/* Link box */}
        <div className="rounded-xl border border-border/80 bg-background/90 p-3 space-y-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Your Personal Invite Link
          </p>
          <p className="font-mono text-xs font-semibold text-primary truncate select-all">
            {inviteUrl || "Loading your invite link…"}
          </p>
        </div>

        {/* Fast Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => copyLink()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98"
          >
            {copied === activeCode ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied === activeCode ? "Link Copied!" : "Copy Link"}
          </button>
          <button
            type="button"
            onClick={() => shareWhatsApp()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-98"
          >
            <Share2 className="h-3.5 w-3.5" />
            WhatsApp
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {activeCode && (
            <button
              type="button"
              disabled={drawingCard}
              onClick={() => shareCard(activeCode)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-action/40 bg-action/10 px-3 py-2 text-xs font-bold text-action transition hover:bg-action/20 disabled:opacity-50"
            >
              🎨 {drawingCard ? "Generating…" : "Festival Card"}
            </button>
          )}
          <button
            type="button"
            onClick={() => shareNative()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" />
            More options
          </button>
        </div>
      </div>

      <Link
        to="/invites"
        className="my-2 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition hover:border-action/40"
      >
        <span className="text-sm font-semibold">
          Invite list — save friends' emails & send codes
        </span>
        <span className="text-primary font-bold">→</span>
      </Link>

      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-2 py-3 text-center">
          {[
            ["Total Passes", list.length],
            ["Joined", joined],
            ["Finished setup", finished],
          ].map(([l, n]) => (
            <div key={l} className="rounded-xl border border-border bg-card py-3">
              <p className="font-display text-2xl font-extrabold text-primary">{n}</p>
              <p className="text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Individual Passes List */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Individual Passes
        </p>
        {list.map((i) => (
          <div
            key={i.code}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "font-mono font-bold tracking-widest text-sm",
                  status(i) && !i.claimed_at && "text-muted-foreground line-through",
                )}
              >
                {i.code}
              </span>
              {status(i) ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                  {status(i)}
                </span>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    className="font-semibold text-primary transition hover:underline"
                    onClick={() => copyLink(i.code)}
                  >
                    {copied === i.code ? "Copied" : "Copy"}
                  </button>
                  <button
                    className="font-semibold text-emerald-600 transition hover:underline"
                    onClick={() => shareWhatsApp(i.code)}
                  >
                    WhatsApp
                  </button>
                  <button
                    className="font-semibold text-action transition hover:underline"
                    onClick={() => shareCard(i.code)}
                  >
                    Card
                  </button>
                  <button
                    className="text-muted-foreground transition hover:text-destructive"
                    onClick={async () => {
                      await revoke({ data: { code: i.code } });
                      load();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {i.claimed_at && (
              <p className="text-xs text-muted-foreground">
                <b className="text-foreground">{i.friend_name ?? "A friend"}</b>{" "}
                <span className={stage(i)[1]}>· {stage(i)[0]}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {!me.invited_by && (
        <form
          className="flex gap-2 pt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await claim({ data: { code } });
            setNote(r.reason);
            if (r.ok) {
              toast.success(r.reason ?? "Invite accepted!");
              onClaimed();
            } else {
              toast.error(r.reason ?? "Invalid code");
            }
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Got a code? A9-XXXXX"
            className="h-11 flex-1 rounded-xl border border-border bg-card px-3 font-mono tracking-widest text-sm outline-none focus:border-action"
          />
          <button
            className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            disabled={!code.trim()}
          >
            Use
          </button>
        </form>
      )}
      {note && <p className="pt-2 text-sm text-muted-foreground">{note}</p>}
    </Section>
  );
}

type Stats = { seen: number; dandiyas: number; passes: number; matches: number; sent: number };
type Liker = {
  id: string;
  first_name: string | null;
  age: number | null;
  college: string | null;
  photo_path: string | null;
};
function ShareStats() {
  const [s, setS] = useState<{
    invite_opens: number;
    invite_joins: number;
    invite_finished: number;
    story_opens: number;
    story_joins: number;
  } | null>(null);
  useEffect(() => {
    supabase.rpc("my_share_stats").then(({ data }) => setS(data?.[0] ?? null));
  }, []);
  if (!s) return null;
  const box = (n: number, l: string) => (
    <div className="bg-card px-3 py-3">
      <p className="font-display text-2xl font-extrabold text-primary">{n}</p>
      <p className="text-xs text-muted-foreground">{l}</p>
    </div>
  );
  return (
    <Section title="YOUR SHARED CARDS">
      <p className="mb-2 mt-2 text-sm font-medium">Invite cards</p>
      <div className="grid grid-cols-3 gap-2">
        {box(s.invite_opens, "Opened")}
        {box(s.invite_joins, "Signed up")}
        {box(s.invite_finished, "Finished setup")}
      </div>
      <p className="mb-2 mt-4 text-sm font-medium">Story card</p>
      <div className="grid grid-cols-2 gap-2">
        {box(s.story_opens, "Opened")}
        {box(s.story_joins, "Joined After9")}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Names of friends who joined are on your Invite list.
      </p>
    </Section>
  );
}

function CardStats() {
  const [s, setS] = useState<Stats | null>(null);
  const [mutual, setMutual] = useState<
    { id: string; first_name: string | null; photo_path: string | null }[]
  >([]);
  const [likers, setLikers] = useState<Liker[]>([]);
  useEffect(() => {
    supabase.rpc("my_card_stats").then(({ data }) => setS((data?.[0] as Stats) ?? null));
    supabase.rpc("my_matches").then(({ data }) => setMutual(data ?? []));
    supabase.rpc("my_likers").then(({ data }) => setLikers((data ?? []) as Liker[]));
  }, []);
  const urls = usePhotoUrls([
    ...mutual.map((m) => m.photo_path),
    ...likers.map((l) => l.photo_path),
  ]);
  if (!s) return null;
  const rate = s.seen ? Math.round((s.dandiyas / s.seen) * 100) : 0;
  return (
    <Section title="YOUR CARD">
      <div className="grid grid-cols-3 gap-2 py-2 text-center">
        {(
          [
            ["Swiped on", s.seen],
            ["Dandiyas", s.dandiyas],
            ["Clashes", s.matches],
          ] as const
        ).map(([l, n]) => (
          <div key={l} className="bg-card py-3">
            <p className="font-display text-2xl font-extrabold text-primary">{n}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {s.seen
          ? `${rate}% of people who saw your card sent a Dandiya. `
          : "Nobody has swiped on your card yet. "}
        You've sent {s.sent}.
      </p>
      {likers.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold">People who like you</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {likers.map((l) => (
              <Link key={l.id} to="/discover" className="w-20 shrink-0">
                <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                  {l.photo_path && urls[l.photo_path] && (
                    <img
                      src={urls[l.photo_path]}
                      alt={l.first_name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute right-1 top-1 rounded-full bg-action p-1 text-action-foreground">
                    <Dandiya className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-medium">
                  {l.first_name}
                  {l.age ? `, ${l.age}` : ""}
                </p>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            They sent you a Dandiya. Send one back from Discover and it's a clash.
          </p>
        </div>
      )}
      {mutual.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold">Sent you a Dandiya — and you sent one back</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {mutual.map((m) => (
              <Link
                key={m.id}
                to="/chat/$id"
                params={{ id: m.id }}
                className="relative w-20 shrink-0"
              >
                <div className="aspect-[3/4] overflow-hidden bg-muted">
                  {m.photo_path && urls[m.photo_path] && (
                    <img
                      src={urls[m.photo_path]}
                      alt={m.first_name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <span className="absolute right-1 top-1 rounded-full bg-action p-1 text-action-foreground">
                  <ChatIcon className="h-3.5 w-3.5" />
                </span>
                <p className="mt-1 truncate text-xs font-medium">{m.first_name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
