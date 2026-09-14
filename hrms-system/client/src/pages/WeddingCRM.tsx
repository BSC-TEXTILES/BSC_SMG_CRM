import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { API, Auth, UserSession } from '../services/api';
import {
  Sparkles,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Heart,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Star,
  MapPin,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Flame,
  ArrowRight,
  CalendarDays,
  CheckCheck
} from 'lucide-react';

interface WeddingCustomer {
  id: number;
  customer_code: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  customer_name: string;
  phone: string;
  alternate_phone?: string;
  city?: string;
  wedding_date?: string;
  bride_name?: string;
  groom_name?: string;
  customer_role?: string;
  estimated_budget?: number;
  shopping_categories?: string | string[];
  expected_shopping_date?: string;
  follow_up_date?: string;
  follow_up_priority?: 'Normal' | 'High' | 'Urgent';
  assigned_telecaller_id?: number;
  telecaller_name?: string;
  current_status: string;
  readiness_score: number;
  initial_notes?: string;
  total_calls_count?: number;
  last_call_date?: string;
  last_call_outcome?: string;
  last_call_notes?: string;
  created_at?: string;
}

interface WeddingStats {
  total_leads: number;
  due_today: number;
  overdue: number;
  upcoming_week: number;
  ready_to_shop: number;
  store_visit_planned: number;
  callback_requests: number;
  converted: number;
  lost: number;
}

interface CallLog {
  id: number;
  call_date: string;
  caller_name: string;
  call_status: string;
  outcome: string;
  call_notes: string;
  customer_feedback: string;
  readiness_score: number;
  next_follow_up_date: string;
}

const CATEGORY_OPTIONS = [
  'Pure Silk Sarees',
  'Bridal Lehengas',
  'Sherwanis & Suits',
  'Family Matching Sets',
  'Fancy & Designer Sarees',
  'Kids Ethnic Wear',
  'Shirting & Suiting',
  'Accessories & Dhotis'
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'New Lead': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Call Scheduled': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Follow-up in Progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Callback Requested': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Store Visit Planned': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Ready to Shop': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Converted': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300' },
  'Lost': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
};

