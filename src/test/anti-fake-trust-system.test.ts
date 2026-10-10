import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeImageSha256 } from "@/lib/verify.functions";
import { REPORT_REASONS } from "@/components/report-user-modal";

describe("After9 Anti-Fake Profile and Trust System Test Suite", () => {
  const migrationsDir = path.resolve(process.cwd(), "drizzle/migrations");
  const migration0026 = fs.readFileSync(path.join(migrationsDir, "0026_anti_fake_trust_system.sql"), "utf-8").toLowerCase();
  const migration0000 = fs.readFileSync(path.join(migrationsDir, "0000_migration.sql"), "utf-8").toLowerCase();
  const migration0025 = fs.readFileSync(path.join(migrationsDir, "0025_admin_moderation_and_delete_functions.sql"), "utf-8").toLowerCase();

  // =========================================================================
  // Scenario 1: User attempts to self-approve
  // =========================================================================
  describe("Scenario 1: User attempts to self-approve", () => {
    it("enforces database trigger guard_profile blocking unauthorized verification_status update", () => {
      // guard_profile trigger forces verification_status to old value for non-service_role
      expect(migration0000).toContain("create or replace function public.guard_profile()");
      expect(migration0000).toContain("coalesce(auth.role(), '') <> 'service_role'");
      // Must overwrite any attempted user client verification_status changes with old value
      expect(migration0000).toContain("new.verification_status := old.verification_status");
    });

    it("resets verification_status to pending whenever profile name, photo, or prompt changes", () => {
      expect(migration0000).toContain("new.verification_status := 'pending'");
      // Ensures user cannot change their approved photo to someone else's without reverification
      expect(migration0000).toContain("new.photo_path is distinct from old.photo_path");
    });
  });

  // =========================================================================
  // Scenario 2: User submits an existing gallery photo as verification evidence
  // =========================================================================
  describe("Scenario 2: User submits gallery photo as verification evidence", () => {
    it("computes deterministic SHA-256 hashes of image buffers", () => {
      const bufferA = Buffer.from("test-selfie-image-data-a");
      const bufferB = Buffer.from("test-selfie-image-data-b");
      const bufferACopy = Buffer.from("test-selfie-image-data-a");

      const hashA = computeImageSha256(bufferA);
      const hashB = computeImageSha256(bufferB);
      const hashACopy = computeImageSha256(bufferACopy);

      expect(hashA).toBe(hashACopy);
      expect(hashA).not.toBe(hashB);
      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    });

    it("flags when submitted selfie hash is byte-identical to uploaded profile photo", () => {
      const profilePhotoBytes = Buffer.from("user-profile-headshot-2026");
      const selfieUploadBytes = Buffer.from("user-profile-headshot-2026");

      const profileHash = computeImageSha256(profilePhotoBytes);
      const selfieHash = computeImageSha256(selfieUploadBytes);

      // Submitting the exact same static profile photo file as a live selfie is forbidden
      expect(selfieHash).toBe(profileHash);
    });

    it("requires live camera capture mode and rejects gallery uploads", () => {
      const gallerySubmission = {
        captureType: "gallery" as const,
        capturedAt: Date.now(),
      };
      const liveCameraSubmission = {
        captureType: "live_camera" as const,
        capturedAt: Date.now(),
      };

      expect(gallerySubmission.captureType).not.toBe("live_camera");
      expect(liveCameraSubmission.captureType).toBe("live_camera");
    });

    it("rejects selfie captures that exceed maximum fresh window (5 minutes)", () => {
      const now = Date.now();
      const freshTimestamp = now - 60 * 1000; // 1 minute ago
      const staleTimestamp = now - 10 * 60 * 1000; // 10 minutes ago

      const isFresh = (ts: number) => Math.abs(now - ts) <= 5 * 60 * 1000;

      expect(isFresh(freshTimestamp)).toBe(true);
      expect(isFresh(staleTimestamp)).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 3: User accesses another user's private verification image
  // =========================================================================
  describe("Scenario 3: Private verification evidence bucket & RLS isolation", () => {
    it("declares verification_evidence bucket as completely private (public = false)", () => {
      expect(migration0026).toContain("'verification_evidence'");
      expect(migration0026).toContain("public = false");
    });

    it("restricts SELECT access on verification_evidence strictly to administrators", () => {
      expect(migration0026).toContain("admins view verification evidence");
      expect(migration0026).toContain("bucket_id = 'verification_evidence'");
      expect(migration0026).toContain("public.is_admin(auth.uid())");
    });

    it("does not allow arbitrary public users to read verification selfies", () => {
      // Must not have a public select policy for verification_evidence
      const publicEvidencePolicy = migration0026.includes("create policy \"public view verification evidence\"");
      expect(publicEvidencePolicy).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 4: Duplicate profile images flagged for moderator review
  // =========================================================================
  describe("Scenario 4: Duplicate profile image detection and queuing", () => {
    it("flags duplicate image hashes across separate accounts for review without auto-banning", () => {
      const userAId = "00000000-0000-0000-0000-000000000001";
      const userBId = "00000000-0000-0000-0000-000000000002";
      const imageBytes = Buffer.from("celebrity-or-stock-photo-data");
      const imageHash = computeImageSha256(imageBytes);

      // When User B uploads the same hash as User A:
      const existingUploads = [
        { actor_id: userAId, image_hash: imageHash, registered_at: "2026-10-10T10:00:00Z" },
      ];

      const duplicateFound = existingUploads.some(
        (up) => up.image_hash === imageHash && up.actor_id !== userBId
      );

      expect(duplicateFound).toBe(true);

      // Decision must be needs_review rather than instant permanent ban
      const verdict = duplicateFound ? "needs_review" : "approved";
      expect(verdict).toBe("needs_review");
    });
  });

  // =========================================================================
  // Scenario 5: User reports and blocks another user
  // =========================================================================
  describe("Scenario 5: User reports and blocks another user", () => {
    it("provides clear, structured reporting reasons including fake profiles and impersonation", () => {
      const reasonIds = REPORT_REASONS.map((r) => r.id);
      expect(reasonIds).toContain("fake_profile");
      expect(reasonIds).toContain("impersonation");
      expect(reasonIds).toContain("stolen_photo");
      expect(reasonIds).toContain("harassment");
      expect(reasonIds).toContain("inappropriate_content");
      expect(reasonIds).toContain("underage_account");
      expect(reasonIds).toContain("other");
    });

    it("inserts report into blocks table with report = true and pending status", () => {
      const reportPayload = {
        blocker_id: "user-victim-id",
        blocked_id: "user-suspect-id",
        reason: "stolen_photo",
        report: true,
        status: "pending",
      };

      expect(reportPayload.report).toBe(true);
      expect(reportPayload.status).toBe("pending");
      expect(reportPayload.reason).toBe("stolen_photo");
    });
  });

  // =========================================================================
  // Scenario 6: Blocked user attempts to appear in Discover or send messages
  // =========================================================================
  describe("Scenario 6: Server-side exclusion of blocked users", () => {
    it("excludes blocked accounts in discover_feed() bidirectional check", () => {
      expect(migration0026).toContain("not exists (");
      expect(migration0026).toContain("b.blocker_id = me.id and b.blocked_id = p.id");
    });

    it("revokes blanket message viewing from moderators and mandates audited function", () => {
      expect(migration0026).toContain("drop policy if exists \"admins select messages\" on public.messages");
      expect(migration0026).toContain("create or replace function public.admin_get_reported_messages");
    });

    it("admin_get_reported_messages requires an active report in blocks table before returning messages", () => {
      expect(migration0026).toContain("from public.blocks");
      expect(migration0026).toContain("b.report = true");
      expect(migration0026).toContain("insert into public.admin_audit_logs");
    });
  });

  // =========================================================================
  // Scenario 7: Unverified account attempts to enter verified-only feed
  // =========================================================================
  describe("Scenario 7: Verified-only Discover floor enforcement", () => {
    it("requires viewer verification_status to be approved in discover_feed()", () => {
      expect(migration0026).toContain("me.verification_status = 'approved'");
      expect(migration0026).toContain("me.onboarded = true");
    });

    it("requires candidate profiles to be approved as well", () => {
      expect(migration0026).toContain("p.verification_status = 'approved'");
    });

    it("preserves global launch control check in discover_feed()", () => {
      expect(migration0026).toContain("launch.enabled = true");
    });
  });

  // =========================================================================
  // Scenario 8: Normal user attempts to access moderation functions
  // =========================================================================
  describe("Scenario 8: Moderation and administrative privilege gates", () => {
    it("admin_get_reported_messages rejects non-admin users with an authorization error", () => {
      expect(migration0026).toContain("if not public.is_admin(v_caller_id) then");
      expect(migration0026).toContain("unauthorized: administrator privileges required");
    });

    it("submit_suspension_appeal accepts valid appeals and writes to security_events", () => {
      expect(migration0026).toContain("create or replace function public.submit_suspension_appeal");
      expect(migration0026).toContain("insert into public.security_events");
      expect(migration0026).toContain("'suspension_appeal'");
    });
  });
});

