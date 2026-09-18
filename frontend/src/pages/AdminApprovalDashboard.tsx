import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { API } from '@/services/api';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  FileText,
  X,
  History,
  Zap,
  TrendingUp,
  TrendingDown,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';


interface ApprovalRequest {
  id: string;
  workflowInstanceId: string;
  stepOrder: number;
  currentState: string;
  requiredRole: string;
  requiredPermission: string | null;
  assignedToUserId: number | null;
  assignedToRole: string;
  assignedLocationId: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'auto_advanced' | 'cancelled';
  requestedAt: string;
  deadlineAt: string | null;
  respondedAt: string | null;
  respondedByUserId: number | null;
  approvalAction: string | null;
  rejectionReason: string | null;
  notes: string | null;
  autoAdvanced: boolean;
  recordId: string;
  recordType: string;
  submittedAt: string;
  submittedBy: number;
  submittedRole: string;
  submittedByUsername: string;
  submittedByName: string;
  workflowName: string;
  module: string;
}

interface ApprovalHistory {
  id: number;
  approvalRequestId: string;
  workflowInstanceId: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  actionByUserId: number | null;
  actionByRole: string;
  actionDetails: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  username: string | null;
  fullName: string | null;
  role: string | null;
}

interface WorkflowInstance {
  id: string;
  workflowDefinitionId: number;
  recordId: string;
  recordType: string;
  currentState: string;
  previousState: string | null;
  nextState: string | null;
  status: string;
  submittedBy: number;
  submittedRole: string;
  assignedLocationId: number | null;
  assignedDepartmentId: number | null;
  submittedAt: string;
  approvalDeadline: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  autoAdvancedAt: string | null;
  autoAdvanced: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workflowName: string;
  module: string;
  submittedByUsername: string;
  submittedByName: string;
  submittedByRole: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    pending: { className: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    approved: { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Approved' },
    rejected: { className: 'bg-rose-100 text-rose-800 border-rose-200', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
    auto_advanced: { className: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Zap className="w-3 h-3" />, label: 'Auto-Advanced' },
    cancelled: { className: 'bg-gray-100 text-gray-800 border-gray-200', icon: <X className="w-3 h-3" />, label: 'Cancelled' }
  };
  const c = config[status as keyof typeof config] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
};

const PriorityBadge = ({ deadlineAt }: { deadlineAt: string | null }) => {
  if (!deadlineAt) return null;
  const now = new Date();
  const deadline = new Date(deadlineAt);
  const diffMs = deadline.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes <= 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"><AlertTriangle className="w-3 h-3" /> EXPIRED</span>;
  }
  if (diffMinutes <= 5) {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"><AlertTriangle className="w-3 h-3" /> {diffMinutes}m left</span>;
  }
  if (diffMinutes <= 10) {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200"><Clock className="w-3 h-3" /> {diffMinutes}m left</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><Clock className="w-3 h-3" /> {diffMinutes}m left</span>;
};

const ActionButton = ({ 
  onClick, 
  children, 
  variant = 'default', 
  size = 'sm', 
  disabled = false,
  icon,
  title,
  type = 'button',
  className = ''
}: {
  onClick?: () => void;
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: React.ReactNode;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}) => {
  const variants = {
    default: 'bg-white border-accent-soft text-primary hover:bg-gray-50',
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200',
    ghost: 'bg-transparent hover:bg-gray-100 border-transparent',
    gold: 'btn-gold border-transparent'
  };
  const sizes = {
    xs: 'px-2 py-1 text-[10px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center rounded-xl font-extrabold transition-all shadow-xs border ${variants[variant]} ${sizes[size]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon}
      {children}
    </button>
  );
};

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = 'primary', 
  trend,
  trendUp = true,
  onClick
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'primary' | 'emerald' | 'rose' | 'blue' | 'purple' | 'amber';
  trend?: string;
  trendUp?: boolean;
  onClick?: () => void;
}) => {
  const colors = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200'
  };
  const iconColors = {
    primary: 'text-primary',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600'
  };

  return (
    <div className={`card-glass p-5 flex items-center justify-between border-l-4 border-l-current cursor-pointer hover:bg-primary/5 transition-colors ${onClick ? 'hover:shadow-lg' : ''}`} onClick={onClick}>
      <div>
        <div className="text-[10.5px] font-black uppercase tracking-wider text-primary">{title}</div>
        <div className="text-2xl font-black text-primary mt-1">{value}</div>
        {subtitle && <div className="text-[11px] text-primary/60 font-semibold mt-0.5">{subtitle}</div>}
        {trend && (
          <div className={`text-[11px] font-bold mt-0.5 flex items-center gap-1 ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className={`w-12 h-12 rounded-2xl ${colors[color]} flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${iconColors[color]}`} />
      </div>
    </div>
  );
};

export default function AdminApprovalDashboard() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'auto'>('pending');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Reassign modal
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignData, setReassignData] = useState({
    assignedToUserId: '',
    assignedToRole: '',
    assignedLocationId: ''
  });
  const [reassignLoading, setReassignLoading] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        role: roleFilter || undefined
      };
      
      const [approvalsRes, statsRes] = await Promise.all([
        API.getPendingApprovals(params),
        API.getWorkflowStats()
      ]);
      
      if (approvalsRes?.success) {
        setApprovals(approvalsRes.data || []);
        setTotalItems(approvalsRes.pagination?.total || 0);
        setTotalPages(approvalsRes.pagination?.totalPages || 1);
      }
      if (statsRes?.success) {
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, roleFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
    else if (key === 'role') setRoleFilter(value);
    setCurrentPage(1);
  };

  const openDetail = async (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setShowDetailModal(true);
    
    try {
      const historyRes = await API.getApprovalHistory(approval.workflowInstanceId);
      if (historyRes?.success) {
        setHistory(historyRes.history || []);
      }
    } catch (err) {
      console.error('Load history error:', err);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;
    setSaving(true);
    try {
      await API.approveRequest(selectedApproval.id, '');
      setShowDetailModal(false);
      loadData();
    } catch (err: any) {
      console.error('Approve error:', err);
      alert(err.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    const notes = prompt('Rejection reason (required):');
    if (!notes) return;
    
    setSaving(true);
    try {
      await API.rejectRequest(selectedApproval.id, notes);
      setShowDetailModal(false);
      loadData();
    } catch (err: any) {
      console.error('Reject error:', err);
      alert(err.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAdvance = async () => {
    if (!selectedApproval) return;
    setSaving(true);
    try {
      await API.triggerAutoAdvance(selectedApproval.workflowInstanceId);
      setShowDetailModal(false);
      loadData();
    } catch (err: any) {
      console.error('Auto-advance error:', err);
      alert(err.message || 'Failed to auto-advance');
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedApproval) return;
    setReassignLoading(true);
    try {
      await API.reassignApproval(selectedApproval.id, {
        assignedToUserId: reassignData.assignedToUserId ? parseInt(reassignData.assignedToUserId, 10) : undefined,
        assignedToRole: reassignData.assignedToRole || undefined,
        assignedLocationId: reassignData.assignedLocationId ? Number(reassignData.assignedLocationId) : undefined
      });
      setShowReassignModal(false);
      setReassignData({ assignedToUserId: '', assignedToRole: '', assignedLocationId: '' });
      loadData();
    } catch (err: any) {
      console.error('Reassign error:', err);
      alert(err.message || 'Failed to reassign');
    } finally {
      setReassignLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const formatFullDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy hh:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      candidates: 'bg-blue-100 text-blue-800',
      wedding_crm: 'bg-purple-100 text-purple-800',
      wedding_registration: 'bg-pink-100 text-pink-800',
      onboarding: 'bg-green-100 text-green-800',
      exit: 'bg-orange-100 text-orange-800',
      feedback: 'bg-amber-100 text-amber-800'
    };
    return colors[module] || 'bg-gray-100 text-gray-800';
  };

  const filteredApprovals = approvals.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.recordId.toLowerCase().includes(q) &&
          !a.recordType.toLowerCase().includes(q) &&
          !a.workflowName.toLowerCase().includes(q) &&
          !a.module.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (roleFilter && a.requiredRole !== roleFilter) return false;
    return true;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;
  const autoCount = approvals.filter(a => a.status === 'auto_advanced').length;

  return (
    <DashboardLayout 
      title="Admin Approval Dashboard" 
      subtitle="Workflow approval center — pending, approved, rejected, and auto-advanced requests"
      rightElement={
        <div className="flex items-center gap-2">
          <ActionButton onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />} title="Refresh" variant="ghost" size="xs">Refresh</ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Pending Approvals" value={pendingCount} icon={Clock} color="amber" trend={`${pendingCount} active`} />
          <StatCard title="Approved" value={approvedCount} icon={CheckCircle2} color="emerald" />
          <StatCard title="Rejected" value={rejectedCount} icon={XCircle} color="rose" />
          <StatCard title="Auto-Advanced" value={autoCount} icon={Zap} color="purple" />
          <StatCard title="Total Requests" value={totalItems} icon={FileText} color="blue" />
        </div>

        {/* Filter Toolbar */}
        <div className="card-glass p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by record ID, workflow, module..."
              value={search}
              onChange={handleSearch}
              className="input-modern pl-9 py-2 text-xs font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-accent hidden sm:block" />
            
            <select value={statusFilter} onChange={(e) => handleFilterChange('status', e.target.value)} className="select-modern text-xs font-bold py-2 min-w-[140px]">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="auto_advanced">Auto-Advanced</option>
            </select>

            <select value={roleFilter} onChange={(e) => handleFilterChange('role', e.target.value)} className="select-modern text-xs font-bold py-2 min-w-[160px]">
              <option value="">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="HR">HR</option>
              <option value="Telecaller">Telecaller</option>
            </select>
          </div>
        </div>

        {/* Approvals Table */}
        <div className="card-glass overflow-hidden">
          <div className="p-5 border-b border-accent-soft flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span>Approval Requests ({totalItems})</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-semibold">Page {currentPage} of {totalPages || 1}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500 font-bold text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-accent" />
              <span>Loading approval requests...</span>
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-bold text-xs space-y-2">
              <FileText className="w-10 h-10 text-gray-300 mx-auto" />
              <div className="text-sm text-primary font-black">No Approval Requests Found</div>
              <p className="text-gray-400 font-medium">Adjust your filters or wait for new requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border-collapse">
                <thead className="bg-primary text-white uppercase text-[10.5px] tracking-wider">
                  <tr>
                    <th className="p-4">Workflow / Record</th>
                    <th className="p-4">Module</th>
                    <th className="p-4">Current State</th>
                    <th className="p-4">Required Role</th>
                    <th className="p-4">Deadline</th>
                    <th className="p-4">Submitted By</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredApprovals.map((a) => (
                    <tr key={a.id} className="hover:bg-black/5 transition-colors">
                      <td className="p-4">
                        <div className="font-extrabold text-primary font-mono text-[11px]">{a.recordId}</div>
                        <div className="text-[10.5px] text-gray-500 font-semibold truncate max-w-xs">{a.workflowName}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${getModuleColor(a.module)}`}>
                          {a.module}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-primary/10 text-primary">
                          {a.currentState}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary">
                          {a.requiredRole}
                        </span>
                      </td>
                      <td className="p-4">
                        <PriorityBadge deadlineAt={a.deadlineAt} />
                      </td>
                      <td className="p-4 text-gray-600">
                        <div className="font-bold text-primary">{a.submittedByName || a.submittedByUsername || 'Unknown'}</div>
                        <div className="text-[10.5px] text-gray-500">{a.submittedRole}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{formatFullDate(a.submittedAt)}</div>
                      </td>
                      <td className="p-4"><StatusBadge status={a.status} /></td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionButton onClick={() => openDetail(a)} variant="ghost" size="xs" icon={<Eye className="w-3 h-3" />} title="View Details" />
                          {a.status === 'pending' && (
                            <>
                              <ActionButton onClick={() => handleApprove()} disabled={saving} variant="primary" size="xs" icon={<CheckCircle2 className="w-3 h-3" />} title="Approve">Approve</ActionButton>
                              <ActionButton onClick={() => handleReject()} disabled={saving} variant="danger" size="xs" icon={<XCircle className="w-3 h-3" />} title="Reject">Reject</ActionButton>
                              <ActionButton onClick={() => handleAutoAdvance()} disabled={saving} variant="secondary" size="xs" icon={<Zap className="w-3 h-3" />} title="Auto-Advance">Auto-Advance</ActionButton>
                              <ActionButton onClick={() => { setReassignData({ assignedToUserId: '', assignedToRole: '', assignedLocationId: '' }); setShowReassignModal(true); }} variant="ghost" size="xs" icon={<UserPlus className="w-3 h-3" />} title="Reassign" />
                            </>
                          )}
                          {a.status === 'auto_advanced' && (
                            <ActionButton variant="ghost" size="xs" icon={<Zap className="w-3 h-3 text-purple-600" />} title="Auto-Advanced" disabled />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-accent-soft flex items-center justify-between">
              <span className="text-xs text-primary font-semibold">Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}</span>
              <div className="flex items-center gap-1">
                <ActionButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="ghost" size="xs" icon={<ChevronLeft className="w-3.5 h-3.5" />} />
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <ActionButton 
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      variant={currentPage === pageNum ? 'primary' : 'ghost'}
                      size="xs"
                      className="w-8 h-8"
                    >
                      {pageNum}
                    </ActionButton>
                  );
                })}
                <ActionButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="ghost" size="xs" icon={<ChevronRight className="w-3.5 h-3.5" />} />
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedApproval && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="card-glass max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary">
              <div className="p-6 border-b border-accent-soft flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-primary flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent" />
                    <span>Approval Request Details</span>
                  </h3>
                  <p className="text-sm text-primary mt-0.5">{selectedApproval.workflowName} • {selectedApproval.module}</p>
                </div>
                <button onClick={() => { setShowDetailModal(false); setSelectedApproval(null); }} className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Header Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Record ID</div>
                    <div className="text-lg font-black text-primary mt-1 font-mono">{selectedApproval.recordId}</div>
                  </div>
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Workflow</div>
                    <div className="text-lg font-black text-primary mt-1">{selectedApproval.workflowName}</div>
                  </div>
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Current State</div>
                    <div className="text-lg font-black text-primary mt-1">
                      <span className="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-primary/10 text-primary">{selectedApproval.currentState}</span>
                    </div>
                  </div>
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Required Role</div>
                    <div className="text-lg font-black text-primary mt-1">
                      <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary">{selectedApproval.requiredRole}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Status</div>
                    <div className="text-lg font-black text-primary mt-1"><StatusBadge status={selectedApproval.status} /></div>
                  </div>
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Deadline</div>
                    <div className="text-lg font-black text-primary mt-1">{formatFullDate(selectedApproval.deadlineAt)}</div>
                    <div className="mt-1"><PriorityBadge deadlineAt={selectedApproval.deadlineAt} /></div>
                  </div>
                  <div className="card-glass p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Submitted</div>
                    <div className="text-lg font-black text-primary mt-1">{formatFullDate(selectedApproval.submittedAt)}</div>
                    <div className="text-[10px] text-gray-500 mt-1">by {selectedApproval.submittedByName || selectedApproval.submittedByUsername}</div>
                  </div>
                </div>

                {/* Notes */}
                {(selectedApproval.notes || selectedApproval.rejectionReason) && (
                  <div className="card-glass p-4 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">Notes / Rejection Reason</div>
                    <p className="text-xs text-primary whitespace-pre-wrap">{selectedApproval.rejectionReason || selectedApproval.notes}</p>
                  </div>
                )}

                {/* History */}
                <div className="pt-4 border-t border-accent-soft">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-extrabold text-sm text-primary flex items-center gap-2">
                      <History className="w-4 h-4 text-accent" />
                      <span>Approval History</span>
                    </h4>
                    <ActionButton onClick={() => { setShowHistoryModal(true); setShowDetailModal(false); }} variant="ghost" size="xs" icon={<Eye className="w-3.5 h-3.5" />} title="Full History">View Full History</ActionButton>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-semibold border-collapse">
                      <thead className="bg-primary text-white uppercase text-[10.5px] tracking-wider">
                        <tr>
                          <th className="p-3">Action</th>
                          <th className="p-3">From State</th>
                          <th className="p-3">To State</th>
                          <th className="p-3">By</th>
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history.slice(0, 10).map((h, i) => (
                          <tr key={i} className="hover:bg-black/5 transition-colors">
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold ${h.action === 'approved' ? 'bg-emerald-100 text-emerald-700' : h.action === 'rejected' ? 'bg-rose-100 text-rose-700' : h.action === 'auto_advanced' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                {h.action}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600">{h.fromState || '—'}</td>
                            <td className="p-3 text-gray-600">{h.toState || '—'}</td>
                            <td className="p-3 text-gray-600">{h.fullName || h.username || 'System'}</td>
                            <td className="p-3 text-gray-600">{formatFullDate(h.createdAt)}</td>
                            <td className="p-3 text-[10px] text-gray-500 truncate max-w-xs">{h.actionDetails ? JSON.stringify(h.actionDetails) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-accent-soft">
                  <ActionButton onClick={() => { setShowDetailModal(false); setSelectedApproval(null); }} variant="secondary">Close</ActionButton>
                  {selectedApproval.status === 'pending' && (
                    <>
                      <ActionButton onClick={handleApprove} disabled={saving} variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
                        {saving ? 'Approving...' : 'Approve'}
                      </ActionButton>
                      <ActionButton onClick={handleReject} disabled={saving} variant="danger" icon={<XCircle className="w-4 h-4" />}>
                        Reject
                      </ActionButton>
                      <ActionButton onClick={handleAutoAdvance} disabled={saving} variant="secondary" icon={<Zap className="w-4 h-4" />}>
                        Auto-Advance
                      </ActionButton>
                      <ActionButton onClick={() => { setShowReassignModal(true); setShowDetailModal(false); }} variant="ghost" icon={<UserPlus className="w-3.5 h-3.5" />}>
                        Reassign
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && selectedApproval && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="card-glass max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary">
              <div className="p-6 border-b border-accent-soft flex items-center justify-between">
                <h3 className="text-lg font-black text-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-accent" />
                  <span>Full Approval History</span>
                </h3>
                <button onClick={() => { setShowHistoryModal(false); setShowDetailModal(true); }} className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-semibold border-collapse">
                    <thead className="bg-primary text-white uppercase text-[10.5px] tracking-wider">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">From State</th>
                        <th className="p-3">To State</th>
                        <th className="p-3">By</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((h, i) => (
                        <tr key={i} className="hover:bg-black/5 transition-colors">
                          <td className="p-3 text-gray-600">{i + 1}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold ${h.action === 'approved' ? 'bg-emerald-100 text-emerald-700' : h.action === 'rejected' ? 'bg-rose-100 text-rose-700' : h.action === 'auto_advanced' ? 'bg-purple-100 text-purple-700' : h.action === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                              {h.action}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600">{h.fromState || '—'}</td>
                          <td className="p-3 text-gray-600">{h.toState || '—'}</td>
                          <td className="p-3 text-gray-600">{h.fullName || h.username || 'System'}</td>
                          <td className="p-3 text-gray-600">{h.role || '—'}</td>
                          <td className="p-3 text-gray-600">{formatFullDate(h.createdAt)}</td>
                          <td className="p-3 text-[10px] text-gray-500 truncate max-w-xs">{h.actionDetails ? JSON.stringify(h.actionDetails) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reassign Modal */}
        {showReassignModal && selectedApproval && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="card-glass max-w-md w-full animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary">
              <div className="p-6 border-b border-accent-soft flex items-center justify-between">
                <h3 className="text-lg font-black text-primary flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent" />
                  <span>Reassign Approval</span>
                </h3>
                <button onClick={() => { setShowReassignModal(false); setReassignData({ assignedToUserId: '', assignedToRole: '', assignedLocationId: '' }); }} className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleReassign(); }} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">Assign to User (ID)</label>
                  <input type="number" value={reassignData.assignedToUserId} onChange={(e) => setReassignData({...reassignData, assignedToUserId: e.target.value})} placeholder="Leave empty to assign by role" className="input-modern text-xs font-semibold py-2" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">Assign to Role</label>
                  <select value={reassignData.assignedToRole} onChange={(e) => setReassignData({...reassignData, assignedToRole: e.target.value})} className="select-modern text-xs font-bold py-2">
                    <option value="">Select Role</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="HR">HR</option>
                    <option value="Telecaller">Telecaller</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">Location ID (Optional)</label>
                  <input type="number" value={reassignData.assignedLocationId} onChange={(e) => setReassignData({...reassignData, assignedLocationId: e.target.value})} placeholder="Leave empty for global" className="input-modern text-xs font-semibold py-2" />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-accent-soft">
                  <ActionButton type="button" onClick={() => { setShowReassignModal(false); setReassignData({ assignedToUserId: '', assignedToRole: '', assignedLocationId: '' }); }} variant="secondary">Cancel</ActionButton>
                  <ActionButton type="submit" disabled={reassignLoading} variant="gold" icon={reassignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}>
                    {reassignLoading ? 'Reassigning...' : 'Reassign'}
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
