import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  MinusCircle,
  Save,
  Layers,
  ArrowLeft,
  Store,
  Check,
  Building2,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { API, Auth } from '../services/api';

// Exact Floor and Section Structure
export const VM_FLOORS_DATA: Record<
  string,
  { label: string; sections: string[]; description: string; badge: string }
> = {
  'Ground Floor': {
    label: 'Ground Floor',
    description: 'Main Entrance & Saree Galleria',
    badge: '1 Section',
    sections: ['Normal Sarees']
  },
  'First Floor': {
    label: 'First Floor',
    description: 'High-Value Silk & Luxury Sarees',
    badge: '1 Section',
    sections: ['Silk Sarees (Up Laks)']
  },
  'Second Floor': {
    label: 'Second Floor',
    description: 'Ladies, Kids, Men & Female Apparel',
    badge: '4 Sections',
    sections: ['Ladies', 'Kids', 'Men', 'Female']
  },
  'Third Floor': {
    label: 'Third Floor',
    description: 'Men Formalwear & Home Furnishing',
    badge: '2 Sections',
    sections: ['Men', 'Home Furnishing']
  }
};

// Exact 11 Visual Merchandising Questions
export const DEFAULT_VM_QUESTIONS = [
  { id: 'vm_q1', title: 'Is the entire section clean, neat and well-maintained?' },
  { id: 'vm_q2', title: 'Are products arranged according to category, colour and size?' },
  { id: 'vm_q3', title: 'Are all racks, shelves, tables and displays properly aligned?' },
  { id: 'vm_q4', title: 'Are new arrivals and latest collections displayed prominently?' },
  { id: 'vm_q5', title: 'Are mannequins styled according to the current theme?' },
  { id: 'vm_q6', title: 'Are price tags, product labels and signages correctly placed and visible?' },
  { id: 'vm_q7', title: 'Are promotional and offer displays updated and correctly positioned?' },
  { id: 'vm_q8', title: 'Is the colour blocking and overall visual theme maintained?' },
  { id: 'vm_q9', title: 'Are the folded, hanging and stacked products properly presented?' },
  { id: 'vm_q10', title: 'Does the section meet the daily VM standard and look attractive to customers?' },
  { id: 'vm_q11', title: 'Are all display lights, LED screens and decorative elements working properly?' }
];

