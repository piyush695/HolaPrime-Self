import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const api = axios.create({
  baseURL: '/api/v1/trader',
});

api.interceptors.request.use((config) => {
  const token = useTraderStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Only logout on 401 for protected trader routes, not for public endpoints
    if (err.response?.status === 401) {
      const url = err.config?.url ?? '';
      // Don't auto-logout for payment/checkout calls — show error instead
      const skipLogout = ['/payments-gateway', '/checkout', '/products'].some(p => url.includes(p));
      if (!skipLogout) {
        useTraderStore.getState().logout();
        // Use soft redirect — don't force full page reload
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(err);
  },
);

interface TraderState {
  token:  string | null;
  user:   { id:string; email:string; firstName:string; lastName:string } | null;
  isAuth: boolean;
  login:  (token: string, user: TraderState['user']) => void;
  logout: () => void;
}

export const useTraderStore = create<TraderState>()(
  persist(
    (set) => ({
      token: null, user: null, isAuth: false,
      login:  (token, user) => set({ token, user, isAuth: true }),
      logout: () => set({ token: null, user: null, isAuth: false }),
    }),
    {
      name: 'hp-trader-auth',
      storage: {
        getItem: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
        setItem: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
        removeItem: (key) => { try { localStorage.removeItem(key); } catch {} },
      },
    },
  ),
);
