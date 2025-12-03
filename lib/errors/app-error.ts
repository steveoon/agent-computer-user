/**
 * AppError - 结构化应用错误类
 *
 * 设计目标：
 * 1. 保留完整错误链 - 通过 cause 属性追溯原始错误
 * 2. 类型化错误分类 - 通过 code 和 category 区分错误类型
 * 3. 用户友好消息 - userMessage 与技术 message 分离
 * 4. 可序列化 - toJSON() 方便日志和 API 响应
 */

import {
  ErrorCode,
  ErrorCategory,
  getErrorCategory,
  getErrorUserMessage,
} from "./error-codes";

/**
 * AppError 构造选项
 */
export interface AppErrorOptions {
  /** 错误代码（必需） */
  code: ErrorCode;
  /** 技术消息（必需） */
  message: string;
  /** 用户友好消息（可选，默认根据 code 生成） */
  userMessage?: string;
  /** 原始错误（可选） */
  cause?: Error;
  /** 额外详情（可选，用于调试） */
  details?: unknown;
}

/**
 * 序列化后的错误格式
 */
export interface SerializedAppError {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  userMessage: string;
  timestamp: string;
  details?: unknown;
  cause?: SerializedAppError | { message: string; stack?: string };
}

/**
 * 结构化应用错误类
 *
 * @example
 * // 创建 LLM 错误
 * throw new AppError({
 *   code: ErrorCode.LLM_UNAUTHORIZED,
 *   message: 'API key is invalid for model gpt-5-mini',
 *   details: { model: 'gpt-5-mini', provider: 'openai' },
 * });
 *
 * @example
 * // 包装原始错误
 * try {
 *   await callLLM();
 * } catch (error) {
 *   throw new AppError({
 *     code: ErrorCode.LLM_GENERATION_FAILED,
 *     message: 'Failed to generate reply',
 *     cause: error instanceof Error ? error : new Error(String(error)),
 *   });
 * }
 */
export class AppError extends Error {
  /** 错误代码 */
  readonly code: ErrorCode;

  /** 错误分类 */
  readonly category: ErrorCategory;

  /** 用户友好消息 */
  readonly userMessage: string;

  /** 额外详情 */
  readonly details?: unknown;

  /** 原始错误 */
  override readonly cause?: Error;

  /** 错误发生时间 */
  readonly timestamp: string;

  constructor(options: AppErrorOptions) {
    super(options.message);

    this.name = "AppError";
    this.code = options.code;
    this.category = getErrorCategory(options.code);
    this.userMessage = options.userMessage || getErrorUserMessage(options.code);
    this.details = options.details;
    this.cause = options.cause;
    this.timestamp = new Date().toISOString();

    // 确保 Error.captureStackTrace 可用（Node.js 环境）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * 转换为可序列化的 JSON 对象
   * 用于日志记录和 API 响应
   */
  toJSON(): SerializedAppError {
    const result: SerializedAppError = {
      code: this.code,
      category: this.category,
      message: this.message,
      userMessage: this.userMessage,
      timestamp: this.timestamp,
    };

    if (this.details !== undefined) {
      result.details = this.details;
    }

    if (this.cause) {
      if (this.cause instanceof AppError) {
        result.cause = this.cause.toJSON();
      } else {
        result.cause = {
          message: this.cause.message,
          stack: this.cause.stack,
        };
      }
    }

    return result;
  }

  /**
   * 获取完整的错误链
   * 返回从当前错误到根本原因的所有错误
   */
  getErrorChain(): Array<AppError | Error> {
    const chain: Array<AppError | Error> = [this];
    let current: Error | undefined = this.cause;

    while (current) {
      chain.push(current);
      current = current instanceof AppError ? current.cause : undefined;
    }

    return chain;
  }

  /**
   * 获取根本原因错误
   */
  getRootCause(): Error {
    const chain = this.getErrorChain();
    return chain[chain.length - 1];
  }

  /**
   * 检查错误链中是否包含特定错误代码
   */
  hasErrorCode(code: ErrorCode): boolean {
    return this.getErrorChain().some(
      error => error instanceof AppError && error.code === code
    );
  }

  /**
   * 检查错误链中是否包含特定分类的错误
   */
  hasErrorCategory(category: ErrorCategory): boolean {
    return this.getErrorChain().some(
      error => error instanceof AppError && error.category === category
    );
  }

  /**
   * 创建格式化的日志字符串
   */
  toLogString(): string {
    const parts = [
      `[${this.code}]`,
      this.message,
    ];

    if (this.details) {
      parts.push(`Details: ${JSON.stringify(this.details)}`);
    }

    if (this.cause) {
      parts.push(`Caused by: ${this.cause.message}`);
    }

    return parts.join(" | ");
  }
}

/**
 * 类型守卫：检查是否为 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 检查错误是否为特定代码
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  return isAppError(error) && error.code === code;
}

/**
 * 检查错误是否为特定分类
 */
export function isErrorCategory(error: unknown, category: ErrorCategory): boolean {
  return isAppError(error) && error.category === category;
}

/**
 * 检查是否为 LLM 相关错误
 */
export function isLLMError(error: unknown): boolean {
  return isErrorCategory(error, ErrorCategory.LLM);
}

/**
 * 检查是否为配置相关错误
 */
export function isConfigError(error: unknown): boolean {
  return isErrorCategory(error, ErrorCategory.CONFIG);
}

/**
 * 检查是否为网络相关错误
 */
export function isNetworkError(error: unknown): boolean {
  return isErrorCategory(error, ErrorCategory.NETWORK);
}

/**
 * 检查是否为认证相关错误
 */
export function isAuthError(error: unknown): boolean {
  return isErrorCategory(error, ErrorCategory.AUTH);
}
