import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dandiya } from "@/components/after9";
import {
  Sparkles,
  Ticket,
  Sliders,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Users,
  Compass,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/lib/after9";

export type DiscoveryStateType =
  "loading" | "zero_users" | "no_eligible_for_night" | "filters_restrictive" | "all_seen" | "error";

export type DiscoveryDiagnostics = {
  total_active_others: number;
  swiped_count: number;
  filter_match_count: number;
  eligible_unswiped: number;
  night_counts: Record<string, number>;
  my_nights_count: number;
  my_min_age: number;
  my_max_age: number;
  my_interested_in: string;
};

export function DiscoveryStateView({
  state,
  selectedNight,
  diagnostics,
  userProfile,
  onClearNight,
  onOpenInvite,
  onOpenShareCard,
  onRetry,
  onExpandFilters,
}: {
  state: DiscoveryStateType;
  selectedNight: number | null;
  diagnostics: DiscoveryDiagnostics | null;
  userProfile: ProfileRow | null;
  onClearNight: () => void;
  onOpenInvite: () => void;
  onOpenShareCard: () => void;
  onRetry: () => void;
  onExpandFilters?: (() => void) | undefined;
}) {
  switch (state) {
    case "loading":
      return <LoadingState />;

    case "zero_users":
      return (
        <ZeroUsersState
          onOpenInvite={onOpenInvite}
          onOpenShareCard={onOpenShareCard}
          userProfile={userProfile}
        />
      );

    case "no_eligible_for_night":
      return (
        <NoEligibleForNightState
          night={selectedNight ?? 1}
          onClearNight={onClearNight}
          onOpenInvite={onOpenInvite}
        />
      );

    case "filters_restrictive":
      return (
        <FiltersRestrictiveState
          diagnostics={diagnostics}
          onExpandFilters={onExpandFilters}
          onOpenInvite={onOpenInvite}
        />
      );

    case "all_seen":
      return (
        <AllSeenState
          swipedCount={diagnostics?.swiped_count ?? 0}
          onOpenInvite={onOpenInvite}
          onOpenShareCard={onOpenShareCard}
        />
      );

    case "error":
      return <ErrorState onRetry={onRetry} />;

    default:
      return null;
  }
}

/** 1. Loading Skeleton with Warm Editorial Shimmer */
function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center animate-fade-in min-h-[460px]">
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card via-card/70 to-card/40 p-6 shadow-sm">
        {/* Shimmer pulse */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
          </div>

          <div className="flex flex-col items-center gap-3 py-12">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-action/10 text-action">
              <Dandiya className="h-9 w-9 animate-pulse-gentle" />
            </div>
            <p className="font-display text-lg font-bold text-primary">Connecting to the floor…</p>
            <p className="text-xs text-muted-foreground">Finding Garba circles in Raipur</p>
          </div>

          <div className="space-y-2">
            <div className="h-4 w-3/4 rounded-sm bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded-sm bg-muted/60 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 2. Zero-Users Launch & Cold-Start Experience */
function ZeroUsersState({
  onOpenInvite,
  onOpenShareCard,
  userProfile,
}: {
  onOpenInvite: () => void;
  onOpenShareCard: () => void;
  userProfile: ProfileRow | null;
}) {
  const needsProfilePolish = !userProfile?.prompt || !userProfile?.photo_path;
  const needsNights =
    !userProfile?.nights ||
    (Array.isArray(userProfile.nights)
      ? userProfile.nights.length === 0
      : typeof userProfile.nights === "object"
        ? Object.values(userProfile.nights as Record<string, unknown>).every((v) => v === "off")
        : true);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in px-2 py-4">
      {/* Decorative Atmosphere Box */}
      <div className="w-full overflow-hidden rounded-3xl border border-action/40 bg-gradient-to-b from-card via-card to-action/5 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Emblem & Festival Badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-action/25 to-action/5 shadow-inner border border-action/30">
            <Dandiya className="h-10 w-10 text-action" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
              ✨
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-action/30 bg-action/10 px-3 py-1 text-[11px] font-bold text-action uppercase tracking-widest">
            <Compass className="h-3.5 w-3.5" />
            Raipur Navratri 2026
          </div>
        </div>

        {/* Copy as prescribed */}
        <div className="space-y-2.5 max-w-sm mx-auto">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary leading-tight">
            Your people are getting ready.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Be part of the first After9 crew. Invite your Garba friends and make your Navratri
            nights more social.
          </p>
        </div>

        {/* Real-time Launch Pulse */}
        <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-xs text-muted-foreground shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Floor opens live as dancers join</span>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 max-w-md mx-auto w-full">
          <button
            type="button"
            onClick={onOpenInvite}
            className="touch-tactile w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-action px-6 py-3.5 font-display text-base font-extrabold text-action-foreground shadow-md transition-all hover:opacity-95 active:scale-98"
          >
            <Ticket className="h-5 w-5" />
            <span>Invite your Garba crew</span>
          </button>
        </div>

        {/* Secondary Actions Grid - Adaptive 1-col on mobile, 3-col on tablet/desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-left">
          {/* Action 1: Complete profile */}
          <Link
            to="/profile"
            className="touch-tactile flex w-full min-h-[56px] items-center justify-between rounded-2xl border border-border bg-background/90 p-3.5 transition-all hover:border-action/50 hover:bg-muted/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                👤
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary truncate">Complete your profile</p>
                <p className="text-[11px] text-muted-foreground">
                  {needsProfilePolish
                    ? "Add photo & personality prompt"
                    : "Profile details verified"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          {/* Action 2: Choose Garba nights */}
          <Link
            to="/profile"
            className="touch-tactile flex w-full min-h-[56px] items-center justify-between rounded-2xl border border-border bg-background/90 p-3.5 transition-all hover:border-action/50 hover:bg-muted/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal font-bold text-sm">
                💃
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary truncate">Choose your Garba nights</p>
                <p className="text-[11px] text-muted-foreground">
                  {needsNights
                    ? "Pick which 9 nights you'll be on the floor"
                    : "Attendance nights locked in"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          {/* Action 3: Share After9 Story Card */}
          <button
            type="button"
            onClick={onOpenShareCard}
            className="touch-tactile flex w-full min-h-[56px] items-center justify-between rounded-2xl border border-border bg-background/90 p-3.5 text-left transition-all hover:border-action/50 hover:bg-muted/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-action/15 text-action font-bold text-sm">
                ✨
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary truncate">Share your After9 card</p>
                <p className="text-[11px] text-muted-foreground">
                  Post 1080 × 1920 Instagram Story & WhatsApp card
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 3. Selected Night has No Profiles */
function NoEligibleForNightState({
  night,
  onClearNight,
  onOpenInvite,
}: {
  night: number;
  onClearNight: () => void;
  onOpenInvite: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in p-4 sm:p-6 min-h-[400px]">
      <div className="w-full max-w-md md:max-w-xl rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-action/15 text-action">
          <Calendar className="h-7 w-7" />
        </div>

        <div className="space-y-1.5 max-w-sm mx-auto">
          <span className="inline-block rounded-full bg-action/15 px-3 py-0.5 text-[11px] font-bold text-action uppercase">
            Night {night}
          </span>
          <h2 className="font-display text-2xl font-extrabold text-primary">
            Nobody on the floor for Night {night} yet.
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dancers have selected other festival nights! Check the full lineup or rally your friends
            specifically for Night {night}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 max-w-md mx-auto">
          <button
            type="button"
            onClick={onClearNight}
            className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98"
          >
            <span>Show all festival nights</span>
          </button>

          <button
            type="button"
            onClick={onOpenInvite}
            className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-action/40 bg-action/10 px-4 py-2.5 text-xs font-bold text-action transition hover:bg-action/20 active:scale-98"
          >
            <Ticket className="h-4 w-4" />
            <span>Invite friends for Night {night}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** 4. Filters Too Restrictive */
function FiltersRestrictiveState({
  diagnostics,
  onExpandFilters,
  onOpenInvite,
}: {
  diagnostics: DiscoveryDiagnostics | null;
  onExpandFilters?: (() => void) | undefined;
  onOpenInvite: () => void;
}) {
  const total = diagnostics?.total_active_others ?? 0;
  const minAge = diagnostics?.my_min_age ?? 18;
  const maxAge = diagnostics?.my_max_age ?? 60;
  const pref = diagnostics?.my_interested_in ?? "everyone";

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in p-4 sm:p-6 min-h-[400px]">
      <div className="w-full max-w-md md:max-w-xl rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sliders className="h-7 w-7" />
        </div>

        <div className="space-y-1.5 max-w-sm mx-auto">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-bold text-primary uppercase">
            Filter Range
          </span>
          <h2 className="font-display text-2xl font-extrabold text-primary">
            No one matches your filters.
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {total > 0 ? (
              <>
                There are <b className="text-foreground">{total} active dancers</b> in Raipur, but
                none match your age range (
                <b>
                  {minAge}–{maxAge}
                </b>
                ) or preference (<b>{pref}</b>).
              </>
            ) : (
              "Try expanding your age range or preference settings to connect with more dancers."
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 max-w-md mx-auto">
          {onExpandFilters ? (
            <button
              type="button"
              onClick={onExpandFilters}
              className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98"
            >
              <span>Widen age & preference</span>
            </button>
          ) : (
            <Link
              to="/profile"
              className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98"
            >
              <span>Edit filters in Profile</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onOpenInvite}
            className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground active:scale-98"
          >
            <Ticket className="h-4 w-4" />
            <span>Invite your Garba circle</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** 5. User Has Seen All Eligible Profiles */
function AllSeenState({
  swipedCount,
  onOpenInvite,
  onOpenShareCard,
}: {
  swipedCount: number;
  onOpenInvite: () => void;
  onOpenShareCard: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in p-4 sm:p-6 min-h-[400px]">
      <div className="w-full max-w-md md:max-w-xl rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/15 text-teal">
          <CheckCircle2 className="h-7 w-7" />
        </div>

        <div className="space-y-1.5 max-w-sm mx-auto">
          <span className="inline-block rounded-full bg-teal/15 px-3 py-0.5 text-[11px] font-bold text-teal uppercase">
            All Caught Up
          </span>
          <h2 className="font-display text-2xl font-extrabold text-primary">
            You're all caught up for now.
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You've connected with or passed on all {swipedCount > 0 ? swipedCount : "matching"}{" "}
            dancers in Raipur right now. New dancers join every evening before 9 PM.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 max-w-md mx-auto">
          <button
            type="button"
            onClick={onOpenInvite}
            className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-3 text-xs font-bold text-action-foreground shadow-xs transition hover:opacity-90 active:scale-98"
          >
            <Ticket className="h-4 w-4" />
            <span>Invite more dancers to Raipur</span>
          </button>

          <Link
            to="/matches"
            className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-primary transition hover:bg-muted active:scale-98"
          >
            <span>View your Clashes & Chats →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 6. Network or Server Error with Recoverable UI */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in p-6 min-h-[420px]">
      <div className="w-full max-w-sm rounded-3xl border border-destructive/30 bg-card p-6 shadow-xs space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-extrabold text-primary">
            Couldn't reach the festival floor.
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We couldn't connect to the server right now. Check your internet connection or tap retry
            below.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={retrying}
            onClick={handleRetry}
            className="touch-tactile w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
            <span>{retrying ? "Reconnecting…" : "Try again"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
