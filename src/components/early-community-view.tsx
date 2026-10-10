import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Users,
  Ticket,
  Calendar,
  Sparkles,
  ArrowRight,
  Share2,
  CheckCircle2,
  AlertCircle,
  Camera,
} from "lucide-react";
import { NIGHTS, goingNights, usePhotoUrls, type ProfileRow } from "@/lib/after9";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface EarlyCommunityViewProps {
  userProfile: ProfileRow | null;
  onOpenInviteModal: () => void;
  onOpenShareCard?: () => void;
  onProfileUpdated?: () => void;
}

export function EarlyCommunityView({
  userProfile,
  onOpenInviteModal,
  onOpenShareCard,
  onProfileUpdated,
}: EarlyCommunityViewProps) {
  const [savingNight, setSavingNight] = useState<number | null>(null);
  const photoUrls = usePhotoUrls([userProfile?.photo_path]);
  const resolvedPhotoUrl = userProfile?.photo_path ? photoUrls[userProfile.photo_path] : null;

  // Active nights for current user
  const userNights = userProfile ? goingNights(userProfile.nights) : [];

  const toggleNight = async (nightNum: number) => {
    if (!userProfile) return;
    setSavingNight(nightNum);
    try {
      const currentNights = (userProfile.nights as Record<string, string>) ?? {};
      const key = String(nightNum);
      const nextNights = { ...currentNights };
      if (nextNights[key] === "going") {
        delete nextNights[key];
      } else {
        nextNights[key] = "going";
      }

      const { error } = await supabase
        .from("profiles")
        .update({ nights: nextNights })
        .eq("id", userProfile.id);

      if (error) throw error;
      toast.success(
        nextNights[key] === "going"
          ? `Night ${nightNum} added to your Garba schedule!`
          : `Night ${nightNum} removed.`
      );
      onProfileUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update nights");
    } finally {
      setSavingNight(null);
    }
  };

  // Check missing essential profile elements
  const missingItems: string[] = [];
  if (!userProfile?.photo_path) missingItems.push("Profile portrait");
  if (!userProfile?.prompt?.trim()) missingItems.push("Garba prompt");
  if (!userProfile?.birth_date) missingItems.push("Birthday");
  if (userNights.length === 0) missingItems.push("Festival nights");

  const isProfileComplete = missingItems.length === 0;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 pb-12 pt-2">
      {/* Festival-inspired Visual & Welcoming Header */}
      <div className="relative overflow-hidden rounded-3xl border border-action/40 bg-gradient-to-b from-action/15 via-card to-card p-6 sm:p-8 text-center shadow-lg">
        {/* Subtle decorative festival sparkles & dandiya motif */}
        <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-action/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-primary/20 blur-2xl pointer-events-none" />

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-action/20 text-action shadow-inner">
          <span className="text-2xl">✨</span>
        </div>

        <h1 className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">
          Your Garba crew starts here.
        </h1>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Bring your people to After9. Build your circle, pick your Garba nights and get ready to meet when the floor comes alive.
        </p>

        {/* Truthful Community Opening Explanation */}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs">
          <span>💫</span>
          <span>Discovering other people will become available when the community opens.</span>
        </div>

        {/* Primary Action: Invite Your Friends */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenInviteModal}
            className="touch-tactile w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-action px-6 py-3.5 text-sm font-extrabold text-action-foreground shadow-md transition hover:opacity-95 active:scale-98"
          >
            <Ticket className="h-4 w-4" />
            <span>Invite Your Friends</span>
          </button>

          {onOpenShareCard && (
            <button
              type="button"
              onClick={onOpenShareCard}
              className="touch-tactile w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-bold text-foreground transition hover:bg-muted active:scale-98"
            >
              <Share2 className="h-4 w-4 text-action" />
              <span>Preview My Share Card</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Completion Action (Shown if Profile is Incomplete) */}
      {!isProfileComplete && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
              <Camera className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h2 className="font-display text-sm font-extrabold text-foreground">
                Complete your profile before doors open
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add your {missingItems.join(", ")} so your circle knows who to look for on the floor.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Link
              to="/profile"
              className="touch-tactile inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 shadow-xs"
            >
              <span>Complete Profile</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Secondary Action: Choose My Garba Nights */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-extrabold text-primary">Choose My Garba Nights</h2>
              <p className="text-[11px] text-muted-foreground">Select the nights you plan to be on the floor in Raipur</p>
            </div>
          </div>
          <span className="text-xs font-bold text-action">
            {userNights.length} {userNights.length === 1 ? "night" : "nights"} selected
          </span>
        </div>

        {/* Interactive 9-Night Selector Grid */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {NIGHTS.map((n) => {
            const nightNum = (n as any).night ?? (n as any).n;
            const isGoing = userNights.includes(nightNum);
            const isSaving = savingNight === nightNum;
            const themeLabel = typeof (n as any).theme === "string" ? (n as any).theme.split(" ")[0] : `Night ${nightNum}`;
            const dateLabel = typeof (n as any).date === "string" ? (n as any).date.split(" ")[0] : String(nightNum);
            return (
              <button
                key={nightNum}
                type="button"
                onClick={() => toggleNight(nightNum)}
                disabled={isSaving}
                className={cn(
                  "touch-tactile relative flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all",
                  isGoing
                    ? "border-action bg-action/15 text-primary shadow-xs ring-1 ring-action"
                    : "border-border/70 bg-background/60 text-muted-foreground hover:border-action/40"
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-action">
                  Night {nightNum}
                </span>
                <span className="font-display text-xs font-extrabold text-foreground mt-0.5">
                  {themeLabel}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {dateLabel}
                </span>
                {isGoing && (
                  <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-action" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* User's Share Card Preview */}
      {userProfile && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-action/10 text-action">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-extrabold text-primary">Your After9 Share Card</h2>
                <p className="text-[11px] text-muted-foreground">Preview how you appear on Instagram Stories & WhatsApp</p>
              </div>
            </div>
            {onOpenShareCard && (
              <button
                type="button"
                onClick={onOpenShareCard}
                className="text-xs font-bold text-action hover:underline"
              >
                Customize →
              </button>
            )}
          </div>

          {/* Mini Editorial Card Preview */}
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-[#260E27] to-[#120514] p-4 text-white shadow-md space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-400/90 tracking-wider">
              <span>GARBA PLANS?</span>
              <span className="text-white/60">NAVRATRI 2026</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-primary/20">
                {resolvedPhotoUrl ? (
                  <img
                    src={resolvedPhotoUrl}
                    alt={userProfile?.first_name || "Profile"}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-xl font-black text-amber-300">
                    {(userProfile?.first_name || "A").slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display text-base font-extrabold text-[#FAF4EA] truncate">
                  {userProfile.first_name || "Your Name"}
                </p>
                {userProfile.college && (
                  <p className="text-xs text-white/70 truncate">{userProfile.college}</p>
                )}
                <p className="text-[11px] text-amber-400 font-semibold mt-0.5">
                  {userNights.length > 0 ? `${userNights.length} nights on the floor` : "Looking for Garba plans"}
                </p>
              </div>
            </div>

            {userProfile.prompt && (
              <p className="text-xs italic text-white/80 border-l-2 border-amber-400 pl-2 line-clamp-2">
                “{userProfile.prompt}”
              </p>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-white/50">
              <span>AFTER9 · Meet on the floor.</span>
              <span>Raipur</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
