import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav, Btn, ChatIcon, Dandiya, Shell } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoUrls, type FeedRow } from "@/lib/after9";
import type { Database } from "@/integrations/supabase/types";
import { NotificationBell } from "@/components/notifications-popover";

type Match = Database["public"]["Functions"]["my_matches"]["Returns"][number];

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Clashes — After9" },
      { name: "description", content: "People who sent your Dandiya back." },
      { property: "og:title", content: "Clashes — After9" },
      { property: "og:description", content: "People who sent your Dandiya back." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Matches,
});

function Matches() {
  const [list, setList] = useState<Match[] | null>(null);
  const [me, setMe] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMe(data.user.id);
    });
    supabase.rpc("my_matches").then(({ data }) => setList(data ?? []));
  }, []);

  const urls = usePhotoUrls((list ?? []).map((m) => m.photo_path));
  return (
    <Shell maxWidth="wide">
      <div className="px-5 pb-2 pt-6 md:pt-10 flex flex-col md:flex-row md:items-baseline md:justify-between gap-2">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <h1 className="font-display text-4xl font-extrabold text-primary tracking-tight">Clashes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Everyone you clashed with. Connect on Instagram, plan a night, or message.</p>
          </div>
          <div className="md:hidden">
            <NotificationBell userId={me} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <NotificationBell userId={me} />
          </div>
          {list && list.length > 0 && (
            <span className="text-xs font-semibold tracking-wider uppercase text-action">
              {list.length} {list.length === 1 ? "Clash" : "Clashes"} on the floor
            </span>
          )}
        </div>
      </div>

      <main className="flex-1 pb-24 md:pb-28">
        {list === null ? (
          <div className="mx-5 mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-16 text-center animate-fade-in max-w-md mx-auto">
            <div className="animate-pulse-gentle">
              <Dandiya className="h-16 w-16 text-action" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-primary">No clashes yet.</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Send a few Dandiyas on Discover and see who sends one back. Chat opens instantly when both of you connect.</p>
            <Link to="/discover" className="mt-6">
              <Btn className="touch-tactile">
                <Dandiya className="h-5 w-5" />
                <span>Go to Discover</span>
              </Btn>
            </Link>
          </div>
        ) : (
          <div className="pt-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:px-5">
            {list.map((p) => (
              <Link
                key={p.id}
                to="/chat/$id"
                params={{ id: p.id }}
                className="touch-tactile group flex items-center gap-4 border-b border-border px-5 py-4 transition-all duration-150 md:rounded-md md:border md:border-border/80 md:bg-card md:hover:border-primary/50 md:hover:shadow-md md:active:scale-[0.99]"
              >
                <div className="h-18 w-15 shrink-0 overflow-hidden rounded-xs bg-muted shadow-xs">
                  {p.photo_path && urls[p.photo_path] && (
                    <img
                      src={urls[p.photo_path]}
                      alt={p.first_name ?? ""}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="font-display text-lg font-bold text-primary tracking-tight truncate">
                      {p.first_name}{p.age ? `, ${p.age}` : ""}
                    </p>
                  </div>
                  {p.college && (
                    <p className="truncate text-xs text-muted-foreground/90">{p.college}</p>
                  )}
                  <p className="mt-0.5 truncate text-sm text-foreground/85 font-medium">
                    {p.last_message ?? <span className="text-action italic">New clash · say hi</span>}
                  </p>
                </div>
                <div className="shrink-0 rounded-full bg-action/10 p-2 text-action transition-transform duration-200 group-hover:scale-110 group-hover:bg-action group-hover:text-action-foreground">
                  <ChatIcon className="h-5 w-5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </Shell>
  );
}
export type { FeedRow };
