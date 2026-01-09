import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse';
import { db, logger } from './src/utils/database';

interface CSVStreamerData {
  // Common fields that might be in CSV files
  username?: string;
  display_name?: string;
  displayName?: string;
  platform?: string;
  followers?: string | number;
  follower_count?: string | number;
  subscribers?: string | number;
  views?: string | number;
  view_count?: string | number;
  is_live?: string | boolean;
  live?: string | boolean;
  online?: string | boolean;
  current_viewers?: string | number;
  viewers?: string | number;
  language?: string;
  region?: string;
  country?: string;
  category?: string;
  game?: string;
  current_game?: string;
  profile_url?: string;
  avatar_url?: string;
  profile_image?: string;
  description?: string;
  bio?: string;
  created_at?: string;
  [key: string]: any; // Allow for additional fields
}

async function importStreamersFromCSV() {
  console.log('🎬 MIELO CSV STREAMER IMPORT');
  console.log('============================\n');

  // Define CSV file locations - UPDATE THESE PATHS
  const csvFiles = [
    {
      platform: 'TWITCH',
      filePath: './data/twitch_streamers.csv', // UPDATE THIS PATH
      region: 'MEXICO' // Default region, can be overridden by CSV data
    },
    {
      platform: 'YOUTUBE',
      filePath: './data/youtube_creators.csv', // UPDATE THIS PATH
      region: 'MEXICO'
    },
    {
      platform: 'TIKTOK',
      filePath: './data/tiktok_creators.csv', // UPDATE THIS PATH
      region: 'MEXICO'
    }
    // Add more platforms as needed
  ];

  console.log('📂 Looking for CSV files...');

  // Check which files exist
  const availableFiles = csvFiles.filter(file => {
    const exists = fs.existsSync(file.filePath);
    if (exists) {
      console.log(`✅ Found: ${file.filePath} (${file.platform})`);
    } else {
      console.log(`❌ Missing: ${file.filePath} (${file.platform})`);
    }
    return exists;
  });

  if (availableFiles.length === 0) {
    console.log('\n⚠️  No CSV files found!');
    console.log('Please update the file paths in this script to point to your CSV files.');
    console.log('\nExpected locations:');
    csvFiles.forEach(file => {
      console.log(`- ${file.filePath} (${file.platform} data)`);
    });
    return;
  }

  console.log(`\n🎯 Processing ${availableFiles.length} CSV files...\n`);

  // Clear existing test data first
  console.log('🗑️  Clearing test/fake data...');
  await db.streamer.deleteMany({
    where: {
      OR: [
        { displayName: { contains: 'Test' } },
        { displayName: { contains: 'Mock' } },
        { displayName: { contains: 'Fake' } },
        { username: { contains: 'test' } }
      ]
    }
  });

  let totalImported = 0;
  let totalErrors = 0;

  for (const fileConfig of availableFiles) {
    console.log(`\n📊 Processing ${fileConfig.platform} data from ${fileConfig.filePath}...`);

    try {
      const fileContent = fs.readFileSync(fileConfig.filePath, 'utf8');
      const records = await new Promise<CSVStreamerData[]>((resolve, reject) => {
        csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records) => {
          if (err) reject(err);
          else resolve(records);
        });
      });

      console.log(`📝 Found ${records.length} records in CSV`);

      let imported = 0;
      let errors = 0;

      for (const record of records) {
        try {
          // Extract and normalize data from CSV record
          const streamerData = normalizeStreamerData(record, fileConfig);

          if (!streamerData.username) {
            console.log(`⚠️  Skipping record - no username found:`, Object.keys(record));
            errors++;
            continue;
          }

          // Import to database
          const saved = await db.streamer.upsert({
            where: {
              platform_username: {
                platform: streamerData.platform as any,
                username: streamerData.username
              }
            },
            update: {
              displayName: streamerData.displayName,
              followers: streamerData.followers,
              currentViewers: streamerData.currentViewers,
              isLive: streamerData.isLive,
              currentGame: streamerData.currentGame,
              avatarUrl: streamerData.avatarUrl,
              language: streamerData.language,
              region: streamerData.region as any,
              updatedAt: new Date()
            },
            create: {
              platform: streamerData.platform as any,
              username: streamerData.username,
              displayName: streamerData.displayName,
              profileUrl: streamerData.profileUrl,
              avatarUrl: streamerData.avatarUrl,
              followers: streamerData.followers,
              currentViewers: streamerData.currentViewers,
              isLive: streamerData.isLive,
              currentGame: streamerData.currentGame,
              language: streamerData.language,
              region: streamerData.region as any,
              tags: streamerData.tags as any,
              usesCamera: true,
              isVtuber: false,
              fraudCheck: 'CLEAN'
            }
          });

          imported++;
          if (imported <= 5) { // Show first 5 for verification
            console.log(`✅ ${saved.displayName} (@${saved.username}) - ${saved.followers.toLocaleString()} followers`);
          }

        } catch (error) {
          errors++;
          if (errors <= 3) { // Show first 3 errors
            console.log(`❌ Error importing record:`, error instanceof Error ? error.message : error);
          }
        }
      }

      console.log(`📊 ${fileConfig.platform} Import Summary:`);
      console.log(`   ✅ Successfully imported: ${imported}`);
      console.log(`   ❌ Errors: ${errors}`);

      totalImported += imported;
      totalErrors += errors;

    } catch (error) {
      console.error(`❌ Error processing ${fileConfig.filePath}:`, error);
      totalErrors++;
    }
  }

  // Final summary
  console.log(`\n🎉 IMPORT COMPLETE`);
  console.log('==================');
  console.log(`✅ Total imported: ${totalImported}`);
  console.log(`❌ Total errors: ${totalErrors}`);

  if (totalImported > 0) {
    console.log(`\n🔍 Verifying import...`);
    const dbStats = await getImportStats();
    console.log(`📊 Database now contains:`);
    console.log(`   Total streamers: ${dbStats.total}`);
    console.log(`   By platform: ${dbStats.byPlatform.map(p => `${p.platform}: ${p.count}`).join(', ')}`);
    console.log(`   Live now: ${dbStats.liveCount}`);

    console.log(`\n🚀 Mielo now has real streamer data!`);
    console.log(`   The chat will now show accurate follower counts and live status.`);
  }
}

