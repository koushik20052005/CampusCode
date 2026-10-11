/* =========================================================
   mail.service.js — free email sending via Brevo HTTP API
   + HTML templates for OTP and hackathon notifications.

   Why HTTP API instead of SMTP: Render blocks outbound SMTP
   ports (587/465 timeout). The HTTPS API on port 443 works.

   Required env vars (Render dashboard → Environment):
     BREVO_API_KEY   Brevo API key (xkeysib-...) from SMTP & API → API Keys
     MAIL_FROM_NAME  e.g. "CampusCode" (optional)
     MAIL_FROM_EMAIL e.g. "you@gmail.com" — must be a verified sender in Brevo

   Free tier: 300 emails/day, no custom domain needed.
   If vars are missing, sendMail() logs instead of sending
   so local dev never crashes.
   ========================================================= */

import pool from "../config/db.js";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "CampusCode";
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL || "";

export function isMailConfigured() {
  return Boolean(BREVO_API_KEY && MAIL_FROM_EMAIL);
}

/* Generic sender — used by OTP, hackathon alerts, login alerts. */
export async function sendMail({ to, subject, html, text }) {
  if (!isMailConfigured()) {
    console.log(`[mail] (not configured) to=${to} subject=${subject}`);
    return { sent: false, reason: "mail_not_configured" };
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Brevo API error ${res.status}`);
    }
    // v6.15 — track daily quota (Brevo free tier: 300/day)
    pool.query(
      `INSERT INTO email_quota (day, sent_count) VALUES (CURRENT_DATE, 1)
       ON CONFLICT (day) DO UPDATE SET sent_count = email_quota.sent_count + 1, updated_at = NOW()`
    ).catch(() => {});
    return { sent: true, id: data.messageId };
  } catch (err) {
    console.error("[mail] send failed:", err.message);
    return { sent: false, reason: err.message };
  }
}

/* ---------- templates ---------- */

const shell = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#4f46e5;padding:20px 24px;color:#fff;font-size:20px;font-weight:bold">${title}</div>
    <div style="padding:24px;color:#1f2937;font-size:15px;line-height:1.6">${body}</div>
    <div style="padding:16px 24px;background:#f9fafb;color:#9ca3af;font-size:12px">CampusCode · Do not reply to this email.</div>
  </div>`;

export function otpEmailTemplate(otp, purpose = "verification") {
  const label =
    purpose === "register"
      ? "completing your CampusCode registration"
      : purpose === "login"
        ? "logging in to CampusCode"
        : "verifying your email";
  return shell(
    "CampusCode",
    `<p>Your one-time password for ${label}:</p>
     <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;margin:20px 0;color:#4f46e5">${otp}</div>
     <p style="color:#6b7280;font-size:13px">Valid for 5 minutes. Never share this code with anyone.</p>`
  );
}

export function hackathonMailTemplate({ title, heading, message, ctaText, ctaUrl }) {
  return shell(
    title || "CampusCode",
    `<h2 style="margin:0 0 12px;font-size:18px">${heading}</h2>
     <p>${message}</p>
     ${
       ctaUrl
         ? `<p><a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">${ctaText || "Open CampusCode"}</a></p>`
         : ""
     }`
  );
}

export function loginAlertTemplate({ email, ip, userAgent, time }) {
  return shell(
    "CampusCode",
    `<h2 style="margin:0 0 12px;font-size:18px">New login detected</h2>
     <p>Your account <b>${email}</b> was just signed in.</p>
     <ul style="color:#4b5563">
       <li>Time: ${time}</li>
       ${ip ? `<li>IP: ${ip}</li>` : ""}
       ${userAgent ? `<li>Device: ${userAgent}</li>` : ""}
     </ul>
     <p style="color:#6b7280;font-size:13px">If this wasn't you, change your password immediately.</p>`
  );
}

/* v6.15 — daily email usage for the admin dashboard */
export async function getEmailQuota() {
  try {
    const { rows } = await pool.query(
      `SELECT sent_count FROM email_quota WHERE day = CURRENT_DATE`
    );
    const used = rows[0]?.sent_count || 0;
    const limit = 300; // Brevo free tier
    return { used, limit, remaining: Math.max(0, limit - used) };
  } catch {
    return { used: 0, limit: 300, remaining: 300 };
  }
}
