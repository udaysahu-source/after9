import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
    "group relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[48px] py-1.5 px-3 text-xs font-medium text-muted-foreground transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action rounded-xl";
  const active = { className: "text-primary font-semibold" };
  return (
    <nav
      className="sticky bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)] md:fixed md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[340px] md:max-w-md md:rounded-full md:border md:border-border md:bg-card/95 md:backdrop-blur-md md:shadow-lg md:px-5 md:py-1.5"
      aria-label="Main Navigation"
    >
      <Link to="/discover" className={item} activeProps={active}>
        {({ isActive }) => (
          <>
            <Dandiya className={cn("h-5 w-5 transition-transform duration-200 group-hover:scale-110", isActive && "text-primary scale-105")} />
            <span>Discover</span>
            {isActive && <span className="h-1 w-1 rounded-full bg-action animate-scale-in" />}
          </>
        )}
      </Link>
      <Link to="/matches" className={item} activeProps={active}>
        {({ isActive }) => (
          <>
            <ChatIcon className={cn("h-5 w-5 transition-transform duration-200 group-hover:scale-110", isActive && "text-primary scale-105")} />
            <span>Chats</span>
            {isActive && <span className="h-1 w-1 rounded-full bg-action animate-scale-in" />}
          </>
        )}
      </Link>
      <Link to="/profile" className={item} activeProps={active}>
        {({ isActive }) => (
          <>
            <span className={cn("font-display text-base leading-5 transition-transform duration-200 group-hover:scale-110", isActive && "text-primary")}>●</span>
            <span>You</span>
            {isActive && <span className="h-1 w-1 rounded-full bg-action animate-scale-in" />}
          </>
        )}
      </Link>
    </nav>
  );
}