export default function VmChecklist() {
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [shift, setShift] = useState<string>('Opening');
  const [points, setPoints] = useState<any[]>(DEFAULT_VM_QUESTIONS);
  const [scores, setScores] = useState<Record<string, { score: string; remarks: string }>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  useEffect(() => {
    API.getVmPoints()
      .then((res: any) => {
        if (res && res.points && res.points.length >= 11) {
          setPoints(res.points);
          initScores(res.points);
        } else {
          setPoints(DEFAULT_VM_QUESTIONS);
          initScores(DEFAULT_VM_QUESTIONS);
        }
      })
      .catch(() => {
        setPoints(DEFAULT_VM_QUESTIONS);
        initScores(DEFAULT_VM_QUESTIONS);
      });
  }, []);

  const initScores = (qList: any[]) => {
    const initial: Record<string, { score: string; remarks: string }> = {};
    qList.forEach((p: any) => {
      initial[p.id] = { score: 'Pass', remarks: '' };
    });
    setScores(initial);
  };

  const resetAllSelections = () => {
    setSelectedFloor(null);
    setSelectedSection(null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const resetSectionOnly = () => {
    setSelectedSection(null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const handleFloorChangeFromControls = (newFloor: string) => {
    setSelectedFloor(newFloor);
    const availableSections = VM_FLOORS_DATA[newFloor]?.sections || [];
    setSelectedSection(availableSections[0] || null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const handleSectionChangeFromControls = (newSection: string) => {
    setSelectedSection(newSection);
    setSubmittedMsg(null);
    initScores(points);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloor || !selectedSection) return;

    setSubmitting(true);
    setSubmittedMsg(null);

    const total = points.length;
    const passCount = Object.values(scores).filter((s) => s.score === 'Pass').length;
    const scorePercent = total > 0 ? (passCount / total) * 100 : 100;

    const entries = points.map((p) => ({
      pointId: p.id,
      pointTitle: p.title,
      score: scores[p.id]?.score || 'Pass',
      remarks: scores[p.id]?.remarks || ''
    }));

    const session = Auth.get();
    const auditorName = session?.fullName || session?.username || 'VM Inspector';

    try {
      await API.submitVm({
        shift,
        floor: selectedFloor,
        section: selectedSection,
        scorePercent,
        submittedBy: auditorName,
        entries
      });
      setSubmittedMsg(
        `Visual Merchandising Checklist submitted successfully for ${selectedFloor} — ${selectedSection}! Score: ${scorePercent.toFixed(0)}%`
      );
    } catch (err: any) {
      console.error(err);
      alert('Failed to submit VM checklist: ' + (err.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  const passCount = Object.values(scores).filter((s) => s.score === 'Pass').length;
  const failCount = Object.values(scores).filter((s) => s.score === 'Fail').length;
  const naCount = Object.values(scores).filter((s) => s.score === 'NA').length;
  const currentScorePercent = points.length > 0 ? Math.round((passCount / points.length) * 100) : 100;

  return (
    <DashboardLayout
      title="Visual Merchandising Checklist"
      subtitle="Store Floor Styling & Display Standards Audit Desk"
    >
      <div className="space-y-6">
        {/* VIEW 1: FLOOR SELECTION (Initial State) */}
        {!selectedFloor && (
          <div className="space-y-6 animate-fade-in">
            <div className="card-glass p-6 sm:p-8 space-y-4 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary text-accent flex items-center justify-center font-black shrink-0 shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black text-accent uppercase tracking-wider">Step 1 of 2</div>
                  <h2 className="text-xl font-black text-primary tracking-tight">Select Store Floor</h2>
                  <p className="text-xs text-primary/70 font-medium mt-0.5">
                    Choose a store floor to begin the Visual Merchandising audit inspection.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(VM_FLOORS_DATA).map(([floorKey, floorInfo]) => (
                <button
                  type="button"
                  key={floorKey}
                  onClick={() => setSelectedFloor(floorKey)}
                  className="card-glass p-6 text-left hover:border-accent hover:shadow-xl transition-all duration-200 group cursor-pointer flex flex-col justify-between h-48 relative overflow-hidden bg-white"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary group-hover:bg-accent/20 group-hover:text-accent-hover transition-colors">
                        {floorInfo.badge}
                      </span>
                      <ChevronRight className="w-4 h-4 text-primary/40 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="font-extrabold text-base text-primary group-hover:text-accent-hover transition-colors">
                      {floorInfo.label}
                    </h3>
                    <p className="text-xs text-primary/70 font-medium leading-relaxed">
                      {floorInfo.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-accent-soft/60 flex items-center justify-between text-[11px] font-bold text-accent">
                    <span>View Sections</span>
                    <span>→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: SECTION SELECTION (Floor Selected, Section Not Selected) */}
        {selectedFloor && !selectedSection && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Back Action */}
            <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetAllSelections}
                  className="p-2.5 rounded-xl border border-accent/40 bg-white hover:bg-accent/10 text-primary transition-all cursor-pointer shadow-xs"
                  title="Back to Floor Selection"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <span>Floor: {selectedFloor}</span>
                    <span>•</span>
                    <span>Step 2 of 2</span>
                  </div>
                  <h2 className="text-xl font-black text-primary tracking-tight">
                    Select Section on {selectedFloor}
                  </h2>
                  <p className="text-xs text-primary/70 font-medium mt-0.5">
                    Showing only sections assigned to {selectedFloor}. Select one to load the 11 VM evaluation check points.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetAllSelections}
                className="btn-outline text-xs px-4 py-2 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Switch Floor</span>
              </button>
            </div>

            {/* Sections Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {VM_FLOORS_DATA[selectedFloor]?.sections.map((secName) => (
                <button
                  type="button"
                  key={secName}
                  onClick={() => {
                    setSelectedSection(secName);
                    initScores(points);
                  }}
                  className="card-glass p-6 text-left hover:border-accent hover:shadow-xl transition-all duration-200 group cursor-pointer flex flex-col justify-between h-40 bg-white"
                >
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent-hover flex items-center justify-center font-black">
                      <Store className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-base text-primary group-hover:text-accent-hover transition-colors">
                      {secName}
                    </h3>
                    <p className="text-[11px] text-primary/70 font-medium">
                      {selectedFloor} Department
                    </p>
                  </div>

                  <div className="pt-2 border-t border-accent-soft/60 flex items-center justify-between text-xs font-black text-accent">
                    <span>Audit Section</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: 11 QUESTIONS EVALUATION CHECKLIST (Floor & Section Selected) */}
        {selectedFloor && selectedSection && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            {/* Active Audit Location Banner & Controls Bar */}
            <div className="card-glass p-5 space-y-4 border-2 border-accent/40 bg-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-accent-soft/60">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary text-accent flex items-center justify-center font-black shadow-md shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                        📍 {selectedFloor}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent-hover font-bold">
                        🏷️ {selectedSection}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        11 VM Questions Active
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-primary tracking-tight mt-1">
                      Visual Merchandising Audit: {selectedSection}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={resetSectionOnly}
                    className="px-3 py-1.5 rounded-xl border border-accent/40 text-primary text-xs font-bold hover:bg-accent/10 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Store className="w-3.5 h-3.5 text-accent" />
                    <span>Change Section</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetAllSelections}
                    className="px-3 py-1.5 rounded-xl border border-primary/20 text-primary text-xs font-bold hover:bg-primary/5 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>Change Floor</span>
                  </button>
                </div>
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-1">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary/70 tracking-wider">
                    Store Floor
                  </label>
                  <select
                    value={selectedFloor}
                    onChange={(e) => handleFloorChangeFromControls(e.target.value)}
                    className="select-modern font-bold text-xs mt-1 w-full"
                  >
                    {Object.keys(VM_FLOORS_DATA).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary/70 tracking-wider">
                    Floor Section
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => handleSectionChangeFromControls(e.target.value)}
                    className="select-modern font-bold text-xs mt-1 w-full"
                  >
                    {VM_FLOORS_DATA[selectedFloor]?.sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary/70 tracking-wider">
                    Audit Shift
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="select-modern font-bold text-xs mt-1 w-full"
                  >
                    <option value="Opening">Opening Audit (10 AM)</option>
                    <option value="Mid-Day">Mid-Day Check (3 PM)</option>
                    <option value="Closing">Closing Audit (9 PM)</option>
                  </select>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-gold text-xs py-2.5 px-6 font-extrabold flex items-center justify-center gap-2 w-full cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{submitting ? 'Submitting Report…' : 'Submit Audit Report'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Success Banner */}
            {submittedMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{submittedMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={resetSectionOnly}
                  className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-extrabold transition-colors cursor-pointer shrink-0"
                >
                  Audit Next Section →
                </button>
              </div>
            )}

            {/* Real-time Audit Score Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card-glass p-4 bg-white border border-accent-soft flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-primary/60">Compliance Score</div>
                  <div className="text-xl font-black text-primary font-mono mt-0.5">{currentScorePercent}%</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent font-black flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>

              <div className="card-glass p-4 bg-white border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-800/80">Passed</div>
                  <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">{passCount} / 11</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
              </div>

              <div className="card-glass p-4 bg-white border border-rose-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-rose-800/80">Failed</div>
                  <div className="text-xl font-black text-rose-700 font-mono mt-0.5">{failCount} / 11</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 font-black flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="card-glass p-4 bg-white border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-gray-600">N/A</div>
                  <div className="text-xl font-black text-gray-700 font-mono mt-0.5">{naCount} / 11</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-black flex items-center justify-center">
                  <MinusCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 11 Visual Merchandising Check Points List */}
            <div className="card-glass p-6 space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-accent-soft pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider">
                    Visual Merchandising Checklist Evaluation (11 Points)
                  </h3>
                  <p className="text-xs text-primary/70 font-medium mt-0.5">
                    Evaluating section standard compliance for: <strong className="text-primary">{selectedFloor} — {selectedSection}</strong>
                  </p>
                </div>
                <span className="text-xs font-bold text-accent">
                  {Object.keys(scores).length} of 11 Rated
                </span>
              </div>

              <div className="space-y-3.5">
                {points.map((p, idx) => {
                  const current = scores[p.id] || { score: 'Pass', remarks: '' };
                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-background/50 border border-accent-soft hover:border-accent/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-xs sm:text-sm text-primary leading-snug">
                            {p.title}
                          </span>
                        </div>
                      </div>

                      {/* Evaluation Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {(['Pass', 'Fail', 'NA'] as const).map((sc) => {
                          const selected = current.score === sc;
                          return (
                            <button
                              type="button"
                              key={sc}
                              onClick={() =>
                                setScores({
                                  ...scores,
                                  [p.id]: { ...current, score: sc }
                                })
                              }
                              className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                                selected
                                  ? sc === 'Pass'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : sc === 'Fail'
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                    : 'bg-gray-700 text-white border-gray-700 shadow-sm'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {sc === 'Pass' ? '✓ Pass' : sc === 'Fail' ? '✗ Fail' : '— N/A'}
                            </button>
                          );
                        })}
                      </div>

                      {/* Remarks Input */}
                      <div className="w-full md:w-72 shrink-0">
                        <input
                          type="text"
                          placeholder="Remarks / Defect note..."
                          value={current.remarks}
                          onChange={(e) =>
                            setScores({
                              ...scores,
                              [p.id]: { ...current, remarks: e.target.value }
                            })
                          }
                          className="input-modern text-xs w-full bg-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Submit Action */}
              <div className="pt-4 border-t border-accent-soft flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetSectionOnly}
                  className="px-4 py-2 rounded-xl border border-accent/40 text-primary text-xs font-bold hover:bg-accent/10 transition-all cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Choose Another Section</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold text-xs py-2.5 px-6 font-extrabold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Submitting Report…' : 'Submit Audit Report'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
