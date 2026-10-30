/* =========================================================
   CERTIFICATE SERVICE — Module 8
   On-demand PDF rendering for the 3 organizer-pickable themes:
     sidebar        — v2 design 01 (Unstop-style side panel)
     constellation  — v2 design 02 (Unstop Awards-style night sky)
     blueprint      — v2 design 06 (CampusCode-native spec sheet)
   The other 3 v2 designs (band+ribbon, split hero, portrait)
   stay as samples only until the organizer picker is finalized.

   PDFs are rendered fresh from the database row on every
   download: no file storage, nothing goes stale.
   pdfkit is pure JavaScript (no Chromium) — safe on a 1GB host.

   COORDINATES: pdfkit's origin is the TOP-LEFT, y grows
   downward. All y values below are distances from the TOP.
========================================================= */

import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "assets");
const LOGO = path.join(ASSETS, "campuscode-logo.png");

const FONTS = {
  InterBlack: path.join(ASSETS, "fonts", "Inter-Black.ttf"),
  InterBold: path.join(ASSETS, "fonts", "Inter-BoldReal.ttf"),
  Inter: path.join(ASSETS, "fonts", "DejaVuSans.ttf"),
  DMMono: path.join(ASSETS, "fonts", "DMMono-Regular.ttf"),
  SerifBold: path.join(ASSETS, "fonts", "DejaVuSerif-Bold.ttf"),
  Serif: path.join(ASSETS, "fonts", "DejaVuSerif.ttf"),
};

export const CERT_THEMES = ["sidebar", "constellation", "blueprint"];

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode() {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const byte of bytes) {
    out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `CC-CERT-${out}`;
}

/* Generate `count` codes that do not already exist in the table. */
export async function generateUniqueCodes(pool, count) {
  const codes = new Set();
  while (codes.size < count) {
    codes.add(generateCode());
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const list = [...codes];
    const existing = await pool.query(
      `SELECT code FROM certificates WHERE code = ANY($1)`,
      [list]
    );
    const taken = new Set(existing.rows.map((row) => row.code));
    if (taken.size === 0) return list;
    for (const code of taken) {
      codes.delete(code);
      let next = generateCode();
      while (codes.has(next)) next = generateCode();
      codes.add(next);
    }
  }
  return [...codes];
}

export function formatCertDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function placeText(place) {
  return place === 1
    ? "Winner \u2014 1st Place"
    : place === 2
      ? "Winner \u2014 2nd Place"
      : place === 3
        ? "Winner \u2014 3rd Place"
        : null;
}

/* Deterministic pseudo-random (so a design looks designed, not random). */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function registerFonts(doc) {
  for (const [name, file] of Object.entries(FONTS)) {
    doc.registerFont(name, file);
  }
}

async function qrBuffer(code) {
  return QRCode.toBuffer(`https://campuscode.co.in/verify/${code}`, {
    margin: 1,
    width: 256,
  });
}

/* QR white box at (x, yTop); code + verify lines to its right. */
function drawQr(doc, x, yTop, qr, size, code, captionColor) {
  doc.save();
  doc.fillColor("#ffffff");
  doc.roundedRect(x - 6, yTop - 6, size + 12, size + 12, 6).fill();
  doc.restore();
  doc.image(qr, x, yTop, { width: size, height: size });
  const tx = x + size + 18;
  doc.font("DMMono").fontSize(8).fillColor(captionColor);
  doc.text(code, tx, yTop + 12);
  doc.text("Verify at", tx, yTop + 28);
  doc.text("campuscode.co.in/verify", tx, yTop + 44);
}

/* Signature block: name on top, rule, role below. yTop = top of block. */
function drawSignature(doc, x, yTop, name, role, color, ink) {
  doc.font("Inter").fontSize(10).fillColor(ink);
  doc.text(name, x, yTop, { width: 160, align: "center" });
  doc.strokeColor(color).lineWidth(0.75);
  doc.moveTo(x, yTop + 18).lineTo(x + 160, yTop + 18).stroke();
  doc.font("DMMono").fontSize(7.5).fillColor(color);
  doc.text(role, x, yTop + 30, { width: 160, align: "center" });
}

