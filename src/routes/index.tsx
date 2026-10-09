import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import hero from "@/assets/hero.jpg";
import { AppIcon, Btn, Wordmark } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "After9 — Meet on the floor. Stay after." },
      {
        name: "description",
        content:
          "Discover people going to the same Garba nights. Send a Dandiya. 18+, real people only.",
      },
      { property: "og:title", content: "After9 — Meet on the floor. Stay after." },
      {
        property: "og:description",
        content: "Discover people going to the same Garba nights. 18+, real people only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const nav = useNavigate();
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const code = qs.get("invite");
    if (code) localStorage.setItem("after9.invite", code.toUpperCase());
    const ref = qs.get("ref");
    const src = qs.get("src");
    const seenKey = `after9.opened.${src}.${code ?? ref}`;
    if (src && !sessionStorage.getItem(seenKey)) {
      sessionStorage.setItem(seenKey, "1");
      if (src === "card" && code) supabase.rpc("log_card_open", { _kind: "invite", _code: code });
      if (src === "story" && ref && /^[0-9a-f-]{36}$/i.test(ref)) {
        localStorage.setItem("after9.ref", ref);
        supabase.rpc("log_card_open", { _kind: "story", _ref: ref });
      }
    }
    if (new URLSearchParams(location.search).get("chat")) localStorage.setItem("after9.chat", "1");
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/discover" });
    });
  }, [nav]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md md:max-w-5xl md:flex-row flex-col overflow-x-hidden bg-background">
      {/* Hero photography section */}
      <div className="relative h-[55dvh] md:h-auto md:w-1/2 md:min-h-dvh overflow-hidden bg-primary/10">
        <img
          src={hero}
          alt="Friends dancing Garba under festival lights"
          className="h-full w-full object-cover animate-scale-in transition-transform duration-700 ease-[var(--ease-out-quint)] hover:scale-[1.03]"
          width={1024}
          height={1536}
        />
        <div className="animate-rise absolute left-5 top-5 flex items-center gap-2 rounded-sm bg-background/95 py-1.5 pl-1.5 pr-3 shadow-xs backdrop-blur-xs">
          <AppIcon className="h-8 w-8" />
          <Wordmark className="text-xl text-primary" />
        </div>
      </div>

      {/* Editorial content & action section */}
      <div className="-mt-10 md:mt-0 relative mx-4 md:mx-0 flex flex-1 flex-col justify-center rounded-t-sm md:rounded-none bg-background px-4 md:px-12 pt-6 md:py-12 shadow-xs md:shadow-none">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <h1 className="font-display animate-rise text-[clamp(2.15rem,7vw,3.5rem)] font-extrabold leading-[0.95] text-primary tracking-tight">
            Meet on the floor.
            <br />
            <span className="text-action inline-block">Stay after.</span>
          </h1>
          <p className="mt-4 md:mt-6 animate-rise text-[15px] md:text-[17px] leading-relaxed text-muted-foreground [animation-delay:120ms]">
            Discover people going to the same Garba nights. Send a Dandiya. If they send one back,
            it's a clash.
          </p>
          <div className="mt-8 md:mt-12 flex flex-col gap-3 pb-4 pt-4 animate-rise [animation-delay:200ms]">
            <Btn
              onClick={() => nav({ to: "/auth" })}
              className="group touch-tactile shadow-md text-base md:text-lg h-14 md:h-16"
            >
              <span>Enter After9</span>
              <span className="inline-block transition-transform duration-200 ease-[var(--ease-out-quint)] group-hover:translate-x-1.5">
                →
              </span>
            </Btn>
            <Btn variant="ghost" onClick={() => nav({ to: "/auth" })} className="touch-tactile">
              I already have an account
            </Btn>
            <p className="pt-2 text-center text-xs tracking-widest text-muted-foreground">
              18+ · REAL PEOPLE ONLY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
