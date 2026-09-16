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
  Plus,
  Trash2,
  FolderPlus,
  Info,
  X,
  Tag,
  ShieldCheck
} from 'lucide-react';
import { API, Auth } from '../services/api';

export interface FloorItem {
  id?: string;
  name: string;
  label: string;
  description: string;
  badge?: string;
  sections: string[];
  isCustom?: boolean;
  createdAt?: string;
}

// Built-in Floor and Section Definitions
export const DEFAULT_VM_FLOORS: Record<string, FloorItem> = {
  'Ground Floor': {
    name: 'Ground Floor',
    label: 'Ground Floor',
    description: 'Main Entrance & Saree Galleria',
    badge: '1 Section',
    sections: ['Normal Sarees']
  },
  'First Floor': {
    name: 'First Floor',
    label: 'First Floor',
    description: 'High-Value Silk & Luxury Sarees',
    badge: '1 Section',
    sections: ['Silk Sarees (Up Laks)']
  },
  'Second Floor': {
    name: 'Second Floor',
    label: 'Second Floor',
    description: 'Ladies, Kids, Men & Female Apparel',
    badge: '4 Sections',
    sections: ['Ladies', 'Kids', 'Men', 'Female']
  },
  'Third Floor': {
    name: 'Third Floor',
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
  const session = Auth.get();
  const isAdmin = !session || session.role === 'Admin' || session.role === 'Super Admin';

  // Floor & Section Hierarchy State
  const [floorsData, setFloorsData] = useState<Record<string, FloorItem>>(DEFAULT_VM_FLOORS);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Audit Form State
  const [shift, setShift] = useState<string>('Opening');
  const [points, setPoints] = useState<any[]>(DEFAULT_VM_QUESTIONS);
  const [scores, setScores] = useState<Record<string, { score: string; remarks: string }>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  // Admin "Create New Floor Folder" Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [newFloorDesc, setNewFloorDesc] = useState('');
  const [newSectionInput, setNewSectionInput] = useState('');
  const [newSectionsList, setNewSectionsList] = useState<string[]>([]);
  const [creatingFloor, setCreatingFloor] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load custom floors from backend & questions
  useEffect(() => {
    loadFloorsAndQuestions();
  }, []);

  const loadFloorsAndQuestions = async () => {
    // 1. Fetch VM Checkpoints
    try {
      const res = await API.getVmPoints();
      if (res && res.points && res.points.length >= 11) {
        setPoints(res.points);
        initScores(res.points);
      } else {
        setPoints(DEFAULT_VM_QUESTIONS);
        initScores(DEFAULT_VM_QUESTIONS);
      }
    } catch {
      setPoints(DEFAULT_VM_QUESTIONS);
      initScores(DEFAULT_VM_QUESTIONS);
    }

    // 2. Fetch Custom Store Floors
    try {
      const floorRes = await API.getVmFloors();
      if (floorRes && Array.isArray(floorRes.floors)) {
        const merged: Record<string, FloorItem> = { ...DEFAULT_VM_FLOORS };
        floorRes.floors.forEach((f: any) => {
          merged[f.name] = {
            id: f.id,
            name: f.name,
            label: f.name,
            description: f.description || 'Custom Store Department',
            badge: `${f.sections?.length || 1} Section${(f.sections?.length || 1) > 1 ? 's' : ''}`,
            sections: f.sections || ['General'],
            isCustom: true
          };
        });
        setFloorsData(merged);
      }
    } catch (e) {
      // Fallback: check localStorage for custom floors
      try {
        const cached = localStorage.getItem('bsc_custom_vm_floors');
        if (cached) {
          const parsed = JSON.parse(cached);
          setFloorsData({ ...DEFAULT_VM_FLOORS, ...parsed });
        }
      } catch {}
    }
  };

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
    const availableSections = floorsData[newFloor]?.sections || [];
    setSelectedSection(availableSections[0] || null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const handleSectionChangeFromControls = (newSection: string) => {
    setSelectedSection(newSection);
    setSubmittedMsg(null);
    initScores(points);
  };

  // Add section pill to modal
  const handleAddSectionToModal = () => {
    const trimmed = newSectionInput.trim();
    if (!trimmed) return;
    if (newSectionsList.includes(trimmed)) {
      setNewSectionInput('');
      return;
    }
    setNewSectionsList([...newSectionsList, trimmed]);
    setNewSectionInput('');
  };

  // Remove section pill from modal
  const handleRemoveSectionFromModal = (secToRemove: string) => {
    setNewSectionsList(newSectionsList.filter((s) => s !== secToRemove));
  };

  // Submit New Floor Creation
  const handleCreateFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const name = newFloorName.trim();
    if (!name) {
      setCreateError('Please enter a Floor / Folder name.');
      return;
    }

    if (floorsData[name]) {
      setCreateError(`A floor named "${name}" already exists.`);
      return;
    }

    const sections = [...newSectionsList];
    if (newSectionInput.trim() && !sections.includes(newSectionInput.trim())) {
      sections.push(newSectionInput.trim());
    }

    if (sections.length === 0) {
      setCreateError('Please add at least one department section to this floor.');
      return;
    }

    setCreatingFloor(true);
    try {
      const payload = {
        name,
        description: newFloorDesc.trim() || 'Store Department & Merchandise Galleria',
        sections
      };

      await API.createVmFloor(payload);

      // Update state
      const updatedFloors: Record<string, FloorItem> = {
        ...floorsData,
        [name]: {
          name,
          label: name,
          description: payload.description,
          badge: `${sections.length} Section${sections.length > 1 ? 's' : ''}`,
          sections,
          isCustom: true
        }
      };
      setFloorsData(updatedFloors);

      try {
        const customOnly: Record<string, FloorItem> = {};
        Object.entries(updatedFloors).forEach(([k, v]) => {
          if (v.isCustom) customOnly[k] = v;
        });
        localStorage.setItem('bsc_custom_vm_floors', JSON.stringify(customOnly));
      } catch {}

      // Reset modal
      setNewFloorName('');
      setNewFloorDesc('');
      setNewSectionInput('');
      setNewSectionsList([]);
      setIsCreateModalOpen(false);
      setSubmittedMsg(`New store floor folder "${name}" created successfully with all sections ready for audit!`);
    } catch (err: any) {
      setCreateError('Failed to create floor folder: ' + (err.message || 'Server error'));
    } finally {
      setCreatingFloor(false);
    }
  };

  // Delete custom floor
  const handleDeleteCustomFloor = async (floorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove floor folder "${floorName}"?`)) return;

    try {
      await API.deleteVmFloor({ name: floorName });
      const copy = { ...floorsData };
      delete copy[floorName];
      setFloorsData(copy);

      try {
        const customOnly: Record<string, FloorItem> = {};
        Object.entries(copy).forEach(([k, v]) => {
          if (v.isCustom) customOnly[k] = v;
        });
        localStorage.setItem('bsc_custom_vm_floors', JSON.stringify(customOnly));
      } catch {}

      if (selectedFloor === floorName) {
        resetAllSelections();
      }
    } catch (err: any) {
      alert('Failed to remove floor: ' + (err.message || 'Server error'));
    }
  };

  // Submit Audit Checklist
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
            {/* Step 1 Header Banner */}
            <div className="card-glass p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary text-accent flex items-center justify-center font-black shrink-0 shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <span>Step 1 of 2</span>
                    <span>•</span>
                    <span>Store Floor Directory</span>
                  </div>
                  <h2 className="text-xl font-black text-primary tracking-tight">Select Store Floor</h2>
                  <p className="text-xs text-primary/70 font-medium mt-0.5">
                    Choose a store floor to begin the Visual Merchandising audit inspection.
                  </p>
                </div>
              </div>

              {/* Admin Action: Create New Floor / Folder Button */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-gold text-xs px-4 py-2.5 font-extrabold flex items-center gap-2 cursor-pointer shadow-md shrink-0"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ Create New Floor / Folder</span>
                </button>
              )}
            </div>

            {/* Notification Banner */}
            {submittedMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{submittedMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmittedMsg(null)}
                  className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Floor Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(floorsData).map(([floorKey, floorInfo]) => (
                <div
                  key={floorKey}
                  onClick={() => setSelectedFloor(floorKey)}
                  className="card-glass p-5 text-left hover:border-accent hover:shadow-xl transition-all duration-200 group cursor-pointer flex flex-col justify-between h-64 relative overflow-hidden bg-white border border-accent/25"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary group-hover:bg-accent/20 group-hover:text-accent-hover transition-colors">
                        {floorInfo.sections.length} Section{floorInfo.sections.length > 1 ? 's' : ''}
                      </span>
                      {floorInfo.isCustom && isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomFloor(floorKey, e)}
                          title="Remove custom floor folder"
                          className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <h3 className="font-extrabold text-base text-primary group-hover:text-accent-hover transition-colors flex items-center gap-1.5">
                        <span>{floorInfo.label}</span>
                        {floorInfo.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                            Custom
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-primary/70 font-medium mt-0.5 line-clamp-2">
                        {floorInfo.description}
                      </p>
                    </div>

                    {/* Section Details Pills - Shows all details for this floor */}
                    <div className="pt-2 border-t border-accent-soft/60 space-y-1.5">
                      <div className="text-[9.5px] font-black uppercase text-primary/50 tracking-wider">
                        Included Sections:
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                        {floorInfo.sections.map((sec) => (
                          <span
                            key={sec}
                            className="px-2 py-0.5 rounded-md bg-background text-primary text-[10px] font-bold border border-accent-soft shrink-0"
                          >
                            {sec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-accent-soft/60 flex items-center justify-between text-xs font-black text-accent">
                    <span>View Sections</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}

              {/* Action Card: Add New Floor Folder */}
              {isAdmin && (
                <div
                  onClick={() => setIsCreateModalOpen(true)}
                  className="card-glass p-5 border-2 border-dashed border-accent/40 hover:border-accent hover:bg-accent/5 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center gap-3 h-64 group bg-white/60"
                >
                  <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent-hover flex items-center justify-center font-black group-hover:scale-110 transition-transform shadow-xs">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-primary group-hover:text-accent-hover transition-colors">
                      + Create New Floor Folder
                    </h3>
                    <p className="text-[11px] text-primary/65 font-medium mt-1 max-w-[200px]">
                      Add a custom floor with assigned department sections & VM criteria
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent/15 text-accent">
                    Admin Option
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: SECTION SELECTION (Floor Selected, Section Not Selected) */}
        {selectedFloor && !selectedSection && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Back Action */}
            <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30 shadow-xs">
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
              {floorsData[selectedFloor]?.sections.map((secName) => (
                <button
                  type="button"
                  key={secName}
                  onClick={() => {
                    setSelectedSection(secName);
                    initScores(points);
                  }}
                  className="card-glass p-6 text-left hover:border-accent hover:shadow-xl transition-all duration-200 group cursor-pointer flex flex-col justify-between h-44 bg-white border border-accent/25"
                >
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent-hover flex items-center justify-center font-black">
                      <Store className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-base text-primary group-hover:text-accent-hover transition-colors">
                      {secName}
                    </h3>
                    <p className="text-[11px] text-primary/70 font-medium">
                      {selectedFloor} Department Section
                    </p>
                  </div>

                  <div className="pt-2 border-t border-accent-soft/60 flex items-center justify-between text-xs font-black text-accent">
                    <span>Audit Section (11 Points)</span>
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
                    {Object.keys(floorsData).map((f) => (
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
                    {floorsData[selectedFloor]?.sections.map((s) => (
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

            {/* Real-time Audit Score Summary Cards */}
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

      {/* CREATE NEW FLOOR / FOLDER MODAL (ADMIN ONLY) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="card-glass bg-white rounded-3xl w-full max-w-lg shadow-2xl border-2 border-accent/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-primary via-primary to-[#0B1F35] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center font-black">
                  <FolderPlus className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Create New Floor / Department Folder</h3>
                  <p className="text-xs text-accent">Admin Store Configuration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateFloorSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Floor Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-primary/70 tracking-wider">
                  Floor / Folder Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fourth Floor, Basement Galleria, Mezzanine"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  className="input-modern text-xs w-full font-bold"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-primary/70 tracking-wider">
                  Description / Department Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ethnic Wear, Bridal Studio, Accessories"
                  value={newFloorDesc}
                  onChange={(e) => setNewFloorDesc(e.target.value)}
                  className="input-modern text-xs w-full"
                />
              </div>

              {/* Department Sections */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-primary/70 tracking-wider">
                  Department Sections <span className="text-rose-600">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Bridal Lehengas, Designer Kurtas"
                    value={newSectionInput}
                    onChange={(e) => setNewSectionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSectionToModal();
                      }
                    }}
                    className="input-modern text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddSectionToModal}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-extrabold hover:bg-primary-hover cursor-pointer"
                  >
                    + Add Section
                  </button>
                </div>

                {/* Section Pills Display */}
                <div className="p-3 bg-background rounded-xl border border-accent-soft/80 min-h-16 flex flex-wrap items-center gap-1.5">
                  {newSectionsList.length === 0 ? (
                    <span className="text-xs text-primary/50 italic">
                      No sections added yet. Type a section name above and click "+ Add Section".
                    </span>
                  ) : (
                    newSectionsList.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-primary text-xs font-bold border border-accent/40 shadow-2xs"
                      >
                        <Tag className="w-3 h-3 text-accent" />
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSectionFromModal(s)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Quick suggestion tags */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-primary/60">Quick Suggestions:</span>
                <div className="flex flex-wrap gap-1">
                  {['Bridal Studio', 'Accessories', 'Footwear', 'Jewellery', 'Custom Tailoring', 'Western Wear'].map(
                    (sugg) => (
                      <button
                        type="button"
                        key={sugg}
                        onClick={() => {
                          if (!newSectionsList.includes(sugg)) {
                            setNewSectionsList([...newSectionsList, sugg]);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent-hover font-semibold transition-colors cursor-pointer"
                      >
                        + {sugg}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-accent-soft flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/30 text-primary text-xs font-bold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFloor}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {creatingFloor ? 'Creating Floor…' : 'Create Store Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
