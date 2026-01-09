import { TwitchScraper } from './src/scrapers/twitchScraper';
import { logger } from './src/utils/database';

async function testTwitchScraper() {
  const scraper = new TwitchScraper();

  console.log('🔍 Testing Twitch Scraper...\n');

  try {
    // Test with some popular LATAM streamers
    const testUsernames = [
      'elrubius',      // Spanish streamer (popular)
      'auronplay',     // Spanish streamer (very popular)
      'thegrefg',      // Spanish streamer (gaming)
      'elspreen',      // Argentine streamer
      'juansguarnizo'  // Colombian streamer
    ];

    console.log(`📋 Testing with ${testUsernames.length} streamers:`, testUsernames.join(', '));
    console.log('⏱️  Starting scrape...\n');

    const startTime = Date.now();

    // Run the scraper
    const results = await scraper.scrapeStreamers(testUsernames);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n📊 SCRAPING RESULTS');
    console.log('==================');
    console.log(`✅ Successfully scraped: ${results.length}/${testUsernames.length} streamers`);
    console.log(`⏱️  Total duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
    console.log(`📈 Average per streamer: ${(duration/results.length).toFixed(0)}ms\n`);

    // Display detailed results
    results.forEach((streamer, index) => {
      console.log(`\n${index + 1}. ${streamer.displayName} (@${streamer.username})`);
      console.log(`   👥 Followers: ${streamer.followers.toLocaleString()}`);
      console.log(`   📺 Live: ${streamer.isLive ? '🔴 YES' : '⚫ NO'}`);
      if (streamer.currentViewers) {
        console.log(`   👀 Viewers: ${streamer.currentViewers.toLocaleString()}`);
      }
      if (streamer.currentGame) {
        console.log(`   🎮 Game: ${streamer.currentGame}`);
      }
      console.log(`   🌍 Region: ${streamer.region}`);
      console.log(`   🏷️  Tags: ${streamer.tags.join(', ') || 'None'}`);
      console.log(`   📱 Language: ${streamer.language}`);
      console.log(`   📷 Uses Camera: ${streamer.usesCamera ? 'Yes' : 'No'}`);
      console.log(`   🎭 VTuber: ${streamer.isVtuber ? 'Yes' : 'No'}`);
    });

    // Performance stats
    console.log('\n📈 PERFORMANCE METRICS');
    console.log('======================');
    const avgFollowers = results.reduce((sum, s) => sum + s.followers, 0) / results.length;
    const liveStreamers = results.filter(s => s.isLive).length;
    const totalViewers = results.reduce((sum, s) => sum + (s.currentViewers || 0), 0);

    console.log(`📊 Average followers: ${Math.round(avgFollowers).toLocaleString()}`);
    console.log(`🔴 Live streamers: ${liveStreamers}/${results.length} (${((liveStreamers/results.length)*100).toFixed(1)}%)`);
    console.log(`👀 Total live viewers: ${totalViewers.toLocaleString()}`);

    // Regional distribution
    const regions = results.reduce((acc, s) => {
      acc[s.region] = (acc[s.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n🌍 REGIONAL DISTRIBUTION');
    console.log('========================');
    Object.entries(regions).forEach(([region, count]) => {
      console.log(`${region}: ${count} streamers`);
    });

    // Tag distribution
    const allTags = results.flatMap(s => s.tags);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n🏷️  TAG DISTRIBUTION');
    console.log('===================');
    Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([tag, count]) => {
        console.log(`${tag}: ${count} streamers`);
      });

  } catch (error) {
    console.error('❌ Error testing scraper:', error);
  } finally {
    await scraper.close();
    console.log('\n🔧 Scraper closed successfully');
  }
}

// Run the test
testTwitchScraper().catch(console.error);