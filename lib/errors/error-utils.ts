/**
 * 错误处理工具函数
 *
 * 提供错误包装、解析和转换的工具函数
 */

import { AppError, isAppError } from "./app-error";
import { ErrorCode, ErrorCategory } from "./error-codes";
import { createLLMError, createNetworkError } from "./error-factory";

/**
 * AI SDK 错误解析结果
 */
interface AISDKErrorInfo {
  /** 是否为认证错误 */
  isAuthError: boolean;
  /** 是否为模型不存在错误 */
  isModelNotFound: boolean;
  /** 是否为限流错误 */
  isRateLimited: boolean;
  /** 是否为超时错误 */
  isTimeout: boolean;
  /** HTTP 状态码 */
  statusCode?: number;
  /** Provider 名称 */
  provider?: string;
  /** 模型名称 */
  model?: string;
  /** 原始错误消息 */
  originalMessage?: string;
  /** 响应体内容 */
  responseBody?: string;
}

/**
 * 解析 AI SDK 错误
 *
 * 从 AI SDK 抛出的错误中提取有用信息
 * 支持 AI_APICallError 等错误类型
 *
 * @example
 * const info = parseAISDKError(error);
 * if (info?.isAuthError) {
 *   // 处理认证错误
 * }
 */
export function parseAISDKError(error: unknown): AISDKErrorInfo | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const err = error as Record<string, unknown>;

  // 检查是否为 AI SDK 的 API 调用错误
  const isAISDKError =
    err.name === "AI_APICallError" ||
    err.name === "APICallError" ||
    (typeof err.url === "string" && typeof err.statusCode === "number");

  if (!isAISDKError) {
    return null;
  }

  const statusCode = typeof err.statusCode === "number" ? err.statusCode : undefined;
  const responseBody = typeof err.responseBody === "string" ? err.responseBody : undefined;
  const url = typeof err.url === "string" ? err.url : undefined;
  const message = err.message as string | undefined;

  // 从 URL 提取 provider
  let provider: string | undefined;
  if (url) {
    if (url.includes("openai.com") || url.includes("hash070.com")) provider = "openai";
    else if (url.includes("anthropic.com")) provider = "anthropic";
    else if (url.includes("dashscope.aliyuncs.com")) provider = "qwen";
    else if (url.includes("openrouter.ai")) provider = "openrouter";
    else if (url.includes("deepseek.com")) provider = "deepseek";
    else if (url.includes("moonshot.cn")) provider = "moonshotai";
    else if (url.includes("googleapis.com")) provider = "google";
  }

  // 从响应体提取模型名称（如果存在）
  let model: string | undefined;
  if (responseBody) {
    const modelMatch = responseBody.match(/model[`'":\s]+([^`'"}\s,]+)/i);
    if (modelMatch) {
      model = modelMatch[1];
    }
  }

  // 判断错误类型
  const isAuthError = statusCode === 401 || statusCode === 403;
  const isModelNotFound =
    (responseBody?.includes("model") && responseBody?.includes("not exist")) ||
    responseBody?.includes("not authorized to access this model") ||
    false;
  const isRateLimited = statusCode === 429;
  const isTimeout =
    statusCode === 408 ||
    statusCode === 504 ||
    message?.toLowerCase().includes("timeout") ||
    false;

  return {
    isAuthError,
    isModelNotFound,
    isRateLimited,
    isTimeout,
    statusCode,
    provider,
    model,
    originalMessage: message,
    responseBody,
  };
}

/**
 * 将任意错误包装为 AppError
 *
 * 智能检测错误类型并选择合适的错误代码
 *
 * @param error - 原始错误
 * @param fallbackCode - 默认错误代码（当无法识别错误类型时使用）
 * @param userMessage - 自定义用户消息（可选）
 *
 * @example
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const appError = wrapError(error, ErrorCode.SYSTEM_INTERNAL);
 *   console.error(appError.toLogString());
 *   return { error: appError.userMessage };
 * }
 */
export function wrapError(
  error: unknown,
  fallbackCode: ErrorCode = ErrorCode.SYSTEM_UNKNOWN,
  userMessage?: string
): AppError {
  // 如果已经是 AppError，直接返回（可能添加新的 userMessage）
  if (isAppError(error)) {
    if (userMessage && userMessage !== error.userMessage) {
      // 创建新的 AppError 保留原始错误作为 cause
      return new AppError({
        code: error.code,
        message: error.message,
        userMessage,
        cause: error.cause,
        details: error.details,
      });
    }
    return error;
  }

  // 转换为 Error 对象
  const originalError = toError(error);

  // 尝试解析 AI SDK 错误
  const aiInfo = parseAISDKError(error);
  if (aiInfo) {
    const context = {
      model: aiInfo.model,
      provider: aiInfo.provider,
      statusCode: aiInfo.statusCode,
      responseBody: aiInfo.responseBody,
    };

    if (aiInfo.isModelNotFound) {
      return createLLMError(ErrorCode.LLM_MODEL_NOT_FOUND, originalError, context);
    }
    if (aiInfo.isAuthError) {
      return createLLMError(ErrorCode.LLM_UNAUTHORIZED, originalError, context);
    }
    if (aiInfo.isRateLimited) {
      return createLLMError(ErrorCode.LLM_RATE_LIMITED, originalError, context);
    }
    if (aiInfo.isTimeout) {
      return createLLMError(ErrorCode.LLM_TIMEOUT, originalError, context);
    }

    // 其他 AI SDK 错误
    return createLLMError(ErrorCode.LLM_GENERATION_FAILED, originalError, context);
  }

  // 检查网络错误
  const message = originalError.message.toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("network") ||
    message.includes("fetch failed")
  ) {
    if (message.includes("timeout")) {
      return createNetworkError(ErrorCode.NETWORK_TIMEOUT, originalError);
    }
    return createNetworkError(ErrorCode.NETWORK_CONNECTION_FAILED, originalError);
  }

  // 使用回退代码创建通用错误（直接使用 AppError 以支持任意错误代码）
  return new AppError({
    code: fallbackCode,
    message: originalError.message,
    cause: originalError,
  });
}

