"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/utils/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";

export function DebugAuth() {
  const [clientStatus, setClientStatus] = useState<Record<string, unknown> | null>(null);
  const authStore = useAuthStore();

  useEffect(() => {
    const checkClientStatus = async () => {
      try {
        const supabase = createClient();

        // 检查session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        // 检查用户
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        setClientStatus({
          session: session
            ? {
                access_token: session.access_token ? "exists" : "missing",
                user_email: session.user?.email,
              }
            : null,
          user: user
            ? {
                id: user.id,
                email: user.email,
              }
            : null,
          sessionError: sessionError?.message,
          userError: userError?.message,
          timestamp: new Date().toISOString(),
        });

        console.log("[DEBUG AUTH] Client status:", {
          hasSession: !!session,
          hasUser: !!user,
          userEmail: user?.email,
          sessionError: sessionError?.message,
          userError: userError?.message,
        });
      } catch (error) {
        console.error("[DEBUG AUTH] Error:", error);
        setClientStatus({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    checkClientStatus();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-md z-50">
      <div className="mb-2 font-bold">🔍 Auth Debug Info</div>

      <div className="mb-2">
        <div className="font-semibold">Zustand Store:</div>
        <div>isAuthenticated: {authStore.isAuthenticated.toString()}</div>
        <div>isLoading: {authStore.isLoading.toString()}</div>
        <div>user: {authStore.user?.email || "null"}</div>
        <div>error: {authStore.error || "null"}</div>
      </div>

      <div className="mb-2">
        <div className="font-semibold">Client Status:</div>
        <pre className="text-xs overflow-auto max-h-32">
          {JSON.stringify(clientStatus, null, 2)}
        </pre>
      </div>
    </div>
  );
}
