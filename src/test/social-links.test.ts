import { describe, it, expect } from "vitest";
import { validateAndNormalizeSocial } from "@/lib/social-links";

describe("Social Links Validation and Normalization", () => {
  it("normalizes and validates Instagram handles and URLs", () => {
    // Plain handle with @
    const r1 = validateAndNormalizeSocial("instagram", "@aarav_garba");
    expect(r1.valid).toBe(true);
    expect(r1.handle).toBe("aarav_garba");
    expect(r1.url).toBe("https://instagram.com/aarav_garba");

    // Full URL
    const r2 = validateAndNormalizeSocial("instagram", "https://instagram.com/diya.navratri/");
    expect(r2.valid).toBe(true);
    expect(r2.handle).toBe("diya.navratri");
    expect(r2.url).toBe("https://instagram.com/diya.navratri");

    // Invalid handle with forbidden characters
    const r3 = validateAndNormalizeSocial("instagram", "aarav!garba$");
    expect(r3.valid).toBe(false);
  });

  it("normalizes and validates Snapchat usernames", () => {
    const r1 = validateAndNormalizeSocial("snapchat", "rohan_99");
    expect(r1.valid).toBe(true);
    expect(r1.handle).toBe("rohan_99");
    expect(r1.url).toBe("https://snapchat.com/add/rohan_99");

    const r2 = validateAndNormalizeSocial("snapchat", "https://www.snapchat.com/add/priya_vibe");
    expect(r2.valid).toBe(true);
    expect(r2.handle).toBe("priya_vibe");
    expect(r2.url).toBe("https://snapchat.com/add/priya_vibe");
  });

  it("normalizes and validates X / Twitter handles", () => {
    const r1 = validateAndNormalizeSocial("x", "@raipur_dandiya");
    expect(r1.valid).toBe(true);
    expect(r1.handle).toBe("raipur_dandiya");
    expect(r1.url).toBe("https://x.com/raipur_dandiya");

    const r2 = validateAndNormalizeSocial("x", "https://twitter.com/garba_queen");
    expect(r2.valid).toBe(true);
    expect(r2.handle).toBe("garba_queen");
    expect(r2.url).toBe("https://x.com/garba_queen");
  });

  it("normalizes and validates YouTube channels and handles", () => {
    const r1 = validateAndNormalizeSocial("youtube", "@navratrilive");
    expect(r1.valid).toBe(true);
    expect(r1.handle).toBe("navratrilive");
    expect(r1.url).toBe("https://youtube.com/@navratrilive");

    const r2 = validateAndNormalizeSocial("youtube", "https://youtube.com/@after9raipur");
    expect(r2.valid).toBe(true);
    expect(r2.handle).toBe("after9raipur");
    expect(r2.url).toBe("https://youtube.com/@after9raipur");
  });

  it("normalizes and validates LinkedIn profiles", () => {
    const r1 = validateAndNormalizeSocial("linkedin", "in/aarav-patel");
    expect(r1.valid).toBe(true);
    expect(r1.handle).toBe("aarav-patel");
    expect(r1.url).toBe("https://linkedin.com/in/aarav-patel");

    const r2 = validateAndNormalizeSocial("linkedin", "https://linkedin.com/in/diya-sharma-123/");
    expect(r2.valid).toBe(true);
    expect(r2.handle).toBe("diya-sharma-123");
    expect(r2.url).toBe("https://linkedin.com/in/diya-sharma-123");
  });

  it("rejects malicious or unsafe custom URLs", () => {
    // javascript: injection attempt
    const r1 = validateAndNormalizeSocial("custom", "javascript:alert(1)");
    expect(r1.valid).toBe(false);
    expect(r1.error).toContain("HTTP or HTTPS");

    // data: scheme attempt
    const r2 = validateAndNormalizeSocial("custom", "data:text/html,<script>evil</script>");
    expect(r2.valid).toBe(false);

    // valid custom URL
    const r3 = validateAndNormalizeSocial("custom", "https://portfolio.me/aarav");
    expect(r3.valid).toBe(true);
    expect(r3.handle).toBe("portfolio.me/aarav");
    expect(r3.url).toBe("https://portfolio.me/aarav");
  });
});
