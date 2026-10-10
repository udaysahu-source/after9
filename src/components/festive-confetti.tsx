import { useEffect, useRef } from "react";

// Saffron, Gold, Emerald, Rose, Cream festive palette
const FESTIVE_COLORS = [
  "#F26419", // Saffron / Orange (Action)
  "#E09F3E", // Amber Gold
  "#FFF3B0", // Marigold Yellow
  "#335C67", // Teal
  "#9E2A2B", // Festive Plum / Red
  "#2A9D8F", // Emerald
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
  shape: "rect" | "circle" | "sparkle";
}

/**
 * Lightweight Canvas Confetti component with zero external dependencies.
 * Automatically cleans up after animation finishes.
 */
export function FestiveConfetti({
  count = 65,
  origin = { x: 0.5, y: 0.4 },
  durationMs = 2800,
  onComplete,
}: {
  count?: number;
  origin?: { x: number; y: number };
  durationMs?: number;
  onComplete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect reduced motion
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onComplete?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const particles: Particle[] = [];
    const originX = origin.x * width;
    const originY = origin.y * height;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
        vy: Math.sin(angle) * speed - 3.5, // initial upward lift
        size: 5 + Math.random() * 6,
        color: FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)]!,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
        shape: Math.random() > 0.4 ? "rect" : Math.random() > 0.5 ? "circle" : "sparkle",
      });
    }

    let animationFrameId: number;
    const startTime = performance.now();

    const render = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = elapsed / durationMs;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.985; // drag
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - Math.pow(progress, 1.4));

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 4-point sparkle star
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.3, -p.size * 0.3);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(p.size * 0.3, p.size * 0.3);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.3, p.size * 0.3);
          ctx.lineTo(-p.size, 0);
          ctx.lineTo(-p.size * 0.3, -p.size * 0.3);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        onComplete?.();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [count, durationMs, onComplete, origin.x, origin.y]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100] h-full w-full"
      style={{ touchAction: "none" }}
    />
  );
}
