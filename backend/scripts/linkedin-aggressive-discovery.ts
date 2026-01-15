/**
 * LinkedIn Aggressive Discovery
 *
 * This script aggressively discovers LinkedIn profiles by:
 * 1. Processing ALL YouTube channels in the database
 * 2. Using LinkedIn search API with various keywords
 * 3. Creating entries even for private profiles (using source avatar)
 * 4. Processing Twitch and Kick channels for LinkedIn
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Platform, Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';
const RATE_LIMIT_MS = 250;
const BATCH_SIZE = 500;

function extractLinkedInHandle(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function getHighestResAvatar(avatar: any): string | null {
  const sources = avatar?.image?.sources;
  if (!sources || sources.length === 0) return null;
  const sorted = [...sources].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || null;
}

async function fetchYouTubeChannel(handle: string): Promise<any> {
  try {
    const url = handle.startsWith('http') ? handle : `https://www.youtube.com/@${handle}`;
    const response = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });
    if (!response.data?.success) return null;
    return response.data;
  } catch {
    return null;
  }
}

async function tryLinkedInProfile(linkedinUrl: string): Promise<{ profile: any; isPrivate: boolean }> {
  try {
    const endpoint = linkedinUrl.includes('/company/')
      ? 'https://api.scrapecreators.com/v1/linkedin/company'
      : 'https://api.scrapecreators.com/v1/linkedin/profile';

    const response = await axios.get(endpoint, {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url: linkedinUrl },
      timeout: 30000
    });

    if (response.data?.message?.includes('private') || response.data?.message?.includes('not publicly available')) {
      return { profile: null, isPrivate: true };
    }

    const data = response.data?.data || response.data;
    if (!data || data.success === false) {
      return { profile: null, isPrivate: true };
    }

    return { profile: data, isPrivate: false };
  } catch {
    return { profile: null, isPrivate: true };
  }
}

async function createLinkedInEntry(
  linkedinUrl: string,
  sourceData: { name: string; avatar: string | null; followers: number; platform: string; username: string },
  linkedinProfile: any | null,
  isPrivate: boolean
): Promise<boolean> {
  const handle = extractLinkedInHandle(linkedinUrl);
  if (!handle) return false;

  try {
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: { platform: 'LINKEDIN', username: handle.toLowerCase() }
      }
    });

    if (existing) return false;

    let displayName: string;
    let avatarUrl: string | undefined;
    let followers = 0;
    let description: string;

    if (linkedinProfile && !isPrivate) {
      displayName = linkedinProfile.name ||
        `${linkedinProfile.first_name || ''} ${linkedinProfile.last_name || ''}`.trim() ||
        sourceData.name || handle;
      avatarUrl = linkedinProfile.image || sourceData.avatar || undefined;
      followers = linkedinProfile.followers || linkedinProfile.follower_count || 0;
      description = linkedinProfile.headline || linkedinProfile.about || `From ${sourceData.platform}: @${sourceData.username}`;
    } else {
      displayName = sourceData.name || handle;
      avatarUrl = sourceData.avatar || undefined;
      followers = 0;
      description = `LinkedIn (private) - ${sourceData.platform}: @${sourceData.username} (${sourceData.followers?.toLocaleString() || 0} followers)`;
    }

    if (avatarUrl) {
      try {
        avatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch {}
    }

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle.toLowerCase(),
        displayName,
        profileUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
        avatarUrl: avatarUrl || undefined,
        followers,
        profileDescription: description,
        region: Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        discoveredVia: `${sourceData.platform.toLowerCase()}:@${sourceData.username}`,
        socialLinks: [`https://${sourceData.platform.toLowerCase()}.com/@${sourceData.username}`],
      }
    });

    const status = isPrivate ? '🔒' : '✅';
    console.log(`  ${status} ${handle} (${followers} followers)`);
    return true;
  } catch (error: any) {
    return false;
  }
}

async function searchLinkedInProfiles(query: string): Promise<number> {
  // Try to use LinkedIn profile search if available
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/linkedin/search', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { query },
      timeout: 30000
    });

    const profiles = response.data?.profiles || response.data?.results || response.data?.data || [];
    console.log(`  Found ${profiles.length} profiles`);

    let created = 0;
    for (const profile of profiles) {
      const profileUrl = profile.profile_url || profile.url || `https://linkedin.com/in/${profile.public_identifier}`;
      const success = await createLinkedInEntry(
        profileUrl,
        { name: profile.name || '', avatar: profile.image, followers: 0, platform: 'linkedin', username: profile.public_identifier || '' },
        profile,
        false
      );
      if (success) created++;
    }
    return created;
  } catch (error: any) {
    console.log(`  Search not available: ${error.response?.data?.message || error.message}`);
    return 0;
  }
}

async function processYouTubeChannelBatch(offset: number, limit: number): Promise<{ processed: number; found: number; created: number }> {
  const result = { processed: 0, found: 0, created: 0 };

  // Get YouTube channels that haven't been checked for LinkedIn yet
  const channels = await db.streamer.findMany({
    where: { platform: 'YOUTUBE' },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileUrl: true,
      avatarUrl: true,
      followers: true,
      socialLinks: true
    },
    orderBy: { followers: 'desc' },
    skip: offset,
    take: limit
  });

  for (const channel of channels) {
    result.processed++;

    // First check if LinkedIn URL already exists in socialLinks
    const links = (channel.socialLinks as string[]) || [];
    let linkedinUrl = links.find(l => typeof l === 'string' && l.toLowerCase().includes('linkedin.com'));

    // If no LinkedIn in existing links, fetch from API
    if (!linkedinUrl) {
      const ytData = await fetchYouTubeChannel(channel.username);
      if (ytData) {
        linkedinUrl = ytData.linkedin;
        if (!linkedinUrl && ytData.links) {
          linkedinUrl = ytData.links.find((l: string) => l?.toLowerCase().includes('linkedin.com'));
        }

        // Update channel's socialLinks if we found new ones
        if (linkedinUrl && !links.includes(linkedinUrl)) {
          const newLinks = [...links, linkedinUrl];
          await db.streamer.update({
            where: { id: channel.id },
            data: { socialLinks: newLinks }
          });
        }
      }
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }

    if (!linkedinUrl) continue;
    result.found++;

    const { profile, isPrivate } = await tryLinkedInProfile(linkedinUrl);

    const sourceData = {
      name: channel.displayName || channel.username,
      avatar: channel.avatarUrl,
      followers: channel.followers || 0,
      platform: 'YOUTUBE',
      username: channel.username
    };

    const success = await createLinkedInEntry(linkedinUrl, sourceData, profile, isPrivate);
    if (success) result.created++;

    await new Promise(r => setTimeout(r, 100));
  }

  return result;
}

// Keywords to search for LinkedIn profiles
const LINKEDIN_SEARCH_KEYWORDS = [
  'tech founder', 'startup ceo', 'software engineer', 'product manager',
  'venture capital', 'investor', 'entrepreneur', 'marketing director',
  'sales executive', 'data scientist', 'machine learning', 'ai researcher',
  'youtuber', 'content creator', 'influencer', 'podcast host',
  'business coach', 'consultant', 'cto', 'cmo', 'cfo',
  'growth hacker', 'digital marketer', 'seo expert', 'social media manager',
  'designer', 'ux researcher', 'brand strategist', 'creative director',
];

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN AGGRESSIVE DISCOVERY');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);

  let totalCreated = 0;

  // Phase 1: Try LinkedIn search API with various keywords
  console.log('\n=== Phase 1: LinkedIn Profile Search ===\n');
  for (const keyword of LINKEDIN_SEARCH_KEYWORDS.slice(0, 10)) {
    console.log(`Searching: "${keyword}"`);
    const created = await searchLinkedInProfiles(keyword);
    totalCreated += created;
    await new Promise(r => setTimeout(r, 500));
  }

  // Phase 2: Process YouTube channels in batches
  console.log('\n=== Phase 2: Processing YouTube Channels ===\n');

  const ytTotal = await db.streamer.count({ where: { platform: 'YOUTUBE' } });
  console.log(`Total YouTube channels: ${ytTotal}`);

  let offset = 0;
  let batchResults = { processed: 0, found: 0, created: 0 };

  while (offset < Math.min(ytTotal, 3000)) { // Process up to 3000 channels
    console.log(`\nBatch ${Math.floor(offset / BATCH_SIZE) + 1}: channels ${offset} - ${offset + BATCH_SIZE}`);
    const batch = await processYouTubeChannelBatch(offset, BATCH_SIZE);
    batchResults.processed += batch.processed;
    batchResults.found += batch.found;
    batchResults.created += batch.created;
    totalCreated += batch.created;

    console.log(`  Processed: ${batch.processed}, Found: ${batch.found}, Created: ${batch.created}`);

    const currentCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
    console.log(`  Total LinkedIn now: ${currentCount}`);

    if (currentCount >= 1000) {
      console.log('\n🎉 Reached 1000 LinkedIn profiles target!');
      break;
    }

    offset += BATCH_SIZE;
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   AGGRESSIVE DISCOVERY COMPLETE');
  console.log('===========================================');
  console.log(`YouTube processed: ${batchResults.processed}`);
  console.log(`LinkedIn URLs found: ${batchResults.found}`);
  console.log(`New LinkedIn created: ${totalCreated}`);
  console.log(`Initial LinkedIn: ${initialCount}`);
  console.log(`Final LinkedIn: ${finalCount}`);
  console.log(`Progress: ${finalCount}/1000 target`);

  await db.$disconnect();
}

main().catch(console.error);
