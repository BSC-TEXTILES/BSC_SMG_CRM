import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API, Auth, UserSession } from '../services/api';
import {
  BarChart3,
  Users,
  Target,
  FileText,
  PartyPopper,
  LogOut,
  ClipboardList,
  Settings,
  DoorOpen,
  UserCheck,
  Briefcase,
  ChevronRight,
  Sparkles,
  Megaphone,
  CheckSquare,
  Menu,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { 
  getSidebarCollapsed, 
  setSidebarCollapsed, 
  subscribeSidebarCollapsed 
} from '../utils/sidebarState';
import { getDashboardLabelForRole } from '../utils/dashboardRouting';

interface SidebarProps {
  session: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ session, isOpen, onClose }: SidebarProps) {
  const pathname = useLocation().pathname;
  const role = session?.role || 'HR';
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const navScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => {
      setCollapsed(c);
    });
    return unsub;
  }, []);

  // ── Escape key closes mobile sidebar ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ── Body scroll lock when mobile sidebar is open ────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('sidebar-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('sidebar-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('sidebar-open');
    };
  }, [isOpen]);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCollapsed(next);
  };

  // Auto-scroll the active nav item to the top of the sidebar
  useEffect(() => {
    if (!navScrollRef.current) return;
    const container = navScrollRef.current;
    // Small delay to ensure the DOM has updated after navigation
    const timer = setTimeout(() => {
      const activeLink = container.querySelector('[data-active="true"]');
      if (activeLink) {
        const containerRect = container.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const offset = linkRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: Math.max(0, offset - 8), behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  const roleNavMap: Record<string, string[]> = {
    'Super Admin': ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'feedback_public', 'tv', 'greeter', 'broadcast', 'user_management', 'settings', 'system_admin'],
    'Admin':       ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'feedback_public', 'tv', 'greeter', 'broadcast', 'user_management', 'settings', 'system_admin'],
    'HR':          ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'user_management'],
    'Recruiter':   ['wedding_crm', 'wedding_registration', 'dashboard', 'candidates', 'broadcast'],
    'Interviewer': ['candidates'],
    'Manager':     ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'pm_view', 'vm_checklist', 'attendance', 'dashboard', 'candidates', 'offer', 'openings', 'daily_mcheck', 'mcheck_reports', 'mcheck_history', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'user_management'],
    'Employee':    ['wedding_crm', 'wedding_registration', 'dashboard'],
    'Guest':       ['wedding_registration'],
    'Greeter':     ['wedding_crm', 'wedding_registration', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'vm_checklist', 'feedback_public', 'tv', 'greeter']
  };

  const [allowed, setAllowed] = useState<string[]>(roleNavMap[role] || roleNavMap['HR']);

  const roleLabels: Record<string, string> = {
    'Super Admin': 'Super Administrator',
    'Admin':       'Administrator',
    'HR':          'HR Specialist',
    'Recruiter':   'Recruiter',
    'Interviewer': 'Interviewer Panel',
    'Manager':     'Store Manager',
    'Employee':    'Employee',
    'Guest':       'Guest',
    'Greeter':     'Greeter Desk'
  };

  const navItems = [
    { key: 'wedding_crm', href: '/wedding-crm', label: 'Wedding CRM', icon: Sparkles, section: 'Store Operations', isNew: true },
    { key: 'footfall', href: '/footfall', label: 'Hourly Footfall', icon: BarChart3, section: 'Store Operations' },
    { key: 'feedback_collection', href: '/feedback-collection', label: 'Feedback Collection', icon: FileText, section: 'Store Operations' },
    { key: 'feedback_list', href: '/feedback-list', label: 'Feedback Call Queue', icon: FileText, section: 'Store Operations' },
    { key: 'feedback_qr', href: '/feedback-qr', label: 'Feedback QR Code', icon: ClipboardList, section: 'Store Operations' },
    { key: 'divert', href: '/divert', label: 'Sourcing Diverts', icon: Target, section: 'Store Operations' },
    { key: 'pm_view', href: '/pm-view', label: 'Purchase Manager View', icon: Briefcase, section: 'Store Operations' },
    { key: 'vm_checklist', href: '/vm-checklist', label: 'VM Checklist', icon: ClipboardList, section: 'Store Operations' },
    { key: 'attendance', href: '/attendance', label: 'Attendance & Roster', icon: UserCheck, section: 'Store Operations' },
    { key: 'dashboard', href: '/dashboard', label: getDashboardLabelForRole(role), icon: BarChart3, section: 'Core Workspace' },
    { key: 'candidates', href: '/candidates', label: 'Candidate CRM', icon: Users, section: 'Core Workspace' },
    { key: 'offer', href: '/offer-process', label: 'Offer Desk', icon: FileText, section: 'Core Workspace' },
    { key: 'openings', href: '/openings', label: 'Manpower Planning', icon: Briefcase, section: 'Core Workspace' },
    { key: 'daily_mcheck', href: '/daily-mcheck', label: 'Daily MCheck', icon: CheckSquare, section: 'Daily Operations' },
    { key: 'mcheck_reports', href: '/mcheck-reports', label: 'MCheck Reports', icon: BarChart3, section: 'Daily Operations' },
    { key: 'mcheck_history', href: '/mcheck-history', label: 'MCheck History', icon: ClipboardList, section: 'Daily Operations' },
    { key: 'employees', href: '/employees', label: 'Employee Directory', icon: UserCheck, section: 'Talent Management' },
    { key: 'dept_hiring', href: '/department-hiring', label: 'Department Hiring Status', icon: Briefcase, section: 'Talent Management' },
    { key: 'section_allocation', href: '/section-allocation', label: 'Section Allocation', icon: UserCheck, section: 'Talent Management' },
    { key: 'wedding_registration', href: '/wedding-registration', label: 'Applicant Registration', icon: Sparkles, section: 'Public Portals' },
    { key: 'feedback_public', href: '/feedback-public', label: 'Customer Feedback QR', icon: ClipboardList, section: 'Public Portals' },
    { key: 'tv', href: '/tv', label: 'Live TV Kiosk', icon: BarChart3, section: 'Public Portals' },
    { key: 'greeter', href: '/greeter', label: 'Greeter Kiosk', icon: UserCheck, section: 'Public Portals' },
    { key: 'broadcast', href: '/broadcast-center', label: 'Broadcast Center', icon: Megaphone, section: 'Administration' },
    { key: 'user_management', href: '/user-management', label: 'User Management', icon: Shield, section: 'Administration' },
    { key: 'settings', href: '/settings', label: 'System Settings', icon: Settings, section: 'Administration' },
    { key: 'system_admin', href: '/system-admin', label: 'System Administrator', icon: ShieldAlert, section: 'Administration' }
  ];

  useEffect(() => {
    // 1. Check user-specific permissions first
    API.getMyPermissions().then(myPerms => {
      if (myPerms && myPerms.custom && Array.isArray(myPerms.modules) && myPerms.modules.length > 0) {
        setAllowed(myPerms.modules);
        return;
      }

      // 2. Fall back to role-based page visibility settings
      API.getPageSettings().then(res => {
        const settingsObj = (res && res.settings) ? res.settings : (res || {});
        const defaultAllowed = roleNavMap[role] || roleNavMap['HR'];
        
        if (settingsObj && Object.keys(settingsObj).length > 0) {
          const allKeys = navItems.map(item => item.key);
          
          const newAllowed = allKeys.filter(key => {
            const dbKey = `${role}_${key}`;
            if (settingsObj[dbKey] !== undefined) {
              return settingsObj[dbKey] === true;
            }
            return defaultAllowed.includes(key);
          });
          
          setAllowed(newAllowed);
        } else {
          setAllowed(defaultAllowed);
        }
      }).catch(() => {
        setAllowed(roleNavMap[role] || roleNavMap['HR']);
      });
    }).catch(() => {
      // Graceful fallback
      const defaultAllowed = roleNavMap[role] || roleNavMap['HR'];
      setAllowed(defaultAllowed);
    });
  }, [role]);

  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-primary/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label="Main navigation"
        style={{ width: collapsed ? '72px' : '256px' }}
        className={`
          fixed top-0 left-0 bottom-0 bg-primary text-white z-50 flex flex-col transition-all duration-300 shadow-2xl border-r border-accent/25 overscroll-contain
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-[72px]' : 'w-64'}
        `}
      >
        {/* Header: Collapsed shows ONLY 3-lines + logo; Expanded shows Logo + Text + 3-line Toggle */}
        {collapsed ? (
          <div className="p-3 border-b border-accent/15 flex flex-col items-center justify-center min-h-[64px] gap-2.5">
            {/* 3-line hamburger button prominently displayed at top */}
            <button
              type="button"
              onClick={handleToggle}
              className="p-1.5 rounded-xl text-accent hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer shadow-xs border border-accent/30"
              title="Expand navigation menu (3 lines)"
              aria-label="Expand sidebar"
            >
              <Menu className="w-5 h-5 text-accent" />
            </button>
            {/* ONLY LOGO */}
            <img 
              src="/logo.png" 
              alt="BSC Logo" 
              className="w-9 h-9 object-contain rounded-xl bg-white p-1 shadow-md border border-accent/40 hover:scale-105 transition-transform cursor-pointer"
              onClick={handleToggle}
              title="BSC Logo - Click to expand navigation"
            />
          </div>
        ) : (
          <div className="p-3.5 border-b border-accent/15 flex items-center justify-between min-h-[64px] w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <img 
                src="/logo.png" 
                alt="BSC Logo" 
                className="w-10 h-10 object-contain rounded-xl bg-white p-1 shadow-md border border-accent/30 flex-shrink-0" 
              />
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-background tracking-wide leading-tight truncate">BSC EXCLUSIVE</div>
                <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1 truncate text-accent">
                  {session?.isGlobalAdmin ? (
                    <span className="text-[#27805B] font-extrabold truncate">🌐 ALL LOCATIONS</span>
                  ) : (
                    <span className="truncate">📍 {session?.locationName?.toUpperCase() || 'DAVANAGERE'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 3-line menu toggle button */}
            <button
              type="button"
              onClick={handleToggle}
              className="p-1.5 rounded-xl text-accent hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer border border-accent/30 shadow-xs"
              title="Collapse sidebar to logo only (3 lines)"
              aria-label="Toggle sidebar collapse"
            >
              <Menu className="w-5 h-5 text-accent" />
            </button>
          </div>
        )}

        {/* User Card */}
        <div className={`mx-2 my-2 rounded-xl bg-black/20 border border-accent/25 flex items-center shadow-inner transition-all ${
          collapsed ? 'p-1 justify-center' : 'p-2.5 gap-2.5'
        }`}>
          <div 
            className="w-8 h-8 rounded-lg bg-accent text-primary font-black flex items-center justify-center text-xs shadow-md border border-accent flex-shrink-0"
            title={`${session?.fullName || 'User'} (${role})`}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <div className="font-bold text-xs text-background truncate">{session?.fullName || 'HR Manager'}</div>
              <div className="text-[10px] text-accent font-semibold truncate">{roleLabels[role] || role}</div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div ref={navScrollRef} className="flex-1 overflow-y-auto px-2 py-1.5 space-y-3">
          {['Store Operations', 'Core Workspace', 'Daily Operations', 'Talent Management', 'Public Portals', 'Administration'].map(section => {
            const items = navItems.filter(item => item.section === section && (allowed.includes(item.key) || ['Super Admin', 'Admin', 'HR', 'Manager'].includes(role)));
            if (items.length === 0) return null;

            return (
              <div key={section} className="space-y-0.5">
                {collapsed ? (
                  <div className="h-px bg-accent/20 my-1.5 mx-1" />
                ) : (
                  <div className="text-[9px] font-black uppercase tracking-widest text-accent/60 px-2.5 mb-1">
                    <span>{section}</span>
                  </div>
                )}

                <div className="space-y-1">
                  {items.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.key}
                        to={item.href}
                        target={(item as any).target}
                        onClick={onClose}
                        title={item.label}
                        data-active={isActive ? 'true' : undefined}
                        className={`
                          flex items-center rounded-xl text-xs font-bold transition-all duration-150 group relative
                          ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 justify-between'}
                          ${isActive 
                            ? 'bg-accent text-primary shadow-lg shadow-accent/25 font-black border-l-4 border-primary' 
                            : 'text-background/85 hover:bg-primary-hover hover:text-white'}
                        `}
                      >
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                          <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 flex-shrink-0 ${
                            isActive ? 'text-primary' : item.key === 'wedding_crm' ? 'text-accent animate-pulse' : 'text-accent/80 group-hover:text-accent'
                          }`} />
                          
                          {!collapsed && (
                            <span className="truncate">
                              {item.label}
                            </span>
                          )}

                          {!collapsed && item.key === 'wedding_crm' && (
                            <span className="text-[8px] bg-accent text-primary font-black px-1.5 py-[2px] rounded-full uppercase ml-1 flex-shrink-0">
                              NEW
                            </span>
                          )}
                        </div>

                        {!collapsed && isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-primary opacity-80 flex-shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Logout */}
        <div className={`border-t border-accent/15 bg-primary/80 transition-all ${collapsed ? 'p-2' : 'p-3'}`}>
          <button
            onClick={() => Auth.logout()}
            title="Sign Out Session"
            className={`w-full flex items-center justify-center rounded-xl text-xs font-bold bg-[#C43D4B]/15 text-background border border-[#C43D4B]/40 hover:bg-[#C43D4B] hover:text-white transition-all shadow-sm ${
              collapsed ? 'py-2.5 px-0' : 'py-2.5 px-3 gap-2'
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
          {!collapsed && (
            <div className="text-[8.5px] text-background/40 text-center mt-2 font-medium">
              BSC Wedding CRM · Enterprise ATS v2.6
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
