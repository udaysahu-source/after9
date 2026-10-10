import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, AppIcon, Wordmark, Btn, Dandiya } from "@/components/after9";
import { FESTIVAL, NIGHTS, goingNights, usePhotoUrls, invalidatePhotoUrl } from "@/lib/after9";
import { ExternalLink, Lock, Calendar, School, Instagram, Youtube, Linkedin, Twitter, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "After9 — Festival Identity Card" },
      { name: "description", content: "Meet on the floor. Stay after." },
      { name: "robots", content: "noindex, nofollow" }, // Never index private profiles in search engines
      { property: "og:title", content: "After9 — Festival Identity Card" },
      { property: "og:description", content: "Meet on the floor. Stay after." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicProfilePage,
});

type PublicProfile = {
  id: string;
  share_token: string;
  first_name: string;
  age: number | null;
  college: string | null;
  branch: string | null;
  prompt: string | null;
  nights: Record<string, string>;
  photo_path: string | null;
  card_preferences: any;
  social_links: {
    platform: string;
    handle: string;
    profile_url: string;
  }[];
};

function PublicProfilePage() {
  const { token } = Route.useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_public_profile", { token });
        if (rpcErr || !data) {
          setError(true);
        } else {
          setProfile(data as unknown as PublicProfile);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const urls = usePhotoUrls([profile?.photo_path]);
  const photoUrl = profile?.photo_path ? urls[profile.photo_path] : null;

  if (loading) {
    return (
      <Shell maxWidth="default">
        <div className="flex flex-1 items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <AppIcon className="h-10 w-10 animate-pulse" />
            <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
              Loading festival card…
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !profile) {
    return (
      <Shell maxWidth="default">
        <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6 pb-4">
          <Link to="/" className="flex items-center gap-2">
            <AppIcon className="h-7 w-7" />
            <Wordmark className="text-xl text-primary" />
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-primary">
            Card Unavailable or Private
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">
            This After9 identity card is either private, expired, or was updated by its owner.
          </p>

          <Link to="/" className="mt-8">
            <Btn className="px-6">Enter After9</Btn>
          </Link>
        </main>
      </Shell>
    );
  }

  const activeNights = goingNights(profile.nights);

  return (
    <Shell maxWidth="default">
      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6 pb-3">
        <Link to="/" className="flex items-center gap-2">
          <AppIcon className="h-7 w-7" />
          <Wordmark className="text-xl text-primary" />
        </Link>
        <span className="rounded-full bg-action/15 px-3 py-1 text-[11px] font-bold text-action">
          {FESTIVAL.name} {FESTIVAL.year}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-16 pt-2">
        {/* Card Frame */}
        <article className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-md">
          {/* Portrait Photo */}
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
            {photoUrl && !photoError ? (
              <img
                src={photoUrl}
                alt={profile.first_name}
                className="h-full w-full object-cover"
                onError={() => {
                  invalidatePhotoUrl(profile.photo_path);
                  setPhotoError(true);
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2A1428] to-[#140816] font-display text-7xl font-extrabold text-primary-foreground">
                {profile.first_name.slice(0, 1).toUpperCase()}
              </div>
            )}

            {/* Subtle Gradient Scrim at bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />

            {/* Name & Details over bottom of photo */}
            <div className="absolute bottom-4 left-4 right-4">
              <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
                {profile.first_name}
                {profile.age ? `, ${profile.age}` : ""}
              </h1>

              {profile.college && (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-action">
                  <School className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {profile.college}
                    {profile.branch ? ` · ${profile.branch}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="p-5 space-y-4">
            {/* Personality Prompt */}
            {profile.prompt && (
              <div className="rounded-2xl border border-border/60 bg-muted/40 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Garba night isn't complete without…
                </p>
                <p className="font-sans text-sm italic text-foreground/90">
                  “{profile.prompt}”
                </p>
              </div>
            )}

            {/* Festival Attendance */}
            {activeNights.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-action" />
                  Attending {activeNights.length} of 9 Nights
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {NIGHTS.map((n) => {
                    const isAttending = activeNights.includes(n.n);
                    return (
                      <span
                        key={n.n}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition",
                          isAttending
                            ? "bg-action/20 text-action font-bold border border-action/40"
                            : "bg-muted/40 text-muted-foreground/60"
                        )}
                      >
                        N{n.n} · {n.date}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Connected Socials */}
            {profile.social_links.length > 0 && (
              <div className="border-t border-border/70 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Social Links
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.social_links.map((s) => (
                    <a
                      key={s.platform}
                      href={s.profile_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-action transition"
                    >
                      {s.platform === "instagram" && <Instagram className="h-3.5 w-3.5 text-[#E1306C]" />}
                      {s.platform === "x" && <Twitter className="h-3.5 w-3.5 text-[#1DA1F2]" />}
                      {s.platform === "youtube" && <Youtube className="h-3.5 w-3.5 text-[#FF0000]" />}
                      {s.platform === "linkedin" && <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />}
                      {s.platform === "snapchat" && <span>👻</span>}
                      {s.platform === "custom" && <LinkIcon className="h-3.5 w-3.5 text-action" />}
                      <span className="font-mono">{s.handle}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Enter After9 CTA */}
        <div className="mt-8 rounded-2xl border border-action/40 bg-gradient-to-br from-card via-card to-action/10 p-5 text-center shadow-sm space-y-3">
          <div className="flex justify-center">
            <Dandiya className="h-10 w-10 text-action animate-bounce" />
          </div>
          <h2 className="font-display text-lg font-extrabold text-primary">
            Meet {profile.first_name} on After9
          </h2>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Social discovery for real people on Navratri and Garba nights. Chat opens only on a mutual Dandiya clash.
          </p>
          <Link to="/" className="block pt-1">
            <Btn className="w-full">Join the Floor →</Btn>
          </Link>
        </div>
      </main>
    </Shell>
  );
}
