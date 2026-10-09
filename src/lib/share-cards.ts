import appIcon from "@/assets/app_icon.png";

export type CardTemplate = "editorial" | "minimal" | "festival";
export type CardTheme = "plum" | "saffron" | "midnight";

export type CardCustomization = {
  template: CardTemplate;
  theme: CardTheme;
  focalY: number; // 0 to 100 percentage for vertical focal crop
  showCollege: boolean;
  showPrompt: boolean;
  showNights: boolean;
  showSocials: boolean;
  selectedSocial?: {
    platform: string;
    handle: string;
  } | null;
};

export type ProfileCardData = {
  photoUrl: string | null;
  name: string;
  age: number | null;
  college: string | null;
  branch?: string | null;
  prompt: string | null;
  nights: number[];
  shareUrl: string;
  city?: string | null;
  generalArea?: string | null;
};

// Curated Palettes: Deep plum, royal maroon, warm cream/ivory, and warm saffron accents
export const THEMES: Record<
  CardTheme,
  {
    bgGradStart: string;
    bgGradEnd: string;
    accent: string;
    accentWarm: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    cardBorder: string;
    tagBg: string;
    photoBorder: string;
  }
> = {
  plum: {
    bgGradStart: "#260E27", // Royal deep plum
    bgGradEnd: "#120514",   // Velvet midnight
    accent: "#FF9E3B",      // Subtle festive saffron
    accentWarm: "#F3D5A5",  // Warm candlelight gold
    textPrimary: "#FAF4EA", // Warm rich ivory
    textSecondary: "rgba(250, 244, 234, 0.85)",
    textMuted: "rgba(250, 244, 234, 0.65)",
    cardBorder: "rgba(255, 158, 59, 0.28)",
    tagBg: "rgba(255, 158, 59, 0.16)",
    photoBorder: "rgba(250, 244, 234, 0.18)",
  },
  saffron: {
    bgGradStart: "#381108", // Rich terracotta maroon
    bgGradEnd: "#170402",   // Deep spiced plum
    accent: "#FFA726",      // Warm glowing saffron
    accentWarm: "#FFE2B3",  // Cream glow
    textPrimary: "#FFF9F2", // Pure warm cream
    textSecondary: "rgba(255, 249, 242, 0.88)",
    textMuted: "rgba(255, 249, 242, 0.65)",
    cardBorder: "rgba(255, 167, 38, 0.32)",
    tagBg: "rgba(255, 167, 38, 0.18)",
    photoBorder: "rgba(255, 167, 38, 0.25)",
  },
  midnight: {
    bgGradStart: "#160918", // Nocturnal plum-slate
    bgGradEnd: "#080209",   // Pure dark velvet
    accent: "#F2B880",      // Soft champagne saffron
    accentWarm: "#FDF4E7",  // Ivory
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.82)",
    textMuted: "rgba(255, 255, 255, 0.60)",
    cardBorder: "rgba(255, 255, 255, 0.22)",
    tagBg: "rgba(255, 255, 255, 0.10)",
    photoBorder: "rgba(255, 255, 255, 0.15)",
  },
};

async function loadFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load("800 96px Syne"),
        document.fonts.load("700 48px Syne"),
        document.fonts.load('600 40px "Plus Jakarta Sans"'),
        document.fonts.load('500 36px "Plus Jakarta Sans"'),
        document.fonts.ready,
      ]),
      new Promise((res) => setTimeout(res, 500)),
    ]);
  } catch {
    /* fallback to system fonts */
  }
}

/** Safely load image with CORS and fallback to object URL blob fetch if needed */
async function loadImgSafe(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, 2000);

    const finish = (result: HTMLImageElement | null) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => finish(img);
    img.onerror = async () => {
      try {
        const res = await fetch(src, { mode: "cors" });
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          URL.revokeObjectURL(objUrl);
          finish(fallbackImg);
        };
        fallbackImg.onerror = () => {
          URL.revokeObjectURL(objUrl);
          finish(null);
        };
        fallbackImg.src = objUrl;
      } catch {
        finish(null);
      }
    };
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Compute actual availability copy based on profile attendance dates */
function getGarbaAvailabilityText(d: ProfileCardData): {
  headline: string;
  pillText: string | null;
} {
  const count = d.nights?.length ?? 0;
  if (count === 9) {
    return {
      headline: "I'm in for Garba every night.",
      pillText: "All 9 Garba Nights",
    };
  }
  if (count > 0) {
    return {
      headline: "I'm in for Garba tonight.",
      pillText: `${count} ${count === 1 ? "Night" : "Nights"} on the floor`,
    };
  }
  return {
    headline: "Looking for Garba plans.",
    pillText: null,
  };
}

