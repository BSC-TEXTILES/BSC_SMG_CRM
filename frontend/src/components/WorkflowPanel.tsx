import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth, UserSession } from '../services/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Send,
  Loader2,
  History
} from 'lucide-react';

/**
 * Role-Scoped Workflow Panel
 * --------------------------------------------------------------------------
 * Shows every role ONLY its authorized workflow data, served by
 * GET /api/workflow/dashboard (backend enforces role + location scope):
 *   - Admin/Super Admin: their pending approval queue with the remaining
 *     20-minute window (server-computed), quick approve/reject, and a link to
 *     the full approval center.
 *   - Every role: live counts (pending / overdue / approved / rejected /
 *     auto-advanced), their own submissions with current → next state, and
 *     recent decisions visible to their scope.
 *
 * The countdown here is display-only. The backend timeout processor advances
 * expired approvals regardless of any browser state.
 */

interface QueueItem {
  id: number;
  deadlineAt: string | null;
  requestedAt: string;
  currentState: string;
  assignedToRole: string;
  workflowInstanceId: number;
  recordId: string;
  recordType: string;
  submittedByName: string | null;
  submittedByUsername: string | null;
  workflowName: string;
  module: string;
  remainingSeconds: number;
}

interface SubmissionItem {
  workflowInstanceId: number;
  recordId: string;
  recordType: string;
  currentState: string;
  previousState: string | null;
  nextState: string | null;
  status: string;
  submittedAt: string;
  approvalDeadline: string | null;
  approvedAt: string | null;
  autoAdvanced: boolean;
  autoAdvancedAt: string | null;
  workflowName: string;
  module: string;
}

interface DecisionItem {
  id: number;
  status: string;
  approvalAction: string | null;
  respondedAt: string | null;
  deadlineAt: string | null;
  recordId: string;
  recordType: string;
  currentState: string;
  workflowName: string;
  module: string;
  respondedByName: string | null;
}

