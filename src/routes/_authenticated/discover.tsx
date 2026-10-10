import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback } from "react";
import { AppIcon, BottomNav, Btn, ChatIcon, Dandiya, Shell, Wordmark } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { checkAdminStatus, toggleAdminDiscoverLaunch } from "@/lib/admin.functions";
import {
  FESTIVAL,
  NIGHTS,
  QUIZ,
  goingNights,
  shared,
  useMyProfile,
  usePhotoUrls,
  vibe,
  ageFrom,
  type FeedRow,
  type ProfileRow,
} from "@/lib/after9";
import { cn } from "@/lib/utils";
import { InviteShareModal } from "@/components/invite-share-modal";
import { ShareCardStudio } from "@/components/share-card-studio";
import type { CardCustomization } from "@/lib/share-cards";
import { getMySocialLinks, type SocialLinkRow } from "@/lib/social-links";
import {
  DiscoveryStateView,
  type DiscoveryStateType,
  type DiscoveryDiagnostics,
} from "@/components/discovery-states";
import { Analytics } from "@/lib/launch-analytics";
import { toast } from "sonner";
import { NotificationBell } from "@/components/notifications-popover";
import { EarlyCommunityView } from "@/components/early-community-view";
import { MatchCommunicationScreen } from "@/components/match-communication-screen";
import { FestiveConfetti } from "@/components/festive-confetti";
import { playDandiyaClackSound, playCelebrationChime } from "@/lib/sound-effects";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover — After9" },
      { name: "description", content: "See who's going to the same Garba nights as you." },
      { property: "og:title", content: "Discover — After9" },
      { property: "og:description", content: "See who's going to the same Garba nights as you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Discover,
});

