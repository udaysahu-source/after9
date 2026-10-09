import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationType = NotificationRow["type"];

/** Helper to convert VAPID base64 string to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Fetch user notifications */
export async function getMyNotifications(limit = 30): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch notifications:", error.message);
    return [];
  }
  return data ?? [];
}

/** Get unread notification count */
export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notification_count");
  if (error) {
    console.warn("Failed to count unread notifications:", error.message);
    return 0;
  }
  return data ?? 0;
}

/** Mark a single notification as read */
export async function markNotificationAsRead(id: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
}

/** Mark all user notifications as read */
export async function markAllNotificationsAsRead(): Promise<void> {
  await supabase.rpc("mark_all_notifications_read");
}

/** Check if Web Push is supported on this browser/platform */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Get current browser notification permission state */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Subscribe user to Web Push.
 * If VAPID public key is configured via VITE_VAPID_PUBLIC_KEY, registers subscription in DB.
 */
export async function subscribeToWebPush(userId: string): Promise<{
  success: boolean;
  status: "granted" | "denied" | "unsupported" | "error" | "default";
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, status: "unsupported", error: "Push not supported by this browser" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, status: permission, error: "Notification permission denied" };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Use VAPID key if configured
    const vapidPublicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

    if (!subscription) {
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };
      if (vapidPublicKey) {
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
      }
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    // Extract subscription keys
    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (p256dh && auth) {
      const p256dhStr = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dh))));
      const authStr = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(auth))));

      // Upsert into Supabase push_subscriptions table
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: p256dhStr,
          auth: authStr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );
    }

    // Enable push setting on profile
    await supabase
      .from("profiles")
      .update({ push_notifications_enabled: true })
      .eq("id", userId);

    return { success: true, status: "granted" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Web push subscription error:", msg);
    return { success: false, status: "error", error: msg };
  }
}

/** Unsubscribe user from Web Push */
export async function unsubscribeFromWebPush(userId: string): Promise<void> {
  try {
    if (isPushSupported()) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);

        await subscription.unsubscribe();
      }
    }

    await supabase
      .from("profiles")
      .update({ push_notifications_enabled: false })
      .eq("id", userId);
  } catch (err) {
    console.warn("Unsubscribe push error:", err);
  }
}
