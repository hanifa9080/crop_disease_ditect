import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface RegisterResult {
  status: 'pending' | 'ok';
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isCheckingSession: boolean;
  login: (email: string, password: string) => Promise<RegisterResult>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyResetOtp: (email: string, otp: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On app load — check if the HTTP-only cookie session is still valid
  // by hitting /auth/me. The browser sends the cookie automatically.
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => setUser(u ? {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar_url,
        joinedAt: u.joined_at,
      } : null))
      .catch(() => setUser(null))
      .finally(() => setIsCheckingSession(false));
  }, []);

  const login = async (email: string, password: string): Promise<RegisterResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',          // sends + receives the cookie
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Login failed');
      }
      const data = await r.json();
      return data as RegisterResult;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<RegisterResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Registration failed');
      }
      const data = await r.json();
      // Register now returns { status: "pending", email } — user must verify OTP
      return data as RegisterResult;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Verification failed');
      }
      const u = await r.json();
      setUser({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, joinedAt: u.joinedAt });
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '' }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Could not resend OTP');
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Tell the backend to clear the cookie, then wipe local state
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Could not send reset code');
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyResetOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Invalid or expired reset code');
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Password reset failed');
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading, isCheckingSession, login, register, verifyOtp, resendOtp,
      forgotPassword, verifyResetOtp, resetPassword,
      logout, error, clearError: () => setError(null)
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};