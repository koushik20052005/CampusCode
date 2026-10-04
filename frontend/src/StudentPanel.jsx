import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Trophy, Clock3, Users, FolderGit2, Send, Code2,
  Sparkles, Bell, IdCard, UserCircle, Bot, ExternalLink, Link as LinkIcon,
  LoaderCircle, CheckCircle2, Terminal
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./StudentPanel.css";
import CampusCodeLoader from "./components/ui/CampusCodeLoader";
import CampusCodeRefresh from "./components/ui/CampusCodeRefresh";

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
            <button onClick={() => navigate("Hackathons")} className="student-primary-btn">OPEN HACKATHON <b>↗</b></button>
          )}
        </div>
        <div className="student-hero-mark"><CCMark /></div>
      </div>

      <div className="student-stats-grid">
        <StatCard label="REGISTERED" number={value(stats.registered, stats.registered_count)} detail="FROM BACKEND" />
        <StatCard label="ONGOING" number={value(stats.ongoing, stats.ongoing_count)} detail="FROM BACKEND" />
        <StatCard label="COMPLETED" number={value(stats.completed, stats.completed_count)} detail="FROM BACKEND" />
        <StatCard label="CERTIFICATES" number={value(stats.certificates, stats.certificate_count)} detail="FROM BACKEND" />
      </div>

      <DashboardDiscover navigate={navigate} />

      <div className="student-two-col">
        <div className="student-panel-card">
          <div className="student-panel-title"><span>01 / CURRENT ACTIVITY</span><button onClick={() => navigate("Hackathons")}>VIEW HACKATHONS ↗</button></div>
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
          {notifications.length ? (
            <div className="notification-mini-list">
              {notifications.slice(0, 4).map((item, index) => (
                <div className="notification-mini" key={item.id || index}>
                  <span className="live-dot" />
                  <div><strong>{value(item.title, item.subject, item.message)}</strong><small>{value(item.body, item.message, item.description)}</small></div>
                  <time>{formatDate(item.created_at || item.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : <EmptyState title="NO NOTIFICATIONS" text="There are no notifications returned by the backend." />}
        </div>
      </div>
    </section>
  );
}

function DashboardDiscover({ navigate }) {
  const [items, setItems] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [joining, setJoining] = useState("");
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
    try { await apiFetch(`/hackathons/${encodeURIComponent(id)}/join`, { method: "POST" }); setJoined((current) => new Set([...current, id])); }
    catch {} finally { setJoining(""); }
  };
  return <div className="student-dashboard-discover">
    <div className="student-panel-title"><span>03 / DISCOVER HACKATHONS</span><button onClick={() => navigate("Hackathons")}>VIEW ALL ↗</button></div>
    {loading ? <div className="student-discover-loading">Loading available hackathons...</div> : items.length ? <div className="student-discover-grid">{items.map((item) => { const id=String(item.id||""); const isJoined=joined.has(id); return <div className="student-discover-card" key={id}><div><span>{value(item.track, item.category, "HACKATHON")}</span><strong>{value(item.title, item.name, item.hackathon_name)}</strong><small>{formatDate(item.start_date || item.startDate)}</small></div><button disabled={isJoined || joining===id} onClick={() => join(item)}>{isJoined ? "JOINED" : joining===id ? "JOINING" : "JOIN NOW ↗"}</button></div>; })}</div> : <EmptyState title="NO OPEN HACKATHONS" text="Explore the Hackathons section when organizers publish new events." />}
  </div>;
}

function HackathonsPage({ onOpen, onJoined }) {
  const [items, setItems] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
      onJoined?.({ hackathon: value(item.title, item.name, item.hackathon_name) });
    } catch (err) {
      setError(err.message);
    } finally { setJoining(""); }
  };

  return (
    <section>
      <PageHeading eyebrow="DISCOVER / BACKEND DATA" title="HACKATHONS." text="Explore CampusCode challenges and join the ones you want to compete in." count={items.length} />
      {message && <div className="student-inline-success">{message}</div>}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} retry={load} />}
      {!loading && !error && !items.length && <EmptyState title="NO HACKATHONS AVAILABLE" text="The backend returned no hackathons for this account right now." />}
      {!loading && !error && items.length > 0 && (
        <div className="hackathon-grid">
          {items.map((item) => {
            const id = String(item.id || "");
            const joined = joinedIds.has(id);
            return (
              <article className="hackathon-card" key={item.id}>
                <div className="hackathon-card-top"><span>{value(item.code, item.slug, item.id)}</span><b>{value(item.status)}</b></div>
                <h2>{value(item.title, item.name, item.hackathon_name)}</h2>
                <p>{value(item.description, item.short_description)}</p>
                <div className="hackathon-data">
                  <span><small>MODE</small>{value(item.mode, item.event_mode)}</span>
                  <span><small>TEAM SIZE</small>{value(item.team_size, item.teamSize, item.max_team_size)}</span>
                  <span><small>START</small>{formatDate(item.start_date || item.startDate)}</span>
                </div>
                <div className="hackathon-actions">
                  <button onClick={() => onOpen(item)} className="student-outline-btn">VIEW DETAILS <b>↗</b></button>
                  <button
                    onClick={() => join(item)}
                    disabled={joined || joining === id}
                    className={`student-join-btn ${joined ? "joined" : ""}`}
                  >
                    {joined ? "✓ JOINED" : joining === id ? "JOINING..." : "JOIN HACKATHON ↗"}
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
      <PageHeading eyebrow="MY ACTIVITY / BACKEND DATA" title="REGISTRATIONS." text="Your registrations are read from the authenticated student APIs." count={items.length} />
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} retry={load} />}
      {!loading && !error && !items.length && <EmptyState title="NO REGISTRATIONS" text="No registration records were returned for your student account." />}
      {!loading && !error && items.length > 0 && (
        <div className="registration-grid">
          {items.map((item, index) => (
            <article className="registration-card" key={item.participant_id || item.registration_id || item.hackathon_id || index}>
              <div><span>REGISTRATION</span><b>{value(item.participant_id, item.registration_id, "CONFIRMED")}</b></div>
              <h2>{value(item.hackathon?.title, item.title, item.name, item.hackathon_name)}</h2>
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

function RegistrationDetail({ registration, onBack }) {
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
      <button className="back-btn" onClick={onBack}>← BACK TO REGISTRATIONS</button>
      <PageHeading eyebrow="REGISTRATION / LIVE RECORD" title={value(registration.hackathon?.title, registration.title, registration.name, registration.hackathon_name)} text="Round and team information is fetched from CampusCode APIs." />
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
            <div className="digital-avatar">{String(value(profile.name, "S")).charAt(0).toUpperCase()}</div>
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

function NotificationsPage() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const result = await apiFetch("/student/notifications"); setItems(unwrapList(result, ["notifications", "items", "data"])); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <section><PageHeading eyebrow="ALERTS / BACKEND DATA" title="NOTIFICATIONS." text="Live notifications for the authenticated student." count={items.length} />{loading && <LoadingState />}{!loading && error && <ErrorState message={error} retry={load} />}{!loading && !error && !items.length && <EmptyState title="NO NOTIFICATIONS" text="No notification records were returned." />}{!loading && !error && items.map((item, i) => <div className="notification-full" key={item.id || i}><span className="live-dot" /><div><strong>{value(item.title, item.subject, item.message)}</strong><p>{value(item.body, item.message, item.description)}</p></div><time>{formatDate(item.created_at || item.createdAt)}</time></div>)}</section>;
}

function HackMatePage() {
  const [hackathons, setHackathons] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState(null);
  const [loadingHackathons, setLoadingHackathons] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [addingMember, setAddingMember] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

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
        text="Find registered students from the same hackathon using HackMate match scores."
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

function StudentMyTeamPage() {
  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const [registrations, setRegistrations] = useState([]);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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
      if (!items.length) {
        setSelectedHackathonId("");
        setTeam(null);
        setMembers([]);
        setTeamName("");
        return;
      }

      const firstId = getHackathonId(items[0]);
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

            <div className="student-team-members">
              <span className="student-feature-label">TEAM MEMBERS</span>
              {members.length ? members.map((member, index) => {
                const memberId = String(member.user_id || member.id || "");
                const memberIsLeader = memberId === leaderId || String(member.role || "").toUpperCase() === "LEADER";
                return (
                  <div className="student-member-row" key={member.id || member.user_id || member.name || index}>
                    <div className="student-member-avatar">{String(member.name || "U").charAt(0).toUpperCase()}</div>
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
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [statement, setStatement] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAgreement, setShowAgreement] = useState(false);

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
  const submitted = Boolean(submission);
  const canSubmit = accessible && Boolean(team) && !submitted && !saving;

  const submit = async () => {
    const clean = statement.trim();
    if (clean.length < 20) return setError("Problem statement must contain at least 20 characters.");
    if (!selected) return setError("Select a hackathon first.");
    if (!team) return setError("You must be part of a team before submitting Round 1.");
    setSaving(true); setError(""); setMessage("");
    try {
      await apiFetch(`/student/round1/hackathons/${selected}/submit`, { method: "POST", body: JSON.stringify({ problem_statement: clean }) });
      setMessage("Round 1 idea submitted successfully.");
      await loadStatus(selected);
    } catch (err) { setError(err.message || "Failed to submit Round 1 idea"); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState label="Loading Round 1..." />;
  return (
    <section>
      <PageHeading eyebrow="BUILD / ROUND 01" title="PROBLEM STATEMENT." text="Submit your team's problem statement when Round 1 is live." />
      {error && <div className="student-inline-error">{error}</div>}
      {message && <div className="student-inline-success">{message}</div>}
      <div className={`student-feature-grid student-round-workspace ${roundCompleted || hackathonCompleted ? "student-round-completed-workspace" : ""}`}>
        <div className="student-feature-card student-round-status-card">
          {(roundCompleted || hackathonCompleted) && <CompletionStamp round={hackathonCompleted ? null : 1} />}
          <span className="student-feature-label">HACKATHON WORKSPACE</span>
          <h2>{value(hackathon.title, "Hackathon")}</h2>
          <div className="student-round-status-row"><span className={`student-round-status ${roundStatus === "LIVE" ? "live" : ""}`}>{roundStatus || "NOT AVAILABLE"}</span><span>{currentRound ? `CURRENT ROUND ${currentRound}` : "ROUND STATUS"}</span></div>
          <StudentHackathonSelector value={selected} onChange={setSelected} items={items} />
          {loadingStatus ? <LoadingState label="Loading round status..." /> : <div className="student-info-list"><div><span>TEAM</span><strong>{value(team?.name, team?.team_name, "No team")}</strong></div><div><span>SUBMISSION</span><strong>{value(submission?.status, "Not submitted")}</strong></div><div><span>DECISION</span><strong>{value(data?.decision?.decision, "Pending")}</strong></div><div className="student-feedback-row"><span>ORGANIZER FEEDBACK</span><strong>{value(data?.decision?.organizer_feedback, "No feedback yet")}</strong></div></div>}
        </div>
        <div className="student-feature-card student-round-form-card">
          <div className="student-feature-card-head"><div><span className="student-feature-label">ROUND 1 SUBMISSION</span><h2>What are you solving?</h2><p>Explain the problem, who experiences it, and what your team plans to solve.</p></div><div className="student-feature-icon"><Send size={18} /></div></div>
          {!team ? <div className="student-round-notice warning"><strong>TEAM REQUIRED</strong><span>Create or join a team before submitting Round 1.</span></div> : submitted ? <div className="student-round-submitted"><CheckCircle2 size={18} /><div><strong>SUBMITTED SUCCESSFULLY</strong><span>{submission.status || "SUBMITTED"}</span></div></div> : roundCompleted || hackathonCompleted ? <div className="student-round-notice student-round-completed-notice"><strong>{hackathonCompleted ? "HACKATHON COMPLETED" : "ROUND 1 COMPLETED"}</strong><span>{hackathonCompleted ? "This hackathon has finished. Round 1 is now read-only." : "Round 1 has been completed. New submissions are closed."}</span></div> : !accessible ? <div className="student-round-notice"><strong>ROUND 1 IS LOCKED</strong><span>{round.reason === "ROUND_COMPLETED" ? "Round 1 has been completed." : "The organizer has not opened Round 1 yet."}</span></div> : (
            <div className="student-round-form"><div className="student-form-label-row"><label>PROBLEM STATEMENT *</label><span>{statement.length} / 5000</span></div><textarea value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 5000))} rows={10} maxLength={5000} disabled={!canSubmit} placeholder="Example: Students struggle to discover relevant hackathons and form teams with complementary skills..." /><div className="student-form-actions"><span>Minimum 20 characters. Once submitted, your team cannot submit Round 1 again.</span><button className="student-primary-btn" disabled={!canSubmit || statement.trim().length < 20} onClick={() => setShowAgreement(true)}>{saving ? "SUBMITTING..." : "SUBMIT ROUND 1 ↗"}</button></div></div>
          )}
        </div>
      </div>
      <ParticipantAgreementModal open={showAgreement} hackathonName={value(hackathon.title, "Hackathon")} accepted={false} onClose={() => setShowAgreement(false)} onAccept={() => { setShowAgreement(false); submit(); }} />
    </section>
  );
}

function StudentRoundTwoPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState("");
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
            <div className="student-round-notice">
              <strong>
                ROUND 2 IS LOCKED
              </strong>

              <span>
                Your Round 1 team decision
                must be selected and Round 2
                must be active.
              </span>
            </div>
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
  const [items, setItems] = useState([]); const [selected, setSelected] = useState(""); const [data, setData] = useState(null); const [github, setGithub] = useState(""); const [demo, setDemo] = useState(""); const [description, setDescription] = useState(""); const [loading, setLoading] = useState(true); const [loadingStatus, setLoadingStatus] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
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
  return <section><PageHeading eyebrow="BUILD / ROUND 03" title="FINAL SUBMISSION." text="Submit the final GitHub repository and optional demo/details when Round 3 is live." />{error && <div className="student-inline-error">{error}</div>}{message && <div className="student-inline-success">{message}</div>}<div className={`student-feature-grid student-round-workspace ${roundCompleted || hackathonCompleted ? "student-round-completed-workspace" : ""}`}><div className="student-feature-card student-round-status-card">{(roundCompleted || hackathonCompleted) && <CompletionStamp round={hackathonCompleted ? null : 3} />}<span className="student-feature-label">FINAL ROUND STATUS</span><StudentHackathonSelector value={selected} onChange={setSelected} items={items}/>{loadingStatus ? <LoadingState label="Loading round status..." /> : <div className="student-info-list"><div><span>ROUND 3 ACCESS</span><strong>{roundCompleted ? "COMPLETED" : accessible ? "OPEN" : value(data?.message, "LOCKED")}</strong></div><div><span>SUBMISSION</span><strong>{value(submission?.status, "Not submitted")}</strong></div><div><span>SCORE</span><strong>{value(submission?.score, data?.score, "Not scored")}</strong></div><div><span>DECISION</span><strong>{value(submission?.decision, data?.decision?.decision, "Pending")}</strong></div><div className="student-feedback-row"><span>ORGANIZER FEEDBACK</span><strong>{value(submission?.organizer_feedback, data?.organizer_feedback, data?.decision?.organizer_feedback, "No feedback yet")}</strong></div></div>}</div><div className="student-feature-card student-round-form-card"><div className="student-feature-card-head"><div><span className="student-feature-label">FINAL BUILD</span><h2>Ship the final project</h2><p>GitHub is required. Demo URL and project description are optional.</p></div><div className="student-feature-icon"><Terminal size={18}/></div></div>{submitted ? <div className="student-round-submitted"><CheckCircle2 size={18}/><div><strong>FINAL SUBMISSION RECEIVED</strong><span>{submission.status || "SUBMITTED"}</span></div></div> : roundCompleted || hackathonCompleted ? <div className="student-round-notice student-round-completed-notice"><strong>HACKATHON COMPLETED</strong><span>All three rounds are finished. This hackathon is now read-only.</span></div> : !accessible ? <div className="student-round-notice"><strong>ROUND 3 IS LOCKED</strong><span>{value(data?.message, "Your team must be selected from Round 2 and Round 3 must be opened by the organizer.")}</span></div> : <div className="student-round-form"><label>GITHUB REPOSITORY URL *</label><div className="student-input-icon"><LinkIcon size={15}/><input value={github} onChange={(e)=>setGithub(e.target.value)} placeholder="https://github.com/username/project"/></div><label>LIVE DEMO URL <span>(OPTIONAL)</span></label><div className="student-input-icon"><ExternalLink size={15}/><input value={demo} onChange={(e)=>setDemo(e.target.value)} placeholder="https://your-project.vercel.app"/></div><label>PROJECT DESCRIPTION <span>(OPTIONAL)</span></label><textarea rows={6} maxLength={5000} value={description} onChange={(e)=>setDescription(e.target.value.slice(0,5000))} placeholder="Briefly explain the final solution, key features and how it works..."/><div className="student-form-counter">{description.length} / 5000</div><button className="student-primary-btn" disabled={saving || !github.trim()} onClick={submit}>{saving ? "SUBMITTING..." : "SUBMIT FINAL PROJECT ↗"}</button></div>}</div></div></section>;
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
  const [selected, setSelected] = useState("");
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
  const [selected, setSelected] = useState("");
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

function StudentMilestoneOverlay({ milestone, onClose }) {
  if (!milestone) return null;
  const config = milestone.type === "registered"
    ? { eyebrow: "REGISTRATION CONFIRMED", title: "YOU'RE IN.", copy: `Your registration for ${milestone.hackathon || "this hackathon"} is confirmed. Time to build.` }
    : milestone.type === "advanced"
      ? { eyebrow: "NEXT ROUND UNLOCKED", title: "YOU MADE IT THROUGH.", copy: `Your Round ${milestone.fromRound || 1} submission was selected. Round ${milestone.toRound || 2} is now unlocked.` }
      : { eyebrow: "WINNER", title: "YOU DID IT.", copy: `Congratulations — you won ${milestone.hackathon || "the hackathon"}.` };
  return <div className="student-milestone-backdrop"><div className="student-milestone-card"><div className="student-milestone-icon">✦</div><span>{config.eyebrow}</span><h2>{config.title}</h2><p>{config.copy}</p><button onClick={onClose}>CONTINUE BUILDING</button></div></div>;
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
  return <section><PageHeading eyebrow="COMMUNICATION / OFFICIAL" title="OFFICIAL COMMUNICATION." text="Use the official CampusCode channel for important announcements and communication." /><div className="student-communication-hero"><div className="student-communication-icon">◉</div><div><span className="student-feature-label">CAMPUSCODE OFFICIAL CHANNEL</span><h2>Stay connected.</h2><p>Follow the official WhatsApp channel for hackathon updates, announcements, deadlines and important communication.</p><a href={channel} target="_blank" rel="noreferrer" className="student-primary-btn">OPEN WHATSAPP CHANNEL ↗</a></div></div><div className="student-two-col"><div className="student-feature-card"><span className="student-feature-label">IMPORTANT</span><h3>Check official updates first.</h3><p>When a deadline, round instruction or organizer decision changes, rely on the official communication shared by CampusCode and your hackathon organizer.</p></div><div className="student-feature-card"><span className="student-feature-label">QUICK ACCESS</span><h3>Keep this channel easy to find.</h3><p>Save or follow the channel so you can quickly return to official announcements when you are working on a submission.</p></div></div></section>;
}


function HelpSupportPage() {
  return <section><PageHeading eyebrow="HELP / SUPPORT" title="HELP & SUPPORT." text="Start with the guide and FAQs. If you still need help, use the official communication channel or contact your organizer." /><div className="student-support-grid"><div className="student-support-card"><span>01</span><h3>Student Guide</h3><p>Learn how the CampusCode workflow works from joining a hackathon through results.</p><button className="student-outline-btn" onClick={() => window.dispatchEvent(new CustomEvent("campuscode:navigate", { detail: "Student Guide" }))}>OPEN GUIDE →</button></div><div className="student-support-card"><span>02</span><h3>FAQs</h3><p>Find answers about teams, rounds, submissions, AI assistance and communication.</p><button className="student-outline-btn" onClick={() => window.dispatchEvent(new CustomEvent("campuscode:navigate", { detail: "Student Guide" }))}>VIEW FAQ →</button></div><div className="student-support-card"><span>03</span><h3>Official WhatsApp</h3><p>Follow the official CampusCode channel for announcements and important updates.</p><a className="student-outline-btn" href="https://whatsapp.com/channel/0029Vb8gR7TEVccLc1pW4O2d" target="_blank" rel="noreferrer">OPEN CHANNEL →</a></div></div></section>;
}

function StudentPanel() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedHackathon, setSelectedHackathon] = useState(null);
  const [project, setProject] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const showMilestone = (type, payload = {}) => { setMilestone({ type, ...payload }); window.clearTimeout(window.__campusCodeMilestoneTimer); window.__campusCodeMilestoneTimer = window.setTimeout(() => setMilestone(null), 4800); };

  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const displayName = storedUser.name || "Student";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

  const navItems = [
    ["Overview", <LayoutDashboard size={16} strokeWidth={1.8} />],
    ["Hackathons", <Trophy size={16} strokeWidth={1.8} />],
    ["My Registrations", <Clock3 size={16} strokeWidth={1.8} />],
    ["HackMate AI", <Sparkles size={16} strokeWidth={1.8} />],
    ["IdeaCheck AI", <Sparkles size={16} strokeWidth={1.8} />],
    ["My Team", <Users size={16} strokeWidth={1.8} />],
    ["Round 1", <Send size={16} strokeWidth={1.8} />],
    ["Round 2", <Code2 size={16} strokeWidth={1.8} />],
    ["Round 3", <Terminal size={16} strokeWidth={1.8} />],
    ["Submissions", <Send size={16} strokeWidth={1.8} />],
    ["Results", <Trophy size={16} strokeWidth={1.8} />],
    ["Leaderboard", <Trophy size={16} strokeWidth={1.8} />],
    ["RuleBot AI", <Bot size={16} strokeWidth={1.8} />],
    ["Student Guide", <Bot size={16} strokeWidth={1.8} />],
    ["Official Communication", <Bell size={16} strokeWidth={1.8} />],
    ["Notifications", <Bell size={16} strokeWidth={1.8} />],
    ["Help & Support", <Bot size={16} strokeWidth={1.8} />],
    ["Digital Card", <IdCard size={16} strokeWidth={1.8} />],
    ["Profile", <UserCircle size={16} strokeWidth={1.8} />],
  ];
  const handleNav = (label) => { setActiveNav(label); setSelectedHackathon(null); setSidebarOpen(false); requestAnimationFrame(() => { const main = document.querySelector(".student-main"); if (main) main.scrollTo({ top: 0, behavior: "smooth" }); }); };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); localStorage.removeItem("role"); navigate("/login", { replace: true }); };
  const refreshStudentPage = async () => {
    setRefreshKey((current) => current + 1);
  };

  let content = <OverviewPage navigate={handleNav} studentName={displayName} />;
  if (activeNav === "Hackathons") content = <HackathonsPage onOpen={(item) => { setSelectedHackathon(item); setActiveNav("My Registrations"); }} onJoined={(payload) => showMilestone("registered", payload)} />;
  if (activeNav === "My Registrations") content = selectedHackathon ? <RegistrationDetail registration={selectedHackathon} onBack={() => setSelectedHackathon(null)} /> : <RegistrationsPage onOpen={setSelectedHackathon} />;
  if (activeNav === "HackMate AI") content = <HackMatePage />;
  if (activeNav === "IdeaCheck AI") content = <IdeaCheckAIPage />;
  if (activeNav === "My Team") content = <StudentMyTeamPage />;
  if (activeNav === "Round 1") content = <StudentRoundOnePage />;
  if (activeNav === "Round 2") content = <StudentRoundTwoPage />;
  if (activeNav === "Round 3") content = <StudentRoundThreePage />;
  if (activeNav === "Submissions") content = <StudentSubmissionsPage project={project} />;
  if (activeNav === "Results") content = <StudentResultsPage />;
  if (activeNav === "Leaderboard") content = <StudentLeaderboardPage />;
  if (activeNav === "RuleBot AI") content = <RuleBotPage />;
  if (activeNav === "Student Guide") content = <StudentGuidePage />;
  if (activeNav === "Official Communication") content = <OfficialCommunicationPage />;
  if (activeNav === "Notifications") content = <NotificationsPage />;
  if (activeNav === "Help & Support") content = <HelpSupportPage />;
  if (activeNav === "Digital Card") content = <DigitalCard />;
  if (activeNav === "Profile") content = <ProfilePage />;

  return (
    <div className="student-panel">
      <StudentMilestoneOverlay milestone={milestone} onClose={() => { window.clearTimeout(window.__campusCodeMilestoneTimer); setMilestone(null); }} />
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
                activeNav === label ? "active" : ""
              } ${label === "RuleBot AI" ? "rulebot-nav-item" : ""}`}
              onClick={() => handleNav(label)}
            >
              <span className="student-nav-icon">{icon}</span>
              <span>{label}</span>
              {activeNav === label && <b>→</b>}
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
            <button type="button" className="student-top-notification" onClick={() => handleNav("Notifications")} aria-label="Open notifications">
              <Bell size={16} strokeWidth={1.8} />
              <i />
            </button>
            <CampusCodeRefresh onRefresh={refreshStudentPage} />
            <div className="topbar-user"><CCMark small /><span>{displayName}</span></div>
          </div>
        </header><div className="student-content" key={refreshKey}>{content}</div></main>
    </div>
  );
}

export default StudentPanel;
