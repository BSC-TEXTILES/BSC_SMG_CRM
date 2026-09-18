import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { API, Auth } from '../services/api';
import { getDashboardRouteForRole } from '../utils/dashboardRouting';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { Loader2 } from 'lucide-react';

/**
 * Frontend RBAC Route Guard (UX layer).
 *
 * The backend independently enforces authorization on every API call — this
 * guard only prevents a user from OPENING a page their role is not assigned
 * to (defense against URL tampering / sidebar-less navigation), and redirects
 * unauthenticated visitors to login.
 *
 * Resolution chain mirrors the Sidebar exactly:
 *   session → role map → user_permissions override → page_visibility DB →
 *   allow / redirect to the role's own dashboard.
 */
export default function RouteGuard({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const location = useLocation();
  const [resolution, setResolution] = useState<'checking' | 'allowed' | 'denied' | 'anonymous'>('checking');

  useEffect(() => {
    const session = Auth.get();
    if (!Auth.check() || !session) {
      setResolution('anonymous');
      return;
    }

    const role = session.role || '';
    const roleKeys = getRoleNavMap(role);

    // Role map is the immediate baseline (no flash of blocked content)
    if (!roleKeys.includes(pageKey)) {
      setResolution('denied');
      return;
    }

    let cancelled = false;
    // DB-backed narrowing (page_visibility + user-specific permissions)
    Promise.all([
      API.getMyPermissions().catch(() => null),
      API.getPageSettings().catch(() => null)
    ]).then(([myPerms, pageSettingsRes]) => {
      if (cancelled) return;
      const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
      const settingsObj = pageSettingsRes && pageSettingsRes.settings ? pageSettingsRes.settings : (pageSettingsRes || null);
      const allowed = resolveAllowedPages(role, settingsObj, userModules);
      setResolution(allowed.includes(pageKey) ? 'allowed' : 'denied');
    });

    return () => { cancelled = true; };
  }, [pageKey, location.pathname]);

  if (resolution === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-xs font-bold text-primary">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          Verifying access…
        </div>
      </div>
    );
  }

  if (resolution === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (resolution === 'denied') {
    // Never show another role's page — bounce to THIS role's own dashboard
    return <Navigate to={getDashboardRouteForRole(Auth.get()?.role)} replace />;
  }

  return <>{children}</>;
}
