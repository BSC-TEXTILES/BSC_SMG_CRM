import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Eye,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  MessageCircle,
  History,
  Star,
  MapPin,
  Edit2,
  X
} from 'lucide-react';

interface WeddingCustomer {
  id: number;
  customer_code: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  customer_name: string;
  mobile_number: string;
  phone?: string;
  email?: string;
  wedding_date?: string;
  expected_shopping_date: string;
  preferred_shopping_category?: string;
  estimated_family_size?: number;
  assigned_telecaller?: string;
  assigned_telecaller_id?: number;
  follow_up_date: string;
  preferred_call_time?: string;
  customer_notes?: string;
  customer_status: string;
  call_status: string;
  total_calls_count?: number;
  last_call_date?: string;
  last_call_outcome?: string;
  overdue_days?: number;
  created_at?: string;
}

interface CallLog {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_code?: string;
  mobile_number?: string;
  call_date: string;
  call_time: string;
  telecaller_name: string;
  telecaller_id?: number;
  call_status: string;
  call_outcome: string;
  remarks?: string;
  next_follow_up_date?: string;
  next_follow_up_time?: string;
  expected_shopping_date_updated?: string;
  created_at: string;
}

interface DashboardStats {
  totalCustomers: number;
  todayFollowUps: number;
  overdueFollowUps: number;
  upcomingFollowUps: number;
  callsCompletedToday: number;
  totalCalls: number;
  noAnswerToday: number;
  convertedCount: number;
  followUpCompletionRate: number;
  statusBreakdown: Record<string, number>;
}

interface PerformanceMetrics {
  totalAssigned: number;
  totalCalls: number;
  contactedCount: number;
  connectedCount: number;
  noAnswerCount: number;
  convertedCount: number;
  convertedThisPeriod: number;
  connectionRate: number;
  contactRate: number;
}

const CALL_STATUSES = [
  'Pending',
  'Called',
  'No Answer',
  'Busy',
  'Call Back Requested',
  'Connected',
  'Completed'
];

const CALL_OUTCOMES = [
  'Connected',
  'No Answer',
  'Busy',
  'Call Back Requested',
  'Interested',
  'Not Interested',
  'Shopping Confirmed',
  'Other'
];

const CALL_TIME_OPTIONS = [
  'Morning (10 AM - 1 PM)',
  'Afternoon (1 PM - 4 PM)',
  'Evening (4 PM - 7 PM)',
  'Night (7 PM - 9 PM)',
  'Any Time'
];

const getStatusBadge = (status: string): string => {
  const map: Record<string, string> = {
    'New': 'bg-blue-50 text-blue-700 border border-blue-200',
    'Follow-up Pending': 'bg-amber-50 text-amber-700 border border-amber-200',
    'Contacted': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    'Interested': 'bg-green-50 text-green-700 border border-green-200',
    'Shopping Date Confirmed': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Converted': 'bg-green-100 text-green-800 border border-green-300',
    'Visited Store': 'bg-teal-50 text-teal-700 border border-teal-200',
    'Not Interested': 'bg-red-50 text-red-700 border border-red-200',
    'No Response': 'bg-gray-50 text-gray-600 border border-gray-200',
    'Cancelled': 'bg-red-100 text-red-800 border border-red-300',
    'Closed': 'bg-gray-100 text-gray-700 border border-gray-300'
  };
  return map[status] || 'bg-gray-50 text-gray-600 border border-gray-200';
};

