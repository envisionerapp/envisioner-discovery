#!/usr/bin/env ts-node

import { Command } from 'commander';
import { db, logger } from '../src/utils/database';
import dotenv from 'dotenv';
import { databaseSyncService } from '../src/services/databaseSyncService';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('sync-to-prod')
  .description('Sync local database changes to production')
  .version('1.0.0');

// Full sync command
program
  .command('full')
  .description('Perform full database sync to production')
  .action(async () => {
    try {
      console.log('🚀 Starting full sync to production...');

      const localCount = await db.streamer.count();
      console.log(`📊 Local database has ${localCount.toLocaleString()} streamers`);

      await databaseSyncService.startSync();

      console.log('✅ Full sync completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      process.exit(1);
    }
  });

// Incremental sync command
program
  .command('incremental')
  .description('Sync only changed records since last sync')
  .action(async () => {
    try {
      console.log('🔄 Starting incremental sync...');

      await databaseSyncService.triggerSync();

      console.log('✅ Incremental sync completed!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      process.exit(1);
    }
  });

// Watch mode - continuous sync
program
  .command('watch')
  .description('Start continuous sync (watch for changes)')
  .option('-i, --interval <seconds>', 'Sync interval in seconds', '300')
  .action(async (options) => {
    try {
      console.log('👀 Starting watch mode - continuous sync...');
      console.log(`⏱️  Sync interval: ${options.interval} seconds`);

      await databaseSyncService.startSync();

      // Keep process running
      console.log('🔄 Sync service running... Press Ctrl+C to stop');

      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping sync service...');
        await databaseSyncService.stopSync();
        process.exit(0);
      });

      // Keep alive
      setInterval(() => {}, 1000);

    } catch (error) {
      console.error('❌ Watch mode failed:', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check sync status and database counts')
  .action(async () => {
    try {
      const localCount = await db.streamer.count();

      // Get production count
      const prodResponse = await fetch(`${process.env.PRODUCTION_API_URL}/api/streamers/stats`);
      const prodData = await prodResponse.json();
      const prodCount = prodData.data.total;

      console.log('📊 Database Status:');
      console.log(`   Local:      ${localCount.toLocaleString()} streamers`);
      console.log(`   Production: ${prodCount.toLocaleString()} streamers`);
      console.log(`   Difference: ${(localCount - prodCount).toLocaleString()}`);

      if (localCount === prodCount) {
        console.log('✅ Databases are in sync!');
      } else {
        console.log('⚠️  Databases are out of sync');
      }

      process.exit(0);
    } catch (error) {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    }
  });

// Compare databases
program
  .command('diff')
  .description('Show differences between local and production')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(async (options) => {
    try {
      console.log('🔍 Comparing databases...');

      // Get recent changes from local
      const recentChanges = await db.streamer.findMany({
        orderBy: { updatedAt: 'desc' },
        take: parseInt(options.limit),
        select: {
          username: true,
          displayName: true,
          platform: true,
          followers: true,
          updatedAt: true,
        }
      });

      console.log('\n📝 Recent local changes:');
      recentChanges.forEach((streamer, index) => {
        console.log(`${index + 1}. ${streamer.displayName} (${streamer.platform})`);
        console.log(`   Followers: ${streamer.followers?.toLocaleString()}`);
        console.log(`   Updated: ${streamer.updatedAt.toISOString()}`);
        console.log('');
      });

      process.exit(0);
    } catch (error) {
      console.error('❌ Diff failed:', error);
      process.exit(1);
    }
  });

program.parse();