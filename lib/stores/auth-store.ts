import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import { createSecureStorage } from "@/lib/utils/secure-storage";

interface AuthState {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly error: string | null;
}

interface AuthActions {
  readonly setUser: (user: User | null) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly clearError: () => void;
  readonly logout: () => void;
}

type AuthStore = AuthState & AuthActions;

// 🔒 创建安全的IndexedDB存储
const secureStorage = createSecureStorage("auth-store");

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      // State
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      // Actions
      setUser: user =>
        set(state => ({
          ...state,
          user,
          isAuthenticated: !!user,
          error: null,
        })),

      setLoading: loading =>
        set(state => ({
          ...state,
          isLoading: loading,
        })),

      setError: error =>
        set(state => ({
          ...state,
          error,
          isLoading: false,
        })),

      clearError: () =>
        set(state => ({
          ...state,
          error: null,
        })),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => secureStorage),
      partialize: state => ({
        // 🎯 只存储必要的认证状态
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // 🔄 状态恢复处理
      onRehydrateStorage: () => {
        return async (_state, error) => {
          if (error) {
            console.error("[AUTH STORE] 恢复状态时出错:", error);
          }
        };
      },
    }
  )
);
