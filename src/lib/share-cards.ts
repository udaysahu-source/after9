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
};

// Brand Colors
const THEMES: Record<
  CardTheme,
  {
    bgGradStart: string;
    bgGradEnd: string;
    accent: string;
    textPrimary: string;
    textSecondary: string;
    cardBorder: string;
    tagBg: string;
  }
> = {
  plum: {
    bgGradStart: "#2A1428",
    bgGradEnd: "#140816",
    accent: "#E8963C",
    textPrimary: "#FAF5EE",
    textSecondary: "rgba(250, 245, 238, 0.78)",
    cardBorder: "rgba(232, 150, 60, 0.35)",
    tagBg: "rgba(232, 150, 60, 0.15)",
  },
  saffron: {
    bgGradStart: "#4A1806",
    bgGradEnd: "#200A02",
    accent: "#F26419",
    textPrimary: "#FFF9F2",
    textSecondary: "rgba(255, 249, 242, 0.8)",
    cardBorder: "rgba(242, 100, 25, 0.4)",
    tagBg: "rgba(242, 100, 25, 0.2)",
  },
  midnight: {
    bgGradStart: "#151518",
    bgGradEnd: "#0A0A0C",
    accent: "#E59866",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.72)",
    cardBorder: "rgba(255, 255, 255, 0.25)",
    tagBg: "rgba(255, 255, 255, 0.1)",
  },
};

const ROSE = "#E2547A";

async function loadFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('800 96px Syne'),
        document.fonts.load('700 48px Syne'),
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
    }, 1500);

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
      // Fallback: try fetching as blob to bypass canvas tainting
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

/** Dandiya stroke marks */
function drawMarks(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = ROSE) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.5);
  ctx.lineTo(x + s, y - s * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.35, y + s * 1.05);
  ctx.lineTo(x + s * 1.35, y + s * 0.35);
  ctx.stroke();
  ctx.restore();
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

