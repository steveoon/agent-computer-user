"use client";

import { Bot, Server, Cpu, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandSelector } from "@/components/brand-selector";
import { UserNav } from "@/components/user-nav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODEL_DICTIONARY, type ModelId } from "@/lib/config/models";

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
}: ChatHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 py-3 px-4">
      {/* 主标题行 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-600" />
          <h1 className="text-base font-semibold text-slate-800">AI 助手</h1>
        </div>
        <UserNav />
      </div>

      {/* 控制按钮行 */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/40">
        <div className="flex items-center gap-3">
          <BrandSelector showHistory />
          <div className="text-xs text-slate-500 bg-white/70 px-2 py-1 rounded-full font-medium">
            {messagesCount} 条消息
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onSmartClean}
            variant="outline"
            size="sm"
            className="text-xs h-7 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-colors font-medium"
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
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/30">
        <div className="flex items-center gap-4 text-xs text-slate-600">
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
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
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
                  <a
                    href="/agent-config"
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    修改配置
                  </a>
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
        </div>
        <div className="text-xs text-slate-500">
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
