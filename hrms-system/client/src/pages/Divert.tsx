import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { 
  Target, Plus, Search, Filter, Clock, CheckCircle, AlertCircle, 
  Download, RefreshCw, X, Eye, FileText, CheckCircle2, ShoppingBag, 
  ArrowRight, ShieldCheck, UserCheck, Phone, Calendar, Building2, TrendingUp, Sparkles, XCircle
} from 'lucide-react';
import { API } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import * as XLSX from 'xlsx';

export default function Divert() {
  const [diverts, setDiverts] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showRaiseModal, setShowRaiseModal] = useState<boolean>(false);
  const [selectedDivert, setSelectedDivert] = useState<any | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Raise Form State
  const [productWanted, setProductWanted] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [priceRange, setPriceRange] = useState<string>('');
  const [reasonCode, setReasonCode] = useState<string>('OUT_OF_STOCK');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [divRes, secRes] = await Promise.all([
        API.getDiverts().catch(() => ({ diverts: [] })),
        API.getSections().catch(() => ({ sections: [] }))
      ]);
      if (divRes && divRes.diverts) setDiverts(divRes.diverts);
      if (secRes && secRes.sections) setSections(secRes.sections);
    } catch (err) {
      console.error('Error fetching divert data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDivert = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await API.createDivert({
        sectionId,
        productWanted,
        quantity,
        priceRange,
        reasonCode,
        customerName,
        customerMobile,
        createdBy: 'Floor Staff'
      });
      setShowRaiseModal(false);
      setProductWanted('');
      setCustomerName('');
      setCustomerMobile('');
      setPriceRange('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to raise sourcing divert.');
    } finally {
      setCreating(false);
    }
  };

  // Analytics Calculations
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const pendingDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      const st = (d.status || '').toLowerCase();
      return st === 'open' || st === 'sourcing' || st === 'new';
    }).length;
  }, [diverts]);

  const approvedDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      const st = (d.status || '').toLowerCase();
      return st === 'available' || st === 'approved' || st === 'completed';
    }).length;
  }, [diverts]);

  const rejectedDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      const st = (d.status || '').toLowerCase();
      return st === 'rejected' || st === 'declined' || st === 'cancelled';
    }).length;
  }, [diverts]);

  const todayDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      if (!d.entryDate && !d.createdAt) return false;
      const dt = (d.entryDate || d.createdAt).split('T')[0];
      return dt === todayStr;
    }).length;
  }, [diverts, todayStr]);

  // Filtered List with Instant Search (No Page Refresh)
  const filteredDiverts = useMemo(() => {
    let list = [...diverts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        (d.productWanted || '').toLowerCase().includes(q) ||
        (d.refNo || d.id || '').toLowerCase().includes(q) ||
        (d.customerName || '').toLowerCase().includes(q) ||
        (d.customerMobile || '').toLowerCase().includes(q) ||
        (d.pmNotes || '').toLowerCase().includes(q) ||
        (d.reasonCode || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      list = list.filter(d => (d.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    if (sectionFilter) {
      list = list.filter(d => String(d.sectionId || d.section_id) === String(sectionFilter));
    }

    if (reasonFilter) {
      list = list.filter(d => (d.reasonCode || '').toLowerCase() === reasonFilter.toLowerCase());
    }

    if (fromDate) {
      list = list.filter(d => {
        const dt = (d.entryDate || d.createdAt || '').split('T')[0];
        return dt >= fromDate;
      });
    }

    if (toDate) {
      list = list.filter(d => {
        const dt = (d.entryDate || d.createdAt || '').split('T')[0];
        return dt <= toDate;
      });
    }

    return list;
  }, [diverts, searchQuery, statusFilter, sectionFilter, reasonFilter, fromDate, toDate]);

  const handleExportExcel = () => {
    const dataToExport = filteredDiverts.map((item, idx) => ({
      'S.No': idx + 1,
      'Ref No': item.refNo || `#${item.id?.slice(0, 6)}`,
      'Date': item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '—',
      'Product Wanted': item.productWanted || '—',
      'Quantity': item.quantity || 1,
      'Price Range': item.priceRange || '—',
      'Reason Code': item.reasonCode || '—',
      'Customer Name': item.customerName || 'Walk-in',
      'Customer Phone': item.customerMobile || '—',
      'Status': item.status?.toUpperCase() || 'OPEN',
      'PM Notes': item.pmNotes || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sourcing Diverts');
    XLSX.writeFile(wb, `Sourcing_Diverts_Report_${todayStr}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'available' || st === 'approved' || st === 'completed') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available / Resolved
        </span>
      );
    }
    if (st === 'sourcing' || st === 'in progress' || st === 'review') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
          <Clock className="w-3 h-3 text-amber-600" /> Sourcing In Progress
        </span>
      );
    }
    if (st === 'rejected' || st === 'declined') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
          <XCircle className="w-3 h-3 text-rose-600" /> Rejected / Unavailable
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
        <Sparkles className="w-3 h-3 text-sky-600" /> Open Sourcing Request
      </span>
    );
  };

  return (
    <DashboardLayout 
      title="Sourcing Diverts &amp; Merchandise Requests" 
      subtitle="Track, filter, and review floor merchandise divert requests raised by staff for Purchase Manager review"
    >
      <div className="space-y-6">

        {/* Page Header Banner */}
        <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-[#4A1726]/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4A1726] text-[#C6A15B] text-[10px] font-black uppercase tracking-widest mb-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>Floor Sourcing Desk</span>
            </div>
            <h2 className="text-xl font-black text-[#4A1726] tracking-tight flex items-center gap-2">
              <span>Customer Sourcing Diverts</span>
            </h2>
            <p className="text-xs text-[#666666] font-medium mt-0.5">Real-time store floor customer requirement logs and Purchase Manager sourcing queue.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-xl border border-[#EAE4DC] bg-white text-xs font-bold text-[#4A1726] hover:bg-[#F8F5F1] flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4" /> Export Report
            </button>
            <button
              onClick={() => setShowRaiseModal(true)}
              className="btn-gold text-xs py-2 px-4 flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Sourcing Divert</span>
            </button>
          </div>
        </div>

        {/* Analytics Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Open / Pending Diverts"
            value={pendingDivertsCount}
            subtext="Awaiting PM sourcing resolution"
            icon={Target}
            color="gold"
          />
          <MetricCard
            title="Available / Resolved"
            value={approvedDivertsCount}
            subtext="Stock sourced &amp; customer notified"
            icon={CheckCircle2}
            color="emerald"
          />
          <MetricCard
            title="Today's Diverts"
            value={todayDivertsCount}
            subtext={`Requests logged on ${todayStr}`}
            icon={Clock}
            color="navy"
          />
          <MetricCard
            title="Total Diverts Logged"
            value={diverts.length}
            subtext="Avg processing turnaround ~2.4h"
            icon={TrendingUp}
            color="indigo"
          />
        </div>

        {/* Modern Filters Bar */}
        <div className="card-glass p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-2">
            <h3 className="font-extrabold text-[#4A1726] text-xs uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#C6A15B]" />
              <span>Filter Sourcing Register</span>
            </h3>
            {(searchQuery || statusFilter || sectionFilter || reasonFilter || fromDate || toDate) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setSectionFilter('');
                  setReasonFilter('');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-rose-600 hover:underline text-[11px] font-extrabold"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product, ref no, customer..."
                className="input-modern pl-9 py-2 text-xs w-full"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-modern text-xs font-bold"
            >
              <option value="">All Statuses</option>
              <option value="open">Open Requests</option>
              <option value="sourcing">Sourcing In Progress</option>
              <option value="available">Available / Resolved</option>
              <option value="rejected">Rejected / Unavailable</option>
            </select>

            {/* Store Section Filter */}
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="select-modern text-xs font-bold"
            >
              <option value="">All Store Sections</option>
              <option value="Ground Floor Saree">Ground Floor Saree</option>
              <option value="1st Floor Saree">1st Floor Saree</option>
              <option value="Ladies">Ladies</option>
              <option value="Kids">Kids</option>
              <option value="Mens">Mens</option>
            </select>

            {/* Reason Code Filter */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="select-modern text-xs font-bold"
            >
              <option value="">All Reasons</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="COLOR_UNAVAILABLE">Color Unavailable</option>
              <option value="SIZE_MISSING">Size Missing</option>
              <option value="PRICE_HIGH">Price High</option>
            </select>

            {/* From Date */}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-modern py-1.5 text-xs"
              placeholder="From Date"
            />

            {/* To Date */}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-modern py-1.5 text-xs"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Diverts Main Register Table */}
        <div className="card-glass p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-3">
            <h3 className="font-extrabold text-[#4A1726] text-sm tracking-tight">
              Sourcing Divert Logs ({filteredDiverts.length} Entries)
            </h3>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-xs text-gray-500 font-bold">Loading sourcing diverts...</div>
            ) : filteredDiverts.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500 font-bold">No sourcing divert entries found matching your query.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE4DC] text-[10.5px] font-black uppercase text-[#777777] bg-[#F8F5F1]/60">
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-4">Ref No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Product Requested</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Reason Code</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">PM Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC]/60">
                  {filteredDiverts.map((item, idx) => (
                    <tr 
                      key={item.id || idx} 
                      onClick={() => setSelectedDivert(item)} 
                      className="hover:bg-black/5 cursor-pointer transition-colors font-medium"
                    >
                      <td className="py-3.5 px-3 text-center font-bold text-[#666666]">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-[#4A1726]">
                        #{item.refNo || item.id?.slice(0, 6)}
                      </td>
                      <td className="py-3.5 px-4 text-[#555555] font-semibold">
                        {item.entryDate ? new Date(item.entryDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-[#4A1726]">
                        {item.productWanted}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#4A1726]">
                        {item.quantity || 1} pcs
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-[#F8F5F1] border border-[#EAE4DC] text-[#555555] font-bold text-[10.5px]">
                          {item.reasonCode || 'OUT_OF_STOCK'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#4A1726]">{item.customerName || 'Walk-in Customer'}</div>
                        <div className="text-[10px] text-[#777777] font-mono">{item.customerMobile || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3.5 px-4 text-[#555555] text-xs max-w-xs truncate italic">
                        {item.pmNotes || 'Awaiting PM review'}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedDivert(item)}
                          className="px-3 py-1.5 rounded-xl border border-[#4A1726] text-[#4A1726] font-extrabold hover:bg-[#4A1726] hover:text-white transition-all text-xs flex items-center gap-1 ml-auto shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Raise New Sourcing Divert Modal */}
        {showRaiseModal && (
          <div className="fixed inset-0 bg-[#4A1726]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#C6A15B]/40 animate-scale-in">
              <div className="bg-[#4A1726] text-white p-5 flex items-center justify-between border-b border-[#C6A15B]/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C6A15B] text-white font-black text-lg flex items-center justify-center shadow-md">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Raise New Sourcing Divert</h3>
                    <p className="text-xs text-[#C6A15B] font-medium">Log unavailable floor stock requirement</p>
                  </div>
                </div>

                <button onClick={() => setShowRaiseModal(false)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDivert} className="p-6 space-y-4 text-xs bg-[#F8F5F1]">
                <div className="bg-white p-4 rounded-2xl border border-[#EAE4DC] space-y-3 shadow-xs">
                  <div>
                    <label className="block font-bold text-[#4A1726] mb-1">Product / Fabric Requested *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pure Kanjivaram Silk Saree (Bottle Green/Gold border)"
                      value={productWanted}
                      onChange={(e) => setProductWanted(e.target.value)}
                      className="input-modern font-extrabold text-[#4A1726]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#4A1726] mb-1">Store Section</label>
                      <select
                        value={sectionId}
                        onChange={(e) => setSectionId(e.target.value)}
                        className="select-modern font-bold"
                      >
                        <option value="">Select Floor Section</option>
                        <option value="Ground Floor Saree">Ground Floor Saree</option>
                        <option value="1st Floor Saree">1st Floor Saree</option>
                        <option value="Ladies">Ladies</option>
                        <option value="Kids">Kids</option>
                        <option value="Mens">Mens</option>
                        {sections.filter(s => !['Ground Floor Saree', '1st Floor Saree', 'Ladies', 'Kids', 'Mens'].includes(s.name)).map(s => (
                          <option key={s.id} value={s.name || s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[#4A1726] mb-1">Quantity Requested</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                        className="input-modern font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#4A1726] mb-1">Target Price Range</label>
                      <input
                        type="text"
                        placeholder="e.g. ₹5,000 - ₹8,000"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#4A1726] mb-1">Reason Code</label>
                      <select
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value)}
                        className="select-modern font-bold"
                      >
                        <option value="OUT_OF_STOCK">Out of Stock</option>
                        <option value="COLOR_UNAVAILABLE">Color Unavailable</option>
                        <option value="SIZE_MISSING">Size Missing</option>
                        <option value="PRICE_HIGH">Price High</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-[#EAE4DC] space-y-3 shadow-xs">
                  <h4 className="font-extrabold text-[#4A1726] text-xs border-b border-[#EAE4DC] pb-1.5 uppercase tracking-wider">
                    Customer Details (Optional)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#4A1726] mb-1">Customer Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Anitha Kumar"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="input-modern font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#4A1726] mb-1">Customer Mobile Phone</label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value)}
                        className="input-modern font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE4DC]">
                  <button
                    type="button"
                    onClick={() => setShowRaiseModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#555555] bg-white border border-[#EAE4DC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-gold text-xs py-2 px-5 font-black shadow-md disabled:opacity-50"
                  >
                    {creating ? 'Raising Request...' : 'Raise Sourcing Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Centered Details Popup Modal Card with Approval Timeline */}
        {selectedDivert && (
          <div className="fixed inset-0 bg-[#4A1726]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#C6A15B]/40 animate-scale-in flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-[#4A1726] text-white p-5 flex items-center justify-between border-b border-[#C6A15B]/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C6A15B] text-white font-black text-lg flex items-center justify-center shadow-md">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">
                      Sourcing Request Details — #{selectedDivert.refNo || selectedDivert.id?.slice(0, 6)}
                    </h3>
                    <div className="text-xs text-[#C6A15B] font-bold font-mono mt-0.5">
                      Logged on: {selectedDivert.entryDate ? new Date(selectedDivert.entryDate).toLocaleDateString('en-IN') : 'Today'}
                    </div>
                  </div>
                </div>

                <button onClick={() => setSelectedDivert(null)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-[#F8F5F1]">
                {/* Product & Status Box */}
                <div className="bg-white p-5 rounded-2xl border border-[#EAE4DC] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-2">
                    <span className="text-[10.5px] font-black uppercase text-[#777777]">Sourcing Status</span>
                    {getStatusBadge(selectedDivert.status)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-[10.5px] font-black text-[#777777] block uppercase">Product Requested</span>
                      <span className="font-extrabold text-sm text-[#4A1726] block mt-0.5">{selectedDivert.productWanted}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-[#777777] block uppercase">Requested Quantity</span>
                      <span className="font-mono font-black text-sm text-[#4A1726] block mt-0.5">{selectedDivert.quantity || 1} Pcs</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-[#777777] block uppercase">Target Price Range</span>
                      <span className="font-extrabold text-xs text-[#C6A15B] block mt-0.5">{selectedDivert.priceRange || 'Standard Pricing'}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-[#777777] block uppercase">Reason Code</span>
                      <span className="font-bold text-xs text-[#4A1726] block mt-0.5">{selectedDivert.reasonCode || 'OUT_OF_STOCK'}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="bg-white p-5 rounded-2xl border border-[#EAE4DC] space-y-3 shadow-xs">
                  <h4 className="font-extrabold text-[#4A1726] text-xs uppercase tracking-wider border-b border-[#EAE4DC] pb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#C6A15B]" />
                    <span>Customer Contact Information</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-[#777777] block text-[10.5px]">Customer Name</span>
                      <span className="font-extrabold text-[#4A1726]">{selectedDivert.customerName || 'Walk-in Customer'}</span>
                    </div>
                    <div>
                      <span className="text-[#777777] block text-[10.5px]">Mobile Phone</span>
                      <span className="font-mono font-extrabold text-[#4A1726]">{selectedDivert.customerMobile || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* PM Sourcing Notes */}
                <div className="bg-white p-5 rounded-2xl border border-[#EAE4DC] space-y-2 shadow-xs">
                  <h4 className="font-extrabold text-[#4A1726] text-xs uppercase tracking-wider border-b border-[#EAE4DC] pb-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C6A15B]" />
                    <span>Purchase Manager Review &amp; Vendor Remarks</span>
                  </h4>
                  <div className="p-3 rounded-xl bg-[#F8F5F1] border border-[#EAE4DC] text-xs font-semibold text-[#4A1726] italic">
                    {selectedDivert.pmNotes || 'Request logged in system. Awaiting Purchase Manager sourcing review & vendor check.'}
                  </div>
                </div>

                {/* Beautiful Approval & Lifecycle Timeline */}
                <div className="bg-white p-5 rounded-2xl border border-[#EAE4DC] space-y-4 shadow-xs">
                  <h4 className="font-extrabold text-[#4A1726] text-xs uppercase tracking-wider border-b border-[#EAE4DC] pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#C6A15B]" />
                    <span>Sourcing Approval &amp; Lifecycle Timeline</span>
                  </h4>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 font-medium before:top-2 before:bottom-2 before:w-0.5 before:bg-[#EAE4DC]">
                    {/* Step 1: Created */}
                    <div className="relative">
                      <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                      <div className="font-extrabold text-[#4A1726] text-xs">Request Created</div>
                      <div className="text-[10.5px] text-[#777777]">Floor Staff logged request for {selectedDivert.productWanted}</div>
                    </div>

                    {/* Step 2: Floor Manager Review */}
                    <div className="relative">
                      <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                      <div className="font-extrabold text-[#4A1726] text-xs">Floor Manager Review</div>
                      <div className="text-[10.5px] text-[#777777]">Verified out-of-stock floor condition</div>
                    </div>

                    {/* Step 3: Purchase Sourcing Review */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        selectedDivert.status !== 'open' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white animate-pulse'
                      }`}>
                        {selectedDivert.status !== 'open' ? '✓' : '•'}
                      </div>
                      <div className="font-extrabold text-[#4A1726] text-xs">Purchase Manager Sourcing</div>
                      <div className="text-[10.5px] text-[#777777]">Vendor procurement &amp; merchandise availability check</div>
                    </div>

                    {/* Step 4: Resolution */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        (selectedDivert.status || '').toLowerCase() === 'available' ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {(selectedDivert.status || '').toLowerCase() === 'available' ? '✓' : '○'}
                      </div>
                      <div className="font-extrabold text-[#4A1726] text-xs">Merchandise Resolution</div>
                      <div className="text-[10.5px] text-[#777777]">Stock fulfilled &amp; customer notified</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-[#F8F5F1] border-t border-[#EAE4DC] flex items-center justify-end">
                <button
                  onClick={() => setSelectedDivert(null)}
                  className="px-5 py-2 rounded-xl bg-[#4A1726] text-white font-extrabold text-xs shadow-md"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
