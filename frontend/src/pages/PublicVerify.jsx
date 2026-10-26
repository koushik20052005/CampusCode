import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./PublicVerify.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function CampusCodeMark() {
  return (
    <span className="public-verify-brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/* Public certificate verification — no login needed, because a
   recruiter scanning the QR will not have a CampusCode account. */
export default function PublicVerify() {
  const { code } = useParams();
  const [state, setState] = useState("loading");
  const [certificate, setCertificate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/certificates/verify/${encodeURIComponent(code || "")}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data?.valid) {
          setCertificate(data.certificate);
          setState("valid");
        } else {
          setState("invalid");
        }
      })
      .catch(() => {
        if (!cancelled) setState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="public-verify-page">
      <div className="public-verify-card">
        <div className="public-verify-logo">
          <CampusCodeMark />
          <span>CAMPUSCODE</span>
        </div>

        {state === "loading" && (
          <p className="public-verify-muted">Checking certificate…</p>
        )}

        {state === "invalid" && (
          <>
            <div className="public-verify-stamp invalid">NOT FOUND</div>
            <h1>No certificate matches this code.</h1>
            <p className="public-verify-muted">
              The code <b>{code}</b> does not belong to any CampusCode
              certificate. Check the code on the PDF and try again.
            </p>
          </>
        )}

        {state === "valid" && certificate && (
          <>
            <div className="public-verify-stamp valid">VERIFIED</div>
            <h1>{certificate.holder_name}</h1>
            <p className="public-verify-muted">
              {certificate.type === "WINNER"
                ? `Winner certificate${certificate.place ? ` — ${certificate.place}${certificate.place === 1 ? "st" : certificate.place === 2 ? "nd" : "rd"} place` : ""}`
                : "Participation certificate"}
            </p>
            <dl className="public-verify-details">
              <div>
                <dt>Hackathon</dt>
                <dd>{certificate.hackathon_title}</dd>
              </div>
              <div>
                <dt>Certificate code</dt>
                <dd>{certificate.code}</dd>
              </div>
              <div>
                <dt>Issued on</dt>
                <dd>{formatDate(certificate.issued_at)}</dd>
              </div>
            </dl>
            <p className="public-verify-muted small">
              This page is the proof: the certificate is real only if its code
              verifies here.
            </p>
          </>
        )}

        <Link className="public-verify-home" to="/">
          Back to CampusCode
        </Link>
      </div>
    </main>
  );
}
