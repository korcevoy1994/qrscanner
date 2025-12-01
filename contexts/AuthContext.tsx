'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, AuthState } from '@/types/user';

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    const checkAuth = () => {
      try {
        const userCookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith('scanner_user='));

        if (userCookie) {
          const userJson = decodeURIComponent(userCookie.split('=')[1]);
          const user = JSON.parse(userJson) as Omit<User, 'id'>;
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkAuth();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем локальное состояние
      localStorage.removeItem('scanner_user');
      localStorage.removeItem('scanner_token');

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
