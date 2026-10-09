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
} from "lucide-react";
import {
  checkAdminStatus,
  getAdminOverviewMetrics,
  listAdminUsers,
  updateUserModeration,
  listAdminReports,
  resolveAdminReport,
  listAdminInvites,
  revokeAdminInvite,
  listAdminEvents,
  saveAdminEvent,
  getAdminSystemHealth,
  getAdminAuditLogs,
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

type AdminTab = "overview" | "users" | "moderation" | "invites" | "events" | "health";

function AdminDashboard() {
  const checkStatus = useServerFn(checkAdminStatus);
  const getMetrics = useServerFn(getAdminOverviewMetrics);
  const listUsers = useServerFn(listAdminUsers);
  const updateModeration = useServerFn(updateUserModeration);
  const getReports = useServerFn(listAdminReports);
  const resolveReport = useServerFn(resolveAdminReport);
  const getInvites = useServerFn(listAdminInvites);
  const revokeInvite = useServerFn(revokeAdminInvite);
  const getEvents = useServerFn(listAdminEvents);
  const saveEvent = useServerFn(saveAdminEvent);
  const getHealth = useServerFn(getAdminSystemHealth);
  const getAuditLogs = useServerFn(getAdminAuditLogs);

  const [authStatus, setAuthStatus] = useState<AdminStatusResult | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // State for metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

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
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>({
    title: "",
    venue: "",
    city: "Raipur",
    ticket_price_range: "",
    price_source: "",
    booking_url: "",
    verification_status: "verified",
  });

  // State for health & audit logs
  const [healthData, setHealthData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // Initial auth check
  useEffect(() => {
    checkStatus()
      .then((res) => {
        setAuthStatus(res);
        setLoadingAuth(false);
      })
      .catch(() => {
        setAuthStatus({ isAdmin: false, role: null, email: null, userId: null });
        setLoadingAuth(false);
      });
  }, [checkStatus]);

  // Load Tab Data
  const loadTabData = useCallback(async () => {
    if (!authStatus?.isAdmin) return;

    if (activeTab === "overview") {
      setMetricsLoading(true);
      try {
        const m = await getMetrics();
        setMetrics(m);
      } catch (err: any) {
        toast.error(err.message || "Could not load metrics");
      } finally {
        setMetricsLoading(false);
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
        const ev = await getEvents();
        setEvents(ev);
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
    }
  }, [
    authStatus?.isAdmin,
    activeTab,
    userSearch,
    userFilter,
    getMetrics,
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

  // Not authorized state
  if (!authStatus?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-xl space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-primary">Admin Access Restricted</h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              This interface is restricted to authorized After9 administrators. Privileges are enforced server-side.
            </p>
          </div>
          {authStatus?.email && (
            <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
              Signed in as <b className="text-foreground">{authStatus.email}</b>
            </div>
          )}
          <div className="pt-2">
            <Link
              to="/discover"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to After9
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

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              {authStatus.role} · {authStatus.email}
            </span>
            <button
              onClick={loadTabData}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground transition"
              title="Refresh data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto max-w-7xl mt-3 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "users", label: "Users", icon: Users },
            { id: "moderation", label: "Moderation & Safety", icon: ShieldAlert },
            { id: "invites", label: "Referrals & Invites", icon: Ticket },
            { id: "events", label: "Events & Plans", icon: Calendar },
            { id: "health", label: "System Health & Audit", icon: ShieldCheck },
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

              {metrics && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <MetricCard title="Total Registered" value={metrics.totalUsers} subtitle="All created accounts" />
                  <MetricCard
                    title="Profile Completed"
                    value={metrics.onboardedUsers}
                    subtitle={`${metrics.totalUsers ? Math.round((metrics.onboardedUsers / metrics.totalUsers) * 100) : 0}% completion`}
                  />
                  <MetricCard title="Live on Discover" value={metrics.discoverableUsers} subtitle="Active & discoverable" />
                  <MetricCard title="Mutual Matches" value={metrics.mutualMatches} subtitle="Two-way Dandiya clashes" />
                  <MetricCard title="Total Swipes" value={metrics.totalSwipes} subtitle="Send & pass reactions" />
                  <MetricCard title="Messages Exchanged" value={metrics.totalMessages} subtitle="Across matched chats" />
                  <MetricCard
                    title="Referral Invites"
                    value={`${metrics.claimedInvites} / ${metrics.totalInvites}`}
                    subtitle={`${metrics.conversionRate}% claimed conversion`}
                  />
                  <MetricCard
                    title="Pending Reports"
                    value={metrics.openReports}
                    subtitle="Requires moderator review"
                    highlight={metrics.openReports > 0}
                  />
                  <MetricCard title="New Users (24h)" value={metrics.newUsers24h} subtitle="Past 24 hours" />
                  <MetricCard title="New Users (7d)" value={metrics.newUsers7d} subtitle="Past 7 days" />
                  <MetricCard title="Active (24h)" value={metrics.activeUsers24h} subtitle="Profiles updated past 24h" />
                  <MetricCard title="Active (7d)" value={metrics.activeUsers7d} subtitle="Profiles updated past 7d" />
                </div>
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Invitations & Referrals</h2>
                  <p className="text-xs text-muted-foreground">Monitor aggregate invite usage and revoke compromised codes.</p>
                </div>
                {invitesLoading && <RefreshCw className="h-4 w-4 animate-spin text-action" />}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Creator</th>
                      <th className="px-4 py-3">Claimed By</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {invites.map((inv) => (
                      <tr key={inv.code} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-primary">{inv.code}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{inv.creator?.first_name || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">{inv.creator?.college || ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          {inv.claimed_by_user ? (
                            <span className="font-semibold text-foreground">
                              {inv.claimed_by_user.first_name} ({inv.claimed_by_user.college})
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Unclaimed</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {inv.revoked ? (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              Revoked
                            </span>
                          ) : inv.claimed_at ? (
                            <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                              Claimed
                            </span>
                          ) : (
                            <span className="rounded-full bg-action/15 px-2 py-0.5 text-[10px] font-bold text-action">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!inv.revoked && !inv.claimed_at && (
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
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: EVENTS & PLANS */}
          {activeTab === "events" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-primary">Garba Events & Venues</h2>
                  <p className="text-xs text-muted-foreground">Manage official venue listings and verified ticket booking links.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingEvent({
                      title: "",
                      venue: "",
                      city: "Raipur",
                      ticket_price_range: "",
                      price_source: "",
                      booking_url: "",
                      verification_status: "verified",
                    });
                    setEventModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Event Listing
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((ev) => (
                  <div key={ev.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                          {ev.verification_status}
                        </span>
                        <h3 className="font-display text-base font-extrabold text-primary mt-1">{ev.title}</h3>
                        <p className="text-xs text-muted-foreground">📍 {ev.venue}, {ev.city}</p>
                      </div>
                    </div>

                    {ev.ticket_price_range && (
                      <p className="text-xs text-foreground font-semibold">
                        🎟 {ev.ticket_price_range}{" "}
                        {ev.price_source && <span className="text-[10px] text-muted-foreground font-normal">({ev.price_source})</span>}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      {ev.booking_url ? (
                        <a
                          href={ev.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-action hover:underline"
                        >
                          Booking Link ↗
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No link</span>
                      )}
                      <button
                        onClick={() => {
                          setEditingEvent(ev);
                          setEventModalOpen(true);
                        }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
          <DialogContent className="max-w-md border-border/80 bg-background/98 p-6 shadow-2xl rounded-2xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="font-display text-lg font-extrabold text-primary">
                {editingEvent.id ? "Edit Event Listing" : "Add Event Listing"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Verified Garba and festival listings shown in After9 community.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEvent} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="font-semibold text-foreground">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Raas Garba 2026"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground">Venue</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shriram Ground"
                    value={editingEvent.venue}
                    onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">City</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.city}
                    onChange={(e) => setEditingEvent({ ...editingEvent, city: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-foreground">Ticket Price Range</label>
                <input
                  type="text"
                  placeholder="e.g. ₹300 - ₹800"
                  value={editingEvent.ticket_price_range || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, ticket_price_range: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
                />
              </div>
              <div>
                <label className="font-semibold text-foreground">Official Booking URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editingEvent.booking_url || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, booking_url: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
                />
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