export default function WeddingCRM() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'calling_desk' | 'calendar' | 'analytics'>('calling_desk');

  // Multi-location state
  const [selectedLocation, setSelectedLocation] = useState<number | ''>('');
  const [locations, setLocations] = useState<any[]>([]);

  // Telecallers list
  const [telecallers, setTelecallers] = useState<any[]>([]);

  // Statistics
  const [stats, setStats] = useState<WeddingStats>({
    total_leads: 0,
    due_today: 0,
    overdue: 0,
    upcoming_week: 0,
    ready_to_shop: 0,
    store_visit_planned: 0,
    callback_requests: 0,
    converted: 0,
    lost: 0
  });

  // Customer Register List
  const [customers, setCustomers] = useState<WeddingCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Calling Desk Queues
  const [callingDeskData, setCallingDeskData] = useState<{
    counts: { overdue: number; due_today: number; callbacks: number; upcoming: number };
    queues: {
      overdue: WeddingCustomer[];
      due_today: WeddingCustomer[];
      callbacks: WeddingCustomer[];
      upcoming: WeddingCustomer[];
    };
  }>({
    counts: { overdue: 0, due_today: 0, callbacks: 0, upcoming: 0 },
    queues: { overdue: [], due_today: [], callbacks: [], upcoming: [] }
  });
  const [activeDeskQueue, setActiveDeskQueue] = useState<'due_today' | 'overdue' | 'callbacks' | 'upcoming'>('due_today');
  const [loadingDesk, setLoadingDesk] = useState(false);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarData, setCalendarData] = useState<{
    days: Record<string, { follow_ups: number; expected_shoppings: number; customers: any[] }>;
    month: string;
  }>({ days: {}, month: '' });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCallLogModal, setShowCallLogModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<WeddingCustomer | null>(null);
  const [customerTimeline, setCustomerTimeline] = useState<CallLog[]>([]);

  // Duplicate Check Banner
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    customer_name: '',
    phone: '',
    alternate_phone: '',
    city: '',
    wedding_date: '',
    bride_name: '',
    groom_name: '',
    customer_role: 'Groom',
    estimated_budget: '',
    shopping_categories: [] as string[],
    expected_shopping_date: '',
    follow_up_date: '',
    follow_up_priority: 'Normal',
    assigned_telecaller_id: '',
    initial_notes: '',
    location_id: ''
  });

  const [callLogForm, setCallLogForm] = useState({
    call_status: 'Connected',
    outcome: 'Interested - Follow-up Required',
    call_notes: '',
    customer_feedback: '',
    readiness_score: 3,
    next_follow_up_date: '',
    assigned_telecaller_id: '',
    new_customer_status: ''
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check auth session
  useEffect(() => {
    const s = Auth.get();
    if (!s) {
      window.location.href = '/login';
      return;
    }
    setSession(s);
    if (!s.isGlobalAdmin && s.locationId) {
      setSelectedLocation(s.locationId);
      setAddForm(prev => ({ ...prev, location_id: String(s.locationId) }));
    }
  }, []);

  // Fetch Locations & Telecallers
  useEffect(() => {
    API.getLocations().then(res => {
      if (res && res.locations) setLocations(res.locations);
    }).catch(() => {});

    API.getWeddingTelecallers(selectedLocation || undefined).then(res => {
      if (res && res.telecallers) setTelecallers(res.telecallers);
    }).catch(() => {});
  }, [selectedLocation]);

  // Load Dashboard Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await API.getWeddingStats(selectedLocation || undefined);
      if (res && res.stats) setStats(res.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [selectedLocation]);

  // Load Customers
  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const res = await API.getWeddingCustomers({
        location_id: selectedLocation || undefined,
        date_filter: dateFilter,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        from_date: customFromDate || undefined,
        to_date: customToDate || undefined,
        limit: 100
      });
      if (res && res.customers) {
        setCustomers(res.customers);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [selectedLocation, dateFilter, statusFilter, searchQuery, customFromDate, customToDate]);

  // Load Calling Desk Queues
  const loadCallingDesk = useCallback(async () => {
    setLoadingDesk(true);
    try {
      const res = await API.getWeddingCallingDesk({
        location_id: selectedLocation || undefined
      });
      if (res && res.queues) {
        setCallingDeskData(res);
      }
    } catch (err) {
      console.error('Failed to load calling desk:', err);
    } finally {
      setLoadingDesk(false);
    }
  }, [selectedLocation]);

  // Load Calendar
  const loadCalendar = useCallback(async () => {
    try {
      const res = await API.getWeddingCalendar({
        month: calendarMonth,
        location_id: selectedLocation || undefined
      });
      if (res && res.calendar) {
        setCalendarData(res.calendar);
      }
    } catch (err) {
      console.error('Failed to load calendar:', err);
    }
  }, [calendarMonth, selectedLocation]);

  // Load Analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await API.getWeddingAnalytics({
        location_id: selectedLocation || undefined
      });
      if (res && res.analytics) {
        setAnalyticsData(res.analytics);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, [selectedLocation]);

  // Master refresh on location or tab change
  useEffect(() => {
    loadStats();
    if (activeTab === 'register') loadCustomers();
    else if (activeTab === 'calling_desk') loadCallingDesk();
    else if (activeTab === 'calendar') loadCalendar();
    else if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, selectedLocation, loadStats, loadCustomers, loadCallingDesk, loadCalendar, loadAnalytics]);

  // Real-time Duplicate Check on phone change
  const handlePhoneBlur = async (phone: string) => {
    if (!phone || phone.trim().length < 10) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const res = await API.checkWeddingDuplicate(phone.trim());
      if (res && res.exists) {
        setDuplicateWarning(res.existingCustomer);
      } else {
        setDuplicateWarning(null);
      }
    } catch (e) {
      setDuplicateWarning(null);
    }
  };

  // Handle Add Customer Submission
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.customer_name || !addForm.phone) {
      alert('Please fill customer name and phone number.');
      return;
    }
    if (!addForm.expected_shopping_date) {
      alert('Please provide the Expected Shopping Date.');
      return;
    }
    if (!addForm.follow_up_date) {
      alert('Please provide the Follow-up Date.');
      return;
    }

    try {
      const payload = {
        ...addForm,
        estimated_budget: addForm.estimated_budget ? parseFloat(addForm.estimated_budget) : null,
        location_id: addForm.location_id ? parseInt(addForm.location_id) : (session?.locationId || 1),
        assigned_telecaller_id: addForm.assigned_telecaller_id ? parseInt(addForm.assigned_telecaller_id) : null
      };

      const res = await API.createWeddingCustomer(payload);
      if (res && res.success) {
        showToast(`Wedding Customer ${res.customer.customer_code} created successfully!`);
        setShowAddModal(false);
        setDuplicateWarning(null);
        // Reset form
        setAddForm({
          customer_name: '',
          phone: '',
          alternate_phone: '',
          city: '',
          wedding_date: '',
          bride_name: '',
          groom_name: '',
          customer_role: 'Groom',
          estimated_budget: '',
          shopping_categories: [],
          expected_shopping_date: '',
          follow_up_date: '',
          follow_up_priority: 'Normal',
          assigned_telecaller_id: '',
          initial_notes: '',
          location_id: session?.locationId ? String(session.locationId) : ''
        });
        loadStats();
        if (activeTab === 'calling_desk') loadCallingDesk();
        else loadCustomers();
      } else {
        alert(res?.error || 'Failed to create wedding customer');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating customer');
    }
  };

  // Open Log Call Modal
  const openCallModal = (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setCallLogForm({
      call_status: 'Connected',
      outcome: 'Interested - Follow-up Required',
      call_notes: '',
      customer_feedback: '',
      readiness_score: cust.readiness_score || 3,
      next_follow_up_date: '',
      assigned_telecaller_id: cust.assigned_telecaller_id ? String(cust.assigned_telecaller_id) : '',
      new_customer_status: cust.current_status || ''
    });
    setShowCallLogModal(true);
  };

  // Submit Call Log
  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const payload = {
        customer_id: selectedCustomer.id,
        call_status: callLogForm.call_status,
        outcome: callLogForm.outcome,
        call_notes: callLogForm.call_notes,
        customer_feedback: callLogForm.customer_feedback,
        readiness_score: callLogForm.readiness_score,
        next_follow_up_date: callLogForm.next_follow_up_date || undefined,
        assigned_telecaller_id: callLogForm.assigned_telecaller_id ? parseInt(callLogForm.assigned_telecaller_id) : undefined,
        new_customer_status: callLogForm.new_customer_status || undefined
      };

      const res = await API.logWeddingCall(payload);
      if (res && res.success) {
        showToast(`Call logged for ${selectedCustomer.customer_name}. Next follow-up updated!`);
        setShowCallLogModal(false);
        loadStats();
        if (activeTab === 'calling_desk') loadCallingDesk();
        else if (activeTab === 'register') loadCustomers();
        // If profile modal is also open, reload timeline
        if (showProfileModal) {
          openProfileModal(selectedCustomer);
        }
      } else {
        alert(res?.error || 'Failed to log call');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving call log');
    }
  };

  // Open Customer Profile & Timeline
  const openProfileModal = async (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setShowProfileModal(true);
    try {
      const res = await API.getWeddingCustomerById(cust.id);
      if (res && res.customer) {
        setSelectedCustomer(res.customer);
        setCustomerTimeline(res.timeline || []);
      }
    } catch (e) {
      console.error('Error fetching customer profile:', e);
    }
  };

  // Open Edit Customer Modal
  const openEditModal = (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const res = await API.updateWeddingCustomer(selectedCustomer.id, selectedCustomer);
      if (res && res.success) {
        showToast('Customer details updated successfully.');
        setShowEditModal(false);
        loadCustomers();
        loadCallingDesk();
      } else {
        alert(res?.error || 'Failed to update customer');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating customer');
    }
  };

  // Delete customer (Admin only)
  const handleDeleteCustomer = async (cust: WeddingCustomer) => {
    if (!window.confirm(`Are you sure you want to remove customer ${cust.customer_name} (${cust.customer_code})?`)) {
      return;
    }
    try {
      const res = await API.deleteWeddingCustomer(cust.id);
      if (res && res.success) {
        showToast('Customer record deleted.');
        loadStats();
        loadCustomers();
        loadCallingDesk();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  // Copy phone helper
  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopySuccess(phone);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // Format dates
  const formatDate = (dStr?: string) => {
    if (!dStr) return '—';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  // Days difference
  const getDaysDiff = (dStr?: string) => {
    if (!dStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      const res = await API.getWeddingExportData({
        location_id: selectedLocation || undefined,
        status: statusFilter || undefined
      });
      if (!res || !res.customers || res.customers.length === 0) {
        alert('No data to export.');
        return;
      }

      const headers = [
        'Code', 'Location', 'Customer Name', 'Phone', 'Alt Phone', 'City',
        'Wedding Date', 'Bride Name', 'Groom Name', 'Role', 'Est. Budget',
        'Shopping Categories', 'Expected Shopping Date', 'Follow-up Date',
        'Priority', 'Status', 'Readiness Score (1-5)', 'Assigned Telecaller',
        'Total Calls', 'Last Call Outcome', 'Last Call Notes'
      ];

      const csvRows = [headers.join(',')];

      res.customers.forEach((c: any) => {
        const row = [
          `"${c.customer_code || ''}"`,
          `"${c.location_name || ''}"`,
          `"${(c.customer_name || '').replace(/"/g, '""')}"`,
          `"${c.phone || ''}"`,
          `"${c.alternate_phone || ''}"`,
          `"${(c.city || '').replace(/"/g, '""')}"`,
          `"${c.wedding_date ? c.wedding_date.slice(0, 10) : ''}"`,
          `"${(c.bride_name || '').replace(/"/g, '""')}"`,
          `"${(c.groom_name || '').replace(/"/g, '""')}"`,
          `"${c.customer_role || ''}"`,
          `"${c.estimated_budget || ''}"`,
          `"${(Array.isArray(c.shopping_categories) ? c.shopping_categories.join(';') : (c.shopping_categories || '')).replace(/"/g, '""')}"`,
          `"${c.expected_shopping_date ? c.expected_shopping_date.slice(0, 10) : ''}"`,
          `"${c.follow_up_date ? c.follow_up_date.slice(0, 10) : ''}"`,
          `"${c.follow_up_priority || ''}"`,
          `"${c.current_status || ''}"`,
          `"${c.readiness_score || ''}"`,
          `"${(c.telecaller_name || '').replace(/"/g, '""')}"`,
          `"${c.total_calls_count || 0}"`,
          `"${(c.last_call_outcome || '').replace(/"/g, '""')}"`,
          `"${(c.last_call_notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `BSC_Wedding_Customers_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to export data: ' + err.message);
    }
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8F5F1] text-gray-800 flex">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Topbar
          title="Wedding Customer Follow-up CRM"
          breadcrumbs={[
            { label: 'Store Operations', href: '/dashboard' },
            { label: 'Wedding Follow-up CRM' }
          ]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <div className="flex items-center gap-2">
              {/* Multi-location selector for Global Admin */}
              {session?.isGlobalAdmin && (
                <div className="flex items-center bg-[#4A1726]/10 rounded-lg p-1 border border-[#C6A15B]/30">
                  <span className="text-[11px] font-bold text-[#4A1726] px-2 uppercase tracking-wide">Location:</span>
                  <select
                    value={selectedLocation}
                    onChange={e => setSelectedLocation(e.target.value ? parseInt(e.target.value) : '')}
                    className="bg-white text-xs font-semibold text-[#4A1726] py-1 px-2.5 rounded-md border-0 focus:ring-2 focus:ring-[#C6A15B] shadow-xs cursor-pointer"
                  >
                    <option value="">🌐 All Locations</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Branch Badge for Single Location */}
              {!session?.isGlobalAdmin && session?.locationName && (
                <div className="bg-[#4A1726] text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <MapPin className="w-3.5 h-3.5 text-[#C6A15B]" />
                  <span>{session.locationName}</span>
                </div>
              )}

              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-[#4A1726] to-[#6A2338] text-[#F8F5F1] hover:from-[#38111D] hover:to-[#551B2C] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all hover:scale-102"
              >
                <Plus className="w-4 h-4 text-[#C6A15B]" />
                <span>Add Wedding Customer</span>
              </button>
            </div>
          }
        />

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-[200] bg-[#4A1726] border-2 border-[#C6A15B] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up">
              <CheckCircle2 className="w-5 h-5 text-[#C6A15B]" />
              <span className="text-sm font-semibold">{toastMessage}</span>
            </div>
          )}

          {/* ── 8 KPI Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* 1. Today's Follow-ups (Primary Pulse) */}
            <div
              onClick={() => {
                setActiveTab('calling_desk');
                setActiveDeskQueue('due_today');
              }}
              className="bg-white border-2 border-amber-400/80 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group hover:border-amber-500"
            >
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Due Today</span>
                <PhoneCall className="w-4 h-4 animate-bounce" />
              </div>
              <div className="text-2xl font-black text-[#4A1726]">{stats.due_today}</div>
              <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Calls to make today</div>
            </div>

            {/* 2. Overdue Calls (Critical Red) */}
            <div
              onClick={() => {
                setActiveTab('calling_desk');
                setActiveDeskQueue('overdue');
              }}
              className={`bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                stats.overdue > 0 ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-red-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Overdue</span>
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-red-700">{stats.overdue}</div>
              <div className="text-[10px] text-red-600 font-semibold mt-0.5">Missed follow-ups</div>
            </div>

            {/* 3. Callbacks Requested */}
            <div
              onClick={() => {
                setActiveTab('calling_desk');
                setActiveDeskQueue('callbacks');
              }}
              className="bg-white border border-purple-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-purple-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Callbacks</span>
                <PhoneForwarded className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-purple-800">{stats.callback_requests}</div>
              <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Requested to call back</div>
            </div>

            {/* 4. Ready to Shop */}
            <div
              onClick={() => {
                setActiveTab('register');
                setStatusFilter('Ready to Shop');
              }}
              className="bg-white border border-rose-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Ready to Shop</span>
                <Flame className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-800">{stats.ready_to_shop}</div>
              <div className="text-[10px] text-rose-600 font-semibold mt-0.5">High purchase intent</div>
            </div>

            {/* 5. Visit Planned */}
            <div
              onClick={() => {
                setActiveTab('register');
                setStatusFilter('Store Visit Planned');
              }}
              className="bg-white border border-emerald-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Visit Planned</span>
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-emerald-800">{stats.store_visit_planned}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Date confirmed</div>
            </div>

            {/* 6. Converted */}
            <div
              onClick={() => {
                setActiveTab('register');
                setStatusFilter('Converted');
              }}
              className="bg-white border border-teal-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-teal-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Converted</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-teal-800">{stats.converted}</div>
              <div className="text-[10px] text-teal-600 font-semibold mt-0.5">Shopped successfully</div>
            </div>

            {/* 7. Upcoming Week */}
            <div
              onClick={() => {
                setActiveTab('calling_desk');
                setActiveDeskQueue('upcoming');
              }}
              className="bg-white border border-blue-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Next 7 Days</span>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-blue-800">{stats.upcoming_week}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Upcoming calls</div>
            </div>

            {/* 8. Total Wedding Leads */}
            <div
              onClick={() => {
                setActiveTab('register');
                setStatusFilter('');
                setDateFilter('all');
              }}
              className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Leads</span>
                <Users className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-black text-[#4A1726]">{stats.total_leads}</div>
              <div className="text-[10px] text-gray-500 font-semibold mt-0.5">All registered leads</div>
            </div>
          </div>

          {/* ── Tabs Navigation ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveTab('calling_desk')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'calling_desk'
                    ? 'bg-[#4A1726] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <PhoneCall className="w-4 h-4 text-[#C6A15B]" />
                <span>Telecaller Calling Desk</span>
                {callingDeskData.counts.due_today > 0 && (
                  <span className="bg-amber-400 text-[#4A1726] text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {callingDeskData.counts.due_today}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('register')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'register'
                    ? 'bg-[#4A1726] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Heart className="w-4 h-4 text-[#C6A15B]" />
                <span>Customer Register</span>
                <span className="bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {stats.total_leads}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'calendar'
                    ? 'bg-[#4A1726] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-[#C6A15B]" />
                <span>Follow-up Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-[#4A1726] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-[#C6A15B]" />
                <span>Conversion Funnel & Analytics</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleExportCSV}
                className="bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handlePrint}
                className="bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-gray-500" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════ */}
          {/* TAB 1: TELECALLER CALLING DESK                         */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === 'calling_desk' && (
            <div className="space-y-4">
              {/* Queue Selector Tabs */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                <button
                  onClick={() => setActiveDeskQueue('due_today')}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    activeDeskQueue === 'due_today'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-amber-50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Due Today</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                    {callingDeskData.counts.due_today}
                  </span>
                </button>

                <button
                  onClick={() => setActiveDeskQueue('overdue')}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    activeDeskQueue === 'overdue'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-red-50'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Overdue Calls</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                    {callingDeskData.counts.overdue}
                  </span>
                </button>

                <button
                  onClick={() => setActiveDeskQueue('callbacks')}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    activeDeskQueue === 'callbacks'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-purple-50'
                  }`}
                >
                  <PhoneForwarded className="w-4 h-4" />
                  <span>Callback Requests</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                    {callingDeskData.counts.callbacks}
                  </span>
                </button>

                <button
                  onClick={() => setActiveDeskQueue('upcoming')}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    activeDeskQueue === 'upcoming'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-blue-50'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Upcoming (7 Days)</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                    {callingDeskData.counts.upcoming}
                  </span>
                </button>
              </div>

              {/* Calling Queue Cards Grid */}
              {loadingDesk ? (
                <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#C6A15B] mb-2" />
                  <p className="text-sm font-semibold">Loading telecaller queue...</p>
                </div>
              ) : callingDeskData.queues[activeDeskQueue].length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                  <CheckCheck className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                  <h3 className="text-base font-bold text-gray-800">Queue is Clear!</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                    No customers waiting in the{' '}
                    <span className="font-semibold text-[#4A1726]">{activeDeskQueue.replace('_', ' ')}</span> queue.
                    Great job staying on top of follow-ups!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {callingDeskData.queues[activeDeskQueue].map(cust => {
                    const shopDays = getDaysDiff(cust.expected_shopping_date);
                    const followDays = getDaysDiff(cust.follow_up_date);

                    return (
                      <div
                        key={cust.id}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between relative overflow-hidden"
                      >
                        {/* Top Indicator bar */}
                        <div
                          className={`absolute top-0 left-0 right-0 h-1.5 ${
                            activeDeskQueue === 'overdue'
                              ? 'bg-red-500'
                              : activeDeskQueue === 'due_today'
                              ? 'bg-amber-400'
                              : activeDeskQueue === 'callbacks'
                              ? 'bg-purple-500'
                              : 'bg-blue-500'
                          }`}
                        />

                        <div>
                          {/* Header: Code, Priority, Location */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              {cust.customer_code}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {cust.location_code && (
                                <span className="text-[10px] font-bold bg-[#4A1726]/10 text-[#4A1726] px-1.5 py-0.2 rounded">
                                  {cust.location_code}
                                </span>
                              )}
                              {cust.follow_up_priority === 'Urgent' && (
                                <span className="text-[10px] font-black bg-red-100 text-red-700 px-1.5 py-0.2 rounded">
                                  URGENT
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Customer Name & Role */}
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-black text-gray-900 leading-tight">
                                {cust.customer_name}
                              </h4>
                              <p className="text-xs text-gray-500 font-medium mt-0.5">
                                {cust.customer_role || 'Wedding Shopper'} • {cust.city || 'Local Customer'}
                              </p>
                            </div>
                            {/* Readiness Meter */}
                            <div className="text-right">
                              <div className="flex items-center gap-0.5 text-amber-500 justify-end">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      star <= (cust.readiness_score || 3)
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-gray-200'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] text-gray-400 font-bold">
                                Score: {cust.readiness_score || 3}/5
                              </span>
                            </div>
                          </div>

                          {/* Phone with Click-to-Call & Copy */}
                          <div className="mt-3 bg-[#F8F5F1] rounded-lg p-2 flex items-center justify-between border border-gray-200/80">
                            <a
                              href={`tel:${cust.phone}`}
                              className="text-sm font-black text-[#4A1726] hover:underline flex items-center gap-1.5 tracking-wide"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#C6A15B]" />
                              <span>{cust.phone}</span>
                            </a>
                            <button
                              onClick={() => copyPhone(cust.phone)}
                              className="text-gray-400 hover:text-gray-600 p-1"
                              title="Copy Phone"
                            >
                              {copySuccess === cust.phone ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Event & Shopping Dates (Strict Distinction) */}
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                                Expected Shopping
                              </span>
                              <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                                <ShoppingBag className="w-3 h-3 text-[#C6A15B]" />
                                {formatDate(cust.expected_shopping_date)}
                              </span>
                              {shopDays !== null && (
                                <span
                                  className={`text-[9.5px] font-bold block mt-0.5 ${
                                    shopDays < 0
                                      ? 'text-red-500'
                                      : shopDays <= 7
                                      ? 'text-amber-600'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {shopDays < 0
                                    ? `${Math.abs(shopDays)}d ago`
                                    : shopDays === 0
                                    ? 'Today!'
                                    : `in ${shopDays} days`}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                                Follow-up Due
                              </span>
                              <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-blue-500" />
                                {formatDate(cust.follow_up_date)}
                              </span>
                              {followDays !== null && (
                                <span
                                  className={`text-[9.5px] font-bold block mt-0.5 ${
                                    followDays < 0
                                      ? 'text-red-600 font-extrabold'
                                      : followDays === 0
                                      ? 'text-amber-600 font-extrabold'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {followDays < 0
                                    ? `${Math.abs(followDays)}d overdue`
                                    : followDays === 0
                                    ? 'Due Today'
                                    : `in ${followDays} days`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Last Call Summary */}
                          {cust.last_call_outcome ? (
                            <div className="mt-2.5 text-[11px] text-gray-600 bg-amber-50/50 p-2 rounded border border-amber-100">
                              <span className="font-bold text-amber-800">Last Outcome:</span>{' '}
                              {cust.last_call_outcome}
                              {cust.last_call_notes && (
                                <p className="text-[10px] text-gray-500 italic truncate mt-0.5">
                                  "{cust.last_call_notes}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2.5 text-[11px] text-gray-400 italic">
                              No calls logged yet. Initial lead.
                            </div>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => openProfileModal(cust)}
                            className="text-xs font-bold text-gray-600 hover:text-[#4A1726] flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Timeline</span>
                          </button>

                          <button
                            onClick={() => openCallModal(cust)}
                            className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-102"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Log Call</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* TAB 2: CUSTOMER REGISTER (FULL TABLE)                  */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === 'register' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search name, phone, code..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#C6A15B] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Date Quick Filter */}
                  <div>
                    <select
                      value={dateFilter}
                      onChange={e => setDateFilter(e.target.value)}
                      className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-[#C6A15B] focus:bg-white"
                    >
                      <option value="all">📅 All Dates</option>
                      <option value="today">Today's Follow-ups</option>
                      <option value="tomorrow">Tomorrow</option>
                      <option value="this_week">This Week</option>
                      <option value="next_week">Next Week</option>
                      <option value="overdue">Overdue Follow-ups</option>
                      <option value="custom">Custom Date Range</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-[#C6A15B] focus:bg-white"
                    >
                      <option value="">🔘 All Statuses</option>
                      <option value="New Lead">New Lead</option>
                      <option value="Call Scheduled">Call Scheduled</option>
                      <option value="Follow-up in Progress">Follow-up in Progress</option>
                      <option value="Callback Requested">Callback Requested</option>
                      <option value="Store Visit Planned">Store Visit Planned</option>
                      <option value="Ready to Shop">Ready to Shop</option>
                      <option value="Converted">Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>

                  {/* Custom From Date (if custom selected) */}
                  {dateFilter === 'custom' && (
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={e => setCustomFromDate(e.target.value)}
                      className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                    />
                  )}

                  {/* Custom To Date (if custom selected) */}
                  {dateFilter === 'custom' && (
                    <input
                      type="date"
                      value={customToDate}
                      onChange={e => setCustomToDate(e.target.value)}
                      className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                    />
                  )}

                  {/* Refresh / Filter Apply Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadCustomers}
                      className="w-full bg-[#4A1726] hover:bg-[#38111D] text-white py-1.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#C6A15B]" />
                      <span>Filter</span>
                    </button>
                    {(searchQuery || statusFilter || dateFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('');
                          setDateFilter('all');
                          setCustomFromDate('');
                          setCustomToDate('');
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 py-1.5 px-3 rounded-lg text-xs font-bold"
                        title="Reset Filters"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#4A1726] text-[#F8F5F1] uppercase text-[10px] tracking-wider font-extrabold border-b border-[#C6A15B]/30">
                      <tr>
                        <th className="py-3 px-3">Customer Code</th>
                        <th className="py-3 px-3">Customer Name & Contact</th>
                        <th className="py-3 px-3">Location</th>
                        <th className="py-3 px-3">Wedding Date</th>
                        <th className="py-3 px-3">Expected Shopping</th>
                        <th className="py-3 px-3">Follow-up Date</th>
                        <th className="py-3 px-3">Readiness</th>
                        <th className="py-3 px-3">Current Status</th>
                        <th className="py-3 px-3">Telecaller</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingCustomers ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-gray-500">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#C6A15B] mb-2" />
                            Loading customer directory...
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-gray-500">
                            <Heart className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                            <p className="font-semibold">No wedding customers found.</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Try changing filters or add a new wedding customer.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        customers.map(cust => {
                          const statusStyle = STATUS_COLORS[cust.current_status] || {
                            bg: 'bg-gray-100',
                            text: 'text-gray-700',
                            border: 'border-gray-200'
                          };
                          const shopDays = getDaysDiff(cust.expected_shopping_date);
                          const followDays = getDaysDiff(cust.follow_up_date);

                          return (
                            <tr key={cust.id} className="hover:bg-amber-50/20 transition-colors">
                              {/* Code */}
                              <td className="py-3 px-3 font-mono font-bold text-gray-700">
                                {cust.customer_code}
                              </td>

                              {/* Customer info */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-gray-900 leading-tight">
                                  {cust.customer_name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <a
                                    href={`tel:${cust.phone}`}
                                    className="text-xs font-semibold text-[#4A1726] hover:underline"
                                  >
                                    {cust.phone}
                                  </a>
                                  <button
                                    onClick={() => copyPhone(cust.phone)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    {copySuccess === cust.phone ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {cust.customer_role} {cust.city ? `• ${cust.city}` : ''}
                                </span>
                              </td>

                              {/* Location */}
                              <td className="py-3 px-3">
                                <span className="inline-block bg-[#4A1726]/10 text-[#4A1726] font-bold text-[10.5px] px-2 py-0.5 rounded">
                                  {cust.location_code || cust.location_name || 'Store'}
                                </span>
                              </td>

                              {/* Wedding Date */}
                              <td className="py-3 px-3">
                                <span className="font-semibold text-gray-800">
                                  {formatDate(cust.wedding_date)}
                                </span>
                                {(cust.bride_name || cust.groom_name) && (
                                  <span className="text-[10px] text-gray-400 block truncate max-w-[120px]">
                                    {cust.bride_name ? `B: ${cust.bride_name}` : ''}
                                    {cust.groom_name ? ` G: ${cust.groom_name}` : ''}
                                  </span>
                                )}
                              </td>

                              {/* Expected Shopping Date */}
                              <td className="py-3 px-3">
                                <span className="font-bold text-gray-900 block">
                                  {formatDate(cust.expected_shopping_date)}
                                </span>
                                {shopDays !== null && (
                                  <span
                                    className={`text-[9.5px] font-bold ${
                                      shopDays < 0
                                        ? 'text-red-500'
                                        : shopDays <= 7
                                        ? 'text-amber-600'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {shopDays < 0
                                      ? `${Math.abs(shopDays)}d ago`
                                      : shopDays === 0
                                      ? 'Today!'
                                      : `in ${shopDays} days`}
                                  </span>
                                )}
                              </td>

                              {/* Follow-up Date */}
                              <td className="py-3 px-3">
                                <span className="font-bold text-gray-900 block">
                                  {formatDate(cust.follow_up_date)}
                                </span>
                                {followDays !== null && (
                                  <span
                                    className={`text-[9.5px] font-extrabold ${
                                      followDays < 0
                                        ? 'text-red-600'
                                        : followDays === 0
                                        ? 'text-amber-600'
                                        : 'text-blue-600'
                                    }`}
                                  >
                                    {followDays < 0
                                      ? `${Math.abs(followDays)}d overdue`
                                      : followDays === 0
                                      ? 'Due Today'
                                      : `in ${followDays} days`}
                                  </span>
                                )}
                              </td>

                              {/* Readiness Score */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-0.5 text-amber-500">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                      key={star}
                                      className={`w-3 h-3 ${
                                        star <= (cust.readiness_score || 3)
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-gray-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-[10px] text-gray-400 font-bold block mt-0.5">
                                  {cust.readiness_score}/5
                                </span>
                              </td>

                              {/* Current Status */}
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                                >
                                  {cust.current_status}
                                </span>
                              </td>

                              {/* Telecaller */}
                              <td className="py-3 px-3">
                                <span className="text-gray-700 font-medium">
                                  {cust.telecaller_name || (
                                    <span className="text-gray-400 italic">Unassigned</span>
                                  )}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openCallModal(cust)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-md"
                                    title="Log Call"
                                  >
                                    <PhoneCall className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openProfileModal(cust)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-1.5 rounded-md"
                                    title="View Timeline Profile"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openEditModal(cust)}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-1.5 rounded-md"
                                    title="Edit Details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {(session?.role === 'Super Admin' || session?.role === 'Admin') && (
                                    <button
                                      onClick={() => handleDeleteCustomer(cust)}
                                      className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-md"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* TAB 3: DATE-WISE FOLLOW-UP CALENDAR                    */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              {/* Month Navigation */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#C6A15B]" />
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Follow-up & Expected Shopping Calendar
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={e => setCalendarMonth(e.target.value)}
                    className="py-1 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#4A1726]"
                  />
                  <button
                    onClick={loadCalendar}
                    className="bg-[#4A1726] text-white p-1.5 rounded-lg hover:bg-[#38111D]"
                    title="Reload Calendar"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#C6A15B]" />
                  </button>
                </div>
              </div>

              {/* Day Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 31 }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateKey = `${calendarMonth}-${String(dayNum).padStart(2, '0')}`;
                  const dayData = calendarData.days[dateKey];
                  const followUps = dayData?.follow_ups || 0;
                  const shoppings = dayData?.expected_shoppings || 0;
                  const isSelected = selectedCalendarDate === dateKey;

                  // Simple date check
                  const dObj = new Date(`${dateKey}T00:00:00`);
                  if (isNaN(dObj.getTime()) || dObj.getMonth() !== new Date(`${calendarMonth}-01T00:00:00`).getMonth()) {
                    return null;
                  }
                  const weekday = dObj.toLocaleDateString('en-US', { weekday: 'short' });

                  return (
                    <div
                      key={dateKey}
                      onClick={() => setSelectedCalendarDate(isSelected ? null : dateKey)}
                      className={`bg-white rounded-xl border p-3 cursor-pointer transition-all shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-[#4A1726] ring-2 ring-[#C6A15B]'
                          : followUps > 0 || shoppings > 0
                          ? 'border-amber-200 bg-amber-50/10'
                          : 'border-gray-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-gray-800">{dayNum}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{weekday}</span>
                      </div>

                      <div className="space-y-1">
                        {followUps > 0 && (
                          <div className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center justify-between">
                            <span>Follow-ups</span>
                            <span className="bg-amber-200 px-1 rounded">{followUps}</span>
                          </div>
                        )}
                        {shoppings > 0 && (
                          <div className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center justify-between">
                            <span>Shopping</span>
                            <span className="bg-emerald-200 px-1 rounded">{shoppings}</span>
                          </div>
                        )}
                        {followUps === 0 && shoppings === 0 && (
                          <div className="text-[10px] text-gray-300 italic py-1 text-center">—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Day Customer Preview */}
              {selectedCalendarDate && calendarData.days[selectedCalendarDate] && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-slide-up">
                  <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <h4 className="text-sm font-extrabold text-[#4A1726]">
                      Schedule for {formatDate(selectedCalendarDate)}
                    </h4>
                    <span className="text-xs text-gray-500 font-medium">
                      {calendarData.days[selectedCalendarDate].customers.length} customer(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {calendarData.days[selectedCalendarDate].customers.map((c: any) => (
                      <div
                        key={c.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-gray-900 text-xs">{c.customer_name}</div>
                          <div className="text-[11px] text-gray-500">{c.phone}</div>
                          <span
                            className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 ${
                              c.event_type === 'shopping'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.event_type === 'shopping' ? '🛍️ Expected Shopping' : '📞 Follow-up Call'}
                          </span>
                        </div>
                        <button
                          onClick={() => openCallModal(c)}
                          className="bg-[#4A1726] text-white p-2 rounded-lg hover:bg-[#38111D]"
                          title="Log Call"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-[#C6A15B]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* TAB 4: CONVERSION FUNNEL & ANALYTICS                   */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Funnel Visualisation */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-extrabold text-[#4A1726]">
                      Wedding Customer Conversion Funnel
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Stage-by-stage progression from store visit to successful wedding shopping purchase
                    </p>
                  </div>
                  <div className="bg-[#4A1726]/10 text-[#4A1726] px-3 py-1 rounded-lg text-xs font-extrabold">
                    Overall Conversion:{' '}
                    {stats.total_leads > 0
                      ? Math.round((stats.converted / stats.total_leads) * 100)
                      : 0}
                    %
                  </div>
                </div>

                {/* Horizontal Funnel Stages */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {/* Stage 1: New Leads */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
                      Stage 1: Visit Logged
                    </span>
                    <div className="text-3xl font-black text-blue-900 mt-2">{stats.total_leads}</div>
                    <p className="text-[11px] text-blue-600 font-semibold mt-1">100% of pipeline</p>
                  </div>

                  {/* Stage 2: Follow-up in Progress */}
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">
                      Stage 2: In Follow-up
                    </span>
                    <div className="text-3xl font-black text-amber-900 mt-2">
                      {stats.total_leads - stats.lost}
                    </div>
                    <p className="text-[11px] text-amber-600 font-semibold mt-1">Active leads</p>
                  </div>

                  {/* Stage 3: Store Visit Planned */}
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block">
                      Stage 3: Visit Planned
                    </span>
                    <div className="text-3xl font-black text-purple-900 mt-2">
                      {stats.store_visit_planned}
                    </div>
                    <p className="text-[11px] text-purple-600 font-semibold mt-1">Visit date fixed</p>
                  </div>

                  {/* Stage 4: Ready to Shop */}
                  <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">
                      Stage 4: Ready to Shop
                    </span>
                    <div className="text-3xl font-black text-rose-900 mt-2">{stats.ready_to_shop}</div>
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">High readiness score</p>
                  </div>

                  {/* Stage 5: Converted */}
                  <div className="bg-teal-50 border-2 border-teal-300 rounded-xl p-4 text-center shadow-xs">
                    <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider block">
                      Stage 5: Purchased! 🎉
                    </span>
                    <div className="text-3xl font-black text-teal-900 mt-2">{stats.converted}</div>
                    <p className="text-[11px] text-teal-700 font-bold mt-1">Successful conversions</p>
                  </div>
                </div>
              </div>

              {/* Telecaller Performance Table */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-[#4A1726]">
                    Telecaller Calling & Conversion Performance
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">Ranked by calls & conversion</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Telecaller</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3">Assigned Leads</th>
                        <th className="py-2.5 px-3">Total Calls Made</th>
                        <th className="py-2.5 px-3">Successful Conversions</th>
                        <th className="py-2.5 px-3">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analyticsData?.telecallers && analyticsData.telecallers.length > 0 ? (
                        analyticsData.telecallers.map((t: any) => {
                          const convRate =
                            t.assigned_leads > 0
                              ? Math.round((t.conversions / t.assigned_leads) * 100)
                              : 0;
                          return (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="py-3 px-3 font-bold text-gray-900">{t.name}</td>
                              <td className="py-3 px-3 font-semibold text-gray-600">{t.location_name}</td>
                              <td className="py-3 px-3 font-semibold text-gray-800">{t.assigned_leads}</td>
                              <td className="py-3 px-3 font-black text-[#4A1726]">{t.total_calls}</td>
                              <td className="py-3 px-3 font-black text-teal-700">{t.conversions}</td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-2 rounded-full"
                                      style={{ width: `${Math.min(convRate, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-extrabold text-gray-800">{convRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            No telecaller activity recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ══════════════════════════════════════════════════════ */}
        {/* MODAL 1: ADD WEDDING CUSTOMER                          */}
        {/* ══════════════════════════════════════════════════════ */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200 animate-slide-up">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-[#4A1726] to-[#6A2338] text-white rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#C6A15B]" />
                  <div>
                    <h3 className="text-base font-extrabold">Add Wedding Customer</h3>
                    <p className="text-xs text-[#F8F5F1]/80">
                      Record store visitor planning wedding shopping
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setDuplicateWarning(null);
                  }}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Duplicate Warning Banner */}
              {duplicateWarning && (
                <div className="bg-red-50 border-b border-red-200 p-3.5 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-extrabold text-red-800">Duplicate Customer Detected!</p>
                    <p className="text-red-700 mt-0.5">
                      Phone <span className="font-bold">{duplicateWarning.phone}</span> is already registered as{' '}
                      <span className="font-bold">{duplicateWarning.customer_name}</span> (Code:{' '}
                      {duplicateWarning.customer_code}) in {duplicateWarning.location_name}.
                    </p>
                  </div>
                </div>
              )}

              {/* Form Body */}
              <form onSubmit={handleCreateCustomer} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Location (if admin) */}
                  {session?.isGlobalAdmin && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Store Location *
                      </label>
                      <select
                        value={addForm.location_id}
                        onChange={e => setAddForm({ ...addForm, location_id: e.target.value })}
                        className="w-full text-xs font-semibold p-2 bg-gray-50 border border-gray-200 rounded-lg"
                        required
                      >
                        <option value="">Select Location</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Customer Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={addForm.customer_name}
                      onChange={e => setAddForm({ ...addForm, customer_name: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                      required
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Primary Phone Number *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9845012345"
                      value={addForm.phone}
                      onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                      onBlur={e => handlePhoneBlur(e.target.value)}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                      required
                    />
                  </div>

                  {/* Alternate Phone */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9845099999"
                      value={addForm.alternate_phone}
                      onChange={e => setAddForm({ ...addForm, alternate_phone: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">City / Town</label>
                    <input
                      type="text"
                      placeholder="e.g. Shivamogga, Bhadravathi"
                      value={addForm.city}
                      onChange={e => setAddForm({ ...addForm, city: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>

                  {/* Customer Role */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Customer Role in Wedding
                    </label>
                    <select
                      value={addForm.customer_role}
                      onChange={e => setAddForm({ ...addForm, customer_role: e.target.value })}
                      className="w-full text-xs font-semibold p-2 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <option value="Groom">Groom</option>
                      <option value="Bride">Bride</option>
                      <option value="Groom's Father/Mother">Groom's Father/Mother</option>
                      <option value="Bride's Father/Mother">Bride's Father/Mother</option>
                      <option value="Relative / Family Member">Relative / Family Member</option>
                      <option value="Friend">Friend</option>
                    </select>
                  </div>

                  {/* Wedding Date */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Wedding / Muhurtham Date
                    </label>
                    <input
                      type="date"
                      value={addForm.wedding_date}
                      onChange={e => setAddForm({ ...addForm, wedding_date: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>

                  {/* Bride Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Bride Name</label>
                    <input
                      type="text"
                      placeholder="Bride's name"
                      value={addForm.bride_name}
                      onChange={e => setAddForm({ ...addForm, bride_name: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>

                  {/* Groom Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Groom Name</label>
                    <input
                      type="text"
                      placeholder="Groom's name"
                      value={addForm.groom_name}
                      onChange={e => setAddForm({ ...addForm, groom_name: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>

                  {/* Estimated Budget */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Estimated Budget (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 50000, 100000"
                      value={addForm.estimated_budget}
                      onChange={e => setAddForm({ ...addForm, estimated_budget: e.target.value })}
                      className="w-full text-xs font-medium p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Follow-up Priority
                    </label>
                    <select
                      value={addForm.follow_up_priority}
                      onChange={e =>
                        setAddForm({
                          ...addForm,
                          follow_up_priority: e.target.value as any
                        })
                      }
                      className="w-full text-xs font-semibold p-2 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  {/* ── CORE DATE SEPARATION ─────────────────── */}
                  {/* Expected Shopping Date */}
                  <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                    <label className="block text-xs font-extrabold text-amber-900 mb-1">
                      🛍️ Expected Shopping Date *
                    </label>
                    <span className="text-[10px] text-amber-700 block mb-1.5">
                      When the customer says they will come back to shop
                    </span>
                    <input
                      type="date"
                      value={addForm.expected_shopping_date}
                      onChange={e => setAddForm({ ...addForm, expected_shopping_date: e.target.value })}
                      className="w-full text-xs font-bold p-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  {/* Follow-up Date */}
                  <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                    <label className="block text-xs font-extrabold text-blue-900 mb-1">
                      📞 Telecaller Follow-up Date *
                    </label>
                    <span className="text-[10px] text-blue-700 block mb-1.5">
                      When staff should call to remind / invite customer
                    </span>
                    <input
                      type="date"
                      value={addForm.follow_up_date}
                      onChange={e => setAddForm({ ...addForm, follow_up_date: e.target.value })}
                      className="w-full text-xs font-bold p-2 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Assigned Telecaller */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Assign Telecaller
                    </label>
                    <select
                      value={addForm.assigned_telecaller_id}
                      onChange={e => setAddForm({ ...addForm, assigned_telecaller_id: e.target.value })}
                      className="w-full text-xs font-semibold p-2 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <option value="">Unassigned (Open Queue)</option>
                      {telecallers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.role || 'Staff'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Shopping Categories (Multi-select) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Shopping Categories of Interest
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATEGORY_OPTIONS.map(cat => {
                        const isChecked = addForm.shopping_categories.includes(cat);
                        return (
                          <label
                            key={cat}
                            className={`flex items-center gap-1.5 p-2 rounded-lg text-[11px] font-semibold cursor-pointer border transition-all ${
                              isChecked
                                ? 'bg-[#4A1726]/10 border-[#4A1726] text-[#4A1726]'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setAddForm({
                                    ...addForm,
                                    shopping_categories: [...addForm.shopping_categories, cat]
                                  });
                                } else {
                                  setAddForm({
                                    ...addForm,
                                    shopping_categories: addForm.shopping_categories.filter(c => c !== cat)
                                  });
                                }
                              }}
                              className="rounded text-[#4A1726] focus:ring-[#C6A15B]"
                            />
                            <span>{cat}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visit Notes */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Store Visit Notes & Customer Preferences
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Liked Kanchipuram silk sarees in green shade, looking for 4 family matching dhotis..."
                      value={addForm.initial_notes}
                      onChange={e => setAddForm({ ...addForm, initial_notes: e.target.value })}
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setDuplicateWarning(null);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-[#4A1726] to-[#6A2338] text-white hover:from-[#38111D] hover:to-[#551B2C] rounded-lg text-xs font-extrabold shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#C6A15B]" />
                    <span>Save Wedding Customer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* MODAL 2: LOG CALL OUTCOME                              */}
        {/* ══════════════════════════════════════════════════════ */}
        {showCallLogModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-gray-200 animate-slide-up">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <PhoneCall className="w-5 h-5 text-emerald-200" />
                  <div>
                    <h3 className="text-base font-extrabold">Log Call Outcome</h3>
                    <p className="text-xs text-emerald-100">
                      Record telecaller discussion and next step
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCallLogModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Quick Summary */}
              <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-extrabold text-gray-900">{selectedCustomer.customer_name}</div>
                  <div className="text-gray-500 font-semibold">{selectedCustomer.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 font-bold uppercase">Expected Shopping</div>
                  <div className="font-extrabold text-[#4A1726]">
                    {formatDate(selectedCustomer.expected_shopping_date)}
                  </div>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveCallLog} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                {/* Call Status */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Call Connection Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Connected', 'Not Answered', 'Busy / Switched Off'].map(st => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setCallLogForm({ ...callLogForm, call_status: st })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                          callLogForm.call_status === st
                            ? 'bg-[#4A1726] text-white border-[#4A1726]'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outcome */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Call Outcome *</label>
                  <select
                    value={callLogForm.outcome}
                    onChange={e => {
                      const val = e.target.value;
                      let suggestedStatus = selectedCustomer.current_status;
                      if (val.includes('Confirmed Store Visit')) suggestedStatus = 'Store Visit Planned';
                      else if (val.includes('Ready to Shop')) suggestedStatus = 'Ready to Shop';
                      else if (val.includes('Callback Requested')) suggestedStatus = 'Callback Requested';
                      else if (val.includes('Already Purchased') || val.includes('Not Interested'))
                        suggestedStatus = 'Lost';
                      else if (val.includes('Purchased at BSC')) suggestedStatus = 'Converted';

                      setCallLogForm({
                        ...callLogForm,
                        outcome: val,
                        new_customer_status: suggestedStatus
                      });
                    }}
                    className="w-full text-xs font-semibold p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    required
                  >
                    <option value="Interested - Confirmed Store Visit">
                      ✅ Interested - Confirmed Store Visit
                    </option>
                    <option value="Interested - Follow-up Required">
                      💬 Interested - Follow-up Required
                    </option>
                    <option value="Ready to Shop Soon">🔥 Ready to Shop Soon</option>
                    <option value="Callback Requested">📞 Callback Requested</option>
                    <option value="Postponed Shopping / Muhurtham">
                      ⏳ Postponed Shopping / Muhurtham
                    </option>
                    <option value="Already Purchased at BSC (Converted)">
                      🎉 Already Purchased at BSC (Converted)
                    </option>
                    <option value="Already Purchased Elsewhere">
                      ❌ Already Purchased Elsewhere (Lost)
                    </option>
                    <option value="Not Interested / Budget Mismatch">
                      ⛔ Not Interested / Budget Mismatch (Lost)
                    </option>
                    <option value="No Answer - Try Again Later">
                      📵 No Answer - Try Again Later
                    </option>
                  </select>
                </div>

                {/* Readiness Score (1 to 5) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Customer Purchase Readiness Score (1-5)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(score => (
                      <button
                        type="button"
                        key={score}
                        onClick={() => setCallLogForm({ ...callLogForm, readiness_score: score })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold border transition-all flex items-center justify-center gap-1 ${
                          callLogForm.readiness_score === score
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-amber-50'
                        }`}
                      >
                        <Star className="w-3 h-3 fill-current" />
                        <span>{score}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    1 = Cold/Distant • 3 = Normal follow-up • 5 = Immediate buying intent
                  </span>
                </div>

                {/* Next Follow-up Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Next Follow-up Date (Schedule next call)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={callLogForm.next_follow_up_date}
                      onChange={e => setCallLogForm({ ...callLogForm, next_follow_up_date: e.target.value })}
                      className="flex-1 text-xs font-bold p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                    />
                    {/* Quick shortcuts */}
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 2);
                        setCallLogForm({
                          ...callLogForm,
                          next_follow_up_date: d.toISOString().slice(0, 10)
                        });
                      }}
                      className="text-[10px] font-extrabold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-2 rounded-lg"
                    >
                      +2 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setCallLogForm({
                          ...callLogForm,
                          next_follow_up_date: d.toISOString().slice(0, 10)
                        });
                      }}
                      className="text-[10px] font-extrabold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-2 rounded-lg"
                    >
                      +1 Week
                    </button>
                  </div>
                </div>

                {/* Update Overall Customer Status */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Update Overall Customer Status
                  </label>
                  <select
                    value={callLogForm.new_customer_status}
                    onChange={e => setCallLogForm({ ...callLogForm, new_customer_status: e.target.value })}
                    className="w-full text-xs font-semibold p-2 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="Follow-up in Progress">Follow-up in Progress</option>
                    <option value="Callback Requested">Callback Requested</option>
                    <option value="Store Visit Planned">Store Visit Planned</option>
                    <option value="Ready to Shop">Ready to Shop</option>
                    <option value="Converted">Converted (Shopped)</option>
                    <option value="Lost">Lost (Bought elsewhere / Dropped)</option>
                  </select>
                </div>

                {/* Call Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Call Notes & Customer Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Spoke to customer, said family is arriving next Tuesday, requested call on Monday morning..."
                    value={callLogForm.call_notes}
                    onChange={e => setCallLogForm({ ...callLogForm, call_notes: e.target.value })}
                    className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#C6A15B]"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCallLogModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg text-xs font-extrabold shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Save Call Log</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* MODAL 3: CUSTOMER PROFILE & TIMELINE                   */}
        {/* ══════════════════════════════════════════════════════ */}
        {showProfileModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200 animate-slide-up">
              {/* Profile Header */}
              <div className="p-5 bg-gradient-to-r from-[#4A1726] to-[#6A2338] text-white rounded-t-2xl flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded font-bold">
                      {selectedCustomer.customer_code}
                    </span>
                    <span className="text-[10px] font-extrabold bg-[#C6A15B] text-[#4A1726] px-2 py-0.5 rounded uppercase">
                      {selectedCustomer.current_status}
                    </span>
                  </div>
                  <h3 className="text-lg font-black mt-1.5">{selectedCustomer.customer_name}</h3>
                  <p className="text-xs text-white/80 font-medium">
                    {selectedCustomer.customer_role} • {selectedCustomer.city || 'Local Customer'}
                  </p>
                </div>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Details Bar */}
              <div className="bg-gray-50 border-b border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Phone</span>
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    className="font-bold text-[#4A1726] hover:underline"
                  >
                    {selectedCustomer.phone}
                  </a>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Wedding Date</span>
                  <span className="font-bold text-gray-800">{formatDate(selectedCustomer.wedding_date)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    Expected Shopping
                  </span>
                  <span className="font-bold text-gray-800">
                    {formatDate(selectedCustomer.expected_shopping_date)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Readiness</span>
                  <div className="flex items-center gap-0.5 text-amber-500 mt-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= (selectedCustomer.readiness_score || 3)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Body: Timeline of Calls */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">
                    Telecaller Interaction Timeline ({customerTimeline.length} calls)
                  </h4>
                  <button
                    onClick={() => openCallModal(selectedCustomer)}
                    className="bg-[#4A1726] hover:bg-[#38111D] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-[#C6A15B]" />
                    <span>Log New Call</span>
                  </button>
                </div>

                {customerTimeline.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-semibold">No call history recorded yet.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Use the "Log New Call" button to record the first conversation.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-[#C6A15B]/40 ml-3 space-y-4 py-2">
                    {customerTimeline.map(log => (
                      <div key={log.id} className="relative pl-6">
                        {/* Timeline dot */}
                        <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#4A1726] border-2 border-[#C6A15B]" />

                        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 text-xs shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold text-[#4A1726]">{log.outcome}</span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {formatDate(log.call_date)}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-500 mb-2">
                            Caller: <span className="font-bold text-gray-700">{log.caller_name}</span> •
                            Status: <span className="font-bold text-gray-700">{log.call_status}</span>
                          </div>

                          {log.call_notes && (
                            <p className="text-gray-700 bg-white p-2.5 rounded-lg border border-gray-100 text-xs italic">
                              "{log.call_notes}"
                            </p>
                          )}

                          {log.next_follow_up_date && (
                            <div className="mt-2 text-[10.5px] text-blue-700 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Scheduled Next Follow-up: {formatDate(log.next_follow_up_date)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* MODAL 4: EDIT CUSTOMER DETAILS                         */}
        {/* ══════════════════════════════════════════════════════ */}
        {showEditModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-gray-200 animate-slide-up">
              <div className="p-4 bg-gradient-to-r from-[#4A1726] to-[#6A2338] text-white rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#C6A15B]" />
                  <h3 className="text-sm font-extrabold">Edit Customer: {selectedCustomer.customer_code}</h3>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCustomer} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={selectedCustomer.customer_name}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, customer_name: e.target.value })}
                    className="w-full p-2 bg-gray-50 border rounded-lg font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={selectedCustomer.phone}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                    className="w-full p-2 bg-gray-50 border rounded-lg font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Expected Shopping Date</label>
                    <input
                      type="date"
                      value={selectedCustomer.expected_shopping_date ? selectedCustomer.expected_shopping_date.slice(0, 10) : ''}
                      onChange={e => setSelectedCustomer({ ...selectedCustomer, expected_shopping_date: e.target.value })}
                      className="w-full p-2 bg-gray-50 border rounded-lg font-bold text-amber-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={selectedCustomer.follow_up_date ? selectedCustomer.follow_up_date.slice(0, 10) : ''}
                      onChange={e => setSelectedCustomer({ ...selectedCustomer, follow_up_date: e.target.value })}
                      className="w-full p-2 bg-gray-50 border rounded-lg font-bold text-blue-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Status</label>
                    <select
                      value={selectedCustomer.current_status}
                      onChange={e => setSelectedCustomer({ ...selectedCustomer, current_status: e.target.value })}
                      className="w-full p-2 bg-gray-50 border rounded-lg font-semibold"
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Call Scheduled">Call Scheduled</option>
                      <option value="Follow-up in Progress">Follow-up in Progress</option>
                      <option value="Callback Requested">Callback Requested</option>
                      <option value="Store Visit Planned">Store Visit Planned</option>
                      <option value="Ready to Shop">Ready to Shop</option>
                      <option value="Converted">Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Priority</label>
                    <select
                      value={selectedCustomer.follow_up_priority || 'Normal'}
                      onChange={e => setSelectedCustomer({ ...selectedCustomer, follow_up_priority: e.target.value as any })}
                      className="w-full p-2 bg-gray-50 border rounded-lg font-semibold"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Estimated Budget (₹)</label>
                  <input
                    type="number"
                    value={selectedCustomer.estimated_budget || ''}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, estimated_budget: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-gray-50 border rounded-lg"
                  />
                </div>

                <div className="pt-3 border-t flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#4A1726] hover:bg-[#38111D] text-white rounded-lg font-extrabold shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
