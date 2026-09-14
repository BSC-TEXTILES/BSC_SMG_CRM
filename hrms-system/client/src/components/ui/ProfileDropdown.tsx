import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Settings, Volume2, VolumeX, Moon, Sun, Command, LogOut, ShieldCheck, ChevronDown, Activity } from 'lucide-react';
import { Auth, UserSession } from '../../services/api';
import { NotificationService } from '../../services/notificationService';

interface ProfileDropdownProps {
  session: UserSession | null;
  onOpenNotifications: () => void;
  onOpenActivity: () => void;
  onOpenSearch: () => void;
}

export default function ProfileDropdown({
  session,
  onOpenNotifications,
  onOpenActivity,
  onOpenSearch
}: ProfileDropdownProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(NotificationService.isSoundEnabled());

  const role = session?.role || 'HR';
  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  const handleToggleSound = () => {
    const next = NotificationService.toggleSound();
    setSoundEnabled(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#4A1726]/5 border border-transparent hover:border-[#EAE4DC] transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-[#4A1726] text-white font-black text-xs flex items-center justify-center shadow-xs border border-[#C6A15B]/30">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="font-extrabold text-xs text-[#321923] leading-tight truncate max-w-[110px]">
            {session?.fullName || 'User'}
          </div>
          <div className="text-[9.5px] text-[#C6A15B] font-bold uppercase tracking-wider">
            {role}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#7A726D]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-[#EAE4DC] z-50 p-2 text-xs font-bold animate-fade-in space-y-1">
            <div className="p-3 rounded-xl bg-[#F8F5F1] border border-[#EAE4DC] mb-1">
              <div className="font-black text-[#4A1726]">{session?.fullName || 'User Session'}</div>
              <div className="text-[10px] text-[#7A726D] font-mono mt-0.5">{session?.username}</div>
            </div>

            <button
              onClick={() => { setOpen(false); onOpenNotifications(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#321923] hover:bg-[#F8F5F1]"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#C6A15B]" />
                <span>Notifications</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#FDF0F2] text-[#C43D4B] text-[10px] font-black border border-[#F6C8CE]">
                {NotificationService.getUnreadCount()}
              </span>
            </button>

            <button
              onClick={() => { setOpen(false); onOpenActivity(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#321923] hover:bg-[#F8F5F1]"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#27805B]" />
                <span>Live Activity</span>
              </div>
            </button>

            <button
              onClick={() => { setOpen(false); onOpenSearch(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#321923] hover:bg-[#F8F5F1]"
            >
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4 text-[#4A1726]" />
                <span>Global Search</span>
              </div>
              <span className="font-mono text-[9px] text-[#7A726D] bg-white border border-[#EAE4DC] px-1.5 py-0.5 rounded">Ctrl+K</span>
            </button>

            <button
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#321923] hover:bg-[#F8F5F1]"
            >
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-[#27805B]" /> : <VolumeX className="w-4 h-4 text-[#7A726D]" />}
                <span>Audio Alerts</span>
              </div>
              <span className="text-[10px] text-[#7A726D]">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {session?.role === 'Admin' || session?.role === 'Super Admin' ? (
              <button
                onClick={() => { setOpen(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-[#321923] hover:bg-[#F8F5F1]"
              >
                <Settings className="w-4 h-4 text-[#C58A24]" />
                <span>System Governance</span>
              </button>
            ) : null}

            <div className="pt-1 border-t border-[#EAE4DC]">
              <button
                onClick={() => Auth.logout()}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-[#C43D4B] hover:bg-[#FDF0F2] font-black"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
