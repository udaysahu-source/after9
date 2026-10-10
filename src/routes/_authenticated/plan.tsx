import { createFileRoute, Link, useNavigate, Outlet, useMatch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  CalendarDays,
  Search,
  Filter,
  Bookmark,
  Users,
  Plus,
  Compass,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { BottomNav, Btn, Shell } from "@/components/after9";
import { supabase } from "@/integrations/supabase/client";
import {
  listPublicEvents,
  listMySavedEvents,
  toggleSaveEvent,
  listMyGroupPlans,
  respondToGroupPlan,
  submitEventSuggestion,
  createGroupPlan,
  type PlanEventItem,
} from "@/lib/plan.functions";
import {
  DateSelectorRibbon,
  EventCard,
  SuggestEventModal,
  CreateGroupPlanModal,
  formatEventDate,
  type DateRibbonItem,
} from "@/components/plan-components";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plan — After9 Garba Nights & Passes" },
      { name: "description", content: "Discover confirmed Garba events, compare venue pass prices, and plan nights with your crew in Raipur." },
      { property: "og:title", content: "Plan — After9 Garba Nights & Passes" },
      { property: "og:description", content: "Discover confirmed Garba events, compare venue pass prices, and plan nights with your crew in Raipur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanRootWrapper,
});

function PlanRootWrapper() {
  const isChild = useMatch({ from: "/_authenticated/plan/$id", shouldThrow: false });
  if (isChild) {
    return <Outlet />;
  }
  return <PlanPage />;
}

// Configured 2026 Navratri festival dates (9 Nights of Garba in Raipur)
const FESTIVAL_DATES_2026: Array<{ iso: string; weekday: string; day: string; month: string; night: number }> = [
  { iso: "2026-10-11", weekday: "Sun", day: "11", month: "Oct", night: 1 },
  { iso: "2026-10-12", weekday: "Mon", day: "12", month: "Oct", night: 2 },
  { iso: "2026-10-13", weekday: "Tue", day: "13", month: "Oct", night: 3 },
  { iso: "2026-10-14", weekday: "Wed", day: "14", month: "Oct", night: 4 },
  { iso: "2026-10-15", weekday: "Thu", day: "15", month: "Oct", night: 5 },
  { iso: "2026-10-16", weekday: "Fri", day: "16", month: "Oct", night: 6 },
  { iso: "2026-10-17", weekday: "Sat", day: "17", month: "Oct", night: 7 },
  { iso: "2026-10-18", weekday: "Sun", day: "18", month: "Oct", night: 8 },
  { iso: "2026-10-19", weekday: "Mon", day: "19", month: "Oct", night: 9 },
];

const RAIPUR_LOCALITIES = [
  { id: "all", label: "All Raipur" },
  { id: "vip road", label: "VIP Road" },
  { id: "avadhpuri", label: "Avadhpuri" },
  { id: "telibandha", label: "Telibandha" },
  { id: "shankar nagar", label: "Shankar Nagar" },
  { id: "naya raipur", label: "Naya Raipur" },
  { id: "samta colony", label: "Samta Colony" },
];

