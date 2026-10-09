import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChatIcon, Dandiya, Shell } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoUrls } from "@/lib/after9";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Msg = Database["public"]["Tables"]["messages"]["Row"];
type Match = Database["public"]["Functions"]["my_matches"]["Returns"][number];

export const Route = createFileRoute("/_authenticated/chat/$id")({
  head: () => ({
    meta: [
      { title: "Chat — After9" },
      { name: "description", content: "Private chat with your After9 clash." },
      { property: "og:title", content: "Chat — After9" },
      { property: "og:description", content: "Private chat with your After9 clash." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chat,
});

function Chat() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [me, setMe] = useState<string>("");
  const [other, setOther] = useState<Match | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [matchedSocials, setMatchedSocials] = useState<{ platform: string; handle: string; profile_url: string }[]>([]);
  const [t, setT] = useState("");
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const urls = usePhotoUrls([other?.photo_path]);

  useEffect(() => {
    let uid = "";
    supabase.auth.getUser().then(async ({ data }) => {
      uid = data.user!.id; setMe(uid);
      const { data: ms } = await supabase.rpc("my_matches");
      setOther(ms?.find((m) => m.id === id) ?? null);
      const { data: rows } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${uid},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${uid})`).order("created_at");
      setMsgs(rows ?? []);
      // Load matched socials guarded by database-level mutual consent
      const { data: socs } = await supabase.rpc("get_matched_socials", { target_user_id: id });
      setMatchedSocials((socs ?? []) as { platform: string; handle: string; profile_url: string }[]);
      // Clear unread notifications for this chat
      supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("action_url", `/chat/${id}`);
    });
    const ch = supabase.channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (pl) => {
        const m = pl.new as Msg;
        if ((m.sender_id === id && m.recipient_id === uid) || (m.sender_id === uid && m.recipient_id === id))
          setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  if (other === undefined) return <Shell><div /></Shell>;
  if (other === null) return <Shell><p className="p-8 text-muted-foreground">Chat opens only after a clash. <Link to="/discover" className="underline">Back</Link></p></Shell>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = t.trim();
    if (!body) return;
    setT("");
    const { data } = await supabase.from("messages").insert({ sender_id: me, recipient_id: id, body }).select().single();
    if (data) setMsgs((x) => (x.some((y) => y.id === data.id) ? x : [...x, data]));
  };
  const block = async (report: boolean) => {
    const reason = report ? prompt("What happened? (optional)") ?? "" : null;
    await supabase.from("blocks").insert({ blocker_id: me, blocked_id: id, report, reason });
    nav({ to: "/matches" });
  };

  return (
    <Shell maxWidth="default">
      <header className="relative mx-auto flex w-full max-w-2xl items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/matches" className="-ml-2 flex h-11 items-center gap-1.5 rounded-sm px-2 text-primary transition-colors hover:bg-muted/60" aria-label="Back to chats">
          <span className="text-xl leading-none">←</span>
          <span className="hidden text-sm font-semibold md:inline">Chats</span>
        </Link>
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted shadow-xs">
          {other.photo_path && urls[other.photo_path] && <img src={urls[other.photo_path]} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-primary">{other.first_name}</p>
          <p className="truncate text-xs text-muted-foreground">{other.college}</p>
        </div>
        <button onClick={() => setMenu(!menu)} className="-mr-2 flex h-11 w-11 items-center justify-center text-xl text-muted-foreground transition-colors hover:text-foreground" aria-label="More options">⋯</button>
        {menu && (
          <div className="absolute right-4 top-14 z-20 flex flex-col rounded-sm border border-border bg-card text-base shadow-lg animate-scale-in">
            <button className="px-5 py-4 text-left transition-colors hover:bg-muted/50" onClick={() => block(false)}>Unmatch & block</button>
            <button className="px-5 py-4 text-left text-destructive transition-colors hover:bg-muted/50" onClick={() => block(true)}>Report</button>
          </div>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2.5 px-4 py-5">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <span className="flex items-center gap-1 text-action"><Dandiya className="h-5 w-5" /><ChatIcon className="h-6 w-6" /><Dandiya className="h-5 w-5 -scale-x-100" /></span>
          <p className="max-w-md text-xs text-muted-foreground leading-relaxed">You and {other.first_name} both sent a Dandiya. This chat is just for you two. Be kind, meet in the crowd first.</p>
          {matchedSocials.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {matchedSocials.map((s) => (
                <a
                  key={s.platform}
                  href={s.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-primary shadow-2xs transition hover:border-action/60 hover:text-action"
                >
                  <span className="text-xs">
                    {s.platform === "instagram" ? "📸" : s.platform === "snapchat" ? "👻" : s.platform === "youtube" ? "▶️" : s.platform === "x" ? "𝕏" : s.platform === "linkedin" ? "💼" : "🔗"}
                  </span>
                  <span>@{s.handle}</span>
                  <span className="text-[10px] text-muted-foreground">↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
        {msgs.map((m) => (
          <p key={m.id} className={cn("max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-[15px] leading-snug shadow-2xs break-words", m.sender_id === me ? "self-end rounded-br-sm bg-primary text-primary-foreground" : "self-start rounded-bl-sm bg-card border border-border/40")}>{m.body}</p>
        ))}
        <div ref={endRef} />
      </main>
      <div className="sticky bottom-0 w-full border-t border-border bg-background/95 backdrop-blur-sm">
        <form onSubmit={send} className="mx-auto flex max-w-2xl items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <input
            value={t}
            maxLength={1000}
            onChange={(e) => setT(e.target.value)}
            placeholder="Which night are you dancing?"
            className="h-13 min-w-0 flex-1 rounded-full border border-border/60 bg-card px-5 text-base outline-none transition-colors focus:border-action"
          />
          <button className="touch-tactile h-13 shrink-0 rounded-full bg-action px-6 text-base font-semibold text-action-foreground shadow-xs transition-transform active:scale-95">Send</button>
        </form>
      </div>
    </Shell>
  );
}
