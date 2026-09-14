import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ShieldCheck, Lock, User, ArrowRight, MapPin, RefreshCw, Hash } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // ── Numeric captcha: fetched from the server, auto-refreshed every 30 s,
  // and reloaded automatically after any failed sign-in attempt. ──
  const loadCaptcha = React.useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch('/api/auth/captcha');
      const json = await res.json();
      if (json?.data?.svg) {
        setCaptchaSvg('data:image/svg+xml;utf8,' + encodeURIComponent(json.data.svg));
        setCaptchaId(json.data.captchaId);
      }
    } catch {
      setCaptchaSvg('');
    } finally {
      setCaptchaLoading(false);
      setCaptchaText('');
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
    const t = setInterval(loadCaptcha, 30 * 1000);
    return () => clearInterval(t);
  }, [loadCaptcha]);

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
      const res = await API.verifyUser(username.trim(), password, captchaId, captchaText);
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

        // Record the sign-in device location (used by admins for the
        // security trail). Silently skipped if the user denies permission.
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const session = Auth.get();
              if (!session?.token) return;
              fetch('/api/security/log-event', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.token}`,
                  'x-auth-token': session.token
                },
                body: JSON.stringify({
                  event: 'GPS_PING',
                  details: {
                    lat: Number(pos.coords.latitude.toFixed(5)),
                    lng: Number(pos.coords.longitude.toFixed(5)),
                    accuracyM: Math.round(pos.coords.accuracy),
                    at: new Date().toISOString()
                  }
                })
              }).catch(() => {});
            },
            () => { /* permission denied / unavailable — skip silently */ },
            { timeout: 8000, maximumAge: 300000 }
          );
        }

        navigate('/dashboard', { replace: true });
      } else {
        setErrorMsg(res.message || 'Sign-in failed. Please check your details and the captcha.');
        // Wrong credentials OR wrong captcha: the server consumes the captcha
        // on every attempt, so always load a fresh one.
        loadCaptcha();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign-in failed. Please try again.');
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col items-center justify-center p-4 sm:p-6">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E2E8F0] animate-fade-in">
        {/* Card Header */}
        <div className="bg-[#163B5C] p-6 flex items-center gap-4 border-b border-[#4E8ABF]/30">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-[#4E8ABF]/30" />
          <div>
            <h2 className="text-lg font-black text-white leading-tight tracking-tight">Enterprise Operations Portal</h2>
            <div className="text-[10px] text-[#4E8ABF] font-bold uppercase tracking-widest mt-0.5">
              BSC EXCLUSIVE · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleLogin} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-[#1B2A3B] tracking-tight">Welcome Back</h3>
            <p className="text-xs text-[#5F6E7E] font-medium mt-1">Sign in with your authorized system credentials. Your location will be loaded automatically.</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FDF0F2] border border-[#F6C8CE] text-[#C43D4B] text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#1B2A3B]">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6E7E]" />
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@bsctextiles.com"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-[#E2E8F0] bg-white text-[#1B2A3B] placeholder-[#8896A6] focus:outline-none focus:border-[#4E8ABF] focus:ring-2 focus:ring-[#4E8ABF]/20 transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#1B2A3B]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6E7E]" />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-[#E2E8F0] bg-white text-[#1B2A3B] placeholder-[#8896A6] focus:outline-none focus:border-[#4E8ABF] focus:ring-2 focus:ring-[#4E8ABF]/20 transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#321923]">
              Security Code
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A726D]" />
                <input
                  type="text"
                  inputMode="numeric"
                  name="captcha"
                  autoComplete="off"
                  maxLength={4}
                  value={captchaText}
                  onChange={(e) => setCaptchaText(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter the 4 digits"
                  className="w-full text-xs font-semibold pl-10 pr-3 py-3 rounded-xl border border-[#EAE4DC] bg-white text-[#321923] placeholder-[#8E8883] focus:outline-none focus:border-[#4E8ABF] focus:ring-2 focus:ring-[#4E8ABF]/20 transition-all shadow-xs tracking-[0.35em]"
                  required
                />
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {captchaSvg ? (
                  <img
                    src={captchaSvg}
                    alt="Security captcha - 4 digit numeric code"
                    className="h-[42px] w-[120px] rounded-lg border border-[#EAE4DC] bg-white shadow-xs select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="h-[42px] w-[120px] rounded-lg border border-[#EAE4DC] bg-white animate-pulse" />
                )}
                <button
                  type="button"
                  onClick={loadCaptcha}
                  className="p-2 rounded-lg border border-[#EAE4DC] text-[#163B5C] hover:bg-[#F4F6F9] transition-colors"
                  title="Load a new security code"
                  aria-label="Refresh captcha"
                >
                  <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[#7A726D] font-medium">Refreshes automatically every 30 seconds for your security.</p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showToast('Please contact your System Administrator to reset your password', 'info')}
              className="text-xs text-[#4E8ABF] font-bold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#163B5C] text-white font-extrabold text-xs tracking-wide hover:bg-[#1F4D77] active:scale-[0.99] transition-all shadow-lg shadow-[#163B5C]/20 flex items-center justify-center gap-2 disabled:opacity-50"
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

          <div className="pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => navigate('/candidate-entry')}
              className="w-full py-3 px-4 rounded-xl border-2 border-[#163B5C] text-[#163B5C] bg-white font-extrabold text-xs tracking-wide hover:bg-[#F4F6F9] active:scale-[0.99] transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>Apply as a Candidate</span>
              <User className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Card Footer */}
        <div className="bg-[#F4F6F9] px-7 py-3.5 border-t border-[#E2E8F0] flex items-center justify-between text-[10px] text-[#5F6E7E] font-semibold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4E8ABF]" />
            <span>Authorized access only · Location auto-assigned</span>
          </span>
          <span className="font-black text-[#163B5C]">BSC v3.0</span>
        </div>
      </div>

      {/* Location Info Note */}
      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#5F6E7E] font-medium">
        <MapPin className="w-3 h-3 text-[#4E8ABF]" />
        <span>Your location (Belagavi / Davanagere / Shivamogga) is assigned by the System Admin</span>
      </div>
    </div>
  );
}
