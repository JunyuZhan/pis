/**
 * 数据库适配器类型定义
 * PIS Standalone 版本支持 Supabase（云端）和 PostgreSQL（自托管）两种数据库后端
 */

export interface DatabaseConfig {
  type: 'supabase' | 'postgresql';
  // Supabase 配置（当 type='supabase' 时使用）
  supabaseUrl?: string;
  supabaseKey?: string;
  // PostgreSQL 配置（当 type='postgresql' 时使用）
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface QueryResult<T = any> {
  data: T[] | null;
  error: Error | null;
  count?: number;
}

export interface DatabaseAdapter {
  /**
   * 查询单条记录
   */
  findOne<T = any>(
    table: string,
    filters: Record<string, any>
  ): Promise<{ data: T | null; error: Error | null }>;
  
  /**
   * 查询多条记录
   */
  findMany<T = any>(
    table: string,
    filters?: Record<string, any>,
    options?: {
      select?: string[];
      limit?: number;
      offset?: number;
      orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    }
  ): Promise<QueryResult<T>>;
  
  /**
   * 插入记录
   */
  insert<T = any>(
    table: string,
    data: T | T[]
  ): Promise<{ data: T[] | null; error: Error | null }>;
  
  /**
   * 更新记录
   */
  update<T = any>(
    table: string,
    filters: Record<string, any>,
    data: Partial<T>
  ): Promise<{ data: T[] | null; error: Error | null }>;
  
  /**
   * 删除记录
   */
  delete(
    table: string,
    filters: Record<string, any>
  ): Promise<{ error: Error | null }>;
  
  /**
   * 计数
   */
  count(
    table: string,
    filters?: Record<string, any>
  ): Promise<number>;
}
