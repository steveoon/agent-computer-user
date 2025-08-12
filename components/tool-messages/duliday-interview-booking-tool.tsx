"use client";

import { Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";
import { useMemo } from "react";

interface InterviewBookingResult {
  success: boolean;
  code: number;
  message: string;
  notice: string | null;
  errorList: unknown[] | null;
  requestInfo: {
    name: string;
    phone: string;
    age: string;
    genderId: number;
    education: string;
    jobId: number;
    interviewTime: string;
  };
}

export function DulidayInterviewBookingToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const name = input.name as string | undefined;
  const jobId = input.jobId as number | undefined;
  const interviewTime = input.interviewTime as string | undefined;
  const education = input.education as string | undefined;

  // 解析结果数据
  const bookingResult = useMemo(() => {
    if (output && typeof output === "object") {
      // Handle both direct object and wrapped object format
      if ("type" in output && output.type === "object" && "object" in output) {
        // Wrapped format: { type: "object", object: {...} }
        const wrappedResult = output as { type: string; object: unknown };
        if (
          wrappedResult.object &&
          typeof wrappedResult.object === "object" &&
          wrappedResult.object !== null &&
          "success" in wrappedResult.object
        ) {
          return wrappedResult.object as InterviewBookingResult;
        }
      } else if ("success" in output) {
        // Direct format
        return output as InterviewBookingResult;
      }
    }
    return null;
  }, [output]);

  const details: string[] = [];
  if (name) details.push(name);
  if (education) details.push(education);
  if (jobId) details.push(`岗位${jobId}`);
  if (interviewTime) {
    // 格式化时间显示
    try {
      const date = new Date(interviewTime);
      const formattedTime = date.toLocaleString("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      details.push(formattedTime);
    } catch {
      details.push(interviewTime);
    }
  }

  const detail = details.length > 0 ? details.join(" · ") : "预约面试";

  return (
    <BaseToolMessage
      icon={Calendar}
      label="预约面试"
      detail={detail}
      theme={themes.green}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    >
      {/* 显示API响应详情 */}
      {bookingResult && state === "output-available" && (
        <div className="mt-3 space-y-2">
          {/* 状态和消息 */}
          <div
            className={`p-3 rounded-lg flex items-start gap-2 ${
              bookingResult.success
                ? "bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800"
                : "bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800"
            }`}
          >
            {bookingResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div
                className={`font-medium ${
                  bookingResult.success
                    ? "text-green-800 dark:text-green-200"
                    : "text-red-800 dark:text-red-200"
                }`}
              >
                {bookingResult.message}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                响应代码: {bookingResult.code}
              </div>
            </div>
          </div>

          {/* 显示notice */}
          {bookingResult.notice && (
            <div className="p-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">{bookingResult.notice}</div>
            </div>
          )}

          {/* 显示详细信息 */}
          {bookingResult.success && bookingResult.requestInfo && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">预约信息</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">姓名：</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {bookingResult.requestInfo.name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">电话：</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {bookingResult.requestInfo.phone}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">学历：</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {bookingResult.requestInfo.education}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">岗位ID：</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {bookingResult.requestInfo.jobId}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">面试时间：</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {bookingResult.requestInfo.interviewTime}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </BaseToolMessage>
  );
}
