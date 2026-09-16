import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ShieldCheck, Lock, User, ArrowRight, MapPin, RefreshCw, Hash, Eye, EyeOff } from 'lucide-react';

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
  const [countdown, setCountdown] = useState(30);
  const [showPassword, setShowPassword] = useState(false);

  // Rate limit & 10-minute temporary lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);

  // Validate password utility
  const validatePassword = (pwd: string) => {
    const hasLength = pwd.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return hasLength && hasLetter && hasNumber && hasSpecial;
  };

  // Check lock status with the backend (persists across page refresh, multi-tab, etc.)
  const checkServerLock = React.useCallback(async (userToCheck?: string) => {
    try {
      const uname = userToCheck !== undefined ? userToCheck : username;
      const res = await API.getLockStatus(uname.trim());
      if (res && res.data) {
        if (res.data.isLocked && res.data.remainingSeconds > 0) {
          setIsLocked(true);
          setLockRemainingSeconds(res.data.remainingSeconds);
        } else {
          setIsLocked(false);
          setLockRemainingSeconds(0);
        }
      }
    } catch {
      // Ignore network errors on check
    }
  }, [username]);

  // Initial check on mount
  useEffect(() => {
    checkServerLock();
  }, [checkServerLock]);

  // 1-second countdown interval for the 10-minute lockout timer
  useEffect(() => {
    if (!isLocked || lockRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          clearInterval(timer);
          // Re-verify with server that lock has expired
          checkServerLock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockRemainingSeconds, checkServerLock]);

  const formatLockTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
    setCountdown(30);
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadCaptcha();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loadCaptcha]);

  useEffect(() => {
    if (Auth.check()) {
      const user = Auth.get();
      if (user && ['Admin', 'Super Admin'].includes(user.role)) {
        navigate('/wedding-crm', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    if (!validatePassword(password)) {
      setErrorMsg('Password must be at least 8 characters long and contain letters, numbers, and special characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await API.verifyUser(username.trim(), password, captchaId, captchaText);
      if (res.success && res.data) {
        const user = res.data.user;

        // Reset lockout state on success
        setIsLocked(false);
        setLockRemainingSeconds(0);

        // Save full session including location fields from server JWT
        Auth.save({
          id: user.id,
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

        if (['Admin', 'Super Admin'].includes(res.user.role)) {
          navigate('/wedding-crm', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        if (res.locked || res.remainingSeconds) {
          setIsLocked(true);
          setLockRemainingSeconds(res.remainingSeconds || 600);
        }
        setErrorMsg(res.message || 'Sign-in failed. Please check your details and the captcha.');
        loadCaptcha();
      }
    } catch (err: any) {
      // If error message indicates lockout, check server lock status
      checkServerLock();
      setErrorMsg(err.message || 'Sign-in failed. Please try again.');
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-accent-soft animate-fade-in">
        {/* Card Header */}
        <div className="bg-primary p-6 flex items-center gap-4 border-b border-accent/30">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-accent/30" />
          <div>
            <h2 className="text-lg font-black text-white leading-tight tracking-tight">Enterprise Operations Portal</h2>
            <div className="text-[10px] text-accent font-bold uppercase tracking-widest mt-0.5">
              BSC EXCLUSIVE · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleLogin} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-primary tracking-tight">Welcome Back</h3>
            <p className="text-xs text-primary/70 font-medium mt-1">Sign in with your authorized system credentials. Your location will be loaded automatically.</p>
          </div>

          {/* 10-Minute Lockout Countdown Alert */}
          {isLocked && lockRemainingSeconds > 0 && (
            <div className="p-4 rounded-2xl bg-[#FFF5F5] border-2 border-[#FEB2B2] text-[#9B2C2C] space-y-2 animate-scale-in">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4 text-[#E53E3E]" />
                <span>Account Temporarily Locked</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed">
                5 consecutive incorrect password attempts detected. For security, login is locked for 10 minutes.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#FEB2B2]/60 text-xs">
                <span className="font-bold text-[#742A2A]">Remaining Lock Time:</span>
                <span className="font-mono font-black text-sm bg-[#FED7D7] px-2.5 py-1 rounded-lg text-[#9B2C2C] shadow-xs">
                  {formatLockTimer(lockRemainingSeconds)}
                </span>
              </div>
            </div>
          )}

          {errorMsg && !isLocked && (
            <div className="p-3.5 rounded-xl bg-[#FDF0F2] border border-[#F6C8CE] text-[#C43D4B] text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/70" />
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                disabled={isLocked && lockRemainingSeconds > 0}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => { if (username.trim()) checkServerLock(username.trim()); }}
                placeholder="admin@bsctextiles.com"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/70" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                disabled={isLocked && lockRemainingSeconds > 0}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full text-xs font-semibold pl-10 pr-10 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/60 hover:text-primary transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Security Code
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/70" />
                <input
                  type="text"
                  name="captcha"
                  autoComplete="off"
                  maxLength={8}
                  value={captchaText}
                  disabled={isLocked && lockRemainingSeconds > 0}
                  onChange={(e) => setCaptchaText(e.target.value)}
                  placeholder="Enter 8 characters"
                  className="w-full text-xs font-semibold pl-10 pr-3 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs tracking-widest disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                />
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {captchaSvg ? (
                  <img
                    src={captchaSvg}
                    alt="Security captcha - 4 digit numeric code"
                    className="h-[42px] w-[120px] rounded-lg border border-accent-soft bg-white shadow-xs select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="h-[42px] w-[120px] rounded-lg border border-accent-soft bg-white animate-pulse" />
                )}
                <button
                  type="button"
                  onClick={() => { loadCaptcha(); setCountdown(30); }}
                  className="p-2 rounded-lg border border-accent-soft text-primary hover:bg-background transition-colors"
                  title="Load a new security code"
                  aria-label="Refresh captcha"
                >
                  <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-primary/70 font-medium">Refreshes automatically in {countdown}s for your security.</p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showToast('Please contact your System Administrator to reset your password', 'info')}
              className="text-xs text-accent font-bold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || (isLocked && lockRemainingSeconds > 0)}
            className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover active:scale-[0.99] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Authenticating Credentials…</span>
              </>
            ) : isLocked && lockRemainingSeconds > 0 ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Locked ({formatLockTimer(lockRemainingSeconds)})</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 border-t border-accent-soft">
            <button
              type="button"
              onClick={() => navigate('/candidate-entry')}
              className="w-full py-3 px-4 rounded-xl border-2 border-primary text-primary bg-white font-extrabold text-xs tracking-wide hover:bg-background active:scale-[0.99] transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>Apply as a Candidate</span>
              <User className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Card Footer */}
        <div className="bg-background px-7 py-3.5 border-t border-accent-soft flex items-center justify-between text-[10px] text-primary/70 font-semibold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Authorized access only · Location auto-assigned</span>
          </span>
          <span className="font-black text-primary">BSC v3.0</span>
        </div>
      </div>

      {/* Location Info Note */}
      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-primary/70 font-medium">
        <MapPin className="w-3 h-3 text-accent" />
        <span>Your location (Belagavi / Davanagere / Shivamogga) is assigned by the System Admin</span>
      </div>
    </div>
  );
}
