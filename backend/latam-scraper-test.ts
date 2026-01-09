import { TwitchScraper } from './src/scrapers/twitchScraper';
import { db, logger } from './src/utils/database';

async function testLatamStreamers() {
  console.log('🇪🇸 LATAM STREAMER SCRAPER TEST');
  console.log('===============================\n');

  const scraper = new TwitchScraper();

  // Real popular LATAM streamers
  const latamStreamers = [
    'ibai',           // Spain-based but very popular in LATAM
    'elrubius',       // Spanish streamer popular in LATAM
    'auronplay',      // Spanish streamer popular in LATAM
    'juansguarnizo',  // Colombian streamer
    'elspreen',       // Argentinian streamer
    'coscu',          // Argentinian streamer
    'reborn_live',    // Mexican streamer
    'carreraaa',      // Spanish but LATAM audience
    'knekro',         // Spanish streamer
    'thegrefg'        // Spanish streamer with LATAM audience
  ];

  console.log(`📋 Testing with real LATAM streamers: ${latamStreamers.slice(0, 5).join(', ')} and 5 more...`);
  console.log('🌐 Making real HTTP requests to extract follower data...\n');

  const startTime = Date.now();

  try {
    // Test first 5 streamers to avoid rate limits
    const results = await scraper.scrapeStreamers(latamStreamers.slice(0, 5));
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n🎉 LATAM SCRAPING RESULTS');
    console.log('=========================');
    console.log(`✅ Successfully scraped: ${results.length}/${5} streamers`);
    console.log(`⏱️  Total duration: ${duration}ms (${(duration/1000).toFixed(2)}s)\n`);

    if (results.length === 0) {
      console.log('❌ No results returned - checking scraper configuration...');
      return;
    }

    // Display results with real data
    results.forEach((streamer, index) => {
      console.log(`\n${index + 1}. 🎮 ${streamer.displayName} (@${streamer.username})`);
      console.log(`   🔗 ${streamer.profileUrl}`);

      if (streamer.followers > 0) {
        console.log(`   👥 Followers: ${streamer.followers.toLocaleString()} ✅ REAL DATA`);
      } else {
        console.log(`   👥 Followers: Failed to extract (DOM selector issue)`);
      }

      console.log(`   📺 Live Status: ${streamer.isLive ? '🔴 LIVE' : '⚫ OFFLINE'}`);

      if (streamer.isLive && streamer.currentViewers && streamer.currentViewers > 0) {
        console.log(`   👀 Current Viewers: ${streamer.currentViewers.toLocaleString()}`);
      }

      if (streamer.currentGame) {
        console.log(`   🎮 Current Game: ${streamer.currentGame}`);
      }

      console.log(`   🌍 Detected Region: ${streamer.region}`);
      console.log(`   📱 Language: ${streamer.language}`);

      if (streamer.tags.length > 0) {
        console.log(`   🏷️  Auto Tags: ${streamer.tags.join(', ')}`);
      }

      if (streamer.isVtuber) {
        console.log(`   🎭 VTuber: Yes`);
      }
    });

    // Save to database if we got real data
    const realDataCount = results.filter(s => s.followers > 0).length;
    console.log(`\n💾 SAVING TO DATABASE`);
    console.log('====================');

    if (realDataCount > 0) {
      console.log(`📊 Found ${realDataCount} streamers with real follower data`);
      console.log('💾 Saving to database...');

      let savedCount = 0;
      for (const streamerData of results) {
        try {
          const saved = await db.streamer.upsert({
            where: {
              platform_username: {
                platform: 'TWITCH',
                username: streamerData.username
              }
            },
            update: {
              displayName: streamerData.displayName,
              followers: streamerData.followers,
              currentViewers: streamerData.currentViewers || null,
              isLive: streamerData.isLive,
              currentGame: streamerData.currentGame || null,
              lastStreamed: streamerData.lastStreamed || null,
              avatarUrl: streamerData.avatarUrl || null,
              language: streamerData.language,
              tags: streamerData.tags,
              region: streamerData.region,
              usesCamera: streamerData.usesCamera,
              isVtuber: streamerData.isVtuber,
              fraudCheck: 'CLEAN',
              updatedAt: new Date()
            },
            create: {
              platform: 'TWITCH',
              username: streamerData.username,
              displayName: streamerData.displayName,
              profileUrl: streamerData.profileUrl,
              avatarUrl: streamerData.avatarUrl,
              followers: streamerData.followers,
              currentViewers: streamerData.currentViewers || null,
              isLive: streamerData.isLive,
              currentGame: streamerData.currentGame,
              lastStreamed: streamerData.lastStreamed,
              language: streamerData.language,
              tags: streamerData.tags,
              region: streamerData.region,
              usesCamera: streamerData.usesCamera,
              isVtuber: streamerData.isVtuber,
              fraudCheck: 'CLEAN'
            }
          });

          savedCount++;
          console.log(`✅ Saved: ${saved.displayName} (${saved.followers.toLocaleString()} followers)`);
        } catch (error) {
          console.log(`❌ Failed to save ${streamerData.displayName}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      console.log(`\n🎯 DATABASE SUMMARY`);
      console.log(`✅ Saved ${savedCount}/${results.length} streamers to database`);
      console.log(`📊 These are now available for AI chat searches!`);

    } else {
      console.log('⚠️  No real follower data extracted - DOM selectors need updates');
    }

    // Test database query
    console.log(`\n🔍 TESTING DATABASE QUERY`);
    console.log('=========================');
    const dbStreamers = await db.streamer.findMany({
      where: { platform: 'TWITCH' },
      orderBy: { followers: 'desc' },
      take: 3
    });

    console.log(`📊 Top 3 streamers in database:`);
    dbStreamers.forEach((streamer, i) => {
      console.log(`${i + 1}. ${streamer.displayName} - ${streamer.followers.toLocaleString()} followers`);
    });

  } catch (error) {
    console.error('\n❌ SCRAPING ERROR:', error);
    console.log('\n🔧 This could be due to:');
    console.log('   • Twitch rate limiting');
    console.log('   • Changed DOM selectors');
    console.log('   • Network connectivity');
    console.log('   • Missing API credentials');
  } finally {
    await scraper.close();
    console.log('\n🔧 Browser closed successfully');
  }
}

// Run the test
testLatamStreamers().catch((error) => {
  console.error('Fatal test error:', error);
  process.exit(1);
});