function normalizeStreamerData(record: CSVStreamerData, fileConfig: any): any {
  // Helper function to convert string numbers to integers
  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle formats like "1.2M", "500K", "1,234,567"
      const str = value.toLowerCase().replace(/[,\s]/g, '');
      if (str.includes('m')) {
        return Math.floor(parseFloat(str) * 1000000);
      } else if (str.includes('k')) {
        return Math.floor(parseFloat(str) * 1000);
      }
      return parseInt(str) || 0;
    }
    return 0;
  };

  // Helper function to parse boolean values
  const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'live', 'online'].includes(value.toLowerCase());
    }
    return false;
  };

  // Extract username - try multiple possible column names
  const username = record.username || record.handle || record.user_name || record.channel_name;

  // Extract display name
  const displayName = record.display_name || record.displayName || record.name || record.title || username;

  // Extract follower count - try multiple possible column names
  const followers = parseNumber(
    record.followers || record.follower_count || record.subscribers ||
    record.subscriber_count || record.fans || record.fan_count
  );

  // Extract viewer count for live streams
  const currentViewers = parseNumber(
    record.current_viewers || record.viewers || record.live_viewers || record.watching_now
  );

  // Extract live status
  const isLive = parseBoolean(
    record.is_live || record.live || record.online || record.streaming
  );

  // Extract game/category
  const currentGame = record.game || record.current_game || record.category || record.content_type;

  // Extract language (default to Spanish for LATAM)
  const language = record.language || record.lang || 'es';

  // Extract region/country
  let region = record.region || record.country || fileConfig.region;

  // Normalize region names to match our enum
  const regionMap: { [key: string]: string } = {
    'mexico': 'MEXICO',
    'colombia': 'COLOMBIA',
    'argentina': 'ARGENTINA',
    'chile': 'CHILE',
    'peru': 'PERU',
    'venezuela': 'VENEZUELA',
    'ecuador': 'ECUADOR',
    'bolivia': 'BOLIVIA',
    'paraguay': 'PARAGUAY',
    'uruguay': 'URUGUAY'
  };

  region = regionMap[region.toLowerCase()] || 'MEXICO';

  // Generate profile URL based on platform
  const generateProfileUrl = (platform: string, username: string): string => {
    const baseUrls: { [key: string]: string } = {
      'TWITCH': 'https://www.twitch.tv/',
      'YOUTUBE': 'https://www.youtube.com/@',
      'TIKTOK': 'https://www.tiktok.com/@',
      'INSTAGRAM': 'https://www.instagram.com/',
      'FACEBOOK': 'https://www.facebook.com/'
    };
    return (baseUrls[platform] || '') + username;
  };

  // Determine content tags based on game/category
  const determineTags = (currentGame?: string): string[] => {
    if (!currentGame) return ['VARIETY'];

    const game = currentGame.toLowerCase();
    const tags: string[] = [];

    if (game.includes('just chatting') || game.includes('irl')) tags.push('IRL');
    if (game.includes('music')) tags.push('MUSIC');
    if (game.includes('valorant') || game.includes('csgo') || game.includes('cod')) tags.push('FPS');
    if (game.includes('minecraft') || game.includes('fortnite') || game.includes('lol')) tags.push('GAMING');
    if (game.includes('art') || game.includes('drawing')) tags.push('ART');

    return tags.length > 0 ? tags : ['GAMING'];
  };

  return {
    platform: fileConfig.platform,
    username: username?.toLowerCase(),
    displayName: displayName || username,
    profileUrl: record.profile_url || record.url || generateProfileUrl(fileConfig.platform, username),
    avatarUrl: record.avatar_url || record.profile_image || record.thumbnail,
    followers,
    currentViewers: isLive ? currentViewers : null,
    isLive,
    currentGame,
    language,
    region,
    tags: determineTags(currentGame)
  };
}

