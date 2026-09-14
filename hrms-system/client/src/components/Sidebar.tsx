import React, { useEffect, useState } from 'react';
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
  CheckSquare
} from 'lucide-react';

interface SidebarProps {
  session: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ session, isOpen, onClose }: SidebarProps) {
  const pathname = useLocation().pathname;
  const role = session?.role || 'HR';

  const roleNavMap: Record<string, string[]> = {
    'Super Admin': ['dashboard', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'candidates', 'interview', 'offer', 'openings', 'onboarding', 'employees', 'dept_hiring', 'section_allocation', 'exit', 'form', 'settings', 'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
    'Admin':       ['dashboard', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'candidates', 'interview', 'offer', 'openings', 'onboarding', 'employees', 'dept_hiring', 'section_allocation', 'exit', 'form', 'settings', 'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
    'HR':          ['dashboard', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'candidates', 'interview', 'offer', 'openings', 'onboarding', 'employees', 'dept_hiring', 'section_allocation', 'exit', 'form', 'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
    'Recruiter':   ['dashboard', 'candidates', 'interview', 'form', 'broadcast'],
    'Interviewer': ['interview', 'candidates'],
    'Manager':     ['dashboard', 'footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'candidates', 'interview', 'offer', 'openings', 'employees', 'dept_hiring', 'section_allocation', 'broadcast', 'daily_mcheck', 'mcheck_reports', 'mcheck_history'],
    'Employee':    ['dashboard', 'onboarding'],
    'Guest':       ['form'],
    'Greeter':     ['footfall', 'feedback_collection', 'feedback_list', 'feedback_qr', 'divert', 'vm_checklist', 'feedback_public', 'tv', 'greeter']
  };

  const [allowed, setAllowed] = useState<string[]>(roleNavMap[role] || roleNavMap['HR']);

  useEffect(() => {
    // Dynamically fetch page visibility from the database
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
      }
    }).catch(() => {
      // Quietly fallback to default role permissions
    });
  }, [role]);

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
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: BarChart3, section: 'Core Workspace' },
    { key: 'footfall', href: '/footfall', label: 'Hourly Footfall', icon: BarChart3, section: 'Store Operations' },
    { key: 'feedback_collection', href: '/feedback-collection', label: 'Feedback Collection', icon: FileText, section: 'Store Operations' },
    { key: 'feedback_list', href: '/feedback-list', label: 'Feedback Call Queue', icon: FileText, section: 'Store Operations' },
    { key: 'feedback_qr', href: '/feedback-qr', label: 'Feedback QR Code', icon: ClipboardList, section: 'Store Operations' },
    { key: 'divert', href: '/divert', label: 'Sourcing Diverts', icon: Target, section: 'Store Operations' },
    { key: 'pm_view', href: '/pm-view', label: 'Purchase Manager View', icon: Briefcase, section: 'Store Operations' },
    // { key: 'cash', href: '/cash-settlement', label: 'Cash Settlement', icon: FileText, section: 'Store Operations' },
    { key: 'vm_checklist', href: '/vm-checklist', label: 'VM Checklist', icon: ClipboardList, section: 'Store Operations' },
    { key: 'attendance', href: '/attendance', label: 'Attendance & Roster', icon: UserCheck, section: 'Store Operations' },
    // MCheck — Daily Operations
    { key: 'daily_mcheck', href: '/daily-mcheck', label: 'Daily MCheck', icon: CheckSquare, section: 'Daily Operations' },
    { key: 'mcheck_reports', href: '/mcheck-reports', label: 'MCheck Reports', icon: BarChart3, section: 'Daily Operations' },
    { key: 'mcheck_history', href: '/mcheck-history', label: 'MCheck History', icon: ClipboardList, section: 'Daily Operations' },
    { key: 'candidates', href: '/candidates', label: 'Candidate CRM', icon: Users, section: 'Core Workspace' },
    { key: 'offer', href: '/offer-process', label: 'Offer Desk', icon: FileText, section: 'Core Workspace' },
    { key: 'openings', href: '/openings', label: 'Manpower Planning', icon: Briefcase, section: 'Core Workspace' },
    // { key: 'onboarding', href: '/onboarding', label: 'Onboarding Hub', icon: PartyPopper, section: 'Talent Management' },
    { key: 'employees', href: '/employees', label: 'Employee Directory', icon: UserCheck, section: 'Talent Management' },
    { key: 'dept_hiring', href: '/department-hiring', label: 'Department Hiring Status', icon: Briefcase, section: 'Talent Management' },
    { key: 'section_allocation', href: '/section-allocation', label: 'Section Allocation', icon: UserCheck, section: 'Talent Management' },
    // { key: 'exit', href: '/employee-exit', label: 'Exit & FnF Desk', icon: DoorOpen, section: 'Talent Management' },
    { key: 'form', href: '/candidate-entry', label: 'Applicant Registration', icon: ClipboardList, section: 'Public Portals', target: '_blank' },
    { key: 'feedback_public', href: '/feedback-public', label: 'Customer Feedback QR', icon: ClipboardList, section: 'Public Portals', target: '_blank' },
    { key: 'tv', href: '/tv', label: 'Live TV Kiosk', icon: BarChart3, section: 'Public Portals', target: '_blank' },
    { key: 'greeter', href: '/greeter', label: 'Greeter Kiosk', icon: UserCheck, section: 'Public Portals', target: '_blank' },
    { key: 'broadcast', href: '/broadcast-center', label: 'Broadcast Center', icon: Megaphone, section: 'Administration' },
    { key: 'settings', href: '/settings', label: 'System Settings', icon: Settings, section: 'Administration' }
  ];

  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-[#4A1726]/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 bottom-0 w-64 bg-[#4A1726] text-white z-50 flex flex-col transition-transform duration-300 shadow-2xl border-r border-[#C6A15B]/20
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header Logo */}
        <div className="p-4 border-b border-[#C6A15B]/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BSC Logo" className="w-10 h-10 object-contain rounded-xl bg-white p-1 shadow-md border border-[#C6A15B]/30" />
            <div>
              <div className="font-extrabold text-sm text-[#F8F5F1] tracking-wide leading-tight">BSC EXCLUSIVE</div>
              <div className="text-[9.5px] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                {session?.isGlobalAdmin ? (
                  <span className="text-[#27805B] font-extrabold">🌐 ALL LOCATIONS</span>
                ) : (
                  <span className="text-[#C6A15B]">📍 {session?.locationName?.toUpperCase() || 'DAVANAGERE'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 mx-3 my-3 rounded-2xl bg-black/20 border border-[#C6A15B]/25 flex items-center gap-3 shadow-inner">
          <div className="w-9 h-9 rounded-xl bg-[#C6A15B] text-[#321923] font-black flex items-center justify-center text-xs shadow-md border border-[#D4B373]">
            {initials}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="font-bold text-xs text-[#F8F5F1] truncate">{session?.fullName || 'HR Manager'}</div>
            <div className="text-[10px] text-[#C6A15B] font-semibold truncate">{roleLabels[role] || role}</div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {['Core Workspace', 'Store Operations', 'Daily Operations', 'Talent Management', 'Public Portals', 'Administration'].map(section => {
            const items = navItems.filter(item => item.section === section && (allowed.includes(item.key) || ['Super Admin', 'Admin', 'HR', 'Manager'].includes(role)));
            if (items.length === 0) return null;

            return (
              <div key={section}>
                <div className="text-[9.5px] font-black uppercase tracking-widest text-[#C6A15B]/60 px-3 mb-1.5 flex items-center gap-1">
                  <span>{section}</span>
                </div>
                <div className="space-y-1">
                  {items.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.key}
                        to={item.href}
                        target={item.target}
                        onClick={onClose}
                        className={`
                          flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 group
                          ${isActive 
                            ? 'bg-[#C6A15B] text-[#321923] shadow-lg shadow-[#C6A15B]/25 font-black border-l-4 border-[#321923]' 
                            : 'text-[#F8F5F1]/85 hover:bg-[#5C1D30] hover:text-white'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-[#321923]' : 'text-[#C6A15B]/80 group-hover:text-[#C6A15B]'}`} />
                          <span>{item.label}</span>
                        </div>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#321923] opacity-80" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Logout */}
        <div className="p-3 border-t border-[#C6A15B]/15 bg-[#350E1A]/80">
          <button
            onClick={() => Auth.logout()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#C43D4B]/15 text-[#F8F5F1] border border-[#C43D4B]/40 hover:bg-[#C43D4B] hover:text-white transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
          <div className="text-[9px] text-[#F8F5F1]/40 text-center mt-2 font-medium">
            BSC Candidate CRM · Enterprise ATS v2.5
          </div>
        </div>
      </aside>
    </>
  );
}
