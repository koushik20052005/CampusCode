/* =========================================================
   CERTIFICATE SERVICE — Module 8
   On-demand PDF rendering. The 3 organizer-pickable themes are the
   quiz designs picked 2026-10-30 (light-clean, minimal,
   classic-ivory). The v2 launch themes (sidebar, constellation,
   blueprint) stay renderable so certificates already issued with
   them still download exactly as before — they are just no longer
   offered in the organizer picker.

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
// Corrected render: slash center = tile center, verified 0.0px off.
// All NEW themes use this; the old themes keep LOGO untouched.
const LOGO_BARS = path.join(ASSETS, "campuscode-logo-bars.png");
const PARTNER_LOGO = path.join(ASSETS, "adaption-logo.png");

const FONTS = {
  InterBlack: path.join(ASSETS, "fonts", "Inter-Black.ttf"),
  InterBold: path.join(ASSETS, "fonts", "Inter-BoldReal.ttf"),
  Inter: path.join(ASSETS, "fonts", "DejaVuSans.ttf"),
  DMMono: path.join(ASSETS, "fonts", "DMMono-Regular.ttf"),
  SerifBold: path.join(ASSETS, "fonts", "DejaVuSerif-Bold.ttf"),
  Serif: path.join(ASSETS, "fonts", "DejaVuSerif.ttf"),
};

export const CERT_THEMES = ["sidebar", "constellation", "blueprint", "light-clean", "minimal", "classic-ivory", "midnight-gold", "royal-purple", "ocean-blue", "emerald-classic", "rose-blush", "sunset-glow", "mono-grid", "forest-line", "crimson-award", "skyline-blue", "charcoal-lime", "teal-ribbon", "mint-rebuild"];

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
  "light-clean": drawLightClean,
  minimal: drawMinimal,
  "classic-ivory": drawClassicIvory,
  "midnight-gold": drawMidnightGold,
  "royal-purple": drawRoyalPurple,
  "ocean-blue": drawOceanBlue,
  "emerald-classic": drawEmeraldClassic,
  "rose-blush": drawRoseBlush,
  "sunset-glow": drawSunsetGlow,
  "mono-grid": drawMonoGrid,
  "forest-line": drawForestLine,
  "crimson-award": drawCrimsonAward,
  "skyline-blue": drawSkylineBlue,
  "charcoal-lime": drawCharcoalLime,
  "teal-ribbon": drawTealRibbon,
  "mint-rebuild": drawMintRebuild,
};

/* ---------------- LIGHT CLEAN (quiz participation pick, 2026-10-30)
   Landing off-white + grid + lime top bar + centered purple name. */
function drawLightClean(doc, W, H, d, qr) {
  doc.fillColor("#f7f7f4").rect(0, 0, W, H).fill();
  doc.strokeColor("#e8e8e0").lineWidth(0.5);
  for (let gx = 0; gx <= W; gx += 28) doc.moveTo(gx, 0).lineTo(gx, H).stroke();
  for (let gy = 0; gy <= H; gy += 28) doc.moveTo(0, gy).lineTo(W, gy).stroke();
  doc.fillColor("#a8e62e").rect(0, 0, W, 7).fill();
  drawDiagonalTexture(doc, W, H, "#e8e8e0");
  const cx = W / 2;
  doc.image(LOGO_BARS, cx - 35, 80, { width: 70, height: 58 });
  doc.font("DMMono").fontSize(10).fillColor("#777770");
  doc.text("CAMPUSCODE", 0, 158, { align: "center" });
  doc.font("InterBlack").fontSize(40).fillColor("#111111");
  doc.text(d.title, 0, 188, { align: "center" });
  doc.strokeColor("#a8e62e").lineWidth(3);
  doc.moveTo(cx - 60, 248).lineTo(cx + 60, 248).stroke();
  doc.font("InterBold").fontSize(13).fillColor("#777770");
  doc.text("This certificate is proudly presented to", 0, 268, { align: "center" });
  doc.font("InterBlack").fontSize(44).fillColor("#7665ff");
  doc.text(d.holderName, 0, 296, { align: "center" });
  const action = d.placeLine
    ? `for winning the ${d.hackathonTitle}`
    : `for participating in the ${d.hackathonTitle}`;
  doc.font("InterBold").fontSize(14).fillColor("#111111");
  doc.text(action, 0, 372, { align: "center" });
  doc.text(`held on ${d.eventDate}`, 0, 394, { align: "center" });
  if (d.placeLine) {
    doc.font("InterBold").fontSize(13).fillColor("#7665ff");
    doc.text(d.placeLine, 0, 418, { align: "center" });
  }
  doc.font("DMMono").fontSize(8.5).fillColor("#777770");
  doc.text("BUILDING REAL PRODUCTS, NOT JUST PROJECTS", 0, d.placeLine ? 444 : 430, { align: "center" });
  drawSignature(doc, cx - 80, H - 130, "CampusCode Team", "HACKATHON ORGANIZER", "#777770", "#111111");
  drawQr(doc, W - 300, H - 154, qr, 64, d.code, "#777770");
  drawFooter(doc, W, H, d.code, "#777770");
}

