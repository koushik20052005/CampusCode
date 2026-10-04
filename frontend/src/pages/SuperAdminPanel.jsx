import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Globe2,
  LayoutDashboard,
  Menu,
  Network,
  Pause,
  Play,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./SuperAdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function unwrap(data, keys = []) {
  if (!data) return null;

  for (const key of keys) {
    if (data?.[key] !== undefined) {
      return data[key];
    }
  }

  return data;
}

function value(...values) {
  for (const item of values) {
    if (
      item !== undefined &&
      item !== null &&
      String(item).trim() !== ""
    ) {
      return item;
    }
  }

  return "—";
}

function formatTime(valueInput) {
  if (!valueInput) return "—";

  const date = new Date(valueInput);

  if (Number.isNaN(date.getTime())) {
    return String(valueInput);
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(valueInput) {
  if (!valueInput) return "—";

  const date = new Date(valueInput);

  if (Number.isNaN(date.getTime())) {
    return String(valueInput);
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function LoadingState() {
  return (
    <div className="superadmin-loading">
      <div className="superadmin-loading-core">
        <div className="superadmin-loading-shape">
          <span />
          <span />
          <span />
        </div>

        <strong>LOADING COMMAND CENTER</strong>
        <small>SYNCING CAMPUSCODE SYSTEMS</small>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  number,
  detail,
  accent = "lime",
}) {
  return (
    <article className={`superadmin-stat-card accent-${accent}`}>
      <div className="superadmin-stat-top">
        <div className="superadmin-stat-icon">
          <Icon size={17} strokeWidth={1.8} />
        </div>

        <span>{label}</span>
      </div>

      <strong>{number}</strong>

      <small>{detail}</small>
    </article>
  );
}

function StatusDot({ status }) {
  const normalized = String(status || "").toLowerCase();

  const good =
    normalized.includes("healthy") ||
    normalized.includes("connected") ||
    normalized.includes("ok") ||
    normalized.includes("active") ||
    normalized.includes("running");

  const bad =
    normalized.includes("error") ||
    normalized.includes("failed") ||
    normalized.includes("down") ||
    normalized.includes("critical");

  return (
    <i
      className={`superadmin-status-dot ${
        good ? "good" : bad ? "bad" : "neutral"
      }`}
    />
  );
}

function Blueprint({ nodes, connections, onNodeClick }) {
  const fallbackNodes = [
    {
      id: "frontend",
      name: "CampusCode Frontend",
      type: "APPLICATION",
      status: "ONLINE",
      x: 18,
      y: 50,
    },
    {
      id: "api",
      name: "Express API",
      type: "BACKEND",
      status: "ONLINE",
      x: 38,
      y: 50,
    },
    {
      id: "database",
      name: "Neon PostgreSQL",
      type: "DATABASE",
      status: "ONLINE",
      x: 62,
      y: 34,
    },
    {
      id: "gemini",
      name: "Gemini AI",
      type: "AI ENGINE",
      status: "CONNECTED",
      x: 62,
      y: 66,
    },
    {
      id: "monitoring",
      name: "Monitoring",
      type: "OBSERVABILITY",
      status: "ACTIVE",
      x: 84,
      y: 50,
    },
  ];

  const finalNodes =
    Array.isArray(nodes) && nodes.length ? nodes : fallbackNodes;

  const finalConnections =
    Array.isArray(connections) && connections.length
      ? connections
      : [
          { from: "frontend", to: "api" },
          { from: "api", to: "database" },
          { from: "api", to: "gemini" },
          { from: "api", to: "monitoring" },
        ];

  const nodeMap = useMemo(() => {
    const map = {};

    finalNodes.forEach((node) => {
      map[String(node.id)] = node;
    });

    return map;
  }, [finalNodes]);

  return (
    <div className="superadmin-blueprint">
      <div className="blueprint-grid" />

      <div className="blueprint-label blueprint-label-a">
        CAMPUSCODE / SYSTEM MAP
      </div>

      <div className="blueprint-label blueprint-label-b">
        LIVE ARCHITECTURE
      </div>

      <div className="blueprint-core">
        <div className="blueprint-core-ring ring-a" />
        <div className="blueprint-core-ring ring-b" />
        <div className="blueprint-core-inner">
          <Network size={25} />
          <span>CORE</span>
        </div>
      </div>

      <svg
        className="blueprint-lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {finalConnections.map((connection, index) => {
          const from =
            nodeMap[String(connection.from || connection.source)];

          const to =
            nodeMap[String(connection.to || connection.target)];

          if (!from || !to) return null;

          return (
            <g key={`${connection.from}-${connection.to}-${index}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="blueprint-line"
              />

              <circle
                cx={from.x}
                cy={from.y}
                r="0.8"
                className="blueprint-packet"
              >
                <animate
                  attributeName="cx"
                  values={`${from.x};${to.x};${from.x}`}
                  dur="3.5s"
                  repeatCount="indefinite"
                />

                <animate
                  attributeName="cy"
                  values={`${from.y};${to.y};${from.y}`}
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {finalNodes.map((node) => (
        <button
          key={node.id}
          type="button"
          className="blueprint-node"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
          }}
          onClick={() => onNodeClick(node)}
        >
          <span className="blueprint-node-pulse" />

          <span className="blueprint-node-icon">
            {String(node.type || "").toLowerCase().includes("database") ? (
              <Database size={15} />
            ) : String(node.type || "")
                .toLowerCase()
                .includes("ai") ? (
              <BrainCircuit size={15} />
            ) : String(node.type || "")
                .toLowerCase()
                .includes("backend") ? (
              <Server size={15} />
            ) : (
              <Boxes size={15} />
            )}
          </span>

          <span className="blueprint-node-copy">
            <strong>{value(node.name, node.id)}</strong>
            <small>{value(node.type, "SERVICE")}</small>
          </span>

          <StatusDot status={node.status} />
        </button>
      ))}

      <div className="blueprint-scale">
        <span />
        <span />
        <span />
        <small>SYSTEM FLOW</small>
      </div>
    </div>
  );
}

export default function SuperAdminPanel() {
  const [view, setView] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [errors, setErrors] = useState([]);
  const [responseTime, setResponseTime] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [activity, setActivity] = useState([]);
  const [maintenance, setMaintenance] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);

  const [maintenanceUpdating, setMaintenanceUpdating] =
    useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const results = await Promise.allSettled([
        apiFetch("/superadmin/overview"),
        apiFetch("/superadmin/health"),
        apiFetch("/superadmin/stats"),
        apiFetch("/superadmin/requests"),
        apiFetch("/superadmin/errors"),
        apiFetch("/superadmin/response-time"),
        apiFetch("/superadmin/blueprint"),
        apiFetch("/superadmin/activity"),
        apiFetch("/superadmin/maintenance"),
      ]);

      const failures = [];

      if (results[0].status === "fulfilled") {
        setOverview(results[0].value);
      } else {
        failures.push(results[0].reason?.message);
      }

      if (results[1].status === "fulfilled") {
        setHealth(results[1].value);
      } else {
        failures.push(results[1].reason?.message);
      }

      if (results[2].status === "fulfilled") {
        setStats(results[2].value);
      } else {
        failures.push(results[2].reason?.message);
      }

      if (results[3].status === "fulfilled") {
        setRequests(
          unwrap(results[3].value, [
            "requests",
            "logs",
            "items",
            "data",
          ]) || []
        );
      } else {
        failures.push(results[3].reason?.message);
      }

      if (results[4].status === "fulfilled") {
        setErrors(
          unwrap(results[4].value, [
            "errors",
            "logs",
            "items",
            "data",
          ]) || []
        );
      } else {
        failures.push(results[4].reason?.message);
      }

      if (results[5].status === "fulfilled") {
        setResponseTime(results[5].value);
      } else {
        failures.push(results[5].reason?.message);
      }

      if (results[6].status === "fulfilled") {
        setBlueprint(
          unwrap(results[6].value, [
            "blueprint",
            "system",
            "data",
          ]) || {}
        );
      } else {
        failures.push(results[6].reason?.message);
      }

      if (results[7].status === "fulfilled") {
        setActivity(
          unwrap(results[7].value, [
            "activity",
            "logs",
            "items",
            "data",
          ]) || []
        );
      } else {
        failures.push(results[7].reason?.message);
      }

      if (results[8].status === "fulfilled") {
        setMaintenance(results[8].value);
      } else {
        failures.push(results[8].reason?.message);
      }

      if (failures.length) {
        setError(
          failures.filter(Boolean).slice(0, 2).join(" · ")
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();

    const interval = setInterval(() => {
      load(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [load]);

  const openNode = async (node) => {
    setSelectedNode(node);
    setNodeDetails(null);

    try {
      const result = await apiFetch(
        `/superadmin/blueprint/${encodeURIComponent(node.id)}`
      );

      setNodeDetails(
        unwrap(result, ["node", "data"]) || result
      );
    } catch {
      setNodeDetails(node);
    }
  };

  const toggleMaintenance = async () => {
    if (maintenanceUpdating) return;

    const current =
      maintenance?.enabled ??
      maintenance?.maintenance_mode ??
      false;

    setMaintenanceUpdating(true);

    try {
      const result = await apiFetch(
        "/superadmin/maintenance",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled: !current,
          }),
        }
      );

      setMaintenance(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setMaintenanceUpdating(false);
    }
  };

  const clearTelemetry = async () => {
    try {
      await apiFetch("/superadmin/telemetry", {
        method: "DELETE",
      });

      await load(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const overviewData =
    overview?.data ||
    overview?.overview ||
    overview ||
    {};

  const statsData =
    stats?.statistics ||
    stats?.stats ||
    stats?.data ||
    stats ||
    {};

  const totalUsers =
    statsData.total_users ??
    overviewData.total_users ??
    overviewData.users ??
    0;

  const activeUsers =
    statsData.active_users ??
    overviewData.active_users ??
    0;

  const hackathons =
    statsData.total_hackathons ??
    overviewData.total_hackathons ??
    overviewData.hackathons ??
    0;

  const teams =
    statsData.total_teams ??
    overviewData.total_teams ??
    overviewData.teams ??
    0;

  const submissions =
    statsData.total_submissions ??
    overviewData.total_submissions ??
    overviewData.submissions ??
    0;

  const blueprintData = blueprint || {};

  const blueprintNodes =
    blueprintData.nodes ||
    blueprintData.services ||
    [];

  const blueprintConnections =
    blueprintData.connections ||
    blueprintData.edges ||
    [];

  const maintenanceEnabled =
    maintenance?.enabled ??
    maintenance?.maintenance_mode ??
    false;

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "blueprint",
      label: "System Blueprint",
      icon: Network,
    },
    {
      id: "live",
      label: "Live Requests",
      icon: Activity,
    },
    {
      id: "errors",
      label: "Errors",
      icon: AlertTriangle,
    },
    {
      id: "activity",
      label: "Activity",
      icon: Bell,
    },
  ];

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="superadmin-panel">
      <div className="superadmin-bg-grid" />
      <div className="superadmin-bg-orb orb-one" />
      <div className="superadmin-bg-orb orb-two" />

      <header className="superadmin-mobile-topbar">
        <button
          type="button"
          className="superadmin-mobile-menu"
          onClick={() => setMobileOpen((current) => !current)}
        >
          <Menu size={19} />
        </button>

        <div className="superadmin-mobile-brand">
          <strong>CAMPUSCODE</strong>
          <span>SUPER ADMIN</span>
        </div>

        <button
          type="button"
          className="superadmin-mobile-refresh"
          onClick={() => load(true)}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "spin" : ""}
          />
        </button>
      </header>

      <aside
        className={`superadmin-sidebar ${
          mobileOpen ? "open" : ""
        }`}
      >
        <div className="superadmin-brand">
          <div className="superadmin-brand-mark">
            <span>C</span>
          </div>

          <div>
            <strong>CAMPUSCODE</strong>
            <small>SUPER ADMIN</small>
          </div>
        </div>

        <div className="superadmin-sidebar-label">
          COMMAND
        </div>

        <nav className="superadmin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.id}
                className={`superadmin-nav-item ${
                  view === item.id ? "active" : ""
                }`}
                onClick={() => {
                  setView(item.id);
                  setMobileOpen(false);
                }}
              >
                <span className="superadmin-nav-icon">
                  <Icon size={17} />
                </span>

                <span>{item.label}</span>

                {view === item.id && <b>›</b>}
              </button>
            );
          })}
        </nav>

        <div className="superadmin-sidebar-label">
          SYSTEM
        </div>

        <div className="superadmin-system-mini">
          <div>
            <StatusDot status={health?.status} />
            <span>API</span>
            <strong>
              {String(health?.status || "UNKNOWN").toUpperCase()}
            </strong>
          </div>

          <div>
            <StatusDot status={health?.database} />
            <span>DATABASE</span>
            <strong>
              {String(
                health?.database || "UNKNOWN"
              ).toUpperCase()}
            </strong>
          </div>

          <div>
            <StatusDot
              status={maintenanceEnabled ? "maintenance" : "active"}
            />
            <span>MODE</span>
            <strong>
              {maintenanceEnabled
                ? "MAINTENANCE"
                : "LIVE"}
            </strong>
          </div>
        </div>

        <div className="superadmin-sidebar-bottom">
          <div className="superadmin-sidebar-user">
            <div className="superadmin-avatar">
              SA
            </div>

            <div>
              <strong>SUPER ADMIN</strong>
              <span>FULL PLATFORM ACCESS</span>
            </div>
          </div>

          <button
            type="button"
            className="superadmin-refresh-sidebar"
            onClick={() => load(true)}
          >
            <RefreshCw
              size={14}
              className={refreshing ? "spin" : ""}
            />
            REFRESH SYSTEM
          </button>
        </div>
      </aside>

      <main className="superadmin-main">
        <header className="superadmin-topbar">
          <div>
            <span className="superadmin-eyebrow">
              CAMPUSCODE / SUPER ADMIN
            </span>

            <h1>
              {view === "overview"
                ? "SYSTEM OVERVIEW."
                : view === "blueprint"
                ? "SYSTEM BLUEPRINT."
                : view === "live"
                ? "LIVE REQUESTS."
                : view === "errors"
                ? "ERROR MONITOR."
                : "SYSTEM ACTIVITY."}
            </h1>
          </div>

          <div className="superadmin-top-actions">
            <div className="superadmin-live-status">
              <i />
              LIVE MONITORING
            </div>

            <button
              type="button"
              className="superadmin-refresh-btn"
              onClick={() => load(true)}
            >
              <RefreshCw
                size={14}
                className={refreshing ? "spin" : ""}
              />
              REFRESH
            </button>
          </div>
        </header>

        <div className="superadmin-content">
          {error && (
            <div className="superadmin-alert">
              <AlertCircle size={15} />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {view === "overview" && (
            <>
              <section className="superadmin-welcome">
                <div>
                  <span className="superadmin-section-kicker">
                    PLATFORM CONTROL
                  </span>

                  <h2>
                    THE CAMPUSCODE
                    <br />
                    <em>COMMAND CENTER.</em>
                  </h2>

                  <p>
                    Monitor the complete CampusCode ecosystem
                    from one operational surface. Backend,
                    database, AI, users, hackathons and
                    platform activity remain visible here.
                  </p>

                  <div className="superadmin-welcome-meta">
                    <span>
                      <i />
                      API{" "}
                      {health?.status === "healthy"
                        ? "HEALTHY"
                        : "CONNECTED"}
                    </span>

                    <span>
                      <i />
                      POSTGRESQL{" "}
                      {health?.database || "CONNECTED"}
                    </span>

                    <span>
                      <i />
                      GEMINI{" "}
                      {health?.gemini || "CONFIGURED"}
                    </span>
                  </div>
                </div>

                <div className="superadmin-welcome-visual">
                  <div className="superadmin-visual-ring ring-one" />
                  <div className="superadmin-visual-ring ring-two" />
                  <div className="superadmin-visual-ring ring-three" />

                  <div className="superadmin-visual-core">
                    <Network size={28} />
                    <span>CC</span>
                  </div>

                  <i className="visual-dot dot-a" />
                  <i className="visual-dot dot-b" />
                  <i className="visual-dot dot-c" />
                </div>
              </section>

              <section className="superadmin-stats-grid">
                <StatCard
                  icon={Users}
                  label="Total Users"
                  number={totalUsers}
                  detail="Live from CampusCode backend"
                />

                <StatCard
                  icon={Trophy}
                  label="Hackathons"
                  number={hackathons}
                  detail="Registered platform events"
                  accent="dark"
                />

                <StatCard
                  icon={Boxes}
                  label="Teams"
                  number={teams}
                  detail="Teams across hackathons"
                  accent="soft"
                />

                <StatCard
                  icon={BarChart3}
                  label="Submissions"
                  number={submissions}
                  detail="R1 / R2 / R3 records"
                  accent="lime"
                />
              </section>

              <section className="superadmin-two-column">
                <article className="superadmin-card">
                  <div className="superadmin-card-head">
                    <div>
                      <span>HEALTH</span>
                      <h3>System signals</h3>
                    </div>

                    <Server size={18} />
                  </div>

                  <div className="superadmin-signal">
                    <div>
                      <StatusDot status={health?.status} />
                      <span>Backend API</span>
                    </div>

                    <strong>
                      {value(health?.status)}
                    </strong>
                  </div>

                  <div className="superadmin-signal">
                    <div>
                      <StatusDot status={health?.database} />
                      <span>PostgreSQL</span>
                    </div>

                    <strong>
                      {value(health?.database)}
                    </strong>
                  </div>

                  <div className="superadmin-signal">
                    <div>
                      <StatusDot status={health?.gemini} />
                      <span>Gemini AI</span>
                    </div>

                    <strong>
                      {value(health?.gemini)}
                    </strong>
                  </div>

                  <div className="superadmin-signal">
                    <div>
                      <StatusDot status="active" />
                      <span>Monitoring</span>
                    </div>

                    <strong>ACTIVE</strong>
                  </div>
                </article>

                <article className="superadmin-card">
                  <div className="superadmin-card-head">
                    <div>
                      <span>TELEMETRY</span>
                      <h3>Runtime snapshot</h3>
                    </div>

                    <Activity size={18} />
                  </div>

                  <div className="superadmin-runtime-grid">
                    <div>
                      <small>REQUESTS</small>
                      <strong>{requests.length}</strong>
                    </div>

                    <div>
                      <small>ERRORS</small>
                      <strong>{errors.length}</strong>
                    </div>

                    <div>
                      <small>AVG RESPONSE</small>
                      <strong>
                        {value(
                          responseTime?.average,
                          responseTime?.avg,
                          "—"
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>ACTIVE USERS</small>
                      <strong>{activeUsers}</strong>
                    </div>
                  </div>

                  <div className="superadmin-runtime-footer">
                    <Clock3 size={13} />
                    Auto-refresh every 10 seconds
                  </div>
                </article>
              </section>

              <section className="superadmin-card superadmin-blueprint-preview">
                <div className="superadmin-card-head">
                  <div>
                    <span>ARCHITECTURE</span>
                    <h3>CampusCode Blueprint</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setView("blueprint")}
                  >
                    OPEN BLUEPRINT
                    <ChevronRight size={14} />
                  </button>
                </div>

                <Blueprint
                  nodes={blueprintNodes}
                  connections={blueprintConnections}
                  onNodeClick={openNode}
                />
              </section>
            </>
          )}

          {view === "blueprint" && (
            <section className="superadmin-page-card">
              <div className="superadmin-page-heading">
                <div>
                  <span>SYSTEM / ARCHITECTURE</span>
                  <h2>CampusCode Blueprint.</h2>
                  <p>
                    Visual map of the services powering the
                    CampusCode platform.
                  </p>
                </div>

                <div className="superadmin-blueprint-legend">
                  <span>
                    <i />
                    ONLINE
                  </span>

                  <span>
                    <i />
                    DATA FLOW
                  </span>
                </div>
              </div>

              <Blueprint
                nodes={blueprintNodes}
                connections={blueprintConnections}
                onNodeClick={openNode}
              />
            </section>
          )}

          {view === "live" && (
            <section className="superadmin-page-card">
              <div className="superadmin-page-heading">
                <div>
                  <span>OBSERVABILITY / REQUESTS</span>
                  <h2>Live API traffic.</h2>
                  <p>
                    Recent requests recorded by the CampusCode
                    monitoring layer.
                  </p>
                </div>

                <div className="superadmin-page-count">
                  {requests.length} EVENTS
                </div>
              </div>

              <div className="superadmin-table">
                <div className="superadmin-table-head">
                  <span>METHOD</span>
                  <span>PATH</span>
                  <span>STATUS</span>
                  <span>TIME</span>
                  <span>RECORDED</span>
                </div>

                {requests.length ? (
                  requests.map((request, index) => (
                    <div
                      className="superadmin-table-row"
                      key={
                        request.id ||
                        `${request.path}-${index}`
                      }
                    >
                      <strong>
                        {value(request.method, "GET")}
                      </strong>

                      <span className="mono">
                        {value(
                          request.path,
                          request.url,
                          "—"
                        )}
                      </span>

                      <span
                        className={`table-status ${
                          Number(request.status || request.statusCode) >=
                          400
                            ? "bad"
                            : "good"
                        }`}
                      >
                        {value(
                          request.status,
                          request.statusCode,
                          "200"
                        )}
                      </span>

                      <span>
                        {value(
                          request.response_time,
                          request.responseTime,
                          request.duration,
                          "—"
                        )}
                      </span>

                      <span>
                        {formatTime(
                          request.created_at ||
                            request.timestamp
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="superadmin-empty">
                    <Activity size={22} />
                    <strong>NO REQUEST TELEMETRY</strong>
                    <span>
                      Requests will appear here as the
                      monitoring layer records activity.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "errors" && (
            <section className="superadmin-page-card">
              <div className="superadmin-page-heading">
                <div>
                  <span>OBSERVABILITY / FAILURES</span>
                  <h2>Error monitor.</h2>
                  <p>
                    Runtime errors recorded by the CampusCode
                    monitoring layer.
                  </p>
                </div>

                <button
                  type="button"
                  className="superadmin-danger-btn"
                  onClick={clearTelemetry}
                >
                  <Trash2 size={14} />
                  CLEAR TELEMETRY
                </button>
              </div>

              <div className="superadmin-error-list">
                {errors.length ? (
                  errors.map((item, index) => (
                    <article
                      className="superadmin-error-item"
                      key={item.id || index}
                    >
                      <div className="superadmin-error-icon">
                        <AlertTriangle size={16} />
                      </div>

                      <div>
                        <strong>
                          {value(
                            item.message,
                            item.error,
                            "Unknown error"
                          )}
                        </strong>

                        <span>
                          {value(
                            item.path,
                            item.url,
                            "Unknown route"
                          )}{" "}
                          ·{" "}
                          {formatTime(
                            item.created_at ||
                              item.timestamp
                          )}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="superadmin-empty">
                    <CheckCircle2 size={24} />
                    <strong>NO RECORDED ERRORS</strong>
                    <span>
                      The current telemetry buffer contains
                      no recorded runtime errors.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "activity" && (
            <section className="superadmin-page-card">
              <div className="superadmin-page-heading">
                <div>
                  <span>PLATFORM / ACTIVITY</span>
                  <h2>System activity.</h2>
                  <p>
                    Recent events and operational activity from
                    the CampusCode platform.
                  </p>
                </div>

                <div className="superadmin-page-count">
                  {activity.length} EVENTS
                </div>
              </div>

              <div className="superadmin-activity-list">
                {activity.length ? (
                  activity.map((item, index) => (
                    <article
                      className="superadmin-activity-item"
                      key={item.id || index}
                    >
                      <div className="superadmin-activity-icon">
                        <Bell size={15} />
                      </div>

                      <div className="superadmin-activity-main">
                        <strong>
                          {value(
                            item.title,
                            item.action,
                            item.event,
                            "System activity"
                          )}
                        </strong>

                        <span>
                          {value(
                            item.description,
                            item.message,
                            item.path,
                            "CampusCode platform event"
                          )}
                        </span>
                      </div>

                      <time>
                        {formatTime(
                          item.created_at ||
                            item.timestamp
                        )}
                      </time>
                    </article>
                  ))
                ) : (
                  <div className="superadmin-empty">
                    <Bell size={22} />
                    <strong>NO ACTIVITY</strong>
                    <span>
                      Recent platform activity will appear
                      here.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="superadmin-maintenance-card">
            <div className="superadmin-maintenance-icon">
              {maintenanceEnabled ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </div>

            <div className="superadmin-maintenance-copy">
              <span>SYSTEM CONTROL</span>
              <h3>
                {maintenanceEnabled
                  ? "Maintenance mode is active."
                  : "CampusCode is operating normally."}
              </h3>

              <p>
                Maintenance mode controls the platform state
                exposed by the Super Admin control layer.
              </p>
            </div>

            <button
              type="button"
              className={`superadmin-maintenance-btn ${
                maintenanceEnabled ? "active" : ""
              }`}
              onClick={toggleMaintenance}
              disabled={maintenanceUpdating}
            >
              {maintenanceUpdating
                ? "UPDATING..."
                : maintenanceEnabled
                ? "DISABLE"
                : "ENABLE"}
            </button>
          </section>
        </div>
      </main>

      {selectedNode && (
        <div
          className="superadmin-node-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedNode(null);
            }
          }}
        >
          <div className="superadmin-node-modal">
            <button
              type="button"
              className="superadmin-node-close"
              onClick={() => setSelectedNode(null)}
            >
              <X size={17} />
            </button>

            <div className="superadmin-node-modal-icon">
              <Network size={21} />
            </div>

            <span>BLUEPRINT NODE</span>

            <h2>
              {value(
                nodeDetails?.name,
                selectedNode.name,
                selectedNode.id
              )}
            </h2>

            <p>
              {value(
                nodeDetails?.description,
                selectedNode.description,
                "CampusCode system service"
              )}
            </p>

            <div className="superadmin-node-details">
              <div>
                <small>TYPE</small>
                <strong>
                  {value(
                    nodeDetails?.type,
                    selectedNode.type
                  )}
                </strong>
              </div>

              <div>
                <small>STATUS</small>
                <strong>
                  {value(
                    nodeDetails?.status,
                    selectedNode.status
                  )}
                </strong>
              </div>

              <div>
                <small>NODE ID</small>
                <strong className="mono">
                  {value(
                    nodeDetails?.id,
                    selectedNode.id
                  )}
                </strong>
              </div>
            </div>

            <div className="superadmin-node-footer">
              <CheckCircle2 size={14} />
              BACKEND NODE DATA CONNECTED
            </div>
          </div>
        </div>
      )}
    </div>
  );
}