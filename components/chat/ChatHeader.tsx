"use client";

import { Server, Cpu, Settings2, Loader2, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  currentBrand,
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
    <div className="bg-gradient-to-r from-slate-50 to-brand-light/20 dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 py-3 px-4">
      {/* 主标题行 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* 沙盒折叠按钮 */}
          {onToggleDesktop && (
            <Button
              onClick={onToggleDesktop}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-white/50 dark:hover:bg-slate-800/50"
              title={isDesktopCollapsed ? "展开沙盒面板" : "折叠沙盒面板"}
            >
              {isDesktopCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              ) : (
                <PanelLeftClose className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )}
            </Button>
          )}
          <div className="relative h-7 w-36 flex-shrink-0">
            <Image
              src={logoSrc}
              alt="花卷智能助手"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </div>
        <UserNav />
      </div>

      {/* 控制按钮行 */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/40 dark:border-slate-700/40">
        <div className="flex items-center gap-3">
          <BrandSelector showHistory />
          <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 px-2 py-1 rounded-full font-medium">
            {messagesCount} 条消息
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onSmartClean}
            variant="outline"
            size="sm"
            className="text-xs h-7 px-3 text-brand-primary border-brand-primary/30 hover:bg-brand-primary/10 hover:border-brand-primary transition-colors font-medium"
            disabled={isLoading || messagesCount <= 2}
            title="保留最近一半消息，清理其余历史"
          >
            智能清理
          </Button>
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="text-xs h-7 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors font-medium"
            disabled={isLoading}
          >
            清空
          </Button>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/30 dark:border-slate-700/30">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                sandboxStatus === "running"
                  ? "bg-green-500"
                  : sandboxStatus === "paused"
                    ? "bg-yellow-500"
                    : "bg-gray-400"
              }`}
            ></div>
            <span className="font-medium">
              {sandboxStatus === "running"
                ? "运行中"
                : sandboxStatus === "paused"
                  ? "已暂停"
                  : "未知"}
            </span>
          </div>
          {currentBrand && (
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3" />
              <span className="font-medium">{currentBrand}</span>
            </div>
          )}
          {/* 环境信息显示 */}
          <div className="flex items-center gap-1.5" title={envInfo.description}>
            <div className="w-2 h-2 bg-brand-primary rounded-full"></div>
            <span className="font-medium capitalize">{envInfo.environment}</span>
          </div>
          {/* 模型配置显示 */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 hover:bg-white/50 px-2 py-1 rounded-md transition-colors">
                <Settings2 className="w-3 h-3" />
                <span className="font-medium">模型配置</span>
              </button>
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
                    <div className="text-xs text-slate-500">{chatModel}</div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-600 mb-1">消息分类模型</div>
                    <div className="font-medium text-sm">
                      {MODEL_DICTIONARY[classifyModel]?.name || classifyModel}
                    </div>
                    <div className="text-xs text-slate-500">{classifyModel}</div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-600 mb-1">智能回复模型</div>
                    <div className="font-medium text-sm">
                      {MODEL_DICTIONARY[replyModel]?.name || replyModel}
                    </div>
                    <div className="text-xs text-slate-500">{replyModel}</div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {/* 配置页面入口 */}
          <NavLink
            href="/admin/settings"
            className="flex items-center gap-1.5 hover:bg-white/50 px-2 py-1 rounded-md transition-colors"
          >
            <Settings className="w-3 h-3" />
            <span className="font-medium">配置</span>
          </NavLink>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {isLoading && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="font-medium">思考中...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
