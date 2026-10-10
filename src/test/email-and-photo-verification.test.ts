import { describe, it, expect, vi } from "vitest";
import { isDisposableEmail, DISPOSABLE_EMAIL_DOMAINS } from "@/lib/disposable-domains";

describe("Anti-Fake User & Disposable Email Defense", () => {
  it("contains extensive list of known throwaway email providers", () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeGreaterThan(40);
    expect(DISPOSABLE_EMAIL_DOMAINS.has("mailinator.com")).toBe(true);
    expect(DISPOSABLE_EMAIL_DOMAINS.has("guerrillamail.com")).toBe(true);
    expect(DISPOSABLE_EMAIL_DOMAINS.has("tempmail.com")).toBe(true);
    expect(DISPOSABLE_EMAIL_DOMAINS.has("10minutemail.com")).toBe(true);
    expect(DISPOSABLE_EMAIL_DOMAINS.has("sharklasers.com")).toBe(true);
    expect(DISPOSABLE_EMAIL_DOMAINS.has("yopmail.com")).toBe(true);
  });

  it("blocks disposable email domains during signup", () => {
    expect(isDisposableEmail("bot123@mailinator.com")).toBe(true);
    expect(isDisposableEmail("fake.user@guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("temp@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("random@sharklasers.com")).toBe(true);
    expect(isDisposableEmail("spam@yopmail.com")).toBe(true);
  });

  it("permits genuine personal and institutional emails", () => {
    expect(isDisposableEmail("aarav.garba@gmail.com")).toBe(false);
    expect(isDisposableEmail("student@nitrr.ac.in")).toBe(false);
    expect(isDisposableEmail("diya_dance@outlook.com")).toBe(false);
    expect(isDisposableEmail("user@yahoo.com")).toBe(false);
    expect(isDisposableEmail("dancer@icloud.com")).toBe(false);
    expect(isDisposableEmail("team@after9.app")).toBe(false);
  });

  it("handles case-insensitive and whitespace-padded email strings gracefully", () => {
    expect(isDisposableEmail("  Test@Mailinator.COM  ")).toBe(true);
    expect(isDisposableEmail("  User@GMAIL.com ")).toBe(false);
  });

  it("safely handles empty or malformed inputs without throwing", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("invalid-email")).toBe(false);
    expect(isDisposableEmail("@missinguser.com")).toBe(false);
    expect(isDisposableEmail("user@")).toBe(false);
  });
});
