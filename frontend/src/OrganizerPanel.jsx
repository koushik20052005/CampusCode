import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Code2,
  Edit3,
  FolderGit2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Save,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trophy,
  UserCircle,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./OrganizerPanel.css";
import { useLiveNotifications, NotificationToasts } from "./notifications";
import CampusCodeLoader from "./components/ui/CampusCodeLoader";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("campuscode_token") ||
  "";

const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("campuscode_token");
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
};

const arr = (data, ...keys) => {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return Array.isArray(data) ? data : [];
};

const dateText = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const statusClass = (status = "") =>
  String(status).toUpperCase().replace(/\s+/g, "-");

const COMPLETED_STATUSES = new Set([
  "COMPLETED",
  "COMPLETE",
  "FINISHED",
  "CLOSED",
  "ARCHIVED",
]);

const isCompletedStatus = (status) =>
  COMPLETED_STATUSES.has(String(status || "").trim().toUpperCase());

const dedupeHackathons = (items = []) => {
  const map = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || item?.hackathon_id || "");
    if (!id) continue;

    const existing = map.get(id);
    map.set(
      id,
      existing
        ? { ...existing, ...item }
        : item
    );
  }

  return [...map.values()];
};

const isHackathonCompleted = (hackathon) =>
  isCompletedStatus(hackathon?.status) ||
  Number(hackathon?.current_round) === 4 ||
  Boolean(hackathon?.completed_at || hackathon?.completedAt);

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["hackathons", "My Hackathons", Trophy],
  ["create", "Create Hackathon", Plus],
  ["quiz", "Quiz Builder", CheckCircle2],
  ["quiz-manager", "Quiz Manager", ClipboardCheck],
  ["rounds", "Rounds & Schedule", Clock3],
  ["participants", "Participants", Users],
  ["teams", "Teams", Users],
  ["submissions", "Submissions", Send],
  ["rulebot", "RuleBot", Sparkles],
  ["leaderboard", "Leaderboard", Trophy],
  ["certificates", "Certificates", Award],
  ["result-request", "Result Approval", AlertCircle],
  ["notifications", "Notifications", Bell],
  ["profile", "Profile", UserCircle],
];

