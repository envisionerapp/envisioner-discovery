#!/usr/bin/env npx ts-node

import { updateAllAvatars } from './updateAvatars';
import { db, logger } from '../src/utils/database';
import { Platform } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface CronJobConfig {
  batchSizes: {
    [Platform.TWITCH]: number;
    [Platform.YOUTUBE]: number;
    [Platform.KICK]: number;
    [Platform.FACEBOOK]: number;
    [Platform.TIKTOK]: number;
  };
  maxRuntimeMinutes: number;
  enabledPlatforms: Platform[];
  logRetentionDays: number;
}

const defaultConfig: CronJobConfig = {
  batchSizes: {
    [Platform.TWITCH]: 50,
    [Platform.YOUTUBE]: 30,
    [Platform.KICK]: 25,
    [Platform.FACEBOOK]: 20,
    [Platform.TIKTOK]: 20
  },
  maxRuntimeMinutes: 30,
  enabledPlatforms: [Platform.TWITCH, Platform.YOUTUBE, Platform.KICK],
  logRetentionDays: 7
};

class AvatarCronJob {
  private config: CronJobConfig;
  private logDir: string;
  private startTime: Date;

  constructor() {
    this.config = this.loadConfig();
    this.logDir = path.join(__dirname, '..', 'logs', 'avatar-cron');
    this.startTime = new Date();
    this.ensureLogDirectory();
  }

  private loadConfig(): CronJobConfig {
    const configPath = path.join(__dirname, 'avatar-cron-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...configData };
      } catch (error) {
        logger.warn('Failed to load cron config, using defaults:', error);
        return defaultConfig;
      }
    }
    return defaultConfig;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const dateStr = this.startTime.toISOString().split('T')[0];
    return path.join(this.logDir, `avatar-cron-${dateStr}.log`);
  }

  private async logToFile(message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    try {
      fs.appendFileSync(this.getLogFileName(), logMessage);
    } catch (error) {
      logger.error('Failed to write to cron log file:', error);
    }
  }

  private async log(message: string, data?: any): Promise<void> {
    logger.info(message, data);
    await this.logToFile(data ? `${message} ${JSON.stringify(data)}` : message);
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.logRetentionDays);

      for (const file of files) {
        if (!file.startsWith('avatar-cron-') || !file.endsWith('.log')) continue;

        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          await this.log(`Cleaned up old log file: ${file}`);
        }
      }
    } catch (error) {
      await this.log('Failed to cleanup old logs:', error);
    }
  }

  private async getPlatformStats(): Promise<Record<string, { pending: number; total: number }>> {
    const stats: Record<string, { pending: number; total: number }> = {};

    for (const platform of this.config.enabledPlatforms) {
      const pending = await db.streamer.count({
        where: {
          platform,
          OR: [{ avatarUrl: null }, { avatarUrl: '' }]
        }
      });

      const total = await db.streamer.count({
        where: { platform }
      });

      stats[platform] = { pending, total };
    }

    return stats;
  }

  private shouldContinueRunning(): boolean {
    const elapsedMinutes = (Date.now() - this.startTime.getTime()) / (1000 * 60);
    return elapsedMinutes < this.config.maxRuntimeMinutes;
  }

  private async updatePlatformAvatars(platform: Platform): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const batchSize = this.config.batchSizes[platform];
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    await this.log(`Starting avatar updates for ${platform}`, { batchSize });

    while (this.shouldContinueRunning()) {
      try {
        const stats = await updateAllAvatars({
          platform,
          limit: batchSize,
          forceUpdate: false
        });

        if (stats.total === 0) {
          await this.log(`No more ${platform} streamers need avatar updates`);
          break;
        }

        totalProcessed += stats.total;
        totalSuccessful += stats.success;
        totalFailed += stats.failed;

        await this.log(`${platform} batch completed`, {
          batch: { processed: stats.total, successful: stats.success, failed: stats.failed },
          totals: { processed: totalProcessed, successful: totalSuccessful, failed: totalFailed }
        });

        // Break if we processed fewer than the batch size (likely done)
        if (stats.total < batchSize) {
          await this.log(`${platform} processing complete - processed fewer than batch size`);
          break;
        }

        // Short break between batches
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        await this.log(`Error processing ${platform} batch:`, error);
        totalFailed += batchSize; // Estimate failed count

        // Wait longer on error before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return {
      processed: totalProcessed,
      successful: totalSuccessful,
      failed: totalFailed
    };
  }

  async run(): Promise<void> {
    await this.log('Starting avatar cron job', {
      config: this.config,
      startTime: this.startTime.toISOString()
    });

    try {
      // Clean up old logs first
      await this.cleanupOldLogs();

      // Get initial stats
      const initialStats = await this.getPlatformStats();
      await this.log('Initial platform statistics', initialStats);

      const results: Record<string, any> = {};

      // Process each enabled platform
      for (const platform of this.config.enabledPlatforms) {
        if (!this.shouldContinueRunning()) {
          await this.log(`Stopping early due to runtime limit for platform ${platform}`);
          break;
        }

        const platformResult = await this.updatePlatformAvatars(platform);
        results[platform] = platformResult;

        await this.log(`Completed ${platform}`, platformResult);
      }

      // Get final stats
      const finalStats = await this.getPlatformStats();
      await this.log('Final platform statistics', finalStats);

      // Calculate summary
      const summary = {
        startTime: this.startTime.toISOString(),
        endTime: new Date().toISOString(),
        runtimeMinutes: Math.round((Date.now() - this.startTime.getTime()) / (1000 * 60)),
        platformResults: results,
        initialStats,
        finalStats
      };

      await this.log('Avatar cron job completed successfully', summary);

    } catch (error) {
      await this.log('Avatar cron job failed:', error);
      throw error;
    }
  }
}

async function main() {
  const cronJob = new AvatarCronJob();

  try {
    await cronJob.run();
    process.exit(0);
  } catch (error) {
    logger.error('Cron job failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down avatar cron job gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down avatar cron job gracefully');
  process.exit(0);
});

if (require.main === module) {
  main();
}