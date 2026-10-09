import { useState, useEffect } from "react";
import {
  getMySocialLinks,
  upsertSocialLink,
  toggleSocialLinkEnabled,
  deleteSocialLink,
  validateAndNormalizeSocial,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialLinkRow,
} from "@/lib/social-links";
import { toast } from "sonner";
import {
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon mapping helper
function PlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  switch (platform) {
    case "instagram":
      return <Instagram className={cn("text-[#E1306C]", className)} />;
    case "youtube":
      return <Youtube className={cn("text-[#FF0000]", className)} />;
    case "x":
      return <Twitter className={cn("text-[#1DA1F2]", className)} />;
    case "linkedin":
      return <Linkedin className={cn("text-[#0A66C2]", className)} />;
    case "snapchat":
      return (
        <span
          className={cn(
            "flex items-center justify-center font-bold text-amber-500 font-display text-sm",
            className
          )}
        >
          👻
        </span>
      );
    case "custom":
    default:
      return <LinkIcon className={cn("text-action", className)} />;
  }
}

export function SocialLinksManager({
  userId,
  onLinksChanged,
}: {
  userId: string;
  onLinksChanged?: (links: SocialLinkRow[]) => void;
}) {
  const [links, setLinks] = useState<SocialLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlatform, setEditingPlatform] = useState<SocialPlatform | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await getMySocialLinks(userId);
    setLinks(list);
    onLinksChanged?.(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleStartAdd = (platform: SocialPlatform) => {
    const existing = links.find((l) => l.platform === platform);
    setEditingPlatform(platform);
    setInputValue(existing ? existing.handle : "");
  };

  const handleSave = async () => {
    if (!editingPlatform) return;
    const { valid, error, handle, url } = validateAndNormalizeSocial(editingPlatform, inputValue);
    if (!valid) {
      toast.error(error || "Invalid handle");
      return;
    }

    setSaving(true);
    const res = await upsertSocialLink(userId, editingPlatform, handle, url, true);
    setSaving(false);

    if (res.ok) {
      toast.success(`${editingPlatform} handle saved!`);
      setEditingPlatform(null);
      setInputValue("");
      load();
    } else {
      toast.error(res.error || "Failed to save link");
    }
  };

  const handleToggle = async (link: SocialLinkRow) => {
    const nextVal = !link.is_enabled;
    const ok = await toggleSocialLinkEnabled(link.id, userId, nextVal);
    if (ok) {
      toast.success(nextVal ? "Visible on card/clashes" : "Set to private");
      load();
    } else {
      toast.error("Failed to update visibility");
    }
  };

  const handleDelete = async (link: SocialLinkRow) => {
    const ok = await deleteSocialLink(link.id, userId);
    if (ok) {
      toast.success("Handle removed");
      load();
    } else {
      toast.error("Failed to remove handle");
    }
  };

  const activeMeta = SOCIAL_PLATFORMS.find((p) => p.key === editingPlatform);
  const preview = editingPlatform ? validateAndNormalizeSocial(editingPlatform, inputValue) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/80 bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-action tracking-wider uppercase mb-1">
          <Lock className="h-3.5 w-3.5" />
          <span>Private by default</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your social handles are never visible to strangers. They only appear when you explicitly enable them on your exported Story Card or share them during mutual Dandiya clashes.
        </p>
      </div>

      {/* Social Platforms List */}
      <div className="space-y-2.5">
        {SOCIAL_PLATFORMS.map((plat) => {
          const existing = links.find((l) => l.platform === plat.key);
          const isEditing = editingPlatform === plat.key;

          return (
            <div
              key={plat.key}
              className={cn(
                "rounded-2xl border border-border/70 bg-card/70 p-3.5 transition",
                isEditing && "border-action ring-1 ring-action/20 bg-card"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                    <PlatformIcon platform={plat.key} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{plat.name}</p>
                    {existing ? (
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {existing.handle}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{plat.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {existing ? (
                    <>
                      {/* Visibility Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(existing)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold transition",
                          existing.is_enabled
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        )}
                        title="Toggle visibility"
                      >
                        {existing.is_enabled ? "Enabled" : "Off"}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartAdd(plat.key)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition"
                        title="Edit"
                      >
                        ✎
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(existing)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartAdd(plat.key)}
                      className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Editor Drawer */}
              {isEditing && (
                <div className="mt-3.5 border-t border-border/70 pt-3 space-y-3 animate-fade-in">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Enter {plat.name} Handle or URL
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={plat.placeholder}
                        className="h-10 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus:border-action"
                      />
                    </div>
                  </div>

                  {preview && preview.valid && (
                    <div className="rounded-xl border border-border/50 bg-background/80 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Profile Link Preview:</span>
                        <a
                          href={preview.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-action hover:underline"
                        >
                          Test link <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="font-mono text-[11px] text-foreground truncate select-all">
                        {preview.url}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlatform(null);
                        setInputValue("");
                      }}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving || !inputValue.trim()}
                      onClick={handleSave}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save handle"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
