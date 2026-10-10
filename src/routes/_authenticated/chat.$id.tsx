import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ChatIcon, Dandiya, Shell } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoUrls } from "@/lib/after9";
import { listPublicEvents, createGroupPlan, type PlanEventItem } from "@/lib/plan.functions";
import { formatEventDate } from "@/components/plan-components";
import { cn } from "@/lib/utils";
import { CalendarDays, ExternalLink, ShieldCheck, Sparkles, X, Check } from "lucide-react";
import { toast } from "sonner";
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
  const fetchEvents = useServerFn(listPublicEvents);
  const onCreatePlan = useServerFn(createGroupPlan);
  const [me, setMe] = useState<string>("");
  const [other, setOther] = useState<Match | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [matchedSocials, setMatchedSocials] = useState<{ platform: string; handle: string; profile_url: string }[]>([]);
  const [t, setT] = useState("");
  const [menu, setMenu] = useState(false);

  // Garba Plan Suggestion Modal state
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [eventsList, setEventsList] = useState<PlanEventItem[]>([]);
  const [selectedEv, setSelectedEv] = useState<PlanEventItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

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
    const chTopic = `chat-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ch = supabase.channel(chTopic)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (pl) => {
        const m = pl.new as Msg;
        if ((m.sender_id === id && m.recipient_id === uid) || (m.sender_id === uid && m.recipient_id === id))
          setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const loadEventsForPicker = async () => {
    setPlanPickerOpen(true);
    if (eventsList.length === 0) {
      const evs = await fetchEvents({ data: { city: "Raipur" } }).catch(() => []);
      setEventsList(evs);
      if (evs.length > 0) {
        setSelectedEv(evs[0]!);
        setSelectedDate(evs[0]!.start_date || "2026-10-15");
      }
    }
  };

  if (other === undefined) return <Shell><div /></Shell>;
  if (other === null) return <Shell><p className="p-8 text-muted-foreground">Chat opens only after a clash. <Link to="/discover" className="underline">Back</Link></p></Shell>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = t.trim().slice(0, 1000);
    if (!body) return;
    setT("");
    const { data, error } = await supabase.from("messages").insert({ sender_id: me, recipient_id: id, body }).select().single();
    if (error) {
      console.warn("[Chat] Send failed:", error.message);
      return;
    }
    if (data) setMsgs((x) => (x.some((y) => y.id === data.id) ? x : [...x, data]));
  };

  const sendPlanSuggestion = async () => {
    if (!selectedEv || !selectedDate) return;
    const planPayload = JSON.stringify({
      type: "garba_plan",
      eventId: selectedEv.id,
      slug: selectedEv.slug,
      title: selectedEv.title,
      venue: selectedEv.venue,
      date: selectedDate,
      bookingUrl: selectedEv.booking_url,
      verificationStatus: selectedEv.verification_status,
    });
    const body = `[GARBA_PLAN:${planPayload}]`;
    const { data, error } = await supabase.from("messages").insert({ sender_id: me, recipient_id: id, body }).select().single();
    if (error) {
      toast.error("Failed to send plan suggestion.");
      return;
    }
    if (data) setMsgs((x) => (x.some((y) => y.id === data.id) ? x : [...x, data]));
    setPlanPickerOpen(false);
    toast.success("Garba plan suggested!");
  };

  const handleAcceptPlan = async (parsedPlan: any) => {
    try {
      await onCreatePlan({
        data: {
          eventId: parsedPlan.eventId,
          planDate: parsedPlan.date,
          proposedTime: "20:00",
          meetingPoint: "Main Venue Entrance",
          notes: `Accepted plan from chat with ${other.first_name}`,
          invitedUserIds: [id],
        },
      });
      // Send message confirming acceptance
      const body = `I'm in for ${parsedPlan.title} on ${formatEventDate(parsedPlan.date)}! Let's meet on the floor 💃✨`;
      await supabase.from("messages").insert({ sender_id: me, recipient_id: id, body });
      toast.success("Plan confirmed and added to your Navratri itinerary!");
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm plan.");
    }
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

        {/* Suggest plan button in header */}
        <button
          type="button"
          onClick={loadEventsForPicker}
          className="inline-flex items-center gap-1 rounded-xl bg-action/15 border border-action/30 px-2.5 py-1 text-xs font-bold text-action hover:bg-action/25 transition shadow-2xs active:scale-95"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Suggest Plan</span>
        </button>

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

        {/* Messages feed */}
        {msgs.map((m) => {
          const isSender = m.sender_id === me;
          const isPlanMsg = m.body.startsWith("[GARBA_PLAN:");

          if (isPlanMsg) {
            try {
              const rawJson = m.body.slice(12, -1);
              const planData = JSON.parse(rawJson);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[90%] sm:max-w-[75%] rounded-3xl p-4 shadow-sm border space-y-3",
                    isSender
                      ? "self-end bg-primary text-primary-foreground border-primary"
                      : "self-start bg-card border-border/80 text-card-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-action/20 text-action px-2 py-0.5 text-[10px] font-bold">
                      <Sparkles className="h-3 w-3" /> Garba Plan Suggestion
                    </span>
                    <span className="text-[10px] opacity-80">{formatEventDate(planData.date)}</span>
                  </div>

                  <div>
                    <h4 className="font-display text-base font-extrabold leading-tight">{planData.title}</h4>
                    <p className="text-xs opacity-90 mt-0.5">📍 {planData.venue}</p>
                  </div>

                  <div className="pt-2 border-t border-white/20 flex flex-wrap items-center gap-2">
                    <Link
                      to="/plan/$id"
                      params={{ id: planData.slug || planData.eventId }}
                      className="text-xs font-bold underline hover:opacity-80 inline-flex items-center gap-1"
                    >
                      <span>View Event</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>

                    {!isSender && (
                      <button
                        type="button"
                        onClick={() => handleAcceptPlan(planData)}
                        className="rounded-xl bg-action px-3 py-1 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95"
                      >
                        Accept Plan ✓
                      </button>
                    )}
                  </div>
                </div>
              );
            } catch {
              /* Fallback to regular bubble if json parse fails */
            }
          }

          return (
            <p
              key={m.id}
              className={cn(
                "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-[15px] leading-snug shadow-2xs break-words",
                isSender
                  ? "self-end rounded-br-sm bg-primary text-primary-foreground"
                  : "self-start rounded-bl-sm bg-card border border-border/40"
              )}
            >
              {m.body}
            </p>
          );
        })}
        <div ref={endRef} />
      </main>

      {/* Suggest Plan Drawer / Modal */}
      {planPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setPlanPickerOpen(false)}
              className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-display text-xl font-black text-primary">Suggest a Garba Night</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pick an event and date to send to {other.first_name}:</p>

            {eventsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Loading Raipur Garba events...</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground">Select Venue Event</label>
                  <div className="mt-1 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {eventsList.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          setSelectedEv(ev);
                          setSelectedDate(ev.start_date || "2026-10-15");
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-2xl border transition active:scale-98",
                          selectedEv?.id === ev.id
                            ? "border-action bg-action/10 shadow-xs"
                            : "border-border/80 bg-background hover:border-action/60"
                        )}
                      >
                        <p className="font-display text-xs font-bold text-primary truncate">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{ev.venue}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedEv && (
                  <div>
                    <label className="text-xs font-bold text-foreground">Select Night / Date</label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(selectedEv.dates.length > 0 ? selectedEv.dates : [selectedEv.start_date || "2026-10-15"]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDate(d)}
                          className={cn(
                            "rounded-xl border px-3 py-1 text-xs font-semibold transition",
                            selectedDate === d
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border/80 bg-background hover:border-action"
                          )}
                        >
                          {formatEventDate(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPlanPickerOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendPlanSuggestion}
                    className="rounded-xl bg-action px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90"
                  >
                    Send Suggestion ↗
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message input bar */}
      <div className="sticky bottom-0 w-full border-t border-border bg-background/95 backdrop-blur-sm">
        <form onSubmit={send} className="mx-auto flex max-w-2xl items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={loadEventsForPicker}
            title="Suggest a Garba Night"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground hover:border-action/60 hover:text-action transition shadow-2xs active:scale-95"
          >
            <CalendarDays className="h-5 w-5" />
          </button>
          <input
            value={t}
            maxLength={1000}
            onChange={(e) => setT(e.target.value)}
            placeholder="Which night are you dancing?"
            className="h-12 min-w-0 flex-1 rounded-full border border-border/60 bg-card px-5 text-base outline-none transition-colors focus:border-action"
          />
          <button className="touch-tactile h-12 shrink-0 rounded-full bg-action px-6 text-sm font-semibold text-action-foreground shadow-xs transition-transform active:scale-95">Send</button>
        </form>
      </div>
    </Shell>
  );
}

