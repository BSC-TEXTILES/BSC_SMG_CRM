import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { BarChart3, Clock, Users, Calendar, Save, CheckCircle2, AlertCircle, Sparkles, Check, Hourglass, Activity, FileText, Download, TrendingUp, Zap } from 'lucide-react';
import { API } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { io } from 'socket.io-client';

export default function Footfall() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<Record<number, { visitors: number; remarks: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const slotHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  const fetchFootfall = async (selectedDate: string) => {
    try {
      const res = await API.getFootfall(selectedDate);
      const map: Record<number, { visitors: number; remarks: string }> = {};
      if (res && res.entries && Array.isArray(res.entries)) {
        res.entries.forEach((e: any) => {
          map[e.slotHour] = { visitors: Number(e.visitors) || 0, remarks: e.remarks || '' };
        });
      }
      setSlots(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchFootfall(date);

    // Socket.IO Push Listener for 0ms latency synchronization
    const socket = io({ path: '/socket.io', autoConnect: true });
    socket.on('footfall:updated', (data: any) => {
      if (data && data.entryDate === date) {
        setSlots(prev => ({
          ...prev,
          [data.slotHour]: { visitors: Number(data.visitors) || 0, remarks: data.remarks || '' }
        }));
      }
    });

    // Realtime polling fallback every 5 seconds
    const interval = setInterval(() => {
      API.getFootfall(date)
        .then((res: any) => {
          if (res && res.entries && Array.isArray(res.entries)) {
            const map: Record<number, { visitors: number; remarks: string }> = {};
            res.entries.forEach((e: any) => {
              map[e.slotHour] = { visitors: Number(e.visitors) || 0, remarks: e.remarks || '' };
            });
            setSlots(map);
          }
        })
        .catch(() => {});
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [date]);

  const handleSaveSlot = async (hour: number) => {
    setSavingSlot(hour);
    setMessage(null);
    try {
      const slotData = slots[hour] || { visitors: 0, remarks: '' };
      await API.upsertFootfall({
        entryDate: date,
        slotHour: hour,
        visitors: Number(slotData.visitors),
        remarks: slotData.remarks,
        submittedBy: 'Floor Manager'
      });
      const formatHour = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
      setMessage(`Footfall slot for ${formatHour} updated and synchronized live!`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to save slot entry.');
    } finally {
      setSavingSlot(null);
    }
  };

  const handleExportExcel = () => {
    const exportData = slotHours.map(hour => {
      const slot = slots[hour] || { visitors: 0, remarks: '' };
      const formatHour = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
      const formatEndHour = (hour + 1) > 12 ? `${(hour + 1) - 12}:00 PM` : (hour + 1) === 12 ? '12:00 PM' : `${hour + 1}:00 AM`;
      return {
        'Date': date,
        'Slot': `Slot ${hour - 9}`,
        'Time Operating Window': `${formatHour} - ${formatEndHour}`,
        'Visitors Count': Number(slot.visitors) || 0,
        'Floor Remarks': slot.remarks || '—'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hourly Footfall');
    XLSX.writeFile(workbook, `BSC_Hourly_Footfall_${date}.xlsx`);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentHourNow = useMemo(() => new Date().getHours(), []);
  const isTodaySelected = date === todayStr;

  const totalFootfall = useMemo(() => {
    return Object.values(slots).reduce((sum, s) => sum + (Number(s.visitors) || 0), 0);
  }, [slots]);

  const completedSlotsCount = useMemo(() => {
    return slotHours.filter(h => (slots[h]?.visitors || 0) > 0).length;
  }, [slots]);

  const pendingSlotsCount = useMemo(() => {
    return slotHours.length - completedSlotsCount;
  }, [completedSlotsCount]);

  const chartData = useMemo(() => {
    return slotHours.map(hour => {
      const slot = slots[hour] || { visitors: 0, remarks: '' };
      const formatHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
      return {
        time: formatHour,
        visitors: Number(slot.visitors) || 0
      };
    });
  }, [slots]);

  const peakHourSlot = useMemo(() => {
    let max = 0;
    let maxHour = 10;
    slotHours.forEach(h => {
      const v = Number(slots[h]?.visitors || 0);
      if (v > max) {
        max = v;
        maxHour = h;
      }
    });
    const formatHour = maxHour > 12 ? `${maxHour - 12}:00 PM` : maxHour === 12 ? '12:00 PM' : `${maxHour}:00 AM`;
    return { hourStr: formatHour, count: max };
  }, [slots]);

  return (
    <DashboardLayout 
      title="Hourly Footfall Register" 
      subtitle="Realtime store visitor tracking across floor operating hours (10:00 AM – 10:00 PM)"
    >
      <div className="space-y-6">
        
        {/* Top Controls: Glass Date Selector + Excel Export Button */}
        <div className="space-y-5">
          <div className="card-glass p-5 lg:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#EAE4DC]/80 bg-white/70 backdrop-blur-xl shadow-md rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4A1726] to-[#350E1A] text-[#C6A15B] flex items-center justify-center shadow-lg shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#777777] tracking-widest mb-1">
                  Store Log Register Date
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-[#EAE4DC] bg-white/90 font-extrabold text-xs text-[#4A1726] outline-none shadow-xs focus:ring-2 focus:ring-[#C6A15B]/40 transition-all"
                  />
                  <button
                    onClick={() => setDate(todayStr)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                      isTodaySelected 
                        ? 'bg-[#4A1726] text-[#C6A15B] shadow-md ring-1 ring-[#C6A15B]/30' 
                        : 'bg-[#F8F5F1] border border-[#EAE4DC] text-[#555555] hover:bg-white'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-black bg-[#F8F5F1] border border-[#EAE4DC] text-[#555555] hover:bg-white transition-all"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3.5 py-2 rounded-xl bg-emerald-100/80 border border-emerald-300/50 text-emerald-800 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Socket Push Sync Active</span>
              </span>

              <button
                onClick={handleExportExcel}
                className="btn-gold px-4 py-2 text-xs font-black flex items-center gap-2 shadow-sm rounded-xl"
              >
                <Download className="w-4 h-4" />
                <span>Export Register (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Daily Visitors"
              value={totalFootfall.toLocaleString('en-IN')}
              subtext={`Sum of 12 operating slots for ${date}`}
              icon={Users}
              color="navy"
            />
            <MetricCard
              title="Completed Slots"
              value={`${completedSlotsCount} / 12`}
              subtext="Hours with recorded visitor counts"
              icon={CheckCircle2}
              color="emerald"
            />
            <MetricCard
              title="Peak Rush Hour"
              value={peakHourSlot.count > 0 ? peakHourSlot.hourStr : '—'}
              subtext={`Highest traffic: ${peakHourSlot.count} visitors`}
              icon={TrendingUp}
              color="gold"
            />
            <MetricCard
              title="Operating Coverage"
              value="12 Hours"
              subtext="Realtime synchronized floor tracking"
              icon={Activity}
              color="indigo"
            />
          </div>
        </div>

        {/* Peak Hour Traffic Visual Heatmap Chart */}
        <div className="card-glass p-5 lg:p-6 border border-[#EAE4DC]/80 bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#C6A15B]" />
              <h3 className="font-extrabold text-[#4A1726] text-sm uppercase tracking-wider">
                Store Hourly Traffic Distribution Heatmap
              </h3>
            </div>
            <span className="text-xs font-bold text-[#777777] font-mono">
              Peak Slot: <strong className="text-[#C6A15B]">{peakHourSlot.hourStr} ({peakHourSlot.count} Visitors)</strong>
            </span>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C6A15B" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#4A1726" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE4DC" />
                <XAxis dataKey="time" stroke="#777777" fontSize={11} tickLine={false} />
                <YAxis stroke="#777777" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#4A1726', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#C6A15B' }}
                />
                <Area type="monotone" dataKey="visitors" stroke="#C6A15B" strokeWidth={3} fillOpacity={1} fill="url(#visitorGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {message && (
          <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs font-black flex items-center gap-3 shadow-md animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#C6A15B]" />
            <h3 className="font-extrabold text-[#4A1726] text-base tracking-tight">Hourly Store Entry Slots</h3>
          </div>
          <span className="text-xs font-bold text-[#777777] bg-white/60 px-3 py-1 rounded-full border border-[#EAE4DC]">
            12 Hourly Slots (10 AM - 10 PM)
          </span>
        </div>

        {/* Hourly Slot Entry Responsive Grid */}
        {loading ? (
          <div className="card-glass p-12 text-center text-xs text-[#777777] font-bold">
            Loading hourly footfall register for {date}...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {slotHours.map((hour) => {
              const slot = slots[hour] || { visitors: 0, remarks: '' };
              const formatHour = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
              const formatEndHour = (hour + 1) > 12 ? `${(hour + 1) - 12}:00 PM` : (hour + 1) === 12 ? '12:00 PM' : `${hour + 1}:00 AM`;
              
              const isCurrentSlot = isTodaySelected && currentHourNow === hour;
              const isSaved = (slot.visitors || 0) > 0;

              return (
                <div 
                  key={hour} 
                  className={`card-glass p-5 flex flex-col justify-between transition-all duration-200 relative group hover:-translate-y-1 hover:shadow-xl rounded-2xl ${
                    isCurrentSlot
                      ? 'border-2 border-[#C6A15B] shadow-xl ring-4 ring-[#C6A15B]/15 bg-gradient-to-br from-amber-50/60 to-amber-100/30'
                      : isSaved
                      ? 'border-l-4 border-l-emerald-600 bg-white/80'
                      : 'border-l-4 border-l-[#4A1726]/30 bg-white/60'
                  }`}
                >
                  <div>
                    {/* Time Slot Header */}
                    <div className="flex items-center justify-between border-b border-[#EAE4DC]/80 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 font-black text-[#4A1726] text-sm tracking-tight">
                          <Clock className={`w-4 h-4 ${isCurrentSlot ? 'text-[#C6A15B] animate-pulse' : 'text-[#4A1726]'}`} />
                          <span>{formatHour} – {formatEndHour}</span>
                        </div>
                        <div className="text-[10px] text-[#777777] font-bold font-mono mt-0.5">
                          Slot {hour - 9} of 12
                        </div>
                      </div>

                      {/* Status Badges */}
                      {isCurrentSlot ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#C6A15B] text-white text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Current
                        </span>
                      ) : isSaved ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-300/50">
                          <Check className="w-3 h-3 text-emerald-600" /> Saved
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-[#F8F5F1] border border-[#EAE4DC] text-[#777777] text-[10px] font-bold uppercase tracking-wider">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-extrabold text-[#4A1726] mb-1">
                          Visitor Footfall Count
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={slot.visitors || ''}
                            onChange={(e) => setSlots({
                              ...slots,
                              [hour]: { ...slot, visitors: parseInt(e.target.value, 10) || 0 }
                            })}
                            placeholder="0"
                            className="w-full text-base font-black font-mono pl-9 pr-3 py-2 rounded-xl border border-[#EAE4DC] bg-white text-[#4A1726] focus:outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20 transition-all shadow-2xs"
                          />
                          <Users className="w-4 h-4 text-[#777777] absolute left-3 top-3" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-[#4A1726] mb-1">
                          Floor Notes / Remarks
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={slot.remarks || ''}
                            onChange={(e) => setSlots({
                              ...slots,
                              [hour]: { ...slot, remarks: e.target.value }
                            })}
                            placeholder="e.g. Rush in Womens Sarees"
                            className="w-full text-xs font-semibold pl-8 pr-3 py-2 rounded-xl border border-[#EAE4DC] bg-white text-[#4A1726] focus:outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20 transition-all shadow-2xs"
                          />
                          <FileText className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-2.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={() => handleSaveSlot(hour)}
                    disabled={savingSlot === hour}
                    className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] disabled:opacity-50 ${
                      isCurrentSlot
                        ? 'bg-[#C6A15B] text-white hover:bg-[#b07d20] shadow-md'
                        : isSaved
                        ? 'bg-[#4A1726] text-white hover:bg-[#350E1A]'
                        : 'bg-[#4A1726] text-white hover:bg-[#350E1A]'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingSlot === hour ? 'Logging Entry...' : isSaved ? 'Update Slot Log' : 'Save Slot Log'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
