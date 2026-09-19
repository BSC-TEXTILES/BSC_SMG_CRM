import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { isDateInRange } from '../utils/dateUtils';
import {
  Phone, PhoneCall, Clock, Calendar, Users, Heart, CheckCircle, 
  MapPin, Edit3, Eye, Search, Filter, MessageCircle, X, Save,
  AlertCircle, PhoneOff, BookOpen, Star, RefreshCw, ChevronRight, User
} from 'lucide-react';

interface WeddingCustomer {
  id: number;
  registrationId?: string;
  customerName: string;
  mobile: string;
  email?: string;
  locationId?: number;
  locationName?: string;
  weddingDate?: string;
  dateFlexibility?: string;
  functions?: string;
  shoppingCategory?: string;
  preferredShoppingDate?: string;
  preferredTime?: string;
  contactMethod?: string;
  status: string;
  callStatus?: string;
  visitStatus?: string;
  shoppingStatus?: string;
  nextFollowUp?: string;
  assignedTelecallerName?: string;
  assignedTelecallerId?: number;
  registrationDate?: string;
  remarks?: string;
}

export default function TelecallerDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [deskStats, setDeskStats] = useState<any>({});
  const [customers, setCustomers] = useState<WeddingCustomer[]>([]);
  const [filtered, setFiltered] = useState<WeddingCustomer[]>([]);
  
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'My Queue');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Date Range Filter
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [detailCustomer, setDetailCustomer] = useState<WeddingCustomer | null>(null);
  const [logCallModalOpen, setLogCallModalOpen] = useState(false);
  
  // Call Log State
  const [callLogForm, setCallLogForm] = useState({
    callResult: 'Connected',
    nextFollowUpDate: '',
    nextFollowUpTime: '',
    customerResponse: '',
    remarks: '',
    newStatus: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deskRes, custRes] = await Promise.all([
        API.getWeddingCallingDesk(),
        API.getWeddingCustomers({ limit: 5000 })
      ]);
      
      if (deskRes?.data) setDeskStats(deskRes.data);
      if (custRes?.customers) setCustomers(custRes.customers);
    } catch (err: any) {
      showToast('Error loading telecaller data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const currentSession = Auth.get();
    setSession(currentSession);
    loadData();
  }, [navigate, loadData]);

  useEffect(() => {
    let list = [...customers];

    // Restrict to my assigned queue unless Admin
    if (session?.role !== 'Admin' && session?.role !== 'Super Admin') {
      list = list.filter(c => c.assignedTelecallerId === session?.id || c.assignedTelecallerName === session?.fullName);
    }

    // Pipeline / Tab Filtering
    if (activeTab === 'New Requests') list = list.filter(c => c.status?.toLowerCase().includes('new'));
    if (activeTab === 'Today Follow-ups') {
      const today = new Date().toISOString().split('T')[0];
      list = list.filter(c => c.nextFollowUp && c.nextFollowUp.startsWith(today));
    }
    if (activeTab === 'Overdue') {
      const today = new Date().toISOString().split('T')[0];
      list = list.filter(c => c.nextFollowUp && c.nextFollowUp < today && !['Completed', 'Not Interested'].includes(c.status));
    }
    if (activeTab === 'Contacted') list = list.filter(c => c.status === 'Contacted');
    if (activeTab === 'Visit Planned') list = list.filter(c => c.status === 'Visit Planned');
    if (activeTab === 'Shopping Confirmed') list = list.filter(c => c.status === 'Shopping Confirmed');
    if (activeTab === 'Completed') list = list.filter(c => c.status === 'Completed');

    // Date Range filtering
    if (activeRange !== 'all') {
      list = list.filter(c => {
        const d = c.nextFollowUp || c.registrationDate || new Date().toISOString();
        return isDateInRange(new Date(d), activeRange, fromDate, toDate);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.customerName && c.customerName.toLowerCase().includes(q)) || 
        (c.mobile && c.mobile.toLowerCase().includes(q)) || 
        (c.registrationId && c.registrationId.toLowerCase().includes(q)) ||
        (c.locationName && c.locationName.toLowerCase().includes(q))
      );
    }
    
    setFiltered(list);
  }, [customers, activeTab, searchQuery, activeRange, fromDate, toDate, session]);

  const handleLogCall = async () => {
    if (!detailCustomer || saving) return;
    setSaving(true);
    try {
      const payload = {
        customerId: detailCustomer.id,
        callStatus: callLogForm.callResult,
        remarks: callLogForm.remarks,
        response: callLogForm.customerResponse,
        nextFollowUpDate: callLogForm.nextFollowUpDate,
        nextFollowUpTime: callLogForm.nextFollowUpTime,
        status: callLogForm.newStatus || detailCustomer.status
      };
      
      await API.logWeddingCall(payload);
      
      // If status changed, update customer
      if (callLogForm.newStatus && callLogForm.newStatus !== detailCustomer.status) {
         await API.updateWeddingCustomer(detailCustomer.id, { status: callLogForm.newStatus });
      }
      
      showToast('Call logged successfully', 'success');
      setLogCallModalOpen(false);
      setCallLogForm({ callResult: 'Connected', nextFollowUpDate: '', nextFollowUpTime: '', customerResponse: '', remarks: '', newStatus: '' });
      loadData();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderStatus = (status?: string) => {
    if (!status) return <span className="text-slate-400">-</span>;
    const s = status.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700';
    if (s.includes('new') || s.includes('pending')) cls = 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('contacted') || s.includes('scheduled')) cls = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (s.includes('visit') || s.includes('progress')) cls = 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('confirm') || s.includes('completed')) cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s.includes('not interested') || s.includes('cancel')) cls = 'bg-rose-50 text-rose-700 border-rose-200';
    return <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{status}</span>;
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title="Telecaller Dashboard" session={session} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <ToastContainer />
          
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">BSC EXCLUSIVE • Telecaller Dashboard</h1>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">
                    Logged in as <strong className="text-slate-800">{session?.fullName || session?.username}</strong> ({session?.role})
                    {session?.locationId && ` • Assigned Location: ${session.locationId}`}
                  </p>
                </div>
              </div>
              <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Total Assigned</div>
                <div className="text-2xl font-extrabold text-slate-900">{deskStats.assignedCalls || 0}</div>
                <Users className="absolute top-4 right-4 w-8 h-8 text-slate-100" />
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-sm relative overflow-hidden text-white">
                <div className="text-xs font-bold text-blue-100 mb-1 uppercase tracking-wider">Today's Follow-ups</div>
                <div className="text-2xl font-extrabold">{deskStats.pendingCalls || 0}</div>
                <Clock className="absolute top-4 right-4 w-8 h-8 text-white/20" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="text-xs font-bold text-rose-500 mb-1 uppercase tracking-wider">Overdue</div>
                <div className="text-2xl font-extrabold text-slate-900">{deskStats.noAnswerCount || 0}</div>
                <AlertCircle className="absolute top-4 right-4 w-8 h-8 text-rose-50" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="text-xs font-bold text-teal-600 mb-1 uppercase tracking-wider">Completed Today</div>
                <div className="text-2xl font-extrabold text-slate-900">{deskStats.completedToday || 0}</div>
                <CheckCircle className="absolute top-4 right-4 w-8 h-8 text-teal-50" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden hidden lg:block">
                <div className="text-xs font-bold text-emerald-600 mb-1 uppercase tracking-wider">Visits Scheduled</div>
                <div className="text-2xl font-extrabold text-slate-900">{deskStats.connectedCalls || 0}</div>
                <MapPin className="absolute top-4 right-4 w-8 h-8 text-emerald-50" />
              </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              {/* Pipeline Tabs */}
              <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200 p-2">
                {['My Queue', 'New Requests', 'Today Follow-ups', 'Overdue', 'Contacted', 'Visit Planned', 'Shopping Confirmed', 'Completed'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      activeTab === tab 
                        ? 'bg-accent/10 text-accent shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Filters & Search */}
              <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search Registration ID, Name, Phone..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {(['all', 'today', 'yesterday', 'week', 'month'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setActiveRange(range)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeRange === range ? 'bg-slate-800 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {range === 'all' ? 'All Time' :
                       range === 'today' ? 'Today' :
                       range === 'yesterday' ? 'Yesterday' :
                       range === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Operations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Registration</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer & Contact</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Wedding Details</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Telecaller & Follow-up</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={6} className="py-12 text-center text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />Loading Queue...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-medium">No customers found in this queue.</td></tr>
                    ) : (
                      filtered.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="text-sm font-bold text-slate-900 font-mono">{c.registrationId || `CUST-${c.id}`}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3"/>{c.locationName || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-bold text-slate-900 group-hover:text-accent cursor-pointer transition-colors" onClick={() => setDetailCustomer(c)}>
                              {c.customerName}
                            </div>
                            <div className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3 text-slate-400"/> {c.mobile}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-bold text-slate-700">{c.weddingDate ? new Date(c.weddingDate).toLocaleDateString() : 'TBD'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.shoppingCategory || 'Unspecified'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-bold text-slate-700">{c.assignedTelecallerName || 'Unassigned'}</div>
                            <div className="text-xs text-rose-500 font-bold mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3"/> {c.nextFollowUp ? new Date(c.nextFollowUp).toLocaleDateString() : 'No follow-up'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {renderStatus(c.status)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button 
                              onClick={() => { setDetailCustomer(c); setLogCallModalOpen(true); }}
                              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors text-xs font-bold"
                            >
                              <PhoneCall className="w-3.5 h-3.5 mr-1" /> Log Call
                            </button>
                            <button 
                              onClick={() => setDetailCustomer(c)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Customer Detail Drawer / Modal */}
      {detailCustomer && !logCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white shadow-2xl w-full md:w-[600px] md:rounded-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{detailCustomer.customerName}</h2>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{detailCustomer.registrationId || `CUST-${detailCustomer.id}`} • {detailCustomer.locationName}</div>
              </div>
              <button onClick={() => setDetailCustomer(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/30">
              
              {/* Quick Actions */}
              <div className="flex gap-3">
                <button onClick={() => setLogCallModalOpen(true)} className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-bold shadow-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                  <PhoneCall className="w-4 h-4" /> Log Call / Follow-up
                </button>
                <button className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" /> Schedule Visit
                </button>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Current Status</div>
                  {renderStatus(detailCustomer.status)}
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Next Follow-up</div>
                  <div className="text-sm font-bold text-rose-600 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {detailCustomer.nextFollowUp ? new Date(detailCustomer.nextFollowUp).toLocaleDateString() : 'Not Scheduled'}
                  </div>
                </div>
              </div>

              {/* Wedding & Shopping Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent" /> Wedding & Shopping Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500 font-medium">Wedding Date</span><span className="font-bold text-slate-800">{detailCustomer.weddingDate ? new Date(detailCustomer.weddingDate).toLocaleDateString() : 'TBD'}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500 font-medium">Shopping Category</span><span className="font-bold text-slate-800">{detailCustomer.shoppingCategory || 'N/A'}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500 font-medium">Functions</span><span className="font-medium text-slate-800">{detailCustomer.functions || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Preferred Shopping Date</span><span className="font-medium text-slate-800">{detailCustomer.preferredShoppingDate ? new Date(detailCustomer.preferredShoppingDate).toLocaleDateString() : 'N/A'}</span></div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" /> Contact Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500 font-medium">Mobile Number</span><span className="font-bold text-slate-800">{detailCustomer.mobile}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500 font-medium">Email Address</span><span className="font-medium text-slate-800">{detailCustomer.email || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Contact Method</span><span className="font-medium text-slate-800">{detailCustomer.contactMethod || 'N/A'}</span></div>
                </div>
              </div>
              
              {/* Activity Timeline Placeholder */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 text-center shadow-inner">
                <MessageCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">Consultation & Call Logs are available in the Full Profile view.</p>
                <button className="mt-3 text-xs font-bold text-accent hover:underline">View Full Timeline</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Call Modal / Follow-up Scheduler */}
      {logCallModalOpen && detailCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-accent" /> Log Call & Follow-up
              </h2>
              <button onClick={() => setLogCallModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-5 bg-white">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm font-medium text-blue-900">
                <User className="w-5 h-5 text-blue-500" /> Calling: {detailCustomer.customerName} ({detailCustomer.mobile})
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Call Result <span className="text-rose-500">*</span></label>
                <select 
                  value={callLogForm.callResult} 
                  onChange={e => setCallLogForm({...callLogForm, callResult: e.target.value})}
                  className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border"
                >
                  <option value="Connected">Connected</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Busy">Busy</option>
                  <option value="Call Back Requested">Call Back Requested</option>
                  <option value="Not Reachable">Not Reachable</option>
                  <option value="Number Invalid">Number Invalid</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Customer Response / Remarks <span className="text-rose-500">*</span></label>
                <textarea 
                  rows={3}
                  value={callLogForm.remarks}
                  onChange={e => setCallLogForm({...callLogForm, remarks: e.target.value})}
                  className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border resize-none"
                  placeholder="Enter detailed notes about the conversation..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Next Follow-up Date</label>
                  <input 
                    type="date"
                    value={callLogForm.nextFollowUpDate}
                    onChange={e => setCallLogForm({...callLogForm, nextFollowUpDate: e.target.value})}
                    className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Time</label>
                  <input 
                    type="time"
                    value={callLogForm.nextFollowUpTime}
                    onChange={e => setCallLogForm({...callLogForm, nextFollowUpTime: e.target.value})}
                    className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Update Pipeline Status (Optional)</label>
                <select 
                  value={callLogForm.newStatus} 
                  onChange={e => setCallLogForm({...callLogForm, newStatus: e.target.value})}
                  className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border"
                >
                  <option value="">-- Keep current status: {detailCustomer.status} --</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Follow-up Scheduled">Follow-up Scheduled</option>
                  <option value="Visit Planned">Visit Planned</option>
                  <option value="Shopping Confirmed">Shopping Confirmed</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setLogCallModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 transition-colors">Cancel</button>
              <button 
                onClick={handleLogCall} 
                disabled={saving || !callLogForm.remarks.trim()} 
                className="px-5 py-2.5 text-sm font-bold text-white bg-accent rounded-xl shadow-sm hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Log & Follow-up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
