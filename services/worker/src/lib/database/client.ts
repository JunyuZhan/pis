
import { createSupabaseCompatClient, SupabaseCompatClient } from './supabase-compat.js';
import { createPostgreSQLCompatClient, PostgreSQLCompatClient } from './postgresql-compat.js';
import logger from '../logger.js';

const dbType = (process.env.DATABASE_TYPE || 'postgresql').toLowerCase();
let dbClient: SupabaseCompatClient | PostgreSQLCompatClient;

if (dbType === 'postgresql') {
  // PostgreSQL 模式：使用 PostgreSQL 适配器
  try {
    dbClient = createPostgreSQLCompatClient();
    logger.info({ mode: 'postgresql' }, '✅ Database client initialized');
  } catch (err: any) {
    logger.fatal({ err }, '❌ Failed to initialize PostgreSQL database client');
    process.exit(1);
  }
} else {
  // Supabase 模式：使用 Supabase 客户端
  try {
    dbClient = createSupabaseCompatClient();
    logger.info({ mode: 'supabase' }, '✅ Database client initialized');
  } catch (err: any) {
    logger.fatal({ err }, '❌ Failed to initialize Supabase database client');
    process.exit(1);
  }
}

export const db = dbClient;