/** Template 1: EDITORIAL (High-fashion, full-bleed portrait with gradient fade and bold display typography) */
async function renderEditorialTemplate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: ProfileCardData,
  c: CardCustomization,
  theme: typeof THEMES.plum,
  icon: HTMLImageElement | null,
  photo: HTMLImageElement | null
) {
  // Safe margins for Story interfaces:
  // Top: 140px safe zone
  // Bottom: 220px safe zone

  // Photo Box: Full width with subtle margin
  const px = 60,
    py = 140,
    pw = W - 120,
    ph = 1140;

  ctx.save();
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.clip();

  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;

    // Apply focal point Y offset
    const focalRatio = Math.max(0, Math.min(100, c.focalY)) / 100;
    const overflowY = dh - ph;
    const dy = py - overflowY * focalRatio;
    const dx = px + (pw - dw) / 2;

    ctx.drawImage(photo, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#261329";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = theme.textPrimary;
    ctx.font = '800 240px Syne, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText((d.name || "A").slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 80);
  }

  // Cinematic dark fade scrim at bottom of photo
  const fade = ctx.createLinearGradient(0, py + ph - 420, 0, py + ph);
  fade.addColorStop(0, "rgba(20,8,22,0)");
  fade.addColorStop(0.65, "rgba(20,8,22,0.85)");
  fade.addColorStop(1, "rgba(20,8,22,0.98)");
  ctx.fillStyle = fade;
  ctx.fillRect(px, py + ph - 420, pw, 420);
  ctx.restore();

  // Top Bar: Story Header Tag
  ctx.textAlign = "left";
  ctx.fillStyle = theme.accent;
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = "4px";
  ctx.fillText("AFTER9 FESTIVAL PASS", px + 10, py - 30);

  ctx.textAlign = "right";
  ctx.fillStyle = theme.textSecondary;
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("NAVRATRI '26 · RAIPUR", W - px - 10, py - 30);

  // Name & Age over photo fade
  ctx.textAlign = "left";
  ctx.fillStyle = theme.textPrimary;

  // Dynamic font sizing for long names
  const displayName = `${d.name}${d.age ? `, ${d.age}` : ""}`;
  let nameFontSize = 92;
  ctx.font = `800 ${nameFontSize}px Syne, sans-serif`;
  while (ctx.measureText(displayName).width > pw - 80 && nameFontSize > 56) {
    nameFontSize -= 4;
    ctx.font = `800 ${nameFontSize}px Syne, sans-serif`;
  }
  ctx.fillText(displayName, px + 44, py + ph - 130);

  // College & Branch
  if (c.showCollege && d.college) {
    ctx.fillStyle = theme.accent;
    ctx.font = '600 36px "Plus Jakarta Sans", sans-serif';
    const collegeLine = `${d.college}${d.branch ? ` · ${d.branch}` : ""}`;
    ctx.fillText(collegeLine, px + 44, py + ph - 65);
  }

  // Bottom Content Section:
  let curY = py + ph + 80;

  // Personality Prompt
  if (c.showPrompt && d.prompt) {
    ctx.fillStyle = theme.textPrimary;
    ctx.font = 'italic 500 44px "Plus Jakarta Sans", sans-serif';
    const lines = wrapText(ctx, `“${d.prompt}”`, W - 160).slice(0, 2);
    for (const l of lines) {
      ctx.fillText(l, px + 10, curY);
      curY += 60;
    }
    curY += 20;
  }

  // Attendance Nights Chips
  if (c.showNights && d.nights.length > 0) {
    ctx.fillStyle = theme.tagBg;
    const tagH = 54;
    const nightText = `💃 Attending ${d.nights.length} of 9 Garba Nights`;
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    const tagW = ctx.measureText(nightText).width + 50;

    roundRect(ctx, px + 10, curY, tagW, tagH, 27);
    ctx.fill();
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.fillText(nightText, px + 35, curY + 37);

    curY += tagH + 30;
  }

  // Optional Social Handle Badge
  if (c.showSocials && c.selectedSocial?.handle) {
    const handleText = `${c.selectedSocial.handle}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
    const tagW = ctx.measureText(handleText).width + 60;
    roundRect(ctx, px + 10, curY, tagW, 52, 26);
    ctx.fill();

    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(handleText, px + 40, curY + 36);
  }

  // Story Footer Watermark:
  const footerY = H - 180;
  if (icon) {
    ctx.save();
    roundRect(ctx, px + 10, footerY, 74, 74, 20);
    ctx.clip();
    ctx.drawImage(icon, px + 10, footerY, 74, 74);
    ctx.restore();
  }

  ctx.fillStyle = theme.textPrimary;
  ctx.font = '800 42px Syne, sans-serif';
  ctx.fillText("AFTER9", px + 105, footerY + 52);

  ctx.textAlign = "right";
  ctx.fillStyle = theme.accent;
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("meet on the floor · stay after", W - px - 10, footerY + 50);

  drawMarks(ctx, W - px - 120, footerY - 45, 50, theme.accent);
}

/** Template 2: MINIMAL (Warm ivory/plum framing, refined portrait, understated elegance) */
async function renderMinimalTemplate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: ProfileCardData,
  c: CardCustomization,
  theme: typeof THEMES.plum,
  icon: HTMLImageElement | null,
  photo: HTMLImageElement | null
) {
  const px = 90,
    py = 170,
    pw = W - 180,
    ph = 1040;

  // Subtle Outer Border Frame
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 3;
  roundRect(ctx, 60, 100, W - 120, H - 240, 48);
  ctx.stroke();

  // Header
  ctx.textAlign = "center";
  ctx.fillStyle = theme.accent;
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = "6px";
  ctx.fillText("AFTER9 · NAVRATRI 2026", W / 2, 145);

  // Photo frame
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 36);
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
    ctx.fillStyle = "#261329";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = theme.textPrimary;
    ctx.font = '800 220px Syne, sans-serif';
    ctx.fillText((d.name || "A").slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 75);
  }
  ctx.restore();

  // Subtle border around photo
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 36);
  ctx.stroke();

  let curY = py + ph + 85;

  // Name & Age (Centered)
  ctx.textAlign = "center";
  ctx.fillStyle = theme.textPrimary;
  const displayName = `${d.name}${d.age ? `, ${d.age}` : ""}`;
  let nameSize = 88;
  ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  while (ctx.measureText(displayName).width > W - 220 && nameSize > 54) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  }
  ctx.fillText(displayName, W / 2, curY);
  curY += 56;

  // College
  if (c.showCollege && d.college) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '500 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${d.college}${d.branch ? ` · ${d.branch}` : ""}`, W / 2, curY);
    curY += 56;
  }

  // Prompt
  if (c.showPrompt && d.prompt) {
    curY += 15;
    ctx.fillStyle = theme.accent;
    ctx.font = 'italic 500 40px "Plus Jakarta Sans", sans-serif';
    const lines = wrapText(ctx, `“${d.prompt}”`, W - 280).slice(0, 2);
    for (const l of lines) {
      ctx.fillText(l, W / 2, curY);
      curY += 54;
    }
  }

  // Attendance
  if (c.showNights && d.nights.length > 0) {
    curY += 20;
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`✨ Dancing on ${d.nights.length} Nights`, W / 2, curY);
    curY += 45;
  }

  // Social
  if (c.showSocials && c.selectedSocial?.handle) {
    ctx.fillStyle = theme.textPrimary;
    ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${c.selectedSocial.handle}`, W / 2, curY);
  }

  // Bottom Branding
  ctx.fillStyle = theme.textSecondary;
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("after9.in", W / 2, H - 170);
}

/** Template 3: FESTIVAL (Warm saffron & terracotta glow, dandiya clack marks, vibrant festival atmosphere) */
async function renderFestivalTemplate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: ProfileCardData,
  c: CardCustomization,
  theme: typeof THEMES.plum,
  icon: HTMLImageElement | null,
  photo: HTMLImageElement | null
) {
  // Festive Radial Glow in Background
  const glow = ctx.createRadialGradient(W / 2, 600, 50, W / 2, 600, 600);
  glow.addColorStop(0, "rgba(242, 100, 25, 0.25)");
  glow.addColorStop(1, "rgba(242, 100, 25, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Festive Motion Marks in background corners
  drawMarks(ctx, 80, 100, 80, "rgba(242, 100, 25, 0.5)");
  drawMarks(ctx, W - 180, 120, 80, "rgba(226, 84, 122, 0.5)");

  const px = 70,
    py = 180,
    pw = W - 140,
    ph = 1100;

  // Header Ribbon
  ctx.textAlign = "center";
  ctx.fillStyle = theme.accent;
  ctx.font = '800 32px Syne, sans-serif';
  ctx.letterSpacing = "5px";
  ctx.fillText("NINE NIGHTS OF DANCE", W / 2, 130);

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
    ctx.fillStyle = "#38180A";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = theme.textPrimary;
    ctx.font = '800 240px Syne, sans-serif';
    ctx.fillText((d.name || "A").slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 80);
  }

  // Warm saffron/plum fade
  const fade = ctx.createLinearGradient(0, py + ph - 420, 0, py + ph);
  fade.addColorStop(0, "rgba(36,10,2,0)");
  fade.addColorStop(0.7, "rgba(36,10,2,0.85)");
  fade.addColorStop(1, "rgba(36,10,2,0.98)");
  ctx.fillStyle = fade;
  ctx.fillRect(px, py + ph - 420, pw, 420);
  ctx.restore();

  // Photo border in saffron
  ctx.strokeStyle = "rgba(242, 100, 25, 0.4)";
  ctx.lineWidth = 3;
  roundRect(ctx, px, py, pw, ph, 44);
  ctx.stroke();

  // Name & Age over photo fade
  ctx.textAlign = "left";
  ctx.fillStyle = theme.textPrimary;
  const displayName = `${d.name}${d.age ? `, ${d.age}` : ""}`;
  let nameSize = 92;
  ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  while (ctx.measureText(displayName).width > pw - 80 && nameSize > 56) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px Syne, sans-serif`;
  }
  ctx.fillText(displayName, px + 44, py + ph - 130);

  if (c.showCollege && d.college) {
    ctx.fillStyle = theme.accent;
    ctx.font = '600 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${d.college}${d.branch ? ` · ${d.branch}` : ""}`, px + 44, py + ph - 65);
  }

  // Bottom Festival Information
  let curY = py + ph + 85;

  if (c.showPrompt && d.prompt) {
    ctx.fillStyle = theme.textPrimary;
    ctx.font = 'italic 500 42px "Plus Jakarta Sans", sans-serif';
    const lines = wrapText(ctx, `“${d.prompt}”`, W - 180).slice(0, 2);
    for (const l of lines) {
      ctx.fillText(l, px + 20, curY);
      curY += 58;
    }
    curY += 20;
  }

  // Festive Nights Row
  if (c.showNights && d.nights.length > 0) {
    ctx.fillStyle = "rgba(242, 100, 25, 0.18)";
    const pillH = 58;
    const pillText = `🎉 ${d.nights.length} Nights on the Floor`;
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    const pillW = ctx.measureText(pillText).width + 60;

    roundRect(ctx, px + 20, curY, pillW, pillH, 29);
    ctx.fill();
    ctx.strokeStyle = "rgba(242, 100, 25, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.fillText(pillText, px + 50, curY + 40);

    // Social chip next to it if space permits
    if (c.showSocials && c.selectedSocial?.handle) {
      const sText = `${c.selectedSocial.handle}`;
      const sW = ctx.measureText(sText).width + 50;
      const sX = px + 35 + pillW;
      if (sX + sW < W - px) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        roundRect(ctx, sX, curY, sW, pillH, 29);
        ctx.fill();
        ctx.fillStyle = theme.textPrimary;
        ctx.fillText(sText, sX + 25, curY + 40);
      }
    }
  }

  // Footer: After9 Festive Mark
  const footerY = H - 180;
  ctx.textAlign = "center";
  ctx.fillStyle = theme.textPrimary;
  ctx.font = '800 48px Syne, sans-serif';
  ctx.fillText("AFTER9", W / 2, footerY + 30);

  ctx.fillStyle = theme.accent;
  ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = "3px";
  ctx.fillText("MEET ON THE FLOOR · STAY AFTER", W / 2, footerY + 70);
}