function drawSeal(doc, cx, cy, r, text, ring, fill, txtcolor) {
  doc.fillColor(fill);
  doc.circle(cx, cy, r).fill();
  doc.strokeColor(ring).lineWidth(1.5);
  doc.circle(cx, cy, r - 4).stroke();
  const fs = r * 0.42;
  doc.fillColor(txtcolor).font("InterBlack").fontSize(fs);
  doc.text(text, cx - r, cy - fs / 2, { width: r * 2, align: "center" });
}

function drawFooter(doc, W, H, code, color, showLeft = true) {
  doc.font("DMMono").fontSize(7.5).fillColor(color);
  if (showLeft) {
    doc.text("CAMPUSCODE  \u00b7  VERIFIED CERTIFICATE", 28, H - 26);
  }
  doc.text(code, W - 28 - doc.widthOfString(code), H - 26);
}

function drawWatermark(doc, W, H, text, color, alpha) {
  doc.save();
  doc.fillColor(color).fillOpacity(alpha);
  doc.font("InterBlack").fontSize(42);
  doc.translate(W / 2, H / 2);
  doc.rotate(-28);
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      doc.text(text, col * 330 - 165, row * 130, {
        width: 330,
        align: "center",
      });
    }
  }
  doc.restore();
  doc.fillOpacity(1);
}

/* ------------------------------------------------ SIDEBAR (v2 design 01) */
function drawSidebar(doc, W, H, d, qr) {
  doc.fillColor("#f7f7f4").rect(0, 0, W, H).fill();
  drawWatermark(doc, W, H, "CAMPUSCODE", "#111111", 0.045);
  // Dark side panel with lime slashes, clipped to the panel.
  doc.save();
  doc.rect(0, 0, 252, H).clip();
  doc.fillColor("#2e1065").rect(0, 0, 252, H).fill();
  doc.strokeColor("#a8e62e").lineWidth(7);
  for (let i = -6; i < 14; i++) {
    doc.strokeOpacity(0.16);
    doc.moveTo(i * 46, -20).lineTo(i * 46 + 130, H + 20).stroke();
  }
  doc.restore();
  doc.strokeOpacity(1);
  // Overlapping circular logo badge.
  doc.fillColor("#ffffff").circle(252, 150, 62).fill();
  doc.strokeColor("#a8e62e").lineWidth(2).circle(252, 150, 62).stroke();
  doc.image(LOGO, 252 - 44, 150 - 44, { width: 88, height: 88 });
  doc.font("DMMono").fontSize(9).fillColor("#c4b5fd");
  doc.text("EST. 2026", 0, H - 60, { width: 252, align: "center" });
  doc.font("InterBold").fontSize(11).fillColor("#ffffff");
  doc.text("CAMPUSCODE", 0, H - 42, { width: 252, align: "center" });
  // Content.
  const x = 320;
  doc.font("DMMono").fontSize(10).fillColor("#7665ff");
  doc.text(d.title.toUpperCase(), x, 110);
  doc.font("InterBlack").fontSize(30).fillColor("#111111");
  doc.text("This is awarded to", x, 152);
  doc.font("InterBlack").fontSize(44).fillColor("#5b21b6");
  doc.text(d.holderName, x, 195);
  doc.font("Inter").fontSize(13).fillColor("#444444");
  doc.text("for participating in", x, 252);
  doc.font("InterBold").fontSize(17).fillColor("#111111");
  doc.text(d.hackathonTitle, x, 272);
  doc.font("Inter").fontSize(12).fillColor("#777770");
  doc.text(
    [
      ...(d.teamName ? [`Team ${d.teamName}`] : []),
      `Track: ${d.track}`,
      d.eventDate,
    ].join("  \u00b7  "),
    x,
    300
  );
  doc.font("Inter").fontSize(12).fillColor("#555555");
  doc.text("In recognition of their ideas, teamwork, and contribution", x, 336);
  doc.text("to the national online hackathon.", x, 356);
  if (d.placeLine) {
    doc.font("InterBold").fontSize(13).fillColor("#b45309");
    doc.text(d.placeLine, x, 384);
  }
  drawSignature(doc, x, H - 130, "CampusCode Team", "HACKATHON ORGANIZER", "#777770", "#111111");
  drawQr(doc, W - 300, H - 154, qr, 64, d.code, "#777770");
  drawFooter(doc, W, H, d.code, "#777770", false);
}

