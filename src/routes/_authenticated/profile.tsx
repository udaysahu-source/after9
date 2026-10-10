import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { BottomNav, Btn, Shell } from "@/components/after9";
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
  invalidatePhotoUrl,
  validateBirthDate,
  type Attendance,
  type ProfileRow,
} from "@/lib/after9";
import { verifyProfile } from "@/lib/verify.functions";
import { checkAdminStatus } from "@/lib/admin.functions";
import { drawInviteCard } from "@/lib/share-cards";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  User,
  Sparkles,
  Link2,
  Compass,
  Shield,
  Ticket,
  Bell,
  Settings,
  ArrowLeft,
  Copy,
  Check,
  Share2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Info,
  Camera,
} from "lucide-react";
import { ShareCardStudio } from "@/components/share-card-studio";
import { PhotoVerificationModal } from "@/components/photo-verification-modal";
import { SocialLinksManager } from "@/components/social-links-manager";
import { ProfileInstagramField } from "@/components/profile-instagram-field";
import { ProfileVisibilityMeter } from "@/components/profile-visibility-meter";
import { getMySocialLinks, type SocialLinkRow } from "@/lib/social-links";
import { NotificationBell } from "@/components/notifications-popover";
import { PWAInstallCard } from "@/components/pwa-install-button";
import { NotificationSettings } from "@/components/notification-settings";
import { useAuthoritativeInvites } from "@/lib/invites";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — After9" },
      { name: "description", content: "Edit your After9 profile, card, discovery preferences and settings." },
      { property: "og:title", content: "Your profile — After9" },
      { property: "og:description", content: "Edit your After9 profile, card, discovery preferences and settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

export type ProfileCategory =
  | "my_profile"
  | "card"
  | "socials"
  | "discovery"
  | "privacy"
  | "invites"
  | "notifications"
  | "account";

export function calculateProfileCompletion(p: ProfileRow, socials: SocialLinkRow[]): {
  percentage: number;
  missing: string[];
} {
  let score = 0;
  const missing: string[] = [];

  if (p.photo_path) score += 20;
  else missing.push("Photo");

  if (p.first_name?.trim()) score += 15;
  else missing.push("Name");

  if (p.birth_date) score += 15;
  else missing.push("Birthday");

  if (p.prompt?.trim()) score += 15;
  else missing.push("Garba Prompt");

  if (goingNights(p.nights).length > 0) score += 15;
  else missing.push("Nights");

  if (Object.keys((p.quiz ?? {}) as Record<string, string>).length > 0) score += 10;
  else missing.push("Quiz");

  if (p.college?.trim()) score += 5;
  else missing.push("College");

  if (socials.length > 0) score += 5;
  else missing.push("Social link");

  return { percentage: Math.min(score, 100), missing };
}

function Profile() {
  const { p, loading, save, reload } = useMyProfile();
  const nav = useNavigate();
  const verify = useServerFn(verifyProfile);

  const [activeCategory, setActiveCategory] = useState<ProfileCategory | null>(null);
  const [checking, setChecking] = useState(false);
  const [cardStudioOpen, setCardStudioOpen] = useState(false);
  const [photoVerificationOpen, setPhotoVerificationOpen] = useState(false);
  const [socials, setSocials] = useState<SocialLinkRow[]>([]);
  const urls = usePhotoUrls([p?.photo_path]);

  useEffect(() => {
    if (p?.id) {
      getMySocialLinks(p.id).then(setSocials);
    }
  }, [p?.id]);

  if (loading) {
    return (
      <Shell maxWidth="wide">
        <main className="flex-1 pb-24 md:pb-28">
          <div className="flex items-center justify-between px-5 pt-6 md:pt-10">
            <div className="space-y-2">
              <div className="h-8 w-48 rounded-xl bg-muted animate-pulse" />
              <div className="h-3.5 w-64 rounded-md bg-muted/60 animate-pulse" />
            </div>
          </div>

          <div className="mt-5 md:mt-8 md:grid md:grid-cols-12 md:gap-8 md:px-5">
            <div className="flex flex-col gap-5 md:col-span-5 px-5 md:px-0">
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-16 rounded-xl bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-3.5 w-48 rounded bg-muted/60 animate-pulse" />
                    <div className="h-3.5 w-28 rounded bg-muted/40 animate-pulse" />
                  </div>
                </div>
                <div className="h-12 w-full rounded-xl bg-muted/40 animate-pulse" />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="h-10 rounded-xl bg-muted/50 animate-pulse" />
                  <div className="h-10 rounded-xl bg-muted/40 animate-pulse" />
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-3 space-y-2">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="h-12 w-full rounded-xl bg-muted/30 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </main>
        <BottomNav />
      </Shell>
    );
  }

  if (!p) {
    return (
      <Shell maxWidth="wide">
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-xs">
            <User className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-black text-primary">Set Up Your Profile</h1>
          <p className="text-sm text-muted-foreground max-w-sm mt-2">
            We couldn't load your profile record. Start quick onboarding to get your Dandiya pass and be discovered!
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <Btn onClick={() => nav({ to: "/onboarding" })}>
              Start Setup ✨
            </Btn>
            <Btn variant="outline" onClick={() => reload()}>
              Retry
            </Btn>
          </div>
        </main>
        <BottomNav />
      </Shell>
    );
  }

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
    if ("photo_path" in patch || "prompt" in patch || "first_name" in patch) {
      recheck();
    }
  };

  const completion = calculateProfileCompletion(p, socials);

  const categories = [
    {
      id: "my_profile" as const,
      label: "My Profile",
      icon: User,
      subtitle: p.first_name ? `${p.first_name}${p.prompt ? ` · "${p.prompt.slice(0, 24)}…"` : ""}` : "Personal details & photo",
    },
    {
      id: "card" as const,
      label: "My After9 Card",
      icon: Sparkles,
      subtitle: p.public_profile_enabled ? "Public link active · Custom style" : "Private link · Custom style",
    },
    {
      id: "socials" as const,
      label: "Instagram & Socials",
      icon: Link2,
      subtitle: socials.length > 0 ? `${socials.length} link${socials.length > 1 ? "s" : ""} added` : "Connect your Instagram for clashes",
    },
    {
      id: "discovery" as const,
      label: "Discovery Preferences",
      icon: Compass,
      subtitle: !p.discoverable ? "Hidden from Discover" : `${p.min_age}–${p.max_age} yrs · ${p.interested_in}`,
    },
    {
      id: "privacy" as const,
      label: "Privacy & Safety",
      icon: Shield,
      subtitle: "Audience meter, blocked users & safety",
    },
    {
      id: "invites" as const,
      label: "Invitations & Referrals",
      icon: Ticket,
      subtitle: "Personal invite link & friend list",
    },
    {
      id: "notifications" as const,
      label: "App & Notifications",
      icon: Bell,
      subtitle: "Install PWA & Web Push alerts",
    },
    {
      id: "account" as const,
      label: "Account",
      icon: Settings,
      subtitle: "Sign out & account deletion",
    },
  ];

  return (
    <Shell maxWidth="wide">
      <main className="flex-1 pb-24 md:pb-28">
        {/* Top Header with Notification Bell */}
        <div className="flex items-center justify-between px-5 pt-6 md:pt-10">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-primary md:text-4xl">Profile & Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your Garba presence, card and privacy.</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userId={p.id} />
          </div>
        </div>

        {/* Responsive Content Grid */}
        <div className="mt-5 md:mt-8 md:grid md:grid-cols-12 md:gap-8 md:px-5">
          {/* LEFT COLUMN: Overview Card & Category Nav */}
          <div className={cn("flex flex-col gap-5 md:col-span-5", activeCategory !== null && "hidden md:flex")}>
            {/* Clean Profile Overview (Displaying only the required 6 elements) */}
            <div className="mx-5 md:mx-0 overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-4">
                {/* 1. Profile photo */}
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-muted shadow-xs">
                  {p.photo_path && urls[p.photo_path] ? (
                    <img src={urls[p.photo_path]} alt={p.first_name ?? "You"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-muted-foreground">
                      {p.first_name?.[0] || "?"}
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-background",
                      p.verification_status === "approved"
                        ? "bg-teal-500"
                        : p.verification_status === "pending"
                        ? "bg-action"
                        : "bg-destructive"
                    )}
                    title={`Status: ${p.verification_status}`}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  {/* 2. Name, age, and photo verification badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-xl font-extrabold text-primary truncate">
                      {p.first_name || "Your Name"}
                      {p.birth_date ? `, ${ageFrom(p.birth_date)}` : ""}
                    </h2>
                    {p.verification_status === "approved" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                        <ShieldCheck className="h-3 w-3" /> Photo verified
                      </span>
                    ) : p.verification_status === "needs_review" ? (
                      <button
                        type="button"
                        onClick={() => setPhotoVerificationOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition"
                      >
                        <RefreshCw className="h-3 w-3" /> Under Review
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPhotoVerificationOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full bg-action/15 border border-action/30 px-2 py-0.5 text-[10px] font-bold text-action hover:bg-action/25 transition shadow-xs"
                      >
                        <Camera className="h-3 w-3" /> Verify Photo
                      </button>
                    )}
                  </div>

                  {/* 3. College, if the user has enabled its visibility */}
                  {p.show_college && p.college ? (
                    <p className="text-xs text-muted-foreground truncate font-medium">
                      🎓 {p.college}
                      {p.branch ? ` · ${p.branch}` : ""}
                    </p>
                  ) : null}

                  <p className="text-xs font-semibold text-teal">
                    {goingNights(p.nights).length} of 9 Garba nights selected
                  </p>
                </div>
              </div>

              {/* 4. Profile completion status, calculated from actual saved fields */}
              <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">Profile Completion</span>
                  <span className="font-black text-action">{completion.percentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-action to-saffron transition-all duration-500"
                    style={{ width: `${completion.percentage}%` }}
                  />
                </div>
                {completion.missing.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Add <span className="font-medium text-foreground">{completion.missing.slice(0, 2).join(", ")}</span> to reach 100%
                  </p>
                ) : (
                  <p className="text-[11px] text-teal font-medium">✨ All profile details complete</p>
                )}
              </div>

              {/* 5 & 6. Primary Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCardStudioOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98"
                >
                  <Sparkles className="h-3.5 w-3.5 text-saffron" />
                  Customize Card
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("my_profile")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted active:scale-98"
                >
                  <User className="h-3.5 w-3.5 text-action" />
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Category Navigation Menu */}
            <div className="mx-5 md:mx-0 rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex w-full items-center justify-between p-3.5 text-left transition hover:bg-muted/40 active:bg-muted/60",
                      active && "bg-muted/50 border-l-3 border-action"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                        active ? "bg-action/20 text-action" : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate", active ? "text-primary" : "text-foreground")}>
                          {cat.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{cat.subtitle}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Focused Category View */}
          <div className={cn("md:col-span-7", activeCategory === null && "hidden md:block")}>
            {activeCategory === null ? (
              // Desktop placeholder when no category explicitly selected
              <div className="hidden md:flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground h-full min-h-[400px]">
                <Settings className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <h3 className="font-display text-lg font-bold text-primary">Select a Category</h3>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Choose a category on the left to edit your personal profile, card, social links, or privacy settings.
                </p>
              </div>
            ) : (
              // Active Category Panel
              <div className="mx-5 md:mx-0 rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-6">
                {/* Header with Back button on mobile */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
                      aria-label="Back to settings list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <h2 className="font-display text-xl font-extrabold text-primary">
                        {categories.find((c) => c.id === activeCategory)?.label}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {categories.find((c) => c.id === activeCategory)?.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CATEGORY 1: MY PROFILE */}
                {activeCategory === "my_profile" && (
                  <MyProfileCategory
                    p={p}
                    photoUrl={p.photo_path ? urls[p.photo_path] : undefined}
                    onSave={saveAndCheck}
                    onRequestVerification={() => setPhotoVerificationOpen(true)}
                  />
                )}

                {/* CATEGORY 2: MY AFTER9 CARD */}
                {activeCategory === "card" && (
                  <MyCardCategory
                    p={p}
                    photoUrl={p.photo_path ? urls[p.photo_path] : undefined}
                    onOpenStudio={() => setCardStudioOpen(true)}
                    onSave={saveAndCheck}
                    onReload={reload}
                  />
                )}

                {/* CATEGORY 3: SOCIAL LINKS */}
                {activeCategory === "socials" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connect your Instagram for post-clash conversations. Handles remain strictly private by default and are only shared with mutual Dandiya matches when you both consent.
                    </p>
                    <ProfileInstagramField
                      userId={p.id}
                      onHandleChange={() => getMySocialLinks(p.id).then(setSocials)}
                    />
                    <div className="pt-2">
                      <p className="text-xs font-bold text-foreground mb-2">Other Social Networks</p>
                      <SocialLinksManager userId={p.id} onLinksChanged={setSocials} />
                    </div>
                  </div>
                )}

                {/* CATEGORY 4: DISCOVERY PREFERENCES */}
                {activeCategory === "discovery" && (
                  <DiscoveryCategory p={p} onSave={saveAndCheck} photoUrl={p.photo_path ? urls[p.photo_path] : undefined} />
                )}

                {/* CATEGORY 5: PRIVACY & SAFETY */}
                {activeCategory === "privacy" && (
                  <PrivacySafetyCategory p={p} onSave={saveAndCheck} />
                )}

                {/* CATEGORY 6: INVITATIONS */}
                {activeCategory === "invites" && (
                  <InvitationsCategory p={p} />
                )}

                {/* CATEGORY 7: APP & NOTIFICATIONS */}
                {activeCategory === "notifications" && (
                  <div className="space-y-6">
                    <PWAInstallCard />
                    <NotificationSettings
                      userId={p.id}
                      enabled={p.push_notifications_enabled ?? false}
                      onUpdate={reload}
                    />
                  </div>
                )}

                {/* CATEGORY 8: ACCOUNT */}
                {activeCategory === "account" && (
                  <AccountCategory p={p} />
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Share Card Studio Modal */}
      <ShareCardStudio
        open={cardStudioOpen}
        onOpenChange={setCardStudioOpen}
        userId={p.id}
        socialLinks={socials}
        savedPreferences={(p.card_preferences as any) ?? null}
        cardData={{
          name: p.first_name ?? "",
          age: p.birth_date ? ageFrom(p.birth_date) : null,
          college: p.show_college ? p.college : null,
          branch: p.show_college ? p.branch : null,
          city: "Raipur",
          generalArea: (p as any).general_area ?? null,
          prompt: p.prompt ?? "",
          photoUrl: (p.photo_path && urls[p.photo_path]) ? urls[p.photo_path]! : null,
          nights: Array.isArray(p.nights) ? (p.nights as number[]) : [],
          shareUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/p/${p.share_token}`,
        }}
      />

      {/* Live Photo Verification Modal */}
      <PhotoVerificationModal
        open={photoVerificationOpen}
        onOpenChange={setPhotoVerificationOpen}
        profilePhotoUrl={(p.photo_path && urls[p.photo_path]) ? urls[p.photo_path]! : null}
        onVerificationComplete={async () => {
          await reload();
        }}
      />
    </Shell>
  );
}

// ==========================================
// CATEGORY 1: MY PROFILE
// ==========================================
function MyProfileCategory({
  p,
  photoUrl,
  onSave,
  onRequestVerification,
}: {
  p: ProfileRow;
  photoUrl?: string | undefined;
  onSave: (patch: Partial<ProfileRow>) => Promise<void>;
  onRequestVerification?: () => void;
}) {
  const [firstName, setFirstName] = useState(p.first_name ?? "");
  const [birthDate, setBirthDate] = useState(p.birth_date ?? "");
  const [college, setCollege] = useState(p.college ?? "");
  const [branch, setBranch] = useState(p.branch ?? "");
  const [generalArea, setGeneralArea] = useState((p as any).general_area ?? "");
  const [promptText, setPromptText] = useState(p.prompt ?? "");
  const [photo, setPhoto] = useState<{ path: string | null; preview?: string | undefined }>({
    path: p.photo_path,
    preview: photoUrl,
  });
  const [quiz, setQuiz] = useState((p.quiz ?? {}) as Record<string, string>);
  const [nights, setNights] = useState((p.nights ?? {}) as Record<string, Attendance>);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (birthDate) {
      const v = validateBirthDate(birthDate);
      if (!v.valid) {
        toast.error(v.error || "Please enter a valid birth date (18+).");
        return;
      }
    }

    setSaving(true);
    try {
      if (p.photo_path && p.photo_path !== photo.path) {
        invalidatePhotoUrl(p.photo_path);
        await supabase.storage.from("photos").remove([p.photo_path]);
      }
      await onSave({
        first_name: firstName.trim(),
        birth_date: birthDate || null,
        college: college.trim() || null,
        branch: branch.trim() || null,
        general_area: generalArea.trim() || null,
        prompt: promptText.trim() || null,
        photo_path: photo.path,
        quiz,
        nights,
      } as any);
      toast.success("Profile saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Photo Picker with Camera & Live Person Match */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
          Profile Photo
        </label>
        <PhotoPicker
          userId={p.id}
          url={photo.preview}
          onUploaded={(path, preview) => {
            setPhoto({ path, preview });
            onRequestVerification?.();
          }}
          onRemove={() => setPhoto({ path: null })}
          onRequestVerification={onRequestVerification}
        />
      </div>

      {/* Name and Birthday */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            First Name
          </label>
          <input
            className={fieldInput}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            Birthday (YYYY-MM-DD)
          </label>
          <input
            type="date"
            className={fieldInput}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
      </div>

      {/* College and Branch */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            College / University
          </label>
          <input
            className={fieldInput}
            placeholder="e.g. NIT Raipur, AIIMS"
            value={college}
            onChange={(e) => setCollege(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            Branch · Year (Optional)
          </label>
          <input
            className={fieldInput}
            placeholder="e.g. CSE · 3rd Year"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </div>
      </div>

      {/* General Area */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
          General Area in Raipur (Coarse neighborhood only)
        </label>
        <input
          className={fieldInput}
          placeholder="e.g. Telibandha, Shankar Nagar, Pandri"
          value={generalArea}
          onChange={(e) => setGeneralArea(e.target.value)}
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
          Garba Prompt
        </label>
        <input
          className={fieldInput}
          maxLength={70}
          placeholder="Garba night isn't complete without…"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
        />
      </div>

      {/* Garba Quiz */}
      <div className="space-y-4 pt-2 border-t border-border/60">
        <h3 className="font-display text-sm font-bold text-primary">Garba Quiz & Preferences</h3>
        {QUIZ.map((q) => (
          <div key={q.key} className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">{q.q}</p>
            <OptionList
              options={q.options}
              value={quiz[q.key]}
              onPick={(o) => setQuiz({ ...quiz, [q.key]: o })}
            />
          </div>
        ))}
      </div>

      {/* Nights Picker */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <h3 className="font-display text-sm font-bold text-primary">Nights You're Attending</h3>
        <NightsPicker value={nights} onChange={setNights} />
      </div>

      {/* Dedicated Instagram Handle Field */}
      <div className="pt-2 border-t border-border/60">
        <ProfileInstagramField userId={p.id} />
      </div>

      <div className="pt-3">
        <Btn onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save Profile Changes"}
        </Btn>
      </div>
    </div>
  );
}

// ==========================================
// CATEGORY 2: MY AFTER9 CARD
// ==========================================
function MyCardCategory({
  p,
  photoUrl,
  onOpenStudio,
  onSave,
  onReload,
}: {
  p: ProfileRow;
  photoUrl?: string | undefined;
  onOpenStudio: () => void;
  onSave: (patch: Partial<ProfileRow>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [publicEnabled, setPublicEnabled] = useState(p.public_profile_enabled);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${p.share_token}`;

  const togglePublic = async (enabled: boolean) => {
    setPublicEnabled(enabled);
    await onSave({ public_profile_enabled: enabled });
    toast.success(enabled ? "Public card enabled!" : "Public card disabled.");
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Card link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate your secret link? The previous link will immediately stop working.")) return;
    setRegenerating(true);
    try {
      const { error } = await supabase.rpc("regenerate_share_token");
      if (error) throw error;
      await onReload();
      toast.success("New secret link generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate link");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Customize Card Button */}
      <div className="rounded-2xl border border-action/40 bg-gradient-to-br from-card to-action/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-action" />
            <h3 className="font-display text-sm font-bold text-primary">Custom Card Design</h3>
          </div>
          <button
            onClick={onOpenStudio}
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Open Card Studio ↗
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose from Editorial, Minimal, or Festival styles, customize festive color themes, and export at 1080 × 1920 Instagram Story resolution.
        </p>
      </div>

      {/* Public Profile Card Toggle */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-primary">Public Profile Card</h3>
            <p className="text-xs text-muted-foreground">Allow anyone with your secret link to view your verified card</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publicEnabled}
            onClick={() => togglePublic(!publicEnabled)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              publicEnabled ? "bg-action" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-background transition-all",
                publicEnabled ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
          When enabled, friends who tap your Instagram Story or WhatsApp link can view your safe Navratri card without an account.
        </p>
      </div>

      {/* Share Link Box */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your Public URL</span>
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            publicEnabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
          )}>
            {publicEnabled ? "Active" : "Disabled"}
          </span>
        </div>
        <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 select-all">
          <p className="font-mono text-xs font-semibold text-primary truncate">{publicUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!publicEnabled}
            onClick={copyUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Link Copied!" : "Copy Link"}
          </button>
          {publicEnabled && (
            <a
              href={`/p/${p.share_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </a>
          )}
        </div>
      </div>

      {/* Revoke Token */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h3 className="font-display text-sm font-bold text-primary">Revoke & Regenerate Link</h3>
        <p className="text-xs text-muted-foreground">
          If you shared your card previously and want to disable that link completely, click below to generate a new opaque token.
        </p>
        <button
          type="button"
          disabled={regenerating}
          onClick={handleRegenerate}
          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
          {regenerating ? "Regenerating…" : "Revoke Old Link & Generate New"}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// CATEGORY 4: DISCOVERY PREFERENCES
// ==========================================
function DiscoveryCategory({
  p,
  onSave,
  photoUrl,
}: {
  p: ProfileRow;
  onSave: (patch: Partial<ProfileRow>) => Promise<void>;
  photoUrl?: string | undefined;
}) {
  const [interestedIn, setInterestedIn] = useState(p.interested_in);
  const [minAge, setMinAge] = useState(p.min_age);
  const [maxAge, setMaxAge] = useState(p.max_age);
  const [discoverable, setDiscoverable] = useState(p.discoverable);

  const [audiences, setAudiences] = useState<string[]>(
    (p as any).visibility_audiences?.length ? (p as any).visibility_audiences : ["only_me"]
  );

  return (
    <div className="space-y-5">
      {/* Show me preference */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          Who do you want to meet?
        </label>
        <Choice
          options={INTERESTS}
          value={interestedIn}
          onChange={(v) => {
            setInterestedIn(v);
            onSave({ interested_in: v });
          }}
        />
      </div>

      {/* Age range */}
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span>Age Range</span>
          <span className="text-primary font-mono">{minAge} – {maxAge} years</span>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <input
            type="range"
            min={18}
            max={60}
            value={minAge}
            className="flex-1 accent-[var(--action)]"
            onChange={(e) => {
              const val = Math.min(+e.target.value, maxAge);
              setMinAge(val);
              onSave({ min_age: val });
            }}
          />
          <input
            type="range"
            min={18}
            max={60}
            value={maxAge}
            className="flex-1 accent-[var(--action)]"
            onChange={(e) => {
              const val = Math.max(+e.target.value, minAge);
              setMaxAge(val);
              onSave({ max_age: val });
            }}
          />
        </div>
      </div>

      {/* Profile Discovery Audience Meter */}
      <ProfileVisibilityMeter
        audiences={audiences}
        onChangeAudiences={(auds) => {
          setAudiences(auds);
          onSave({ visibility_audiences: auds } as any);
        }}
        college={p.college}
        onChangeCollege={(c) => onSave({ college: c })}
        generalArea={(p as any).general_area}
        onChangeGeneralArea={(a) => onSave({ general_area: a } as any)}
        discoverable={discoverable}
        onToggleDiscoverable={(disc) => {
          setDiscoverable(disc);
          onSave({ discoverable: disc });
        }}
        userFirstName={p.first_name}
        userAge={p.birth_date ? ageFrom(p.birth_date) : null}
        userPhotoUrl={photoUrl}
        userPrompt={p.prompt}
        userNightsCount={goingNights(p.nights).length}
      />
    </div>
  );
}

// ==========================================
// CATEGORY 5: PRIVACY & SAFETY
// ==========================================
function PrivacySafetyCategory({
  p,
  onSave,
}: {
  p: ProfileRow;
  onSave: (patch: Partial<ProfileRow>) => Promise<void>;
}) {
  const [showCollege, setShowCollege] = useState(p.show_college);
  const [discoverable, setDiscoverable] = useState(p.discoverable);

  return (
    <div className="space-y-5">
      {/* Toggle Hide me from Discover */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-primary">Hide me from Discover</h3>
            <p className="text-xs text-muted-foreground">Immediately removes your profile from new discovery results</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!discoverable}
            onClick={() => {
              const next = !discoverable;
              setDiscoverable(!next);
              onSave({ discoverable: !next });
            }}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              !discoverable ? "bg-action" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-background transition-all",
                !discoverable ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>
      </div>

      {/* Toggle Show College */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-primary">Show my college</h3>
            <p className="text-xs text-muted-foreground">Display college & branch on your share card and profile</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showCollege}
            onClick={() => {
              setShowCollege(!showCollege);
              onSave({ show_college: !showCollege });
            }}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              showCollege ? "bg-action" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-background transition-all",
                showCollege ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>
      </div>

      {/* Blocked Users */}
      <BlockedList userId={p.id} />

      {/* Community Safety & Helpline Information */}
      <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>After9 Safety & Community Standards</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          After9 is an adult (18+) community designed for safe Navratri and Garba meetups. We strictly prohibit harassment, impersonation, and non-consensual sharing.
        </p>
        <p className="text-[11px] text-muted-foreground">
          <b>Raipur Emergency / Women Helpline:</b> 112 / 1091
        </p>
      </div>
    </div>
  );
}

// ==========================================
// CATEGORY 6: INVITATIONS
// ==========================================
function InvitationsCategory({ p }: { p: ProfileRow }) {
  const {
    primaryCode,
    availableCount,
    claimedCount,
    totalAllocation,
    invites,
    status,
    error,
    refresh,
  } = useAuthoritativeInvites();

  const [copied, setCopied] = useState("");
  const [drawingCard, setDrawingCard] = useState(false);

  const inviteUrl = primaryCode ? `${window.location.origin}/?invite=${primaryCode}` : "";

  const handleCopy = async (code = primaryCode) => {
    if (!code) return;
    const url = `${window.location.origin}/?invite=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      toast.success("Invite link copied to clipboard! 📋");
      setTimeout(() => setCopied(""), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleWhatsApp = (code = primaryCode) => {
    if (!code) return;
    const url = `${window.location.origin}/?invite=${code}`;
    const text = `Hey! Join me on After9 for Navratri & Garba nights. Connect on the floor: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleDrawCard = async (code = primaryCode) => {
    if (!code) return;
    setDrawingCard(true);
    try {
      await drawInviteCard(code, `${window.location.origin}/?invite=${code}&src=card`);
      toast.success("Festival invite card created! 🎨");
    } catch {
      toast.error("Could not generate card.");
    } finally {
      setDrawingCard(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Community Invite Card */}
      <div className="rounded-2xl border border-action/40 bg-gradient-to-br from-card to-action/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/20 text-action">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-action uppercase">COMMUNITY INVITES</p>
              <h3 className="font-display text-base font-extrabold text-primary">Your Garba nights need a better crew.</h3>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            Unlimited Sharing Active
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Find your people, plan your nights and make Navratri more memorable with After9. Distribute your personal link as many times as you like with friends and group chats.
        </p>

        {status === "error" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-2 text-center">
            <p className="text-xs text-destructive font-semibold">{error || "Could not load invite link"}</p>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-bold text-primary shadow-xs"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 bg-background/90 p-3 space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Your Persistent Invite Link</p>
            <p className="font-mono text-xs font-semibold text-primary truncate select-all">
              {inviteUrl || (status === "loading" ? "Generating your invite link…" : "Ready to share")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleCopy()}
            disabled={!primaryCode || status === "loading"}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {copied === primaryCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === primaryCode ? "Copied!" : "Copy Link"}
          </button>
          <button
            type="button"
            onClick={() => handleWhatsApp()}
            disabled={!primaryCode || status === "loading"}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => handleDrawCard()}
            disabled={!primaryCode || status === "loading" || drawingCard}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {drawingCard ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-action" />}
            Story Card
          </button>
        </div>

        <p className="text-[11px] text-center font-medium italic text-muted-foreground pt-1">
          After9 — “Meet on the floor. Stay after.”
        </p>
      </div>

      {/* Redemption History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-primary">Your Invite Passes ({invites.length})</h3>
          <Link to="/invites" className="text-xs font-semibold text-action hover:underline">
            Manage Friends List ↗
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden text-xs">
          {invites.map((inv) => (
            <div key={inv.code} className="flex items-center justify-between p-3">
              <div>
                <p className="font-mono font-bold text-primary">{inv.code}</p>
                <p className="text-[11px] text-muted-foreground">
                  {inv.claimed_at
                    ? `Claimed by ${inv.friend_name || "Friend"} (${inv.friend_status || "joined"})`
                    : inv.revoked
                    ? "Cancelled"
                    : "Available to share"}
                </p>
              </div>
              <div>
                {!inv.claimed_at && !inv.revoked && (
                  <button
                    onClick={() => handleCopy(inv.code)}
                    className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
          ))}
          {invites.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">No invite passes generated yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CATEGORY 8: ACCOUNT
// ==========================================
function AccountCategory({ p }: { p: ProfileRow }) {
  const nav = useNavigate();
  const checkAdmin = useServerFn(checkAdminStatus);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin()
      .then((res) => setIsAdmin(Boolean(res?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  const handleSignOut = async () => {
    if (!confirm("Are you sure you want to sign out?")) return;
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  const handleDeleteProfile = async () => {
    if (!confirm("Delete your profile, photo and chats permanently? This cannot be undone.")) return;
    try {
      if (p.photo_path) {
        invalidatePhotoUrl(p.photo_path);
        await supabase.storage.from("photos").remove([p.photo_path]);
      }
      await supabase.from("profiles").delete().eq("id", p.id);
      await supabase.auth.signOut();
      nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete profile");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h3 className="font-display text-sm font-bold text-primary">Signed-in Identity</h3>
        <p className="text-xs text-muted-foreground font-mono truncate select-all">User ID: {p.id}</p>
        <p className="text-xs text-muted-foreground">Verification: <b className="text-foreground">{p.verification_status}</b></p>
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">👑</span>
              <h3 className="font-display text-sm font-bold text-primary">Administrator Controls</h3>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Access platform metrics, user moderation, referral audits, and Discover launch control.
          </p>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90"
          >
            Open Admin Control Center →
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-display text-sm font-bold text-primary">Session Management</h3>
        <p className="text-xs text-muted-foreground">
          Sign out of your active browser session on this device.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out of After9
        </button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-wider">
          <AlertTriangle className="h-4 w-4" />
          <span>Danger Zone</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Permanently delete your profile, photos, matches, Dandiyas, and conversation records. This action cannot be reversed.
        </p>
        <button
          type="button"
          onClick={handleDeleteProfile}
          className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete My Profile Permanently
        </button>
      </div>
    </div>
  );
}

// ==========================================
// HELPER: BLOCKED LIST
// ==========================================
function BlockedList({ userId }: { userId: string }) {
  const [list, setList] = useState<{ blocked_id: string }[] | null>(null);

  const load = () =>
    supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId)
      .then(({ data }) => setList(data ?? []));

  useEffect(() => {
    load();
  }, [userId]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-primary">Blocked Accounts</h3>
        <span className="text-xs text-muted-foreground">{list ? `${list.length} blocked` : "Loading…"}</span>
      </div>
      {list && list.length > 0 ? (
        <div className="divide-y divide-border/60">
          {list.map((b, i) => (
            <div key={b.blocked_id} className="flex items-center justify-between py-2 text-xs">
              <span className="text-muted-foreground">Blocked User {i + 1}</span>
              <button
                className="font-bold text-primary hover:underline"
                onClick={async () => {
                  await supabase
                    .from("blocks")
                    .delete()
                    .eq("blocker_id", userId)
                    .eq("blocked_id", b.blocked_id);
                  load();
                  toast.success("User unblocked");
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground pt-1">Nobody blocked.</p>
      )}
    </div>
  );
}
