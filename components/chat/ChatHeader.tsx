"use client";

import { Settings2, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandSelector } from "@/components/brand-selector";
import { UserNav } from "@/components/user-nav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODEL_DICTIONARY, type ModelId } from "@/lib/config/models";
import { NavLink } from "@/components/ui/nav-link";
import Image from "next/image";
import { useTheme } from "next-themes";

interface ChatHeaderProps {
  currentBrand?: string;
  messagesCount: number;
  sandboxStatus: "running" | "paused" | "unknown";
  isLoading: boolean;
  chatModel: ModelId;
  classifyModel: ModelId;
  replyModel: ModelId;
  envInfo: {
    environment: string;
    description: string;
  };
  onSmartClean: () => void;
  onClear: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktop?: () => void;
}

export function ChatHeader({
  messagesCount,
  sandboxStatus,
  isLoading,
  chatModel,
  classifyModel,
  replyModel,
  envInfo,
  onSmartClean,
  onClear,
  isDesktopCollapsed,
  onToggleDesktop,
}: ChatHeaderProps) {
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/dark_1x-removebg.png" : "/light_1x-removebg.png";

  return (
    <div
      className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-white/20 py-2 px-4 flex flex-col gap-2 relative z-50 transition-all duration-300 ${
        isLoading ? "shadow-none border-b-0" : "shadow-sm"
      }`}
    >
      {/* 顶部栏：Logo、用户、主操作 */}
      <div className="flex justify-between items-center h-9">
        {/* 左侧：Logo & 侧边栏开关 */}
        <div className="flex items-center gap-3">
          {onToggleDesktop && (
            <Button
              onClick={onToggleDesktop}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-full"
              title={isDesktopCollapsed ? "展开沙盒面板" : "折叠沙盒面板"}
            >
              {isDesktopCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              ) : (
                <PanelLeftClose className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )}
            </Button>
          )}

          <div className="relative h-6 w-32 flex-shrink-0">
            <Image
              src={logoSrc}
              alt="花卷智能助手"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </div>

        {/* 右侧：用户导航 */}
        <UserNav />
      </div>

      {/* 工具栏：品牌、状态、操作 */}
      <div className="flex items-center justify-between pt-1">
        {/* 左侧：品牌选择 & 消息计数 */}
        <div className="flex items-center gap-3">
          <BrandSelector showHistory />
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1 opacity-50"></div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {messagesCount} 条消息
          </div>
        </div>

        {/* 右侧：状态指示 & 操作按钮 */}
        <div className="flex items-center gap-3">
          {/* 状态指示器 (紧凑版) */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-800/40 px-2 py-1 rounded-full border border-white/20 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-1.5" title={`沙盒状态: ${sandboxStatus}`}>
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  sandboxStatus === "running"
                    ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]"
                    : sandboxStatus === "paused"
                      ? "bg-yellow-500"
                      : "bg-gray-400"
                }`}
              ></div>
              <span className="font-medium hidden sm:inline">
                {sandboxStatus === "running"
                  ? "运行中"
                  : sandboxStatus === "paused"
                    ? "暂停"
                    : "未知"}
              </span>
            </div>

            <div className="w-px h-2.5 bg-slate-300 dark:bg-slate-600 opacity-50"></div>

            <div className="flex items-center gap-1.5" title={`当前环境: ${envInfo.environment}`}>
              <div className="w-1.5 h-1.5 bg-brand-primary rounded-full"></div>
              <span className="font-medium capitalize hidden sm:inline">{envInfo.environment}</span>
            </div>
          </div>

          {/* 操作按钮组 */}
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-white/50 rounded-full transition-colors"
                  title="模型配置"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">当前模型配置</h3>
                    <NavLink
                      href="/agent-config"
                      className="text-xs text-brand-primary hover:text-brand-dark underline"
                    >
                      修改配置
                    </NavLink>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">主聊天模型</div>
                      <div className="font-medium text-sm">
                        {MODEL_DICTIONARY[chatModel]?.name || chatModel}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">消息分类模型</div>
                      <div className="font-medium text-sm">
                        {MODEL_DICTIONARY[classifyModel]?.name || classifyModel}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">智能回复模型</div>
                      <div className="font-medium text-sm">
                        {MODEL_DICTIONARY[replyModel]?.name || replyModel}
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <NavLink href="/admin/settings">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-white/50 rounded-full transition-colors"
                title="系统设置"
              >
                <Settings className="w-3.5 h-3.5 text-slate-600" />
              </Button>
            </NavLink>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1 opacity-50"></div>

            <Button
              onClick={onSmartClean}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-brand-primary hover:bg-brand-primary/10 hover:text-brand-dark font-medium rounded-md transition-colors"
              disabled={isLoading || messagesCount <= 2}
              title="智能清理"
            >
              智能清理
            </Button>

            <Button
              onClick={onClear}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 font-medium rounded-md transition-colors"
              disabled={isLoading}
              title="清空会话"
            >
              清空
            </Button>
          </div>
        </div>
      </div>

      {/* 加载状态指示 (绝对定位在顶部) */}
      {
        /* 动态加载条 - 带泛光效果 */
        isLoading && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-[length:200%_100%] animate-gradient-flow shadow-[0_0_15px_rgba(168,85,247,0.6)]" />
        )
      }
    </div>
  );
}
