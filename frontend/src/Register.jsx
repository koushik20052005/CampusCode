import { useEffect, useState } from "react";
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

  // v6.10 — email OTP verification step (free via Gmail SMTP)
  const [step, setStep] = useState("details"); // "details" | "otp"
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devOtp, setDevOtp] = useState(null);
  // v6.11 — captcha (free, server-side) + password strength
  const [captchaId, setCaptchaId] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaText, setCaptchaText] = useState("");

  const loadCaptcha = async () => {
    try {
      const r = await fetch(`${API_URL}/auth/captcha`);
      const d = await r.json().catch(() => ({}));
      if (d.success) {
        setCaptchaId(d.captchaId);
        setCaptchaSvg(d.svg);
        setCaptchaText("");
      }
    } catch { /* retry on submit */ }
  };
  React.useEffect(() => { loadCaptcha(); }, []);

  const pwScore = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const busy = loading || otpBusy;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  // STEP 1 — validate details, then send the OTP email
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setDevOtp(null);

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !email || !form.password) {
      setError(
        "Please fill in all required fields."
      );
      return;
    }

    const pw = form.password;
    if (
      pw.length < 8 ||
      !/[A-Z]/.test(pw) ||
      !/[a-z]/.test(pw) ||
      !/[0-9]/.test(pw)
    ) {
      setError(
        "Password needs min 8 characters with an uppercase letter, a lowercase letter, and a number."
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

    await sendOtp(email, false);
  };

  // v6.10 — POST /api/auth/send-otp
  const sendOtp = async (email, isResend) => {
    try {
      setOtpBusy(true);
      setError("");

      const response = await fetch(
        `${API_URL}/auth/send-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            purpose: "register",
            captchaId,
            captchaText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.captchaFailed) loadCaptcha();
        throw new Error(
          data.message ||
            "Could not send the code."
        );
      }

      // v6.10.1 — don't advance if the email wasn't actually delivered
      if (!data.delivered && !data.dev_otp) {
        throw new Error(
          data.message ||
            "Could not send the code. Try a master code or try again later."
        );
      }

      setDevOtp(data.dev_otp || null);
      setStep("otp");
      setResendIn(60);

      setSuccess(
        data.dev_otp
          ? "Mail is not configured yet — your test code is shown below."
          : isResend
            ? "A new code was sent to your email. It expires in 5 minutes."
            : "A 6-digit code was sent to your email. It expires in 5 minutes."
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not send the code. Please try again."
      );
    } finally {
      setOtpBusy(false);
    }
  };

  // STEP 2 — verify OTP, then create the account
  const handleVerifySubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const email = form.email.trim().toLowerCase();
    const code = String(otp || "")
      .replace(/\D/g, "")
      .trim();

    if (code.length < 6) {
      setError(
        "Enter the 6-digit code from your email."
      );
      return;
    }

    try {
      setOtpBusy(true);

      const response = await fetch(
        `${API_URL}/auth/verify-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            otp: code,
            purpose: "register",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Code did not match. Try again."
        );
      }

      await createAccount();
    } catch (err) {
      setError(
        err.message ||
          "Verification failed. Try again."
      );
    } finally {
      setOtpBusy(false);
    }
  };

  const createAccount = async () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

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
            role: "STUDENT", // v6.6 — student-only registration
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
        "Email verified — account created. Redirecting to login..."
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

  // Resend countdown (60s)
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(
      () => setResendIn((s) => s - 1),
      1000
    );
    return () => clearTimeout(t);
  }, [resendIn]);

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

            <form
              onSubmit={
                step === "otp"
                  ? handleVerifySubmit
                  : handleDetailsSubmit
              }
            >

              {step === "details" ? (
              <>

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
                    🎓
                  </span>

                  <input
                    type="text"
                    value="STUDENT"
                    disabled
                    aria-label="Account type: student only"
                  />

                </div>

                <p className="register-organizer-note">
                  Organizer? Accounts are created by our team — contact{" "}
                  <a href="mailto:campuscode@gmail.com">campuscode@gmail.com</a>
                </p>

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

                {form.password && (
                  <p className="register-otp-hint">
                    Strength: {["Weak", "Fair", "Good", "Strong"][Math.min(pwScore(form.password), 3)]}
                    {" — "}needs 8+ chars, upper + lower + number.
                  </p>
                )}

              </div>

              {/* v6.11 — captcha */}
              <div className="register-field">

                <label>CAPTCHA</label>

                <div className="register-captcha-row">
                  {captchaSvg ? (
                    <span
                      className="register-captcha-img"
                      dangerouslySetInnerHTML={{ __html: captchaSvg }}
                    />
                  ) : (
                    <span className="register-captcha-img">...</span>
                  )}
                  <button
                    type="button"
                    className="register-otp-link"
                    onClick={loadCaptcha}
                    disabled={busy}
                  >
                    ↻ NEW
                  </button>
                </div>

                <div className="register-input-wrap" style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    value={captchaText}
                    onChange={(e) => { setCaptchaText(e.target.value); setError(""); }}
                    placeholder="Enter the code above"
                    autoComplete="off"
                    disabled={busy}
                    maxLength={5}
                  />
                </div>

              </div>

              </>
              ) : (
              <>

              {/* v6.10 — OTP VERIFICATION STEP */}
              <p className="register-otp-sent">
                CODE SENT TO{" "}
                <strong>
                  {form.email.trim().toLowerCase()}
                </strong>
              </p>

              <div className="register-field">

                <label>6-DIGIT CODE</label>

                <div className="register-input-wrap register-otp-input">

                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => {
                      setOtp(
                        e.target.value
                          .replace(/[^\d]/g, "")
                          .slice(0, 8)
                      );
                      setError("");
                    }}
                    placeholder="••••••"
                    maxLength={8}
                    disabled={busy}
                    autoFocus
                  />

                </div>

                <p className="register-otp-hint">
                  Check your inbox (and spam folder). The code expires
                  in 5 minutes. If the mail system is down, a master
                  code also works.
                </p>

              </div>

              {devOtp && (
                <div className="register-dev-hint">
                  <span>TEST MODE</span>
                  <p>
                    Mail is not configured — your code is{" "}
                    <strong>{devOtp}</strong>
                  </p>
                </div>
              )}

              </>
              )}

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
              {step === "details" ? (
              <button
                type="submit"
                className="register-submit"
                disabled={busy}
              >

                <span>
                  {otpBusy
                    ? "SENDING CODE..."
                    : "SEND VERIFICATION CODE"}
                </span>

                <b>
                  {otpBusy
                    ? "..."
                    : "↗"}
                </b>

              </button>
              ) : (
              <>
              <button
                type="submit"
                className="register-submit"
                disabled={busy}
              >

                <span>
                  {busy
                    ? "VERIFYING..."
                    : "VERIFY & CREATE ACCOUNT"}
                </span>

                <b>
                  {busy
                    ? "..."
                    : "✓"}
                </b>

              </button>

              <div className="register-otp-row">

                <button
                  type="button"
                  className="register-otp-link"
                  disabled={busy || resendIn > 0}
                  onClick={() =>
                    sendOtp(
                      form.email.trim().toLowerCase(),
                      true
                    )
                  }
                >
                  {resendIn > 0
                    ? `RESEND IN ${resendIn}s`
                    : "RESEND CODE"}
                </button>

                <button
                  type="button"
                  className="register-otp-link"
                  disabled={busy}
                  onClick={() => {
                    setStep("details");
                    setOtp("");
                    setError("");
                    setSuccess("");
                  }}
                >
                  ← USE A DIFFERENT EMAIL
                </button>

              </div>
              </>
              )}

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