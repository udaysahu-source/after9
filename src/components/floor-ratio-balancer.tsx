import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check, Share2, Sparkles, Scale, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type FloorRatioData = {
  men: number;
  women: number;
  total: number;
  menPct: number;
  womenPct: number;
  status: "men_heavy" | "women_heavy" | "balanced";
};

export async function fetchFloorRatio(): Promise<FloorRatioData | null> {
  try {
    const { data } = await supabase.rpc("floor_ratio");
    const raw = data as { men?: number; women?: number; total?: number } | null;
    const dbMen = Number(raw?.men ?? 0);
    const dbWomen = Number(raw?.women ?? 0);
    const dbTotal = Number(raw?.total ?? 0);

    // Insufficient sample: return null (never invent numbers or fake ratios)
    if (dbTotal < 15) {
      return null;
    }

    const menPct = Math.round((dbMen / dbTotal) * 100);
    const womenPct = 100 - menPct;

    let status: FloorRatioData["status"] = "balanced";
    if (menPct >= 60) status = "men_heavy";
    else if (womenPct >= 60) status = "women_heavy";

    return {
      men: dbMen,
      women: dbWomen,
      total: dbTotal,
      menPct,
      womenPct,
      status,
    };
  } catch {
    return null;
  }
}

/** Visual live balance meter pill/card to show on Onboarding Step 0 */
export function FloorRatioMeter({
  ratio,
  onOpenModal,
}: {
  ratio: FloorRatioData | null;
  onOpenModal?: () => void;
}) {
  if (!ratio) return null;

  return (
    <div
      onClick={onOpenModal}
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/80 p-3.5 shadow-sm transition hover:border-action/40",
        onOpenModal && "cursor-pointer"
      )}
      role="region"
      aria-label="Festival Floor Balance"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="tracking-wide">LIVE FESTIVAL FLOOR RATIO</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              ratio.status === "men_heavy"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : ratio.status === "women_heavy"
                ? "bg-pink-500/15 text-pink-700 dark:text-pink-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            )}
          >
            {ratio.status === "men_heavy"
              ? "High Guy Demand"
              : ratio.status === "women_heavy"
              ? "High Girl Demand"
              : "Balanced Floor"}
          </span>
          {onOpenModal && (
            <Info className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
          )}
        </div>
      </div>

      {/* Dual Progress Meter */}
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted/60 p-0.5 border border-border/40">
        <div
          className="h-full rounded-l-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700"
          style={{ width: `${ratio.menPct}%` }}
        />
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-700"
          style={{ width: `${ratio.womenPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="text-sm">🕺</span>
          <span className="text-foreground font-semibold">{ratio.menPct}%</span> Guys
        </span>
        <span className="flex items-center gap-1">
          <span className="text-foreground font-semibold">{ratio.womenPct}%</span> Girls
          <span className="text-sm">💃</span>
        </span>
      </div>
    </div>
  );
}

/** Balance Popup Modal that triggers when user selects their gender */
export function FloorBalanceModal({
  open,
  onOpenChange,
  gender,
  ratio,
  inviteCode,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gender: string;
  ratio: FloorRatioData;
  inviteCode?: string | null;
  userId?: string;
}) {
  const [copied, setCopied] = useState(false);

  const isMenHeavy = ratio.status === "men_heavy";
  const isWomenHeavy = ratio.status === "women_heavy";

  const isOverRepresented =
    (gender === "man" && isMenHeavy) || (gender === "woman" && isWomenHeavy);
  const isUnderRepresented =
    (gender === "woman" && isMenHeavy) || (gender === "man" && isWomenHeavy);

  const inviteUrl =
    typeof window !== "undefined"
      ? inviteCode
        ? `${window.location.origin}/?invite=${inviteCode}`
        : `${window.location.origin}/?ref=${userId || ""}&src=floor_balance`
      : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy link. Please copy manually.");
    }
  };

  const handleWhatsApp = () => {
    const text = isOverRepresented
      ? `Hey! Join me on After9 for Navratri/Garba nights. We need dancers on the floor to balance the circles! Join using my invite: ${inviteUrl}`
      : `Hey! I just got on After9 for Navratri/Garba nights. Join me on the floor with my invite: ${inviteUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "After9 Community Invite",
          text: "Join me on After9 — Navratri festival social discovery! Connect with my invite link.",
          url: inviteUrl,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80 bg-background/95 p-6 backdrop-blur-md sm:rounded-3xl">
        <DialogHeader className="text-left space-y-3">
          <div className="flex items-center gap-2">
            {isOverRepresented ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Scale className="h-5 w-5" />
              </span>
            ) : isUnderRepresented ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-600 dark:text-pink-400">
                <Sparkles className="h-5 w-5" />
              </span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </span>
            )}
            <div>
              <p className="text-[11px] font-bold tracking-widest text-action uppercase">
                {isOverRepresented
                  ? "Floor Balance Notice"
                  : isUnderRepresented
                  ? "Priority Deck Placement"
                  : "Floor Status"}
              </p>
              <DialogTitle className="font-display text-xl font-extrabold text-primary">
                {isOverRepresented
                  ? gender === "man"
                    ? "High Demand for Guys Tonight"
                    : "High Demand for Girls Tonight"
                  : isUnderRepresented
                  ? gender === "woman"
                    ? "Women are in High Demand!"
                    : "Men are in High Demand!"
                  : "The Festival Floor is in Harmony"}
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="text-sm text-foreground/85 leading-relaxed pt-1">
            {isOverRepresented ? (
              <>
                To keep Dandiya circles flowing smoothly and maximize matches for everyone, After9 balances the floor ratio.
                Currently, <b className="text-primary">{gender === "man" ? "guys" : "girls"} make up {gender === "man" ? ratio.menPct : ratio.womenPct}%</b> of the floor.
              </>
            ) : isUnderRepresented ? (
              <>
                You've received <b className="text-primary">Priority Discovery Placement</b>!
                Because the floor currently has <b className="text-primary">{gender === "woman" ? ratio.menPct : ratio.womenPct}% {gender === "woman" ? "guys" : "girls"}</b>, your profile will be highlighted to ensure you get great clashes.
              </>
            ) : (
              <>
                The festival floor has a balanced 50/50 ratio right now! Matches and dandiya clashes are moving fast.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Live Ratio Preview Box */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Current Floor Composition</span>
            <span className="font-semibold text-primary">
              {ratio.menPct}% 🕺 : {ratio.womenPct}% 💃
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60 p-0.5 border border-border/40">
            <div
              className="h-full rounded-l-full bg-gradient-to-r from-indigo-500 to-indigo-600"
              style={{ width: `${ratio.menPct}%` }}
            />
            <div
              className="h-full rounded-r-full bg-gradient-to-r from-rose-500 to-pink-500"
              style={{ width: `${ratio.womenPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isOverRepresented
              ? `💡 Floor Balancer Bonus: Invite a ${gender === "man" ? "female" : "male"} friend to dance at After9 to fast-track your profile straight to the top of the discovery deck!`
              : "Chat only unlocks when both dancers clash Dandiyas. Your birthdate and private details remain protected."}
          </p>
        </div>

        {/* Invite Link & Sharing */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-muted-foreground tracking-wide">
            {isOverRepresented ? "INVITE A FRIEND TO BALANCE THE FLOOR" : "SHARE YOUR AFTER9 INVITE"}
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono text-muted-foreground">
            <span className="flex-1 truncate">{inviteUrl || "Generating your invite pass…"}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleWhatsApp}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-98"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share on WhatsApp
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground transition hover:bg-accent active:scale-98"
              >
                <Share2 className="h-3.5 w-3.5" />
                More
              </button>
            )}
          </div>
        </div>

        {/* Modal Action CTA */}
        <div className="pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-2xl bg-action py-3 text-center text-sm font-bold text-action-foreground shadow-md transition hover:opacity-90 active:scale-[0.99]"
          >
            {isOverRepresented ? "I Understand · Continue to Setup →" : "Continue Setup →"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
