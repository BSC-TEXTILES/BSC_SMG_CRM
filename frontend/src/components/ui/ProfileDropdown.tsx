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
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-primary/5 border border-transparent hover:border-accent-soft transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center shadow-xs border border-accent/30">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="font-extrabold text-xs text-primary leading-tight truncate max-w-[110px]">
            {session?.fullName || 'User'}
          </div>
          <div className="text-[9.5px] text-accent font-bold uppercase tracking-wider">
            {role}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-primary" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-accent-soft z-50 p-2 text-xs font-bold animate-fade-in space-y-1">
            <div className="p-3 rounded-xl bg-background border border-accent-soft mb-1">
              <div className="font-black text-primary">{session?.fullName || 'User Session'}</div>
              <div className="text-[10px] text-primary font-mono mt-0.5">{session?.username}</div>
            </div>

            <button
              onClick={() => { setOpen(false); onOpenNotifications(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-primary hover:bg-background"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-accent" />
                <span>Notifications</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#FDE8E8] text-[#C0392B] text-[10px] font-black border border-[#F5B7B7]">
                {NotificationService.getUnreadCount()}
              </span>
            </button>

            <button
              onClick={() => { setOpen(false); onOpenActivity(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-primary hover:bg-background"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#2D8659]" />
                <span>Live Activity</span>
              </div>
            </button>

            <button
              onClick={() => { setOpen(false); onOpenSearch(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-primary hover:bg-background"
            >
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4 text-primary" />
                <span>Global Search</span>
              </div>
              <span className="font-mono text-[9px] text-primary bg-white border border-accent-soft px-1.5 py-0.5 rounded">Ctrl+K</span>
            </button>

            <button
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between p-2 rounded-xl text-primary hover:bg-background"
            >
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-[#2D8659]" /> : <VolumeX className="w-4 h-4 text-primary" />}
                <span>Audio Alerts</span>
              </div>
              <span className="text-[10px] text-primary">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {session?.role === 'Admin' || session?.role === 'Super Admin' ? (
              <button
                onClick={() => { setOpen(false); navigate('/system-admin'); }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-primary hover:bg-background"
              >
                <Settings className="w-4 h-4 text-[#B8860B]" />
                <span>System Administrator</span>
              </button>
            ) : null}

            <div className="pt-1 border-t border-accent-soft">
              <button
                onClick={() => Auth.logout()}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-[#C0392B] hover:bg-[#FDE8E8] font-black"
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
