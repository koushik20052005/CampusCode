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
    <div className="initializing-screen">

      {/* BACKGROUND */}
      <div className="initializing-grid" />

      <div className="initializing-noise" />

      {/* TOP BRAND */}
      <header className="initializing-header">

        <div className="initializing-brand">

          <span className="initializing-logo" aria-label="CampusCode logo">
            <i className="initializing-logo-bar initializing-logo-black" />
            <i className="initializing-logo-bar initializing-logo-purple" />
            <i className="initializing-logo-bar initializing-logo-lime" />
          </span>

          <div>
            <strong>CAMPUSCODE</strong>
            <small>HACKATHON ARENA</small>
          </div>

        </div>

        <div className="initializing-header-status">
          <span />
          SECURE CONNECTION
        </div>

      </header>

      {/* CENTER */}
      <main className="initializing-main">

        <div className="initializing-orbit">

          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />

          <div className="orbit-core">

            <span className="core-line" />

            <div className="core-logo">
              CC
            </div>

            <span className="core-line" />

          </div>

        </div>

        <div className="initializing-label">
          CAMPUSCODE / SYSTEM BOOT
        </div>

        <h1>
          INITIALIZING
          <span>WORKSPACE.</span>
        </h1>

        <p className="initializing-phase">
          {phase}
          <span className="phase-dots">...</span>
        </p>

        {/* PROGRESS */}
        <div className="initializing-progress">

          <div className="progress-top">
            <span>SYSTEM INITIALIZATION</span>

            <strong>
              {String(progress).padStart(3, "0")}%
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

        </div>

        {/* ROLE */}
        <div className="initializing-role">

          <span>ACCESS LEVEL</span>

          <strong>
            {role}
          </strong>

        </div>

      </main>

      {/* BOTTOM */}
      <footer className="initializing-footer">

        <span>
          CAMPUSCODE © 2026
        </span>

        <span>
          AUTH / INITIALIZATION
        </span>

        <span>
          <i />
          ALL SYSTEMS OPERATIONAL
        </span>

      </footer>

    </div>
  );
}

export default Initializing;