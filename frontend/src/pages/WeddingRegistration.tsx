import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import {
  User, Phone, Mail, MapPin, Calendar, Heart,
  ShoppingBag, Building2, CheckCircle2,
  ArrowRight, ArrowLeft, Star, Clock, DollarSign,
  CreditCard, Sparkles, Building, Home, Package,
  Search, X, ChevronDown, Check, AlertCircle
} from 'lucide-react';

const STORE_INFO: Record<number, { name: string; code: string; address: string; phone: string }> = {
  1: { name: 'Belagavi', code: 'BEL', address: '1st Gate Road, Shukrawar Peth Road, Shivaji Colony, Tilakwadi, Belagavi, Karnataka – 590006', phone: '0831-246XXXX' },
  2: { name: 'Davanagere', code: 'DAV', address: 'Medical College Road, MCC B Block, Kuvempu Nagar, Davangere, Karnataka – 577004', phone: '08192-25XXXX' },
  3: { name: 'Shivamogga', code: 'SHI', address: 'BSC Textiles, Shivamogga, Karnataka', phone: '' }
};

const LOCATIONS = [
  { id: 1, name: 'Belagavi', code: 'BEL' },
  { id: 2, name: 'Davanagere', code: 'DAV' },
  { id: 3, name: 'Shivamogga', code: 'SHI' }
];

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const WEDDING_TYPES = ['Hindu Wedding', 'Muslim Wedding', 'Christian Wedding', 'Jain Wedding', 'Sikh Wedding', 'Other'];
const DATE_FLEXIBILITY = ['Fixed Date', 'Flexible Date', 'Not Decided'];
const WEDDING_FUNCTIONS = [
  { id: 'engagement', label: 'Engagement' },
  { id: 'haldi', label: 'Haldi' },
  { id: 'mehendi', label: 'Mehendi' },
  { id: 'sangeet', label: 'Sangeet' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'reception', label: 'Reception' },
  { id: 'other', label: 'Other' }
];
const BUDGET_RANGES = [
  'Below ₹25,000',
  '₹25,000 – ₹50,000',
  '₹50,000 – ₹1,00,000',
  '₹1,00,000 – ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  'Above ₹5,00,000',
  'Not Decided'
];
const SHOPPING_CATEGORIES = [
  { category: 'Women', items: ['Silk Sarees', 'Wedding Sarees', 'Designer Sarees', 'Reception Sarees', 'Party Wear', 'Ladies Wear', 'Kids Wear'] },
  { category: 'Men', items: ['Suit', 'Sherwani', 'Kurta', 'Shirt', 'Trousers', "Men's Traditional Wear"] },
  { category: 'Family', items: ['Family Shopping', "Bride's Family", "Groom's Family", 'Relatives', 'Kids'] },
  { category: 'Home / Gift', items: ['Home Furnishing', 'Towels', 'Wedding Gifts', 'Return Gifts', 'Other'] }
];
const SHOPPING_TIMES = ['Morning', 'Afternoon', 'Evening', 'Flexible'];
const CONTACT_METHODS = ['Phone Call', 'WhatsApp', 'SMS', 'Email'];
const FOLLOWUP_TIMES = ['9 AM – 12 PM', '12 PM – 3 PM', '3 PM – 6 PM', '6 PM – 9 PM', 'Any Time'];
const EXISTING_CUSTOMER = ['Yes', 'No', 'Not Sure'];

const initialForm = {
  // Step 1: Store Location
  location_id: '',
  // Step 2: Customer Details
  customer_name: '',
  mobile: '',
  alternate_mobile: '',
  email: '',
  gender: '',
  age: '',
  address: '',
  area: '',
  city: '',
  pincode: '',
  // Step 3: Wedding Details
  wedding_date: '',
  wedding_date_flexibility: '',
  wedding_venue: '',
  wedding_city: '',
  wedding_type: '',
  wedding_functions: [] as string[],
  guest_count: '',
  family_size: '',
  // Step 4: Bride & Groom Details
  bride_name: '',
  bride_age: '',
  bride_contact: '',
  bride_shopping_required: true,
  groom_name: '',
  groom_age: '',
  groom_contact: '',
  groom_shopping_required: true,
  // Step 5: Shopping Requirements
  shopping_requirements: {} as Record<string, string[]>,
  budget_range: '',
  // Step 6: Visit & Follow-up Preferences
  preferred_shopping_date: '',
  preferred_shopping_time: '',
  expected_visitors: '',
  existing_customer: '',
  existing_customer_id: '',
  previous_store: '',
  preferred_contact_method: '',
  preferred_followup_time: '',
  // Step 7: Additional Information
  additional_notes: '',
  // Step 8: Consent
  consent: false
};

