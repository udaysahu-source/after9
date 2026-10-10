import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ShieldAlert,
  Users,
  ShieldCheck,
  Ticket,
  Calendar,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Eye,
  Trash2,
  Lock,
  Plus,
  Sparkles,
  Rocket,
  Globe,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkAdminStatus,
  getAdminOverviewMetrics,
  getAdminLaunchControl,
  toggleAdminDiscoverLaunch,
  listAdminUsers,
  updateUserModeration,
  listAdminReports,
  resolveAdminReport,
  listAdminInvites,
  revokeAdminInvite,
  listAdminEvents,
  saveAdminEvent,
  verifyAdminEvent,
  listAdminEventSuggestions,
  resolveAdminEventSuggestion,
  getAdminSystemHealth,
  getAdminAuditLogs,
  getAdminSecurityOverview,
  type AdminStatusResult,
} from "@/lib/admin.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — After9" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

type AdminTab = "overview" | "launch" | "users" | "moderation" | "invites" | "events" | "health" | "security";

function AdminDashboard() {
  const checkStatus = useServerFn(checkAdminStatus);
  const getMetrics = useServerFn(getAdminOverviewMetrics);
  const getLaunchCtrl = useServerFn(getAdminLaunchControl);
  const toggleLaunch = useServerFn(toggleAdminDiscoverLaunch);
  const listUsers = useServerFn(listAdminUsers);
  const updateModeration = useServerFn(updateUserModeration);
  const getReports = useServerFn(listAdminReports);
  const resolveReport = useServerFn(resolveAdminReport);
  const getInvites = useServerFn(listAdminInvites);
  const revokeInvite = useServerFn(revokeAdminInvite);
  const getEvents = useServerFn(listAdminEvents);
  const saveEvent = useServerFn(saveAdminEvent);
  const verifyEvent = useServerFn(verifyAdminEvent);
  const getEventSuggestions = useServerFn(listAdminEventSuggestions);
  const resolveSuggestion = useServerFn(resolveAdminEventSuggestion);
  const getHealth = useServerFn(getAdminSystemHealth);
  const getAuditLogs = useServerFn(getAdminAuditLogs);
  const getSecurityOverview = useServerFn(getAdminSecurityOverview);

  const [authStatus, setAuthStatus] = useState<AdminStatusResult | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [securityData, setSecurityData] = useState<any>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  // State for metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [growthWindow, setGrowthWindow] = useState<"24h" | "7d" | "30d" | "all">("24h");

  // State for Launch Control
  const [launchControl, setLaunchControl] = useState<any>(null);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [targetInput, setTargetInput] = useState("50");
  const [launchModalOpen, setLaunchModalOpen] = useState(false);

  // State for user management
  const [userList, setUserList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ action: "suspend" | "reactivate" | "approve" | "reject"; user: any } | null>(null);

  // State for moderation reports
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [modNote, setModNote] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // State for invites
  const [invites, setInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // State for events
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSubTab, setEventSubTab] = useState<"listings" | "suggestions">("listings");
  const [eventSuggestions, setEventSuggestions] = useState<any[]>([]);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>({
    title: "",
    slug: "",
    venue: "",
    area: "",
    address: "",
    city: "Raipur",
    state: "Chhattisgarh",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    organizer: "",
    poster_url: "",
    booking_url: "",
    ticket_price_range: "",
    min_price_inr: "",
    price_source: "",
    source_notes: "",
    verification_status: "pending_verification",
    publication_status: "published",
    is_active: true,
  });

  // State for health & audit logs
  const [healthData, setHealthData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // Admin login form state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSigningIn, setAdminSigningIn] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Initial auth check with session awareness
  const refreshAuth = useCallback(async () => {
    setLoadingAuth(true);
    try {
      const res = await checkStatus();
      setAuthStatus(res);
    } catch {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      setAuthStatus({
        isAdmin: false,
        role: null,
        email: user?.email ?? null,
        userId: user?.id ?? null,
        serviceRoleConfigured: false,
      });
    } finally {
      setLoadingAuth(false);
    }
  }, [checkStatus]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Handle Admin Direct Sign In
  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setAdminAuthError("Please enter both administrator email and password.");
      return;
    }

    setAdminSigningIn(true);
    setAdminAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (error) {
        setAdminAuthError(error.message);
        return;
      }

      toast.success("Authentication successful! Verifying administrator role…");
      const status = await checkStatus();
      setAuthStatus(status);
      if (!status.isAdmin) {
        setAdminAuthError(`Account "${adminEmail.trim()}" is authenticated, but does not have administrator privileges.`);
      }
    } catch (err: any) {
      setAdminAuthError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setAdminSigningIn(false);
    }
  };

  // Handle Admin Sign Out
  const handleAdminSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setAuthStatus({ isAdmin: false, role: null, email: null, userId: null });
      setAdminEmail("");
      setAdminPassword("");
      toast.success("Signed out successfully.");
    } catch (err: any) {
      toast.error(err.message || "Could not sign out.");
    }
  };

  // Handle Password Reset Link
  const handlePasswordReset = async () => {
    if (!adminEmail.trim()) {
      setAdminAuthError("Please enter your admin email above first to receive password recovery.");
      return;
    }
    setAdminSigningIn(true);
    setAdminAuthError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail.trim(), {
        redirectTo: `${window.location.origin}/admin`,
      });
      if (error) {
        setAdminAuthError(error.message);
      } else {
        setResetSent(true);
        toast.success(`Password recovery link sent to ${adminEmail.trim()}!`);
      }
    } catch (err: any) {
      setAdminAuthError(err.message || "Could not send password recovery link.");
    } finally {
      setAdminSigningIn(false);
    }
  };

  // Load Tab Data
  const loadTabData = useCallback(async () => {
    if (!authStatus?.isAdmin) return;

    if (activeTab === "overview") {
      setMetricsLoading(true);
      try {
        const m = await getMetrics();
        setMetrics(m);
        if (m.launch) {
          setLaunchControl({
            discover_enabled: m.launch.discoverEnabled,
            readiness_target: m.launch.readinessTarget,
            city_counts: m.launch.cityCounts,
            night_counts: m.launch.nightCounts,
            last_changed_at: m.launch.lastChangedAt,
            last_changed_by_email: m.launch.lastChangedByEmail,
            total_registered_users: m.totalUsers,
            completed_profiles_count: m.onboardedUsers,
            eligible_users_count: m.discoverableUsers,
          });
          setTargetInput(String(m.launch.readinessTarget ?? 50));
        }
      } catch (err: any) {
        toast.error(err.message || "Could not load metrics");
      } finally {
        setMetricsLoading(false);
      }
    } else if (activeTab === "launch") {
      setLaunchLoading(true);
      try {
        const lc = await getLaunchCtrl();
        setLaunchControl(lc);
        setTargetInput(String(lc.readiness_target ?? 50));
      } catch (err: any) {
        toast.error(err.message || "Could not load launch control");
      } finally {
        setLaunchLoading(false);
      }
    } else if (activeTab === "users") {
      setUsersLoading(true);
      try {
        const u = await listUsers({ data: { search: userSearch, status: userFilter } });
        setUserList(u);
      } catch (err: any) {
        toast.error(err.message || "Could not load users");
      } finally {
        setUsersLoading(false);
      }
    } else if (activeTab === "moderation") {
      setReportsLoading(true);
      try {
        const r = await getReports();
        setReports(r);
      } catch (err: any) {
        toast.error(err.message || "Could not load reports");
      } finally {
        setReportsLoading(false);
      }
    } else if (activeTab === "invites") {
      setInvitesLoading(true);
      try {
        const inv = await getInvites();
        setInvites(inv);
      } catch (err: any) {
        toast.error(err.message || "Could not load invites");
      } finally {
        setInvitesLoading(false);
      }
    } else if (activeTab === "events") {
      setEventsLoading(true);
      try {
        const [ev, suggs] = await Promise.all([
          getEvents(),
          getEventSuggestions().catch(() => []),
        ]);
        setEvents(ev);
        setEventSuggestions(suggs);
      } catch (err: any) {
        toast.error(err.message || "Could not load events");
      } finally {
        setEventsLoading(false);
      }
    } else if (activeTab === "health") {
      setHealthLoading(true);
      try {
        const [h, a] = await Promise.all([getHealth(), getAuditLogs()]);
        setHealthData(h);
        setAuditLogs(a);
      } catch (err: any) {
        toast.error(err.message || "Could not load health diagnostics");
      } finally {
        setHealthLoading(false);
      }
    } else if (activeTab === "security") {
      setSecurityLoading(true);
      try {
        const sec = await getSecurityOverview();
        setSecurityData(sec);
      } catch (err: any) {
        toast.error(err.message || "Could not load security overview");
      } finally {
        setSecurityLoading(false);
      }
    }
  }, [
    authStatus?.isAdmin,
    activeTab,
    userSearch,
    userFilter,
    getMetrics,
    getLaunchCtrl,
    listUsers,
    getReports,
    getInvites,
    getEvents,
    getHealth,
    getAuditLogs,
  ]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Handle Launch Control Toggle
  const handleToggleLaunch = async (enable: boolean) => {
    setLaunchLoading(true);
    try {
      const target = parseInt(targetInput, 10) || 50;
      const updated = await toggleLaunch({
        data: {
          enabled: enable,
          target,
        },
      });
      setLaunchControl(updated);
      setLaunchModalOpen(false);
      toast.success(enable ? "Discover launched globally! Feeds are live." : "Discover paused — waiting room active.");
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update launch status");
    } finally {
      setLaunchLoading(false);
    }
  };

  // Handle Save Readiness Target
  const handleSaveTarget = async () => {
    setLaunchLoading(true);
    try {
      const target = parseInt(targetInput, 10) || 50;
      const updated = await toggleLaunch({
        data: {
          enabled: launchControl?.discover_enabled ?? false,
          target,
        },
      });
      setLaunchControl(updated);
      toast.success(`Readiness target updated to ${target}`);
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update target");
    } finally {
      setLaunchLoading(false);
    }
  };

  // Auth loading state
  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-action" />
          <p className="text-sm font-semibold text-muted-foreground">Verifying admin authorization…</p>
        </div>
      </div>
    );
  }

  // Not authorized / Not logged in state
  if (!authStatus?.isAdmin) {
    // Case 1: User is already logged into an account that lacks admin rights
    if (authStatus?.userId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-primary">Admin Access Restricted</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                This area is restricted to authorized After9 administrators. Privileges are strictly enforced server-side.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
              Signed in as <b className="text-foreground">{authStatus.email || "Unknown account"}</b>
              <p className="text-[11px] text-destructive mt-1 font-medium">This account does not have administrator privileges.</p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleAdminSignOut}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted shadow-xs transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out & Switch Account
              </button>
              <Link
                to="/discover"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to After9
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Case 2: User is unauthenticated — Render the Dedicated Admin Sign In Form
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-action/15 text-action">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-black text-primary">After9 Control Center</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sign in with your authorized administrator account to manage After9 operations, moderation and discovery.
            </p>
          </div>

          {adminAuthError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{adminAuthError}</span>
              </div>
            </div>
          )}

          {resetSent && (
            <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-xs text-teal-800 dark:text-teal-300 font-medium">
              ✓ Password recovery instructions have been dispatched to your email. Check your inbox to reset your password.
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                Admin Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-action focus:ring-1 focus:ring-action"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={adminSigningIn}
                  className="text-[11px] font-semibold text-action hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-action focus:ring-1 focus:ring-action"
              />
            </div>

            <button
              type="submit"
              disabled={adminSigningIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-3 text-xs font-black uppercase tracking-wider text-action-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
            >
              {adminSigningIn ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Verifying Credentials…
                </>
              ) : (
                "Sign In to Control Center"
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-border/60 text-center">
            <Link
              to="/discover"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Public App
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handle User Moderation Action
  const handleUserAction = async () => {
    if (!confirmModal) return;
    try {
      await updateModeration({
        data: {
          userId: confirmModal.user.id,
          action: confirmModal.action,
          reason: actionReason || undefined,
        },
      });
      toast.success(`User successfully updated: ${confirmModal.action}`);
      setConfirmModal(null);
      setActionReason("");
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    }
  };

  // Handle Report Resolution
  const handleResolveReport = async (status: "resolved" | "dismissed") => {
    if (!selectedReport) return;
    try {
      await resolveReport({
        data: {
          blockerId: selectedReport.blocker_id,
          blockedId: selectedReport.blocked_id,
          status,
          notes: modNote || undefined,
        },
      });
      toast.success(`Report marked as ${status}`);
      setSelectedReport(null);
      setModNote("");
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve report");
    }
  };

  // Handle Invite Revocation
  const handleRevokeInvite = async (code: string) => {
    if (!confirm(`Revoke invitation code ${code}? This cannot be undone.`)) return;
    try {
      await revokeInvite({ data: { code, reason: "Revoked by administrator" } });
      toast.success(`Invite code ${code} revoked`);
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke invite");
    }
  };

  // Handle Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveEvent({ data: editingEvent });
      toast.success("Event listing saved");
      setEventModalOpen(false);
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save event");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/discover" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>App</span>
            </Link>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-action/20 px-2 py-0.5 text-xs font-black tracking-wider text-action uppercase">
                ADMIN
              </span>
              <h1 className="font-display text-lg font-extrabold text-primary">After9 Control Center</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {authStatus.serviceRoleConfigured === false && (
              <span
                className="hidden lg:inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                title="Service role key not configured in .env. Admin operations are enforced via verified PostgreSQL RLS policies."
              >
                Direct RLS Mode
              </span>
            )}
            <span className="hidden sm:inline-flex rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground font-mono">
              {authStatus.role} · {authStatus.email}
            </span>
            <button
              onClick={loadTabData}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground transition"
              title="Refresh data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleAdminSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition"
              title="Sign Out of Admin"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto max-w-7xl mt-3 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "launch", label: "Launch Control", icon: Sparkles },
            { id: "users", label: "Users", icon: Users },
            { id: "moderation", label: "Moderation & Safety", icon: ShieldAlert },
            { id: "invites", label: "Referrals & Invites", icon: Ticket },
            { id: "events", label: "Events & Plans", icon: Calendar },
            { id: "health", label: "System Health & Audit", icon: ShieldCheck },
            { id: "security", label: "Security & Threat Defense", icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-7xl">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Platform Overview</h2>
                  <p className="text-xs text-muted-foreground">Real-time aggregate data across users, matching and safety.</p>
                </div>
                {metricsLoading && <RefreshCw className="h-4 w-4 animate-spin text-action" />}
              </div>

              {/* Discover Launch Status Banner */}
              {launchControl && (
                <div
                  className={`rounded-2xl border p-4.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                    launchControl.discover_enabled
                      ? "border-teal-500/40 bg-teal-500/10 text-teal-950 dark:text-teal-100"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        launchControl.discover_enabled ? "bg-teal-500 text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {launchControl.discover_enabled ? <Rocket className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            launchControl.discover_enabled
                              ? "bg-teal-500/20 text-teal-700 dark:text-teal-300"
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {launchControl.discover_enabled ? "Discover is Live" : "Discover is Paused (Waiting Room Active)"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Target: {launchControl.completed_profiles_count ?? metrics?.onboardedUsers ?? 0} /{" "}
                          {launchControl.readiness_target} profiles completed
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {launchControl.discover_enabled
                          ? "All eligible profiles are actively visible and matchable in the Dandiya deck."
                          : "Ordinary users see the early-community waiting room with Garba crew invite tools."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <button
                      onClick={() => setActiveTab("launch")}
                      className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted shadow-xs transition"
                    >
                      Manage Launch →
                    </button>
                    <button
                      onClick={() => setLaunchModalOpen(true)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition ${
                        launchControl.discover_enabled ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"
                      }`}
                    >
                      {launchControl.discover_enabled ? "Pause Discover" : "Launch Discover"}
                    </button>
                  </div>
                </div>
              )}

              {/* Time Window Selector for Registration Growth */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Registration Growth Window:</span>
                </div>
                <div className="flex items-center rounded-xl border border-border bg-card p-0.5">
                  {(["24h", "7d", "30d", "all"] as const).map((win) => (
                    <button
                      key={win}
                      onClick={() => setGrowthWindow(win)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition ${
                        growthWindow === win
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {win === "all" ? "All Time" : win}
                    </button>
                  ))}
                </div>
              </div>

              {metrics && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    <MetricCard title="Total Registered" value={metrics.totalUsers} subtitle="All created accounts" />
                    <MetricCard
                      title={`New Users (${growthWindow.toUpperCase()})`}
                      value={
                        growthWindow === "24h"
                          ? metrics.newUsers24h
                          : growthWindow === "7d"
                          ? metrics.newUsers7d
                          : growthWindow === "30d"
                          ? (metrics.newUsers30d ?? metrics.newUsers7d)
                          : metrics.totalUsers
                      }
                      subtitle={`Registrations in past ${growthWindow}`}
                      highlight={true}
                    />
                    <MetricCard
                      title="Profile Completed"
                      value={metrics.onboardedUsers}
                      subtitle={`${
                        metrics.totalUsers ? Math.round((metrics.onboardedUsers / metrics.totalUsers) * 100) : 0
                      }% completion rate`}
                    />
                    <MetricCard
                      title="Live Discover Inventory"
                      value={metrics.discoverableUsers}
                      subtitle="Eligible & discoverable now"
                    />
                    <MetricCard title="Mutual Matches" value={metrics.mutualMatches} subtitle="Two-way Dandiya clashes" />
                    <MetricCard title="Total Swipes" value={metrics.totalSwipes} subtitle="Send & pass reactions" />
                    <MetricCard title="Messages Exchanged" value={metrics.totalMessages} subtitle="Across matched chats" />
                    <MetricCard
                      title="Pending Reports"
                      value={metrics.openReports}
                      subtitle="Requires moderator review"
                      highlight={metrics.openReports > 0}
                    />
                    <MetricCard title="Active Users (24h)" value={metrics.activeUsers24h} subtitle="Updated profile past 24h" />
                    <MetricCard title="Active Users (7d)" value={metrics.activeUsers7d} subtitle="Updated profile past 7d" />
                    <MetricCard
                      title="Referral Tokens"
                      value={metrics.totalInvites}
                      subtitle={`${metrics.conversionRate}% claimed rate`}
                    />
                    <MetricCard
                      title="Referred Users"
                      value={metrics.referredUsersTotal ?? metrics.claimedInvites}
                      subtitle={`${metrics.referredOnboardedRate ?? 100}% finished onboarding`}
                    />
                  </div>

                  {/* Referral Funnel & Event Summary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Referral Performance Funnel */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-action" />
                          <h3 className="font-display text-sm font-extrabold text-primary">Referral Funnel Conversion</h3>
                        </div>
                        <span className="text-xs font-bold text-action font-mono">{metrics.conversionRate}% claimed</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Tokens Created</p>
                          <p className="text-lg font-black text-primary font-display mt-0.5">{metrics.totalInvites}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Referred Users</p>
                          <p className="text-lg font-black text-primary font-display mt-0.5">
                            {metrics.referredUsersTotal ?? metrics.claimedInvites}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-teal-500/10 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400">Onboarded</p>
                          <p className="text-lg font-black text-teal-600 dark:text-teal-400 font-display mt-0.5">
                            {metrics.referredUsersOnboarded ?? metrics.claimedInvites}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {metrics.referredOnboardedRate ?? 100}% of referred accounts successfully completed onboarding and joined the community.
                      </p>
                    </div>

                    {/* Events & Garba Venues Summary */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <h3 className="font-display text-sm font-extrabold text-primary">Garba Event Listings</h3>
                        </div>
                        <button onClick={() => setActiveTab("events")} className="text-xs font-bold text-primary hover:underline">
                          View all →
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400">Verified</p>
                          <p className="text-lg font-black text-teal-600 font-display mt-0.5">{metrics.events?.verified ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Unverified</p>
                          <p className="text-lg font-black text-amber-600 font-display mt-0.5">{metrics.events?.unverified ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Expired</p>
                          <p className="text-lg font-black text-muted-foreground font-display mt-0.5">{metrics.events?.expired ?? 0}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Total {metrics.events?.total ?? 0} venue listings curated for Garba nights in Raipur and central hubs.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: LAUNCH CONTROL */}
          {activeTab === "launch" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Discover Launch Control</h2>
                  <p className="text-xs text-muted-foreground">
                    Persistent database-level feature flag. Disabling routes users to the early-community waiting room.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {launchLoading && <RefreshCw className="h-4 w-4 animate-spin text-action" />}
                  <button
                    onClick={() => setLaunchModalOpen(true)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition flex items-center gap-2 ${
                      launchControl?.discover_enabled ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"
                    }`}
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    <span>{launchControl?.discover_enabled ? "Pause Discover" : "Launch Discover Globally"}</span>
                  </button>
                </div>
              </div>

              {launchControl && (
                <>
                  {/* Status Banner */}
                  <div
                    className={`rounded-2xl border p-5 shadow-xs transition ${
                      launchControl.discover_enabled
                        ? "border-teal-500/40 bg-teal-500/10 text-teal-950 dark:text-teal-100"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            launchControl.discover_enabled ? "bg-teal-500 text-white" : "bg-amber-500 text-white"
                          }`}
                        >
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                                launchControl.discover_enabled
                                  ? "bg-teal-500/20 text-teal-800 dark:text-teal-300"
                                  : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                              }`}
                            >
                              {launchControl.discover_enabled ? "DISCOVER IS CURRENTLY LIVE" : "PRE-LAUNCH WAITING ROOM ACTIVE"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                            {launchControl.discover_enabled
                              ? "The discovery deck is open for all eligible, verified users. Profile feeds, swipe interactions, and Dandiya clash matches are fully functioning in real-time."
                              : "All non-admin users visiting /discover see the early-community waiting room with the 'Your Garba crew starts here' experience, invite tools, and night selectors. Backend database function discover_feed() returns 0 rows."}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleLaunch(!launchControl.discover_enabled)}
                        disabled={launchLoading}
                        className={`rounded-xl px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition shrink-0 ${
                          launchControl.discover_enabled ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"
                        }`}
                      >
                        {launchControl.discover_enabled ? "Switch to Pre-Launch" : "Switch to Live Discover"}
                      </button>
                    </div>
                  </div>

                  {/* Readiness Target & Progress */}
                  <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-extrabold text-primary">Launch Readiness Target</h3>
                        <p className="text-xs text-muted-foreground">
                          Target number of completed, verified profiles before recommending public launch.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          className="w-24 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-action"
                        />
                        <button
                          onClick={handleSaveTarget}
                          disabled={launchLoading}
                          className="rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition"
                        >
                          Save Target
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">
                          {launchControl.completed_profiles_count ?? 0} of {launchControl.readiness_target ?? 50} Profiles Completed
                        </span>
                        <span className="font-mono font-bold text-action">
                          {Math.min(
                            100,
                            Math.round(
                              ((launchControl.completed_profiles_count ?? 0) /
                                (launchControl.readiness_target || 50)) *
                                100
                            )
                          )}
                          % Ready
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-gradient-to-r from-action to-primary transition-all duration-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((launchControl.completed_profiles_count ?? 0) /
                                  (launchControl.readiness_target || 50)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground italic">
                        * Note: Reaching 100% does NOT automatically enable Discover. The administrator retains final human authority to flip the switch.
                      </p>
                    </div>
                  </div>

                  {/* Inventory & Breakdown Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* City Breakdown */}
                    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <h3 className="font-display text-sm font-extrabold text-primary">Eligible Profiles by City</h3>
                      </div>
                      <div className="divide-y divide-border/60">
                        {launchControl.city_counts && Object.keys(launchControl.city_counts).length > 0 ? (
                          Object.entries(launchControl.city_counts).map(([city, count]: [string, any]) => (
                            <div key={city} className="flex items-center justify-between py-2 text-xs">
                              <span className="font-semibold text-foreground">📍 {city}</span>
                              <span className="font-mono font-bold rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                {count} {count === 1 ? "user" : "users"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground py-2 italic">No city location data recorded yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Garba Nights Breakdown */}
                    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-action" />
                        <h3 className="font-display text-sm font-extrabold text-primary">Attendance Interest by Garba Night</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 9 }, (_, i) => i + 1).map((night) => {
                          const count = launchControl.night_counts?.[`night_${night}`] ?? 0;
                          return (
                            <div
                              key={night}
                              className={`rounded-xl border p-2.5 text-center transition ${
                                count > 0 ? "border-action/40 bg-action/10" : "border-border/60 bg-muted/20"
                              }`}
                            >
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Night {night}</p>
                              <p className="text-base font-black text-primary font-display mt-0.5">{count}</p>
                              <p className="text-[9px] text-muted-foreground">interested</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Audit Metadata Footer */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span>Last configuration change: </span>
                      <b className="text-foreground">
                        {launchControl.last_changed_at
                          ? new Date(launchControl.last_changed_at).toLocaleString()
                          : "Initial setup"}
                      </b>
                      {launchControl.last_changed_by_email && (
                        <span>
                          {" "}
                          by <b className="text-primary">{launchControl.last_changed_by_email}</b>
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">Key: launch_control.global</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">User Management</h2>
                  <p className="text-xs text-muted-foreground">Search, inspect account status, and manage profile moderation.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search name, college…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="rounded-xl border border-border bg-card pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-action"
                    />
                  </div>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-action"
                  >
                    <option value="all">All statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* User table / cards */}
              <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">College & Branch</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Onboarded</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {userList.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-muted overflow-hidden shrink-0">
                              {u.photo_path ? (
                                <img
                                  src={`https://vjsqakziqyesruxggaik.supabase.co/storage/v1/object/public/photos/${u.photo_path}`}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center font-bold text-muted-foreground">
                                  {u.first_name?.[0] || "?"}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{u.first_name || "Unnamed User"}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{u.college || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{u.branch || ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_suspended ? (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              Suspended
                            </span>
                          ) : u.verification_status === "approved" ? (
                            <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                              Verified
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.onboarded ? (
                            <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.is_suspended ? (
                              <button
                                onClick={() => setConfirmModal({ action: "reactivate", user: u })}
                                className="rounded-lg border border-teal-500/40 bg-teal-500/10 px-2.5 py-1 text-[11px] font-bold text-teal-600 hover:bg-teal-500/20"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmModal({ action: "suspend", user: u })}
                                className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/20"
                              >
                                Suspend
                              </button>
                            )}
                            {u.verification_status !== "approved" && (
                              <button
                                onClick={() => setConfirmModal({ action: "approve", user: u })}
                                className="rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {userList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No users found matching query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MODERATION & SAFETY */}
          {activeTab === "moderation" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Moderation & User Reports</h2>
                  <p className="text-xs text-muted-foreground">Investigate reported accounts, evidence, and safety resolutions.</p>
                </div>
                {reportsLoading && <RefreshCw className="h-4 w-4 animate-spin text-action" />}
              </div>

              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={`${rep.blocker_id}-${rep.blocked_id}`}
                    className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              rep.status === "pending"
                                ? "bg-amber-500/15 text-amber-600"
                                : rep.status === "resolved"
                                ? "bg-teal-500/15 text-teal-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {rep.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Reported on {new Date(rep.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          Reporter: <b className="text-primary">{rep.blocker?.first_name || "Anonymous"}</b> · Target:{" "}
                          <b className="text-destructive">{rep.blocked?.first_name || "Unknown"}</b>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {rep.status === "pending" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedReport(rep);
                                handleResolveReport("resolved");
                              }}
                              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 transition"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedReport(rep);
                                handleResolveReport("dismissed");
                              }}
                              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted transition"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Submitted Reason</p>
                      <p className="text-xs text-foreground italic">
                        "{rep.reason || "No explicit reason submitted (User blocked & reported)"}"
                      </p>
                    </div>

                    {rep.moderator_notes && (
                      <p className="text-xs text-muted-foreground">
                        <b>Moderator note:</b> {rep.moderator_notes}
                      </p>
                    )}
                  </div>
                ))}

                {reports.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600 mb-2 opacity-80" />
                    <p className="text-sm font-semibold">Zero open reports</p>
                    <p className="text-xs">No pending moderation or safety complaints.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: INVITES & REFERRALS */}
          {activeTab === "invites" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Invitations & Referral Attribution</h2>
                  <p className="text-xs text-muted-foreground">
                    Four-stage tracking: link creation → registration attribution → onboarding completion → live on Discover.
                  </p>
                </div>
                {invitesLoading && <RefreshCw className="h-4 w-4 animate-spin text-action" />}
              </div>

              {/* Referral Funnel Aggregate Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">1. Tokens Created</p>
                  <p className="text-xl font-black text-primary font-display">{invites.length}</p>
                  <p className="text-[10px] text-muted-foreground">Unique invite tokens</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">2. Attributed Registrations</p>
                  <p className="text-xl font-black text-primary font-display">
                    {invites.filter((i) => i.claimed_at).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {invites.length ? Math.round((invites.filter((i) => i.claimed_at).length / invites.length) * 100) : 0}% claim rate
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">3. Onboarded Members</p>
                  <p className="text-xl font-black text-teal-600 font-display">
                    {invites.filter((i) => i.claimed_by_user?.onboarded).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Completed profile & photos</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">4. Live on Discover</p>
                  <p className="text-xl font-black text-teal-600 font-display">
                    {invites.filter((i) => i.claimed_by_user?.discoverable).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Active in match inventory</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Referral Token</th>
                      <th className="px-4 py-3">Inviter</th>
                      <th className="px-4 py-3">Attributed User</th>
                      <th className="px-4 py-3">Funnel Stage</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {invites.map((inv) => (
                      <tr key={inv.code} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-primary">{inv.code}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{inv.creator?.first_name || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">{inv.creator?.college || ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          {inv.claimed_by_user ? (
                            <div>
                              <p className="font-semibold text-foreground">{inv.claimed_by_user.first_name}</p>
                              <p className="text-[10px] text-muted-foreground">{inv.claimed_by_user.college || "No college"}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Unclaimed (Available)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {inv.revoked ? (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              Revoked
                            </span>
                          ) : inv.claimed_by_user?.discoverable ? (
                            <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                              Stage 4: Live on Discover
                            </span>
                          ) : inv.claimed_by_user?.onboarded ? (
                            <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                              Stage 3: Onboarded
                            </span>
                          ) : inv.claimed_at ? (
                            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                              Stage 2: Registered
                            </span>
                          ) : (
                            <span className="rounded-full bg-action/15 px-2 py-0.5 text-[10px] font-bold text-action">
                              Stage 1: Link Created
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!inv.revoked && (
                            <button
                              onClick={() => handleRevokeInvite(inv.code)}
                              className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/20"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {invites.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No referral tokens found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: EVENTS & PLANS */}
          {activeTab === "events" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Garba Events & Venues</h2>
                  <p className="text-xs text-muted-foreground">Manage official venue listings, review poster records, and verify community submissions.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setEventSubTab("listings")}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        eventSubTab === "listings" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Curated Listings ({events.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventSubTab("suggestions")}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        eventSubTab === "suggestions" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      User Suggestions ({eventSuggestions.length})
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setEditingEvent({
                        title: "",
                        slug: "",
                        venue: "",
                        area: "",
                        address: "",
                        city: "Raipur",
                        state: "Chhattisgarh",
                        start_date: "",
                        end_date: "",
                        start_time: "",
                        end_time: "",
                        organizer: "",
                        poster_url: "",
                        booking_url: "",
                        ticket_price_range: "",
                        min_price_inr: "",
                        price_source: "",
                        source_notes: "",
                        verification_status: "pending_verification",
                        publication_status: "published",
                        is_active: true,
                      });
                      setEventModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Event
                  </button>
                </div>
              </div>

              {eventSubTab === "listings" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((ev) => {
                    const isVerified = ev.verification_status === "verified";
                    const isPending = ev.verification_status === "pending_verification";

                    return (
                      <div key={ev.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isVerified
                                ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30"
                                : isPending
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {isVerified ? "✓ Verified" : isPending ? "⏳ Pending Review" : ev.verification_status}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              {ev.publication_status}
                            </span>
                          </div>

                          <h3 className="font-display text-base font-extrabold text-primary leading-snug">{ev.title}</h3>
                          <p className="text-xs text-muted-foreground">📍 {ev.venue}{ev.area ? ` · ${ev.area}` : ""}, {ev.city}</p>

                          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1">
                            {ev.start_date && (
                              <p>📅 {ev.start_date} {ev.end_date && ev.end_date !== ev.start_date ? `to ${ev.end_date}` : ""}</p>
                            )}
                            {ev.organizer && <p>👤 {ev.organizer}</p>}
                            {ev.ticket_price_range && <p>🎟 {ev.ticket_price_range}</p>}
                            {ev.source_notes && (
                              <p className="text-[10px] italic line-clamp-2 mt-1 text-muted-foreground/80 bg-muted/40 p-1.5 rounded-lg">
                                📝 {ev.source_notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={async () => {
                                const newVerdict = !isVerified;
                                await verifyEvent({ data: { eventId: ev.id, verified: newVerdict } });
                                toast.success(newVerdict ? "Event marked verified!" : "Event marked unverified.");
                                loadTabData();
                              }}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                isVerified
                                  ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
                                  : "bg-teal-500/15 text-teal-700 hover:bg-teal-500/25"
                              }`}
                            >
                              {isVerified ? "Unverify" : "Verify ✓"}
                            </button>
                            <Link
                              to="/plan/$id"
                              params={{ id: ev.slug || ev.id }}
                              className="text-[11px] font-semibold text-action hover:underline"
                            >
                              Preview ↗
                            </Link>
                          </div>

                          <button
                            onClick={() => {
                              setEditingEvent({
                                id: ev.id,
                                title: ev.title,
                                slug: ev.slug || "",
                                venue: ev.venue,
                                area: ev.area || "",
                                address: ev.address || "",
                                city: ev.city || "Raipur",
                                state: ev.state || "Chhattisgarh",
                                start_date: ev.start_date || "",
                                end_date: ev.end_date || "",
                                start_time: ev.start_time || "",
                                end_time: ev.end_time || "",
                                organizer: ev.organizer || "",
                                poster_url: ev.poster_url || "",
                                booking_url: ev.booking_url || "",
                                ticket_price_range: ev.ticket_price_range || "",
                                min_price_inr: ev.min_price_inr || "",
                                price_source: ev.price_source || "",
                                source_notes: ev.source_notes || "",
                                verification_status: ev.verification_status || "pending_verification",
                                publication_status: ev.publication_status || "published",
                                is_active: ev.is_active ?? true,
                              });
                              setEventModalOpen(true);
                            }}
                            className="rounded-lg border border-border/80 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Community Suggestions Sub-tab */
                <div className="space-y-3">
                  {eventSuggestions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                      No community event suggestions pending review.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {eventSuggestions.map((sug) => (
                        <div key={sug.id} className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                sug.status === "approved"
                                  ? "bg-teal-500/15 text-teal-600"
                                  : sug.status === "rejected"
                                  ? "bg-red-500/15 text-red-600"
                                  : "bg-amber-500/15 text-amber-600"
                              }`}>
                                {sug.status}
                              </span>
                              <h4 className="font-display text-base font-bold text-primary mt-1">{sug.name}</h4>
                              <p className="text-xs text-muted-foreground">📍 {sug.venue}, {sug.city}</p>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">{sug.dates}</span>
                          </div>

                          {sug.organizer && <p className="text-xs text-muted-foreground">Organizer: {sug.organizer}</p>}
                          {sug.source_link && (
                            <a href={sug.source_link} target="_blank" rel="noopener noreferrer" className="text-xs text-action hover:underline block truncate">
                              Link: {sug.source_link} ↗
                            </a>
                          )}
                          {sug.notes && <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-xl">{sug.notes}</p>}

                          {sug.status === "pending" && (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                              <button
                                onClick={async () => {
                                  await resolveSuggestion({ data: { suggestionId: sug.id, action: "rejected" } });
                                  toast.success("Suggestion rejected.");
                                  loadTabData();
                                }}
                                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                              >
                                Reject
                              </button>
                              <button
                                onClick={async () => {
                                  await resolveSuggestion({ data: { suggestionId: sug.id, action: "approved" } });
                                  // Pre-fill event modal from suggestion
                                  setEditingEvent({
                                    title: sug.name,
                                    venue: sug.venue,
                                    city: sug.city || "Raipur",
                                    organizer: sug.organizer || "",
                                    booking_url: sug.source_link || "",
                                    source_notes: `From community suggestion: ${sug.notes || ""}`,
                                    verification_status: "verified",
                                    publication_status: "published",
                                    is_active: true,
                                  });
                                  setEventModalOpen(true);
                                  toast.success("Suggestion approved! Complete event details.");
                                  loadTabData();
                                }}
                                className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-teal-700"
                              >
                                Approve & Add Listing
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SYSTEM HEALTH & AUDIT */}
          {activeTab === "health" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-primary">Technical System Health</h2>
                <p className="text-xs text-muted-foreground">Live infrastructure diagnostics and audit trail.</p>
              </div>

              {healthData && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>PostgreSQL Database</span>
                      <span className="text-teal-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                      </span>
                    </div>
                    <p className="text-2xl font-black text-primary font-mono">{healthData.database.latencyMs} ms</p>
                    <p className="text-[11px] text-muted-foreground">Query round-trip latency to Supabase</p>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Web Push Subscriptions</span>
                      <span className="text-action font-mono">{healthData.notifications.pushSubscriptions}</span>
                    </div>
                    <p className="text-2xl font-black text-primary">{healthData.notifications.pushOptedInUsers}</p>
                    <p className="text-[11px] text-muted-foreground">Users with push notifications enabled</p>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Security Audit Log</span>
                      <span className="text-teal-600">Active</span>
                    </div>
                    <p className="text-2xl font-black text-primary font-mono">{healthData.audit.totalLoggedEvents}</p>
                    <p className="text-[11px] text-muted-foreground">Privileged actions recorded</p>
                  </div>
                </div>
              )}

              {/* Audit Log Table */}
              <div className="space-y-3">
                <h3 className="font-display text-lg font-bold text-primary">Recent Audit Trail</h3>
                <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Actor</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Target</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition">
                          <td className="px-4 py-3 text-muted-foreground font-mono">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{log.actor_email}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{log.target_id || "—"}</td>
                          <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary flex items-center gap-2">
                    <Lock className="h-6 w-6 text-action" /> Defensive Security & Threat Monitoring
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Active defenses against account takeover, unauthorized access, bot abuse, and credential stuffing.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setSecurityLoading(true);
                    try {
                      const sec = await getSecurityOverview();
                      setSecurityData(sec);
                      toast.success("Security metrics refreshed");
                    } catch (e: any) {
                      toast.error(e.message || "Refresh failed");
                    } finally {
                      setSecurityLoading(false);
                    }
                  }}
                  disabled={securityLoading}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/60 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${securityLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>

              {securityData && (
                <>
                  {/* Threat Posture Status Banner */}
                  <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    securityData.metrics.threatLevel === "ELEVATED"
                      ? "border-destructive/60 bg-destructive/10 text-destructive"
                      : securityData.metrics.threatLevel === "GUARDED"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-xs">
                        {securityData.metrics.threatLevel === "ELEVATED" ? (
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        ) : securityData.metrics.threatLevel === "GUARDED" ? (
                          <ShieldAlert className="h-5 w-5 text-amber-500" />
                        ) : (
                          <ShieldCheck className="h-5 w-5 text-teal-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold">Threat Level: {securityData.metrics.threatLevel}</p>
                        <p className="text-xs opacity-90">
                          {securityData.metrics.threatLevel === "NOMINAL"
                            ? "All defensive security controls operational. No critical abuse patterns detected."
                            : securityData.metrics.threatLevel === "GUARDED"
                            ? "Elevated automated probe or rate limit triggers observed. Defenses active."
                            : "Multiple severe security incidents or bot attacks intercepted. Review event logs below."}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-black uppercase font-mono shadow-xs">
                      {securityData.metrics.totalSecurityEvents} Events Tracked
                    </span>
                  </div>

                  {/* 4 Metric Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rate Limits Tripped (24h)</p>
                      <p className="text-3xl font-black text-primary font-mono">{securityData.metrics.rateLimits24h}</p>
                      <p className="text-[11px] text-muted-foreground">Server & DB sliding window throttles</p>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bot Decoy Traps (24h)</p>
                      <p className="text-3xl font-black text-primary font-mono">{securityData.metrics.botTraps24h}</p>
                      <p className="text-[11px] text-muted-foreground">Automated honeypot triggers blocked</p>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Auth Denials (24h)</p>
                      <p className="text-3xl font-black text-primary font-mono">{securityData.metrics.authFailures24h}</p>
                      <p className="text-[11px] text-muted-foreground">Unauthorized privileged attempts</p>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Suspended Accounts</p>
                      <p className="text-3xl font-black text-primary font-mono">{securityData.metrics.suspendedUsersCount}</p>
                      <p className="text-[11px] text-muted-foreground">Enforced via DB RLS & triggers</p>
                    </div>
                  </div>

                  {/* Defensive Layers Checklist */}
                  <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3">
                    <h3 className="font-display text-base font-bold text-primary">Hardened Defensive Architecture</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">RLS Owner Isolation</p>
                          <p className="text-muted-foreground text-[11px]">Profiles, contacts, and cards protected against cross-user access.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">Suspension Lockouts</p>
                          <p className="text-muted-foreground text-[11px]">Suspended accounts blocked by DB triggers from chats, swipes, and feed.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">Distributed Rate Limiter</p>
                          <p className="text-muted-foreground text-[11px]">Sliding-window rate limits on AI verify, invites, and admin mutations.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">Storage Access Control</p>
                          <p className="text-muted-foreground text-[11px]">Storage photo reads strictly restricted; blocked/private users protected.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">Controlled Decoy Traps</p>
                          <p className="text-muted-foreground text-[11px]">Hidden honeypots in auth forms intercept scrapers and automated bots.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">Production Network Headers</p>
                          <p className="text-muted-foreground text-[11px]">Strict CSP, HSTS, frame-ancestors, and X-Content-Type-Options active.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Events Stream */}
                  <div className="space-y-3">
                    <h3 className="font-display text-lg font-bold text-primary">Live Security & Threat Events Log</h3>
                    <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Timestamp</th>
                            <th className="px-4 py-3">Severity</th>
                            <th className="px-4 py-3">Event Type</th>
                            <th className="px-4 py-3">Actor / IP Hash</th>
                            <th className="px-4 py-3">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {securityData.events.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                                No security incidents or anomalies recorded. All systems normal.
                              </td>
                            </tr>
                          ) : (
                            securityData.events.map((ev: any) => (
                              <tr key={ev.id} className="hover:bg-muted/30 transition">
                                <td className="px-4 py-3 text-muted-foreground font-mono whitespace-nowrap">
                                  {new Date(ev.created_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    ev.severity === "critical"
                                      ? "bg-destructive/15 text-destructive"
                                      : ev.severity === "warn"
                                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                      : "bg-teal-500/15 text-teal-600 dark:text-teal-400"
                                  }`}>
                                    {ev.severity}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-foreground font-mono text-[11px]">
                                  {ev.event_type}
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                                  {ev.ip_hash || (ev.actor_id ? `uid:${ev.actor_id.slice(0, 8)}` : "—")}
                                </td>
                                <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-xs truncate font-mono">
                                  {JSON.stringify(ev.metadata)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal for User Moderation */}
      {confirmModal && (
        <Dialog open={true} onOpenChange={() => setConfirmModal(null)}>
          <DialogContent className="max-w-md border-border/80 bg-background/98 p-6 shadow-2xl rounded-2xl">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-display text-lg font-extrabold text-primary capitalize">
                Confirm {confirmModal.action}: {confirmModal.user.first_name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                This action will be permanently recorded in the security audit log.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Action Reason (Required for audit)</label>
                <input
                  type="text"
                  placeholder="e.g. Inappropriate profile photo, community guidelines violation…"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-action"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUserAction}
                  className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  Confirm {confirmModal.action}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit Event Modal */}
      {eventModalOpen && (
        <Dialog open={true} onOpenChange={() => setEventModalOpen(false)}>
          <DialogContent className="max-w-lg border-border/80 bg-background/98 p-6 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="font-display text-lg font-extrabold text-primary">
                {editingEvent.id ? "Edit Event Listing" : "Add Event Listing"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Verified Garba and festival listings shown in After9 Plan.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEvent} className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">Event Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VIP Raas Garba 2026"
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Slug (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. vip-raas-garba-2026"
                    value={editingEvent.slug || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, slug: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">Venue *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shriram Ground"
                    value={editingEvent.venue}
                    onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Area / Locality</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Road"
                    value={editingEvent.area || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, area: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">City</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.city || "Raipur"}
                    onChange={(e) => setEditingEvent({ ...editingEvent, city: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Organizer</label>
                  <input
                    type="text"
                    placeholder="e.g. Sadhna Media"
                    value={editingEvent.organizer || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, organizer: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">Start Date</label>
                  <input
                    type="date"
                    value={editingEvent.start_date || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, start_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">End Date</label>
                  <input
                    type="date"
                    value={editingEvent.end_date || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, end_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">Ticket Price Range</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹300 - ₹800"
                    value={editingEvent.ticket_price_range || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, ticket_price_range: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Min Price INR</label>
                  <input
                    type="number"
                    placeholder="e.g. 300"
                    value={editingEvent.min_price_inr || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, min_price_inr: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Official Booking URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editingEvent.booking_url || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, booking_url: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Source Notes / Poster Details</label>
                <textarea
                  rows={2}
                  placeholder="Notes from poster, contact numbers, or program details..."
                  value={editingEvent.source_notes || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, source_notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">Verification Status</label>
                  <select
                    value={editingEvent.verification_status || "pending_verification"}
                    onChange={(e) => setEditingEvent({ ...editingEvent, verification_status: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  >
                    <option value="verified">Verified</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="unverified">Unverified</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground">Publication Status</label>
                  <select
                    value={editingEvent.publication_status || "published"}
                    onChange={(e) => setEditingEvent({ ...editingEvent, publication_status: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="rounded-xl border border-border px-3.5 py-2 font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground hover:opacity-90"
                >
                  Save Listing
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Modal for Discover Launch Control */}
      {launchModalOpen && (
        <Dialog open={true} onOpenChange={() => setLaunchModalOpen(false)}>
          <DialogContent className="max-w-md border-border/80 bg-background/98 p-6 shadow-2xl rounded-2xl">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    launchControl?.discover_enabled ? "bg-amber-500/15 text-amber-600" : "bg-teal-500/15 text-teal-600"
                  }`}
                >
                  <Rocket className="h-5 w-5" />
                </div>
                <DialogTitle className="font-display text-lg font-extrabold text-primary">
                  {launchControl?.discover_enabled ? "Pause Discover Deck?" : "Launch Discover Deck Globally?"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                {launchControl?.discover_enabled
                  ? "Pausing Discover routes all ordinary users to the early-community waiting room ('Your Garba crew starts here'). Server-side discover_feed() will immediately return 0 rows to protect user inventory."
                  : "Launching Discover makes all eligible, verified profiles visible and matchable. Users will be able to swipe, send Dandiyas, and match in real-time."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2 my-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current State:</span>
                <span className="font-bold text-foreground">
                  {launchControl?.discover_enabled ? "🟢 Live" : "🟡 Waiting Room"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Action to Execute:</span>
                <span className="font-bold text-primary">
                  {launchControl?.discover_enabled ? "Switch to Pre-Launch" : "Switch to Live"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed Profiles Ready:</span>
                <span className="font-bold text-foreground">
                  {launchControl?.completed_profiles_count ?? 0} / {targetInput} target
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLaunchModalOpen(false)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={launchLoading}
                onClick={() => handleToggleLaunch(!launchControl?.discover_enabled)}
                className={`rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-xs transition ${
                  launchControl?.discover_enabled
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                {launchLoading
                  ? "Updating…"
                  : launchControl?.discover_enabled
                  ? "Yes, Pause Discover"
                  : "Yes, Launch Discover Now"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  highlight = false,
}: {
  title: string;
  value: any;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs space-y-1 transition ${
        highlight
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-border/80 bg-card"
      }`}
    >
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-primary font-display">{value ?? 0}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
