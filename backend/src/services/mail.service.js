/* =========================================================
   mail.service.js — free email sending via Brevo SMTP (nodemailer)
   + HTML templates for OTP and hackathon notifications.

   Required env vars (Render dashboard → Environment):
     MAIL_HOST   e.g. smtp-relay.brevo.com
     MAIL_PORT   e.g. 587
     MAIL_USER   Brevo login email
     MAIL_PASS   Brevo SMTP key
     MAIL_FROM   e.g. "CampusCode <you@gmail.com>" (verified sender)

   Free tier: 300 emails/day, no custom domain needed.
   If vars are missing, sendMail() logs instead of sending
   so local dev never crashes.
   ========================================================= */

import nodemailer from "nodemailer";

const MAIL_HOST = process.env.MAIL_HOST || "";
const MAIL_PORT = Number(process.env.MAIL_PORT || 587);
const MAIL_USER = process.env.MAIL_USER || "";
const MAIL_PASS = process.env.MAIL_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || "";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS || !MAIL_FROM) return null;
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_PORT === 465,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
  return transporter;
}

export function isMailConfigured() {
  return Boolean(MAIL_HOST && MAIL_USER && MAIL_PASS && MAIL_FROM);
}

/* Generic sender — used by OTP, hackathon alerts, login alerts. */
export async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) {
    console.log(`[mail] (not configured) to=${to} subject=${subject}`);
    return { sent: false, reason: "mail_not_configured" };
  }
  try {
    await tx.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text: text || undefined,
    });
    return { sent: true };
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
