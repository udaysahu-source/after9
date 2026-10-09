import { describe, expect, it } from "vitest";
import { toVerdict } from "./verify-rules";

describe("photo check verdict", () => {
  it("approves a clean real photo", () => {
    expect(toVerdict({ issue: "none", confidence: 0.9, observations: "" }).approved).toBe(true);
  });
  it("lets a low-confidence AI suspicion through", () => {
    expect(toVerdict({ issue: "ai_generated", confidence: 0.6, observations: "" }).approved).toBe(true);
  });
  it("rejects a confident AI-made photo with specific feedback", () => {
    const v = toVerdict({ issue: "ai_generated", confidence: 0.92, observations: "" });
    expect(v.approved).toBe(false);
    expect(v.reason).toMatch(/warped/);
  });
  it("rejects an illustration", () => {
    expect(toVerdict({ issue: "illustration", confidence: 0.7, observations: "" }).approved).toBe(false);
  });
});
