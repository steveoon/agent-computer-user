import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// 加载环境变量 (.env.local, .env, etc.)
// 优先加载 .env.local，然后是 .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  out: './drizzle',                    // 迁移文件输出目录
  schema: './db/schema.ts',            // Schema 定义位置
  dialect: 'postgresql',               // 使用 PostgreSQL
  dbCredentials: {
    url: process.env.DATABASE_URL!,    // 数据库连接字符串
  },
  schemaFilter: ['app_huajune'],       // 指定使用的 schema（多项目共用数据库时的逻辑隔离）
});