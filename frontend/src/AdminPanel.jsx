import { useEffect, useMemo, useState } from "react";
import "./AdminPanel.css";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileCheck2,
  Globe2,
  GitBranch,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Network,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Send,
  Settings,
  Trash2,
  Trophy,
  UserCircle,
  Users,
  X,
  Zap,
  Ban,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Bot,
} from "lucide-react";

import { apiFetch } from "./api";


const navGroups = [
  {
    label: "Command",
    items: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["ai", "AI Analysis", Bot],
      ["notifications", "Notifications", Bell],
    ],
  },
  {
    label: "Management",
    items: [
      ["hackathons", "Hackathons", Trophy],
      ["approvals", "Approvals", FileCheck2],
      ["users", "Users", Users],
      ["teams", "Teams", Users],
      ["submissions", "Submissions", FileCheck2],
      ["evaluations", "Evaluations", BarChart3],
      ["results", "Results", BarChart3],
    ],
  },
  {
    label: "System",
    items: [
      ["activity", "System Activity", Activity],
      ["system", "System Blueprint", Network],
      ["version", "Version Control", GitBranch],
    ],
  },
  {
    label: "Account",
    items: [["profile", "Profile", UserCircle]],
  },
];

const unwrap = (data, keys = []) => {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return Array.isArray(data) ? data : [];
};

const value = (v, fallback = "—") =>
  v === null || v === undefined || v === "" ? fallback : v;

const COMPLETED_STATUSES = new Set([
  "COMPLETED",
  "COMPLETE",
  "FINISHED",
  "CLOSED",
  "ARCHIVED",
]);

const isCompletedStatus = (status) =>
  COMPLETED_STATUSES.has(String(status || "").trim().toUpperCase());

const dedupeById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id;
    if (id === undefined || id === null) return true;
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeHackathons = (items = []) =>
  dedupeById(items);

const formatDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const formatTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
};

