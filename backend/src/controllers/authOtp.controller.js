/* =========================================================
   authOtp.controller.js — email OTP endpoints (free via Gmail SMTP).

   POST /api/auth/send-otp    { email, purpose }  → sends 6-digit OTP
   POST /api/auth/verify-otp  { email, otp, purpose } → verifies

   Purpose: "register" only — login OTP was removed, and forgot
   password uses its own endpoints, so these two endpoints no
   longer accept any other purpose.
   Rate-limited at the router level.
   ========================================================= */

import { createOtp, verifyOtp } from "../services/otp.service.js";
import { verifyCaptcha } from "../services/captcha.service.js";
import {
  sendMail,
  otpEmailTemplate,
  isMailConfigured,
} from "../services/mail.service.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PURPOSES = new Set(["register"]);

export async function sendOtp(req, res) {
  try {
    const { email, purpose = "register", captchaId, captchaText } = req.body || {};
    const clean = String(email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(clean)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }
    // OTP is registration-only now — reject anything else outright
    // instead of silently mapping it to "register".
    if (!PURPOSES.has(purpose)) {
      return res.status(400).json({ success: false, message: "OTP is only available for registration." });
    }
    // v6.11 — captcha blocks bots from burning OTP quota
    const captchaOk = await verifyCaptcha(captchaId, captchaText);
    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        message: "Captcha did not match. Try again.",
        captchaFailed: true,
      });
    }
    const use = PURPOSES.has(purpose) ? purpose : "register";

    const { otp } = await createOtp(clean, use);
    const result = await sendMail({
      to: clean,
      subject: `Your CampusCode OTP is ${otp}`,
      html: otpEmailTemplate(otp, use),
    });

    // Dev fallback: when mail isn't configured AND not production,
    // return the OTP so the flow can still be tested end-to-end.
    const devMode = !isMailConfigured() && process.env.NODE_ENV !== "production";

    return res.status(200).json({
      success: true,
      message: result.sent
        ? "OTP sent to your email. It expires in 5 minutes."
        : devMode
          ? "Mail not configured — dev mode returned the OTP below."
          : "Could not send email right now. Try a master OTP or try again later.",
      delivered: result.sent,
      ...(devMode ? { dev_otp: otp } : {}),
    });
  } catch (err) {
    console.error("[auth] send-otp error:", err.message);
    return res.status(500).json({ success: false, message: "Could not send OTP. Try again." });
  }
}

export async function verifyOtpHandler(req, res) {
  try {
    const { email, otp, purpose = "register" } = req.body || {};
    const clean = String(email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(clean) || !String(otp || "").trim()) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }
    // OTP is registration-only now (see sendOtp above).
    if (!PURPOSES.has(purpose)) {
      return res.status(400).json({ success: false, message: "OTP is only available for registration." });
    }
    const use = "register";

    const result = await verifyOtp(clean, otp, use);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }
    return res.status(200).json({
      success: true,
      message: "Email verified.",
      master: Boolean(result.master),
    });
  } catch (err) {
    console.error("[auth] verify-otp error:", err.message);
    return res.status(500).json({ success: false, message: "Verification failed. Try again." });
  }
}
