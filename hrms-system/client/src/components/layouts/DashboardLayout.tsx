import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Topbar from '../Topbar';
import ToastContainer from '../Toast';
import { Auth, UserSession } from "../../services/api";
import { Plus, X, UserCheck, BarChart3, Target, PhoneCall, Zap } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  rightElement?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  breadcrumbs = [],
  rightElement
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F8F5F1] flex relative select-none">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={rightElement}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile Floating Quick Action Speed Dial (FAB) */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        {speedDialOpen && (
          <div className="mb-3 space-y-2.5 animate-scale-in flex flex-col items-end">
            <button
              onClick={() => { setSpeedDialOpen(false); window.open('/greeter', '_blank'); }}
              className="px-4 py-2.5 rounded-2xl bg-[#4A1726] text-[#C6A15B] text-xs font-black shadow-xl border border-[#C6A15B]/40 flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Greeter Entrance Kiosk</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/footfall'); }}
              className="px-4 py-2.5 rounded-2xl bg-[#4A1726] text-white text-xs font-black shadow-xl border border-[#C6A15B]/20 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-[#C6A15B]" />
              <span>Hourly Footfall Register</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/divert'); }}
              className="px-4 py-2.5 rounded-2xl bg-[#4A1726] text-white text-xs font-black shadow-xl border border-[#C6A15B]/20 flex items-center gap-2"
            >
              <Target className="w-4 h-4 text-[#C58A24]" />
              <span>Sourcing Diverts</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/feedback-list'); }}
              className="px-4 py-2.5 rounded-2xl bg-[#4A1726] text-white text-xs font-black shadow-xl border border-[#C6A15B]/20 flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4 text-[#27805B]" />
              <span>Feedback Call Queue</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setSpeedDialOpen(!speedDialOpen)}
          className={`w-14 h-14 rounded-full bg-gradient-to-r from-[#4A1726] to-[#350E1A] text-[#C6A15B] shadow-2xl flex items-center justify-center border-2 border-[#C6A15B]/50 transition-transform active:scale-95 ${
            speedDialOpen ? 'rotate-45' : ''
          }`}
          title="Quick Store Action Speed Dial"
        >
          <Zap className="w-6 h-6 fill-[#C6A15B]" />
        </button>
      </div>
    </div>
  );
}
