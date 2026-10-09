import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Users,
  Ticket,
  Copy,
  Check,
  Share2,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { NIGHTS, goingNights, type ProfileRow } from "@/lib/after9";
import { useAuthoritativeInvites } from "@/lib/invites";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface EarlyCommunityViewProps {
  userProfile: ProfileRow | null;
  readinessTarget: number;
  completedProfilesCount: number;
  totalRegisteredUsers: number;
  nightCounts: Record<string, number>;
  cityCounts: Record<string, number>;
  onOpenInviteModal: () => void;
  onProfileUpdated?: () => void;
}

export function EarlyCommunityView({
  userProfile,
  readinessTarget = 50,
  completedProfilesCount = 0,
  totalRegisteredUsers = 0,
  nightCounts = {},
  cityCounts = {},
  onOpenInviteModal,
  onProfileUpdated,
}: EarlyCommunityViewProps) {
  const { primaryCode, availableCount, totalAllocation, status: inviteStatus } = useAuthoritativeInvites();
  const [copied, setCopied] = useState(false);
  const [savingNight, setSavingNight] = useState<number | null>(null);

  // Active nights for current user
  const userNights = userProfile ? goingNights(userProfile.nights) : [];

  const handleCopyLink = async () => {
    if (!primaryCode) {
      onOpenInviteModal();
      return;
    }
    const url = `${window.location.origin}/?invite=${primaryCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Personal invite link copied! 📋");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleWhatsAppShare = () => {
    if (!primaryCode) {
      onOpenInviteModal();
      return;
    }
    const url = `${window.location.origin}/?invite=${primaryCode}`;
    const text = `Hey! Join me on After9 for Navratri & Garba nights in Raipur. Claim your community invite here: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

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

  // Calculate real progress towards readiness target
  const target = Math.max(1, readinessTarget);
  const currentReady = Math.max(0, completedProfilesCount);
  const progressPercent = Math.min(100, Math.round((currentReady / target) * 100));

  // Determine top night participation
  const topNightEntries = Object.entries(nightCounts)
    .filter(([_, cnt]) => cnt > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 pb-12 pt-4">
      {/* Hero Badge */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-action/30 bg-action/10 px-3.5 py-1 text-xs font-bold text-action shadow-2xs">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>EARLY COMMUNITY FORMATION PHASE</span>
        </div>

        <h1 className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">
          Your Garba crew starts here.
        </h1>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Invite your friends to After9. We're bringing the right people together for better Garba nights in Raipur. Matchmaking unlocks once the community is ready.
        </p>
      </div>

      {/* Real Community Readiness Indicator */}
      <div className="rounded-2xl border border-action/40 bg-gradient-to-br from-card via-card to-action/5 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/20 text-action">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-action">COMMUNITY READINESS</p>
              <h2 className="font-display text-base font-extrabold text-primary">
                {currentReady} of {target} Members Ready
              </h2>
            </div>
          </div>
          <span className="rounded-full bg-action/15 px-3 py-1 text-xs font-extrabold text-action">
            {progressPercent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-action to-primary transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
            <span>{currentReady} profiles complete</span>
            <span>Launch target: {target}</span>
          </div>
        </div>

        {/* Raipur & Top Night Stats (Real Data Only) */}
        {topNightEntries.length > 0 && (
          <div className="rounded-xl border border-border/80 bg-background/60 p-3 space-y-1.5">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              POPULAR NIGHTS SO FAR (RAIPUR)
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {topNightEntries.map(([nightKey, count]) => (
                <span
                  key={nightKey}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  <Calendar className="h-3 w-3 text-action" />
                  Night {nightKey}: <b>{count} going</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Primary Actions: Invite Crew */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Ticket className="h-4 w-4" />
            </span>
            <h3 className="font-display text-sm font-bold text-primary">Invite Your Friends</h3>
          </div>
          <span className="text-[11px] font-bold text-muted-foreground">
            {inviteStatus === "loading" ? "Loading..." : `${availableCount} of ${totalAllocation} left`}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Each member receives personal invitation passes. Share your link directly on WhatsApp or copy it to bring your college and Garba circle in.
        </p>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-primary transition hover:bg-muted active:scale-95"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Invite Link"}</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95 shadow-xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share on WhatsApp</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenInviteModal}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-action px-3 py-2.5 text-xs font-bold text-action-foreground transition hover:opacity-90 active:scale-95"
        >
          <span>Open Full Invite Pass & QR Card</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Select Your Garba Nights (Quick Setup) */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-primary">Select Your Garba Nights</h3>
              <p className="text-[11px] text-muted-foreground">Tap the nights you plan to play in Raipur</p>
            </div>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-primary">
            {userNights.length} of 9
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NIGHTS.map((n) => {
            const isGoing = userNights.includes(n.n);
            const isSaving = savingNight === n.n;
            return (
              <button
                key={n.n}
                type="button"
                disabled={isSaving}
                onClick={() => toggleNight(n.n)}
                className={cn(
                  "touch-tactile flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all",
                  isGoing
                    ? "border-action bg-action/15 text-primary font-bold shadow-2xs"
                    : "border-border/70 bg-background text-muted-foreground hover:border-primary/40",
                  isSaving && "opacity-50"
                )}
              >
                <span className="text-xs font-extrabold">Night {n.n}</span>
                <span className="text-[10px] opacity-75">{n.date}</span>
                {isGoing && <CheckCircle2 className="h-3 w-3 text-action mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Complete Profile Action */}
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-muted/40 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-primary">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </span>
          <div>
            <p className="text-xs font-bold text-primary">Profile & Verified Photo</p>
            <p className="text-[11px] text-muted-foreground">
              {userProfile?.verification_status === "approved"
                ? "Verified & ready for launch"
                : "Complete all fields to get verified"}
            </p>
          </div>
        </div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 rounded-xl bg-background border border-border px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-muted"
        >
          <span>Edit Profile</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
