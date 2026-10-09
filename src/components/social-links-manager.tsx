import { useState, useEffect } from "react";
import {
  getMySocialLinks,
  upsertSocialLink,
  updateSocialLinkVisibility,
  toggleSocialLinkEnabled,
  deleteSocialLink,
  validateAndNormalizeSocial,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialVisibility,
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
  Share2,
  Users,
  Check,
  Globe,
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

const VISIBILITY_OPTIONS: {
  key: SocialVisibility;
  label: string;
  icon: typeof Lock;
  description: string;
}[] = [
  {
    key: "private",
    label: "Private",
    icon: Lock,
    description: "Only you can see this handle. Never shared automatically.",
  },
  {
    key: "share_card",
    label: "Share Card",
    icon: Share2,
    description: "Included when you export or share your festival Story Card.",
  },
  {
    key: "matched",
    label: "Matched Connections",
    icon: Users,
    description: "Visible only to mutual matches when consent requirements are met.",
  },
];

export function SocialLinksManager({
  userId,
  onLinksChanged,
  compact = false,
}: {
  userId: string;
  onLinksChanged?: (links: SocialLinkRow[]) => void;
  compact?: boolean;
}) {
  const [links, setLinks] = useState<SocialLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlatform, setEditingPlatform] = useState<SocialPlatform | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedVisibility, setSelectedVisibility] = useState<SocialVisibility>("private");
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
    setSelectedVisibility(existing?.visibility || "private");
  };

  const handleSave = async () => {
    if (!editingPlatform) return;
    const { valid, error, handle, url } = validateAndNormalizeSocial(editingPlatform, inputValue);
    if (!valid) {
      toast.error(error || "Invalid handle");
      return;
    }

    setSaving(true);
    const res = await upsertSocialLink(
      userId,
      editingPlatform,
      handle,
      url,
      true,
      selectedVisibility
    );
    setSaving(false);

    if (res.ok) {
      toast.success(`${editingPlatform} handle saved (${selectedVisibility})!`);
      setEditingPlatform(null);
      setInputValue("");
      setSelectedVisibility("private");
      load();
    } else {
      toast.error(res.error || "Failed to save link");
    }
  };

  const handleChangeVisibility = async (link: SocialLinkRow, nextVis: SocialVisibility) => {
    const ok = await updateSocialLinkVisibility(link.id, userId, nextVis);
    if (ok) {
      toast.success(`Visibility set to ${nextVis.replace("_", " ")}`);
      load();
    } else {
      toast.error("Failed to update visibility");
    }
  };

  const handleToggle = async (link: SocialLinkRow) => {
    const nextVal = !link.is_enabled;
    const ok = await toggleSocialLinkEnabled(link.id, userId, nextVal);
    if (ok) {
      toast.success(nextVal ? "Handle enabled" : "Handle hidden");
      load();
    } else {
      toast.error("Failed to update status");
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

  const preview = editingPlatform ? validateAndNormalizeSocial(editingPlatform, inputValue) : null;

  return (
    <div className="space-y-4">
      {/* Supporting Copy Box */}
      <div className="rounded-2xl border border-border/80 bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-action tracking-wider uppercase mb-1">
          <Lock className="h-3.5 w-3.5" />
          <span>Your privacy, your control</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect your social profiles if you want. You decide who can see them, and you can change your choices anytime. All handles default to private.
        </p>
      </div>

      {/* Social Platforms List */}
      <div className="space-y-3">
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{plat.name}</p>
                      {existing && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            existing.visibility === "private" && "bg-muted text-muted-foreground",
                            existing.visibility === "share_card" && "bg-action/15 text-action",
                            existing.visibility === "matched" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          )}
                        >
                          {existing.visibility === "private" && "🔒 Private"}
                          {existing.visibility === "share_card" && "🎴 Share Card"}
                          {existing.visibility === "matched" && "🤝 Matched"}
                        </span>
                      )}
                    </div>
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
                      {/* Status Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(existing)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold transition",
                          existing.is_enabled
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        )}
                        title="Enable or disable handle"
                      >
                        {existing.is_enabled ? "Active" : "Off"}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartAdd(plat.key)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition"
                        title="Edit handle and visibility"
                      >
                        ✎
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(existing)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition"
                        title="Remove handle"
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

              {/* Quick Visibility Selector if already configured */}
              {existing && !isEditing && (
                <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="text-[11px]">Visibility:</span>
                  <div className="flex items-center gap-1">
                    {(["private", "share_card", "matched"] as SocialVisibility[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleChangeVisibility(existing, v)}
                        className={cn(
                          "rounded-lg px-2 py-0.5 text-[10px] font-medium transition",
                          existing.visibility === v
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-muted text-muted-foreground"
                        )}
                      >
                        {v === "private" ? "Private" : v === "share_card" ? "Card" : "Matched"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline Editor Drawer */}
              {isEditing && (
                <div className="mt-3.5 border-t border-border/70 pt-3 space-y-3.5 animate-fade-in">
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

                  {/* Normalized Link Preview */}
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

                  {/* Visibility Controls */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Choose Visibility
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {VISIBILITY_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = selectedVisibility === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setSelectedVisibility(opt.key)}
                            className={cn(
                              "flex items-start gap-2.5 rounded-xl border p-2 text-left transition",
                              isSelected
                                ? "border-action bg-action/10 text-primary"
                                : "border-border/60 bg-background/60 hover:bg-muted/40"
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", isSelected ? "text-action" : "text-muted-foreground")} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                                {opt.label}
                                {opt.key === "private" && (
                                  <span className="text-[10px] font-normal text-muted-foreground">(Default)</span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
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
