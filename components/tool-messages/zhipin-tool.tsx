"use client";

import { 
  Users, 
  UserCheck, 
  ListChecks, 
  ClipboardList,
  HandshakeIcon,
  type LucideIcon 
} from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

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
    };
    
    if (toolName === "zhipin_get_candidate_list" && result.data?.candidates) {
      const candidates = result.data.candidates;
      detail = `找到 ${candidates.length} 个候选人`;
      if (result.data.total && result.data.total > candidates.length) {
        detail += ` (共 ${result.data.total} 个)`;
      }
    } else if (toolName === "zhipin_say_hello" && result.data?.summary) {
      const summary = result.data.summary;
      detail = `总计: ${summary.total} 个 · 成功: ${summary.success} 个 · 失败: ${summary.failed} 个`;
    }
  }

  return (
    <BaseToolMessage
      icon={Icon}
      label={label}
      detail={detail}
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
