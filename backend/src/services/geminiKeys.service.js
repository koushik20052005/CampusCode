/* =========================================================
   GEMINI KEY POOL — rotation + failover

   v6.16 (Oct 25, 2026) — FirstCommit '26 reliability.

   Env:
     GEMINI_API_KEY   — legacy single key (still supported)
     GEMINI_API_KEYS  — comma-separated pool, e.g.
                        key1,key2,key3 (5-10 keys for events)

   Rules:
   - Keys are tried round-robin. A key that returns a
     retryable error (429/5xx) or a network failure goes on
     a 60s cooldown; the next key is tried immediately.
   - Auth errors (400/401/403) are NOT rotated: a bad key
     config must fail loudly, not silently burn the pool.
   - Keys are NEVER logged in full — only their index.

   Important honesty note (Oct 24 discussion): keys in the
   SAME Google project share that project's total quota.
   Rotation saves you from a dead key, not from the quota
   ceiling. Pair with the worker's call pacing + a quota
   increase for flagship events.

   In-memory only: a restart resets cooldowns, which is
   safe (cooldowns are an optimization, not state).
========================================================= */

const COOLDOWN_MS = 60 * 1000;

function loadKeys() {
  const pooled = String(process.env.GEMINI_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const legacy = String(process.env.GEMINI_API_KEY || "").trim();
  const keys = [...pooled];
  if (legacy && !keys.includes(legacy)) keys.push(legacy);
  return keys;
}

let cachedKeys = null;
let cursor = 0;
const cooldownUntil = new Map(); // keyIndex -> epoch ms

function keys() {
  if (!cachedKeys) cachedKeys = loadKeys();
  return cachedKeys;
}

/* Test hook: force a reload after env changes. */
export function reloadGeminiKeys() {
  cachedKeys = null;
  cursor = 0;
  cooldownUntil.clear();
}

export function geminiKeyCount() {
  return keys().length;
}

function isCoolingDown(index) {
  const until = cooldownUntil.get(index);
  return until && Date.now() < until;
}

/* Next usable key index, round-robin, skipping cooldowns.
   Returns null when every key is cooling down. */
export function nextKeyIndex() {
  const list = keys();
  if (list.length === 0) return null;
  for (let step = 0; step < list.length; step += 1) {
    const index = (cursor + step) % list.length;
    if (!isCoolingDown(index)) {
      cursor = (index + 1) % list.length;
      return index;
    }
  }
  return null;
}

export function getKeyByIndex(index) {
  return keys()[index] || null;
}

export function reportKeyFailure(index, status) {
  // Auth/config errors must surface, not rotate away silently.
  if (status === 400 || status === 401 || status === 403) return;
  cooldownUntil.set(index, Date.now() + COOLDOWN_MS);
}

export function reportKeySuccess(index) {
  cooldownUntil.delete(index);
}
