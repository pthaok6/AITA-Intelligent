import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

export interface User { id: string; email: string; fullName: string; role: 'ADMIN' | 'LECTURER' | 'STUDENT'; avatarUrl?: string | null }
interface AuthContextType {
  user: User | null; token: string | null; loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<boolean>;
  updateUser: (updated: Partial<User>) => void;
  isAuthenticated: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    localStorage.removeItem('aita_token');
    localStorage.removeItem('aita_user');
    let active = true;
    const expired = () => { setUser(null); setToken(null); };
    const refreshed = (event: Event) => {
      const data = (event as CustomEvent).detail;
      setUser(data.user); setToken(data.token);
    };
    window.addEventListener('aita-session-expired', expired);
    window.addEventListener('aita-session-refreshed', refreshed);

    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, 2500);

    void apiRequest<User>('/auth/me')
      .then(result => {
        if (active) {
          setUser(result.success ? result.data || null : null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setLoading(false);
        }
      })
      .finally(() => {
        clearTimeout(safetyTimer);
      });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      window.removeEventListener('aita-session-expired', expired);
      window.removeEventListener('aita-session-refreshed', refreshed);
    };
  }, []);
  const login = useCallback((newToken: string, newUser: User) => { setToken(newToken); setUser(newUser); }, []);
  const updateUser = useCallback((updated: Partial<User>) => { setUser(prev => prev ? { ...prev, ...updated } : null); }, []);
  const logout = async () => {
    const result = await apiRequest('/auth/logout', { method: 'POST' });
    if (!result.success) return false;
    setUser(null); setToken(null);
    return true;
  };
  return <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, isAuthenticated: !!user }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
