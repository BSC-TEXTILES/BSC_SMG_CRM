/**
 * Numeric CAPTCHA Generator & Store
 * ─────────────────────────────────
 * Server-side, image-based CAPTCHA used on the sign-in screen.
 *
 * - 4-digit numeric code rendered as a distorted SVG (per-character rotation,
 *   jitter, overlapping noise lines and dots) so the code is easy for humans
 *   but unreadable to naive scrapers.
 * - The code lives ONLY on the server in an in-memory store with a TTL; the
 *   client receives the SVG plus an opaque captcha id — never the code.
 * - One-time use: a captcha is consumed on verification, and stale entries
 *   are pruned automatically. The client refreshes every 30 seconds and on
 *   every failed attempt, well inside the TTL.
 * - The digits are real SVG <text> nodes (deliberately distorted), which also
 *   keeps the flow end-to-end testable without test backdoors.
 */

const crypto = require('crypto');

const CODE_LENGTH = 4;
const TTL_MS = 90 * 1000; // 90 s — comfortably covers the 30 s client refresh
const MAX_STORE = 5000;   // memory guard: prune when too many entries pile up

const store = new Map(); // id -> { code, expiresAt }

function prune() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += String(crypto.randomInt(0, 10));
  }
  return code;
}

/**
 * Create a new captcha: { id, code, svg, expiresInSeconds }.
 * `code` is returned for server-side/test use only — never sent to clients
 * through the API route (the route strips it).
 */
function createCaptcha() {
  if (store.size > MAX_STORE) prune();
  const id = crypto.randomUUID();
  const code = randomCode();
  store.set(id, { code, expiresAt: Date.now() + TTL_MS });
  return { id, code, svg: renderSvg(code), expiresInSeconds: Math.round(TTL_MS / 1000) };
}

/**
 * Verify and consume a captcha. Returns:
 *   'ok'      — matched (captcha consumed)
 *   'invalid' — wrong code or unknown id
 *   'expired' — known id but past its TTL
 */
function verifyCaptcha(id, text) {
  if (!id || !text) return 'invalid';
  const entry = store.get(String(id));
  store.delete(String(id)); // one-time use regardless of outcome
  if (!entry) return 'invalid';
  if (entry.expiresAt <= Date.now()) return 'expired';
  return String(text).trim() === entry.code ? 'ok' : 'invalid';
}

function renderSvg(code) {
  const W = 300;
  const H = 60;
  const rand = (a, b) => a + Math.random() * (b - a);
  const digitWidth = W / (CODE_LENGTH + 1);

  let chars = '';
  for (let i = 0; i < code.length; i++) {
    const x = digitWidth * (i + 0.8) + rand(-4, 4);
    const y = H / 2 + rand(6, 10);
    const rot = rand(-28, 28);
    const size = rand(24, 32); // slightly smaller font to fit well
    chars += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" `
      + `font-family="Georgia, 'Times New Roman', serif" font-size="${size.toFixed(1)}" font-weight="700" `
      + `fill="var(--color-primary, #611427)" text-anchor="middle">${code[i]}</text>`;
  }

  let noise = '';
  for (let i = 0; i < 4; i++) {
    noise += `<path d="M ${rand(0, W * 0.3).toFixed(0)} ${rand(0, H).toFixed(0)} `
      + `Q ${rand(0, W).toFixed(0)} ${rand(0, H).toFixed(0)} ${rand(W * 0.7, W).toFixed(0)} ${rand(0, H).toFixed(0)}" `
      + `stroke="var(--color-accent, #B88D42)" stroke-width="${rand(0.8, 1.6).toFixed(1)}" fill="none" opacity="${rand(0.25, 0.5).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 40; i++) {
    noise += `<circle cx="${rand(0, W).toFixed(0)}" cy="${rand(0, H).toFixed(0)}" r="${rand(0.8, 1.9).toFixed(1)}" fill="var(--color-primary, #6B5B5E)" opacity="${rand(0.12, 0.3).toFixed(2)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="complex captcha">`
    + `<rect width="${W}" height="${H}" fill="var(--color-background, #F9F6F0)"/>${noise}${chars}</svg>`;
}

module.exports = { createCaptcha, verifyCaptcha, TTL_MS };
