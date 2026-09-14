import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
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
  CheckCheck,
  History,
  FileSpreadsheet,
  X,
  MessageSquare
} from 'lucide-react';

interface WeddingCustomer {
  id: number;
  customer_code: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  customer_name: string;
  mobile_number: string;
  phone?: string; // alias
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

interface WeddingStats {
  totalCustomers: number;
  todayFollowUps: number;
  overdueFollowUps: number;
  callsPending: number;
  callsCompleted: number;
  shoppingConfirmed: number;
  visitedConverted: number;
  notInterested: number;
}

interface CallLog {
  id: number;
  customer_id: number;
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

interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  details?: string;
  created_at: string;
}

const CUSTOMER_STATUSES = [
  'New',
  'Follow-up Pending',
  'Contacted',
  'Interested',
  'Shopping Date Confirmed',
  'Visited Store',
  'Converted',
  'Not Interested',
  'No Response',
  'Cancelled',
  'Closed'
];

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

const CATEGORY_OPTIONS = [
  'Pure Silk Sarees',
  'Bridal Lehengas',
  'Sherwanis & Suits',
  'Family Matching Sets',
  'Fancy & Designer Sarees',
  'Kids Ethnic Wear',
  'Shirting & Suiting',
  'Accessories & Dhotis',
  'General Wedding Shopping'
];

const CALL_TIME_OPTIONS = [
  'Morning (10 AM - 1 PM)',
  'Afternoon (1 PM - 4 PM)',
  'Evening (4 PM - 7 PM)',
  'Night (7 PM - 9 PM)',
  'Any Time'
];

export default function WeddingCRM() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [activeTab, setActiveTab] = useState<'calling_desk' | 'register' | 'calendar' | 'analytics'>('calling_desk');

  // Multi-location state
  const [selectedLocation, setSelectedLocation] = useState<number | ''>('');
  const [locations, setLocations] = useState<any[]>([
    { id: 1, name: 'Belagavi', code: 'BEL' },
    { id: 2, name: 'Davanagere', code: 'DAV' },
    { id: 3, name: 'Shivamogga', code: 'SHI' }
  ]);

  // Telecallers list
  const [telecallers, setTelecallers] = useState<any[]>([]);

  // 8 Dashboard KPI Stats
  const [stats, setStats] = useState<WeddingStats>({
    totalCustomers: 0,
    todayFollowUps: 0,
    overdueFollowUps: 0,
    callsPending: 0,
    callsCompleted: 0,
    shoppingConfirmed: 0,
    visitedConverted: 0,
    notInterested: 0
  });

  // Calling Desk State
  const [deskQueueType, setDeskQueueType] = useState<'overdue' | 'dueToday' | 'callbacks' | 'upcoming'>('dueToday');
  const [deskSummary, setDeskSummary] = useState({
    pendingCalls: 0,
    completedToday: 0,
    noAnswerCount: 0,
    callbackCount: 0,
    remainingCalls: 0
  });
  const [deskQueues, setDeskQueues] = useState<{
    overdue: WeddingCustomer[];
    dueToday: WeddingCustomer[];
    callbackRequests: WeddingCustomer[];
    upcoming: WeddingCustomer[];
  }>({
    overdue: [],
    dueToday: [],
    callbackRequests: [],
    upcoming: []
  });
  const [loadingDesk, setLoadingDesk] = useState(false);

  // Customer Directory / Register State
  const [customers, setCustomers] = useState<WeddingCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateViewFilter, setDateViewFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [callStatusFilter, setCallStatusFilter] = useState('');
  const [telecallerFilter, setTelecallerFilter] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Calendar State
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [monthCustomers, setMonthCustomers] = useState<WeddingCustomer[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<{
    funnel: any;
    outcomes: any[];
    telecallers: any[];
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Modals & Active Customer
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<WeddingCustomer | null>(null);
  const [customerCallLogs, setCustomerCallLogs] = useState<CallLog[]>([]);
  const [customerAuditLogs, setCustomerAuditLogs] = useState<AuditLog[]>([]);

  // Duplicate Check Alert State
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Customer Form
  const [addForm, setAddForm] = useState({
    customer_name: '',
    mobile_number: '',
    email: '',
    location_id: '',
    wedding_date: '',
    expected_shopping_date: '',
    preferred_shopping_category: 'General Wedding Shopping',
    estimated_family_size: '2',
    assigned_telecaller: '',
    assigned_telecaller_id: '',
    follow_up_date: '',
    preferred_call_time: 'Morning (10 AM - 1 PM)',
    customer_notes: ''
  });

  // Log Call Form
  const [logForm, setLogForm] = useState({
    call_date: new Date().toISOString().slice(0, 10),
    call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    call_status: 'Completed',
    call_outcome: 'Connected',
    remarks: '',
    next_follow_up_date: '',
    next_follow_up_time: 'Morning (10 AM - 1 PM)',
    expected_shopping_date: ''
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to sidebar collapse state
  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => setCollapsed(c));
    return unsub;
  }, []);

  // Initialize Auth & Location
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
    } else {
      // Default to Davanagere if global admin
      setSelectedLocation('');
    }

    // Set default addForm dates: Shopping in 30 days, Follow-up in 3 days
    const today = new Date();
    const fDate = new Date(today);
    fDate.setDate(today.getDate() + 3);
    const sDate = new Date(today);
    sDate.setDate(today.getDate() + 30);

