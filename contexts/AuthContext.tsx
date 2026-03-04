import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isCheckingSession: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
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
      const u = await r.json();
      setUser({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, joinedAt: u.joinedAt });
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
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
      const u = await r.json();
      setUser({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, joinedAt: u.joinedAt });
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

  return (
    <AuthContext.Provider value={{
      user, isLoading, isCheckingSession, login, register, logout,
      error, clearError: () => setError(null)
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