function Logo() {
  return (
    <div className="admin-brand">
      <div className="admin-logo-mark" aria-label="CampusCode">
        <span className="admin-logo-bar admin-logo-black" />
        <span className="admin-logo-bar admin-logo-purple" />
        <span className="admin-logo-bar admin-logo-lime" />
      </div>
      <div>
        <div className="admin-brand-name">CAMPUSCODE</div>
        <div className="admin-brand-sub">HACKATHON ARENA</div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="admin-loading">
      <LoaderCircle size={24} className="spin" />
      <span>Loading live backend data...</span>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="admin-error">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}

function Empty({ title, text }) {
  return (
    <div className="admin-empty">
      <Database size={25} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="admin-page-title">
      <div>
        <div className="admin-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ icon: Icon, label, number, detail, tone = "" }) {
  return (
    <div className={`admin-stat ${tone}`}>
      <div className="admin-stat-icon">
        <Icon size={18} />
      </div>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-number">{number}</div>
      <div className="admin-stat-detail">{detail}</div>
    </div>
  );
}

function AdminSidebar({ section, navigate, open, onLogout, user }) {
  return (
    <aside className={`admin-sidebar ${open ? "open" : ""}`}>
      <div className="admin-sidebar-top">
        <Logo />
        <button
          className="admin-mobile-close"
          onClick={() => navigate(section)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <div className="admin-sidebar-scroll">
        {navGroups.map((group) => (
          <div className="admin-nav-group" key={group.label}>
            <div className="admin-nav-label">{group.label}</div>

            {group.items.map(([key, label, Icon]) => (
              <button
                key={key}
                className={`admin-nav-item ${
                  section === key ? "active" : ""
                }`}
                onClick={() => navigate(key)}
              >
                <Icon size={17} />
                <span>{label}</span>

                {key === "approvals" && (
                  <span className="admin-nav-dot" />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="admin-sidebar-bottom">
        <div className="admin-mini-user">
          <div className="admin-avatar">
            {(user?.name || "A").charAt(0).toUpperCase()}
          </div>

          <div className="admin-mini-user-copy">
            <strong>{value(user?.name, "Administrator")}</strong>
            <span>ADMIN</span>
          </div>
        </div>

        <button className="admin-logout" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function AdminTopbar({ onMenu, user, section }) {
  const labels = {
    dashboard: "Dashboard",
    ai: "AI Analysis",
    notifications: "Notifications",
    hackathons: "Hackathons",
    approvals: "Approvals",
    users: "Users",
    teams: "Teams",
    submissions: "Submissions",
    evaluations: "Evaluations",
    results: "Results",
    activity: "System Activity",
    system: "System Blueprint",
    version: "Version Control",
    profile: "Profile",
  };

  return (
    <header className="admin-topbar">
      <button className="admin-menu-button" onClick={onMenu}>
        <Menu size={19} />
      </button>

      <div className="admin-breadcrumb">
        <span>ADMINISTRATION</span>
        <ChevronRight size={13} />
        <strong>{labels[section] || "Dashboard"}</strong>
      </div>

      <div className="admin-top-actions">
        <div className="admin-live-pill">
          <span />
          LIVE SYSTEM
        </div>

        <div className="admin-top-profile">
          <div className="admin-avatar small">
            {(user?.name || "A").charAt(0).toUpperCase()}
          </div>
          <span>{value(user?.name, "Admin")}</span>
        </div>
      </div>
    </header>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [pending, setPending] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const load = async () => {
    setLoading(true);
    setErrors([]);

    const results = await Promise.allSettled([
      apiFetch("/dashboard/admin"),
      apiFetch("/users/admin/all"),
      apiFetch("/hackathons"),
      apiFetch("/hackathons/admin/pending-approvals"),
      apiFetch("/health"),
    ]);

    const nextErrors = [];

    if (results[0].status === "fulfilled") {
      setData(results[0].value);
    } else {
      nextErrors.push(results[0].reason?.message || "Unable to load admin dashboard.");
    }

    if (results[1].status === "fulfilled") {
      setUsers(dedupeById(unwrap(results[1].value, ["users", "data"])));
    } else {
      nextErrors.push(results[1].reason?.message || "Unable to load users.");
    }

    if (results[2].status === "fulfilled") {
      setHackathons(
        dedupeHackathons(unwrap(results[2].value, ["hackathons", "events", "data"]))
      );
    } else {
      nextErrors.push(results[2].reason?.message || "Unable to load hackathons.");
    }

    if (results[3].status === "fulfilled") {
      setPending(
        dedupeHackathons(unwrap(results[3].value, ["hackathons", "data"]))
      );
    } else {
      nextErrors.push(results[3].reason?.message || "Unable to load approvals.");
    }

    if (results[4].status === "fulfilled") {
      setHealth(results[4].value);
    } else {
      nextErrors.push(results[4].reason?.message || "Unable to check backend health.");
    }

    setErrors(nextErrors);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const dashboardStats =
    data?.statistics || data?.stats || data?.data || {};

  const totalUsers =
    dashboardStats.total_users ??
    dashboardStats.users ??
    users.length;

  const activeUsers =
    dashboardStats.active_users ??
    users.filter((u) => u.is_active !== false).length;

  const totalHackathons =
    dashboardStats.total_hackathons ??
    dashboardStats.hackathons ??
    hackathons.length;

  const pendingCount =
    dashboardStats.pending_approvals ??
    dashboardStats.pending_hackathons ??
    pending.length;

  return (
    <div>
      <PageTitle
        eyebrow="Command Center"
        title={
          <>
            Platform <span>overview.</span>
          </>
        }
        description="A live administrative view of CampusCode. Metrics and records come from the connected backend."
        action={
          <button className="admin-refresh" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {errors.map((error, index) => (
        <ErrorBox key={index} message={error} />
      ))}

      {loading ? (
        <Loading />
      ) : (
        <>
          <section className="admin-hero-grid">
            <div className="admin-command-card">
              <div className="admin-command-grid" />

              <div className="admin-command-content">
                <div className="admin-command-tag">
                  <Zap size={13} />
                  CAMPUSCODE / ADMINISTRATION
                </div>

                <h2>
                  COMMAND
                  <br />
                  <em>CENTER.</em>
                </h2>

                <p>
                  Manage the hackathon ecosystem, review organizer requests,
                  operate notifications and keep platform activity visible.
                </p>

                <div className="admin-command-meta">
                  <span>
                    <i />
                    API {health?.status === "healthy" ? "HEALTHY" : "CONNECTED"}
                  </span>

                  <span>
                    DATABASE {health?.database || "—"}
                  </span>
                </div>
              </div>

              <div className="admin-command-orbit">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="admin-system-card">
              <div className="admin-card-head">
                <div>
                  <span className="admin-kicker">System snapshot</span>
                  <h3>Control signals</h3>
                </div>
                <Activity size={18} />
              </div>

              <div className="admin-signal">
                <span>Backend</span>
                <strong>{value(health?.status)}</strong>
                <i className={health?.status === "healthy" ? "ok" : ""} />
              </div>

              <div className="admin-signal">
                <span>Database</span>
                <strong>{value(health?.database)}</strong>
                <i className={health?.database === "connected" ? "ok" : ""} />
              </div>

              <div className="admin-signal">
                <span>Pending approvals</span>
                <strong>{pendingCount}</strong>
                <i className={pendingCount ? "warn" : "ok"} />
              </div>

              <div className="admin-system-footer">
                Last checked {formatTime(new Date())}
              </div>
            </div>
          </section>

          <section className="admin-stats-grid">
            <StatCard
              icon={Users}
              label="Total users"
              number={totalUsers}
              detail="Live from backend"
            />

            <StatCard
              icon={Trophy}
              label="Hackathons"
              number={totalHackathons}
              detail="Live hackathon registry"
              tone="purple"
            />

            <StatCard
              icon={Clock3}
              label="Pending approvals"
              number={pendingCount}
              detail="Requires admin review"
              tone="amber"
            />

            <StatCard
              icon={ShieldCheck}
              label="Active users"
              number={activeUsers}
              detail="Accounts currently active"
              tone="cyan"
            />
          </section>

          <section className="admin-two-column">
            <div className="admin-panel-card">
              <div className="admin-card-head">
                <div>
                  <span className="admin-kicker">Approval queue</span>
                  <h3>Needs your attention</h3>
                </div>

                <button onClick={() => onNavigate("approvals")}>
                  Open queue <ChevronRight size={14} />
                </button>
              </div>

              {pending.length ? (
                pending.slice(0, 5).map((item) => (
                  <div className="admin-list-row" key={item.id}>
                    <div className="admin-row-icon">
                      <FileCheck2 size={15} />
                    </div>

                    <div className="admin-row-main">
                      <strong>
                        {value(item.title, "Untitled hackathon")}
                      </strong>

                      <span>
                        {value(item.organizer_name, "Unknown organizer")} ·{" "}
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <span className="status-badge pending">
                      {String(
                        item.approval_status || "PENDING"
                      ).replaceAll("_", " ")}
                    </span>
                  </div>
                ))
              ) : (
                <Empty
                  title="Approval queue is clear"
                  text="No pending hackathon approvals were returned by the backend."
                />
              )}
            </div>

            <div className="admin-panel-card">
              <div className="admin-card-head">
                <div>
                  <span className="admin-kicker">Platform records</span>
                  <h3>Hackathon activity</h3>
                </div>

                <button onClick={() => onNavigate("hackathons")}>
                  View all <ChevronRight size={14} />
                </button>
              </div>

              {hackathons.length ? (
                hackathons.slice(0, 5).map((item) => (
                  <div className="admin-list-row" key={item.id}>
                    <div className="admin-row-icon purple">
                      <Trophy size={15} />
                    </div>

                    <div className="admin-row-main">
                      <strong>
                        {value(item.title || item.name)}
                      </strong>

                      <span>
                        {value(item.track || item.category, "No track")} ·{" "}
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <span className="status-badge">
                      {String(
                        item.publication_status ||
                        item.approval_status ||
                        item.status ||
                        "UNKNOWN"
                      ).replaceAll("_", " ")}
                    </span>
                  </div>
                ))
              ) : (
                <Empty
                  title="No hackathons found"
                  text="The backend returned an empty hackathon collection."
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}


/* =========================================================
   AI ANALYSIS
========================================================= */

function AIAnalysisPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadHackathons = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/hackathons");
      const list = dedupeHackathons(unwrap(data, ["hackathons", "events", "data"]));

      setHackathons(list);

      if (list[0]?.id && !selected) {
        setSelected(String(list[0].id));
      }
    } catch (e) {
      setError(e.message);
      setHackathons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHackathons();
  }, []);

  const runRound1Analysis = async () => {
    if (!selected) return;

    setAnalyzing(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const data = await apiFetch(
        `/ai/hackathons/${selected}/round1/analyze`,
        {
          method: "POST",
        }
      );

      setResult(data);
      setSuccess("Round 1 AI analysis completed by the backend.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <PageTitle
        eyebrow="Command / Artificial Intelligence"
        title={
          <>
            AI <span>analysis.</span>
          </>
        }
        description="Operate the existing CampusCode AI analysis service. AI results are returned by the backend."
        action={
          <button className="admin-refresh" onClick={loadHackathons}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {success && (
        <div className="admin-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="ai-command-layout">
          <section className="admin-panel-card ai-control-card">
            <div className="ai-glow" />

            <div className="ai-icon-large">
              <Bot size={30} />
            </div>

            <span className="admin-kicker">Gemini / AI service</span>

            <h2>Round 1 intelligence.</h2>

            <p>
              Select a hackathon and invoke the existing Round 1 AI analysis
              endpoint. Nothing is generated or scored inside this frontend.
            </p>

            <label className="admin-field-label">HACKATHON</label>

            <select
              className="admin-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {!hackathons.length && (
                <option value="">No hackathons available</option>
              )}

              {hackathons.map((hackathon) => (
                <option key={hackathon.id} value={hackathon.id}>
                  {hackathon.title || hackathon.name || "Hackathon"}
                </option>
              ))}
            </select>

            <button
              className="ai-run-button"
              onClick={runRound1Analysis}
              disabled={!selected || analyzing}
            >
              {analyzing ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Zap size={16} />
              )}

              {analyzing ? "Analyzing..." : "Run Round 1 AI Analysis"}
            </button>

            <div className="ai-route-note">
              <span>POST</span>
              /api/ai/hackathons/:hackathonId/round1/analyze
            </div>
          </section>

          <section className="admin-panel-card ai-result-card">
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">Backend response</span>
                <h3>Analysis output</h3>
              </div>
              <Server size={18} />
            </div>

            {result ? (
              <pre className="ai-json">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <Empty
                title="No analysis loaded"
                text="Run an analysis to display the real backend response here."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function NotificationsPage() {
  const [history, setHistory] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [users, setUsers] = useState([]);

  const [audience, setAudience] = useState("STUDENTS");
  const [hackathonId, setHackathonId] = useState("");
  const [userId, setUserId] = useState("");
  const [userIds, setUserIds] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("ANNOUNCEMENT");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      apiFetch("/notifications/history"),
      apiFetch("/hackathons"),
      apiFetch("/users/admin/all"),
    ]);

    if (results[0].status === "fulfilled") {
      setHistory(
        unwrap(results[0].value, [
          "notifications",
          "history",
          "data",
          "items",
        ])
      );
    }

    if (results[1].status === "fulfilled") {
      const list = unwrap(
        results[1].value,
        ["hackathons", "events", "data"]
      );
      setHackathons(list);

      if (list[0]?.id && !hackathonId) {
        setHackathonId(String(list[0].id));
      }
    }

    if (results[2].status === "fulfilled") {
      setUsers(
        unwrap(results[2].value, ["users", "data"])
      );
    }

    const failed = results.find((r) => r.status === "rejected");

    if (failed) {
      setError(failed.reason?.message || "Unable to load notification data.");
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleUser = (id) => {
    setUserIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const send = async (e) => {
    e.preventDefault();

    setSending(true);
    setError("");
    setSuccess("");

    const payload = {
      audience,
      title: title.trim(),
      message: message.trim(),
      type,
    };

    if (audience === "USER") {
      payload.user_id = userId;
    }

    if (audience === "SELECTED_USERS") {
      payload.user_ids = userIds;
    }

    if (audience === "HACKATHON_PARTICIPANTS") {
      payload.hackathon_id = hackathonId;
    }

    try {
      await apiFetch("/notifications", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess("Notification sent successfully through the backend.");
      setTitle("");
      setMessage("");
      setUserId("");
      setUserIds([]);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageTitle
        eyebrow="Command / Communications"
        title={
          <>
            Notification <span>center.</span>
          </>
        }
        description="Send real CampusCode notifications and review notification history."
        action={
          <button className="admin-refresh" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {success && (
        <div className="admin-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="notification-layout">
          <form className="admin-panel-card notification-compose" onSubmit={send}>
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">Broadcast</span>
                <h3>Compose notification</h3>
              </div>
              <MessageSquare size={18} />
            </div>

            <label className="admin-field-label">AUDIENCE</label>

            <select
              className="admin-select"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="STUDENTS">All Students</option>
              <option value="ORGANIZERS">All Organizers</option>
              <option value="ALL_USERS">All Users</option>
              <option value="USER">Single User</option>
              <option value="SELECTED_USERS">Selected Users</option>
              <option value="HACKATHON_PARTICIPANTS">
                Hackathon Participants
              </option>
            </select>

            {audience === "USER" && (
              <>
                <label className="admin-field-label">USER</label>
                <select
                  className="admin-select"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </>
            )}

            {audience === "SELECTED_USERS" && (
              <div className="user-picker">
                <div className="user-picker-head">
                  <span>Select recipients</span>
                  <strong>{userIds.length} selected</strong>
                </div>

                <div className="user-picker-list">
                  {users.map((user) => (
                    <button
                      type="button"
                      key={user.id}
                      className={`user-picker-row ${
                        userIds.includes(user.id) ? "selected" : ""
                      }`}
                      onClick={() => toggleUser(user.id)}
                    >
                      <span>
                        {(user.name || "U").charAt(0).toUpperCase()}
                      </span>

                      <div>
                        <strong>{value(user.name)}</strong>
                        <small>{value(user.email)}</small>
                      </div>

                      {userIds.includes(user.id) && (
                        <CheckCircle2 size={16} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {audience === "HACKATHON_PARTICIPANTS" && (
              <>
                <label className="admin-field-label">HACKATHON</label>
                <select
                  className="admin-select"
                  value={hackathonId}
                  onChange={(e) => setHackathonId(e.target.value)}
                  required
                >
                  <option value="">Select hackathon</option>
                  {hackathons.map((hackathon) => (
                    <option key={hackathon.id} value={hackathon.id}>
                      {hackathon.title || hackathon.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="admin-field-label">TYPE</label>

            <select
              className="admin-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="INFO">Info</option>
              <option value="HACKATHON">Hackathon</option>
              <option value="ROUND">Round</option>
            </select>

            <label className="admin-field-label">TITLE</label>

            <input
              className="admin-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              required
            />

            <label className="admin-field-label">MESSAGE</label>

            <textarea
              className="admin-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message..."
              rows={6}
              required
            />

            <button
              className="notification-send"
              type="submit"
              disabled={sending}
            >
              {sending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {sending ? "Sending..." : "Send notification"}
            </button>
          </form>

          <section className="admin-panel-card notification-history">
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">Backend records</span>
                <h3>Notification history</h3>
              </div>
              <Bell size={18} />
            </div>

            {history.length ? (
              history.slice(0, 30).map((item, index) => (
                <div className="notification-history-row" key={item.id || index}>
                  <div className="notification-history-icon">
                    <Bell size={15} />
                  </div>

                  <div>
                    <strong>
                      {value(item.title, "Notification")}
                    </strong>

                    <span>
                      {value(item.message)} ·{" "}
                      {formatDate(item.created_at || item.sent_at)}
                    </span>
                  </div>

                  <small>
                    {value(item.audience || item.type)}
                  </small>
                </div>
              ))
            ) : (
              <Empty
                title="No notification history"
                text="The backend returned no notification history records."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   HACKATHONS
========================================================= */

function HackathonsPage() {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/hackathons");
      setHackathons(
        dedupeHackathons(unwrap(data, ["hackathons", "events", "data"]))
      );
    } catch (e) {
      setError(e.message);
      setHackathons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (hackathon, status) => {
    if (!hackathon?.id) return;

    const currentStatus = String(
      hackathon.publication_status ||
      hackathon.approval_status ||
      hackathon.status ||
      ""
    ).toUpperCase();

    if (isCompletedStatus(currentStatus)) {
      setError("Completed hackathons are read-only and cannot be blocked or unblocked.");
      return;
    }

    setBusy(`${status}-${hackathon.id}`);
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/hackathons/${hackathon.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setSuccess(`Hackathon status changed to ${status}.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const deleteHackathon = async (hackathon) => {
    if (!hackathon?.id) return;

    const title = hackathon.title || hackathon.name || "this hackathon";

    if (
      !window.confirm(
        `Delete "${title}"?\n\nThis permanently removes the hackathon and related data.`
      )
    ) {
      return;
    }

    setBusy(`delete-${hackathon.id}`);
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/hackathons/${hackathon.id}`, {
        method: "DELETE",
      });

      setSuccess("Hackathon deleted successfully.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageTitle
        eyebrow="Management / Events"
        title={
          <>
            Hackathon <span>registry.</span>
          </>
        }
        description="Manage hackathons using the existing CampusCode administrator APIs."
        action={
          <button className="admin-refresh" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {success && (
        <div className="admin-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : hackathons.length ? (
        <div className="admin-event-grid">
          {hackathons.map((hackathon) => {
            const status = String(
              hackathon.publication_status ||
                hackathon.approval_status ||
                hackathon.status ||
                "UNKNOWN"
            ).toUpperCase();

            return (
              <article
                className={`admin-event-card ${
                  isCompletedStatus(status) ? "admin-event-card-completed" : ""
                }`}
                key={hackathon.id}
              >
                <div className="admin-event-top">
                  <span className="event-index">
                    #{String(hackathon.id).slice(0, 8)}
                  </span>

                  <span className={`status-badge ${
                    isCompletedStatus(status) ? "completed" : ""
                  }`}>
                    {isCompletedStatus(status)
                      ? "COMPLETED ✓"
                      : status.replaceAll("_", " ")}
                  </span>
                </div>

                <h3>
                  {value(
                    hackathon.title || hackathon.name,
                    "Untitled hackathon"
                  )}
                </h3>

                <p>
                  {value(
                    hackathon.description,
                    "No description provided."
                  )}
                </p>

                <div className="admin-event-meta">
                  <span>
                    TRACK
                    <b>{value(hackathon.track || hackathon.category)}</b>
                  </span>

                  <span>
                    ORGANIZER
                    <b>
                      {value(
                        hackathon.organizer_name ||
                          hackathon.organizer
                      )}
                    </b>
                  </span>

                  <span>
                    ROUND
                    <b>{value(hackathon.current_round, "0")}</b>
                  </span>

                  <span>
                    CREATED
                    <b>{formatDate(hackathon.created_at)}</b>
                  </span>
                </div>

                {isCompletedStatus(status) && (
                  <div className="admin-completed-note">
                    This hackathon is completed and is now read-only.
                  </div>
                )}

                <div className="admin-event-actions">
                  <button
                    className="event-action neutral"
                    disabled={!!busy || isCompletedStatus(status)}
                    onClick={() =>
                      updateStatus(
                        hackathon,
                        status === "BLOCKED" ? "OPEN" : "BLOCKED"
                      )
                    }
                  >
                    {status === "BLOCKED" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Ban size={14} />
                    )}
                    {status === "BLOCKED" ? "Unblock" : "Block"}
                  </button>

                  <button
                    className="event-action danger"
                    disabled={!!busy}
                    onClick={() => deleteHackathon(hackathon)}
                  >
                    {busy === `delete-${hackathon.id}` ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No hackathons found"
          text="The backend returned an empty hackathon collection."
        />
      )}
    </div>
  );
}


/* =========================================================
   APPROVALS
========================================================= */

function ApprovalsPage() {
  const [items, setItems] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(
        "/hackathons/admin/pending-approvals"
      );

      setItems(
        unwrap(data, ["hackathons", "data"])
      );
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (item, decision) => {
    if (!item?.id) return;

    setBusy(`${decision}-${item.id}`);
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/hackathons/${item.id}/approval`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          feedback: feedback[item.id]?.trim() || null,
        }),
      });

      setSuccess(
        `"${item.title || "Hackathon"}" was ${
          decision === "APPROVE" ? "approved" : "rejected"
        }.`
      );

      setItems((current) =>
        current.filter((currentItem) => currentItem.id !== item.id)
      );

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageTitle
        eyebrow="Management / Approval Queue"
        title={
          <>
            Review <span>requests.</span>
          </>
        }
        description="Organizer-submitted hackathons waiting for an administrator decision."
        action={
          <button className="admin-refresh" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {success && (
        <div className="admin-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : items.length ? (
        <div className="admin-approval-stack">
          {items.map((item) => (
            <article className="admin-approval-card" key={item.id}>
              <div className="approval-header">
                <div>
                  <span className="admin-kicker">PENDING REVIEW</span>
                  <h3>{value(item.title, "Untitled hackathon")}</h3>
                  <p>
                    {value(item.organizer_name, "Unknown organizer")} ·{" "}
                    {value(item.organizer_email)}
                  </p>
                </div>

                <span className="status-badge pending">PENDING</span>
              </div>

              <div className="approval-grid">
                <div>
                  <label>TRACK</label>
                  <strong>{value(item.track)}</strong>
                </div>

                <div>
                  <label>LOCATION</label>
                  <strong>{value(item.location)}</strong>
                </div>

                <div>
                  <label>EXPECTED DATE</label>
                  <strong>
                    {formatDate(
                      item.expected_date || item.start_date
                    )}
                  </strong>
                </div>

                <div>
                  <label>MAX TEAMS</label>
                  <strong>{value(item.max_teams)}</strong>
                </div>
              </div>

              <p className="approval-description">
                {value(
                  item.description,
                  "No description provided."
                )}
              </p>

              <textarea
                value={feedback[item.id] || ""}
                onChange={(e) =>
                  setFeedback((current) => ({
                    ...current,
                    [item.id]: e.target.value,
                  }))
                }
                placeholder="Optional feedback for the organizer..."
              />

              <div className="approval-actions">
                <button
                  className="approve"
                  disabled={!!busy}
                  onClick={() => review(item, "APPROVE")}
                >
                  {busy === `APPROVE-${item.id}` ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  Approve
                </button>

                <button
                  className="reject"
                  disabled={!!busy}
                  onClick={() => review(item, "REJECT")}
                >
                  {busy === `REJECT-${item.id}` ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <X size={15} />
                  )}
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No pending approvals"
          text="The approval endpoint returned an empty queue."
        />
      )}
    </div>
  );
}


/* =========================================================
   USERS
========================================================= */

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/users/admin/all");
      setUsers(unwrap(data, ["users", "data"]));
    } catch (e) {
      setError(e.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleUser = async (user) => {
    if (!user?.id) return;

    if (String(user.role || "").toUpperCase() === "ADMIN") {
      setError("Administrator accounts cannot be blocked from this panel.");
      return;
    }

    const nextActive = user.is_active === false;

    setBusy(`status-${user.id}`);
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/users/admin/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });

      setSuccess(
        `${user.name || "User"} has been ${nextActive ? "unblocked" : "blocked"}.`
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const deleteUser = async (user) => {
    if (!user?.id) return;

    if (String(user.role || "").toUpperCase() === "ADMIN") {
      setError("Administrator accounts cannot be deleted from this panel.");
      return;
    }

    const name = user.name || user.email || "this user";

    if (
      !window.confirm(
        `Delete "${name}"?\n\nThis permanently removes the user account. If the account is referenced by protected records, the backend will safely reject the deletion.`
      )
    ) {
      return;
    }

    setBusy(`delete-${user.id}`);
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/users/admin/${user.id}`, {
        method: "DELETE",
      });

      setSuccess("User deleted successfully.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const filtered = useMemo(
    () =>
      users.filter((user) =>
        `${user.name || ""} ${user.email || ""} ${
          user.role || ""
        } ${user.campus_code_id || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [users, query]
  );

  return (
    <div>
      <PageTitle
        eyebrow="Management / Users"
        title={
          <>
            User <span>directory.</span>
          </>
        }
        description="Manage live CampusCode accounts, access status and account removal."
        action={
          <button className="admin-refresh" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {success && (
        <div className="admin-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      <div className="admin-user-control-note">
        <ShieldCheck size={15} />
        <span>
          Blocking changes <b>is_active</b> and immediately prevents that account
          from logging in. Deletion is permanent and is protected by the
          database relationships.
        </span>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, role or campus ID..."
          />
        </div>

        <span>
          {filtered.length} / {users.length} users
        </span>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-user-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Campus ID</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((user) => {
                const isAdmin = String(user.role || "").toUpperCase() === "ADMIN";
                const blocked = user.is_active === false;

                return (
                  <tr key={user.id}>
                    <td>
                      <div className="table-user">
                        <div className="admin-avatar">
                          {(user.name || "U").charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <strong>{value(user.name)}</strong>
                          <span>{value(user.email)}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`role-badge ${String(
                          user.role || ""
                        ).toLowerCase()}`}
                      >
                        {value(user.role)}
                      </span>
                    </td>

                    <td>{value(user.campus_code_id)}</td>

                    <td>
                      <span
                        className={`status-badge ${blocked ? "blocked" : "active"}`}
                      >
                        {blocked ? "BLOCKED" : "ACTIVE"}
                      </span>
                    </td>

                    <td>{formatDate(user.created_at)}</td>

                    <td>
                      <div className="admin-user-actions">
                        <button
                          className={`user-action ${blocked ? "restore" : "block"}`}
                          disabled={!!busy || isAdmin}
                          title={isAdmin ? "Admin accounts are protected" : blocked ? "Unblock user" : "Block user"}
                          onClick={() => toggleUser(user)}
                        >
                          {busy === `status-${user.id}` ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : blocked ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Ban size={14} />
                          )}
                          {blocked ? "Unblock" : "Block"}
                        </button>

                        <button
                          className="user-action delete"
                          disabled={!!busy || isAdmin}
                          title={isAdmin ? "Admin accounts are protected" : "Delete user"}
                          onClick={() => deleteUser(user)}
                        >
                          {busy === `delete-${user.id}` ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No users found"
          text="No matching users were returned by the backend."
        />
      )}
    </div>
  );
}

/* =========================================================
   TEAMS
========================================================= */

function TeamsPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useState("");
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHackathons = async () => {
    try {
      const data = await apiFetch("/hackathons");
      const list = dedupeHackathons(unwrap(data, ["hackathons", "events", "data"]));
      setHackathons(list);

      if (list[0]?.id && !selected) {
        setSelected(String(list[0].id));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHackathons();
  }, []);

  useEffect(() => {
    if (!selected) return;

    apiFetch(`/hackathons/${selected}/teams`)
      .then((data) =>
        setTeams(unwrap(data, ["teams", "data"]))
      )
      .catch((e) => {
        setError(e.message);
        setTeams([]);
      });
  }, [selected]);

  return (
    <div>
      <PageTitle
        eyebrow="Management / Collaboration"
        title={
          <>
            Team <span>management.</span>
          </>
        }
        description="Live teams loaded from the existing hackathon team API."
      />

      {error && <ErrorBox message={error} />}

      <div className="admin-select-wrap">
        <label>HACKATHON</label>

        <select
          className="admin-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {!hackathons.length && (
            <option value="">No hackathons</option>
          )}

          {hackathons.map((hackathon) => (
            <option key={hackathon.id} value={hackathon.id}>
              {hackathon.title || hackathon.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : teams.length ? (
        <div className="admin-simple-list">
          {teams.map((team) => (
            <div className="admin-simple-row" key={team.id}>
              <div>
                <strong>
                  {value(team.name || team.team_name)}
                </strong>
                <span>
                  {value(team.status, "No status")}
                </span>
              </div>

              <b>
                {team.member_count ??
                  team.members?.length ??
                  "—"}{" "}
                members
              </b>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No teams found"
          text="The selected hackathon returned no team records."
        />
      )}
    </div>
  );
}


/* =========================================================
   SUBMISSIONS
========================================================= */

function SubmissionsPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useState("");
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/hackathons")
      .then((data) => {
        const list = unwrap(data, [
          "hackathons",
          "events",
          "data",
        ]);

        setHackathons(list);

        if (list[0]?.id) {
          setSelected(String(list[0].id));
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;

    apiFetch(`/hackathons/${selected}/teams`)
      .then((data) =>
        setTeams(unwrap(data, ["teams", "data"]))
      )
      .catch((e) => {
        setError(e.message);
        setTeams([]);
      });
  }, [selected]);

  return (
    <div>
      <PageTitle
        eyebrow="Management / Review"
        title={
          <>
            Submission <span>oversight.</span>
          </>
        }
        description="Live team/project records from the connected hackathon APIs."
      />

      {error && <ErrorBox message={error} />}

      <div className="admin-select-wrap">
        <label>HACKATHON</label>

        <select
          className="admin-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {hackathons.map((hackathon) => (
            <option key={hackathon.id} value={hackathon.id}>
              {hackathon.title || hackathon.name}
            </option>
          ))}
        </select>
      </div>

      {teams.length ? (
        <div className="admin-simple-list">
          {teams.map((team) => (
            <div className="admin-simple-row" key={team.id}>
              <div>
                <strong>
                  {value(team.name || team.team_name)}
                </strong>
                <span>
                  Project:{" "}
                  {value(
                    team.project_title ||
                      team.project?.title,
                    "No project"
                  )}
                </span>
              </div>

              <b>{value(team.status)}</b>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No submission records"
          text="No team/project records were returned for the selected hackathon."
        />
      )}
    </div>
  );
}


/* =========================================================
   EVALUATIONS
========================================================= */

function EvaluationsPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/hackathons")
      .then((data) => {
        const list = unwrap(data, [
          "hackathons",
          "events",
          "data",
        ]);

        setHackathons(list);

        if (list[0]?.id) {
          setSelected(String(list[0].id));
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;

    apiFetch(`/results/hackathon/${selected}`)
      .then((data) =>
        setResults(unwrap(data, ["results", "data"]))
      )
      .catch((e) => {
        setError(e.message);
        setResults([]);
      });
  }, [selected]);

  return (
    <div>
      <PageTitle
        eyebrow="Management / Evaluation"
        title={
          <>
            Evaluation <span>records.</span>
          </>
        }
        description="Read evaluation/result records returned by the backend. No scores are generated here."
      />

      {error && <ErrorBox message={error} />}

      <div className="admin-select-wrap">
        <label>HACKATHON</label>

        <select
          className="admin-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {hackathons.map((hackathon) => (
            <option key={hackathon.id} value={hackathon.id}>
              {hackathon.title || hackathon.name}
            </option>
          ))}
        </select>
      </div>

      {results.length ? (
        <div className="admin-results-list">
          {results.map((item, index) => (
            <div
              className="admin-result-row"
              key={
                item.submission_id ||
                item.team_id ||
                item.id ||
                index
              }
            >
              <div className="rank">
                #{item.rank ?? index + 1}
              </div>

              <div className="result-main">
                <strong>
                  {value(
                    item.team_name ||
                      item.team?.name,
                    "Team"
                  )}
                </strong>

                <span>
                  {value(
                    item.project_title ||
                      item.project?.title,
                    "Project"
                  )}
                </span>
              </div>

              <div className="result-score">
                {value(
                  item.score ??
                    item.overall_score
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No evaluation records"
          text="No result/evaluation records were returned for the selected hackathon."
        />
      )}
    </div>
  );
}


/* =========================================================
   RESULTS / RESULT REQUESTS
========================================================= */

function ResultsPage() {
  const [requests, setRequests] = useState([]);
  const [results, setResults] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const response = await Promise.allSettled([
      apiFetch("/admin/result-requests/pending"),
      apiFetch("/hackathons"),
    ]);

    if (response[0].status === "fulfilled") {
      setRequests(
        unwrap(response[0].value, [
          "requests",
          "resultRequests",
          "data",
        ])
      );
    }

    if (response[1].status === "fulfilled") {
      const list = unwrap(
        response[1].value,
        ["hackathons", "events", "data"]
      );

      setHackathons(list);

      if (list[0]?.id && !selected) {
        setSelected(String(list[0].id));
      }
    }

    const failed = response.find(
      (item) => item.status === "rejected"
    );

    if (failed) {
      setError(failed.reason?.message || "Unable to load result data.");
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;

    apiFetch(`/results/hackathon/${selected}`)
      .then((data) =>
        setResults(unwrap(data, ["results", "data"]))
      )
      .catch((e) => {
        setError(e.message);
        setResults([]);
      });
  }, [selected]);

  const decide = async (request, action) => {
    if (!request?.id) return;

    setBusy(`${action}-${request.id}`);
    setError("");
    setSuccess("");

    try {
      await apiFetch(
        `/admin/result-requests/${request.id}/${action}`,
        {
          method: "POST",
        }
      );

      setSuccess(
        `Result request ${action === "approve" ? "approved" : "rejected"}.`
      );

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageTitle
        eyebrow="Management / Results"
        title={
          <>
            Results <span>control.</span>
          </>
        }
        description="Review result-publication requests and read published result records."
        action={
          <button className="admin-refresh" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {success && (
        <div className="admin-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <section className="admin-panel-card result-request-card">
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">
                  ADMIN RESULT REQUESTS
                </span>
                <h3>Pending publication requests</h3>
              </div>

              <BarChart3 size={18} />
            </div>

            {requests.length ? (
              requests.map((request) => (
                <div
                  className="result-request-row"
                  key={request.id}
                >
                  <div>
                    <strong>
                      {value(
                        request.hackathon_title ||
                          request.title ||
                          request.hackathon?.title,
                        "Hackathon result request"
                      )}
                    </strong>

                    <span>
                      {value(
                        request.organizer_name ||
                          request.organizer?.name,
                        "Organizer"
                      )}{" "}
                      · {formatDate(request.created_at)}
                    </span>
                  </div>

                  <div className="result-request-actions">
                    <button
                      className="approve"
                      disabled={!!busy}
                      onClick={() =>
                        decide(request, "approve")
                      }
                    >
                      {busy === `approve-${request.id}` ? (
                        <LoaderCircle className="spin" size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      Approve
                    </button>

                    <button
                      className="reject"
                      disabled={!!busy}
                      onClick={() =>
                        decide(request, "reject")
                      }
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="No pending result requests"
                text="The admin result-request endpoint returned an empty queue."
              />
            )}
          </section>

          <section className="admin-panel-card published-results-card">
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">
                  PUBLISHED DATA
                </span>
                <h3>Hackathon results</h3>
              </div>
            </div>

            <div className="admin-select-wrap">
              <label>HACKATHON</label>

              <select
                className="admin-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {!hackathons.length && (
                  <option value="">No hackathons</option>
                )}

                {hackathons.map((hackathon) => (
                  <option
                    key={hackathon.id}
                    value={hackathon.id}
                  >
                    {hackathon.title || hackathon.name}
                  </option>
                ))}
              </select>
            </div>

            {results.length ? (
              <div className="admin-results-list">
                {results.map((item, index) => (
                  <div
                    className="admin-result-row"
                    key={
                      item.submission_id ||
                      item.team_id ||
                      item.id ||
                      index
                    }
                  >
                    <div className="rank">
                      #{item.rank ?? index + 1}
                    </div>

                    <div className="result-main">
                      <strong>
                        {value(
                          item.team_name ||
                            item.team?.name,
                          "Team"
                        )}
                      </strong>

                      <span>
                        {value(
                          item.project_title ||
                            item.project?.title,
                          "Project"
                        )}
                      </span>
                    </div>

                    <div className="result-score">
                      {value(
                        item.score ??
                          item.overall_score
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No published results"
                text="No result records were returned for the selected hackathon."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}



/* =========================================================
   SYSTEM BLUEPRINT / ADMIN DIGITAL TWIN
   Former Super Admin blueprint visual + interactions, now
   integrated into the Admin panel.
========================================================= */

function ActivityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await apiFetch("/monitoring/requests?limit=50");
      setItems(unwrap(result, ["requests", "activity", "activities", "events", "logs", "data", "items"]));
    } catch (e) {
      setError(e.message || "Unable to load system activity.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return <section>
    <PageTitle eyebrow="SYSTEM / ACTIVITY" title={<>System <span>activity.</span></>} description="Operational events and platform activity from the existing administration API." />
    <div className="admin-panel-card admin-activity-shell">
      <div className="admin-card-head"><div><span className="admin-kicker">LIVE ACTIVITY</span><h3>Platform event stream</h3></div><button className="event-action neutral" onClick={load}><RefreshCw size={14}/> Refresh</button></div>
      {loading ? <div className="admin-loading"><LoaderCircle className="spin" size={20}/> Loading activity...</div> : error ? <ErrorBox message={error}/> : items.length ? <div className="admin-activity-list">{items.map((item, i) => {
        const timestamp = item.request_id ? item.created_at : (item.created_at || item.createdAt || item.timestamp);
        const status = Number(item.status_code ?? item.status ?? 0);
        const statusLabel = status >= 500 ? "SERVER ERROR" : status >= 400 ? "CLIENT ERROR" : status >= 200 ? "SUCCESS" : "REQUEST";
        const requestLabel = item.endpoint
          ? `${String(item.method || "REQUEST").toUpperCase()} ${item.endpoint}`
          : value(item.title || item.action || item.event || item.type, "SYSTEM EVENT");
        const description = item.endpoint
          ? `${statusLabel} • ${item.response_time_ms != null ? `${item.response_time_ms} ms` : "response time unavailable"}${item.user_role ? ` • ${item.user_role}` : ""}`
          : value(item.description || item.message || item.details, "Activity recorded by CampusCode.");
        return <div className="admin-activity-row" key={item.request_id || item.id || i}>
          <span className="admin-activity-icon"><Activity size={15}/></span>
          <div><strong>{requestLabel}</strong><p>{description}</p></div>
          <time>{formatDate(timestamp)} {formatTime(timestamp)}</time>
        </div>;
      })}</div> : <Empty title="NO SYSTEM ACTIVITY" text="The backend returned no request activity records." />}
    </div>
  </section>;
}

const ADMIN_BLUEPRINT = {
  campuscode: {
    id: "campuscode", name: "CAMPUSCODE", type: "PLATFORM", status: "ONLINE",
    description: "CampusCode production platform and service topology.",
    details: "The complete CampusCode platform connecting portals, backend services, PostgreSQL data, AI services and observability.",
    children: ["frontend", "backend", "database", "ai", "monitoring"],
  },
  frontend: {
    id: "frontend", name: "FRONTEND", type: "APPLICATION", status: "ONLINE",
    description: "React application layer serving all CampusCode portals.",
    details: "Client-side application containing the Student, Organizer and Admin experiences and their supporting pages.",
    children: ["student", "organizer", "admin"],
  },
  student: {
    id: "student", name: "STUDENT PAGE", type: "PORTAL", status: "ONLINE",
    description: "Student-facing portal for hackathons, teams, submissions, IdeaCheck and results.",
    details: "Student workspace for discovering hackathons, joining teams, submitting projects, using AI assistance and viewing competition outcomes.",
    children: ["student-overview", "student-hackathons", "student-team", "student-project", "student-rounds", "student-ideacheck", "student-rulebot", "student-leaderboard", "student-notifications"],
  },
  organizer: {
    id: "organizer", name: "ORGANIZER PAGE", type: "PORTAL", status: "ONLINE",
    description: "Organizer portal for hackathon management, round reviews, decisions and feedback.",
    details: "Organizer workspace for creating and managing hackathons, reviewing rounds, making decisions, publishing feedback and managing results.",
    children: ["organizer-dashboard", "organizer-hackathons", "organizer-r1", "organizer-r2", "organizer-r3", "organizer-results", "organizer-notifications"],
  },
  admin: {
    id: "admin", name: "ADMIN PAGE", type: "PORTAL", status: "ONLINE",
    description: "Admin control layer for platform governance and administration.",
    details: "Administrative control surface for users, hackathons, teams, submissions, evaluations, results, notifications and system operations.",
    children: ["admin-dashboard", "admin-users", "admin-hackathons", "admin-teams", "admin-submissions", "admin-results", "admin-notifications", "admin-system"],
  },
  backend: {
    id: "backend", name: "BACKEND API", type: "BACKEND", status: "ONLINE",
    description: "Node.js and Express API layer handling authentication, modules and platform workflows.",
    details: "The API layer receives authenticated requests, enforces role access, coordinates business logic and communicates with PostgreSQL and AI services.",
    children: ["backend-auth", "backend-users", "backend-hackathons", "backend-teams", "backend-rounds", "backend-results", "backend-ideacheck", "backend-rulebot", "backend-notifications"],
  },
  database: {
    id: "database", name: "NEON POSTGRESQL", type: "DATABASE", status: "ONLINE",
    description: "Primary PostgreSQL data layer for CampusCode.",
    details: "Persistent platform data including users, hackathons, participants, teams, submissions, round decisions, AI analysis and notifications.",
    children: ["db-users", "db-hackathons", "db-participants", "db-teams", "db-submissions", "db-results", "db-ai", "db-notifications"],
  },
  ai: {
    id: "ai", name: "GEMINI AI", type: "AI ENGINE", status: "ONLINE",
    description: "AI service used by supported CampusCode analysis workflows.",
    details: "AI layer supporting project analysis, recommendations and selected intelligence workflows while keeping organizer control over decisions.",
    children: ["ai-r1", "ai-r2", "ai-ideacheck", "ai-rulebot"],
  },
  monitoring: {
    id: "monitoring", name: "OBSERVABILITY", type: "MONITORING", status: "ONLINE",
    description: "Request, error, latency and platform activity telemetry.",
    details: "System observability layer used to inspect health, requests, errors, response time and platform activity.",
    children: ["monitoring-requests", "monitoring-errors", "monitoring-health", "monitoring-activity"],
  },
};

const ADMIN_BLUEPRINT_EXTRA = {
  "student-overview": ["OVERVIEW", "PAGE", "Student dashboard and current competition state.", "Student landing and summary surface."],
  "student-hackathons": ["HACKATHONS", "MODULE", "Discover, view and join available hackathons.", "Hackathon discovery and registration flow."],
  "student-team": ["MY TEAM", "MODULE", "Team creation, membership and team workspace.", "Student team management workflow."],
  "student-project": ["MY PROJECT", "MODULE", "Project details and submission workspace.", "Student project and submission preparation."],
  "student-rounds": ["R1 / R2 / R3", "MODULE", "Round status, submissions, decisions and feedback.", "Multi-round competition lifecycle."],
  "student-ideacheck": ["IDEACHECK AI", "AI MODULE", "Similarity and originality analysis workflow.", "AI-assisted idea comparison."],
  "student-rulebot": ["RULEBOT", "AI MODULE", "Hackathon rule assistance and student guidance.", "Rule-aware assistance module."],
  "student-leaderboard": ["LEADERBOARD", "MODULE", "Published competition ranking and results.", "Results visibility for students."],
  "student-notifications": ["NOTIFICATIONS", "MODULE", "Student-facing competition and platform notifications.", "Notification delivery surface."],
  "organizer-dashboard": ["DASHBOARD", "PAGE", "Organizer overview and active hackathon state.", "Organizer command surface."],
  "organizer-hackathons": ["HACKATHONS", "MODULE", "Create, configure and manage organizer hackathons.", "Hackathon management workflow."],
  "organizer-r1": ["ROUND 1", "REVIEW MODULE", "Review Round 1 submissions and AI analysis.", "Organizer Round 1 evaluation."],
  "organizer-r2": ["ROUND 2", "REVIEW MODULE", "Review Round 2 submissions and AI analysis.", "Organizer Round 2 evaluation."],
  "organizer-r3": ["ROUND 3", "MANUAL REVIEW", "Manual scoring, decisions and organizer feedback.", "Final manual competition review."],
  "organizer-results": ["RESULTS", "MODULE", "Result request, publication and leaderboard workflow.", "Organizer result workflow."],
  "organizer-notifications": ["NOTIFICATIONS", "MODULE", "Organizer-facing notifications and updates.", "Organizer notification surface."],
  "admin-dashboard": ["DASHBOARD", "PAGE", "Platform administration overview and controls.", "Admin dashboard."],
  "admin-users": ["USERS", "MODULE", "User administration, roles and account state.", "Administrative user management."],
  "admin-hackathons": ["HACKATHONS", "MODULE", "Hackathon administration and platform oversight.", "Administrative hackathon management."],
  "admin-teams": ["TEAMS", "MODULE", "Team administration and participant oversight.", "Administrative team management."],
  "admin-submissions": ["SUBMISSIONS", "MODULE", "Submission and evaluation oversight.", "Administrative submission management."],
  "admin-results": ["RESULT APPROVAL", "MODULE", "Review and approve/reject organizer result requests.", "Administrative result approval."],
  "admin-notifications": ["NOTIFICATIONS", "MODULE", "Platform notification controls.", "Administrative notification management."],
  "admin-system": ["SYSTEM BLUEPRINT", "SYSTEM", "Interactive architecture, health and system controls.", "Admin-integrated platform observability."],
  "backend-auth": ["AUTH", "API MODULE", "JWT authentication and role-based authorization.", "Authentication and authorization API."],
  "backend-users": ["USERS", "API MODULE", "User and role management APIs.", "User service endpoints."],
  "backend-hackathons": ["HACKATHONS", "API MODULE", "Hackathon creation, discovery, registration and administration APIs.", "Hackathon service endpoints."],
  "backend-teams": ["TEAMS", "API MODULE", "Team creation, membership and project relationships.", "Team service endpoints."],
  "backend-rounds": ["ROUNDS", "API MODULE", "Round 1, Round 2 and Round 3 lifecycle APIs.", "Competition round services."],
  "backend-results": ["RESULTS", "API MODULE", "Result requests, approval and leaderboard APIs.", "Result service endpoints."],
  "backend-ideacheck": ["IDEACHECK", "API MODULE", "Similarity and originality analysis API.", "IdeaCheck service."],
  "backend-rulebot": ["RULEBOT", "API MODULE", "Rule assistance API.", "RuleBot service."],
  "backend-notifications": ["NOTIFICATIONS", "API MODULE", "Notification creation and retrieval APIs.", "Notification service."],
  "db-users": ["USERS", "TABLE GROUP", "User identity, roles and account state.", "Core user records."],
  "db-hackathons": ["HACKATHONS", "TABLE GROUP", "Hackathon configuration and lifecycle data.", "Hackathon records."],
  "db-participants": ["PARTICIPANTS", "TABLE GROUP", "Hackathon participation relationships.", "Participant records."],
  "db-teams": ["TEAMS", "TABLE GROUP", "Team and membership data.", "Team records."],
  "db-submissions": ["SUBMISSIONS", "TABLE GROUP", "Project and round submission data.", "Submission records."],
  "db-results": ["RESULTS", "TABLE GROUP", "Result requests, decisions and leaderboard data.", "Result records."],
  "db-ai": ["AI ANALYSIS", "TABLE GROUP", "AI scores, feedback and analysis metadata.", "AI analysis records."],
  "db-notifications": ["NOTIFICATIONS", "TABLE GROUP", "Notification and delivery records.", "Notification records."],
  "ai-r1": ["R1 ANALYSIS", "AI FLOW", "AI-assisted Round 1 project analysis.", "Gemini analysis flow."],
  "ai-r2": ["R2 ANALYSIS", "AI FLOW", "AI-assisted Round 2 project analysis.", "Gemini analysis flow."],
  "ai-ideacheck": ["IDEACHECK", "AI FLOW", "Similarity analysis using project descriptions and scoring.", "IdeaCheck intelligence flow."],
  "ai-rulebot": ["RULEBOT", "AI FLOW", "Rule-aware student assistance.", "RuleBot assistance flow."],
  "monitoring-requests": ["REQUEST TELEMETRY", "TELEMETRY", "HTTP request method, endpoint, status, role and response time.", "Monitoring request logs."],
  "monitoring-errors": ["ERROR TELEMETRY", "TELEMETRY", "Captured API error messages and failed requests.", "Monitoring error logs."],
  "monitoring-health": ["HEALTH CHECKS", "TELEMETRY", "API, database and AI health state.", "Platform health monitoring."],
  "monitoring-activity": ["SYSTEM ACTIVITY", "TELEMETRY", "Recent platform and administrative activity.", "Activity monitoring."],
};

function adminBlueprintNode(id) {
  if (ADMIN_BLUEPRINT[id]) return ADMIN_BLUEPRINT[id];
  const extra = ADMIN_BLUEPRINT_EXTRA[id];
  if (extra) return { id, name: extra[0], type: extra[1], status: "ONLINE", description: extra[2], details: extra[3], children: [] };
  return { id, name: String(id || "UNKNOWN").replaceAll("-", " ").toUpperCase(), type: "SERVICE", status: "ONLINE", description: "CampusCode system component.", details: "System component.", children: [] };
}

function adminBlueprintIcon(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("database") || t.includes("table")) return Database;
  if (t.includes("ai")) return BrainCircuit;
  if (t.includes("backend") || t.includes("api")) return Server;
  if (t.includes("monitor") || t.includes("telemetry")) return Activity;
  if (t.includes("portal") || t.includes("page") || t.includes("application")) return Globe2;
  if (t.includes("system")) return Network;
  return Boxes;
}

function findBlueprintParentId(childId) {
  for (const [id, node] of Object.entries(ADMIN_BLUEPRINT)) {
    if ((node.children || []).includes(childId)) return id;
  }
  for (const [id, node] of Object.entries(ADMIN_BLUEPRINT)) {
    for (const nestedId of node.children || []) {
      const nested = adminBlueprintNode(nestedId);
      if ((nested.children || []).includes(childId)) return nestedId;
    }
  }
  return "campuscode";
}

function AdminBlueprintNode({ node, x, y, selected, onClick }) {
  const Icon = adminBlueprintIcon(node.type);
  return (
    <button type="button" className={`admin-blueprint-node ${selected ? "selected" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onClick(node)}>
      <span className="admin-blueprint-node-shadow" />
      <span className="admin-blueprint-node-face">
        <span className="admin-blueprint-node-top"><Icon size={16} /><i /></span>
        <strong>{node.name}</strong>
        <small>{node.type}</small>
      </span>
      <span className="admin-blueprint-node-side" />
      <span className="admin-blueprint-node-pulse" />
    </button>
  );
}

function AdminBlueprintScene({ rootId, selectedNode, onNodeClick, query = "", layer = "ALL", focusMode = false, zoom = 1, onZoomIn, onZoomOut, onReset, onToggleFocus }) {
  const root = adminBlueprintNode(rootId);
  const children = (root.children || []).map(adminBlueprintNode);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filtered = children.filter((node) => {
    const matchesQuery = !normalizedQuery || `${node.name} ${node.type} ${node.id}`.toLowerCase().includes(normalizedQuery);
    const matchesLayer = layer === "ALL" || String(node.type || "").toUpperCase().includes(layer);
    return matchesQuery && matchesLayer;
  });
  const visible = filtered.slice(0, 8);
  const positions = [[14,50],[31,22],[31,78],[50,13],[50,87],[69,22],[69,78],[86,50]];
  const centerX = 50, centerY = 50;

  return (
    <div className={`admin-blueprint-scene glass-architecture ${focusMode ? "focus-mode" : ""}`}>
      <div className="admin-blueprint-stars" />
      <div className="admin-blueprint-grid" />
      <div className="admin-blueprint-vignette" />
      <div className="admin-glass-ambient ambient-a" />
      <div className="admin-glass-ambient ambient-b" />
      <div className="admin-blueprint-label"><span>INTERACTIVE SYSTEM ARCHITECTURE</span><strong>{root.name}</strong></div>
      <div className="admin-blueprint-code">CC / ARCH-01<br /><b>LIVE TOPOLOGY</b></div>

      <div className="admin-blueprint-canvas" style={{ transform: `scale(${zoom})` }}>
        <svg className="admin-blueprint-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visible.map((child, index) => {
            const [x, y] = positions[index];
            return <g key={child.id} className={selectedNode?.id && selectedNode.id !== child.id ? "connection-dim" : ""}>
              <path className="admin-glass-connection" d={`M ${centerX} ${centerY} C ${centerX} ${centerY}, ${x} ${y}, ${x} ${y}`} />
              <circle className="admin-glass-packet" cx={centerX} cy={centerY} r="0.7"><animate attributeName="cx" values={`${centerX};${x};${centerX}`} dur="4.5s" begin={`${index * .35}s`} repeatCount="indefinite" /><animate attributeName="cy" values={`${centerY};${y};${centerY}`} dur="4.5s" begin={`${index * .35}s`} repeatCount="indefinite" /></circle>
            </g>;
          })}
        </svg>

        <div className="admin-glass-core">
          <div className="admin-glass-core-backdrop" />
          <div className="admin-glass-core-logo"><span /><span /><span /></div>
          <strong>{root.name}</strong>
          <small>{root.type}</small>
          <span className="admin-glass-status"><i /> {root.status}</span>
        </div>

        {visible.map((child, index) => {
          const [x, y] = positions[index];
          return <AdminBlueprintNode key={child.id} node={child} x={x} y={y} selected={selectedNode?.id === child.id} onClick={onNodeClick} />;
        })}
      </div>

      {selectedNode && <aside className="admin-blueprint-side-inspector">
        <button type="button" className="admin-blueprint-side-close" onClick={() => onNodeClick(null)}>×</button>
        <span className="admin-kicker">MODULE INSPECTOR</span>
        <h4>{selectedNode.name}</h4>
        <small>{selectedNode.type}</small>
        <div className="admin-blueprint-side-status"><i /> {selectedNode.status || "ONLINE"}</div>
        <p>{selectedNode.description || "CampusCode system component."}</p>
        <div className="admin-blueprint-side-meta"><span>CHILD MODULES <b>{(selectedNode.children || []).length}</b></span><span>NODE ID <b>{selectedNode.id}</b></span></div>
        {(selectedNode.children || []).length > 0 && <button type="button" className="admin-blueprint-side-open" onClick={() => onNodeClick(selectedNode, true)}>OPEN ARCHITECTURE →</button>}
      </aside>}

      {!visible.length && <div className="admin-blueprint-no-match">NO MATCHING MODULES</div>}

      <div className="admin-blueprint-glass-controls">
        <button type="button" onClick={onZoomOut} title="Zoom out"><ZoomOut size={14} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} title="Zoom in"><ZoomIn size={14} /></button>
        <button type="button" onClick={onReset} title="Reset view"><RefreshCw size={13} /></button>
        <button type="button" onClick={onToggleFocus} title="Focus mode"><Maximize2 size={13} /></button>
      </div>

      <div className="admin-blueprint-legend"><span><i className="live" /> LIVE</span><span><i className="flow" /> SYSTEM FLOW</span><span><i className="node" /> CLICK MODULE</span></div>
      <div className="admin-blueprint-mini-map"><span>MAP</span><div className="mini-map-core" />{visible.slice(0, 6).map((node, index) => <i key={node.id} style={{ left: `${20 + (index % 3) * 28}%`, top: `${25 + Math.floor(index / 3) * 42}%` }} />)}</div>
      <div className="admin-blueprint-help">Hover a module to inspect it · click to open architecture</div>
    </div>
  );
}

function BlueprintNodeModal({ node, details, onClose, onEnter }) {
  if (!node) return null;
  const Icon = adminBlueprintIcon(node.type);
  const detail = details || node;
  const children = (node.children || []).map(adminBlueprintNode);

  return (
    <div className="admin-blueprint-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="admin-blueprint-modal" role="dialog" aria-modal="true">
        <button type="button" className="admin-blueprint-modal-close" onClick={onClose}><X size={17} /></button>
        <div className="admin-blueprint-modal-head">
          <div className="admin-blueprint-modal-icon"><Icon size={24} /></div>
          <div><span>NODE INSPECTOR / ARCHITECTURE</span><h2>{node.name}</h2><small>{node.type} · {node.status}</small></div>
        </div>

        <div className="admin-blueprint-modal-status"><i /> SYSTEM {String(node.status).toUpperCase()}</div>

        <div className="admin-blueprint-modal-section"><span>DESCRIPTION</span><p>{node.description}</p><p className="detail">{node.details}</p></div>

        <div className="admin-blueprint-modal-grid">
          <div><span>NODE ID</span><strong>{node.id}</strong></div>
          <div><span>TYPE</span><strong>{node.type}</strong></div>
          <div><span>STATUS</span><strong>{node.status}</strong></div>
          <div><span>CHILD MODULES</span><strong>{children.length}</strong></div>
        </div>

        {children.length > 0 && <div className="admin-blueprint-modal-section"><span>CONNECTED MODULES</span><div className="admin-blueprint-child-list">{children.map(child => <button key={child.id} type="button" onClick={() => onEnter(child)}><b>{child.name}</b><small>{child.type}</small><ChevronRight size={14} /></button>)}</div></div>}

        <div className="admin-blueprint-modal-section"><span>LIVE BACKEND DETAILS</span><pre>{JSON.stringify(detail, null, 2)}</pre></div>

        <div className="admin-blueprint-modal-actions">
          {children.length > 0 && <button type="button" className="primary" onClick={() => onEnter(node)}><Network size={14} /> OPEN {node.name} BLUEPRINT</button>}
          <button type="button" className="secondary" onClick={onClose}>CLOSE</button>
        </div>
      </section>
    </div>
  );
}

function SystemBlueprintPage() {
  const [blueprint, setBlueprint] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [rootId, setRootId] = useState("campuscode");
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState("ALL");
  const [focusMode, setFocusMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      apiFetch("/monitoring/health"),
      apiFetch("/monitoring/stats"),
    ]);

    const [h, s] = results;
    setBlueprint(ADMIN_BLUEPRINT);

    if (h.status === "fulfilled") {
      setHealth(h.value);
    } else {
      setError(h.reason?.message || "Unable to load monitoring health.");
    }

    if (s.status === "fulfilled") {
      setStats(
        s.value?.statistics ||
        s.value?.stats ||
        s.value?.data ||
        s.value ||
        {}
      );
    } else if (h.status === "rejected") {
      setError(s.reason?.message || "Unable to load monitoring statistics.");
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!focusMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedNode(null);
        setNodeDetails(null);
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [focusMode]);

  const openNode = async (node, enter = false) => {
    if (!node) { setSelectedNode(null); setNodeDetails(null); return; }
    if (enter && node.children?.length) { enterBlueprint(node); return; }
    setSelectedNode(node);
    setNodeDetails(null);
    setError("");

    const monitoringRoutes = {
      "monitoring": "/monitoring/stats",
      "monitoring-requests": "/monitoring/requests?limit=50",
      "monitoring-errors": "/monitoring/errors?limit=50",
      "monitoring-health": "/monitoring/health",
      "monitoring-activity": "/monitoring/requests?limit=50",
    };

    const endpoint = monitoringRoutes[node.id];
    if (!endpoint) {
      setNodeDetails(node);
      return;
    }

    try {
      const result = await apiFetch(endpoint);
      setNodeDetails({
        ...node,
        live_backend: result,
      });
    } catch (e) {
      setNodeDetails({
        ...node,
        live_backend_error: e.message || "Unable to load live monitoring data.",
      });
    }
  };
  const enterBlueprint = (node) => {
    if (node.children?.length) { setRootId(node.id); setSelectedNode(null); setNodeDetails(null); setQuery(""); setZoom(1); }
    else openNode(node);
  };
  const goBack = () => {
    if (rootId === "campuscode") return;
    const parentId = findBlueprintParentId(rootId);
    setRootId(parentId); setSelectedNode(null); setNodeDetails(null); setQuery(""); setZoom(1);
  };
  const refreshMonitoring = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const [healthResult, statsResult] = await Promise.all([
        apiFetch("/monitoring/health"),
        apiFetch("/monitoring/stats"),
      ]);
      setHealth(healthResult);
      setStats(
        statsResult?.statistics ||
        statsResult?.stats ||
        statsResult?.data ||
        statsResult ||
        {}
      );
      setSuccess("Monitoring data refreshed from the live backend.");
    } catch (e) {
      setError(e.message || "Unable to refresh monitoring data.");
    } finally {
      setBusy(false);
    }
  };

  const root = adminBlueprintNode(rootId);
  const statsObject = stats || {};
  const healthStatus = String(health?.system?.status || health?.status || health?.overall || "ONLINE").toUpperCase();
  const mergedDetails = nodeDetails || selectedNode;
  const layerOptions = ["ALL", "APPLICATION", "BACKEND", "DATABASE", "AI", "MONITORING"];

  if (loading) return <Loading />;

  if (focusMode) {
    return (
      <div className="admin-blueprint-fullscreen" role="dialog" aria-modal="true" aria-label="CampusCode full screen system blueprint">
        <button
          type="button"
          className="admin-blueprint-fullscreen-back"
          onClick={() => {
            setSelectedNode(null);
            setNodeDetails(null);
            setFocusMode(false);
          }}
        >
          <ArrowLeft size={16} />
          BACK
        </button>

        <AdminBlueprintScene
          rootId={rootId}
          selectedNode={null}
          onNodeClick={() => {}}
          query={query}
          layer={layer}
          focusMode
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(1.25, Number((z + .1).toFixed(2))))}
          onZoomOut={() => setZoom((z) => Math.max(.8, Number((z - .1).toFixed(2))))}
          onReset={() => setZoom(1)}
          onToggleFocus={() => setFocusMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="admin-system-blueprint-page">
      <PageTitle
        eyebrow="SYSTEM / ARCHITECTURE"
        title={<>CampusCode <span>system architecture.</span></>}
        description="Explore the platform as a realistic glass architecture. Search modules, focus system layers and inspect connected services without leaving Admin."
        action={<button className="admin-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button>}
      />

      {error && <ErrorBox message={error} />}
      {success && <div className="admin-success"><CheckCircle2 size={16} />{success}</div>}

      <div className="admin-blueprint-stats">
        <StatCard icon={Users} label="Users" number={statsObject?.total_users ?? statsObject?.users ?? "—"} detail="Platform users" />
        <StatCard icon={Trophy} label="Hackathons" number={statsObject?.total_hackathons ?? statsObject?.hackathons ?? "—"} detail="Registered events" tone="purple" />
        <StatCard icon={FileCheck2} label="Submissions" number={statsObject?.total_submissions ?? statsObject?.submissions ?? "—"} detail="Recorded submissions" tone="cyan" />
        <StatCard icon={Server} label="System" number={healthStatus} detail={value(health?.database, "Database unknown")} tone="amber" />
      </div>

      <section className="admin-blueprint-card">
        <div className="admin-blueprint-toolbar">
          <div><span className="admin-kicker">3D GLASS ARCHITECTURE</span><h3>{root.name}</h3><p>{root.description}</p></div>
          <div className="admin-blueprint-toolbar-actions">
            {rootId !== "campuscode" && <button type="button" className="admin-blueprint-back" onClick={goBack}><ArrowLeft size={14} /> BACK</button>}
            <div className="admin-blueprint-breadcrumb"><button type="button" onClick={() => { setRootId("campuscode"); setSelectedNode(null); setNodeDetails(null); setQuery(""); }}>CAMPUSCODE</button>{rootId !== "campuscode" && <><ChevronRight size={13} /><span>{root.name}</span></>}</div>
          </div>
        </div>

        <div className="admin-blueprint-ui-toolbar">
          <div className="admin-blueprint-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules..." /></div>
          <div className="admin-blueprint-layers">{layerOptions.map((item) => <button key={item} type="button" className={layer === item ? "active" : ""} onClick={() => setLayer(item)}>{item}</button>)}</div>
        </div>

        <AdminBlueprintScene
          rootId={rootId}
          selectedNode={selectedNode}
          onNodeClick={openNode}
          query={query}
          layer={layer}
          focusMode={focusMode}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(1.25, Number((z + .1).toFixed(2))))}
          onZoomOut={() => setZoom((z) => Math.max(.8, Number((z - .1).toFixed(2))))}
          onReset={() => setZoom(1)}
          onToggleFocus={() => {
            setSelectedNode(null);
            setNodeDetails(null);
            setFocusMode((x) => !x);
          }}
        />

        <div className="admin-blueprint-path"><span>PATH</span><b>CAMPUSCODE</b><ChevronRight size={12} /> <b>{root.name}</b>{selectedNode && <><ChevronRight size={12} /><b>{selectedNode.name}</b></>}</div>
      </section>

      <div className="admin-blueprint-bottom-grid">
        <section className="admin-panel-card">
          <div className="admin-card-head"><div><span className="admin-kicker">MODULE INSPECTOR</span><h3>{mergedDetails?.name || "Select a module"}</h3></div><Network size={18} /></div>
          {mergedDetails ? <div className="admin-blueprint-inspector">
            <div className="admin-blueprint-inspector-row"><span>TYPE</span><strong>{mergedDetails.type}</strong></div>
            <div className="admin-blueprint-inspector-row"><span>STATUS</span><strong>{mergedDetails.status || "ONLINE"}</strong></div>
            <div className="admin-blueprint-inspector-row"><span>DESCRIPTION</span><strong>{mergedDetails.description || "CampusCode system component."}</strong></div>
            <div className="admin-blueprint-inspector-row"><span>CHILD MODULES</span><strong>{(mergedDetails.children || []).length}</strong></div>
            {(mergedDetails.children || []).length > 0 && <button className="event-action neutral" onClick={() => enterBlueprint(mergedDetails)}>OPEN ARCHITECTURE →</button>}
          </div> : <Empty title="NO MODULE SELECTED" text="Click a glass module above to inspect its connections and details." />}
        </section>

        <section className="admin-panel-card">
          <div className="admin-card-head"><div><span className="admin-kicker">SYSTEM CONTROL</span><h3>Platform controls</h3></div><Settings size={18} /></div>
          <p className="approval-description">Existing system controls remain available without changing the backend architecture.</p>
          <div className="admin-list-row"><div className="admin-row-main"><strong>SYSTEM LIVE</strong><span>Monitoring health and request telemetry are read directly from the live backend.</span></div><span className="admin-live-indicator">ONLINE</span></div>
          <div className="admin-list-row"><div className="admin-row-main"><strong>TELEMETRY</strong><span>Use System Activity and the Monitoring modules above to inspect recorded requests and errors.</span></div><span className="admin-control-note">READ ONLY</span></div>
        </section>
      </div>

      {selectedNode && <BlueprintNodeModal node={selectedNode} details={nodeDetails} onClose={() => { setSelectedNode(null); setNodeDetails(null); }} onEnter={enterBlueprint} />}
    </div>
  );
}

function ProfilePage({ user }) {
  const displayName = user?.name || user?.full_name || "CampusCode Admin";
  const email = user?.email || "—";
  const role = user?.role || "ADMIN";
  const userId = user?.id || user?.user_id || "—";
  const initials = String(displayName)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "A";

  return (
    <section className="admin-profile-page">
      <PageTitle
        eyebrow="ACCOUNT / PROFILE"
        title={<>Admin <span>profile.</span></>}
        description="Review the account currently signed in to the CampusCode Admin workspace."
      />

      <div className="profile-layout">
        <section className="profile-identity">
          <div className="profile-big-avatar">{initials}</div>
          <h3>{displayName}</h3>
          <p>{email}</p>

          <div className="profile-id">
            ACCOUNT ROLE
            <strong>{String(role).toUpperCase()}</strong>
          </div>

          <div className="profile-id">
            ACCOUNT ID
            <strong>{String(userId)}</strong>
          </div>
        </section>

        <section className="profile-form">
          <div className="admin-card-head">
            <div>
              <span className="admin-kicker">ACCOUNT INFORMATION</span>
              <h3>Administrator details</h3>
            </div>
            <UserCircle size={18} />
          </div>

          <div className="field-grid">
            <label>
              NAME
              <input value={displayName} readOnly />
            </label>

            <label>
              EMAIL
              <input value={email} readOnly />
            </label>

            <label>
              ROLE
              <input value={String(role).toUpperCase()} readOnly />
            </label>

            <label>
              ACCOUNT ID
              <input value={String(userId)} readOnly />
            </label>
          </div>

          <label>
            ACCESS
            <textarea
              value="Administrator access is controlled by the authenticated CampusCode role."
              readOnly
              rows={4}
            />
          </label>
        </section>
      </div>
    </section>
  );
}

function VersionControlPage() {
  const versions = [
    { id: "v1", title: "v1", label: "FOUNDATION", status: "RELEASED", features: ["CampusCode product foundation", "React + Vite frontend setup", "Node.js + Express API foundation", "PostgreSQL database foundation", "Authentication and JWT flow", "Role-based Student / Organizer / Admin access", "Initial hackathon creation and discovery", "Core student registration flow"] },
    { id: "v2", title: "v2", label: "CORE HACKATHON PLATFORM", status: "RELEASED", features: ["Student workspace", "Organizer workspace", "Admin workspace", "Hackathon registration management", "Team creation and membership", "Hackathon-scoped team workflows", "Project management", "Notifications foundation"] },
    { id: "v3", title: "v3", label: "COMPETITION FLOW", status: "RELEASED", features: ["Round 1 problem statement workflow", "Round 2 project submission", "Round 3 final submission", "Round access and locking", "Organizer decisions and feedback", "Results publication", "Leaderboard", "Submission tracking"] },
    { id: "v4", title: "v4", label: "AI INTEGRATION", status: "RELEASED", features: ["IdeaCheck AI", "RuleBot AI", "HackMate AI", "AI-assisted Round 1 analysis", "AI-assisted Round 2 analysis", "Gemini integration", "AI feedback and recommendations", "Student intelligence workflows"] },
    { id: "v5", title: "v5", label: "PLATFORM HARDENING", status: "RELEASED", features: ["Admin management improvements", "Approvals and evaluations", "Result approval workflow", "Notification improvements", "Hackathon completion history", "Completed stamps and round states", "UI and responsive refinements", "Deployment and workflow hardening"] },
    { id: "v6", title: "v6", label: "CURRENT PLATFORM", status: "CURRENT", features: ["Integrated CampusCode platform", "System Activity", "Interactive System Blueprint", "Version Control", "Advanced Admin controls", "Student Guide and FAQ", "Official communication surface", "Round 1 participant agreement popup", "Hackathon-scoped My Team selector", "HackMate teammate intelligence", "Readable Student and Admin UI", "Current production experience"] },
    { id: "v7", title: "v7", label: "UPCOMING", status: "UPCOMING", features: ["Advanced analytics", "Expanded platform intelligence", "Additional AI assistance", "System observability improvements", "Further UX refinement"] },
    { id: "v8", title: "v8", label: "FINAL RELEASE", status: "FINAL", features: ["Final product polish", "Production readiness", "Complete CampusCode ecosystem", "Long-term stability and maintainability"] },
  ];
  const [selected, setSelected] = useState("v6");
  const [versionModal, setVersionModal] = useState(null);
  const current = versions.find((item) => item.id === selected) || versions[5];
  return (
    <section className="admin-version-page">
      <PageTitle eyebrow="SYSTEM / VERSION CONTROL" title={<>Product <span>versions.</span></>} description="Track the evolution of CampusCode from v1 through the current v6, upcoming v7 and final v8." />
      <div className="admin-version-top-grid">
        <div className="admin-version-current">
          <span className="admin-kicker">CURRENT VERSION</span>
          <div className="admin-version-number">v6</div>
          <div className="admin-version-current-title">CURRENT PLATFORM</div>
          <p>v6 is the current CampusCode platform version.</p>
          <div className="admin-version-status"><i /> LIVE / CURRENT</div>
        </div>
        <div className="admin-version-summary-grid">
          <div><strong>6</strong><span>Released</span></div>
          <div><strong>2</strong><span>Upcoming</span></div>
          <div><strong>v6</strong><span>Current</span></div>
          <div><strong>v8</strong><span>Final</span></div>
        </div>
      </div>

      <div className="admin-version-timeline-card">
        <div className="admin-card-head"><div><span className="admin-kicker">RELEASE TIMELINE</span><h3>CampusCode evolution</h3></div><History size={18} /></div>
        <div className="admin-version-timeline">
          <div className="admin-version-line" />
          {versions.map((item) => (
            <button key={item.id} type="button" className={`admin-version-node ${item.status.toLowerCase()} ${selected === item.id ? "active" : ""}`} onClick={() => { setSelected(item.id); setVersionModal(item); }}>
              <span className="admin-version-dot" />
              <strong>{item.title}</strong>
              <small>{item.status}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-version-details-grid">
        <section className="admin-panel-card admin-version-detail-card">
          <span className={`admin-version-badge ${current.status.toLowerCase()}`}>{current.status}</span>
          <div className="admin-version-detail-head"><div><strong>{current.title}</strong><span>{current.label}</span></div><GitBranch size={25} /></div>
          <p>This version represents a defined stage in the CampusCode product lifecycle. The feature list is presented as the product roadmap record and does not change the live backend.</p>
          <div className="admin-version-feature-list">{current.features.map((feature) => <div key={feature}><CheckCircle2 size={15} /><span>{feature}</span></div>)}</div><button type="button" className="event-action neutral admin-version-open" onClick={() => setVersionModal(current)}>VIEW FULL VERSION →</button>
        </section>
        <section className="admin-panel-card">
          <div className="admin-card-head"><div><span className="admin-kicker">ROADMAP</span><h3>What comes next</h3></div><Zap size={18} /></div>
          <div className="admin-version-roadmap-row"><span>v7</span><div><strong>UPCOMING</strong><p>Next platform iteration and further product improvements.</p></div></div>
          <div className="admin-version-roadmap-row"><span>v8</span><div><strong>FINAL</strong><p>Final planned CampusCode release and production polish.</p></div></div>
        </section>
      </div>
      {versionModal && <div className="admin-version-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setVersionModal(null); }}>
        <section className="admin-version-modal" role="dialog" aria-modal="true">
          <button className="admin-version-modal-close" onClick={() => setVersionModal(null)}><X size={18}/></button>
          <span className={`admin-version-badge ${versionModal.status.toLowerCase()}`}>{versionModal.status}</span>
          <div className="admin-version-modal-version">{versionModal.title}</div>
          <h2>{versionModal.label}</h2>
          <p>Everything recorded for this CampusCode version is shown below.</p>
          <div className="admin-version-modal-features">{versionModal.features.map((feature,index)=><div key={feature}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{feature}</strong><p>Implemented as part of the {versionModal.label.toLowerCase()} stage of CampusCode.</p></div><CheckCircle2 size={18}/></div>)}</div>
          <div className="admin-version-modal-actions"><button className="event-action neutral" onClick={() => setVersionModal(null)}><ArrowLeft size={14}/> BACK TO VERSIONS</button></div>
        </section>
      </div>}
    </section>
  );
}

/* =========================================================
   ADMIN PANEL
========================================================= */

export default function AdminPanel({
  section = "dashboard",
  navigate,
  sidebarOpen,
  setSidebarOpen,
  user,
  onLogout,
}) {
  const go = (next) => {
    navigate?.(next);
    setSidebarOpen?.(false);
  };

  return (
    <div className="admin-app">
      <div className="admin-bg-grid" />
      <div className="admin-bg-glow one" />
      <div className="admin-bg-glow two" />

      {sidebarOpen && (
        <div
          className="admin-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar
        section={section}
        navigate={go}
        open={sidebarOpen}
        user={user}
        onLogout={onLogout}
      />

      <div className="admin-main">
        <AdminTopbar
          onMenu={() => setSidebarOpen?.(true)}
          user={user}
          section={section}
        />

        <main className="admin-content">
          {section === "dashboard" && (
            <Dashboard onNavigate={go} />
          )}

          {section === "ai" && <AIAnalysisPage />}

          {section === "notifications" && (
            <NotificationsPage />
          )}

          {section === "hackathons" && (
            <HackathonsPage />
          )}

          {section === "approvals" && (
            <ApprovalsPage />
          )}

          {section === "users" && <UsersPage />}

          {section === "teams" && <TeamsPage />}

          {section === "submissions" && (
            <SubmissionsPage />
          )}

          {section === "evaluations" && (
            <EvaluationsPage />
          )}

          {section === "results" && <ResultsPage />}

          {section === "activity" && (
            <ActivityPage />
          )}

          {section === "system" && (
            <SystemBlueprintPage />
          )}

          {section === "version" && (
            <VersionControlPage />
          )}

          {section === "profile" && (
            <ProfilePage user={user} />
          )}

          {![
            "dashboard",
            "ai",
            "notifications",
            "hackathons",
            "approvals",
            "users",
            "teams",
            "submissions",
            "evaluations",
            "results",
            "activity",
            "system",
            "version",
            "profile",
          ].includes(section) && (
            <Dashboard onNavigate={go} />
          )}
        </main>
      </div>
    </div>
  );
}
