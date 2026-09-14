import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, MapPin, Calendar, Briefcase, DollarSign, FileText, UserCheck, ShieldCheck, ExternalLink, Award, User, Heart, Layers, Building, Edit3, Save, RotateCcw } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { API } from '../../services/api';
import { showToast } from '../Toast';
import { formatName } from '../../utils/formatName';

interface EmployeeProfileModalProps {
  employee: any | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function EmployeeProfileModal({ employee, onClose, onUpdated }: EmployeeProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'professional' | 'documents'>('overview');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentEmp, setCurrentEmp] = useState<any | null>(employee);

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    setCurrentEmp(employee);
    if (employee) {
      // Initialize edit form from employee props
      const parseSal = (val: any) => {
        if (!val) return { base: '', inc: '' };
        const s = String(val).trim();
        if (s.includes('|')) {
          const p = s.split('|');
          return { base: p[0] || '', inc: p[1] || '' };
        }
        if (s.includes('+')) {
          const p = s.split('+');
          return { base: p[0] || '', inc: p[1] || '' };
        }
        return { base: s, inc: '' };
      };

      const salObj = parseSal(employee.salary);

      setEditForm({
        name: employee.name || employee.fullName || '',
        phone: employee.phone || '',
        email: employee.email || '',
        gender: employee.gender || 'MALE',
        dob: employee.dob ? employee.dob.split('T')[0] : '',
        bloodGroup: employee.bloodGroup || employee.blood_group || '',
        aadhaarNumber: employee.aadhaarNumber || employee.aadhaar_number || employee.aadharNumber || '',
        desig: employee.desig || employee.designation || '',
        department: employee.department || '',
        section: employee.section || '',
        branch: employee.branch || 'BSC EXCLUSIVE DAVANAGERE',
        reportingManager: employee.reportingManager || employee.reporting_manager || '',
        status: employee.status || 'Joined',
        salaryBase: salObj.base,
        salaryInc: salObj.inc,
        offeredDoj: employee.offeredDoj || employee.estDoj || employee.actualDoj || '',
        experience: employee.experience || '',
        retailExperience: employee.retailExperience || employee.retail_experience || '',
        qualification: employee.qualification || '',
        previousCompany: employee.previousCompany || employee.previous_company || '',
        previousDesignation: employee.previousDesignation || employee.previous_designation || '',
        previousSalary: employee.previousSalary || employee.previous_salary || '',
        fatherDetails: employee.fatherDetails || employee.father_details || '',
        motherDetails: employee.motherDetails || employee.mother_details || '',
        religion: employee.religion || '',
        caste: employee.caste || '',
        languagesKnown: employee.languagesKnown || employee.languages_known || '',
        remarks: employee.remarks || ''
      });
    }
  }, [employee]);

  if (!currentEmp) return null;

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return API.fileUrl ? API.fileUrl(url) : url;
  };

  const empName = formatName(currentEmp.name || currentEmp.fullName || 'Employee Profile');
  const empCode = currentEmp.employeeCode || currentEmp.empNo || currentEmp.appNo || (currentEmp.id ? `EMP-${currentEmp.id}` : '—');
  const desig = currentEmp.desig || currentEmp.designation || 'Staff Member';
  const dept = currentEmp.department || 'Retail Sales';
  const section = currentEmp.section || 'Unassigned';
  const photo = fileUrl(currentEmp.photoUrl);

  const parseSalary = (val: any) => {
    if (!val) return { base: 0, incentive: 0, total: 0 };
    const str = String(val).trim();
    if (str.includes('|')) {
      const parts = str.split('|');
      const base = parseFloat(parts[0]) || 0;
      const inc = parseFloat(parts[1]) || 0;
      return { base, incentive: inc, total: base + inc };
    }
    if (str.includes('+')) {
      const parts = str.split('+');
      const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      return { base, incentive: inc, total: base + inc };
    }
    const base = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return { base, incentive: 0, total: base };
  };

  const sal = parseSalary(currentEmp.salary);

  const handleSaveCompleteInfo = async () => {
    setSaving(true);
    try {
      const combinedSalary = editForm.salaryInc
        ? `${editForm.salaryBase}|${editForm.salaryInc}`
        : editForm.salaryBase;

      const appNoKey = currentEmp.appNo || currentEmp.empNo || currentEmp.id;

      const updatedPayload = {
        name: editForm.name,
        fullName: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        gender: editForm.gender,
        dob: editForm.dob,
        bloodGroup: editForm.bloodGroup,
        aadhaarNumber: editForm.aadhaarNumber,
        desig: editForm.desig,
        designation: editForm.desig,
        department: editForm.department,
        section: editForm.section,
        branch: editForm.branch,
        reportingManager: editForm.reportingManager,
        status: editForm.status,
        salary: combinedSalary,
        offeredDoj: editForm.offeredDoj,
        experience: editForm.experience,
        retailExperience: editForm.retailExperience,
        qualification: editForm.qualification,
        previousCompany: editForm.previousCompany,
        previousDesignation: editForm.previousDesignation,
        previousSalary: editForm.previousSalary,
        fatherDetails: editForm.fatherDetails,
        motherDetails: editForm.motherDetails,
        religion: editForm.religion,
        caste: editForm.caste,
        languagesKnown: editForm.languagesKnown,
        remarks: editForm.remarks
      };

      await API.updateCandidate(appNoKey, updatedPayload);

      showToast('Employee information updated successfully everywhere!', 'success');

      setCurrentEmp({
        ...currentEmp,
        ...updatedPayload
      });

      setIsEditing(false);

      if (onUpdated) {
        onUpdated();
      }
    } catch (err: any) {
      showToast('Failed to save employee changes: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#163B5C]/70 backdrop-blur-md transition-all animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#F4F6F9] rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border-2 border-[#4E8ABF]/50">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-[#163B5C] via-[#0E2A44] to-[#0B1F35] text-white p-5 sm:p-6 border-b-2 border-[#4E8ABF]/40 relative">
          {/* Action Buttons Header Top Right */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-gold px-3.5 py-1.5 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5"
                title="Edit Employee Information"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Info</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 text-xs font-black rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Cancel Edit</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 shadow-md"
              title="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Enlarged Photo / Avatar Picture */}
            <div className="relative shrink-0">
              {photo ? (
                <img
                  src={photo}
                  alt={empName}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-[#4E8ABF] shadow-2xl bg-white p-1"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-[#163B5C] to-[#1F4D77] text-white font-black text-3xl sm:text-4xl flex items-center justify-center border-4 border-[#4E8ABF] shadow-2xl">
                  {currentEmp.initials || empName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md border-2 border-white">
                Active Staff
              </span>
            </div>

            {/* Header Text Details */}
            <div className="text-center sm:text-left space-y-1.5 min-w-0 pr-24">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="font-black text-white text-xl sm:text-2xl tracking-tight">{empName}</h2>
                <StatusBadge status={currentEmp.status || 'Joined'} size="sm" />
              </div>

              <div className="text-xs text-[#4E8ABF] font-extrabold font-mono flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-amber-300">{empCode}</span>
                <span>•</span>
                <span className="text-white font-bold">{desig}</span>
                <span>•</span>
                <span className="text-white/80 font-normal">Department: {dept}</span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-white/80">
                {currentEmp.phone && (
                  <a href={`tel:${currentEmp.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-amber-300 font-bold border border-white/10">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{currentEmp.phone}</span>
                  </a>
                )}
                {currentEmp.email && (
                  <a href={`mailto:${currentEmp.email}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white/90 font-semibold border border-white/10">
                    <Mail className="w-3.5 h-3.5 text-[#4E8ABF]" />
                    <span>{currentEmp.email}</span>
                  </a>
                )}
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-emerald-300 font-bold">
                  <Layers className="w-3.5 h-3.5" /> Section: {section}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 p-2 sm:px-6 bg-white border-b border-[#E2E8F0] overflow-x-auto text-xs font-bold scrollbar-none sticky top-0 z-10 shadow-xs">
          {[
            { id: 'overview', label: '👤 Employment Overview' },
            { id: 'personal', label: '📋 Personal & Contact Details' },
            { id: 'professional', label: '💼 Experience & Background' },
            { id: 'documents', label: '📄 Verified Documents' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all text-xs font-black ${
                activeTab === t.id
                  ? 'bg-[#163B5C] text-[#4E8ABF] shadow-md ring-1 ring-[#4E8ABF]/30'
                  : 'text-[#475569] hover:bg-[#F4F6F9] hover:text-[#163B5C]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          
          {/* VIEW MODE */}
          {!isEditing ? (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#5F6E7E]">Base Monthly Salary</span>
                      <div className="text-lg font-mono font-black text-emerald-800">
                        {sal.base > 0 ? `₹ ${sal.base.toLocaleString('en-IN')}` : (currentEmp.salary || '—')}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#5F6E7E]">Date of Joining (DOJ)</span>
                      <div className="text-base font-extrabold text-[#163B5C]">
                        {currentEmp.offeredDoj || currentEmp.estDoj || currentEmp.actualDoj || currentEmp.date || '—'}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#5F6E7E]">Assigned Section</span>
                      <div className="text-base font-extrabold text-[#4E8ABF]">{section}</div>
                    </div>
                  </div>

                  {/* Compensation Breakdown */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
                    <h4 className="font-black text-[#163B5C] uppercase text-xs tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#4E8ABF]" />
                      <span>Compensation & Package Breakdown</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-[#F4F6F9] p-3 rounded-xl border border-[#E2E8F0]">
                        <div className="text-[9px] uppercase font-black text-[#5F6E7E] mb-0.5">Base Salary</div>
                        <div className="text-base font-bold text-[#163B5C] font-mono">₹{sal.base.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                        <div className="text-[9px] uppercase font-black text-emerald-800 mb-0.5">Monthly Incentive</div>
                        <div className="text-base font-bold text-emerald-700 font-mono">{sal.incentive > 0 ? `+₹${sal.incentive.toLocaleString('en-IN')}` : 'Included'}</div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-2xs">
                        <div className="text-[9px] uppercase font-black text-amber-900 mb-0.5">Total Package</div>
                        <div className="text-base font-black text-slate-900 font-mono">₹{sal.total.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Organization Placement */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
                    <h4 className="font-black text-[#163B5C] uppercase text-xs tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                      <Building className="w-4 h-4 text-[#4E8ABF]" />
                      <span>Store Floor & Department Assignment</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Department</span><span className="font-extrabold text-[#163B5C] text-sm">{dept}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Floor Section</span><span className="font-extrabold text-[#4E8ABF] text-sm">{section}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Designation Role</span><span className="font-extrabold text-[#163B5C]">{desig}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Reporting Manager</span><span className="font-extrabold text-[#163B5C]">{currentEmp.reportingManager || currentEmp.reporting_manager || 'Store Manager'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Store Branch</span><span className="font-extrabold text-[#163B5C]">{currentEmp.branch || 'BSC EXCLUSIVE DAVANAGERE'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Shift Schedule</span><span className="font-extrabold text-emerald-800">General Shift (10:00 AM – 09:00 PM)</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONAL & CONTACT */}
              {activeTab === 'personal' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                    <h4 className="font-black text-[#163B5C] uppercase text-xs tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-[#4E8ABF]" />
                      <span>Personal Profile & Identification</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Full Name</span><span className="font-extrabold text-[#163B5C] text-sm">{empName}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Gender</span><span className="font-extrabold text-[#163B5C]">{currentEmp.gender || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Date of Birth (DOB)</span><span className="font-extrabold text-[#163B5C]">{currentEmp.dob || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Blood Group</span><span className="font-black text-rose-700">{currentEmp.bloodGroup || currentEmp.blood_group || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Religion & Caste</span><span className="font-extrabold text-[#163B5C]">{currentEmp.religion || '—'} {currentEmp.caste ? `(${currentEmp.caste})` : ''}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Languages Spoken</span><span className="font-extrabold text-[#163B5C]">{currentEmp.languagesKnown || currentEmp.languages_known || 'Kannada, English, Hindi'}</span></div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                    <h4 className="font-black text-[#163B5C] uppercase text-xs tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#4E8ABF]" />
                      <span>Contact Address & Family Background</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Mobile Phone</span><span className="font-extrabold text-[#163B5C]">{currentEmp.phone || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Email Address</span><span className="font-extrabold text-[#163B5C]">{currentEmp.email || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Father's Details</span><span className="font-extrabold text-[#163B5C]">{currentEmp.fatherDetails || currentEmp.father_details || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Mother's Details</span><span className="font-extrabold text-[#163B5C]">{currentEmp.motherDetails || currentEmp.mother_details || '—'}</span></div>
                      <div className="sm:col-span-2"><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Residential Address</span><span className="font-extrabold text-[#163B5C]">{currentEmp.address || currentEmp.cityState || 'Davanagere, Karnataka'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROFESSIONAL & EXPERIENCE */}
              {activeTab === 'professional' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                    <h4 className="font-black text-[#163B5C] uppercase text-xs tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#4E8ABF]" />
                      <span>Work Experience & Prior Employment</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Total Experience</span><span className="font-extrabold text-[#163B5C]">{currentEmp.experience || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Retail Industry Experience</span><span className="font-extrabold text-[#163B5C]">{currentEmp.retailExperience || currentEmp.retail_experience || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Previous Company</span><span className="font-extrabold text-[#163B5C]">{currentEmp.previousCompany || currentEmp.previous_company || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Previous Role / Designation</span><span className="font-extrabold text-[#163B5C]">{currentEmp.previousDesignation || currentEmp.previous_designation || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Previous Base Salary</span><span className="font-extrabold text-[#163B5C]">{currentEmp.previousSalary || currentEmp.previous_salary || '—'}</span></div>
                      <div><span className="text-[#5F6E7E] block text-[10.5px] font-bold">Highest Qualification</span><span className="font-extrabold text-[#163B5C]">{currentEmp.qualification || '—'}</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#E2E8F0]/60">
                      <span className="text-[#5F6E7E] block text-[10.5px] mb-1 font-bold uppercase">Executive HR Remarks:</span>
                      <div className="p-3.5 rounded-xl bg-[#F4F6F9] border border-[#E2E8F0] text-xs font-semibold text-[#163B5C] italic">
                        {currentEmp.remarks || 'No executive remarks recorded.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: VERIFIED DOCUMENTS */}
              {activeTab === 'documents' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                    <h4 className="font-black text-[#163B5C] uppercase text-xs tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#4E8ABF]" />
                      <span>Onboarded Documents & Verification Links</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {fileUrl(currentEmp.photoUrl) && (
                        <a
                          href={fileUrl(currentEmp.photoUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F4F6F9] hover:bg-[#163B5C] hover:text-white transition-all flex items-center justify-between font-bold group"
                        >
                          <span>📷 Staff Profile Photo</span>
                          <ExternalLink className="w-4 h-4 text-[#4E8ABF] group-hover:text-white" />
                        </a>
                      )}
                      {fileUrl(currentEmp.aadhaarUrl || currentEmp.aadharUrl || currentEmp.aadhaar_url || currentEmp.aadhar_url) && (
                        <a
                          href={fileUrl(currentEmp.aadhaarUrl || currentEmp.aadharUrl || currentEmp.aadhaar_url || currentEmp.aadhar_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F4F6F9] hover:bg-[#163B5C] hover:text-white transition-all flex items-center justify-between font-bold group"
                        >
                          <span>📄 Aadhaar Card Document</span>
                          <ExternalLink className="w-4 h-4 text-[#4E8ABF] group-hover:text-white" />
                        </a>
                      )}
                      {fileUrl(currentEmp.resumeUrl) && (
                        <a
                          href={fileUrl(currentEmp.resumeUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F4F6F9] hover:bg-[#163B5C] hover:text-white transition-all flex items-center justify-between font-bold group"
                        >
                          <span>📑 Employee Resume / CV</span>
                          <ExternalLink className="w-4 h-4 text-[#4E8ABF] group-hover:text-white" />
                        </a>
                      )}
                    </div>
                    {!currentEmp.photoUrl && !currentEmp.resumeUrl && !(currentEmp.aadhaarUrl || currentEmp.aadharUrl || currentEmp.aadhaar_url || currentEmp.aadhar_url) && (
                      <div className="p-8 text-center text-[#5F6E7E] font-semibold italic">
                        No uploaded document files found for this profile.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* EDIT FORM MODE */
            <div className="space-y-4 animate-fade-in bg-white p-5 rounded-2xl border border-[#4E8ABF]/40 shadow-md">
              <h3 className="font-black text-[#163B5C] text-sm uppercase tracking-wider border-b border-[#E2E8F0] pb-2 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#4E8ABF]" />
                <span>Edit Complete Employee Record</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Full Employee Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Designation Role</label>
                  <input
                    type="text"
                    value={editForm.desig}
                    onChange={(e) => setEditForm({ ...editForm, desig: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Allocated Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Assigned Floor Section</label>
                  <input
                    type="text"
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-black text-[#4E8ABF] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Base Monthly Salary (₹)</label>
                  <input
                    type="text"
                    value={editForm.salaryBase}
                    onChange={(e) => setEditForm({ ...editForm, salaryBase: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-mono font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Monthly Incentive Bonus (₹)</label>
                  <input
                    type="text"
                    value={editForm.salaryInc}
                    onChange={(e) => setEditForm({ ...editForm, salaryInc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-mono font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Employment Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  >
                    <option value="Joined">Joined (Active Staff)</option>
                    <option value="Offer Accepted">Offer Accepted</option>
                    <option value="Notice Period">Notice Period</option>
                    <option value="Completed Exit">Completed Exit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">Date of Joining (DOJ)</label>
                  <input
                    type="date"
                    value={editForm.offeredDoj}
                    onChange={(e) => setEditForm({ ...editForm, offeredDoj: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-[#163B5C] uppercase mb-1">HR Executive Remarks</label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#163B5C] outline-none focus:ring-2 focus:ring-[#4E8ABF]/40"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F4F6F9] border-t border-[#E2E8F0] flex items-center justify-between">
          <div className="text-[11px] text-[#5F6E7E] font-bold">
            BSC EXCLUSIVE HRMS • AUTHORIZED EMPLOYEE REGISTER
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] bg-white font-extrabold text-xs text-[#475569]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCompleteInfo}
                  disabled={saving}
                  className="btn-gold text-xs px-6 py-2 shadow-md flex items-center gap-1.5 font-black"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Updating Database...' : 'Save Employee Details'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="btn-primary text-xs px-6 py-2 shadow-md"
              >
                Close Profile Overview
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
