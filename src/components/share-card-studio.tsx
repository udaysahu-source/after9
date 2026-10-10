import { useState, useEffect, useRef } from "react";
import {
  renderCardToCanvas,
  renderCardToBlob,
  type CardTemplate,
  type CardTheme,
  type CardCustomization,
  type ProfileCardData,
} from "@/lib/share-cards";
import { type SocialLinkRow } from "@/lib/social-links";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Sliders,
  Palette,
  Layout,
  ExternalLink,
  Instagram,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export function ShareCardStudio({
  open,
  onOpenChange,
  cardData,
  socialLinks = [],
  savedPreferences,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardData: ProfileCardData;
  socialLinks?: SocialLinkRow[];
  savedPreferences?: Partial<CardCustomization> | null;
  userId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"template" | "layout">("template");

  // Platform share instructions modal
  const [platformGuide, setPlatformGuide] = useState<"instagram" | "snapchat" | null>(null);

  const enabledSocials = socialLinks.filter((s) => s.is_enabled);

  const [config, setConfig] = useState<CardCustomization>({
    template: savedPreferences?.template || "editorial",
    theme: savedPreferences?.theme || "auto",
    focalY: savedPreferences?.focalY ?? 50,
    showCollege: savedPreferences?.showCollege ?? !!cardData.college,
    showPrompt: savedPreferences?.showPrompt ?? !!cardData.prompt,
    showNights: savedPreferences?.showNights ?? cardData.nights.length > 0,
    showSocials: savedPreferences?.showSocials ?? false,
    selectedSocial:
      savedPreferences?.selectedSocial ??
      (enabledSocials[0]
        ? { platform: enabledSocials[0].platform, handle: enabledSocials[0].handle }
        : null),
  });

  // Re-render preview canvas whenever config changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRendering(true);

    const canvas = canvasRef.current || document.createElement("canvas");
    renderCardToCanvas(canvas, cardData, config)
      .then(() => {
        if (cancelled) return;
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewUrl(dataUrl);
        setRendering(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Render error:", err);
        setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, cardData, config]);

  // Persist preferences to profile in background
  const savePrefs = (newConfig: CardCustomization) => {
    setConfig(newConfig);
    supabase
      .from("profiles")
      .update({
        card_preferences: newConfig as any,
      })
      .eq("id", userId)
      .then(() => {});
  };

  /** General Share (Native Web Share with File) */
  const handleGeneralShare = async () => {
    try {
      setRendering(true);
      const blob = await renderCardToBlob(cardData, config);
      const fileName = `after9-${cardData.name.toLowerCase().replace(/\s+/g, "-")}-card.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${cardData.name}'s After9 Festival Card`,
          text: `Find me on After9 for Navratri & Garba nights! ${cardData.shareUrl}`,
        });
        toast.success("Shared successfully!");
      } else {
        // Fallback: download image + copy link
        downloadBlob(blob, fileName);
        await navigator.clipboard.writeText(cardData.shareUrl);
        toast.success("Card downloaded & profile link copied!");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Sharing failed, downloading image instead.");
        handleSaveImage();
      }
    } finally {
      setRendering(false);
    }
  };

  /** Instagram Story flow */
  const handleInstagramShare = async () => {
    try {
      setRendering(true);
      const blob = await renderCardToBlob(cardData, config);
      const fileName = `after9-story-${cardData.name.toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "After9 Story",
            text: `Find me on After9: ${cardData.shareUrl}`,
          });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }

      // Fallback
      downloadBlob(blob, fileName);
      setPlatformGuide("instagram");
    } finally {
      setRendering(false);
    }
  };

  /** Snapchat flow */
  const handleSnapchatShare = async () => {
    try {
      setRendering(true);
      const blob = await renderCardToBlob(cardData, config);
      const fileName = `after9-snap-${cardData.name.toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "After9 Snapchat",
            text: cardData.shareUrl,
          });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }

      // Fallback
      downloadBlob(blob, fileName);
      setPlatformGuide("snapchat");
    } finally {
      setRendering(false);
    }
  };

  /** Save Image directly */
  const handleSaveImage = async () => {
    try {
      setRendering(true);
      const blob = await renderCardToBlob(cardData, config);
      const fileName = `after9-${cardData.name.toLowerCase().replace(/\s+/g, "-")}.png`;
      downloadBlob(blob, fileName);
      toast.success("Card saved to gallery! 📸");
    } catch {
      toast.error("Failed to generate image file.");
    } finally {
      setRendering(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(cardData.shareUrl);
      setCopiedLink(true);
      toast.success("Public profile link copied! 📋");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto border-border/80 bg-background/95 p-4 sm:p-6 backdrop-blur-md sm:rounded-3xl">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/20 text-action">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-action uppercase">
                  Social Identity Studio
                </p>
                <DialogTitle className="font-display text-xl font-extrabold text-primary">
                  Customize Your After9 Card
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Designed for 1080 × 1920 Instagram Story & WhatsApp Status. Export sharp, authentic social cards.
            </DialogDescription>
          </DialogHeader>

          {/* Main Grid: Live Preview (Left) & Controls (Right) */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Live 9:16 Card Preview */}
            <div className="md:col-span-6 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[9/16] overflow-hidden rounded-2xl border-2 border-border/80 bg-black shadow-lg">
                <canvas ref={canvasRef} className="hidden" />
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Card Preview"
                    className="h-full w-full object-cover transition-opacity duration-200"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-card text-xs text-muted-foreground">
                    Rendering card…
                  </div>
                )}
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs text-xs font-semibold text-white">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Updating…
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                1080 × 1920 Story Canvas · High-res PNG
              </p>
            </div>

            {/* Customization Controls */}
            <div className="md:col-span-6 flex flex-col gap-4">
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("template")}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5",
                    activeTab === "template"
                      ? "bg-background text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Style & Theme
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("layout")}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5",
                    activeTab === "layout"
                      ? "bg-background text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Content & Crop
                </button>
              </div>

              {activeTab === "template" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Template Picker */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Template
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { key: "editorial", label: "Editorial", desc: "Magazine display" },
                        { key: "minimal", label: "Minimal", desc: "Framed chic" },
                        { key: "festival", label: "Festival", desc: "Saffron glow" },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => savePrefs({ ...config, template: t.key as CardTemplate })}
                          className={cn(
                            "rounded-xl border p-2.5 text-left transition",
                            config.template === t.key
                              ? "border-action bg-action/10 text-primary ring-1 ring-action/30"
                              : "border-border bg-card/60 text-muted-foreground hover:border-action/40"
                          )}
                        >
                          <p className="font-bold text-xs">{t.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Picker */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Color Atmosphere
                    </label>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { key: "auto", label: "Auto (Photo)", swatch: "linear-gradient(135deg, #FF9E3B, #9C27B0)", isGradient: true },
                        { key: "plum", label: "Plum Dusk", swatch: "#2A1428", isGradient: false },
                        { key: "saffron", label: "Warm Saffron", swatch: "#4A1806", isGradient: false },
                        { key: "midnight", label: "Midnight", swatch: "#151518", isGradient: false },
                      ].map((th) => (
                        <button
                          key={th.key}
                          type="button"
                          onClick={() => savePrefs({ ...config, theme: th.key as CardTheme })}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border p-2 text-xs font-bold transition",
                            config.theme === th.key
                              ? "border-action bg-action/10 text-primary"
                              : "border-border bg-card/60 text-muted-foreground hover:border-action/40"
                          )}
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-white/20 shrink-0"
                            style={th.isGradient ? { background: th.swatch } : { backgroundColor: th.swatch }}
                          />
                          <span className="truncate">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "layout" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Photo Focal Crop Position */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Photo Focus Position
                      </label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {config.focalY <= 30 ? "Top" : config.focalY >= 70 ? "Bottom" : "Center"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.focalY}
                      onChange={(e) =>
                        savePrefs({ ...config, focalY: parseInt(e.target.value, 10) })
                      }
                      className="mt-2 w-full accent-action cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Top</span>
                      <span>Center</span>
                      <span>Bottom</span>
                    </div>
                  </div>

                  {/* Content Visibility Toggles */}
                  <div className="space-y-2 border-t border-border/70 pt-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Card Elements
                    </label>

                    <div className="space-y-1.5">
                      {cardData.college && (
                        <label className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-xs font-semibold cursor-pointer">
                          <span>Show College & Branch</span>
                          <input
                            type="checkbox"
                            checked={config.showCollege}
                            onChange={(e) =>
                              savePrefs({ ...config, showCollege: e.target.checked })
                            }
                            className="h-4 w-4 rounded accent-action"
                          />
                        </label>
                      )}

                      {cardData.prompt && (
                        <label className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-xs font-semibold cursor-pointer">
                          <span>Show Personality Prompt</span>
                          <input
                            type="checkbox"
                            checked={config.showPrompt}
                            onChange={(e) =>
                              savePrefs({ ...config, showPrompt: e.target.checked })
                            }
                            className="h-4 w-4 rounded accent-action"
                          />
                        </label>
                      )}

                      {cardData.nights.length > 0 && (
                        <label className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-xs font-semibold cursor-pointer">
                          <span>Show Garba Nights Attendance</span>
                          <input
                            type="checkbox"
                            checked={config.showNights}
                            onChange={(e) =>
                              savePrefs({ ...config, showNights: e.target.checked })
                            }
                            className="h-4 w-4 rounded accent-action"
                          />
                        </label>
                      )}

                      {enabledSocials.length > 0 && (
                        <div className="rounded-xl bg-card/70 p-3 space-y-2">
                          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                            <span>Show Social Handle on Card</span>
                            <input
                              type="checkbox"
                              checked={config.showSocials}
                              onChange={(e) =>
                                savePrefs({ ...config, showSocials: e.target.checked })
                              }
                              className="h-4 w-4 rounded accent-action"
                            />
                          </label>

                          {config.showSocials && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {enabledSocials.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() =>
                                    savePrefs({
                                      ...config,
                                      selectedSocial: { platform: s.platform, handle: s.handle },
                                    })
                                  }
                                  className={cn(
                                    "rounded-lg px-2.5 py-1 text-[11px] font-mono transition",
                                    config.selectedSocial?.handle === s.handle
                                      ? "bg-action text-action-foreground font-bold"
                                      : "bg-muted text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {s.handle}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Export & Sharing Actions */}
          <div className="mt-4 border-t border-border/80 pt-4 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Share & Export Card
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* 1. General Native Share */}
              <button
                type="button"
                disabled={rendering}
                onClick={handleGeneralShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98 disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>

              {/* 2. Instagram Story */}
              <button
                type="button"
                disabled={rendering}
                onClick={handleInstagramShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#E1306C] px-3 py-2.5 text-xs font-bold text-white shadow-xs transition hover:opacity-90 active:scale-98 disabled:opacity-50"
              >
                <Instagram className="h-3.5 w-3.5" />
                Instagram Story
              </button>

              {/* 3. Snapchat */}
              <button
                type="button"
                disabled={rendering}
                onClick={handleSnapchatShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#FFFC00] px-3 py-2.5 text-xs font-bold text-black shadow-xs transition hover:opacity-90 active:scale-98 disabled:opacity-50"
              >
                <span>👻</span>
                Snapchat
              </button>

              {/* 4. Save Image */}
              <button
                type="button"
                disabled={rendering}
                onClick={handleSaveImage}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted active:scale-98 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Save Image
              </button>

              {/* 5. Copy Profile Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted active:scale-98"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? "Link Copied!" : "Copy Link"}
              </button>

              {/* Public Preview Link */}
              <a
                href={cardData.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-action/40 bg-action/10 px-3 py-2.5 text-xs font-bold text-action transition hover:bg-action/20 text-center"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview Public
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guide Dialog for Instagram/Snapchat manual posting */}
      {platformGuide && (
        <Dialog open={!!platformGuide} onOpenChange={() => setPlatformGuide(null)}>
          <DialogContent className="max-w-sm rounded-2xl p-5">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-base font-extrabold text-primary">
                {platformGuide === "instagram" ? "📸 Add to Instagram Story" : "👻 Add to Snapchat"}
              </DialogTitle>
              <DialogDescription className="text-xs text-foreground/85 leading-relaxed">
                Your 1080 × 1920 card has been downloaded to your photo gallery.
              </DialogDescription>
            </DialogHeader>

            <ol className="list-decimal pl-4 text-xs space-y-2 text-foreground/90 my-2">
              <li>Open {platformGuide === "instagram" ? "Instagram" : "Snapchat"} on your phone.</li>
              <li>Tap <b>Your Story</b> or <b>Memories / Camera Roll</b>.</li>
              <li>Select your downloaded After9 card.</li>
              <li>
                Add your link sticker: <code className="font-mono text-action">{cardData.shareUrl}</code>
              </li>
              <li>Post to your story!</li>
            </ol>

            <button
              type="button"
              onClick={() => setPlatformGuide(null)}
              className="mt-2 w-full rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground"
            >
              Got it
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
