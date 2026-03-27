import axios, { type AxiosError } from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Axios client ──────────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as typeof err.config & { _retry?: boolean };
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          '/api/v1/auth/refresh',
          { refreshToken },
        );
        useAuthStore.getState().setTokens(data.accessToken, refreshToken);
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${data.accessToken}`,
        };
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

// ── Auth store (persisted) ────────────────────────────────────────────────────
interface AdminUser {
  id:         string;
  email:      string;
  firstName:  string;
  lastName:   string;
  role:       string;
}

interface AuthState {
  admin:        AdminUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isAuth:       boolean;
  login:        (admin: AdminUser, access: string, refresh: string) => void;
  setTokens:    (access: string, refresh: string) => void;
  logout:       () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin:        null,
      accessToken:  null,
      refreshToken: null,
      isAuth:       false,
      login:  (admin, accessToken, refreshToken) =>
        set({ admin, accessToken, refreshToken, isAuth: true }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: () =>
        set({ admin: null, accessToken: null, refreshToken: null, isAuth: false }),
    }),
    {
      name: 'hp-admin-auth-v2',   // bumped version clears all old stale sessions
      storage: {
        getItem: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
        setItem: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
        removeItem: (key) => { try { localStorage.removeItem(key); } catch {} },
      },
    },
  ),
);
