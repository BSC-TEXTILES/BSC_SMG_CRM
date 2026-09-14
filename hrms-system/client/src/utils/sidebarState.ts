/**
 * Sidebar Collapse State Manager
 * Handles desktop 3-line hamburger collapse state with localStorage persistence
 * and custom event broadcasting so pages and layout smoothly adjust margins.
 */

const STORAGE_KEY = 'bsc_sidebar_collapsed';
const EVENT_NAME = 'bsc_sidebar_collapse';

export const getSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
};

export const setSidebarCollapsed = (collapsed: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(collapsed));
  if (typeof document !== 'undefined' && document.body) {
    if (collapsed) {
      document.body.setAttribute('data-sidebar-collapsed', 'true');
    } else {
      document.body.removeAttribute('data-sidebar-collapsed');
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { collapsed } }));
};

// Initialize attribute on body immediately
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (getSidebarCollapsed() && document.body) {
    document.body.setAttribute('data-sidebar-collapsed', 'true');
  }
}

export const toggleSidebarCollapsed = (): boolean => {
  const current = getSidebarCollapsed();
  const next = !current;
  setSidebarCollapsed(next);
  return next;
};

export const subscribeSidebarCollapsed = (callback: (collapsed: boolean) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ collapsed: boolean }>;
    callback(customEvent.detail.collapsed);
  };

  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
