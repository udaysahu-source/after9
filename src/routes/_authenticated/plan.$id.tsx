import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  Calendar,
  CalendarDays,
  MapPin,
  Clock,
  Ticket,
  ShieldCheck,
  AlertCircle,
  Bookmark,
  Share2,
  ExternalLink,
  Users,
  MessageCircle,
  ArrowLeft,
  Info,
  Check,
  Navigation,
  Sparkles,
} from "lucide-react";
import { BottomNav, Btn, Shell } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import {
  getEventDetail,
  toggleSaveEvent,
  setAttendanceInterest,
  createGroupPlan,
  isSafeHttpsUrl,
  type PlanEventItem,
} from "@/lib/plan.functions";
import { CreateGroupPlanModal, formatEventDate } from "@/components/plan-components";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plan/$id")({
  head: () => ({
    meta: [
      { title: "Garba Event Details — After9" },
      { name: "description", content: "Garba venue, timings, pass details, and group planning in Raipur." },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const fetchEventDetail = useServerFn(getEventDetail);
  const onToggleSave = useServerFn(toggleSaveEvent);
  const onSetAttendance = useServerFn(setAttendanceInterest);
  const onCreateGroupPlan = useServerFn(createGroupPlan);

  const [event, setEvent] = useState<PlanEventItem | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [attendance, setAttendance] = useState<string | null>(null);
  const [attendanceVisibility, setAttendanceVisibility] = useState<"mutual_matches" | "private">("mutual_matches");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Group plan modal
  const [groupPlanModalOpen, setGroupPlanModalOpen] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);

  // Suggest in Chat modal
  const [chatSuggestOpen, setChatSuggestOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchEvent(data.user.id);
      } else {
        fetchEvent();
      }
    });

    supabase.rpc("my_matches").then(({ data }) => {
      setMatches(data ?? []);
    });
  }, [id]);

  const fetchEvent = async (uid?: string) => {
    setLoading(true);
    try {
      const res = await fetchEventDetail({
        data: { idOrSlug: id, userId: uid },
      });
      setEvent(res.event);
      setIsSaved(res.isSaved);
      setAttendance(res.attendanceStatus);
    } catch (err: any) {
      toast.error("Failed to load event details.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!event) return;
    try {
      const res = await onToggleSave({ data: { eventId: event.id } });
      setIsSaved(res.saved);
      toast.success(res.saved ? "Added to your Navratri itinerary!" : "Removed from itinerary.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update saved event.");
    }
  };

  const handleShare = async () => {
    if (!event) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${event.title} — After9 Raipur Garba`,
          text: `Check out ${event.title} at ${event.venue} on After9!`,
          url,
        });
        return;
      } catch {
        /* fallback */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Event link copied to clipboard!");
  };

  const handleAttendanceChange = async (newStatus: "interested" | "going" | "none") => {
    if (!event) return;
    try {
      await onSetAttendance({
        data: {
          eventId: event.id,
          status: newStatus,
          visibility: attendanceVisibility,
        },
      });
      setAttendance(newStatus === "none" ? null : newStatus);
      toast.success(newStatus === "none" ? "Attendance removed." : `Marked as ${newStatus}!`);
    } catch (err: any) {
      toast.error("Failed to update attendance.");
    }
  };

  const handleSuggestInChat = async (matchId: string) => {
    if (!event || !userId) return;
    try {
      const datesText = event.start_date === event.end_date
        ? formatEventDate(event.start_date)
        : `${formatEventDate(event.start_date)} - ${formatEventDate(event.end_date)}`;

      const messageBody = `Hey! Want to go to "${event.title}" at ${event.venue} on ${datesText}? Let's plan it on After9: ${window.location.origin}/plan/${event.slug || event.id}`;

      await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: matchId,
        body: messageBody,
      });

      toast.success("Event recommendation sent to chat!");
      setChatSuggestOpen(false);
      nav({ to: "/chat/$id", params: { id: matchId } });
    } catch (err: any) {
      toast.error("Failed to suggest in chat.");
    }
  };

  if (loading) {
    return (
      <Shell maxWidth="default">
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center text-muted-foreground">
          <p className="text-sm font-semibold">Loading Garba event details...</p>
        </div>
        <BottomNav />
      </Shell>
    );
  }

  if (!event) {
    return (
      <Shell maxWidth="default">
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-3">
          <p className="font-display text-xl font-bold text-primary">Event Not Found</p>
          <p className="text-xs text-muted-foreground">This listing may have been moved or unpublished.</p>
          <Link to="/plan" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs">
            Back to Plan
          </Link>
        </div>
        <BottomNav />
      </Shell>
    );
  }

  const isVerified = event.verification_status === "verified";
  const hasPasses = isSafeHttpsUrl(event.booking_url);
  const mapsSearchQuery = encodeURIComponent(`${event.venue}, ${event.area || ""}, Raipur, Chhattisgarh`);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsSearchQuery}`;

  return (
    <Shell maxWidth="default" className="pb-28">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-background/95 backdrop-blur-md px-4 py-3">
        <Link
          to="/plan"
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All Events</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card text-foreground hover:border-action/60 transition shadow-2xs"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleSave}
            aria-label={isSaved ? "Saved" : "Save"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border transition shadow-2xs",
              isSaved
                ? "bg-action text-white border-action"
                : "border-border/80 bg-card text-foreground hover:border-action/60"
            )}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </button>
        </div>
      </header>

      {/* Hero Poster */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-gradient-to-br from-plum-950 via-primary to-plum-900 flex items-center justify-center">
        {event.poster_url ? (
          <img
            src={event.poster_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-ivory/90">
            <span className="text-4xl mb-2">✨</span>
            <h1 className="font-display font-black text-2xl md:text-3xl text-ivory tracking-tight">{event.title}</h1>
            <p className="text-xs text-ivory/80 mt-1">{event.venue} · {event.city}</p>
          </div>
        )}

        {/* Verification status pill */}
        <div className="absolute top-4 left-4">
          {isVerified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" /> Verified Event
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-xs">
              <AlertCircle className="h-4 w-4" /> Pending Verification
            </span>
          )}
        </div>
      </div>

      {/* Main Details Body */}
      <main className="px-5 pt-5 space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-black text-primary leading-tight">
            {event.title}
          </h1>
          {event.organizer ? (
            <p className="text-xs text-muted-foreground mt-1">
              Organized by <span className="font-semibold text-foreground">{event.organizer}</span>
            </p>
          ) : null}
        </div>

        {/* Key Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Dates & Times */}
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-action">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-bold text-foreground">Festival Dates</span>
            </div>
            <p className="text-xs font-semibold text-foreground leading-snug">
              {event.start_date === event.end_date
                ? formatEventDate(event.start_date)
                : `${formatEventDate(event.start_date)} – ${formatEventDate(event.end_date)}`}
            </p>
            {event.start_time ? (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-action" /> Timings: {event.start_time} {event.end_time ? `to ${event.end_time}` : ""}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Entry timings to be announced</p>
            )}
          </div>

          {/* Venue & Location */}
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-action">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-bold text-foreground">Venue</span>
              </div>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-action hover:underline inline-flex items-center gap-0.5"
              >
                <span>Directions</span>
                <Navigation className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs font-semibold text-foreground leading-snug truncate">
              {event.venue}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {event.address || `${event.area ? event.area + ", " : ""}${event.city}, Chhattisgarh`}
            </p>
          </div>
        </div>

        {/* Confirmed Passes & Ticket Status */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-action" /> Entry & Pass Details
            </span>
            {hasPasses && (
              <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                Official Booking Live
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <p className="text-lg font-black text-primary">
                {event.min_price_inr !== null ? (
                  <>
                    From <span className="text-2xl text-action">₹{event.min_price_inr}</span>
                  </>
                ) : event.ticket_price_range ? (
                  event.ticket_price_range
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground italic">Pricing to be confirmed by organizer</span>
                )}
              </p>
              {event.price_source && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Source: {event.price_source}</p>
              )}
            </div>

            {hasPasses ? (
              <a
                href={event.booking_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-action px-5 py-2.5 text-xs font-bold text-action-foreground shadow-xs hover:opacity-95 transition active:scale-95"
              >
                <span>Get Official Passes</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Booking links not published
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-border/60">
            ⚠️ <strong>Pass Verification Notice:</strong> After9 connects attendees and curates verified festival listings. All pass purchases, payments, and entry policies are managed exclusively by event organizers. Never buy unofficial passes from unverified sources.
          </p>
        </div>

        {/* Highlights and Themes */}
        {(event.highlights?.length > 0 || event.themes_count) && (
          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-primary">Event Highlights</h3>
            <div className="flex flex-wrap gap-2">
              {event.themes_count ? (
                <span className="rounded-xl border border-action/30 bg-action/10 px-3 py-1 text-xs font-semibold text-action">
                  ✨ {event.themes_count} Festive Themes
                </span>
              ) : null}
              {event.highlights.map((h, i) => (
                <span
                  key={i}
                  className="rounded-xl border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-foreground"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Additional Programs (e.g. Shehnaz Akhtar Bhajan Sandhya) */}
        {event.additional_programs && event.additional_programs.length > 0 && (
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
            <h3 className="font-display text-sm font-bold text-primary">Special Linked Programs</h3>
            {event.additional_programs.map((prog: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40">
                <span className="font-semibold text-foreground">{prog.name}</span>
                <span className="text-muted-foreground font-medium">{formatEventDate(prog.date)}</span>
              </div>
            ))}
          </div>
        )}

        {/* "Who's Going?" Section with Privacy Controls */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-primary flex items-center gap-1.5">
              <Users className="h-4 w-4 text-action" /> Your Attendance Interest
            </h3>
            <span className="text-[10px] text-muted-foreground">Voluntary & private</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAttendanceChange(attendance === "going" ? "none" : "going")}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-bold transition active:scale-95",
                attendance === "going"
                  ? "bg-action text-white shadow-xs"
                  : "border border-border/80 bg-background text-foreground hover:border-action/60"
              )}
            >
              {attendance === "going" ? "✓ I'm Going" : "I'm Going"}
            </button>
            <button
              type="button"
              onClick={() => handleAttendanceChange(attendance === "interested" ? "none" : "interested")}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-bold transition active:scale-95",
                attendance === "interested"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-background text-foreground hover:border-action/60"
              )}
            >
              {attendance === "interested" ? "✓ Interested" : "Interested"}
            </button>
          </div>

          {attendance && (
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Visibility:</span>
              <select
                value={attendanceVisibility}
                onChange={(e: any) => setAttendanceVisibility(e.target.value)}
                className="rounded-lg border border-border/80 bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground outline-hidden"
              >
                <option value="mutual_matches">Visible to Mutual Clashes</option>
                <option value="private">Only Me (Private)</option>
              </select>
            </div>
          )}
        </div>

        {/* Source & Verification provenance */}
        <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-action" /> Listing Provenance
          </p>
          <p>{event.source_notes || "Curated from Raipur festival organisers."}</p>
        </div>

        {/* Social Actions Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => setGroupPlanModalOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 transition active:scale-95"
          >
            <Users className="h-4 w-4" />
            <span>Plan with Friends</span>
          </button>

          {matches.length > 0 && (
            <button
              type="button"
              onClick={() => setChatSuggestOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-3 text-xs font-bold text-foreground shadow-2xs hover:border-action/60 hover:text-action transition active:scale-95"
            >
              <MessageCircle className="h-4 w-4 text-action" />
              <span>Suggest in Chat</span>
            </button>
          )}
        </div>
      </main>

      {/* Suggest in Chat Modal */}
      {chatSuggestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in">
            <h3 className="font-display text-lg font-black text-primary">Suggest to a Clash</h3>
            <p className="text-xs text-muted-foreground mt-1">Pick a mutual match to send this Garba event invitation:</p>

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSuggestInChat(m.id)}
                  className="w-full flex items-center justify-between rounded-xl border border-border/80 p-2.5 text-left text-xs font-semibold text-foreground hover:border-action hover:bg-muted/40 transition"
                >
                  <span>{m.first_name}</span>
                  <span className="text-action text-[11px] font-bold">Send ↗</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setChatSuggestOpen(false)}
              className="mt-4 w-full rounded-xl border border-border/80 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Group Plan Modal */}
      <CreateGroupPlanModal
        open={groupPlanModalOpen}
        onOpenChange={setGroupPlanModalOpen}
        event={event}
        availableMatches={matches}
        onSubmit={async (data) => {
          await onCreateGroupPlan({ data });
        }}
      />

      <BottomNav />
    </Shell>
  );
}
