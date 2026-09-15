import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, XOctagon } from 'lucide-react';
import { Auth } from '../services/api';
import { NotificationService } from '../services/notificationService';

/**
 * DevToolsGuard
 * ─────────────
 * Multi-layer Developer Tools Detection and Security Shield.
 *
 * Capabilities:
 *   1. Viewport Delta — Detects docked DevTools (Chrome, Edge, Firefox, Safari)
 *      when outer/inner window dimensions differ by >= 160px.
 *   2. Debugger Execution Timing — Detects undocked DevTools, attached debuggers
 *      (such as VS Code JS debugging, Chrome remote debugging, mobile remote inspection)
 *      via execution latency caused by attached debugger engines.
 *   3. Console Serialization Probes — Detects open developer consoles via RegExp
 *      and DOM property lazy-evaluation probes.
 *   4. Mobile Injected Debuggers — Detects mobile inspection tools like Eruda & vConsole.
 *   5. DevTools Shortcut Interception — Intercepts F12, Ctrl+Shift+I/J/C, Cmd+Option+I/J/C
 *      and triggers immediate protection.
 *   6. Context Menu Protection — Disables inspect element via right click when armed.
 *
 * Controls:
 *   - Controlled strictly by the Admin Dashboard Toggle (stored in backend database).
 *   - Live push via Socket.IO + 15-second polling fallback.
 *   - Real-time audit logging of DEVTOOLS_DETECTED & DEVTOOLS_CLOSED to server.
 */

const SIZE_THRESHOLD = 160;     // px — docked panel minimum dimension
const POLL_INTERVAL = 500;       // ms between active checks
const REPORT_COOLDOWN = 30_000;  // ms — throttle server audit reports

