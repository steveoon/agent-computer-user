/**
 * PostgreSQL 标准错误接口
 *
 * 用于类型安全的数据库错误处理
 */

/**
 * PostgreSQL 错误代码常量
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PostgreSQLErrorCode = {
  /** 唯一约束冲突 */
  UNIQUE_VIOLATION: "23505",
  /** 外键约束冲突 */
  FOREIGN_KEY_VIOLATION: "23503",
  /** 非空约束冲突 */
  NOT_NULL_VIOLATION: "23502",
  /** 检查约束冲突 */
  CHECK_VIOLATION: "23514",
  /** 数据类型不匹配 */
  INVALID_TEXT_REPRESENTATION: "22P02",
  /** 数值越界 */
  NUMERIC_VALUE_OUT_OF_RANGE: "22003",
} as const;

/**
 * PostgreSQL 错误接口
 *
 * 包含 PostgreSQL 返回的标准错误字段
 */
export interface PostgreSQLError extends Error {
  /** 错误代码（如 "23505" 表示唯一约束冲突） */
  code?: string;
  /** 错误详情 */
  detail?: string;
  /** 错误提示 */
  hint?: string;
  /** 涉及的表名 */
  table?: string;
  /** 涉及的列名 */
  column?: string;
  /** 涉及的约束名 */
  constraint?: string;
  /** 错误所在文件 */
  file?: string;
  /** 错误所在行号 */
  line?: string;
  /** 错误所在例程 */
  routine?: string;
}

/**
 * 类型守卫：判断是否为 PostgreSQL 错误
 *
 * @param error - 待检查的错误对象
 * @returns 如果是 PostgreSQL 错误返回 true
 *
 * @example
 * try {
 *   await db.insert(table).values(data);
 * } catch (error) {
 *   if (isPostgreSQLError(error)) {
 *     console.log('错误代码:', error.code);
 *     console.log('错误详情:', error.detail);
 *   }
 * }
 */
export function isPostgreSQLError(error: unknown): error is PostgreSQLError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as PostgreSQLError).code === "string"
  );
}

/**
 * 检查是否为唯一约束冲突错误
 *
 * @param error - 错误对象
 * @returns 如果是唯一约束冲突返回 true
 *
 * @example
 * if (isUniqueViolation(error)) {
 *   return { success: false, error: '该记录已存在' };
 * }
 */
export function isUniqueViolation(error: unknown): boolean {
  return isPostgreSQLError(error) && error.code === PostgreSQLErrorCode.UNIQUE_VIOLATION;
}

/**
 * 检查是否为外键约束冲突错误
 *
 * @param error - 错误对象
 * @returns 如果是外键约束冲突返回 true
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return isPostgreSQLError(error) && error.code === PostgreSQLErrorCode.FOREIGN_KEY_VIOLATION;
}

/**
 * 检查是否为非空约束冲突错误
 *
 * @param error - 错误对象
 * @returns 如果是非空约束冲突返回 true
 */
export function isNotNullViolation(error: unknown): boolean {
  return isPostgreSQLError(error) && error.code === PostgreSQLErrorCode.NOT_NULL_VIOLATION;
}

/**
 * 获取用户友好的错误消息
 *
 * @param error - 错误对象
 * @returns 用户友好的错误消息
 *
 * @example
 * try {
 *   await createBrand(data);
 * } catch (error) {
 *   const message = getFriendlyErrorMessage(error);
 *   return { success: false, error: message };
 * }
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (!isPostgreSQLError(error)) {
    return error instanceof Error ? error.message : "未知错误";
  }

  switch (error.code) {
    case PostgreSQLErrorCode.UNIQUE_VIOLATION:
      return error.constraint
        ? `该记录已存在（约束：${error.constraint}）`
        : "该记录已存在";

    case PostgreSQLErrorCode.FOREIGN_KEY_VIOLATION:
      return "关联的数据不存在或已被删除";

    case PostgreSQLErrorCode.NOT_NULL_VIOLATION:
      return error.column ? `字段 "${error.column}" 不能为空` : "必填字段不能为空";

    case PostgreSQLErrorCode.CHECK_VIOLATION:
      return error.constraint
        ? `数据验证失败（约束：${error.constraint}）`
        : "数据验证失败";

    case PostgreSQLErrorCode.INVALID_TEXT_REPRESENTATION:
      return "数据格式错误";

    case PostgreSQLErrorCode.NUMERIC_VALUE_OUT_OF_RANGE:
      return "数值超出允许范围";

    default:
      return error.message || "数据库操作失败";
  }
}
