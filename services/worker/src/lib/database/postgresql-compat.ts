/**
 * PostgreSQL 兼容层
 * 
 * 提供与 Supabase Client 类似的 API 接口，用于 PostgreSQL 自托管模式
 */
import { PostgreSQLAdapter } from './postgresql-adapter.js';
import { createDatabaseAdapter } from './index.js';

/**
 * PostgreSQL 兼容客户端
 * 提供与 Supabase Client 类似的 API 接口
 */
export class PostgreSQLCompatClient {
  private adapter: PostgreSQLAdapter;

  constructor(adapter: PostgreSQLAdapter) {
    this.adapter = adapter;
  }

  /**
   * 查询构建器（模拟 Supabase 的 from 方法）
   */
  from<T = any>(table: string): PostgresQueryBuilder<T> {
    return new PostgresQueryBuilder<T>(this.adapter, table);
  }

  /**
   * 调用数据库函数 (RPC)
   * PostgreSQL 使用 CALL 或 SELECT function_name()
   */
  async rpc(functionName: string, params?: Record<string, any>): Promise<{ data: any; error: Error | null }> {
    try {
      // 构建参数化查询
      const paramNames = params ? Object.keys(params) : [];
      const paramValues = params ? Object.values(params) : [];
      const paramPlaceholders = paramValues.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = paramNames.length > 0
        ? `SELECT ${functionName}(${paramPlaceholders})`
        : `SELECT ${functionName}()`;
      
      // 使用 adapter 执行查询（需要访问 adapter 的内部方法）
      const result = await (this.adapter as any).pool.query(query, paramValues);
      
      return {
        data: result.rows.length > 0 ? result.rows[0][functionName] : null,
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err,
      };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.adapter.close();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.adapter.findOne('albums', { id: '00000000-0000-0000-0000-000000000000' });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

/**
 * PostgreSQL 查询构建器（模拟 Supabase 查询构建器）
 */
class PostgresQueryBuilder<T = any> {
  private adapter: PostgreSQLAdapter;
  private table: string;
  private filters: Record<string, any> = {};
  private orderBy: { column: string; direction: 'asc' | 'desc' }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectColumns?: string[];

  constructor(adapter: PostgreSQLAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
  }

  eq(column: string, value: any): this {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: any): this {
    // PostgreSQL 不支持 neq，使用 NOT (column = value)
    this.filters[`!${column}`] = value;
    return this;
  }

  gt(column: string, value: any): this {
    this.filters[`${column}>`] = value;
    return this;
  }

  gte(column: string, value: any): this {
    this.filters[`${column}>=`] = value;
    return this;
  }

  lt(column: string, value: any): this {
    this.filters[`${column}<`] = value;
    return this;
  }

  lte(column: string, value: any): this {
    this.filters[`${column}<=`] = value;
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters[`${column}~`] = pattern;
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters[`${column}~~`] = pattern;
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters[`${column}[]`] = values;
    return this;
  }

  is(column: string, value: any): this {
    this.filters[`${column}?`] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy.push({
      column,
      direction: options?.ascending === false ? 'desc' : 'asc',
    });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  select(columns: string): this {
    this.selectColumns = columns.split(',').map((c) => c.trim());
    return this;
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    this.limitValue = 1;
    const result = await this.adapter.findMany<T>(
      this.table,
      this.filters,
      {
        select: this.selectColumns,
        limit: this.limitValue,
        offset: this.offsetValue,
        orderBy: this.orderBy.length > 0 ? this.orderBy : undefined,
      }
    );
    
    return {
      data: result.data && result.data.length > 0 ? result.data[0] : null,
      error: result.error,
    };
  }

  async then<TResult1 = { data: T[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.adapter.findMany<T>(
      this.table,
      this.filters,
      {
        select: this.selectColumns,
        limit: this.limitValue,
        offset: this.offsetValue,
        orderBy: this.orderBy.length > 0 ? this.orderBy : undefined,
      }
    );
    
    if (result.error && onrejected) {
      return onrejected(result.error);
    }
    
    if (onfulfilled) {
      return onfulfilled(result);
    }
    
    return result as TResult1;
  }
}

/**
 * 从环境变量创建 PostgreSQL 兼容客户端
 */
export function createPostgreSQLCompatClient(): PostgreSQLCompatClient {
  const adapter = createDatabaseAdapter() as PostgreSQLAdapter;
  return new PostgreSQLCompatClient(adapter);
}
