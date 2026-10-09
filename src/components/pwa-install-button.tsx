import { useState } from "react";
import { usePWAInstall } from "@/lib/pwa";
import { Download, Check, Share, PlusSquare, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function PWAInstallCard({ className }: { className?: string }) {
  const { canInstall, installed, isIOS, triggerInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (installed) {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-400",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">After9 App Installed</p>
            <p className="text-xs text-muted-foreground">Running as standalone Progressive Web App</p>
          </div>
        </div>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    if (canInstall) {
      setInstalling(true);
      await triggerInstall();
      setInstalling(false);
    } else {
      // Fallback modal explaining installation
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card/60 p-4 shadow-xs",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Install After9 on your Phone</p>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for quick festival access & full-screen view
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{installing ? "Installing..." : "Install"}</span>
        </button>
      </div>

      {/* iOS Safari / Browser Manual Install Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-card p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Smartphone className="h-5 w-5 text-primary" />
              <span>Install After9</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Follow these two simple steps to add After9 to your home screen:
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3.5 text-sm text-foreground">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Share className="h-4 w-4" />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Step 1:</strong> Tap the{" "}
                <strong className="text-foreground">Share</strong> icon in your browser menu (at
                the bottom of Safari or top-right in Chrome).
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <PlusSquare className="h-4 w-4" />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Step 2:</strong> Scroll down and select{" "}
                <strong className="text-foreground">Add to Home Screen</strong>.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full rounded-full bg-secondary py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
