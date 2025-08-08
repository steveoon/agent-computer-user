"use client";

import { ChartBarIcon } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function DulidayBiReportToolMessage(props: ToolMessageProps) {
  const { args, state, result, isLatestMessage, status, messageId, partIndex } = props;
  const startDate = args.startDate as string | undefined;
  const endDate = args.endDate as string | undefined;
  const orderStatus = args.orderStatus as string | undefined;
  const storeName = args.storeName as string | undefined;
  const regionName = args.regionName as string | undefined;
  const formatType = args.formatType as string | undefined;
  const limit = args.limit as number | undefined;

  const details: string[] = [];
  
  // 日期范围
  if (startDate || endDate) {
    const dateRange = `${startDate || "开始"} ~ ${endDate || "至今"}`;
    details.push(dateRange);
  }
  
  // 其他筛选条件
  if (orderStatus) details.push(orderStatus);
  if (storeName) details.push(storeName);
  if (regionName) details.push(regionName);
  
  // 数据量和格式
  if (limit) details.push(`${limit}条`);
  if (formatType && formatType !== "summary") {
    const formatMap: Record<string, string> = {
      detailed: "详细",
      notification: "通知",
    };
    details.push(formatMap[formatType] || formatType);
  }

  const detail = details.length > 0 ? details.join(" · ") : "获取BI报表数据";

  return (
    <BaseToolMessage
      icon={ChartBarIcon}
      label="BI报表数据"
      detail={detail}
      theme={themes.indigo}
      state={state}
      result={result}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}