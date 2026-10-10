import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitSuspensionAppeal } from "@/lib/verify.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Btn } from "@/components/after9";
import { toast } from "sonner";
import { ShieldAlert, Send, RefreshCw } from "lucide-react";

export function SuspensionAppealModal({
  open,
  onOpenChange,
  suspensionReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suspensionReason?: string | null;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const appealFn = useServerFn(submitSuspensionAppeal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error("Please explain your appeal in detail (minimum 10 characters).");
      return;
    }

    setLoading(true);
    try {
      const res = await appealFn({ data: { reason } });
      toast.success(res.message || "Your appeal has been submitted to the moderation team.");
      setReason("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit appeal. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/80">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold">Appeal Account Suspension</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            If you believe your profile restriction was an error or you have updated your information to comply with community guidelines, please submit an appeal below.
          </DialogDescription>
        </DialogHeader>

        {suspensionReason && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <span className="font-bold">Reason on file: </span>
            {suspensionReason}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="appeal-reason" className="text-xs font-semibold text-foreground">
              Explanation & Appeal Details
            </label>
            <textarea
              id="appeal-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why your account should be reinstated (e.g. clarification on photo authenticity, mistake in report, or adherence to rules)..."
              className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-action focus:outline-none"
              required
              minLength={10}
              maxLength={1000}
            />
            <p className="text-[11px] text-muted-foreground text-right">{reason.length}/1000</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Btn
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Btn>
            <Btn
              type="submit"
              size="sm"
              disabled={loading || reason.trim().length < 10}
              className="gap-1.5"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Submit Appeal</span>
            </Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
