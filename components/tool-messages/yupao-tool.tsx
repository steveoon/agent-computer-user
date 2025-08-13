"use client";

import { 
  Users, 
  UserCheck, 
  ListChecks, 
  MessageSquare,
  Smartphone,
  ScrollText,
  ClipboardList,
  HandshakeIcon,
  type LucideIcon 
} from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

// 定义各个工具的图标映射
const toolIcons: Record<string, LucideIcon> = {
  yupao_get_unread_messages: ListChecks,
  yupao_open_candidate_chat: UserCheck,
  yupao_get_chat_details: ScrollText,
  yupao_send_message: MessageSquare,
  yupao_exchange_wechat: Smartphone,
  yupao_get_username: UserCheck,
  yupao_get_candidate_list: ClipboardList,
  yupao_say_hello: HandshakeIcon,
};

// 定义各个工具的标签映射
const toolLabels: Record<string, string> = {
  yupao_get_unread_messages: "获取未读消息",
  yupao_open_candidate_chat: "打开候选人聊天",
  yupao_get_chat_details: "获取聊天详情",
  yupao_send_message: "发送消息",
  yupao_exchange_wechat: "交换微信",
  yupao_get_username: "获取用户名",
  yupao_get_candidate_list: "获取候选人列表",
  yupao_say_hello: "批量打招呼",
};

export function YupaoToolMessage(props: ToolMessageProps) {
  const { toolName, input, state, output, isLatestMessage, status, messageId, partIndex } = props;

  const Icon = toolIcons[toolName] || Users;
  const label = toolLabels[toolName] || toolName;

  // 根据不同的工具生成详细信息
  let detail = "";

  if (toolName === "yupao_get_unread_messages") {
    const max = input.max as number | undefined;
    const skipFirstMessage = input.skipFirstMessage as boolean | undefined;
    
    const details: string[] = [];
    if (max) details.push(`最多${max}条`);
    if (skipFirstMessage) details.push("跳过第一条");
    detail = details.join(" · ");
  } else if (toolName === "yupao_open_candidate_chat") {
    const candidateName = input.candidateName as string | undefined;
    const candidateInfo = input.candidateInfo as string | undefined;
    
    if (candidateName) {
      detail = `候选人: ${candidateName}`;
    } else if (candidateInfo) {
      detail = `信息: ${candidateInfo.slice(0, 20)}...`;
    }
  } else if (toolName === "yupao_get_chat_details") {
    const includeMessages = input.includeMessages as boolean | undefined;
    const includeProfile = input.includeProfile as boolean | undefined;
    
    const details: string[] = [];
    if (includeMessages) details.push("包含消息");
    if (includeProfile) details.push("包含资料");
    detail = details.join(" · ");
  } else if (toolName === "yupao_send_message") {
    const message = input.message as string | undefined;
    if (message) {
      detail = `消息: "${message.slice(0, 30)}${message.length > 30 ? '...' : ''}"`;
    }
  } else if (toolName === "yupao_exchange_wechat") {
    const timeout = input.timeout as number | undefined;
    if (timeout) {
      detail = `超时: ${timeout/1000}秒`;
    }
  } else if (toolName === "yupao_get_candidate_list") {
    const skipContacted = input.skipContacted as boolean | undefined;
    const maxResults = input.maxResults as number | undefined;
    
    const details: string[] = [];
    if (skipContacted) details.push("跳过已联系");
    if (maxResults) details.push(`最多${maxResults}个`);
    detail = details.length > 0 ? details.join(" · ") : "获取所有候选人";
  } else if (toolName === "yupao_say_hello") {
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
        filtered?: number;
        summary?: {
          total: number;
          success: number;
          failed: number;
        };
      };
    };
    
    if (toolName === "yupao_get_candidate_list" && result.data?.candidates) {
      const candidates = result.data.candidates;
      const resultDetails: string[] = [];
      resultDetails.push(`找到 ${candidates.length} 个候选人`);
      if (result.data.filtered && result.data.filtered > 0) {
        resultDetails.push(`已过滤 ${result.data.filtered} 个已联系`);
      }
      detail = resultDetails.join(" · ");
    } else if (toolName === "yupao_say_hello" && result.data?.summary) {
      const summary = result.data.summary;
      detail = `总计: ${summary.total} 个 · 成功: ${summary.success} 个 · 失败: ${summary.failed} 个`;
    }
  }

  return (
    <BaseToolMessage
      icon={Icon}
      label={label}
      detail={detail}
      theme={themes.purple}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
