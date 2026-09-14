import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { ClipboardList, CheckCircle, XCircle, MinusCircle, Save, Camera } from 'lucide-react';
import { API } from '../services/api';

export default function VmChecklist() {
  const [points, setPoints] = useState<any[]>([]);
  const [shift, setShift] = useState<string>('Opening');
  const [floor, setFloor] = useState<string>('1st Floor');
  const [scores, setScores] = useState<Record<string, { score: string; remarks: string }>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  useEffect(() => {
    API.getVmPoints()
      .then((res: any) => {
        if (res && res.points) {
          setPoints(res.points);
          const initial: Record<string, { score: string; remarks: string }> = {};
          res.points.forEach((p: any) => {
            initial[p.id] = { score: 'Pass', remarks: '' };
          });
          setScores(initial);
        }
      })
      .catch((err: any) => console.error(err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmittedMsg(null);

    const total = points.length;
    const passCount = Object.values(scores).filter(s => s.score === 'Pass').length;
    const scorePercent = total > 0 ? (passCount / total) * 100 : 100;

    const entries = points.map(p => ({
      pointId: p.id,
      pointTitle: p.title,
      score: scores[p.id]?.score || 'Pass',
      remarks: scores[p.id]?.remarks || ''
    }));

    try {
      await API.submitVm({
        shift,
        floor,
        scorePercent,
        submittedBy: 'VM Inspector',
        entries
      });
      setSubmittedMsg(`VM Checklist submitted! Score: ${scorePercent.toFixed(0)}%`);
      setTimeout(() => setSubmittedMsg(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to submit VM checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Visual Merchandising Checklist" subtitle="Store Floor Styling & Display Standards Audit Desk">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Controls Bar */}
        <div className="card-glass p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-[#4A1726]/60 tracking-wider">Audit Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="select-modern mt-1"
              >
                <option value="Opening">Opening Audit (10 AM)</option>
                <option value="Mid-Day">Mid-Day Check (3 PM)</option>
                <option value="Closing">Closing Audit (9 PM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-[#4A1726]/60 tracking-wider">Floor Section</label>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="select-modern mt-1"
              >
                <option value="Ground Floor">Ground Floor (Sarees)</option>
                <option value="1st Floor">1st Floor (Suiting & Shirting)</option>
                <option value="2nd Floor">2nd Floor (Kids & Women)</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-gold text-xs py-2.5 px-6 flex items-center gap-2">
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Submitting...' : 'Submit Audit Report'}</span>
          </button>
        </div>

        {submittedMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{submittedMsg}</span>
          </div>
        )}

        {/* Audit Points List */}
        <div className="card-glass p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-[#4A1726] uppercase tracking-wider border-b pb-2">Floor Display Check Points</h3>
          <div className="space-y-4">
            {points.map((p, idx) => {
              const current = scores[p.id] || { score: 'Pass', remarks: '' };
              return (
                <div key={p.id} className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-extrabold text-sm text-[#4A1726]">{idx + 1}. {p.title}</div>
                    <div className="text-xs text-gray-500 font-medium">{p.section}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {['Pass', 'Fail', 'NA'].map((sc) => {
                      const selected = current.score === sc;
                      return (
                        <button
                          type="button"
                          key={sc}
                          onClick={() => setScores({
                            ...scores,
                            [p.id]: { ...current, score: sc }
                          })}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                            selected
                              ? sc === 'Pass' ? 'bg-emerald-600 text-white border-emerald-600'
                                : sc === 'Fail' ? 'bg-red-600 text-white border-red-600'
                                : 'bg-gray-600 text-white border-gray-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {sc}
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-full md:w-64">
                    <input
                      type="text"
                      placeholder="Remarks / Defect note..."
                      value={current.remarks}
                      onChange={(e) => setScores({
                        ...scores,
                        [p.id]: { ...current, remarks: e.target.value }
                      })}
                      className="input-modern text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
