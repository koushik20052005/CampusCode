import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Trophy, Clock3, Users, FolderGit2, Send, Code2,
  Sparkles, Bell, IdCard, UserCircle, Bot, ExternalLink, Link as LinkIcon,
  LoaderCircle, CheckCircle2, Terminal, Award, Zap
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./StudentPanel.css";
import CampusCodeLoader from "./components/ui/CampusCodeLoader";
import CampusCodeRefresh from "./components/ui/CampusCodeRefresh";
import { useLiveNotifications, NotificationToasts } from "./notifications";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof data === "object" ? data?.message : data;
    throw new Error(message || `Request failed (${response.status})`);
  }

  return data;
}

function unwrapList(data, keys = []) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function dedupeHackathons(items = []) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.hackathon_id || item?.hackathon?.id || item?.id || item?.slug || item?.code || "");
    if (!id) continue;
    const existing = map.get(id);
    map.set(id, existing ? { ...existing, ...item, hackathon: item.hackathon || existing.hackathon } : item);
  }
  return [...map.values()];
}

const COMPLETED_STATUSES = new Set(["COMPLETED", "COMPLETE", "FINISHED", "CLOSED", "ARCHIVED"]);

function isCompletedStatus(status) {
  return COMPLETED_STATUSES.has(String(status || "").trim().toUpperCase());
}

function isCompletedRecord(record) {
  if (!record) return false;
  return isCompletedStatus(record.status) || isCompletedStatus(record.round_status) ||
    Boolean(record.completed_at || record.completedAt);
}

function getRoundRecord(payload, roundNumber) {
  const key = `round${roundNumber}`;
  return payload?.round || payload?.[key] || payload?.data?.round || payload?.data?.[key] || {};
}

function isRoundCompleted(payload, roundNumber) {
  const round = getRoundRecord(payload, roundNumber);
  if (isCompletedRecord(round)) return true;
  if (roundNumber === 3) {
    const hackathon = payload?.hackathon || payload?.data?.hackathon || {};
    return isCompletedRecord(hackathon) || Number(hackathon?.current_round) === 4;
  }
  return false;
}

function CompletionStamp({ round, compact = false }) {
  const label = round ? `ROUND ${round}` : "HACKATHON";
  return (
    <div className={`student-completed-stamp ${compact ? "compact" : ""}`} aria-label={`${label} Completed`}>
      <span>CAMPUSCODE</span>
      <strong>{label}</strong>
      <b>COMPLETED ✓</b>
    </div>
  );
}

function value(...values) {
  return values.find((item) => item !== undefined && item !== null && item !== "") ?? "—";
}

function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CCMark({ small = false }) {
  return (
    <span className={`cc-mark ${small ? "cc-mark-small" : ""}`} aria-label="CampusCode logo">
      <span />
      <span />
      <span />
    </span>
  );
}

/* v6.1 — deterministic brand mark for hackathons: gradient tile
   with initials, derived from the title so every hackathon gets
   its own stable "logo". */
