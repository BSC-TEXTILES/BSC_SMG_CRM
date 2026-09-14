import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * ConnectivityBanner
 * ──────────────────
 * Production resilience: detects a lost internet connection (browser
 * `offline`/`online` events) and shows an animated, non-blocking banner.
 * When the connection returns, a short "back online" confirmation is shown.
 * Operations on the page continue; API failures surface their own toasts.
 */
export default function ConnectivityBanner() {
  const [offline, setOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      setJustBack(false);
    };
    const goOnline = () => {
      setOffline(false);
      setJustBack(true);
      window.setTimeout(() => setJustBack(false), 3500);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline && !justBack) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] flex justify-center pointer-events-none px-3 pt-3">
      {offline ? (
        <div className="pointer-events-auto flex items-center gap-3 bg-[#0E2A44] text-white px-5 py-3 rounded-2xl shadow-2xl border border-red-400/40 animate-slide-down">
          <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
          <div>
            <div className="text-xs font-black tracking-wide">No Internet Connection</div>
            <div className="text-[11px] text-white/70 font-medium">
              You are offline — data will refresh automatically once the connection returns.
            </div>
          </div>
          <span className="flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      ) : (
        <div className="pointer-events-auto flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl animate-slide-down">
          <Wifi className="w-4 h-4" />
          <span className="text-xs font-black tracking-wide">Back online — reloading latest data…</span>
        </div>
      )}
    </div>
  );
}