/* ---------------- MINIMAL (quiz runner-up pick, 2026-10-30)
   White + lime edge bar + left-aligned type + ghost place numeral. */
function drawMinimal(doc, W, H, d, qr) {
  doc.fillColor("#ffffff").rect(0, 0, W, H).fill();
  doc.fillColor("#a8e62e").rect(0, 0, 12, H).fill();
  drawDotGrid(doc, W, H, "#e9e9e4");
  doc.image(LOGO_BARS, 56, 44, { width: 66, height: 55 });
  doc.font("DMMono").fontSize(12).fillColor("#111111");
  doc.text("CAMPUSCODE", 134, 66);
  doc.font("DMMono").fontSize(8).fillColor("#777770");
  doc.text("VERIFIED CERTIFICATE", 134, 86);
  if (d.place) {
    doc.save();
    doc.fillColor("#f2f2ee").fillOpacity(1);
    doc.font("InterBlack").fontSize(300);
    doc.text(String(d.place), W - 280, 150, { width: 220, align: "center" });
    doc.restore();
  }
  doc.font("InterBlack").fontSize(44).fillColor("#111111");
  doc.text(d.title, 56, 170, { width: 560 });
  doc.strokeColor("#a8e62e").lineWidth(4);
  doc.moveTo(56, 292).lineTo(140, 292).stroke();
  doc.font("InterBlack").fontSize(36).fillColor("#7665ff");
  doc.text(d.holderName, 56, 312, { width: 560 });
  doc.font("InterBold").fontSize(14).fillColor("#111111");
  doc.text(d.hackathonTitle, 56, 372, { width: 560 });
  doc.font("InterBold").fontSize(13).fillColor("#777770");
  doc.text(d.placeLine ? `${d.eventDate}  \u00b7  ${d.placeLine}` : d.eventDate, 56, 396, { width: 560 });
  doc.font("DMMono").fontSize(8.5).fillColor("#777770");
  doc.text("BUILDING REAL PRODUCTS, NOT JUST PROJECTS", 56, 440, { width: 560 });
  doc.save();
  doc.fillColor("#e8e8e0").font("DMMono").fontSize(8);
  doc.translate(W - 24, H - 120);
  doc.rotate(-90);
  doc.text("CAMPUSCODE  ·  BUILDING REAL PRODUCTS, NOT JUST PROJECTS", 0, 0);
  doc.restore();
  drawQr(doc, 56, H - 110, qr, 56, d.code, "#777770");
}

/* ---------------- CLASSIC IVORY (quiz winner pick, 2026-10-30)
   Formal serif certificate: ivory + double rule + lime CC seal. */
