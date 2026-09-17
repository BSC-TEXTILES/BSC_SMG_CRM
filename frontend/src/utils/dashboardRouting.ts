/**
 * Dashboard Routing & Role Resolution Utility
 * Maps authenticated user roles to the three authorized dashboards:
 * 1. Admin Dashboard (Super Admin, Admin)
 * 2. HR Dashboard (HR, Recruiter, Interviewer)
 * 3. Manager Dashboard (Manager, Store Manager, Operations)
 */

export type DashboardType = 'admin' | 'hr' | 'manager';

export function getDashboardTypeForRole(role?: string): DashboardType {
  const r = (role || '').trim().toLowerCase();
  if (r === 'super admin' || r === 'admin') {
    return 'admin';
  }
  if (r === 'hr' || r === 'recruiter' || r === 'interviewer') {
    return 'hr';
  }
  // Store Manager, Manager, and general operations
  return 'manager';
}

export function getDashboardLabelForRole(role?: string): string {
  const type = getDashboardTypeForRole(role);
  switch (type) {
    case 'admin':
      return 'Admin Dashboard';
    case 'hr':
      return 'HR Dashboard';
    case 'manager':
      return 'Manager Dashboard';
  }
}

export function getDashboardRouteForRole(role?: string): string {
  const type = getDashboardTypeForRole(role);
  return `/dashboard?view=${type}`;
}