interface WorkflowDashboard {
  role: string;
  isApprovalAuthority: boolean;
  counts: {
    pending: number;
    overdue: number;
    approved: number;
    rejected: number;
    autoAdvanced: number;
    completedByApproval: number;
    mySubmissions: number;
    myActive: number;
    unreadNotifications: number;
  };
  pendingQueue: QueueItem[];
  recentDecisions: DecisionItem[];
  mySubmissions: SubmissionItem[];
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—';
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function stateLabel(state: string | null | undefined): string {
  if (!state) return '—';
  return state.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const StateChip = ({ state }: { state: string | null }) => {
  const s = state || '';
  const cls = s === 'pending_admin_approval' || s === 'pending'
    ? 'bg-amber-100 text-amber-800'
    : s === 'approved' || s === 'completed'
    ? 'bg-emerald-100 text-emerald-800'
    : s === 'rejected' || s === 'cancelled'
    ? 'bg-rose-100 text-rose-800'
    : s === 'auto_advanced'
    ? 'bg-purple-100 text-purple-800'
    : 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${cls}`}>{stateLabel(s)}</span>;
};

export default function WorkflowPanel() {
  const navigate = useNavigate();
  const [session] = useState<UserSession | null>(() => Auth.get());
  const [data, setData] = useState<WorkflowDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local tick so countdowns move without refetching; server remainingSeconds
  // is the authoritative anchor on each refresh.
  const [nowTs, setNowTs] = useState(Date.now());
  const anchorRef = useRef<{ at: number; items: Record<number, number> }>({ at: Date.now(), items: {} });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await API.getWorkflowDashboard();
      if (res?.success && res.data) {
        setData(res.data as WorkflowDashboard);
        const items: Record<number, number> = {};
        (res.data.pendingQueue || []).forEach((q: QueueItem) => { items[q.id] = q.remainingSeconds; });
        anchorRef.current = { at: Date.now(), items };
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refreshTimer = setInterval(() => load(true), 30000); // re-anchor from server
    const tickTimer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => { clearInterval(refreshTimer); clearInterval(tickTimer); };
  }, [load]);

  const remainingFor = (q: QueueItem): number => {
    const anchored = anchorRef.current.items[q.id];
    if (anchored == null) return q.remainingSeconds;
    return anchored - Math.floor((nowTs - anchorRef.current.at) / 1000);
  };

  const handleApprove = async (q: QueueItem) => {
    setActing(q.id);
    try {
      await API.approveRequest(String(q.id), '');
      await load(true);
    } catch (err: any) {
      alert(err.message || 'Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (q: QueueItem) => {
    const notes = prompt(`Rejection reason for ${q.recordType} ${q.recordId} (required):`);
    if (!notes || !notes.trim()) return;
    setActing(q.id);
    try {
      await API.rejectRequest(String(q.id), notes.trim());
      await load(true);
    } catch (err: any) {
      alert(err.message || 'Failed to reject');
    } finally {
      setActing(null);
    }
  };

  if (!session) return null;

  const isAdmin = ['Admin', 'Super Admin'].includes(session.role || '');
  const c = data?.counts;

  return (
    <div className="card-glass p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent-soft pb-3">
        <div>
          <h3 className="font-extrabold text-primary text-base tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <span>{isAdmin ? 'Approval Workflow Command Center' : 'My Workflow & Approvals'}</span>
          </h3>
          <p className="text-xs text-primary font-medium mt-0.5">
            {isAdmin
              ? 'Pending 20-minute Admin approval window — expired requests advance automatically (server-enforced).'
              : 'Your submissions and approval tasks — every action is audited.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="p-2 rounded-xl border border-accent-soft bg-white text-primary hover:bg-gray-50 transition-colors"
            title="Refresh workflow data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
        </div>
      </div>

      {error && (
        <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Live DB counts — never hard-coded */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Pending', value: c?.pending ?? '—', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Overdue', value: c?.overdue ?? '—', icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Approved', value: c?.approved ?? '—', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Rejected', value: c?.rejected ?? '—', icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Auto-Advanced', value: c?.autoAdvanced ?? '—', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'My Submissions', value: c?.mySubmissions ?? '—', icon: Send, color: 'text-primary', bg: 'bg-accent-soft' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`rounded-xl border border-accent-soft ${item.bg} px-3 py-2.5 flex items-center gap-2.5`}>
              <Icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
              <div className="min-w-0">
                <div className="text-lg font-black text-primary leading-none">{item.value}</div>
                <div className="text-[9.5px] font-black uppercase tracking-wide text-primary/70 mt-0.5">{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin pending approval queue */}
      {isAdmin && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent" /> Pending My Approval ({data?.pendingQueue?.length ?? 0})
            </h4>
          </div>
          {loading && !data ? (
            <div className="py-6 text-center text-xs font-bold text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading approval queue…
            </div>
          ) : (data?.pendingQueue?.length ?? 0) === 0 ? (
            <div className="py-5 text-center text-xs font-bold text-gray-400 border border-dashed border-accent-soft rounded-xl">
              No requests waiting for your approval right now.
            </div>
          ) : (
            <div className="divide-y divide-accent-soft/60 border border-accent-soft rounded-xl overflow-hidden">
              {data!.pendingQueue.map(q => {
                const remaining = remainingFor(q);
                const expired = remaining <= 0;
                const urgent = !expired && remaining <= 300;
                return (
                  <div key={q.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3.5 py-3 bg-white hover:bg-black/[.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-extrabold text-primary">{q.recordId}</span>
                        <StateChip state={q.currentState} />
                        <span className="text-[10px] font-bold text-primary/60">{q.workflowName}</span>
                      </div>
                      <div className="text-[10.5px] text-primary/70 font-semibold mt-0.5 truncate">
                        Submitted by {q.submittedByName || q.submittedByUsername || 'Unknown'} · {q.module}
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[11px] font-black font-mono flex items-center gap-1.5 flex-shrink-0 ${
                      expired ? 'bg-rose-100 text-rose-700 animate-pulse' : urgent ? 'bg-rose-100 text-rose-700' : remaining <= 600 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {expired ? 'EXPIRED — auto-advancing' : `${formatCountdown(remaining)} left`}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(q)}
                        disabled={acting === q.id || expired}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10.5px] font-extrabold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {acting === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Approve
                      </button>
                      <button
                        onClick={() => handleReject(q)}
                        disabled={acting === q.id || expired}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 text-[10.5px] font-extrabold hover:bg-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* My submissions — visible to every role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-accent" /> My Recent Submissions
          </h4>
          {(data?.mySubmissions?.length ?? 0) === 0 ? (
            <div className="py-4 text-center text-[11px] font-bold text-gray-400 border border-dashed border-accent-soft rounded-xl">
              You have not submitted any records to a workflow yet.
            </div>
          ) : (
            <div className="divide-y divide-accent-soft/60 border border-accent-soft rounded-xl bg-white overflow-hidden">
              {data!.mySubmissions.slice(0, 5).map(s => (
                <div key={s.workflowInstanceId} className="px-3 py-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-extrabold text-primary">{s.recordId}</span>
                      <StateChip state={s.currentState} />
                      {s.autoAdvanced && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-700">AUTO-ADVANCED</span>
                      )}
                    </div>
                    <div className="text-[10px] text-primary/60 font-semibold mt-0.5 truncate">
                      {s.workflowName} → next: {stateLabel(s.nextState) || '—'}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-accent" /> Recent Decisions ({isAdmin ? 'all scope' : 'my scope'})
          </h4>
          {(data?.recentDecisions?.length ?? 0) === 0 ? (
            <div className="py-4 text-center text-[11px] font-bold text-gray-400 border border-dashed border-accent-soft rounded-xl">
              No decisions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-accent-soft/60 border border-accent-soft rounded-xl bg-white overflow-hidden">
              {data!.recentDecisions.slice(0, 5).map(d => (
                <div key={d.id} className="px-3 py-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-extrabold text-primary">{d.recordId}</span>
                      <StateChip state={d.status} />
                    </div>
                    <div className="text-[10px] text-primary/60 font-semibold mt-0.5 truncate">
                      {d.workflowName}{d.respondedAt ? ` · ${new Date(d.respondedAt).toLocaleString()}` : ''}
                      {d.respondedByName ? ` · by ${d.respondedByName}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
