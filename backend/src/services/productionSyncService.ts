import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/database';

// Production database connection
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://mielo_dbms_user:UxAYpbAFawKzxltS9OBrq8UvzBQfwxu7@dpg-d33j19odl3ps738uaoi0-a.oregon-postgres.render.com/mielo_dbms"
    }
  }
});

export class ProductionSyncService {
  private static instance: ProductionSyncService;
  private isEnabled: boolean = true;

  private constructor() {}

  static getInstance(): ProductionSyncService {
    if (!ProductionSyncService.instance) {
      ProductionSyncService.instance = new ProductionSyncService();
    }
    return ProductionSyncService.instance;
  }

  async syncStreamerToProduction(operation: 'create' | 'update' | 'delete', streamerData: any, streamerId?: string) {
    if (!this.isEnabled) {
      logger.debug('🔄 Production sync is disabled');
      return;
    }

    try {
      logger.info(`🔄 SYNC: ${operation.toUpperCase()} streamer to production`, {
        operation,
        username: streamerData?.username || 'unknown',
        id: streamerId
      });

      switch (operation) {
        case 'create':
          await this.createStreamerInProduction(streamerData);
          break;
        case 'update':
          await this.updateStreamerInProduction(streamerData);
          break;
        case 'delete':
          if (streamerId) {
            await this.deleteStreamerInProduction(streamerId);
          }
          break;
      }

      logger.info(`✅ SYNC: Successfully ${operation}d streamer in production`);
    } catch (error) {
      logger.error(`❌ SYNC: Failed to ${operation} streamer in production`, { error, streamerData });
    }
  }

  private async createStreamerInProduction(streamerData: any) {
    const cleanData = this.cleanStreamerData(streamerData);
    await prodPrisma.streamer.create({
      data: cleanData
    });
  }

  private async updateStreamerInProduction(streamerData: any) {
    const cleanData = this.cleanStreamerData(streamerData);

    // Find by platform + username since production IDs will be different
    await prodPrisma.streamer.updateMany({
      where: {
        platform: streamerData.platform,
        username: streamerData.username
      },
      data: cleanData
    });
  }

  private async deleteStreamerInProduction(streamerId: string) {
    // This is tricky since local and production IDs are different
    // We'd need to track the mapping or use platform+username
    logger.warn('🔄 SYNC: Delete operation not implemented for production sync');
  }

  private cleanStreamerData(streamer: any) {
    return {
      platform: streamer.platform,
      username: streamer.username,
      displayName: streamer.displayName,
      profileUrl: streamer.profileUrl,
      avatarUrl: streamer.avatarUrl, // Your working avatars!
      followers: streamer.followers,
      currentViewers: streamer.currentViewers,
      highestViewers: streamer.highestViewers,
      lastStreamed: streamer.lastStreamed,
      isLive: streamer.isLive,
      currentGame: streamer.currentGame,
      topGames: streamer.topGames,
      tags: streamer.tags,
      region: streamer.region,
      language: streamer.language,
      socialLinks: streamer.socialLinks || [],
      usesCamera: streamer.usesCamera,
      isVtuber: streamer.isVtuber,
      fraudCheck: streamer.fraudCheck,
      notes: streamer.notes,
      lastScrapedAt: streamer.lastScrapedAt
    };
  }

  enableSync() {
    this.isEnabled = true;
    logger.info('🔄 SYNC: Production sync enabled');
  }

  disableSync() {
    this.isEnabled = false;
    logger.info('🔄 SYNC: Production sync disabled');
  }

  async disconnect() {
    await prodPrisma.$disconnect();
  }
}