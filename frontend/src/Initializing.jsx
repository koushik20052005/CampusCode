import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Initializing.css";

function Initializing() {
  const navigate = useNavigate();
  const location = useLocation();

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("VERIFYING IDENTITY");

  const role = location.state?.role || "STUDENT";

  useEffect(() => {
    const startTime = Date.now();

    const phases = [
      "VERIFYING IDENTITY",
      "AUTHENTICATING SESSION",
      "LOADING USER PROFILE",
      "SYNCING CAMPUSCODE",
      "PREPARING WORKSPACE",
      "SYSTEM READY",
    ];

    let currentPhase = 0;

    const phaseTimer = setInterval(() => {
      currentPhase++;

      if (currentPhase < phases.length) {
        setPhase(phases[currentPhase]);
      }
    }, 850);

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;

      // Minimum 3 seconds
      const calculatedProgress = Math.min(
        100,
        Math.floor((elapsed / 3000) * 100)
      );

      setProgress(calculatedProgress);
    }, 50);

    const redirectTimer = setTimeout(() => {
      if (role === "STUDENT") {
        navigate("/student", { replace: true });
      } else if (role === "ORGANIZER") {
        navigate("/organizer", { replace: true });
      } else if (role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }, 3000);

    return () => {
      clearInterval(phaseTimer);
      clearInterval(progressTimer);
      clearTimeout(redirectTimer);
    };
  }, [navigate, role]);

  return (
    <div className="init-screen">
      <div className="init-grid" />

      <header className="init-header">
        <div className="init-brand">
          <span className="init-logo" aria-label="CampusCode logo">
            <i className="init-bar init-bar-white" />
            <i className="init-bar init-bar-purple" />
            <i className="init-bar init-bar-lime" />
          </span>
          <div>
            <strong>CAMPUSCODE</strong>
            <small>HACKATHON ARENA</small>
          </div>
        </div>
        <div className="init-secure">
          <span className="init-secure-dot" />
          SECURE CONNECTION
        </div>
      </header>

      <main className="init-main">
        {/* Charge Up logo loader */}
        <div className="init-charge" aria-hidden="true">
          <i className="init-charge-bar init-charge-white" />
          <i className="init-charge-bar init-charge-purple" />
          <i className="init-charge-bar init-charge-lime" />
        </div>

        <div className="init-word">CAMPUSCODE</div>

        <p className="init-phase">
          {phase}
          <span className="init-dots" />
        </p>

        <div className="init-progress">
          <div className="init-progress-top">
            <span>SYSTEM INITIALIZATION</span>
            <strong>{String(progress).padStart(3, "0")}%</strong>
          </div>
          <div className="init-track">
            <div
              className="init-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="init-role">
          <span>ACCESS LEVEL</span>
          <strong>{role}</strong>
        </div>
      </main>

      <footer className="init-footer">
        <span>CAMPUSCODE © 2026</span>
        <span>AUTH / INITIALIZATION</span>
        <span className="init-ok">
          <i />
          ALL SYSTEMS OPERATIONAL
        </span>
      </footer>
    </div>
  );
}

export default Initializing;
