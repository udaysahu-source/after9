import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check, Share2, Ticket, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ensureInvites } from "@/lib/invites.functions";
import { drawInviteCard } from "@/lib/share-cards";
import { Link } from "@tanstack/react-router";

import { Analytics } from "@/lib/launch-analytics";

export function InviteShareModal({
  open,
  onOpenChange,
  code: initialCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code?: string | null;
}) {
  const ensure = useServerFn(ensureInvites);
  const [activeCode, setActiveCode] = useState<string | null>(initialCode ?? null);
  const [availableCount, setAvailableCount] = useState<number>(5);
  const [copied, setCopied] = useState(false);
  const [drawingCard, setDrawingCard] = useState(false);

  useEffect(() => {
    if (open && !activeCode) {
      ensure().then((r) => {
        if (r?.ok && r.primaryCode) {
          setActiveCode(r.primaryCode);
          if (r.availableCount !== undefined) setAvailableCount(r.availableCount);
        }
      }).catch(() => {});
    }
  }, [open, activeCode, ensure]);

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
      toast.success("Invite link copied to clipboard! 📋");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy link. Please copy manually.");
    }
  };

  const handleWhatsApp = () => {
    if (!inviteUrl) return;
    Analytics.inviteShared("whatsapp");
    const text = `Hey! Join me on After9 for Navratri & Garba nights. Connect on the floor: ${inviteUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleNativeShare = async () => {
    if (!inviteUrl) return;
    Analytics.inviteShared("native");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "After9 Festival Invite",
          text: "Join me on After9 for Navratri & Garba nights. Connect on the floor!",
          url: inviteUrl,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      handleCopy();
    }
  };

  const handleDrawCard = async () => {
    if (!activeCode) return;
    setDrawingCard(true);
    try {
      Analytics.inviteShared("card");
      await drawInviteCard(activeCode, `${window.location.origin}/?invite=${activeCode}&src=card`);
      toast.success("Festival card generated!");
    } catch {
      toast.error("Could not draw festival card.");
    } finally {
      setDrawingCard(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80 bg-background/95 p-6 backdrop-blur-md sm:rounded-3xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action/20 text-action">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-action uppercase">COMMUNITY INVITES</p>
              <DialogTitle className="font-display text-xl font-extrabold text-primary">
                Invite Friends to After9
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-foreground/85 leading-relaxed pt-1">
            Share your personal invite link so friends can connect with you on After9 during Navratri.
          </DialogDescription>
        </DialogHeader>

        {/* Invite Card Preview */}
        <div className="relative overflow-hidden rounded-2xl border border-action/40 bg-gradient-to-br from-card via-card to-action/10 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-widest text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-action" />
              PERSONAL INVITE
            </span>
            <span className="rounded-full bg-action/15 px-2.5 py-0.5 text-[11px] font-bold text-action">
              {availableCount !== undefined ? `${availableCount} Invites Left` : "Loading…"}
            </span>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/90 p-3 space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Your Invite Link</p>
            <p className="font-mono text-xs font-semibold text-primary truncate select-all">
              {inviteUrl || "Generating your personal invite link…"}
            </p>
          </div>

          {activeCode && (
            <p className="text-center font-display text-xl font-extrabold tracking-widest text-primary">
              {activeCode}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 active:scale-98"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link Copied!" : "Copy Link"}
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-98"
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDrawCard}
              disabled={drawingCard || !activeCode}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-action/50 bg-action/10 px-3 py-2 text-xs font-bold text-action transition hover:bg-action/20 disabled:opacity-50"
            >
              🎨 {drawingCard ? "Generating…" : "Festival Card"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
              >
                <Share2 className="h-3.5 w-3.5" />
                More options
              </button>
            ) : (
              <Link
                to="/invites"
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted text-center"
              >
                Track friends →
              </Link>
            )}
          </div>
        </div>

        <div className="border-t border-border/70 pt-3 flex justify-between items-center text-xs text-muted-foreground">
          <span>Keep passes for people you know</span>
          <Link
            to="/invites"
            onClick={() => onOpenChange(false)}
            className="font-semibold text-primary hover:underline"
          >
            Manage invite list →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
