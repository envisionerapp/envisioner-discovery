/**
 * API Integration Test Suite
 * Tests all external APIs before running continuous population
 */

require('dotenv').config();
const axios = require('axios');

const results = {
  twitch: { status: 'pending', data: null, error: null },
  kick: { status: 'pending', data: null, error: null },
  youtube: { status: 'pending', data: null, error: null },
  scrapeCreatorsTikTok: { status: 'pending', data: null, error: null },
  scrapeCreatorsInstagram: { status: 'pending', data: null, error: null },
  scrapeCreatorsX: { status: 'pending', data: null, error: null },
  bunnyUpload: { status: 'pending', data: null, error: null },
};

// ============ TWITCH API TEST ============
async function testTwitchAPI() {
  console.log('\n🎮 Testing TWITCH API...');
  try {
    // Get OAuth token
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    const token = tokenRes.data.access_token;
    console.log('  ✓ OAuth token obtained');

    // Get top live streams (discover new channels)
    const streamsRes = await axios.get('https://api.twitch.tv/helix/streams', {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      },
      params: {
        first: 5 // Get 5 streams for test
      }
    });

    const streams = streamsRes.data.data;
    console.log(`  ✓ Found ${streams.length} live streams`);

    // Get user details for these streams
    const userLogins = streams.map(s => s.user_login);
    const usersRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      },
      params: {
        login: userLogins
      }
    });

    const users = usersRes.data.data;
    console.log(`  ✓ Got ${users.length} user profiles`);

    // Sample data
    const sample = streams[0];
    const sampleUser = users.find(u => u.login === sample.user_login);

    results.twitch = {
      status: 'success',
      data: {
        sampleChannel: {
          username: sample.user_login,
          displayName: sample.user_name,
          viewers: sample.viewer_count,
          game: sample.game_name,
          title: sample.title,
          avatar: sampleUser?.profile_image_url,
          description: sampleUser?.description
        },
        totalFound: streams.length
      }
    };

    console.log(`  ✓ Sample: ${sample.user_name} (${sample.viewer_count} viewers) playing ${sample.game_name}`);
    console.log(`    Avatar: ${sampleUser?.profile_image_url?.substring(0, 60)}...`);
    return true;
  } catch (error) {
    results.twitch = { status: 'failed', error: error.message };
    console.log(`  ✗ FAILED: ${error.message}`);
    return false;
  }
}

// ============ KICK API TEST ============
async function testKickAPI() {
  console.log('\n🥊 Testing KICK API...');
  try {
    // Get OAuth token
    const tokenRes = await axios.post('https://id.kick.com/oauth/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KICK_CLIENT_ID,
        client_secret: process.env.KICK_CLIENT_SECRET
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    const token = tokenRes.data.access_token;
    console.log('  ✓ OAuth token obtained');

    // Get live channels (discover)
    const liveRes = await axios.get('https://api.kick.com/public/v1/livestreams', {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { limit: 5 }
    });

    const streams = liveRes.data.data || [];
    console.log(`  ✓ Found ${streams.length} live streams`);

    if (streams.length > 0) {
      const sample = streams[0];
      results.kick = {
        status: 'success',
        data: {
          sampleChannel: {
            username: sample.channel?.slug || sample.slug,
            displayName: sample.channel?.user?.username || sample.session_title,
            viewers: sample.viewer_count,
            category: sample.category?.name,
            title: sample.session_title,
            avatar: sample.channel?.user?.profile_pic || sample.thumbnail?.url
          },
          totalFound: streams.length
        }
      };
      console.log(`  ✓ Sample: ${sample.channel?.slug || 'unknown'} (${sample.viewer_count} viewers)`);
    } else {
      results.kick = { status: 'success', data: { totalFound: 0, note: 'No live streams at this time' } };
    }
    return true;
  } catch (error) {
    results.kick = { status: 'failed', error: error.message };
    console.log(`  ✗ FAILED: ${error.message}`);
    return false;
  }
}

// ============ YOUTUBE API TEST ============
async function testYouTubeAPI() {
  console.log('\n📺 Testing YOUTUBE API...');
  try {
    // Search for live streams
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        part: 'snippet',
        type: 'video',
        eventType: 'live',
        q: 'gaming live stream',
        maxResults: 5
      }
    });

    const videos = searchRes.data.items || [];
    console.log(`  ✓ Found ${videos.length} live videos`);

    // Get channel details
    const channelIds = [...new Set(videos.map(v => v.snippet.channelId))];
    const channelsRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        part: 'snippet,statistics',
        id: channelIds.join(',')
      }
    });

    const channels = channelsRes.data.items || [];
    console.log(`  ✓ Got ${channels.length} channel profiles`);

    if (channels.length > 0) {
      const sample = channels[0];
      results.youtube = {
        status: 'success',
        data: {
          sampleChannel: {
            channelId: sample.id,
            username: sample.snippet.customUrl,
            displayName: sample.snippet.title,
            subscribers: parseInt(sample.statistics.subscriberCount),
            videoCount: parseInt(sample.statistics.videoCount),
            viewCount: parseInt(sample.statistics.viewCount),
            avatar: sample.snippet.thumbnails?.high?.url,
            country: sample.snippet.country,
            description: sample.snippet.description?.substring(0, 100)
          },
          totalFound: channels.length
        }
      };
      console.log(`  ✓ Sample: ${sample.snippet.title} (${sample.statistics.subscriberCount} subs)`);
      console.log(`    Avatar: ${sample.snippet.thumbnails?.high?.url?.substring(0, 60)}...`);
    }
    return true;
  } catch (error) {
    results.youtube = { status: 'failed', error: error.message };
    console.log(`  ✗ FAILED: ${error.message}`);
    return false;
  }
}

