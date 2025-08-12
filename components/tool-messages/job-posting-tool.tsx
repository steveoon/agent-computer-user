"use client";

import { Briefcase } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function JobPostingToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const positionType = input.positionType as string | undefined;
  const brand = input.brand as string | undefined;
  const limit = input.limit as number | undefined;

  const details: string[] = [];
  if (positionType) details.push(`${positionType}岗位`);
  if (brand) details.push(brand);
  if (limit) details.push(`最多${limit}个`);

  const detail = details.join(" · ");

  return (
    <BaseToolMessage
      icon={Briefcase}
      label="生成岗位推送消息"
      detail={detail}
      theme={themes.indigo}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}