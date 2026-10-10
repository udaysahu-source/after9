import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Share2,
  Ticket,
  Sparkles,
  AlertCircle,
  RefreshCw,
  QrCode,
  Download,
  Users,
  Eye,
  ExternalLink,
} from "lucide-react";
import { drawInviteCard } from "@/lib/share-cards";
import { Link } from "@tanstack/react-router";
import { Analytics } from "@/lib/launch-analytics";
import { useAuthoritativeInvites } from "@/lib/invites";
import { generateQrSvg } from "@/lib/qr-code";
import type { ProfileRow } from "@/lib/after9";

export function InviteShareModal({
  open,
  onOpenChange,
  code: initialCode,
  userProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code?: string | null;
  userProfile?: ProfileRow | null;
}) {
  const {
    primaryCode,
    claimedCount,
    status,
    error,
    refresh,
  } = useAuthoritativeInvites(open);

  const [activeCode, setActiveCode] = useState<string | null>(initialCode ?? null);
  const [copied, setCopied] = useState(false);
  const [drawingCard, setDrawingCard] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setActiveCode(initialCode);
    } else if (primaryCode) {
      setActiveCode(primaryCode);
    }
  }, [initialCode, primaryCode]);

  const inviteUrl =
    typeof window !== "undefined" && activeCode
      ? `${window.location.origin}/?invite=${activeCode}`
      : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      Analytics.inviteShared("copy");
      toast.success("Personal invite link copied! 📋");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy link. Please copy manually.");
    }
  };

  const handleWhatsApp = () => {
    if (!inviteUrl) return;
    Analytics.inviteShared("whatsapp");
    const text = `Hey! Your Garba nights need a better crew. Find your people, plan your nights and join me on After9: ${inviteUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleNativeShare = async () => {
    if (!inviteUrl) return;
    Analytics.inviteShared("native");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "After9 — Your Garba crew starts here",
          text: "Your Garba nights need a better crew. Find your people, plan your nights and join me on After9!",
          url: inviteUrl,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    handleCopy();
  };

  const handleDrawCard = async () => {
    if (!activeCode) return;
    setDrawingCard(true);
    try {
      await drawInviteCard(activeCode, `${window.location.origin}/?invite=${activeCode}&src=card`, {
        senderName: userProfile?.first_name,
        photoUrl: userProfile?.photo_path,
      });
      Analytics.inviteShared("card");
      toast.success("1080 × 1920 Story invite created! 🎨");
    } catch {
      toast.error("Could not generate card. Please try again.");
    } finally {
      setDrawingCard(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80 bg-background/98 p-6 shadow-2xl backdrop-blur-md rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action/20 text-action">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-action uppercase">AFTER9 INVITATION</p>
              <DialogTitle className="font-display text-xl font-extrabold text-primary">
                Your Garba nights need a better crew.
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-foreground/85 leading-relaxed pt-1">
            Find your people, plan your nights and make Navratri more memorable with After9.
          </DialogDescription>
        </DialogHeader>

        {/* Polished In-App Invitation Card */}
        <div className="relative overflow-hidden rounded-2xl border border-action/40 bg-gradient-to-br from-card via-card to-action/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-widest text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-action" />
              AFTER9 COMMUNITY PASS
            </span>
            {claimedCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                <Users className="h-3 w-3" />
                {claimedCount} {claimedCount === 1 ? "friend joined" : "friends joined"}
              </span>
            ) : (
              <span className="rounded-full bg-action/15 px-2.5 py-0.5 text-[11px] font-bold text-action">
                Unlimited Sharing
              </span>
            )}
          </div>

          {status === "error" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-destructive text-xs font-semibold">
                <AlertCircle className="h-4 w-4" />
                <span>{error || "Could not generate invite link."}</span>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-bold text-primary shadow-xs transition hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" />
                Retry Link Generation
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/80 bg-background/90 p-3 space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Your Personal Referral Link</p>
                <p className="font-mono text-xs font-semibold text-primary truncate select-all">
                  {inviteUrl ? (
                    inviteUrl
                  ) : status === "loading" ? (
                    "Generating your persistent link…"
                  ) : (
                    "Loading link…"
                  )}
                </p>
              </div>

              {activeCode && status !== "error" && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs text-muted-foreground">Code:</span>
                  <span className="font-mono text-base font-extrabold tracking-wider text-action">
                    {activeCode}
                  </span>
                </div>
              )}

              {/* QR Code Toggle Container */}
              {showQr && activeCode && (
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background border border-border space-y-2 animate-fade-in">
                  <img
                    src={generateQrSvg(inviteUrl, 180)}
                    alt="After9 Referral QR Code"
                    className="h-40 w-40 rounded-lg shadow-xs"
                  />
                  <p className="text-[11px] text-muted-foreground text-center">
                    Scan with camera or phone to join directly
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/80 text-center font-medium italic">
            After9 — “Meet on the floor. Stay after.”
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              disabled={!activeCode || status === "loading" || status === "error"}
              className="touch-tactile flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 active:scale-98 disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link Copied!" : "Copy Link"}
            </button>
            <button
              onClick={handleWhatsApp}
              disabled={!activeCode || status === "loading" || status === "error"}
              className="touch-tactile flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-98 disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleDrawCard}
              disabled={drawingCard || !activeCode || status === "loading" || status === "error"}
              className="touch-tactile flex items-center justify-center gap-1.5 rounded-xl border border-action/50 bg-action/10 px-2 py-2 text-xs font-bold text-action transition hover:bg-action/20 disabled:opacity-50"
              title="Download 1080 × 1920 Instagram Story artwork"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{drawingCard ? "Saving…" : "Story Card"}</span>
            </button>

            <button
              onClick={() => setShowQr(!showQr)}
              disabled={!activeCode}
              className="touch-tactile flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
              title="Show QR Code for scanning"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>{showQr ? "Hide QR" : "Show QR"}</span>
            </button>

            <button
              onClick={handleNativeShare}
              disabled={!activeCode || status === "loading" || status === "error"}
              className="touch-tactile flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
              title="More sharing options"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