function Discover() {
  const { p: me, loading } = useMyProfile();
  const nav = useNavigate();
  const [feed, setFeed] = useState<FeedRow[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiscoveryDiagnostics | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [night, setNight] = useState<number | null>(null);
  const [clash, setClash] = useState<FeedRow | null>(null);
  const [fly, setFly] = useState<0 | 1 | -1>(0);
  const [dragRatio, setDragRatio] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [shareStudioOpen, setShareStudioOpen] = useState(false);
  const [socials, setSocials] = useState<SocialLinkRow[]>([]);
  const [launchControl, setLaunchControl] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToggling, setAdminToggling] = useState(false);
  const [easterEggConfetti, setEasterEggConfetti] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  const checkAdmin = useServerFn(checkAdminStatus);
  const toggleLaunch = useServerFn(toggleAdminDiscoverLaunch);

  useEffect(() => {
    checkAdmin()
      .then((res) => setIsAdmin(Boolean(res?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [checkAdmin]);

  const handleAdminToggleLaunch = async () => {
    setAdminToggling(true);
    try {
      const nextState = !launchControl?.discover_enabled;
      await toggleLaunch({ data: { enabled: nextState } });
      toast.success(
        nextState
          ? "Discover is now LIVE globally for all members! 🚀"
          : "Discover paused — waiting room active.",
      );
      loadDiscoveryData();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle Discover state");
    } finally {
      setAdminToggling(false);
    }
  };

  useEffect(() => {
    if (me) setHidden(!me.discoverable);
  }, [me]);

  const toggleHidden = async () => {
    if (!me) return;
    const nextHidden = !hidden;
    setHidden(nextHidden);
    await supabase.from("profiles").update({ discoverable: !nextHidden }).eq("id", me.id);
    setNote(
      nextHidden
        ? "Hide me from Discover is ON — you're immediately hidden from new discovery results."
        : "Hide me from Discover is OFF — you're discoverable by your chosen audience.",
    );
    loadDiscoveryData();
  };

  const loadDiscoveryData = useCallback(async () => {
    setFeedLoading(true);
    setFeedError(false);
    try {
      const [feedRes, diagRes, launchRes] = await Promise.all([
        supabase.rpc("discover_feed"),
        supabase.rpc("discover_diagnostics"),
        supabase.rpc("get_launch_control"),
      ]);

      if (feedRes.error) throw feedRes.error;
      const returnedCandidates = feedRes.data ?? [];
      setFeed(returnedCandidates);

      // Instrument real, tamper-resistant impressions across eligible candidate set
      if (returnedCandidates.length > 0) {
        const batchToken = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        Promise.resolve(
          supabase.rpc("record_discovery_impressions", {
            p_profile_ids: returnedCandidates.map((x) => x.id),
            p_batch_id: batchToken,
          })
        ).catch(() => {});
      }

      if (diagRes.data && typeof diagRes.data === "object" && !("error" in diagRes.data)) {
        setDiagnostics(diagRes.data as unknown as DiscoveryDiagnostics);
      }

      if (launchRes.data && typeof launchRes.data === "object") {
        setLaunchControl(launchRes.data);
      }
    } catch (err) {
      console.error("[Discover] data fetch error:", err);
      setFeedError(true);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscoveryData();

    // Real-time synchronization: listen for admin launch control events (e.g. Discover going live)
    // Exclude global wildcard on `profiles` table to eliminate thundering herd storms across connected clients
    const channel = supabase
      .channel("discover_launch_control")
      .on("postgres_changes", { event: "*", schema: "public", table: "launch_control" }, (payload: any) => {
        if (payload?.new?.discover_enabled) {
          toast.success("🎉 Discover matching is now LIVE! Start swiping to find your Garba crew.");
        }
        loadDiscoveryData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDiscoveryData]);

  useEffect(() => {
    if (me?.id) {
      getMySocialLinks(me.id).then(setSocials);
    }
  }, [me?.id]);

  useEffect(() => {
    if (!loading && me && !me.onboarded) nav({ to: "/onboarding" });
  }, [loading, me, nav]);

  useEffect(() => {
    const ref = localStorage.getItem("after9.ref");
    if (ref)
      supabase
        .rpc("log_card_open", { _kind: "story_join", _ref: ref })
        .then(() => localStorage.removeItem("after9.ref"));
  }, []);

  // Candidates returned by discover_feed() are adaptively balanced and scored on the server
  // Filter by selected Garba night while preserving the balanced candidate order
  const deck = (feed ?? []).filter((x) => (night ? goingNights(x.nights).includes(night) : true));
  const [top, second] = deck;

  const cardUrls = usePhotoUrls(deck.slice(0, 3).map((d) => d.photo_path));
  const myPhotoUrls = usePhotoUrls([me?.photo_path]);

  // Determine explicit discovery state
  let discoveryState: DiscoveryStateType | "normal";

  if (feedLoading || loading) {
    discoveryState = "loading";
  } else if (feedError) {
    discoveryState = "error";
  } else if (deck.length > 0) {
    discoveryState = "normal";
  } else if (night !== null && (feed?.length ?? 0) > 0) {
    discoveryState = "no_eligible_for_night";
  } else if (diagnostics) {
    if (diagnostics.total_active_others === 0) {
      discoveryState = "zero_users";
    } else if (diagnostics.filter_match_count === 0) {
      discoveryState = "filters_restrictive";
    } else if (diagnostics.swiped_count > 0 && diagnostics.eligible_unswiped === 0) {
      discoveryState = "all_seen";
    } else {
      discoveryState = "zero_users";
    }
  } else {
    discoveryState = "zero_users";
  }

  // Track launch analytics when discovery screen/state resolves
  useEffect(() => {
    if (!feedLoading && discoveryState) {
      Analytics.discoveryOpened(discoveryState, deck.length, night);
      if (deck.length > 0) {
        Analytics.eligibleReturned(deck.length);
      }
    }
  }, [discoveryState, deck.length, night, feedLoading]);

  const selectNight = (n: number | null) => {
    setNight(n);
    Analytics.nightSelected(n);
  };

  const handleQuickExpandFilters = async () => {
    if (!me) return;
    try {
      await supabase
        .from("profiles")
        .update({
          min_age: 18,
          max_age: 60,
          interested_in: "everyone",
        })
        .eq("id", me.id);
      toast.success("Filters widened: everyone, ages 18–60");
      await loadDiscoveryData();
    } catch {
      toast.error("Could not update filters");
    }
  };

  const act = async (dir: "send" | "pass", openChat = false) => {
    if (!top || !me || fly) return;
    Analytics.dandiyaSent(dir);
    if (dir === "send") {
      playDandiyaClackSound();
    }
    setFly(dir === "send" ? 1 : -1);
    setDragRatio(dir === "send" ? 1 : -1);
    await new Promise((r) => setTimeout(r, 260));
    setFeed((f) => (f ?? []).filter((x) => x.id !== top.id));
    setFly(0);
    setDragRatio(0);
    await supabase.from("dandiyas").insert({ from_id: me.id, to_id: top.id, kind: dir });
    if (dir === "send") {
      const { data } = await supabase.rpc("is_match", { a: me.id, b: top.id });
      if (data) {
        Analytics.matchCreated();
        setClash(top);
      } else if (openChat) {
        setNote(
          `Dandiya sent. Your connection with ${top.first_name} opens the moment they send one back.`,
        );
      }
    }
  };

  const hideFrom = async () => {
    if (!top || !me) return;
    const t = top;
    setFeed((f) => (f ?? []).filter((x) => x.id !== t.id));
    await supabase
      .from("blocks")
      .insert({ blocker_id: me.id, blocked_id: t.id, reason: "hidden", report: false });
    setNote(`Hidden. ${t.first_name} won't see your name, college or photo.`);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") act("send");
      if (e.key === "ArrowLeft") act("pass");
      if (e.key === " " && top) {
        e.preventDefault();
        act("send", true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const handleLogoTap = () => {
    const nextCount = logoTaps + 1;
    setLogoTaps(nextCount);
    playDandiyaClackSound();
    if (nextCount >= 5) {
      setLogoTaps(0);
      setEasterEggConfetti(true);
      playCelebrationChime();
      toast.success("✨ Garba Night Easter Egg unlocked! Have an electric Navratri in Raipur! 🪘", {
        duration: 3500,
      });
    }
  };

  return (
    <Shell maxWidth="wide">
      {easterEggConfetti && (
        <FestiveConfetti
          count={80}
          durationMs={2800}
          onComplete={() => setEasterEggConfetti(false)}
        />
      )}
      <header className="mx-auto flex w-full max-w-md md:max-w-4xl lg:max-w-5xl items-center justify-between px-5 pb-3 pt-5">
        <button
          type="button"
          onClick={handleLogoTap}
          className="flex items-center gap-2 text-left touch-tactile transition-transform hover:scale-[1.03] active:scale-95"
          title="After9 Dandiya Deck"
        >
          <AppIcon className="h-8 w-8 transition-transform group-hover:rotate-6" />
          <Wordmark className="text-2xl text-primary" />
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              to="/admin"
              className="flex min-h-[36px] items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-black text-primary transition hover:bg-primary hover:text-primary-foreground active:scale-95 shadow-2xs"
              title="Open Admin Control Center"
            >
              <span>👑</span>
              <span>Admin</span>
            </Link>
          )}
          <NotificationBell userId={me?.id} />
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="flex min-h-[36px] items-center gap-1 rounded-full border border-action/50 bg-action/10 px-3 py-1 text-xs font-bold text-action transition hover:bg-action/20 active:scale-95 shadow-2xs"
            title="Invite Friends to After9"
          >
            <span>🎟️</span>
            <span>Invites</span>
          </button>
          <p className="text-right text-xs text-muted-foreground animate-rise [animation-delay:60ms]">
            {FESTIVAL.name} {FESTIVAL.year}
            <br />
            {me ? goingNights(me.nights).length : 0} of 9 nights
          </p>
        </div>
      </header>

      {/* Admin Launch Control Bar (Only rendered for authorized admins) */}
      {isAdmin && (
        <div className="mx-auto w-full max-w-md md:max-w-4xl lg:max-w-5xl px-5 pt-1 pb-3">
          <div
            className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition ${
              launchControl?.discover_enabled
                ? "border-teal-500/40 bg-teal-500/10 text-teal-950 dark:text-teal-100"
                : "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white text-base font-bold shadow-xs">
                👑
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-foreground">
                    Admin Launch Control: Discover is{" "}
                    {launchControl?.discover_enabled ? "🟢 LIVE" : "🟡 PAUSED"}
                  </span>
                  <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border/60">
                    {launchControl?.completed_profiles_count ?? 0} /{" "}
                    {launchControl?.readiness_target ?? 50} profiles ready
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {launchControl?.discover_enabled
                    ? "Members have full access to profile feeds and Dandiya matching."
                    : "Members currently see the waiting room. You can launch or pause Discover anytime."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                disabled={adminToggling}
                onClick={handleAdminToggleLaunch}
                className={`rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-xs transition ${
                  launchControl?.discover_enabled
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                {adminToggling
                  ? "Updating…"
                  : launchControl?.discover_enabled
                  ? "Pause Discover"
                  : "Launch Discover Globally 🚀"}
              </button>
              <Link
                to="/admin"
                className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted shadow-xs transition"
              >
                Admin Center →
              </Link>
            </div>
          </div>
        </div>
      )}

      {launchControl && !launchControl.discover_enabled ? (
        <EarlyCommunityView
          userProfile={me}
          onOpenInviteModal={() => setInviteModalOpen(true)}
          onOpenShareCard={() => setShareStudioOpen(true)}
          onProfileUpdated={loadDiscoveryData}
        />
      ) : (
        <>
          <div className="mx-auto w-full max-w-md md:max-w-4xl lg:max-w-5xl px-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Invite Friends Banner */}
          <div className="flex items-center justify-between rounded-xl border border-action/40 bg-gradient-to-r from-action/10 via-card to-card p-3 shadow-xs min-h-[56px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-action/20 text-lg">
                🎟️
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary">Invite Friends to After9</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Connect directly with campus & festival friends
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="touch-tactile shrink-0 min-h-[36px] rounded-lg bg-action px-3 py-1.5 text-xs font-bold text-action-foreground shadow-xs transition hover:opacity-90 active:scale-95"
            >
              Invite ↗
            </button>
          </div>

          {/* Hide me from Discover switch */}
          <button
            onClick={toggleHidden}
            aria-pressed={!!hidden}
            className="touch-tactile flex min-h-[56px] w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-sm transition-all hover:border-primary/40 active:scale-[0.99]"
          >
            <span className="min-w-0 pr-2">
              <b>Hide me from Discover</b>
              <br />
              <span className="text-xs text-muted-foreground block truncate">
                {hidden
                  ? "Your profile is hidden from new discovery results"
                  : "Discoverable by your chosen audience"}
              </span>
            </span>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                hidden ? "bg-action" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-xs transition-transform duration-200",
                  hidden ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </div>

        {me &&
          ((me as any).visibility_audiences?.includes("only_me") ||
            !(me as any).visibility_audiences?.length) && (
            <Link
              to="/profile"
              className="animate-scale-in mb-3 block w-full rounded-sm border-l-2 border-action bg-card px-3 py-2 text-sm transition-opacity hover:opacity-85"
            >
              <b>Discovery set to Only Me.</b> Your profile will not appear on Discover until you
              choose an audience. Tap to change →
            </Link>
          )}

        {note && (
          <button
            onClick={() => setNote(null)}
            className="animate-scale-in mb-3 block w-full rounded-sm border-l-2 border-teal bg-card px-3 py-2 text-left text-sm transition-opacity hover:opacity-80"
          >
            {note}
          </button>
        )}

        {me && me.verification_status !== "approved" && (
          <Link
            to="/profile"
            className={cn(
              "animate-scale-in mb-3 block w-full rounded-sm border-l-2 px-3 py-2 text-sm transition-opacity hover:opacity-85",
              me.verification_status === "rejected"
                ? "border-destructive bg-card"
                : "border-action bg-card",
            )}
          >
            {me.verification_status === "rejected" ? (
              <>
                <b>Your profile isn't live.</b> {me.verification_reason} Tap to fix.
              </>
            ) : (
              <>
                <b>Checking your profile…</b> Others will see you once it's approved.
              </>
            )}
          </Link>
        )}
      </div>

      <div className="no-scrollbar mx-auto flex w-full max-w-md md:max-w-4xl lg:max-w-5xl gap-2 overflow-x-auto md:flex-wrap md:justify-center md:overflow-visible px-5 pb-4">
        <Chip on={night === null} onClick={() => selectNight(null)}>
          All nights
        </Chip>
        {NIGHTS.map((n) => (
          <Chip
            key={n.n}
            on={night === n.n}
            dim={!!me && !goingNights(me.nights).includes(n.n)}
            onClick={() => selectNight(n.n)}
          >
            Night {n.n}
          </Chip>
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-md md:max-w-4xl lg:max-w-5xl flex-1 flex-col px-5 pb-20 md:pb-28">
        {discoveryState === "normal" && top ? (
          <>
            {deck.length <= 3 && (
              <div className="mb-3 text-center animate-fade-in">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-action/30 bg-action/10 px-3.5 py-1 text-xs font-bold text-action shadow-2xs">
                  <span>✨</span>
                  <span>Your Garba circle is growing. Try another night.</span>
                </span>
              </div>
            )}
            <div className="md:grid md:grid-cols-12 md:gap-8 md:items-start">
            {/* Stage (Left Column) */}
            <div className="flex flex-col md:col-span-6 lg:col-span-6">
              <div className="relative flex flex-1 min-h-[380px] sm:min-h-[440px] max-h-[min(640px,calc(100dvh-230px))]">
                {second && (
                  <div
                    className="absolute inset-0 origin-bottom overflow-hidden rounded-sm bg-card border border-border/40 shadow-xs transition-all duration-200 ease-[var(--ease-out-quint)]"
                    style={{
                      transform: `translateY(${Math.max(0, 8 - 8 * Math.abs(dragRatio))}px) scale(${0.96 + 0.04 * Math.abs(dragRatio)})`,
                      opacity: 0.65 + 0.35 * Math.abs(dragRatio),
                    }}
                  >
                    {second.photo_path && cardUrls[second.photo_path] && (
                      <img
                        src={cardUrls[second.photo_path]}
                        alt=""
                        className="h-full w-full object-cover opacity-50"
                      />
                    )}
                  </div>
                )}
                <Card
                  key={top.id}
                  p={top}
                  url={top.photo_path ? cardUrls[top.photo_path] : undefined}
                  sharedCount={me ? shared(me.nights, top.nights).length : 0}
                  fly={fly}
                  onDragRatio={setDragRatio}
                  onSwipe={act}
                  onChat={() => act("send", true)}
                  onHide={hideFrom}
                />
              </div>

              {/* Action buttons below card */}
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-3">
                  <Btn
                    variant="outline"
                    className="flex-1 touch-tactile min-h-[50px]"
                    onClick={() => act("pass")}
                  >
                    Pass
                  </Btn>
                  <Btn
                    className="group flex-[2] touch-tactile min-h-[50px]"
                    onClick={() => act("send")}
                  >
                    <Dandiya className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
                    <span>Send Dandiya</span>
                  </Btn>
                </div>
                <div className="hidden md:flex items-center justify-center gap-5 pt-1 text-xs text-muted-foreground/80 font-mono">
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-xs">
                      ←
                    </kbd>{" "}
                    Pass
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-xs">
                      →
                    </kbd>{" "}
                    Dandiya
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-xs">
                      Space
                    </kbd>{" "}
                    Chat
                  </span>
                </div>
              </div>
            </div>

            {/* Tablet & Desktop Floor Dossier (Right Column) */}
            <div className="hidden md:block md:col-span-6 lg:col-span-6">
              <FloorDossier
                p={top}
                me={me}
                sharedCount={me ? shared(me.nights, top.nights).length : 0}
                onAct={act}
                onChat={() => act("send", true)}
                onHide={hideFrom}
              />
            </div>
          </div>
        </>
        ) : (
          <DiscoveryStateView
            state={discoveryState === "normal" ? "zero_users" : discoveryState}
            selectedNight={night}
            diagnostics={diagnostics}
            userProfile={me}
            onClearNight={() => selectNight(null)}
            onOpenInvite={() => setInviteModalOpen(true)}
            onOpenShareCard={() => setShareStudioOpen(true)}
            onRetry={loadDiscoveryData}
            onExpandFilters={handleQuickExpandFilters}
          />
        )}
      </main>
      </>
      )}

      <BottomNav />

      {clash && me && (
        <MatchCommunicationScreen
          partner={clash}
          myId={me.id}
          myNights={me.nights}
          onClose={() => setClash(null)}
          onOpenChat={() => {
            const cid = clash.id;
            setClash(null);
            nav({ to: "/chat/$id", params: { id: cid } });
          }}
          mode="fullscreen"
        />
      )}

      <InviteShareModal open={inviteModalOpen} onOpenChange={setInviteModalOpen} userProfile={me} />

      {me && (
        <ShareCardStudio
          open={shareStudioOpen}
          onOpenChange={setShareStudioOpen}
          cardData={{
            photoUrl: me.photo_path ? (myPhotoUrls[me.photo_path] ?? null) : null,
            name: me.first_name ?? "Me",
            age: me.birth_date ? ageFrom(me.birth_date) : null,
            college: me.show_college ? (me.college ?? null) : null,
            branch: me.show_college ? (me.branch ?? null) : null,
            prompt: me.prompt ?? null,
            nights: goingNights(me.nights),
            shareUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/p/${me.share_token}`,
          }}
          socialLinks={socials}
          savedPreferences={(me.card_preferences as Partial<CardCustomization> | null) ?? null}
          userId={me.id}
        />
      )}
    </Shell>
  );
}

function Chip({
  on,
  dim,
  children,
  onClick,
}: {
  on: boolean;
  dim?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "touch-tactile shrink-0 min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-95 hover:scale-[1.02]",
        on
          ? "border-primary bg-primary text-primary-foreground shadow-xs"
          : "border-border hover:border-primary/40",
        !on && dim && "text-muted-foreground opacity-60",
      )}
    >
      {children}
    </button>
  );
}

function FloorDossier({
  p,
  me,
  sharedCount,
  onAct,
  onChat,
  onHide,
}: {
  p: FeedRow;
  me: ProfileRow | null;
  sharedCount: number;
  onAct: (d: "send" | "pass") => void;
  onChat: () => void;
  onHide: () => void;
}) {
  const vibeScore = me ? vibe(me.quiz, me.nights, p) : 0;
  const sharedNights = me ? shared(me.nights, p.nights) : [];
  const dancerNights = goingNights(p.nights);
  const pQuiz = (p.quiz ?? {}) as Record<string, string>;
  const myQuiz = (me?.quiz ?? {}) as Record<string, string>;

  return (
    <aside className="hidden md:flex flex-col gap-4 rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm backdrop-blur-xs animate-fade-in">
      {/* Dancer Header & Vibe Badge */}
      <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              {p.first_name}, {p.age}
            </h2>
            <span className="inline-flex items-center rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-bold text-teal">
              Verified
            </span>
          </div>
          {p.college && (
            <p className="mt-0.5 text-xs text-muted-foreground font-medium">
              {p.college}
              {p.branch ? ` · ${p.branch}` : ""}
            </p>
          )}
        </div>

        {/* Dynamic Festival Vibe Score */}
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-action/30 bg-action/10 px-3 py-1 text-xs font-bold text-action">
            <span>✨</span>
            <span>Vibe: {vibeScore}</span>
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">
            {sharedCount > 0
              ? `${sharedCount} mutual night${sharedCount > 1 ? "s" : ""}`
              : "Festival explorer"}
          </span>
        </div>
      </div>

      {/* Prompt Quote (if available) */}
      {p.prompt && (
        <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-2xs">
          <p className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
            Garba night isn't complete without…
          </p>
          <p className="italic text-sm text-foreground/90">"{p.prompt}"</p>
        </div>
      )}

      {/* 9-Night Festival Attendance Schedule */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Navratri Schedule
          </p>
          <span className="text-[11px] font-semibold text-teal">
            {dancerNights.length} of 9 nights
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {NIGHTS.map((n) => {
            const isShared = sharedNights.includes(n.n);
            const isDancerGoing = dancerNights.includes(n.n);
            return (
              <div
                key={n.n}
                className={cn(
                  "flex flex-col rounded-xl border p-2 text-center text-xs transition",
                  isShared
                    ? "border-action bg-action/15 text-primary font-bold shadow-2xs ring-1 ring-action/40"
                    : isDancerGoing
                      ? "border-teal/40 bg-teal/5 text-foreground font-medium"
                      : "border-border/50 bg-muted/30 text-muted-foreground opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px]">Night {n.n}</span>
                  {isShared ? (
                    <span className="text-[10px]" title="Both going!">
                      ✨
                    </span>
                  ) : isDancerGoing ? (
                    <span className="text-[9px] text-teal font-semibold">Going</span>
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">{n.date}</span>
                {isShared && (
                  <span className="text-[9px] font-bold text-action mt-0.5 uppercase tracking-tight">
                    Both on floor
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Garba Personality & Energy Badges */}
      {QUIZ.some((q) => pQuiz[q.key]) && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Garba Personality
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {QUIZ.map((q) => {
              const ans = pQuiz[q.key];
              if (!ans) return null;
              const isMatch = myQuiz[q.key] === ans;
              return (
                <div
                  key={q.key}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-xs",
                    isMatch
                      ? "border-teal/50 bg-teal/10 text-teal font-semibold"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <span className="text-muted-foreground font-medium">{q.q}</span>
                  <span className={cn("font-bold", isMatch ? "text-teal" : "text-foreground")}>
                    {ans} {isMatch && "✓ Match"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop Direct Connect Bar */}
      <div className="mt-auto flex flex-col gap-2.5 border-t border-border/60 pt-4">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => onAct("pass")}
            className="touch-tactile flex-1 min-h-[44px] flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-muted-foreground transition hover:border-primary/40 hover:text-foreground active:scale-98"
          >
            Pass (←)
          </button>
          <button
            type="button"
            onClick={onChat}
            className="touch-tactile flex-[2] min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-action px-5 py-2.5 text-xs font-extrabold text-action-foreground shadow-sm transition hover:opacity-95 active:scale-98"
          >
            <ChatIcon className="h-4 w-4" />
            <span>Direct Chat (Space)</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="text-center text-[11px] text-muted-foreground hover:text-destructive transition py-1"
        >
          Hide my profile from {p.first_name}
        </button>
      </div>
    </aside>
  );
}

function Card({
  p,
  url,
  sharedCount,
  fly,
  onDragRatio,
  onSwipe,
  onChat,
  onHide,
}: {
  p: FeedRow;
  url?: string | undefined;
  sharedCount: number;
  fly: 0 | 1 | -1;
  onDragRatio?: (r: number) => void;
  onSwipe: (d: "send" | "pass") => void;
  onChat: () => void;
  onHide: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef({ x: 0, t: 0 });

  const end = (x: number) => {
    const v = (x - start.current.x) / Math.max(1, Date.now() - start.current.t);
    setDrag(false);
    if (dx > 105 || v > 0.55) {
      onSwipe("send");
    } else if (dx < -105 || v < -0.55) {
      onSwipe("pass");
    } else {
      setDx(0);
      onDragRatio?.(0);
    }
  };

  const x = fly ? fly * 580 : dx;
  const clampedTilt = Math.min(16, Math.max(-16, x / 18));
  const strength = Math.min(1, Math.abs(dx) / 105);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const currentDx = e.clientX - start.current.x;
    setDx(currentDx);
    onDragRatio?.(Math.min(1, Math.max(-1, currentDx / 105)));
  };

  return (
    <article
      className="relative z-10 flex flex-1 touch-pan-y select-none flex-col rounded-sm bg-card shadow-sm border border-border/40 will-change-transform cursor-grab active:cursor-grabbing"
      style={{
        transform: `translateX(${x}px) rotate(${clampedTilt}deg)`,
        transition: drag ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onPointerDown={(e) => {
        setDrag(true);
        start.current = { x: e.clientX - dx, t: Date.now() };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => end(e.clientX)}
      onPointerCancel={() => {
        setDrag(false);
        setDx(0);
        onDragRatio?.(0);
      }}
    >
      <div className="relative flex-1 overflow-hidden bg-muted">
        {url && (
          <img
            src={url}
            alt={p.first_name ?? ""}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300"
          />
        )}

        {/* DANDIYA Stamp with Pop Animation */}
        <div
          style={{ opacity: dx > 0 ? strength : 0 }}
          className={cn(
            "pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-sm bg-action px-3.5 py-1.5 font-display text-sm font-bold text-action-foreground shadow-md transition-transform duration-100",
            dx > 35 && "animate-stamp-pop",
          )}
        >
          <Dandiya className="h-4 w-4" />
          <span>DANDIYA</span>
        </div>

        {/* Quick action buttons */}
        <div
          className="absolute bottom-3 right-3 flex flex-col gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={onChat}
            aria-label={`Send ${p.first_name} a Dandiya and open chat`}
            className="touch-tactile flex h-14 w-14 items-center justify-center rounded-full bg-action text-action-foreground shadow-lg transition-transform hover:scale-105 active:scale-90"
          >
            <ChatIcon className="h-7 w-7" />
          </button>
          <button
            onClick={onHide}
            aria-label={`Hide my profile from ${p.first_name}`}
            className="touch-tactile rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur-xs transition hover:bg-background"
          >
            Hide me
          </button>
        </div>

        {/* PASS Stamp with Pop Animation */}
        <div
          style={{ opacity: dx < 0 ? strength : 0 }}
          className={cn(
            "pointer-events-none absolute right-4 top-4 rounded-sm bg-background px-3.5 py-1.5 font-display text-sm font-bold text-primary shadow-md transition-transform duration-100",
            dx < -35 && "animate-stamp-pop",
          )}
        >
          PASS
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-3xl font-extrabold text-primary tracking-tight">
            {p.first_name}, {p.age}
          </h2>
          {sharedCount > 0 && (
            <span className="shrink-0 rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-semibold text-teal">
              {sharedCount} night{sharedCount > 1 ? "s" : ""} together
            </span>
          )}
        </div>
        {p.college && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {p.college}
            {p.branch ? ` · ${p.branch}` : ""}
          </p>
        )}
        {p.prompt && <p className="mt-2 text-[15px] italic text-foreground/90">"{p.prompt}"</p>}
      </div>
    </article>
  );
}