/** Formats the user's location cleanly */
function getLocationText(d: ProfileCardData): string {
  if (d.generalArea && d.city) {
    return `📍 ${d.generalArea}, ${d.city}`;
  }
  if (d.generalArea) {
    return `📍 ${d.generalArea}`;
  }
  return `📍 ${d.city || "Raipur"}`;
}

/** Renders the card into the given canvas at exact 1080 × 1920 */
export async function renderCardToCanvas(
  canvas: HTMLCanvasElement,
  d: ProfileCardData,
  c: CardCustomization
): Promise<void> {
  await loadFonts();
  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d")!;
  const theme = THEMES[c.theme] || THEMES.plum;

  // 1. Draw Canvas Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.bgGradStart);
  bgGrad.addColorStop(1, theme.bgGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const [icon, photo] = await Promise.all([
    loadImgSafe(appIcon),
    d.photoUrl ? loadImgSafe(d.photoUrl) : null,
  ]);

  if (c.template === "editorial") {
    await renderEditorialTemplate(ctx, W, H, d, c, theme, icon, photo);
  } else if (c.template === "minimal") {
    await renderMinimalTemplate(ctx, W, H, d, c, theme, icon, photo);
  } else {
    await renderFestivalTemplate(ctx, W, H, d, c, theme, icon, photo);
  }
}

/**
 * Template 1: EDITORIAL
 * Stylish, youthful festive invitation with full-bleed photo centerpiece,
 * clear Garba availability, location, and elegant typography.
 */
async function renderEditorialTemplate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: ProfileCardData,
  c: CardCustomization,
  theme: (typeof THEMES)["plum"],
  icon: HTMLImageElement | null,
  photo: HTMLImageElement | null
) {
  // Safe Story margins:
  // Top header: Y ~ 140px
  // Photo box: Y = 210 to Y = 1270 (height: 1060px)
  const px = 64;
  const py = 210;
  const pw = W - px * 2; // 952px
  const ph = 1060;

  // 1. Top Section — "GARBA PLANS?" Header Tag
  ctx.textAlign = "left";
  ctx.fillStyle = theme.accent;
  ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("GARBA PLANS?", px + 4, py - 40);

  ctx.textAlign = "right";
  ctx.fillStyle = theme.textMuted;
  ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("NAVRATRI 2026", W - px - 4, py - 40);

  // 2. Large Photo Centerpiece
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 42);
  ctx.clip();

  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;

    const focalRatio = Math.max(0, Math.min(100, c.focalY)) / 100;
    const overflowY = dh - ph;
    const dy = py - overflowY * focalRatio;
    const dx = px + (pw - dw) / 2;

    ctx.drawImage(photo, dx, dy, dw, dh);
  } else {
    // Elegant warm photo placeholder with initial
    ctx.fillStyle = "#2A102A";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = theme.accentWarm;
    ctx.font = "800 240px Syne, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.name || "A").slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 80);
  }

  // Smooth dark fade scrim at bottom of photo for text contrast
  const scrim = ctx.createLinearGradient(0, py + ph - 440, 0, py + ph);
  scrim.addColorStop(0, "rgba(18, 5, 20, 0)");
  scrim.addColorStop(0.5, "rgba(18, 5, 20, 0.75)");
  scrim.addColorStop(1, "rgba(18, 5, 20, 0.98)");
  ctx.fillStyle = scrim;
  ctx.fillRect(px, py + ph - 440, pw, 440);
  ctx.restore();

  // Subtle border around photo
  ctx.strokeStyle = theme.photoBorder;
  ctx.lineWidth = 2.5;
  roundRect(ctx, px, py, pw, ph, 42);
  ctx.stroke();

  // 3. Name & Age (rendered on photo scrim)
  ctx.textAlign = "left";
  ctx.fillStyle = theme.textPrimary;
  const displayName = `${d.name}${d.age ? `, ${d.age}` : ""}`;
  let nameSize = 88;
  ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  while (ctx.measureText(displayName).width > pw - 80 && nameSize > 52) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  }
  ctx.fillText(displayName, px + 44, py + ph - 130);

  // College or subline on photo (if enabled)
  if (c.showCollege && d.college) {
    ctx.fillStyle = theme.accentWarm;
    ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
    const collegeLine = `${d.college}${d.branch ? ` · ${d.branch}` : ""}`;
    const truncatedCollege =
      ctx.measureText(collegeLine).width > pw - 88
        ? collegeLine.slice(0, 36) + "…"
        : collegeLine;
    ctx.fillText(truncatedCollege, px + 44, py + ph - 70);
  }

  // 4. Content Below Photo
  let curY = py + ph + 68;

  // Garba Availability Headline: "I'm in for Garba tonight."
  const avail = getGarbaAvailabilityText(d);
  ctx.fillStyle = theme.textPrimary;
  ctx.font = '700 48px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(avail.headline, px + 8, curY);
  curY += 58;

  // Location Tag: 📍 Raipur
  ctx.fillStyle = theme.accent;
  ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(getLocationText(d), px + 8, curY);
  curY += 54;

  // Personality Prompt (if enabled)
  if (c.showPrompt && d.prompt) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = 'italic 500 36px "Plus Jakarta Sans", sans-serif';
    const promptLines = wrapText(ctx, `“${d.prompt}”`, pw - 20).slice(0, 2);
    for (const l of promptLines) {
      ctx.fillText(l, px + 8, curY);
      curY += 46;
    }
    curY += 10;
  }

  // Memorable Callout / Vibe Note
  ctx.fillStyle = theme.accentWarm;
  ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Let's make tonight memorable ✨", px + 8, curY);
  curY += 50;

  // Social Handle Pill (if enabled)
  if (c.showSocials && c.selectedSocial?.handle) {
    const handleText = `${c.selectedSocial.handle}`;
    ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
    const pillW = ctx.measureText(handleText).width + 56;
    const pillH = 50;
    roundRect(ctx, px + 8, curY, pillW, pillH, 25);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(handleText, px + 36, curY + 35);
  }

  // 5. Clean Editorial Footer
  const footerY = H - 160;
  if (icon) {
    ctx.save();
    roundRect(ctx, px + 8, footerY, 60, 60, 16);
    ctx.clip();
    ctx.drawImage(icon, px + 8, footerY, 60, 60);
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = theme.textPrimary;
  ctx.font = "800 38px Syne, sans-serif";
  ctx.fillText("AFTER9", px + (icon ? 84 : 8), footerY + 44);

  ctx.textAlign = "right";
  ctx.fillStyle = theme.accent;
  ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Meet on the floor", W - px - 8, footerY + 44);
}

