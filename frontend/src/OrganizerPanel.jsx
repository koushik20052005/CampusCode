import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Edit3,
  FolderGit2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
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
  ["rounds", "Rounds & Schedule", Clock3],
  ["participants", "Participants", Users],
  ["teams", "Teams", Users],
  ["submissions", "Submissions", Send],
  ["rulebot", "RuleBot", Sparkles],
  ["leaderboard", "Leaderboard", Trophy],
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
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
        user={user}
        onLogout={onLogout}
      />

      <div className="organizer-main">
        <OrganizerTopbar
          user={user}
          onMenu={() => setSidebarOpen?.(true)}
          onLogout={onLogout}
          onNotifications={() => go("notifications")}
          onRefresh={refreshOrganizer}
          refreshing={refreshing}
        />

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

              {section === "rounds" && (
                <Rounds
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  onRefresh={load}
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

              {section === "teams" && (
                <Teams
                  hackathon={selected}
                  hackathons={hackathons}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              )}

              {section === "submissions" && (
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
        </main>
      </div>
    </div>
  );
}

function OrganizerSidebar({ section, navigate, open, user, onLogout }) {
  return (
    <aside className={`org-sidebar ${open ? "is-open" : ""}`}>
      <div className="org-brand-row">
        <button className="org-brand" onClick={() => navigate("dashboard")}>
          <span className="org-logo">
            <i />
            <i />
            <i />
          </span>
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
        {NAV.map(([key, label, Icon]) => (
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

function OrganizerTopbar({ user, onMenu, onLogout, onNotifications, onRefresh, refreshing }) {
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
        <button className="org-top-icon" onClick={onNotifications} title="Notifications" aria-label="Notifications">
          <Bell size={17} />
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
              <button className="outline-btn" onClick={() => onNavigate("rounds")}>
                Manage rounds <ArrowRight size={13} />
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

  const publish = (id) =>
    onRun(
      () => apiFetch(`/hackathons/${id}/publish`, { method: "POST" }),
      "Hackathon published. Registration is now open."
    );

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
              <article className={`hack-card ${String(selectedId) === String(h.id) ? "selected" : ""}`} key={h.id} style={{ "--delay": `${index * 55}ms` }}>
                <div className="hack-accent" />
                <div className="hack-main">
                  <div className="hack-title-row">
                    <h3>{h.title}</h3>
                    <span className={`status-pill ${statusClass(state)}`}>{state}</span>
                  </div>
                  <p className="hack-meta">{h.track || "No track"} · {h.location || "Online"}</p>
                  <p className="hack-description">{h.description || "No description."}</p>

                  <div className="hack-tags">
                    <span>Expected {dateText(h.expected_date || h.start_date)}</span>
                    <span>Max teams {h.max_teams ?? "—"}</span>
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((x) => ({ ...x, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.description.trim() || !form.track.trim()) {
      setError("Title, description and track are required.");
      return;
    }

    const maxTeams = Number(form.max_teams);
    if (!Number.isInteger(maxTeams) || maxTeams < 1) {
      setError("Maximum teams must be at least 1.");
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        track: form.track.trim(),
        location: form.location.trim(),
        expected_date: form.expected_date || null,
        max_teams: maxTeams,
      });
    } catch (err) {
      setError(err.message || "Failed to create hackathon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      eyebrow="Event operations"
      title="Create hackathon"
      description="Create a draft first. The expected date is informational; publication and round activation stay manual."
      action={<button className="outline-btn" onClick={onCancel}>Back</button>}
    >
      <form className="org-form" onSubmit={submit}>
        <Field label="Hackathon title" required>
          <input className="org-input" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Campus Innovation Challenge" />
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
        <Field label="Maximum teams" required>
          <input className="org-input" type="number" min="1" step="1" value={form.max_teams} onChange={(e) => update("max_teams", e.target.value)} />
        </Field>
        <Field label="Expected date">
          <input className="org-input" type="date" value={form.expected_date} onChange={(e) => update("expected_date", e.target.value)} />
        </Field>
        <Field label="Description" required full>
          <textarea className="org-input textarea" rows={7} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Explain the hackathon, challenge, eligibility and what participants should build..." />
        </Field>

        {error && <div className="form-error">{error}</div>}

        <div className="form-footer">
          <div>
            <b>Draft workflow</b>
            <span>Create → Submit approval → Publish → Go LIVE → activate R1/R2/R3 manually.</span>
          </div>
          <button className="primary-btn" disabled={saving}>
            {saving ? <><LoaderCircle size={14} className="spin"/> Creating...</> : <><Plus size={14}/> Create draft</>}
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

function Rounds({ hackathon, hackathons, selectedId, setSelectedId, onRefresh }) {
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
              <p>Status: {hackathon.status || "—"} · Current round: {hackathon.current_round ?? 1}</p>
            </div>
            <span className={`status-pill ${statusClass(hackathon.status)}`}>{hackathon.status || "DRAFT"}</span>
          </div>

          <div className="round-grid">
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

  const load = async (roundNumber = round) => {
    if (!hackathon?.id) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(
        `/organizer/round${roundNumber}/hackathons/${hackathon.id}/submissions`
      );
      const nextItems = arr(data, "submissions", "data");
      setItems(nextItems);
      return nextItems;
    } catch (e) {
      setItems([]);
      setError(e.message || `Unable to load Round ${roundNumber} submissions.`);
    } finally {
      setLoading(false);
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
    setSelectedSubmission(submission);
    setReviewScore(
      submission?.score !== null && submission?.score !== undefined
        ? String(submission.score)
        : ""
    );
    setReviewFeedback(submission?.organizer_feedback || "");
  };

  const closeSubmission = () => {
    if (reviewBusy) return;
    setSelectedSubmission(null);
    setReviewScore("");
    setReviewFeedback("");
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
            <span>AI: <b>{s.ai_analyzed_at ? "Analyzed" : "Pending"}</b></span>
            <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
          </div>
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
            <span>PDF: <b>{s.pdf_url || s.pdf_file_name || s.pdf_file_url ? "Provided" : "Missing"}</b></span>
            <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
          </div>
          {s.ai_analysis && (
            <div className="organizer-ai-metrics">
              <div><b>{s.ai_analysis.overall_score ?? "—"}</b><span>Overall</span></div>
              <div><b>{s.ai_analysis.novelty_score ?? "—"}</b><span>Novelty</span></div>
              <div><b>{s.ai_analysis.technical_score ?? "—"}</b><span>Technical</span></div>
              <div><b>{s.ai_analysis.impact_score ?? "—"}</b><span>Impact</span></div>
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
            <span>Submitted: {dateText(s.submitted_at || s.created_at)}</span>
          </div>
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
          <div className="submission-list organizer-submission-list">
            {items.map((s, i) =>
              round === 1
                ? renderRound1(s, i)
                : round === 2
                  ? renderRound2(s, i)
                  : renderRound3(s, i)
            )}
          </div>
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
        />
      )}
    </>
  );
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
}) {
  const id =
    submission?.id ||
    submission?.submission_id;

  const isRound3 =
    round === 3;

  const aiBusy =
    busy === `ai-${round}-${id}`;

  const decision =
    submission?.decision?.decision ||
    submission?.decision ||
    submission?.status ||
    "PENDING";

  const ai =
    submission?.ai_analysis ||
    submission?.ai ||
    {};

  const title =
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
          `Team ${submission?.team_id || "—"}`;

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

            {/* R2 METRICS */}
            {round === 2 && (
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
                      submission.pdf
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
        {submission?.organizer_feedback && (
          <div className="organizer-existing-feedback">
            <span>
              EXISTING ORGANIZER FEEDBACK
            </span>

            <p>
              {submission.organizer_feedback}
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

  return createPortal(modal, document.body);
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
