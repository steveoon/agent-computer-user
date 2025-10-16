/**
 * Open API 统一响应处理工具
 * 用于标准化对外 API 的响应格式
 */

import { NextResponse } from "next/server";
import type { APISuccessResponse, APIErrorResponse } from "@/types/api";

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
 * 处理未知错误并返回标准化响应
 */
export function handleUnknownError(
  error: unknown,
  correlationId?: string
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  const errorDetails = error instanceof Error ? error.stack : error;

  return createErrorResponse(ApiErrorType.InternalServerError, {
    message: errorMessage,
    details: errorDetails,
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