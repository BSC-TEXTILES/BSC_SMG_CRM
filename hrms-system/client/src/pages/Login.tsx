import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ShieldCheck, Lock, User, ArrowRight, MapPin } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Auth.check()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await API.verifyUser(username.trim(), password);
      if (res.success && res.data) {
        const user = res.data.user;

        // Save full session including location fields from server JWT
        Auth.save({
          username: user.username,
          role: user.role,
          fullName: user.fullName,
          displayName: user.displayName || user.fullName || user.role,
          token: res.data.token,
          // Location fields — set by the server from the user's DB record
          locationId: user.locationId ?? null,
          locationCode: user.locationCode ?? null,
          locationName: user.locationName ?? null,
          isGlobalAdmin: user.isGlobalAdmin === true || user.locationId === null
        });

        const locationLabel = user.locationName ? ` — ${user.locationName}` : '';
        showToast(`Welcome back, ${user.fullName || user.username}${locationLabel}`, 'success');
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMsg(res.message || 'Incorrect username or password. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5F1] flex flex-col items-center justify-center p-4 sm:p-6">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#EAE4DC] animate-fade-in">
        {/* Card Header */}
        <div className="bg-[#4A1726] p-6 flex items-center gap-4 border-b border-[#C6A15B]/30">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-[#C6A15B]/30" />
          <div>
            <h2 className="text-lg font-black text-white leading-tight tracking-tight">Enterprise Operations Portal</h2>
            <div className="text-[10px] text-[#C6A15B] font-bold uppercase tracking-widest mt-0.5">
              BSC EXCLUSIVE · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleLogin} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-[#321923] tracking-tight">Welcome Back</h3>
            <p className="text-xs text-[#7A726D] font-medium mt-1">Sign in with your authorized system credentials. Your location will be loaded automatically.</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FDF0F2] border border-[#F6C8CE] text-[#C43D4B] text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#321923]">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A726D]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@bsctextiles.com"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-[#EAE4DC] bg-white text-[#321923] placeholder-[#8E8883] focus:outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20 transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#321923]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A726D]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-[#EAE4DC] bg-white text-[#321923] placeholder-[#8E8883] focus:outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20 transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showToast('Please contact your System Administrator to reset your password', 'info')}
              className="text-xs text-[#C6A15B] font-bold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#4A1726] text-white font-extrabold text-xs tracking-wide hover:bg-[#5C1D30] active:scale-[0.99] transition-all shadow-lg shadow-[#4A1726]/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Authenticating Credentials…</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 border-t border-[#EAE4DC]">
            <button
              type="button"
              onClick={() => navigate('/candidate-entry')}
              className="w-full py-3 px-4 rounded-xl border-2 border-[#4A1726] text-[#4A1726] bg-white font-extrabold text-xs tracking-wide hover:bg-[#F8F5F1] active:scale-[0.99] transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>Apply as a Candidate</span>
              <User className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Card Footer */}
        <div className="bg-[#F8F5F1] px-7 py-3.5 border-t border-[#EAE4DC] flex items-center justify-between text-[10px] text-[#7A726D] font-semibold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C6A15B]" />
            <span>Authorized access only · Location auto-assigned</span>
          </span>
          <span className="font-black text-[#4A1726]">BSC v3.0</span>
        </div>
      </div>

      {/* Location Info Note */}
      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#7A726D] font-medium">
        <MapPin className="w-3 h-3 text-[#C6A15B]" />
        <span>Your location (Belagavi / Davanagere / Shivamogga) is assigned by the System Admin</span>
      </div>
    </div>
  );
}