    setAddForm(prev => ({
      ...prev,
      follow_up_date: fDate.toISOString().slice(0, 10),
      expected_shopping_date: sDate.toISOString().slice(0, 10)
    }));
  }, []);

  // Fetch Locations & Telecallers
  useEffect(() => {
    const defaultLocations = [
      { id: 1, name: 'Belagavi', code: 'BEL' },
      { id: 2, name: 'Davanagere', code: 'DAV' },
      { id: 3, name: 'Shivamogga', code: 'SHI' }
    ];

    if (typeof API.getLocations === 'function') {
      API.getLocations().then(res => {
        const list = res?.locations || res?.data?.locations;
        if (list && list.length > 0) {
          setLocations(list.map((l: any) => ({
            id: l.id,
            name: l.location_name || l.name,
            code: l.location_code || l.code
          })));
        } else {
          setLocations(defaultLocations);
        }
      }).catch(() => setLocations(defaultLocations));
    } else {
      setLocations(defaultLocations);
    }

    API.getWeddingTelecallers(selectedLocation || undefined).then(res => {
      const tc = res?.telecallers || res?.data?.telecallers;
      if (tc) {
        setTelecallers(tc);
      }
    }).catch(() => {});
  }, [selectedLocation]);

  // Load Dashboard Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await API.getWeddingStats(selectedLocation || undefined);
      const s = res?.stats || res?.data?.stats;
      if (s) {
        setStats({
          totalCustomers: Number(s.totalCustomers ?? s.total_customers) || 0,
          todayFollowUps: Number(s.todayFollowUps ?? s.due_today) || 0,
          overdueFollowUps: Number(s.overdueFollowUps ?? s.overdue) || 0,
          callsPending: Number(s.callsPending ?? s.calls_pending) || 0,
          callsCompleted: Number(s.callsCompleted ?? s.calls_completed) || 0,
          shoppingConfirmed: Number(s.shoppingConfirmed ?? s.shopping_confirmed) || 0,
          visitedConverted: Number(s.visitedConverted ?? s.visited_converted) || 0,
          notInterested: Number(s.notInterested ?? s.not_interested) || 0
        });
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [selectedLocation]);

  // Load Calling Desk Queues
  const loadCallingDesk = useCallback(async () => {
    setLoadingDesk(true);
    try {
      const res = await API.getWeddingCallingDesk({
        location_id: selectedLocation || undefined
      });
      const summary = res?.summary || res?.data?.summary;
      const queues = res?.queues || res?.data?.queues;
      if (summary) setDeskSummary(summary);
      if (queues) {
        setDeskQueues({
          overdue: queues.overdue || [],
          dueToday: queues.dueToday || queues.due_today || [],
          callbackRequests: queues.callbackRequests || queues.callbacks || [],
          upcoming: queues.upcoming || []
        });
      }
    } catch (err) {
      console.error('Failed to load calling desk:', err);
    } finally {
      setLoadingDesk(false);
    }
  }, [selectedLocation]);

  // Load Customer Directory / Register
  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const res = await API.getWeddingCustomers({
        location_id: selectedLocation || undefined,
        date_filter: dateViewFilter !== 'all' ? dateViewFilter : undefined,
        status: statusFilter || undefined,
        telecaller_id: telecallerFilter || undefined,
        search: searchQuery || undefined,
        from_date: customStartDate || undefined,
        to_date: customEndDate || undefined,
        limit: 100
      });
      const custList = res?.customers || res?.data?.customers;
      if (custList) {
        setCustomers(custList);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [selectedLocation, dateViewFilter, statusFilter, telecallerFilter, searchQuery, customStartDate, customEndDate]);

  // Load Calendar Data
  const loadCalendar = useCallback(async () => {
    try {
      const res = await API.getWeddingCalendar({
        month: `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`,
        location_id: selectedLocation || undefined
      });
      const days = res?.days || res?.data?.days;
      const cList = res?.customers || res?.data?.customers;
      if (days) setCalendarDays(days);
      if (cList) setMonthCustomers(cList);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    }
  }, [calendarYear, calendarMonth, selectedLocation]);

  // Load Analytics Data
  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await API.getWeddingAnalytics({
        location_id: selectedLocation || undefined
      });
      const ana = res?.data || res;
      if (ana) {
        setAnalyticsData(ana);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selectedLocation]);

  // Refresh tab data when activeTab or location changes
  useEffect(() => {
    loadStats();
    if (activeTab === 'calling_desk') loadCallingDesk();
    else if (activeTab === 'register') loadCustomers();
    else if (activeTab === 'calendar') loadCalendar();
    else if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, selectedLocation, loadStats, loadCallingDesk, loadCustomers, loadCalendar, loadAnalytics]);

  // Duplicate Check on Phone Blur
  const handlePhoneBlur = async (phone: string) => {
    if (!phone || phone.trim().length < 10) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const res = await API.checkWeddingDuplicate(phone.trim());
      if (res && res.exists) {
        setDuplicateWarning(res.customer || res.existingCustomer);
      } else {
        setDuplicateWarning(null);
      }
    } catch (e) {
      setDuplicateWarning(null);
    }
  };

  // Create Customer Handler
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.customer_name.trim() || !addForm.mobile_number.trim()) {
      alert('Customer Name and Mobile Number are required.');
      return;
    }
    if (!addForm.expected_shopping_date) {
      alert('Expected Shopping Date is required.');
      return;
    }
    if (!addForm.follow_up_date) {
      alert('Follow-up Date is required.');
      return;
    }

    try {
      const payload = {
        customer_name: addForm.customer_name.trim(),
        mobile_number: addForm.mobile_number.trim(),
        email: addForm.email.trim() || null,
        wedding_date: addForm.wedding_date || null,
        expected_shopping_date: addForm.expected_shopping_date,
        preferred_shopping_category: addForm.preferred_shopping_category,
        estimated_family_size: parseInt(addForm.estimated_family_size, 10) || 1,
        assigned_telecaller: addForm.assigned_telecaller || null,
        assigned_telecaller_id: addForm.assigned_telecaller_id ? parseInt(addForm.assigned_telecaller_id, 10) : null,
        follow_up_date: addForm.follow_up_date,
        preferred_call_time: addForm.preferred_call_time,
        customer_notes: addForm.customer_notes.trim() || null,
        location_id: addForm.location_id ? parseInt(addForm.location_id, 10) : (session?.locationId || 2)
      };

      const res = await API.createWeddingCustomer(payload);
      if (res && res.success) {
        showToast(`Wedding Customer added! Code: ${res.customer_code || res.customer?.customer_code}`);
        setShowAddModal(false);
        setDuplicateWarning(null);

        // Reset form
        setAddForm(prev => ({
          customer_name: '',
          mobile_number: '',
          email: '',
          location_id: session?.locationId ? String(session.locationId) : '',
          wedding_date: '',
          expected_shopping_date: prev.expected_shopping_date,
          preferred_shopping_category: 'General Wedding Shopping',
          estimated_family_size: '2',
          assigned_telecaller: '',
          assigned_telecaller_id: '',
          follow_up_date: prev.follow_up_date,
          preferred_call_time: 'Morning (10 AM - 1 PM)',
          customer_notes: ''
        }));

        loadStats();
        if (activeTab === 'calling_desk') loadCallingDesk();
        else loadCustomers();
      } else {
        alert(res?.message || res?.error || 'Failed to create customer');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating wedding customer');
    }
  };

  // Open Log Call Modal
  const openCallModal = (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setLogForm({
      call_date: new Date().toISOString().slice(0, 10),
      call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      call_status: 'Completed',
      call_outcome: 'Connected',
      remarks: '',
      next_follow_up_date: cust.follow_up_date || '',
      next_follow_up_time: cust.preferred_call_time || 'Morning (10 AM - 1 PM)',
      expected_shopping_date: cust.expected_shopping_date || ''
    });
    setShowLogCallModal(true);
  };

  // Submit Call Log
  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const payload = {
        customerId: selectedCustomer.id,
        customer_id: selectedCustomer.id,
        callDate: logForm.call_date,
        callTime: logForm.call_time,
        callStatus: logForm.call_status,
        callOutcome: logForm.call_outcome,
        remarks: logForm.remarks,
        nextFollowUpDate: logForm.call_outcome !== 'Not Interested' ? logForm.next_follow_up_date : null,
        nextFollowUpTime: logForm.call_outcome !== 'Not Interested' ? logForm.next_follow_up_time : null,
        expectedShoppingDate: logForm.call_outcome === 'Shopping Confirmed' ? logForm.expected_shopping_date : null
      };

      const res = await API.logWeddingCall(payload);
      if (res && res.success) {
        showToast(`Call outcome [${logForm.call_outcome}] logged for ${selectedCustomer.customer_name}!`);
        setShowLogCallModal(false);
        loadStats();
        if (activeTab === 'calling_desk') loadCallingDesk();
        else if (activeTab === 'register') loadCustomers();
        else if (activeTab === 'calendar') loadCalendar();

        if (showProfileModal) {
          openProfileModal(selectedCustomer);
        }
      } else {
        alert(res?.message || 'Failed to log call');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving call log');
    }
  };

  // Open Customer Profile Modal
  const openProfileModal = async (cust: WeddingCustomer) => {
    setSelectedCustomer(cust);
    setShowProfileModal(true);
    try {
      const res = await API.getWeddingCustomerById(cust.id);
      if (res && res.customer) {
        setSelectedCustomer(res.customer);
        setCustomerCallLogs(res.callLogs || res.timeline || []);
        setCustomerAuditLogs(res.auditLogs || []);
      }
    } catch (e) {
      console.error('Error fetching customer profile:', e);
    }
  };

  // Open Edit Customer Modal
  const openEditModal = (cust: WeddingCustomer) => {
    setSelectedCustomer({ ...cust });
    setShowEditModal(true);
  };

  // Submit Update Customer
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const res = await API.updateWeddingCustomer(selectedCustomer.id, selectedCustomer);
      if (res && res.success) {
        showToast('Customer profile updated successfully.');
        setShowEditModal(false);
        loadCustomers();
        loadCallingDesk();
        loadStats();
        if (showProfileModal) {
          openProfileModal(selectedCustomer);
        }
      } else {
        alert(res?.message || 'Failed to update customer');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating customer');
    }
  };

  // Soft Delete Customer
  const handleDeleteCustomer = async (cust: WeddingCustomer) => {
    if (!window.confirm(`Are you sure you want to archive customer ${cust.customer_name} (${cust.customer_code})? Historical call logs will be preserved.`)) {
      return;
    }
    try {
      const res = await API.deleteWeddingCustomer(cust.id);
      if (res && res.success) {
        showToast('Customer archived successfully.');
        setShowProfileModal(false);
        loadStats();
        loadCustomers();
        loadCallingDesk();
      } else {
        alert(res?.message || 'Failed to archive customer');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to archive customer');
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      const res = await API.getWeddingExportData({
        location_id: selectedLocation || undefined,
        status: statusFilter || undefined
      });
      const rows = res?.records || res?.customers || [];
      if (rows.length === 0) {
        alert('No records available to export.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Wedding Customers');

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `BSC_Wedding_CRM_${dateStr}.xlsx`);
      showToast('Excel report downloaded successfully.');
    } catch (err: any) {
      alert('Failed to export Excel: ' + err.message);
    }
  };

  // Export to PDF / Print Report
  const handleExportPDF = () => {
    const locName = locations.find(l => l.id === selectedLocation)?.name || (session?.isGlobalAdmin ? 'All Locations' : (session?.locationName || 'Davanagere'));
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to view printable PDF report.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BSC Wedding Customer Follow-up Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #321923; }
          .header { border-bottom: 3px solid #C6A15B; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .brand { font-size: 24px; font-weight: 900; color: #4A1726; }
          .tagline { font-size: 11px; color: #C6A15B; font-weight: bold; letter-spacing: 2px; }
          .meta { text-align: right; font-size: 12px; color: #666; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
          .kpi-card { background: #F8F5F1; border: 1px solid #EAE4DC; padding: 12px; border-radius: 8px; }
          .kpi-title { font-size: 11px; font-weight: bold; color: #7A726D; text-transform: uppercase; }
          .kpi-val { font-size: 20px; font-weight: 900; color: #4A1726; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th { background: #4A1726; color: #F8F5F1; padding: 8px 10px; text-align: left; font-weight: bold; }
          td { padding: 8px 10px; border-bottom: 1px solid #EAE4DC; }
          tr:nth-child(even) { background: #FAFAFA; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
          .badge-overdue { background: #FEE2E2; color: #991B1B; }
          .badge-confirmed { background: #D1FAE5; color: #065F46; }
          .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #EEE; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">BSC EXCLUSIVE TEXTILES</div>
            <div class="tagline">WEDDING CUSTOMER FOLLOW-UP REPORT</div>
          </div>
          <div class="meta">
            <div><strong>Location:</strong> ${locName}</div>
            <div><strong>Report Date:</strong> ${dateStr}</div>
            <div><strong>Generated By:</strong> ${session?.fullName || 'Staff'}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Customers</div>
            <div class="kpi-val">${stats.totalCustomers}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Due Today</div>
            <div class="kpi-val">${stats.todayFollowUps}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Overdue Calls</div>
            <div class="kpi-val" style="color:#B91C1C;">${stats.overdueFollowUps}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Shopping Confirmed</div>
            <div class="kpi-val" style="color:#047857;">${stats.shoppingConfirmed}</div>
          </div>
        </div>

        <h3>Active Wedding Customer Follow-up List</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th>Expected Shopping</th>
              <th>Next Follow-up</th>
              <th>Telecaller</th>
              <th>Customer Status</th>
              <th>Call Status</th>
            </tr>
          </thead>
          <tbody>
            ${customers.slice(0, 50).map(c => `
              <tr>
                <td>${c.customer_code}</td>
                <td><strong>${c.customer_name}</strong></td>
                <td>${c.mobile_number}</td>
                <td>${c.expected_shopping_date}</td>
                <td>${c.follow_up_date} ${c.overdue_days && c.overdue_days > 0 ? `<span class="badge badge-overdue">${c.overdue_days}d overdue</span>` : ''}</td>
                <td>${c.assigned_telecaller || 'Unassigned'}</td>
                <td>${c.customer_status}</td>
                <td>${c.call_status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          BSC Business Management System · Wedding CRM Module · Printed on ${new Date().toLocaleString('en-IN')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Helper copy phone
  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopySuccess(phone);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // Format Date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5F1] text-gray-800 flex relative selection:bg-[#C6A15B]/30">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
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
              {session?.isGlobalAdmin ? (
                <div className="flex items-center bg-[#4A1726]/10 rounded-xl p-1 border border-[#C6A15B]/40">
                  <span className="text-[11px] font-bold text-[#4A1726] px-2 uppercase tracking-wide">Location:</span>
                  <select
                    value={selectedLocation}
                    onChange={e => setSelectedLocation(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="bg-white text-xs font-bold text-[#4A1726] py-1 px-2.5 rounded-lg border-0 focus:ring-2 focus:ring-[#C6A15B] shadow-xs cursor-pointer"
                  >
                    <option value="">🌐 ALL LOCATIONS (BEL, DAV, SHI)</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        📍 {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-[#4A1726] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm border border-[#C6A15B]/30">
                  <MapPin className="w-3.5 h-3.5 text-[#C6A15B]" />
                  <span>📍 {session?.locationName?.toUpperCase() || 'DAVANAGERE'}</span>
                </div>
              )}

              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-[#4A1726] to-[#6A2338] hover:from-[#350E1A] hover:to-[#551B2C] text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform active:scale-95 border border-[#C6A15B]/50"
              >
                <Plus className="w-4 h-4 text-[#C6A15B]" />
                <span>Add Wedding Customer</span>
              </button>
            </div>
          }
        />

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
          {/* Toast Alert */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-[200] bg-[#4A1726] border-2 border-[#C6A15B] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up">
              <CheckCircle2 className="w-5 h-5 text-[#C6A15B] flex-shrink-0" />
              <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              8 DASHBOARD KPI CARDS (Manager Understands in < 10 Seconds)
             ════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* 1. Total Wedding Customers */}
            <div
              onClick={() => { setActiveTab('register'); setStatusFilter(''); setDateViewFilter('all'); }}
              className="bg-white border border-[#EAE4DC] hover:border-[#4A1726] rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[#7A726D] mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Total Customers</span>
                <Users className="w-4 h-4 text-[#4A1726] group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-[#4A1726]">{stats.totalCustomers}</div>
              <div className="text-[10px] text-[#7A726D] font-medium mt-0.5">All registered</div>
            </div>

            {/* 2. Today's Follow-ups (Primary Pulse KPI - Click opens Calling Desk) */}
            <div
              onClick={() => { setActiveTab('calling_desk'); setDeskQueueType('dueToday'); }}
              className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
            >
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Today's Calls</span>
                <PhoneCall className="w-4 h-4 text-amber-600 animate-bounce" />
              </div>
              <div className="text-2xl font-black text-amber-900">{stats.todayFollowUps}</div>
              <div className="text-[10px] text-amber-800 font-bold mt-0.5 flex items-center gap-1">
                <span>Primary Desk</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>

            {/* 3. Overdue Follow-ups */}
            <div
              onClick={() => { setActiveTab('calling_desk'); setDeskQueueType('overdue'); }}
              className={`rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group border ${
                stats.overdueFollowUps > 0 ? 'bg-red-50/70 border-red-300' : 'bg-white border-[#EAE4DC]'
              }`}
            >
              <div className="flex items-center justify-between text-red-600 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Overdue</span>
                <AlertCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-red-700">{stats.overdueFollowUps}</div>
              <div className="text-[10px] text-red-600 font-semibold mt-0.5">Calls missed</div>
            </div>

            {/* 4. Calls Pending */}
            <div
              onClick={() => { setActiveTab('calling_desk'); }}
              className="bg-white border border-[#EAE4DC] hover:border-orange-300 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-orange-600 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Calls Pending</span>
                <Clock className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-orange-700">{stats.callsPending}</div>
              <div className="text-[10px] text-orange-600 font-medium mt-0.5">To be completed</div>
            </div>

            {/* 5. Calls Completed */}
            <div
              onClick={() => { setActiveTab('register'); setCallStatusFilter('Completed'); }}
              className="bg-white border border-[#EAE4DC] hover:border-emerald-300 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Calls Completed</span>
                <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-emerald-700">{stats.callsCompleted}</div>
              <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Successfully logged</div>
            </div>

            {/* 6. Shopping Confirmed */}
            <div
              onClick={() => { setActiveTab('register'); setStatusFilter('Shopping Date Confirmed'); }}
              className="bg-white border border-[#EAE4DC] hover:border-blue-300 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Shopping Confirmed</span>
                <ShoppingBag className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-blue-800">{stats.shoppingConfirmed}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">High Intent</div>
            </div>

            {/* 7. Visited / Converted */}
            <div
              onClick={() => { setActiveTab('register'); setStatusFilter('Converted'); }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-teal-700 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Visited / Won</span>
                <Sparkles className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-teal-900">{stats.visitedConverted}</div>
              <div className="text-[10px] text-teal-700 font-bold mt-0.5">Conversion rate</div>
            </div>

            {/* 8. Not Interested */}
            <div
              onClick={() => { setActiveTab('register'); setStatusFilter('Not Interested'); }}
              className="bg-white border border-[#EAE4DC] hover:border-gray-400 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Not Interested</span>
                <XCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-gray-700">{stats.notInterested}</div>
              <div className="text-[10px] text-gray-500 font-medium mt-0.5">Closed / Opt-out</div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              PRIMARY NAVIGATION TABS
             ════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-2 rounded-2xl border border-[#EAE4DC] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveTab('calling_desk')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  activeTab === 'calling_desk'
                    ? 'bg-[#4A1726] text-white shadow-md'
                    : 'text-[#7A726D] hover:bg-[#F8F5F1] hover:text-[#4A1726]'
                }`}
              >
                <PhoneCall className={`w-4 h-4 ${activeTab === 'calling_desk' ? 'text-[#C6A15B]' : ''}`} />
                <span>WEDDING FOLLOW-UP DESK</span>
                {deskSummary.remainingCalls > 0 && (
                  <span className="bg-amber-400 text-[#321923] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {deskSummary.remainingCalls}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('register')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  activeTab === 'register'
                    ? 'bg-[#4A1726] text-white shadow-md'
                    : 'text-[#7A726D] hover:bg-[#F8F5F1] hover:text-[#4A1726]'
                }`}
              >
                <Users className={`w-4 h-4 ${activeTab === 'register' ? 'text-[#C6A15B]' : ''}`} />
                <span>Customer Register</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-bold">
                  {stats.totalCustomers}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  activeTab === 'calendar'
                    ? 'bg-[#4A1726] text-white shadow-md'
                    : 'text-[#7A726D] hover:bg-[#F8F5F1] hover:text-[#4A1726]'
                }`}
              >
                <CalendarDays className={`w-4 h-4 ${activeTab === 'calendar' ? 'text-[#C6A15B]' : ''}`} />
                <span>Follow-up Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-[#4A1726] text-white shadow-md'
                    : 'text-[#7A726D] hover:bg-[#F8F5F1] hover:text-[#4A1726]'
                }`}
              >
                <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-[#C6A15B]' : ''}`} />
                <span>Funnel & Performance</span>
              </button>
            </div>

            {/* Global Actions: Excel & PDF Exports */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
                title="Export current view to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="bg-white hover:bg-gray-50 text-[#4A1726] border border-[#EAE4DC] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
                title="Export printable PDF report"
              >
                <Printer className="w-3.5 h-3.5 text-[#C6A15B]" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              TAB 1: TELECALLER CALLING DESK ("WEDDING FOLLOW-UP DESK")
             ════════════════════════════════════════════════════════════ */}
          {activeTab === 'calling_desk' && (
            <div className="space-y-4">
              {/* Telecaller Metrics Banner */}
              <div className="bg-gradient-to-r from-[#4A1726] to-[#321923] text-white rounded-3xl p-5 shadow-lg border border-[#C6A15B]/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#C6A15B] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C6A15B]" />
                    <span>DAILY TELECALLING WORKLOAD</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#F8F5F1] mt-0.5">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {/* Counter Pills */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2 text-center">
                    <div className="text-[10px] font-bold uppercase text-white/70">Calls Pending</div>
                    <div className="text-lg font-black text-amber-400">{deskSummary.pendingCalls}</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2 text-center">
                    <div className="text-[10px] font-bold uppercase text-white/70">Calls Completed</div>
                    <div className="text-lg font-black text-emerald-400">{deskSummary.completedToday}</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2 text-center">
                    <div className="text-[10px] font-bold uppercase text-white/70">No Answer</div>
                    <div className="text-lg font-black text-rose-400">{deskSummary.noAnswerCount}</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2 text-center">
                    <div className="text-[10px] font-bold uppercase text-white/70">Callbacks</div>
                    <div className="text-lg font-black text-purple-300">{deskSummary.callbackCount}</div>
                  </div>
                  <div className="bg-[#C6A15B] text-[#321923] rounded-2xl px-4 py-2 text-center shadow-md">
                    <div className="text-[10px] font-black uppercase">Remaining Calls</div>
                    <div className="text-lg font-black">{deskSummary.remainingCalls}</div>
                  </div>
                </div>
              </div>

              {/* Prioritized Queues Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => setDeskQueueType('overdue')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    deskQueueType === 'overdue'
                      ? 'bg-red-50 border-red-400 ring-2 ring-red-400 shadow-sm'
                      : 'bg-white border-[#EAE4DC] hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-red-700">
                    <span className="text-xs font-black uppercase">1. Overdue</span>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-red-800 mt-1">{deskQueues.overdue.length}</div>
                  <div className="text-[10px] text-red-600 font-medium">Missed previous calls</div>
                </button>

                <button
                  onClick={() => setDeskQueueType('dueToday')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    deskQueueType === 'dueToday'
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400 shadow-sm'
                      : 'bg-white border-[#EAE4DC] hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-700">
                    <span className="text-xs font-black uppercase">2. Due Today</span>
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-amber-900 mt-1">{deskQueues.dueToday.length}</div>
                  <div className="text-[10px] text-amber-700 font-medium">Scheduled for today</div>
                </button>

                <button
                  onClick={() => setDeskQueueType('callbacks')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    deskQueueType === 'callbacks'
                      ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400 shadow-sm'
                      : 'bg-white border-[#EAE4DC] hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-purple-700">
                    <span className="text-xs font-black uppercase">3. Callback Requests</span>
                    <PhoneForwarded className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-purple-900 mt-1">{deskQueues.callbackRequests.length}</div>
                  <div className="text-[10px] text-purple-700 font-medium">Customer requested call</div>
                </button>

                <button
                  onClick={() => setDeskQueueType('upcoming')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    deskQueueType === 'upcoming'
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400 shadow-sm'
                      : 'bg-white border-[#EAE4DC] hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-blue-700">
                    <span className="text-xs font-black uppercase">4. Upcoming (Next 7d)</span>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-blue-900 mt-1">{deskQueues.upcoming.length}</div>
                  <div className="text-[10px] text-blue-700 font-medium">Pipeline follow-ups</div>
                </button>
              </div>

              {/* Customer Cards in Active Queue */}
              {loadingDesk ? (
                <div className="bg-white p-12 rounded-3xl border border-[#EAE4DC] text-center text-[#7A726D]">
                  <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#C6A15B] mb-2" />
                  <p className="text-sm font-bold">Loading telecalling queue...</p>
                </div>
              ) : (
                (() => {
                  const currentQueue =
                    deskQueueType === 'overdue' ? deskQueues.overdue :
                    deskQueueType === 'dueToday' ? deskQueues.dueToday :
                    deskQueueType === 'callbacks' ? deskQueues.callbackRequests :
                    deskQueues.upcoming;

                  if (currentQueue.length === 0) {
                    return (
                      <div className="bg-white p-12 rounded-3xl border border-[#EAE4DC] text-center">
                        <CheckCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                        <h3 className="text-base font-black text-[#4A1726]">All Clear! No Calls in this Queue</h3>
                        <p className="text-xs text-[#7A726D] mt-1">Great job! All follow-ups in this bucket are completed or none are scheduled.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {currentQueue.map((cust) => {
                        const isOverdue = cust.overdue_days && cust.overdue_days > 0;

                        return (
                          <div
                            key={cust.id}
                            className={`bg-white rounded-2xl p-4 border shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                              isOverdue ? 'border-red-300 bg-red-50/10' : 'border-[#EAE4DC]'
                            }`}
                          >
                            {/* Card Top: Code, Location, Status */}
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono bg-[#4A1726]/10 text-[#4A1726] font-bold px-2 py-0.5 rounded-md">
                                    {cust.customer_code}
                                  </span>
                                  {cust.location_name && (
                                    <span className="text-[10px] text-[#7A726D] font-semibold">
                                      📍 {cust.location_name}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  {cust.customer_status}
                                </span>
                              </div>

                              {/* Customer Name & Mobile */}
                              <div className="mb-2">
                                <h4 className="text-base font-black text-[#321923] tracking-tight">{cust.customer_name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <a
                                    href={`tel:${cust.mobile_number}`}
                                    className="text-xs font-black text-[#4A1726] hover:underline flex items-center gap-1"
                                    title="Click to dial"
                                  >
                                    <Phone className="w-3 h-3 text-[#C6A15B]" />
                                    <span>{cust.mobile_number}</span>
                                  </a>
                                  <button
                                    onClick={() => copyPhone(cust.mobile_number)}
                                    className="text-[10px] text-gray-400 hover:text-gray-700"
                                    title="Copy mobile number"
                                  >
                                    {copySuccess === cust.mobile_number ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>

                              {/* Dates Matrix: Crucial Distinction */}
                              <div className="bg-[#F8F5F1] p-2.5 rounded-xl space-y-1.5 text-[11px] border border-[#EAE4DC]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#7A726D] font-semibold flex items-center gap-1">
                                    <ShoppingBag className="w-3 h-3 text-blue-600" />
                                    <span>Expected Shopping:</span>
                                  </span>
                                  <span className="font-black text-blue-900">{formatDate(cust.expected_shopping_date)}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-[#7A726D] font-semibold flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-600" />
                                    <span>Next Follow-up:</span>
                                  </span>
                                  <div className="text-right">
                                    <span className="font-black text-[#4A1726]">{formatDate(cust.follow_up_date)}</span>
                                    {isOverdue && (
                                      <span className="ml-1 text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                                        {cust.overdue_days}d overdue
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {cust.wedding_date && (
                                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                                    <span>Wedding Date:</span>
                                    <span className="font-bold">{formatDate(cust.wedding_date)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Last Call Result & Telecaller */}
                              <div className="mt-2.5 text-[11px] text-[#7A726D] space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span>Last Call Result:</span>
                                  <span className="font-bold text-[#321923]">{cust.last_call_outcome || 'No Calls Yet'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Assigned Telecaller:</span>
                                  <span className="font-bold text-[#4A1726]">{cust.assigned_telecaller || 'Unassigned'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons: [ Call ], [ Log Call ], [ View ] */}
                            <div className="mt-4 pt-3 border-t border-[#EAE4DC] flex items-center gap-2">
                              <a
                                href={`tel:${cust.mobile_number}`}
                                onClick={() => openCallModal(cust)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center py-2 rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1 transition-all"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Call</span>
                              </a>

                              <button
                                onClick={() => openCallModal(cust)}
                                className="flex-1 bg-[#4A1726] hover:bg-[#321923] text-white py-2 rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1 transition-all"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-[#C6A15B]" />
                                <span>Log Call</span>
                              </button>

                              <button
                                onClick={() => openProfileModal(cust)}
                                className="p-2 border border-[#EAE4DC] hover:bg-gray-100 rounded-xl text-[#321923]"
                                title="View Customer Profile"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 2: CUSTOMER REGISTER / DIRECTORY
             ════════════════════════════════════════════════════════════ */}
          {activeTab === 'register' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-[#EAE4DC] shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-[#7A726D]" />
                    <input
                      type="text"
                      placeholder="Search name, mobile, email, code..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B] focus:border-transparent font-medium"
                    />
                  </div>

                  {/* Customer Status Filter */}
                  <div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-[#EAE4DC] rounded-xl font-medium focus:ring-2 focus:ring-[#C6A15B]"
                    >
                      <option value="">All Customer Statuses</option>
                      {CUSTOMER_STATUSES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Call Status Filter */}
                  <div>
                    <select
                      value={callStatusFilter}
                      onChange={e => setCallStatusFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-[#EAE4DC] rounded-xl font-medium focus:ring-2 focus:ring-[#C6A15B]"
                    >
                      <option value="">All Call Statuses</option>
                      {CALL_STATUSES.map(cs => (
                        <option key={cs} value={cs}>{cs}</option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned Telecaller Filter */}
                  <div>
                    <select
                      value={telecallerFilter}
                      onChange={e => setTelecallerFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-[#EAE4DC] rounded-xl font-medium focus:ring-2 focus:ring-[#C6A15B]"
                    >
                      <option value="">All Assigned Telecallers</option>
                      {telecallers.map(tc => (
                        <option key={tc.id} value={tc.full_name}>{tc.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Follow-up Quick Date Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EAE4DC]">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-[#7A726D] mr-1">Follow-up:</span>
                    {[
                      { key: 'all', label: 'All Dates' },
                      { key: 'today', label: 'Today' },
                      { key: 'tomorrow', label: 'Tomorrow' },
                      { key: 'overdue', label: 'Overdue' },
                      { key: 'this_week', label: 'This Week' },
                      { key: 'next_week', label: 'Next Week' },
                      { key: 'custom', label: 'Custom' }
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onClick={() => setDateViewFilter(btn.key)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          dateViewFilter === btn.key
                            ? 'bg-[#4A1726] text-white'
                            : 'bg-[#F8F5F1] text-[#7A726D] hover:bg-[#EAE4DC]'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {dateViewFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="text-xs border border-[#EAE4DC] rounded-xl px-2.5 py-1"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="text-xs border border-[#EAE4DC] rounded-xl px-2.5 py-1"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Directory Table */}
              <div className="bg-white rounded-2xl border border-[#EAE4DC] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#4A1726] text-[#F8F5F1] font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Customer ID</th>
                        <th className="p-3">Customer Name & Phone</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Expected Shopping</th>
                        <th className="p-3">Next Follow-up</th>
                        <th className="p-3">Customer Status</th>
                        <th className="p-3">Call Status</th>
                        <th className="p-3">Assigned Telecaller</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE4DC]">
                      {loadingCustomers ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-gray-400">
                            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-[#C6A15B]" />
                            <span>Loading wedding customers...</span>
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-gray-400">
                            No wedding customers match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        customers.map((c) => {
                          const isOverdue = c.overdue_days && c.overdue_days > 0;

                          return (
                            <tr key={c.id} className="hover:bg-[#F8F5F1]/80 transition-colors">
                              <td className="p-3 font-mono font-bold text-[#4A1726]">
                                {c.customer_code}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-[#321923] text-xs">{c.customer_name}</div>
                                <div className="text-[11px] text-[#7A726D] flex items-center gap-1.5 mt-0.5">
                                  <span>{c.mobile_number}</span>
                                  <button
                                    onClick={() => copyPhone(c.mobile_number)}
                                    title="Copy mobile"
                                    className="text-gray-400 hover:text-gray-700"
                                  >
                                    {copySuccess === c.mobile_number ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 font-semibold text-[#7A726D]">
                                📍 {c.location_name || 'Davanagere'}
                              </td>
                              <td className="p-3 font-black text-blue-900">
                                {formatDate(c.expected_shopping_date)}
                              </td>
                              <td className="p-3">
                                <div className="font-black text-[#321923]">{formatDate(c.follow_up_date)}</div>
                                {isOverdue && (
                                  <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded-full">
                                    {c.overdue_days}d overdue
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  {c.customer_status}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                                  {c.call_status}
                                </span>
                              </td>
                              <td className="p-3 font-medium text-[#4A1726]">
                                {c.assigned_telecaller || 'Unassigned'}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openCallModal(c)}
                                    className="p-1.5 bg-[#4A1726] hover:bg-[#321923] text-white rounded-lg transition-all"
                                    title="Log Call"
                                  >
                                    <PhoneCall className="w-3.5 h-3.5 text-[#C6A15B]" />
                                  </button>

                                  <button
                                    onClick={() => openProfileModal(c)}
                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                                    title="View Profile"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => openEditModal(c)}
                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                                    title="Edit Details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {(session?.isGlobalAdmin || session?.role === 'Admin' || session?.role === 'Super Admin') && (
                                    <button
                                      onClick={() => handleDeleteCustomer(c)}
                                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                      title="Archive Customer"
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

          {/* ════════════════════════════════════════════════════════════
              TAB 3: FOLLOW-UP CALENDAR
             ════════════════════════════════════════════════════════════ */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border border-[#EAE4DC] shadow-xs">
                {/* Calendar Month Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-black text-[#4A1726]">
                      {new Date(calendarYear, calendarMonth - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-xs text-[#7A726D]">Follow-up schedule and customer workload</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (calendarMonth === 1) {
                          setCalendarMonth(12);
                          setCalendarYear(calendarYear - 1);
                        } else {
                          setCalendarMonth(calendarMonth - 1);
                        }
                      }}
                      className="p-2 border border-[#EAE4DC] rounded-xl hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#4A1726]" />
                    </button>

                    <button
                      onClick={() => {
                        setCalendarYear(new Date().getFullYear());
                        setCalendarMonth(new Date().getMonth() + 1);
                      }}
                      className="px-3 py-1.5 text-xs font-bold border border-[#EAE4DC] rounded-xl hover:bg-gray-50"
                    >
                      Today
                    </button>

                    <button
                      onClick={() => {
                        if (calendarMonth === 12) {
                          setCalendarMonth(1);
                          setCalendarYear(calendarYear + 1);
                        } else {
                          setCalendarMonth(calendarMonth + 1);
                        }
                      }}
                      className="p-2 border border-[#EAE4DC] rounded-xl hover:bg-gray-50"
                    >
                      <ChevronRight className="w-4 h-4 text-[#4A1726]" />
                    </button>
                  </div>
                </div>

                {/* Calendar Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs mb-4 pb-3 border-b border-[#EAE4DC]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="font-semibold text-gray-700">Overdue</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="font-semibold text-gray-700">Due Today</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-semibold text-gray-700">Upcoming</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-gray-700">Completed</span>
                  </div>
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center font-black text-[11px] text-[#7A726D] uppercase py-1">
                      {d}
                    </div>
                  ))}

                  {(() => {
                    const firstDayIdx = new Date(calendarYear, calendarMonth - 1, 1).getDay();
                    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
                    const cells = [];

                    // Leading empty slots
                    for (let i = 0; i < firstDayIdx; i++) {
                      cells.push(<div key={`empty-${i}`} className="min-h-[85px] bg-gray-50/50 rounded-2xl border border-transparent" />);
                    }

                    // Actual month days
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayInfo = calendarDays.find(d => d.date === dateStr);
                      const isToday = dateStr === new Date().toISOString().slice(0, 10);
                      const isSelected = selectedCalendarDate === dateStr;

                      cells.push(
                        <div
                          key={dateStr}
                          onClick={() => setSelectedCalendarDate(dateStr)}
                          className={`min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#4A1726] ring-2 ring-[#C6A15B] bg-amber-50/30'
                              : isToday
                              ? 'border-amber-400 bg-amber-50/20'
                              : 'border-[#EAE4DC] bg-white hover:border-[#C6A15B]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black ${isToday ? 'bg-[#4A1726] text-white px-1.5 py-0.5 rounded-md' : 'text-[#321923]'}`}>
                              {day}
                            </span>
                            {dayInfo && dayInfo.total > 0 && (
                              <span className="text-[10px] font-mono font-bold text-gray-500">
                                {dayInfo.total} calls
                              </span>
                            )}
                          </div>

                          {dayInfo && (
                            <div className="space-y-0.5 mt-1 text-[9.5px]">
                              {dayInfo.overdue_count > 0 && (
                                <div className="bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded-md">
                                  {dayInfo.overdue_count} overdue
                                </div>
                              )}
                              {dayInfo.today_count > 0 && (
                                <div className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-md">
                                  {dayInfo.today_count} today
                                </div>
                              )}
                              {dayInfo.shopping_confirmed_count > 0 && (
                                <div className="bg-blue-100 text-blue-900 font-bold px-1.5 py-0.2 rounded-md">
                                  {dayInfo.shopping_confirmed_count} shop confirmed
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return cells;
                  })()}
                </div>
              </div>

              {/* Selected Date Detail Drawer / Table */}
              {selectedCalendarDate && (
                <div className="bg-white p-5 rounded-3xl border-2 border-[#C6A15B]/40 shadow-md animate-slide-up space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-[#4A1726]">
                        Follow-ups Scheduled for {formatDate(selectedCalendarDate)}
                      </h4>
                      <p className="text-xs text-[#7A726D]">Click any customer to log call or inspect profile</p>
                    </div>
                    <button
                      onClick={() => setSelectedCalendarDate(null)}
                      className="p-1 text-gray-400 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(() => {
                    const filtered = monthCustomers.filter(c => c.follow_up_date === selectedCalendarDate);
                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-gray-500 py-3">No follow-ups scheduled for this date.</p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                        {filtered.map(c => (
                          <div key={c.id} className="p-3 bg-[#F8F5F1] rounded-2xl border border-[#EAE4DC] flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xs text-[#321923]">{c.customer_name}</div>
                              <div className="text-[11px] text-[#7A726D]">{c.mobile_number}</div>
                              <div className="text-[10px] text-blue-800 font-bold mt-0.5">
                                Shopping: {formatDate(c.expected_shopping_date)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => openCallModal(c)}
                                className="px-2.5 py-1.5 bg-[#4A1726] text-white text-xs font-bold rounded-xl"
                              >
                                Call
                              </button>
                              <button
                                onClick={() => openProfileModal(c)}
                                className="p-1.5 bg-white border border-[#EAE4DC] rounded-xl text-gray-600 hover:text-[#4A1726]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 4: ANALYTICS & TELECALLER PERFORMANCE
             ════════════════════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">
              {loadingAnalytics ? (
                <div className="bg-white p-12 rounded-3xl border border-[#EAE4DC] text-center text-[#7A726D]">
                  <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#C6A15B] mb-2" />
                  <p className="text-sm font-bold">Computing conversion funnels & performance...</p>
                </div>
              ) : (
                <>
                  {/* Conversion Funnel */}
                  <div className="bg-white p-6 rounded-3xl border border-[#EAE4DC] shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-black text-[#4A1726]">Wedding Customer Conversion Funnel</h3>
                        <p className="text-xs text-[#7A726D]">Step-by-step conversion tracking from initial lead to store visit and purchase</p>
                      </div>
                      <span className="text-xs font-bold text-[#C6A15B]">BSC CRM Intelligence</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Total Customers', val: analyticsData?.funnel?.total_customers || 0, color: 'bg-[#4A1726] text-white' },
                        { label: 'Contacted', val: analyticsData?.funnel?.contacted || 0, color: 'bg-indigo-700 text-white' },
                        { label: 'Interested', val: analyticsData?.funnel?.interested || 0, color: 'bg-purple-700 text-white' },
                        { label: 'Shopping Confirmed', val: analyticsData?.funnel?.shopping_confirmed || 0, color: 'bg-blue-700 text-white' },
                        { label: 'Visited Store', val: analyticsData?.funnel?.visited || 0, color: 'bg-emerald-600 text-white' },
                        { label: 'Converted', val: analyticsData?.funnel?.converted || 0, color: 'bg-teal-700 text-white' }
                      ].map((step, idx) => (
                        <div key={step.label} className="bg-[#F8F5F1] p-4 rounded-2xl border border-[#EAE4DC] flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#7A726D]">
                            <span>Step {idx + 1}</span>
                            {idx < 5 && <ArrowRight className="w-3 h-3 text-[#C6A15B]" />}
                          </div>
                          <div className="my-2">
                            <div className="text-2xl font-black text-[#321923]">{step.val}</div>
                            <div className="text-xs font-black text-[#4A1726] mt-0.5">{step.label}</div>
                          </div>
                          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${step.color}`}
                              style={{
                                width: `${
                                  analyticsData?.funnel?.total_customers > 0
                                    ? Math.round((step.val / analyticsData.funnel.total_customers) * 100)
                                    : 0
                                }%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Telecaller Performance Scorecard */}
                  <div className="bg-white rounded-3xl border border-[#EAE4DC] shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-[#EAE4DC]">
                      <h3 className="text-base font-black text-[#4A1726]">Telecaller Workload & Performance Scorecard</h3>
                      <p className="text-xs text-[#7A726D]">Calls completed, conversion results, and pending follow-ups per telecaller</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#4A1726] text-[#F8F5F1] font-black uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3">Telecaller Name</th>
                            <th className="p-3 text-center">Assigned Customers</th>
                            <th className="p-3 text-center">Calls Completed</th>
                            <th className="p-3 text-center">Connected</th>
                            <th className="p-3 text-center">No Answer</th>
                            <th className="p-3 text-center">Callbacks</th>
                            <th className="p-3 text-center">Interested</th>
                            <th className="p-3 text-center">Shopping Confirmed</th>
                            <th className="p-3 text-center">Conversions</th>
                            <th className="p-3 text-center">Pending Follow-ups</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE4DC]">
                          {analyticsData?.telecallers?.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-gray-400">
                                No telecaller performance data recorded yet.
                              </td>
                            </tr>
                          ) : (
                            analyticsData?.telecallers?.map((tc: any) => (
                              <tr key={tc.telecaller} className="hover:bg-[#F8F5F1]/80 transition-colors font-medium">
                                <td className="p-3 font-bold text-[#4A1726]">{tc.telecaller}</td>
                                <td className="p-3 text-center font-bold">{tc.assigned_customers}</td>
                                <td className="p-3 text-center font-bold text-emerald-700">{tc.calls_completed}</td>
                                <td className="p-3 text-center">{tc.connected}</td>
                                <td className="p-3 text-center text-rose-600 font-semibold">{tc.no_answer}</td>
                                <td className="p-3 text-center text-purple-700 font-semibold">{tc.callbacks}</td>
                                <td className="p-3 text-center">{tc.interested}</td>
                                <td className="p-3 text-center font-bold text-blue-700">{tc.shopping_confirmed}</td>
                                <td className="p-3 text-center font-black text-teal-800">{tc.conversions}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    tc.pending_followups > 0 ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {tc.pending_followups}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL: ADD WEDDING CUSTOMER (With Realtime Duplicate Check)
         ════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-[#C6A15B]/30 overflow-hidden my-6 animate-scale-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#4A1726] to-[#321923] text-white p-5 flex items-center justify-between border-b border-[#C6A15B]/30">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#C6A15B]" />
                <div>
                  <h3 className="text-base font-black text-[#F8F5F1]">Add Wedding Customer</h3>
                  <p className="text-[11px] text-[#C6A15B] font-semibold">Store visit walk-in record & follow-up scheduler</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Duplicate Mobile Warning Banner */}
            {duplicateWarning && (
              <div className="bg-amber-50 border-b border-amber-300 p-3.5 flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <strong>Customer already exists:</strong> {duplicateWarning.customer_name} ({duplicateWarning.customer_code})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    openProfileModal(duplicateWarning);
                  }}
                  className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-colors"
                >
                  View Existing Customer
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Name * */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">
                    Customer Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patil"
                    value={addForm.customer_name}
                    onChange={e => setAddForm({ ...addForm, customer_name: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B]"
                  />
                </div>

                {/* Mobile Number * */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">
                    Mobile Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={15}
                    placeholder="10-digit mobile number"
                    value={addForm.mobile_number}
                    onChange={e => {
                      setAddForm({ ...addForm, mobile_number: e.target.value });
                    }}
                    onBlur={e => handlePhoneBlur(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B]"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={addForm.email}
                    onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B]"
                  />
                </div>

                {/* Location (Auto-populated for branch, dropdown for Global Admin) */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Store Location</label>
                  {session?.isGlobalAdmin ? (
                    <select
                      value={addForm.location_id}
                      onChange={e => setAddForm({ ...addForm, location_id: e.target.value })}
                      className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B]"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={session?.locationName || 'Davanagere'}
                      className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl bg-gray-100 text-gray-600"
                    />
                  )}
                </div>

                {/* Wedding Date */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Wedding Date</label>
                  <input
                    type="date"
                    value={addForm.wedding_date}
                    onChange={e => setAddForm({ ...addForm, wedding_date: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B]"
                  />
                </div>

                {/* Expected Shopping Date * (Strictly distinguished from follow-up) */}
                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                  <label className="block text-xs font-black text-blue-900 mb-1 flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Expected Shopping Date <span className="text-red-600">*</span></span>
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.expected_shopping_date}
                    onChange={e => setAddForm({ ...addForm, expected_shopping_date: e.target.value })}
                    className="w-full text-xs font-bold p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  <span className="text-[10px] text-blue-700 mt-1 block">When customer plans to shop in store</span>
                </div>

                {/* Follow-up Date * (When telecaller must call) */}
                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
                  <label className="block text-xs font-black text-amber-900 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Follow-up Date <span className="text-red-600">*</span></span>
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.follow_up_date}
                    onChange={e => setAddForm({ ...addForm, follow_up_date: e.target.value })}
                    className="w-full text-xs font-bold p-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <span className="text-[10px] text-amber-800 mt-1 block">When telecaller will make follow-up call</span>
                </div>

                {/* Preferred Call Time */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Preferred Call Time</label>
                  <select
                    value={addForm.preferred_call_time}
                    onChange={e => setAddForm({ ...addForm, preferred_call_time: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl"
                  >
                    {CALL_TIME_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Preferred Shopping Category */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Shopping Category</label>
                  <select
                    value={addForm.preferred_shopping_category}
                    onChange={e => setAddForm({ ...addForm, preferred_shopping_category: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl"
                  >
                    {CATEGORY_OPTIONS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Estimated Family Size */}
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Estimated Family Size</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={addForm.estimated_family_size}
                    onChange={e => setAddForm({ ...addForm, estimated_family_size: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl"
                  />
                </div>

                {/* Assigned Telecaller */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-[#321923] mb-1">Assigned Telecaller</label>
                  <select
                    value={addForm.assigned_telecaller_id}
                    onChange={e => {
                      const id = e.target.value;
                      const selected = telecallers.find(t => String(t.id) === id);
                      setAddForm({
                        ...addForm,
                        assigned_telecaller_id: id,
                        assigned_telecaller: selected ? selected.full_name : ''
                      });
                    }}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl"
                  >
                    <option value="">Assign to Telecaller (or unassigned)</option>
                    {telecallers.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.full_name} ({tc.role})</option>
                    ))}
                  </select>
                </div>

                {/* Customer Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-[#321923] mb-1">Customer Notes / Preferences</label>
                  <textarea
                    rows={2}
                    placeholder="Specific bridal colors, family requirements, store visit context..."
                    value={addForm.customer_notes}
                    onChange={e => setAddForm({ ...addForm, customer_notes: e.target.value })}
                    className="w-full text-xs font-medium p-2.5 border border-[#EAE4DC] rounded-xl"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-[#EAE4DC] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#EAE4DC] text-xs font-bold rounded-xl hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#4A1726] hover:bg-[#321923] text-white text-xs font-black rounded-xl shadow-md transition-all"
                >
                  Save Wedding Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: LOG CALL OUTCOME (Fast, Minimal Clicks)
         ════════════════════════════════════════════════════════════ */}
      {showLogCallModal && selectedCustomer && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#C6A15B]/40 overflow-hidden my-6 animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#4A1726] to-[#321923] text-white p-5 flex items-center justify-between border-b border-[#C6A15B]/30">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-5 h-5 text-[#C6A15B]" />
                <div>
                  <h3 className="text-base font-black text-[#F8F5F1]">Log Call Outcome</h3>
                  <p className="text-[11px] text-[#C6A15B] font-semibold">{selectedCustomer.customer_name} ({selectedCustomer.mobile_number})</p>
                </div>
              </div>
              <button onClick={() => setShowLogCallModal(false)} className="text-white/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCallLog} className="p-6 space-y-4">
              {/* Call Status & Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Call Status</label>
                  <select
                    value={logForm.call_status}
                    onChange={e => setLogForm({ ...logForm, call_status: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 border border-[#EAE4DC] rounded-xl"
                  >
                    {CALL_STATUSES.map(cs => (
                      <option key={cs} value={cs}>{cs}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#321923] mb-1">Call Outcome *</label>
                  <select
                    value={logForm.call_outcome}
                    onChange={e => setLogForm({ ...logForm, call_outcome: e.target.value })}
                    className="w-full text-xs font-bold p-2.5 border border-[#C6A15B] rounded-xl bg-amber-50/40 text-[#4A1726]"
                  >
                    {CALL_OUTCOMES.map(co => (
                      <option key={co} value={co}>{co}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic condition: If Shopping Confirmed -> Ask Expected Shopping Date */}
              {logForm.call_outcome === 'Shopping Confirmed' && (
                <div className="bg-blue-50 border border-blue-300 p-3 rounded-2xl animate-fade-in">
                  <label className="block text-xs font-black text-blue-900 mb-1 flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Confirmed Expected Shopping Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={logForm.expected_shopping_date}
                    onChange={e => setLogForm({ ...logForm, expected_shopping_date: e.target.value })}
                    className="w-full text-xs font-bold p-2 border border-blue-400 rounded-xl bg-white"
                  />
                  <p className="text-[10px] text-blue-700 mt-1">Customer will be marked as Shopping Date Confirmed.</p>
                </div>
              )}

              {/* Dynamic condition: If No Answer, Call Back Requested, or Interested -> Ask Next Follow-up Date */}
              {logForm.call_outcome !== 'Not Interested' && (
                <div className="bg-amber-50/60 border border-amber-300 p-3 rounded-2xl space-y-2.5 animate-fade-in">
                  <label className="block text-xs font-black text-amber-900 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Next Follow-up Date & Time</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={logForm.next_follow_up_date}
                      onChange={e => setLogForm({ ...logForm, next_follow_up_date: e.target.value })}
                      className="text-xs font-semibold p-2 border border-amber-300 rounded-xl bg-white"
                    />
                    <select
                      value={logForm.next_follow_up_time}
                      onChange={e => setLogForm({ ...logForm, next_follow_up_time: e.target.value })}
                      className="text-xs font-semibold p-2 border border-amber-300 rounded-xl bg-white"
                    >
                      {CALL_TIME_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-xs font-black text-[#321923] mb-1">Remarks & Telecaller Notes</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Record customer response, shopping plans, family requirements..."
                  value={logForm.remarks}
                  onChange={e => setLogForm({ ...logForm, remarks: e.target.value })}
                  className="w-full text-xs font-medium p-2.5 border border-[#EAE4DC] rounded-xl focus:ring-2 focus:ring-[#C6A15B]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#EAE4DC] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLogCallModal(false)}
                  className="px-4 py-2 border border-[#EAE4DC] text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all"
                >
                  Complete & Save Call Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: CUSTOMER PROFILE & TIMELINE (No Page Reload)
         ════════════════════════════════════════════════════════════ */}
      {showProfileModal && selectedCustomer && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-[#C6A15B]/40 overflow-hidden my-6 animate-scale-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#4A1726] to-[#321923] text-white p-5 flex items-center justify-between border-b border-[#C6A15B]/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-[#C6A15B] text-[#321923] px-2 py-0.5 rounded-md">
                    {selectedCustomer.customer_code}
                  </span>
                  <h3 className="text-base font-black text-[#F8F5F1]">{selectedCustomer.customer_name}</h3>
                </div>
                <p className="text-[11px] text-[#C6A15B] mt-0.5">
                  📍 {selectedCustomer.location_name || 'Davanagere'} · Registered {formatDate(selectedCustomer.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    openEditModal(selectedCustomer);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1 border border-white/20"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Customer</span>
                </button>

                <button
                  onClick={() => openCallModal(selectedCustomer)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Log Call</span>
                </button>

                <button onClick={() => setShowProfileModal(false)} className="text-white/70 hover:text-white p-1 ml-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Content Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F8F5F1] p-3 rounded-2xl border border-[#EAE4DC]">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Customer Status</div>
                  <div className="text-xs font-black text-[#4A1726] mt-0.5">{selectedCustomer.customer_status}</div>
                </div>

                <div className="bg-[#F8F5F1] p-3 rounded-2xl border border-[#EAE4DC]">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Call Status</div>
                  <div className="text-xs font-black text-gray-800 mt-0.5">{selectedCustomer.call_status}</div>
                </div>

                <div className="bg-[#F8F5F1] p-3 rounded-2xl border border-[#EAE4DC]">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Expected Shopping</div>
                  <div className="text-xs font-black text-blue-900 mt-0.5">{formatDate(selectedCustomer.expected_shopping_date)}</div>
                </div>

                <div className="bg-[#F8F5F1] p-3 rounded-2xl border border-[#EAE4DC]">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Next Follow-up</div>
                  <div className="text-xs font-black text-amber-900 mt-0.5">{formatDate(selectedCustomer.follow_up_date)}</div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contact & Wedding Details */}
                <div className="bg-white p-4 rounded-2xl border border-[#EAE4DC] space-y-2">
                  <h4 className="font-black text-[#4A1726] text-xs uppercase tracking-wide border-b border-[#EAE4DC] pb-1.5">
                    Customer & Wedding Details
                  </h4>
                  <div className="space-y-1.5 text-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mobile Number:</span>
                      <span className="font-bold">{selectedCustomer.mobile_number}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email:</span>
                        <span className="font-medium">{selectedCustomer.email}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Wedding Date:</span>
                      <span className="font-bold">{formatDate(selectedCustomer.wedding_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shopping Category:</span>
                      <span className="font-bold text-[#4A1726]">{selectedCustomer.preferred_shopping_category || 'General Wedding Shopping'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Family Size:</span>
                      <span className="font-bold">{selectedCustomer.estimated_family_size || 1} members</span>
                    </div>
                  </div>
                </div>

                {/* Follow-up & Telecaller Details */}
                <div className="bg-white p-4 rounded-2xl border border-[#EAE4DC] space-y-2">
                  <h4 className="font-black text-[#4A1726] text-xs uppercase tracking-wide border-b border-[#EAE4DC] pb-1.5">
                    Telecaller Assignment & Notes
                  </h4>
                  <div className="space-y-1.5 text-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Assigned Telecaller:</span>
                      <span className="font-bold text-[#4A1726]">{selectedCustomer.assigned_telecaller || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Preferred Call Time:</span>
                      <span className="font-medium">{selectedCustomer.preferred_call_time || 'Any Time'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Calls Made:</span>
                      <span className="font-black">{selectedCustomer.total_calls_count || 0}</span>
                    </div>
                    {selectedCustomer.customer_notes && (
                      <div className="pt-1.5 border-t border-[#EAE4DC]">
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Notes:</span>
                        <p className="text-gray-800 italic mt-0.5">{selectedCustomer.customer_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Call History Timeline (Chronological) */}
              <div className="space-y-3">
                <h4 className="font-black text-[#4A1726] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#C6A15B]" />
                  <span>Call History Timeline</span>
                </h4>

                {customerCallLogs.length === 0 ? (
                  <div className="bg-[#F8F5F1] p-4 rounded-2xl border border-[#EAE4DC] text-center text-gray-500">
                    No calls logged for this customer yet.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-3 border-l-2 border-[#C6A15B]/40">
                    {customerCallLogs.map((log) => (
                      <div key={log.id} className="relative bg-white p-3 rounded-2xl border border-[#EAE4DC] shadow-2xs">
                        <div className="absolute -left-[31px] top-3.5 w-3 h-3 rounded-full bg-[#C6A15B] border-2 border-white" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-[#4A1726]">{formatDate(log.call_date)}</span>
                            <span className="text-[10px] text-gray-500">{log.call_time}</span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                              {log.call_outcome}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500">by {log.telecaller_name}</span>
                        </div>
                        {log.remarks && (
                          <p className="text-xs text-gray-700 mt-1.5 bg-[#F8F5F1] p-2 rounded-xl border border-[#EAE4DC]">
                            "{log.remarks}"
                          </p>
                        )}
                        {log.next_follow_up_date && (
                          <div className="text-[10px] text-amber-800 font-bold mt-1">
                            Next Follow-up Scheduled: {formatDate(log.next_follow_up_date)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Log Trail */}
              {customerAuditLogs.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-[#EAE4DC]">
                  <h4 className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">
                    Audit Trail Activity
                  </h4>
                  <div className="space-y-1">
                    {customerAuditLogs.map(a => (
                      <div key={a.id} className="text-[10px] text-gray-600 flex items-center justify-between">
                        <span><strong>{a.action}:</strong> {a.details}</span>
                        <span className="text-gray-400">{formatDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#EAE4DC] bg-[#F8F5F1] flex items-center justify-between">
              <div>
                {(session?.isGlobalAdmin || session?.role === 'Admin' || session?.role === 'Super Admin') && (
                  <button
                    onClick={() => handleDeleteCustomer(selectedCustomer)}
                    className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Archive Customer</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-2 bg-[#4A1726] text-white text-xs font-bold rounded-xl"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: EDIT CUSTOMER (CRUD)
         ════════════════════════════════════════════════════════════ */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-[#C6A15B]/40 overflow-hidden my-6 animate-scale-in">
            <div className="bg-gradient-to-r from-[#4A1726] to-[#321923] text-white p-5 flex items-center justify-between border-b border-[#C6A15B]/30">
              <h3 className="text-base font-black text-[#F8F5F1]">Edit Wedding Customer</h3>
              <button onClick={() => setShowEditModal(false)} className="text-white/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="p-6 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#321923] mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={selectedCustomer.customer_name}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, customer_name: e.target.value })}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#321923] mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={selectedCustomer.mobile_number}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, mobile_number: e.target.value })}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#321923] mb-1">Email</label>
                  <input
                    type="email"
                    value={selectedCustomer.email || ''}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#321923] mb-1">Wedding Date</label>
                  <input
                    type="date"
                    value={selectedCustomer.wedding_date ? selectedCustomer.wedding_date.slice(0, 10) : ''}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, wedding_date: e.target.value })}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-blue-900 mb-1">Expected Shopping Date *</label>
                  <input
                    type="date"
                    required
                    value={selectedCustomer.expected_shopping_date ? selectedCustomer.expected_shopping_date.slice(0, 10) : ''}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, expected_shopping_date: e.target.value })}
                    className="w-full p-2 border border-blue-300 rounded-xl font-bold bg-blue-50/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-900 mb-1">Follow-up Date *</label>
                  <input
                    type="date"
                    required
                    value={selectedCustomer.follow_up_date ? selectedCustomer.follow_up_date.slice(0, 10) : ''}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, follow_up_date: e.target.value })}
                    className="w-full p-2 border border-amber-300 rounded-xl font-bold bg-amber-50/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#321923] mb-1">Customer Status</label>
                  <select
                    value={selectedCustomer.customer_status}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, customer_status: e.target.value })}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl font-bold"
                  >
                    {CUSTOMER_STATUSES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#321923] mb-1">Assigned Telecaller</label>
                  <select
                    value={selectedCustomer.assigned_telecaller || ''}
                    onChange={e => {
                      const name = e.target.value;
                      const tc = telecallers.find(t => t.full_name === name);
                      setSelectedCustomer({
                        ...selectedCustomer,
                        assigned_telecaller: name,
                        assigned_telecaller_id: tc ? tc.id : undefined
                      });
                    }}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl font-semibold"
                  >
                    <option value="">Unassigned</option>
                    {telecallers.map(t => (
                      <option key={t.id} value={t.full_name}>{t.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#321923] mb-1">Customer Notes</label>
                  <textarea
                    rows={2}
                    value={selectedCustomer.customer_notes || ''}
                    onChange={e => setSelectedCustomer({ ...selectedCustomer, customer_notes: e.target.value })}
                    className="w-full p-2 border border-[#EAE4DC] rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#EAE4DC] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-[#EAE4DC] rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4A1726] text-white text-xs font-black rounded-xl shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