function drawClassicIvory(doc, W, H, d, qr) {
  doc.fillColor("#fdf8ec").rect(0, 0, W, H).fill();
  doc.strokeColor("#5a4632").lineWidth(1.5);
  doc.rect(18, 18, W - 36, H - 36).stroke();
  doc.strokeColor("#b4a078").lineWidth(0.75);
  doc.rect(28, 28, W - 56, H - 56).stroke();
  const cx = W / 2;
  doc.image(LOGO_BARS, cx - 33, 62, { width: 66, height: 55 });
  doc.font("DMMono").fontSize(10).fillColor("#786446");
  doc.text("CAMPUSCODE", 0, 136, { align: "center" });
  doc.font("SerifBold").fontSize(44).fillColor("#1e1810");
  doc.text(d.title, 0, 168, { align: "center" });
  doc.strokeColor("#b4a078").lineWidth(1);
  doc.moveTo(cx - 75, 232).lineTo(cx + 75, 232).stroke();
  doc.font("Serif").fontSize(14).fillColor("#5a4c36");
  doc.text("This is to certify that", 0, 252, { align: "center" });
  doc.font("SerifBold").fontSize(46).fillColor("#1e1810");
  doc.text(d.holderName, 0, 282, { align: "center" });
  const action = d.placeLine
    ? `has won the ${d.hackathonTitle}`
    : `has participated in the ${d.hackathonTitle}`;
  doc.font("Serif").fontSize(15).fillColor("#1e1810");
  doc.text(action, 0, 352, { align: "center" });
  doc.text(`held on ${d.eventDate}`, 0, 378, { align: "center" });
  if (d.placeLine) {
    doc.font("SerifBold").fontSize(14).fillColor("#5a4632");
    doc.text(d.placeLine, 0, 404, { align: "center" });
  }
  drawQr(doc, 56, H - 110, qr, 56, d.code, "#786446");
  doc.font("DMMono").fontSize(8).fillColor("#786446");
  doc.text(`${d.code}  \u00b7  campuscode.co.in`, 0, H - 40, { align: "center" });
}

/* ---------------- v6.36 — 12 extra demo themes (organizer picker) --
   One shared layout engine; each theme is just a palette + layout.
   Center layout mirrors Light Clean; left layout mirrors Minimal. */
function drawSimpleTheme(doc, W, H, d, qr, o) {
  const cx = W / 2;
  doc.fillColor(o.bg).rect(0, 0, W, H).fill();
  if (o.grid) {
    doc.strokeColor(o.grid).lineWidth(0.5);
    for (let gx = 0; gx <= W; gx += 28) doc.moveTo(gx, 0).lineTo(gx, H).stroke();
    for (let gy = 0; gy <= H; gy += 28) doc.moveTo(0, gy).lineTo(W, gy).stroke();
  }
  if (o.barLeft) doc.fillColor(o.barLeft).rect(0, 0, 12, H).fill();
  if (o.bandTop) doc.fillColor(o.bandTop).rect(0, 0, W, 14).fill();
  doc.strokeColor(o.frame).lineWidth(2);
  doc.rect(18, 18, W - 36, H - 36).stroke();
  if (o.frameInner) {
    doc.strokeColor(o.frameInner).lineWidth(0.75);
    doc.rect(28, 28, W - 56, H - 56).stroke();
  }
  if (o.layout === "left") {
    doc.image(LOGO_BARS, 56, 44, { width: 66, height: 55 });
    doc.font("DMMono").fontSize(12).fillColor(o.titleColor);
    doc.text("CAMPUSCODE", 134, 66);
    doc.font("DMMono").fontSize(8).fillColor(o.subColor);
    doc.text("VERIFIED CERTIFICATE", 134, 86);
    doc.font(o.titleFont).fontSize(44).fillColor(o.titleColor);
    doc.text(d.title, 56, 170, { width: 560 });
    doc.strokeColor(o.accent).lineWidth(4);
    doc.moveTo(56, 292).lineTo(140, 292).stroke();
    doc.font("InterBlack").fontSize(36).fillColor(o.nameColor);
    doc.text(d.holderName, 56, 312, { width: 560 });
    doc.font("InterBold").fontSize(14).fillColor(o.titleColor);
    doc.text(d.hackathonTitle, 56, 372, { width: 560 });
    doc.font("InterBold").fontSize(13).fillColor(o.subColor);
    doc.text(d.placeLine ? `${d.eventDate} · ${d.placeLine}` : d.eventDate, 56, 396, { width: 560 });
  } else {
    doc.image(LOGO_BARS, cx - 35, 70, { width: 70, height: 58 });
    doc.font("DMMono").fontSize(10).fillColor(o.subColor);
    doc.text("CAMPUSCODE", 0, 148, { align: "center" });
    doc.font(o.titleFont).fontSize(40).fillColor(o.titleColor);
    doc.text(d.title, 0, 182, { align: "center" });
    doc.strokeColor(o.accent).lineWidth(3);
    doc.moveTo(cx - 60, 242).lineTo(cx + 60, 242).stroke();
    doc.font("InterBold").fontSize(13).fillColor(o.subColor);
    doc.text(o.presented, 0, 262, { align: "center" });
    doc.font("InterBlack").fontSize(44).fillColor(o.nameColor);
    doc.text(d.holderName, 0, 292, { align: "center" });
    const action = d.placeLine ? `for winning the ${d.hackathonTitle}` : `for participating in the ${d.hackathonTitle}`;
    doc.font("InterBold").fontSize(14).fillColor(o.titleColor);
    doc.text(action, 0, 366, { align: "center" });
    doc.text(`held on ${d.eventDate}`, 0, 390, { align: "center" });
    if (d.placeLine) {
      doc.font("InterBold").fontSize(13).fillColor(o.accent);
      doc.text(d.placeLine, 0, 414, { align: "center" });
    }
    if (o.seal) drawSeal(doc, cx, 470, 30, "CC", o.seal.ring, o.seal.fill, o.seal.txt);
  }
  if (o.qr === "right") drawQr(doc, W - 300, H - 154, qr, 64, d.code, o.subColor);
  else drawQr(doc, 56, H - 110, qr, 56, d.code, o.subColor);
  drawFooter(doc, W, H, d.code, o.subColor);
}

