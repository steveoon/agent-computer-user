import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from 'dotenv';
import path from 'path';
import * as schema from "./schema";

/**
 * Database client for Drizzle ORM
 *
 * IMPORTANT: For Supabase connection pooling (transaction mode),
 * set { prepare: false } to disable prepared statements.
 *
 * Connection modes:
 * - Session mode: Use default settings (开发环境)
 * - Transaction mode: Add { prepare: false } (生产环境推荐)
 */

// 在开发环境下加载环境变量
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

/**
 * 数据库实例缓存
 * 使用懒初始化模式，避免模块加载时的副作用
 */
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * 获取数据库实例（懒初始化）
 *
 * 优点：
 * - 避免模块加载期的副作用（不会在 Next.js build 阶段创建连接）
 * - 清晰的错误信息（缺少 DATABASE_URL 时明确报错）
 * - 单例模式（多次调用返回同一实例）
 *
 * @throws {Error} 如果 DATABASE_URL 未设置
 * @returns Drizzle ORM 数据库实例
 */
export function getDb(): ReturnType<typeof drizzle> {
  // 如果已有实例，直接返回
  if (dbInstance) {
    return dbInstance;
  }

  // 检查是否在测试环境
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

  if (isTestEnvironment) {
    // 测试环境：返回空对象，实际操作应该被 mock
    console.warn(
      "[Database] Running in test environment. Database operations should be mocked."
    );
    dbInstance = {} as ReturnType<typeof drizzle>;
    return dbInstance;
  }

  // 生产/开发环境：必须提供 DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[Database] DATABASE_URL environment variable is required for database operations. " +
      "Please set DATABASE_URL in your environment variables (.env.local or production environment)."
    );
  }

  // 创建 PostgreSQL 连接
  // Supabase Transaction pooling requires prepare: false
  const client = postgres(process.env.DATABASE_URL, {
    prepare: false, // Required for Supabase transaction pooling
  });

  // 创建 Drizzle 实例并缓存
  dbInstance = drizzle({ client, schema });
  return dbInstance;
}

// Export schema
export { schema };