/** Coarse device hint for audit logging */
function deviceClass(): 'mobile' | 'tablet' | 'desktop' {
  try {
    const ua = navigator.userAgent || '';
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const w = window.innerWidth || 0;
    if (coarse && w > 0 && w < 480) return 'mobile';
    if (coarse && w >= 480 && w <= 1024) return 'tablet';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return w <= 1024 ? 'mobile' : 'tablet';
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

function reportEvent(event: 'DEVTOOLS_DETECTED' | 'DEVTOOLS_CLOSED') {
  try {
    const session = Auth.get();
    fetch('/api/security/log-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: session?.token ? `Bearer ${session.token}` : '',
        'x-auth-token': session?.token || ''
      },
      body: JSON.stringify({
        event,
        details: {
          page: window.location.pathname,
          device: deviceClass(),
          timestamp: new Date().toISOString()
        }
      })
    }).catch(() => {});
  } catch {
    /* logging must never crash the app */
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
  const [armed, setArmed] = useState<boolean>(() => readCachedFlag());

  const reportedRef = useRef(0);
  const detectedRef = useRef(false);

  // Synchronize shield state from server (on mount, interval, and Socket.IO push)
  useEffect(() => {
    let disposed = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/security/shield-status');
        const json = await res.json();
        const enabled = json && json.enabled === true;
        try {
          localStorage.setItem(SHIELD_FLAG_KEY, enabled ? 'true' : 'false');
        } catch { /* private mode safe */ }
        if (!disposed) {
          setArmed(enabled);
        }
      } catch {
        /* offline fallback */
      }
    };

    fetchStatus();
    const intervalId = window.setInterval(fetchStatus, 15_000);

    // Live Socket.IO push notification when an Admin flips the toggle
    const unsubscribe = NotificationService.onShieldChanged((enabled) => {
      if (!disposed) {
        setArmed(enabled);
        try {
          localStorage.setItem(SHIELD_FLAG_KEY, enabled ? 'true' : 'false');
        } catch {}
      }
    });

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  // When shield is disabled by Admin, immediately clear lock overlay
  useEffect(() => {
    if (!armed) {
      if (detectedRef.current) {
        detectedRef.current = false;
        setDetected(false);
      }
    }
  }, [armed]);

  // Detection Engine
  useEffect(() => {
    if (!armed) return;

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

    // ── Check 1: Docked DevTools viewport dimension difference ──
    const checkDocked = (): boolean => {
      if (typeof window === 'undefined') return false;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      // Normal browser chrome (title bar, scrollbars) is < 80px.
      // Any docked developer panel takes at least 160px.
      return widthDiff > SIZE_THRESHOLD || heightDiff > SIZE_THRESHOLD;
    };

    // ── Check 2: Debugger execution timing (undocked DevTools, attached debuggers) ──
    const checkDebuggerTiming = (): boolean => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      (function() { debugger; })();
      const elapsed = performance.now() - start;
      // When devtools / debugger is open or attached, execution pauses or delays > 50ms
      return elapsed > 50;
    };

    // ── Check 3: Console Object / RegExp toString probe ──
    let consoleProbeTriggered = false;
    const probeRegExp = /./;
    probeRegExp.toString = function() {
      consoleProbeTriggered = true;
      return 'bsc-devtools-probe';
    };

    const checkConsole = (): boolean => {
      consoleProbeTriggered = false;
      // Modern devtools console evaluates arguments when rendered
      console.log('%c', probeRegExp);
      console.clear();
      return consoleProbeTriggered;
    };

    // ── Check 4: Mobile in-page debuggers (Eruda, vConsole) ──
    const checkMobileDebuggers = (): boolean => {
      const anyWin = window as any;
      if (anyWin.eruda || anyWin.__eruda || anyWin.vConsole || anyWin.__vconsole) {
        return true;
      }
      if (document.getElementById('eruda') || document.getElementById('__vconsole')) {
        return true;
      }
      return false;
    };

    // Master check routine
    const runCheck = () => {
      if (disposed) return;
      try {
        const isDocked = checkDocked();
        const isMobileTool = checkMobileDebuggers();
        const isConsoleOpen = checkConsole();
        const isDebuggerAttached = checkDebuggerTiming();

        if (isDocked || isMobileTool || isConsoleOpen || isDebuggerAttached) {
          trigger();
        } else {
          clearIfQuiet();
        }
      } catch {
        /* never crash check loop */
      }
    };

    // Immediate initial check
    runCheck();

    // Polling interval
    const timer = window.setInterval(runCheck, POLL_INTERVAL);

    // Event hooks for instant detection
    const handleResize = () => runCheck();
    const handleFocus = () => runCheck();

    // Keyboard shortcut prevention and trigger
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        trigger();
        return;
      }
      // Ctrl+Shift+I / J / C or Cmd+Option+I / J / C
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'i' || k === 'j' || k === 'c') {
          e.preventDefault();
          e.stopPropagation();
          trigger();
          return;
        }
      }
      // Ctrl+U / Cmd+U (View Source)
      if (isCtrlOrCmd && (e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        trigger();
        return;
      }
    };

    // Context menu prevention (prevent right-click Inspect)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [armed]);

  if (!detected) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="devtools-guard-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-primary/95 backdrop-blur-2xl px-4 animate-fade-in select-none"
    >
      <div className="max-w-md w-full text-center p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-md">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-[#C43D4B]/15 border border-[#C43D4B]/40 flex items-center justify-center mb-6 shadow-2xl">
          <XOctagon className="w-10 h-10 text-[#E8828D]" strokeWidth={1.75} />
        </div>
        <h2
          id="devtools-guard-title"
          className="text-2xl font-black text-white tracking-tight mb-3"
        >
          Developer Tools Detected
        </h2>
        <p className="text-[#D7E3EE] leading-relaxed mb-2 font-medium text-sm">
          For the security of customer and business data, this application is
          locked while developer tools or debuggers are open.
        </p>
        <p className="text-accent font-bold text-sm mb-6">
          Please close Developer Tools to continue using the application.
        </p>
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[#8FA9C0] text-xs font-semibold uppercase tracking-widest">
          <ShieldAlert className="w-4 h-4 text-accent" />
          <span>BSC Security Shield</span>
        </div>
      </div>
    </div>
  );
}
