import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { API, Auth, UserSession } from '../services/api';
import { 
  Users, CheckCircle2, AlertCircle, Building2, TrendingUp, Sparkles, PhoneCall,
  Search, Bell, Plus, Calendar, MapPin, ChevronDown, Check, Activity, Target
} from 'lucide-react';
import ToastContainer from '../components/Toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>({});
  
  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    
    // Attempt to load some real stats for the dashboard, otherwise fallback to UI placeholders
    API.getWeddingEnhancedDashboard().then(res => {
      if(res && res.data) setStats(res.data);
    }).catch(e => console.error(e));
  }, [navigate]);

  return (
    <div className="flex h-screen bg-[#FFF9F9] font-sans">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Custom Top Header matches the mockup */}
        <header className="h-16 bg-[#FFF9F9] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-[#F3EFE9] rounded-lg p-1 text-xs font-bold text-[#5B4636]">
               <button className="px-3 py-1.5 bg-[#FDECC8] rounded-md shadow-sm">Davanagere</button>
               <button className="px-3 py-1.5 hover:bg-white/50 rounded-md transition-colors">Belagum</button>
               <button className="px-3 py-1.5 hover:bg-white/50 rounded-md transition-colors">Shivamogga</button>
             </div>
             <div className="relative">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8F85]" />
               <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-[#F3EFE9] border-none rounded-lg text-xs font-bold w-64 focus:ring-0 focus:outline-none text-[#5B4636]" />
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-xs font-bold text-[#5B4636] bg-[#F3EFE9] px-4 py-2 rounded-lg">
               <Calendar className="w-3.5 h-3.5" /> 14 Oct 2024 | 11:42 AM IST
             </div>
             <button className="px-4 py-2 bg-[#4A1E2C] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#3d1824] transition-colors flex items-center gap-1.5">
               <Plus className="w-3.5 h-3.5" /> New Record
             </button>
             <button className="p-2 relative text-[#5B4636] hover:bg-[#F3EFE9] rounded-full transition-colors">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
             </button>
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-[#4A1E2C] text-white flex items-center justify-center font-bold text-sm">
                 {session?.fullName?.charAt(0) || 'A'}
               </div>
               <div className="hidden md:block text-left leading-tight">
                 <div className="text-[11px] font-bold text-[#2C1E16]">{session?.fullName || 'Admin User'}</div>
                 <div className="text-[10px] text-[#9A8F85] font-semibold">Davanagere Flagship</div>
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 scroll-smooth bg-[#FFF9F9]">
          <ToastContainer />
          
          <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
            {/* Top Widget: Executive Console */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#EBE5E0] p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#9A8F85] mb-1">
                    Enterprise Master Telemetry <span className="w-1 h-1 rounded-full bg-[#EBE5E0]"></span> HQ Consolidated View
                  </div>
                  <h1 className="text-3xl font-extrabold text-[#2C1E16]">Executive Operational Console</h1>
                </div>
                <div className="flex items-center gap-3">
                   <button className="flex items-center gap-2 text-xs font-bold text-[#5B4636] bg-[#F8F6F3] border border-[#EBE5E0] px-4 py-2 rounded-lg hover:bg-[#F3EFE9] transition-colors">
                     <Building2 className="w-3.5 h-3.5" /> Davanagere Flagship (Main) <span className="bg-[#4A1E2C] text-white px-1.5 rounded text-[10px] ml-1">+2</span> <ChevronDown className="w-3 h-3 ml-1" />
                   </button>
                   <button className="flex items-center gap-2 text-xs font-bold text-[#5B4636] bg-[#F8F6F3] border border-[#EBE5E0] px-4 py-2 rounded-lg hover:bg-[#F3EFE9] transition-colors">
                     <Calendar className="w-3.5 h-3.5" /> This Month (Oct 2024) <ChevronDown className="w-3 h-3 ml-1" />
                   </button>
                   <button className="p-2 border border-[#EBE5E0] bg-[#F8F6F3] text-[#5B4636] rounded-lg hover:bg-[#F3EFE9] transition-colors"><Activity className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-6 gap-4 border-t border-[#EBE5E0] pt-6">
                <div className="space-y-1 relative pr-4 border-r border-[#EBE5E0]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A8F85] flex items-center justify-between">Total Headcount <Users className="w-3.5 h-3.5 opacity-50"/></div>
                  <div className="text-3xl font-black text-[#2C1E16]">1,482</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold"><span className="text-emerald-600 bg-emerald-50 px-1.5 rounded">+3.6% MoM</span> <span className="text-[#9A8F85]">3 Hubs</span></div>
                </div>
                <div className="space-y-1 relative pr-4 border-r border-[#EBE5E0]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A8F85] flex items-center justify-between">Joining Calls Desk <PhoneCall className="w-3.5 h-3.5 opacity-50"/></div>
                  <div className="text-3xl font-black text-[#2C1E16]">38</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold"><span className="text-rose-600 bg-rose-50 px-1.5 rounded">8 Overdue</span> <span className="text-[#9A8F85]">Action Required</span></div>
                </div>
                <div className="space-y-1 relative pr-4 border-r border-[#EBE5E0]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A8F85] flex items-center justify-between">DOJ (Next 7D) <Calendar className="w-3.5 h-3.5 opacity-50"/></div>
                  <div className="text-3xl font-black text-[#2C1E16]">24</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[#9A8F85]">Confirmed Inductees</div>
                </div>
                <div className="space-y-1 relative pr-4 border-r border-[#EBE5E0]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A8F85] flex items-center justify-between">Wedding Silks VIP <Sparkles className="w-3.5 h-3.5 opacity-50"/></div>
                  <div className="text-3xl font-black text-[#2C1E16]">{stats.upcomingWeddings || '412'}</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600">₹9.8 Cr Pipeline</div>
                </div>
                <div className="space-y-1 relative pr-4 border-r border-[#EBE5E0]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A8F85] flex items-center justify-between">MCheck Compliance <CheckCircle2 className="w-3.5 h-3.5 opacity-50"/></div>
                  <div className="text-3xl font-black text-[#2C1E16]">94.6%</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600">Ready & Verified</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A8F85] flex items-center justify-between">Active Weaving Looms <Target className="w-3.5 h-3.5 opacity-50"/></div>
                  <div className="text-3xl font-black text-[#2C1E16]">18 <span className="text-[#9A8F85] text-xl">/ 18</span></div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-max px-1.5 rounded">On Schedule</div>
                </div>
              </div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-3 gap-6">
              {/* Joining Call Desk Pipeline */}
              <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-[#EBE5E0] p-0 overflow-hidden flex flex-col">
                 <div className="p-5 border-b border-[#EBE5E0] flex justify-between items-start bg-[#FDFCFB]">
                   <div>
                     <h3 className="text-base font-extrabold text-[#2C1E16] flex items-center gap-2">
                       <PhoneCall className="w-4 h-4 text-[#4A1E2C]" /> Joining Call Desk Pipeline
                     </h3>
                     <p className="text-[11px] text-[#9A8F85] font-semibold mt-1">Real-time candidate onboarding confirmation telemetry</p>
                   </div>
                   <div className="flex gap-2">
                     <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Confirmed (18)</span>
                     <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Pending Call (12)</span>
                     <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> No Answer (8)</span>
                   </div>
                 </div>
                 <div className="overflow-x-auto flex-1">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-[#4A1E2C] text-white">
                         <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-wider">Candidate & Role</th>
                         <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-wider">Showroom Location</th>
                         <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-wider">Target DOJ</th>
                         <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-wider">Call Status</th>
                         <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-wider">Desk Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#EBE5E0]">
                       <tr className="hover:bg-[#FDFCFB]">
                         <td className="py-3 px-4">
                           <div className="text-xs font-bold text-[#2C1E16]">Pooja Raghavan</div>
                           <div className="text-[10px] text-[#9A8F85] mt-0.5">Lead Silk Draper • Emp# BSC-4402</div>
                         </td>
                         <td className="py-3 px-4 text-xs font-semibold text-[#5B4636]">Davanagere Flagship</td>
                         <td className="py-3 px-4">
                           <div className="text-xs font-bold text-[#2C1E16]">18 Oct 2024</div>
                           <div className="text-[10px] text-[#9A8F85] mt-0.5">In 4 days</div>
                         </td>
                         <td className="py-3 px-4">
                           <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">Pending Call</span>
                         </td>
                         <td className="py-3 px-4">
                           <div className="flex gap-2">
                             <button className="bg-[#4A1E2C] text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#3d1824]">Call Log</button>
                             <button className="bg-[#F8F6F3] text-[#5B4636] border border-[#EBE5E0] text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#F3EFE9]">Update DOJ</button>
                           </div>
                         </td>
                       </tr>
                       <tr className="hover:bg-[#FDFCFB]">
                         <td className="py-3 px-4">
                           <div className="text-xs font-bold text-[#2C1E16]">Manjunath Swamy</div>
                           <div className="text-[10px] text-[#9A8F85] mt-0.5">Loom Master Technician • BSC-4408</div>
                         </td>
                         <td className="py-3 px-4 text-xs font-semibold text-[#5B4636]">Belagum Hub</td>
                         <td className="py-3 px-4">
                           <div className="text-xs font-bold text-[#2C1E16]">16 Oct 2024</div>
                           <div className="text-[10px] text-[#9A8F85] mt-0.5">In 2 days</div>
                         </td>
                         <td className="py-3 px-4">
                           <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">Confirmed</span>
                         </td>
                         <td className="py-3 px-4">
                           <button className="bg-[#987635] text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#85652d]">Initiate Onboarding</button>
                         </td>
                       </tr>
                       <tr className="hover:bg-[#FDFCFB]">
                         <td className="py-3 px-4">
                           <div className="text-xs font-bold text-[#2C1E16]">Ananya Kulkarni</div>
                           <div className="text-[10px] text-[#9A8F85] mt-0.5">Bridal Salon Exec • BSC-4412</div>
                         </td>
                         <td className="py-3 px-4 text-xs font-semibold text-[#5B4636]">Shivamogga Gallerie</td>
                         <td className="py-3 px-4">
                           <div className="text-xs font-bold text-[#2C1E16]">15 Oct 2024</div>
                           <div className="text-[10px] text-rose-600 font-bold mt-0.5">Tomorrow</div>
                         </td>
                         <td className="py-3 px-4">
                           <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">No Answer (2x)</span>
                         </td>
                         <td className="py-3 px-4">
                           <div className="flex gap-2">
                             <button className="bg-[#4A1E2C] text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#3d1824]">Escalate</button>
                             <button className="bg-[#F8F6F3] text-[#5B4636] border border-[#EBE5E0] text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#F3EFE9]">Reschedule</button>
                           </div>
                         </td>
                       </tr>
                     </tbody>
                   </table>
                 </div>
                 <div className="p-3 bg-[#FDFCFB] border-t border-[#EBE5E0] flex justify-between items-center">
                   <div className="text-[10px] text-[#9A8F85] font-semibold flex items-center gap-1.5">
                     <Activity className="w-3.5 h-3.5" /> greyHR Master sync queued every 15 minutes
                   </div>
                   <button className="text-[11px] font-bold text-[#2C1E16] hover:underline flex items-center gap-1">View All 38 Joining Desks &rarr;</button>
                 </div>
              </div>

              {/* Regional Performance Matrix */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#EBE5E0] p-5 flex flex-col">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-base font-extrabold text-[#2C1E16] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-600" /> Regional Performance
                    </h3>
                    <p className="text-[11px] text-[#9A8F85] font-semibold mt-1">Live store revenue, staff presence</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">Live Hubs: 3</span>
                </div>

                <div className="space-y-4 flex-1">
                  {/* Davanagere */}
                  <div className="border-l-2 border-[#4A1E2C] pl-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs font-bold text-[#2C1E16] flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4A1E2C]"></div> Davanagere Flagship (Main)
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded border border-emerald-100">Audit 98.4%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">MTD Revenue</div><div className="text-xs font-black text-[#2C1E16]">₹1.84 Cr</div></div>
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">Attendance</div><div className="text-xs font-black text-emerald-600">97.8% <span className="font-medium text-[9px] text-[#9A8F85]">(712 Staff)</span></div></div>
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">Wedding Footfall</div><div className="text-xs font-black text-[#2C1E16]">184 Walk-ins</div></div>
                    </div>
                  </div>

                  <hr className="border-[#EBE5E0]" />

                  {/* Belagum */}
                  <div className="border-l-2 border-emerald-600 pl-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs font-bold text-[#2C1E16] flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div> Belagum Heritage Hub
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded border border-emerald-100">Audit 94.1%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">MTD Revenue</div><div className="text-xs font-black text-[#2C1E16]">₹1.16 Cr</div></div>
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">Attendance</div><div className="text-xs font-black text-emerald-600">95.4% <span className="font-medium text-[9px] text-[#9A8F85]">(488 Staff)</span></div></div>
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">Wedding Footfall</div><div className="text-xs font-black text-[#2C1E16]">132 Walk-ins</div></div>
                    </div>
                  </div>

                  <hr className="border-[#EBE5E0]" />

                  {/* Shivamogga */}
                  <div className="border-l-2 border-amber-600 pl-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs font-bold text-[#2C1E16] flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-600"></div> Shivamogga Gallerie
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded border border-amber-100">Audit 91.2%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">MTD Revenue</div><div className="text-xs font-black text-[#2C1E16]">₹82.4 L</div></div>
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">Attendance</div><div className="text-xs font-black text-emerald-600">95.6% <span className="font-medium text-[9px] text-[#9A8F85]">(282 Staff)</span></div></div>
                      <div><div className="text-[9px] uppercase font-bold text-[#9A8F85]">Wedding Footfall</div><div className="text-xs font-black text-[#2C1E16]">96 Walk-ins</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-3 gap-6">
              
              {/* High-Priority Wedding Follow-ups */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#EBE5E0] p-5">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-base font-extrabold text-[#2C1E16] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> High-Priority Follow-ups
                    </h3>
                    <p className="text-[11px] text-[#9A8F85] font-semibold mt-1">Upcoming Muhurtham VIP silk curations</p>
                  </div>
                  <div className="bg-[#4A1E2C] text-white text-[10px] font-bold px-2 py-1 rounded text-center leading-tight">
                    5<br/>Today
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="border border-[#EBE5E0] rounded-xl p-3 bg-[#FDFCFB] hover:border-amber-200 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm font-bold text-[#2C1E16]">Dr. Sahana • Adv. Rahul Gowda</div>
                        <div className="text-[10px] text-[#9A8F85] font-medium">Muhurtham: 14 Nov 2024 (Bangalore Palace)</div>
                      </div>
                      <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-100 text-right">
                        Royal Kanjeevaram<br/>₹3.2L
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#EBE5E0]">
                      <div className="text-[10px] text-[#9A8F85] font-bold flex items-center gap-1.5"><PhoneCall className="w-3 h-3"/> Concierge: Rajeshwari M.</div>
                      <button className="bg-[#4A1E2C] text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#3d1824]">Call • Reminder Due</button>
                    </div>
                  </div>
                  
                  <div className="border border-[#EBE5E0] rounded-xl p-3 bg-[#FDFCFB] hover:border-emerald-200 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm font-bold text-[#2C1E16]">Priyanka Shetty • Vignesh Hegde</div>
                        <div className="text-[10px] text-[#9A8F85] font-medium">Muhurtham: 28 Nov 2024 (Shivamogga)</div>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-right">
                        Heritage Banarasi<br/>₹2.8L
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#EBE5E0]">
                      <div className="text-[10px] text-[#9A8F85] font-bold flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Concierge: Sunil K.</div>
                      <button className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-3 py-1.5 rounded">Trial Slot Confirmed</button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#EBE5E0] text-center">
                  <button className="text-[11px] font-bold text-[#2C1E16] hover:underline">Open Wedding CRM &rarr;</button>
                </div>
              </div>

              {/* Batch Plan & Weaving Velocity */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#EBE5E0] p-5">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-base font-extrabold text-[#2C1E16] flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-600" /> Weaving Velocity
                    </h3>
                    <p className="text-[11px] text-[#9A8F85] font-semibold mt-1">Active loom output & yarn inspection</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-1 rounded text-center leading-tight">
                    18/18<br/>Looms
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-[#EBE5E0] pb-4">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="text-xs font-bold text-[#2C1E16]">Batch #BSC-TX-882 • Pure Silk 220 GSM</div>
                      <span className="text-[10px] font-black text-white bg-[#4A1E2C] px-1.5 py-0.5 rounded">84% Woven</span>
                    </div>
                    <div className="text-[10px] text-[#9A8F85] font-medium mb-3">Loom Cluster B-04 (Davanagere Weaving House)</div>
                    <div className="w-full bg-[#F3EFE9] rounded-full h-1.5 mb-2"><div className="bg-[#4A1E2C] h-1.5 rounded-full w-[84%]"></div></div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-[#5B4636]">Target: 320 Meters (Pure Mulberry Silk)</span>
                      <span className="text-emerald-600">QC Passed Stage 2</span>
                    </div>
                  </div>

                  <div className="border-b border-[#EBE5E0] pb-4">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="text-xs font-bold text-[#2C1E16]">Batch #BSC-TX-889 • Gold Zari Pallu</div>
                      <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Jacquard Setup</span>
                    </div>
                    <div className="text-[10px] text-[#9A8F85] font-medium mb-3">Loom Cluster B-01 (Belagum Master Looms)</div>
                    <div className="w-full bg-[#F3EFE9] rounded-full h-1.5 mb-2"><div className="bg-amber-400 h-1.5 rounded-full w-[15%]"></div></div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-[#5B4636]">Target: 140 Sarees (Wedding Season)</span>
                      <span className="text-amber-600">Warp Tension Sync</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <button className="text-[11px] font-bold text-[#2C1E16] hover:underline">Looms Console &rarr;</button>
                </div>
              </div>

              {/* MCheck Store Audit Radar */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#EBE5E0] p-5">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-base font-extrabold text-[#2C1E16] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" /> MCheck Store Audit
                    </h3>
                    <p className="text-[11px] text-[#9A8F85] font-semibold mt-1">Daily retail discipline & display audit</p>
                  </div>
                  <div className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold px-2 py-1 rounded text-center leading-tight">
                    Avg<br/>94.6%
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-bold text-[#5B4636]">Textile Display & Mannequin Styling</div>
                      <div className="text-xs font-black text-emerald-600">98.2%</div>
                    </div>
                    <div className="w-full bg-[#F3EFE9] rounded-full h-1.5 mb-1"><div className="bg-emerald-500 h-1.5 rounded-full w-[98.2%]"></div></div>
                    <div className="flex justify-between text-[9px] text-[#9A8F85] font-medium"><span>Davanagere: 100%</span><span>Belagum: 98%</span><span>Shivamogga: 96.5%</span></div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-bold text-[#5B4636]">Cash Counters & Safe Reconciliation</div>
                      <div className="text-xs font-black text-emerald-600">96.0%</div>
                    </div>
                    <div className="w-full bg-[#F3EFE9] rounded-full h-1.5 mb-1"><div className="bg-emerald-500 h-1.5 rounded-full w-[96%]"></div></div>
                    <div className="flex justify-between text-[9px] text-[#9A8F85] font-medium"><span>All 14 Cash Registers Balanced</span><span>0 Physical Discrepancy</span></div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-bold text-[#5B4636]">VIP Bridal Trial Salons & Valet</div>
                      <div className="text-xs font-black text-amber-500">91.8%</div>
                    </div>
                    <div className="w-full bg-[#F3EFE9] rounded-full h-1.5 mb-1"><div className="bg-amber-400 h-1.5 rounded-full w-[91.8%]"></div></div>
                    <div className="flex justify-between text-[9px] text-[#9A8F85] font-medium"><span>Minor HVAC note at Belagum Floor 2</span></div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-bold text-[#5B4636]">Staff Uniform & Haute Grooming</div>
                      <div className="text-xs font-black text-emerald-600">99.1%</div>
                    </div>
                    <div className="w-full bg-[#F3EFE9] rounded-full h-1.5 mb-1"><div className="bg-emerald-500 h-1.5 rounded-full w-[99.1%]"></div></div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#EBE5E0] text-center">
                  <button className="bg-rose-50 text-rose-700 text-[10px] font-bold px-3 py-1.5 rounded border border-rose-100 hover:bg-rose-100">Initiate Instant Spot Audit</button>
                </div>
              </div>
            </div>

            {/* Footer Status Bar */}
            <div className="bg-[#2C1E16] text-white rounded-xl p-4 flex justify-between items-center shadow-lg mt-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/20 rounded flex items-center justify-center text-amber-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-wide">BSC Enterprise Operations Protocol Active</div>
                  <div className="text-[10px] text-white/60">greyHR employee payroll, showroom RFID tags, and loom warp meters are synchronized in real-time.</div>
                </div>
              </div>
              <div className="flex gap-3">
                 <button className="bg-[#5B4636] hover:bg-[#725946] text-amber-400 text-xs font-bold px-4 py-2 rounded transition-colors border border-amber-900/30">Download Daily Audit Log</button>
                 <button className="bg-[#1A120D] hover:bg-black text-white text-xs font-bold px-4 py-2 rounded transition-colors border border-white/10">System Diagnostics</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
