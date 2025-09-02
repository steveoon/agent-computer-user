"use client";

import { Building2 } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function DulidayJobListToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const brandName = input.brandName as string | undefined;
  const storeName = input.storeName as string | undefined;
  const regionName = input.regionName as string | undefined;
  const laborForm = input.laborForm as string | undefined;
  const jobNickName = input.jobNickName as string | undefined;

  const details: string[] = [];
  if (brandName) details.push(brandName);
  if (storeName) details.push(`门店：${storeName}`);
  if (regionName) details.push(regionName);
  if (laborForm) details.push(laborForm);
  if (jobNickName) details.push(`岗位：${jobNickName}`);

  const detail = details.length > 0 ? details.join(" · ") : "查询在招岗位";

  return (
    <BaseToolMessage
      icon={Building2}
      label="查询在招岗位"
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
