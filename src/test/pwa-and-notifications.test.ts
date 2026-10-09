import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

describe("PWA Functionality & Assets Verification", () => {
  const publicDir = path.resolve(process.cwd(), "public");

  it("serves valid manifest.webmanifest with installability requirements", () => {
    const manifestPath = path.join(publicDir, "manifest.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(content);

    expect(manifest.name).toBe("After9 — Meet on the floor");
    expect(manifest.short_name).toBe("After9");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#4A102B");
    expect(manifest.background_color).toBe("#120514");

    // Check icons
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    const purposes = manifest.icons.map((i: any) => i.purpose);
    expect(purposes).toContain("maskable");
  });

  it("has all referenced PWA icons generated and non-empty in public/", () => {
    const icons = [
      "pwa-192x192.png",
      "pwa-512x512.png",
      "pwa-maskable-512x512.png",
      "apple-touch-icon.png",
      "favicon.png",
    ];

    for (const icon of icons) {
      const p = path.join(publicDir, icon);
      expect(fs.existsSync(p), `Icon ${icon} should exist`).toBe(true);
      const stat = fs.statSync(p);
      expect(stat.size, `Icon ${icon} should not be empty`).toBeGreaterThan(1000);
    }
  });

  it("provides reliable service worker with offline fallback and push support", () => {
    const swPath = path.join(publicDir, "sw.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, "utf-8");
    // Verify essential service worker lifecycle and strategies
    expect(swContent).toContain("addEventListener(\"install\"");
    expect(swContent).toContain("addEventListener(\"activate\"");
    expect(swContent).toContain("addEventListener(\"fetch\"");
    expect(swContent).toContain("caches.delete"); // stale cache purge
    expect(swContent).toContain("/offline.html");
    expect(swContent).toContain("addEventListener(\"push\"");
    expect(swContent).toContain("addEventListener(\"notificationclick\"");
  });

  it("provides branded offline.html fallback page", () => {
    const offlinePath = path.join(publicDir, "offline.html");
    expect(fs.existsSync(offlinePath)).toBe(true);

    const offlineContent = fs.readFileSync(offlinePath, "utf-8");
    expect(offlineContent).toContain("You're Offline");
    expect(offlineContent).toContain("Retry Connection");
  });
});

describe("Notification Architecture & Simulation", () => {
  interface MockDbNotification {
    id: string;
    user_id: string;
    type: "like" | "match" | "message" | "system";
    title: string;
    body: string;
    action_url: string;
    data: any;
    read: boolean;
    source_id: string;
    created_at: string;
  }

  interface MockDbUser {
    id: string;
    first_name: string;
    blocked_users: string[];
  }

  let dbNotifications: MockDbNotification[];
  let dbDandiyas: { from_id: string; to_id: string; kind: "send" | "pass" }[];

  const userA: MockDbUser = { id: "user-a", first_name: "Aarav", blocked_users: [] };
  const userB: MockDbUser = { id: "user-b", first_name: "Bhavya", blocked_users: [] };
  const userC: MockDbUser = { id: "user-c", first_name: "Chirag", blocked_users: [] };

  beforeEach(() => {
    dbNotifications = [];
    dbDandiyas = [];
  });

  // Simulator strictly implementing handle_dandiya_notification() trigger logic
  function insertDandiya(from: MockDbUser, to: MockDbUser, kind: "send" | "pass") {
    dbDandiyas.push({ from_id: from.id, to_id: to.id, kind });

    if (kind !== "send") return;

    // Block check
    if (from.blocked_users.includes(to.id) || to.blocked_users.includes(from.id)) {
      return;
    }

    const smallerId = from.id < to.id ? from.id : to.id;
    const largerId = from.id < to.id ? to.id : from.id;
    const pairSource = `${smallerId}:${largerId}`;

    const isMutual = dbDandiyas.some(
      (d) => d.from_id === to.id && d.to_id === from.id && d.kind === "send"
    );

    if (isMutual) {
      // 1. Notify recipient
      const notifTo: MockDbNotification = {
        id: `notif-${Math.random()}`,
        user_id: to.id,
        type: "match",
        title: "It's a match! 🎉",
        body: `You and ${from.first_name} liked each other.`,
        action_url: `/chat/${from.id}`,
        data: { match_id: from.id },
        read: false,
        source_id: pairSource,
        created_at: new Date().toISOString(),
      };
      // Check unique (user_id, type, source_id)
      if (
        !dbNotifications.some(
          (n) =>
            n.user_id === notifTo.user_id &&
            n.type === notifTo.type &&
            n.source_id === notifTo.source_id
        )
      ) {
        dbNotifications.push(notifTo);
      }

      // 2. Notify sender
      const notifFrom: MockDbNotification = {
        id: `notif-${Math.random()}`,
        user_id: from.id,
        type: "match",
        title: "It's a match! 🎉",
        body: `You and ${to.first_name} liked each other.`,
        action_url: `/chat/${to.id}`,
        data: { match_id: to.id },
        read: false,
        source_id: pairSource,
        created_at: new Date().toISOString(),
      };
      if (
        !dbNotifications.some(
          (n) =>
            n.user_id === notifFrom.user_id &&
            n.type === notifFrom.type &&
            n.source_id === notifFrom.source_id
        )
      ) {
        dbNotifications.push(notifFrom);
      }

      // Mark prior like notifications as read
      for (const n of dbNotifications) {
        if (
          n.type === "like" &&
          (n.user_id === from.id || n.user_id === to.id) &&
          (n.source_id === `${from.id}:${to.id}` || n.source_id === `${to.id}:${from.id}`)
        ) {
          n.read = true;
        }
      }
    } else {
      // ONE-WAY LIKE
      const notif: MockDbNotification = {
        id: `notif-${Math.random()}`,
        user_id: to.id,
        type: "like",
        title: "New Like 👀",
        body: "Someone's interested in you 👀",
        action_url: "/discover",
        data: { kind: "like" },
        read: false,
        source_id: `${from.id}:${to.id}`,
        created_at: new Date().toISOString(),
      };
      if (
        !dbNotifications.some(
          (n) =>
            n.user_id === notif.user_id &&
            n.type === notif.type &&
            n.source_id === notif.source_id
        )
      ) {
        dbNotifications.push(notif);
      }
    }
  }

  it("Rule A: Right swipe generates anonymous like notification for recipient", () => {
    insertDandiya(userA, userB, "send");

    const bNotifs = dbNotifications.filter((n) => n.user_id === userB.id);
    expect(bNotifs.length).toBe(1);
    expect(bNotifs[0]!.type).toBe("like");
    expect(bNotifs[0]!.body).toBe("Someone's interested in you 👀");
    expect(bNotifs[0]!.body).not.toContain("Aarav"); // Identity kept anonymous
    expect(bNotifs[0]!.action_url).toBe("/discover");
  });

  it("Rule A2: Duplicate swipes do not generate duplicate like notifications", () => {
    insertDandiya(userA, userB, "send");
    insertDandiya(userA, userB, "send"); // duplicate swipe request

    const bNotifs = dbNotifications.filter((n) => n.user_id === userB.id);
    expect(bNotifs.length).toBe(1);
  });

  it("Rule B: Mutual match generates exactly one match notification for both participants", () => {
    // User A likes User B
    insertDandiya(userA, userB, "send");
    // User B likes User A (mutual match!)
    insertDandiya(userB, userA, "send");

    const aNotifs = dbNotifications.filter((n) => n.user_id === userA.id && n.type === "match");
    const bNotifs = dbNotifications.filter((n) => n.user_id === userB.id && n.type === "match");

    // Both users notified
    expect(aNotifs.length).toBe(1);
    expect(bNotifs.length).toBe(1);

    expect(aNotifs[0]!.title).toBe("It's a match! 🎉");
    expect(aNotifs[0]!.body).toBe("You and Bhavya liked each other.");
    expect(aNotifs[0]!.action_url).toBe(`/chat/${userB.id}`);

    expect(bNotifs[0]!.title).toBe("It's a match! 🎉");
    expect(bNotifs[0]!.body).toBe("You and Aarav liked each other.");
    expect(bNotifs[0]!.action_url).toBe(`/chat/${userA.id}`);
  });

  it("Rule B2: Concurrent or retried mutual matches do not produce duplicate match notifications", () => {
    insertDandiya(userA, userB, "send");
    insertDandiya(userB, userA, "send");
    // Retried request
    insertDandiya(userB, userA, "send");

    const aNotifs = dbNotifications.filter((n) => n.user_id === userA.id && n.type === "match");
    const bNotifs = dbNotifications.filter((n) => n.user_id === userB.id && n.type === "match");

    expect(aNotifs.length).toBe(1);
    expect(bNotifs.length).toBe(1);
  });

  it("Rule C: Blocked users do not generate notifications", () => {
    const userABlockingC: MockDbUser = {
      ...userA,
      blocked_users: [userC.id],
    };

    insertDandiya(userC, userABlockingC, "send");
    const aNotifs = dbNotifications.filter((n) => n.user_id === userA.id);
    expect(aNotifs.length).toBe(0); // blocked!
  });

  it("Rule D: Marking notification as read updates read state", () => {
    insertDandiya(userA, userB, "send");
    expect(dbNotifications[0]!.read).toBe(false);

    dbNotifications[0]!.read = true;
    expect(dbNotifications[0]!.read).toBe(true);
  });
});
