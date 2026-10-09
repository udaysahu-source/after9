import { useState, useEffect } from "react";
import { Bell, Heart, Sparkles, MessageCircle, CheckCheck, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationRow,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function NotificationBell({
  userId,
  className,
}: {
  userId?: string | null | undefined;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const loadData = async () => {
    if (!userId) return;
    const [count, list] = await Promise.all([
      getUnreadNotificationCount(),
      getMyNotifications(30),
    ]);
    setUnreadCount(count);
    setNotifications(list);
  };

  useEffect(() => {
    if (!userId) return;
    loadData();

    // Subscribe to Realtime notifications for instant in-app update
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationRow;
          setNotifications((prev) => [newNotif, ...prev]);
          if (!newNotif.read) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as NotificationRow;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      await loadData();
      setLoading(false);
    }
  };

  const handleItemClick = async (notif: NotificationRow) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);

    // Navigate to notification destination
    if (notif.action_url) {
      if (notif.action_url.startsWith("/chat/")) {
        const id = notif.action_url.replace("/chat/", "");
        nav({ to: "/chat/$id", params: { id } });
      } else if (notif.action_url === "/matches") {
        nav({ to: "/matches" });
      } else {
        nav({ to: "/discover" });
      }
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const renderIcon = (type: NotificationRow["type"]) => {
    switch (type) {
      case "match":
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Sparkles className="h-4 w-4" />
          </div>
        );
      case "like":
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <Heart className="h-4 w-4 fill-rose-400/30" />
          </div>
        );
      case "message":
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <MessageCircle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <Bell className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground shadow-xs transition-all hover:bg-muted active:scale-95",
            className
          )}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-scale-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-border bg-card p-0 flex flex-col"
      >
        <SheetHeader className="border-b border-border/80 px-5 py-4 text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                  {unreadCount} new
                </span>
              )}
            </SheetTitle>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-3">
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <p className="font-semibold text-sm text-foreground">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-[220px]">
                You'll receive updates when someone likes your profile or forms a Garba clash.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleItemClick(notif)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition-all active:scale-[0.99]",
                    notif.read
                      ? "bg-card/40 border border-border/40 opacity-80 hover:bg-muted/40"
                      : "bg-primary/5 border border-primary/25 shadow-xs hover:bg-primary/10"
                  )}
                >
                  {renderIcon(notif.type)}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-xs font-bold leading-tight",
                          notif.read ? "text-foreground" : "text-primary"
                        )}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {notif.body}
                    </p>
                  </div>

                  {!notif.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
