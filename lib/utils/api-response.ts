/**
 * Open API 统一响应处理工具
 * 用于标准化对外 API 的响应格式
 */

import { NextResponse } from "next/server";
import type { APISuccessResponse, APIErrorResponse } from "@/types/api";
import {
  wrapError,
  extractErrorContext,
  logError,
  ErrorCode,
  ErrorCategory,
  type AppError,
} from "@/lib/errors";

/**
 * 生成关联 ID
 */
export function generateCorrelationId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * API 错误类型枚举
 */
export enum ApiErrorType {
  // 客户端错误
  BadRequest = "BadRequest",
  Unauthorized = "Unauthorized",
  Forbidden = "Forbidden",
  NotFound = "NotFound",
  MethodNotAllowed = "MethodNotAllowed",
  Conflict = "Conflict",
  UnprocessableEntity = "UnprocessableEntity",
  TooManyRequests = "TooManyRequests",

  // 服务端错误
  InternalServerError = "InternalServerError",
  NotImplemented = "NotImplemented",
  BadGateway = "BadGateway",
  ServiceUnavailable = "ServiceUnavailable",
  GatewayTimeout = "GatewayTimeout",
}

/**
 * HTTP 状态码映射
 */
const ERROR_STATUS_MAP: Record<ApiErrorType, number> = {
  [ApiErrorType.BadRequest]: 400,
  [ApiErrorType.Unauthorized]: 401,
  [ApiErrorType.Forbidden]: 403,
  [ApiErrorType.NotFound]: 404,
  [ApiErrorType.MethodNotAllowed]: 405,
  [ApiErrorType.Conflict]: 409,
  [ApiErrorType.UnprocessableEntity]: 422,
  [ApiErrorType.TooManyRequests]: 429,
  [ApiErrorType.InternalServerError]: 500,
  [ApiErrorType.NotImplemented]: 501,
  [ApiErrorType.BadGateway]: 502,
  [ApiErrorType.ServiceUnavailable]: 503,
  [ApiErrorType.GatewayTimeout]: 504,
};

/**
 * 默认错误消息
 */
const DEFAULT_ERROR_MESSAGES: Record<ApiErrorType, string> = {
  [ApiErrorType.BadRequest]: "Invalid request parameters",
  [ApiErrorType.Unauthorized]: "Authentication required",
  [ApiErrorType.Forbidden]: "Access denied",
  [ApiErrorType.NotFound]: "Resource not found",
  [ApiErrorType.MethodNotAllowed]: "Method not allowed",
  [ApiErrorType.Conflict]: "Resource conflict",
  [ApiErrorType.UnprocessableEntity]: "Unprocessable entity",
  [ApiErrorType.TooManyRequests]: "Rate limit exceeded",
  [ApiErrorType.InternalServerError]: "Internal server error",
  [ApiErrorType.NotImplemented]: "Not implemented",
  [ApiErrorType.BadGateway]: "Bad gateway",
  [ApiErrorType.ServiceUnavailable]: "Service unavailable",
  [ApiErrorType.GatewayTimeout]: "Gateway timeout",
};

/**
 * API 错误响应选项
 */
export interface ApiErrorOptions {
  message?: string;
  details?: unknown;
  correlationId?: string;
}

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(
  errorType: ApiErrorType,
  options: ApiErrorOptions = {}
): NextResponse {
  const correlationId = options.correlationId || generateCorrelationId();
  const statusCode = ERROR_STATUS_MAP[errorType];
  const message = options.message || DEFAULT_ERROR_MESSAGES[errorType];

  const errorResponse: APIErrorResponse = {
    error: errorType,
    message,
    statusCode,
    correlationId,
  };

  // 添加可选的详细信息
  if (options.details !== undefined) {
    errorResponse.details = options.details;
  }

  // 记录错误日志
  if (statusCode >= 500) {
    console.error(`[${correlationId}] ${errorType}:`, message, options.details);
  }

  return NextResponse.json(errorResponse, {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-Id": correlationId,
    },
  });
}

