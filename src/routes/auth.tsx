import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Btn, Shell, AppIcon } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { isDisposableEmail } from "@/lib/disposable-domains";
import { Mail, KeyRound, ArrowLeft, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

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
  const [mode, setMode] = useState<"signup" | "signin" | "recovery" | "verify_otp">("signup");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [otp, setOtp] = useState("");
  const [hp, setHp] = useState(""); // Honeypot decoy field
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [invite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    try {
      const code = typeof window !== "undefined" ? localStorage.getItem("after9.invite") : null;
      if (code) setInvite(code);
    } catch {
      /* ignore storage read error */
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

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
      }).then(() => {}, () => {});
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

      if (mode === "verify_otp") {
        if (!otp.trim()) {
          setBusy(false);
          return setMsg("Please enter the 6-digit confirmation code from your email.");
        }
        let verifyRes = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "signup",
        });
        if (verifyRes.error) {
          verifyRes = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: otp.trim(),
            type: "email",
          });
        }
        setBusy(false);
        if (verifyRes.error) {
          return setMsg(verifyRes.error.message || "Invalid or expired verification code. Please check your inbox or tap Resend.");
        }
        if (verifyRes.data?.session || verifyRes.data?.user) {
          nav({ to: "/discover" });
        }
        return;
      }

      if (mode === "signup") {
        if (isDisposableEmail(email)) {
          setBusy(false);
          return setMsg("Temporary or disposable email domains are blocked to minimize fake users and protect safety. Please use your personal email (such as Gmail, Outlook, or your college address).");
        }

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
          setResendCooldown(60);
          setMode("verify_otp");
          setMsg(`Verification email sent to ${email.trim()}! Please enter the 6-digit confirmation code from the email below, or click the link in your inbox.`);
        }
        return;
      }

      // SIGN IN
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
          }).then(() => {}, () => {});
        }

        if (error.message.toLowerCase().includes("invalid login credentials")) {
          setShowResend(true);
          return setMsg("Invalid credentials. If you just created an account, please verify your email in your inbox first before signing in.");
        }
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setMode("verify_otp");
          setResendCooldown(30);
          return setMsg("Your email is not confirmed yet. Enter the 6-digit code sent to your inbox, or tap Resend below.");
        }
        return setMsg(error.message);
      }
      setFailCount(0);
      if (data?.session || data?.user) {
        nav({ to: "/discover" });
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
    if (resendCooldown > 0) return;
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
      setResendCooldown(60);
      setMsg(`New verification email & code sent to ${email.trim()}! Please check your inbox and spam folder.`);
    }
  };

  return (
    <Shell maxWidth="default">
      <div className="mx-auto flex w-full max-w-md flex-1 animate-rise flex-col px-5 pb-6 pt-10 md:my-auto md:py-12">
        <AppIcon className="h-14 w-14 shadow-sm" />

        {mode === "verify_otp" ? (
          <div key="verify_otp" className="animate-fade-in">
            <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight text-primary tracking-tight">
              Check your inbox.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a verification link and 6-digit code to <strong className="text-foreground">{email}</strong>.
            </p>
          </div>
        ) : (
          <div key={mode} className="animate-fade-in">
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-none text-primary tracking-tight">
              {mode === "signup" ? "Join the floor." : mode === "recovery" ? "Reset password." : "Welcome back."}
            </h1>
            <p className="mt-3 text-muted-foreground">Real people only. Every profile is checked before it goes live.</p>
          </div>
        )}

        {invite && mode !== "verify_otp" && (
          <p className="animate-scale-in mt-4 border-l-2 border-teal bg-card px-3 py-2 text-sm shadow-xs">
            <b>Invite {invite}</b> — you'll skip the photo check once you finish setup{localStorage.getItem("after9.chat") ? ", and your chat with your friend opens right away" : ""}.
          </p>
        )}

        {mode !== "verify_otp" && mode !== "recovery" && (
          <>
            <Btn variant="outline" className="touch-tactile mt-8" onClick={google}>
              Continue with Google
            </Btn>
            <p className="my-5 text-center text-xs tracking-widest text-muted-foreground">OR</p>
          </>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
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

          {mode === "verify_otp" ? (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  className={input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  required
                  placeholder="Enter code (e.g. 123456)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  autoFocus
                />
              </div>

              {/* Spam & Email Delivery Assistance Callout */}
              <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2 text-xs shadow-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Mail className="h-4 w-4 text-action" />
                  <span>Can't find the email?</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                  <li>Check your <b>Spam</b>, <b>Junk</b>, or <b>Promotions</b> folder.</li>
                  <li>Search for messages from <b>Supabase</b> or <b>After9</b>.</li>
                  <li>You can also click the confirmation link in the email directly.</li>
                </ul>
                <div className="pt-1 flex items-center justify-between border-t border-border/60">
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={resendCooldown > 0 || busy}
                    className="font-bold text-action underline hover:opacity-80 disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend verification email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setMsg("");
                    }}
                    className="text-muted-foreground hover:text-foreground underline text-[11px]"
                  >
                    Change email
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          {msg && (
            <div className="animate-shake rounded-sm border-l-2 border-primary bg-card p-3 text-sm text-foreground shadow-xs">
              <p>{msg}</p>
              {showResend && mode !== "verify_otp" && (
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
            {mode === "verify_otp"
              ? "Verify Code & Enter ✨"
              : mode === "signup"
                ? "Create account"
                : mode === "signin"
                  ? "Sign in"
                  : "Send recovery link"}
          </Btn>
        </form>

        <button
          className="touch-tactile mt-auto pt-6 text-sm text-muted-foreground transition hover:text-foreground"
          onClick={() => {
            setMsg("");
            setShowResend(false);
            if (mode === "verify_otp") {
              setMode("signin");
            } else {
              setMode(mode === "signup" ? "signin" : "signup");
            }
          }}
        >
          {mode === "signup"
            ? "Already on After9? Sign in"
            : mode === "recovery" || mode === "verify_otp"
              ? "Back to Sign in"
              : "New here? Create an account"}
        </button>
      </div>
    </Shell>
  );
}
