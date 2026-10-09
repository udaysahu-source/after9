import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // If returning from OAuth redirect with token hash or PKCE code, wait for session exchange
    if (typeof window !== "undefined" && (window.location.hash.includes("access_token") || window.location.search.includes("code="))) {
      const { data: initial } = await supabase.auth.getSession();
      if (initial.session) return;

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

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