/**
 * 将任意值转换为 Error 对象
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  if (typeof error === "object" && error !== null) {
    const message =
      (error as Record<string, unknown>).message ||
      (error as Record<string, unknown>).error ||
      JSON.stringify(error);
    return new Error(String(message));
  }

  return new Error(String(error));
}

/**
 * 从 AppError 提取错误上下文信息
 * 用于添加到返回结果中
 */
export interface ErrorContext {
  errorCode: ErrorCode;
  category: ErrorCategory;
  originalError?: string;
  details?: unknown;
}

/**
 * 从 AppError 提取错误上下文
 *
 * @example
 * const context = extractErrorContext(appError);
 * return {
 *   replyType: "error",
 *   reasoningText: `系统错误：${appError.userMessage}`,
 *   errorContext: context,
 * };
 */
export function extractErrorContext(error: AppError): ErrorContext {
  const context: ErrorContext = {
    errorCode: error.code,
    category: error.category,
  };

  if (error.cause) {
    context.originalError = error.cause.message;
  }

  if (error.details) {
    context.details = error.details;
  }

  return context;
}

/**
 * 安全地获取用户友好的错误消息
 * 即使传入的不是 AppError 也能返回合理的消息
 */
export function getUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    // 避免暴露技术细节，返回通用消息
    return "操作失败，请稍后重试";
  }

  return "发生未知错误，请稍后重试";
}

/**
 * 记录错误日志的辅助函数
 *
 * @example
 * } catch (error) {
 *   const appError = wrapError(error, ErrorCode.LLM_GENERATION_FAILED);
 *   logError('智能回复生成', appError);
 *   return { replyType: 'error', ... };
 * }
 */
export function logError(context: string, error: AppError): void {
  console.error(`[${error.code}] ${context}:`, error.toLogString());

  // 如果有原始错误，也记录完整堆栈
  if (error.cause) {
    console.error("Original error:", error.cause);
  }
}
