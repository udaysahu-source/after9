import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Btn, Shell, AppIcon } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — After9" },
      { name: "description", content: "Sign in or create your After9 account." },
      { property: "og:title", content: "Sign in — After9" },
      { property: "og:description", content: "Sign in or create your After9 account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

const input = "h-14 w-full border-b-2 border-border bg-transparent text-lg outline-none transition-colors duration-200 focus:border-action placeholder:text-muted-foreground/60";

function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin" | "recovery">("signup");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [hp, setHp] = useState(""); // Honeypot decoy field
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownSeconds > 0) {
      return setMsg(`Too many consecutive attempts. Please wait ${cooldownSeconds} seconds.`);
    }

    // Controlled Decoy Check: Bots filling hidden form field
    if (hp.trim()) {
      supabase.rpc("log_security_event", {
        p_event_type: "bot_decoy_triggered",
        p_severity: "critical",
        p_metadata: { form: "auth_submit", mode },
      }).catch(() => {});
      return setMsg("Invalid submission detected.");
    }

    setBusy(true);
    setMsg("");
    setShowResend(false);

    try {
      if (mode === "recovery") {
        if (!email.trim()) {
          setBusy(false);
          return setMsg("Enter your account email to receive a password recovery link.");
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/discover`,
        });
        setBusy(false);
        if (error) {
          return setMsg(error.message);
        }
        setMsg(`If an account exists for ${email.trim()}, password recovery instructions have been sent to your inbox.`);
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pw,
          options: { emailRedirectTo: `${window.location.origin}/discover` },
        });
        setBusy(false);
        if (error) {
          setFailCount((f) => f + 1);
          if (error.message.includes("weak_password") || error.message.includes("pwned")) {
            return setMsg("Password was identified as common or weak. Please choose a more unique, stronger password (8+ characters).");
          }
          return setMsg(error.message);
        }
        if (data?.session) {
          nav({ to: "/discover" });
        } else if (data?.user) {
          setMsg(`Verification email sent to ${email.trim()}! Please click the confirmation link in your inbox, then sign in.`);
          setShowResend(true);
          setMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pw,
        });
        setBusy(false);
        if (error) {
          const nextFail = failCount + 1;
          setFailCount(nextFail);
          if (nextFail >= 5) {
            setCooldownSeconds(30);
            supabase.rpc("log_security_event", {
              p_event_type: "repeated_auth_failures",
              p_severity: "warn",
              p_metadata: { failures: nextFail },
            }).catch(() => {});
          }

          if (error.message.toLowerCase().includes("invalid login credentials")) {
            setShowResend(true);
            return setMsg("Invalid credentials. If you just created an account, please verify your email in your inbox first before signing in.");
          }
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setShowResend(true);
            return setMsg("Your email has not been confirmed yet. Please check your inbox and spam folder for the confirmation link.");
          }
          return setMsg(error.message);
        }
        setFailCount(0);
        if (data?.session || data?.user) {
          nav({ to: "/discover" });
        }
      }
    } catch (err: unknown) {
      setBusy(false);
      setMsg(err instanceof Error ? err.message : "An unexpected error occurred during authentication.");
    }
  };

  const google = async () => {
    setBusy(true);
    setMsg("");
    try {
      const isLovable = typeof window !== "undefined" && (window.location.hostname.includes("lovable") || window.location.hostname.includes("gptengineer"));
      if (isLovable) {
        const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/discover` });
        if (r?.error) {
          setBusy(false);
          setMsg(r.error.message ?? "Google sign-in failed");
        }
      } else {
        // Direct Supabase Google OAuth for local development and direct hosts
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/discover`,
            skipBrowserRedirect: true,
          },
        });
        if (error) {
          setBusy(false);
          return setMsg(error.message);
        }
        if (data?.url) {
          // Pre-flight check if Google provider has been configured in Supabase
          try {
            const check = await fetch(data.url, { redirect: "manual" });
            if (check.status >= 400) {
              const err = await check.json().catch(() => ({}));
              setBusy(false);
              if (err?.msg?.includes("missing OAuth secret") || err?.error_code === "validation_failed") {
                return setMsg("Google OAuth is not enabled on this Supabase project (missing Client ID / Secret in Supabase dashboard under Authentication → Providers → Google). Please use Email & Password below, or add Google credentials in your Supabase project.");
              }
              return setMsg(err?.msg ?? "Google sign-in is currently unavailable on this Supabase project.");
            }
          } catch {
            // In case of preflight fetch network issues, proceed with direct redirect
          }
          window.location.href = data.url;
        }
      }
    } catch (err: unknown) {
      setBusy(false);
      setMsg(err instanceof Error ? err.message : "Google sign-in failed.");
    }
  };

  const resendConfirmation = async () => {
    if (!email.trim()) return setMsg("Please enter your email above first.");
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/discover` },
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
    } else {
      setMsg(`New confirmation link sent to ${email.trim()}! Please check your inbox and spam folder.`);
    }
  };

  return (
    <Shell maxWidth="default">
      <div className="mx-auto flex w-full max-w-md flex-1 animate-rise flex-col px-5 pb-6 pt-10 md:my-auto md:py-12">
        <AppIcon className="h-14 w-14 shadow-sm" />
        <div key={mode} className="animate-fade-in">
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-none text-primary tracking-tight">
            {mode === "signup" ? "Join the floor." : "Welcome back."}
          </h1>
          <p className="mt-3 text-muted-foreground">Real people only. Every profile is checked before it goes live.</p>
        </div>
        {invite && (
          <p className="animate-scale-in mt-4 border-l-2 border-teal bg-card px-3 py-2 text-sm shadow-xs">
            <b>Invite {invite}</b> — you'll skip the photo check once you finish setup{localStorage.getItem("after9.chat") ? ", and your chat with your friend opens right away" : ""}.
          </p>
        )}
        <Btn variant="outline" className="touch-tactile mt-8" onClick={google}>
          Continue with Google
        </Btn>
        <p className="my-5 text-center text-xs tracking-widest text-muted-foreground">OR</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Controlled Decoy field: Invisible to genuine users and screen readers, filled by naive bots */}
          <input
            type="text"
            name="hp_organizer_code"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none", zIndex: -1 }}
            aria-hidden="true"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />

          <input
            className={input}
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode !== "recovery" && (
            <input
              className={input}
              type="password"
              required
              minLength={8}
              placeholder="Password (8+ characters)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          )}

          {mode === "signin" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setMsg("");
                  setMode("recovery");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {msg && (
            <div className="animate-shake rounded-sm border-l-2 border-primary bg-card p-3 text-sm text-foreground shadow-xs">
              <p>{msg}</p>
              {showResend && (
                <button
                  type="button"
                  onClick={resendConfirmation}
                  className="mt-2 text-xs font-semibold text-action underline hover:opacity-80"
                >
                  Resend confirmation email
                </button>
              )}
            </div>
          )}
          <Btn loading={busy} className="touch-tactile mt-2 shadow-sm">
            {mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send recovery link"}
          </Btn>
        </form>
        <button
          className="touch-tactile mt-auto pt-6 text-sm text-muted-foreground transition hover:text-foreground"
          onClick={() => {
            setMsg("");
            setShowResend(false);
            setMode(mode === "signup" ? "signin" : "signup");
          }}
        >
          {mode === "signup"
            ? "Already on After9? Sign in"
            : mode === "recovery"
              ? "Back to Sign in"
              : "New here? Create an account"}
        </button>
      </div>
    </Shell>
  );
}
