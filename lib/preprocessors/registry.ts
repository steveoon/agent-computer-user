/**
 * 预处理器注册表
 *
 * 在主 LLM 调用之前，按 promptType 执行场景化的预处理逻辑。
 * route.ts 只调用通用的 runPreprocessor()，具体实现通过注册表外置。
 *
 * 使用方式：
 *   1. 在 lib/preprocessors/ 下新建场景文件，调用 registerPreprocessor() 注册
 *   2. 在 route.ts 中 import 该文件（触发自注册）
 *   3. route.ts 中调用 runPreprocessor(ctx) 即可
 */

import type { UIMessage } from "ai";
import type { ModelConfig } from "@/lib/config/models";
import type { OpenApiPromptType } from "@/lib/tools/tool-registry";

/**
 * 预处理器上下文 — route.ts 传入的通用信息
 */
export interface PreprocessorContext {
  promptType: OpenApiPromptType;
  processedMessages: UIMessage[];
  modelConfig?: ModelConfig;
  userId?: string;
  sessionId?: string;
  dulidayToken?: string;
  correlationId: string;
}

/**
 * 预处理器结果
 */
export interface PreprocessorResult {
  /** 追加到系统提示词末尾的文本段落（空字符串表示无内容） */
  systemPromptSuffix: string;
  /** 工具获取到岗位数据后的回调，透传到 ToolCreationContext.onJobsFetched */
  onJobsFetched?: (jobs: unknown[]) => void;
  /** LLM 响应结束后执行的回调（fire-and-forget），用于异步任务如事实提取 */
  afterResponse?: () => void;
}

type Preprocessor = (ctx: PreprocessorContext) => Promise<PreprocessorResult>;

const PREPROCESSOR_REGISTRY: Partial<Record<OpenApiPromptType, Preprocessor>> = {};

export function registerPreprocessor(promptType: OpenApiPromptType, fn: Preprocessor): void {
  PREPROCESSOR_REGISTRY[promptType] = fn;
}

/**
 * 运行对应 promptType 的预处理器
 * 无注册预处理器时返回空结果
 */
export async function runPreprocessor(ctx: PreprocessorContext): Promise<PreprocessorResult> {
  const preprocessor = PREPROCESSOR_REGISTRY[ctx.promptType];
  if (!preprocessor) return { systemPromptSuffix: "" };
  return preprocessor(ctx);
}
