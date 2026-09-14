import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import { getBusinessDate } from '../utils/dateUtils';
import { formatName } from '../utils/formatName';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { 
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase, 
  FileText, CheckCircle, XCircle, Plus, Clock, ExternalLink, MessageSquare, ChevronRight, X, Trash2, Edit3, ShieldAlert, FileCheck, Image as ImageIcon, UserCheck, DollarSign, TrendingUp
} from 'lucide-react';
import ShortlistModal from '../components/ui/ShortlistModal';
import CandidateProfileModal from '../components/ui/CandidateProfileModal';
import { BSC_DEPARTMENTS, getSectionsForDepartment } from '../utils/bscDepartments';

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [candidates, setCandidates] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [shortlistModal, setShortlistModal] = useState<{ open: boolean; candidate: any | null }>({ open: false, candidate: null });

  // Drawer
  const [drawerCandidate, setDrawerCandidate] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'details' | 'questions' | 'activity'>('overview');
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Modals
  const [remarkModal, setRemarkModal] = useState<{ open: boolean; action: string; candidate: any | null }>({ open: false, action: '', candidate: null });
  const [remarksText, setRemarksText] = useState('');
  
  const [directOfferModal, setDirectOfferModal] = useState<{ open: boolean; candidate: any | null }>({ open: false, candidate: null });
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ open: boolean; candidate: any | null; newStatus: string }>({ open: false, candidate: null, newStatus: '' });
  const [highlightAppNo, setHighlightAppNo] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({ salary: "", incentive: "", doj: "", desig: "", department: "", section: "", remarks: "" });
  const [designations, setDesignations] = useState<string[]>([]);
  
  const [callModal, setCallModal] = useState<{ open: boolean; candidate: any | null; step: number; callStatus: any }>({ open: false, candidate: null, step: 1, callStatus: null });
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [callRemarks, setCallRemarks] = useState('');

  // Selected / Rejected Panel View
  const [selRejPanel, setSelRejPanel] = useState<'selected' | 'rejected' | null>(null);
  const [selRejData, setSelRejData] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Recruitment Analytics & Pipeline Date Range Filter State
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadCandidates = useCallback(async () => {
    try {
      const d = await API.getCandidates({ limit: 50000 });
      if (d && d.candidates) {
        setCandidates(d.candidates);
      }
    } catch (err: any) {
      showToast('Could not load candidates: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadCandidates();
    API.getDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});
  }, [navigate, loadCandidates]);

  // Filtering
  useEffect(() => {
    let list = [...candidates];

    const getItemDate = (item: any): Date | null => {
      if (item.rawDate) {
        const d = new Date(item.rawDate);
        if (!isNaN(d.getTime())) return d;
      }
      if (item.createdAt) {
        const d = new Date(item.createdAt);
        if (!isNaN(d.getTime())) return d;
      }
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    if (activeRange === 'today') {
      const now = new Date();
      list = list.filter(c => {
        const d = getItemDate(c);
        return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      });
    } else if (activeRange === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      list = list.filter(c => {
        const d = getItemDate(c);
        return d && d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate();
      });
    } else if (activeRange === 'week') {
      const weekAgo = Date.now() - 7 * 86400000;
      list = list.filter(c => {
        const d = getItemDate(c);
        return d && d.getTime() >= weekAgo;
      });
    } else if (activeRange === 'month') {
      const monthAgo = Date.now() - 30 * 86400000;
      list = list.filter(c => {
        const d = getItemDate(c);
        return d && d.getTime() >= monthAgo;
      });
    } else if (activeRange === 'last_month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0).getTime();
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
      list = list.filter(c => {
        const d = getItemDate(c);
        return d && d.getTime() >= firstDay && d.getTime() <= lastDay;
      });
    } else if (activeRange === 'custom' && fromDate) {
      const fParts = fromDate.split('-').map(Number);
      const start = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0).getTime();
      let end = start + 86400000 - 1;
      if (toDate) {
        const tParts = toDate.split('-').map(Number);
        end = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
      }
      list = list.filter(c => {
        const d = getItemDate(c);
        return d && d.getTime() >= start && d.getTime() <= end;
      });
    }

    if (activeStatus !== 'all') {
      list = list.filter(c => {
        if (activeStatus === 'Selected') {
          return c.status === 'Selected' || c.status === 'Already Selected' || c.status === 'Joined';
        }
        return c.status === activeStatus;
      });
    }
    if (desigFilter) {
      list = list.filter(c => c.desig === desigFilter);
    }
    if (sourceFilter) {
      list = list.filter(c => c.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.appNo || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => sortDir === 'asc' ? (a.rawDate || 0) - (b.rawDate || 0) : (b.rawDate || 0) - (a.rawDate || 0));

    setFiltered(list);
  }, [candidates, activeStatus, desigFilter, sourceFilter, searchQuery, sortDir, activeRange, fromDate, toDate]);

  const maskPhone = (ph: string) => {
    const p = String(ph || '').replace(/\D/g, '');
    return p ? p.slice(0, 5) + ' XXXXX' : '—';
  };

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

    if (clean.startsWith('uploads/')) {
      clean = `/${clean}`;
    }

    const filename = clean.split('/').pop() || clean;

    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;

    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  };

  const openDrawer = async (c: any) => {
    setDrawerCandidate(c);
    setDrawerTab('overview');
    setActivityLog([]);
    try {
      const d = await API.getActivityFull(c.appNo);
      if (d && d.activity) setActivityLog(d.activity);
    } catch (e) {}
  };

  const handleStatusSelect = async (candidate: any, targetStatus: string) => {
    if (!candidate || candidate.status === targetStatus || actionLoading) return;

    // Shortlisted -> open shortlisting card to collect salary/DOJ/dept details
    if (targetStatus === 'Shortlisted') {
      setDirectOfferModal({ open: true, candidate });
      setOfferForm({
        salary: candidate.expectedSalary || candidate.previousSalary || candidate.salary || '',
        incentive: '',
        doj: candidate.offeredDoj || candidate.estDoj || '',
        desig: candidate.desig || candidate.designation || '',
        department: candidate.department || 'Mens',
        section: candidate.section || '',
        remarks: candidate.remarks || ''
      });
      return;
    }

    setActionLoading(true);
    try {
      if (targetStatus === 'Rejected') {
        await API.rejectCandidate({ appNo: candidate.appNo, remarks: 'Status updated to Rejected', candName: candidate.name });
      } else {
        await API.updateCandidate(candidate.appNo, { status: targetStatus, remarks: `Status updated to ${targetStatus}` });
      }
      showToast(`${candidate.name} status updated to ${targetStatus} 🎉`, 'success');
      loadCandidates();
    } catch (err: any) {
      showToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const executeStatusChange = async () => {
    if (!confirmStatusModal.candidate || !confirmStatusModal.newStatus || actionLoading) return;
    const c = confirmStatusModal.candidate;
    const targetStatus = confirmStatusModal.newStatus;

    setActionLoading(true);
    try {
      if (targetStatus === 'Rejected') {
        await API.rejectCandidate({ appNo: c.appNo, remarks: 'Status updated to Rejected', candName: c.name });
      } else {
        await API.updateCandidate(c.appNo, { status: targetStatus, remarks: `Status updated to ${targetStatus}` });
      }
      showToast(`${c.name} updated to ${targetStatus} 🎉`, 'success');
      setHighlightAppNo(c.appNo);
      setTimeout(() => setHighlightAppNo(null), 2500);
      setConfirmStatusModal({ open: false, candidate: null, newStatus: '' });
      loadCandidates();
    } catch (err: any) {
      showToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCandidate = async (appNo: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this candidate?')) return;
    try {
      await API.deleteCandidate(appNo);
      showToast('Candidate deleted successfully', 'success');
      setDrawerCandidate(null);
      loadCandidates();
    } catch (err) {
      showToast('Failed to delete candidate', 'error');
    }
  };

  const handleStatusChange = async (action: string, candidate: any) => {
    if (!candidate || actionLoading) return;
    
    if (action === 'shortlist') {
      setDirectOfferModal({ open: true, candidate });
      setOfferForm({
        salary: candidate.expectedSalary || candidate.previousSalary || candidate.salary || "",
        incentive: "",
        doj: candidate.offeredDoj || candidate.estDoj || "",
        desig: candidate.desig || candidate.designation || "",
        department: candidate.department || "Mens",
        section: candidate.section || "",
        remarks: candidate.remarks || ""
      });
      return;
    }
    
    setActionLoading(true);
    try {
      if (action === 'reject') {
        if (!window.confirm(`Are you sure you want to reject ${candidate.name}?`)) {
          setActionLoading(false);
          return;
        }
        await API.rejectCandidate({ appNo: candidate.appNo, remarks: 'Rejected from Shortlisting phase', candName: candidate.name });
        showToast(`${candidate.name} rejected`, 'warn');
      } else {
        const statusMap: Record<string, string> = {
          shortlist: 'Shortlisted',
          hold: 'Hold',
          reactivate: 'New'
        };
        await API.updateCandidate(candidate.appNo, { status: statusMap[action] || action, remarks: '' });
        showToast(`${candidate.name} updated to ${statusMap[action] || action}`, 'success');
      }

      setDrawerCandidate(null);
      loadCandidates();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewSelRej = async (type: 'selected' | 'rejected') => {
    setSelRejPanel(type);
    try {
      const res = type === 'selected' ? await API.getSelectedCandidates() : await API.getRejectedCandidates();
      setSelRejData(res.candidates || []);
    } catch (e) {
      setSelRejData([]);
    }
  };

  const handleDirectOfferSubmit = async () => {
    if (!directOfferModal.candidate) return;
    if (!offerForm.salary) {
      showToast('Offered salary is mandatory', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const combinedSalary = offerForm.incentive && offerForm.incentive.trim()
        ? `${offerForm.salary.trim()}|${offerForm.incentive.trim()}`
        : offerForm.salary.trim();

      // Single API call — offerController.createDirectOffer now handles setting
      // status = 'Shortlisted' in both candidates and selection_offers tables
      await API.createDirectOffer({
        appNo: directOfferModal.candidate.appNo,
        salaryOffered: combinedSalary,
        estDoj: offerForm.doj,
        designation: offerForm.desig,
        department: offerForm.department,
        section: offerForm.section || null,
        remarks: offerForm.remarks
      });

      showToast(`${directOfferModal.candidate.name} shortlisted & moved to Offer Desk 🎉`, 'success');
      setDirectOfferModal({ open: false, candidate: null });
      setDrawerCandidate(null);
      loadCandidates();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const canDelete = session?.role === 'Admin' || session?.role === 'Super Admin';

  return (
    <div className="min-h-screen bg-[#F8F5F1] flex">
      
      {/* Professional Status Change Confirmation Modal */}
      {confirmStatusModal.open && confirmStatusModal.candidate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#4A1726]/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#EAE4DC] space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#4A1726] text-white flex items-center justify-center font-black text-sm shadow-md">
                  {confirmStatusModal.candidate.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-[#4A1726] text-base">Move Candidate Status</h3>
                  <div className="text-xs text-[#777777] font-semibold">{confirmStatusModal.candidate.name} ({confirmStatusModal.candidate.appNo})</div>
                </div>
              </div>
              <button onClick={() => setConfirmStatusModal({ open: false, candidate: null, newStatus: '' })} className="text-[#888888] hover:text-[#4A1726]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F8F5F1] p-4 rounded-2xl border border-[#EAE4DC] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] uppercase text-[10px]">Current Status</span>
                <StatusBadge status={confirmStatusModal.candidate.status} size="sm" />
              </div>
              <div className="flex justify-center text-[#C6A15B]">
                <ChevronRight className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] uppercase text-[10px]">New Status</span>
                <StatusBadge status={confirmStatusModal.newStatus} size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAE4DC]">
              <button 
                onClick={() => setConfirmStatusModal({ open: false, candidate: null, newStatus: '' })} 
                className="px-4 py-2 rounded-xl border border-[#EAE4DC] font-bold text-xs text-[#4A1726] hover:bg-[#F8F5F1] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeStatusChange} 
                disabled={actionLoading} 
                className="btn-primary text-xs shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Candidate CRM"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Candidates' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <button
              onClick={() => window.open('/candidate-entry', '_blank')}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Register Candidate</span>
            </button>
          }
        />

        <main className="p-4 lg:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Recruitment Analytics & Pipeline Banner */}
          <div className="card-glass p-5 space-y-4 border-2 border-[#4A1726]/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAE4DC] pb-3.5">
              <div>
                <h3 className="font-extrabold text-[#4A1726] text-base tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#C6A15B]" />
                  <span>Recruitment Analytics &amp; Pipeline</span>
                </h3>
                <p className="text-xs text-[#777777] font-medium mt-0.5">
                  Real-time candidate metrics, funnel conversion &amp; team performance.
                </p>
              </div>

              {/* Date Filter Quick Range Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                  { key: 'last_month', label: 'Last Month' }
                ].map(range => (
                  <button
                    key={range.key}
                    onClick={() => { setActiveRange(range.key as any); setFromDate(''); setToDate(''); }}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      activeRange === range.key
                        ? 'bg-[#4A1726] text-white font-extrabold shadow-xs'
                        : 'bg-[#F8F5F1] text-[#555555] border border-[#EAE4DC] hover:bg-white'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex flex-wrap items-center gap-3 bg-[#F8F5F1] p-3 rounded-2xl border border-[#EAE4DC] text-xs font-bold text-[#4A1726]">
              <span className="text-[#777777] uppercase text-[10.5px] font-black">Custom Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#EAE4DC] bg-white font-semibold outline-none text-xs"
                  placeholder="dd-mm-yyyy"
                />
                <span className="text-[#777777] font-extrabold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#EAE4DC] bg-white font-semibold outline-none text-xs"
                  placeholder="dd-mm-yyyy"
                />
              </div>
              {(fromDate || toDate || activeRange !== 'all') && (
                <button
                  onClick={() => { setActiveRange('all'); setFromDate(''); setToDate(''); }}
                  className="text-rose-600 hover:underline text-[11px] font-extrabold ml-auto"
                >
                  Reset Date Filter
                </button>
              )}
            </div>
          </div>
          {/* Status Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-bold scrollbar-none">
            {[
              { key: 'all', label: 'All Candidates' },
              { key: 'New', label: 'New Applicants' },
              { key: 'Shortlisted', label: 'Shortlisted' },
              { key: 'Selected', label: 'Selected' },
              { key: 'Offer Sent', label: 'Offer Sent' },
              { key: 'Hold', label: 'On Hold' },
              { key: 'Rejected', label: 'Rejected' }
            ].map(p => {
              const count = p.key === 'all' ? candidates.length : candidates.filter(c => c.status === p.key).length;
              return (
                <button
                  key={p.key}
                  onClick={() => setActiveStatus(p.key)}
                  className={`
                    px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 shadow-xs
                    ${activeStatus === p.key 
                      ? 'bg-[#4A1726] text-white border-[#4A1726] shadow-sm font-black' 
                      : 'bg-white text-[#555555] border-[#EAE4DC] hover:bg-[#F8F5F1] hover:text-[#4A1726] font-semibold'}
                  `}
                >
                  <span>{p.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeStatus === p.key ? 'bg-white/20 text-white' : 'bg-black/5 text-[#777777]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Toolbar */}
          <div className="card-glass p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, app no..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#EAE4DC] bg-[#F8F5F1] text-xs font-semibold text-[#4A1726] focus:outline-none focus:border-[#4A1726] shadow-xs"
                />
              </div>

              <select
                value={desigFilter}
                onChange={(e) => setDesigFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#EAE4DC] bg-[#F8F5F1] text-xs font-semibold text-[#4A1726]"
              >
                <option value="">All Designations</option>
                {Array.from(new Set((candidates || []).map(c => c.desig).filter(Boolean))).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#EAE4DC] bg-[#F8F5F1] text-xs font-semibold text-[#4A1726]"
              >
                <option value="">All Sources</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Employee Reference">Employee Reference</option>
                <option value="Advertisement">Advertisement</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex items-center gap-2 font-bold">
              <button
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-3.5 py-2 rounded-xl border border-[#EAE4DC] bg-white text-[#4A1726] hover:bg-[#F8F5F1] transition-colors shadow-xs"
              >
                {sortDir === 'asc' ? '↑ Date Applied (Asc)' : '↓ Date Applied (Desc)'}
              </button>
            </div>
          </div>

          {/* Candidate Table Grid */}
          <div className="card-glass p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE4DC] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F8F5F1]/60">
                    <th className="py-3 px-3 text-center w-12">SL.NO</th>
                    <th className="py-3 px-4">App No</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC]/60">
                  {filtered.length > 0 ? (
                    (filtered || []).map((c, idx) => (
                      <tr key={c.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3.5 px-3 text-center font-bold text-[#666666]">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#555555] font-bold">{c.appNo}</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openDrawer(c)}
                            className="flex items-center gap-3 group text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#4A1726] text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {c.initials}
                            </div>
                            <span className="font-extrabold text-[#4A1726] group-hover:underline">{formatName(c.name)}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#555555]">{maskPhone(c.phone)}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-semibold">{c.gender || '—'}</td>
                        <td className="py-3.5 px-4 text-[#4A1726] font-extrabold">{c.desig}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-medium">{c.source}</td>
                        <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap font-medium">{c.date}</td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={c.status || 'New'}
                            disabled={actionLoading}
                            onChange={(e) => handleStatusSelect(c, e.target.value)}
                            className={`text-[11px] font-extrabold rounded-xl border-2 px-2.5 py-1.5 cursor-pointer outline-none transition-all shadow-xs ${
                              c.status === 'New' ? 'bg-slate-100 text-slate-800 border-slate-300' :
                              c.status === 'Shortlisted' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                              c.status === 'Joined' ? 'bg-teal-50 text-teal-800 border-teal-300 font-black' :
                              c.status === 'Hold' ? 'bg-orange-50 text-orange-800 border-orange-300' :
                              c.status === 'Rejected' || c.status === 'Offer Rejected' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                              'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="New">🔵 New</option>
                            <option value="Shortlisted">📋 Shortlisted (Move to Offer Desk)</option>
                            <option value="Hold">⏸ On Hold</option>
                            <option value="Rejected">❌ Rejected</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === 'New' && (
                              <button
                                onClick={() => handleStatusChange('shortlist', c)}
                                className="px-3 py-1.5 rounded-xl bg-[#C6A15B] text-white font-black hover:bg-[#b08123] transition-all text-[11px] shadow-xs flex items-center gap-1"
                              >
                                Shortlist & Offer Desk ↗
                              </button>
                            )}
                            {c.status === 'Shortlisted' && (
                              <button
                                onClick={() => navigate('/offer-desk')}
                                className="px-3 py-1.5 rounded-xl bg-[#4A1726] text-white font-extrabold hover:bg-[#350E1A] transition-all text-[11px] shadow-xs flex items-center gap-1"
                              >
                                📄 View on Offer Desk ↗
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/candidate-entry?edit=${c.appNo}`)}
                              className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors"
                              title="Edit Candidate Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteCandidate(c.appNo)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors"
                                title="Delete Candidate Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-[#777777] font-semibold">
                        No candidates found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Panel Views */}
            <div className="pt-3 border-t border-[#EAE4DC] flex items-center gap-3">
              <button
                onClick={() => handleViewSelRej('selected')}
                className="px-3.5 py-1.5 rounded-xl border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>View Selected Candidates</span>
              </button>
              <button
                onClick={() => handleViewSelRej('rejected')}
                className="px-3.5 py-1.5 rounded-xl border border-rose-600 text-rose-700 font-bold hover:bg-rose-50 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                <span>View Rejected Candidates</span>
              </button>
            </div>
          </div>

          {/* Selected / Rejected Quick View Modal */}
          {selRejPanel && (
            <div className="card-glass p-5 space-y-4 animate-fade-in border-2 border-[#4A1726]/20">
              <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-3">
                <h3 className="font-extrabold text-[#4A1726] text-base capitalize flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#C6A15B]" />
                  <span>{selRejPanel} Candidates</span>
                </h3>
                <button onClick={() => setSelRejPanel(null)} className="text-[#888888] hover:text-[#4A1726] p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#EAE4DC] text-[10px] font-black uppercase text-[#777777]">
                      <th className="py-2.5 px-3">App No</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE4DC]/50">
                    {(selRejData || []).map((c, idx) => (
                      <tr key={idx} className="hover:bg-black/5 font-medium">
                        <td className="py-2.5 px-3 font-mono">{c.appNo}</td>
                        <td className="py-2.5 px-3 font-bold text-[#4A1726]">{formatName(c.name)}</td>
                        <td className="py-2.5 px-3">{c.desig}</td>
                        <td className="py-2.5 px-3 font-mono">{c.phone}</td>
                      </tr>
                    ))}
                    {selRejData.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-[#888888]">No records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Universal 360 Candidate Profile Modal with Status, Department, Designation & Optional Section Editing */}
      <CandidateProfileModal
        candidate={drawerCandidate}
        isOpen={!!drawerCandidate}
        onClose={() => setDrawerCandidate(null)}
        onUpdated={loadCandidates}
      />

      {/* Direct Shortlisting & Offer Desk Modal */}
      {directOfferModal.open && directOfferModal.candidate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#4A1726]/70 backdrop-blur-md transition-all animate-fade-in">
          <div className="w-full max-w-lg bg-[#F8F5F1] rounded-3xl p-6 space-y-4 shadow-2xl animate-fade-in border-2 border-[#C6A15B]/50">
            <div className="flex items-center justify-between border-b border-[#C6A15B]/30 pb-3">
              <div>
                <span className="text-[10px] font-black text-[#C6A15B] uppercase tracking-wider block">Candidate Shortlisting</span>
                <h3 className="font-black text-[#4A1726] text-lg">Shortlist & Send to Offer Desk — {directOfferModal.candidate.name}</h3>
              </div>
              <button onClick={() => setDirectOfferModal({ open: false, candidate: null })} className="p-2 rounded-xl bg-white/60 text-[#4A1726] hover:bg-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-white p-5 rounded-2xl border border-[#EAE4DC]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1">Offered Base Salary (₹) *</label>
                  <input type="text" value={offerForm.salary} onChange={(e) => setOfferForm({ ...offerForm, salary: e.target.value })} placeholder="e.g. 18000" className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-mono font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-[#C6A15B]/40" />
                </div>

                <div>
                  <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1">Incentive (₹) (Optional)</label>
                  <input type="text" value={offerForm.incentive || ''} onChange={(e) => setOfferForm({ ...offerForm, incentive: e.target.value })} placeholder="e.g. 2000" className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-mono font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-[#C6A15B]/40" />
                </div>

                <div>
                  <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1">Estimated Date of Joining</label>
                  <input type="date" value={offerForm.doj} onChange={(e) => setOfferForm({ ...offerForm, doj: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-bold text-[#4A1726] outline-none focus:ring-2 focus:ring-[#C6A15B]/40" />
                </div>

                <div>
                  <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1">Finalized Designation</label>
                  <input type="text" value={offerForm.desig} onChange={(e) => setOfferForm({ ...offerForm, desig: e.target.value })} placeholder="Designation role" className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-bold text-[#4A1726] outline-none focus:ring-2 focus:ring-[#C6A15B]/40" />
                </div>

                <div>
                  <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1">Allocated Department</label>
                  <select value={offerForm.department} onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value, section: '' })} className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-bold text-[#4A1726] outline-none focus:ring-2 focus:ring-[#C6A15B]/40">
                    {BSC_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1 flex items-center justify-between">
                    <span>Floor Section</span>
                    <span className="text-[10px] font-bold text-[#777777] uppercase">(Optional)</span>
                  </label>
                  {getSectionsForDepartment(offerForm.department).length > 0 ? (
                    <select value={offerForm.section} onChange={(e) => setOfferForm({ ...offerForm, section: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-bold text-[#C6A15B] outline-none focus:ring-2 focus:ring-[#C6A15B]/40">
                      <option value="">-- Optional / Unassigned --</option>
                      {getSectionsForDepartment(offerForm.department).map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Optional section" value={offerForm.section} onChange={(e) => setOfferForm({ ...offerForm, section: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-bold text-[#C6A15B] outline-none focus:ring-2 focus:ring-[#C6A15B]/40" />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-black text-[#4A1726] uppercase text-[11px] mb-1">Shortlisting & Recruiter Remarks</label>
                <textarea
                  rows={2}
                  value={offerForm.remarks || ''}
                  onChange={(e) => setOfferForm({ ...offerForm, remarks: e.target.value })}
                  placeholder="Enter shortlisting notes, recruiter remarks or special conditions..."
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE4DC] font-semibold text-[#4A1726] outline-none focus:ring-2 focus:ring-[#C6A15B]/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#EAE4DC]">
              <span className="text-[11px] font-bold text-[#777777]">Candidate status updates to <strong className="text-[#4A1726]">Shortlisted</strong></span>
              <div className="flex items-center gap-2">
                <button onClick={() => setDirectOfferModal({ open: false, candidate: null })} className="px-4 py-2 rounded-xl border border-[#EAE4DC] bg-white font-extrabold text-xs text-[#555555]">
                  Cancel
                </button>
                <button onClick={handleDirectOfferSubmit} disabled={actionLoading} className="btn-gold text-xs px-5 py-2 shadow-md font-black flex items-center gap-1.5 disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" />
                  <span>{actionLoading ? 'Processing...' : 'Shortlist & Send to Offer Desk'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Shortlisting & Screening Questions Modal */}
      <ShortlistModal
        candidate={shortlistModal.candidate}
        isOpen={shortlistModal.open}
        onClose={() => setShortlistModal({ open: false, candidate: null })}
        onShortlistConfirmed={loadCandidates}
      />
    </div>
  );
}
