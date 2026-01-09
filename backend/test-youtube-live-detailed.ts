import axios from 'axios';
import * as xml2js from 'xml2js';
import * as cheerio from 'cheerio';

// Test YouTube channel that's known to stream frequently
const TEST_CHANNELS = [
  { name: 'Lofi Girl', id: 'UCSJ4gkVC6NrvII8umztf0Ow' },
  { name: 'NASA', id: 'UCLA_DiR1FfKNvjuUpBHmylQ' },
];

async function testYouTubeLiveDetection(channelId: string, channelName: string) {
  console.log(`\n=== Testing ${channelName} (${channelId}) ===`);

  try {
    // Step 1: Check RSS feed
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    console.log(`1. Fetching RSS: ${rssUrl}`);

    const rssResponse = await axios.get(rssUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log(`   ✓ RSS Status: ${rssResponse.status}`);

    const parsedRss = await xml2js.parseStringPromise(rssResponse.data);

    if (parsedRss?.feed?.entry && parsedRss.feed.entry.length > 0) {
      const latestEntry = parsedRss.feed.entry[0];
      const videoId = latestEntry['yt:videoId']?.[0];
      const title = latestEntry.title?.[0];
      const published = latestEntry.published?.[0];

      console.log(`   ✓ Latest video: ${title}`);
      console.log(`   ✓ Video ID: ${videoId}`);
      console.log(`   ✓ Published: ${published}`);

      // Step 2: Check video page
      if (videoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`\n2. Fetching video page: ${videoUrl}`);

        const pageResponse = await axios.get(videoUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        console.log(`   ✓ Page Status: ${pageResponse.status}`);

        const pageHtml = pageResponse.data;

        // Check for live indicators
        const isLiveContent = pageHtml.includes('"isLiveContent":true');
        const hasLiveIcon = pageHtml.includes('{"iconType":"LIVE"}');
        const hasLiveBroadcast = pageHtml.includes('"liveBroadcastDetails"');
        const hasLiveBadge = pageHtml.includes('BADGE_STYLE_TYPE_LIVE_NOW');

        console.log(`\n3. Live Indicators:`);
        console.log(`   isLiveContent: ${isLiveContent}`);
        console.log(`   hasLiveIcon: ${hasLiveIcon}`);
        console.log(`   hasLiveBroadcast: ${hasLiveBroadcast}`);
        console.log(`   hasLiveBadge: ${hasLiveBadge}`);

        const isLive = isLiveContent || hasLiveIcon || hasLiveBroadcast || hasLiveBadge;

        if (isLive) {
          console.log(`\n   🔴 LIVE DETECTED!`);

          // Try to extract viewer count
          const viewerPatterns = [
            /"viewCount":"(\d+)"/,
            /"concurrentViewers":"(\d+)"/,
            /watching now","simpleText":"([\d,]+)/,
            /"viewCountText".*?"simpleText":"([\d,]+)\s*watching/
          ];

          let viewers: number | undefined;
          for (const pattern of viewerPatterns) {
            const match = pageHtml.match(pattern);
            if (match && match[1]) {
              const viewerStr = match[1].replace(/,/g, '');
              viewers = parseInt(viewerStr);
              if (!isNaN(viewers) && viewers > 0) {
                console.log(`   👥 Viewers: ${viewers.toLocaleString()} (pattern: ${pattern})`);
                break;
              }
            }
          }

          if (!viewers) {
            console.log(`   ⚠️  Could not extract viewer count`);
            // Show a snippet of the HTML for debugging
            const snippets = [
              pageHtml.match(/"viewCount[^}]{0,100}/),
              pageHtml.match(/watching[^}]{0,100}/),
              pageHtml.match(/"concurrentViewers[^}]{0,100}/)
            ].filter(Boolean);
            if (snippets.length > 0) {
              console.log(`   Debug snippets:`);
              snippets.forEach((s, i) => console.log(`     ${i + 1}. ${s?.[0]}`));
            }
          }

          // Try to extract start time
          const startTimeMatch = pageHtml.match(/"startTimestamp":"([^"]+)"/);
          if (startTimeMatch && startTimeMatch[1]) {
            const startedAt = new Date(startTimeMatch[1]);
            console.log(`   ⏰ Started: ${startedAt.toISOString()}`);
          } else {
            console.log(`   ⚠️  Could not extract start time`);
          }
        } else {
          console.log(`\n   ⚪ Not currently live`);
        }
      }
    } else {
      console.log(`   ⚠️  No entries in RSS feed`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Headers:`, error.response.headers);
    }
  }
}

async function main() {
  console.log('YouTube Live Detection Test\n');

  for (const channel of TEST_CHANNELS) {
    await testYouTubeLiveDetection(channel.id, channel.name);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