function PlanPage() {
  const fetchPublicEvents = useServerFn(listPublicEvents);
  const fetchSaved = useServerFn(listMySavedEvents);
  const fetchGroupPlans = useServerFn(listMyGroupPlans);
  const onToggleSave = useServerFn(toggleSaveEvent);
  const onRespondGroupPlan = useServerFn(respondToGroupPlan);
  const onSuggestEvent = useServerFn(submitEventSuggestion);
  const onCreateGroupPlan = useServerFn(createGroupPlan);

  const [activeTab, setActiveTab] = useState<"discover" | "itinerary">("discover");
  const [city, setCity] = useState("Raipur");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [hasTicketsOnly, setHasTicketsOnly] = useState(false);
  const [under500Only, setUnder500Only] = useState(false);
  const [sortBy, setSortBy] = useState<"time" | "price" | "name" | "date">("time");

  const [events, setEvents] = useState<PlanEventItem[]>([]);
  const [savedEvents, setSavedEvents] = useState<Array<{ saved_at: string; event: PlanEventItem }>>([]);
  const [groupPlans, setGroupPlans] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Modals state
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [groupPlanModalOpen, setGroupPlanModalOpen] = useState(false);
  const [targetEventForPlan, setTargetEventForPlan] = useState<PlanEventItem | null>(null);
  const [matches, setMatches] = useState<any[]>([]);

  // Debounce search query to prevent stutter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load events and user itinerary
  const loadData = async () => {
    setLoading(true);
    try {
      const [evList, savedList, plansList] = await Promise.all([
        fetchPublicEvents({
          data: {
            city,
            area: selectedArea !== "all" ? selectedArea : undefined,
            date: selectedDate ?? undefined,
            query: debouncedQuery || undefined,
            verifiedOnly: verifiedOnly || undefined,
            freeOnly: freeOnly || undefined,
            hasBookingUrl: hasTicketsOnly || undefined,
            maxBudget: under500Only ? 500 : undefined,
            sortBy,
          },
        }),
        fetchSaved().catch(() => []),
        fetchGroupPlans().catch(() => []),
      ]);

      setEvents(evList);
      setSavedEvents(savedList);
      setGroupPlans(plansList);
      setSavedIds(new Set(savedList.map((s) => s.event.id)));
    } catch (err: any) {
      console.warn("[Plan] Load error:", err);
      toast.error("Could not load Garba events. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [city, selectedDate, debouncedQuery, selectedArea, verifiedOnly, freeOnly, hasTicketsOnly, under500Only, sortBy]);

  const activeFiltersCount =
    (selectedArea !== "all" ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (freeOnly ? 1 : 0) +
    (hasTicketsOnly ? 1 : 0) +
    (under500Only ? 1 : 0) +
    (debouncedQuery ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedArea("all");
    setVerifiedOnly(false);
    setFreeOnly(false);
    setHasTicketsOnly(false);
    setUnder500Only(false);
    setSearchQuery("");
  };

  // Load user matches for group planning
  useEffect(() => {
    supabase.rpc("my_matches").then(({ data }) => {
      setMatches(data ?? []);
    });
  }, []);

  // Compute ribbon dates with indicator dots
  const ribbonDates: DateRibbonItem[] = useMemo(() => {
    return FESTIVAL_DATES_2026.map((f) => {
      return {
        iso: f.iso,
        weekday: f.weekday,
        day: f.day,
        month: f.month,
        nightNumber: f.night,
        hasEvents: true, // We know Raipur catalogue has events spanning these dates
        hasVerified: false, // Initially pending verification
      };
    });
  }, []);

  const handleToggleSave = async (eventId: string) => {
    try {
      const res = await onToggleSave({ data: { eventId } });
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (res.saved) {
          next.add(eventId);
          toast.success("Event added to your Navratri itinerary!");
        } else {
          next.delete(eventId);
          toast.success("Event removed from itinerary.");
        }
        return next;
      });
      // Refresh saved list
      const updated = await fetchSaved().catch(() => []);
      setSavedEvents(updated);
    } catch (err: any) {
      toast.error(err.message || "Failed to update saved event.");
    }
  };

  const handleOpenGroupPlan = (event: PlanEventItem) => {
    setTargetEventForPlan(event);
    setGroupPlanModalOpen(true);
  };

  return (
    <Shell maxWidth="wide" className="pb-24">
      {/* Header */}
      <header className="px-5 pt-6 md:pt-10 pb-4 flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-action/15 px-2.5 py-0.5 text-xs font-bold text-action">
              <Sparkles className="h-3.5 w-3.5" /> Raipur Garba Nights 2026
            </span>
            <div className="relative inline-block">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground">
                <MapPin className="h-3 w-3 text-action" /> {city}
              </span>
            </div>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-primary tracking-tight mt-1.5">
            Plan Your Garba
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Compare venues, confirmed timings and official passes across Raipur. Coordinate nights with your crew or clashes.
          </p>
        </div>

        {/* Tab switch & Suggest action */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="inline-flex rounded-2xl border border-border/80 bg-card p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("discover")}
              className={cn(
                "rounded-xl px-4 py-1.5 text-xs font-bold transition",
                activeTab === "discover"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("itinerary")}
              className={cn(
                "rounded-xl px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5",
                activeTab === "itinerary"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>My Plans</span>
              {savedEvents.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-black text-white">
                  {savedEvents.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSuggestModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border/80 bg-card px-3 py-2 text-xs font-bold text-foreground shadow-2xs hover:border-action/60 hover:text-action transition active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Suggest Event</span>
          </button>
        </div>
      </header>

      {/* DISCOVER TAB */}
      {activeTab === "discover" && (
        <div className="px-5 space-y-5">
          {/* 1. Movie-app style date ribbon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-foreground flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-action" /> Select Night
              </span>
              <span className="text-muted-foreground text-[11px]">
                {selectedDate ? `Showing events for ${formatEventDate(selectedDate)}` : "Showing all 9 festival dates"}
              </span>
            </div>
            <DateSelectorRibbon
              dates={ribbonDates}
              selectedDate={selectedDate}
              onSelectDate={(iso) => setSelectedDate(iso)}
            />
          </div>

          {/* 2. Search & filter bar */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by venue (e.g. VIP Road, Avadhpuri, Royal Castle)..."
                  className="w-full rounded-2xl border border-border/80 bg-card pl-10 pr-8 py-2 text-xs md:text-sm outline-hidden focus:border-action shadow-2xs transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                aria-label="Sort events"
                className="rounded-2xl border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-action shadow-2xs"
              >
                <option value="time">Sort: Earliest Time</option>
                <option value="price">Sort: Lowest Price</option>
                <option value="name">Sort: A–Z Name</option>
                <option value="date">Sort: Festival Date</option>
              </select>
            </div>

            {/* Locality Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-1 shrink-0 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-action" /> Locality:
              </span>
              {RAIPUR_LOCALITIES.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedArea(loc.id)}
                  className={cn(
                    "rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95 border",
                    selectedArea === loc.id
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                      : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-action/60"
                  )}
                >
                  {loc.label}
                </button>
              ))}
            </div>

            {/* Filter chips & Clear */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95",
                    verifiedOnly
                      ? "bg-teal-500 text-white border-teal-500 shadow-xs"
                      : "bg-card border-border/80 text-muted-foreground hover:border-action/60"
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Verified Only</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFreeOnly(!freeOnly)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95",
                    freeOnly
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-card border-border/80 text-muted-foreground hover:border-action/60"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Free Entry</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUnder500Only(!under500Only)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95",
                    under500Only
                      ? "bg-action text-white border-action shadow-xs"
                      : "bg-card border-border/80 text-muted-foreground hover:border-action/60"
                  )}
                >
                  <span>Under ₹500</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHasTicketsOnly(!hasTicketsOnly)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95",
                    hasTicketsOnly
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-card border-border/80 text-muted-foreground hover:border-action/60"
                  )}
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Passes Available</span>
                </button>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-xl border border-dashed border-border/80 px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-destructive hover:border-destructive/60 transition shrink-0"
                >
                  Reset ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Result count status */}
            {!loading && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 pt-0.5">
                <span>
                  Showing <strong className="text-foreground">{events.length}</strong> {events.length === 1 ? "Garba night" : "Garba nights"}
                  {selectedArea !== "all" && <span> in <strong className="text-foreground">{selectedArea}</strong></span>}
                </span>
                {activeFiltersCount > 0 && (
                  <span className="text-action font-semibold">
                    {activeFiltersCount} {activeFiltersCount === 1 ? "filter active" : "filters active"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3. Event list */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-action mb-2" />
              <p className="text-xs font-semibold">Finding Garba nights in Raipur...</p>
            </div>
          ) : events.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/60 p-10 text-center space-y-3">
              <span className="text-4xl animate-bounce-soft">🪔</span>
              <h3 className="font-display text-xl font-bold text-primary">No events found for this filter</h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                We haven't listed a Garba event matching your search or date yet. Know an organizer hosting a night here?
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="min-h-[44px] touch-tactile active:scale-95 rounded-xl border border-border/80 bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-2xs hover:bg-muted transition-all"
                >
                  Clear Filters
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestModalOpen(true)}
                  className="min-h-[44px] touch-tactile active:scale-95 rounded-xl bg-action px-5 py-2.5 text-xs font-bold text-action-foreground shadow-xs hover:opacity-90 transition-all"
                >
                  Suggest an Event
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  isSaved={savedIds.has(ev.id)}
                  onToggleSave={handleToggleSave}
                  onOpenGroupPlan={handleOpenGroupPlan}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ITINERARY TAB */}
      {activeTab === "itinerary" && (
        <div className="px-5 space-y-6 animate-fade-in">
          {/* Disclaimer banner */}
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/10 p-4 text-xs text-teal-900 dark:text-teal-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              Personal Navratri Itinerary
            </p>
            <p className="text-[11px] leading-relaxed text-teal-800 dark:text-teal-300">
              Saving an event adds it to your personal schedule so you and your friends can coordinate.
              Official passes must be purchased directly from the respective organizer or authorized booking platform.
            </p>
          </div>

          {/* Group Plans Section */}
          {groupPlans.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-extrabold text-primary flex items-center gap-2">
                <Users className="h-5 w-5 text-action" /> Your Group Plans
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupPlans.map((gp: any) => (
                  <div key={gp.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          gp.status === "confirmed" ? "bg-teal-500/15 text-teal-600" : "bg-amber-500/15 text-amber-600"
                        )}>
                          {gp.status === "confirmed" ? "✓ Confirmed" : "⏳ Awaiting Responses"}
                        </span>
                        <h4 className="font-display text-base font-extrabold text-primary mt-1">{gp.events?.title}</h4>
                        <p className="text-xs text-muted-foreground">📍 {gp.events?.venue}</p>
                      </div>
                      <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                        {formatEventDate(gp.plan_date)}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded-xl">
                      <p><span className="font-semibold text-foreground">Time:</span> {gp.proposed_time || "20:00"}</p>
                      <p><span className="font-semibold text-foreground">Meeting Point:</span> {gp.meeting_point}</p>
                      {gp.notes && <p><span className="font-semibold text-foreground">Note:</span> {gp.notes}</p>}
                    </div>

                    {/* Participants list */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <div className="flex items-center -space-x-1.5">
                        {(gp.participants || []).map((p: any, idx: number) => (
                          <span
                            key={idx}
                            title={`${p.profiles?.first_name || "Friend"} (${p.status})`}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[11px] font-bold text-white shadow-2xs",
                              p.status === "accepted" ? "bg-teal-500" : p.status === "declined" ? "bg-red-400" : "bg-amber-500"
                            )}
                          >
                            {(p.profiles?.first_name || "F")[0]}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await onRespondGroupPlan({ data: { planId: gp.id, response: "accepted" } });
                            toast.success("Response recorded!");
                            loadData();
                          }}
                          className="min-h-[40px] touch-tactile active:scale-95 rounded-xl bg-action px-3.5 py-2 text-xs font-bold text-action-foreground shadow-2xs hover:opacity-90 transition-all"
                        >
                          I'm In ✨
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onRespondGroupPlan({ data: { planId: gp.id, response: "declined" } });
                            toast.success("Plan declined.");
                            loadData();
                          }}
                          className="min-h-[40px] touch-tactile active:scale-95 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                        >
                          Can't Go
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Events Section */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-extrabold text-primary flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-action" /> Saved Garba Nights ({savedEvents.length})
            </h2>

            {savedEvents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-gradient-to-b from-card via-card/80 to-action/5 p-8 text-center space-y-4 shadow-2xs">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-action/10 border border-action/20 text-action">
                  <Bookmark className="h-8 w-8 animate-bounce-soft" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <p className="font-display text-lg font-bold text-primary">Your Raipur Navratri Itinerary</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Bookmark your favorite Garba nights to track venue timings, ticket sales, and easily coordinate group plans with your Dandiya clashes.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground/90 font-medium py-1">
                  <span className="rounded-full bg-secondary/80 px-2.5 py-1">📅 Daily Schedule</span>
                  <span className="rounded-full bg-secondary/80 px-2.5 py-1">🎟️ Pass Price Compare</span>
                  <span className="rounded-full bg-secondary/80 px-2.5 py-1">🤝 1-Click Group Plans</span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("discover")}
                    className="min-h-[44px] touch-tactile active:scale-95 rounded-xl bg-action px-6 py-2.5 text-xs font-bold text-action-foreground shadow-xs hover:opacity-95 transition-all"
                  >
                    Explore Raipur Events →
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {savedEvents.map(({ event }) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isSaved={true}
                    onToggleSave={handleToggleSave}
                    onOpenGroupPlan={handleOpenGroupPlan}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <SuggestEventModal
        open={suggestModalOpen}
        onOpenChange={setSuggestModalOpen}
        onSubmit={async (data) => {
          await onSuggestEvent({ data });
        }}
      />

      <CreateGroupPlanModal
        open={groupPlanModalOpen}
        onOpenChange={setGroupPlanModalOpen}
        event={targetEventForPlan}
        availableMatches={matches}
        onSubmit={async (data) => {
          await onCreateGroupPlan({ data });
          loadData();
        }}
      />

      <BottomNav />
    </Shell>
  );
}
