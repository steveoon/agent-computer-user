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

// 检查是否在非生产环境（测试、build 等）
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// 创建数据库连接或 mock
let db: ReturnType<typeof drizzle>;

if (process.env.DATABASE_URL) {
  // Create PostgreSQL connection
  // Supabase Transaction pooling requires prepare: false
  const client = postgres(process.env.DATABASE_URL, {
    prepare: false, // Required for Supabase transaction pooling
  });

  // Create Drizzle instance with schema
  db = drizzle({ client, schema });
} else {
  // 在以下情况创建 mock 数据库，避免模块加载失败：
  // 1. 测试环境（Vitest 或 NODE_ENV=test）
  // 2. Next.js build 阶段（收集页面数据时可能导入 db）
  // 3. 其他开发场景
  //
  // 实际的数据库操作在运行时如果没有真实连接会报错
  if (isTestEnvironment) {
    console.warn(
      "[Database] DATABASE_URL not set in test environment. Database operations will be mocked."
    );
  } else if (isBuildTime) {
    console.warn(
      "[Database] DATABASE_URL not set during Next.js build. Using mock database for module resolution."
    );
  } else {
    console.warn(
      "[Database] DATABASE_URL not set. Database operations will fail at runtime."
    );
  }

  // 导出一个 mock 的 db 对象，防止导入时报错
  // 实际的数据库操作在测试中应该被 mock，在生产环境中应该配置 DATABASE_URL
  db = {} as ReturnType<typeof drizzle>;
}

// Export database and schema
export { db, schema };