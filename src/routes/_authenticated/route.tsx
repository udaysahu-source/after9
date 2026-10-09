import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1. If returning from OAuth redirect with token hash or PKCE code, wait for session exchange
    if (typeof window !== "undefined" && (window.location.hash.includes("access_token") || window.location.search.includes("code="))) {
      const { data: initial } = await supabase.auth.getSession();
      if (initial?.session) return;

      const oauthSession = await new Promise((resolve) => {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
          if (sess) {
            sub.subscription.unsubscribe();
            resolve(sess);
          }
        });
        setTimeout(() => {
          sub.subscription.unsubscribe();
          resolve(null);
        }, 3000);
      });
      if (oauthSession) return;
    }

    // 2. Check current active session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      // If access token is expired or close to expiry (<60s), attempt background refresh
      const expiresAt = sessionData.session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && expiresAt < now + 60) {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) return;
        } catch {
          // Fall through to other checks
        }
      } else {
        return;
      }
    }

    // 3. If session wasn't immediately active in memory, attempt refresh from stored refresh_token
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) return;
    } catch {
      // Proceed to fallback
    }

    // 4. Check cached user identity
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) return;
    } catch {
      // Network hiccup - check grace period below
    }

    // 5. Short grace period for Supabase to finish restoring session from storage
    const delayedSession = await new Promise((resolve) => {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
        if (sess) {
          sub.subscription.unsubscribe();
          resolve(sess);
        }
      });
      setTimeout(() => {
        sub.subscription.unsubscribe();
        resolve(null);
      }, 1000);
    });

    if (delayedSession) return;

    // Truly unauthenticated -> redirect to /auth
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
