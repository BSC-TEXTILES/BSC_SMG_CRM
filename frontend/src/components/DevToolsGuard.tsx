import { useEffect, useState } from 'react';
import { ShieldAlert, XOctagon } from 'lucide-react';
import { Auth } from '../services/api';
import { NotificationService } from '../services/notificationService';
import { DevToolsDetector } from '../services/devToolsDetector';

const SHIELD_FLAG_KEY = 'bsc_shield_enabled';

function readCachedFlag(): boolean {
  try {
    return localStorage.getItem(SHIELD_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function DevToolsGuard() {
  const [armed, setArmed] = useState<boolean>(() => readCachedFlag());
  const [isOpen, setIsOpen] = useState(false);
  const [bypass, setBypass] = useState(false);

  // Sync bypass state from localStorage and custom events
  useEffect(() => {
    const updateBypass = () => {
      try {
        const bp = localStorage.getItem('bsc_shield_bypass') === 'true';
        setBypass(bp);
      } catch {
        setBypass(false);
      }
    };
    updateBypass();
    window.addEventListener('dev_tools_bypass_changed', updateBypass);
    window.addEventListener('storage', updateBypass);
    return () => {
      window.removeEventListener('dev_tools_bypass_changed', updateBypass);
      window.removeEventListener('storage', updateBypass);
    };
  }, []);

  // Synchronize shield armed state from server (on mount, interval, and Socket.IO push)
  useEffect(() => {
    let disposed = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/security/shield-status');
        const json = await res.json();
        const enabled = json && json.enabled === true;
        try {
          localStorage.setItem(SHIELD_FLAG_KEY, enabled ? 'true' : 'false');
        } catch {}
        if (!disposed) {
          setArmed(enabled);
          DevToolsDetector.arm(enabled);
        }
      } catch {
        /* offline fallback */
      }
    };

    fetchStatus();
    const intervalId = window.setInterval(fetchStatus, 15_000);

    const unsubscribe = NotificationService.onShieldChanged((enabled) => {
      if (!disposed) {
        setArmed(enabled);
        DevToolsDetector.arm(enabled);
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

  // Subscribe to live DevToolsDetector state
  useEffect(() => {
    const unsub = DevToolsDetector.subscribe((state) => {
      setIsOpen(state.isOpen);
    });
    return unsub;
  }, []);

  // Arm/disarm detector when armed flag changes
  useEffect(() => {
    DevToolsDetector.arm(armed);
  }, [armed]);

  // If shield is off, or DevTools are closed, or admin has bypassed protection, do not block screen
  const session = Auth.get();
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';
  // Allow Admins to view the Admin Dashboard (/dashboard) and Settings (/settings) without blocking screen
  // so they can monitor telemetry and configure DevTools detection live
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isAdminMonitoringPage = pathname === '/dashboard' || pathname === '/settings';
  const shouldBlock = armed && isOpen && !(isAdmin && (bypass || isAdminMonitoringPage));

  if (!shouldBlock) return null;

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