/**
 * 创建标准化的成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    message?: string;
    headers?: Record<string, string>;
    correlationId?: string;
  } = {}
): NextResponse {
  const correlationId = options.correlationId || generateCorrelationId();

  const response: APISuccessResponse<T> = {
    success: true,
    data,
  };

  if (options.message) {
    response.message = options.message;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Correlation-Id": correlationId,
    ...options.headers,
  };

  return NextResponse.json(response, {
    status: 200,
    headers,
  });
}

/**
 * ErrorCategory 到 ApiErrorType 的映射
 */
const ERROR_CATEGORY_TO_API_TYPE: Record<ErrorCategory, ApiErrorType> = {
  [ErrorCategory.LLM]: ApiErrorType.BadGateway, // LLM 服务错误
  [ErrorCategory.CONFIG]: ApiErrorType.InternalServerError, // 配置错误
  [ErrorCategory.AUTH]: ApiErrorType.Unauthorized, // 认证错误
  [ErrorCategory.NETWORK]: ApiErrorType.GatewayTimeout, // 网络错误
  [ErrorCategory.VALIDATION]: ApiErrorType.BadRequest, // 验证错误
  [ErrorCategory.BUSINESS]: ApiErrorType.UnprocessableEntity, // 业务错误
  [ErrorCategory.SYSTEM]: ApiErrorType.InternalServerError, // 系统错误
};

/**
 * 特定错误代码到 ApiErrorType 的覆盖映射（优先级高于分类映射）
 */
const ERROR_CODE_OVERRIDES: Partial<Record<ErrorCode, ApiErrorType>> = {
  [ErrorCode.LLM_UNAUTHORIZED]: ApiErrorType.Unauthorized,
  [ErrorCode.LLM_RATE_LIMITED]: ApiErrorType.TooManyRequests,
  [ErrorCode.LLM_TIMEOUT]: ApiErrorType.GatewayTimeout,
  [ErrorCode.AUTH_FORBIDDEN]: ApiErrorType.Forbidden,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: ApiErrorType.Unauthorized,
  [ErrorCode.BUSINESS_RESOURCE_NOT_FOUND]: ApiErrorType.NotFound,
};

/**
 * 从 AppError 获取对应的 ApiErrorType
 */
function getApiErrorType(appError: AppError): ApiErrorType {
  // 优先使用特定错误代码的覆盖映射
  const codeOverride = ERROR_CODE_OVERRIDES[appError.code];
  if (codeOverride) {
    return codeOverride;
  }
  // 回退到分类映射
  return ERROR_CATEGORY_TO_API_TYPE[appError.category];
}

/**
 * 处理未知错误并返回标准化响应
 * 使用结构化错误系统自动识别错误类型
 */
export function handleUnknownError(
  error: unknown,
  correlationId?: string,
  fallbackCode: ErrorCode = ErrorCode.SYSTEM_INTERNAL
): NextResponse {
  const appError = wrapError(error, fallbackCode);
  const apiErrorType = getApiErrorType(appError);

  // 记录完整错误链
  logError(`API Error [${correlationId}]`, appError);

  return createErrorResponse(apiErrorType, {
    message: appError.userMessage,
    details: extractErrorContext(appError),
    correlationId,
  });
}

/**
 * 验证请求方法
 */
export function validateMethod(
  request: Request,
  allowedMethods: string[]
): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    return createErrorResponse(ApiErrorType.MethodNotAllowed, {
      message: `Method ${request.method} not allowed. Allowed methods: ${allowedMethods.join(", ")}`,
    });
  }
  return null;
}

/**
 * 创建缺失字段错误响应
 */
export function createMissingFieldsError(
  missingFields: string[],
  correlationId?: string
): NextResponse {
  return createErrorResponse(ApiErrorType.BadRequest, {
    message: `Missing required fields: ${missingFields.join(", ")}`,
    details: { missing: missingFields },
    correlationId,
  });
}

/**
 * 创建验证错误响应
 */
export function createValidationError(
  errors: Record<string, string>,
  correlationId?: string
): NextResponse {
  return createErrorResponse(ApiErrorType.UnprocessableEntity, {
    message: "Validation failed",
    details: { errors },
    correlationId,
  });
}