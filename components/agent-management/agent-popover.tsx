"use client";

import { useEffect, useState, useRef } from "react";
import {
  Bot,
  Play,
  Square,
  ExternalLink,
  Trash2,
  Settings,
  RefreshCw,
  Plus,
  Eraser,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAgentStore, selectRunningAgentCount } from "@/lib/stores/agent-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { AgentStatusBadge } from "./agent-status-badge";
import { AgentAddDialog } from "./agent-add-dialog";
import { cn } from "@/lib/utils";
import type { AgentInfo } from "@/types/agent";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Agent 快捷管理面板
 * 显示在 ChatHeader 中的 Popover
 */
// localStorage key for macOS permission hint dismissal
const MACOS_HINT_DISMISSED_KEY = "agent-macos-permission-hint-dismissed";

export function AgentPopover() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMacOS, setIsMacOS] = useState(false);
  const [showMacOSHint, setShowMacOSHint] = useState(false);
  const {
    agents,
    loading,
    error,
    isElectron,
    initialize,
    startAgent,
    stopAgent,
    openAgentUI,
    removeAgent,
    cleanupAgent,
    loadAgents,
    clearError,
  } = useAgentStore();

  const runningCount = useAgentStore(selectRunningAgentCount);
  const { isAuthenticated } = useAuthStore();

  // 使用 ref 跟踪清理函数，解决 async 竞态问题
  const cleanupRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // 检测 macOS 平台并判断是否显示提示
  useEffect(() => {
    let isMounted = true;

    if (typeof window !== "undefined" && window.electronApi?.system) {
      window.electronApi.system
        .getPlatform()
        .then((info) => {
          // 避免组件卸载后 setState
          if (!isMounted) return;

          const isMac = info.platform === "darwin";
          setIsMacOS(isMac);
          // 只在 macOS 上显示提示，且用户未关闭过
          if (isMac) {
            const dismissed = localStorage.getItem(MACOS_HINT_DISMISSED_KEY);
            setShowMacOSHint(!dismissed);
          }
        })
        .catch(() => {
          // IPC 失败时静默处理，不影响主功能
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // 初始化并订阅事件，组件卸载时清理
  useEffect(() => {
    isMountedRef.current = true;

    const setup = async () => {
      const cleanup = await initialize();
      // 如果在初始化完成前已卸载，立即调用清理
      if (!isMountedRef.current) {
        cleanup();
      } else {
        cleanupRef.current = cleanup;
      }
    };
    setup();

    return () => {
      isMountedRef.current = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [initialize]);

  // 关闭 macOS 权限提示
  const dismissMacOSHint = () => {
    setShowMacOSHint(false);
    localStorage.setItem(MACOS_HINT_DISMISSED_KEY, "true");
  };

  // 不在 Electron 环境中不渲染
  if (!isElectron) {
    return null;
  }

  // 认证检查辅助函数
  const requireAuth = (): boolean => {
    if (!isAuthenticated) {
      toast.error("请先登录", {
        description: "您需要登录后才能启动 Agent",
        richColors: true,
        position: "top-center",
      });
      return false;
    }
    return true;
  };

  const handleStartAll = async () => {
    if (!requireAuth()) return;
    // 批量启动不自动打开 UI
    await startAgent(undefined, false);
  };

  const handleStartAgent = async (agentId: string) => {
    if (!requireAuth()) return;
    await startAgent(agentId);
  };

  const handleStopAll = async () => {
    await stopAgent();
  };

  const handleOpenSettings = () => {
    router.push("/admin/settings?tab=agents");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 w-7 p-0 relative rounded-full transition-colors",
                  "hover:bg-white/50 dark:hover:bg-slate-800/50",
                  // 打开时显示选中底色
                  isOpen && "bg-white/60 dark:bg-slate-800/60 shadow-sm",
                  // 运行中时图标变绿
                  runningCount > 0 && "text-green-600 dark:text-green-400"
                )}
              >
                <Bot className={cn(
                  "h-3.5 w-3.5",
                  runningCount > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-slate-600 dark:text-slate-400"
                )} />
                {/* 运行中数量指示 */}
                {runningCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 text-[8px] text-white flex items-center justify-center font-medium shadow-sm">
                    {runningCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Agent 管理
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        className="w-72 p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Agent 管理
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
              {runningCount}/{agents.length}
            </span>
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  onClick={() => loadAgents()}
                  disabled={loading}
                >
                  <RefreshCw
                    className={cn(
                      "h-3 w-3 text-slate-400",
                      loading && "animate-spin"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                刷新
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800/30">
            <p className="text-[11px] text-red-600 dark:text-red-400 leading-relaxed">
              {error}
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px] text-red-500 hover:text-red-700"
              onClick={clearError}
            >
              关闭
            </Button>
          </div>
        )}

        {/* macOS 权限提示 */}
        {isMacOS && showMacOSHint && (
          <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  首次启动 Agent 时，macOS 会要求授权「App 管理」权限。
                  请在弹出的系统设置窗口中开启本应用的开关。
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-amber-100 dark:hover:bg-amber-800/30 rounded flex-shrink-0"
                onClick={dismissMacOSHint}
              >
                <X className="h-3 w-3 text-amber-500" />
              </Button>
            </div>
          </div>
        )}

        {/* Agent 列表 */}
        <div className="max-h-[240px] overflow-y-auto">
          {agents.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <Bot className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                暂无 Agent
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                点击下方添加
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {agents.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  onStart={() => handleStartAgent(agent.id)}
                  onStop={() => stopAgent(agent.id)}
                  onOpenUI={() => openAgentUI(agent.id)}
                  onRemove={() => removeAgent(agent.id)}
                  onCleanup={() => cleanupAgent(agent.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center justify-between">
            {/* 批量操作 */}
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartAll}
                disabled={loading || agents.length === 0 || runningCount === agents.length}
                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Play className="h-3 w-3" />
                全部启动
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopAll}
                disabled={loading || runningCount === 0}
                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Square className="h-3 w-3" />
                全部停止
              </Button>
            </div>

            {/* 添加和设置 */}
            <div className="flex gap-1">
              <AgentAddDialog
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-brand-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={handleOpenSettings}
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Agent 设置
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ========== 子组件 ==========

interface AgentListItemProps {
  agent: AgentInfo;
  onStart: () => void;
  onStop: () => void;
  onOpenUI: () => void;
  onRemove: () => void;
  onCleanup: () => void;
}

function AgentListItem({
  agent,
  onStart,
  onStop,
  onOpenUI,
  onRemove,
  onCleanup,
}: AgentListItemProps) {
  const isRunning = agent.status === "running";
  const isPending = agent.status === "starting" || agent.status === "stopping";
  const isStopped = agent.status === "stopped" || agent.status === "error";

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
      {/* 左侧信息 */}
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
            {agent.name}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
            :{agent.appPort}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <AgentStatusBadge status={agent.status} size="sm" showLabel={false} />
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            {agent.id}
          </span>
        </div>
      </div>

      {/* 右侧操作 */}
      <div className="flex items-center gap-0.5">
        <TooltipProvider delayDuration={300}>
          {/* 启动/停止按钮 */}
          {isRunning ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  onClick={onStop}
                  disabled={isPending}
                >
                  <Square className="h-3 w-3 text-slate-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                停止
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  onClick={onStart}
                  disabled={isPending}
                >
                  <Play className="h-3 w-3 text-slate-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                启动
              </TooltipContent>
            </Tooltip>
          )}

          {/* 清理端口按钮 - 仅在停止状态显示 */}
          {isStopped && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded group"
                  onClick={onCleanup}
                  disabled={isPending}
                >
                  <Eraser className="h-3 w-3 text-slate-400 group-hover:text-amber-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                清理端口
              </TooltipContent>
            </Tooltip>
          )}

          {/* 打开 UI 按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                onClick={onOpenUI}
                disabled={!isRunning}
              >
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              打开界面
            </TooltipContent>
          </Tooltip>

          {/* 删除按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-red-50 dark:hover:bg-red-900/20 rounded group"
                onClick={onRemove}
                disabled={isRunning || isPending}
              >
                <Trash2 className="h-3 w-3 text-slate-400 group-hover:text-red-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              删除
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
