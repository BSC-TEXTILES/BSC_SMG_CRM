import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell, Clock, ChevronRight, Search, Activity, Command, ShieldAlert, ShieldOff } from 'lucide-react';
import { UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import NotificationDrawer from './ui/NotificationDrawer';
import ActivityPanel from './ui/ActivityPanel';
import GlobalSearchModal from './ui/GlobalSearchModal';
import ProfileDropdown from './ui/ProfileDropdown';

import { toggleSidebarCollapsed } from '../utils/sidebarState';

interface TopbarProps {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  session: UserSession | null;
  onMenuClick: () => void;
  rightElement?: React.ReactNode;
}

export default function Topbar({ title, breadcrumbs, session, onMenuClick, rightElement }: TopbarProps) {
  const [clock, setClock] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bypassDevTools, setBypassDevTools] = useState(false);

  useEffect(() => {
    setBypassDevTools(localStorage.getItem('bsc_shield_bypass') === 'true');
    
    const updateTime = () => {
      const now = new Date();
      setClock(
        now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) +
        ' · ' +
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const unsub = NotificationService.subscribe(() => {
      setUnreadCount(NotificationService.getUnreadCount());
    });

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      clearInterval(interval);
      unsub();
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleHamburgerClick = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebarCollapsed();
    } else {
      onMenuClick();
    }
  };

  return (
    <>
      <header className="h-16 w-full max-w-full bg-white/95 backdrop-blur-md border-b border-accent-soft px-2.5 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs flex-shrink-0">
        {/* ── Left Area: Hamburger & Title ───────────────────────────────── */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
          <button
            onClick={handleHamburgerClick}
            className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors border border-accent-soft flex-shrink-0 flex items-center justify-center cursor-pointer shadow-xs"
            aria-label="Toggle navigation menu (3 lines)"
            title="Toggle navigation (3 lines)"
          >
            <Menu className="w-5 h-5 text-primary" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-primary tracking-tight leading-none truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[200px] md:max-w-[240px] lg:max-w-none">
              {title}
            </h1>
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-primary/70 font-semibold mt-1 truncate">
              <span className="text-primary font-bold flex-shrink-0">BSC Portal</span>
              {session?.locationName && (
                <>
                  <ChevronRight className="w-3 h-3 text-accent/70 flex-shrink-0" />
                  <span className="text-accent font-bold flex-shrink-0 flex items-center gap-1">
                    <span>📍</span>
                    <span>{session.locationName}</span>
                  </span>
                </>
              )}
              {session?.isGlobalAdmin && (
                <>
                  <ChevronRight className="w-3 h-3 text-accent/70 flex-shrink-0" />
                  <span className="text-[#27805B] font-bold flex-shrink-0">🌐 All Locations</span>
                </>
              )}
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-accent/70 flex-shrink-0" />
                  {b.href ? (
                    <Link to={b.href || '#'} className="hover:text-accent transition-colors truncate">{b.label}</Link>
                  ) : (
                    <span className="text-primary font-bold truncate">{b.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* ── Center Area: Stable, Fixed Search Directory (Ctrl+K) ──────── */}
        <div className="flex-1 flex items-center justify-center px-2 sm:px-4 min-w-0 max-w-[160px] xs:max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-accent-soft bg-background/80 hover:bg-background text-xs font-semibold text-primary/70 hover:text-primary hover:border-accent transition-all shadow-2xs group cursor-pointer"
            title="Search directory (Ctrl+K)"
            aria-label="Search directory (Ctrl+K)"
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Search className="w-3.5 h-3.5 text-accent flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate hidden sm:inline">Search directory...</span>
              <span className="sm:hidden text-[11px] truncate font-medium">Search...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[9px] bg-white border border-accent-soft px-1.5 py-0.5 rounded text-primary font-bold shadow-2xs flex-shrink-0 select-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </kbd>
          </button>
        </div>

        {/* ── Right Area: Tools, Notifications, Profile & Custom Actions ─── */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 flex-shrink-0 min-w-0">
          <div className="hidden 2xl:flex items-center gap-2 text-xs text-primary bg-background px-3 py-1.5 rounded-xl border border-accent-soft font-mono shadow-xs">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold">{clock}</span>
          </div>

          {/* Activity Panel Trigger */}
          <button
            onClick={() => setActivityOpen(true)}
            className="hidden sm:flex p-1.5 sm:p-2 rounded-xl text-primary hover:bg-primary/5 border border-transparent hover:border-accent-soft transition-all"
            title="Live Activity Intelligence"
          >
            <Activity className="w-4 h-4 text-[#27805B]" />
          </button>

          {/* DevTools Bypass Toggle (Admins Only) */}
          {session?.isGlobalAdmin && (
            <button
              onClick={() => {
                const newState = !bypassDevTools;
                setBypassDevTools(newState);
                localStorage.setItem('bsc_shield_bypass', newState ? 'true' : 'false');
                window.dispatchEvent(new Event('dev_tools_bypass_changed'));
              }}
              className="p-1.5 sm:p-2 rounded-xl text-primary hover:bg-primary/5 border border-transparent hover:border-accent-soft transition-all"
              title={bypassDevTools ? "DevTools Protection Bypassed" : "DevTools Protection Active"}
            >
              {bypassDevTools ? (
                <ShieldOff className="w-4 h-4 text-orange-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-primary" />
              )}
            </button>
          )}

          {/* Notification Drawer Trigger */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-1.5 sm:p-2 rounded-xl text-primary hover:bg-primary/5 border border-transparent hover:border-accent-soft transition-all"
            title="Notification Center"
          >
            <Bell className="w-4 h-4 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C43D4B] text-white font-black text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Dropdown */}
          <ProfileDropdown
            session={session}
            onOpenNotifications={() => setNotifOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />

          {rightElement}
        </div>
      </header>

      {/* Drawers & Modals */}
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <ActivityPanel isOpen={activityOpen} onClose={() => setActivityOpen(false)} />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
