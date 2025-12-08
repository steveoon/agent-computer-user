/**
 * 结构化错误处理系统
 *
 * 统一导出所有错误相关的类型、类和工具函数
 *
 * @example
 * import {
 *   AppError,
 *   ErrorCode,
 *   ErrorCategory,
 *   wrapError,
 *   isAppError,
 *   createLLMError,
 * } from '@/lib/errors';
 *
 * try {
 *   await generateReply();
 * } catch (error) {
 *   const appError = wrapError(error, ErrorCode.LLM_GENERATION_FAILED);
 *   console.error(appError.toLogString());
 *   return { error: appError.userMessage, code: appError.code };
 * }
 */

// 错误代码和分类
export {
  ErrorCode,
  ErrorCategory,
  ERROR_CODE_TO_CATEGORY,
  ERROR_USER_MESSAGES,
  getErrorCategory,
  getErrorUserMessage,
  isErrorInCategory,
} from "./error-codes";

export type { ErrorCode as ErrorCodeType, ErrorCategory as ErrorCategoryType } from "./error-codes";

// AppError 类和类型守卫
export {
  AppError,
  isAppError,
  isErrorCode,
  isErrorCategory,
  isLLMError,
  isConfigError,
  isNetworkError,
  isAuthError,
} from "./app-error";

export type { AppErrorOptions, SerializedAppError } from "./app-error";

// 错误工厂函数
export {
  createLLMError,
  createConfigError,
  createNetworkError,
  createAuthError,
  createValidationError,
  createBusinessError,
  createSystemError,
} from "./error-factory";

// 错误工具函数
export {
  wrapError,
  toError,
  parseAISDKError,
  extractErrorContext,
  getUserMessage,
  logError,
} from "./error-utils";

export type { ErrorContext } from "./error-utils";
