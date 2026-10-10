import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Dandiya, Btn } from "@/components/after9";
import { usePhotoUrls, shared } from "@/lib/after9";
import {
  getMatchInstagramStatus,
  setMatchInstagramConsent,
  saveUserInstagramHandle,
  copyInstagramHandle,
  openInstagramProfile,
  type InstagramExchangeState,
} from "@/lib/instagram-match";
import { validateAndNormalizeSocial } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import {
  Instagram,
  Copy,
  ExternalLink,
  CalendarDays,
  MessageCircle,
  Lock,
  Sparkles,
  Check,
  X,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { FestiveConfetti } from "@/components/festive-confetti";
import { playDandiyaClackSound, playCelebrationChime } from "@/lib/sound-effects";

export type MatchPartnerInfo = {
  id: string;
  first_name?: string | null;
  age?: number | null;
  college?: string | null;
  photo_path?: string | null;
  nights?: any;
};

export function MatchCommunicationScreen({
  partner,
  myId,
  myNights,
  onClose,
  onOpenChat,
  mode = "fullscreen",
}: {
  partner: MatchPartnerInfo;
  myId: string;
  myNights?: any;
  onClose?: () => void;
  onOpenChat?: () => void;
  mode?: "fullscreen" | "embedded";
}) {
  const nav = useNavigate();
  const urls = usePhotoUrls([partner.photo_path]);
  const [exchange, setExchange] = useState<InstagramExchangeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [promptHandle, setPromptHandle] = useState(false);
  const [inputHandle, setInputHandle] = useState("");
  const [savingHandle, setSavingHandle] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  // Play initial celebratory Dandiya Clack on mount
  useEffect(() => {
    playDandiyaClackSound();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    const status = await getMatchInstagramStatus(partner.id);
    if (status.bothConsented && status.partnerHandle && !exchange?.bothConsented) {
      playCelebrationChime();
    }
    setExchange(status);
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id]);

  const handleToggleConsent = async (nextConsent: boolean) => {
    if (!exchange) return;

    // If user wants to consent but doesn't have their own handle saved yet
    if (nextConsent && !exchange.myHandle) {
      setPromptHandle(true);
      return;
    }

    setActing(true);
    const res = await setMatchInstagramConsent(partner.id, nextConsent);
    setActing(false);

    if (res.ok) {
      toast.success(
        nextConsent
          ? `Instagram handle shared with ${partner.first_name || "match"}!`
          : "Instagram sharing paused for this clash"
      );
      loadStatus();
    } else {
      toast.error(res.error || "Failed to update Instagram sharing");
    }
  };

  const handleSaveAndShareHandle = async () => {
    if (!inputHandle.trim()) {
      toast.error("Please enter your Instagram username");
      return;
    }

    setSavingHandle(true);
    const res = await saveUserInstagramHandle(myId, inputHandle);
    if (!res.ok) {
      setSavingHandle(false);
      toast.error(res.error || "Could not save Instagram handle");
      return;
    }

    // Now consent to share with this match
    await setMatchInstagramConsent(partner.id, true);
    setSavingHandle(false);
    setPromptHandle(false);
    setInputHandle("");
    toast.success(`Instagram handle saved and shared with ${partner.first_name || "match"}!`);
    loadStatus();
  };

  const handleCopy = async (handle: string) => {
    const ok = await copyInstagramHandle(handle);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Shared festival nights
  const sharedNights = shared(myNights, partner.nights);

  const isFullscreen = mode === "fullscreen";

  return (
    <div
      className={cn(
        isFullscreen
          ? "fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center overflow-y-auto bg-primary/98 px-5 py-8 text-center text-primary-foreground backdrop-blur-md"
          : "w-full rounded-3xl border border-border/80 bg-card p-5 text-card-foreground shadow-sm"
      )}
    >
      {/* Festive Confetti Burst for Match Milestone */}
      {showConfetti && (
        <FestiveConfetti
          count={75}
          durationMs={2800}
          onComplete={() => setShowConfetti(false)}
        />
      )}

      {/* Container sizing */}
      <div className={cn("w-full", isFullscreen ? "max-w-md mx-auto" : "max-w-2xl mx-auto")}>
        {/* Close button for fullscreen modal */}
        {isFullscreen && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-primary-foreground hover:bg-white/20 transition active:scale-95"
            aria-label="Close match screen"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Visual Hook & Partner Avatar */}
        <div className="relative mx-auto mb-4 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* Clack Burst Glow */}
            <div className="absolute -inset-2 rounded-full bg-action/25 blur-md animate-pulse" />
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full border-3 border-action/80 bg-muted shadow-xl">
              {partner.photo_path && urls[partner.photo_path] ? (
                <img
                  src={urls[partner.photo_path]}
                  alt={partner.first_name ?? "Match"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-3xl font-display font-black text-primary">
                  {partner.first_name?.[0] || "✨"}
                </div>
              )}
            </div>
            {/* Floating Dandiya Clack badge */}
            <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-action text-white shadow-md border-2 border-primary">
              <Dandiya className="h-4 w-4" />
            </div>
          </div>

          <p
            className={cn(
              "mt-3 font-display text-xs font-black tracking-[0.25em] uppercase text-action",
              isFullscreen ? "text-action" : "text-action"
            )}
          >
            Dandiya Clash!
          </p>
          <h2
            className={cn(
              "font-display text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5",
              isFullscreen ? "text-primary-foreground" : "text-foreground"
            )}
          >
            You and {partner.first_name || "your match"} connected
          </h2>

          {/* Subtitle / Details */}
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs",
              isFullscreen ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {partner.college && <span>{partner.college}</span>}
            {partner.age && <span>· Age {partner.age}</span>}
            {sharedNights.length > 0 && (
              <span className="font-semibold text-action">
                · Both dancing Night {sharedNights.join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Concise Reassurance Badge */}
        <div
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-medium mb-3.5",
            isFullscreen
              ? "border border-white/15 bg-white/10 text-primary-foreground/90 backdrop-blur-xs"
              : "border border-border/70 bg-muted/50 text-muted-foreground"
          )}
        >
          <Lock className="h-3 w-3 text-action shrink-0" />
          <span>Instagram sharing is optional · Private until you both agree</span>
        </div>

        {/* PRIMARY ACTION SECTION: INSTAGRAM */}
        <div className="space-y-3">
          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ) : exchange?.bothConsented && exchange.partnerHandle ? (
            /* STATE A: BOTH CONSENTED — UNLOCKED! */
            <div
              className={cn(
                "rounded-2xl border p-4 text-left space-y-3.5 shadow-sm animate-fade-in",
                isFullscreen
                  ? "border-action/40 bg-card text-foreground"
                  : "border-action/40 bg-action/5 text-foreground"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E1306C]/15 text-[#E1306C]">
                    <Instagram className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-action">
                      Connected on Instagram
                    </span>
                    <p className="font-mono text-base font-bold text-foreground">
                      @{exchange.partnerHandle}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  Mutual ✓
                </span>
              </div>

              {/* Action Buttons: Open & Copy */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openInstagramProfile(exchange.partnerHandle!)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#E1306C] px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 active:scale-95 transition"
                >
                  <Instagram className="h-3.5 w-3.5" />
                  <span>Open Instagram</span>
                  <ExternalLink className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(exchange.partnerHandle!)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Copy Handle</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground leading-normal">
                After9 doesn't send Instagram DMs. Tap above to open Instagram and start your conversation on the floor!
              </p>
            </div>
          ) : exchange?.myConsent ? (
            /* STATE B: CURRENT USER CONSENTED, WAITING FOR PARTNER */
            <div
              className={cn(
                "rounded-2xl border p-4 text-left space-y-2.5",
                isFullscreen
                  ? "border-white/20 bg-white/10 text-primary-foreground"
                  : "border-border bg-card text-foreground"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-[#E1306C]" />
                  <p className="text-xs font-bold">You shared your Instagram</p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                  Awaiting partner
                </span>
              </div>
              <p className="text-[12px] opacity-85 leading-relaxed">
                We'll reveal <b>@{partner.first_name}'s</b> handle the moment they choose to share back.
              </p>
              <div className="pt-1 flex items-center justify-between text-xs">
                <span className="text-[11px] opacity-75">Your handle: @{exchange.myHandle}</span>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => handleToggleConsent(false)}
                  className="text-[11px] font-semibold text-destructive hover:underline"
                >
                  {acting ? "Updating..." : "Stop sharing"}
                </button>
              </div>
            </div>
          ) : promptHandle ? (
            /* STATE C: INLINE PROMPT TO ENTER IG HANDLE */
            <div
              className={cn(
                "rounded-2xl border p-4 text-left space-y-3 animate-scale-in",
                isFullscreen
                  ? "border-action bg-card text-foreground"
                  : "border-action bg-card text-foreground"
              )}
            >
              <div>
                <p className="font-display text-sm font-bold text-primary">Enter Your Instagram</p>
                <p className="text-[11px] text-muted-foreground">
                  Saved privately. Only shared with {partner.first_name || "this clash"} when you connect.
                </p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={inputHandle}
                  onChange={(e) => setInputHandle(e.target.value)}
                  placeholder="@your_username"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus:border-action"
                />
              </div>
              {inputHandle.trim() && (
                <div className="text-[11px]">
                  {validateAndNormalizeSocial("instagram", inputHandle).valid ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ Valid: @{validateAndNormalizeSocial("instagram", inputHandle).handle}
                    </span>
                  ) : (
                    <span className="font-medium text-destructive">
                      {validateAndNormalizeSocial("instagram", inputHandle).error}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPromptHandle(false)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingHandle || !inputHandle.trim() || !validateAndNormalizeSocial("instagram", inputHandle).valid}
                  onClick={handleSaveAndShareHandle}
                  className="flex items-center gap-1.5 rounded-xl bg-[#E1306C] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {savingHandle ? "Saving..." : "Save & Share"}
                </button>
              </div>
            </div>
          ) : (
            /* STATE D: INITIAL SHARE BUTTON */
            <button
              type="button"
              disabled={acting}
              onClick={() => handleToggleConsent(true)}
              className={cn(
                "touch-tactile flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-extrabold shadow-lg transition active:scale-98",
                exchange?.partnerConsent
                  ? "bg-gradient-to-r from-[#E1306C] to-pink-500 text-white animate-pulse-gentle"
                  : isFullscreen
                  ? "bg-action text-white hover:bg-action/90"
                  : "bg-action text-white hover:bg-action/90"
              )}
            >
              <Instagram className="h-4 w-4" />
              <span>
                {exchange?.partnerConsent
                  ? `${partner.first_name || "Match"} shared theirs! Share Instagram to Connect`
                  : `Connect on Instagram with ${partner.first_name || "match"}`}
              </span>
            </button>
          )}

          {/* SECONDARY ACTION: PLAN A GARBA NIGHT */}
          <Link
            to="/plan"
            className="block w-full"
            onClick={onClose}
          >
            <button
              type="button"
              className={cn(
                "touch-tactile flex w-full items-center justify-center gap-2 rounded-2xl border py-3 px-4 text-xs sm:text-sm font-bold transition active:scale-98",
                isFullscreen
                  ? "border-white/25 bg-white/10 text-primary-foreground hover:bg-white/20"
                  : "border-border/80 bg-background text-foreground hover:bg-muted"
              )}
            >
              <CalendarDays className="h-4 w-4 text-action" />
              <span>Suggest a Garba Night or Event</span>
            </button>
          </Link>

          {/* ALTERNATIVE ACTION: IN-APP CHAT (Retained as alternative) */}
          {isFullscreen ? (
            <div className="flex items-center justify-center gap-3 pt-2 text-xs">
              {onOpenChat ? (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="inline-flex items-center gap-1.5 font-semibold text-primary-foreground/80 hover:text-white transition"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Or use in-app chat</span>
                </button>
              ) : (
                <Link
                  to="/chat/$id"
                  params={{ id: partner.id }}
                  className="inline-flex items-center gap-1.5 font-semibold text-primary-foreground/80 hover:text-white transition"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Or use in-app chat</span>
                </Link>
              )}

              {onClose && (
                <>
                  <span className="opacity-40">·</span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-semibold text-primary-foreground/80 hover:text-white transition"
                  >
                    Keep discovering
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="pt-0.5 text-center text-[11px] text-muted-foreground">
              In-app messages are available below
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
