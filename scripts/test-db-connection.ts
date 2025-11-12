import { getDb } from '../db';
import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await getDb().execute(sql`SELECT NOW() as current_time`);
    console.log('✅ Database connected successfully!');
    if (result && result.length > 0) {
      console.log('Server time:', result[0]);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();