const MARK_GRADIENTS = [
  ["#a7f37a", "#4c7a12"],
  ["#7c5cff", "#2e1a8f"],
  ["#141414", "#4a4a4a"],
  ["#9ed41f", "#1d6f5f"],
  ["#b8e62e", "#7c5cff"],
  ["#ffcf5c", "#e07b39"],
];
function initialsOf(text) {
  const words = String(text || "?").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
function gradientFor(text) {
  let h = 0;
  for (const ch of String(text || "?")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MARK_GRADIENTS[h % MARK_GRADIENTS.length];
}
function HackathonMark({ title, size = 54 }) {
  const [from, to] = gradientFor(title);
  return (
    <span
      className="hack-mark"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(13, Math.round(size * 0.34)),
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {initialsOf(title)}
    </span>
  );
}
/* v6.18 — event banner (banner system): the organizer's web banner
   on desktop and mobile banner on phones. When only one is set it
   is used on both. When neither is set nothing renders, so old
   events keep their existing look. */
function EventBanner({ web, mobile, title }) {
  const webUrl = String(web || "").trim();
  const mobileUrl = String(mobile || "").trim();
  if (!webUrl && !mobileUrl) return null;
  const alt = title ? `${title} banner` : "Event banner";
  if (webUrl && mobileUrl) {
    return (
      <div className="event-banner">
        <img className="event-banner-web" src={webUrl} alt={alt} loading="lazy" />
        <img className="event-banner-mobile" src={mobileUrl} alt={alt} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="event-banner">
      <img className="event-banner-single" src={webUrl || mobileUrl} alt={alt} loading="lazy" />
    </div>
  );
}

/* v6.1 — member avatar: initials circle with stable gradient */
function MemberAvatar({ name, size = 34 }) {
  const [from, to] = gradientFor(name);
  return (
    <span
      className="member-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.32)),
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

/* v6.3 — Snapchat-style character avatar (Style A).
   Deterministic from the name: skin, hair, background are stable
   per student, no uploads needed. */
const AVATAR_SKINS = ["#ffd9b3", "#f1c27d", "#e0ac69", "#c68642", "#8d5524"];
const AVATAR_HAIRS = ["#1c1c1c", "#4a3221", "#8a5a2b", "#d9a441", "#9a9a9a", "#7c5cff"];
const AVATAR_BGS = ["#e8f5d6", "#e3e0ff", "#ffe8d6", "#d6f0ff", "#f3e8ff", "#dff5e1"];
function avatarHash(str) {
  let h = 0;
  for (const ch of String(str || "?")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
function StudentAvatar({ name, size = 40 }) {
  const h = avatarHash(name);
  const skin = AVATAR_SKINS[h % AVATAR_SKINS.length];
  const hair = AVATAR_HAIRS[(h >> 3) % AVATAR_HAIRS.length];
  const bg = AVATAR_BGS[(h >> 6) % AVATAR_BGS.length];
  const hairStyle = h % 3;
  const smile = h % 2 === 0;
  const gid = `av${h % 9973}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="student-avatar"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="50" fill={bg} />
      <circle cx="50" cy="46" r="26" fill={skin} />
      {hairStyle === 0 && (
        <path d="M20 38 Q20 14 50 14 Q80 14 80 38 Q72 26 60 28 Q52 18 40 26 Q28 24 20 38Z" fill={hair} />
      )}
      {hairStyle === 1 && (
        <g fill={hair}>
          <path d="M20 40 Q18 12 50 12 Q82 12 80 40 L74 34 Q70 22 50 22 Q30 22 26 34Z" />
          <rect x="20" y="30" width="8" height="18" rx="4" />
          <rect x="72" y="30" width="8" height="18" rx="4" />
        </g>
      )}
      {hairStyle === 2 && (
        <g fill={hair}>
          <path d="M22 36 Q24 10 50 10 Q76 10 78 36 Q60 24 50 30 Q40 24 22 36Z" />
          <circle cx="50" cy="12" r="7" />
        </g>
      )}
      <circle cx="41" cy="46" r="3.4" fill="#1c1c1c" />
      <circle cx="59" cy="46" r="3.4" fill="#1c1c1c" />
      <circle cx="42" cy="45" r="1.1" fill="#fff" />
      <circle cx="60" cy="45" r="1.1" fill="#fff" />
      <path
        d={smile ? "M44 56 Q50 61 56 56" : "M44 56 Q50 58 56 56"}
        stroke="#1c1c1c"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="35" cy="53" rx="4" ry="2.6" fill="#ff9d9d" opacity=".55" />
      <ellipse cx="65" cy="53" rx="4" ry="2.6" fill="#ff9d9d" opacity=".55" />
      <path d="M34 78 Q50 70 66 78 L64 100 L36 100Z" fill="#7c5cff" />
    </svg>
  );
}

function Brand({ mobile = false }) {
  return (
    <div className={mobile ? "student-mobile-brand" : "student-brand"}>
      <CCMark small={mobile} />
      <div>
        <strong>CAMPUSCODE</strong>
        <span>HACKATHON ARENA</span>
      </div>
    </div>
  );
}

function LoadingState({ label = "" }) {
  return (
    <div className="student-loading-shell">
      <CampusCodeLoader fullScreen={false} text={label} />
    </div>
  );
}

function ErrorState({ message, retry }) {
  return (
    <div className="student-state student-state-error">
      <strong>BACKEND REQUEST FAILED</strong>
      <span>{message}</span>
      {retry && <button onClick={retry}>RETRY</button>}
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="student-empty">
      <CCMark small />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function PageHeading({ eyebrow, title, text, count }) {
  return (
    <div className="student-page-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {count !== undefined && <div className="student-counter"><strong>{String(count).padStart(2, "0")}</strong><span>LIVE DATA</span></div>}
    </div>
  );
}

function StatCard({ label, number, detail }) {
  return (
    <div className="student-stat-card">
      <span>{label}</span>
      <strong>{number}</strong>
      <small>{detail}</small>
    </div>
  );
}

function OverviewPage({ navigate, studentName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/student/dashboard");
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={load} />;

  const stats = data?.stats || {};
  const current = data?.current_event || data?.current_hackathon || null;
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const dashboardUser = data?.user || {};

  return (
    <section>
      <PageHeading
        eyebrow="STUDENT WORKSPACE / LIVE"
        title={<>{`WELCOME BACK, `}<span className="name-highlight">{String(dashboardUser.name || studentName || "STUDENT").split(" ")[0].toUpperCase()}</span>{`.`}</>}
        text="Your CampusCode activity is loaded directly from the backend."
      />

      <div className="student-hero">
        <div className="student-hero-copy">
          <span>BUILD · LEARN · COLLABORATE</span>
          <h2>{value(current?.title, current?.name, current?.hackathon_name)}</h2>
          <p>{current ? value(current.description, current.short_description) : "No current hackathon is assigned to your account."}</p>
          {current && (
            <button onClick={() => navigate("Events")} className="student-primary-btn">OPEN EVENT <b>↗</b></button>
          )}
        </div>
        <div className="student-hero-avatars">
          <StudentAvatar name={String(dashboardUser?.name || studentName || "STUDENT")} size={88} />
          {current && <HackathonMark title={value(current.title, current.name, current.hackathon_name)} size={64} />}
        </div>
      </div>

      <div className="student-stats-grid">
        <StatCard label="REGISTERED" number={value(stats.registered, stats.registered_count)} detail="FROM BACKEND" />
        <StatCard label="ONGOING" number={value(stats.ongoing, stats.ongoing_count)} detail="FROM BACKEND" />
        <StatCard label="COMPLETED" number={value(stats.completed, stats.completed_count)} detail="FROM BACKEND" />
        <StatCard label="CERTIFICATES" number={value(stats.certificates, stats.certificate_count)} detail="FROM BACKEND" />
      </div>

      <DashboardDiscover navigate={navigate} />

      <StudentEnrich stats={stats} navigate={navigate} />

      <div className="student-two-col">
        <div className="student-panel-card">
          <div className="student-panel-title"><span>01 / CURRENT ACTIVITY</span><button onClick={() => navigate("Events")}>VIEW EVENTS ↗</button></div>
          {current ? (
            <div className="current-event">
              <div className="current-event-code">{value(current.code, current.slug, current.id)}</div>
              <h3>{value(current.title, current.name, current.hackathon_name)}</h3>
              <div className="current-event-meta">
                <span>{value(current.status)}</span>
                <span>{value(current.mode, current.event_mode)}</span>
                <span>{formatDate(current.start_date || current.startDate)}</span>
              </div>
            </div>
          ) : <EmptyState title="NO CURRENT ACTIVITY" text="The backend has not returned a current hackathon for this student." />}
        </div>

        <div className="student-panel-card">
          <div className="student-panel-title"><span>02 / NOTIFICATIONS</span><button onClick={() => navigate("Notifications")}>OPEN ALL ↗</button></div>
          {(() => { const _unread = (notifications || []).filter((n) => !n.is_read && n.is_read !== 1 && n.read_at == null && n.readAt == null); return _unread.length ? (
            <div className="notification-mini-list">
              {_unread.slice(0, 4).map((item, index) => (
                <div className="notification-mini" key={item.id || index}>
                  <span className="live-dot" />
                  <div><strong>{value(item.title, item.subject, item.message)}</strong><small>{value(item.body, item.message, item.description)}</small></div>
                  <time>{formatDate(item.created_at || item.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : <EmptyState title="ALL CAUGHT UP" text="No unread notifications." />})()}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   v6 — dashboard enrichment: deadlines, AI spotlight, journey
========================================================= */
function StudentEnrich({ stats, navigate }) {
  const [deadlines, setDeadlines] = useState([]);
  const [dlLoading, setDlLoading] = useState(true);

  useEffect(() => {
    apiFetch("/student/hackathons/my-hackathons")
      .then((r) => {
        const list = unwrapList(r, ["hackathons", "registrations", "items", "data"]);
        const upcoming = list
          .map((h) => ({
            title: value(h.title, h.name, h.hackathon_name, h.hackathon?.title, "Hackathon"),
            date: h.start_date || h.startDate || h.registration_deadline || h.deadline,
          }))
          .filter((x) => x.date)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3);
        setDeadlines(upcoming);
      })
      .catch(() => {})
      .finally(() => setDlLoading(false));
  }, []);

  const journey = [
    { label: "HACKATHONS", n: Number(stats.registered ?? stats.registered_count ?? 0), icon: <Trophy size={16} strokeWidth={1.8} /> },
    { label: "ONGOING", n: Number(stats.ongoing ?? stats.ongoing_count ?? 0), icon: <Zap size={16} strokeWidth={1.8} /> },
    { label: "COMPLETED", n: Number(stats.completed ?? stats.completed_count ?? 0), icon: <CheckCircle2 size={16} strokeWidth={1.8} /> },
    { label: "CERTIFICATES", n: Number(stats.certificates ?? stats.certificate_count ?? 0), icon: <Award size={16} strokeWidth={1.8} /> },
  ];
  const maxJourney = Math.max(1, ...journey.map((j) => j.n));

  return (
    <div className="student-enrich">
      <div className="student-panel-card enrich-card">
        <div className="student-panel-title"><span>UPCOMING DEADLINES</span><button onClick={() => navigate("My Events")}>VIEW ALL ↗</button></div>
        {dlLoading ? <div className="enrich-loading"><span /></div> : deadlines.length ? (
          <div className="enrich-deadlines">
            {deadlines.map((d, i) => (
              <div className="enrich-deadline" key={i}>
                <div className="enrich-date"><strong>{formatDate(d.date).split(" ").slice(0, 2).join(" ")}</strong><small>{formatDate(d.date)}</small></div>
                <div className="enrich-deadline-info"><strong>{d.title}</strong><span>STARTS SOON</span></div>
              </div>
            ))}
          </div>
        ) : <div className="enrich-empty"><strong>No deadlines yet.</strong><p>Join an event and your upcoming dates will appear here.</p><button onClick={() => navigate("Events")}>BROWSE EVENTS ↗</button></div>}
      </div>

      <div className="student-panel-card enrich-card enrich-ai">
        <div className="student-panel-title"><span>AI SPOTLIGHT</span></div>
        <h3>Your AI teammates are ready.</h3>
        <p>Check your idea, find teammates, or ask the rules — right from here.</p>
        <div className="enrich-ai-actions">
          <button onClick={() => navigate("IdeaCheck AI")}><Sparkles size={14} /> IDEACHECK</button>
          <button onClick={() => navigate("HackMate AI")}><Users size={14} /> HACKMATE</button>
          <button onClick={() => navigate("RuleBot AI")}><Bot size={14} /> RULEBOT</button>
        </div>
      </div>

      <div className="student-panel-card enrich-card">
        <div className="student-panel-title"><span>YOUR JOURNEY</span><button onClick={() => navigate("Certificates")}>CERTIFICATES ↗</button></div>
        <div className="enrich-journey">
          {journey.map((j) => (
            <div className="enrich-journey-row" key={j.label}>
              <span className="enrich-journey-icon">{j.icon}</span>
              <div className="enrich-journey-bar"><i style={{ width: `${Math.round((j.n / maxJourney) * 100)}%` }} /></div>
              <strong>{j.n}</strong>
              <small>{j.label}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardDiscover({ navigate }) {
  const [items, setItems] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [joining, setJoining] = useState("");
  const [justJoined, setJustJoined] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([apiFetch("/hackathons"), apiFetch("/student/hackathons/my-hackathons")]).then(([all, mine]) => {
      if (all.status === "fulfilled") setItems(dedupeHackathons(unwrapList(all.value, ["hackathons", "events", "items"])).slice(0, 3));
      if (mine.status === "fulfilled") setJoined(new Set(unwrapList(mine.value, ["hackathons", "registrations", "items", "data"]).map((x) => String(x.hackathon_id || x.hackathon?.id || x.id || ""))));
    }).finally(() => setLoading(false));
  }, []);
  const join = async (item) => {
    const id = String(item.id || "");
    if (!id || joined.has(id)) return;
    setJoining(id);
    try { await apiFetch(`/hackathons/${encodeURIComponent(id)}/join`, { method: "POST" }); setJoined((current) => new Set([...current, id])); setJustJoined(id); setTimeout(() => setJustJoined(""), 3000); }
    catch {} finally { setJoining(""); }
  };
  return <div className="student-dashboard-discover">
    <div className="student-panel-title"><span>03 / DISCOVER EVENTS</span><button onClick={() => navigate("Events")}>VIEW ALL ↗</button></div>
    {loading ? <div className="student-discover-loading">Loading available hackathons...</div> : items.length ? <div className="student-discover-grid">{items.map((item) => { const id=String(item.id||""); const isJoined=joined.has(id); return <div className={`student-discover-card ${justJoined === id ? "join-celebrate" : ""}`} key={id}>{justJoined === id && (<><span className="join-confetti"><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="join-stamp">YOU'RE IN ✓</span></>)}<div className="student-discover-head"><HackathonMark title={value(item.title, item.name, item.hackathon_name)} size={40} /><div><span>{value(item.track, item.category, "HACKATHON")}</span><strong>{value(item.title, item.name, item.hackathon_name)}</strong><small>{formatDate(item.start_date || item.startDate)}</small></div></div><button disabled={isJoined || joining===id} onClick={() => join(item)}>{isJoined ? "JOINED" : joining===id ? "JOINING" : "JOIN NOW ↗"}</button></div>; })}</div> : <EmptyState title="NO OPEN HACKATHONS" text="Explore the Hackathons section when organizers publish new events." />}
  </div>;
}

function HackathonsPage({ onOpen, onJoined }) {
  const [items, setItems] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [justJoinedId, setJustJoinedId] = useState("");
  // v6.17 — event-type filter (works once the backend returns event_type).
  const [typeFilter, setTypeFilter] = useState("all");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const [allResult, mineResult] = await Promise.allSettled([
        apiFetch("/hackathons"),
        apiFetch("/student/hackathons/my-hackathons"),
      ]);
      if (allResult.status === "rejected") throw allResult.reason;
      const all = dedupeHackathons(unwrapList(allResult.value, ["hackathons", "events", "items"]));
      const mine = mineResult.status === "fulfilled"
        ? unwrapList(mineResult.value, ["hackathons", "registrations", "items", "data"])
        : [];
      const ids = new Set(mine.map((x) => String(x.hackathon_id || x.hackathon?.id || x.id || "")).filter(Boolean));
      setItems(all);
      setJoinedIds(ids);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const join = async (item) => {
    const id = item?.id;
    if (!id || joining || joinedIds.has(String(id))) return;
    setJoining(String(id)); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/hackathons/${encodeURIComponent(id)}/join`, { method: "POST" });
      setJoinedIds((current) => new Set([...current, String(id)]));
      setMessage(result?.message || "Hackathon joined successfully.");
      setJustJoinedId(String(id)); setTimeout(() => setJustJoinedId(""), 3000);
      onJoined?.({ hackathon: value(item.title, item.name, item.hackathon_name) });
    } catch (err) {
      setError(err.message);
    } finally { setJoining(""); }
  };

  return (
    <section>
      <PageHeading eyebrow="DISCOVER / BACKEND DATA" title="EVENTS." text="Explore CampusCode events — hackathons, quizzes, workshops — and join the ones you want." count={items.length} />
      {message && <div className="student-inline-success">{message}</div>}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} retry={load} />}
      {!loading && !error && !items.length && <EmptyState title="NO HACKATHONS AVAILABLE" text="The backend returned no hackathons for this account right now." />}
      {!loading && !error && items.length > 0 && (
        <div className="event-hub-tabs" role="tablist" aria-label="Filter events by type">
          {[
            ["all", "All events"],
            ["hackathon", "Hackathons"],
            ["quiz", "Quizzes"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`event-hub-tab ${typeFilter === key ? "active" : ""}`}
              onClick={() => setTypeFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="hackathon-grid">
          {items
            .filter((item) => typeFilter === "all" || (item.event_type || "hackathon") === typeFilter)
            .map((item) => {
            const id = String(item.id || "");
            const joined = joinedIds.has(id);
            const isQuiz = item.event_type === "quiz";
            return (
              <article className={`hackathon-card ${justJoinedId === id ? "join-celebrate" : ""}`} key={item.id}>
                {justJoinedId === id && (<><span className="join-confetti"><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="join-stamp">YOU'RE IN ✓</span></>)}
                <EventBanner web={item.banner_web_url} mobile={item.banner_mobile_url} title={value(item.title, item.name, item.hackathon_name)} />
                <div className="hackathon-card-top"><span>{value(item.code, item.slug, item.id)}</span><b>{value(item.status)}</b></div>
                <div className="hackathon-card-brand">
                  <HackathonMark title={value(item.title, item.name, item.hackathon_name)} />
                  <h2>{value(item.title, item.name, item.hackathon_name)}</h2>
                </div>
                {isQuiz && <p><strong>QUIZ · SOLO · TIMED</strong></p>}
                <p>{value(item.description, item.short_description)}</p>
                <div className="hackathon-data">
                  <span><small>MODE</small>{value(item.mode, item.event_mode)}</span>
                  <span><small>{isQuiz ? "FORMAT" : "TEAM SIZE"}</small>{isQuiz ? "Solo" : value(item.team_size, item.teamSize, item.max_team_size)}</span>
                  <span><small>START</small>{formatDate(item.start_date || item.startDate)}</span>
                </div>
                <div className="hackathon-actions">
                  <button onClick={() => onOpen(item)} className="student-outline-btn">VIEW DETAILS <b>↗</b></button>
                  <button
                    onClick={() => join(item)}
                    disabled={joined || joining === id}
                    className={`student-join-btn ${joined ? "joined" : ""}`}
                  >
                    {joined ? "✓ JOINED" : joining === id ? "JOINING..." : isQuiz ? "REGISTER FOR QUIZ ↗" : "JOIN HACKATHON ↗"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RegistrationsPage({ onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await apiFetch("/student/hackathons/my-hackathons");
      const registrations = dedupeHackathons(
        Array.isArray(result?.hackathons)
          ? result.hackathons
          : unwrapList(result, ["hackathons", "registrations", "events", "items"])
      );
      setItems(registrations);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <section>
      <PageHeading eyebrow="MY ACTIVITY / BACKEND DATA" title="MY EVENTS." text="Every event you joined, in one place. Open one to see its rounds, team, results and certificates." count={items.length} />
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} retry={load} />}
      {!loading && !error && !items.length && <EmptyState title="NO EVENTS JOINED" text="No joined events were returned for your student account." />}
      {!loading && !error && items.length > 0 && (
        <div className="registration-grid">
          {items.map((item, index) => (
            <article className="registration-card" key={item.participant_id || item.registration_id || item.hackathon_id || index}>
              <EventBanner web={item.hackathon?.banner_web_url || item.banner_web_url} mobile={item.hackathon?.banner_mobile_url || item.banner_mobile_url} title={value(item.hackathon?.title, item.title, item.name, item.hackathon_name)} />
              <div><span>REGISTRATION</span><b>{value(item.participant_id, item.registration_id, "CONFIRMED")}</b></div>
              <div className="hackathon-card-brand">
                <HackathonMark title={value(item.hackathon?.title, item.title, item.name, item.hackathon_name)} />
                <h2>{value(item.hackathon?.title, item.title, item.name, item.hackathon_name)}</h2>
              </div>
              <p>STATUS: <strong>{value(item.registration_status, item.status, "REGISTERED")}</strong></p>
              <p>TEAM: <strong>{value(item.team?.name, item.team_name, "NOT ASSIGNED")}</strong></p>
              <button onClick={() => onOpen(item)} className="student-primary-btn">OPEN JOURNEY ↗</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RegistrationDetail({ registration, onBack, bare }) {
  const id = registration?.hackathon_id || registration?.hackathonId || registration?.id;
  const [rounds, setRounds] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [roundResult, teamResult] = await Promise.allSettled([
        apiFetch(`/hackathons/${encodeURIComponent(id)}/rounds`),
        apiFetch(`/hackathons/${encodeURIComponent(id)}/teams`),
      ]);
      if (roundResult.status === "fulfilled") setRounds(unwrapList(roundResult.value, ["rounds", "data", "items"]));
      if (teamResult.status === "fulfilled") {
        const teams = unwrapList(teamResult.value, ["teams", "data", "items"]);
        setTeam(teams[0] || teamResult.value?.team || null);
      }
      if (roundResult.status === "rejected" && teamResult.status === "rejected") throw roundResult.reason;
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  return (
    <section>
      <EventBanner
        web={registration.banner_web_url || registration.hackathon?.banner_web_url}
        mobile={registration.banner_mobile_url || registration.hackathon?.banner_mobile_url}
        title={value(registration.hackathon?.title, registration.title, registration.name, registration.hackathon_name)}
      />
      {!bare && (
        <>
          <button className="back-btn" onClick={onBack}>← BACK TO REGISTRATIONS</button>
          <PageHeading eyebrow="REGISTRATION / LIVE RECORD" title={value(registration.hackathon?.title, registration.title, registration.name, registration.hackathon_name)} text="Round and team information is fetched from CampusCode APIs." />
        </>
      )}
      <div className="registration-detail-head">
        <div><span>REGISTRATION ID</span><strong>{value(registration.participant_id, registration.registration_id, registration.registration_code, "CONFIRMED")}</strong></div>
        <div><span>STATUS</span><strong>{value(registration.registration_status, registration.status, "REGISTERED")}</strong></div>
        <div><span>TEAM</span><strong>{value(registration.team?.name, registration.team_name, "NOT ASSIGNED")}</strong></div>
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} retry={load} />}
      {!loading && !error && (
        <div className="student-two-col">
          <div className="student-panel-card">
            <div className="student-panel-title"><span>ROUND PIPELINE</span></div>
            {rounds.length ? rounds.map((round, index) => (
              <div className="round-row" key={round.id || round.round_number || index}>
                <div className="round-number">{value(round.round_number, round.roundNumber, index + 1)}</div>
                <div><strong>{value(round.name, round.title, `ROUND ${index + 1}`)}</strong><span>{value(round.status, round.round_status)}</span></div>
                <b>{value(round.result, round.selection_status)}</b>
              </div>
            )) : <EmptyState title="NO ROUND DATA" text="No round records were returned for this hackathon." />}
          </div>
          <div className="student-panel-card">
            <div className="student-panel-title"><span>TEAM RECORD</span></div>
            {team ? (
              <div className="team-detail"><span>TEAM</span><h3>{value(team.name, team.team_name)}</h3><p>ID: {value(team.id, team.team_id)}</p><p>STATUS: {value(team.status)}</p></div>
            ) : <EmptyState title="NO TEAM DATA" text="No team record was returned for this registration." />}
          </div>
        </div>
      )}
    </section>
  );
}

function DigitalCard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await apiFetch("/users/me");
      setProfile(result?.profile || result?.user || result?.data || null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState label="Loading Digital ID from backend..." />;
  if (error) return <ErrorState message={error} retry={load} />;
  if (!profile) return <EmptyState title="DIGITAL ID NOT FOUND" text="The backend did not return a profile for this account." />;

  const campusId = profile.campus_code_id;
  const publicUrl = campusId
    ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/u/${encodeURIComponent(campusId)}`
    : "";

  return (
    <section>
      <PageHeading eyebrow="IDENTITY / VERIFIED ACCOUNT" title="DIGITAL ID." text="Your identity card uses the real CampusCode profile and CampusCode ID returned by the backend." />
      <div className="digital-id-layout">
        <div className="digital-id-card">
          <div className="digital-id-top"><Brand /><span>VERIFIED</span></div>
          <div className="digital-id-main">
            <StudentAvatar name={value(profile.name, "Student")} size={76} />
            <div><span>STUDENT</span><h2>{value(profile.name)}</h2><p>{value(profile.email)}</p></div>
          </div>
          <div className="digital-id-data">
            <div><span>CAMPUSCODE ID</span><strong>{value(campusId)}</strong></div>
            <div><span>ROLE</span><strong>{value(profile.role)}</strong></div>
            <div><span>ACCOUNT</span><strong>{profile.is_active === undefined ? "—" : profile.is_active ? "ACTIVE" : "INACTIVE"}</strong></div>
          </div>
          <div className="digital-id-qr-wrap">
            {publicUrl ? <QRCodeSVG value={publicUrl} size={210} level="H" bgColor="#ffffff" fgColor="#0a0a0a" /> : <EmptyState title="QR UNAVAILABLE" text="CampusCode ID was not returned by the backend." />}
            {publicUrl && <span>SCAN TO OPEN PUBLIC CAMPUSCODE PROFILE</span>}
          </div>
          <div className="digital-id-footer"><span>LEARN · BUILD · BELONG</span><span>{value(campusId)}</span></div>
        </div>
        <div className="digital-id-info">
          <span>IDENTITY / 01</span>
          <h2>ONE ID.<br />YOUR CAMPUSCODE.</h2>
          <p>The QR code is generated from the real public profile URL using the CampusCode ID returned by your backend. No placeholder QR pattern is used.</p>
          <div className="identity-check"><i /> BACKEND PROFILE LOADED</div>
          <div className="identity-actions">
            <button onClick={() => window.print()}>PRINT / SAVE</button>
            {publicUrl && <button onClick={() => navigator.clipboard?.writeText(publicUrl)}>COPY PROFILE LINK</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   v6 — CERTIFICATES (Module 8: real issued certificates)
========================================================= */
function CertificatesPage({ hackathonId }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/certificates/mine");
      const all = Array.isArray(data?.certificates) ? data.certificates : [];
      // Hub use: show only this event's certificates.
      setCertificates(hackathonId
        ? all.filter((c) => String(c.hackathon_id) === String(hackathonId))
        : all);
    } catch (e) {
      setError(e.message || "Unable to load certificates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const download = async (cert) => {
    setDownloadingId(cert.id);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/certificates/${cert.id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CampusCode-Certificate-${cert.code}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e.message || "Download failed.");
    } finally {
      setDownloadingId("");
    }
  };

  const copyVerifyLink = async (cert) => {
    const link = `https://campuscode.co.in/verify/${cert.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Verify link copied.");
    } catch {
      setMessage(link);
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
    <section>
      <PageHeading eyebrow="REWARDS / CERTIFICATES" title="CERTIFICATES." text={hackathonId ? "Certificates issued for this event — download the PDF or share the verify link." : "Every certificate carries a unique code anyone can verify — share the verify link with recruiters."} />
      {error && <p className="student-inline-error">{error}</p>}
      {message && <p className="student-inline-success">{message}</p>}
      {loading ? (
        <div className="student-panel-card"><p>Loading your certificates…</p></div>
      ) : certificates.length === 0 ? (
        <div className="student-panel-card">
          <h3>No certificates yet</h3>
          <p>Participation certificates appear here once an organizer issues them for a hackathon you submitted in. Winner certificates appear for Round 3 top 3 teams.</p>
        </div>
      ) : (
        <div className="student-two-col">
          {certificates.map((cert, index) => (
            <div className="student-feature-card cert-reveal" style={{ "--delay": `${index * 90}ms` }} key={cert.id}>
              <div className="student-feature-card-head">
                <span className="student-feature-label">
                  {cert.type === "WINNER" ? "WINNER CERTIFICATE" : "PARTICIPATION CERTIFICATE"}
                </span>
                <Award size={16} />
                <span className="cert-seal">✓</span>
              </div>
              <h3>{cert.hackathon_title}</h3>
              <p>
                {cert.team_name ? `Team ${cert.team_name} · ` : ""}
                {cert.type === "WINNER" && cert.place ? `Place ${cert.place} · ` : ""}
                Issued {formatDate(cert.issued_at)}
              </p>
              <p className="student-feature-label">{cert.code}</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  className="student-primary-btn"
                  disabled={downloadingId === cert.id}
                  onClick={() => download(cert)}
                >
                  {downloadingId === cert.id ? "DOWNLOADING…" : "DOWNLOAD PDF ↗"}
                </button>
                <button
                  className="student-outline-btn"
                  onClick={() => copyVerifyLink(cert)}
                >
                  COPY VERIFY LINK
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", bio: "", skills: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/users/me");
      const next = result?.profile || result?.user || result?.data || null;
      setProfile(next);
      if (next) {
        setForm({
          name: next.name || "",
          bio: next.bio || "",
          skills: Array.isArray(next.skills) ? next.skills.join(", ") : (next.skills || ""),
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const skillSuggestions = [
    "HTML", "CSS", "JavaScript", "React", "Next.js", "Node.js",
    "Express.js", "Python", "FastAPI", "Java", "C", "C++", "Kotlin",
    "Flutter", "SQL", "PostgreSQL", "MongoDB", "Git", "GitHub",
    "Tailwind CSS", "AWS", "Docker", "Machine Learning", "Data Analysis"
  ];

  const filteredSkillSuggestions = skillSuggestions.filter((skill) => {
    const current = form.skills.split(",").pop().trim().toLowerCase();
    return (
      current &&
      skill.toLowerCase().startsWith(current) &&
      !form.skills.toLowerCase().includes(skill.toLowerCase())
    );
  }).slice(0, 6);

  const addSkillSuggestion = (skill) => {
    const parts = form.skills
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const current = parts[parts.length - 1];

    if (current && current.toLowerCase() !== skill.toLowerCase()) {
      parts[parts.length - 1] = skill;
    } else if (!parts.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      parts.push(skill);
    }

    setForm((currentForm) => ({
      ...currentForm,
      skills: `${parts.join(", ")}, `,
    }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const skills = form.skills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const result = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          bio: form.bio.trim(),
          skills,
        }),
      });

      const updated = result?.profile || result?.user || result?.data || null;
      if (updated) {
        setProfile(updated);
        setForm({
          name: updated.name || "",
          bio: updated.bio || "",
          skills: Array.isArray(updated.skills) ? updated.skills.join(", ") : (updated.skills || ""),
        });
        localStorage.setItem("user", JSON.stringify({
          ...JSON.parse(localStorage.getItem("user") || "{}"),
          name: updated.name,
        }));
      }

      setEditing(false);
      setMessage(result?.message || "Profile updated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !profile) return <ErrorState message={error} retry={load} />;
  if (!profile) return <EmptyState title="PROFILE NOT FOUND" text="The backend returned no profile for this account." />;

  const fields = [
    ["NAME", profile.name],
    ["EMAIL", profile.email],
    ["ROLE", profile.role],
    ["CAMPUSCODE ID", profile.campus_code_id],
    ["BIO", profile.bio],
    ["SKILLS", Array.isArray(profile.skills) ? profile.skills.join(", ") : profile.skills],
  ];

  return (
    <section>
      <PageHeading
        eyebrow="ACCOUNT / BACKEND PROFILE"
        title="YOUR PROFILE."
        text="Edit your student profile and save the changes directly to the CampusCode backend."
      />

      {!editing ? (
        <>
          <div className="profile-grid">
            {fields.map(([label, field]) => (
              <div className="profile-field" key={label}>
                <span>{label}</span>
                <strong>{value(field)}</strong>
              </div>
            ))}
          </div>

          <div className="profile-edit-actions">
            <button className="profile-edit-btn" onClick={() => { setEditing(true); setMessage(""); }}>
              EDIT PROFILE ↗
            </button>
          </div>
        </>
      ) : (
        <div className="profile-edit-shell">
          <div className="profile-edit-grid">
            <div className="profile-edit-field">
              <label>NAME</label>
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>

            <div className="profile-edit-field">
              <label>EMAIL · READ ONLY</label>
              <input value={profile.email || ""} disabled />
            </div>

            <div className="profile-edit-field full">
              <label>BIO</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
                placeholder="Tell the CampusCode community about yourself"
              />
            </div>

            <div className="profile-edit-field full profile-skills-field">
              <label>SKILLS · COMMA SEPARATED</label>
              <input
                value={form.skills}
                onChange={(e) => setForm((current) => ({ ...current, skills: e.target.value }))}
                placeholder="React, Node.js, Python"
                autoComplete="off"
              />
              {filteredSkillSuggestions.length > 0 && (
                <div className="profile-skill-suggestions">
                  {filteredSkillSuggestions.map((skill) => (
                    <button type="button" key={skill} onClick={() => addSkillSuggestion(skill)}>
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <div className="profile-message error">{error}</div>}
          {message && <div className="profile-message">{message}</div>}

          <div className="profile-edit-actions">
            <button className="profile-save-btn" onClick={save} disabled={saving}>
              {saving ? "SAVING..." : "SAVE CHANGES ↗"}
            </button>
            <button
              className="profile-cancel-btn"
              onClick={() => {
                setEditing(false);
                setError("");
                setForm({
                  name: profile.name || "",
                  bio: profile.bio || "",
                  skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || ""),
                });
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {message && !editing && <div className="profile-message">{message}</div>}
    </section>
  );
}

/* v6.5 — notifications with read/unread: unread-only by default, mark as read */
function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("unread");
  const [marking, setMarking] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await apiFetch("/student/notifications");
      setItems(unwrapList(result, ["notifications", "items", "data"]));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const isUnread = (n) => !n.is_read && n.is_read !== 1 && n.read_at == null && n.readAt == null;
  const unreadItems = items.filter(isUnread);
  const shown = filter === "unread" ? unreadItems : items;

  const markRead = async (id) => {
    if (!id) return;
    setMarking(String(id));
    try {
      await apiFetch(`/student/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      setItems((prev) => prev.map((n) => (String(n.id) === String(id) ? { ...n, is_read: true } : n)));
    } catch (err) { setError(err.message); } finally { setMarking(""); }
  };

  const markAllRead = async () => {
    setMarking("all");
    try {
      await apiFetch("/student/notifications/read-all", { method: "PATCH" });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) { setError(err.message); } finally { setMarking(""); }
  };

  return (
    <section>
      <PageHeading
        eyebrow="ALERTS / BACKEND DATA"
        title="NOTIFICATIONS."
        text="Only unread notifications are shown by default. Mark them read as you go."
        count={unreadItems.length}
      />
      <div className="notif-toolbar">
        <div className="notif-filter" role="tablist" aria-label="Notification filter">
          <button type="button" role="tab" aria-selected={filter === "unread"}
            className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>
            UNREAD <b>{unreadItems.length}</b>
          </button>
          <button type="button" role="tab" aria-selected={filter === "all"}
            className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            ALL <b>{items.length}</b>
          </button>
        </div>
        {unreadItems.length > 0 && (
          <button type="button" className="notif-mark-all" onClick={markAllRead} disabled={marking === "all"}>
            {marking === "all" ? "MARKING..." : "MARK ALL AS READ ✓"}
          </button>
        )}
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} retry={load} />}
      {!loading && !error && !shown.length && (
        <EmptyState
          title={filter === "unread" ? "ALL CAUGHT UP" : "NO NOTIFICATIONS"}
          text={filter === "unread" ? "You have no unread notifications." : "No notification records were returned."}
        />
      )}
      {!loading && !error && shown.map((item, i) => {
        const unread = isUnread(item);
        const busy = marking === String(item.id);
        return (
          <div className={`notification-full ${unread ? "is-unread" : "is-read"}`} key={item.id || i}>
            <span className="live-dot" />
            <div>
              <strong>{value(item.title, item.subject, item.message)}</strong>
              <p>{value(item.body, item.message, item.description)}</p>
            </div>
            <time>{formatDate(item.created_at || item.createdAt)}</time>
            {unread ? (
              <button type="button" className="notif-mark-one" onClick={() => markRead(item.id)} disabled={busy}>
                {busy ? "..." : "MARK AS READ"}
              </button>
            ) : (
              <span className="notif-read-tick">READ ✓</span>
            )}
          </div>
        );
      })}
    </section>
  );
}

function HackMatePage({ onGoToMyTeam }) {
  const [hackathons, setHackathons] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState(null);
  const [loadingHackathons, setLoadingHackathons] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [addingMember, setAddingMember] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  /* v6.16 — HackMate-by-ID: find a friend by search or QR scan. */
  const [findTab, setFindTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [foundStudent, setFoundStudent] = useState(null);
  const [finding, setFinding] = useState(false);
  const [findMessage, setFindMessage] = useState("");
  const [myCampusId, setMyCampusId] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [isMobileView, setIsMobileView] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 780px)").matches
  );
  const scannerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 780px)");
    const onChange = () => setIsMobileView(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* Own CampusCode ID for the "My card" QR (same source as Digital ID). */
  useEffect(() => {
    let cancelled = false;
    apiFetch("/users/me")
      .then((result) => {
        const profile = result?.profile || result?.user || result?.data || null;
        if (!cancelled && profile?.campus_code_id) {
          setMyCampusId(profile.campus_code_id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHackathons = async () => {
    setLoadingHackathons(true);
    setError("");

    try {
      // Only registered hackathons are used by HackMate.
      const result = await apiFetch("/student/hackathons");
      const items = dedupeHackathons(unwrapList(result, ["hackathons", "registrations", "events", "items"]));
      setHackathons(items);

      if (!selectedId && items.length) {
        setSelectedId(String(items[0].id || items[0].hackathon_id || ""));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHackathons(false);
    }
  };

  const loadMatches = async (hackathonId = selectedId) => {
    if (!hackathonId) {
      setData(null);
      return;
    }

    setLoadingMatches(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiFetch(`/student/hackmate/${encodeURIComponent(hackathonId)}`);
      setData(result);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    loadHackathons();
  }, []);

  useEffect(() => {
    if (selectedId) loadMatches(selectedId);
  }, [selectedId]);

  const addMemberToTeam = async (candidate) => {
    const teamId = data?.my_team?.id;

    if (!teamId) {
      setError("Create your team first from My Team.");
      return;
    }

    if (Number(data?.my_team?.available_slots ?? 0) <= 0) {
      setError("Your team is already full.");
      return;
    }

    setAddingMember(String(candidate.user_id));
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(candidate.user_id)}`, {
        method: "POST",
      });

      setSuccess(`${candidate.name || "Student"} was added to your team.`);
      await loadMatches(selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMember("");
    }
  };

  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations
    : [];

  /* ---- v6.16: HackMate-by-ID helpers (search + QR scan) ---- */

  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").id || "";
    } catch {
      return "";
    }
  })();

  const currentTeamForFind = data?.my_team || null;
  const isTeamLeaderForFind = Boolean(
    currentTeamForFind &&
      String(currentTeamForFind.leader_id || "") === String(currentUserId)
  );
  const canAddMemberForFind = Boolean(
    currentTeamForFind &&
      Number(currentTeamForFind.available_slots ?? 0) > 0 &&
      isTeamLeaderForFind
  );

  const myPublicUrl = myCampusId
    ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/u/${encodeURIComponent(myCampusId)}`
    : "";

  const lookupByCampusId = async (campusId) => {
    if (!selectedId) {
      setFindMessage("Select a registered hackathon first.");
      return;
    }
    setFinding(true);
    setFindMessage("");
    setFoundStudent(null);
    try {
      const result = await apiFetch(
        `/student/hackmate/${encodeURIComponent(selectedId)}/find/${encodeURIComponent(campusId)}`
      );
      setFoundStudent(result?.student || null);
      if (result?.student && !result.registered_for_hackathon) {
        setFindMessage(
          "Found, but this student is not registered for the selected hackathon — they must register before you can add them."
        );
      } else if (result?.student && result.already_in_team) {
        setFindMessage(
          "Found, but this student is already in a team for this hackathon."
        );
      }
    } catch (err) {
      setFindMessage(err.message);
    } finally {
      setFinding(false);
    }
  };

  const extractCampusId = (text) => {
    const match = String(text || "").match(/CC-[A-Z0-9]+/i);
    return match ? match[0].toUpperCase() : "";
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* Scanner may already be stopped; safe to ignore. */
    }
    try {
      scanner.clear();
    } catch {
      /* Clearing an unstarted scanner is safe to ignore. */
    }
  };

  const startScanner = async () => {
    if (scannerRef.current) return;
    setScanMessage("");
    try {
      /* Scanner code loads only when the Scan tab opens on mobile,
         so desktop bundles stay light. */
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("hackmate-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          const campusId = extractCampusId(decodedText);
          if (!campusId) {
            setScanMessage("This QR code is not a CampusCode profile.");
            return;
          }
          stopScanner();
          setScanMessage(`QR detected: ${campusId}`);
          lookupByCampusId(campusId);
        },
        () => {}
      );
    } catch {
      setScanMessage(
        "Camera could not be started. Allow camera permission in your browser and try again."
      );
    }
  };

  useEffect(
    () => () => {
      stopScanner();
    },
    []
  );

  const switchFindTab = (tab) => {
    setFindTab(tab);
    setFindMessage("");
    setScanMessage("");
  };

  /* Start the camera only after the Scan tab has rendered,
     and stop it whenever the tab closes or the view changes. */
  useEffect(() => {
    if (findTab === "scan" && isMobileView) {
      /* Scanner start is async (camera permission + dynamic
         import), so this cannot loop renders. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startScanner();
    } else {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findTab, isMobileView]);

  const searchNorm = searchQuery.trim().toLowerCase();
  const isIdQuery = /^cc-[a-z0-9]+$/i.test(searchQuery.trim());
  const searchResults = !searchNorm
    ? []
    : recommendations.filter(
        (candidate) =>
          String(candidate.name || "")
            .toLowerCase()
            .includes(searchNorm) ||
          (Array.isArray(candidate.skills) &&
            candidate.skills.some((skill) =>
              String(skill).toLowerCase().includes(searchNorm)
            ))
      );

  const currentTeam = data?.my_team || null;
  const selectedHackathon = hackathons.find(
    (item) => String(item.id || item.hackathon_id) === String(selectedId)
  );

  if (loadingHackathons) return <LoadingState label="Loading your registered hackathons..." />;

  return (
    <section className="rulebot-page">
      <PageHeading
        eyebrow="INTELLIGENCE / HACKMATE"
        title="FIND YOUR TEAM."
        text="Find registered students from the same hackathon using HackMate match scores. Search by name or CampusCode ID, or scan a teammate's QR on mobile."
        count={recommendations.length}
      />

      {error && <ErrorState message={error} retry={() => loadMatches(selectedId)} />}
      {success && <div className="student-inline-success">{success}</div>}

      <div className="hackmate-toolbar">
        <label>SELECT REGISTERED HACKATHON</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Choose a registered hackathon</option>
          {hackathons.map((item) => {
            const id = item.id || item.hackathon_id;
            return (
              <option key={id} value={id}>
                {value(item.title, item.name, item.hackathon_name, item.hackathon?.title)}
              </option>
            );
          })}
        </select>
      </div>

      {!hackathons.length && !error && (
        <EmptyState
          title="NO REGISTERED HACKATHONS"
          text="Register for a hackathon first. HackMate only works with your registered hackathons."
        />
      )}

      {selectedId && loadingMatches && (
        <LoadingState label="Finding registered teammates..." />
      )}

      {selectedId && !loadingMatches && !error && data && (
        <>
          <section className="hackmate-team-layout">
            <div className="hackmate-team-panel">
              <div className="hackmate-panel-head">
                <div>
                  <span>YOUR TEAM</span>
                  <h2>{currentTeam ? value(currentTeam.name) : "NO TEAM YET"}</h2>
                  <p>
                    {currentTeam
                      ? `${value(currentTeam.member_count, 0)} / ${value(currentTeam.max_size, "—")} members`
                      : "Go to My Team and create your team before adding teammates."}
                  </p>
                </div>

                {currentTeam && (
                  <b className="hackmate-status-badge">
                    {value(currentTeam.status, "BUILDING")}
                  </b>
                )}
              </div>

              {currentTeam ? (
                <>
                  <div className="hackmate-team-meta">
                    <div>
                      <span>AVAILABLE SLOTS</span>
                      <strong>{value(currentTeam.available_slots, 0)}</strong>
                    </div>
                    <div>
                      <span>MISSING SKILLS</span>
                      <strong>
                        {Array.isArray(currentTeam.missing_skills) && currentTeam.missing_skills.length
                          ? currentTeam.missing_skills.join(", ")
                          : "No major skill gap"}
                      </strong>
                    </div>
                  </div>

                  <div className="hackmate-member-list">
                    {(currentTeam.members || []).map((member) => (
                      <div className="hackmate-member-chip" key={member.id || member.user_id || member.name}>
                        <span>{String(member.name || "U").charAt(0).toUpperCase()}</span>
                        <div>
                          <strong>{value(member.name)}</strong>
                          <small>{value(member.role, "MEMBER")}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="hackmate-no-team">
                  <strong>CREATE YOUR TEAM FIRST</strong>
                  <p>
                    Your matching candidates are ready, but only a team leader can add students.
                  </p>
                  <p className="hackmate-no-team-note">
                    Open <b>My Team</b>, create your team for this hackathon, then return here.
                  </p>
                  {onGoToMyTeam && (
                    <button
                      type="button"
                      className="student-outline-btn"
                      onClick={onGoToMyTeam}
                    >
                      OPEN MY TEAM ↗
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="hackmate-intelligence-card">
              <span>HACKMATE INTELLIGENCE</span>
              <strong>{recommendations.length}</strong>
              <p>registered students matched for this hackathon</p>

              <div>
                <small>HACKATHON</small>
                <b>{value(selectedHackathon?.title, selectedHackathon?.name)}</b>
              </div>
              <div>
                <small>CANDIDATES</small>
                <b>{value(data?.meta?.total_candidates, recommendations.length)}</b>
              </div>
            </div>
          </section>

          {/* v6.16 — HackMate-by-ID: my card + find a friend (search / scan). */}
          <section className="hackmate-find-section">
            <div className="hackmate-find-card">
              <span>YOUR HACKMATE CARD</span>
              <h2>SHOW THIS QR.</h2>
              <p>
                Friends scan this on their phone, or search your CampusCode ID,
                to find you. Only public info is shared — no phone, no email.
              </p>
              {myPublicUrl ? (
                <div className="hackmate-my-qr">
                  <QRCodeSVG
                    value={myPublicUrl}
                    size={132}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                  />
                  <div>
                    <small>CAMPUSCODE ID</small>
                    <strong>{myCampusId}</strong>
                    <button
                      type="button"
                      className="student-outline-btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(myCampusId);
                        setSuccess(`CampusCode ID ${myCampusId} copied.`);
                      }}
                    >
                      COPY ID
                    </button>
                  </div>
                </div>
              ) : (
                <p className="hackmate-find-note">
                  Your CampusCode ID was not returned by the backend.
                </p>
              )}
            </div>

            <div className="hackmate-find-card">
              <span>FIND A FRIEND</span>
              <h2>ADD TO YOUR TEAM.</h2>
              <p>
                Your team needs a leader seat first — create it in My Team,
                then add friends here. Team size is capped at 4.
              </p>

              <div className="hackmate-find-tabs">
                <button
                  type="button"
                  className={`hackmate-find-tab${findTab === "search" ? " on" : ""}`}
                  onClick={() => switchFindTab("search")}
                >
                  🔍 SEARCH
                </button>
                <button
                  type="button"
                  className={`hackmate-find-tab${findTab === "scan" ? " on" : ""}`}
                  onClick={() => switchFindTab("scan")}
                >
                  📷 SCAN QR
                  {!isMobileView && <small>mobile only</small>}
                </button>
              </div>

              {findTab === "search" && (
                <>
                  <input
                    type="text"
                    className="hackmate-find-input"
                    placeholder="Name, skill — or CampusCode ID like CC-8K2N4P"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFoundStudent(null);
                      setFindMessage("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isIdQuery) {
                        lookupByCampusId(searchQuery.trim().toUpperCase());
                      }
                    }}
                  />

                  {isIdQuery && (
                    <button
                      type="button"
                      className="hackmate-add-btn hackmate-find-id-btn"
                      disabled={finding}
                      onClick={() =>
                        lookupByCampusId(searchQuery.trim().toUpperCase())
                      }
                    >
                      {finding ? "FINDING..." : "FIND BY ID"}
                    </button>
                  )}

                  {findMessage && (
                    <p className="hackmate-find-note">{findMessage}</p>
                  )}

                  {foundStudent && (
                    <div className="hackmate-found-card">
                      <div className="hackmate-candidate-person">
                        <div className="hackmate-candidate-avatar">
                          {String(foundStudent.name || "U")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <h3>{value(foundStudent.name)}</h3>
                          <span>{value(foundStudent.campus_code_id)}</span>
                        </div>
                      </div>
                      <div className="hackmate-skill-list">
                        {(foundStudent.skills || []).map((skill) => (
                          <b key={skill}>{skill}</b>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="hackmate-add-btn"
                        disabled={
                          !canAddMemberForFind ||
                          addingMember === String(foundStudent.user_id)
                        }
                        onClick={() => addMemberToTeam(foundStudent)}
                      >
                        {addingMember === String(foundStudent.user_id)
                          ? "ADDING..."
                          : canAddMemberForFind
                            ? "ADD TO TEAM"
                            : currentTeamForFind
                              ? "TEAM FULL"
                              : "CREATE TEAM FIRST"}
                      </button>
                    </div>
                  )}

                  {searchNorm && !isIdQuery && (
                    <div className="hackmate-find-results">
                      {!searchResults.length ? (
                        <p className="hackmate-find-note">
                          No registered student matches “{searchQuery}” for
                          this hackathon. Try a CampusCode ID instead.
                        </p>
                      ) : (
                        searchResults.map((candidate) => (
                          <div
                            className="hackmate-find-row"
                            key={candidate.user_id}
                          >
                            <div className="hackmate-candidate-avatar">
                              {String(candidate.name || "U")
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="hackmate-find-row-info">
                              <strong>{value(candidate.name)}</strong>
                              <small>
                                {value(candidate.match_score, 0)}% match
                                {Array.isArray(candidate.skills) &&
                                candidate.skills.length
                                  ? ` · ${candidate.skills.slice(0, 3).join(", ")}`
                                  : ""}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="hackmate-add-btn"
                              disabled={
                                !canAddMemberForFind ||
                                addingMember === String(candidate.user_id)
                              }
                              onClick={() => addMemberToTeam(candidate)}
                            >
                              {addingMember === String(candidate.user_id)
                                ? "ADDING..."
                                : canAddMemberForFind
                                  ? "ADD"
                                  : "FULL"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}

              {findTab === "scan" && (
                <>
                  {!isMobileView ? (
                    <div className="hackmate-find-note">
                      <strong>QR scanning is mobile-only.</strong>
                      <br />
                      On a laptop you can&apos;t scan — use Search above, or
                      open HackMate on your phone and scan a friend&apos;s QR
                      there. Your own QR is on the left card.
                    </div>
                  ) : (
                    <>
                      <div id="hackmate-qr-reader" className="hackmate-qr-reader" />
                      {scanMessage && (
                        <p className="hackmate-find-note">{scanMessage}</p>
                      )}
                      {foundStudent && (
                        <div className="hackmate-found-card">
                          <h3>{value(foundStudent.name)}</h3>
                          <span>{value(foundStudent.campus_code_id)}</span>
                          <button
                            type="button"
                            className="hackmate-add-btn"
                            disabled={
                              !canAddMemberForFind ||
                              addingMember === String(foundStudent.user_id)
                            }
                            onClick={() => addMemberToTeam(foundStudent)}
                          >
                            {addingMember === String(foundStudent.user_id)
                              ? "ADDING..."
                              : canAddMemberForFind
                                ? "ADD TO TEAM"
                                : currentTeamForFind
                                  ? "TEAM FULL"
                                  : "CREATE TEAM FIRST"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="hackmate-matches-section">
            <div className="hackmate-matches-heading">
              <div>
                <span>COMPATIBILITY ENGINE</span>
                <h2>Recommended teammates</h2>
                <p>
                  These students are registered for the selected hackathon and are returned by HackMate with a compatibility score.
                </p>
              </div>
              {selectedHackathon && <b>{value(selectedHackathon.title, selectedHackathon.name)}</b>}
            </div>

            {!recommendations.length ? (
              <EmptyState
                title="NO MATCHES FOUND"
                text="No compatible registered students were returned for this hackathon."
              />
            ) : (
              <div className="hackmate-candidate-list">
                {recommendations.map((candidate) => {
                  const canAdd = Boolean(
                    currentTeam &&
                    Number(currentTeam.available_slots ?? 0) > 0 &&
                    String(currentTeam.leader_id || "") === String(
                      (() => {
                        try {
                          return JSON.parse(localStorage.getItem("user") || "{}").id || "";
                        } catch {
                          return "";
                        }
                      })()
                    )
                  );

                  return (
                    <article className="hackmate-candidate-card" key={candidate.user_id}>
                      <div className="hackmate-candidate-person">
                        <div className="hackmate-candidate-avatar">
                          {String(candidate.name || "U")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <h3>{value(candidate.name)}</h3>
                          <span>{value(candidate.email, "CampusCode student")}</span>
                          {candidate.bio && <p>{candidate.bio}</p>}
                        </div>
                      </div>

                      <div className="hackmate-candidate-score">
                        <small>MATCH SCORE</small>
                        <strong>{value(candidate.match_score, 0)}%</strong>
                      </div>

                      <div className="hackmate-candidate-details">
                        <small>SKILLS</small>
                        <div className="hackmate-skill-list">
                          {Array.isArray(candidate.skills) && candidate.skills.length ? (
                            candidate.skills.map((skill) => <b key={skill}>{skill}</b>)
                          ) : (
                            <span>No skills listed</span>
                          )}
                        </div>

                        {Array.isArray(candidate.complementary_skills) && candidate.complementary_skills.length > 0 && (
                          <>
                            <small className="hackmate-gap-label">FILLS SKILL GAP</small>
                            <div className="hackmate-skill-list gap">
                              {candidate.complementary_skills.slice(0, 5).map((skill) => (
                                <b key={skill}>+ {skill}</b>
                              ))}
                            </div>
                          </>
                        )}

                        {candidate.reason && <p>{candidate.reason}</p>}
                      </div>

                      <div className="hackmate-candidate-actions">
                        <button
                          type="button"
                          className="student-outline-btn"
                          onClick={() => setSelectedUser(candidate)}
                        >
                          VIEW PROFILE ↗
                        </button>

                        <button
                          type="button"
                          className="hackmate-add-btn"
                          disabled={!canAdd || addingMember === String(candidate.user_id)}
                          onClick={() => addMemberToTeam(candidate)}
                        >
                          {addingMember === String(candidate.user_id)
                            ? "ADDING..."
                            : canAdd
                              ? "ADD TO TEAM"
                              : currentTeam
                                ? "TEAM FULL"
                                : "CREATE TEAM FIRST"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {selectedUser && (
        <div className="match-modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="match-modal" onClick={(e) => e.stopPropagation()}>
            <button className="match-modal-close" onClick={() => setSelectedUser(null)}>×</button>
            <span>HACKMATE PROFILE</span>
            <h2>{value(selectedUser.name)}</h2>
            <p>{value(selectedUser.email)}</p>
            <p>{value(selectedUser.bio, "No bio provided by this student.")}</p>
            <div className="match-skills">
              {(selectedUser.skills || []).map((skill) => <b key={skill}>{skill}</b>)}
            </div>
            <small>{value(selectedUser.reason)}</small>
          </div>
        </div>
      )}
    </section>
  );
}

function RuleBotPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [rules, setRules] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingHackathons, setLoadingHackathons] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const loadHackathons = async () => {
    setLoadingHackathons(true);
    setError("");
    try {
      const result = await apiFetch("/student/hackathons");
      const items = dedupeHackathons(unwrapList(result, ["hackathons", "registrations", "events", "items"]));
      setHackathons(items);
      if (!selectedId && items.length) {
        setSelectedId(String(items[0].id || items[0].hackathon_id || ""));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHackathons(false);
    }
  };

  useEffect(() => { loadHackathons(); }, []);

  const loadRules = async (hackathonId) => {
    if (!hackathonId) return;
    setLoadingRules(true);
    setError("");
    setMessages([]);
    try {
      const result = await apiFetch(`/rulebot/${encodeURIComponent(hackathonId)}/rules`);
      setRules(result);
    } catch (err) {
      setRules(null);
      setError(err.message);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    if (selectedId) loadRules(selectedId);
  }, [selectedId]);

  const ask = async (question = input.trim()) => {
    if (!question || !selectedId || asking) return;

    setInput("");
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-u`, sender: "user", text: question },
    ]);
    setAsking(true);
    setError("");

    try {
      const result = await apiFetch(`/rulebot/${encodeURIComponent(selectedId)}/ask`, {
        method: "POST",
        body: JSON.stringify({ question }),
      });

      const answer =
        result?.answer ||
        result?.response ||
        result?.message ||
        "RuleBot returned no answer.";

      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-b`, sender: "bot", text: answer },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  };

  if (loadingHackathons) return <LoadingState label="Loading your hackathons..." />;

  return (
    <section className="rulebot-page">
      <PageHeading
        eyebrow="CAMPUSCODE INTELLIGENCE / RULEBOT"
        title="RULEBOT AI."
        text="Ask questions against the selected hackathon's organizer-uploaded rulebook."
      />

      <div className="rulebot-card">
        <div className="rulebot-header">
          <div className="rulebot-header-title">
            <div className="rulebot-icon">✦</div>
            <div>
              <strong>RULEBOT</strong>
              <small>{rules?.has_rules ? `RULEBOOK: ${value(rules?.rules?.file_name)}` : "RULEBOOK NOT AVAILABLE"}</small>
            </div>
          </div>

          <select className="rulebot-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Choose a registered hackathon</option>
            {hackathons.map((item) => {
              const id = item.id || item.hackathon_id;
              return (
                <option key={id} value={id}>
                  {value(item.title, item.name, item.hackathon_name)}
                </option>
              );
            })}
          </select>
        </div>

        {error && <div className="profile-message error" style={{ margin: "15px 25px 0" }}>{error}</div>}

        {!selectedId ? (
          <div className="rulebot-empty">
            <strong>SELECT A HACKATHON</strong>
            <span>RuleBot needs a specific hackathon because its answers are grounded in that event's rulebook.</span>
          </div>
        ) : loadingRules ? (
          <LoadingState label="Checking the selected hackathon rulebook..." />
        ) : !rules?.has_rules ? (
          <div className="rulebot-empty">
            <strong>RULEBOOK NOT UPLOADED</strong>
            <span>The selected hackathon does not have an organizer-uploaded rulebook yet.</span>
          </div>
        ) : (
          <>
            <div className="rulebot-messages">
              {messages.length === 0 && (
                <div className="rulebot-message">
                  <div className="rulebot-avatar">✦</div>
                  <div className="rulebot-bubble">
                    <strong>RuleBot is ready.</strong>
                    <div>Ask about eligibility, teams, rounds, submissions, deadlines or other rules in this hackathon's uploaded rulebook.</div>
                  </div>
                </div>
              )}

              {messages.map((item) => (
                <div className={`rulebot-message ${item.sender === "user" ? "user" : ""}`} key={item.id}>
                  {item.sender !== "user" && <div className="rulebot-avatar">✦</div>}
                  <div className="rulebot-bubble">{item.text}</div>
                </div>
              ))}

              {asking && (
                <div className="rulebot-message">
                  <div className="rulebot-avatar">✦</div>
                  <div className="rulebot-bubble">RuleBot is checking the rulebook…</div>
                </div>
              )}
            </div>

            <div className="rulebot-suggestions">
              <button onClick={() => ask("What are the team size rules?")}>Team size rules</button>
              <button onClick={() => ask("What are the submission requirements?")}>Submission requirements</button>
              <button onClick={() => ask("What are the deadlines?")}>Deadlines</button>
              <button onClick={() => ask("What are the eligibility rules?")}>Eligibility</button>
            </div>

            <div className="rulebot-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask RuleBot about this hackathon..."
                disabled={asking}
              />
              <button onClick={() => ask()} disabled={asking}>↑</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function StudentHackathonSelector({ value: selectedValue, onChange, items }) {
  const uniqueItems = dedupeHackathons(items);
  return (
    <select className="student-data-select" value={selectedValue} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a registered hackathon</option>
      {uniqueItems.map((item) => {
        const id = item.hackathon_id || item.id || item.hackathon?.id;
        return <option key={id} value={id}>{value(item.hackathon?.title, item.title, item.name, item.hackathon_name)}</option>;
      })}
    </select>
  );
}

// v6.9.5: shared hackathon selection — all tabs/pages stay in sync
// so switching tabs never resets the selector back to the first hackathon.
const SYNCED_HACKATHON_KEY = "campuscode_selected_hackathon";
const SYNCED_HACKATHON_EVENT = "campuscode:hackathon-change";
function useSyncedHackathon() {
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem(SYNCED_HACKATHON_KEY) || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    const onSync = (e) => setSelected(e.detail || "");
    window.addEventListener(SYNCED_HACKATHON_EVENT, onSync);
    return () => window.removeEventListener(SYNCED_HACKATHON_EVENT, onSync);
  }, []);
  const setSynced = (id) => {
    const next = id || "";
    setSelected(next);
    try {
      if (next) localStorage.setItem(SYNCED_HACKATHON_KEY, next);
      else localStorage.removeItem(SYNCED_HACKATHON_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent(SYNCED_HACKATHON_EVENT, { detail: next }));
  };
  return [selected, setSynced];
}

// v6.9.5: Forged Steel round lock — heavy chain + gunmetal padlock,
// sway/float/sheen animations, reduced-motion aware.
function RoundLock({ round = 2, reason }) {
  return (
    <div className="student-round-lock" role="img" aria-label={`Round ${round} is locked`}>
      <svg viewBox="0 0 400 380" className="student-lock-svg" aria-hidden="true">
        <defs>
          <linearGradient id="rLockSteel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2e3138" /><stop offset=".28" stopColor="#7d838c" />
            <stop offset=".5" stopColor="#dfe3e8" /><stop offset=".72" stopColor="#7d838c" />
            <stop offset="1" stopColor="#2e3138" />
          </linearGradient>
          <linearGradient id="rLockGun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#565b64" /><stop offset=".12" stopColor="#33373e" />
            <stop offset=".55" stopColor="#1d2025" /><stop offset="1" stopColor="#101216" />
          </linearGradient>
          <linearGradient id="rLockChrome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5c6169" /><stop offset=".4" stopColor="#e9edf2" />
            <stop offset=".6" stopColor="#aeb4bd" /><stop offset="1" stopColor="#5c6169" />
          </linearGradient>
          <filter id="rLockDs" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity=".35" />
          </filter>
        </defs>
        <ellipse cx="200" cy="352" rx="110" ry="14" fill="#0f172a" opacity=".12" />
        <g className="rlock-sway">
          <g stroke="url(#rLockSteel)" strokeWidth="13" fill="none">
            <line x1="200" y1="0" x2="200" y2="26" />
            <ellipse cx="200" cy="46" rx="17" ry="24" />
            <ellipse cx="200" cy="92" rx="24" ry="17" />
            <ellipse cx="200" cy="136" rx="17" ry="24" />
          </g>
          <g className="rlock-floaty">
            <g filter="url(#rLockDs)">
              <path d="M168 210 L168 172 Q168 138 200 138 Q232 138 232 172 L232 210"
                stroke="url(#rLockChrome)" strokeWidth="24" fill="none" strokeLinecap="round" />
              <rect className="rlock-sheen" x="176" y="146" width="9" height="52" rx="4.5" fill="#fff" />
              <rect x="148" y="200" width="104" height="96" rx="20" fill="url(#rLockGun)" stroke="#0a0b0d" strokeWidth="2" />
              <rect x="158" y="210" width="84" height="10" rx="5" fill="#fff" opacity=".08" />
              <circle cx="200" cy="240" r="12" fill="#0b0c0e" stroke="#3c4048" strokeWidth="3" />
              <rect x="194" y="246" width="12" height="24" rx="6" fill="#0b0c0e" stroke="#3c4048" strokeWidth="3" />
              <circle cx="164" cy="216" r="4" fill="#8a8f98" /><circle cx="236" cy="216" r="4" fill="#8a8f98" />
              <circle cx="164" cy="280" r="4" fill="#8a8f98" /><circle cx="236" cy="280" r="4" fill="#8a8f98" />
            </g>
          </g>
        </g>
        <text x="200" y="348" textAnchor="middle" fill="#64748b" fontSize="11" letterSpacing="3" fontFamily="ui-monospace, monospace">ROUND {round} · LOCKED</text>
      </svg>
      <div className="student-round-lock-text">
        <strong>ROUND {round} IS LOCKED</strong>
        <span>{reason}</span>
      </div>
    </div>
  );
}

function StudentMyTeamPage({ lockedHackathonId }) {
  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const [registrations, setRegistrations] = useState([]);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState(lockedHackathonId ? String(lockedHackathonId) : "");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currentUserId = String(storedUser?.id || storedUser?.user_id || "");

  const getHackathonId = (item) => String(
    item?.hackathon_id || item?.hackathon?.id || item?.id || ""
  );

  const getHackathonTitle = (item) => value(
    item?.hackathon?.title,
    item?.title,
    item?.name,
    item?.hackathon_name,
    "Hackathon"
  );

  const getHackathonStatus = (item) => String(
    item?.hackathon?.status ||
    item?.status ||
    item?.hackathon_status ||
    ""
  ).toUpperCase();

  const isHackathonCompleted = (item) => {
    const status = getHackathonStatus(item);
    return ["COMPLETED", "COMPLETE", "FINISHED", "CLOSED", "ARCHIVED"].includes(status);
  };

  const leaderId = String(team?.leader_id || team?.leader?.id || "");
  const isLeader = Boolean(currentUserId && leaderId && currentUserId === leaderId);
  const selectedRegistration = registrations.find(
    (item) => getHackathonId(item) === String(selectedHackathonId)
  );
  const hackathonCompleted = isHackathonCompleted(selectedRegistration) ||
    isHackathonCompleted(team?.hackathon) ||
    ["COMPLETED", "COMPLETE", "FINISHED", "CLOSED", "ARCHIVED"].includes(
      String(team?.hackathon_status || "").toUpperCase()
    );
  const isBuilding = String(team?.status || "BUILDING").toUpperCase() === "BUILDING";
  const canModifyTeam = Boolean(team && !hackathonCompleted && isBuilding);

  const normalizeTeams = (result) =>
    unwrapList(result, ["teams", "data", "items"]);

  const loadRegistrations = async () => {
    const result = await apiFetch("/student/hackathons/my-hackathons");
    const items = dedupeHackathons(unwrapList(result, ["hackathons", "registrations", "events", "data"]));
    setRegistrations(items);
    return items;
  };

  const loadTeamForHackathon = async (hackathonId, registrationList = registrations) => {
    if (!hackathonId) {
      setTeam(null);
      setMembers([]);
      setTeamName("");
      return;
    }

    setTeamLoading(true);
    setError("");

    try {
      // IMPORTANT: teams are loaded for the selected hackathon.
      // We never use /student/team here because that endpoint returns the
      // student's latest team and can therefore show an old hackathon team.
      const result = await apiFetch(`/hackathons/${encodeURIComponent(hackathonId)}/teams`);
      const teams = normalizeTeams(result);

      const matchingTeam = teams.find((candidate) => {
        const candidateMembers = Array.isArray(candidate?.members) ? candidate.members : [];
        const memberMatch = candidateMembers.some((member) =>
          String(member?.user_id || member?.id || "") === currentUserId
        );
        const leaderMatch = String(candidate?.leader_id || "") === currentUserId;
        return memberMatch || leaderMatch;
      }) || null;

      setTeam(matchingTeam);
      setMembers(Array.isArray(matchingTeam?.members) ? matchingTeam.members : []);
      setTeamName(matchingTeam?.name || matchingTeam?.team_name || "");

      const selected = registrationList.find(
        (item) => getHackathonId(item) === String(hackathonId)
      );

      if (matchingTeam && selected && !selected?.hackathon) {
        // Keep the registration object untouched; status is still read from
        // the selected hackathon/team data when available.
      }
    } catch (err) {
      setTeam(null);
      setMembers([]);
      setTeamName("");
      setError(err.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await loadRegistrations();
      // Hub-locked: the event is fixed by the hub, never the first list item.
      const firstId = lockedHackathonId
        ? String(lockedHackathonId)
        : (items.length ? getHackathonId(items[0]) : "");
      if (!firstId) {
        setSelectedHackathonId("");
        setTeam(null);
        setMembers([]);
        setTeamName("");
        return;
      }

      setSelectedHackathonId((current) => current || firstId);
      await loadTeamForHackathon(firstId, items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleHackathonChange = async (nextId) => {
    setSelectedHackathonId(nextId);
    setTeam(null);
    setMembers([]);
    setTeamName("");
    setMessage("");
    setError("");
    await loadTeamForHackathon(nextId, registrations);
  };

  const createTeam = async () => {
    if (!selectedHackathonId) return setError("Choose a registered hackathon first.");
    if (hackathonCompleted) return setError("This hackathon is completed. Teams are read-only.");
    if (!teamName.trim()) return setError("Enter a team name first.");

    setCreating(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/hackathons/${encodeURIComponent(selectedHackathonId)}/teams`, {
        method: "POST",
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const created = result?.team || result?.data?.team || null;
      setMessage(result?.message || "Your team was created successfully.");
      setJustCreated(true); setTimeout(() => setJustCreated(false), 2500);
      if (created) {
        setTeam(created);
        setMembers(Array.isArray(created.members) ? created.members : []);
      }
      await loadTeamForHackathon(selectedHackathonId, registrations);
    } catch (err) {
      setError(err.message);
    } finally { setCreating(false); }
  };

  const updateTeam = async () => {
    if (!team?.id) return;
    if (!isLeader) return setError("Only the team leader can update the team.");
    if (!canModifyTeam) return setError("This team can no longer be edited.");
    if (!teamName.trim()) return setError("Enter a team name first.");

    setUpdating(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/teams/${encodeURIComponent(team.id)}`, {
        method: "PUT",
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const updated = result?.team || result?.data?.team || result?.data || null;
      if (updated) setTeam((current) => ({ ...current, ...updated }));
      setMessage(result?.message || "Team details updated successfully.");
      await loadTeamForHackathon(selectedHackathonId, registrations);
    } catch (err) {
      setError(err.message);
    } finally { setUpdating(false); }
  };

  const exitTeam = async () => {
    if (!team?.id || isLeader) return;
    if (!canModifyTeam) return setError("You cannot exit a completed or locked team.");

    const confirmed = window.confirm(
      `Exit ${team.name || team.team_name || "this team"}? You will leave the team.`
    );
    if (!confirmed) return;

    setLeaving(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/teams/${encodeURIComponent(team.id)}/leave`, { method: "DELETE" });
      setTeam(null); setMembers([]); setTeamName("");
      setMessage(result?.message || "You have exited the team.");
    } catch (err) {
      setError(err.message);
    } finally { setLeaving(false); }
  };

  const deleteTeam = async () => {
    if (!team?.id || !isLeader) return;
    if (!canModifyTeam) return setError("Only active BUILDING teams can be deleted.");

    const confirmed = window.confirm(
      `Delete ${team.name || team.team_name || "this team"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/teams/${encodeURIComponent(team.id)}`, { method: "DELETE" });
      setTeam(null); setMembers([]); setTeamName("");
      setMessage(result?.message || "Team deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally { setDeleting(false); }
  };

  if (loading) return <LoadingState label="Loading your team workspace..." />;

  return (
    <section className="student-my-team-page">
      <PageHeading
        eyebrow="BUILD / COLLABORATION"
        title="MY TEAM."
        text="Select a hackathon to create, manage, or view your team history."
        count={members.length}
      />

      <div className="student-team-selector-card">
        <div>
          <span className="student-feature-label">01 / SELECT HACKATHON</span>
          <strong>{selectedRegistration ? getHackathonTitle(selectedRegistration) : "Choose a hackathon"}</strong>
          <small>{hackathonCompleted ? "HACKATHON COMPLETED · READ ONLY" : "TEAM MANAGEMENT CONTEXT"}</small>
        </div>
        {lockedHackathonId ? (
          <strong>{selectedRegistration ? getHackathonTitle(selectedRegistration) : "This event"}</strong>
        ) : (
          <select
            className="student-data-select student-team-hackathon-select"
            value={selectedHackathonId}
            onChange={(e) => handleHackathonChange(e.target.value)}
            disabled={teamLoading}
          >
            <option value="">Choose a registered hackathon</option>
            {registrations.map((item) => {
              const id = getHackathonId(item);
              return (
                <option key={id} value={id}>
                  {getHackathonTitle(item)}{isHackathonCompleted(item) ? " · COMPLETED" : ""}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {error && <ErrorState message={error} retry={() => loadTeamForHackathon(selectedHackathonId, registrations)} />}
      {message && <div className="student-inline-success">{message}</div>}

      {teamLoading ? (
        <LoadingState label="Loading selected hackathon team..." />
      ) : !selectedHackathonId ? (
        <EmptyState title="SELECT A HACKATHON" text="Choose a registered hackathon above to view or create its team." />
      ) : !team ? (
        <div className="student-team-create-layout">
          <div className="student-feature-card student-team-create-card">
            <span className="student-feature-label">02 / NO TEAM</span>
            <h2>{hackathonCompleted ? "HACKATHON COMPLETED" : "CREATE YOUR TEAM"}</h2>
            <p>
              {hackathonCompleted
                ? "This hackathon is completed. No team changes are available."
                : `You are not part of a team for ${getHackathonTitle(selectedRegistration)} yet.`}
            </p>

            {!hackathonCompleted && (
              <div className="student-team-create-form">
                <label>TEAM NAME</label>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name"
                  className="student-team-name-input"
                  maxLength={80}
                />
                <button
                  type="button"
                  className="student-primary-btn"
                  onClick={createTeam}
                  disabled={creating || !selectedHackathonId || !teamName.trim()}
                >
                  {creating ? "CREATING TEAM..." : "CREATE TEAM ↗"}
                </button>
              </div>
            )}
          </div>

          <div className={`student-feature-card student-team-help-card ${hackathonCompleted ? "completed" : ""}`}>
            <span className="student-feature-label">HACKATHON STATE</span>
            {hackathonCompleted ? (
              <>
                <div className="student-team-mini-stamp">CAMPUSCODE<br />HACKATHON<br />COMPLETED ✓</div>
                <p>This hackathon is preserved as history. Team records remain read-only.</p>
              </>
            ) : (
              <>
                <strong>CREATE</strong><p>The student who creates the team becomes the leader automatically.</p>
                <strong>LEADER</strong><p>The leader can update or delete the team while it is BUILDING.</p>
                <strong>MEMBER</strong><p>Members can leave the team while it is BUILDING.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={`student-team-layout ${hackathonCompleted ? "student-team-completed-layout" : ""}`}>
          <div className="student-feature-card student-team-main-card">
            {hackathonCompleted && (
              <div className="student-completed-stamp" aria-label="CampusCode Hackathon Completed">
                <span>CAMPUSCODE</span>
                <strong>HACKATHON</strong>
                <b>COMPLETED ✓</b>
              </div>
            )}

            <div className="student-team-head">
              <div>
                <span className="student-feature-label">{hackathonCompleted ? "PAST TEAM / HISTORY" : "CURRENT TEAM"}</span>
                <h2>{value(team.name, team.team_name)}</h2>
                <p>{getHackathonTitle(selectedRegistration)}</p>
              </div>
              <b className={`student-team-status ${hackathonCompleted ? "completed" : ""}`}>
                {hackathonCompleted ? "COMPLETED" : value(team.status, "BUILDING")}
              </b>
            </div>

            <div className="student-info-list">
              <div><span>TEAM LEADER</span><strong>{isLeader ? "YOU" : value(team.leader_name, team.leader?.name, "Team leader")}</strong></div>
              <div><span>MEMBERS</span><strong>{members.length || value(team.member_count, 0)}</strong></div>
              <div><span>PROJECT</span><strong>{value(team.project_title, team.project?.title, "No project yet")}</strong></div>
            </div>

            <div className={`student-team-members ${justCreated ? "team-just-created" : ""}`}>
              <span className="student-feature-label">TEAM MEMBERS</span>
              {members.length ? members.map((member, index) => {
                const memberId = String(member.user_id || member.id || "");
                const memberIsLeader = memberId === leaderId || String(member.role || "").toUpperCase() === "LEADER";
                return (
                  <div className="student-member-row" key={member.id || member.user_id || member.name || index}>
                    <StudentAvatar name={value(member.name, "User")} size={40} />
                    <div>
                      <strong>{value(member.name, "User")}</strong>
                      <span>{memberIsLeader ? "LEADER" : "MEMBER"}</span>
                    </div>
                    {memberId === currentUserId && <b>YOU</b>}
                  </div>
                );
              }) : <p className="student-muted">No team members returned.</p>}
            </div>
          </div>

          {!hackathonCompleted && (
            <div className="student-feature-card student-team-next-card">
              <span className="student-feature-label">TEAM MANAGEMENT</span>
              <h3>{isLeader ? "Leader controls" : "Member controls"}</h3>
              <p>
                {isLeader
                  ? "You created this team, so you are the leader. Update or delete it while it is BUILDING."
                  : "You are a team member. You can leave the team while it is BUILDING."}
              </p>

              {isLeader && (
                <div className="student-team-control-form">
                  <label>TEAM NAME</label>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    disabled={!canModifyTeam || updating}
                    className="student-team-name-input"
                  />
                  <button
                    type="button"
                    className="student-primary-btn"
                    onClick={updateTeam}
                    disabled={!canModifyTeam || updating || !teamName.trim() || teamName.trim() === String(team.name || team.team_name || "").trim()}
                  >
                    {updating ? "UPDATING..." : "UPDATE TEAM ↗"}
                  </button>
                </div>
              )}

              <div className="student-team-danger-zone">
                <span className="student-feature-label">TEAM ACTION</span>
                {isLeader ? (
                  <>
                    <p>As leader, you cannot exit directly. Delete the team if you want to disband it.</p>
                    <button type="button" className="student-danger-btn" onClick={deleteTeam} disabled={deleting || !canModifyTeam}>
                      {deleting ? "DELETING TEAM..." : "DELETE TEAM"}
                    </button>
                  </>
                ) : (
                  <>
                    <p>Leaving removes you from this team. The team and other members remain unchanged.</p>
                    <button type="button" className="student-danger-btn" onClick={exitTeam} disabled={leaving || !canModifyTeam}>
                      {leaving ? "EXITING TEAM..." : "LEAVE TEAM"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {hackathonCompleted && (
            <div className="student-feature-card student-team-history-card">
              <span className="student-feature-label">03 / HISTORY</span>
              <h3>HACKATHON COMPLETED.</h3>
              <p>This team is now part of your CampusCode hackathon history. No create, update, leave, or delete controls are available.</p>
              <div className="student-history-lock">🔒 READ ONLY · TEAM HISTORY PRESERVED</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function IdeaCheckAIPage() {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeIdea = async () => {
    const description = idea.trim();
    if (description.length < 10) {
      setError("Enter at least 10 characters so IdeaCheck AI can analyze your idea.");
      return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await apiFetch("/ideacheck/check", {
        method: "POST",
        body: JSON.stringify({ project_description: description }),
      });
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const similarity = result?.similarity_check || {};
  const evaluation = result?.idea_evaluation || {};
  const ai = result?.ai_analysis || {};
  const matched = similarity?.matched_project;
  const similarityScore = Number(similarity?.similarity_score || 0);
  const confidence = Number(ai?.confidence || 0);
  const aiAvailable = ai?.available !== false && Boolean(ai?.summary);

  return (
    <section className="ideacheck-page">
      <PageHeading
        eyebrow="CAMPUSCODE INTELLIGENCE / IDEACHECK"
        title="IDEACHECK AI."
        text="Check your idea against the CampusCode reference dataset, then get a Gemini-powered explanation and improvement plan."
      />

      <div className="ideacheck-hero-grid">
        <div className="ideacheck-input-card">
          <div className="ideacheck-card-head">
            <div><span className="student-feature-label">01 / YOUR IDEA</span><h2>WHAT ARE YOU BUILDING?</h2></div>
            <div className="ideacheck-ai-badge">GEMINI AI</div>
          </div>
          <textarea
            className="ideacheck-textarea"
            value={idea}
            onChange={(e) => setIdea(e.target.value.slice(0, 5000))}
            placeholder="Describe your project idea, the problem it solves, target users and the main features..."
            maxLength={5000}
          />
          <div className="ideacheck-input-footer">
            <span>{idea.length} / 5000</span>
            <button type="button" className="student-primary-btn ideacheck-analyze-btn" onClick={analyzeIdea} disabled={loading || idea.trim().length < 10}>
              {loading ? "ANALYZING WITH AI..." : "CHECK IDEA WITH AI ↗"}
            </button>
          </div>
          {error && <div className="student-inline-error">{error}</div>}
        </div>

        <div className="ideacheck-process-card">
          <span className="student-feature-label">HOW IT WORKS</span>
          <div className="ideacheck-process-step"><b>01</b><div><strong>DATASET CHECK</strong><span>Compares your idea against the CampusCode reference projects.</span></div></div>
          <div className="ideacheck-process-line" />
          <div className="ideacheck-process-step"><b>02</b><div><strong>SIMILARITY</strong><span>Calculates the strongest project similarity and identifies the matching reference.</span></div></div>
          <div className="ideacheck-process-line" />
          <div className="ideacheck-process-step"><b>03</b><div><strong>GEMINI AI</strong><span>Explains what is similar, what is different and how you can improve the idea.</span></div></div>
        </div>
      </div>

      {loading && <LoadingState label="IdeaCheck AI is analyzing your idea..." />}

      {result && !loading && (
        <div className="ideacheck-results">
          <div className="ideacheck-result-header">
            <div><span className="student-feature-label">02 / ANALYSIS COMPLETE</span><h2>YOUR IDEA REPORT.</h2></div>
            <div className={`ideacheck-verdict-pill ${String(ai?.ai_verdict || "").toLowerCase()}`}>{aiAvailable ? ai.ai_verdict : similarity.status}</div>
          </div>

          <div className="ideacheck-score-grid">
            <div className="ideacheck-score-card main"><span>SIMILARITY</span><strong>{similarityScore}%</strong><small>{similarity.status === "SIMILAR_FOUND" ? "Similar project found" : "No similar project found"}</small></div>
            <div className="ideacheck-score-card"><span>AI CONFIDENCE</span><strong>{aiAvailable ? `${confidence}%` : "—"}</strong><small>{aiAvailable ? value(ai.model_name, "Gemini") : "AI temporarily unavailable"}</small></div>
            <div className="ideacheck-score-card"><span>IDEA SCORE</span><strong>{value(evaluation.overall, "—")}</strong><small>{value(evaluation.verdict, "Evaluation")}</small></div>
          </div>

          {matched && (
            <div className="ideacheck-match-card">
              <div><span className="student-feature-label">REFERENCE MATCH</span><h3>{value(matched.title, "Matched project")}</h3><p>{value(matched.description, "No project description available.")}</p></div>
              <div><span>CATEGORY</span><strong>{value(matched.category, "—")}</strong><span>TECHNOLOGY</span><strong>{value(matched.technology, "—")}</strong></div>
            </div>
          )}

          {aiAvailable ? (
            <>
              <div className="ideacheck-ai-summary"><span className="student-feature-label">GEMINI EXPLANATION</span><h3>{value(ai.summary)}</h3><p>{value(ai.similarity_explanation)}</p></div>
              <div className="ideacheck-ai-grid">
                <div className="ideacheck-ai-card"><span>WHAT MAKES IT DIFFERENT</span>{(ai.unique_points || []).map((item, index) => <div key={index}><b>+</b><p>{item}</p></div>)}</div>
                <div className="ideacheck-ai-card"><span>AI FEATURE SUGGESTIONS</span>{(ai.feature_suggestions || []).map((item, index) => <div key={index}><b>✦</b><p>{item}</p></div>)}</div>
                <div className="ideacheck-ai-card"><span>HOW TO IMPROVE</span>{(ai.improvement_suggestions || []).map((item, index) => <div key={index}><b>↗</b><p>{item}</p></div>)}</div>
                <div className="ideacheck-ai-card"><span>DIFFERENTIATION STRATEGY</span><p>{value(ai.differentiation_strategy)}</p></div>
              </div>
            </>
          ) : (
            <div className="ideacheck-ai-unavailable"><strong>AI EXPLANATION TEMPORARILY UNAVAILABLE</strong><span>{value(ai.message, "The dataset similarity result is still available. Try again in a moment.")}</span></div>
          )}

          <div className="ideacheck-evaluation-card">
            <div><span className="student-feature-label">LOCAL IDEA EVALUATION</span><strong>{value(evaluation.verdict, "—")}</strong></div>
            <div className="ideacheck-mini-scores"><span>TECH {value(evaluation.technology, "—")}</span><span>USAGE {value(evaluation.usage, "—")}</span><span>INNOVATION {value(evaluation.innovation, "—")}</span><span>PRACTICALITY {value(evaluation.practicality, "—")}</span><span>FEASIBILITY {value(evaluation.feasibility, "—")}</span></div>
          </div>
          <p className="ideacheck-disclaimer">{value(result.disclaimer)}</p>
        </div>
      )}

      {!result && !loading && <div className="ideacheck-empty"><div className="ideacheck-empty-icon">✦</div><strong>YOUR IDEA REPORT WILL APPEAR HERE</strong><span>Enter an idea above to run the CampusCode dataset check and Gemini AI analysis.</span></div>}
    </section>
  );
}

function StudentProjectPage({ setProject }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const teamResult = await apiFetch("/student/team");
      const team = teamResult?.team || teamResult?.data?.team || teamResult?.data;
      if (!team?.id) throw new Error("Create or join a team before creating a project.");
      const result = await apiFetch(`/projects/team/${team.id}`);
      const project = result?.project || result?.data || result;
      setData(project); setProject?.(project);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const update = (field, next) => setData((current) => ({ ...(current || {}), [field]: next }));
  const save = async () => {
    if (!data?.id) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/projects/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      const project = result?.project || result?.data || result;
      setData(project); setProject?.(project); setMessage("Project saved to the backend.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingState label="Loading your project..." />;
  if (error && !data) return <ErrorState message={error} retry={load} />;
  return (
    <section>
      <PageHeading eyebrow="BUILD / PROJECT" title="MY PROJECT." text="Project data is loaded and saved through the CampusCode API." />
      {error && <div className="student-inline-error">{error}</div>}
      {!data?.id ? <EmptyState title="NO PROJECT YET" text="No project exists for your team yet. Create one through the team project workflow." /> : (
        <div className="student-feature-card student-form-card">
          <input value={data.title || ""} onChange={(e) => update("title", e.target.value)} placeholder="Project title" />
          <input value={data.track || ""} onChange={(e) => update("track", e.target.value)} placeholder="Track" />
          <textarea rows={5} value={data.problem_statement || data.description || ""} onChange={(e) => update("problem_statement", e.target.value)} placeholder="Problem statement" />
          <textarea rows={5} value={data.solution || ""} onChange={(e) => update("solution", e.target.value)} placeholder="Solution" />
          <input value={data.github_url || ""} onChange={(e) => update("github_url", e.target.value)} placeholder="GitHub URL" />
          <input value={data.live_demo_url || data.demo || ""} onChange={(e) => update("live_demo_url", e.target.value)} placeholder="Live demo URL" />
          {message && <p className="student-inline-success">{message}</p>}
          <button className="student-primary-btn" disabled={saving} onClick={save}>{saving ? "SAVING..." : "SAVE PROJECT ↗"}</button>
        </div>
      )}
    </section>
  );
}

function StudentRoundOnePage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useSyncedHackathon();
  const [data, setData] = useState(null);
  const [statement, setStatement] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAgreement, setShowAgreement] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [agreementAction, setAgreementAction] = useState("submit");
  const [leaderNote, setLeaderNote] = useState("");

  const loadStatus = async (id) => {
    if (!id) return;
    setLoadingStatus(true); setError("");
    try {
      const result = await apiFetch(`/student/round1/hackathons/${id}`);
      // Keep the complete response. The backend returns
      // hackathon, round1, team and submission as sibling fields.
      setData(result);
      setStatement(result?.submission?.problem_statement || "");
    } catch (err) { setData(null); setError(err.message || "Failed to fetch Round 1 status"); }
    finally { setLoadingStatus(false); }
  };

  useEffect(() => {
    apiFetch("/student/hackathons/my-hackathons").then((result) => {
      const list = dedupeHackathons(unwrapList(result, ["hackathons", "data"]));
      setItems(list); if (list[0]) setSelected(String(list[0].hackathon_id || list[0].id));
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { setMessage(""); loadStatus(selected); }, [selected]);

  const hackathon = data?.hackathon || {};
  const round = data?.round || data?.round1 || {};
  const team = data?.team || null;
  const submission = data?.submission || null;
  const currentRound = Number(hackathon.current_round ?? round.current_round ?? data?.current_round ?? 0);
  const roundStatus = String(round.status || "").toUpperCase();
  const roundCompleted = isRoundCompleted(data, 1) || isCompletedStatus(roundStatus);
  const hackathonCompleted = isCompletedRecord(hackathon) || Number(hackathon?.current_round) === 4;
  const accessible = !roundCompleted && !hackathonCompleted && (
    data?.accessible === true || round?.accessible === true || (roundStatus === "LIVE" && currentRound === 1)
  );
  const submitted = submission?.status === "SUBMITTED";
  const pendingApproval = submission?.status === "PENDING_APPROVAL";
  const draft = submission?.status === "DRAFT";
  const currentUserId = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").id || ""; } catch { return ""; } })();
  const isLeader = Boolean(team?.leader_id) && String(team.leader_id) === String(currentUserId);
  const canSubmit = accessible && Boolean(team) && !submitted && !pendingApproval && !saving;
  const submissionLabel = !submission ? "Not submitted" : submission.status === "PENDING_APPROVAL" ? "AWAITING LEADER APPROVAL" : submission.status === "DRAFT" ? "DRAFT — LEADER ASKED FOR CHANGES" : submission.status;

  const doSubmit = async () => {
    const clean = statement.trim();
    if (clean.length < 20) return setError("Problem statement must contain at least 20 characters.");
    if (!selected) return setError("Select a hackathon first.");
    if (!team) return setError("You must be part of a team before submitting Round 1.");
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(`/student/round1/hackathons/${selected}/submit`, { method: "POST", body: JSON.stringify({ problem_statement: clean }) });
      setMessage(result?.message || (isLeader ? "Round 1 idea submitted successfully." : "Round 1 idea sent to your team leader for approval."));
      setJustSent(true); setTimeout(() => setJustSent(false), 1800);
      await loadStatus(selected);
    } catch (err) { setError(err.message || "Failed to submit Round 1 idea"); }
    finally { setSaving(false); }
  };

  // Leader submits directly (agreement = final submission).
  // Member only proposes — the leader's approval is the submission.
  const handleSubmitClick = () => {
    if (isLeader) { setAgreementAction("submit"); setShowAgreement(true); }
    else doSubmit();
  };

  const approve = async () => {
    const clean = statement.trim();
    if (clean.length < 20) return setError("Problem statement must contain at least 20 characters.");
    if (!selected) return setError("Select a hackathon first.");
    setSaving(true); setError(""); setMessage("");
    try {
      await apiFetch(`/student/round1/hackathons/${selected}/approve`, { method: "POST", body: JSON.stringify({ problem_statement: clean }) });
      setMessage("Round 1 idea approved and submitted.");
      setJustSent(true); setTimeout(() => setJustSent(false), 1800);
      await loadStatus(selected);
    } catch (err) { setError(err.message || "Failed to approve Round 1 proposal"); }
    finally { setSaving(false); }
  };

  const reject = async () => {
    if (!selected) return setError("Select a hackathon first.");
    setSaving(true); setError(""); setMessage("");
    try {
      await apiFetch(`/student/round1/hackathons/${selected}/reject`, { method: "POST", body: JSON.stringify({ note: leaderNote.trim() }) });
      setMessage("Proposal sent back for changes.");
      setLeaderNote("");
      await loadStatus(selected);
    } catch (err) { setError(err.message || "Failed to reject Round 1 proposal"); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState label="Loading Round 1..." />;
  return (
    <section>
      <PageHeading eyebrow="BUILD / ROUND 01" title="PROBLEM STATEMENT." text="Submit your team's problem statement when Round 1 is live." />
      {justSent && (<div className="r1-plane-strip" aria-hidden="true"><span className="r1-plane-trail" /><span className="r1-plane"><svg width="30" height="30" viewBox="0 0 24 24" fill="#111"><path d="M2 12L22 2l-8 20-2.5-8.5z" /></svg></span><span className="r1-plane-sent">SENT ↗</span></div>)}
      {error && <div className="student-inline-error">{error}</div>}
      {message && <div className="student-inline-success">{message}</div>}
      <div className={`student-feature-grid student-round-workspace ${roundCompleted || hackathonCompleted ? "student-round-completed-workspace" : ""}`}>
        <div className="student-feature-card student-round-status-card">
          {(roundCompleted || hackathonCompleted) && <CompletionStamp round={hackathonCompleted ? null : 1} />}
          <span className="student-feature-label">HACKATHON WORKSPACE</span>
          <h2>{value(hackathon.title, "Hackathon")}</h2>
          <div className="student-round-status-row"><span className={`student-round-status ${roundStatus === "LIVE" ? "live" : ""}`}>{roundStatus || "NOT AVAILABLE"}</span><span>{currentRound ? `CURRENT ROUND ${currentRound}` : "ROUND STATUS"}</span></div>
          <StudentHackathonSelector value={selected} onChange={setSelected} items={items} />
          {loadingStatus ? <LoadingState label="Loading round status..." /> : <div className="student-info-list"><div><span>TEAM</span><strong>{value(team?.name, team?.team_name, "No team")}</strong></div><div><span>SUBMISSION</span><strong>{submissionLabel}</strong></div><div><span>DECISION</span><strong>{value(data?.decision?.decision, "Pending")}</strong></div><div className="student-feedback-row"><span>ORGANIZER FEEDBACK</span><strong>{value(data?.decision?.organizer_feedback, "No feedback yet")}</strong></div></div>}
        </div>
        <div className="student-feature-card student-round-form-card">
          <div className="student-feature-card-head"><div><span className="student-feature-label">ROUND 1 SUBMISSION</span><h2>What are you solving?</h2><p>Explain the problem, who experiences it, and what your team plans to solve.</p></div><div className="student-feature-icon"><Send size={18} /></div></div>
          {!team ? <div className="student-round-notice warning"><strong>TEAM REQUIRED</strong><span>Create or join a team before submitting Round 1.</span></div> : submitted ? (<div className="student-round-submitted-wrap"><div className="student-round-submitted"><CheckCircle2 size={18} /><div><strong>SUBMITTED SUCCESSFULLY</strong><span>{submission.status || "SUBMITTED"}</span></div></div><div className="student-round-submitted-details"><div className="student-round-submitted-meta"><span>SUBMITTED BY</span><strong>{value(submission.submitted_by_name, "A teammate")}</strong></div><div className="student-round-submitted-meta"><span>SUBMITTED ON</span><strong>{formatDate(submission.submitted_at)}</strong></div><div className="student-round-submitted-text"><span>PROBLEM STATEMENT — VISIBLE TO THE WHOLE TEAM</span><p>{submission.problem_statement}</p></div></div></div>) : pendingApproval ? (isLeader ? (<div className="student-round-approval"><div className="student-round-approval-head"><strong>AWAITING YOUR APPROVAL</strong><span>Proposed by {value(submission.submitted_by_name, "a teammate")} — review it, edit if needed, then approve. Your approval submits it officially.</span></div><div className="student-form-label-row"><label>PROBLEM STATEMENT *</label><span>{statement.length} / 5000</span></div><textarea value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 5000))} rows={10} maxLength={5000} disabled={saving} /><div className="student-round-approval-actions"><button className="student-primary-btn" disabled={saving || statement.trim().length < 20} onClick={() => { setAgreementAction("approve"); setShowAgreement(true); }}>{saving ? "APPROVING..." : "APPROVE & SUBMIT ↗"}</button></div><div className="student-round-reject"><div className="student-form-label-row"><label>NOTE FOR YOUR TEAM (OPTIONAL)</label></div><textarea value={leaderNote} onChange={(e) => setLeaderNote(e.target.value.slice(0, 1000))} rows={3} maxLength={1000} disabled={saving} placeholder="What should they change?" /><button className="student-outline-btn" disabled={saving} onClick={reject}>SEND BACK FOR CHANGES</button></div></div>) : (<div className="student-round-waiting"><div className="student-round-submitted"><CheckCircle2 size={18} /><div><strong>AWAITING LEADER APPROVAL</strong><span>Proposed by {value(submission.submitted_by_name, "a teammate")}</span></div></div><div className="student-round-submitted-details"><div className="student-round-submitted-text"><span>PROPOSED PROBLEM STATEMENT — VISIBLE TO THE WHOLE TEAM</span><p>{submission.problem_statement}</p></div></div></div>)) : roundCompleted || hackathonCompleted ? <div className="student-round-notice student-round-completed-notice"><strong>{hackathonCompleted ? "HACKATHON COMPLETED" : "ROUND 1 COMPLETED"}</strong><span>{hackathonCompleted ? "This hackathon has finished. Round 1 is now read-only." : "Round 1 has been completed. New submissions are closed."}</span></div> : !accessible ? <RoundLock round={1} reason={round.reason === "ROUND_COMPLETED" ? "Round 1 has been completed." : "The organizer has not opened Round 1 yet."} /> : (
            <div className="student-round-form">{draft && submission.leader_note ? <div className="student-round-leader-note"><strong>LEADER ASKED FOR CHANGES</strong><span>{submission.leader_note}</span></div> : null}<div className="student-form-label-row"><label>PROBLEM STATEMENT *</label><span>{statement.length} / 5000</span></div><textarea value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 5000))} rows={10} maxLength={5000} disabled={!canSubmit} placeholder="Example: Students struggle to discover relevant hackathons and form teams with complementary skills..." /><div className="student-form-actions"><span>{isLeader ? "Minimum 20 characters. Once submitted, your team cannot submit Round 1 again." : "Minimum 20 characters. Your leader reviews it before it becomes official."}</span><button className="student-primary-btn" disabled={!canSubmit || statement.trim().length < 20} onClick={handleSubmitClick}>{saving ? "SUBMITTING..." : isLeader ? "SUBMIT ROUND 1 ↗" : "SEND TO LEADER FOR APPROVAL ↗"}</button></div></div>
          )}
        </div>
      </div>
      <ParticipantAgreementModal open={showAgreement} hackathonName={value(hackathon.title, "Hackathon")} accepted={false} onClose={() => setShowAgreement(false)} onAccept={() => { setShowAgreement(false); agreementAction === "approve" ? approve() : doSubmit(); }} />
    </section>
  );
}

function StudentRoundTwoPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useSyncedHackathon();
  const [data, setData] = useState(null);
  const [github, setGithub] = useState("");
  const [pdf, setPdf] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = async (id) => {
    if (!id) return;

    setLoadingStatus(true);
    setError("");

    try {
      const result = await apiFetch(
        `/student/round2/hackathons/${id}`
      );

      const payload = result;

      setData(payload);
      setGithub(
        payload?.submission?.github_url || ""
      );
      setPdf(
        payload?.submission?.pdf_url || ""
      );
    } catch (err) {
      setData(null);
      setError(
        err.message ||
          "Failed to fetch Round 2 status"
      );
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    apiFetch(
      "/student/hackathons/my-hackathons"
    )
      .then((result) => {
        const list = dedupeHackathons(
          unwrapList(result, [
            "hackathons",
            "data",
          ])
        );

        setItems(list);

        if (list[0]) {
          setSelected(
            String(
              list[0].hackathon_id ||
                list[0].id
            )
          );
        }
      })
      .catch((err) =>
        setError(err.message)
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMessage("");
    loadStatus(selected);
  }, [selected]);

  const submission =
    data?.submission || null;

  const roundRecord =
    getRoundRecord(data, 2);

  const roundStatus = String(
    roundRecord?.status ||
      data?.round_status ||
      ""
  ).toUpperCase();

  const roundCompleted =
    isRoundCompleted(data, 2) ||
    isCompletedStatus(roundStatus);

  const hackathonCompleted =
    isCompletedRecord(
      data?.hackathon
    ) ||
    Number(
      data?.hackathon?.current_round
    ) === 4;

  const accessible =
    !roundCompleted &&
    !hackathonCompleted &&
    data?.accessible === true;

  const submitted =
    Boolean(submission);

  const submit = async () => {
    if (!selected) {
      return setError(
        "Select a hackathon first."
      );
    }

    /*
     * GitHub is OPTIONAL.
     * PDF is REQUIRED.
     */
    if (!pdf.trim()) {
      return setError(
        "Google Drive PDF URL is required."
      );
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiFetch(
        `/student/round2/hackathons/${selected}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            github_url:
              github.trim() || null,
            pdf_url: pdf.trim(),
          }),
        }
      );

      if (result?.submission) {
        setData((current) => ({
          ...(current || {}),
          submission:
            result.submission,
        }));
      }

      setMessage(
        "Round 2 project submitted successfully."
      );

      await loadStatus(selected);
    } catch (err) {
      setError(
        err.message ||
          "Failed to submit Round 2"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        label="Loading Round 2..."
      />
    );
  }

  return (
    <section>
      <PageHeading
        eyebrow="BUILD / ROUND 02"
        title="PROJECT SUBMISSION."
        text="Submit your project PDF when Round 2 is live. GitHub is optional."
      />

      {error && (
        <div className="student-inline-error">
          {error}
        </div>
      )}

      {message && (
        <div className="student-inline-success">
          {message}
        </div>
      )}

      <div
        className={`student-feature-grid student-round-workspace ${
          roundCompleted ||
          hackathonCompleted
            ? "student-round-completed-workspace"
            : ""
        }`}
      >
        <div className="student-feature-card student-round-status-card">
          {(roundCompleted ||
            hackathonCompleted) && (
            <CompletionStamp
              round={
                hackathonCompleted
                  ? null
                  : 2
              }
            />
          )}

          <span className="student-feature-label">
            ROUND 2 STATUS
          </span>

          <StudentHackathonSelector
            value={selected}
            onChange={setSelected}
            items={items}
          />

          {loadingStatus ? (
            <LoadingState
              label="Loading round status..."
            />
          ) : (
            <div className="student-info-list">
              <div>
                <span>
                  ROUND 2 ACCESS
                </span>

                <strong>
                  {roundCompleted
                    ? "COMPLETED"
                    : accessible
                    ? "OPEN"
                    : value(
                        data?.message,
                        "LOCKED"
                      )}
                </strong>
              </div>

              <div>
                <span>
                  SUBMISSION
                </span>

                <strong>
                  {value(
                    submission?.status,
                    "Not submitted"
                  )}
                </strong>
              </div>

              <div>
                <span>
                  DECISION
                </span>

                <strong>
                  {value(
                    data?.decision?.decision,
                    "Pending"
                  )}
                </strong>
              </div>

              <div className="student-feedback-row">
                <span>
                  ORGANIZER FEEDBACK
                </span>

                <strong>
                  {value(
                    data?.decision
                      ?.organizer_feedback,
                    "No feedback yet"
                  )}
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="student-feature-card student-round-form-card">
          <div className="student-feature-card-head">
            <div>
              <span className="student-feature-label">
                IMPLEMENTATION
              </span>

              <h2>
                Submit your project
              </h2>

              <p>
                Google Drive PDF is required.
                GitHub repository is optional.
              </p>
            </div>

            <div className="student-feature-icon">
              <FolderGit2 size={18} />
            </div>
          </div>

          {submitted ? (
            <div className="student-round-submitted">
              <CheckCircle2 size={18} />

              <div>
                <strong>
                  ROUND 2 SUBMITTED
                </strong>

                <span>
                  {submission.status ||
                    "SUBMITTED"}
                </span>
              </div>
            </div>
          ) : roundCompleted ||
            hackathonCompleted ? (
            <div className="student-round-notice student-round-completed-notice">
              <strong>
                {hackathonCompleted
                  ? "HACKATHON COMPLETED"
                  : "ROUND 2 COMPLETED"}
              </strong>

              <span>
                {hackathonCompleted
                  ? "This hackathon has finished. Round 2 is now read-only."
                  : "Round 2 has been completed. New submissions are closed."}
              </span>
            </div>
          ) : !accessible ? (
            <RoundLock round={2} reason="Your Round 1 team decision must be selected and Round 2 must be active." />
          ) : (
            <div className="student-round-form">

              {/* OPTIONAL GITHUB */}
              <label>
                GITHUB REPOSITORY URL{" "}
                <span>(OPTIONAL)</span>
              </label>

              <div className="student-input-icon">
                <LinkIcon size={15} />

                <input
                  value={github}
                  onChange={(e) =>
                    setGithub(
                      e.target.value
                    )
                  }
                  placeholder="https://github.com/username/project"
                />
              </div>

              {/* REQUIRED PDF */}
              <label>
                GOOGLE DRIVE PDF URL{" "}
                <span className="student-required-mark">
                  *
                </span>
              </label>

              <div className="student-input-icon">
                <ExternalLink size={15} />

                <input
                  value={pdf}
                  onChange={(e) =>
                    setPdf(
                      e.target.value
                    )
                  }
                  placeholder="https://drive.google.com/file/d/.../view"
                />
              </div>

              <button
                className="student-primary-btn"
                disabled={
                  saving ||
                  !pdf.trim()
                }
                onClick={submit}
              >
                {saving
                  ? "SUBMITTING..."
                  : "SUBMIT ROUND 2 ↗"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StudentRoundThreePage() {
  const [items, setItems] = useState([]); const [selected, setSelected] = useSyncedHackathon(); const [data, setData] = useState(null); const [github, setGithub] = useState(""); const [demo, setDemo] = useState(""); const [description, setDescription] = useState(""); const [loading, setLoading] = useState(true); const [loadingStatus, setLoadingStatus] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const loadStatus = async (id) => { if (!id) return; setLoadingStatus(true); setError(""); try { const result = await apiFetch(`/student/round3/hackathons/${id}`); const payload = result?.round3 || result?.data || result; setData({ ...payload, round2: result?.round2 || payload?.round2 }); setGithub(payload?.submission?.github_url || ""); setDemo(payload?.submission?.demo_url || ""); setDescription(payload?.submission?.project_description || ""); } catch (err) { setData(null); setError(err.message || "Failed to fetch Round 3 status"); } finally { setLoadingStatus(false); } };
  useEffect(() => { apiFetch("/student/hackathons/my-hackathons").then((result) => { const list = dedupeHackathons(unwrapList(result, ["hackathons", "data"])); setItems(list); if (list[0]) setSelected(String(list[0].hackathon_id || list[0].id)); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { setMessage(""); loadStatus(selected); }, [selected]);
  const submission = data?.submission || null;
  const roundRecord = getRoundRecord(data, 3);
  const roundStatus = String(roundRecord?.status || data?.round_status || "").toUpperCase();
  const roundCompleted = isRoundCompleted(data, 3) || isCompletedStatus(roundStatus);
  const hackathonCompleted = isCompletedRecord(data?.hackathon) || Number(data?.hackathon?.current_round) === 4;
  const accessible = !roundCompleted && !hackathonCompleted && data?.accessible === true;
  const submitted = Boolean(submission);
  const submit = async () => { if (!selected) return setError("Select a hackathon first."); if (!github.trim()) return setError("GitHub repository URL is required."); setSaving(true); setError(""); setMessage(""); try { const result = await apiFetch(`/student/round3/hackathons/${selected}/submit`, { method: "POST", body: JSON.stringify({ github_url: github.trim(), demo_url: demo.trim() || null, project_description: description.trim() || null }) }); if (result?.submission) setData((current) => ({ ...(current || {}), submission: result.submission })); setMessage("Round 3 final submission sent successfully."); await loadStatus(selected); } catch (err) { setError(err.message || "Failed to submit Round 3"); } finally { setSaving(false); } };
  if (loading) return <LoadingState label="Loading Round 3..." />;
  return <section><PageHeading eyebrow="BUILD / ROUND 03" title="FINAL SUBMISSION." text="Submit the final GitHub repository and optional demo/details when Round 3 is live." />{error && <div className="student-inline-error">{error}</div>}{message && <div className="student-inline-success">{message}</div>}<div className={`student-feature-grid student-round-workspace ${roundCompleted || hackathonCompleted ? "student-round-completed-workspace" : ""}`}><div className="student-feature-card student-round-status-card">{(roundCompleted || hackathonCompleted) && <CompletionStamp round={hackathonCompleted ? null : 3} />}<span className="student-feature-label">FINAL ROUND STATUS</span><StudentHackathonSelector value={selected} onChange={setSelected} items={items}/>{loadingStatus ? <LoadingState label="Loading round status..." /> : <div className="student-info-list"><div><span>ROUND 3 ACCESS</span><strong>{roundCompleted ? "COMPLETED" : accessible ? "OPEN" : value(data?.message, "LOCKED")}</strong></div><div><span>SUBMISSION</span><strong>{value(submission?.status, "Not submitted")}</strong></div><div><span>SCORE</span><strong>{value(submission?.score, data?.score, "Not scored")}</strong></div><div><span>DECISION</span><strong>{value(submission?.decision, data?.decision?.decision, "Pending")}</strong></div><div className="student-feedback-row"><span>ORGANIZER FEEDBACK</span><strong>{value(submission?.organizer_feedback, data?.organizer_feedback, data?.decision?.organizer_feedback, "No feedback yet")}</strong></div></div>}</div><div className="student-feature-card student-round-form-card"><div className="student-feature-card-head"><div><span className="student-feature-label">FINAL BUILD</span><h2>Ship the final project</h2><p>GitHub is required. Demo URL and project description are optional.</p></div><div className="student-feature-icon"><Terminal size={18}/></div></div>{submitted ? <div className="student-round-submitted"><CheckCircle2 size={18}/><div><strong>FINAL SUBMISSION RECEIVED</strong><span>{submission.status || "SUBMITTED"}</span></div></div> : roundCompleted || hackathonCompleted ? <div className="student-round-notice student-round-completed-notice"><strong>HACKATHON COMPLETED</strong><span>All three rounds are finished. This hackathon is now read-only.</span></div> : !accessible ? <RoundLock round={3} reason={value(data?.message, "Your team must be selected from Round 2 and Round 3 must be opened by the organizer.")} /> : <div className="student-round-form"><label>GITHUB REPOSITORY URL *</label><div className="student-input-icon"><LinkIcon size={15}/><input value={github} onChange={(e)=>setGithub(e.target.value)} placeholder="https://github.com/username/project"/></div><label>LIVE DEMO URL <span>(OPTIONAL)</span></label><div className="student-input-icon"><ExternalLink size={15}/><input value={demo} onChange={(e)=>setDemo(e.target.value)} placeholder="https://your-project.vercel.app"/></div><label>PROJECT DESCRIPTION <span>(OPTIONAL)</span></label><textarea rows={6} maxLength={5000} value={description} onChange={(e)=>setDescription(e.target.value.slice(0,5000))} placeholder="Briefly explain the final solution, key features and how it works..."/><div className="student-form-counter">{description.length} / 5000</div><button className="student-primary-btn" disabled={saving || !github.trim()} onClick={submit}>{saving ? "SUBMITTING..." : "SUBMIT FINAL PROJECT ↗"}</button></div>}</div></div></section>;
}

function StudentSubmissionsPage({ project }) {
  const [submission, setSubmission] = useState(null); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  const load = async () => { if (!project?.id) { setLoading(false); return; } try { const result = await apiFetch(`/submissions/projects/${project.id}`); setSubmission(result?.submission || result?.data || null); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [project?.id]);
  const submit = async () => { if (!project?.id) return; setSubmitting(true); setError(""); try { const result = await apiFetch(`/submissions/projects/${project.id}`, { method: "POST" }); setSubmission(result?.submission || result?.data); } catch (err) { setError(err.message); } finally { setSubmitting(false); } };
  if (loading) return <LoadingState label="Loading submission..." />;
  return <section><PageHeading eyebrow="BUILD / DELIVERY" title="SUBMISSIONS." text="Submit your current project to the live hackathon backend." />{error && <div className="student-inline-error">{error}</div>}<div className="student-feature-card"><h2>{value(project?.title, "No project")}</h2><p>Project ID: {value(project?.id)}</p><div className="student-submission-status"><span>STATUS</span><strong>{value(submission?.status, "NOT SUBMITTED")}</strong>{submission?.submitted_at && <small>Submitted {formatDate(submission.submitted_at)}</small>}</div>{project?.id && !submission && <button className="student-primary-btn" disabled={submitting} onClick={submit}>{submitting ? "SUBMITTING..." : "SUBMIT PROJECT ↗"}</button>}</div></section>;
}

function StudentResultsPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useSyncedHackathon();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [hackathonError, setHackathonError] = useState("");
  const [error, setError] = useState("");

  const loadHackathons = async () => {
    setLoading(true);
    setHackathonError("");

    try {
      // Results should use the student's registered hackathons.
      // If that endpoint is temporarily unavailable or returns an empty
      // list, fall back to the available-hackathons endpoint so the selector
      // does not disappear from the page.
      let list = [];
      let registeredError = null;

      try {
        const registeredResult = await apiFetch("/student/hackathons/my-hackathons");
        list = dedupeHackathons(
          unwrapList(registeredResult, ["hackathons", "registrations", "items", "data"])
        );
      } catch (err) {
        registeredError = err;
      }

      if (!list.length) {
        try {
          const availableResult = await apiFetch("/student/hackathons");
          list = dedupeHackathons(
            unwrapList(availableResult, ["hackathons", "registrations", "events", "items", "data"])
          );
        } catch (availableErr) {
          throw registeredError || availableErr;
        }
      }

      setHackathons(list);
      setSelected((current) => {
        if (current && list.some((item) => String(item.hackathon_id || item.hackathon?.id || item.id) === String(current))) {
          return current;
        }
        return String(list[0]?.hackathon_id || list[0]?.hackathon?.id || list[0]?.id || "");
      });
    } catch (err) {
      setHackathons([]);
      setSelected("");
      setHackathonError(err.message || "Unable to fetch hackathons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHackathons(); }, []);

  useEffect(() => {
    if (!selected) {
      setResults([]);
      return;
    }

    setLoadingResults(true);
    setError("");
    apiFetch(`/results/hackathon/${encodeURIComponent(selected)}`)
      .then((data) => setResults(unwrapList(data, ["results", "data", "items"])))
      .catch((err) => {
        setResults([]);
        setError(err.message || "Unable to fetch results.");
      })
      .finally(() => setLoadingResults(false));
  }, [selected]);

  if (loading) return <LoadingState label="Loading results..." />;
  return (
    <section className="student-results-page">
      <PageHeading
        eyebrow="RESULTS / PUBLISHED"
        title="HACKATHON RESULTS."
        text="Results are loaded from the CampusCode result API after publication."
      />

      <div className="student-results-shell">
        <div className="student-results-toolbar">
          <div>
            <span>RESULTS BOARD</span>
            <strong>Published team results</strong>
          </div>
          <select
            className="student-data-select student-results-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">No hackathons available</option>
            {hackathons.map((h) => {
              const id = h.hackathon_id || h.hackathon?.id || h.id;
              return (
              <option key={id} value={id}>
                {value(h.title, h.name, h.hackathon?.title, h.hackathon_name)}
              </option>
              );
            })}
          </select>
        </div>

        {hackathonError && <div className="student-inline-error">{hackathonError}</div>}
        {error && <div className="student-inline-error">{error}</div>}

        {loadingResults ? <LoadingState label="Loading published results..." /> : <div className="student-results-list">
          {results.map((result, index) => {
            const decision = String(result.decision || result.status || "PUBLISHED").toLowerCase();
            const score = value(result.score, result.overall_score, "—");

            return (
              <article
                className={`student-result-card ${decision}`}
                key={result.submission_id || result.team_id || index}
              >
                <div className="student-result-rank">
                  <span>RANK</span>
                  <strong>#{result.rank ?? index + 1}</strong>
                </div>

                <div className="student-result-main">
                  <div className="student-result-title-row">
                    <div>
                      <span className="student-result-kicker">TEAM</span>
                      <h3>{value(result.team_name, result.team?.name, "Team")}</h3>
                      <p>{value(result.project_title, result.project?.title, "Project")}</p>
                    </div>
                    <small className={`student-result-status ${decision}`}>
                      {value(result.decision, result.status, "PUBLISHED")}
                    </small>
                  </div>

                  {(result.organizer_feedback || result.feedback) && (
                    <div className="student-result-feedback">
                      <span>ORGANIZER FEEDBACK</span>
                      <p>{value(result.organizer_feedback, result.feedback)}</p>
                    </div>
                  )}
                </div>

                <div className="student-result-score">
                  <span>SCORE</span>
                  <strong>{score}</strong>
                </div>
              </article>
            );
          })}

          {!results.length && !error && !loadingResults && (
            <EmptyState
              title="NO PUBLISHED RESULTS"
              text="No published results are available for this hackathon."
            />
          )}
        </div>}
      </div>
    </section>
  );
}

function StudentLeaderboardPage() {
  const [hackathons, setHackathons] = useState([]);
  const [selected, setSelected] = useSyncedHackathon();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState("");

  const loadHackathons = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/student/hackathons/my-hackathons");
      const list = dedupeHackathons(unwrapList(result, ["hackathons", "registrations", "items", "data"]));
      setHackathons(list);
      if (!selected && list[0]) {
        setSelected(String(list[0].hackathon_id || list[0].id || list[0].hackathon?.id || ""));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBoard = async (hackathonId) => {
    if (!hackathonId) { setItems([]); return; }
    setLoadingBoard(true);
    setError("");
    try {
      const result = await apiFetch(`/leaderboard/hackathons/${encodeURIComponent(hackathonId)}`);
      setItems(unwrapList(result, ["leaderboard", "results", "items", "data"]));
    } catch (err) {
      setItems([]);
      setError(err.message);
    } finally {
      setLoadingBoard(false);
    }
  };

  useEffect(() => { loadHackathons(); }, []);
  useEffect(() => { if (selected) loadBoard(selected); }, [selected]);

  if (loading) return <LoadingState label="" />;

  return (
    <section>
      <PageHeading
        eyebrow="COMPETE / LEADERBOARD"
        title="LEADERBOARD."
        text="View published Round 3 standings for your registered hackathons."
      />

      <div className="student-feature-card student-leaderboard-card">
        <label className="student-feature-label">HACKATHON</label>
        <select className="student-data-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a registered hackathon</option>
          {hackathons.map((item) => {
            const id = item.hackathon_id || item.id || item.hackathon?.id;
            return <option key={id} value={id}>{value(item.hackathon?.title, item.title, item.name, item.hackathon_name)}</option>;
          })}
        </select>

        {error && <div className="student-inline-error">{error}</div>}
        {loadingBoard ? <LoadingState label="" /> : items.length ? (
          <div className="student-leaderboard-list">
            {items.map((item, index) => (
              <article className="student-leaderboard-row" key={item.team_id || item.id || index}>
                <strong>#{value(item.rank, index + 1)}</strong>
                <div>
                  <b>{value(item.team_name, item.team?.name, "Team")}</b>
                  <span>{value(item.leader_name, item.leader?.name, "Team leader")}</span>
                </div>
                <em>{value(item.score, item.total_score, "—")}</em>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="NO PUBLISHED STANDINGS" text="No leaderboard entries are available for this hackathon yet." />
        )}
      </div>
    </section>
  );
}

function MilestoneConfetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const COLORS = ["#a7f37a", "#7665ff", "#ffffff", "#e8b93c", "#23f39a"];
    const pieces = [];
    const burst = (x, spread) => {
      for (let i = 0; i < 70; i++) {
        pieces.push({
          x, y: H * 0.72,
          vx: (Math.random() - 0.5) * spread,
          vy: -Math.random() * 13 - 5,
          s: Math.random() * 7 + 4,
          r: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          life: 1,
        });
      }
    };
    burst(W * 0.5, 16);
    setTimeout(() => burst(W * 0.22, 10), 180);
    setTimeout(() => burst(W * 0.78, 10), 320);
    let raf;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.008;
        if (p.life <= 0 || p.y > H + 20) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s * 0.62);
        ctx.restore();
      }
      if (pieces.some((p) => p.life > 0 && p.y < H + 20)) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="milestone-confetti" aria-hidden="true" />;
}

function StudentMilestoneOverlay({ milestone, onClose }) {
  if (!milestone) return null;
  const config = milestone.type === "registered"
    ? { eyebrow: "REGISTRATION CONFIRMED", title: "YOU'RE IN.", copy: `Your registration for ${milestone.hackathon || "this hackathon"} is confirmed. Time to build.` }
    : milestone.type === "advanced"
      ? { eyebrow: "NEXT ROUND UNLOCKED", title: "YOU MADE IT THROUGH.", copy: `Your Round ${milestone.fromRound || 1} submission was selected. Round ${milestone.toRound || 2} is now unlocked.` }
      : { eyebrow: "WINNER", title: "YOU DID IT.", copy: `Congratulations — you won ${milestone.hackathon || "the hackathon"}.` };
  return <div className="student-milestone-backdrop"><MilestoneConfetti /><div className="student-milestone-card"><div className="student-milestone-icon">✦</div><span>{config.eyebrow}</span><h2>{config.title}</h2><p>{config.copy}</p><button onClick={onClose}>CONTINUE BUILDING</button></div></div>;
}

function ParticipantAgreementModal({ open, hackathonName, accepted, onClose, onAccept }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (!open) setChecked(false); }, [open]);
  if (!open) return null;
  return (
    <div className="student-agreement-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="student-agreement-modal" role="dialog" aria-modal="true" aria-labelledby="agreement-title">
        <button type="button" className="student-agreement-close" onClick={onClose}>×</button>
        <span className="student-feature-label">BEFORE OFFICIAL SUBMISSION</span>
        <h2 id="agreement-title">Participant Agreement</h2>
        <p className="student-agreement-intro">Please review and accept this agreement before submitting your team's Round 1 idea for <strong>{hackathonName}</strong>.</p>
        <div className="student-agreement-points">
          <div><b>01</b><span><strong>Team responsibility</strong>Your team is responsible for the accuracy of the submitted problem statement.</span></div>
          <div><b>02</b><span><strong>Submission rules</strong>Once submitted, the Round 1 idea becomes an official hackathon submission.</span></div>
          <div><b>03</b><span><strong>Original work</strong>Submit work that your team is authorized to use and represent.</span></div>
          <div><b>04</b><span><strong>Organizer review</strong>Your submission may be reviewed according to the hackathon workflow and organizer decisions.</span></div>
        </div>
        <label className="student-agreement-check">
          <input type="checkbox" checked={checked || accepted} onChange={(e) => setChecked(e.target.checked)} disabled={accepted} />
          <span>I have read and agree to the Participant Agreement.</span>
        </label>
        <div className="student-agreement-actions">
          <button type="button" className="student-outline-btn" onClick={onClose}>CANCEL</button>
          <button type="button" className="student-primary-btn" disabled={!checked && !accepted} onClick={onAccept}>ACCEPT &amp; CONTINUE →</button>
        </div>
        <small className="student-agreement-version">Agreement version 1.0 · Acceptance is stored for this hackathon on this device.</small>
      </section>
    </div>
  );
}


function StudentGuidePage() {
  const [openFaq, setOpenFaq] = useState(0);
  const sections = [
    ["01", "GET STARTED", "Use your Dashboard to see your current activity, notifications and available hackathons."],
    ["02", "JOIN A HACKATHON", "Open Hackathons, review the event information and use JOIN HACKATHON when you are eligible."],
    ["03", "BUILD YOUR TEAM", "After joining, open My Team to create a team or use HackMate AI to discover compatible participants."],
    ["04", "SUBMIT YOUR IDEA", "When Round 1 is live, your team submits its problem statement. A Participant Agreement appears before the official submission."],
    ["05", "ROUND 1 → ROUND 3", "Watch the round status in each workspace. A later round can remain locked until the organizer workflow opens it for your team."],
    ["06", "CHECK RESULTS", "Use Results and Leaderboard to view published outcomes, scores and available organizer feedback."],
    ["07", "USE AI RESPONSIBLY", "IdeaCheck helps you review an idea. RuleBot helps with hackathon rules. Always treat the organizer's official instructions as authoritative."],
  ];
  const faqs = [
    ["Can I submit Round 1 without a team?", "No. The current StudentPanel requires you to be part of a team before Round 1 submission."],
    ["Why is my round locked?", "A round can be unavailable because the organizer has not opened it, the previous workflow has not selected your team, or the round has completed."],
    ["Where should I look for official communication?", "Use the Official Communication page and follow the official CampusCode WhatsApp channel linked there."],
    ["Can RuleBot replace organizer instructions?", "No. RuleBot is an assistance tool. For a final decision about a hackathon rule, follow the official organizer communication and rulebook."],
  ];
  return (
    <section className="student-guide-page">
      <PageHeading eyebrow="HELP / CAMPUSCODE GUIDE" title="STUDENT GUIDE." text="Everything you need to navigate CampusCode, from joining a hackathon to completing your final round." />
      <div className="student-guide-hero"><div><span className="student-feature-label">YOUR PLAYBOOK</span><h2>JOIN. BUILD. SUBMIT. ADVANCE.</h2><p>Follow the journey in order. Your dashboard and round pages will tell you what is currently available.</p></div><div className="student-guide-hero-mark"><CCMark /></div></div>
      <div className="student-guide-grid">{sections.map(([number, title, text]) => <article key={number} className="student-guide-card"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      <div className="student-guide-two-col">
        <section className="student-feature-card"><span className="student-feature-label">DO THIS</span><h2>WHAT TO DO</h2><ul className="student-guide-list"><li>Read the hackathon details before joining.</li><li>Create or join the correct team for the hackathon.</li><li>Check your round status before preparing a submission.</li><li>Keep your project information accurate and consistent.</li><li>Read official announcements and deadlines.</li><li>Use IdeaCheck and RuleBot as supporting tools.</li></ul></section>
        <section className="student-feature-card"><span className="student-feature-label">AVOID THIS</span><h2>WHAT NOT TO DO</h2><ul className="student-guide-list"><li>Do not submit copied or unauthorized work.</li><li>Do not share account credentials with other people.</li><li>Do not wait until the last moment to check a round.</li><li>Do not treat AI output as an official organizer decision.</li><li>Do not ignore organizer announcements.</li><li>Do not submit to the wrong hackathon or team.</li></ul></section>
      </div>
      <section className="student-feature-card student-guide-faq"><div className="student-feature-card-head"><div><span className="student-feature-label">FAQ</span><h2>COMMON QUESTIONS</h2></div><Bot size={19}/></div>{faqs.map(([q,a], index) => <div className="student-guide-faq-row" key={q}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{q}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{a}</p>}</div>)}</section>
    </section>
  );
}


function OfficialCommunicationPage() {
  const channel = "https://whatsapp.com/channel/0029Vb8gR7TEVccLc1pW4O2d";
  const [showToast, setShowToast] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowToast(false), 8000);
    return () => clearTimeout(t);
  }, []);
  return <section><PageHeading eyebrow="COMMUNICATION / OFFICIAL" title="OFFICIAL COMMUNICATION." text="Use the official CampusCode channel for important announcements and communication." />{showToast && (<div className="announce-toast" role="status"><span className="bell"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8e62e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg></span><div><strong>New announcement</strong><p>Follow the official CampusCode WhatsApp channel for hackathon updates, announcements and deadlines.</p></div><button type="button" onClick={() => setShowToast(false)} aria-label="Dismiss announcement">✕</button></div>)}<div className="student-communication-hero"><div className="student-communication-icon">◉</div><div><span className="student-feature-label">CAMPUSCODE OFFICIAL CHANNEL</span><h2>Stay connected.</h2><p>Follow the official WhatsApp channel for hackathon updates, announcements, deadlines and important communication.</p><a href={channel} target="_blank" rel="noreferrer" className="student-primary-btn">OPEN WHATSAPP CHANNEL ↗</a></div></div><div className="student-two-col"><div className="student-feature-card"><span className="student-feature-label">IMPORTANT</span><h3>Check official updates first.</h3><p>When a deadline, round instruction or organizer decision changes, rely on the official communication shared by CampusCode and your hackathon organizer.</p></div><div className="student-feature-card"><span className="student-feature-label">QUICK ACCESS</span><h3>Keep this channel easy to find.</h3><p>Save or follow the channel so you can quickly return to official announcements when you are working on a submission.</p></div></div></section>;
}


function HelpSupportPage() {
  return <section><PageHeading eyebrow="HELP / SUPPORT" title="HELP & SUPPORT." text="Start with the guide and FAQs. If you still need help, use the official communication channel or contact your organizer." /><div className="student-support-grid"><div className="student-support-card"><span>01</span><h3>Student Guide</h3><p>Learn how the CampusCode workflow works from joining a hackathon through results.</p><button className="student-outline-btn" onClick={() => window.dispatchEvent(new CustomEvent("campuscode:navigate", { detail: "Student Guide" }))}>OPEN GUIDE →</button></div><div className="student-support-card"><span>02</span><h3>FAQs</h3><p>Find answers about teams, rounds, submissions, AI assistance and communication.</p><button className="student-outline-btn" onClick={() => window.dispatchEvent(new CustomEvent("campuscode:navigate", { detail: "Student Guide" }))}>VIEW FAQ →</button></div><div className="student-support-card"><span>03</span><h3>Official WhatsApp</h3><p>Follow the official CampusCode channel for announcements and important updates.</p><a className="student-outline-btn" href="https://whatsapp.com/channel/0029Vb8gR7TEVccLc1pW4O2d" target="_blank" rel="noreferrer">OPEN CHANNEL →</a></div></div></section>;
}

function StudentRoundsPage() {
  const [tab, setTab] = useState(1);
  const tabs = [
    { id: 1, label: "ROUND 1", sub: "Problem statement" },
    { id: 2, label: "ROUND 2", sub: "Project build" },
    { id: 3, label: "ROUND 3", sub: "Final submission" },
  ];
  return (
    <section>
      <PageHeading
        eyebrow="BUILD / ROUNDS"
        title="ROUNDS."
        text="All three rounds on one page. Switch tabs to submit, track status, or review AI analysis."
      />
      <div className="rounds-tabs" role="tablist" aria-label="Hackathon rounds">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rounds-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="rounds-tab-num">0{t.id}</span>
            <span className="rounds-tab-text">
              <strong>{t.label}</strong>
              <small>{t.sub}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="rounds-panel" key={tab} role="tabpanel">
        {tab === 1 && <StudentRoundOnePage />}
        {tab === 2 && <StudentRoundTwoPage />}
        {tab === 3 && <StudentRoundThreePage />}
      </div>
    </section>
  );
}

/* =========================================================
   v6.17 — EVENT HUB
   One page per event. Rounds, team, results, leaderboard and
   certificates live here as tabs instead of top-level nav
   items — the Unstop pattern: the event is the home.
   Tabs reuse the existing pages; the hub only sets the synced
   event selection and (for id-only opens) resolves the record.
========================================================= */
/* =========================================================
   v6.17 — QUIZ (student side)
   QuizOverview: meta + attempt status for the hub Overview tab.
   StudentQuizPage: start → timed taking → instant result.
   QuizLeaderboard: submitted attempts, score desc, time asc.
   Correct answers are only ever rendered AFTER submit.
========================================================= */
function QuizOverview({ event, onGoToQuiz }) {
  const id = String(event?.hackathon_id || event?.hackathon?.id || event?.id || "");
  const [meta, setMeta] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/quizzes/${id}/attempts/mine`)
      .then((data) => { setMeta(data?.meta || null); setAttempt(data?.attempt || null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState label="Loading quiz details..." />;
  if (error) return <ErrorState message={error} retry={() => window.location.reload()} />;
  if (!meta) return <EmptyState title="QUIZ NOT FOUND" text="No quiz details were returned for this event." />;

  return (
    <section>
      <div className="registration-detail-head">
        <div><span>QUESTIONS</span><strong>{meta.question_count}</strong></div>
        <div><span>TOTAL MARKS</span><strong>{meta.total_marks}</strong></div>
        <div><span>DURATION</span><strong>{meta.duration_minutes} MIN</strong></div>
        <div><span>NEGATIVE</span><strong>{meta.negative_marks ? `−${meta.negative_marks}` : "NONE"}</strong></div>
      </div>
      <div className="student-panel-card" style={{ marginTop: 16 }}>
        <div className="student-panel-title"><span>HOW THIS QUIZ WORKS</span></div>
        <p style={{ lineHeight: 1.7, color: "#555" }}>
          Solo quiz, single attempt. The timer starts when you press Start and
          auto-submits at zero — answers saved so far are still scored.
          {meta.negative_marks ? ` Wrong answers cost ${meta.negative_marks} mark${meta.negative_marks === 1 ? "" : "s"} each; skipped questions cost nothing.` : " No negative marking."}
          {meta.start_date && ` Window opens ${formatDate(meta.start_date)}.`}
          {meta.end_date && ` Window closes ${formatDate(meta.end_date)}.`}
        </p>
        {attempt?.status === "SUBMITTED" && (
          <p style={{ marginTop: 12 }}><strong>Your score: {attempt.score} / {attempt.total_marks}</strong> — open the Quiz tab for the full review.</p>
        )}
        {attempt?.status === "IN_PROGRESS" && (
          <p style={{ marginTop: 12 }}><strong>Your attempt is in progress</strong> — open the Quiz tab to resume before the timer ends.</p>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="student-primary-btn" onClick={onGoToQuiz}>
            {attempt?.status === "SUBMITTED" ? "VIEW RESULT ↗" : attempt?.status === "IN_PROGRESS" ? "RESUME QUIZ ↗" : "OPEN QUIZ ↗"}
          </button>
        </div>
      </div>
    </section>
  );
}

function QuizLeaderboard({ eventId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const myId = String(storedUser?.id || storedUser?.user_id || "");

  useEffect(() => {
    apiFetch(`/quizzes/${eventId}/leaderboard`)
      .then((data) => setRows(Array.isArray(data?.leaderboard) ? data.leaderboard : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <LoadingState label="Loading leaderboard..." />;
  if (error) return <ErrorState message={error} retry={() => window.location.reload()} />;
  if (!rows.length) return <EmptyState title="NO RESULTS YET" text="Nobody has submitted this quiz yet. The leaderboard fills up as submissions come in." />;

  return (
    <section>
      <PageHeading eyebrow="RESULTS / LEADERBOARD" title="LEADERBOARD." text="Highest score first; ties break by earliest submission." />
      <div className="student-panel-card">
        {rows.map((row, i) => (
          <div className="round-row" key={row.user_id} style={String(row.user_id) === myId ? { background: "rgba(168,230,46,.12)" } : undefined}>
            <div className="round-number">{i + 1}</div>
            <div><strong>{row.user_name || "Student"}</strong><span>{row.correct_count}/{row.question_count} correct</span></div>
            <b>{row.score} / {row.total_marks}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

/* v6.19 — M1 quiz score count-up (0 → final score, ease-out) */
function QuizScoreCount({ score }) {
  const target = Number(score) || 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setShown(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{Number.isInteger(shown) ? Math.round(shown) : shown.toFixed(1)}</>;
}

function StudentQuizPage({ eventId }) {
  const [phase, setPhase] = useState("loading");
  const [meta, setMeta] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [detail, setDetail] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef({});
  // v6.19 — proctored quiz: terms gate, camera/mic presence check
  // (permission only — nothing recorded, streamed or stored),
  // fullscreen + exit/tab-switch flags, visited-question palette.
  const [termsChecked, setTermsChecked] = useState(false);
  const [permWarning, setPermWarning] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [showFsOverlay, setShowFsOverlay] = useState(false);
  const [visited, setVisited] = useState(() => new Set([0]));
  const mediaRef = useRef(null);
  const fsExitsRef = useRef(0);
  const tabSwitchesRef = useRef(0);
  const intentionalFsExitRef = useRef(false);

  const applyLoaded = (data) => {
    setMeta(data?.meta || null);
    setAttempt(data?.attempt || null);
    if (data?.attempt?.status === "SUBMITTED") {
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setDetail(Array.isArray(data?.detail) ? data.detail : []);
      setPhase("submitted");
    } else if (data?.attempt?.status === "IN_PROGRESS") {
      const qs = Array.isArray(data?.questions) ? data.questions : [];
      const ans = data?.attempt?.answers || {};
      setQuestions(qs);
      setAnswers(ans);
      answersRef.current = ans;
      setRemaining(typeof data?.remaining_seconds === "number" ? data.remaining_seconds : null);
      // Refresh lands on a resume gate (media + fullscreen again),
      // never straight back into the quiz.
      setVisited(new Set([0, ...qs.map((q, i) => (ans[q.id] !== undefined && ans[q.id] !== null ? i : -1)).filter((i) => i >= 0)]));
      setPhase("resume");
    } else {
      setPhase("ready");
    }
  };

  const load = async () => {
    setPhase("loading"); setError("");
    try {
      const data = await apiFetch(`/quizzes/${eventId}/attempts/mine`);
      applyLoaded(data);
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/quizzes/${eventId}/attempts/mine`)
      .then((data) => { if (!cancelled) applyLoaded(data); })
      .catch((err) => { if (!cancelled) { setError(err.message); setPhase("error"); } });
    return () => { cancelled = true; };
  }, [eventId]);

  const submit = async (finalAnswers) => {
    if (submitting) return;
    setSubmitting(true); setError("");
    try {
      const data = await apiFetch(`/quizzes/${eventId}/attempts/${attempt.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: finalAnswers }),
      });
      setAttempt(data?.attempt || null);
      setDetail(Array.isArray(data?.detail) ? data.detail : []);
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setPhase("submitted");
      // Quiz over: camera/mic indicator off, leave fullscreen.
      try { (mediaRef.current || []).forEach((t) => t.stop()); } catch {}
      mediaRef.current = null;
      try { if (document.fullscreenElement) { intentionalFsExitRef.current = true; await document.exitFullscreen(); } } catch {}
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown: server-anchored start, client tick, auto-submit at zero.
  useEffect(() => {
    if (phase !== "taking" || remaining === null) return;
    if (remaining <= 0) { submit(answersRef.current); return; }
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return r;
        if (r <= 1) {
          clearInterval(timer);
          submit(answersRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attempt?.id]);

  // v6.19 — proctored quiz: stop camera/mic tracks on unmount.
  useEffect(() => () => {
    try { (mediaRef.current || []).forEach((t) => t.stop()); } catch {}
    mediaRef.current = null;
  }, []);

  // v6.19 — proctored quiz: fullscreen exits + tab switches are
  // counted (not auto-submit) and reported best-effort.
  const sendProctor = () => {
    if (!attempt?.id) return;
    apiFetch(`/quizzes/${eventId}/attempts/${attempt.id}/proctor`, {
      method: "PUT",
      body: JSON.stringify({ fullscreen_exits: fsExitsRef.current, tab_switches: tabSwitchesRef.current }),
    }).catch(() => {});
  };
  useEffect(() => {
    if (phase !== "taking") return;
    const onFsChange = () => {
      if (document.fullscreenElement) return;
      if (intentionalFsExitRef.current) { intentionalFsExitRef.current = false; return; }
      fsExitsRef.current += 1;
      setShowFsOverlay(true);
      sendProctor();
    };
    const onVis = () => {
      if (document.hidden) { tabSwitchesRef.current += 1; sendProctor(); }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attempt?.id]);

  const requestFullscreen = async () => {
    try { await document.documentElement.requestFullscreen(); } catch {}
  };

  // Camera + mic presence check only: permission is requested,
  // the browser indicator stays on during the quiz, tracks stop
  // at submit. Nothing is recorded, streamed, uploaded or stored.
  const beginAttempt = async () => {
    setPermBusy(true); setPermWarning(false);
    let denied = false;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaRef.current = stream.getTracks();
      } else denied = true;
    } catch { denied = true; }
    setPermBusy(false);
    // Warn-and-allow: a denial shows a warning and waits for the
    // student to press Continue, instead of locking them out.
    if (denied) { setPermWarning(true); return; }
    await requestFullscreen();
    await start();
  };
  const continueWithoutCamera = async () => {
    setPermWarning(false);
    await requestFullscreen();
    await start();
  };

  const start = async () => {
    setStarting(true); setError("");
    try {
      const data = await apiFetch(`/quizzes/${eventId}/attempts`, { method: "POST", body: JSON.stringify({ terms_accepted: true }) });
      setAttempt(data?.attempt || null);
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setRemaining(typeof data?.remaining_seconds === "number" ? data.remaining_seconds : null);
      setCurrent(0);
      setVisited(new Set([0]));
      setPhase("taking");
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const pick = (questionId, index) => {
    const next = { ...answers, [questionId]: index };
    setAnswers(next);
    answersRef.current = next;
    setVisited((prev) => { const n = new Set(prev); n.add(current); return n; });
    if (attempt?.id) {
      apiFetch(`/quizzes/${eventId}/attempts/${attempt.id}/answers`, {
        method: "PUT",
        body: JSON.stringify({ answers: next }),
      }).catch(() => {});
    }
  };

  const goTo = (i) => {
    setVisited((prev) => { const n = new Set(prev); n.add(i); return n; });
    setCurrent(i);
  };

  const fmtTime = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  if (phase === "loading") return <LoadingState label="Loading quiz..." />;
  if (phase === "error") return <ErrorState message={error} retry={load} />;

  if (phase === "ready") {
    return (
      <section>
        <PageHeading eyebrow="QUIZ / READY" title="READY WHEN YOU ARE." text="Single attempt. Review the rules and turn on camera & mic first — the timer starts after you accept." />
        {meta && (
          <div className="registration-detail-head">
            <div><span>QUESTIONS</span><strong>{meta.question_count}</strong></div>
            <div><span>DURATION</span><strong>{meta.duration_minutes} MIN</strong></div>
            <div><span>TOTAL MARKS</span><strong>{meta.total_marks}</strong></div>
            <div><span>NEGATIVE</span><strong>{meta.negative_marks ? `−${meta.negative_marks}` : "NONE"}</strong></div>
          </div>
        )}
        {error && <ErrorState message={error} retry={load} />}
        <div style={{ marginTop: 20 }}>
          <button className="student-primary-btn" disabled={starting} onClick={() => setPhase("terms")}>
            START QUIZ ↗
          </button>
        </div>
      </section>
    );
  }

  if (phase === "terms") {
    return (
      <section>
        <PageHeading eyebrow="QUIZ / RULES" title="READ BEFORE YOU START." text="Accept the rules to begin. The timer starts after you accept." />
        {meta && (
          <div className="registration-detail-head">
            <div><span>QUESTIONS</span><strong>{meta.question_count}</strong></div>
            <div><span>DURATION</span><strong>{meta.duration_minutes} MIN</strong></div>
            <div><span>TOTAL MARKS</span><strong>{meta.total_marks}</strong></div>
            {meta.end_date && (<div><span>WINDOW ENDS</span><strong>{formatDate(meta.end_date)}</strong></div>)}
          </div>
        )}
        <div className="student-panel-card" style={{ marginTop: 16 }}>
          <div style={{ maxHeight: 340, overflowY: "auto", paddingRight: 8 }}>
            <ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>
              <li>Single attempt only — you cannot restart or re-attempt this quiz.</li>
              <li>The timer ({meta?.duration_minutes || "—"} minutes) starts the moment you accept, and the quiz auto-submits at zero or at the window end, whichever comes first.</li>
              <li>Your camera must remain ON for the entire quiz. Do not cover, turn off, or move away from the camera.</li>
              <li>Your microphone must remain ON for the entire quiz. Keep your surroundings quiet and free of disturbance.</li>
              <li>The quiz must be taken in fullscreen. Do not exit fullscreen at any point during the quiz.</li>
              <li>Every fullscreen exit is logged and visible to the organizer.</li>
              <li>Every tab switch or window switch is logged and visible to the organizer.</li>
              <li>Do not open any other tab, application, or window during the quiz.</li>
              <li>Do not use AI tools, chatbots, or search engines to answer any question.</li>
              <li>Do not use a second device — phone, tablet, or another laptop — during the quiz.</li>
              <li>Do not take help from any other person during the quiz.</li>
              <li>Do not copy, photograph, screenshot, record, or share any question.</li>
              <li>Do not refresh or close the browser mid-quiz unless you must resume — the timer keeps running and you return through the resume screen.</li>
              <li>Answers are autosaved as you pick them. Skipped questions can be revisited from the number grid until you submit.</li>
              <li>Negative marking applies as configured for this quiz — wrong answers reduce your score, skipped questions score zero.</li>
              <li>Your total score can never go below zero.</li>
              <li>Use only your own registered account. Impersonation leads to immediate disqualification.</li>
              <li>Do not share your login or quiz link with anyone else.</li>
              <li>Keep a stable internet connection. The timer keeps running through disconnections, and no extra time is given for connectivity loss.</li>
              <li>The quiz window closes at the scheduled end time — a late start does not extend your time.</li>
              <li>Any disturbance, malpractice, or rule violation may lead to your removal from the quiz and disqualification by the organizer.</li>
              <li>The organizer may mark an attempt invalid based on the logged fullscreen exits, tab switches, and permission status.</li>
              <li>Your score is shown instantly after submit. Correct answers are never shown before you submit.</li>
              <li>Scores and results once submitted are final. No re-evaluation requests will be entertained.</li>
              <li>The organizer's decision on disqualification, results, and rankings is final and binding.</li>
              <li>By accepting below, you agree to all the rules above and to the logging described in them.</li>
            </ol>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} style={{ marginTop: 4 }} />
            <span>I have read the rules and I accept them.</span>
          </label>
          {permWarning && (<div className="student-inline-error" style={{ marginTop: 12 }}>Camera or microphone permission was denied. You can continue without it, but the organizer will see that camera/mic permission was not granted. <button type="button" className="student-outline-btn" style={{ marginLeft: 8 }} onClick={continueWithoutCamera}>CONTINUE WITHOUT CAMERA</button></div>)}
          {error && <ErrorState message={error} retry={load} />}
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="student-primary-btn" disabled={!termsChecked || permBusy || starting} onClick={beginAttempt}>{permBusy ? "WAITING FOR PERMISSION…" : starting ? "STARTING…" : "ACCEPT & START QUIZ ↗"}</button>
            <button className="student-outline-btn" onClick={() => setPhase("ready")}>← BACK</button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "resume") {
    return (
      <section>
        <PageHeading eyebrow="QUIZ / RESUME" title="PICK UP WHERE YOU LEFT OFF." text="Your answers were autosaved. The timer kept running — resume in fullscreen to continue." />
        {attempt && (<div className="registration-detail-head"><div><span>TIME LEFT</span><strong style={{ color: remaining !== null && remaining < 60 ? "#991b1b" : undefined }}>{fmtTime(remaining)}</strong></div><div><span>ANSWERED</span><strong>{Object.keys(answers).length} / {questions.length}</strong></div></div>)}
        <div style={{ marginTop: 20 }}>
          <button className="student-primary-btn" disabled={permBusy} onClick={async () => { setPermBusy(true); try { if (navigator.mediaDevices?.getUserMedia) { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); mediaRef.current = s.getTracks(); } } catch {} finally { setPermBusy(false); } await requestFullscreen(); setPhase("taking"); }}>{permBusy ? "WAITING FOR PERMISSION…" : "RESUME QUIZ ↗"}</button>
        </div>
      </section>
    );
  }

  if (phase === "submitted") {
    return (
      <section>
        <PageHeading eyebrow="QUIZ / RESULT" title="YOUR RESULT." text="Correct answers are shown for review. Scores are final." />
        {attempt && (
          <div className="registration-detail-head">
            <div className="quiz-result-celebrate"><span className="join-confetti"><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="quiz-score-check"><svg width="30" height="30" viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="13" stroke="#82b91a" strokeWidth="2.5" /><path d="M9 15.5l4 4 8-9" stroke="#82b91a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><span>SCORE</span><strong><QuizScoreCount score={attempt.score} /> / {attempt.total_marks}</strong></div></div>
            <div><span>CORRECT</span><strong>{attempt.correct_count} / {attempt.question_count}</strong></div>
          </div>
        )}
        <div className="student-panel-card" style={{ marginTop: 16 }}>
          {questions.map((q, i) => {
            const d = detail.find((x) => String(x.question_id) === String(q.id));
            const mine = d?.selected_index;
            return (
              <div key={q.id} style={{ padding: "14px 0", borderBottom: "1px solid #eee" }}>
                <p><strong>Q{i + 1}. {q.question_text}</strong> <span style={{ color: d?.is_correct ? "#3f6212" : "#991b1b" }}>{d?.is_correct ? " ✓ Correct" : " ✗ Wrong"}</span></p>
                <p style={{ color: "#555", marginTop: 6 }}>
                  Your answer: {mine === null || mine === undefined ? "Skipped" : q.options?.[mine] ?? "—"}
                  {"  ·  "}Correct answer: {q.options?.[Number(q.correct_index)] ?? "—"}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // taking
  const q = questions[current];
  const answeredCount = questions.filter((item) => answers[item.id] !== undefined && answers[item.id] !== null).length;
  const skippedCount = Math.max(0, visited.size - answeredCount);
  return (
    <section>
      <div className="registration-detail-head">
        <div><span>TIME LEFT</span><strong style={{ color: remaining !== null && remaining < 60 ? "#991b1b" : undefined }}>{fmtTime(remaining)}</strong></div>
        <div><span>QUESTION</span><strong>{questions.length ? `${current + 1} / ${questions.length}` : "—"}</strong></div>
        <div><span>ANSWERED</span><strong>{answeredCount} / {questions.length}</strong></div>
        <div><span>SKIPPED</span><strong>{skippedCount}</strong></div>
        <div><span>LEFT</span><strong>{questions.length - visited.size}</strong></div>
      </div>
      {error && <ErrorState message={error} retry={load} />}
      {!q ? (
        <EmptyState title="NO QUESTIONS" text="This quiz has no questions yet." />
      ) : (
        <div className="student-panel-card" style={{ marginTop: 16 }}>
          <div className="student-panel-title"><span>QUESTION {current + 1}</span><span>{q.marks} MARK{q.marks === 1 ? "" : "S"}</span></div>
          <h3 style={{ fontSize: 18, lineHeight: 1.5 }}>{q.question_text}</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {(q.options || []).map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(q.id, i)}
                style={{
                  textAlign: "left", padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                  border: answers[q.id] === i ? "2px solid #111" : "1px solid #ddd",
                  background: answers[q.id] === i ? "#f7fee7" : "#fff",
                  font: "inherit",
                }}
              >
                <strong>{String.fromCharCode(65 + i)}.</strong> {opt}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button className="student-outline-btn" disabled={current === 0} onClick={() => goTo(current - 1)}>← PREVIOUS</button>
            <button className="student-outline-btn" disabled={current >= questions.length - 1} onClick={() => goTo(current + 1)}>NEXT →</button>
            <button
              className="student-primary-btn"
              disabled={submitting}
              onClick={() => {
                if (window.confirm("Submit the quiz? You cannot change answers after this.")) submit(answersRef.current);
              }}
            >
              {submitting ? "SUBMITTING..." : "SUBMIT QUIZ"}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {questions.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => goTo(i)}
            style={{
              width: 36, height: 36, borderRadius: 8, cursor: "pointer", font: "inherit", fontWeight: 700,
              border: i === current ? "2px solid #111" : visited.has(i) ? "1px solid #e11d48" : "1px solid #ddd",
              background: answers[item.id] !== undefined && answers[item.id] !== null ? "#a8e62e" : visited.has(i) ? "#fee2e2" : "#fff",
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {showFsOverlay && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, textAlign: "center" }}>
            <h3>You left fullscreen</h3>
            <p style={{ marginTop: 8 }}>This exit has been counted. Return to fullscreen to continue the quiz.</p>
            <button className="student-primary-btn" style={{ marginTop: 16 }} onClick={async () => { await requestFullscreen(); setShowFsOverlay(false); }}>RETURN TO FULLSCREEN ↗</button>
          </div>
        </div>
      )}
    </section>
  );
}

function EventHub({ event, tab, setTab, onBack }) {
  const [resolved, setResolved] = useState(event);
  // Id-only opens start in resolving state; no sync setState in the effect.
  const [resolving, setResolving] = useState(
    () =>
      Boolean(
        event?.hackathon_id || event?.hackathon?.id || event?.id
      ) &&
      !event?.title &&
      !event?.hackathon?.title &&
      !event?.name
  );

  const id = String(
    event?.hackathon_id || event?.hackathon?.id || event?.id || ""
  );
  const rawTitle =
    resolved?.hackathon?.title ||
    resolved?.title ||
    resolved?.name ||
    resolved?.hackathon_name ||
    "Event";
  const title = String(rawTitle);

  // v6.17 — quiz events get quiz tabs, not rounds/team tabs.
  const eventType = resolved?.event_type || resolved?.hackathon?.event_type || "hackathon";
  const isQuiz = eventType === "quiz";

  useEffect(() => {
    // Id-only opens (e.g. HackMate's "open my team") resolve the record.
    if (!id || resolved?.title || resolved?.hackathon?.title || resolved?.name) return;
    let cancelled = false;
    apiFetch("/student/hackathons/my-hackathons")
      .then((result) => {
        if (cancelled) return;
        const list = dedupeHackathons(
          unwrapList(result, ["hackathons", "registrations", "events", "items", "data"])
        );
        const found = list.find(
          (item) => String(item.hackathon_id || item.hackathon?.id || item.id || "") === id
        );
        if (found) setResolved(found);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, resolved]);

  // v6.20 — quizzes are solo: never land on the team tab for a quiz.
  useEffect(() => {
    if (isQuiz && tab === "team") setTab("overview");
  }, [isQuiz, tab, setTab]);

  const tabs = isQuiz
    ? [
        ["overview", "Overview"],
        ["quiz", "Quiz"],
        ["leaderboard", "Leaderboard"],
        ["certificates", "Certificates"],
        ["announcements", "Announcements"],
      ]
    : [
        ["overview", "Overview"],
        ["rounds", "Rounds"],
        ["team", "My Team"],
        ["results", "Results"],
        ["leaderboard", "Leaderboard"],
        ["certificates", "Certificates"],
        ["announcements", "Announcements"],
      ];

  return (
    <section>
      <button className="back-btn" onClick={onBack}>← ALL MY EVENTS</button>
      <PageHeading
        eyebrow="EVENT / LIVE HUB"
        title={`${title.toUpperCase()}.`}
        text={
          isQuiz
            ? "Everything for this quiz lives here — the timed quiz, leaderboard and certificates."
            : "Everything for this event lives here — rounds, team, results, leaderboard and certificates."
        }
      />
      <div className="event-hub-tabs" role="tablist" aria-label="Event sections">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`event-hub-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {resolving && <LoadingState label="Loading event..." />}
      {!resolving && (
        <div key={tab} className="event-hub-panel">
          {tab === "overview" && (
            isQuiz
              ? <QuizOverview event={resolved} onGoToQuiz={() => setTab("quiz")} />
              : <RegistrationDetail registration={resolved} onBack={onBack} bare />
          )}
          {tab === "rounds" && <StudentRoundsPage />}
          {tab === "team" && !isQuiz && <StudentMyTeamPage lockedHackathonId={id} />}
          {tab === "results" && <StudentResultsPage />}
          {tab === "quiz" && <StudentQuizPage eventId={id} />}
          {tab === "leaderboard" && (
            isQuiz ? <QuizLeaderboard eventId={id} /> : <StudentLeaderboardPage />
          )}
          {tab === "certificates" && <CertificatesPage hackathonId={id} />}
          {tab === "announcements" && <OfficialCommunicationPage />}
        </div>
      )}
    </section>
  );
}

function StudentPanel() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedHackathon, setSelectedHackathon] = useState(null);
  const [hubTab, setHubTab] = useState("overview");
  const [syncedId, setSyncedId] = useSyncedHackathon();
  const [project, setProject] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const showMilestone = (type, payload = {}) => { setMilestone({ type, ...payload }); window.clearTimeout(window.__campusCodeMilestoneTimer); window.__campusCodeMilestoneTimer = window.setTimeout(() => setMilestone(null), 4800); };
  const { unread, toasts, clearBadge, dismissToast } = useLiveNotifications();

  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const displayName = storedUser.name || "Student";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

  const navItems = [
    ["Overview", <LayoutDashboard size={16} strokeWidth={1.8} />],
    ["Events", <Trophy size={16} strokeWidth={1.8} />],
    ["My Events", <Clock3 size={16} strokeWidth={1.8} />],
    ["HackMate AI", <Sparkles size={16} strokeWidth={1.8} />],
    ["IdeaCheck AI", <Sparkles size={16} strokeWidth={1.8} />],
    ["Certificates", <Award size={16} strokeWidth={1.8} />],
    ["Digital Card", <IdCard size={16} strokeWidth={1.8} />],
    ["RuleBot AI", <Bot size={16} strokeWidth={1.8} />],
    ["Student Guide", <Bot size={16} strokeWidth={1.8} />],
    ["Official Communication", <Bell size={16} strokeWidth={1.8} />],
    ["Notifications", <Bell size={16} strokeWidth={1.8} />],
    ["Help & Support", <Bot size={16} strokeWidth={1.8} />],
    ["Profile", <UserCircle size={16} strokeWidth={1.8} />],
  ];
  const handleNav = (label) => { setActiveNav(label); setSelectedHackathon(null); setSidebarOpen(false); requestAnimationFrame(() => { const main = document.querySelector(".student-main"); if (main) main.scrollTo({ top: 0, behavior: "smooth" }); }); };
  // Open an event's hub. Per-event pages (rounds, team, results,
  // leaderboard) are hub tabs now, not top-level nav items.
  const openHub = (item, tab = "overview") => {
    setSelectedHackathon(item);
    setHubTab(tab);
    const id = String(item?.hackathon_id || item?.hackathon?.id || item?.id || "");
    if (id) setSyncedId(id);
    setActiveNav("EventHub");
    setSidebarOpen(false);
    requestAnimationFrame(() => { const main = document.querySelector(".student-main"); if (main) main.scrollTo({ top: 0, behavior: "smooth" }); });
  };
  const openHubTeam = () => {
    if (syncedId) openHub({ id: syncedId }, "team");
    else handleNav("My Events");
  };
  const closeHub = () => { setSelectedHackathon(null); handleNav("My Events"); };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); localStorage.removeItem("role"); navigate("/login", { replace: true }); };
  const refreshStudentPage = async () => {
    setRefreshKey((current) => current + 1);
  };

  let content = <OverviewPage navigate={handleNav} studentName={displayName} />;
  if (activeNav === "Events") content = <HackathonsPage onOpen={(item) => openHub(item)} onJoined={(payload) => showMilestone("registered", payload)} />;
  if (activeNav === "My Events") content = <RegistrationsPage onOpen={(item) => openHub(item)} />;
  if (activeNav === "EventHub") content = selectedHackathon ? <EventHub event={selectedHackathon} tab={hubTab} setTab={setHubTab} onBack={closeHub} /> : <RegistrationsPage onOpen={(item) => openHub(item)} />;
  if (activeNav === "HackMate AI") content = <HackMatePage onGoToMyTeam={openHubTeam} />;
  if (activeNav === "IdeaCheck AI") content = <IdeaCheckAIPage />;
  if (activeNav === "RuleBot AI") content = <RuleBotPage />;
  if (activeNav === "Student Guide") content = <StudentGuidePage />;
  if (activeNav === "Official Communication") content = <OfficialCommunicationPage />;
  if (activeNav === "Notifications") content = <NotificationsPage />;
  if (activeNav === "Help & Support") content = <HelpSupportPage />;
  if (activeNav === "Digital Card") content = <DigitalCard />;
  if (activeNav === "Certificates") content = <CertificatesPage />;
  if (activeNav === "Profile") content = <ProfilePage />;

  return (
    <div className="student-panel">
      <StudentMilestoneOverlay milestone={milestone} onClose={() => { window.clearTimeout(window.__campusCodeMilestoneTimer); setMilestone(null); }} />
      <NotificationToasts toasts={toasts} onDismiss={dismissToast} />
      <div className="student-bg-grid" />
      <div className="student-bg-orb one" /><div className="student-bg-orb two" />
      <div className="student-mobile-topbar"><button onClick={() => setSidebarOpen((x) => !x)} className="student-menu-button">☰</button><Brand mobile /><div className="student-mobile-avatar">{initials || "S"}</div></div>
      <aside className={`student-sidebar ${sidebarOpen ? "student-sidebar-open" : ""}`}>
        <Brand />

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="student-nav">
          {navItems.map(([label, icon]) => (
            <button
              key={label}
              type="button"
              className={`student-nav-item ${
                activeNav === label || (activeNav === "EventHub" && label === "My Events") ? "active" : ""
              } ${label === "RuleBot AI" ? "rulebot-nav-item" : ""}`}
              onClick={() => handleNav(label)}
            >
              <span className="student-nav-icon">{icon}</span>
              <span>{label}</span>
              {(activeNav === label || (activeNav === "EventHub" && label === "My Events")) && <b>→</b>}
            </button>
          ))}
        </nav>

        <div className="student-sidebar-bottom">
          <div className="sidebar-label">ACCOUNT</div>

          <div className="sidebar-user">
            <div>{initials || "S"}</div>
            <span>
              <strong>{displayName}</strong>
              <small>{storedUser.role || "STUDENT"}</small>
            </span>
          </div>

          <button type="button" className="logout-btn" onClick={logout}>
            <span>↪</span>
            LOG OUT
          </button>
        </div>
      </aside>
      <main className="student-main"><header className="student-topbar">
          <div><span>CAMPUSCODE / STUDENT</span><strong>{activeNav.toUpperCase()}</strong></div>
          <div className="student-top-actions">
            <button type="button" className="student-top-notification" onClick={() => { clearBadge(); handleNav("Notifications"); }} aria-label="Open notifications">
              <Bell size={16} strokeWidth={1.8} />
              {unread > 0 ? <b className="notif-badge">{unread > 9 ? "9+" : unread}</b> : <i />}
            </button>
            <CampusCodeRefresh onRefresh={refreshStudentPage} />
            <div className="topbar-user"><StudentAvatar name={displayName} size={34} /><span>{displayName}</span></div>
          </div>
        </header><div className="student-content" key={refreshKey}><div className="student-view" key={activeNav}>{content}</div></div></main>
    </div>
  );
}

export default StudentPanel;
