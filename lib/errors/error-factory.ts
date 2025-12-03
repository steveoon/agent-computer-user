/**
 * 错误工厂函数
 *
 * 提供便捷的错误创建方法，减少样板代码
 */

import { AppError } from "./app-error";
import { ErrorCode } from "./error-codes";

/**
 * LLM 错误上下文
 */
interface LLMErrorContext {
  model?: string;
  provider?: string;
  statusCode?: number;
  responseBody?: string;
}

/**
 * 配置错误上下文
 */
interface ConfigErrorContext {
  configKey?: string;
  missingFields?: string[];
  expectedType?: string;
}

/**
 * 网络错误上下文
 */
interface NetworkErrorContext {
  url?: string;
  statusCode?: number;
  method?: string;
}

/**
 * 创建 LLM 相关错误
 *
 * @example
 * throw createLLMError(
 *   ErrorCode.LLM_UNAUTHORIZED,
 *   originalError,
 *   { model: 'gpt-5-mini', provider: 'openai' }
 * );
 */
export function createLLMError(
  code:
    | typeof ErrorCode.LLM_UNAUTHORIZED
    | typeof ErrorCode.LLM_MODEL_NOT_FOUND
    | typeof ErrorCode.LLM_RATE_LIMITED
    | typeof ErrorCode.LLM_TIMEOUT
    | typeof ErrorCode.LLM_GENERATION_FAILED
    | typeof ErrorCode.LLM_RESPONSE_PARSE_ERROR,
  cause: Error,
  context?: LLMErrorContext
): AppError {
  const modelInfo = context?.model ? ` (model: ${context.model})` : "";
  const providerInfo = context?.provider ? ` [${context.provider}]` : "";

  const messages: Record<string, string> = {
    [ErrorCode.LLM_UNAUTHORIZED]: `LLM API authentication failed${providerInfo}${modelInfo}`,
    [ErrorCode.LLM_MODEL_NOT_FOUND]: `Model not found or unavailable${modelInfo}${providerInfo}`,
    [ErrorCode.LLM_RATE_LIMITED]: `LLM API rate limited${providerInfo}`,
    [ErrorCode.LLM_TIMEOUT]: `LLM API request timeout${providerInfo}${modelInfo}`,
    [ErrorCode.LLM_GENERATION_FAILED]: `LLM generation failed${providerInfo}${modelInfo}`,
    [ErrorCode.LLM_RESPONSE_PARSE_ERROR]: `Failed to parse LLM response${providerInfo}`,
  };

  return new AppError({
    code,
    message: messages[code] || `LLM error: ${cause.message}`,
    cause,
    details: context,
  });
}

/**
 * 创建配置相关错误
 *
 * @example
 * throw createConfigError(
 *   ErrorCode.CONFIG_MISSING_FIELD,
 *   'Missing required config fields',
 *   { missingFields: ['configData', 'replyPrompts'] }
 * );
 */
export function createConfigError(
  code:
    | typeof ErrorCode.CONFIG_NOT_FOUND
    | typeof ErrorCode.CONFIG_INVALID
    | typeof ErrorCode.CONFIG_MISSING_FIELD
    | typeof ErrorCode.CONFIG_LOAD_FAILED,
  message: string,
  context?: ConfigErrorContext,
  cause?: Error
): AppError {
  return new AppError({
    code,
    message,
    cause,
    details: context,
  });
}

/**
 * 创建网络相关错误
 */
export function createNetworkError(
  code:
    | typeof ErrorCode.NETWORK_TIMEOUT
    | typeof ErrorCode.NETWORK_CONNECTION_FAILED
    | typeof ErrorCode.NETWORK_HTTP_ERROR
    | typeof ErrorCode.NETWORK_DNS_FAILED,
  cause: Error,
  context?: NetworkErrorContext
): AppError {
  const urlInfo = context?.url ? ` (${context.url})` : "";
  const statusInfo = context?.statusCode ? ` [${context.statusCode}]` : "";

  const messages: Record<string, string> = {
    [ErrorCode.NETWORK_TIMEOUT]: `Network request timeout${urlInfo}`,
    [ErrorCode.NETWORK_CONNECTION_FAILED]: `Failed to connect${urlInfo}`,
    [ErrorCode.NETWORK_HTTP_ERROR]: `HTTP error${statusInfo}${urlInfo}`,
    [ErrorCode.NETWORK_DNS_FAILED]: `DNS resolution failed${urlInfo}`,
  };

  return new AppError({
    code,
    message: messages[code] || `Network error: ${cause.message}`,
    cause,
    details: context,
  });
}

/**
 * 创建认证相关错误
 */
export function createAuthError(
  code:
    | typeof ErrorCode.AUTH_UNAUTHORIZED
    | typeof ErrorCode.AUTH_FORBIDDEN
    | typeof ErrorCode.AUTH_TOKEN_EXPIRED
    | typeof ErrorCode.AUTH_TOKEN_INVALID,
  message: string,
  cause?: Error
): AppError {
  return new AppError({
    code,
    message,
    cause,
  });
}

/**
 * 创建验证相关错误
 */
export function createValidationError(
  code:
    | typeof ErrorCode.VALIDATION_INVALID_INPUT
    | typeof ErrorCode.VALIDATION_MISSING_REQUIRED
    | typeof ErrorCode.VALIDATION_FORMAT_ERROR
    | typeof ErrorCode.VALIDATION_SCHEMA_ERROR,
  message: string,
  details?: unknown
): AppError {
  return new AppError({
    code,
    message,
    details,
  });
}

/**
 * 创建业务相关错误
 */
export function createBusinessError(
  code:
    | typeof ErrorCode.BUSINESS_RULE_VIOLATION
    | typeof ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
    | typeof ErrorCode.BUSINESS_RESOURCE_EXISTS
    | typeof ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED,
  message: string,
  userMessage?: string,
  details?: unknown
): AppError {
  return new AppError({
    code,
    message,
    userMessage,
    details,
  });
}

/**
 * 创建系统相关错误
 */
export function createSystemError(
  code:
    | typeof ErrorCode.SYSTEM_INTERNAL
    | typeof ErrorCode.SYSTEM_DEPENDENCY_FAILED
    | typeof ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE
    | typeof ErrorCode.SYSTEM_UNKNOWN,
  message: string,
  cause?: Error,
  details?: unknown
): AppError {
  return new AppError({
    code,
    message,
    cause,
    details,
  });
}
