/**
 * LinkedIn Investigation Script
 * Tests the entire pipeline to identify why LinkedIn data isn't being retrieved
 */

import axios from 'axios';
import { db } from '../src/utils/database';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

async function testYouTubeChannelAPI(channelUrl: string) {
  console.log('\n=== TEST 1: YouTube Channel API ===');
  console.log(`Testing: ${channelUrl}`);

  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url: channelUrl },
      timeout: 30000
    });

    console.log('Response status:', response.status);
    console.log('Response keys:', Object.keys(response.data || {}));

    const data = response.data;
    console.log('\n--- Direct Fields ---');
    console.log('linkedin:', data.linkedin);
    console.log('instagram:', data.instagram);
    console.log('twitter:', data.twitter);
    console.log('facebook:', data.facebook);
    console.log('tiktok:', data.tiktok);

    console.log('\n--- Links Array ---');
    console.log('links:', JSON.stringify(data.links, null, 2));

    console.log('\n--- Other Useful Data ---');
    console.log('name:', data.name);
    console.log('channelId:', data.channelId);
    console.log('subscriberCount:', data.subscriberCount);
    console.log('email:', data.email);

    return data;
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

async function testLinkedInProfileAPI(profileUrl: string) {
  console.log('\n=== TEST 2: LinkedIn Profile API ===');
  console.log(`Testing: ${profileUrl}`);

  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/linkedin/profile', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url: profileUrl },
      timeout: 30000
    });

    console.log('Response status:', response.status);
    console.log('Response keys:', Object.keys(response.data || {}));
    console.log('Full response:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

async function checkDatabaseStatus() {
  console.log('\n=== TEST 3: Database Status ===');

  // Count LinkedIn creators
  const linkedinCreators = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log('LinkedIn creators in DB:', linkedinCreators);

  // Count LinkedIn in sync queue by status
  const queuePending = await db.socialSyncQueue.count({ where: { platform: 'LINKEDIN', status: 'PENDING' } });
  const queueCompleted = await db.socialSyncQueue.count({ where: { platform: 'LINKEDIN', status: 'COMPLETED' } });
  const queueFailed = await db.socialSyncQueue.count({ where: { platform: 'LINKEDIN', status: 'FAILED' } });
  console.log('LinkedIn queue - Pending:', queuePending, 'Completed:', queueCompleted, 'Failed:', queueFailed);

  // Check YouTube/Twitch/Kick streamers with LinkedIn in socialLinks
  const streamersWithSocials = await db.streamer.findMany({
    where: {
      platform: { in: ['TWITCH', 'KICK', 'YOUTUBE'] },
      NOT: { socialLinks: { equals: [] } }
    },
    select: { username: true, platform: true, socialLinks: true },
    take: 500
  });

  let linkedinUrlCount = 0;
  const linkedinExamples: string[] = [];

  for (const s of streamersWithSocials) {
    const links = s.socialLinks as any;
    if (Array.isArray(links)) {
      for (const link of links) {
        if (typeof link === 'string' && link.toLowerCase().includes('linkedin')) {
          linkedinUrlCount++;
          if (linkedinExamples.length < 10) {
            linkedinExamples.push(`${s.platform}/${s.username}: ${link}`);
          }
        }
      }
    }
  }

  console.log('\nLinkedIn URLs found in socialLinks of streamers:', linkedinUrlCount);
  if (linkedinExamples.length > 0) {
    console.log('Examples:');
    linkedinExamples.forEach(ex => console.log('  ' + ex));
  }

  // Check how many YouTube channels have been processed for social links
  const youtubeTotal = await db.streamer.count({ where: { platform: 'YOUTUBE' } });
  const youtubeWithSocials = await db.streamer.count({
    where: { platform: 'YOUTUBE', NOT: { socialLinks: { equals: [] } } }
  });
  const youtubeNoSocials = await db.streamer.count({
    where: { platform: 'YOUTUBE', socialLinks: { equals: [] } }
  });

  console.log('\nYouTube channels - Total:', youtubeTotal, 'With socials:', youtubeWithSocials, 'Without:', youtubeNoSocials);

  // Check Twitch
  const twitchTotal = await db.streamer.count({ where: { platform: 'TWITCH' } });
  const twitchWithSocials = await db.streamer.count({
    where: { platform: 'TWITCH', NOT: { socialLinks: { equals: [] } } }
  });

  console.log('Twitch streamers - Total:', twitchTotal, 'With socials:', twitchWithSocials);

  // Show recent LinkedIn entries in queue
  const recentQueue = await db.socialSyncQueue.findMany({
    where: { platform: 'LINKEDIN' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { username: true, status: true, createdAt: true, errorMessage: true }
  });

  console.log('\nRecent LinkedIn queue entries:');
  recentQueue.forEach(q => {
    console.log(`  ${q.username}: ${q.status} (${q.createdAt?.toISOString()}) ${q.errorMessage || ''}`);
  });
}

async function findYouTubeChannelsWithLinkedIn() {
  console.log('\n=== TEST 4: Finding YouTube channels that might have LinkedIn ===');

  // Get some popular YouTube channels
  const ytChannels = await db.streamer.findMany({
    where: {
      platform: 'YOUTUBE',
      followers: { gte: 50000 }
    },
    orderBy: { followers: 'desc' },
    take: 20,
    select: { username: true, profileUrl: true, followers: true, socialLinks: true }
  });

  console.log(`\nTop ${ytChannels.length} YouTube channels by subscribers:`);
  for (const ch of ytChannels) {
    console.log(`  @${ch.username} (${ch.followers?.toLocaleString()} subs) - socials: ${JSON.stringify(ch.socialLinks)}`);
  }

  // Test one channel's API response
  if (ytChannels.length > 0) {
    const testChannel = ytChannels[0];
    const url = testChannel.profileUrl || `https://www.youtube.com/@${testChannel.username}`;
    console.log(`\nTesting top channel: ${url}`);
    await testYouTubeChannelAPI(url);
  }
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN INVESTIGATION SCRIPT');
  console.log('===========================================');

  // Test 1: YouTube Channel API for sample profile
  const sampleUrl = 'https://www.youtube.com/@FrancoisPouzet';
  const ytData = await testYouTubeChannelAPI(sampleUrl);

  // Test 2: If LinkedIn found, test LinkedIn Profile API
  if (ytData?.linkedin) {
    await testLinkedInProfileAPI(ytData.linkedin);
  } else if (ytData?.links) {
    const linkedinLink = (ytData.links as string[]).find(l => l?.includes('linkedin'));
    if (linkedinLink) {
      await testLinkedInProfileAPI(linkedinLink);
    }
  }

  // Test a direct LinkedIn profile
  await testLinkedInProfileAPI('https://www.linkedin.com/in/francoispouzet/');

  // Test 3: Database status
  await checkDatabaseStatus();

  // Test 4: Find YT channels with potential LinkedIn
  await findYouTubeChannelsWithLinkedIn();

  console.log('\n===========================================');
  console.log('   INVESTIGATION COMPLETE');
  console.log('===========================================');

  await db.$disconnect();
}

main().catch(console.error);