export default function WeddingRegistrationPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Submitting Registration...');
  const [successRegId, setSuccessRegId] = useState('');
  const [dupWarn, setDupWarn] = useState('');

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!form.location_id) newErrors.location_id = 'Please select a BSC store location';
    }
    else if (stepNum === 2) {
      if (!form.customer_name?.trim() || form.customer_name.trim().length < 2) newErrors.customer_name = 'Full name is required (minimum 2 characters)';
      if (!form.mobile?.trim()) newErrors.mobile = 'Mobile number is required';
      else if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, ''))) newErrors.mobile = 'Enter a valid 10-digit Indian mobile number';
      if (form.alternate_mobile && !/^[6-9]\d{9}$/.test(form.alternate_mobile.replace(/\D/g, ''))) newErrors.alternate_mobile = 'Enter a valid 10-digit mobile number';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Enter a valid email address';
      if (!form.gender) newErrors.gender = 'Please select gender';
      if (!form.city?.trim()) newErrors.city = 'City is required';
      if (!form.address?.trim()) newErrors.address = 'Full address is required';
      if (!form.pincode?.trim() || !/^\d{6}$/.test(form.pincode)) newErrors.pincode = 'Enter a valid 6-digit PIN code';
    }
    else if (stepNum === 3) {
      if (!form.wedding_date) newErrors.wedding_date = 'Wedding date is required';
      else {
        const weddingDate = new Date(form.wedding_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (weddingDate < today) newErrors.wedding_date = 'Wedding date cannot be in the past';
      }
      if (!form.wedding_date_flexibility) newErrors.wedding_date_flexibility = 'Please select wedding date flexibility';
      if (!form.wedding_type) newErrors.wedding_type = 'Please select wedding type';
      if (!form.wedding_functions?.length) newErrors.wedding_functions = 'Select at least one wedding function';
    }
    else if (stepNum === 4) {
      if (!form.bride_name?.trim()) newErrors.bride_name = 'Bride name is required';
      if (!form.groom_name?.trim()) newErrors.groom_name = 'Groom name is required';
      if (form.bride_age && (parseInt(form.bride_age) < 18 || parseInt(form.bride_age) > 100)) newErrors.bride_age = 'Enter a valid age (18-100)';
      if (form.groom_age && (parseInt(form.groom_age) < 18 || parseInt(form.groom_age) > 100)) newErrors.groom_age = 'Enter a valid age (18-100)';
    }
    else if (stepNum === 5) {
      const hasSelections = form.shopping_requirements && Object.values(form.shopping_requirements).some(arr => arr.length > 0);
      if (!hasSelections) newErrors.shopping_requirements = 'Select at least one shopping requirement';
      if (!form.budget_range) newErrors.budget_range = 'Please select estimated budget range';
    }
    else if (stepNum === 6) {
      if (!form.preferred_shopping_date) newErrors.preferred_shopping_date = 'Preferred shopping date is required';
      else {
        const shopDate = new Date(form.preferred_shopping_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (shopDate < today) newErrors.preferred_shopping_date = 'Preferred shopping date cannot be in the past';
      }
      if (!form.preferred_shopping_time) newErrors.preferred_shopping_time = 'Please select preferred shopping time';
      if (!form.preferred_contact_method) newErrors.preferred_contact_method = 'Please select preferred contact method';
      if (!form.preferred_followup_time) newErrors.preferred_followup_time = 'Please select preferred follow-up time';
      if (form.existing_customer === 'Yes') {
        if (!form.existing_customer_id?.trim()) newErrors.existing_customer_id = 'Please enter existing customer ID';
      }
    }
    else if (stepNum === 7) {
      // Optional step
    }
    else if (stepNum === 8) {
      if (!form.consent) newErrors.consent = 'You must agree to the consent before submitting';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleMultiSelect = (category: string, item: string) => {
    setForm(prev => {
      const current = prev.shopping_requirements[category] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, shopping_requirements: { ...prev.shopping_requirements, [category]: updated } };
    });
  };

  const handleWeddingFunctionToggle = (funcId: string) => {
    setForm(prev => {
      const current = prev.wedding_functions || [];
      const updated = current.includes(funcId)
        ? current.filter(f => f !== funcId)
        : [...current, funcId];
      return { ...prev, wedding_functions: updated };
    });
  };

  const checkDuplicate = async () => {
    if (!form.mobile || form.mobile.length < 10) {
      setDupWarn('');
      return;
    }
    try {
      const res = await API.checkWeddingRegistrationDuplicate(form.mobile);
      if (res && res.exists) {
        setDupWarn(`⚠️ This mobile number was already registered by ${res.existingRegistration?.customer_name || 'another customer'} (${res.existingRegistration?.registration_id || 'existing registration'}).`);
      } else {
        setDupWarn('');
      }
    } catch (e) {
      setDupWarn('');
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step === 1) checkDuplicate();
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      showToast('Please fill all required fields correctly', 'error');
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!validateStep(8)) {
      showToast('Please fix the errors before submitting', 'error');
      return;
    }

    setLoading(true);
    setLoadingText('Submitting Registration...');

    try {
      // Get next registration ID
      const idRes = await API.getNextWeddingRegId(form.location_id);
      const registrationId = idRes?.registrationId;

      const payload = {
        ...form,
        mobile: `+91${form.mobile.replace(/\D/g, '')}`,
        alternate_mobile: form.alternate_mobile ? `+91${form.alternate_mobile.replace(/\D/g, '')}` : null,
        age: form.age ? parseInt(form.age, 10) : null,
        guest_count: form.guest_count ? parseInt(form.guest_count, 10) : null,
        family_size: form.family_size ? parseInt(form.family_size, 10) : null,
        bride_age: form.bride_age ? parseInt(form.bride_age, 10) : null,
        groom_age: form.groom_age ? parseInt(form.groom_age, 10) : null,
        expected_visitors: form.expected_visitors ? parseInt(form.expected_visitors, 10) : null,
        registration_id: registrationId
      };

      const res = await API.createWeddingRegistration({ data: payload });

      if (res && res.success) {
        setSuccessRegId(res.registration_id || registrationId);
        setStep(9); // Success screen
        window.scrollTo(0, 0);
        showToast(`Registration Successful! ID: ${res.registration_id || registrationId}`, 'success');
      } else {
        const errMsg = res?.message || res?.error || 'Failed to submit registration';
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Error submitting registration. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setStep(1);
    setSuccessRegId('');
    setDupWarn('');
    window.scrollTo(0, 0);
  };

  const getSelectedStore = () => {
    if (!form.location_id) return null;
    return STORE_INFO[parseInt(form.location_id)];
  };

  const steps = [
    { num: 1, label: 'Store Location', short: 'Location' },
    { num: 2, label: 'Customer Details', short: 'Customer' },
    { num: 3, label: 'Wedding Details', short: 'Wedding' },
    { num: 4, label: 'Bride & Groom', short: 'Couple' },
    { num: 5, label: 'Shopping Needs', short: 'Shopping' },
    { num: 6, label: 'Visit & Follow-up', short: 'Follow-up' },
    { num: 7, label: 'Additional Info', short: 'Notes' },
    { num: 8, label: 'Review & Submit', short: 'Review' }
  ];

  return (
    <div className="min-h-screen bg-background pb-12">
      <ToastContainer />

      {/* Header */}
      <header className="bg-primary p-4 sm:p-5 text-white shadow-lg sticky top-0 z-30 border-b border-accent/30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BSC Logo" className="w-11 h-11 object-contain rounded-xl bg-white p-1 shadow-md border border-white/20" />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight">BSC Wedding Registration</h1>
              <div className="text-[10px] text-accent font-bold uppercase tracking-widest mt-0.5">
                Register your wedding shopping requirements with BSC Textiles
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Official Wedding Portal</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Progress Stepper */}
        {step <= 8 && (
          <div className="card-glass p-4 text-xs font-extrabold space-y-2">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((s, idx) => (
                <div key={s.num} className={`flex items-center gap-2 transition-all ${idx < steps.length - 1 ? 'pr-4' : ''}`}>
                  <div className={`flex items-center gap-1.5 ${step === s.num ? 'text-primary' : step > s.num ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === s.num ? 'bg-primary text-white shadow-md ring-2 ring-accent' : step > s.num ? 'bg-emerald-600 text-white' : 'bg-background border border-accent-soft'}`}>
                      {step > s.num ? '✓' : s.num}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.short}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`h-1.5 flex-1 bg-accent-soft rounded-full overflow-hidden hidden sm:block ${step > s.num + 1 ? 'bg-gradient-to-r from-primary to-accent' : ''}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="h-1.5 w-full bg-accent-soft rounded-full overflow-hidden sm:hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                style={{ width: `${(step - 1) / 7 * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP 1: STORE LOCATION */}
        {step === 1 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 1: Select Your BSC Store Location</h2>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-primary/70 font-medium">Choose your preferred BSC Textiles store for wedding shopping</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {LOCATIONS.map(loc => {
                  const storeInfo = STORE_INFO[loc.id];
                  const isSelected = form.location_id === String(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleChange('location_id', String(loc.id))}
                      className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${isSelected
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                          : 'border-accent-soft bg-background hover:border-primary hover:bg-white'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-accent'}`} />
                        <span className="font-extrabold text-sm text-primary">{loc.name} ({loc.code})</span>
                      </div>
                      <p className="text-xs text-primary/70 line-clamp-2">{storeInfo.address}</p>
                      {storeInfo.phone && <p className="text-[10px] text-primary/50 mt-1">📞 {storeInfo.phone}</p>}
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-1.5 text-primary text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selected</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {errors.location_id && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errors.location_id}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Customer Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMER DETAILS */}
        {step === 2 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 2: Customer Personal Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={e => handleChange('customer_name', e.target.value.trim())}
                    placeholder="Enter full name as per Aadhaar"
                    className={`input-modern ${errors.customer_name ? 'border-red-400' : ''}`}
                  />
                  {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Mobile Number <span className="text-red-500">*</span></label>
                  <div className="flex">
                    <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#475569] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.mobile}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); handleChange('mobile', v); }}
                      placeholder="10-digit mobile number"
                      className={`input-modern rounded-l-none ${errors.mobile ? 'border-red-400' : ''}`}
                      onBlur={checkDuplicate}
                    />
                  </div>
                  {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
                  {dupWarn && <p className="text-amber-700 text-xs mt-1 bg-amber-50 p-2 rounded">{dupWarn}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Alternate Mobile</label>
                  <div className="flex">
                    <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#475569] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.alternate_mobile}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); handleChange('alternate_mobile', v); }}
                      placeholder="Optional 10-digit number"
                      className={`input-modern rounded-l-none ${errors.alternate_mobile ? 'border-red-400' : ''}`}
                    />
                  </div>
                  {errors.alternate_mobile && <p className="text-red-500 text-xs mt-1">{errors.alternate_mobile}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="name@example.com"
                    className={`input-modern ${errors.email ? 'border-red-400' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Gender <span className="text-red-500">*</span></label>
                  <select value={form.gender} onChange={e => handleChange('gender', e.target.value)} className={`select-modern ${errors.gender ? 'border-red-400' : ''}`}>
                    <option value="">Select Gender</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Wedding Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: WEDDING DETAILS */}
        {step === 3 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 3: Wedding Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Wedding Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.wedding_date}
                    onChange={e => handleChange('wedding_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`input-modern ${errors.wedding_date ? 'border-red-400' : ''}`}
                  />
                  {errors.wedding_date && <p className="text-red-500 text-xs mt-1">{errors.wedding_date}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Date Flexibility <span className="text-red-500">*</span></label>
                  <select value={form.wedding_date_flexibility} onChange={e => handleChange('wedding_date_flexibility', e.target.value)} className={`select-modern ${errors.wedding_date_flexibility ? 'border-red-400' : ''}`}>
                    <option value="">Select flexibility</option>
                    {DATE_FLEXIBILITY.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.wedding_date_flexibility && <p className="text-red-500 text-xs mt-1">{errors.wedding_date_flexibility}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Wedding Type <span className="text-red-500">*</span></label>
                  <select value={form.wedding_type} onChange={e => handleChange('wedding_type', e.target.value)} className={`select-modern ${errors.wedding_type ? 'border-red-400' : ''}`}>
                    <option value="">Select wedding type</option>
                    {WEDDING_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  {errors.wedding_type && <p className="text-red-500 text-xs mt-1">{errors.wedding_type}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Wedding City</label>
                  <input
                    type="text"
                    value={form.wedding_city}
                    onChange={e => handleChange('wedding_city', e.target.value)}
                    placeholder="City where wedding will take place"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Wedding Venue</label>
                  <input
                    type="text"
                    value={form.wedding_venue}
                    onChange={e => handleChange('wedding_venue', e.target.value)}
                    placeholder="Venue name / address"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Expected Guests</label>
                  <input
                    type="number"
                    min={0}
                    value={form.guest_count}
                    onChange={e => handleChange('guest_count', e.target.value)}
                    placeholder="e.g. 200"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Family / Shopping Group Size <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={form.family_size}
                    onChange={e => handleChange('family_size', e.target.value)}
                    placeholder="Number of people shopping"
                    className={`input-modern ${errors.family_size ? 'border-red-400' : ''}`}
                  />
                  {errors.family_size && <p className="text-red-500 text-xs mt-1">{errors.family_size}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-2">Wedding Functions <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {WEDDING_FUNCTIONS.map(f => (
                    <label key={f.id} className="flex items-center gap-1.5 bg-background border border-accent-soft px-3.5 py-2 rounded-xl cursor-pointer font-semibold text-xs text-primary hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={form.wedding_functions.includes(f.id)}
                        onChange={() => handleWeddingFunctionToggle(f.id)}
                        className="rounded accent-primary"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
                {errors.wedding_functions && <p className="text-red-500 text-xs mt-1">{errors.wedding_functions}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Bride & Groom Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: BRIDE & GROOM DETAILS */}
        {step === 4 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              <User className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 4: Bride & Groom Details</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bride Details */}
              <div className="p-4 rounded-2xl border border-accent-soft bg-background/50 space-y-4">
                <div className="flex items-center gap-2 border-b border-accent-soft pb-2">
                  <User className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-sm text-primary">Bride Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Bride Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.bride_name}
                      onChange={e => handleChange('bride_name', e.target.value)}
                      placeholder="Bride's full name"
                      className={`input-modern ${errors.bride_name ? 'border-red-400' : ''}`}
                    />
                    {errors.bride_name && <p className="text-red-500 text-xs mt-1">{errors.bride_name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Bride Age</label>
                    <input
                      type="number"
                      min={18}
                      max={100}
                      value={form.bride_age}
                      onChange={e => handleChange('bride_age', e.target.value)}
                      placeholder="e.g. 25"
                      className={`input-modern ${errors.bride_age ? 'border-red-400' : ''}`}
                    />
                    {errors.bride_age && <p className="text-red-500 text-xs mt-1">{errors.bride_age}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Bride Contact</label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.bride_contact}
                      onChange={e => handleChange('bride_contact', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Optional mobile number"
                      className="input-modern"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                    <input
                      type="checkbox"
                      checked={form.bride_shopping_required}
                      onChange={e => handleChange('bride_shopping_required', e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Bride shopping required</span>
                  </label>
                </div>
              </div>

              {/* Groom Details */}
              <div className="p-4 rounded-2xl border border-accent-soft bg-background/50 space-y-4">
                <div className="flex items-center gap-2 border-b border-accent-soft pb-2">
                  <User className="w-5 h-5 text-blue-500" />
                  <h3 className="font-extrabold text-sm text-primary">Groom Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Groom Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.groom_name}
                      onChange={e => handleChange('groom_name', e.target.value)}
                      placeholder="Groom's full name"
                      className={`input-modern ${errors.groom_name ? 'border-red-400' : ''}`}
                    />
                    {errors.groom_name && <p className="text-red-500 text-xs mt-1">{errors.groom_name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Groom Age</label>
                    <input
                      type="number"
                      min={18}
                      max={100}
                      value={form.groom_age}
                      onChange={e => handleChange('groom_age', e.target.value)}
                      placeholder="e.g. 28"
                      className={`input-modern ${errors.groom_age ? 'border-red-400' : ''}`}
                    />
                    {errors.groom_age && <p className="text-red-500 text-xs mt-1">{errors.groom_age}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Groom Contact</label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.groom_contact}
                      onChange={e => handleChange('groom_contact', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Optional mobile number"
                      className="input-modern"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                    <input
                      type="checkbox"
                      checked={form.groom_shopping_required}
                      onChange={e => handleChange('groom_shopping_required', e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Groom shopping required</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Shopping Requirements</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: SHOPPING REQUIREMENTS */}
        {step === 5 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 5: Wedding Shopping Requirements</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-primary/70">Select all categories you plan to shop for (multiple selection allowed)</p>

              {SHOPPING_CATEGORIES.map(cat => (
                <div key={cat.category} className="p-4 rounded-2xl border border-accent-soft bg-background/50">
                  <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-accent" />
                    {cat.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map(item => (
                      <label key={item} className="flex items-center gap-1.5 bg-white border border-accent-soft px-3 py-2 rounded-xl cursor-pointer font-medium text-xs text-primary hover:bg-primary hover:text-white hover:border-primary transition-colors">
                        <input
                          type="checkbox"
                          checked={form.shopping_requirements[cat.category]?.includes(item) || false}
                          onChange={() => handleMultiSelect(cat.category, item)}
                          className="rounded accent-primary"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {errors.shopping_requirements && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errors.shopping_requirements}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-primary mb-1">Estimated Wedding Shopping Budget <span className="text-red-500">*</span></label>
                <select value={form.budget_range} onChange={e => handleChange('budget_range', e.target.value)} className={`select-modern ${errors.budget_range ? 'border-red-400' : ''}`}>
                  <option value="">Select budget range</option>
                  {BUDGET_RANGES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {errors.budget_range && <p className="text-red-500 text-xs mt-1">{errors.budget_range}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Visit & Follow-up</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: VISIT & FOLLOW-UP PREFERENCES */}
        {step === 6 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 6: Preferred Visit & Follow-up</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Preferred Shopping Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.preferred_shopping_date}
                    onChange={e => handleChange('preferred_shopping_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`input-modern ${errors.preferred_shopping_date ? 'border-red-400' : ''}`}
                  />
                  {errors.preferred_shopping_date && <p className="text-red-500 text-xs mt-1">{errors.preferred_shopping_date}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Preferred Shopping Time <span className="text-red-500">*</span></label>
                  <select value={form.preferred_shopping_time} onChange={e => handleChange('preferred_shopping_time', e.target.value)} className={`select-modern ${errors.preferred_shopping_time ? 'border-red-400' : ''}`}>
                    <option value="">Select time</option>
                    {SHOPPING_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.preferred_shopping_time && <p className="text-red-500 text-xs mt-1">{errors.preferred_shopping_time}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Expected Visitors</label>
                  <input
                    type="number"
                    min={1}
                    value={form.expected_visitors}
                    onChange={e => handleChange('expected_visitors', e.target.value)}
                    placeholder="Number of people visiting"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Are you an existing BSC customer? <span className="text-red-500">*</span></label>
                  <select value={form.existing_customer} onChange={e => handleChange('existing_customer', e.target.value)} className={`select-modern ${errors.existing_customer ? 'border-red-400' : ''}`}>
                    <option value="">Select</option>
                    {EXISTING_CUSTOMER.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  {errors.existing_customer && <p className="text-red-500 text-xs mt-1">{errors.existing_customer}</p>}
                </div>

                {form.existing_customer === 'Yes' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-primary mb-1">Existing Customer ID <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.existing_customer_id}
                        onChange={e => handleChange('existing_customer_id', e.target.value)}
                        placeholder="Your BSC customer ID"
                        className={`input-modern ${errors.existing_customer_id ? 'border-red-400' : ''}`}
                      />
                      {errors.existing_customer_id && <p className="text-red-500 text-xs mt-1">{errors.existing_customer_id}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-primary mb-1">Previous BSC Store</label>
                      <input
                        type="text"
                        value={form.previous_store}
                        onChange={e => handleChange('previous_store', e.target.value)}
                        placeholder="Store where you previously shopped"
                        className="input-modern"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-accent" />
                  Communication Preferences
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Preferred Contact Method <span className="text-red-500">*</span></label>
                    <select value={form.preferred_contact_method} onChange={e => handleChange('preferred_contact_method', e.target.value)} className={`select-modern ${errors.preferred_contact_method ? 'border-red-400' : ''}`}>
                      <option value="">Select method</option>
                      {CONTACT_METHODS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.preferred_contact_method && <p className="text-red-500 text-xs mt-1">{errors.preferred_contact_method}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Preferred Follow-up Time <span className="text-red-500">*</span></label>
                    <select value={form.preferred_followup_time} onChange={e => handleChange('preferred_followup_time', e.target.value)} className={`select-modern ${errors.preferred_followup_time ? 'border-red-400' : ''}`}>
                      <option value="">Select time slot</option>
                      {FOLLOWUP_TIMES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {errors.preferred_followup_time && <p className="text-red-500 text-xs mt-1">{errors.preferred_followup_time}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Additional Information</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: ADDITIONAL INFORMATION */}
        {step === 7 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 7: Additional Requirements</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">Additional Requirements / Notes</label>
                <textarea
                  rows={5}
                  value={form.additional_notes}
                  onChange={e => handleChange('additional_notes', e.target.value)}
                  placeholder="Tell us about your wedding shopping requirements, preferred products, family requirements, special requests, etc."
                  className="textarea-modern"
                  maxLength={1000}
                />
                <p className="text-xs text-primary/50 mt-1 text-right">{form.additional_notes.length}/1000 characters</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Review & Submit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: REVIEW & SUBMIT */}
        {step === 8 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 8: Review & Submit</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-primary/70">Please review all details before submitting. You can edit any section by clicking the Edit button.</p>

              {/* Store Info */}
              {(() => {
                const store = getSelectedStore();
                return store && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Selected Store
                    </h4>
                    <div className="text-xs text-primary/80 space-y-1">
                      <p><strong>{store.name} ({store.code})</strong></p>
                      <p>{store.address}</p>
                      {store.phone && <p>📞 {store.phone}</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Customer Details */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Details
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-primary/80">
                  <p><strong>Name:</strong> {form.customer_name}</p>
                  <p><strong>Mobile:</strong> +91 {form.mobile}</p>
                  <p><strong>Email:</strong> {form.email || '—'}</p>
                  <p><strong>Gender:</strong> {form.gender}</p>
                  <p><strong>Age:</strong> {form.age || '—'}</p>
                  <p><strong>City:</strong> {form.city}</p>
                  <p><strong>PIN:</strong> {form.pincode}</p>
                  <p><strong>Address:</strong> {form.address} {form.area ? `, ${form.area}` : ''}</p>
                </div>
              </div>

              {/* Wedding Details */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Wedding Details
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-primary/80">
                  <p><strong>Wedding Date:</strong> {form.wedding_date ? new Date(form.wedding_date).toLocaleDateString('en-IN') : '—'}</p>
                  <p><strong>Flexibility:</strong> {form.wedding_date_flexibility}</p>
                  <p><strong>Type:</strong> {form.wedding_type}</p>
                  <p><strong>City:</strong> {form.wedding_city || '—'}</p>
                  <p><strong>Venue:</strong> {form.wedding_venue || '—'}</p>
                  <p><strong>Guests:</strong> {form.guest_count || '—'}</p>
                  <p><strong>Family Size:</strong> {form.family_size}</p>
                  <p><strong>Functions:</strong> {form.wedding_functions.map(f => WEDDING_FUNCTIONS.find(x => x.id === f)?.label).join(', ')}</p>
                </div>
              </div>

              {/* Bride & Groom */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <User className="w-4 h-4" />
                  Bride & Groom
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-primary/80">
                  <div className="p-2 rounded bg-rose-50 border border-rose-200">
                    <p className="font-bold text-rose-700">Bride</p>
                    <p>Name: {form.bride_name}</p>
                    <p>Age: {form.bride_age || '—'}</p>
                    <p>Contact: {form.bride_contact || '—'}</p>
                    <p>Shopping: {form.bride_shopping_required ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="p-2 rounded bg-blue-50 border border-blue-200">
                    <p className="font-bold text-blue-700">Groom</p>
                    <p>Name: {form.groom_name}</p>
                    <p>Age: {form.groom_age || '—'}</p>
                    <p>Contact: {form.groom_contact || '—'}</p>
                    <p>Shopping: {form.groom_shopping_required ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Shopping */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Shopping Requirements
                </h4>
                <div className="text-xs text-primary/80 space-y-1">
                  {Object.entries(form.shopping_requirements).map(([cat, items]) => (
                    items.length > 0 && (
                      <p key={cat}><strong>{cat}:</strong> {items.join(', ')}</p>
                    )
                  ))}
                  <p><strong>Budget:</strong> {form.budget_range}</p>
                </div>
              </div>

              {/* Follow-up */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Visit & Follow-up
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-primary/80">
                  <p><strong>Preferred Date:</strong> {form.preferred_shopping_date ? new Date(form.preferred_shopping_date).toLocaleDateString('en-IN') : '—'}</p>
                  <p><strong>Preferred Time:</strong> {form.preferred_shopping_time}</p>
                  <p><strong>Visitors:</strong> {form.expected_visitors || '—'}</p>
                  <p><strong>Contact Method:</strong> {form.preferred_contact_method}</p>
                  <p><strong>Follow-up Time:</strong> {form.preferred_followup_time}</p>
                  <p><strong>Existing Customer:</strong> {form.existing_customer}</p>
                </div>
              </div>

              {/* Consent */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-primary">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={e => handleChange('consent', e.target.checked)}
                    className="mt-0.5 rounded accent-primary"
                  />
                  <span>
                    I confirm that the information provided by me is accurate and I agree
                    to be contacted by BSC Textiles regarding my wedding shopping requirements.
                  </span>
                </label>
                {errors.consent && <p className="text-red-500 text-xs ml-6">{errors.consent}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Edit</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-gold flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <span>{loadingText}</span>
                ) : (
                  <>
                    <span>Submit Wedding Registration</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 9: SUCCESS SCREEN */}
        {step === 9 && (
          <div className="card-glass p-8 sm:p-12 text-center space-y-5 animate-fade-in shadow-2xl my-8">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-primary tracking-tight">Wedding Registration Successful! 🎉</h2>
              <p className="text-sm text-primary/70 font-medium mt-1">Thank you for registering with BSC Textiles.</p>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 inline-block">
              <span className="text-xs uppercase font-black text-primary/70 block">Your Wedding Registration ID</span>
              <span className="text-2xl font-mono font-black text-primary tracking-wider">{successRegId}</span>
            </div>

            {(() => {
              const store = getSelectedStore();
              return store && (
                <div className="p-4 rounded-xl bg-background border border-accent-soft text-left max-w-md mx-auto">
                  <h4 className="font-bold text-sm text-primary mb-2">Registration Summary</h4>
                  <div className="text-xs text-primary/80 space-y-1">
                    <p><strong>Store:</strong> {store.name} ({store.code})</p>
                    <p><strong>Customer:</strong> {form.customer_name}</p>
                    <p><strong>Mobile:</strong> +91 {form.mobile}</p>
                    <p><strong>Wedding Date:</strong> {form.wedding_date ? new Date(form.wedding_date).toLocaleDateString('en-IN') : '—'}</p>
                    <p><strong>Registration Date:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p><strong>Registration ID:</strong> {successRegId}</p>
                  </div>
                </div>
              );
            })()}

            <div className="pt-4 border-t border-accent-soft flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => window.print()}
                className="btn-primary text-xs flex items-center gap-2 justify-center"
              >
                <span>Print</span>
              </button>
              <button
                onClick={() => {
                  const text = `BSC Wedding Registration\nID: ${successRegId}\nCustomer: ${form.customer_name}\nMobile: +91 ${form.mobile}\nStore: ${getSelectedStore()?.name}\nWedding Date: ${form.wedding_date}`;
                  navigator.clipboard.writeText(text);
                  showToast('Details copied to clipboard!', 'success');
                }}
                className="btn-secondary text-xs flex items-center gap-2 justify-center"
              >
                <span>Copy Details</span>
              </button>
              <button
                onClick={resetForm}
                className="btn-outline text-xs flex items-center gap-2 justify-center"
              >
                <span>Register Another Wedding</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