/** Render card directly to Blob */
export async function renderCardToBlob(
  d: ProfileCardData,
  c: CardCustomization
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderCardToCanvas(canvas, d, c);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas blob rendering failed"));
    }, "image/png", 0.95);
  });
}

/** Legacy support: Square invite card */
export async function drawInviteCard(code: string, url: string): Promise<"shared" | "downloaded"> {
  await loadFonts();
  const W = 1080,
    H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2A1B2E");
  g.addColorStop(1, "#1E1222");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const icon = await loadImgSafe(appIcon);
  drawMarks(ctx, W - 260, 120, 110);

  if (icon) {
    const s = 300;
    ctx.save();
    roundRect(ctx, (W - s) / 2, 190, s, s, 72);
    ctx.clip();
    ctx.drawImage(icon, (W - s) / 2, 190, s, s);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#F3E9D2";
  ctx.font = '800 120px Syne, sans-serif';
  ctx.fillText("AFTER9", W / 2, 640);

  ctx.fillStyle = "#E8963C";
  ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Meet on the floor. Stay after.", W / 2, 720);

  // Code pill
  ctx.font = '800 88px Syne, sans-serif';
  const codeW = ctx.measureText(code).width + 140;
  roundRect(ctx, (W - codeW) / 2, 810, codeW, 160, 80);
  ctx.strokeStyle = "#E8963C";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#F3E9D2";
  ctx.fillText(code, W / 2, 920);

  ctx.fillStyle = "rgba(243,233,210,0.75)";
  ctx.font = '500 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("Join me with this code — skip the photo check", W / 2, 1080);
  ctx.fillStyle = "#E8963C";
  ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(url.replace(/^https?:\/\//, "").replace(/[&]src=card$/, ""), W / 2, 1160);

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

  const file = new File([blob], `after9-${d.name.toLowerCase()}-card.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${d.name}'s After9 Card`,
        text: `Find me on After9 — ${d.shareUrl}`,
      });
      return "shared";
    } catch {
      /* fallback */
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `after9-${d.name.toLowerCase()}-card.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded";
}
