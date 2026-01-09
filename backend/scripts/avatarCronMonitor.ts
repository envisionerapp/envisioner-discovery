#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import * as path from 'path';
import { db, logger } from '../src/utils/database';

interface CronStats {
  lastRunTime?: Date;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRuntime: number;
  recentRuns: Array<{
    date: Date;
    success: boolean;
    runtime: number;
    processed: number;
  }>;
}

class AvatarCronMonitor {
  private logDir: string;

  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs', 'avatar-cron');
  }

  async getDatabaseStats(): Promise<{
    totalStreamers: number;
    streamersWithAvatars: number;
    streamersWithoutAvatars: number;
    byPlatform: Record<string, { total: number; withAvatars: number; withoutAvatars: number }>;
  }> {
    const totalStreamers = await db.streamer.count();
    const streamersWithAvatars = await db.streamer.count({
      where: {
        AND: [
          { avatarUrl: { not: null } },
          { avatarUrl: { not: '' } }
        ]
      }
    });
    const streamersWithoutAvatars = totalStreamers - streamersWithAvatars;

    // Get stats by platform
    const platforms = await db.streamer.findMany({
      select: { platform: true },
      distinct: ['platform']
    });

    const byPlatform: Record<string, { total: number; withAvatars: number; withoutAvatars: number }> = {};

    for (const { platform } of platforms) {
      const total = await db.streamer.count({ where: { platform } });
      const withAvatars = await db.streamer.count({
        where: {
          platform,
          AND: [
            { avatarUrl: { not: null } },
            { avatarUrl: { not: '' } }
          ]
        }
      });

      byPlatform[platform] = {
        total,
        withAvatars,
        withoutAvatars: total - withAvatars
      };
    }

    return {
      totalStreamers,
      streamersWithAvatars,
      streamersWithoutAvatars,
      byPlatform
    };
  }

  getCronStats(): CronStats {
    const stats: CronStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageRuntime: 0,
      recentRuns: []
    };

    if (!fs.existsSync(this.logDir)) {
      return stats;
    }

    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('avatar-cron-') && file.endsWith('.log'))
        .sort()
        .slice(-7); // Last 7 days

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        let runStart: Date | null = null;
        let runEnd: Date | null = null;
        let processed = 0;
        let success = false;

        for (const line of lines) {
          if (line.includes('Starting avatar cron job')) {
            const match = line.match(/\[([\d-T:\.Z]+)\]/);
            if (match) {
              runStart = new Date(match[1]);
            }
          }

          if (line.includes('Avatar cron job completed successfully')) {
            const match = line.match(/\[([\d-T:\.Z]+)\]/);
            if (match) {
              runEnd = new Date(match[1]);
              success = true;
            }
          }

          if (line.includes('processed":')) {
            const processedMatch = line.match(/"processed":(\d+)/);
            if (processedMatch) {
              processed += parseInt(processedMatch[1], 10);
            }
          }
        }

        if (runStart) {
          stats.totalRuns++;
          if (success) {
            stats.successfulRuns++;
          } else {
            stats.failedRuns++;
          }

          const runtime = runEnd ? runEnd.getTime() - runStart.getTime() : 0;
          stats.recentRuns.push({
            date: runStart,
            success,
            runtime: runtime / 1000, // Convert to seconds
            processed
          });

          if (!stats.lastRunTime || runStart > stats.lastRunTime) {
            stats.lastRunTime = runStart;
          }
        }
      }

      // Calculate average runtime
      const validRuntimes = stats.recentRuns.filter(run => run.runtime > 0);
      if (validRuntimes.length > 0) {
        stats.averageRuntime = validRuntimes.reduce((sum, run) => sum + run.runtime, 0) / validRuntimes.length;
      }

    } catch (error) {
      logger.error('Error parsing cron logs:', error);
    }

    return stats;
  }

  async generateReport(): Promise<void> {
    console.log('🔍 Avatar Cron Job Monitor Report');
    console.log('═'.repeat(50));
    console.log();

    // Database stats
    console.log('📊 Database Statistics:');
    const dbStats = await this.getDatabaseStats();
    console.log(`   Total streamers: ${dbStats.totalStreamers.toLocaleString()}`);
    console.log(`   With avatars: ${dbStats.streamersWithAvatars.toLocaleString()} (${((dbStats.streamersWithAvatars / dbStats.totalStreamers) * 100).toFixed(1)}%)`);
    console.log(`   Without avatars: ${dbStats.streamersWithoutAvatars.toLocaleString()} (${((dbStats.streamersWithoutAvatars / dbStats.totalStreamers) * 100).toFixed(1)}%)`);
    console.log();

    console.log('📱 By Platform:');
    for (const [platform, stats] of Object.entries(dbStats.byPlatform)) {
      const percentage = ((stats.withAvatars / stats.total) * 100).toFixed(1);
      console.log(`   ${platform}: ${stats.withAvatars}/${stats.total} (${percentage}%) have avatars`);
    }
    console.log();

    // Cron stats
    console.log('⏱️  Cron Job Statistics:');
    const cronStats = this.getCronStats();
    console.log(`   Total runs: ${cronStats.totalRuns}`);
    console.log(`   Successful: ${cronStats.successfulRuns}`);
    console.log(`   Failed: ${cronStats.failedRuns}`);
    console.log(`   Success rate: ${cronStats.totalRuns > 0 ? ((cronStats.successfulRuns / cronStats.totalRuns) * 100).toFixed(1) : 0}%`);
    console.log(`   Average runtime: ${cronStats.averageRuntime.toFixed(1)} seconds`);

    if (cronStats.lastRunTime) {
      console.log(`   Last run: ${cronStats.lastRunTime.toLocaleString()}`);
    } else {
      console.log(`   Last run: Never`);
    }
    console.log();

    if (cronStats.recentRuns.length > 0) {
      console.log('📈 Recent Runs (last 7 days):');
      cronStats.recentRuns.slice(-5).forEach((run, index) => {
        const status = run.success ? '✅' : '❌';
        const runtime = run.runtime > 0 ? `${run.runtime.toFixed(1)}s` : 'Unknown';
        console.log(`   ${status} ${run.date.toLocaleString()} - ${runtime} - ${run.processed} processed`);
      });
      console.log();
    }

    // Check if cron is installed
    console.log('🔧 Cron Job Status:');
    try {
      const { execSync } = require('child_process');
      const cronList = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });

      if (cronList.includes('avatarCronJob') || cronList.includes('avatar-cron-wrapper')) {
        console.log('   ✅ Cron job is installed');

        const cronLines = cronList.split('\n').filter((line: string) =>
          line.includes('avatarCronJob') || line.includes('avatar-cron-wrapper')
        );

        cronLines.forEach((line: string) => {
          console.log(`   Schedule: ${line.split(' ').slice(0, 5).join(' ')}`);
        });
      } else {
        console.log('   ❌ Cron job is not installed');
        console.log('   Run: bash scripts/installAvatarCron.sh');
      }
    } catch (error) {
      console.log('   ⚠️  Could not check cron status');
    }
    console.log();

    // Recommendations
    console.log('💡 Recommendations:');
    if (dbStats.streamersWithoutAvatars > 1000) {
      console.log('   • Large number of streamers without avatars - consider running manual batches');
    }
    if (cronStats.failedRuns > cronStats.successfulRuns && cronStats.totalRuns > 2) {
      console.log('   • High failure rate - check logs for errors');
    }
    if (cronStats.totalRuns === 0) {
      console.log('   • No cron runs detected - install and test the cron job');
    }
    if (cronStats.averageRuntime > 1800) { // 30 minutes
      console.log('   • Long runtime detected - consider reducing batch sizes');
    }
    console.log();

    // Log files info
    console.log('📋 Log Files:');
    if (fs.existsSync(this.logDir)) {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .sort()
        .slice(-5);

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`   ${file} (${sizeKB} KB) - ${stats.mtime.toLocaleDateString()}`);
      });

      console.log(`   Location: ${this.logDir}`);
    } else {
      console.log('   No log directory found');
    }
  }
}

async function main() {
  const monitor = new AvatarCronMonitor();

  try {
    await monitor.generateReport();
  } catch (error) {
    logger.error('Failed to generate monitor report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}