/* ------------------------------------------- CONSTELLATION (v2 design 02) */
function drawConstellation(doc, W, H, d, qr) {
  // Vertical gradient via strips (top color first).
  const steps = 60;
  const sh = H / steps;
  const top = [0x31, 0x2e, 0x81];
  const bottom = [0x0b, 0x12, 0x26];
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    const r = Math.round(top[0] + (bottom[0] - top[0]) * f);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * f);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * f);
    doc.fillColor(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
    doc.rect(0, i * sh, W, sh + 1).fill();
  }
  // Dot network.
  const rnd = seededRandom(42);
  const pts = [];
  for (let i = 0; i < 70; i++) {
    pts.push([rnd() * (W - 40) + 20, rnd() * (H - 40) + 20]);
  }
  doc.strokeColor("#22d3ee").fillColor("#22d3ee");
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i][0] - pts[j][0]) < 130 && Math.abs(pts[i][1] - pts[j][1]) < 90) {
        doc.strokeOpacity(0.22).lineWidth(0.5);
        doc.moveTo(pts[i][0], pts[i][1]).lineTo(pts[j][0], pts[j][1]).stroke();
      }
    }
  }
  doc.strokeOpacity(1);
  for (const [x, y] of pts) {
    doc.fillOpacity(0.45).circle(x, y, 1.8).fill();
  }
  doc.fillOpacity(1);
  // Top badge plate.
  doc.fillColor("#1d4ed8").strokeColor("#93c5fd").lineWidth(1);
  doc.roundedRect(W / 2 - 165, 48, 330, 58, 8).fillAndStroke();
  doc.image(LOGO, W / 2 - 150, 58, { width: 38, height: 38 });
  doc.font("InterBlack").fontSize(15).fillColor("#ffffff");
  doc.text("CAMPUSCODE", W / 2 - 100, 59);
  doc.font("DMMono").fontSize(8).fillColor("#bfdbfe");
  doc.text("NATIONAL ONLINE HACKATHON", W / 2 - 100, 78);
  // Medallion + dotted laurel arcs.
  const mx = W / 2;
  const my = 225;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const lx = mx + side * 108 * (0.55 + 0.45 * (i / 8));
      const ly = my - 55 + 95 * (i / 8);
      doc.fillColor("#22d3ee").circle(lx, ly, 2.2).fill();
    }
  }
  doc.fillColor("#0b1226").strokeColor("#22d3ee").lineWidth(2);
  doc.circle(mx, my, 66).fillAndStroke();
  doc.strokeColor("#f59e0b").lineWidth(1);
  doc.circle(mx, my, 58).stroke();
  doc.font("InterBlack").fontSize(26).fillColor("#f59e0b");
  doc.text("CC", mx - 66, my - 13, { width: 132, align: "center" });
  doc.font("Serif").fontSize(30).fillColor("#ffffff");
  doc.text(d.holderName, 0, 320, { align: "center" });
  doc.font("Inter").fontSize(13).fillColor("#c7d2fe");
  doc.text(`${d.college}  \u00b7  ${d.hackathonTitle}`, 0, 362, { align: "center" });
  doc.font("Inter").fontSize(11).fillColor("#93a4c4");
  doc.text(`${d.title}  \u00b7  ${d.eventDate}`, 0, 386, { align: "center" });
  if (d.placeLine) {
    doc.font("InterBold").fontSize(13).fillColor("#f59e0b");
    doc.text(d.placeLine, 0, 406, { align: "center" });
  }
  drawSignature(doc, 90, 455, "CampusCode Team", "HACKATHON ORGANIZER", "#93a4c4", "#ffffff");
  drawQr(doc, W - 300, 445, qr, 56, d.code, "#93a4c4");
  drawFooter(doc, W, H, d.code, "#93a4c4");
}