/**
 * Template 2: MINIMAL
 * Refined framing, centered portrait, elegant whitespace, warm plum-gold palette.
 */
async function renderMinimalTemplate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: ProfileCardData,
  c: CardCustomization,
  theme: (typeof THEMES)["plum"],
  icon: HTMLImageElement | null,
  photo: HTMLImageElement | null
) {
  // Outer delicate frame
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 2;
  roundRect(ctx, 50, 100, W - 100, H - 200, 44);
  ctx.stroke();

  // Top Title
  ctx.textAlign = "center";
  ctx.fillStyle = theme.accent;
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("GARBA PLANS?", W / 2, 160);

  // Centered Photo Box
  const px = 100;
  const py = 210;
  const pw = W - px * 2; // 880px
  const ph = 980;

  ctx.save();
  roundRect(ctx, px, py, pw, ph, 38);
  ctx.clip();

  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    const focalRatio = Math.max(0, Math.min(100, c.focalY)) / 100;
    const overflowY = dh - ph;
    const dy = py - overflowY * focalRatio;
    const dx = px + (pw - dw) / 2;
    ctx.drawImage(photo, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#250F26";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = theme.accentWarm;
    ctx.font = "800 220px Syne, sans-serif";
    ctx.fillText((d.name || "A").slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 75);
  }
  ctx.restore();

  // Thin photo outline
  ctx.strokeStyle = theme.photoBorder;
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 38);
  ctx.stroke();

  let curY = py + ph + 85;

  // Name & Age (Centered)
  ctx.textAlign = "center";
  ctx.fillStyle = theme.textPrimary;
  const displayName = `${d.name}${d.age ? `, ${d.age}` : ""}`;
  let nameSize = 84;
  ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  while (ctx.measureText(displayName).width > pw - 80 && nameSize > 50) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  }
  ctx.fillText(displayName, W / 2, curY);
  curY += 60;

  // Garba Availability Headline
  const avail = getGarbaAvailabilityText(d);
  ctx.fillStyle = theme.accentWarm;
  ctx.font = 'italic 600 42px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(avail.headline, W / 2, curY);
  curY += 54;

  // Location
  ctx.fillStyle = theme.accent;
  ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(getLocationText(d), W / 2, curY);
  curY += 52;

  // Prompt (if enabled)
  if (c.showPrompt && d.prompt) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = 'italic 500 34px "Plus Jakarta Sans", sans-serif';
    const lines = wrapText(ctx, `“${d.prompt}”`, pw - 60).slice(0, 2);
    for (const l of lines) {
      ctx.fillText(l, W / 2, curY);
      curY += 46;
    }
    curY += 8;
  }

  // Vibe Statement
  ctx.fillStyle = theme.textPrimary;
  ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Let's make tonight memorable ✨", W / 2, curY);
  curY += 50;

  // Social handle
  if (c.showSocials && c.selectedSocial?.handle) {
    ctx.fillStyle = theme.accentWarm;
    ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${c.selectedSocial.handle}`, W / 2, curY);
  }

  // Footer
  const footerY = H - 150;
  ctx.fillStyle = theme.textMuted;
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("AFTER9 · Meet on the floor", W / 2, footerY);
}

/**
 * Template 3: FESTIVAL
 * Warm celebratory radiance, subtle festive glow, bold festive status badge.
 */
async function renderFestivalTemplate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: ProfileCardData,
  c: CardCustomization,
  theme: (typeof THEMES)["plum"],
  icon: HTMLImageElement | null,
  photo: HTMLImageElement | null
) {
  // Soft ambient radial glow
  const glow = ctx.createRadialGradient(W / 2, 600, 60, W / 2, 600, 650);
  glow.addColorStop(0, "rgba(255, 158, 59, 0.22)");
  glow.addColorStop(0.7, "rgba(224, 90, 50, 0.08)");
  glow.addColorStop(1, "rgba(38, 14, 39, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top Tag
  const px = 64;
  const py = 200;
  const pw = W - px * 2;
  const ph = 1040;

  ctx.textAlign = "center";
  ctx.fillStyle = theme.accent;
  ctx.font = "800 34px Syne, sans-serif";
  ctx.fillText("GARBA PLANS?", W / 2, 145);

  // Photo
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 44);
  ctx.clip();

  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    const focalRatio = Math.max(0, Math.min(100, c.focalY)) / 100;
    const overflowY = dh - ph;
    const dy = py - overflowY * focalRatio;
    const dx = px + (pw - dw) / 2;
    ctx.drawImage(photo, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#33121D";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = theme.accentWarm;
    ctx.font = "800 240px Syne, sans-serif";
    ctx.fillText((d.name || "A").slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 80);
  }

  // Bottom photo fade
  const fade = ctx.createLinearGradient(0, py + ph - 420, 0, py + ph);
  fade.addColorStop(0, "rgba(25, 6, 20, 0)");
  fade.addColorStop(0.6, "rgba(25, 6, 20, 0.82)");
  fade.addColorStop(1, "rgba(25, 6, 20, 0.98)");
  ctx.fillStyle = fade;
  ctx.fillRect(px, py + ph - 420, pw, 420);
  ctx.restore();

  // Subtle festive photo border
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 3;
  roundRect(ctx, px, py, pw, ph, 44);
  ctx.stroke();

  // Name & Age over photo fade
  ctx.textAlign = "left";
  ctx.fillStyle = theme.textPrimary;
  const displayName = `${d.name}${d.age ? `, ${d.age}` : ""}`;
  let nameSize = 90;
  ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  while (ctx.measureText(displayName).width > pw - 80 && nameSize > 52) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  }
  ctx.fillText(displayName, px + 44, py + ph - 130);

  if (c.showCollege && d.college) {
    ctx.fillStyle = theme.accent;
    ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${d.college}${d.branch ? ` · ${d.branch}` : ""}`, px + 44, py + ph - 68);
  }

  // Bottom Festival Section
  let curY = py + ph + 70;

  // Availability Headline
  const avail = getGarbaAvailabilityText(d);
  ctx.fillStyle = theme.textPrimary;
  ctx.font = '700 48px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(avail.headline, px + 8, curY);
  curY += 58;

  // Location
  ctx.fillStyle = theme.accent;
  ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(getLocationText(d), px + 8, curY);
  curY += 54;

  // Prompt (if enabled)
  if (c.showPrompt && d.prompt) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = 'italic 500 36px "Plus Jakarta Sans", sans-serif';
    const lines = wrapText(ctx, `“${d.prompt}”`, pw - 20).slice(0, 2);
    for (const l of lines) {
      ctx.fillText(l, px + 8, curY);
      curY += 46;
    }
    curY += 10;
  }

  // Vibe Line
  ctx.fillStyle = theme.accentWarm;
  ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Let's make tonight memorable ✨", px + 8, curY);
  curY += 52;

  // Attendance Nights Chip (if enabled)
  if (c.showNights && avail.pillText) {
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    const chipText = `💃 ${avail.pillText}`;
    const chipW = ctx.measureText(chipText).width + 60;
    const chipH = 50;

    roundRect(ctx, px + 8, curY, chipW, chipH, 25);
    ctx.fillStyle = theme.tagBg;
    ctx.fill();
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.fillText(chipText, px + 36, curY + 35);
  }

  // Footer: After9
  const footerY = H - 160;
  ctx.textAlign = "center";
  ctx.fillStyle = theme.textPrimary;
  ctx.font = "800 44px Syne, sans-serif";
  ctx.fillText("AFTER9", W / 2, footerY + 20);

  ctx.fillStyle = theme.accent;
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("MEET ON THE FLOOR", W / 2, footerY + 60);
}

