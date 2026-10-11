import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // v6.10 — login OTP step (free via Resend)
  const [step, setStep] = useState("credentials"); // "credentials" | "otp" | "forgot" | "reset"
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devOtp, setDevOtp] = useState(null);
  // v6.11 — captcha (free, server-side)
  const [captchaId, setCaptchaId] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  // v6.11 — forgot password
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const busy = loading || otpBusy;

  const loadCaptcha = async () => {
    try {
      const r = await fetch(`${API_URL}/auth/captcha`);
      const d = await r.json().catch(() => ({}));
      if (d.success) {
        setCaptchaId(d.captchaId);
        setCaptchaSvg(d.svg);
        setCaptchaText("");
      }
    } catch { /* captcha will retry on submit */ }
  };
  React.useEffect(() => { loadCaptcha(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  // v6.11.3 — shared login completion (direct admin/organizer login + post-OTP student login)
  const completeLogin = async (email) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: form.password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Invalid email or password.");
    if (!data.token || !data.user) throw new Error("Invalid login response from server.");
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("role", data.user.role);
    navigate("/initializing", { replace: true, state: { role: data.user.role } });
  };

  // STEP 1 — check credentials, then send OTP
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    setDevOtp(null);

    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      // verify credentials first (no token issued)
      const pre = await fetch(`${API_URL}/auth/pre-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: form.password }),
      });
      const preData = await pre.json().catch(() => ({}));
      if (!pre.ok) throw new Error(preData.message || "Invalid email or password.");

      // v6.11.3 — admin/organizer log in directly (their emails aren't real inboxes);
      // students go through the OTP step
      if (!preData.requiresOtp) {
        await completeLogin(email);
        return;
      }

      // credentials OK — send OTP (v6.11.1: captcha goes here, single-use)
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "login", captchaId, captchaText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.captchaFailed) loadCaptcha();
        throw new Error(data.message || "Could not send OTP.");
      }
      // v6.10.1 — don't advance if the email wasn't actually delivered
      if (!data.delivered && !data.dev_otp) {
        throw new Error(data.message || "Could not send the code. Try a master code or try again later.");
      }
      setDevOtp(data.dev_otp || null);
      setStep("otp");
      setResendIn(60);
    } catch (err) {
      setError(err.message || "Unable to continue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 — verify OTP, then complete login
  const handleOtp = async (e) => {
    e.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    const code = String(otp || "").replace(/[^\d]/g, "").slice(0, 8);
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    try {
      setOtpBusy(true);
      const vres = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, purpose: "login" }),
      });
      const vdata = await vres.json().catch(() => ({}));
      if (!vres.ok) throw new Error(vdata.message || "Incorrect code.");

      // OTP verified — now log in
      await completeLogin(email);
    } catch (err) {
      setError(err.message || "Unable to login. Please try again.");
    } finally {
      setOtpBusy(false);
    }
  };

  const resendOtp = async () => {
    if (resendIn > 0 || otpBusy) return;
    setError("");
    try {
      setOtpBusy(true);
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), purpose: "login", captchaId, captchaText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.captchaFailed) { loadCaptcha(); setStep("credentials"); }
        throw new Error(data.message || "Could not resend code.");
      }
      if (!data.delivered && !data.dev_otp) {
        throw new Error(data.message || "Could not resend the code. Try again later.");
      }
      setDevOtp(data.dev_otp || null);
      setResendIn(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpBusy(false);
    }
  };

  // v6.11 — forgot password: step 1 sends reset OTP
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    if (!email) { setError("Enter your email address first."); return; }
    try {
      setLoading(true);
      const r = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaId, captchaText }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.captchaFailed) loadCaptcha();
        throw new Error(d.message || "Could not send reset code.");
      }
      if (!d.delivered && !d.dev_otp) throw new Error(d.message || "Could not send reset code.");
      setDevOtp(d.dev_otp || null);
      setStep("reset");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // v6.11 — forgot password: step 2 verifies OTP + sets new password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setOtpBusy(true);
      const r = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          otp: resetOtp.replace(/\D/g, ""),
          newPassword,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Reset failed.");
      setStep("credentials");
      setResetOtp(""); setNewPassword(""); setDevOtp(null);
      loadCaptcha();
      setError("");
      alert("Password reset. Log in with your new password.");
    } catch (err) { setError(err.message); }
    finally { setOtpBusy(false); }
  };

  // resend countdown
  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  return (
    <div className="campus-login">
      <div className="login-grid" />

      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />

      <div className="login-network" aria-hidden="true">
        <svg
          viewBox="0 0 1400 800"
          preserveAspectRatio="none"
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

      <header className="login-nav">
        <button
          type="button"
          className="login-brand"
          onClick={() => navigate("/")}
          aria-label="CampusCode home"
        >
          <span className="login-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="login-brand-text">
            <strong>CAMPUSCODE</strong>
            <small>HACKATHON ARENA</small>
          </span>
        </button>

        <button
          type="button"
          className="login-back"
          onClick={() => navigate("/")}
        >
          ← BACK TO HOME
        </button>
      </header>

      <main className="login-main">
        <section className="login-intro">
          <div className="login-status">
            <span />
            CAMPUSCODE / AUTHENTICATION
          </div>

          <div className="login-intro-index">
            <span>ACCESS</span>
            <span>01 / 02</span>
          </div>

          <h1>
            ENTER
            <br />
            THE
            <br />
            <span>ARENA.</span>
          </h1>

          <p className="login-intro-description">
            Sign in to continue building, collaborating and
            competing with the CampusCode community.
          </p>

          <div className="login-features">
            <div>
              <strong>01</strong>
              <span>BUILD</span>
            </div>

            <div>
              <strong>02</strong>
              <span>COMPETE</span>
            </div>

            <div>
              <strong>03</strong>
              <span>SHIP</span>
            </div>
          </div>

          <div className="login-system-info">
            <span>
              <i />
              AUTHENTICATION READY
            </span>
            <span>SECURE ACCESS</span>
            <span>2026</span>
          </div>
        </section>

        <section className="login-card-wrapper">
          <div className="login-card">
            <div className="login-card-top">
              <div>
                <span className="login-card-label">
                  EXISTING ACCOUNT
                </span>

                <h2>LOGIN</h2>

                <p>Access your CampusCode account.</p>
              </div>

              <div className="login-card-index">
                CC
                <br />
                01
              </div>
            </div>

            <div className="login-divider" />

            {step === "credentials" ? (
            <form onSubmit={handleCredentials}>
              <div className="login-field">
                <label htmlFor="login-email">
                  EMAIL ADDRESS
                </label>

                <div className="login-input-wrap">
                  <span className="login-input-icon">@</span>

                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={busy}
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="login-password">
                  PASSWORD
                </label>

                <div className="login-input-wrap">
                  <span className="login-input-icon">•</span>

                  <input
                    id="login-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={busy}
                  />

                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() =>
                      setShowPassword((prev) => !prev)
                    }
                    disabled={busy}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <span>
                      {showPassword ? "◉" : "○"}
                    </span>
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              {/* v6.11 — captcha */}
              <div className="login-field">
                <label htmlFor="login-captcha">CAPTCHA</label>
                <div className="login-captcha-row">
                  {captchaSvg ? (
                    <span
                      className="login-captcha-img"
                      dangerouslySetInnerHTML={{ __html: captchaSvg }}
                    />
                  ) : (
                    <span className="login-captcha-img">...</span>
                  )}
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={loadCaptcha}
                    disabled={busy}
                    aria-label="New captcha"
                  >
                    ↻ NEW
                  </button>
                </div>
                <div className="login-input-wrap" style={{ marginTop: 8 }}>
                  <input
                    id="login-captcha"
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

              {error && (
                <div
                  className="login-message login-error"
                  role="alert"
                >
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={busy}
              >
                <span>
                  {loading
                    ? "CHECKING..."
                    : "SEND LOGIN CODE"}
                </span>

                <b className={loading ? "is-loading" : ""}>
                  {loading ? "↻" : "↗"}
                </b>
              </button>

              <div className="login-otp-row">
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => { setStep("forgot"); setError(""); setDevOtp(null); loadCaptcha(); }}
                  disabled={busy}
                >
                  FORGOT PASSWORD?
                </button>
              </div>
            </form>
            ) : step === "forgot" ? (
            <form onSubmit={handleForgotSubmit}>
              <p className="login-otp-sent">RESET YOUR <strong>PASSWORD</strong></p>
              <div className="login-field">
                <label htmlFor="login-email">EMAIL ADDRESS</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">@</span>
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={busy}
                    autoFocus
                  />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="login-captcha2">CAPTCHA</label>
                <div className="login-captcha-row">
                  {captchaSvg ? (
                    <span className="login-captcha-img" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                  ) : (<span className="login-captcha-img">...</span>)}
                  <button type="button" className="login-password-toggle" onClick={loadCaptcha} disabled={busy}>↻ NEW</button>
                </div>
                <div className="login-input-wrap" style={{ marginTop: 8 }}>
                  <input id="login-captcha2" type="text" value={captchaText}
                    onChange={(e) => { setCaptchaText(e.target.value); setError(""); }}
                    placeholder="Enter the code above" autoComplete="off" disabled={busy} maxLength={5} />
                </div>
              </div>
              {error && (<div className="login-message login-error" role="alert"><span>!</span><p>{error}</p></div>)}
              <button type="submit" className="login-submit" disabled={busy}>
                <span>{loading ? "SENDING..." : "SEND RESET CODE"}</span>
                <b className={loading ? "is-loading" : ""}>{loading ? "↻" : "↗"}</b>
              </button>
              <div className="login-otp-row">
                <button type="button" className="login-password-toggle"
                  onClick={() => { setStep("credentials"); setError(""); }} disabled={busy}>← BACK TO LOGIN</button>
              </div>
            </form>
            ) : step === "reset" ? (
            <form onSubmit={handleResetSubmit}>
              <p className="login-otp-sent">CODE SENT TO <strong>{form.email.trim().toLowerCase()}</strong></p>
              <div className="login-field">
                <label htmlFor="login-reset-otp">6-DIGIT CODE</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">#</span>
                  <input id="login-reset-otp" type="text" inputMode="numeric" autoComplete="one-time-code"
                    value={resetOtp} onChange={(e) => { setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                    placeholder="••••••" maxLength={8} disabled={busy} autoFocus />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="login-new-password">NEW PASSWORD</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">•</span>
                  <input id="login-new-password" type={showPassword ? "text" : "password"}
                    value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    placeholder="Min 8 chars, upper + lower + number" autoComplete="new-password" disabled={busy} />
                </div>
                <p className="login-otp-hint">Min 8 characters with an uppercase letter, a lowercase letter, and a number.</p>
              </div>
              {devOtp && (<div className="login-message" role="status"><span>i</span><p>TEST MODE — your code is <strong>{devOtp}</strong></p></div>)}
              {error && (<div className="login-message login-error" role="alert"><span>!</span><p>{error}</p></div>)}
              <button type="submit" className="login-submit" disabled={busy}>
                <span>{otpBusy ? "RESETTING..." : "RESET PASSWORD"}</span>
                <b className={otpBusy ? "is-loading" : ""}>{otpBusy ? "↻" : "✓"}</b>
              </button>
              <div className="login-otp-row">
                <button type="button" className="login-password-toggle"
                  onClick={() => { setStep("credentials"); setError(""); setDevOtp(null); }} disabled={busy}>← BACK TO LOGIN</button>
              </div>
            </form>
            ) : (
            <form onSubmit={handleOtp}>
              <p className="login-otp-sent">
                CODE SENT TO <strong>{form.email.trim().toLowerCase()}</strong>
              </p>

              <div className="login-field">
                <label htmlFor="login-otp">6-DIGIT CODE</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">#</span>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 8));
                      setError("");
                    }}
                    placeholder="••••••"
                    maxLength={8}
                    disabled={busy}
                    autoFocus
                  />
                </div>
                <p className="login-otp-hint">
                  Check your inbox (and spam folder). The code expires
                  in 5 minutes. If the mail system is down, a master
                  code also works.
                </p>
              </div>

              {devOtp && (
                <div className="login-message" role="status">
                  <span>i</span>
                  <p>TEST MODE — your code is <strong>{devOtp}</strong></p>
                </div>
              )}

              {error && (
                <div className="login-message login-error" role="alert">
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              <button type="submit" className="login-submit" disabled={busy}>
                <span>{otpBusy ? "VERIFYING..." : "VERIFY & ENTER"}</span>
                <b className={otpBusy ? "is-loading" : ""}>{otpBusy ? "↻" : "↗"}</b>
              </button>

              <div className="login-otp-row">
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={resendOtp}
                  disabled={resendIn > 0 || busy}
                >
                  {resendIn > 0 ? `RESEND IN ${resendIn}s` : "RESEND CODE"}
                </button>
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => { setStep("credentials"); setOtp(""); setError(""); setDevOtp(null); }}
                  disabled={busy}
                >
                  ← BACK
                </button>
              </div>
            </form>
            )}

            <div className="login-register">
              <span>DON&apos;T HAVE AN ACCOUNT?</span>

              <button
                type="button"
                onClick={() => navigate("/register")}
                disabled={busy}
              >
                CREATE ACCOUNT →
              </button>
            </div>
          </div>

          <div className="login-card-footer">
            <span>AUTH / 2026</span>

            <span>
              <i />
              SECURE LOGIN
            </span>
          </div>
        </section>
      </main>

      <footer className="login-bottom">
        <span>CAMPUSCODE © 2026</span>
        <span>LEARN · BUILD · COMPETE · SHIP</span>
        <span>ALL SYSTEMS OPERATIONAL</span>
      </footer>
    </div>
  );
}

export default Login;
