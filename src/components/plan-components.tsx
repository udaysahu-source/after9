import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
  Check,
  Plus,
  X,
  Search,
  Filter,
  ArrowRight,
  Info,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanEventItem } from "@/lib/plan.functions";
import { isSafeHttpsUrl } from "@/lib/plan.functions";
import { toast } from "sonner";

// ==========================================
// 1. DATE SELECTOR RIBBON (Movie-App Inspired)
// ==========================================
export interface DateRibbonItem {
  iso: string; // e.g. "2026-10-15"
  weekday: string; // e.g. "Thu"
  day: string; // e.g. "15"
  month: string; // e.g. "Oct"
  nightNumber?: number | undefined;
  hasEvents: boolean;
  hasVerified: boolean;
}

export function DateSelectorRibbon({
  dates,
  selectedDate,
  onSelectDate,
}: {
  dates: DateRibbonItem[];
  selectedDate: string | null;
  onSelectDate: (iso: string | null) => void;
}) {
  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar px-1 scroll-smooth">
        <button
          type="button"
          onClick={() => onSelectDate(null)}
          className={cn(
            "flex flex-col items-center justify-center shrink-0 min-w-[62px] h-[72px] rounded-2xl border px-2.5 py-1.5 transition-all text-xs active:scale-95",
            selectedDate === null
              ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
              : "bg-card border-border/80 text-muted-foreground hover:border-action/60 hover:text-primary"
          )}
        >
          <span className="text-[10px] uppercase font-semibold tracking-wider">All</span>
          <span className="font-display text-lg font-black my-0.5">Dates</span>
          <span className="text-[9px] opacity-80">9 Nights</span>
        </button>

        {dates.map((d) => {
          const isSelected = selectedDate === d.iso;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onSelectDate(d.iso)}
              className={cn(
                "group relative flex flex-col items-center justify-center shrink-0 min-w-[62px] h-[72px] rounded-2xl border px-2.5 py-1.5 transition-all active:scale-95",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                  : "bg-card border-border/80 text-muted-foreground hover:border-action/60 hover:text-primary"
              )}
            >
              <span className={cn("text-[10px] uppercase font-bold tracking-wider", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>
                {d.weekday}
              </span>
              <span className="font-display text-lg font-black my-0.5 leading-none">
                {d.day}
              </span>
              <span className="text-[10px] opacity-80">
                {d.month}
              </span>

              {/* Event indicators */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                {d.hasVerified ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" title="Verified event" />
                ) : d.hasEvents ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Event listing" />
                ) : null}
              </div>

              {d.nightNumber && (
                <span
                  className={cn(
                    "text-[8px] font-semibold tracking-tight uppercase mt-0.5 px-1 rounded-sm",
                    isSelected ? "bg-action text-white" : "text-action"
                  )}
                >
                  N{d.nightNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 2. EVENT CARD
// ==========================================
export function EventCard({
  event,
  isSaved,
  onToggleSave,
  onOpenGroupPlan,
}: {
  event: PlanEventItem;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
  onOpenGroupPlan?: (event: PlanEventItem) => void;
}) {
  const isVerified = event.verification_status === "verified";
  const hasPasses = event.has_valid_booking_url;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/plan/${event.slug || event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${event.title} — After9 Raipur Garba`,
          text: `Check out ${event.title} at ${event.venue} on After9!`,
          url,
        });
        return;
      } catch {
        /* fallback to clipboard */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Event link copied to clipboard!");
  };

  return (
    <div className="group relative flex flex-col rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs card-hover-lift hover:border-action/60 hover:shadow-md transition-all duration-200">
      {/* Top Banner / Poster Area (Aspect 16:9 to eliminate Cumulative Layout Shift) */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-plum-900 via-primary to-plum-950 flex items-center justify-center">
        {event.poster_url ? (
          <img
            src={event.poster_url}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={640}
            height={360}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-ivory/90">
            <span className="text-3xl mb-1.5 animate-bounce-soft">✨</span>
            <p className="font-display font-extrabold text-lg text-ivory tracking-tight line-clamp-1">{event.title}</p>
            <p className="text-xs text-ivory/70 line-clamp-1">{event.venue} · {event.city}</p>
          </div>
        )}

        {/* Semantic Status Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-600/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
              <AlertCircle className="h-3.5 w-3.5" /> Pending
            </span>
          )}

          {event.min_price_inr === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-md px-2 py-1 text-[11px] font-bold text-white shadow-xs">
              <Sparkles className="h-3 w-3" /> Free
            </span>
          )}

          {hasPasses && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-action/90 backdrop-blur-md px-2 py-1 text-[11px] font-bold text-white shadow-xs">
              <ExternalLink className="h-3 w-3" /> Passes Open
            </span>
          )}
        </div>

        {/* Bookmark & Share controls with 44px tap target safe hit area */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share event"
            className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white transition hover:bg-black/75 touch-tactile active:scale-90"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(event.id);
              }}
              aria-label={isSaved ? "Remove from saved plans" : "Save event to itinerary"}
              className={cn(
                "flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full backdrop-blur-md transition touch-tactile active:scale-90",
                isSaved ? "bg-action text-white shadow-xs" : "bg-black/50 text-white hover:bg-black/75"
              )}
            >
              <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            </button>
          )}
        </div>

        {/* Date pill overlay at bottom of poster */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-white">
            <Calendar className="h-3 w-3 text-action" />
            {formatEventDate(event.start_date, event.end_date)}
          </span>
          {event.start_time && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md px-2 py-1 text-[11px] font-medium text-white/90">
              <Clock className="h-3 w-3 text-action" />
              {event.start_time}
            </span>
          )}
        </div>
      </div>

      {/* Card Content Area */}
      <div className="flex flex-1 flex-col justify-between p-4.5 space-y-3">
        <div>
          <Link
            to="/plan/$id"
            params={{ id: event.slug || event.id }}
            className="focus:outline-hidden"
          >
            <h3 className="font-display text-lg font-black text-primary group-hover:text-action transition-colors line-clamp-1">
              {event.title}
            </h3>
          </Link>

          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mt-1 truncate">
            <MapPin className="h-3.5 w-3.5 text-action shrink-0" />
            <span className="truncate">{event.venue}</span>
            {event.area ? <span className="opacity-75">· {event.area}</span> : null}
          </p>

          {event.organizer ? (
            <p className="text-[11px] text-muted-foreground/80 mt-1 truncate">
              Organized by <span className="font-semibold text-foreground/80">{event.organizer}</span>
            </p>
          ) : null}

          {/* Highlights pills */}
          {event.highlights && event.highlights.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {event.highlights.slice(0, 2).map((h, i) => (
                <span
                  key={i}
                  className="rounded-full bg-secondary/80 border border-border/60 px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & Actions Footer */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
              Pass Price
            </span>
            <p className="text-xs font-extrabold text-primary">
              {event.min_price_inr !== null ? (
                event.min_price_inr === 0 ? (
                  <span className="text-sm font-black text-emerald-600">Free Entry</span>
                ) : (
                  <>
                    From <span className="text-sm font-black text-action">₹{event.min_price_inr}</span>
                  </>
                )
              ) : event.ticket_price_range ? (
                <span>{event.ticket_price_range}</span>
              ) : (
                <span className="text-muted-foreground font-medium italic">Price not confirmed</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenGroupPlan && (
              <button
                type="button"
                onClick={() => onOpenGroupPlan(event)}
                title="Plan night with friends or a clash"
                className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border/80 bg-background text-primary hover:border-action hover:text-action transition shadow-2xs touch-tactile active:scale-95"
              >
                <Users className="h-4 w-4" />
              </button>
            )}

            {hasPasses ? (
              <a
                href={event.booking_url!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!isSafeHttpsUrl(event.booking_url)) {
                    e.preventDefault();
                    toast.error("Invalid booking link.");
                  }
                }}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-action px-3.5 py-2 text-xs font-bold text-action-foreground shadow-xs transition hover:opacity-95 touch-tactile active:scale-95"
              >
                <span>Get Passes</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Link
                to="/plan/$id"
                params={{ id: event.slug || event.id }}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-95 touch-tactile active:scale-95"
              >
                <span>View Event</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. COMMUNITY SUGGEST EVENT MODAL
// ==========================================
export function SuggestEventModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    city: string;
    dates: string;
    venue: string;
    organizer?: string | undefined;
    sourceLink?: string | undefined;
    notes?: string | undefined;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("Raipur");
  const [dates, setDates] = useState("");
  const [venue, setVenue] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [sourceLink, setSourceLink] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !venue.trim() || !dates.trim()) {
      toast.error("Please fill event name, venue, and dates.");
      return;
    }
    if (sourceLink.trim() && !isSafeHttpsUrl(sourceLink.trim())) {
      toast.error("Source link must be a valid https:// URL.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        city: city.trim(),
        dates: dates.trim(),
        venue: venue.trim(),
        organizer: organizer.trim() || undefined,
        sourceLink: sourceLink.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Thank you! Your event suggestion has been submitted for verification.");
      onOpenChange(false);
      setName("");
      setDates("");
      setVenue("");
      setOrganizer("");
      setSourceLink("");
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit event suggestion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action/15 text-action">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-primary">Suggest an Event</h2>
            <p className="text-xs text-muted-foreground">Know a Garba night we missed? Help the community discover it.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground">Event Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Raas 2026"
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Dates *</label>
              <input
                type="text"
                required
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="e.g. 15-18 Oct 2026"
                className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Venue & Locality *</label>
            <input
              type="text"
              required
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Science College Ground, GE Road"
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Organizer (Optional)</label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="e.g. Raipur Cultural Club"
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Source / Official Booking Link (Optional)</label>
            <input
              type="url"
              value={sourceLink}
              onChange={(e) => setSourceLink(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Notes / Ticket Price Info</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pass price details, dress codes, or poster details..."
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-action"
            />
          </div>

          <div className="rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-action mt-0.5" />
            <p>All suggestions undergo human verification before appearing in the verified feed. Never submit fake passes or scam links.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-action px-5 py-2 text-xs font-bold text-action-foreground shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit for Verification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. GROUP PLAN CREATION MODAL
// ==========================================
export function CreateGroupPlanModal({
  open,
  onOpenChange,
  event,
  availableMatches,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PlanEventItem | null;
  availableMatches: Array<{ id: string; first_name: string; photo_path: string | null }>;
  onSubmit: (data: {
    eventId: string;
    planDate: string;
    proposedTime?: string | undefined;
    meetingPoint?: string | undefined;
    notes?: string | undefined;
    invitedUserIds: string[];
  }) => Promise<void>;
}) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [proposedTime, setProposedTime] = useState("20:00");
  const [meetingPoint, setMeetingPoint] = useState("Main Entrance / Ticket Counter");
  const [notes, setNotes] = useState("");
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open || !event) return null;

  const validDates = event.dates.length > 0
    ? event.dates
    : event.start_date
    ? [event.start_date]
    : ["2026-10-15"];

  const effectiveDate = selectedDate || validDates[0]!;

  const toggleInvitee = (id: string) => {
    setInvitedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        eventId: event.id,
        planDate: effectiveDate,
        proposedTime,
        meetingPoint,
        notes: notes.trim() || undefined,
        invitedUserIds: invitedIds,
      });
      toast.success("Garba group plan created! Invitations sent.");
      onOpenChange(false);
      setInvitedIds([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to create group plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-primary">Plan with Friends</h2>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{event.title} · {event.venue}</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground">Select Garba Date *</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {validDates.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95",
                    effectiveDate === d
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-background border-border/80 text-foreground hover:border-action/60"
                  )}
                >
                  {formatEventDate(d)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground">Arrival Time</label>
              <input
                type="time"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-hidden focus:border-action"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Public Meeting Point</label>
              <input
                type="text"
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="e.g. Near Box Office Gate 1"
                className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-hidden focus:border-action"
              />
            </div>
          </div>

          {/* Clash / Friend Invitee Picker */}
          <div>
            <label className="text-xs font-bold text-foreground">Invite From Your Clashes & Mutual Matches</label>
            {availableMatches.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1 italic">
                No mutual Dandiya clashes yet. You can still create this plan for yourself or invite people later!
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {availableMatches.map((m) => {
                  const isInvited = invitedIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleInvitee(m.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95",
                        isInvited
                          ? "bg-action text-white border-action shadow-xs"
                          : "bg-background border-border/80 text-foreground hover:border-action/60"
                      )}
                    >
                      {isInvited && <Check className="h-3 w-3" />}
                      <span>{m.first_name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Plan Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Wearing yellow traditional attire!"
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-sm outline-hidden focus:border-action"
            />
          </div>

          {/* Safety Reminder */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Festival Safety First</p>
              <p className="mt-0.5 leading-relaxed">
                Always meet your group at designated public festival entrances. Each participant must explicitly confirm their attendance.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-action px-5 py-2 text-xs font-bold text-action-foreground shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Confirm Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// UTILITY: Format date strings
// ==========================================
export function formatEventDate(
  startIso: string | null | undefined,
  endIso?: string | null | undefined
): string {
  if (!startIso || typeof startIso !== "string") return "TBD";
  try {
    const [sy, sm, sd] = startIso.split("-").map(Number);
    if (!sy || !sm || !sd) return startIso;
    const sDate = new Date(Date.UTC(sy, sm - 1, sd));

    const sDay = sDate.getUTCDate();
    const sMonth = sDate.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    const sYear = sDate.getUTCFullYear();

    if (!endIso || typeof endIso !== "string" || endIso === startIso) {
      return `${sDay} ${sMonth} ${sYear}`;
    }

    const [ey, em, ed] = endIso.split("-").map(Number);
    if (!ey || !em || !ed) return `${sDay} ${sMonth} ${sYear}`;
    const eDate = new Date(Date.UTC(ey, em - 1, ed));
    const eDay = eDate.getUTCDate();
    const eMonth = eDate.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    const eYear = eDate.getUTCFullYear();

    if (sy === ey && sm === em) {
      return `${sDay}–${eDay} ${sMonth} ${sYear}`;
    }
    if (sy === ey) {
      return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${sYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} – ${eDay} ${eMonth} ${eYear}`;
  } catch {
    return startIso;
  }
}
