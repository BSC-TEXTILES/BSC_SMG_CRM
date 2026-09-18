/**
 * Shared RBAC page-permission resolution (single source of truth).
 *
 * Used by BOTH the Sidebar (what to render) and the RouteGuard (which URLs a
 * role may open). This is the UX layer only — the backend independently
 * enforces the same boundaries on every API call, so tampering with frontend
 * state cannot expose data.
 */

export interface SessionLike {
  role?: string;
  locationId?: number | null;
  isGlobalAdmin?: boolean;
  fullName?: string;
}

// Role → allowed page keys. Mirrors the page_visibility defaults seeded in the
// backend; the DB (page_visibility / user_permissions) can narrow these but a
// key absent for a role here is hidden for that role.
export const ROLE_NAV_MAP: Record<string, string[]> = {
  'Super Admin': ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'feedback_public', 'tv', 'greeter', 'broadcast', 'user_management', 'settings', 'system_admin', 'admin_approvals'],
  'Admin':       ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'feedback_public', 'tv', 'greeter', 'broadcast', 'user_management', 'settings', 'system_admin', 'admin_approvals'],
  'HR':          ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'user_management', 'admin_approvals'],
  'Recruiter':   ['wedding_crm', 'wedding_registration', 'dashboard', 'candidates', 'broadcast'],
  'Interviewer': ['candidates'],
  'Manager':     ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'user_management'],
  'Employee':    ['wedding_crm', 'wedding_registration', 'dashboard'],
  'Guest':       ['wedding_registration'],
  'Greeter':     ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'vm_checklist', 'feedback_public', 'tv', 'greeter']
};

export function getRoleNavMap(role?: string): string[] {
  const r = (role || '').trim();
  return ROLE_NAV_MAP[r] || ROLE_NAV_MAP['Employee'] || [];
}

/**
 * Resolve the effective page keys for a role, narrowed by the database-backed
 * page visibility settings (`${role}_${key}` → boolean) and/or user-specific
 * permissions. `dbSettings` values of `false` always win (deny); unset keys
 * fall back to the role map.
 */
export function resolveAllowedPages(
  role: string | undefined,
  dbSettings: Record<string, boolean> | null | undefined,
  userModules?: string[] | null
): string[] {
  const roleKeys = getRoleNavMap(role);
  const r = (role || '').trim();

  // User-specific permission overrides (exact module list)
  if (userModules && Array.isArray(userModules) && userModules.length > 0) {
    return userModules.filter(k => roleKeys.includes(k));
  }

  if (dbSettings && Object.keys(dbSettings).length > 0) {
    return roleKeys.filter(key => {
      const dbKey = `${r}_${key}`;
      if (dbSettings[dbKey] !== undefined) return dbSettings[dbKey] === true;
      return true; // not explicitly configured → role-map default applies
    });
  }

  return roleKeys;
}
