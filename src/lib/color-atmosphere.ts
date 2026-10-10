/**
 * After9 — Color Atmosphere Extractor
 * Automatically derives a harmonious, festival-inspired color atmosphere
 * from the user's uploaded portrait while preserving contrast and legibility.
 */

export interface CardPalette {
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

// Default Fallback Palette (Rich Deep Plum & Glowing Saffron)
export const DEFAULT_ATMOSPHERE: CardPalette = {
  bgGradStart: "#260E27",
  bgGradEnd: "#120514",
  accent: "#FF9E3B",
  accentWarm: "#F3D5A5",
  textPrimary: "#FAF4EA",
  textSecondary: "rgba(250, 244, 234, 0.88)",
  textMuted: "rgba(250, 244, 234, 0.65)",
  cardBorder: "rgba(255, 158, 59, 0.28)",
  tagBg: "rgba(255, 158, 59, 0.16)",
  photoBorder: "rgba(250, 244, 234, 0.18)",
};

/** Convert RGB to HSL */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Checks if a color is likely a human skin tone sample.
 * Avoids basing entire atmosphere on skin tones.
 */
function isLikelySkinTone(r: number, g: number, b: number): boolean {
  if (r <= g || g <= b) return false;
  const [h, s, l] = rgbToHsl(r, g, b);
  // Typical skin tone hue range: 10 to 45 degrees, medium saturation
  return h >= 10 && h <= 45 && s >= 18 && s <= 65 && l >= 25 && l <= 85;
}

/**
 * Lightweight client-side image color analysis.
 * Analyzes small canvas downsample to extract representative festival atmosphere.
 */
export function extractAtmosphereFromPhoto(
  img: HTMLImageElement | null
): CardPalette {
  if (!img || typeof document === "undefined") {
    return DEFAULT_ATMOSPHERE;
  }

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return DEFAULT_ATMOSPHERE;

    const sampleSize = 32;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const colorBuckets = new Map<number, { count: number; r: number; g: number; b: number; s: number; l: number }>();

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i]!;
      const g = imgData[i + 1]!;
      const b = imgData[i + 2]!;
      const a = imgData[i + 3]!;

      if (a < 128) continue; // Skip transparent
      const [h, s, l] = rgbToHsl(r, g, b);

      // Skip near-black, near-white, or washed out grayscale
      if (l < 12 || l > 92 || s < 12) continue;

      // Filter out skin tones so clothing/lighting/background drives theme
      if (isLikelySkinTone(r, g, b)) continue;

      // Group into 12 hue buckets (every 30 deg)
      const bucketKey = Math.floor(h / 30) * 30;
      const existing = colorBuckets.get(bucketKey) ?? { count: 0, r: 0, g: 0, b: 0, s: 0, l: 0 };
      existing.count += 1;
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.s += s;
      existing.l += l;
      colorBuckets.set(bucketKey, existing);
    }

    if (colorBuckets.size === 0) {
      return DEFAULT_ATMOSPHERE;
    }

    // Find bucket with highest vibrancy & frequency
    let bestBucket: { hue: number; r: number; g: number; b: number; s: number; l: number } | null = null;
    let maxWeight = -1;

    for (const [hue, data] of colorBuckets.entries()) {
      const avgS = data.s / data.count;
      const avgL = data.l / data.count;
      // Weight by frequency and saturation (vibrancy)
      const weight = data.count * (1 + avgS / 50);
      if (weight > maxWeight) {
        maxWeight = weight;
        bestBucket = {
          hue,
          r: Math.round(data.r / data.count),
          g: Math.round(data.g / data.count),
          b: Math.round(data.b / data.count),
          s: avgS,
          l: avgL,
        };
      }
    }

    if (!bestBucket) return DEFAULT_ATMOSPHERE;

    const baseHue = bestBucket.hue;
    // Harmonious accent: 35 degrees offset or warm saffron pop
    const accentHue = baseHue >= 30 && baseHue <= 60 ? 25 : baseHue > 200 ? 38 : (baseHue + 40) % 360;

    const bgGradStart = `hsl(${baseHue}, 45%, 12%)`;
    const bgGradEnd = `hsl(${baseHue}, 55%, 5%)`;
    const accent = `hsl(${accentHue}, 92%, 62%)`;
    const accentWarm = `hsl(${accentHue}, 65%, 82%)`;

    return {
      bgGradStart,
      bgGradEnd,
      accent,
      accentWarm,
      textPrimary: "#FAF4EA", // Guaranteed high contrast ivory
      textSecondary: "rgba(250, 244, 234, 0.88)",
      textMuted: "rgba(250, 244, 234, 0.65)",
      cardBorder: `hsla(${accentHue}, 90%, 62%, 0.32)`,
      tagBg: `hsla(${accentHue}, 90%, 62%, 0.16)`,
      photoBorder: "rgba(250, 244, 234, 0.18)",
    };
  } catch (err) {
    console.warn("[ColorAtmosphere] Extraction failed, using default:", err);
    return DEFAULT_ATMOSPHERE;
  }
}
