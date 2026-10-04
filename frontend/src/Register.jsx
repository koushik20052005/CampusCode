import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "STUDENT",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !email || !form.password) {
      setError(
        "Please fill in all required fields."
      );
      return;
    }

    if (form.password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name,
            email,
            password: form.password,
            role: form.role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to create account."
        );
      }

      setSuccess(
        "Account created successfully. Redirecting to login..."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1200);

    } catch (err) {
      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campus-register">

      {/* BACKGROUND */}
      <div className="register-grid" />

      <div className="register-glow register-glow-one" />
      <div className="register-glow register-glow-two" />

      <div className="register-network">
        <svg
          viewBox="0 0 1400 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 600 C180 450 250 620 420 430 S680 80 900 270 S1150 500 1400 180" />

          <path d="M80 130 C280 300 380 80 570 270 S800 620 1080 500 S1250 400 1400 620" />

          <path d="M250 800 C400 600 570 650 720 460 S970 180 1160 80" />

          <circle cx="420" cy="430" r="4" />
          <circle cx="900" cy="270" r="4" />
          <circle cx="1080" cy="500" r="4" />
          <circle cx="570" cy="270" r="4" />
          <circle cx="1160" cy="80" r="4" />
        </svg>
      </div>

      {/* NAVBAR */}
      <header className="register-nav">

        <button
          type="button"
          className="register-brand"
          onClick={() => navigate("/")}
          aria-label="CampusCode home"
        >
          <span className="register-brand-mark">
            <i />
            <i />
            <i />
          </span>

          <span className="register-brand-text">
            <strong>CAMPUSCODE</strong>
            <small>HACKATHON ARENA</small>
          </span>
        </button>

        <button
          type="button"
          className="register-back"
          onClick={() => navigate("/")}
        >
          ← BACK TO HOME
        </button>

      </header>

      {/* MAIN */}
      <main className="register-main">

        {/* LEFT INFORMATION */}
        <section className="register-intro">

          <div className="register-status">
            <span />
            CAMPUSCODE / REGISTRATION
          </div>

          <div className="register-intro-index">
            <span>CREATE</span>
            <span>02 / 02</span>
          </div>

          <h1>
            JOIN
            <br />
            THE
            <br />
            <span>ARENA.</span>
          </h1>

          <p className="register-intro-description">
            Create your CampusCode identity and
            become part of a student ecosystem
            designed around ideas, teams,
            technology and competition.
          </p>

          {/* INFORMATION CARDS */}
          <div className="register-info-grid">

            <div className="register-info-card register-info-card-main">

              <div className="register-info-card-top">
                <span>01</span>
                <span>IDENTITY</span>
              </div>

              <strong>CREATE</strong>

              <p>
                Build your student profile and
                enter the CampusCode ecosystem.
              </p>

              <div className="register-info-line">
                <i />
              </div>

            </div>

            <div className="register-info-card">

              <div className="register-info-card-top">
                <span>02</span>
                <span>TEAM</span>
              </div>

              <strong>COLLABORATE</strong>

              <p>
                Find teammates and build projects
                together.
              </p>

            </div>

            <div className="register-info-card">

              <div className="register-info-card-top">
                <span>03</span>
                <span>ARENA</span>
              </div>

              <strong>COMPETE</strong>

              <p>
                Join hackathons and turn ideas
                into submissions.
              </p>

            </div>

          </div>

          {/* SYSTEM INFO */}
          <div className="register-system-info">

            <div>
              <span className="register-system-dot" />
              REGISTRATION OPEN
            </div>

            <div>
              STUDENT INNOVATION NETWORK
            </div>

            <div>
              2026
            </div>

          </div>

        </section>

        {/* REGISTER CARD */}
        <section className="register-card-wrapper">

          <div className="register-card">

            <div className="register-card-top">

              <div>

                <span className="register-card-label">
                  NEW ACCOUNT
                </span>

                <h2>REGISTER</h2>

                <p className="register-card-description">
                  Create your CampusCode account.
                </p>

              </div>

              <div className="register-card-index">
                CC
                <br />
                02
              </div>

            </div>

            <div className="register-divider" />

            <form onSubmit={handleSubmit}>

              {/* NAME */}
              <div className="register-field">

                <label>FULL NAME</label>

                <div className="register-input-wrap">

                  <span className="register-input-icon">
                    ◇
                  </span>

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    autoComplete="name"
                    disabled={loading}
                  />

                </div>

              </div>

              {/* EMAIL */}
              <div className="register-field">

                <label>EMAIL ADDRESS</label>

                <div className="register-input-wrap">

                  <span className="register-input-icon">
                    @
                  </span>

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />

                </div>

              </div>

              {/* ROLE */}
              <div className="register-field">

                <label>ACCOUNT TYPE</label>

                <div className="register-input-wrap">

                  <span className="register-input-icon">
                    +
                  </span>

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    disabled={loading}
                  >

                    <option value="STUDENT">
                      STUDENT
                    </option>

                    <option value="ORGANIZER">
                      ORGANIZER
                    </option>

                  </select>

                  <span className="register-select-arrow">
                    ↓
                  </span>

                </div>

              </div>

              {/* PASSWORD */}
              <div className="register-field">

                <label>PASSWORD</label>

                <div className="register-input-wrap">

                  <span className="register-input-icon">
                    •
                  </span>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (prev) => !prev
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >

                    <span className="password-eye">
                      {showPassword
                        ? "◉"
                        : "○"}
                    </span>

                    <span>
                      {showPassword
                        ? "HIDE"
                        : "SHOW"}
                    </span>

                  </button>

                </div>

              </div>

              {/* CONFIRM PASSWORD */}
              <div className="register-field">

                <label>
                  CONFIRM PASSWORD
                </label>

                <div className="register-input-wrap">

                  <span className="register-input-icon">
                    •
                  </span>

                  <input
                    type={
                      showConfirm
                        ? "text"
                        : "password"
                    }
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() =>
                      setShowConfirm(
                        (prev) => !prev
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showConfirm
                        ? "Hide password"
                        : "Show password"
                    }
                  >

                    <span className="password-eye">
                      {showConfirm
                        ? "◉"
                        : "○"}
                    </span>

                    <span>
                      {showConfirm
                        ? "HIDE"
                        : "SHOW"}
                    </span>

                  </button>

                </div>

              </div>

              {/* ERROR */}
              {error && (
                <div className="register-message register-error">

                  <span>!</span>

                  <p>{error}</p>

                </div>
              )}

              {/* SUCCESS */}
              {success && (
                <div className="register-message register-success">

                  <span>✓</span>

                  <p>{success}</p>

                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                className="register-submit"
                disabled={loading}
              >

                <span>
                  {loading
                    ? "CREATING ACCOUNT..."
                    : "CREATE ACCOUNT"}
                </span>

                <b>
                  {loading
                    ? "..."
                    : "↗"}
                </b>

              </button>

            </form>

            {/* LOGIN */}
            <div className="register-login">

              <span>
                ALREADY HAVE AN ACCOUNT?
              </span>

              <button
                type="button"
                onClick={() =>
                  navigate("/login")
                }
                disabled={loading}
              >
                LOGIN →
              </button>

            </div>

          </div>

          <div className="register-card-footer">

            <span>
              AUTH / 2026
            </span>

            <span>
              <i />
              SECURE REGISTRATION
            </span>

          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="register-bottom">

        <span>
          CAMPUSCODE © 2026
        </span>

        <span>
          LEARN · BUILD · COMPETE · SHIP
        </span>

        <span>
          ALL SYSTEMS OPERATIONAL
        </span>

      </footer>

    </div>
  );
}

export default Register;