export default function TelecallerDashboard() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  const [selectedLocation, setSelectedLocation] = useState<number | ''>('');
  const [locations, setLocations] = useState<any[]>([]);

  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    todayFollowUps: 0,
    overdueFollowUps: 0,
    upcomingFollowUps: 0,
    callsCompletedToday: 0,
    totalCalls: 0,
    noAnswerToday: 0,
    convertedCount: 0,
    followUpCompletionRate: 0,
    statusBreakdown: {}
  });

  const [followUpPipeline, setFollowUpPipeline] = useState<{
    today: WeddingCustomer[];
    overdue: WeddingCustomer[];
    upcoming: WeddingCustomer[];
    callbacks: WeddingCustomer[];
  }>({
    today: [],
    overdue: [],
    upcoming: [],
    callbacks: []
  });

  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [callHistoryTotal, setCallHistoryTotal] = useState(0);
  const [callHistoryPage, setCallHistoryPage] = useState(0);
  const [callHistoryDateFilter, setCallHistoryDateFilter] = useState('');

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    totalAssigned: 0,
    totalCalls: 0,
    contactedCount: 0,
    connectedCount: 0,
    noAnswerCount: 0,
    convertedCount: 0,
    convertedThisPeriod: 0,
    connectionRate: 0,
    contactRate: 0
  });

  const [recentCustomers, setRecentCustomers] = useState<WeddingCustomer[]>([]);
  const [customerDetail, setCustomerDetail] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<WeddingCustomer | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [customerDetailTab, setCustomerDetailTab] = useState<'overview' | 'calls' | 'notes'>('overview');

  const [activeTab, setActiveTab] = useState<'pipeline' | 'calls' | 'performance' | 'customers'>('pipeline');

  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [performancePeriod, setPerformancePeriod] = useState('today');

  const [logForm, setLogForm] = useState({
    call_status: 'Completed',
    call_outcome: 'Connected',
    remarks: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)'
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => setCollapsed(c));
    return unsub;
  }, []);

  useEffect(() => {
    const s = Auth.get();
    if (!s) {
      window.location.href = '/login';
      return;
    }
    setSession(s);
    if (!s.isGlobalAdmin && s.locationId) {
      setSelectedLocation(s.locationId);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    API.getLocations().then(res => {
      if (!mounted) return;
      const list = res?.locations || res?.data?.locations;
      if (list && list.length > 0) {
        setLocations(list.map((l: any) => ({
          id: l.id,
          name: l.location_name || l.name,
          code: l.location_code || l.code
        })));
      }
    }).catch(() => {
      console.warn('Failed to load locations from API');
    });
    return () => { mounted = false; };
  }, [session]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await API.getTelecallerDashboardStats(selectedLocation || undefined);
      const s = res?.stats || res;
      if (s) {
        setStats({
          totalCustomers: Number(s.totalCustomers ?? s.total_customers ?? s.total_assigned) || 0,
          todayFollowUps: Number(s.todayFollowUps ?? s.today_follow_ups ?? s.due_today) || 0,
          overdueFollowUps: Number(s.overdueFollowUps ?? s.overdue_follow_ups ?? s.overdue) || 0,
          upcomingFollowUps: Number(s.upcomingFollowUps ?? s.upcoming_follow_ups) || 0,
          callsCompletedToday: Number(s.callsCompletedToday ?? s.calls_completed_today ?? s.calls_completed) || 0,
          totalCalls: Number(s.totalCalls ?? s.total_calls) || 0,
          noAnswerToday: Number(s.noAnswerToday ?? s.no_answer_today ?? s.no_answer) || 0,
          convertedCount: Number(s.convertedCount ?? s.converted_count ?? s.visited_converted) || 0,
          followUpCompletionRate: Number(s.followUpCompletionRate ?? s.follow_up_completion_rate) || 0,
          statusBreakdown: s.statusBreakdown || s.status_breakdown || {}
        });
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [selectedLocation]);

  const loadPipeline = useCallback(async () => {
    setLoadingPipeline(true);
    try {
      const res = await API.getTelecallerFollowUpPipeline(selectedLocation || undefined);
      const pipeline = res?.pipeline || res;
      if (pipeline) {
        setFollowUpPipeline({
          today: pipeline.today || pipeline.dueToday || pipeline.due_today || [],
          overdue: pipeline.overdue || [],
          upcoming: pipeline.upcoming || [],
          callbacks: pipeline.callbacks || pipeline.callbackRequests || pipeline.callback_requests || []
        });
      }
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoadingPipeline(false);
    }
  }, [selectedLocation]);

  const loadCallHistory = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const res = await API.getTelecallerCallHistory({
        limit: 20,
        offset: callHistoryPage * 20,
        date: callHistoryDateFilter || undefined,
        location_id: selectedLocation || undefined
      });
      const calls = res?.calls || res?.callHistory || res?.call_history || [];
      const total = res?.total || calls.length;
      setCallHistory(calls);
      setCallHistoryTotal(total);
    } catch (err) {
      console.error('Failed to load call history:', err);
    } finally {
      setLoadingCalls(false);
    }
  }, [selectedLocation, callHistoryPage, callHistoryDateFilter]);

  const loadPerformance = useCallback(async () => {
    setLoadingPerformance(true);
    try {
      const res = await API.getTelecallerPerformance({
        period: performancePeriod,
        location_id: selectedLocation || undefined
      });
      const perf = res?.performance || res?.metrics || res;
      if (perf) {
        setPerformanceMetrics({
          totalAssigned: Number(perf.totalAssigned ?? perf.total_assigned) || 0,
          totalCalls: Number(perf.totalCalls ?? perf.total_calls) || 0,
          contactedCount: Number(perf.contactedCount ?? perf.contacted_count) || 0,
          connectedCount: Number(perf.connectedCount ?? perf.connected_count) || 0,
          noAnswerCount: Number(perf.noAnswerCount ?? perf.no_answer_count) || 0,
          convertedCount: Number(perf.convertedCount ?? perf.converted_count) || 0,
          convertedThisPeriod: Number(perf.convertedThisPeriod ?? perf.converted_this_period) || 0,
          connectionRate: Number(perf.connectionRate ?? perf.connection_rate) || 0,
          contactRate: Number(perf.contactRate ?? perf.contact_rate) || 0
        });
      }
    } catch (err) {
      console.error('Failed to load performance:', err);
    } finally {
      setLoadingPerformance(false);
    }
  }, [selectedLocation, performancePeriod]);

  const loadRecentCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const res = await API.getTelecallerRecentCustomers(50);
      const custs = res?.customers || res?.recentCustomers || res?.recent_customers || [];
      setRecentCustomers(custs);
    } catch (err) {
      console.error('Failed to load recent customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const loadCustomerDetail = useCallback(async (customerId: number | string) => {
    setLoadingDetail(true);
    try {
      const res = await API.getTelecallerCustomerDetail(customerId);
      if (res) {
        setCustomerDetail(res);
        if (res.customer) setSelectedCustomer(res.customer);
      }
    } catch (err) {
      console.error('Failed to load customer detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    loadStats();
  }, [session, loadStats]);

  useEffect(() => {
    if (!session) return;
    if (activeTab === 'pipeline') loadPipeline();
    else if (activeTab === 'calls') loadCallHistory();
    else if (activeTab === 'performance') loadPerformance();
    else if (activeTab === 'customers') loadRecentCustomers();
  }, [activeTab, session, loadPipeline, loadCallHistory, loadPerformance, loadRecentCustomers]);

  const handleRefresh = () => {
    loadStats();
    if (activeTab === 'pipeline') loadPipeline();
    else if (activeTab === 'calls') loadCallHistory();
    else if (activeTab === 'performance') loadPerformance();
    else if (activeTab === 'customers') loadRecentCustomers();
  };

  const openCustomerDetail = (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setShowCustomerDetail(true);
    setCustomerDetailTab('overview');
    loadCustomerDetail(cust.id);
  };

  const openLogCallModal = (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setLogForm({
      call_status: 'Completed',
      call_outcome: 'Connected',
      remarks: '',
      next_follow_up_date: cust.follow_up_date ? String(cust.follow_up_date).slice(0, 10) : '',
      next_follow_up_time: cust.preferred_call_time || 'Morning (10 AM - 1 PM)'
    });
    setShowLogCallModal(true);
  };

  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const cleanDate = (d?: string | null) => (d && d.trim() ? d.trim().slice(0, 10) : null);
      const payload = {
        customerId: selectedCustomer.id,
        customer_id: selectedCustomer.id,
        callDate: new Date().toISOString().slice(0, 10),
        callTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        callStatus: logForm.call_status,
        callOutcome: logForm.call_outcome,
        remarks: logForm.remarks,
        nextFollowUpDate: logForm.call_outcome !== 'Not Interested' ? cleanDate(logForm.next_follow_up_date) : null,
        nextFollowUpTime: logForm.call_outcome !== 'Not Interested' ? (logForm.next_follow_up_time || null) : null
      };

      const res = await API.logWeddingCall(payload);
      if (res && res.success) {
        showToast(`Call outcome [${logForm.call_outcome}] logged for ${selectedCustomer.customer_name}!`);
        setShowLogCallModal(false);
        loadStats();
        if (activeTab === 'pipeline') loadPipeline();
        else if (activeTab === 'calls') loadCallHistory();
      } else {
        alert(res?.message || 'Failed to log call');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving call log');
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return recentCustomers;
    const q = searchQuery.toLowerCase();
    return recentCustomers.filter(c =>
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_code || '').toLowerCase().includes(q) ||
      (c.mobile_number || '').includes(q)
    );
  }, [recentCustomers, searchQuery]);

  const breadcrumbTrail = useMemo(() => {
    if (showCustomerDetail && selectedCustomer) {
      return [{ label: selectedCustomer.customer_name || 'Customer Details' }];
    }
    return null;
  }, [showCustomerDetail, selectedCustomer]);

  const isLoading = loadingStats || loadingPipeline || loadingCalls || loadingPerformance || loadingCustomers;

  return (
    <div className="h-screen w-full bg-background text-gray-800 flex overflow-hidden relative selection:bg-accent/30">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col h-screen min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="Telecaller Dashboard"
          breadcrumbs={breadcrumbTrail}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {session?.isGlobalAdmin ? (
                <div className="flex items-center bg-primary/10 rounded-xl p-0.5 sm:p-1 border border-accent/40">
                  <span className="hidden lg:inline text-[11px] font-bold text-primary px-1.5 uppercase tracking-wide">Location:</span>
                  <select
                    value={selectedLocation}
                    onChange={e => setSelectedLocation(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="bg-white text-xs font-bold text-primary py-1 px-1.5 sm:px-2 rounded-lg border-0 focus:ring-2 focus:ring-accent shadow-xs cursor-pointer max-w-[95px] xs:max-w-[130px] sm:max-w-[180px]"
                  >
                    <option value="">All</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-primary text-white px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm border border-accent/30 flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="hidden sm:inline">{session?.locationName?.toUpperCase() || 'DAVANAGERE'}</span>
                  <span className="sm:hidden">{session?.locationCode || 'DAV'}</span>
                </div>
              )}

              <button
                onClick={handleRefresh}
                className="bg-white border border-accent-soft hover:border-primary text-primary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow-md transition-all flex-shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 w-full space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {toastMessage && (
              <div className="fixed bottom-6 right-6 z-[200] bg-primary border-2 border-accent text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up">
                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-primary tracking-tight">Telecaller Dashboard</h1>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(63,14,29,0.08)' }}>
                    <Users className="w-5 h-5" style={{ color: '#3F0E1D' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total Assigned</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalCustomers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(63,14,29,0.08)' }}>
                    <Calendar className="w-5 h-5" style={{ color: '#3F0E1D' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Today's Follow-ups</p>
                    <p className="text-xl font-bold text-gray-900">{stats.todayFollowUps}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: stats.overdueFollowUps > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(63,14,29,0.08)' }}>
                    <AlertCircle className="w-5 h-5" style={{ color: stats.overdueFollowUps > 0 ? '#DC2626' : '#3F0E1D' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Overdue</p>
                    <p className="text-xl font-bold" style={{ color: stats.overdueFollowUps > 0 ? '#DC2626' : '#111827' }}>{stats.overdueFollowUps}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(63,14,29,0.08)' }}>
                    <Phone className="w-5 h-5" style={{ color: '#3F0E1D' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Calls Today</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalCalls}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#22C55E' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Connected</p>
                    <p className="text-xl font-bold text-gray-900">{stats.callsCompletedToday}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    <PhoneOff className="w-5 h-5" style={{ color: '#EF4444' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">No Answer</p>
                    <p className="text-xl font-bold text-gray-900">{stats.noAnswerToday}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
                    <TrendingUp className="w-5 h-5" style={{ color: '#22C55E' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Converted</p>
                    <p className="text-xl font-bold text-gray-900">{stats.convertedCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(63,14,29,0.08)' }}>
                    <Clock className="w-5 h-5" style={{ color: '#3F0E1D' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Upcoming</p>
                    <p className="text-xl font-bold text-gray-900">{stats.upcomingFollowUps}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-100 shadow-xs overflow-x-auto">
              {([
                { key: 'pipeline' as const, label: 'Follow-up Pipeline', icon: Calendar },
                { key: 'calls' as const, label: 'Call History', icon: History },
                { key: 'performance' as const, label: 'Performance', icon: BarChart3 },
                { key: 'customers' as const, label: 'My Customers', icon: Users }
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary text-white shadow-md'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {activeTab === 'pipeline' && (
              <div className="space-y-4">
                {loadingPipeline ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    <span className="ml-2 text-sm text-gray-500 font-medium">Loading pipeline...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <h3 className="text-sm font-bold text-gray-900">Today's Follow-ups</h3>
                        <span className="ml-auto bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{followUpPipeline.today.length}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {followUpPipeline.today.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">No follow-ups due today</div>
                        ) : (
                          followUpPipeline.today.map(c => (
                            <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{c.customer_name}</p>
                                <p className="text-xs text-gray-500">{c.mobile_number} {c.wedding_date ? `\u00B7 ${c.wedding_date}` : ''}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadge(c.customer_status)}`}>
                                {c.customer_status}
                              </span>
                              <button onClick={() => openLogCallModal(c)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Log Call">
                                <PhoneCall className="w-4 h-4" />
                              </button>
                              <button onClick={() => openCustomerDetail(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-red-200 shadow-sm">
                      <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <h3 className="text-sm font-bold text-red-700">Overdue Follow-ups</h3>
                        <span className="ml-auto bg-red-50 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{followUpPipeline.overdue.length}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {followUpPipeline.overdue.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">No overdue follow-ups</div>
                        ) : (
                          followUpPipeline.overdue.map(c => (
                            <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-red-50/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{c.customer_name}</p>
                                <p className="text-xs text-gray-500">{c.mobile_number}</p>
                              </div>
                              {c.overdue_days && c.overdue_days > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                  {c.overdue_days}d overdue
                                </span>
                              )}
                              <button onClick={() => openLogCallModal(c)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Log Call">
                                <PhoneCall className="w-4 h-4" />
                              </button>
                              <button onClick={() => openCustomerDetail(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <h3 className="text-sm font-bold text-gray-900">Upcoming (Next 7 Days)</h3>
                        <span className="ml-auto bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{followUpPipeline.upcoming.length}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {followUpPipeline.upcoming.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">No upcoming follow-ups</div>
                        ) : (
                          followUpPipeline.upcoming.map(c => (
                            <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{c.customer_name}</p>
                                <p className="text-xs text-gray-500">{c.mobile_number}</p>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                {c.follow_up_date ? String(c.follow_up_date).slice(0, 10) : 'TBD'}
                              </span>
                              <button onClick={() => openLogCallModal(c)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Log Call">
                                <PhoneCall className="w-4 h-4" />
                              </button>
                              <button onClick={() => openCustomerDetail(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <h3 className="text-sm font-bold text-gray-900">Callback Requests</h3>
                        <span className="ml-auto bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{followUpPipeline.callbacks.length}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {followUpPipeline.callbacks.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">No callback requests</div>
                        ) : (
                          followUpPipeline.callbacks.map(c => (
                            <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{c.customer_name}</p>
                                <p className="text-xs text-gray-500">{c.mobile_number} {c.preferred_call_time ? `\u00B7 Prefers: ${c.preferred_call_time}` : ''}</p>
                              </div>
                              <MessageCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              <button onClick={() => openLogCallModal(c)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Log Call">
                                <PhoneCall className="w-4 h-4" />
                              </button>
                              <button onClick={() => openCustomerDetail(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white rounded-xl border border-gray-100 shadow-xs p-1">
                    <input
                      type="date"
                      value={callHistoryDateFilter}
                      onChange={e => { setCallHistoryDateFilter(e.target.value); setCallHistoryPage(0); }}
                      className="text-xs font-bold text-primary px-3 py-1.5 rounded-lg border-0 focus:ring-2 focus:ring-accent bg-transparent"
                    />
                    {callHistoryDateFilter && (
                      <button onClick={() => { setCallHistoryDateFilter(''); setCallHistoryPage(0); }} className="text-gray-400 hover:text-red-500 px-2">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {loadingCalls ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    <span className="ml-2 text-sm text-gray-500 font-medium">Loading call history...</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Outcome</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {callHistory.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No call records found</td>
                            </tr>
                          ) : (
                            callHistory.map(call => (
                              <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{call.call_date ? String(call.call_date).slice(0, 10) : '-'}</td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{call.call_time || '-'}</td>
                                <td className="px-4 py-3 font-bold text-gray-900">{call.customer_name || `Customer #${call.customer_id}`}</td>
                                <td className="px-4 py-3 text-gray-500">{call.mobile_number || '-'}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadge(call.call_status)}`}>
                                    {call.call_status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    call.call_outcome === 'Connected' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    call.call_outcome === 'No Answer' ? 'bg-red-50 text-red-700 border border-red-200' :
                                    call.call_outcome === 'Interested' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    'bg-gray-50 text-gray-600 border border-gray-200'
                                  }`}>
                                    {call.call_outcome}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{call.remarks || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {callHistoryTotal > 20 && (
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Showing {callHistoryPage * 20 + 1}-{Math.min((callHistoryPage + 1) * 20, callHistoryTotal)} of {callHistoryTotal}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCallHistoryPage(p => Math.max(0, p - 1))}
                            disabled={callHistoryPage === 0}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCallHistoryPage(p => p + 1)}
                            disabled={(callHistoryPage + 1) * 20 >= callHistoryTotal}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {['today', 'week', 'month'].map(period => (
                    <button
                      key={period}
                      onClick={() => setPerformancePeriod(period)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        performancePeriod === period
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>

                {loadingPerformance ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    <span className="ml-2 text-sm text-gray-500 font-medium">Loading performance data...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Total Assigned</p>
                      <p className="text-3xl font-black text-primary">{performanceMetrics.totalAssigned}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Total Calls Made</p>
                      <p className="text-3xl font-black text-primary">{performanceMetrics.totalCalls}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${performanceMetrics.totalAssigned > 0 ? Math.min(100, (performanceMetrics.totalCalls / performanceMetrics.totalAssigned) * 100) : 0}%`, background: '#3F0E1D' }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Contacted</p>
                      <p className="text-3xl font-black text-primary">{performanceMetrics.contactedCount}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${performanceMetrics.totalAssigned > 0 ? Math.min(100, (performanceMetrics.contactedCount / performanceMetrics.totalAssigned) * 100) : 0}%` }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Connected</p>
                      <p className="text-3xl font-black text-primary">{performanceMetrics.connectedCount}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${performanceMetrics.totalAssigned > 0 ? Math.min(100, (performanceMetrics.connectedCount / performanceMetrics.totalAssigned) * 100) : 0}%` }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">No Answer</p>
                      <p className="text-3xl font-black text-red-600">{performanceMetrics.noAnswerCount}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${performanceMetrics.totalAssigned > 0 ? Math.min(100, (performanceMetrics.noAnswerCount / performanceMetrics.totalAssigned) * 100) : 0}%` }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Converted</p>
                      <p className="text-3xl font-black text-green-600">{performanceMetrics.convertedCount}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-600" style={{ width: `${performanceMetrics.totalAssigned > 0 ? Math.min(100, (performanceMetrics.convertedCount / performanceMetrics.totalAssigned) * 100) : 0}%` }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Connection Rate</p>
                      <p className="text-3xl font-black text-primary">{performanceMetrics.connectionRate.toFixed(1)}%</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, performanceMetrics.connectionRate)}%` }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Contact Rate</p>
                      <p className="text-3xl font-black text-primary">{performanceMetrics.contactRate.toFixed(1)}%</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, performanceMetrics.contactRate)}%` }} />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-1">Converted This Period</p>
                      <p className="text-3xl font-black text-green-600">{performanceMetrics.convertedThisPeriod}</p>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-600" style={{ width: `${performanceMetrics.totalAssigned > 0 ? Math.min(100, (performanceMetrics.convertedThisPeriod / performanceMetrics.totalAssigned) * 100) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, code, or phone..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    <span className="ml-2 text-sm text-gray-500 font-medium">Loading customers...</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-50">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">No customers found</div>
                      ) : (
                        filteredCustomers.map(c => (
                          <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openCustomerDetail(c)}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-900 truncate">{c.customer_name}</p>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.customer_code}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{c.mobile_number} {c.wedding_date ? `\u00B7 Wedding: ${c.wedding_date}` : ''}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getStatusBadge(c.customer_status)}`}>
                              {c.customer_status}
                            </span>
                            <button onClick={e => { e.stopPropagation(); openLogCallModal(c); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors flex-shrink-0" title="Log Call">
                              <PhoneCall className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {showCustomerDetail && selectedCustomer && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowCustomerDetail(false); setCustomerDetail(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <div>
                <h2 className="text-lg font-black text-primary">{selectedCustomer.customer_name}</h2>
                <p className="text-xs text-gray-500 font-medium">{selectedCustomer.customer_code}</p>
              </div>
              <button onClick={() => { setShowCustomerDetail(false); setCustomerDetail(null); }} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-100">
              {([
                { key: 'overview' as const, label: 'Overview' },
                { key: 'calls' as const, label: 'Call History' },
                { key: 'notes' as const, label: 'Notes' }
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCustomerDetailTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    customerDetailTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">Loading details...</span>
                </div>
              ) : (
                <>
                  {customerDetailTab === 'overview' && (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Name', value: selectedCustomer.customer_name },
                        { label: 'Phone', value: selectedCustomer.mobile_number },
                        { label: 'Email', value: selectedCustomer.email || '-' },
                        { label: 'Wedding Date', value: selectedCustomer.wedding_date || '-' },
                        { label: 'Shopping Date', value: selectedCustomer.expected_shopping_date || '-' },
                        { label: 'Category', value: selectedCustomer.preferred_shopping_category || '-' },
                        { label: 'Family Size', value: selectedCustomer.estimated_family_size || '-' },
                        { label: 'Assigned To', value: selectedCustomer.assigned_telecaller || '-' },
                        { label: 'Status', value: selectedCustomer.customer_status },
                        { label: 'Call Status', value: selectedCustomer.call_status || '-' },
                        { label: 'Follow-up Date', value: selectedCustomer.follow_up_date ? String(selectedCustomer.follow_up_date).slice(0, 10) : '-' },
                        { label: 'Preferred Time', value: selectedCustomer.preferred_call_time || '-' },
                        { label: 'Notes', value: selectedCustomer.customer_notes || '-' }
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.label}</p>
                          <p className="text-sm font-bold text-gray-900 mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {customerDetailTab === 'calls' && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {customerDetail?.callLogs && customerDetail.callLogs.length > 0 ? (
                        customerDetail.callLogs.map((log: CallLog) => (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                            <PhoneCall className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900">{log.call_date ? String(log.call_date).slice(0, 10) : ''}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{log.call_outcome}</span>
                              </div>
                              {log.remarks && <p className="text-xs text-gray-500 mt-1">{log.remarks}</p>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-6">No call history available</p>
                      )}
                    </div>
                  )}

                  {customerDetailTab === 'notes' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCustomer.customer_notes || 'No notes available'}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center gap-3 rounded-b-xl">
              <a
                href={`tel:${selectedCustomer.mobile_number}`}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
              <button
                onClick={() => { setShowCustomerDetail(false); setCustomerDetail(null); openLogCallModal(selectedCustomer); }}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                <PhoneCall className="w-4 h-4" />
                Log Call
              </button>
              <button
                onClick={() => { setShowCustomerDetail(false); setCustomerDetail(null); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogCallModal && selectedCustomer && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLogCallModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-primary">Log Call</h2>
                <p className="text-xs text-gray-500 font-medium">{selectedCustomer.customer_name}</p>
              </div>
              <button onClick={() => setShowLogCallModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveCallLog} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Call Status</label>
                <select
                  value={logForm.call_status}
                  onChange={e => setLogForm(p => ({ ...p, call_status: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {CALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Call Outcome</label>
                <select
                  value={logForm.call_outcome}
                  onChange={e => setLogForm(p => ({ ...p, call_outcome: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {CALL_OUTCOMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Remarks</label>
                <textarea
                  value={logForm.remarks}
                  onChange={e => setLogForm(p => ({ ...p, remarks: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  placeholder="Enter call remarks..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Next Follow-up Date</label>
                <input
                  type="date"
                  value={logForm.next_follow_up_date}
                  onChange={e => setLogForm(p => ({ ...p, next_follow_up_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Preferred Time</label>
                <select
                  value={logForm.next_follow_up_time}
                  onChange={e => setLogForm(p => ({ ...p, next_follow_up_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {CALL_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogCallModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  Save Call Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
