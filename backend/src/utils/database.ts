import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ProductionSyncService } from '../services/productionSyncService';

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL_POOLER || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_POOLER is not defined');
}

// Configuration based on connection type
const poolConfig = isProduction ? {
  connection_limit: 8,
  pool_timeout: 30,
  connect_timeout: 10,
  pgbouncer: true
} : {
  connection_limit: 5,
  pool_timeout: 30,
  connect_timeout: 10,
  statement_cache_size: 0
};

const params = new URLSearchParams(poolConfig as any);
const connectionString = `${databaseUrl}?${params.toString()}`;
// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (e) {
  // noop: if we can't create logs dir, fallback to console-only logs
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    ...(fs.existsSync(logsDir)
      ? [
          new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
          new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
        ]
      : [])
  ],
});

class DatabaseService extends PrismaClient {
  private syncService: ProductionSyncService;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error'] : [ 'info', 'warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    this.syncService = ProductionSyncService.getInstance();
    this.initializeConnections();
    this.setupProductionSync();
    logger.info('Database service initialized');
  }

  private setupProductionSync() {
    // DISABLED: Production sync middleware is disabled to prevent accidental tag resets
    // Tags are now synced manually using syncTagsToProduction.ts when needed
    // This prevents the middleware from overwriting enriched tags in production
    logger.info('🔄 Production sync middleware DISABLED (manual sync only)');
  }

  private async initializeConnections() {
    try {
      await this.$connect();
      logger.info('PostgreSQL connected successfully');
      // Redis removed for production performance - caching handled by HTTP headers
    } catch (error) {
      logger.error('Database initialization error:', error);
      throw error; // Re-throw DB errors since they're critical
    }
  }

  // Cache methods removed - using HTTP caching instead for better performance
  async cacheGet(key: string): Promise<string | null> {
    return null;
  }

  async cacheSet(key: string, value: string, ttl: number = 3600): Promise<void> {
    return;
  }

  async cacheDel(key: string): Promise<void> {
    return;
  }

  async cacheFlushPattern(pattern: string): Promise<void> {
    return;
  }

  async disconnect() {
    try {
      await this.$disconnect();
      await this.syncService.disconnect();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Database disconnect error:', error);
    }
  }
}

export const db = new DatabaseService();
export { logger };
