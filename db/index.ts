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

// 检查是否在测试环境
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// 检查数据库 URL
if (!process.env.DATABASE_URL && !isTestEnvironment) {
  throw new Error("DATABASE_URL environment variable is not set");
}

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
  // 测试环境下的 mock 数据库
  console.warn(
    "[Database] DATABASE_URL not set in test environment. Database operations will be mocked."
  );
  // 导出一个 mock 的 db 对象，防止测试导入时报错
  // 实际的数据库操作在测试中应该被 mock
  db = {} as ReturnType<typeof drizzle>;
}

// Export database and schema
export { db, schema };