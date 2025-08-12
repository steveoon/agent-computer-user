import { z } from "zod";

/**
 * 格式化 Duliday API 相关的错误信息
 * 为用户提供清晰、详细的错误描述
 */
export class DulidayErrorFormatter {
  /**
   * 格式化 Zod 验证错误
   * @param error - Zod 验证错误对象
   * @returns 格式化后的错误消息
   */
  static formatValidationError(error: z.ZodError): string {
    const errorDetails = error.issues.map(issue => {
      const path = issue.path.join(".");

      switch (issue.code) {
        case "invalid_type":
          // In Zod v4, the issue object has `expected` property but not `received`
          // We can extract the expected type from the issue
          const expectedType = issue.expected || "未知类型";
          return `• 字段 "${path}"\n  期望类型: ${expectedType}\n  ${issue.message}`;

        case "invalid_union":
          return `• 字段 "${path}"\n  数据不符合任何预期的格式\n  ${issue.message}`;

        case "unrecognized_keys":
          // In Zod v4, unrecognized_keys issues have a `keys` property
          const keys = issue.keys;
          const keysList = keys && Array.isArray(keys) ? keys.join(", ") : "未知键";
          return `• 字段 "${path}"\n  包含未识别的键: ${keysList}`;

        case "invalid_format":
          // In Zod v4, string format validation uses "invalid_format" instead of "invalid_string"
          return `• 字段 "${path}"\n  字符串格式无效\n  ${issue.message}`;

        case "too_small":
          // Access minimum value safely
          const minimum = issue.minimum;
          return `• 字段 "${path}"\n  值太小${minimum !== undefined ? `（最小值: ${minimum}）` : ""}\n  ${issue.message}`;

        case "too_big":
          // Access maximum value safely
          const maximum = issue.maximum;
          return `• 字段 "${path}"\n  值太大${maximum !== undefined ? `（最大值: ${maximum}）` : ""}\n  ${issue.message}`;

        case "custom":
          return `• 字段 "${path}"\n  自定义验证失败\n  ${issue.message}`;

        default:
          return `• 字段 "${path}"\n  ${issue.message}`;
      }
    });

    return `数据格式验证失败：\n${errorDetails.join("\n\n")}`;
  }

  /**
   * 格式化网络错误
   * @param error - 错误对象
   * @returns 格式化后的错误消息
   */
  static formatNetworkError(error: Error): string {
    const errorMessage = error.message;

    // 连接错误
    if (errorMessage.includes("ECONNRESET") || errorMessage.includes("EPIPE")) {
      return "网络连接被重置，请检查网络状态后重试";
    }

    // 超时错误
    if (errorMessage.includes("ETIMEDOUT") || error.name === "AbortError") {
      return "API 请求超时，请稍后重试";
    }

    // DNS 错误
    if (errorMessage.includes("ENOTFOUND")) {
      return "无法访问 Duliday API 服务器，请检查网络连接";
    }

    // 其他网络错误
    if (errorMessage.includes("网络连接错误")) {
      return errorMessage;
    }

    return `网络请求失败: ${errorMessage}`;
  }

  /**
   * 格式化 API 响应错误
   * @param status - HTTP 状态码
   * @param statusText - 状态文本
   * @returns 格式化后的错误消息
   */
  static formatHttpError(status: number, statusText: string): string {
    switch (status) {
      case 401:
        return "Duliday Token 无效或已过期，请检查 Token 设置";
      case 403:
        return "没有权限访问该资源，请联系管理员";
      case 404:
        return "请求的资源不存在";
      case 429:
        return "API 请求过于频繁，请稍后重试";
      case 500:
      case 502:
      case 503:
        return "Duliday 服务器暂时不可用，请稍后重试";
      default:
        return `API 请求失败: ${status} ${statusText}`;
    }
  }

  /**
   * 综合格式化各种类型的错误
   * @param error - 任意类型的错误
   * @returns 格式化后的错误消息
   */
  static formatError(error: unknown): string {
    // Zod 验证错误
    if (error instanceof z.ZodError) {
      return this.formatValidationError(error);
    }

    // 标准错误对象
    if (error instanceof Error) {
      // 检查是否是网络相关错误
      if (this.isNetworkError(error)) {
        return this.formatNetworkError(error);
      }
      return error.message;
    }

    // 其他类型的错误
    return String(error);
  }

  /**
   * 判断是否为网络错误
   * @param error - 错误对象
   * @returns 是否为网络错误
   */
  static isNetworkError(error: Error): boolean {
    const networkErrorPatterns = [
      "ECONNRESET",
      "ETIMEDOUT",
      "EPIPE",
      "ENOTFOUND",
      "EHOSTUNREACH",
      "ECONNREFUSED",
      "AbortError",
      "网络连接错误",
    ];

    return networkErrorPatterns.some(
      pattern => error.message.includes(pattern) || error.name === pattern
    );
  }

  /**
   * 为特定组织创建错误上下文
   * @param organizationId - 组织ID
   * @param organizationName - 组织名称（可选）
   * @param error - 错误信息
   * @returns 包含组织上下文的错误消息
   */
  static formatWithOrganizationContext(
    organizationId: number,
    error: string,
    organizationName?: string
  ): string {
    const orgContext = organizationName
      ? `组织 "${organizationName}" (ID: ${organizationId})`
      : `组织 ID: ${organizationId}`;

    return `${orgContext} 同步失败：\n${error}`;
  }
}

/**
 * 导出便捷函数
 */
export const formatDulidayError = DulidayErrorFormatter.formatError.bind(DulidayErrorFormatter);
export const formatValidationError =
  DulidayErrorFormatter.formatValidationError.bind(DulidayErrorFormatter);
export const formatNetworkError =
  DulidayErrorFormatter.formatNetworkError.bind(DulidayErrorFormatter);
export const formatHttpError = DulidayErrorFormatter.formatHttpError.bind(DulidayErrorFormatter);