/** Render card directly to Blob */
export async function renderCardToBlob(
  d: ProfileCardData,
  c: CardCustomization
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderCardToCanvas(canvas, d, c);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob rendering failed"));
      },
      "image/png",
      0.95
    );
  });
}

/** Legacy wrapper */
export async function drawProfileCard(d: ProfileCardData): Promise<"shared" | "downloaded"> {
  const blob = await renderCardToBlob(d, {
    template: "editorial",
    theme: "plum",
    focalY: 50,
    showCollege: !!d.college,
    showPrompt: !!d.prompt,
    showNights: d.nights.length > 0,
    showSocials: false,
  });

  const file = new File([blob], `after9-${d.name.toLowerCase()}-card.png`, {
    type: "image/png",
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${d.name}'s After9 Garba Card`,
        text: `Find me on After9 — ${d.shareUrl}`,
      });
      return "shared";
    } catch {
      /* fallback to download */
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `after9-${d.name.toLowerCase()}-card.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded";
}

/** Legacy support: Invite card generator */
export async function drawInviteCard(code: string, url: string): Promise<"shared" | "downloaded"> {
  await loadFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#260E27");
  g.addColorStop(1, "#120514");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const icon = await loadImgSafe(appIcon);

  if (icon) {
    const s = 280;
    ctx.save();
    roundRect(ctx, (W - s) / 2, 180, s, s, 64);
    ctx.clip();
    ctx.drawImage(icon, (W - s) / 2, 180, s, s);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#FAF4EA";
  ctx.font = "800 110px Syne, sans-serif";
  ctx.fillText("AFTER9", W / 2, 600);

  ctx.fillStyle = "#FF9E3B";
  ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Meet on the floor. Stay after.", W / 2, 680);

  // Code pill
  ctx.font = "800 84px Syne, sans-serif";
  const codeW = ctx.measureText(code).width + 140;
  roundRect(ctx, (W - codeW) / 2, 770, codeW, 150, 75);
  ctx.strokeStyle = "#FF9E3B";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#FAF4EA";
  ctx.fillText(code, W / 2, 875);

  ctx.fillStyle = "rgba(250, 244, 234, 0.75)";
  ctx.font = '500 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Join me on After9 for Navratri", W / 2, 1020);
  ctx.fillStyle = "#FF9E3B";
  ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(url.replace(/^https?:\/\//, "").replace(/[&]src=card$/, ""), W / 2, 1090);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Couldn't create the image.");
  const file = new File([blob], `after9-invite-${code}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "After9 invite",
        text: `Join me on After9 — ${url}`,
      });
      return "shared";
    } catch {
      /* fallback */
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `after9-invite-${code}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded";
}

