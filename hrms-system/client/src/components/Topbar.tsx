import React, { useState, useEffect } from 'react';
import { Menu, Bell, Clock, ChevronRight, Search, Activity, Command } from 'lucide-react';
import { UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import NotificationDrawer from './ui/NotificationDrawer';
import ActivityPanel from './ui/ActivityPanel';
import GlobalSearchModal from './ui/GlobalSearchModal';
import ProfileDropdown from './ui/ProfileDropdown';

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

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#EAE4DC] px-3 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl text-[#4A1726] hover:bg-[#4A1726]/5 lg:hidden transition-colors border border-[#EAE4DC] flex-shrink-0"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-[#321923] tracking-tight leading-none truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
              {title}
            </h1>
            <div className="hidden xs:flex items-center gap-1.5 text-[11px] text-[#7A726D] font-semibold mt-1 truncate">
              <span className="text-[#321923] font-bold flex-shrink-0">BSC Portal</span>
              {session?.locationName && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#C6A15B]/70 flex-shrink-0" />
                  <span className="text-[#C6A15B] font-bold flex-shrink-0 flex items-center gap-1">
                    <span>📍</span>
                    <span>{session.locationName}</span>
                  </span>
                </>
              )}
              {session?.isGlobalAdmin && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#C6A15B]/70 flex-shrink-0" />
                  <span className="text-[#27805B] font-bold flex-shrink-0">🌐 All Locations</span>
                </>
              )}
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-[#C6A15B]/70 flex-shrink-0" />
                  {b.href ? (
                    <a href={b.href} className="hover:text-[#C6A15B] transition-colors truncate">{b.label}</a>
                  ) : (
                    <span className="text-[#321923] font-bold truncate">{b.label}</span>
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
            className="sm:hidden p-2 rounded-xl text-[#4A1726] hover:bg-[#4A1726]/5 border border-transparent hover:border-[#EAE4DC] transition-all"
            title="Search directory"
          >
            <Search className="w-4 h-4 text-[#C6A15B]" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#EAE4DC] bg-[#F8F5F1] text-xs font-semibold text-[#7A726D] hover:text-[#321923] hover:border-[#C6A15B] transition-all shadow-xs"
          >
            <Search className="w-3.5 h-3.5 text-[#C6A15B]" />
            <span>Search directory...</span>
            <span className="font-mono text-[9px] bg-white border border-[#EAE4DC] px-1.5 py-0.5 rounded text-[#4A1726] font-bold ml-1">Ctrl+K</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[#321923] bg-[#F8F5F1] px-3 py-1.5 rounded-xl border border-[#EAE4DC] font-mono shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#C6A15B]" />
            <span className="font-semibold">{clock}</span>
          </div>

          {/* Activity Panel Trigger */}
          <button
            onClick={() => setActivityOpen(true)}
            className="p-1.5 sm:p-2 rounded-xl text-[#4A1726] hover:bg-[#4A1726]/5 border border-transparent hover:border-[#EAE4DC] transition-all"
            title="Live Activity Intelligence"
          >
            <Activity className="w-4 h-4 text-[#27805B]" />
          </button>

          {/* Notification Drawer Trigger */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-1.5 sm:p-2 rounded-xl text-[#4A1726] hover:bg-[#4A1726]/5 border border-transparent hover:border-[#EAE4DC] transition-all"
            title="Notification Center"
          >
            <Bell className="w-4 h-4 text-[#4A1726]" />
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
