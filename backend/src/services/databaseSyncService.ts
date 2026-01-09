import { db, logger } from '../utils/database';
import { PrismaClient } from '@prisma/client';

interface SyncConfig {
  productionApiUrl: string;
  apiKey: string; // Secure API key for production access
  syncInterval: number; // milliseconds
  batchSize: number;
}

export class DatabaseSyncService {
  private config: SyncConfig;
  private isRunning = false;
  private lastSyncTime = new Date(0);

  constructor(config: SyncConfig) {
    this.config = config;
  }

  // Start automatic sync process
  async startSync(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync service already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting database sync service', {
      interval: this.config.syncInterval,
      production: this.config.productionApiUrl
    });

    // Initial full sync
    await this.performFullSync();

    // Then incremental syncs
    this.scheduleIncrementalSync();
  }

  // Full database sync (initial)
  private async performFullSync(): Promise<void> {
    try {
      logger.info('Starting full database sync...');

      // Get all streamers from local DB
      const streamers = await db.streamer.findMany({
        orderBy: { updatedAt: 'desc' }
      });

      // Push to production in batches
      const batches = this.chunkArray(streamers, this.config.batchSize);
      let totalSynced = 0;

      for (const batch of batches) {
        await this.pushBatchToProduction(batch);
        totalSynced += batch.length;
        logger.info(`Synced batch: ${totalSynced}/${streamers.length}`);

        // Rate limiting
        await this.delay(1000);
      }

      this.lastSyncTime = new Date();
      logger.info(`Full sync completed: ${totalSynced} streamers`);

    } catch (error) {
      logger.error('Full sync failed', { error });
      throw error;
    }
  }

  // Incremental sync (only changed records)
  private async performIncrementalSync(): Promise<void> {
    try {
      // Get records changed since last sync
      const changedStreamers = await db.streamer.findMany({
        where: {
          updatedAt: { gt: this.lastSyncTime }
        },
        orderBy: { updatedAt: 'asc' }
      });

      if (changedStreamers.length === 0) {
        logger.debug('No changes to sync');
        return;
      }

      logger.info(`Syncing ${changedStreamers.length} changed records...`);

      // Push changes to production
      await this.pushBatchToProduction(changedStreamers);

      this.lastSyncTime = new Date();
      logger.info(`Incremental sync completed: ${changedStreamers.length} records`);

    } catch (error) {
      logger.error('Incremental sync failed', { error });
    }
  }

  // Push data to production API
  private async pushBatchToProduction(streamers: any[]): Promise<void> {
    try {
      const response = await fetch(`${this.config.productionApiUrl}/api/admin/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'Authorization': `Bearer ${await this.getProductionToken()}`
        },
        body: JSON.stringify({
          streamers: streamers.map(s => ({
            platform: s.platform,
            username: s.username,
            displayName: s.displayName,
            profileUrl: s.profileUrl,
            avatarUrl: s.avatarUrl,
            followers: s.followers,
            currentViewers: s.currentViewers,
            highestViewers: s.highestViewers,
            isLive: s.isLive,
            currentGame: s.currentGame,
            topGames: s.topGames,
            tags: s.tags,
            region: s.region,
            language: s.language,
            usesCamera: s.usesCamera,
            isVtuber: s.isVtuber,
            fraudCheck: s.fraudCheck,
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Production sync failed: ${response.status}`);
      }

      const result = await response.json();
      logger.debug('Batch synced to production', result.data);

    } catch (error) {
      logger.error('Failed to push batch to production', { error });
      throw error;
    }
  }

  // Get production authentication token
  private async getProductionToken(): Promise<string> {
    // Cache the token and refresh when needed
    // Implementation depends on your auth system
    return process.env.PRODUCTION_SYNC_TOKEN || '';
  }

  // Schedule incremental syncs
  private scheduleIncrementalSync(): void {
    setInterval(async () => {
      if (this.isRunning) {
        await this.performIncrementalSync();
      }
    }, this.config.syncInterval);
  }

  // Stop sync service
  async stopSync(): Promise<void> {
    this.isRunning = false;
    logger.info('Database sync service stopped');
  }

  // Manual sync trigger
  async triggerSync(): Promise<void> {
    logger.info('Manual sync triggered');
    await this.performIncrementalSync();
  }

  // Utility methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const syncConfig: SyncConfig = {
  productionApiUrl: process.env.PRODUCTION_API_URL || 'https://api.miela.cc',
  apiKey: process.env.PRODUCTION_API_KEY || '',
  syncInterval: parseInt(process.env.SYNC_INTERVAL_MS || '300000'), // 5 minutes
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '50'),
};

export const databaseSyncService = new DatabaseSyncService(syncConfig);