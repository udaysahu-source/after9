import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldAlert,
  AlertTriangle,
  UserX,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const REPORT_CATEGORIES = [
  {
    id: "fake_profile",
    label: "Fake profile or bot",
    desc: "Profile appears automated, synthetic, or manufactured.",
  },
  {
    id: "impersonation",
    label: "Impersonating someone else",
    desc: "Pretending to be another person, classmate, or celebrity.",
  },
  {
    id: "stolen_photo",
    label: "Stolen or non-consensual photo",
    desc: "Using photos taken from Instagram, websites, or without permission.",
  },
  {
    id: "harassment",
    label: "Harassment, abuse, or hate speech",
    desc: "Offensive messages, intimidation, stalking, or slurs.",
  },
  {
    id: "inappropriate_content",
    label: "Inappropriate or explicit content",
    desc: "Sexual content, illegal material, or violent threats.",
  },
  {
    id: "underage_account",
    label: "Suspected underage account (under 18)",
    desc: "After9 is strictly 18+; user appears to be a minor.",
  },
  {
    id: "other",
    label: "Other safety violation",
    desc: "Any other behavior violating community guidelines.",
  },
] as const;

export const REPORT_REASONS = REPORT_CATEGORIES;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["id"];

interface ReportUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId?: string;
  targetUserName?: string | null;
  targetUser?: { id: string; first_name?: string | null; photo_path?: string | null } | null;
  currentUserId?: string;
  onCompleted?: () => void;
  onReportComplete?: () => void;
}

export function ReportUserModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  targetUser,
  currentUserId,
  onCompleted,
  onReportComplete,
}: ReportUserModalProps) {
  const [category, setCategory] = useState<ReportCategory>("fake_profile");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveTargetId = targetUserId || targetUser?.id;
  const effectiveTargetName = targetUserName || targetUser?.first_name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTargetId) return;

    let effectiveBlockerId = currentUserId;
    if (!effectiveBlockerId) {
      const { data: sessionData } = await supabase.auth.getSession();
      effectiveBlockerId = sessionData.session?.user?.id;
    }
    if (!effectiveBlockerId) return;

    setSubmitting(true);
    try {
      const selectedObj = REPORT_CATEGORIES.find((c) => c.id === category);
      const combinedReason = selectedObj
        ? `${selectedObj.label}${details.trim() ? `: ${details.trim()}` : ""}`
        : details.trim() || "Safety report submitted";

      // 1. Insert into blocks table with report = true
      // This immediately activates database-side blocking across Discover, chat, and photos
      const { error } = await supabase.from("blocks").insert({
        blocker_id: effectiveBlockerId,
        blocked_id: effectiveTargetId,
        report: true,
        reason: combinedReason,
        status: "pending",
      });

      if (error) {
        // If block already existed, update with report
        if (error.code === "23505") {
          await supabase
            .from("blocks")
            .update({
              report: true,
              reason: combinedReason,
              status: "pending",
            })
            .eq("blocker_id", effectiveBlockerId)
            .eq("blocked_id", effectiveTargetId);
        } else {
          throw error;
        }
      }

      toast.success(
        `${targetUserName || "Account"} has been reported and blocked immediately.`,
      );

      onOpenChange(false);
      onCompleted?.();
      onReportComplete?.();
    } catch (err: any) {
      console.error("[ReportUserModal] Error:", err);
      toast.error(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border/80 shadow-2xl rounded-2xl">
        <div className="bg-gradient-to-r from-destructive/15 via-card to-card p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-destructive">
                Report & Block Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Immediate protection against abusive or fake accounts
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs space-y-1.5 text-muted-foreground">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <UserX className="h-3.5 w-3.5 text-destructive" />
              Immediate Safety Enforcement:
            </p>
            <p>
              Blocking is <b>immediate and bilateral</b>. {targetUserName || "This user"} will no longer be able to see you on Discover, view your photos, or send you messages.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              What is the reason for reporting?
            </label>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {REPORT_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-start justify-between gap-2 ${
                      isSelected
                        ? "border-destructive/60 bg-destructive/10 text-foreground"
                        : "border-border/70 bg-card hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div>
                      <p className={`font-semibold ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
                        {cat.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {cat.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="report-details" className="text-xs font-bold text-foreground">
              Additional Details (Optional)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any context that will help our moderation team investigate…"
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-destructive resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border/60">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] rounded-xl bg-destructive py-2.5 text-xs font-black uppercase tracking-wider text-destructive-foreground shadow-sm hover:opacity-90 transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? "Submitting Report…" : "Report & Block Immediately"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
