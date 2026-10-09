import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Compass, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import appIcon from "@/assets/app_icon.png";

export function AppIcon({ className }: { className?: string }) {
  return <img src={appIcon} alt="After9" className={cn("rounded-[22%]", className)} width={256} height={256} />;
}

export function Dandiya({ className, strike }: { className?: string; strike?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("transition-transform duration-200", strike && "rotate-12 scale-110", className)} aria-hidden>
      <path d="M5 21 L17 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M19 21 L7 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
      <path d="M9.2 15 l1.6 1 M14.8 15 l-1.6 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 13.5 15 7.5M15 13.5 9 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-extrabold leading-none tracking-tight", className)}>
      After<span className="text-action">9</span>
    </span>
  );
}

export function Btn({
  children,
  variant = "action",
  loading = false,
  className,
  disabled,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "action" | "plum" | "ghost" | "outline";
  loading?: boolean;
}) {
  const v = {
    action: "bg-action text-action-foreground hover:brightness-105 active:brightness-95 shadow-sm",
    plum: "bg-primary text-primary-foreground hover:brightness-110 active:brightness-90",
    ghost: "text-foreground hover:bg-muted/60 active:bg-muted",
    outline: "border border-border bg-card text-foreground hover:border-primary active:bg-muted/40",
  }[variant];

  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cn(
        "touch-tactile inline-flex h-14 select-none items-center justify-center gap-2 rounded-sm px-6 text-base font-semibold transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none",
        v,
        className
      )}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Dandiya className="h-5 w-5 animate-spin-smooth" />
          <span>Please wait…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Shell({
  children,
  className,
  maxWidth = "default",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: "narrow" | "default" | "wide" | "full";
}) {
  const maxW = {
    narrow: "max-w-md",
    default: "max-w-md md:max-w-2xl lg:max-w-3xl",
    wide: "max-w-md md:max-w-4xl lg:max-w-5xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <div className={cn("mx-auto flex min-h-dvh w-full flex-col overflow-x-hidden bg-background pt-safe pb-safe", maxW, className)}>
      {children}
    </div>
  );
}

export function BottomNav() {
  const item =
    "group relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[50px] py-1.5 px-3 text-xs font-medium text-muted-foreground transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action rounded-xl";
  const active = { className: "text-primary font-semibold" };
  return (
    <>
      {/* Spacer to guarantee page content is never hidden behind the fixed bottom navbar */}
      <div className="h-20 w-full shrink-0 pointer-events-none md:h-24" aria-hidden="true" />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/80 bg-background/95 backdrop-blur-md px-2 py-1 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[360px] md:max-w-md md:rounded-full md:border md:border-border/80 md:bg-card/95 md:backdrop-blur-md md:shadow-xl md:px-5 md:py-1.5 md:pb-1.5"
        aria-label="Main Navigation"
      >
        <Link to="/discover" className={item} activeProps={active}>
          {({ isActive }) => (
            <>
              <Compass
                className={cn(
                  "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-action scale-105 stroke-[2.3]" : "text-muted-foreground/85 stroke-2"
                )}
              />
              <span className={cn(isActive && "text-primary font-bold")}>Discover</span>
              {isActive && <span className="h-1 w-1 rounded-full bg-action animate-scale-in" />}
            </>
          )}
        </Link>
        <Link to="/matches" className={item} activeProps={active}>
          {({ isActive }) => (
            <>
              <MessageCircle
                className={cn(
                  "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-action scale-105 stroke-[2.3]" : "text-muted-foreground/85 stroke-2"
                )}
              />
              <span className={cn(isActive && "text-primary font-bold")}>Chats</span>
              {isActive && <span className="h-1 w-1 rounded-full bg-action animate-scale-in" />}
            </>
          )}
        </Link>
        <Link to="/profile" className={item} activeProps={active}>
          {({ isActive }) => (
            <>
              <User
                className={cn(
                  "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-action scale-105 stroke-[2.3]" : "text-muted-foreground/85 stroke-2"
                )}
              />
              <span className={cn(isActive && "text-primary font-bold")}>You</span>
              {isActive && <span className="h-1 w-1 rounded-full bg-action animate-scale-in" />}
            </>
          )}
        </Link>
      </nav>
    </>
  );
}

