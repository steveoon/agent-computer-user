/**
 * AI SDK 结构化输出工具
 *
 * 提供安全的结构化输出生成包装函数
 * 使用 tool-based pattern 替代 Output.object() 以获得更好的跨模型兼容性
 *
 * @see https://github.com/vercel/ai/issues/9002 - Output.object() 在某些模型上的兼容性问题
 */

import { generateText, tool, hasToolCall, NoObjectGeneratedError, type LanguageModel } from "ai";
import { z } from "zod/v3";
import { wrapError, logError, ErrorCode, type AppError } from "@/lib/errors";

/**
 * safeGenerateObject 选项
 */
export interface SafeGenerateObjectOptions<T> {
  /** 语言模型 */
  model: LanguageModel;
  /** Zod Schema */
  schema: z.ZodType<T>;
  /** Schema 名称（用于日志） */
  schemaName?: string;
  /** 系统提示 */
  system?: string;
  /** 用户提示 */
  prompt: string;
  /** 可选：错误回调（用于自定义日志或监控） */
  onError?: (error: AppError, rawText?: string) => void;
}

/**
 * safeGenerateObject 成功结果
 */
export interface SafeGenerateObjectSuccess<T> {
  success: true;
  data: T;
  /** AI SDK 的 usage 对象 */
  usage?: unknown;
}

/**
 * safeGenerateObject 失败结果
 */
export interface SafeGenerateObjectFailure {
  success: false;
  error: AppError;
  /** 模型生成的原始文本（如果是 NoObjectGeneratedError） */
  rawText?: string;
}

/**
 * safeGenerateObject 结果类型
 */
export type SafeGenerateObjectResult<T> = SafeGenerateObjectSuccess<T> | SafeGenerateObjectFailure;

/**
 * 安全的结构化输出生成
 *
 * 封装 generateText + Output.object()，提供统一的错误处理
 *
 * @example
 * // Pattern 1: 抛出错误模式
 * const result = await safeGenerateObject({
 *   model: registry.languageModel(modelId),
 *   schema: ClassificationOutputSchema,
 *   schemaName: 'ClassificationOutput',
 *   system: prompts.system,
 *   prompt: prompts.prompt,
 * });
 *
 * if (!result.success) {
 *   throw result.error; // 带完整上下文的 AppError
 * }
 * return result.data;
 *
 * @example
 * // Pattern 2: Fallback 模式
 * const result = await safeGenerateObject({
 *   model,
 *   schema: stepSalarySchema,
 *   schemaName: 'StepSalary',
 *   prompt: salaryPrompt,
 *   onError: (error, rawText) => {
 *     if (error.details?.isMarkdownFormat) {
 *       console.warn('LLM returned markdown:', rawText?.slice(0, 200));
 *     }
 *   },
 * });
 *
 * const stepSalaryInfo = result.success ? result.data : defaultStepSalary;
 */
/**
 * 内部工具名称，用于 tool-based structured output
 */
const SUBMIT_OBJECT_TOOL_NAME = "submit_structured_output";

export async function safeGenerateObject<T>(
  options: SafeGenerateObjectOptions<T>
): Promise<SafeGenerateObjectResult<T>> {
  const { model, schema, schemaName, system, prompt, onError } = options;

  try {
    // 使用 tool-based pattern 替代 Output.object()
    // 这种方式在所有支持 tool calling 的模型上都能可靠工作
    // @see https://github.com/vercel/ai/issues/9002
    const submitTool = tool({
      description: `Submit the structured output for ${schemaName || "the request"}`,
      inputSchema: schema,
    });

    const result = await generateText({
      model,
      system,
      prompt,
      tools: { [SUBMIT_OBJECT_TOOL_NAME]: submitTool },
      stopWhen: hasToolCall(SUBMIT_OBJECT_TOOL_NAME),
    });

    // 从 tool call 中提取结果
    const toolCall = result.toolCalls?.[0];
    if (!toolCall || toolCall.toolName !== SUBMIT_OBJECT_TOOL_NAME) {
      // 模型没有调用工具，创建错误
      const error = new Error(
        `Model did not call the ${SUBMIT_OBJECT_TOOL_NAME} tool. ` +
          `Response text: ${result.text?.slice(0, 200) || "(empty)"}`
      );
      throw error;
    }

    return {
      success: true,
      data: toolCall.input as T,
      usage: result.usage,
    };
  } catch (error) {
    // 使用统一错误处理
    const appError = wrapError(error, ErrorCode.LLM_RESPONSE_PARSE_ERROR);

    // 提取原始文本（如果是 NoObjectGeneratedError）
    let rawText: string | undefined;
    if (NoObjectGeneratedError.isInstance(error)) {
      rawText = error.text;
    }

    // 添加 schema 信息到 details
    if (schemaName && appError.details && typeof appError.details === "object") {
      (appError.details as Record<string, unknown>).schemaName = schemaName;
    }

    // 记录错误
    logError(`Structured output generation (${schemaName || "unknown"})`, appError);

    // 调用自定义错误回调
    if (onError) {
      onError(appError, rawText);
    }

    return {
      success: false,
      error: appError,
      rawText,
    };
  }
}
