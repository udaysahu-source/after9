import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderCardToCanvas, type CardCustomization, type ProfileCardData } from "@/lib/share-cards";

describe("Share Cards Engine (1080 × 1920)", () => {
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    mockContext = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 120 }),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      drawImage: vi.fn(),
      set fillStyle(val: any) {},
      set strokeStyle(val: any) {},
      set lineWidth(val: any) {},
      set font(val: any) {},
      set textAlign(val: any) {},
      set textBaseline(val: any) {},
      set shadowColor(val: any) {},
      set shadowBlur(val: any) {},
      set shadowOffsetY(val: any) {},
      set globalAlpha(val: any) {},
    } as unknown as CanvasRenderingContext2D;

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement;
  });

  const sampleData: ProfileCardData = {
    photoUrl: null,
    name: "Riya Sharma",
    age: 21,
    college: "NIT Raipur",
    branch: "Computer Science",
    prompt: "A midnight jalebi run after 4 hours of Garba",
    nights: [1, 2, 5, 8, 9],
    shareUrl: "https://after9.in/p/a1b2c3d4e5",
  };

  const sampleCustomization: CardCustomization = {
    template: "editorial",
    theme: "plum",
    focalY: 50,
    showCollege: true,
    showPrompt: true,
    showNights: true,
    showSocials: true,
    selectedSocial: {
      platform: "instagram",
      handle: "riya.navratri",
    },
  };

  it("sets canvas dimensions strictly to 1080 × 1920 (Instagram Story / WhatsApp Status standard)", async () => {
    await renderCardToCanvas(mockCanvas, sampleData, sampleCustomization);
    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1920);
  });

  it("renders editorial template without crashing", async () => {
    await renderCardToCanvas(mockCanvas, sampleData, {
      ...sampleCustomization,
      template: "editorial",
      theme: "plum",
    });
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it("renders minimal template without crashing", async () => {
    await renderCardToCanvas(mockCanvas, sampleData, {
      ...sampleCustomization,
      template: "minimal",
      theme: "saffron",
    });
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it("renders festival template without crashing", async () => {
    await renderCardToCanvas(mockCanvas, sampleData, {
      ...sampleCustomization,
      template: "festival",
      theme: "midnight",
    });
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it("handles missing photo and long names gracefully", async () => {
    await renderCardToCanvas(
      mockCanvas,
      {
        ...sampleData,
        photoUrl: null,
        name: "Devanandhamurthy Subramaniam-Chatterjee",
        college: null,
        prompt: null,
      },
      {
        ...sampleCustomization,
        showCollege: false,
        showPrompt: false,
        showSocials: false,
      }
    );
    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1920);
  });

  it("renders Garba plans headline, location, and festive hierarchy", async () => {
    await renderCardToCanvas(
      mockCanvas,
      {
        ...sampleData,
        generalArea: "Telibandha",
        city: "Raipur",
      },
      sampleCustomization
    );
    const textCalls = (mockContext.fillText as any).mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain("GARBA PLANS?");
    expect(textCalls).toContain("I'm in for Garba tonight.");
    expect(textCalls).toContain("📍 Telibandha, Raipur");
    expect(textCalls).toContain("Let's make tonight memorable ✨");
  });

  it("handles zero attendance without falsely claiming availability", async () => {
    await renderCardToCanvas(
      mockCanvas,
      {
        ...sampleData,
        nights: [],
        city: "Raipur",
      },
      sampleCustomization
    );
    const textCalls = (mockContext.fillText as any).mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain("Looking for Garba plans.");
    expect(textCalls).not.toContain("I'm in for Garba tonight.");
  });
});
