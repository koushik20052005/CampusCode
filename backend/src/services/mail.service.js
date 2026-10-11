/* =========================================================
   mail.service.js — free email sending via Resend
   + HTML templates for OTP and hackathon notifications.

   Required env var (Render dashboard → Environment):
     RESEND_API_KEY   API key from resend.com (free: 100/day)

   Optional:
     MAIL_FROM        Verified sender, e.g. "CampusCode <x@yourdomain>"
                      Defaults to Resend's test sender until a domain
                      is verified in the Resend dashboard.

   If RESEND_API_KEY is missing, sendMail() logs instead of
   sending so local dev never crashes.
   ========================================================= */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "CampusCode <onboarding@resend.dev>";

let resend = null;

function getClient() {
  if (resend) return resend;
  if (!RESEND_API_KEY) return null;
  resend = new Resend(RESEND_API_KEY);
  return resend;
}

export function isMailConfigured() {
  return Boolean(RESEND_API_KEY);
}

/* Generic sender — used by OTP, hackathon alerts, login alerts. */
export async function sendMail({ to, subject, html, text }) {
  const client = getClient();
  if (!client) {
    console.log(`[mail] (not configured) to=${to} subject=${subject}`);
    return { sent: false, reason: "mail_not_configured" };
  }
  try {
    const { error } = await client.emails.send({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text: text || undefined,
    });
    if (error) throw new Error(error.message);
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