function drawMidnightGold(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#111111", frame: "#d4af37", frameInner: "#8a6f3c", layout: "center", titleFont: "InterBlack", titleColor: "#f5f5f5", nameColor: "#d4af37", subColor: "#bbbbbb", accent: "#d4af37", presented: "This certificate is proudly presented to", qr: "right", seal: { ring: "#d4af37", fill: "#d4af37", txt: "#111111" } }); }
function drawRoyalPurple(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#2d1b4e", frame: "#a8e62e", layout: "left", titleFont: "InterBlack", titleColor: "#ffffff", nameColor: "#a8e62e", subColor: "#c9b8e8", accent: "#a8e62e", qr: "left" }); }
function drawOceanBlue(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#1e4e79", frame: "#7fb3d5", layout: "center", titleFont: "InterBlack", titleColor: "#ffffff", nameColor: "#bcd6ea", subColor: "#9db8d2", accent: "#7fb3d5", presented: "This certificate is proudly presented to", qr: "right" }); }
function drawEmeraldClassic(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#0d3b2e", frame: "#d4af37", frameInner: "#8a6f3c", layout: "center", titleFont: "SerifBold", titleColor: "#f5f0e1", nameColor: "#d4af37", subColor: "#9db8a8", accent: "#d4af37", presented: "This is to certify that", qr: "left", seal: { ring: "#d4af37", fill: "#d4af37", txt: "#0d3b2e" } }); }
function drawRoseBlush(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#fdecef", frame: "#e8a0b4", layout: "center", titleFont: "SerifBold", titleColor: "#5a2a35", nameColor: "#b03a5b", subColor: "#8a6a72", accent: "#e8a0b4", presented: "This is to certify that", qr: "right" }); }
function drawSunsetGlow(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#fff1e0", bandTop: "#e8913a", frame: "#e8913a", layout: "left", titleFont: "InterBlack", titleColor: "#7a3b00", nameColor: "#e8913a", subColor: "#8a6a52", accent: "#e8913a", qr: "left" }); }
function drawMonoGrid(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#f7f7f4", grid: "#e8e8e0", frame: "#333333", layout: "left", titleFont: "InterBlack", titleColor: "#111111", nameColor: "#7665ff", subColor: "#777770", accent: "#a8e62e", qr: "right" }); }
function drawForestLine(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#f2f5e9", frame: "#3e6b34", frameInner: "#6a8a5a", layout: "center", titleFont: "SerifBold", titleColor: "#1e3d1a", nameColor: "#3e6b34", subColor: "#6a7a5e", accent: "#3e6b34", presented: "This is to certify that", qr: "left", seal: { ring: "#3e6b34", fill: "#3e6b34", txt: "#ffffff" } }); }
function drawCrimsonAward(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#5c0a0a", frame: "#d4af37", layout: "center", titleFont: "InterBlack", titleColor: "#fff5f5", nameColor: "#d4af37", subColor: "#c9a0a0", accent: "#d4af37", presented: "This certificate is proudly presented to", qr: "right", seal: { ring: "#d4af37", fill: "#d4af37", txt: "#5c0a0a" } }); }
function drawSkylineBlue(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#dbeafe", frame: "#1e4e79", layout: "left", titleFont: "InterBlack", titleColor: "#16324f", nameColor: "#1e4e79", subColor: "#5a7a9a", accent: "#1e4e79", qr: "left" }); }
function drawCharcoalLime(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#262626", barLeft: "#a8e62e", frame: "#a8e62e", layout: "left", titleFont: "InterBlack", titleColor: "#f5f5f5", nameColor: "#a8e62e", subColor: "#aaaaaa", accent: "#a8e62e", qr: "right" }); }
function drawTealRibbon(doc, W, H, d, qr) { drawSimpleTheme(doc, W, H, d, qr, { bg: "#0f5257", bandTop: "#ffffff", frame: "#ffffff", layout: "center", titleFont: "InterBlack", titleColor: "#ffffff", nameColor: "#a8e62e", subColor: "#9db8ba", accent: "#a8e62e", presented: "This certificate is proudly presented to", qr: "left" }); }

/* ---------------- MINT REBUILD (ReBuild '26 participation, 2026-11-09)
   Koushik's picked sample: soft pastel diagonal gradient (lavender ->
   mint -> peach), thin white rounded border, big bold CAMPUSCODE ·
   REBUILD '26 header, serif holder name, gradient rule centred under
   the name, rounds line + EVENT/DATE/MODE strip, issued block
   bottom-left, QR bottom-right.
   Rules locked by Koushik: NO name, NO signature/sign anywhere, NO
   circular seal. The issued date comes from the certificate row
   (issuedAt); the rounds line and strip values are ReBuild-specific,
   matching the theme name. */
function drawMintRebuild(doc, W, H, d, qr) {
  const cx = W / 2;
  // Pastel diagonal gradient background.
  const bg = doc.linearGradient(0, 0, W, H);
  bg.stop(0, "#e8e4ff").stop(0.5, "#dcf5e6").stop(1, "#fff0dc");
  doc.fillColor(bg).rect(0, 0, W, H).fill();
  // Thin white rounded border frame.
  doc.strokeColor("#ffffff").lineWidth(1.5);
  doc.roundedRect(35, 35, W - 70, H - 70, 12).stroke();
  // Header mark + big bold platform/event line.
  doc.image(LOGO_BARS, cx - 35, 62, { width: 70, height: 58 });
  doc.font("DMMono").fontSize(15).fillColor("#7665ff");
  doc.text("CAMPUSCODE  \u00b7  REBUILD '26", 0, 132, { align: "center" });
  doc.font("InterBlack").fontSize(38).fillColor("#111111");
  doc.text(d.title, 0, 168, { align: "center" });
  doc.font("InterBold").fontSize(12).fillColor("#777770");
  doc.text("This certificate is proudly presented to", 0, 222, { align: "center" });
  doc.font("SerifBold").fontSize(42).fillColor("#111111");
  doc.text(d.holderName, 0, 248, { align: "center" });
  // Gradient rule centred under the name.
  const strip = doc.linearGradient(cx - 80, 0, cx + 80, 0);
  strip.stop(0, "#7566ff").stop(0.5, "#ec4899").stop(1, "#8bcf19");
  doc.fillColor(strip).rect(cx - 80, 306, 160, 3).fill();
  // Description (wraps to two lines).
  doc.font("Inter").fontSize(12.5).fillColor("#444444");
  doc.text(
    `for successfully participating in ${d.hackathonTitle}, organised by CampusCode on ${d.eventDate}.`,
    cx - 260, 326, { width: 520, align: "center" }
  );
  // Rounds line.
  doc.font("Inter").fontSize(11).fillColor("#777770");
  doc.text("Round 1  \u00b7  Recreated the CampusCode platform        Round 2  \u00b7  Built a complete new UI", 0, 372, { align: "center" });
  // EVENT / DATE / MODE strip.
  const cols = [
    { label: "EVENT", value: "ReBuild '26" },
    { label: "DATE", value: d.eventDate },
    { label: "MODE", value: "Online" },
  ];
  cols.forEach((c, i) => {
    const ccx = cx + (i - 1) * 150;
    doc.font("DMMono").fontSize(8.5).fillColor("#9686e6");
    doc.text(c.label, ccx - 75, 392, { width: 150, align: "center" });
    doc.font("InterBold").fontSize(13).fillColor("#444444");
    doc.text(c.value, ccx - 75, 408, { width: 150, align: "center" });
  });
  doc.strokeColor("#d2d2d2").lineWidth(1);
  doc.moveTo(cx - 75, 396).lineTo(cx - 75, 420).stroke();
  doc.moveTo(cx + 75, 396).lineTo(cx + 75, 420).stroke();
  // Issued block, bottom-left (plain text, no line, no signature).
  const issued = d.issuedAt ? formatCertDate(d.issuedAt) : "10 November 2026";
  doc.font("InterBold").fontSize(12).fillColor("#444444");
  doc.text(`Issued on ${issued}`, 244 - 150, 458, { width: 300, align: "center" });
  doc.font("Inter").fontSize(10).fillColor("#777770");
  doc.text("Issued by CampusCode", 244 - 150, 476, { width: 300, align: "center" });
  // QR bottom-right with caption below.
  const qx = W - 211;
  const qy = 407;
  const qs = 80;
  doc.save();
  doc.fillColor("#ffffff");
  doc.roundedRect(qx - 6, qy - 6, qs + 12, qs + 12, 6).fill();
  doc.restore();
  doc.image(qr, qx, qy, { width: qs, height: qs });
  doc.font("InterBold").fontSize(10).fillColor("#444444");
  doc.text("Scan to verify", qx - 6, qy + qs + 10, { width: qs + 12, align: "center" });
  doc.font("DMMono").fontSize(9).fillColor("#777770");
  doc.text(d.code, qx - 6, qy + qs + 26, { width: qs + 12, align: "center" });
  drawFooter(doc, W, H, d.code, "#777770");
}


/* ---------------- v6.46 — partner logo strip (Adaption)
   Centered white pill: "IN PARTNERSHIP WITH" + Adaption wordmark.
   Drawn AFTER the theme drawer so it sits on top of every theme.
   yTop = top edge of the pill. */
function drawPartnerStrip(doc, W, H, yTop) {
  const cx = W / 2;
  const label = "IN PARTNERSHIP WITH";
  doc.font("DMMono").fontSize(8).fillColor("#777770");
  const labelW = doc.widthOfString(label);
  const logoH = 24;
  const logoW = (logoH * 571) / 138;
  const gap = 8;
  const pad = 10;
  const pillW = pad + labelW + gap + logoW + pad;
  const pillH = 36;
  const x = cx - pillW / 2;
  doc.fillColor("#ffffff");
  doc.roundedRect(x, yTop, pillW, pillH, 15).fill();
  doc.strokeColor("#e8e8e0").lineWidth(0.75);
  doc.roundedRect(x, yTop, pillW, pillH, 15).stroke();
  doc.font("DMMono").fontSize(8).fillColor("#777770");
  doc.text(label, x + pad, yTop + 13);
  doc.image(PARTNER_LOGO, x + pad + labelW + gap, yTop + 6, { width: logoW, height: logoH });
}



/* ---------------- v6.47 — diagonal hairline texture (LC + Minimal)
   Full-page "/" hairlines in a near-background tone: fills the empty
   background like certificate security paper, without crossing text
   the way the big slash watermark did. Drawn right after the bg fill. */
function drawDotGrid(doc, W, H, color) {
  doc.save();
  doc.fillColor(color);
  for (let x = 14; x <= W; x += 28) {
    for (let y = 14; y <= H; y += 28) {
      doc.circle(x, y, 1.3).fill();
    }
  }
  doc.restore();
}

function drawDiagonalTexture(doc, W, H, color) {
  doc.save();
  doc.strokeColor(color).lineWidth(0.5);
  for (let x = -H; x <= W; x += 26) {
    doc.moveTo(x, H).lineTo(x + H, 0).stroke();
  }
  doc.restore();
}

/**
 * Render one certificate PDF.
 * cert: { holderName, college, hackathonTitle, teamName, track,
 *         eventDate (already formatted), code, type, place, theme,
 *         partnerLogo (boolean) }
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
  /* v6.46: partner strip on top of every theme except blueprint,
     whose bottom black band + centered signature leave no room. */
  if (cert.partnerLogo && theme !== "blueprint") {
    drawPartnerStrip(doc, W, H, theme === "classic-ivory" ? H - 110 : H - 72);
  }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
