import { useState, useEffect } from "react";
import {
  getMySocialLinks,
  validateAndNormalizeSocial,
  upsertSocialLink,
  deleteSocialLink,
  type SocialLinkRow,
} from "@/lib/social-links";
import { Instagram, Check, Trash2, ExternalLink, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProfileInstagramField({
  userId,
  onHandleChange,
}: {
  userId: string;
  onHandleChange?: (handle: string | null) => void;
}) {
  const [currentLink, setCurrentLink] = useState<SocialLinkRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const links = await getMySocialLinks(userId);
    const insta = links.find((l) => l.platform === "instagram") ?? null;
    setCurrentLink(insta);
    setInputValue(insta ? insta.handle : "");
    onHandleChange?.(insta ? insta.handle : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const preview = inputValue.trim()
    ? validateAndNormalizeSocial("instagram", inputValue)
    : null;

  const handleSave = async () => {
    if (!inputValue.trim()) {
      toast.error("Please enter a valid Instagram handle");
      return;
    }

    const { valid, error, handle, url } = validateAndNormalizeSocial("instagram", inputValue);
    if (!valid) {
      toast.error(error || "Invalid handle");
      return;
    }

    setSaving(true);
    const res = await upsertSocialLink(
      userId,
      "instagram",
      handle,
      url,
      true,
      currentLink?.visibility || "matched" // Available for mutual match consent exchange
    );
    setSaving(false);

    if (res.ok) {
      toast.success(`Instagram handle saved as @${handle}!`);
      setIsEditing(false);
      load();
    } else {
      toast.error(res.error || "Failed to save Instagram handle");
    }
  };

  const handleRemove = async () => {
    if (!currentLink) return;
    setSaving(true);
    const ok = await deleteSocialLink(currentLink.id, userId);
    setSaving(false);

    if (ok) {
      toast.success("Instagram handle removed");
      setIsEditing(false);
      setInputValue("");
      load();
    } else {
      toast.error("Failed to remove Instagram handle");
    }
  };

  if (loading) {
    return <div className="h-20 animate-pulse rounded-2xl bg-muted/50" />;
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E1306C]/10 text-[#E1306C]">
            <Instagram className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">Instagram Handle</h3>
            <p className="text-[11px] text-muted-foreground">
              Primary contact for Dandiya clashes
            </p>
          </div>
        </div>

        {currentLink && !isEditing && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-xl px-2.5 py-1 text-xs font-semibold text-action hover:bg-action/10 transition"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="rounded-xl p-1.5 text-muted-foreground hover:text-destructive transition"
              title="Remove handle"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Viewing existing handle */}
      {currentLink && !isEditing ? (
        <div className="rounded-xl border border-border/60 bg-background/80 p-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm font-bold text-foreground">@{currentLink.handle}</p>
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>Private · Only exchanged when both users agree</span>
            </div>
          </div>
          <a
            href={currentLink.profile_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-action hover:underline"
          >
            <span>View</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : isEditing || !currentLink ? (
        /* Edit or Add mode */
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Enter your handle or profile link
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 font-mono text-sm text-muted-foreground">@</span>
                <input
                  type="text"
                  autoFocus={isEditing}
                  value={inputValue.replace(/^@/, "")}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="your_instagram"
                  className="h-10 w-full rounded-xl border border-border bg-background pl-8 pr-3 font-mono text-sm outline-none focus:border-action"
                />
              </div>
            </div>
          </div>

          {/* Validation & Canonical Preview */}
          {preview && (
            <div
              className={cn(
                "rounded-xl border p-2.5 text-xs flex items-center gap-2",
                preview.valid
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              )}
            >
              {preview.valid ? (
                <>
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="font-mono text-[11px] truncate">
                    Valid: {preview.url}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span>{preview.error}</span>
                </>
              )}
            </div>
          )}

          {/* Privacy reassurance note */}
          <p className="text-[11px] text-muted-foreground leading-normal">
            🔒 Kept strictly private by default. Never visible on Discover or public profiles unless you explicitly choose to connect with a mutual Dandiya clash.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setInputValue(currentLink ? currentLink.handle : "");
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={saving || !inputValue.trim() || (preview !== null && !preview.valid)}
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Instagram"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