/* ----------------------------------------------- BLUEPRINT (v2 design 06) */
function drawBlueprint(doc, W, H, d, qr) {
  doc.fillColor("#f7f7f4").rect(0, 0, W, H).fill();
  doc.strokeColor("#e5e5dd").lineWidth(0.5);
  for (let gx = 0; gx <= W; gx += 28) doc.moveTo(gx, 0).lineTo(gx, H).stroke();
  for (let gy = 0; gy <= H; gy += 28) doc.moveTo(0, gy).lineTo(W, gy).stroke();
  // Corner marks, pointing inward.
  doc.strokeColor("#111111").lineWidth(1.25);
  const m = 26;
  doc.moveTo(m, m).lineTo(m + 26, m).stroke();
  doc.moveTo(m, m).lineTo(m, m + 26).stroke();
  doc.moveTo(W - m, m).lineTo(W - m - 26, m).stroke();
  doc.moveTo(W - m, m).lineTo(W - m, m + 26).stroke();
  doc.moveTo(m, H - m).lineTo(m + 26, H - m).stroke();
  doc.moveTo(m, H - m).lineTo(m, H - m - 26).stroke();
  doc.moveTo(W - m, H - m).lineTo(W - m - 26, H - m).stroke();
  doc.moveTo(W - m, H - m).lineTo(W - m, H - m - 26).stroke();
  // Header.
  doc.font("DMMono").fontSize(10).fillColor("#7665ff");
  doc.text("CAMPUSCODE // CERTIFICATE SPEC SHEET", 56, 62);
  doc.image(LOGO, W - 112, 48, { width: 56, height: 56 });
  doc.font("DMMono").fontSize(9).fillColor("#777770");
  doc.text("DOC: CERT-2026-001", W - 56 - 160, 103, { width: 160, align: "right" });
  // Name block.
  doc.font("DMMono").fontSize(10).fillColor("#82b91a");
  doc.text("HOLDER", 56, 150);
  doc.font("InterBlack").fontSize(40).fillColor("#111111");
  doc.text(d.holderName, 56, 185);
  doc.font("Inter").fontSize(13).fillColor("#444444");
  doc.text(d.title, 56, 238);
  // Spec rows.
  const rows = [
    ["EVENT", d.hackathonTitle],
    ...(d.teamName ? [["TEAM", d.teamName]] : []),
    ["TRACK", d.track],
    ["HELD ON", d.eventDate],
    ["ISSUED BY", "CampusCode"],
  ];
  if (d.placeLine) rows.push(["PLACE", d.placeLine]);
  let ry = 282;
  for (const [label, val] of rows) {
    doc.font("DMMono").fontSize(9).fillColor("#777770");
    doc.text(label, 56, ry);
    doc.font("InterBold").fontSize(12).fillColor("#111111");
    doc.text(val, 220, ry);
    doc.strokeColor("#deded8").lineWidth(0.75);
    doc.moveTo(56, ry + 16).lineTo(W - 56, ry + 16).stroke();
    ry += 40;
  }
  // Bottom band.
  doc.fillColor("#111111").rect(0, H - 104, W, 104).fill();
  drawQr(doc, 56, H - 90, qr, 52, d.code, "#9a9a9a");
  drawSignature(doc, 330, H - 76, "CampusCode Team", "HACKATHON ORGANIZER", "#9a9a9a", "#ffffff");
  doc.save();
  doc.translate(W - 150, H - 52).rotate(-10);
  doc.strokeColor("#a8e62e").lineWidth(1.5);
  doc.rect(-62, -14, 124, 30).stroke();
  doc.font("InterBlack").fontSize(13).fillColor("#a8e62e");
  doc.text("VERIFIED", -62, -5, { width: 124, align: "center" });
  doc.restore();
  drawFooter(doc, W, H, d.code, "#777770");
}

const THEME_DRAWERS = {
  sidebar: drawSidebar,
  constellation: drawConstellation,
  blueprint: drawBlueprint,
};

/**
 * Render one certificate PDF.
 * cert: { holderName, college, hackathonTitle, teamName, track,
 *         eventDate (already formatted), code, type, place, theme }
 * Returns a Buffer with the PDF bytes.
 */
export async function renderCertificatePdf(cert) {
  const theme = CERT_THEMES.includes(cert.theme) ? cert.theme : "sidebar";
  const isWinner = cert.type === "WINNER";
  const d = {
    ...cert,
    title: isWinner ? "Certificate of Achievement" : "Certificate of Participation",
    placeLine: isWinner ? placeText(cert.place) : null,
    college: cert.college || "CampusCode",
  };
  const qr = await qrBuffer(cert.code);
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
  registerFonts(doc);
  doc.info.Title = `${d.title} — ${d.holderName}`;
  doc.info.Author = "CampusCode";
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", resolve));
  const W = 841.89;
  const H = 595.28;
  THEME_DRAWERS[theme](doc, W, H, d, qr);
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
