import { useState, useEffect } from "react";
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "@/lib/notifications";
import { Bell, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function NotificationSettings({
  userId,
  enabled,
  onUpdate,
  className,
}: {
  userId: string;
  enabled: boolean;
  onUpdate?: () => void;
  className?: string;
}) {
  const [pushEnabled, setPushEnabled] = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setPushEnabled(enabled);
    const isSupp = isPushSupported();
    setSupported(isSupp);
    if (isSupp) {
      setPermission(getNotificationPermission());
    } else {
      setPermission("unsupported");
    }
  }, [enabled]);

  const handleToggle = async (nextState: boolean) => {
    if (loading) return;
    setLoading(true);

    if (nextState) {
      if (!supported) {
        toast.info("Web push is not supported by your current browser. In-app alerts are active!");
        setLoading(false);
        return;
      }

      if (permission === "denied") {
        toast.error(
          "Notifications are blocked in your browser settings. Please allow notifications for After9 in site settings."
        );
        setLoading(false);
        return;
      }

      const res = await subscribeToWebPush(userId);
      if (res.success) {
        setPushEnabled(true);
        setPermission("granted");
        toast.success("Push notifications enabled! You'll never miss a Garba clash.");
        onUpdate?.();
      } else if (res.status === "denied") {
        setPermission("denied");
        toast.error("Notification permission was denied in your browser prompt.");
      } else {
        toast.error(res.error || "Could not enable push notifications");
      }
    } else {
      await unsubscribeFromWebPush(userId);
      setPushEnabled(false);
      toast.info("Push notifications paused. In-app notifications will still appear.");
      onUpdate?.();
    }

    setLoading(false);
  };

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Push Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Receive alerts for mutual Garba clashes, right swipes, and chat messages on your device.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={pushEnabled}
          disabled={loading}
          onClick={() => handleToggle(!pushEnabled)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            pushEnabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
              pushEnabled ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          In-App Notifications: Active
        </span>
        <span>•</span>
        <span>
          Device Push:{" "}
          <strong className="text-foreground">
            {permission === "granted" && pushEnabled
              ? "Active"
              : permission === "denied"
                ? "Blocked in Browser"
                : !supported
                  ? "Unsupported on this device"
                  : "Paused"}
          </strong>
        </span>
      </div>

      {permission === "denied" && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <p>
            Browser permission is currently denied. To receive notifications, click the lock/settings icon in your browser address bar and set Notifications to "Allow".
          </p>
        </div>
      )}
    </div>
  );
}
