import React, { useState, useEffect, useRef } from 'react';
import {
  X, Mail, Lock, User as UserIcon, Loader2, ArrowRight,
  ShieldCheck, RefreshCw, KeyRound, Eye, EyeOff, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

type Mode = 'login' | 'signup' | 'forgot';
type Step = 'form' | 'otp' | 'new-password' | 'reset-done';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode }) => {
  const [mode, setMode] = useState<Mode>(initialMode || 'login');
  const [step, setStep] = useState<Step>('form');

  // Shared fields
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP
  const [otpEmail, setOtpEmail]       = useState('');
  const [otp, setOtp]                 = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reset-password specific
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw]             = useState(false);
  const [showConfirmPw, setShowConfirmPw]     = useState(false);
  const [verifiedResetOtp, setVerifiedResetOtp] = useState(''); // OTP confirmed at step 2

  const {
    login, register, verifyOtp, resendOtp,
    forgotPassword, verifyResetOtp, resetPassword,
    error, clearError, isLoading,
  } = useAuth();

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync mode when landing page flips between Sign In / Get Started
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // Reset all state when the modal opens
  useEffect(() => {
    if (isOpen) {
      clearError();
      setPassword('');
      setStep('form');
      setOtp(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setVerifiedResetOtp('');
      setShowPassword(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
    }
  }, [isOpen]);

  // Resend-cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // ── OTP input helpers ──────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtp(next);
    const nextEmpty = next.findIndex(d => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  const otpCode = otp.join('');

  // ── Login / Signup submit ──────────────────────────────────────────────────
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'signup') {
        const result = await register(name, email, password);
        if (result.status === 'pending') {
          setOtpEmail(result.email || email);
          setStep('otp');
          setOtp(['', '', '', '', '', '']);
          setResendCooldown(60);
          clearError();
        }
      } else {
        const result = await login(email, password);
        if (result.status === 'pending') {
          setOtpEmail(result.email || email);
          setStep('otp');
          setOtp(['', '', '', '', '', '']);
          setResendCooldown(60);
          clearError();
        } else {
          onClose();
          setName(''); setEmail(''); setPassword('');
        }
      }
    } catch (e: any) {
      if (e.message?.includes('not verified')) {
        setOtpEmail(email);
        setStep('otp');
        setOtp(['', '', '', '', '', '']);
        setResendCooldown(0);
        clearError();
      }
    }
  };

  // ── Login/Signup OTP verify ────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    try {
      await verifyOtp(otpEmail, otpCode);
      onClose();
      setName(''); setEmail(''); setPassword('');
      setStep('form');
      setOtp(['', '', '', '', '', '']);
    } catch (_) { /* handled in context */ }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      clearError();
      await resendOtp(otpEmail);
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(60);
    } catch (_) { /* handled in context */ }
  };

  // ── Forgot password — Step 1: email entry ─────────────────────────────────
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword(email);
      setOtpEmail(email);
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(60);
      clearError();
      setStep('otp');
    } catch (_) { /* handled in context */ }
  };

  // ── Forgot password — Step 2: verify OTP (SERVER-SIDE) ────────────────────
  // FIX: now actually validates the OTP against the backend before proceeding.
  // A wrong OTP will be rejected here with an error message — user stays on step 2.
  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    try {
      await verifyResetOtp(otpEmail, otpCode);   // ← real server call
      setVerifiedResetOtp(otpCode);              // cache the confirmed OTP for step 3
      clearError();
      setStep('new-password');
    } catch (_) { /* error shown by context */ }
  };

  const handleForgotResend = async () => {
    if (resendCooldown > 0) return;
    try {
      clearError();
      await forgotPassword(otpEmail);            // re-generates & sends a new OTP
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(60);
    } catch (_) { /* handled in context */ }
  };

  // ── Forgot password — Step 3: set new password ────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    try {
      await resetPassword(otpEmail, verifiedResetOtp, newPassword);
      clearError();
      setStep('reset-done');
    } catch (_) { /* handled in context */ }
  };

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setStep('form');
    clearError();
  };

  const goToForgot = () => {
    setMode('forgot');
    setStep('form');
    clearError();
    setEmail('');
    setOtp(['', '', '', '', '', '']);
  };

  const goToLogin = () => {
    setMode('login');
    setStep('form');
    clearError();
    setEmail('');
    setPassword('');
    setOtp(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
  };

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // ── Reusable sub-components ───────────────────────────────────────────────

  const renderOtpGrid = (accentClass: string) => (
    <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
      {otp.map((digit, i) => (
        <input
          key={i}
          ref={el => { otpRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleOtpChange(i, e.target.value)}
          onKeyDown={e => handleOtpKeyDown(i, e)}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-gray-50
            outline-none transition-all ${accentClass}`}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );

  const errorBanner = error ? (
    <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-2">
      <span className="font-bold shrink-0">Error:</span>{' '}{error}
    </div>
  ) : null;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up relative">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8">

          {/* ══════════════════════════════════════════
              LOGIN / SIGNUP — form
          ══════════════════════════════════════════ */}
          {(mode === 'login' || mode === 'signup') && step === 'form' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-4">
                  <UserIcon size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-gray-500 text-sm mt-2">
                  {mode === 'login'
                    ? 'Sign in to access your plant collection anywhere.'
                    : 'Join UZHAVAN AI to save your crop analysis history and advice.'}
                </p>
              </div>

              {errorBanner}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-3.5 text-gray-400" size={18} />
                      <input
                        type="text" required value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                        placeholder="Your Name"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                      placeholder="hello@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'} required value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-11 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Forgot password link — login only */}
                {mode === 'login' && (
                  <div className="text-right -mt-1">
                    <button
                      type="button" onClick={goToForgot}
                      className="text-xs text-amber-600 hover:text-amber-700 font-semibold hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit" disabled={isLoading}
                  className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 mt-4"
                >
                  {isLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : <>{mode === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight size={18} /></>
                  }
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button onClick={switchMode} className="text-emerald-600 font-bold hover:underline">
                    {mode === 'login' ? 'Sign up' : 'Log in'}
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              LOGIN / SIGNUP — OTP step (green)
          ══════════════════════════════════════════ */}
          {(mode === 'login' || mode === 'signup') && step === 'otp' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Verify Your Email</h2>
                <p className="text-gray-500 text-sm mt-2">We've sent a 6-digit code to</p>
                <p className="text-emerald-600 font-semibold text-sm mt-1">{otpEmail}</p>
              </div>

              {errorBanner}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {renderOtpGrid("border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:bg-white")}
                <button
                  type="submit" disabled={isLoading || otpCode.length !== 6}
                  className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : <>Verify &amp; Continue<ShieldCheck size={18} /></>
                  }
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Didn't receive the code?{' '}
                  {resendCooldown > 0
                    ? <span className="text-gray-400 font-medium">Resend in {resendCooldown}s</span>
                    : (
                      <button onClick={handleResendOtp} disabled={isLoading}
                        className="text-emerald-600 font-bold hover:underline inline-flex items-center gap-1">
                        <RefreshCw size={14} /> Resend Code
                      </button>
                    )
                  }
                </p>
              </div>

              <div className="mt-3 text-center">
                <button onClick={() => { setStep('form'); clearError(); }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Back
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              FORGOT — Step 1: email entry (amber)
          ══════════════════════════════════════════ */}
          {mode === 'forgot' && step === 'form' && (
            <>
              {/* Amber accent stripe */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-t-3xl" />

              <div className="text-center mb-8 mt-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-4">
                  <KeyRound size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Forgot Password?</h2>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                  Enter your registered email address below. If an account exists, we'll send you a one-time reset code.
                </p>
              </div>

              {errorBanner}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Registered Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="hello@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={isLoading}
                  className="w-full bg-amber-500 text-white font-bold py-3.5 rounded-xl hover:bg-amber-600 transition-all transform active:scale-[0.98] shadow-lg shadow-amber-200 flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : <>Send Reset Code <ArrowRight size={18} /></>
                  }
                </button>
              </form>

              <div className="mt-6 text-center">
                <button onClick={goToLogin}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              FORGOT — Step 2: OTP verify (amber)
              FIX: now calls verifyResetOtp server-side
          ══════════════════════════════════════════ */}
          {mode === 'forgot' && step === 'otp' && (
            <>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-t-3xl" />

              <div className="text-center mb-8 mt-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-4">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Enter Reset Code</h2>
                <p className="text-gray-500 text-sm mt-2">
                  A 6-digit reset code has been sent to
                </p>
                <p className="text-amber-600 font-semibold text-sm mt-1">{otpEmail}</p>
                <p className="text-gray-400 text-xs mt-2">
                  Check your spam folder if you don't see it.
                </p>
              </div>

              {errorBanner}

              <form onSubmit={handleForgotVerifyOtp} className="space-y-6">
                {renderOtpGrid("border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:bg-white")}
                <button
                  type="submit" disabled={isLoading || otpCode.length !== 6}
                  className="w-full bg-amber-500 text-white font-bold py-3.5 rounded-xl hover:bg-amber-600 transition-all transform active:scale-[0.98] shadow-lg shadow-amber-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : <>Verify Code <ShieldCheck size={18} /></>
                  }
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Didn't receive the code?{' '}
                  {resendCooldown > 0
                    ? <span className="text-gray-400 font-medium">Resend in {resendCooldown}s</span>
                    : (
                      <button onClick={handleForgotResend} disabled={isLoading}
                        className="text-amber-600 font-bold hover:underline inline-flex items-center gap-1">
                        <RefreshCw size={14} /> Resend Code
                      </button>
                    )
                  }
                </p>
              </div>

              <div className="mt-3 text-center">
                <button onClick={() => { setStep('form'); clearError(); setOtp(['','','','','','']); }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Try a different email
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              FORGOT — Step 3: new password
          ══════════════════════════════════════════ */}
          {mode === 'forgot' && step === 'new-password' && (
            <>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-t-3xl" />

              <div className="text-center mb-8 mt-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-4">
                  <Lock size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Set New Password</h2>
                <p className="text-gray-500 text-sm mt-2">
                  Create a strong password for{' '}
                  <span className="text-amber-600 font-semibold">{otpEmail}</span>
                </p>
              </div>

              {errorBanner}

              <form onSubmit={handleResetPassword} className="space-y-4">
                {/* New password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      type={showNewPw ? 'text' : 'password'} required minLength={6}
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-11 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="Min. 6 characters"
                    />
                    <button type="button" onClick={() => setShowNewPw(v => !v)}
                      className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                      {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input
                      type={showConfirmPw ? 'text' : 'password'} required
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className={`w-full bg-gray-50 border rounded-xl py-3 pl-11 pr-11 focus:outline-none transition-all
                        ${passwordMismatch
                          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                          : 'border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                        }`}
                      placeholder="Repeat new password"
                    />
                    <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                      className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                      {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordMismatch && (
                    <p className="text-red-500 text-xs ml-1 mt-1">Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || passwordMismatch || newPassword.length < 6}
                  className="w-full bg-amber-500 text-white font-bold py-3.5 rounded-xl hover:bg-amber-600 transition-all transform active:scale-[0.98] shadow-lg shadow-amber-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : <>Reset Password <ArrowRight size={18} /></>
                  }
                </button>
              </form>
            </>
          )}

          {/* ══════════════════════════════════════════
              FORGOT — Step 4: success
          ══════════════════════════════════════════ */}
          {mode === 'forgot' && step === 'reset-done' && (
            <>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-green-400 rounded-t-3xl" />

              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-6">
                  <CheckCircle2 size={44} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Password Reset!</h2>
                <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-xs mx-auto">
                  Your password has been successfully updated. You can now sign in with your new password.
                </p>

                <button
                  onClick={goToLogin}
                  className="mt-8 w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  Sign In Now <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="bg-emerald-50 p-4 text-center border-t border-emerald-100">
          <p className="text-[10px] text-emerald-700 font-medium">
            🔒 Your account and scan history are stored securely in the local MySQL database.
          </p>
        </div>
      </div>
    </div>
  );
};