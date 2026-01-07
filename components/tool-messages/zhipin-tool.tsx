"use client";

import {
  Users,
  UserCheck,
  ListChecks,
  ClipboardList,
  HandshakeIcon,
  type LucideIcon,
} from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

// MCP 后端类型
type MCPBackend = "puppeteer" | "playwright";

// MCP 后端标签配置
const MCP_BACKEND_STYLES: Record<MCPBackend, { label: string; className: string }> = {
  puppeteer: {
    label: "Puppeteer",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  playwright: {
    label: "Playwright",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};

// 定义各个工具的图标映射
const toolIcons: Record<string, LucideIcon> = {
  zhipin_get_unread_candidates_improved: ListChecks,
  zhipin_open_candidate_chat_improved: UserCheck,
  zhipin_get_candidate_list: ClipboardList,
  zhipin_say_hello: HandshakeIcon,
};

// 定义各个工具的标签映射
const toolLabels: Record<string, string> = {
  zhipin_get_unread_candidates_improved: "获取未读候选人(改进版)",
  zhipin_open_candidate_chat_improved: "打开候选人聊天(改进版)",
  zhipin_get_candidate_list: "获取候选人列表",
  zhipin_say_hello: "批量打招呼",
};

export function ZhipinToolMessage(props: ToolMessageProps) {
  const { toolName, input, state, output, isLatestMessage, status, messageId, partIndex } = props;

  const Icon = toolIcons[toolName] || Users;
  const label = toolLabels[toolName] || toolName;

  // 根据不同的工具生成详细信息
  let detail = "";

  if (toolName.includes("get_unread_candidates")) {
    const max = input.max as number | undefined;
    const onlyUnread = input.onlyUnread as boolean | undefined;
    const sortBy = input.sortBy as string | undefined;

    const details: string[] = [];
    if (max) details.push(`最多${max}个`);
    if (onlyUnread) details.push("仅未读");
    if (sortBy) details.push(`按${sortBy}排序`);
    detail = details.join(" · ");
  } else if (toolName.includes("open_candidate_chat")) {
    const candidateName = input.candidateName as string | undefined;
    const index = input.index as number | undefined;
    const listOnly = input.listOnly as boolean | undefined;

    if (candidateName) {
      detail = `候选人: ${candidateName}`;
    } else if (index !== undefined) {
      detail = `第${index + 1}个候选人`;
    }
    if (listOnly) {
      detail = detail ? `${detail} (仅列出)` : "仅列出";
    }
  } else if (toolName === "zhipin_get_candidate_list") {
    const maxResults = input.maxResults as number | undefined;
    const includeNoGreetButton = input.includeNoGreetButton as boolean | undefined;

    const details: string[] = [];
    if (maxResults) details.push(`最多${maxResults}个`);
    if (includeNoGreetButton) details.push("包含已联系");
    detail = details.length > 0 ? details.join(" · ") : "获取所有候选人";
  } else if (toolName === "zhipin_say_hello") {
    const candidateIndices = input.candidateIndices as number[] | undefined;
    const scrollBehavior = input.scrollBehavior as boolean | undefined;

    const details: string[] = [];
    if (candidateIndices?.length) {
      details.push(`${candidateIndices.length}个候选人`);
    }
    if (scrollBehavior === false) details.push("禁用滚动");
    detail = details.join(" · ");
  }

  // 提取 MCP 后端信息
  let mcpBackend: MCPBackend | undefined;

  // 对于输出，更新detail以包含结果信息
  if (state === "output-available" && output) {
    const result = output as {
      data?: {
        candidates?: unknown[];
        total?: number;
        summary?: {
          total: number;
          success: number;
          failed: number;
        };
      };
      // MCP 后端标识
      mcpBackend?: MCPBackend;
      // 直接在顶层的字段（get_unread_candidates_improved 的返回格式）
      candidates?: unknown[];
      count?: number;
      stats?: {
        total: number;
        withName: number;
        withUnread: number;
        returned: number;
      };
    };

    // 提取 mcpBackend
    mcpBackend = result.mcpBackend;

    if (toolName === "zhipin_get_candidate_list" && result.data?.candidates) {
      const candidates = result.data.candidates;
      detail = `找到 ${candidates.length} 个候选人`;
      if (result.data.total && result.data.total > candidates.length) {
        detail += ` (共 ${result.data.total} 个)`;
      }
    } else if (toolName === "zhipin_say_hello" && result.data?.summary) {
      const summary = result.data.summary;
      detail = `总计: ${summary.total} 个 · 成功: ${summary.success} 个 · 失败: ${summary.failed} 个`;
    } else if (toolName === "zhipin_get_unread_candidates_improved" && result.stats) {
      // 显示 get_unread_candidates_improved 的统计信息
      detail = `返回 ${result.count} 个 · 总计 ${result.stats.total} · 未读 ${result.stats.withUnread}`;
    }
  }

  // 生成 MCP 后端徽章
  const backendBadge = mcpBackend && MCP_BACKEND_STYLES[mcpBackend] ? (
    <span
      className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded ${MCP_BACKEND_STYLES[mcpBackend].className}`}
    >
      {MCP_BACKEND_STYLES[mcpBackend].label}
    </span>
  ) : null;

  // 组合 detail 和后端徽章
  const detailWithBadge = (
    <>
      {detail}
      {backendBadge}
    </>
  );

  return (
    <BaseToolMessage
      icon={Icon}
      label={label}
      detail={detailWithBadge}
      theme={themes.blue}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
