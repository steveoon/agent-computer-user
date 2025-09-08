"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { useAuthStore } from "@/lib/stores/auth-store";
import { logoutAction } from "@/lib/actions/auth-actions";
import { createClient } from "@/lib/utils/supabase/client";
import { toast } from "sonner";
import { User, LogOut } from "lucide-react";

export function UserNav() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuthStore();

  const handleLogout = async () => {
    try {
      // 使用客户端Supabase进行登出，这样AuthProvider会立即响应
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Client logout error:", error);
        toast.error("登出失败，请稍后重试");
        return;
      }

      // 客户端登出成功后，也调用Server Action确保服务器端清理
      try {
        await logoutAction();
      } catch (serverError) {
        // 服务器端清理失败不影响用户体验，只记录日志
        console.error("Server logout error:", serverError);
      }

      toast.success("已成功登出");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("登出过程中发生错误");
    }
  };

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />;
  }

  if (isAuthenticated && user) {
    // 提取用户邮箱的前缀部分作为显示名称
    const displayName = user.email?.split("@")[0] || user.email || "用户";

    return (
      <div className="flex items-center gap-1">
        {/* 紧凑的用户信息显示 */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/80 border border-slate-200 shadow-sm">
          <User className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-xs font-medium text-slate-700 truncate max-w-20" title={user.email}>
            {displayName}
          </span>
        </div>

        {/* 紧凑的登出按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="p-1.5 h-auto hover:bg-red-50 text-slate-500 hover:text-red-600"
          title="登出"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setAuthDialogOpen(true)}
        variant="outline"
        size="sm"
        className="h-7 px-3 text-xs font-medium bg-white/80 border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 transition-colors"
      >
        登录
      </Button>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
