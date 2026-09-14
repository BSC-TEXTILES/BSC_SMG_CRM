import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, XOctagon } from 'lucide-react';
import { Auth } from '../services/api';

/**
 * DevToolsGuard
 * ─────────────
 * Enterprise anti-inspection shield. Detects open browser developer tools
 * on every device (desktop + mobile) using three independent signals, and
 * blocks the application behind a clear "turn off developer tools" screen
 * until every signal is quiet again.
 *
 * Detection signals:
 *   1. Viewport delta  — outer window vs rendered content size differs by
 *      more than the threshold when a docked panel is open (classic method).
 *   2. Debugger pause  — a `debugger` statement costs >100 ms only while a
 *      devtools debugger is attached (catches undocked windows).
 *   3. Element id getter — devtools serializes logged DOM nodes lazily,
 *      which trips a getter on `id` the moment the panel renders it (works
 *      on mobile browsers with remote inspection too).
 *
 * Two independent signals must fire — or one signal fire repeatedly —
 * before the overlay shows, so zoom changes, browser toolbars and slow
 * devices never trigger false positives.
 *
 * Every confirmed detection is reported to the server for the audit trail
 * (POST /api/security/log-event — visible to admins under System Settings).
 *
 * The shield is ADMIN-CONTROLLED and OFF by default: it only arms when an
 * Admin turns it on under System Settings → Security. The flag is fetched
 * from the server on mount and refreshed periodically, so toggling it takes
 * effect on every signed-in device within a minute. localhost/127.0.0.1 is
 * always bypassed so developers can work with devtools during development.
 */

const SIZE_THRESHOLD = 220;      // px — headroom above worst-case browser chrome
const POLL_INTERVAL = 1200;      // ms between checks
const SUSTAINED_STRIKES = 3;     // single-signal must persist this many ticks
const REPORT_COOLDOWN = 60_000;  // ms — max one server report per minute

const isLocalDev = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]');

function reportEvent(event: 'DEVTOOLS_DETECTED' | 'DEVTOOLS_CLOSED') {
  try {
    const session = Auth.get();
    if (!session) return; // only report for authenticated users
    fetch('/api/security/log-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        'x-auth-token': session.token || ''
      },
      body: JSON.stringify({ event, details: { href: window.location.pathname } })
    }).catch(() => {});
  } catch {
    /* logging must never break the app */
  }
}

const SHIELD_FLAG_KEY = 'bsc_shield_enabled';

function readCachedFlag(): boolean {
  try {
    return localStorage.getItem(SHIELD_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function DevToolsGuard() {
  const [detected, setDetected] = useState(false);
  const [armed, setArmed] = useState(() => !isLocalDev() && readCachedFlag());
  const strikesRef = useRef(0);
  const reportedRef = useRef(0);
  const detectedRef = useRef(false);

  // The shield only runs when an Admin has enabled it server-side. The flag
  // is cached for instant boot and re-checked every 60s so a toggle reaches
  // all devices quickly.
  useEffect(() => {
    if (isLocalDev()) return;
    let disposed = false;
    const load = async () => {
      try {
        const res = await fetch('/api/security/shield-status');
        const json = await res.json();
        const enabled = json && json.enabled === true;
        try {
          localStorage.setItem(SHIELD_FLAG_KEY, enabled ? 'true' : 'false');
        } catch { /* private mode */ }
        if (!disposed) setArmed(enabled);
      } catch {
        /* offline: keep last known flag */
      }
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  // If the admin disables the shield while a device is locked, release it.
  useEffect(() => {
    if (!armed) {
      detectedRef.current = false;
      strikesRef.current = 0;
      setDetected(false);
    }
  }, [armed]);

  useEffect(() => {
    if (!armed) return;
    if (isLocalDev()) return; // developer machines keep full devtools access

    let disposed = false;

    const trigger = () => {
      if (detectedRef.current) return;
      detectedRef.current = true;
      setDetected(true);
      const now = Date.now();
      if (now - reportedRef.current > REPORT_COOLDOWN) {
        reportedRef.current = now;
        reportEvent('DEVTOOLS_DETECTED');
      }
    };

    const clearIfQuiet = () => {
      if (!detectedRef.current) return;
      detectedRef.current = false;
      setDetected(false);
      reportEvent('DEVTOOLS_CLOSED');
    };

    // ── Signal 1: viewport delta (docked panels) ──
    const sizeGap = () => {
      const wGap = window.outerWidth - window.innerWidth;
      const hGap = window.outerHeight - window.innerHeight;
      return wGap > SIZE_THRESHOLD || hGap > SIZE_THRESHOLD;
    };

    // ── Signal 2: debugger timing (works for undocked panels) ──
    const debuggerPause = () => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      return performance.now() - start > 100;
    };

    // ── Signal 3: DOM getter probe (fires on mobile remote inspection) ──
    const probe = document.createElement('div');
    let probed = false;
    Object.defineProperty(probe, 'id', {
      get() {
        probed = true;
        return 'bsc-devtools-probe';
      }
    });
    const elementProbe = () => {
      probed = false;
      // Devtools lazily serializes logged objects — the getter fires only
      // when the panel is open and re-renders the log entry. The entry is
      // only ever visible while devtools is open, i.e. while blocked anyway.
      // eslint-disable-next-line no-console
      console.log(probe);
      return probed;
    };

    const tick = () => {
      if (disposed) return;
      try {
        let signals = 0;
        if (sizeGap()) signals++;
        if (elementProbe()) signals++;
        if (debuggerPause()) signals++;

        if (signals >= 2) {
          strikesRef.current = SUSTAINED_STRIKES;
          trigger();
        } else if (signals === 1) {
          strikesRef.current += 1;
          if (strikesRef.current >= SUSTAINED_STRIKES) trigger();
        } else {
          strikesRef.current = 0;
          clearIfQuiet();
        }
      } catch {
        /* never throw from the polling loop */
      }
    };

    const timer = window.setInterval(tick, POLL_INTERVAL);

    // Re-check when the window regains focus — devtools usage often happens
    // in a second monitor while focus returns here.
    window.addEventListener('focus', tick);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [armed]);

  if (!detected) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0E2A44]/95 backdrop-blur-xl px-4 animate-fade-in">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-[#C43D4B]/15 border border-[#C43D4B]/40 flex items-center justify-center mb-6 shadow-2xl">
          <XOctagon className="w-10 h-10 text-[#E8828D]" strokeWidth={1.75} />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight mb-3">
          Developer Tools Detected
        </h2>
        <p className="text-[#D7E3EE] leading-relaxed mb-2 font-medium">
          For the security of customer and business data, this application is
          locked while developer tools are open.
        </p>
        <p className="text-[#4E8ABF] font-bold text-sm mb-8">
          Please turn off Developer Tools to continue.
        </p>
        <div className="flex items-center justify-center gap-2 text-[#8FA9C0] text-xs font-semibold uppercase tracking-widest">
          <ShieldAlert className="w-4 h-4" />
          <span>BSC Security Shield</span>
        </div>
      </div>
    </div>
  );
}
