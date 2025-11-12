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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create PostgreSQL connection
// Supabase Transaction pooling requires prepare: false
const client = postgres(process.env.DATABASE_URL, {
  prepare: false, // Required for Supabase transaction pooling
});

// Create Drizzle instance with schema
export const db = drizzle({ client, schema });

// Export schema for use in queries
export { schema };