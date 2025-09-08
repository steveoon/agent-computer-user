"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/utils/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cleanupSensitiveStorage } from "@/lib/utils/cleanup-storage";
import type { ReactNode } from "react";

interface AuthProviderProps {
  readonly children: ReactNode;
}

/**
 * 认证状态同步Provider
 * 监听Supabase用户状态变化并同步到zustand store
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    // 🧹 首先清理localStorage中的敏感数据
    cleanupSensitiveStorage();

    // 获取初始用户状态
    const getInitialUser = async () => {
      setLoading(true);
      try {
        // 先尝试获取session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        console.log("[AUTH PROVIDER] Initial session check:", {
          hasSession: !!session,
          sessionError: sessionError?.message,
        });

        // 然后获取用户信息
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        console.log("[AUTH PROVIDER] Initial user check:", {
          hasUser: !!user,
          userEmail: user?.email,
          userError: userError?.message,
        });

        if (userError || !user) {
          console.log("[AUTH PROVIDER] No user found or error occurred");
          setUser(null);
        } else {
          console.log("[AUTH PROVIDER] Setting user:", user.email);
          setUser(user);
        }
      } catch (error) {
        console.error("[AUTH PROVIDER] Error in getInitialUser:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // 立即获取用户状态
    getInitialUser();

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AUTH PROVIDER] Auth state changed:", {
        event,
        hasSession: !!session,
        userEmail: session?.user?.email,
      });

      switch (event) {
        case "INITIAL_SESSION":
          // 初始session已经在getInitialUser中处理
          break;
        case "SIGNED_IN":
          if (session?.user) {
            console.log("[AUTH PROVIDER] User signed in:", session.user.email);
            setUser(session.user);
          }
          break;
        case "SIGNED_OUT":
          console.log("[AUTH PROVIDER] User signed out");
          setUser(null);
          break;
        case "TOKEN_REFRESHED":
          if (session?.user) {
            console.log("[AUTH PROVIDER] Token refreshed for:", session.user.email);
            setUser(session.user);
          }
          break;
        case "USER_UPDATED":
          if (session?.user) {
            console.log("[AUTH PROVIDER] User updated:", session.user.email);
            setUser(session.user);
          }
          break;
        default:
          console.log("[AUTH PROVIDER] Unhandled event:", event);
          break;
      }
    });

    // 清理订阅
    return () => {
      console.log("[AUTH PROVIDER] Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
