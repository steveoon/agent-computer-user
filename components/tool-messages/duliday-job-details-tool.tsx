"use client";

import { FileText } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function DulidayJobDetailsToolMessage(props: ToolMessageProps) {
  const { args, state, result, isLatestMessage, status, messageId, partIndex } = props;
  const jobBasicInfoId = args.jobBasicInfoId as number | undefined;

  const detail = jobBasicInfoId ? `岗位ID: ${jobBasicInfoId}` : "查询岗位详情";

  return (
    <BaseToolMessage
      icon={FileText}
      label="查询岗位详情"
      detail={detail}
      theme={themes.purple}
      state={state}
      result={result}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}