// ============ SCRAPECREATORS TIKTOK TEST ============
async function testScrapeCreatorsTikTok() {
  console.log('\n🎵 Testing SCRAPECREATORS - TikTok...');
  try {
    // Test with a known TikTok creator
    const res = await axios.get('https://api.scrapecreators.com/v1/tiktok/profile', {
      headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
      params: { handle: 'khaby.lame' },
      timeout: 30000
    });

    const data = res.data.data || res.data;
    results.scrapeCreatorsTikTok = {
      status: 'success',
      data: {
        username: data.uniqueId || data.username,
        displayName: data.nickname,
        followers: data.followerCount,
        likes: data.heartCount,
        videos: data.videoCount,
        avatar: data.avatarLarger || data.avatarMedium,
        bio: data.signature?.substring(0, 100),
        verified: data.verified
      }
    };
    console.log(`  ✓ Profile: ${data.nickname} (${data.followerCount?.toLocaleString()} followers)`);
    console.log(`    Avatar URL: ${(data.avatarLarger || data.avatarMedium)?.substring(0, 60)}...`);
    return true;
  } catch (error) {
    results.scrapeCreatorsTikTok = { status: 'failed', error: error.response?.data?.message || error.message };
    console.log(`  ✗ FAILED: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============ SCRAPECREATORS INSTAGRAM TEST ============
async function testScrapeCreatorsInstagram() {
  console.log('\n📸 Testing SCRAPECREATORS - Instagram...');
  try {
    const res = await axios.get('https://api.scrapecreators.com/v1/instagram/profile', {
      headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
      params: { handle: 'cristiano' },
      timeout: 30000
    });

    const data = res.data.data || res.data;
    results.scrapeCreatorsInstagram = {
      status: 'success',
      data: {
        username: data.username,
        displayName: data.full_name,
        followers: data.follower_count,
        following: data.following_count,
        posts: data.media_count,
        avatar: data.profile_pic_url || data.profile_pic_url_hd,
        bio: data.biography?.substring(0, 100),
        verified: data.is_verified,
        externalUrl: data.external_url
      }
    };
    console.log(`  ✓ Profile: ${data.full_name} (${data.follower_count?.toLocaleString()} followers)`);
    console.log(`    Avatar URL: ${(data.profile_pic_url_hd || data.profile_pic_url)?.substring(0, 60)}...`);
    return true;
  } catch (error) {
    results.scrapeCreatorsInstagram = { status: 'failed', error: error.response?.data?.message || error.message };
    console.log(`  ✗ FAILED: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============ SCRAPECREATORS X/TWITTER TEST ============
async function testScrapeCreatorsX() {
  console.log('\n🐦 Testing SCRAPECREATORS - X/Twitter...');
  try {
    const res = await axios.get('https://api.scrapecreators.com/v1/twitter/profile', {
      headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
      params: { handle: 'elonmusk' },
      timeout: 30000
    });

    const data = res.data.data || res.data;
    results.scrapeCreatorsX = {
      status: 'success',
      data: {
        username: data.screen_name || data.username,
        displayName: data.name,
        followers: data.followers_count,
        following: data.following_count || data.friends_count,
        tweets: data.statuses_count,
        avatar: data.profile_image_url_https || data.profile_image_url,
        bio: data.description?.substring(0, 100),
        verified: data.verified
      }
    };
    console.log(`  ✓ Profile: ${data.name} (${data.followers_count?.toLocaleString()} followers)`);
    console.log(`    Avatar URL: ${(data.profile_image_url_https || data.profile_image_url)?.substring(0, 60)}...`);
    return true;
  } catch (error) {
    results.scrapeCreatorsX = { status: 'failed', error: error.response?.data?.message || error.message };
    console.log(`  ✗ FAILED: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============ BUNNY CDN UPLOAD TEST ============
async function testBunnyUpload() {
  console.log('\n🐰 Testing BUNNY CDN Upload...');
  try {
    // Use a test image URL (Twitch default avatar)
    const testImageUrl = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png';

    // Download image
    const imageRes = await axios.get(testImageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageRes.data);
    console.log(`  ✓ Downloaded test image (${imageBuffer.length} bytes)`);

    // Upload to Bunny
    const filename = `test/api-test-${Date.now()}.png`;
    const uploadUrl = `https://${process.env.BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${filename}`;

    const uploadRes = await axios.put(uploadUrl, imageBuffer, {
      headers: {
        'AccessKey': process.env.BUNNY_STORAGE_API_KEY,
        'Content-Type': 'image/png'
      }
    });

    const cdnUrl = `https://${process.env.BUNNY_CDN_HOSTNAME}/${filename}`;
    console.log(`  ✓ Uploaded to Bunny CDN`);
    console.log(`    CDN URL: ${cdnUrl}`);

    // Verify it's accessible
    const verifyRes = await axios.head(cdnUrl);
    console.log(`  ✓ Verified accessible (status: ${verifyRes.status})`);

    results.bunnyUpload = {
      status: 'success',
      data: {
        uploadedTo: cdnUrl,
        size: imageBuffer.length,
        verified: true
      }
    };
    return true;
  } catch (error) {
    results.bunnyUpload = { status: 'failed', error: error.message };
    console.log(`  ✗ FAILED: ${error.message}`);
    return false;
  }
}

// ============ MAIN TEST RUNNER ============
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       API INTEGRATION TEST SUITE - Envisioner Discovery');
  console.log('═══════════════════════════════════════════════════════════');

  await testTwitchAPI();
  await new Promise(r => setTimeout(r, 500));

  await testKickAPI();
  await new Promise(r => setTimeout(r, 500));

  await testYouTubeAPI();
  await new Promise(r => setTimeout(r, 500));

  await testScrapeCreatorsTikTok();
  await new Promise(r => setTimeout(r, 500));

  await testScrapeCreatorsInstagram();
  await new Promise(r => setTimeout(r, 500));

  await testScrapeCreatorsX();
  await new Promise(r => setTimeout(r, 500));

  await testBunnyUpload();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                        TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  let passed = 0;
  let failed = 0;

  for (const [name, result] of Object.entries(results)) {
    const icon = result.status === 'success' ? '✓' : '✗';
    const status = result.status === 'success' ? 'PASS' : 'FAIL';
    console.log(`  ${icon} ${name.padEnd(25)} ${status}`);
    if (result.status === 'success') passed++;
    else failed++;
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Total: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Output full results as JSON for debugging
  console.log('\nFull Results JSON:');
  console.log(JSON.stringify(results, null, 2));

  return failed === 0;
}

runAllTests().then(success => {
  process.exit(success ? 0 : 1);
});
