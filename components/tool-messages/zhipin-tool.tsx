"use client";

import { Users, UserCheck, ListChecks, type LucideIcon } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

// 定义各个工具的图标映射
const toolIcons: Record<string, LucideIcon> = {
  zhipin_get_unread_candidates_improved: ListChecks,
  zhipin_open_candidate_chat_improved: UserCheck,
};

// 定义各个工具的标签映射
const toolLabels: Record<string, string> = {
  zhipin_get_unread_candidates_improved: "获取未读候选人(改进版)",
  zhipin_open_candidate_chat_improved: "打开候选人聊天(改进版)",
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
