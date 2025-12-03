/**
 * 结构化错误代码系统
 *
 * 设计原则：
 * 1. 错误代码格式: CATEGORY_SPECIFIC_REASON
 * 2. 每个错误代码对应一个用户友好的默认消息
 * 3. 错误分类用于快速识别错误类型
 */

/**
 * 错误分类枚举
 */
export const ErrorCategory = {
  /** 配置相关错误 */
  CONFIG: "CONFIG",
  /** 认证/授权错误 */
  AUTH: "AUTH",
  /** 网络请求错误 */
  NETWORK: "NETWORK",
  /** AI 模型调用错误 */
  LLM: "LLM",
  /** 数据验证错误 */
  VALIDATION: "VALIDATION",
  /** 业务逻辑错误 */
  BUSINESS: "BUSINESS",
  /** 系统级错误 */
  SYSTEM: "SYSTEM",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * 错误代码常量
 */
export const ErrorCode = {
  // ========== LLM 错误 ==========
  /** API Key 无效或无权限 */
  LLM_UNAUTHORIZED: "LLM_UNAUTHORIZED",
  /** 模型不存在或不可用 */
  LLM_MODEL_NOT_FOUND: "LLM_MODEL_NOT_FOUND",
  /** API 调用被限流 */
  LLM_RATE_LIMITED: "LLM_RATE_LIMITED",
  /** API 调用超时 */
  LLM_TIMEOUT: "LLM_TIMEOUT",
  /** 生成过程失败 */
  LLM_GENERATION_FAILED: "LLM_GENERATION_FAILED",
  /** 响应格式解析失败 */
  LLM_RESPONSE_PARSE_ERROR: "LLM_RESPONSE_PARSE_ERROR",

  // ========== 配置错误 ==========
  /** 配置不存在 */
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  /** 配置格式无效 */
  CONFIG_INVALID: "CONFIG_INVALID",
  /** 缺少必需的配置字段 */
  CONFIG_MISSING_FIELD: "CONFIG_MISSING_FIELD",
  /** 配置加载失败 */
  CONFIG_LOAD_FAILED: "CONFIG_LOAD_FAILED",

  // ========== 网络错误 ==========
  /** 网络请求超时 */
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  /** 无法建立连接 */
  NETWORK_CONNECTION_FAILED: "NETWORK_CONNECTION_FAILED",
  /** HTTP 错误响应 */
  NETWORK_HTTP_ERROR: "NETWORK_HTTP_ERROR",
  /** DNS 解析失败 */
  NETWORK_DNS_FAILED: "NETWORK_DNS_FAILED",

  // ========== 认证错误 ==========
  /** 未认证 */
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  /** 无权限访问 */
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  /** Token 已过期 */
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  /** Token 无效 */
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",

  // ========== 验证错误 ==========
  /** 输入参数无效 */
  VALIDATION_INVALID_INPUT: "VALIDATION_INVALID_INPUT",
  /** 缺少必需参数 */
  VALIDATION_MISSING_REQUIRED: "VALIDATION_MISSING_REQUIRED",
  /** 参数格式错误 */
  VALIDATION_FORMAT_ERROR: "VALIDATION_FORMAT_ERROR",
  /** Schema 验证失败 */
  VALIDATION_SCHEMA_ERROR: "VALIDATION_SCHEMA_ERROR",

  // ========== 业务错误 ==========
  /** 业务规则违反 */
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  /** 资源不存在 */
  BUSINESS_RESOURCE_NOT_FOUND: "BUSINESS_RESOURCE_NOT_FOUND",
  /** 资源已存在 */
  BUSINESS_RESOURCE_EXISTS: "BUSINESS_RESOURCE_EXISTS",
  /** 操作不允许 */
  BUSINESS_OPERATION_NOT_ALLOWED: "BUSINESS_OPERATION_NOT_ALLOWED",

  // ========== 系统错误 ==========
  /** 内部系统错误 */
  SYSTEM_INTERNAL: "SYSTEM_INTERNAL",
  /** 依赖服务失败 */
  SYSTEM_DEPENDENCY_FAILED: "SYSTEM_DEPENDENCY_FAILED",
  /** 资源不可用 */
  SYSTEM_RESOURCE_UNAVAILABLE: "SYSTEM_RESOURCE_UNAVAILABLE",
  /** 未知错误 */
  SYSTEM_UNKNOWN: "SYSTEM_UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 错误代码到分类的映射
 */
export const ERROR_CODE_TO_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  // LLM
  [ErrorCode.LLM_UNAUTHORIZED]: ErrorCategory.LLM,
  [ErrorCode.LLM_MODEL_NOT_FOUND]: ErrorCategory.LLM,
  [ErrorCode.LLM_RATE_LIMITED]: ErrorCategory.LLM,
  [ErrorCode.LLM_TIMEOUT]: ErrorCategory.LLM,
  [ErrorCode.LLM_GENERATION_FAILED]: ErrorCategory.LLM,
  [ErrorCode.LLM_RESPONSE_PARSE_ERROR]: ErrorCategory.LLM,

  // CONFIG
  [ErrorCode.CONFIG_NOT_FOUND]: ErrorCategory.CONFIG,
  [ErrorCode.CONFIG_INVALID]: ErrorCategory.CONFIG,
  [ErrorCode.CONFIG_MISSING_FIELD]: ErrorCategory.CONFIG,
  [ErrorCode.CONFIG_LOAD_FAILED]: ErrorCategory.CONFIG,

  // NETWORK
  [ErrorCode.NETWORK_TIMEOUT]: ErrorCategory.NETWORK,
  [ErrorCode.NETWORK_CONNECTION_FAILED]: ErrorCategory.NETWORK,
  [ErrorCode.NETWORK_HTTP_ERROR]: ErrorCategory.NETWORK,
  [ErrorCode.NETWORK_DNS_FAILED]: ErrorCategory.NETWORK,

  // AUTH
  [ErrorCode.AUTH_UNAUTHORIZED]: ErrorCategory.AUTH,
  [ErrorCode.AUTH_FORBIDDEN]: ErrorCategory.AUTH,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: ErrorCategory.AUTH,
  [ErrorCode.AUTH_TOKEN_INVALID]: ErrorCategory.AUTH,

  // VALIDATION
  [ErrorCode.VALIDATION_INVALID_INPUT]: ErrorCategory.VALIDATION,
  [ErrorCode.VALIDATION_MISSING_REQUIRED]: ErrorCategory.VALIDATION,
  [ErrorCode.VALIDATION_FORMAT_ERROR]: ErrorCategory.VALIDATION,
  [ErrorCode.VALIDATION_SCHEMA_ERROR]: ErrorCategory.VALIDATION,

  // BUSINESS
  [ErrorCode.BUSINESS_RULE_VIOLATION]: ErrorCategory.BUSINESS,
  [ErrorCode.BUSINESS_RESOURCE_NOT_FOUND]: ErrorCategory.BUSINESS,
  [ErrorCode.BUSINESS_RESOURCE_EXISTS]: ErrorCategory.BUSINESS,
  [ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED]: ErrorCategory.BUSINESS,

  // SYSTEM
  [ErrorCode.SYSTEM_INTERNAL]: ErrorCategory.SYSTEM,
  [ErrorCode.SYSTEM_DEPENDENCY_FAILED]: ErrorCategory.SYSTEM,
  [ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE]: ErrorCategory.SYSTEM,
  [ErrorCode.SYSTEM_UNKNOWN]: ErrorCategory.SYSTEM,
};

/**
 * 错误代码到用户友好消息的映射
 */
export const ERROR_USER_MESSAGES: Record<ErrorCode, string> = {
  // LLM
  [ErrorCode.LLM_UNAUTHORIZED]: "AI 服务认证失败，请检查配置",
  [ErrorCode.LLM_MODEL_NOT_FOUND]: "所选模型暂时不可用，请尝试其他模型",
  [ErrorCode.LLM_RATE_LIMITED]: "请求过于频繁，请稍后重试",
  [ErrorCode.LLM_TIMEOUT]: "AI 响应超时，请稍后重试",
  [ErrorCode.LLM_GENERATION_FAILED]: "内容生成失败，请稍后重试",
  [ErrorCode.LLM_RESPONSE_PARSE_ERROR]: "AI 响应格式异常，请重试",

  // CONFIG
  [ErrorCode.CONFIG_NOT_FOUND]: "配置数据未找到，请先进行初始化",
  [ErrorCode.CONFIG_INVALID]: "配置格式无效，请检查配置",
  [ErrorCode.CONFIG_MISSING_FIELD]: "配置缺少必需字段",
  [ErrorCode.CONFIG_LOAD_FAILED]: "配置加载失败，请重试",

  // NETWORK
  [ErrorCode.NETWORK_TIMEOUT]: "网络请求超时，请检查网络连接",
  [ErrorCode.NETWORK_CONNECTION_FAILED]: "网络连接失败，请检查网络",
  [ErrorCode.NETWORK_HTTP_ERROR]: "服务器返回错误，请稍后重试",
  [ErrorCode.NETWORK_DNS_FAILED]: "域名解析失败，请检查网络",

  // AUTH
  [ErrorCode.AUTH_UNAUTHORIZED]: "请先登录",
  [ErrorCode.AUTH_FORBIDDEN]: "您没有权限执行此操作",
  [ErrorCode.AUTH_TOKEN_EXPIRED]: "登录已过期，请重新登录",
  [ErrorCode.AUTH_TOKEN_INVALID]: "认证信息无效，请重新登录",

  // VALIDATION
  [ErrorCode.VALIDATION_INVALID_INPUT]: "输入参数无效",
  [ErrorCode.VALIDATION_MISSING_REQUIRED]: "缺少必需参数",
  [ErrorCode.VALIDATION_FORMAT_ERROR]: "数据格式错误",
  [ErrorCode.VALIDATION_SCHEMA_ERROR]: "数据验证失败",

  // BUSINESS
  [ErrorCode.BUSINESS_RULE_VIOLATION]: "操作违反业务规则",
  [ErrorCode.BUSINESS_RESOURCE_NOT_FOUND]: "请求的资源不存在",
  [ErrorCode.BUSINESS_RESOURCE_EXISTS]: "资源已存在",
  [ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED]: "当前操作不被允许",

  // SYSTEM
  [ErrorCode.SYSTEM_INTERNAL]: "系统内部错误，请稍后重试",
  [ErrorCode.SYSTEM_DEPENDENCY_FAILED]: "依赖服务异常，请稍后重试",
  [ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE]: "系统资源不可用，请稍后重试",
  [ErrorCode.SYSTEM_UNKNOWN]: "发生未知错误，请稍后重试",
};

/**
 * 获取错误代码对应的分类
 */
export function getErrorCategory(code: ErrorCode): ErrorCategory {
  return ERROR_CODE_TO_CATEGORY[code];
}

/**
 * 获取错误代码对应的用户消息
 */
export function getErrorUserMessage(code: ErrorCode): string {
  return ERROR_USER_MESSAGES[code];
}

/**
 * 检查错误代码是否属于某个分类
 */
export function isErrorInCategory(code: ErrorCode, category: ErrorCategory): boolean {
  return ERROR_CODE_TO_CATEGORY[code] === category;
}
