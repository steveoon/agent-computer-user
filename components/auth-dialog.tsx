"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signUpAction } from "@/lib/actions/auth-actions";
import { createClient } from "@/lib/utils/supabase/client";
import { toast } from "sonner";

interface AuthDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

type AuthMode = "login" | "register";

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [isPending, startTransition] = useTransition();
  const { setError, clearError } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        if (mode === "login") {
          // 使用客户端 Supabase 进行登录，确保 onAuthStateChange 能立即触发
          const supabase = createClient();

          const { data, error } = await supabase.auth.signInWithPassword({
            email: formData.get("email") as string,
            password: formData.get("password") as string,
          });

          if (error) {
            console.error("Client login error:", error);
            setError(error.message || "登录失败");
            toast.error(error.message || "登录失败");
            return;
          }

          if (!data.user) {
            setError("登录失败，未获取到用户信息");
            toast.error("登录失败，未获取到用户信息");
            return;
          }

          toast.success("登录成功！");
          onOpenChange(false);

          // 登录成功后 AuthProvider 会监听 SIGNED_IN 事件并更新 Zustand Store
          // 刷新路由以确保服务器端中间件能读取到新的 session cookie
          // 这解决了登录后立即跳转到受保护路由时中间件认证失败的问题
          router.refresh();
        } else {
          // 使用 Server Action 进行注册（含验证逻辑）
          const result = await signUpAction(formData);

          if (result.success) {
            toast.success("注册成功！请检查邮箱进行验证。");
            setMode("login"); // 注册成功后切换到登录模式
          } else {
            setError(result.error || "注册失败");
            toast.error(result.error || "注册失败");
          }
        }
      } catch (error) {
        console.error("Auth error:", error);
        setError("操作过程中发生错误");
        toast.error("操作过程中发生错误");
      }
    });
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    clearError();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "登录账户" : "注册账户"}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? "请输入您的邮箱和密码进行登录" : "创建新账户以开始使用服务"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="请输入邮箱地址"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="请输入密码"
              required
              disabled={isPending}
              minLength={6}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                required
                disabled={isPending}
                minLength={6}
              />
            </div>
          )}

          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending
                ? mode === "login"
                  ? "登录中..."
                  : "注册中..."
                : mode === "login"
                  ? "登录"
                  : "注册"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={toggleMode}
              disabled={isPending}
            >
              {mode === "login" ? "没有账户？点击注册" : "已有账户？点击登录"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
