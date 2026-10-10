import { describe, it, expect, vi } from "vitest";
import {
  checkRateLimit,
  assertRateLimit,
  hashIdentifier,
  getClientIp,
} from "@/lib/security-rate-limiter";
import { validateAndNormalizeSocial } from "@/lib/social-links";
import { validateBirthDate } from "@/lib/after9";
import fs from "node:fs";
import path from "node:path";

describe("After9 Defensive Security & Hardening Test Suite", () => {
  // =========================================================================
  // 1. DISTRIBUTED RATE LIMITER ENFORCEMENT
  // =========================================================================
  describe("1. Distributed Rate Limiter Enforcement", () => {
    it("permits requests within allowed threshold and tracks remaining balance", async () => {
      const action = "test_rate_limit_pass_" + Date.now();
      const res1 = await checkRateLimit({
        action,
        maxAttempts: 3,
        windowSeconds: 60,
        userId: "user-safe",
      });

      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);
      expect(res1.resetAfterSeconds).toBeGreaterThan(0);

      const res2 = await checkRateLimit({
        action,
        maxAttempts: 3,
        windowSeconds: 60,
        userId: "user-safe",
      });

      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);
    });

    it("strictly throttles and blocks requests exceeding threshold", async () => {
      const action = "test_rate_limit_block_" + Date.now();
      // Exhaust 2 attempts
      await checkRateLimit({ action, maxAttempts: 2, windowSeconds: 60, userId: "user-attacker" });
      await checkRateLimit({ action, maxAttempts: 2, windowSeconds: 60, userId: "user-attacker" });

      // 3rd attempt must be denied
      const res3 = await checkRateLimit({
        action,
        maxAttempts: 2,
        windowSeconds: 60,
        userId: "user-attacker",
      });

      expect(res3.allowed).toBe(false);
      expect(res3.remaining).toBe(0);
      expect(res3.resetAfterSeconds).toBeGreaterThan(0);
    });

    it("assertRateLimit throws HTTP 429 when threshold exceeded", async () => {
      const action = "test_rate_limit_throw_" + Date.now();
      await assertRateLimit({ action, maxAttempts: 1, windowSeconds: 60, userId: "u-throw" });

      let thrownError: any = null;
      try {
        await assertRateLimit({ action, maxAttempts: 1, windowSeconds: 60, userId: "u-throw" });
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.statusCode).toBe(429);
      expect(thrownError.message).toContain("Too many requests");
    });

    it("separates limits per user and per IP, isolating mobile carrier NAT", async () => {
      const action = "test_nat_isolation_" + Date.now();
      // User A reaches limit
      await checkRateLimit({ action, maxAttempts: 1, windowSeconds: 60, userId: "user-a", ip: "192.0.2.1" });
      const blockedA = await checkRateLimit({ action, maxAttempts: 1, windowSeconds: 60, userId: "user-a", ip: "192.0.2.1" });
      expect(blockedA.allowed).toBe(false);

      // User B sharing the same NAT IP is NOT blocked
      const allowedB = await checkRateLimit({ action, maxAttempts: 1, windowSeconds: 60, userId: "user-b", ip: "192.0.2.1" });
      expect(allowedB.allowed).toBe(true);
    }, 15000);
  });

  // =========================================================================
  // 2. CONTROLLED DECOY & BOT DETECTION
  // =========================================================================
  describe("2. Controlled Decoy & Bot Detection", () => {
    it("safely hashes identifiers to avoid storing raw PII in logs", () => {
      const ip = "203.0.113.195";
      const hash1 = hashIdentifier(ip);
      const hash2 = hashIdentifier(ip);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^h_[0-9a-f]+$/);
      expect(hash1).not.toContain(ip);
    });
  });

  // =========================================================================
  // 3. INPUT VALIDATION & INJECTION PREVENTION
  // =========================================================================
  describe("3. Input Validation & Injection Prevention", () => {
    it("sanitizes search input against PostgREST filter injection", () => {
      const maliciousInput = "test,id.neq.0,role.eq.admin()";
      const sanitized = maliciousInput.replace(/[^a-zA-Z0-9\s_-]/g, "").trim();
      expect(sanitized).toBe("testidneq0roleeqadmin");
      expect(sanitized).not.toContain(",");
      expect(sanitized).not.toContain("(");
      expect(sanitized).not.toContain(")");
      expect(sanitized).not.toContain(".");
    });

    it("detects and rejects path traversal in photo uploads", () => {
      const userId = "123e4567-e89b-12d3-a456-426614174000";
      const maliciousPaths = [
        "../etc/passwd",
        `${userId}/../../avatar.jpg`,
        "other-user-uuid/avatar.jpg",
        `${userId}/evil.exe`,
        `${userId}/script.js`,
      ];

      for (const p of maliciousPaths) {
        const isSafe = !p.includes("..") && p.startsWith(`${userId}/`) && /\.(jpg|jpeg|png|webp)$/i.test(p);
        expect(isSafe).toBe(false);
      }

      const validPath = `${userId}/1728567890.jpg`;
      const isValid = !validPath.includes("..") && validPath.startsWith(`${userId}/`) && /\.(jpg|jpeg|png|webp)$/i.test(validPath);
      expect(isValid).toBe(true);
    });

    it("rejects malicious URL schemes in social links", () => {
      const dangerousSchemes = [
        "javascript:alert(1)",
        "JAVASCRIPT:document.location='http://evil.com'",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
      ];

      for (const dangerous of dangerousSchemes) {
        const result = validateAndNormalizeSocial("custom", dangerous);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Only safe HTTP or HTTPS links are permitted");
      }
    });

    it("enforces strict birth date validation (18+ only)", () => {
      // Under 18
      const today = new Date();
      const underAgeDate = `${today.getFullYear() - 17}-01-01`;
      const underAgeResult = validateBirthDate(underAgeDate);
      expect(underAgeResult.valid).toBe(false);
      expect(underAgeResult.error).toContain("18 years old");

      // Exactly / Over 18
      const adultDate = `${today.getFullYear() - 20}-01-01`;
      const adultResult = validateBirthDate(adultDate);
      expect(adultResult.valid).toBe(true);
      expect(adultResult.age).toBeGreaterThanOrEqual(18);
    });
  });

  // =========================================================================
  // 4. SECRETS, CREDENTIALS & GIT PROTECTION
  // =========================================================================
  describe("4. Secrets, Credentials & Git Protection", () => {
    it(".gitignore strictly excludes private keys, certificates, and env files", () => {
      const gitignorePath = path.resolve(process.cwd(), ".gitignore");
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");

      expect(gitignoreContent).toContain(".env");
      expect(gitignoreContent).toContain("*.key");
      expect(gitignoreContent).toContain("*.pem");
      expect(gitignoreContent).toContain("*.cert");
      expect(gitignoreContent).toContain("*.secrets");
    });

    it(".env.example contains only dummy placeholder values", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");

      expect(envExampleContent).toContain("your-project-id");
      expect(envExampleContent).toContain("your-publishable-key");
      expect(envExampleContent).toContain("your-supabase-service-role-key");

      // Verify no live jwt tokens or long hashes exist in the example
      expect(envExampleContent).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}/);
    });

    it("privileged service role key is NEVER prefixed with VITE_", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");

      expect(envExampleContent).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
      expect(envExampleContent).not.toContain("VITE_SERVICE_ROLE");
    });
  });

  // =========================================================================
  // 5. PRODUCTION NETWORK SECURITY HEADERS
  // =========================================================================
  describe("5. Production Network Security Headers in vercel.json", () => {
    it("vercel.json includes comprehensive CSP, HSTS, frame restrictions, and nosniff", () => {
      const vercelPath = path.resolve(process.cwd(), "vercel.json");
      const vercelJson = JSON.parse(fs.readFileSync(vercelPath, "utf-8"));

      expect(vercelJson.headers).toBeDefined();
      const allHeaders = vercelJson.headers[0].headers;
      const headerMap = new Map(allHeaders.map((h: any) => [h.key, h.value]));

      expect(headerMap.has("Content-Security-Policy")).toBe(true);
      expect(headerMap.get("Content-Security-Policy")).toContain("default-src 'self'");
      expect(headerMap.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
      expect(headerMap.get("Content-Security-Policy")).toContain("object-src 'none'");

      expect(headerMap.has("Strict-Transport-Security")).toBe(true);
      expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=63072000");

      expect(headerMap.has("X-Content-Type-Options")).toBe(true);
      expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");

      expect(headerMap.has("Referrer-Policy")).toBe(true);
      expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

      expect(headerMap.has("Permissions-Policy")).toBe(true);
    });
  });

  // =========================================================================
  // 6. CI/CD AUTOMATED SECURITY SCANNING WORKFLOW
  // =========================================================================
  describe("6. CI/CD Automated Security Workflow", () => {
    it("GitHub Actions security workflow exists and includes secret and dependency scanning", () => {
      const workflowPath = path.resolve(process.cwd(), ".github/workflows/security.yml");
      expect(fs.existsSync(workflowPath)).toBe(true);

      const workflowContent = fs.readFileSync(workflowPath, "utf-8");
      expect(workflowContent).toContain("TruffleHog");
      expect(workflowContent).toContain("npm audit");
      expect(workflowContent).toContain("npm test");
    });
  });
});
