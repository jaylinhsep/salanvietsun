import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      this.configService.get<string>('DATABASE_URL') ||
      'postgresql://vietsun:vietsun_secret_password@localhost:5432/salanvietsun_tms';

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
  }

  async onModuleInit() {
    try {
      const res = await this.pool.query('SELECT PostGIS_Version() AS postgis_version');
      this.isConnected = true;
      this.logger.log(`PostgreSQL + PostGIS connected (${res.rows[0]?.postgis_version})`);
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(
        `PostgreSQL/PostGIS not reachable (${err.message}). API running — configure DATABASE_URL in .env to enable persistence.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const res = await this.pool.query<T>(text, params);
    this.isConnected = true;
    return res;
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
