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
  Phone,
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
  const [posterError, setPosterError] = useState(false);

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
  const directionsUrl =
    event.maps_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${event.venue}, ${event.area || ""}, Raipur, Chhattisgarh`
    )}`;

  const isApproximateLocation =
    Boolean(event.location_confidence && event.location_confidence.toLowerCase().includes("approximate")) ||
    Boolean(event.address && (event.address.toLowerCase().includes("confirm") || event.address.toLowerCase().includes("approximate") || event.address.toLowerCase().includes("not confirmed"))) ||
    Boolean(event.venue && event.venue.toLowerCase().includes("confirm"));

  const instagramUsername = event.instagram_handle
    ? event.instagram_handle.replace(/^@/, "").trim()
    : null;
  const instagramUrl = instagramUsername
    ? `https://instagram.com/${instagramUsername}`
    : null;

  // Split multiple phone numbers if present (e.g. "+91 7000656161; +91 7566665557")
  const contactNumbers = event.contact_verified
    ? event.contact_verified
        .split(/[;,]/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

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
        {event.poster_url && !posterError ? (
          <img
            src={event.poster_url}
            alt={event.title}
            className="h-full w-full object-cover"
            onError={() => setPosterError(true)}
          />
        ) : (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-center text-ivory/95 bg-gradient-to-br from-plum-950 via-primary to-plum-900 overflow-hidden">
            {/* Consistent After9 Garba-themed fallback styling */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent" />
            <span className="text-4xl mb-2 select-none animate-bounce-soft">✨ 🪘 💃</span>
            <h1 className="font-display font-black text-2xl md:text-3xl text-ivory tracking-tight max-w-md">
              {event.title}
            </h1>
            <p className="text-xs font-semibold text-ivory/80 mt-1 max-w-sm">
              {event.venue} · {event.city}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-ivory/90 border border-white/20">
              After9 Raipur Garba 2026
            </span>
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
              <AlertCircle className="h-4 w-4" /> Pending Review
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 text-xs text-muted-foreground">
            {event.organizer ? (
              <p>
                Organized by <span className="font-semibold text-foreground">{event.organizer}</span>
              </p>
            ) : null}

            {/* Separate Instagram profile link */}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-action hover:underline"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                <span>@{instagramUsername}</span>
              </a>
            )}
          </div>
        </div>

        {/* Approximate Venue Disclaimer */}
        {isApproximateLocation && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Approximate Venue Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              The exact venue entrance or pin is approximate / awaiting organizer confirmation. The directions link navigates to the general vicinity. Verify the specific entry gate with organizers before arriving.
            </p>
          </div>
        )}

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
                <span>Get Directions</span>
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

        {/* Pass Contacts */}
        {contactNumbers.length > 0 && (
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-action">
              <Phone className="h-4 w-4" />
              <span className="text-xs font-bold text-foreground">Pass Enquiries & Contact</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {contactNumbers.map((num, idx) => (
                <a
                  key={idx}
                  href={`tel:${num.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:border-action/60 hover:text-action transition"
                >
                  <Phone className="h-3 w-3 text-action" />
                  <span>{num}</span>
                </a>
              ))}
            </div>
          </div>
        )}

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
                  event.min_price_inr === 0 ? (
                    <span className="text-2xl text-emerald-600">Free Entry</span>
                  ) : (
                    <>
                      From <span className="text-2xl text-action">₹{event.min_price_inr}</span>
                    </>
                  )
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
                <span>Get Passes</span>
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

        {/* Poster Content Notes / Extracted Details */}
        {event.poster_content_notes && (
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Info className="h-4 w-4 text-action" />
              <span>Poster Notes & Entry Guidelines</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 p-3 rounded-xl border border-border/40">
              {event.poster_content_notes}
            </p>
          </div>
        )}

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
        <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-action" /> Listing Provenance & Review Notes
          </p>
          <p>{event.source_notes || "Curated from Raipur festival organisers."}</p>
          {event.verification_notes && (
            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              🔍 <strong>Verification note:</strong> {event.verification_notes}
            </p>
          )}
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
