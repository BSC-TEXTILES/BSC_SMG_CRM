import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getDashboardTypeForRole, getDashboardLabelForRole } from '../utils/dashboardRouting';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import {
  Users,
  UserCheck,
  CheckCircle,
  UserPlus,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  BarChart3,
  Sparkles,
  TrendingUp,
  Percent,
  CalendarCheck,
  Building2,
  FileCheck,
  LogOut,
  Target,
  DollarSign,
  Footprints,
  MessageSquare,
  PhoneCall,
  QrCode,
  LogIn,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CheckSquare,
  Settings
} from 'lucide-react';
import EmployeeProfileModal from '../components/ui/EmployeeProfileModal';
import WorkflowPanel from '../components/WorkflowPanel';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Employees & Operational Stats
  const [employees, setEmployees] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);

  // Operational Kiosk KPIs
  const [footfallToday, setFootfallToday] = useState(0);
  const [openDivertsCount, setOpenDivertsCount] = useState(0);

  // Feedback Collections Stats
  const [feedbackStats, setFeedbackStats] = useState({
    totalFeedback: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    npsScore: 100,
    pendingCallQueue: 0,
    totalCallQueue: 0
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const loadData = useCallback(async () => {
    try {
      const [empData, candData, ffData, divData, fbData] = await Promise.all([
        API.getEmployees().catch(() => ({ employees: [] })),
        API.getCandidates({ limit: 500 }).catch(() => ({ candidates: [] })),
        API.getFootfall().catch(() => ({ entries: [] })),
        API.getDiverts().catch(() => ({ diverts: [] })),
        API.getFeedbackStats().catch(() => ({
          totalFeedback: 0,
          positiveFeedback: 0,
          negativeFeedback: 0,
          npsScore: 100,
          pendingCallQueue: 0,
          totalCallQueue: 0
        }))
      ]);

      if (empData && empData.employees) setEmployees(empData.employees);
      if (candData && candData.candidates) setCandidates(candData.candidates);

      if (ffData && ffData.entries) {
        const tot = ffData.entries.reduce((sum: number, e: any) => sum + (Number(e.visitors !== undefined ? e.visitors : e.visitorsCount || e.visitors_count) || 0), 0);
        setFootfallToday(tot);
      }
      if (divData && divData.diverts) {
        const openDivs = divData.diverts.filter((d: any) => d.status === 'Open' || d.status === 'In Progress').length;
        setOpenDivertsCount(openDivs);
      }
      if (fbData && fbData.success) {
        setFeedbackStats({
          totalFeedback: fbData.totalFeedback || 0,
          positiveFeedback: fbData.positiveFeedback || 0,
          negativeFeedback: fbData.negativeFeedback || 0,
          npsScore: fbData.npsScore || 100,
          pendingCallQueue: fbData.pendingCallQueue || 0,
          totalCallQueue: fbData.totalCallQueue || 0
        });
      }
    } catch (err: any) {
      console.warn('Dashboard data load warning:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    if (sess?.role === 'Greeter') {
      navigate('/footfall', { replace: true });
      return;
    }
    setSession(sess);
    loadData();
  }, [loadData, navigate]);

  // Gender Statistics for Active Employees
  const femaleEmployees = useMemo(() => {
    return employees.filter(e => {
      const g = (e.gender || '').toLowerCase().trim();
      return ['f', 'female', 'girl', 'women', 'woman'].includes(g);
    }).length;
  }, [employees]);

  const maleEmployees = useMemo(() => {
    return employees.filter(e => {
      const g = (e.gender || '').toLowerCase().trim();
      return ['m', 'male', 'boy', 'men', 'man'].includes(g);
    }).length;
  }, [employees]);

  // Department Distribution Breakdown
  const deptBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => {
      const d = e.department || 'General Floor Staff';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: employees.length > 0 ? Math.round((count / employees.length) * 100) : 0
    }));
  }, [employees]);

  // Filtered Active Employee List
  const filteredEmployees = useMemo(() => {
    let list = [...employees];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => 
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.empNo && e.empNo.toLowerCase().includes(q)) ||
        (e.appNo && e.appNo.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.desig && e.desig.toLowerCase().includes(q)) ||
        (e.section && e.section.toLowerCase().includes(q))
      );
    }
    return list;
  }, [employees, searchQuery]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize) || 1;
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isGreeter = session?.role === 'Greeter';

  // Role detection for the five dashboards: Admin, HR, Manager, Floor Manager, Telecaller
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const roleType = getDashboardTypeForRole(session?.role);
  const validViews = ['admin', 'hr', 'manager', 'floor_manager', 'telecaller'];
  const activeDashboard = (requestedView && validViews.includes(requestedView))
    ? requestedView
    : roleType;

  const isAdminUser = ['Admin', 'Super Admin'].includes(session?.role || '');
  const isAdminDashboard = activeDashboard === 'admin';
  const isHRDashboard = activeDashboard === 'hr';
  const isManagerDashboard = activeDashboard === 'manager';
  const isFloorManagerDashboard = activeDashboard === 'floor_manager';
  const isTelecallerDashboard = activeDashboard === 'telecaller';

  const dashboardTitle = isGreeter
    ? "Entrance Greeter & Visitor Desk"
    : isAdminDashboard
    ? "Admin Dashboard"
    : isHRDashboard
    ? "HR Dashboard"
    : isManagerDashboard
    ? "Manager Dashboard"
    : isFloorManagerDashboard
    ? "Floor Manager Dashboard"
    : "Telecaller Dashboard";

  return (
    <div className="min-h-screen bg-bronze flex">
      <ToastContainer />
      
      <Sidebar 
        session={session} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar 
          title={dashboardTitle} 
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bronze text-black text-[10px] font-black uppercase tracking-widest mb-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>
                  {isGreeter
                    ? 'GREETER KIOSK • BSC EXCLUSIVE'
                    : isAdminDashboard
                    ? 'ADMIN DASHBOARD • EXECUTIVE WORKSPACE'
                    : isHRDashboard
                    ? 'HR DASHBOARD • TALENT MANAGEMENT'
                    : 'MANAGER DASHBOARD • STORE OPERATIONS'}
                </span>
              </div>
              <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-bronze-light" />
                <span>
                  {isGreeter
                    ? 'Entrance Greeter & Visitor Operations Hub'
                    : isAdminDashboard
                    ? 'Admin Dashboard — Executive & Workforce Operations'
                    : isHRDashboard
                    ? 'HR Dashboard — Talent Acquisition & Employee Operations'
                    : 'Manager Dashboard — Store Floor & Service Operations'}
                </span>
              </h2>
              <p className="text-xs text-black font-medium mt-0.5">
                {isGreeter 
                  ? 'Real-time visitor footfall counters, entrance greeter kiosk, customer feedback QR & sourcing diverts.'
                  : isAdminDashboard
                  ? 'Executive storewide operational metrics, active employee directory, customer CSAT index & admin controls.'
                  : isHRDashboard
                  ? 'Active workforce directory, candidate pipeline, recruitment offers & attendance rosters.'
                  : 'Daily MCheck audits, hourly footfall registers, feedback call queues & merchandise diverts.'
                }
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
