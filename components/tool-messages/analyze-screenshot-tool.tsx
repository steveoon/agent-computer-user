"use client";

import { Eye, ImageIcon, Cpu, FileText, Lightbulb } from "lucide-react";
import { motion } from "motion/react";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { themes, type ToolMessageProps } from "./types";

export function AnalyzeScreenshotToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;

  // 提取输入参数
  const imageUrl = input.imageUrl as string | undefined;
  const analysisPrompt = input.analysisPrompt as string | undefined;
  const modelName = (input.modelName as string) || "qwen-vl-plus";

  // 提取输出结果
  const analysisResult =
    output && typeof output === "object" && "data" in output
      ? (output.data as {
          summary?: string;
          details?: string;
          keyElements?: string[];
          suggestions?: string;
        })
      : null;

  const theme = themes.purple;

  // 格式化 URL 显示
  const formatUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("oss://")) {
      const parts = url.split("/");
      return `.../${parts[parts.length - 1]}`;
    }
    return url.length > 40 ? url.substring(0, 40) + "..." : url;
  };

  return (
    <motion.div
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      key={`message-${messageId}-part-${partIndex}`}
      className={`flex flex-col gap-3 p-3 mb-3 text-sm ${theme.bgColor} rounded-md border ${theme.borderColor}`}
    >
      {/* 紧凑的工具栏 */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center justify-center w-8 h-8 ${theme.iconBgColor} rounded-full flex-shrink-0`}
        >
          <Eye className={`w-4 h-4 ${theme.iconColor}`} />
        </div>
        <div className="flex-1 flex items-center gap-2">
          <span className={`font-medium ${theme.textColor}`}>图片分析</span>
          <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            <Cpu className="inline w-3 h-3 mr-0.5" />
            {modelName}
          </span>
        </div>
        <div className="w-4 h-4 flex items-center justify-center">
          {state === "input-streaming" || state === "input-available" ? (
            isLatestMessage && status !== "ready" ? (
              <Loader2 className={`animate-spin h-4 w-4 ${theme.loaderColor}`} />
            ) : null
          ) : state === "output-available" ? (
            analysisResult?.summary ? (
              <CheckCircle size={14} className="text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )
          ) : state === "output-error" ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : null}
        </div>
      </div>

      {/* 输入参数区域 - 更清晰的视觉层次 */}
      <div className="pl-10 space-y-1.5">
        {imageUrl && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
            <ImageIcon className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono">OSS: {formatUrl(imageUrl)}</span>
          </div>
        )}

        {analysisPrompt && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-2 border-l-2 border-purple-400">
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-0.5">
              分析指令
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300">{analysisPrompt}</div>
          </div>
        )}
      </div>

      {/* 分析结果显示 - 更好的视觉层次 */}
      {state === "output-available" && analysisResult && (
        <div className="pl-10 space-y-2">
          {/* 摘要 - 主要内容突出显示 */}
          {analysisResult.summary && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                  摘要
                </span>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                {analysisResult.summary}
              </div>
            </div>
          )}

          {/* 关键元素 - 标签式显示 */}
          {analysisResult.keyElements && analysisResult.keyElements.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                关键元素:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysisResult.keyElements.slice(0, 3).map((element, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800"
                  >
                    {element}
                  </span>
                ))}
                {analysisResult.keyElements.length > 3 && (
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    +{analysisResult.keyElements.length - 3} 更多
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 建议 - 醒目提示 */}
          {analysisResult.suggestions && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
              <Lightbulb className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                {analysisResult.suggestions}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