function OrganizerPanel({
  section = "dashboard",
  navigate,
  sidebarOpen,
  setSidebarOpen,
  user,
  onLogout,
}) {
  const [dashboard, setDashboard] = useState(null);
  const [hackathons, setHackathons] = useState([]);
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem("campuscode_org_hackathon") || "";
    } catch {
      return "";
    }
  });
  // v6.9.5: persist organizer hackathon selection across reloads
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem("campuscode_org_hackathon", selectedId);
    } catch {}
  }, [selectedId]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { unread, toasts, clearBadge, dismissToast } = useLiveNotifications();

  const go = (next) => {
    setMessage("");
    setError("");
    navigate?.(next);
    setSidebarOpen?.(false);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/dashboard/organizer");
      const list = dedupeHackathons(arr(data, "hackathons", "events", "data"));
      setDashboard(data);
      setHackathons(list);
      setSelectedId((current) => {
        if (current && list.some((h) => String(h.id) === String(current))) {
          return current;
        }
        return String(list[0]?.id || "");
      });
    } catch (e) {
      setDashboard(null);
      setHackathons([]);
      setError(e.message || "Failed to load organizer data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refreshOrganizer = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      window.setTimeout(() => setRefreshing(false), 850);
    }
  };

  const selected =
    hackathons.find((h) => String(h.id) === String(selectedId)) ||
    hackathons[0] ||
    null;

  const stats = dashboard?.stats || {};

  // Quiz Manager (v6.22, extended v6.23): a selected quiz has no
  // rounds, teams, round submissions or round results — bounce the
  // organizer to Quiz Manager instead of leaving them on a dead
  // section. Certificates is quiz-aware since v6.26, so it stays.
  useEffect(() => {
    if (selected?.event_type === "quiz" && ["rounds", "teams", "submissions", "result-request", "leaderboard"].includes(section)) {
      navigate("quiz-manager");
    }
  }, [selected?.event_type, section]);

  const run = async (fn, success) => {
    setError("");
    setMessage("");
    try {
      await fn();
      if (success) setMessage(success);
      await load();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
  };

  return (
    <div className="organizer-page">
      <div className="org-bg">
        <span className="org-orb orb-one" />
        <span className="org-orb orb-two" />
        <span className="org-grid" />
      </div>

      {sidebarOpen && (
        <button
          className="org-mobile-backdrop"
          onClick={() => setSidebarOpen?.(false)}
          aria-label="Close menu"
        />
      )}

      <OrganizerSidebar
        section={section}
        navigate={go}
        open={sidebarOpen}
        onClose={() => setSidebarOpen?.(false)}
        user={user}
        onLogout={onLogout}
        selectedEventType={selected?.event_type}
      />

      <div className="organizer-main">
        <OrganizerTopbar
          user={user}
          onMenu={() => setSidebarOpen?.(true)}
          onLogout={onLogout}
          unread={unread}
          onNotifications={() => { clearBadge(); go("notifications"); }}
          onRefresh={refreshOrganizer}
          refreshing={refreshing}
        />
        <NotificationToasts toasts={toasts} onDismiss={dismissToast} />

        <main className="organizer-content">
          <OrganizerHero
            section={section}
            user={user}
            onCreate={() => go("create")}
          />

          {error && (
            <AlertBox type="error" message={error} onClose={() => setError("")} />
          )}
          {message && (
            <AlertBox
              type="success"
              message={message}
              onClose={() => setMessage("")}
            />
          )}

          <div className="org-view" key={workspaceId ? "workspace" : section}>
          {workspaceId ? (
            <Workspace
              hackathon={hackathons.find(
                (h) => String(h.id) === String(workspaceId)
              )}
              onBack={() => setWorkspaceId("")}
              onNavigate={go}
            />
          ) : (
            <>
              {section === "dashboard" && (
                <Dashboard
                  user={user}
                  stats={stats}
                  current={dashboard?.current_hackathon || selected}
                  hackathons={hackathons}
                  onRefresh={load}
                  onNavigate={go}
                />
              )}

              {section === "hackathons" && (
                <Hackathons
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  onRefresh={load}
                  onCreate={() => go("create")}
                  onOpenWorkspace={(id) => setWorkspaceId(String(id))}
                  onEdit={() => go("create")}
                  onRun={run}
                />
              )}

              {section === "create" && (
                <CreateHackathon
                  onCancel={() => go("hackathons")}
                  onCreate={async (form) => {
                    await apiFetch("/hackathons", {
                      method: "POST",
                      body: JSON.stringify(form),
                    });
                    await load();
                    go("hackathons");
                    setMessage("Hackathon created as a draft.");
                  }}
                />
              )}

              {section === "quiz" && (
                <QuizBuilder hackathons={hackathons} />
              )}

              {section === "quiz-manager" && (
                <QuizManager hackathons={hackathons} onRefresh={load} />
              )}

              {section === "rounds" && selected?.event_type !== "quiz" && (
                <Rounds
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  onRefresh={load}
                  onGoLive={() => status(selected?.id, "LIVE")}
                />
              )}

              {section === "participants" && (
                <Participants
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "teams" && selected?.event_type !== "quiz" && (
                <Teams
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "submissions" && selected?.event_type !== "quiz" && (
                <OrganizerSubmissions
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "rulebot" && (
                <RuleBot
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "leaderboard" && (
                <Leaderboard
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "certificates" && (
                <Certificates
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "result-request" && (
                <ResultRequest
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "notifications" && <Notifications />}

              {section === "profile" && <Profile user={user} />}
            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

function OrganizerSidebar({ section, navigate, open, onClose, user, onLogout, selectedEventType }) {
  return (
    <aside className={`org-sidebar ${open ? "is-open" : ""}`}>
      {/* v6.28 — small arrow on the drawer edge: one tap closes it on mobile */}
      <button className="org-sidebar-close" onClick={onClose} aria-label="Close sidebar">‹</button>
      <div className="org-brand-row">
        <button className="org-brand" onClick={() => navigate("dashboard")}>
          {/* v6.13.1 — logo matches the loading animation: #f4f7fb, #10b981, #10b981 */}
          <svg
            className="org-logo-svg"
            viewBox="0 0 48 48"
            aria-label="CampusCode"
            role="img"
          >
            <g transform="skewX(-14)">
              <rect x="8" y="11" width="9" height="26" fill="#94a3b8" />
              <rect x="20" y="11" width="9" height="26" fill="#10b981" />
              <rect x="32" y="11" width="9" height="26" fill="#10b981" />
            </g>
          </svg>
          <span>
            <strong>
              Campus<span>Code</span>
            </strong>
            <small>Organizer Console</small>
          </span>
        </button>
        <button className="org-close-mobile" onClick={() => navigate(section)}>
          <X size={18} />
        </button>
      </div>

      <div className="org-user-card">
        <div className="org-avatar">
          {(user?.name || "Organizer").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <b>{user?.name || "Organizer"}</b>
          <span>{user?.role || "ORGANIZER"}</span>
        </div>
      </div>

      <div className="org-nav-scroll">
        <p className="org-nav-label">Workspace</p>
        {NAV.filter(([key]) => {
          // A selected quiz has no hackathon flows: hide Rounds,
          // Teams, round Submissions, Result Approval and the round
          // Leaderboard; Quiz Manager covers quiz results and
          // Certificates is quiz-aware since v6.26, so it stays.
          if (selectedEventType !== "quiz") return true;
          return !["rounds", "teams", "submissions", "result-request", "leaderboard"].includes(key);
        }).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => navigate(key)}
            className={`org-nav-item ${section === key ? "active" : ""}`}
          >
            <span className="org-nav-icon">
              <Icon size={16} />
            </span>
            <span>{label}</span>
            {section === key && <ChevronRight size={13} className="nav-arrow" />}
          </button>
        ))}
      </div>

      <div className="org-sidebar-bottom">
        <button onClick={onLogout} className="org-signout">
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function OrganizerTopbar({ user, onMenu, onLogout, onNotifications, onRefresh, refreshing, unread }) {
  const initials = (user?.name || "User")
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="org-topbar">
      <button className="org-menu" onClick={onMenu}>
        <Menu size={19} />
      </button>
      <div className="org-breadcrumb">
        <span>ORGANIZER</span>
        <b>/</b>
        <em>Event Operations</em>
      </div>

      <div className="org-top-actions">
        <div className="org-search">
          <Search size={14} />
          <span>Search workspace...</span>
        </div>
        <button className="org-top-icon" onClick={onNotifications} title="Notifications" aria-label="Notifications" style={{ position: "relative" }}>
          <Bell size={17} />
          {unread > 0 && <b className="notif-badge">{unread > 9 ? "9+" : unread}</b>}
        </button>
        <button
          className={`org-refresh-button ${refreshing ? "refreshing" : ""}`}
          onClick={onRefresh}
          disabled={refreshing}
          title={refreshing ? "Refreshing" : "Refresh organizer data"}
          aria-label={refreshing ? "Refreshing organizer data" : "Refresh organizer data"}
        >
          <RefreshCw size={16} />
        </button>
        <div className="org-profile-chip">
          <div className="org-mini-avatar">{initials}</div>
          <div className="org-profile-name">
            <b>{user?.name || "Organizer"}</b>
            <span>{user?.role || "ORGANIZER"}</span>
          </div>
          <button onClick={onLogout} className="org-profile-logout" title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}

function OrganizerHero({ section, user, onCreate }) {
  const titles = {
    dashboard: ["Organizer workspace", "Build the next hackathon."],
    hackathons: ["Hackathon operations", "Control every event from one place."],
    create: ["Event operations", "Create a clean hackathon draft."],
    rounds: ["Round control", "Run your competition manually."],
    participants: ["Participants", "See who registered for your events."],
    teams: ["Teams", "Track team formation and status."],
    projects: ["Projects", "Explore what teams are building."],
    submissions: ["Submissions", "Review every round from one workspace."],
    rulebot: ["RuleBot", "Ask the hackathon rules before making a decision."],
    leaderboard: ["Leaderboard", "Read the backend-generated ranking."],
    "result-request": ["Result approval", "Send publication requests to Admin."],
    notifications: ["Notification center", "Keep participants and teams informed."],
    profile: ["Organizer profile", "Keep your CampusCode identity current."],
  };

  const [eyebrow, title] = titles[section] || titles.dashboard;

  return (
    <section className="org-hero">
      <div className="hero-scan" />
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <span className="pulse-dot" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>
          {user?.name
            ? `Welcome back, ${user.name}.`
            : "Manage your hackathon operations from one workspace."}
        </p>
      </div>
      <button className="hero-create" onClick={onCreate}>
        <Plus size={15} />
        Create hackathon
      </button>
    </section>
  );
}

function Panel({ eyebrow, title, description, action, children }) {
  return (
    <section className="org-panel reveal-up">
      <div className="panel-head">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function AlertBox({ type, message, onClose }) {
  return (
    <div className={`org-alert ${type}`}>
      {type === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
      <span>{message}</span>
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

function Picker({ hackathons, selectedId, setSelectedId }) {
  const uniqueHackathons = dedupeHackathons(hackathons);

  return (
    <select
      className="org-select compact"
      value={selectedId}
      onChange={(e) => setSelectedId(e.target.value)}
    >
      {!uniqueHackathons.length && <option value="">No hackathons</option>}
      {uniqueHackathons.map((h) => {
        const id = h.id || h.hackathon_id || h.hackathon?.id;
        const title = h.title || h.name || h.hackathon?.title || h.hackathon_name || `Hackathon ${id}`;
        return (
          <option key={id} value={id}>
            {title}
          </option>
        );
      })}
    </select>
  );
}

function Empty({ text }) {
  return (
    <div className="org-empty">
      <div className="empty-orbit">
        <Code2 size={22} />
      </div>
      <b>{text}</b>
    </div>
  );
}

function Loading() {
  return (
    <div className="org-loading campuscode-panel-loader">
      <CampusCodeLoader fullScreen={false} text="Loading" subtext="Syncing live data" />
    </div>
  );
}

function Dashboard({ user, stats, current, hackathons, onRefresh, onNavigate }) {
  const cards = [
    ["Hackathons", stats.hackathons ?? hackathons.length ?? 0, Trophy],
    ["Participants", stats.participants ?? 0, Users],
    ["Teams", stats.teams ?? 0, Users],
    ["Submissions", stats.submissions ?? 0, Send],
  ];

  return (
    <div className="org-stack">
      <div className="dashboard-intro reveal-up">
        <div>
          <span>LIVE CONTROL PLANE</span>
          <h2>Everything important, one pulse.</h2>
          <p>
            Create events, manage rounds, inspect teams, review submissions and
            request result publication.
          </p>
        </div>
        <button className="ghost-btn" onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="metric-grid">
        {cards.map(([label, value, Icon], index) => (
          <div className="metric-card reveal-up" style={{ "--delay": `${index * 70}ms` }} key={label}>
            <div className="metric-icon"><Icon size={17} /></div>
            <span>{label}</span>
            <strong>{value}</strong>
            <i />
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <Panel
          eyebrow="Current event"
          title={current?.title || "No active hackathon"}
          description={current ? "Your selected event is ready for operations." : "Create your first hackathon to begin."}
          action={
            current && (
              <button className="outline-btn" onClick={() => onNavigate(current?.event_type === "quiz" ? "quiz-manager" : "rounds")}>
                {current?.event_type === "quiz" ? "Manage quiz" : "Manage rounds"} <ArrowRight size={13} />
              </button>
            )
          }
        >
          {current ? (
            <div className="current-event">
              <div>
                <span className={`status-pill ${statusClass(current.status)}`}>
                  {current.status || "DRAFT"}
                </span>
                <h3>{current.track || "Open innovation"}</h3>
                <p>{current.description || "No description available."}</p>
              </div>
              <div className="event-facts">
                <div><b>{current.max_teams ?? "—"}</b><span>Max teams</span></div>
                <div><b>{current.current_round ?? 1}</b><span>Current round</span></div>
                <div><b>{dateText(current.expected_date || current.start_date)}</b><span>Expected date</span></div>
              </div>
            </div>
          ) : (
            <Empty text="No current hackathon found." />
          )}
        </Panel>

        <Panel eyebrow="Quick actions" title="Move fast" description="Jump directly into the most common organizer workflows.">
          <div className="quick-grid">
            {[
              ["Create", "create", Plus],
              ["Rounds", "rounds", Clock3],
              ["Participants", "participants", Users],
              ["Submissions", "submissions", Send],
              ["Leaderboard", "leaderboard", Trophy],
              ["Notifications", "notifications", Bell],
            ].map(([label, key, Icon]) => (
              <button key={key} onClick={() => onNavigate(key)} className="quick-card">
                <Icon size={17} />
                <span>{label}</span>
                <ArrowRight size={12} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Hackathons({
  hackathons,
  selectedId,
  setSelectedId,
  onRefresh,
  onCreate,
  onOpenWorkspace,
  onEdit,
  onRun,
}) {
  const [busy, setBusy] = useState("");

  /* v6.18 — banner system: per-event banner editor state */
  const [bannerOpenId, setBannerOpenId] = useState(null);
  const [bannerWeb, setBannerWeb] = useState("");
  const [bannerMobile, setBannerMobile] = useState("");
  const [bannerMsg, setBannerMsg] = useState("");
  /* v6.21 — date editor: change start/end on an existing event */
  const [datesOpenId, setDatesOpenId] = useState(null);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [datesMsg, setDatesMsg] = useState("");
  const [justPublished, setJustPublished] = useState("");

  const openBannerEditor = (h) => {
    setBannerOpenId(h.id);
    setBannerWeb(h.banner_web_url || "");
    setBannerMobile(h.banner_mobile_url || "");
    setBannerMsg("");
  };

  const saveBanner = async (h) => {
    setBannerMsg("");
    await action(`banner-${h.id}`, async () => {
      try {
        await apiFetch(`/hackathons/${h.id}/banner`, {
          method: "PATCH",
          body: JSON.stringify({
            banner_web_url: bannerWeb.trim(),
            banner_mobile_url: bannerMobile.trim(),
          }),
        });
        setBannerMsg("Banners saved.");
        await onRefresh();
      } catch (e) {
        setBannerMsg(e.message || "Could not save banners.");
      }
    });
  };

  /* v6.21 — stored ISO -> input value (IST wall-clock for quizzes). */
  const toDateInput = (value, isQuizEvent) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    if (!isQuizEvent) return d.toISOString().slice(0, 10);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 16);
  };
  const toISTStamp = (v) => {
    if (!v) return null;
    return v.length === 16 ? `${v}:00+05:30` : `${v}+05:30`;
  };

  const openDatesEditor = (h) => {
    const isQuizEvent = h.event_type === "quiz";
    setDatesOpenId(h.id);
    setDateStart(toDateInput(h.start_date || h.expected_date, isQuizEvent));
    setDateEnd(toDateInput(h.end_date, isQuizEvent));
    setDatesMsg("");
  };

  const saveDates = async (h) => {
    setDatesMsg("");
    await action(`dates-${h.id}`, async () => {
      try {
        const isQuizEvent = h.event_type === "quiz";
        await apiFetch(`/hackathons/${h.id}/dates`, {
          method: "PATCH",
          body: JSON.stringify({
            start_date: isQuizEvent ? toISTStamp(dateStart) : (dateStart || null),
            end_date: isQuizEvent ? toISTStamp(dateEnd) : (dateEnd || null),
          }),
        });
        setDatesMsg("Dates saved.");
        await onRefresh();
      } catch (e) {
        setDatesMsg(e.message || "Could not save dates.");
      }
    });
  };

  const action = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  };

  const submitApproval = (id) =>
    onRun(
      () => apiFetch(`/hackathons/${id}/submit-approval`, { method: "POST" }),
      "Hackathon submitted to Admin for approval."
    );

  const publish = (id) => {
    setJustPublished(String(id));
    setTimeout(() => setJustPublished(""), 3000);
    return onRun(
      () => apiFetch(`/hackathons/${id}/publish`, { method: "POST" }),
      "Hackathon published. Registration is now open."
    );
  };

  const status = (id, value) => {
    const target = hackathons.find((h) => String(h.id) === String(id));

    if (isHackathonCompleted(target)) {
      return onRun(
        async () => {
          throw new Error("This hackathon is completed and can no longer be moved to another status.");
        },
        null
      );
    }

    return onRun(
      () =>
        apiFetch(`/hackathons/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: value }),
        }),
      `Hackathon status changed to ${value}.`
    );
  };

  const remove = async (h) => {
    if (!window.confirm(`Delete "${h.title}"?\n\nThis action cannot be undone.`)) return;
    await action(`delete-${h.id}`, () =>
      onRun(
        () => apiFetch(`/hackathons/${h.id}`, { method: "DELETE" }),
        "Hackathon deleted successfully."
      )
    );
    await onRefresh();
  };

  return (
    <Panel
      eyebrow="Events"
      title="My Hackathons"
      description="Your backend-backed hackathon lifecycle: draft → approval → publish → LIVE."
      action={<button className="primary-btn" onClick={onCreate}><Plus size={14}/> Create</button>}
    >
      {!hackathons.length ? (
        <Empty text="No hackathons yet. Create your first draft." />
      ) : (
        <div className="hackathon-list">
          {hackathons.map((h, index) => {
            const approval = String(h.approval_status || "NOT_SUBMITTED").toUpperCase();
            const publication = String(h.publication_status || "UNPUBLISHED").toUpperCase();
            const state = String(h.status || "DRAFT").toUpperCase();
            return (
              <article className={`hack-card ${String(selectedId) === String(h.id) ? "selected" : ""} ${justPublished === String(h.id) ? "publish-celebrate" : ""}`} key={h.id} style={{ "--delay": `${index * 55}ms` }}>
                {justPublished === String(h.id) && (<><span className="publish-rings"><i /><i /><i /></span><span className="publish-live-chip">● OPEN FOR REGISTRATION</span></>)}
                <div className="hack-accent" />
                <div className="hack-main">
                  <div className="hack-title-row">
                    <h3>{h.title}</h3>
                    {h.event_type === "quiz" && <span className="status-pill">QUIZ</span>}
                    {(h.banner_web_url || h.banner_mobile_url) && <span className="status-pill">BANNER SET</span>}
                    <span className={`status-pill ${statusClass(state)}`}>{state}</span>
                  </div>
                  <p className="hack-meta">{h.track || "No track"} · {h.location || "Online"}</p>
                  <p className="hack-description">{h.description || "No description."}</p>

                  <div className="hack-tags">
                    <span>Expected {dateText(h.expected_date || h.start_date)}</span>
                    <span>{h.event_type === "quiz" ? `Max participants ${h.settings?.max_participants ?? h.max_teams ?? "—"}` : `Max teams ${h.max_teams ?? "—"}`}</span>
                    <span>Approval {approval}</span>
                    <span>Publication {publication}</span>
                  </div>

                  <div className="hack-actions">
                    <button className="primary-btn small" onClick={() => onOpenWorkspace?.(h.id)}>
                      <ArrowRight size={13}/> Open workspace
                    </button>

                    {["DRAFT"].includes(state) && (
                      <button className="outline-btn small" onClick={() => onEdit(h)}>
                        <Edit3 size={13}/> Edit
                      </button>
                    )}

                    <button className="outline-btn small" onClick={() => openBannerEditor(h)}>
                      Banners
                    </button>

                    <button className="outline-btn small" onClick={() => openDatesEditor(h)}>
                      Dates
                    </button>

                    {approval !== "PENDING" && approval !== "APPROVED" && publication !== "PUBLISHED" && (
                      <button className="green-btn small" disabled={busy === `approval-${h.id}`} onClick={() => action(`approval-${h.id}`, () => submitApproval(h.id))}>
                        {busy === `approval-${h.id}` ? <LoaderCircle size={13} className="spin"/> : <Send size={13}/>} Submit approval
                      </button>
                    )}

                    {approval === "APPROVED" && publication !== "PUBLISHED" && (
                      <button className="primary-btn small" disabled={busy === `publish-${h.id}`} onClick={() => action(`publish-${h.id}`, () => publish(h.id))}>
                        <Zap size={13}/> Publish
                      </button>
                    )}

                    {publication === "PUBLISHED" && state === "OPEN" && (
                      <>
                        <button className="live-btn small" onClick={() => status(h.id, "LIVE")}><Zap size={13}/> Go LIVE</button>
                        <button className="outline-btn small" onClick={() => status(h.id, "PAUSED")}>Pause</button>
                      </>
                    )}

                    {publication === "PUBLISHED" && state === "PAUSED" && (
                      <button className="primary-btn small" onClick={() => status(h.id, "OPEN")}>Re-open</button>
                    )}

                    {["DRAFT", "CANCELLED"].includes(state) && (
                      <button className="danger-btn small" disabled={busy === `delete-${h.id}`} onClick={() => remove(h)}>
                        <X size={13}/> Delete
                      </button>
                    )}
                  </div>

                  {String(bannerOpenId) === String(h.id) && (
                    <div className="hack-banner-editor">
                      <label>WEB BANNER (DESKTOP) — IMAGE URL</label>
                      <input
                        type="url"
                        value={bannerWeb}
                        onChange={(e) => setBannerWeb(e.target.value)}
                        placeholder="https://…/banner-desktop.png"
                      />
                      {bannerWeb.trim() && (
                        <img className="hack-banner-preview" src={bannerWeb.trim()} alt="Web banner preview" loading="lazy" />
                      )}
                      <label>MOBILE BANNER — IMAGE URL</label>
                      <input
                        type="url"
                        value={bannerMobile}
                        onChange={(e) => setBannerMobile(e.target.value)}
                        placeholder="https://…/banner-mobile.png"
                      />
                      {bannerMobile.trim() && (
                        <img className="hack-banner-preview" src={bannerMobile.trim()} alt="Mobile banner preview" loading="lazy" />
                      )}
                      <p className="hack-banner-note">Seen by every role — students, organizers and admins — wherever this event appears. Leave a field empty to clear that banner. Works in any state, even on live events.</p>
                      {bannerMsg && <p className="hack-banner-msg">{bannerMsg}</p>}
                      <div className="hack-banner-actions">
                        <button className="primary-btn small" disabled={busy === `banner-${h.id}`} onClick={() => saveBanner(h)}>
                          {busy === `banner-${h.id}` ? <LoaderCircle size={13} className="spin"/> : null} Save banners
                        </button>
                        <button className="outline-btn small" onClick={() => setBannerOpenId(null)}>Close</button>
                      </div>
                    </div>
                  )}

                  {String(datesOpenId) === String(h.id) && (
                    <div className="hack-banner-editor">
                      <label>{h.event_type === "quiz" ? "QUIZ START (IST)" : "START DATE"}</label>
                      <input
                        type={h.event_type === "quiz" ? "datetime-local" : "date"}
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                      />
                      <label>{h.event_type === "quiz" ? "QUIZ END (IST)" : "END DATE"}</label>
                      <input
                        type={h.event_type === "quiz" ? "datetime-local" : "date"}
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                      />
                      <p className="hack-banner-note">Changes the quiz window (or event dates) without recreating the event. Blocked while the event is live. Leave a field empty to clear that date.</p>
                      {datesMsg && <p className="hack-banner-msg">{datesMsg}</p>}
                      <div className="hack-banner-actions">
                        <button className="primary-btn small" disabled={busy === `dates-${h.id}`} onClick={() => saveDates(h)}>
                          {busy === `dates-${h.id}` ? <LoaderCircle size={13} className="spin"/> : null} Save dates
                        </button>
                        <button className="outline-btn small" onClick={() => setDatesOpenId(null)}>Close</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="hack-stats">
                  <div><b>{h.participant_count ?? 0}</b><span>Participants</span></div>
                  <div><b>{h.team_count ?? 0}</b><span>Teams</span></div>
                  <div><b>{h.submission_count ?? 0}</b><span>Submissions</span></div>
                  <div><b>{h.current_round ?? 1}</b><span>Round</span></div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function CreateHackathon({ onCancel, onCreate }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    track: "AI / ML",
    location: "",
    expected_date: "",
    max_teams: "10",
    // v6.17 — quiz events
    event_type: "hackathon",
    duration_minutes: "30",
    negative_marks: "0",
    max_participants: "100",
    quiz_start: "",
    quiz_end: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((x) => ({ ...x, [key]: value }));
  const isQuiz = form.event_type === "quiz";

  // v6.20 — datetime-local values are wall-clock IST: attach the
  // +05:30 offset so Postgres stores the exact IST window.
  const toIST = (v) => {
    if (!v) return null;
    return v.length === 16 ? `${v}:00+05:30` : `${v}+05:30`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.description.trim() || !form.track.trim()) {
      setError("Title, description and track are required.");
      return;
    }

    if (isQuiz) {
      const duration = Number(form.duration_minutes);
      const cap = Number(form.max_participants);
      const negative = Number(form.negative_marks);
      if (!Number.isInteger(duration) || duration < 1) {
        setError("Quiz duration must be at least 1 minute.");
        return;
      }
      if (!Number.isInteger(cap) || cap < 1) {
        setError("Maximum participants must be at least 1.");
        return;
      }
      if (!Number.isFinite(negative) || negative < 0) {
        setError("Negative marking cannot be below 0.");
        return;
      }
      if (form.quiz_start && form.quiz_end && form.quiz_end <= form.quiz_start) {
        setError("Quiz end time must be after the quiz start time.");
        return;
      }
    } else {
      const maxTeams = Number(form.max_teams);
      if (!Number.isInteger(maxTeams) || maxTeams < 1) {
        setError("Maximum teams must be at least 1.");
        return;
      }
    }

    setSaving(true);
    try {
      if (isQuiz) {
        await onCreate({
          title: form.title.trim(),
          description: form.description.trim(),
          track: form.track.trim(),
          location: form.location.trim(),
          expected_date: toIST(form.quiz_start) || form.expected_date || null,
          end_date: toIST(form.quiz_end),
          event_type: "quiz",
          max_teams: Number(form.max_participants),
          settings: {
            duration_minutes: Number(form.duration_minutes),
            negative_marks: Number(form.negative_marks),
            max_participants: Number(form.max_participants),
          },
        });
      } else {
        await onCreate({
          title: form.title.trim(),
          description: form.description.trim(),
          track: form.track.trim(),
          location: form.location.trim(),
          expected_date: form.expected_date || null,
          max_teams: Number(form.max_teams),
        });
      }
    } catch (err) {
      setError(err.message || "Failed to create hackathon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      eyebrow="Event operations"
      title={isQuiz ? "Create quiz" : "Create hackathon"}
      description={
        isQuiz
          ? "Create a quiz draft first, add questions in Quiz Builder, then submit for admin approval. Set the start and end times (IST) for a strict quiz window. Questions lock once the quiz is published."
          : "Create a draft first. The expected date is informational; publication and round activation stay manual."
      }
      action={<button className="outline-btn" onClick={onCancel}>Back</button>}
    >
      <form className="org-form" onSubmit={submit}>
        <Field label="Event type" required>
          <select className="org-input" value={form.event_type} onChange={(e) => update("event_type", e.target.value)}>
            <option value="hackathon">Hackathon</option>
            <option value="quiz">Quiz</option>
          </select>
        </Field>
        <Field label={isQuiz ? "Quiz title" : "Hackathon title"} required>
          <input className="org-input" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder={isQuiz ? "e.g. FirstCommit '26 — Tech Quiz" : "e.g. Campus Innovation Challenge"} />
        </Field>
        <Field label="Location">
          <input className="org-input" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Online / Chennai / Campus" />
        </Field>
        <Field label="Track" required>
          <select className="org-input" value={form.track} onChange={(e) => update("track", e.target.value)}>
            <option>AI / ML</option>
            <option>Open Innovation</option>
            <option>Web Development</option>
            <option>FinTech</option>
            <option>Climate Tech</option>
            <option>Cybersecurity</option>
            <option>Mobile App Development</option>
            <option>Data Science</option>
          </select>
        </Field>
        {isQuiz ? (
          <>
            <Field label="Maximum participants" required>
              <input className="org-input" type="number" min="1" step="1" value={form.max_participants} onChange={(e) => update("max_participants", e.target.value)} />
            </Field>
            <Field label="Duration (minutes)" required>
              <input className="org-input" type="number" min="1" step="1" value={form.duration_minutes} onChange={(e) => update("duration_minutes", e.target.value)} />
            </Field>
            <Field label="Negative marks per wrong answer">
              <input className="org-input" type="number" min="0" step="0.25" value={form.negative_marks} onChange={(e) => update("negative_marks", e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Maximum teams" required>
            <input className="org-input" type="number" min="1" step="1" value={form.max_teams} onChange={(e) => update("max_teams", e.target.value)} />
          </Field>
        )}
        {isQuiz ? (
          <>
            <Field label="Quiz start (IST)">
              <input className="org-input" type="datetime-local" value={form.quiz_start} onChange={(e) => update("quiz_start", e.target.value)} />
            </Field>
            <Field label="Quiz end (IST)">
              <input className="org-input" type="datetime-local" value={form.quiz_end} onChange={(e) => update("quiz_end", e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Expected date">
            <input className="org-input" type="date" value={form.expected_date} onChange={(e) => update("expected_date", e.target.value)} />
          </Field>
        )}
        <Field label="Description" required full>
          <textarea className="org-input textarea" rows={7} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder={isQuiz ? "Explain the quiz, syllabus, eligibility and rules..." : "Explain the hackathon, challenge, eligibility and what participants should build..."} />
        </Field>

        {error && <div className="form-error">{error}</div>}

        <div className="form-footer">
          <div>
            <b>Draft workflow</b>
            <span>{isQuiz ? "Create → Add questions in Quiz Builder → Submit approval → Publish → Go LIVE." : "Create → Submit approval → Publish → Go LIVE → activate R1/R2/R3 manually."}</span>
          </div>
          <button className="primary-btn" disabled={saving}>
            {saving ? <><LoaderCircle size={14} className="spin" /> Creating...</> : <><Plus size={14} /> Create draft</>}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function Field({ label, required, full, children }) {
  return (
    <label className={`org-field ${full ? "full" : ""}`}>
      <span>{label}{required && <em>*</em>}</span>
      {children}
    </label>
  );
}

/* =========================================================
   v6.17 — QUIZ BUILDER (organizer question bank)
   Questions are editable only while the quiz is NOT
   published — the backend enforces the same lock.
========================================================= */
function QuizBuilder({ hackathons, forceQuizId }) {
  const quizzes = (hackathons || []).filter((h) => h.event_type === "quiz");
  const [quizId, setQuizId] = useState("");
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [qForm, setQForm] = useState({
    question_text: "",
    question_type: "MCQ",
    options: ["", "", "", ""],
    correct_index: 0,
    marks: 1,
  });

  const selected = forceQuizId
    ? quizzes.find((q) => String(q.id) === String(forceQuizId)) || quizzes[0] || null
    : quizzes.find((q) => String(q.id) === String(quizId)) || quizzes[0] || null;
  const effectiveId = selected?.id || "";
  const locked = selected?.publication_status === "PUBLISHED";

  const load = async (id) => {
    if (!id) { setQuestions([]); return; }
    setLoading(true); setError("");
    try {
      const data = await apiFetch(`/quizzes/${id}/questions`);
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    apiFetch(`/quizzes/${effectiveId}/questions`)
      .then((data) => { if (!cancelled) setQuestions(Array.isArray(data?.questions) ? data.questions : []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load questions."); });
    return () => { cancelled = true; };
  }, [effectiveId]);

  const resetForm = () => {
    setEditingId(null);
    setQForm({ question_text: "", question_type: "MCQ", options: ["", "", "", ""], correct_index: 0, marks: 1 });
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setQForm({
      question_text: q.question_text || "",
      question_type: q.question_type || "MCQ",
      options: q.question_type === "TRUE_FALSE" ? ["True", "False"] : [...(q.options || []), "", "", "", ""].slice(0, 6),
      correct_index: Number(q.correct_index) || 0,
      marks: Number(q.marks) || 1,
    });
    setMessage("");
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    if (!effectiveId) return;
    if (!qForm.question_text.trim()) { setError("Question text is required."); return; }
    const options = qForm.question_type === "TRUE_FALSE"
      ? ["True", "False"]
      : qForm.options.map((o) => o.trim()).filter(Boolean);
    if (qForm.question_type === "MCQ" && options.length < 2) {
      setError("MCQ questions need at least 2 options.");
      return;
    }
    if (qForm.correct_index < 0 || qForm.correct_index >= options.length) {
      setError("Pick the correct option.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        question_text: qForm.question_text.trim(),
        question_type: qForm.question_type,
        options,
        correct_index: Number(qForm.correct_index),
        marks: Number(qForm.marks) || 1,
      };
      if (editingId) {
        await apiFetch(`/quizzes/${effectiveId}/questions/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Question updated.");
      } else {
        await apiFetch(`/quizzes/${effectiveId}/questions`, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Question added.");
      }
      resetForm();
      await load(effectiveId);
    } catch (err) {
      setError(err.message || "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    setError(""); setMessage("");
    try {
      await apiFetch(`/quizzes/${effectiveId}/questions/${id}`, { method: "DELETE" });
      setMessage("Question deleted.");
      await load(effectiveId);
    } catch (err) {
      setError(err.message || "Failed to delete question.");
    }
  };

  const totalMarks = (questions || []).reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  return (
    <Panel
      eyebrow="Event operations"
      title="Quiz Builder"
      description="Build the question bank for a quiz event. MCQ single-correct and True/False only — both auto-scored."
    >
      {!quizzes.length ? (
        <Empty text="No quiz events yet. Create an event with type Quiz first." />
      ) : (
        <>
          {!forceQuizId && (
            <Field label="Quiz event">
              <select className="org-input" value={effectiveId} onChange={(e) => setQuizId(e.target.value)}>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title} · {String(q.publication_status || "").toUpperCase()}</option>
                ))}
              </select>
            </Field>
          )}

          {locked && (
            <div className="form-error">Questions are locked — this quiz is already published. Unpublishing is not supported in v1; create a new quiz draft for changes.</div>
          )}
          {selected && (
            <p className="hack-meta">
              {(questions?.length ?? 0)} questions · {totalMarks} total marks · {Number(selected.settings?.duration_minutes) || 30} minutes
              {Number(selected.settings?.negative_marks) ? ` · −${selected.settings.negative_marks} per wrong answer` : " · no negative marking"}
            </p>
          )}

          {!locked && (
            <form className="org-form" onSubmit={submitQuestion}>
              <Field label="Question type" required>
                <select className="org-input" value={qForm.question_type} onChange={(e) => setQForm((x) => ({ ...x, question_type: e.target.value, correct_index: 0, options: e.target.value === "TRUE_FALSE" ? ["True", "False"] : ["", "", "", ""] }))}>
                  <option value="MCQ">MCQ (single correct)</option>
                  <option value="TRUE_FALSE">True / False</option>
                </select>
              </Field>
              <Field label="Question" required full>
                <textarea className="org-input textarea" rows={3} value={qForm.question_text} onChange={(e) => setQForm((x) => ({ ...x, question_text: e.target.value }))} placeholder="Type the question..." />
              </Field>
              {qForm.question_type === "MCQ" && qForm.options.map((opt, i) => (
                <Field key={i} label={`Option ${i + 1}`}>
                  <input className="org-input" value={opt} onChange={(e) => setQForm((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? e.target.value : o)) }))} placeholder={`Option ${i + 1}`} />
                </Field>
              ))}
              {qForm.question_type === "MCQ" && (
                <div className="form-footer">
                  <button type="button" className="outline-btn small" disabled={qForm.options.length >= 6} onClick={() => setQForm((x) => ({ ...x, options: [...x.options, ""] }))}>+ Add option</button>
                  <button type="button" className="outline-btn small" disabled={qForm.options.length <= 2} onClick={() => setQForm((x) => ({ ...x, options: x.options.slice(0, -1), correct_index: Math.min(x.correct_index, x.options.length - 2) }))}>− Remove last</button>
                </div>
              )}
              <Field label="Correct option" required>
                <select className="org-input" value={qForm.correct_index} onChange={(e) => setQForm((x) => ({ ...x, correct_index: Number(e.target.value) }))}>
                  {(qForm.question_type === "TRUE_FALSE" ? ["True", "False"] : qForm.options.map((o, i) => o.trim() || `Option ${i + 1}`)).map((label, i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Marks" required>
                <input className="org-input" type="number" min="1" step="1" value={qForm.marks} onChange={(e) => setQForm((x) => ({ ...x, marks: e.target.value }))} />
              </Field>
              <div className="form-footer">
                <div><b>{editingId ? "Editing question" : "New question"}</b><span>{editingId ? "Save overwrites the stored question." : "Questions save in order; they appear to students in this order."}</span></div>
                <span style={{ display: "flex", gap: 8 }}>
                  {editingId && <button type="button" className="outline-btn" onClick={resetForm}>Cancel edit</button>}
                  <button className="primary-btn" disabled={saving}>{saving ? "Saving..." : editingId ? "Save question" : "Add question"}</button>
                </span>
              </div>
            </form>
          )}

          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          {questions === null && !error && <p className="hack-meta">Loading questions...</p>}
          {loading && <p className="hack-meta">Loading questions...</p>}

          {(questions || []).map((q, i) => (
            <article className="hack-card" key={q.id}>
              <div className="hack-main">
                <div className="hack-title-row">
                  <h3>Q{i + 1}. {q.question_text}</h3>
                  <span className="status-pill">{q.question_type} · {q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                </div>
                <p className="hack-meta">
                  {(q.options || []).map((o, j) => `${j === Number(q.correct_index) ? "✓ " : ""}${o}`).join("  |  ")}
                </p>
                {!locked && (
                  <div className="hack-actions">
                    <button className="outline-btn small" onClick={() => startEdit(q)}><Edit3 size={13} /> Edit</button>
                    <button className="outline-btn small" onClick={() => removeQuestion(q.id)}><X size={13} /> Delete</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </>
      )}
    </Panel>
  );
}

function QuizManager({ hackathons, onRefresh }) {
  const quizzes = (hackathons || []).filter((h) => h.event_type === "quiz");
  const [quizId, setQuizId] = useState("");
  const [tab, setTab] = useState("controls");
  const [subs, setSubs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCount, setShowCount] = useState(10);
  const [checked, setChecked] = useState({});

  const selected = quizzes.find((q) => String(q.id) === String(quizId)) || quizzes[0] || null;
  const effectiveId = selected?.id || "";
  const published = selected?.publication_status === "PUBLISHED";
  const approval = selected?.approval_status;
  const status = selected?.status;

  const loadSubs = async (id) => {
    if (!id) { setSubs([]); return; }
    setLoading(true); setError("");
    try {
      const data = await apiFetch(`/quizzes/${id}/submissions`);
      setSubs(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (err) {
      setError(err.message || "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setChecked({}); }, [effectiveId]);
  useEffect(() => {
    if (tab === "submissions" && effectiveId) loadSubs(effectiveId);
  }, [tab, effectiveId]);

  const runAction = async (label, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await fn();
      setMessage(`${label} done.`);
      onRefresh?.();
    } catch (err) {
      setError(err.message || `${label} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const submitApproval = () => runAction("Submitted for approval", () =>
    apiFetch(`/hackathons/${effectiveId}/submit-approval`, { method: "POST" }));
  const publish = () => runAction("Published for registration", () =>
    apiFetch(`/hackathons/${effectiveId}/publish`, { method: "POST" }));
  const start = () => runAction("Quiz started", () =>
    apiFetch(`/hackathons/${effectiveId}/status`, { method: "PATCH", body: JSON.stringify({ status: "LIVE" }) }),
    "Start the quiz? Students will be able to begin their attempt.");
  const stop = () => runAction("Quiz stopped", () =>
    apiFetch(`/quizzes/${effectiveId}/stop`, { method: "POST" }),
    "Stop the quiz? All open attempts will be auto-scored and no new attempts can start.");

  const postSelected = async () => {
    const ids = Object.keys(checked).filter((id) => checked[id]);
    if (!ids.length) { setError("Select at least one student first."); return; }
    if (!window.confirm(`Post results for ${ids.length} student(s)? They will see their score right away.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await apiFetch(`/quizzes/${effectiveId}/post-results`, { method: "POST", body: JSON.stringify({ attemptIds: ids }) });
      setMessage(`Results posted for ${data?.posted_count ?? ids.length} student(s).`);
      setChecked({});
      await loadSubs(effectiveId);
    } catch (err) {
      setError(err.message || "Failed to post results.");
    } finally {
      setBusy(false);
    }
  };

  const all = subs || [];
  const shown = showCount === "all" ? all : all.slice(0, Number(showCount));
  const selectedCount = Object.keys(checked).filter((id) => checked[id]).length;
  const allShownChecked = shown.length > 0 && shown.every((s) => checked[s.id]);
  const toggleAllShown = () => {
    const next = { ...checked };
    if (allShownChecked) shown.forEach((s) => delete next[s.id]);
    else shown.forEach((s) => { next[s.id] = true; });
    setChecked(next);
  };
  const fmtWhen = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); } catch { return String(d); }
  };
  const phaseText = !published
    ? approval === "PENDING" ? "Waiting for admin approval." : approval === "APPROVED" ? "Approved — ready to publish for registration." : "Draft — submit for approval first."
    : status === "OPEN" ? "Open for registration — students can register but cannot start yet."
    : status === "LIVE" ? "Live — students are attempting now."
    : status === "COMPLETED" ? "Stopped — post results from Submissions & Results."
    : `Status: ${status || "—"}.`;

  return (
    <Panel
      eyebrow="Event operations"
      title="Quiz Manager"
      description="One place for a quiz: questions, lifecycle, submissions and results. No rounds — quizzes are solo, timed attempts."
    >
      {!quizzes.length ? (
        <Empty text="No quiz events yet. Create an event with type Quiz first." />
      ) : (
        <>
          <Field label="Quiz event">
            <select className="org-input" value={effectiveId} onChange={(e) => setQuizId(e.target.value)}>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>{q.title} · {String(q.publication_status || "").toUpperCase()} · {String(q.status || "").toUpperCase()}</option>
              ))}
            </select>
          </Field>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button className={tab === "controls" ? "primary-btn small" : "outline-btn small"} onClick={() => setTab("controls")}>Controls</button>
            <button className={tab === "questions" ? "primary-btn small" : "outline-btn small"} onClick={() => setTab("questions")}>Questions</button>
            <button className={tab === "submissions" ? "primary-btn small" : "outline-btn small"} onClick={() => setTab("submissions")}>Submissions & Results</button>
          </div>

          {error && <div className="form-error">{error}</div>}
          {message && <p className="hack-meta" style={{ color: "#3f6212" }}>{message}</p>}

          {tab === "controls" && selected && (
            <div>
              <p className="hack-meta">
                {phaseText}
                {selected.start_date && <> · Window: {fmtWhen(selected.start_date)}{selected.end_date ? ` → ${fmtWhen(selected.end_date)}` : ""}</>}
                {Number(selected.participant_count) > 0 && <> · {selected.participant_count} registered</>}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                {!published && approval !== "PENDING" && approval !== "APPROVED" && (
                  <button className="primary-btn" disabled={busy} onClick={submitApproval}>Submit for approval</button>
                )}
                {!published && approval === "APPROVED" && (
                  <button className="primary-btn" disabled={busy} onClick={publish}>Publish for registration</button>
                )}
                {published && status === "OPEN" && (
                  <button className="primary-btn" disabled={busy} onClick={start}>Start quiz</button>
                )}
                {published && status === "LIVE" && (
                  <button className="danger-btn small" disabled={busy} onClick={stop}>Stop quiz</button>
                )}
                {published && status === "COMPLETED" && (
                  <span className="hack-meta">Quiz stopped. Open Submissions & Results to post scores.</span>
                )}
              </div>
              <p className="hack-meta" style={{ marginTop: 12 }}>
                Publish opens registration only — students cannot attempt until you hit Start quiz.
                Results stay hidden until you post them, and a student sees only their score, never
                which answers were right or wrong.
              </p>
            </div>
          )}

          {tab === "questions" && (
            <QuizBuilder hackathons={hackathons} forceQuizId={effectiveId} />
          )}

          {tab === "submissions" && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <Field label="Show">
                  <select className="org-input" value={showCount} onChange={(e) => setShowCount(e.target.value === "all" ? "all" : Number(e.target.value))}>
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={50}>Top 50</option>
                    <option value="all">All</option>
                  </select>
                </Field>
                <span className="hack-meta">
                  {all.filter((s) => s.status === "SUBMITTED").length} submitted · {all.filter((s) => s.result_posted).length} results posted
                </span>
                <button className="outline-btn small" disabled={loading} onClick={() => loadSubs(effectiveId)}>Refresh</button>
              </div>
              {loading ? (
                <p className="hack-meta">Loading submissions…</p>
              ) : !all.length ? (
                <Empty text="No attempts yet. Students appear here once they start the quiz." />
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #e5e5e0" }}>
                    <input type="checkbox" checked={allShownChecked} onChange={toggleAllShown} />
                    <strong style={{ fontSize: 13 }}>Select all shown ({shown.length})</strong>
                  </div>
                  {shown.map((s) => (
                    <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid #eee" }}>
                      <input type="checkbox" style={{ marginTop: 4 }} checked={Boolean(checked[s.id])} disabled={s.status !== "SUBMITTED" || Boolean(s.result_posted)} onChange={(e) => setChecked((x) => ({ ...x, [s.id]: e.target.checked }))} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14 }}>{s.user_name}</strong>
                        <span className="hack-meta" style={{ display: "block" }}>{s.user_email} · {s.status === "SUBMITTED" ? `Submitted ${fmtWhen(s.submitted_at)}` : "Attempt in progress"}</span>
                        {(Number(s.fullscreen_exits) > 0 || Number(s.tab_switches) > 0) && (
                          <span className="hack-meta" style={{ display: "block", color: "#991b1b" }}>
                            Flags — fullscreen exits: {s.fullscreen_exits} · tab switches: {s.tab_switches}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: 14 }}>{s.score === null || s.score === undefined ? "—" : `${s.score} / ${s.total_marks}`}</strong>
                        <span className="hack-meta" style={{ display: "block" }}>{s.correct_count ?? "—"} / {s.question_count ?? "—"} correct</span>
                        {s.result_posted && <span className="hack-meta" style={{ display: "block", color: "#3f6212" }}>POSTED</span>}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
                    <button className="primary-btn" disabled={busy || selectedCount === 0 || status !== "COMPLETED"} onClick={postSelected}>
                      Post results for selected ({selectedCount})
                    </button>
                    {status !== "COMPLETED" && (
                      <span className="hack-meta">Stop the quiz first — results can only be posted after it ends.</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function Rounds({ hackathon, hackathons, selectedId, setSelectedId, onRefresh, onGoLive }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!hackathon?.id) {
      setRounds([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/hackathons/${hackathon.id}/rounds`);
      const fetched = arr(data, "rounds", "data");
      setRounds([1, 2, 3].map((n) =>
        fetched.find((r) => Number(r.round_number) === n) || {
          round_number: n,
          title: `Round ${n}`,
          status: "SCHEDULED",
        }
      ));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hackathon?.id]);

  // v6.9.5: derive from freshly-loaded rounds so the header never goes stale
  const liveRound = rounds.find(
    (r) => String(r.status || "").toUpperCase() === "LIVE"
  );
  const displayCurrentRound = liveRound
    ? liveRound.round_number
    : (hackathon?.current_round ?? 1);

  const save = async () => {
    if (!hackathon) return;
    setBusy("save");
    setError("");
    try {
      await apiFetch(`/hackathons/${hackathon.id}/rounds/schedule`, {
        method: "PUT",
        body: JSON.stringify({
          rounds: [1, 2, 3].map((n) => {
            const r = rounds.find((x) => Number(x.round_number) === n);
            return {
              round_number: n,
              title: r?.title?.trim() || `Round ${n}`,
              start_at: null,
              end_at: null,
            };
          }),
        }),
      });
      setMessage("Round configuration saved.");
      await load();
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const roundAction = async (number, action) => {
    setBusy(`${action}-${number}`);
    setError("");
    setMessage("");
    try {
      const endpoint = action === "activate"
        ? `/hackathons/${hackathon.id}/rounds/${number}/activate`
        : `/hackathons/${hackathon.id}/rounds/${number}/complete`;
      const data = await apiFetch(endpoint, { method: "POST" });
      setMessage(data?.message || `Round ${number} updated.`);
      await load();
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Panel
      eyebrow="Rounds"
      title="Rounds & manual control"
      description="Round activation is manual. Round 2 becomes available after Round 1 is completed, and Round 3 follows Round 2."
      action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId} />}
    >
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      {!hackathon ? <Empty text="Select a hackathon." /> : loading ? <Loading /> : (
        <>
          <div className="round-banner">
            <div>
              <span>MANUAL LIFECYCLE</span>
              <h3>{hackathon.title}</h3>
              <p>Status: {hackathon.status || "—"} · Current round: {displayCurrentRound}</p>
            </div>
            <span className={`status-pill ${statusClass(hackathon.status)}`}>{hackathon.status || "DRAFT"}</span>
          </div>

          <div className="round-grid">
            {hackathon && String(hackathon.status).toUpperCase() !== "LIVE" && (
              <div className="round-blocker">
                <span className="round-blocker-icon"><Zap size={16} /></span>
                <div className="round-blocker-copy">
                  <strong>Rounds are locked.</strong>
                  <p>
                    This hackathon is currently <b>{String(hackathon.status || "DRAFT").toUpperCase()}</b>.
                    It must be <b>LIVE</b> before Round 1 can be activated
                    {String(hackathon.publication_status || "").toUpperCase() !== "PUBLISHED" ? " (publish it first, then go live)" : ""}.
                  </p>
                </div>
                <button
                  type="button"
                  className="live-btn"
                  disabled={!!busy || !onGoLive}
                  onClick={() => onGoLive && onGoLive()}
                >
                  <Zap size={14} /> GO LIVE NOW
                </button>
              </div>
            )}
            {rounds.map((r) => {
              const n = Number(r.round_number);
              const st = String(r.status || "SCHEDULED").toUpperCase();
              const previous = rounds.find((x) => Number(x.round_number) === n - 1);
              const canActivate =
                hackathon.status === "LIVE" &&
                st !== "LIVE" &&
                st !== "COMPLETED" &&
                (n === 1 || String(previous?.status).toUpperCase() === "COMPLETED");
              const canComplete = st === "LIVE";

              return (
                <div className="round-card" key={n}>
                  <div className="round-card-top">
                    <div>
                      <span>ROUND {n}</span>
                      <input
                        value={r.title || ""}
                        disabled={st === "LIVE" || st === "COMPLETED"}
                        onChange={(e) => setRounds((current) => current.map((x) =>
                          Number(x.round_number) === n ? { ...x, title: e.target.value } : x
                        ))}
                      />
                    </div>
                    <span className={`status-pill ${statusClass(st)}`}>{st}</span>
                  </div>
                  <button className="live-btn wide" disabled={!canActivate || !!busy} onClick={() => roundAction(n, "activate")}>
                    {busy === `activate-${n}` ? <LoaderCircle className="spin" size={14}/> : <Zap size={14}/>}
                    Activate Round {n}
                  </button>
                  <button className="outline-btn wide" disabled={!canComplete || !!busy} onClick={() => roundAction(n, "complete")}>
                    {busy === `complete-${n}` ? <LoaderCircle className="spin" size={14}/> : <CheckCircle2 size={14}/>}
                    Complete Round {n}
                  </button>
                  <p>{n === 1 ? "Available when the hackathon is LIVE." : `Available after Round ${n - 1} is completed.`}</p>
                </div>
              );
            })}
          </div>

          <div className="round-save-row">
            <span>Save round names before operating the lifecycle.</span>
            <button className="primary-btn" disabled={!!busy || isHackathonCompleted(hackathon)} onClick={save}>
              {busy === "save" ? <LoaderCircle size={14} className="spin"/> : <Settings2 size={14}/>}
              Save configuration
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

function Participants({ hackathon, hackathons, selectedId, setSelectedId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hackathon) return setItems([]);
    setLoading(true);
    apiFetch(`/hackathons/${hackathon.id}/participants`)
      .then((d) => setItems(arr(d, "participants", "data")))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hackathon?.id]);

  return (
    <Panel eyebrow="Participants" title="Registered participants" description="Loaded from the selected hackathon." action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId}/>}>
      {error && <div className="form-error">{error}</div>}
      {loading ? <Loading /> : items.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Campus ID</th><th>Team</th></tr></thead>
            <tbody>{items.map((p, i) => (
              <tr key={p.id || p.user_id || i}>
                <td><b>{p.name || p.user_name || "—"}</b></td>
                <td>{p.email || "—"}</td>
                <td>{p.campus_code_id || p.campusCodeId || "—"}</td>
                <td>{p.team_name || p.team?.name || "Not assigned"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty text="No participants registered for this hackathon." />}
    </Panel>
  );
}

function Teams({ hackathon, hackathons, selectedId, setSelectedId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");

  useEffect(() => {
    if (!hackathon) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError("");
    apiFetch(`/hackathons/${hackathon.id}/teams`)
      .then((d) => setItems(arr(d, "teams", "data")))
      .catch((e) => setError(e.message || "Unable to load teams."))
      .finally(() => setLoading(false));
  }, [hackathon?.id]);

  const openTeam = async (team) => {
    const teamId = team?.id || team?.team_id;
    if (!teamId) {
      setSelectedTeam(team);
      return;
    }

    setSelectedTeam(team);
    setTeamLoading(true);
    setTeamError("");

    try {
      const data = await apiFetch(`/teams/${teamId}`);
      setSelectedTeam(data?.team || data?.data || data);
    } catch (e) {
      setTeamError(e.message || "Unable to load complete team details.");
    } finally {
      setTeamLoading(false);
    }
  };

  const closeTeam = () => {
    if (!teamLoading) {
      setSelectedTeam(null);
      setTeamError("");
    }
  };

  const members = Array.isArray(selectedTeam?.members)
    ? selectedTeam.members
    : [];

  return (
    <>
      <Panel
        eyebrow="Teams"
        title="Teams"
        description="Click any team to inspect its leader, members and current status."
        action={
          <Picker
            hackathons={hackathons}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        }
      >
        {error && <div className="form-error">{error}</div>}
        {loading ? (
          <Loading />
        ) : items.length ? (
          <div className="team-grid organizer-team-grid">
            {items.map((t, i) => (
              <button
                type="button"
                className="team-card organizer-team-card"
                key={t.id || t.team_id || i}
                onClick={() => openTeam(t)}
              >
                <div className="team-icon"><Users size={17} /></div>
                <div className="team-card-copy">
                  <h3>{t.name || `Team ${i + 1}`}</h3>
                  <p>{t.status || "BUILDING"}</p>
                </div>
                <strong>
                  {t.member_count ?? t.members?.length ?? 0}
                  <small> members</small>
                </strong>
                <ChevronRight size={16} className="team-card-arrow" />
              </button>
            ))}
          </div>
        ) : (
          <Empty text="No teams found." />
        )}
      </Panel>

      {selectedTeam && (
        <div className="organizer-team-modal-backdrop" onMouseDown={closeTeam}>
          <div
            className="organizer-team-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="organizer-team-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="organizer-team-modal-head">
              <div>
                <span>TEAM DETAILS</span>
                <h2 id="organizer-team-title">
                  {selectedTeam.name || selectedTeam.team_name || "Team"}
                </h2>
                <p>{hackathon?.title || "Selected hackathon"}</p>
              </div>
              <button className="organizer-modal-close" onClick={closeTeam} aria-label="Close team details">
                <X size={19} />
              </button>
            </div>

            {teamError && <div className="form-error">{teamError}</div>}

            {teamLoading ? (
              <Loading />
            ) : (
              <div className="organizer-team-modal-body">
                <div className="team-detail-stats">
                  <div>
                    <span>STATUS</span>
                    <b>{selectedTeam.status || "BUILDING"}</b>
                  </div>
                  <div>
                    <span>MEMBERS</span>
                    <b>{selectedTeam.member_count ?? members.length}</b>
                  </div>
                  <div>
                    <span>TEAM ID</span>
                    <b>{selectedTeam.id || selectedTeam.team_id || "—"}</b>
                  </div>
                </div>

                <div className="team-leader-card">
                  <span>TEAM LEADER</span>
                  <div className="team-member-avatar">
                    {(selectedTeam.leader?.name || selectedTeam.leader_name || "L").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <b>{selectedTeam.leader?.name || selectedTeam.leader_name || "Leader not available"}</b>
                    <p>{selectedTeam.leader?.email || selectedTeam.leader_email || ""}</p>
                  </div>
                </div>

                <div className="team-members-section">
                  <div className="team-section-heading">
                    <span>TEAM MEMBERS</span>
                    <b>{members.length}</b>
                  </div>

                  {members.length ? (
                    <div className="team-member-list">
                      {members.map((member, index) => (
                        <div className="team-member-row" key={member.id || member.user_id || index}>
                          <div className="team-member-avatar">
                            {(member.name || member.user_name || "M").slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <b>{member.name || member.user_name || "Member"}</b>
                            <p>{member.email || member.user_email || "Email not available"}</p>
                          </div>
                          <span>
                            {String(member.role || "MEMBER").toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="Member details are not available for this team." />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Projects({ hackathon, hackathons, selectedId, setSelectedId }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hackathon) return setTeams([]);
    setLoading(true);
    apiFetch(`/hackathons/${hackathon.id}/teams`)
      .then((d) => setTeams(arr(d, "teams", "data")))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hackathon?.id]);

  return (
    <Panel eyebrow="Projects" title="Projects" description="Project information exposed through the live team records." action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId}/>}>
      {error && <div className="form-error">{error}</div>}
      {loading ? <Loading /> : teams.length ? (
        <div className="project-grid">
          {teams.map((t, i) => {
            const project = t.project || t.projects?.[0] || t;
            return (
              <article className="project-card" key={t.id || i}>
                <div className="project-top"><FolderGit2 size={17}/><span>{t.status || "TEAM"}</span></div>
                <h3>{project.project_title || project.title || t.project_title || "Project workspace"}</h3>
                <p>{project.description || t.project_description || "Project details are available when the team has submitted them."}</p>
                <div><b>{t.name || "Team"}</b><span>{project.repository_url || project.repo_url || "Repository not provided"}</span></div>
              </article>
            );
          })}
        </div>
      ) : <Empty text="No projects found." />}
    </Panel>
  );
}


function OrganizerSubmissions({
  hackathon,
  hackathons,
  selectedId,
  setSelectedId,
}) {
  const [round, setRound] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewScore, setReviewScore] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewBusy, setReviewBusy] = useState("");
  const loadSeq = useRef(0);

  const load = async (roundNumber = round) => {
    if (!hackathon?.id) {
      setItems([]);
      return;
    }

    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(
        `/organizer/round${roundNumber}/hackathons/${hackathon.id}/submissions`
      );
      // v6.9.4: ignore stale responses when tabs are switched mid-flight
      if (seq !== loadSeq.current) return;
      const nextItems = arr(data, "submissions", "data");
      setItems(nextItems);
      return nextItems;
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setItems([]);
      setError(e.message || `Unable to load Round ${roundNumber} submissions.`);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedSubmission(null);
    setReviewFeedback("");
    setReviewScore("");
    load(round);
  }, [hackathon?.id, round]);

  const openSubmission = (submission) => {
    setError("");
    setReviewBusy("");
    setSelectedSubmission(submission);
    setReviewScore(
      submission?.score !== null && submission?.score !== undefined
        ? String(submission.score)
        : ""
    );
    // v6.3: feedback lives at different paths per round —
    // R1: decision.feedback | R2: organizer_decision.feedback | R3: organizer_feedback
    // v6.9: feedback_draft is the saved-but-undecided note
    setReviewFeedback(
      submission?.feedback_draft ||
        submission?.organizer_feedback ||
        submission?.decision?.feedback ||
        submission?.organizer_decision?.feedback ||
        ""
    );
  };

  const closeSubmission = () => {
    if (reviewBusy) return;
    // v6.9: keep reviewFeedback so a typed-but-unsaved note is never silently lost
    setSelectedSubmission(null);
    setReviewScore("");
  };

  const analyzeSubmission = async (submissionId, roundNumber) => {
    if (!submissionId) return;

    const key = `ai-${roundNumber}-${submissionId}`;
    setBusy(key);
    setError("");
    setMessage("");

    try {
      const endpoint =
        roundNumber === 1
          ? `/organizer/round1/submissions/${submissionId}/analyze`
          : `/organizer/round2/submissions/${submissionId}/analyze`;

      await apiFetch(endpoint, { method: "POST" });
      setMessage(`Round ${roundNumber} AI analysis completed.`);
      const refreshedItems = await load(roundNumber);
      const updatedSubmission = refreshedItems?.find(
        (item) => String(item.id || item.submission_id) === String(submissionId)
      );
      if (updatedSubmission) setSelectedSubmission(updatedSubmission);
    } catch (e) {
      setError(e.message || `Round ${roundNumber} AI analysis failed.`);
    } finally {
      setBusy("");
    }
  };

  // v6.9: save feedback note without finalizing a decision
  const saveFeedbackDraft = async () => {
    const submissionId = selectedSubmission?.id || selectedSubmission?.submission_id;
    if (!submissionId) {
      setError("Submission ID is missing.");
      return;
    }
    if (!reviewFeedback.trim()) {
      setError("Write some feedback before saving the draft.");
      return;
    }
    setReviewBusy("DRAFT");
    setError("");
    setMessage("");
    try {
      const endpoint =
        round === 3
          ? `/organizer/round3/submissions/${submissionId}/feedback`
          : `/organizer/round${round}/submissions/${submissionId}/feedback`;
      await apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ feedback_draft: reviewFeedback.trim() }),
      });
      setMessage("Feedback draft saved. You can finalize the decision later.");
      const refreshedItems = await load(round);
      const updated = refreshedItems?.find(
        (item) => String(item.id || item.submission_id) === String(submissionId)
      );
      if (updated) setSelectedSubmission(updated);
    } catch (e) {
      setError(e.message || "Unable to save feedback draft.");
    } finally {
      setReviewBusy("");
    }
  };

  const saveDecision = async (roundNumber, decision) => {
    const submissionId = selectedSubmission?.id || selectedSubmission?.submission_id;

    if (!submissionId) {
      setError(`Round ${roundNumber} submission ID is missing.`);
      return;
    }

    if (!reviewFeedback.trim()) {
      setError("Organizer feedback is required before saving the decision.");
      return;
    }

    setReviewBusy(decision);
    setError("");
    setMessage("");

    try {
      const endpoint =
        roundNumber === 1
          ? `/organizer/round1/submissions/${submissionId}/decision`
          : `/organizer/round2/submissions/${submissionId}/decision`;

      const body =
        roundNumber === 1
          ? { decision, organizer_feedback: reviewFeedback.trim() }
          : { decision, feedback: reviewFeedback.trim() };

      await apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setMessage(
        `Round ${roundNumber} submission ${decision === "SELECTED" ? "selected" : "rejected"} successfully.`
      );
      setSelectedSubmission(null);
      setReviewFeedback("");
      setReviewScore("");
      await load(roundNumber);
    } catch (e) {
      setError(e.message || `Unable to save Round ${roundNumber} decision.`);
    } finally {
      setReviewBusy("");
    }
  };

  const reviewRound3 = async (decision) => {
    const submissionId = selectedSubmission?.id || selectedSubmission?.submission_id;

    if (!submissionId) {
      setError("Round 3 submission ID is missing.");
      return;
    }

    const score = Number(reviewScore);

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Please enter a score between 0 and 100.");
      return;
    }

    if (!reviewFeedback.trim()) {
      setError("Organizer feedback is required before saving the review.");
      return;
    }

    setReviewBusy(decision);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/organizer/round3/submissions/${submissionId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          score,
          organizer_feedback: reviewFeedback.trim(),
        }),
      });

      setMessage(
        decision === "SELECTED"
          ? "Round 3 submission accepted successfully."
          : "Round 3 submission rejected successfully."
      );
      setSelectedSubmission(null);
      setReviewScore("");
      setReviewFeedback("");
      await load(3);
    } catch (e) {
      setError(e.message || "Unable to save Round 3 review.");
    } finally {
      setReviewBusy("");
    }
  };

  const renderRound1 = (s, i) => {
    const id = s.id || s.submission_id;
    const decision = s.decision?.decision || s.decision || s.status;
    const aiScore = s.ai_score ?? s.ai?.score ?? s.overall_score ?? null;
    const aiBusy = busy === `ai-1-${id}`;

    return (
      <article
        className="submission-card organizer-round-submission-card organizer-clickable-submission"
        key={id || i}
        onClick={() => openSubmission(s)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSubmission(s);
          }
        }}
      >
        <div className="submission-index">#{i + 1}</div>
        <div className="submission-main">
          <div className="submission-title">
            <div>
              <h3>{s.team_name || s.team?.name || `Team ${s.team_id || "—"}`}</h3>
              <p>Submitted by {s.submitted_by_name || s.submitted_by?.name || "Team member"}</p>
            </div>
            <span>{decision || "SUBMITTED"}</span>
          </div>
          <div className="organizer-submission-problem">
            <label>PROBLEM STATEMENT</label>
            <p>{s.problem_statement || "No problem statement provided."}</p>
          </div>
          <div className="submission-meta organizer-submission-meta">
            <span>AI score: <b>{aiScore ?? "Not analyzed"}</b></span>
            <span>AI: <b>{(s.ai_analyzed_at || s.ai_score != null) ? "Analyzed" : "Pending"}</b></span>
            <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
          </div>
          {(s.ai?.novelty_score != null || s.ai?.impact_score != null) && (
            <div className="organizer-ai-metrics organizer-ai-metrics-compact">
              <div><b>{s.ai?.novelty_score ?? "—"}</b><span>Novelty</span></div>
              <div><b>{s.ai?.relevance_score ?? "—"}</b><span>Relevance</span></div>
              <div><b>{s.ai?.innovation_score ?? "—"}</b><span>Innovation</span></div>
              <div><b>{s.ai?.technical_score ?? "—"}</b><span>Technical</span></div>
              <div><b>{s.ai?.impact_score ?? "—"}</b><span>Impact</span></div>
            </div>
          )}
          {(s.decision?.feedback || s.organizer_feedback) && (
            <div className="organizer-card-feedback">
              <span>ORGANIZER FEEDBACK</span>
              <p>{s.decision?.feedback || s.organizer_feedback}</p>
            </div>
          )}
          <div className="submission-actions organizer-submission-actions">
            <span className="submission-open-hint">Open submission ↗</span>
            <button
              type="button"
              className="ai-analyze-btn small"
              disabled={!id || !!busy}
              onClick={(event) => {
                event.stopPropagation();
                analyzeSubmission(id, 1);
              }}
            >
              {aiBusy ? <LoaderCircle size={13} className="spin" /> : <Sparkles size={13} />}
              {aiBusy ? "Analyzing..." : "AI Analyze"}
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderRound2 = (s, i) => {
    const id = s.id || s.submission_id;
    const decision = s.decision?.decision || s.decision || s.status;
    const aiBusy = busy === `ai-2-${id}`;

    return (
      <article
        className="submission-card organizer-round-submission-card organizer-clickable-submission"
        key={id || i}
        onClick={() => openSubmission(s)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSubmission(s);
          }
        }}
      >
        <div className="submission-index">#{i + 1}</div>
        <div className="submission-main">
          <div className="submission-title">
            <div>
              <h3>{s.project_title || s.project?.title || "Project submission"}</h3>
              <p>{s.team_name || s.team?.name || `Team ${s.team_id || "—"}`}</p>
            </div>
            <span>{decision || "SUBMITTED"}</span>
          </div>
          <p>{s.description || s.project_description || "No project description provided."}</p>
          <div className="submission-meta organizer-submission-meta">
            <span>GitHub: <b>{s.github_url ? "Provided" : "Missing"}</b></span>
            <span>PDF: <b>{s.pdf_url || s.pdf_file_name || s.pdf_file_url || (typeof s.pdf === "string" ? s.pdf : s.pdf?.url) ? "Provided" : "Missing"}</b></span>
            <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
          </div>
          {s.ai_analysis && (
            <div className="organizer-ai-metrics organizer-ai-metrics-compact">
              <div><b>{s.ai_analysis.overall_score ?? "—"}</b><span>Overall</span></div>
              <div><b>{s.ai_analysis.novelty_score ?? "—"}</b><span>Novelty</span></div>
              <div><b>{s.ai_analysis.relevance_score ?? "—"}</b><span>Relevance</span></div>
              <div><b>{s.ai_analysis.innovation_score ?? "—"}</b><span>Innovation</span></div>
              <div><b>{s.ai_analysis.technical_score ?? "—"}</b><span>Technical</span></div>
              <div><b>{s.ai_analysis.impact_score ?? "—"}</b><span>Impact</span></div>
            </div>
          )}
          {(s.organizer_decision?.feedback || s.organizer_feedback) && (
            <div className="organizer-card-feedback">
              <span>ORGANIZER FEEDBACK</span>
              <p>{s.organizer_decision?.feedback || s.organizer_feedback}</p>
            </div>
          )}
          <div className="submission-actions organizer-submission-actions">
            <span className="submission-open-hint">Open submission ↗</span>
            <button
              type="button"
              className="ai-analyze-btn small"
              disabled={!id || !!busy}
              onClick={(event) => {
                event.stopPropagation();
                analyzeSubmission(id, 2);
              }}
            >
              {aiBusy ? <LoaderCircle size={13} className="spin" /> : <Sparkles size={13} />}
              {aiBusy ? "Analyzing..." : "AI Analyze"}
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderRound3 = (s, i) => {
    const id = s.id || s.submission_id;
    const decision = s.decision || s.status || "SUBMITTED";

    return (
      <article
        className="submission-card organizer-round-submission-card organizer-round3-card organizer-clickable-submission"
        key={id || i}
        onClick={() => openSubmission(s)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSubmission(s);
          }
        }}
      >
        <div className="submission-index">#{i + 1}</div>
        <div className="submission-main">
          <div className="submission-title">
            <div>
              <h3>{s.team_name || `Team ${s.team_id || "—"}`}</h3>
              <p>Submitted by {s.submitted_by_name || "Team member"}</p>
            </div>
            <span>{decision}</span>
          </div>
          <p>{s.project_description || "No project description provided."}</p>
          <div className="submission-meta organizer-submission-meta">
            <span>GitHub: <b>{s.github_url ? "Provided" : "Missing"}</b></span>
            <span>Demo: <b>{s.demo_url ? "Provided" : "Not provided"}</b></span>
            <span>Score: <b>{s.score ?? "Not scored"}</b></span>
            <span>Decision: <b>{s.decision || "Pending"}</b></span>
            <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
          </div>
          {s.organizer_feedback && (
            <div className="organizer-card-feedback">
              <span>ORGANIZER FEEDBACK</span>
              <p>{s.organizer_feedback}</p>
            </div>
          )}
          <div className="submission-actions organizer-submission-actions">
            <span className="submission-open-hint">Manual review ↗</span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      <Panel
        eyebrow={`Round ${round} submissions`}
        title={`Submission review · Round ${round}`}
        description={
          round === 3
            ? "R3 is completely manual. Open a submission, inspect GitHub/demo, then enter the score, decision and organizer feedback."
            : "Open a submission for the full project view. Gemini AI is advisory; the organizer makes the final decision."
        }
        action={
          <div className="organizer-submission-toolbar">
            <Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId} />
            <button className={`round-tab ${round === 1 ? "active" : ""}`} onClick={() => setRound(1)}>Round 1</button>
            <button className={`round-tab ${round === 2 ? "active" : ""}`} onClick={() => setRound(2)}>Round 2</button>
            <button className={`round-tab ${round === 3 ? "active" : ""}`} onClick={() => setRound(3)}>Round 3</button>
          </div>
        }
      >
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}

        {round < 3 && (
          <div className="organizer-round-ai-banner">
            <div>
              <span>GEMINI / ADVISORY AI</span>
              <strong>AI assists the organizer — it does not make the final decision.</strong>
              <p>Open a submission to inspect the AI analysis, then enter your own feedback and decision.</p>
            </div>
          </div>
        )}

        {loading ? (
          <Loading />
        ) : items.length ? (
          <OrganizerListErrorBoundary key={`round-${round}`}>
            <div className="submission-list organizer-submission-list">
              {items.map((s, i) =>
                round === 1
                  ? renderRound1(s, i)
                  : round === 2
                    ? renderRound2(s, i)
                    : renderRound3(s, i)
              )}
            </div>
          </OrganizerListErrorBoundary>
        ) : (
          <Empty text={`No Round ${round} submissions found for this hackathon.`} />
        )}
      </Panel>

      {selectedSubmission && (
        <OrganizerSubmissionModal
          round={round}
          submission={selectedSubmission}
          reviewScore={reviewScore}
          setReviewScore={setReviewScore}
          reviewFeedback={reviewFeedback}
          setReviewFeedback={setReviewFeedback}
          reviewBusy={reviewBusy}
          busy={busy}
          error={error}
          onClose={closeSubmission}
          onAnalyze={analyzeSubmission}
          onDecision={saveDecision}
          onRound3Decision={reviewRound3}
          onSaveDraft={saveFeedbackDraft}
        />
      )}
    </>
  );
}

/* v6.4 — never let one bad submission black-screen the organizer panel */
const safeText = (v, fallback = "—") =>
  typeof v === "string" ? v : v === null || v === undefined ? fallback : String(v);

class OrganizerListErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch() {
    // Swallow the render error so a single bad row never whitescreens the panel
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="form-error" style={{ margin: "12px 0" }}>
          Something went wrong showing these submissions.{" "}
          <button
            type="button"
            className="ai-analyze-btn small"
            onClick={() => this.setState({ crashed: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

class OrganizerModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div
          className="organizer-review-modal-backdrop"
          onMouseDown={this.props.onClose}
        >
          <div
            className="organizer-review-modal organizer-submission-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ padding: 32 }}
          >
            <h2 style={{ margin: "0 0 12px" }}>Couldn't open this submission</h2>
            <p style={{ opacity: 0.7, margin: "0 0 20px" }}>
              The submission data couldn't be displayed. The rest of the panel
              is unaffected — you can close this and continue.
            </p>
            <button className="outline-btn" onClick={this.props.onClose}>
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function OrganizerSubmissionModal({
  round,
  submission,
  reviewScore,
  setReviewScore,
  reviewFeedback,
  setReviewFeedback,
  reviewBusy,
  busy,
  error,
  onClose,
  onAnalyze,
  onDecision,
  onRound3Decision,
  onSaveDraft,
}) {
  const id =
    submission?.id ||
    submission?.submission_id;

  const isRound3 =
    round === 3;

  const aiBusy =
    busy === `ai-${round}-${id}`;

  const decision = safeText(
    submission?.decision?.decision ||
      submission?.decision ||
      submission?.status ||
      "PENDING",
    "PENDING"
  );

  const ai =
    submission?.ai_analysis ||
    submission?.ai ||
    {};

  const title = safeText(
    round === 1
      ? submission?.team_name ||
        submission?.team?.name ||
        `Team ${submission?.team_id || "—"}`
      : round === 2
        ? submission?.project_title ||
          submission?.project?.title ||
          submission?.team_name ||
          "Project submission"
        : submission?.team_name ||
          `Team ${submission?.team_id || "—"}`,
    "Submission"
  );

  const aiScore =
    round === 1
      ? submission?.ai_score ??
        ai?.score ??
        ai?.overall_score
      : ai?.overall_score ??
        submission?.overall_score;

  const aiRecommendation =
    submission?.ai_recommendation ||
    ai?.recommendation ||
    "—";

  const rawFeedback =
    submission?.ai_feedback ??
    ai?.feedback ??
    ai?.summary ??
    ai?.response;

  const aiFeedback =
    typeof rawFeedback === "string"
      ? rawFeedback
      : rawFeedback?.feedback ||
        "No AI feedback yet.";

  const strengths =
    Array.isArray(ai?.strengths)
      ? ai.strengths
      : [];

  const weaknesses =
    Array.isArray(ai?.weaknesses)
      ? ai.weaknesses
      : [];

  const suggestions =
    Array.isArray(ai?.suggestions)
      ? ai.suggestions
      : [];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  const modal = (
    <div
      className="organizer-review-modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="organizer-review-modal organizer-submission-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-submission-title"
      >
        {/* HEADER */}
        <div className="organizer-review-modal-head">
          <div>
            <span>
              ROUND 0{round} /{" "}
              {isRound3
                ? "MANUAL REVIEW"
                : "AI + ORGANIZER REVIEW"}
            </span>

            <h2 id="organizer-submission-title">
              {title}
            </h2>

            <p>
              {submission?.submitted_by_name ||
                submission?.submitted_by?.name ||
                "Team member"}

              {submission?.submitted_by_email
                ? ` · ${submission.submitted_by_email}`
                : ""}
            </p>
          </div>

          <button
            className="organizer-review-close"
            onClick={onClose}
            aria-label="Close submission"
          >
            <X size={19} />
          </button>
        </div>

        {/* STATUS */}
        <div className="organizer-review-status-row">
          <span
            className={`status-pill ${statusClass(
              decision
            )}`}
          >
            {decision}
          </span>

          {!isRound3 &&
            aiScore !== null &&
            aiScore !== undefined && (
              <span>
                AI Score: <b>{aiScore}</b>
              </span>
            )}

          {isRound3 && (
            <span>
              Score:{" "}
              <b>
                {submission?.score ??
                  "Not scored"}
              </b>
            </span>
          )}

          <span>
            Submitted:{" "}
            <b>
              {dateText(
                submission?.submitted_at ||
                  submission?.created_at
              )}
            </b>
          </span>
        </div>

        {/* GEMINI AI */}
        {!isRound3 && (
          <section className="organizer-ai-panel organizer-ai-showcase">
            <div className="organizer-ai-panel-head">
              <div>
                <span>
                  GEMINI AI ANALYSIS
                </span>

                <strong>
                  Decision support · organizer remains final reviewer
                </strong>
              </div>

              <button
                className="ai-analyze-btn small"
                disabled={
                  !id || !!busy
                }
                onClick={() =>
                  onAnalyze(id, round)
                }
              >
                {aiBusy ? (
                  <LoaderCircle
                    size={13}
                    className="spin"
                  />
                ) : (
                  <Sparkles size={13} />
                )}

                {aiBusy
                  ? "Analyzing..."
                  : "Analyze / Re-analyze"}
              </button>
            </div>

            {/* BIG SCORE */}
            <div className="organizer-ai-score-hero">
              <div>
                <span>
                  AI OVERALL SCORE
                </span>

                <strong>
                  {aiScore ?? "—"}
                </strong>

                <small>
                  out of 100
                </small>
              </div>

              <div className="organizer-ai-recommendation">
                <span>
                  RECOMMENDATION
                </span>

                <b>
                  {aiRecommendation}
                </b>
              </div>
            </div>

            {/* R1 + R2 METRICS */}
            {(round === 1 || round === 2) && (
              <div className="organizer-ai-metrics">
                <div>
                  <span>Novelty</span>
                  <b>
                    {ai?.novelty_score ??
                      "—"}
                  </b>
                </div>

                <div>
                  <span>Relevance</span>
                  <b>
                    {ai?.relevance_score ??
                      "—"}
                  </b>
                </div>

                <div>
                  <span>Innovation</span>
                  <b>
                    {ai?.innovation_score ??
                      "—"}
                  </b>
                </div>

                <div>
                  <span>Technical</span>
                  <b>
                    {ai?.technical_score ??
                      "—"}
                  </b>
                </div>

                <div>
                  <span>Impact</span>
                  <b>
                    {ai?.impact_score ??
                      "—"}
                  </b>
                </div>
              </div>
            )}

            {/* AI RESPONSE */}
            <div className="organizer-ai-response-box">
              <div className="organizer-ai-response-title">
                <span>
                  AI RESPONSE
                </span>

                <span className="organizer-ai-live-dot">
                  ANALYSIS
                </span>
              </div>

              <p>
                {aiFeedback}
              </p>
            </div>

            {/* INSIGHTS */}
            {(strengths.length > 0 ||
              weaknesses.length > 0 ||
              suggestions.length > 0) && (
              <div className="organizer-ai-insight-grid">
                {strengths.length >
                  0 && (
                  <div className="organizer-ai-insight strengths">
                    <span>
                      STRENGTHS
                    </span>

                    <ul>
                      {strengths.map(
                        (
                          item,
                          index
                        ) => (
                          <li
                            key={`strength-${index}`}
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {weaknesses.length >
                  0 && (
                  <div className="organizer-ai-insight weaknesses">
                    <span>
                      WEAKNESSES
                    </span>

                    <ul>
                      {weaknesses.map(
                        (
                          item,
                          index
                        ) => (
                          <li
                            key={`weakness-${index}`}
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {suggestions.length >
                  0 && (
                  <div className="organizer-ai-insight suggestions">
                    <span>
                      SUGGESTIONS
                    </span>

                    <ul>
                      {suggestions.map(
                        (
                          item,
                          index
                        ) => (
                          <li
                            key={`suggestion-${index}`}
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}


        {/* SUBMISSION DETAILS */}
        <div className="organizer-review-details">
          {round === 1 ? (
            <>
              <div className="organizer-review-detail-card organizer-review-detail-wide">
                <span>
                  PROBLEM STATEMENT
                </span>

                <p>
                  {submission?.problem_statement ||
                    "No problem statement provided."}
                </p>
              </div>

              <div className="organizer-review-detail-card organizer-review-detail-wide">
                <span>
                  PROJECT DESCRIPTION
                </span>

                <p>
                  {submission?.project_description ||
                    submission?.description ||
                    submission?.problem_statement ||
                    "No project description provided."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="organizer-review-detail-card organizer-review-detail-wide">
                <span>
                  PROJECT DESCRIPTION
                </span>

                <p>
                  {submission?.project_description ||
                    submission?.description ||
                    submission?.problem_statement ||
                    "No project description provided."}
                </p>
              </div>

              {submission?.github_url && (
                <div className="organizer-review-detail-card">
                  <span>
                    GITHUB REPOSITORY
                  </span>

                  <a
                    href={
                      submission.github_url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FolderGit2 size={15} />
                    Open GitHub repository ↗
                  </a>
                </div>
              )}

              {(submission?.demo_url ||
                submission?.demo) && (
                <div className="organizer-review-detail-card">
                  <span>
                    LIVE DEMO
                  </span>

                  <a
                    href={
                      submission.demo_url ||
                      submission.demo
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ArrowRight size={15} />
                    Open live demo ↗
                  </a>
                </div>
              )}

              {(submission?.pdf_url ||
                submission?.pdf_file_url ||
                submission?.pdf) && (
                <div className="organizer-review-detail-card organizer-review-detail-wide">
                  <span>
                    PDF / DOCUMENT
                  </span>

                  <a
                    href={
                      submission.pdf_url ||
                      submission.pdf_file_url ||
                      (typeof submission.pdf === "string"
                        ? submission.pdf
                        : submission.pdf?.url)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Send size={15} />
                    Open submitted PDF ↗
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* EXISTING ORGANIZER FEEDBACK */}
        {(submission?.organizer_feedback ||
          submission?.decision?.feedback ||
          submission?.organizer_decision?.feedback) && (
          <div className="organizer-existing-feedback">
            <span>
              EXISTING ORGANIZER FEEDBACK
            </span>

            <p>
              {safeText(
                submission.organizer_feedback ||
                  (typeof submission.decision === "object"
                    ? submission.decision?.feedback
                    : null) ||
                  submission.organizer_decision?.feedback,
                ""
              )}
            </p>
          </div>
        )}

        {/* R3 */}
        {isRound3 && (
          <div className="organizer-manual-review-panel">
            <span>
              ROUND 3 MANUAL REVIEW
            </span>

            <p>
              Round 3 uses the organizer's
              recorded score, decision, and
              feedback. No AI score is shown
              for this round.
            </p>
          </div>
        )}

        {/* REVIEW FORM */}
        <div className="organizer-review-form">
          <div className="organizer-review-form-grid">
            {isRound3 && (
              <Field
                label="Score (0–100)"
                required
              >
                <input
                  className="org-input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={reviewScore}
                  onChange={(event) =>
                    setReviewScore(
                      event.target.value
                    )
                  }
                  placeholder="Enter score"
                  disabled={!!reviewBusy}
                />
              </Field>
            )}

            <Field
              label="Organizer feedback"
              required
              full
            >
              <textarea
                className="org-input textarea"
                rows={5}
                value={reviewFeedback}
                onChange={(event) =>
                  setReviewFeedback(
                    event.target.value
                  )
                }
                placeholder={
                  isRound3
                    ? "Explain the manual final review..."
                    : "Explain why this submission is selected or rejected..."
                }
                disabled={!!reviewBusy}
              />
            </Field>
          </div>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="organizer-review-actions">
            <button
              className="outline-btn"
              disabled={!!reviewBusy}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="ai-analyze-btn"
              disabled={!!reviewBusy || !reviewFeedback.trim()}
              onClick={onSaveDraft}
              title="Save this feedback note without finalizing a decision"
            >
              {reviewBusy === "DRAFT" ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Save size={14} />
              )}
              Save draft
            </button>

            <button
              className="danger-btn"
              disabled={!!reviewBusy}
              onClick={() =>
                isRound3
                  ? onRound3Decision(
                      "REJECTED"
                    )
                  : onDecision(
                      round,
                      "REJECTED"
                    )
              }
            >
              {reviewBusy ===
              "REJECTED" ? (
                <LoaderCircle
                  size={14}
                  className="spin"
                />
              ) : (
                <X size={14} />
              )}

              Reject
            </button>

            <button
              className="approve-btn"
              disabled={!!reviewBusy}
              onClick={() =>
                isRound3
                  ? onRound3Decision(
                      "SELECTED"
                    )
                  : onDecision(
                      round,
                      "SELECTED"
                    )
              }
            >
              {reviewBusy ===
              "SELECTED" ? (
                <LoaderCircle
                  size={14}
                  className="spin"
                />
              ) : (
                <Check size={14} />
              )}

              Accept / Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <OrganizerModalErrorBoundary onClose={onClose}>
      {modal}
    </OrganizerModalErrorBoundary>,
    document.body
  );
}
function RoundTwo({ title, description, hackathon, hackathons, selectedId, setSelectedId, reviewMode }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    if (!hackathon) return setItems([]);
    setLoading(true);
    setError("");
    try {
      const d = await apiFetch(`/organizer/round2/hackathons/${hackathon.id}/submissions`);
      setItems(arr(d, "submissions", "data"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hackathon?.id]);

  const analyze = async (id) => {
    setBusy(`analyze-${id}`);
    try {
      await apiFetch(`/organizer/round2/submissions/${id}/analyze`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const decide = async (id, decision) => {
    setBusy(`decision-${id}`);
    try {
      await apiFetch(`/organizer/round2/submissions/${id}/decision`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          feedback: `Organizer marked this submission ${decision.toLowerCase()}.`,
        }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Panel eyebrow={reviewMode ? "Review desk" : "Round 2"} title={title} description={description} action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId}/>}>
      {error && <div className="form-error">{error}</div>}
      {loading ? <Loading /> : items.length ? (
        <div className="submission-list">
          {items.map((s, i) => {
            const id = s.id || s.submission_id;
            return (
              <article className="submission-card" key={id || i}>
                <div className="submission-index">#{i + 1}</div>
                <div className="submission-main">
                  <div className="submission-title">
                    <div><h3>{s.project_title || s.project?.title || "Project submission"}</h3><p>{s.team_name || s.team?.name || "Team"}</p></div>
                    <span>{s.status || s.decision || "SUBMITTED"}</span>
                  </div>
                  <p>{s.description || s.project_description || "No project description provided."}</p>
                  <div className="submission-meta">
                    <span>Score: <b>{s.score ?? s.overall_score ?? "—"}</b></span>
                    <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
                  </div>
                  <div className="submission-actions">
                    <button className="outline-btn small" disabled={!id || !!busy} onClick={() => analyze(id)}>
                      {busy === `analyze-${id}` ? <LoaderCircle size={13} className="spin"/> : <Sparkles size={13}/>}
                      AI analyze
                    </button>
                    {reviewMode && (
                      <>
                        <button className="approve-btn small" disabled={!id || !!busy} onClick={() => decide(id, "APPROVED")}><Check size={13}/> Approve</button>
                        <button className="danger-btn small" disabled={!id || !!busy} onClick={() => decide(id, "REJECTED")}><X size={13}/> Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty text="No Round 2 submissions found." />}
    </Panel>
  );
}

function RuleBot({ hackathons, selectedId, setSelectedId }) {
  const [rules, setRules] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRules = async () => {
    if (!selectedId) {
      setRules(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/rulebot/${selectedId}/rules`);
      setRules(data?.rules || data?.data || data);
    } catch (e) {
      setError(e.message || "Unable to load hackathon rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAnswer("");
    setMessage("");
    loadRules();
  }, [selectedId]);

  const useDefault = async () => {
    if (!selectedId) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/rulebot/${selectedId}/rules/default`, { method: "POST" });
      setRules(data?.rules || data?.data || data);
      setMessage("CampusCode default rules are now active.");
    } catch (e) {
      setError(e.message || "Unable to use default rules.");
    } finally {
      setUploading(false);
    }
  };

  const uploadRules = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedId) return;

    const formData = new FormData();
    formData.append("rules", file);

    setUploading(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/rulebot/${selectedId}/rules`, {
        method: "POST",
        body: formData,
      });
      setRules(data?.rules || data?.data || data);
      setMessage("Custom hackathon rules uploaded successfully.");
    } catch (e) {
      setError(e.message || "Unable to upload the rules PDF.");
    } finally {
      setUploading(false);
    }
  };

  const ask = async (event) => {
    event.preventDefault();
    if (!selectedId || !question.trim()) return;

    setAsking(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/rulebot/${selectedId}/ask`, {
        method: "POST",
        body: JSON.stringify({ question: question.trim() }),
      });
      setAnswer(data?.answer || data?.response || data?.message || "No answer returned.");
    } catch (e) {
      setError(e.message || "RuleBot could not answer the question.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="rulebot-grid">
      <Panel
        eyebrow="Rules source"
        title="Hackathon rules"
        description="Choose the event, inspect the active rules and upload a custom rules PDF when needed."
        action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId} />}
      >
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        {loading ? <Loading /> : (
          <div className="rulebot-rules-card">
            <div className="rulebot-rules-head">
              <div>
                <span>ACTIVE SOURCE</span>
                <strong>{rules?.is_default || rules?.isDefault ? "CampusCode Default Rules" : rules?.file_name || rules?.filename || "No custom rules uploaded"}</strong>
              </div>
              <span className="rulebot-source-pill">{rules?.is_default || rules?.isDefault ? "DEFAULT" : "CUSTOM"}</span>
            </div>
            <p>{rules?.text || rules?.extracted_text || rules?.content || "RuleBot will use the selected hackathon rules when answering organizer questions."}</p>
            <div className="rulebot-actions">
              <label className="primary-btn rulebot-upload-label">
                <input type="file" accept="application/pdf" onChange={uploadRules} disabled={uploading || !selectedId} />
                {uploading ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
                Upload Rules PDF
              </label>
              <button className="outline-btn" onClick={useDefault} disabled={uploading || !selectedId}>
                <Sparkles size={14} /> Use Default Rules
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Ask RuleBot" title="Rules assistant" description="Ask a question about the selected hackathon rules.">
        <form className="rulebot-chat-form" onSubmit={ask}>
          <textarea
            className="org-input textarea rulebot-question"
            rows={5}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: Can a team submit after the deadline?"
          />
          <button className="primary-btn" disabled={asking || !selectedId || !question.trim()}>
            {asking ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
            {asking ? "Thinking..." : "Ask RuleBot"}
          </button>
        </form>

        {answer && (
          <div className="rulebot-answer">
            <span>RULEBOT ANSWER</span>
            <p>{answer}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* =========================================================
   v6 — CERTIFICATES (Module 8, organizer issue section)
   Theme picker offers the 3 launch themes now; the other 3
   v2 designs join the picker when the organizer template is
   finalized later. Issuing is idempotent — re-running never
   duplicates a certificate.
========================================================= */

const CERT_THEMES = [
  { id: "sidebar", name: "Sidebar Panel", note: "Dark panel + watermark, classic certificate look." },
  { id: "constellation", name: "Constellation Night", note: "Dark gradient + medallion, premium awards feel." },
  { id: "blueprint", name: "Blueprint Spec", note: "Grid + spec rows, CampusCode's own visual language." },
];

function Certificates({ hackathon, hackathons, selectedId, setSelectedId }) {
  const [issued, setIssued] = useState([]);
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);
  const [theme, setTheme] = useState("sidebar");
  const [winnerPicks, setWinnerPicks] = useState({ 1: "", 2: "", 3: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  /* v6.26 — quiz mode: no teams, no Round 1. Participation comes
     from submitted quiz attempts; winners are picked students. */
  const isQuiz = hackathon?.event_type === "quiz";
  const submittedStudents = students.filter((s) => s.status === "SUBMITTED");

  const load = async () => {
    if (!hackathon) {
      setIssued([]);
      setTeams([]);
      setStudents([]);
      return;
    }
    setLoading(true);
    setError("");
    setWinnerPicks({ 1: "", 2: "", 3: "" });
    try {
      const [certData, otherData] = await Promise.all([
        apiFetch(`/certificates/hackathons/${hackathon.id}`),
        isQuiz
          ? apiFetch(`/quizzes/${hackathon.id}/submissions`)
          : apiFetch(`/hackathons/${hackathon.id}/teams`),
      ]);
      setIssued(Array.isArray(certData?.certificates) ? certData.certificates : []);
      if (isQuiz) {
        setTeams([]);
        setStudents(Array.isArray(otherData?.submissions) ? otherData.submissions : []);
      } else {
        setStudents([]);
        setTeams(arr(otherData, "teams", "data"));
      }
    } catch (e) {
      setError(e.message || "Unable to load certificates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hackathon?.id]);

  const issueParticipation = async () => {
    if (!hackathon) return;
    setBusy("participation");
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/certificates/hackathons/${hackathon.id}/issue-participation`, {
        method: "POST",
        body: JSON.stringify({ theme }),
      });
      setMessage(`Issued ${data?.issued ?? 0} participation certificates (${data?.already_had ?? 0} already had one). Saved in database: ${data?.persisted ?? "?"}.`);
      load();
    } catch (e) {
      setError(e.message || "Failed to issue participation certificates.");
    } finally {
      setBusy("");
    }
  };

  const issueWinners = async () => {
    if (!hackathon) return;
    const winners = [1, 2, 3]
      .filter((place) => winnerPicks[place])
      .map((place) =>
        isQuiz
          ? { user_id: winnerPicks[place], place }
          : { team_id: winnerPicks[place], place }
      );
    if (winners.length === 0) {
      setError(isQuiz ? "Pick at least one winning student first." : "Pick at least one winning team first.");
      return;
    }
    setBusy("winners");
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/certificates/hackathons/${hackathon.id}/issue-winners`, {
        method: "POST",
        body: JSON.stringify({ theme, winners }),
      });
      setMessage(`Issued ${data?.issued ?? 0} winner certificates. Saved in database: ${data?.persisted ?? "?"}.`);
      load();
    } catch (e) {
      setError(e.message || "Failed to issue winner certificates.");
    } finally {
      setBusy("");
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
  };

  return (
    <Panel eyebrow="Certificates" title="Issue certificates" description={isQuiz ? "Participation goes to every student who submitted the quiz. Winners go to the students you pick below. Re-issuing is safe — nobody gets a duplicate." : "Pick a theme, then issue. Participation goes to every member of a team that submitted Round 1. Winners go to the teams you pick below. Re-issuing is safe — nobody gets a duplicate."} action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId} />}>
      {error && <div className="form-error">{error}</div>}
      {message && <AlertBox type="success" message={message} onClose={() => setMessage("")} />}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {CERT_THEMES.map((t) => (
          <button
            key={t.id}
            className={theme === t.id ? "primary-btn small" : "outline-btn small"}
            onClick={() => setTheme(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p style={{ marginTop: -8, marginBottom: 20 }}>
        {CERT_THEMES.find((t) => t.id === theme)?.note} The theme is saved on each certificate at issue time.
      </p>

      {isQuiz && (
        <p style={{ marginBottom: 20 }}>
          {submittedStudents.length} student{submittedStudents.length === 1 ? "" : "s"} submitted this quiz — participation goes to all of them.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <button className="primary-btn" disabled={busy !== "" || !hackathon} onClick={issueParticipation}>
          {busy === "participation" ? "ISSUING…" : "ISSUE PARTICIPATION CERTIFICATES"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 24 }}>
        {[1, 2, 3].map((place) => (
          <label key={place} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>{place === 1 ? "1st place" : place === 2 ? "2nd place" : "3rd place"}</span>
            <select
              className="org-select compact"
              value={winnerPicks[place]}
              onChange={(e) => setWinnerPicks((prev) => ({ ...prev, [place]: e.target.value }))}
            >
              <option value="">{isQuiz ? "— No student —" : "— No team —"}</option>
              {isQuiz
                ? submittedStudents.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.user_name || "Student"}{s.score != null && s.total_marks != null ? ` (${s.score}/${s.total_marks})` : ""}
                    </option>
                  ))
                : teams.map((team) => (
                    <option key={team.id || team.team_id} value={team.id || team.team_id}>
                      {team.name || team.team_name || "Team"}
                    </option>
                  ))}
            </select>
          </label>
        ))}
        <button className="outline-btn" disabled={busy !== "" || !hackathon} onClick={issueWinners}>
          {busy === "winners" ? "ISSUING…" : "ISSUE WINNER CERTIFICATES"}
        </button>
      </div>

      {loading ? <Loading /> : issued.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Holder</th><th>Team</th><th>Type</th><th>Place</th><th>Code</th><th>Issued</th></tr></thead>
            <tbody>{issued.map((c, i) => (
              <tr key={c.id || i}>
                <td><b>{c.holder_name || "—"}</b></td>
                <td>{c.team_name || "—"}</td>
                <td>{c.type}</td>
                <td>{c.place || "—"}</td>
                <td>{c.code}</td>
                <td>{formatDate(c.issued_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty text="No certificates issued for this hackathon yet." />}
    </Panel>
  );
}

function Leaderboard({ hackathons, selectedId, setSelectedId }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedId) return setResults([]);
    setLoading(true);
    apiFetch(`/results/hackathon/${selectedId}`)
      .then((d) => setResults(arr(d, "results", "data")))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <Panel eyebrow="Results" title="Leaderboard" description="Read the backend-generated result ranking; no client-side scores are created." action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId}/>}>
      {error && <div className="form-error">{error}</div>}
      {loading ? <Loading /> : results.length ? (
        <div className="leaderboard">
          {results.map((r, i) => (
            <div className={`leader-row rank-${i + 1}`} key={r.submission_id || r.team_id || i}>
              <div className="rank">{r.rank ?? i + 1}</div>
              <div className="rank-team"><b>{r.team_name || r.team?.name || "Team"}</b><span>{r.project_title || r.project?.title || "Project"}</span></div>
              <strong>{r.score ?? r.overall_score ?? "—"}</strong>
            </div>
          ))}
        </div>
      ) : <Empty text="No published/backend results for this hackathon." />}
    </Panel>
  );
}

function ResultRequest({ hackathons: initialHackathons, selectedId, setSelectedId }) {
  const [hackathons, setHackathons] = useState(initialHackathons || []);
  const [loadingHackathons, setLoadingHackathons] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadHackathons = async () => {
    setLoadingHackathons(true);
    setError("");
    try {
      const result = await apiFetch("/hackathons/organizer/my-hackathons");
      const list = dedupeHackathons(arr(result, "hackathons", "events", "items", "data"));
      setHackathons(list);
      setSelectedId((current) => {
        if (current && list.some((h) => String(h.id || h.hackathon_id || h.hackathon?.id) === String(current))) {
          return current;
        }
        return String(list[0]?.id || list[0]?.hackathon_id || list[0]?.hackathon?.id || "");
      });
    } catch (e) {
      setHackathons((current) => current.length ? current : (initialHackathons || []));
      setError(e.message || "Unable to fetch organizer hackathons.");
    } finally {
      setLoadingHackathons(false);
    }
  };

  useEffect(() => { loadHackathons(); }, []);

  const selected = hackathons.find(
    (h) => String(h.id || h.hackathon_id || h.hackathon?.id) === String(selectedId)
  );

  const request = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const id = selected.id || selected.hackathon_id || selected.hackathon?.id;
      await apiFetch(`/result-requests/hackathons/${id}`, { method: "POST" });
      setMessage("Result publication request sent to Admin.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      eyebrow="Results"
      title="Request result approval"
      description="Send the real result publication request to the Admin approval queue."
      action={<Picker hackathons={hackathons} selectedId={selectedId} setSelectedId={setSelectedId} />}
    >
      {loadingHackathons && <div className="form-success">Loading your hackathons...</div>}
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      <div className="approval-card">
        <div><span>Hackathon</span><b>{selected?.title || selected?.name || selected?.hackathon?.title || "Select a hackathon"}</b></div>
        <div><span>Current round</span><b>{selected?.current_round ?? selected?.hackathon?.current_round ?? "—"}</b></div>
        <div><span>Status</span><b>{selected?.status || selected?.hackathon_status || selected?.hackathon?.status || "—"}</b></div>
        <button className="primary-btn" disabled={!selected || busy || loadingHackathons} onClick={request}>
          {busy ? <LoaderCircle size={14} className="spin"/> : <Send size={14}/>} 
          {busy ? "Sending..." : "Request Admin approval"}
        </button>
      </div>
    </Panel>
  );
}

function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("HACKATHON_PARTICIPANTS");
  const [hackathonId, setHackathonId] = useState("");
  const [hackathons, setHackathons] = useState([]);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const [notifications, events] = await Promise.all([
        apiFetch("/notifications"),
        apiFetch("/hackathons/organizer/my-hackathons"),
      ]);
      setItems(arr(notifications, "notifications", "data"));
      setHackathons(dedupeHackathons(arr(events, "hackathons", "events", "data")));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !hackathonId) {
      setError("Title, message and hackathon are required.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await apiFetch("/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          message: body.trim(),
          type: "INFO",
          audience,
          hackathon_id: hackathonId,
        }),
      });
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="notification-grid">
      <Panel eyebrow="Compose" title="Send notification" description="Organizer notifications can target participants of a selected hackathon.">
        {error && <div className="form-error">{error}</div>}
        <form className="notify-form" onSubmit={send}>
          <Field label="Hackathon" required>
            <select className="org-input" value={hackathonId} onChange={(e) => setHackathonId(e.target.value)}>
              <option value="">Select hackathon</option>
              {hackathons.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
            </select>
          </Field>
          <Field label="Audience">
            <select className="org-input" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="HACKATHON_PARTICIPANTS">Hackathon participants</option>
            </select>
          </Field>
          <Field label="Title" required><input className="org-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Important update"/></Field>
          <Field label="Message" required full><textarea className="org-input textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the update..."/></Field>
          <button className="primary-btn" disabled={sending}>{sending ? <LoaderCircle size={14} className="spin"/> : <Send size={14}/>} Send notification</button>
        </form>
      </Panel>

      <Panel eyebrow="Inbox" title="Notifications" description="Your live notification feed.">
        {loading ? <Loading /> : items.length ? (
          <div className="notification-list">
            {items.map((n, i) => (
              <article className="notification-card" key={n.id || i}>
                <div className="notification-icon"><Bell size={15}/></div>
                <div><b>{n.title || "Notification"}</b><p>{n.message || "—"}</p><span>{dateText(n.created_at)}</span></div>
              </article>
            ))}
          </div>
        ) : <Empty text="No notifications yet." />}
      </Panel>
    </div>
  );
}

function Profile({ user }) {
  const [data, setData] = useState(user || {});
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [skills, setSkills] = useState(
    Array.isArray(user?.skills) ? user.skills.join(", ") : user?.skills || ""
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/users/me")
      .then((d) => {
        const u = d.user || d.data || d;
        setData(u);
        setName(u.name || "");
        setBio(u.bio || "");
        setSkills(Array.isArray(u.skills) ? u.skills.join(", ") : u.skills || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const d = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name,
          bio,
          skills: skills.split(",").map((x) => x.trim()).filter(Boolean),
        }),
      });
      const u = d.user || d.data || d;
      setData(u);
      setMessage("Profile saved to the backend.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <Panel eyebrow="Account" title="My Profile" description="Profile information is loaded and saved through the CampusCode API.">
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      <div className="profile-card">
        <div className="profile-avatar">{(name || "O").slice(0, 1).toUpperCase()}</div>
        <div className="profile-fields">
          <Field label="Full name"><input className="org-input" value={name} onChange={(e) => setName(e.target.value)}/></Field>
          <Field label="Email"><input className="org-input" value={data?.email || user?.email || ""} disabled/></Field>
          <Field label="Bio" full><textarea className="org-input textarea" rows={5} value={bio} onChange={(e) => setBio(e.target.value)}/></Field>
          <Field label="Skills" full><input className="org-input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Node.js, PostgreSQL"/></Field>
          <div className="profile-footer"><span>Role: {data?.role || user?.role || "ORGANIZER"}</span><button className="primary-btn" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Profile"}</button></div>
        </div>
      </div>
    </Panel>
  );
}

function Workspace({ hackathon, onBack, onNavigate }) {
  const [tab, setTab] = useState("rounds");
  const [rounds, setRounds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hackathon?.id) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/hackathons/${hackathon.id}/rounds`).catch(() => ({})),
      apiFetch(`/hackathons/${hackathon.id}/teams`).catch(() => ({})),
      apiFetch(`/organizer/round2/hackathons/${hackathon.id}/submissions`).catch(() => ({})),
    ]).then(([r, t, s]) => {
      setRounds(arr(r, "rounds", "data"));
      setTeams(arr(t, "teams", "data"));
      setSubmissions(arr(s, "submissions", "data"));
    }).finally(() => setLoading(false));
  }, [hackathon?.id]);

  if (!hackathon) return <Panel eyebrow="Workspace" title="Hackathon not found"><Empty text="Select a valid hackathon." /></Panel>;

  return (
    <Panel
      eyebrow="Hackathon workspace"
      title={hackathon.title}
      description="Manage the selected event without losing your place in the organizer console."
      action={<button className="outline-btn" onClick={onBack}><X size={14}/> Close workspace</button>}
    >
      <div className="workspace-head">
        <div><span>{hackathon.status || "DRAFT"}</span><b>{hackathon.track || "Open innovation"}</b></div>
        <div className="workspace-tabs">
          {["rounds", "teams", "submissions"].map((x) => <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x}</button>)}
        </div>
      </div>

      {loading ? <Loading /> : tab === "rounds" ? (
        rounds.length ? <div className="workspace-list">{rounds.map((r) => <div key={r.id || r.round_number}><b>Round {r.round_number}</b><span>{r.title || `Round ${r.round_number}`}</span><em>{r.status || "SCHEDULED"}</em></div>)}</div> : <Empty text="No rounds configured yet."/>
      ) : tab === "teams" ? (
        teams.length ? <div className="workspace-list">{teams.map((t) => <div key={t.id}><b>{t.name || "Team"}</b><span>{t.member_count ?? t.members?.length ?? 0} members</span><em>{t.status || "—"}</em></div>)}</div> : <Empty text="No teams found."/>
      ) : (
        submissions.length ? <div className="workspace-list">{submissions.map((s, i) => <div key={s.id || i}><b>{s.project_title || s.project?.title || "Submission"}</b><span>{s.team_name || s.team?.name || "Team"}</span><em>{s.status || "SUBMITTED"}</em></div>)}</div> : <Empty text="No submissions found."/>
      )}

      <div className="workspace-footer">
        <button className="outline-btn" onClick={() => { onBack(); onNavigate("rounds"); }}>Open Rounds</button>
        <button className="outline-btn" onClick={() => { onBack(); onNavigate("teams"); }}>Open Teams</button>
        <button className="primary-btn" onClick={() => { onBack(); onNavigate("submissions"); }}>Open Submissions</button>
      </div>
    </Panel>
  );
}

export default OrganizerPanel;