async function getImportStats() {
  const total = await db.streamer.count();
  const byPlatform = await db.streamer.groupBy({
    by: ['platform'],
    _count: { platform: true }
  });
  const liveCount = await db.streamer.count({
    where: { isLive: true }
  });

  return {
    total,
    byPlatform: byPlatform.map(p => ({ platform: p.platform, count: p._count.platform })),
    liveCount
  };
}

// Instructions for the user
function printInstructions() {
  console.log('\n📋 HOW TO USE THIS CSV IMPORTER');
  console.log('================================');
  console.log('1. Update the csvFiles array in this script with your actual CSV file paths');
  console.log('2. Make sure your CSV files have headers for the data columns');
  console.log('3. Common column names that work:');
  console.log('   - username, handle, user_name, channel_name');
  console.log('   - followers, follower_count, subscribers');
  console.log('   - is_live, live, online, streaming');
  console.log('   - current_viewers, viewers, live_viewers');
  console.log('   - language, region, country');
  console.log('   - game, current_game, category');
  console.log('4. Run: npx ts-node import-csv-streamers.ts');
  console.log('\nNeed help? Just ask Mielo! 😊');
}

// Run the import or show instructions
if (require.main === module) {
  // Check if this is just being run to see instructions
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printInstructions();
  } else {
    importStreamersFromCSV().catch((error) => {
      console.error('❌ Import failed:', error);
      console.log('\n💡 If you need help setting up the CSV import, just ask!');
      process.exit(1);
    });
  }
}