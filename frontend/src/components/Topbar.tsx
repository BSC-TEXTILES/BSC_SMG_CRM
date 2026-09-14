import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell, Clock, ChevronRight, Search, Activity, Command } from 'lucide-react';
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

  useEffect(() => {
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

    return () => {
      clearInterval(interval);
      unsub();
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
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-3 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleHamburgerClick}
            className="p-2 rounded-xl text-[#163B5C] hover:bg-[#163B5C]/10 transition-colors border border-[#E2E8F0] flex-shrink-0 flex items-center justify-center cursor-pointer shadow-xs"
            aria-label="Toggle navigation menu (3 lines)"
            title="Toggle navigation (3 lines)"
          >
            <Menu className="w-5 h-5 text-[#163B5C]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-[#1B2A3B] tracking-tight leading-none truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
              {title}
            </h1>
            <div className="hidden xs:flex items-center gap-1.5 text-[11px] text-[#5F6E7E] font-semibold mt-1 truncate">
              <span className="text-[#1B2A3B] font-bold flex-shrink-0">BSC Portal</span>
              {session?.locationName && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#4E8ABF]/70 flex-shrink-0" />
                  <span className="text-[#4E8ABF] font-bold flex-shrink-0 flex items-center gap-1">
                    <span>📍</span>
                    <span>{session.locationName}</span>
                  </span>
                </>
              )}
              {session?.isGlobalAdmin && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#4E8ABF]/70 flex-shrink-0" />
                  <span className="text-[#27805B] font-bold flex-shrink-0">🌐 All Locations</span>
                </>
              )}
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-[#4E8ABF]/70 flex-shrink-0" />
                  {b.href ? (
                    <Link to={b.href || '#'} className="hover:text-[#4E8ABF] transition-colors truncate">{b.label}</Link>
                  ) : (
                    <span className="text-[#1B2A3B] font-bold truncate">{b.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Smart Search Trigger (Mobile icon, Desktop bar) */}
          <button
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-xl text-[#163B5C] hover:bg-[#163B5C]/5 border border-transparent hover:border-[#E2E8F0] transition-all"
            title="Search directory"
          >
            <Search className="w-4 h-4 text-[#4E8ABF]" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-[#F4F6F9] text-xs font-semibold text-[#5F6E7E] hover:text-[#1B2A3B] hover:border-[#4E8ABF] transition-all shadow-xs"
          >
            <Search className="w-3.5 h-3.5 text-[#4E8ABF]" />
            <span>Search directory...</span>
            <span className="font-mono text-[9px] bg-white border border-[#E2E8F0] px-1.5 py-0.5 rounded text-[#163B5C] font-bold ml-1">Ctrl+K</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[#1B2A3B] bg-[#F4F6F9] px-3 py-1.5 rounded-xl border border-[#E2E8F0] font-mono shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#4E8ABF]" />
            <span className="font-semibold">{clock}</span>
          </div>

          {/* Activity Panel Trigger */}
          <button
            onClick={() => setActivityOpen(true)}
            className="p-1.5 sm:p-2 rounded-xl text-[#163B5C] hover:bg-[#163B5C]/5 border border-transparent hover:border-[#E2E8F0] transition-all"
            title="Live Activity Intelligence"
          >
            <Activity className="w-4 h-4 text-[#27805B]" />
          </button>

          {/* Notification Drawer Trigger */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-1.5 sm:p-2 rounded-xl text-[#163B5C] hover:bg-[#163B5C]/5 border border-transparent hover:border-[#E2E8F0] transition-all"
            title="Notification Center"
          >
            <Bell className="w-4 h-4 text-[#163B5C]" />
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
