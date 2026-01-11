require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const db = new PrismaClient();
const API_KEY = process.env.SCRAPECREATORS_API_KEY;
const BASE_URL = 'https://api.scrapecreators.com';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Platform to sync: TIKTOK or INSTAGRAM
const PLATFORM = process.argv[2]?.toUpperCase() || 'TIKTOK';
const BATCH_SIZE = 10;
const MIN_FOLLOWERS = 50000; // Only sync influencers with 50k+ followers

async function searchTikTok(query) {
  try {
    const res = await client.get('/v1/tiktok/search/users', { params: { query } });
    return res.data?.user_list || [];
  } catch (e) {
    console.log(`   Search error: ${e.message}`);
    return [];
  }
}

async function getTikTokProfile(handle) {
  try {
    const res = await client.get('/v1/tiktok/profile', { params: { handle } });
    return res.data?.user ? { ...res.data.user, ...res.data.stats } : null;
  } catch (e) {
    return null;
  }
}

async function searchInstagram(query) {
  try {
    const res = await client.get('/v1/instagram/search', { params: { query } });
    return res.data?.users || [];
  } catch (e) {
    console.log(`   Search error: ${e.message}`);
    return [];
  }
}

async function getInstagramProfile(handle) {
  try {
    const res = await client.get('/v1/instagram/profile', { params: { handle } });
    return res.data?.data || res.data?.user || res.data;
  } catch (e) {
    return null;
  }
}

function scoreTikTokResult(r, displayName, expectedFollowers) {
  const info = r.user_info;
  let score = 0;
  if (info.custom_verify) score += 100;
  score += Math.log10((info.follower_count || 0) + 1) * 10;
  const nameLower = displayName.toLowerCase();
  const nickLower = (info.nickname || '').toLowerCase();
  const uniqueLower = (info.unique_id || '').toLowerCase();
  if (nickLower.includes(nameLower) || nameLower.includes(nickLower)) score += 20;
  if (uniqueLower.includes(nameLower.replace(/\s/g, ''))) score += 15;
  if ((info.follower_count || 0) >= expectedFollowers * 0.01) score += 30;
  return { result: r, score, followers: info.follower_count };
}

function scoreInstagramResult(r, displayName, expectedFollowers) {
  let score = 0;
  if (r.is_verified) score += 100;
  score += Math.log10((r.follower_count || 0) + 1) * 10;
  const nameLower = displayName.toLowerCase();
  if ((r.full_name || '').toLowerCase().includes(nameLower)) score += 20;
  if ((r.username || '').toLowerCase().includes(nameLower.replace(/\s/g, ''))) score += 15;
  if ((r.follower_count || 0) >= expectedFollowers * 0.01) score += 30;
  return { result: r, score, followers: r.follower_count };
}

async function run() {
  console.log(`🚀 Syncing ${PLATFORM} to influencers (min ${MIN_FOLLOWERS.toLocaleString()} followers)\n`);

  // Get influencers without this platform, sorted by reach
  // Skip entries marked as NOT_FOUND from previous failed searches
  const whereClause = PLATFORM === 'TIKTOK'
    ? { tiktokUsername: null, totalReach: { gte: MIN_FOLLOWERS } }
    : { instagramUsername: null, totalReach: { gte: MIN_FOLLOWERS } };

  // Also exclude already marked as not found
  const notFoundClause = PLATFORM === 'TIKTOK'
    ? { NOT: { tiktokUsername: 'NOT_FOUND' } }
    : { NOT: { instagramUsername: 'NOT_FOUND' } };

  const influencers = await db.influencer.findMany({
    where: whereClause,
    orderBy: { totalReach: 'desc' },
    take: BATCH_SIZE,
    select: {
      id: true,
      displayName: true,
      totalReach: true,
      twitchUsername: true,
      youtubeUsername: true,
    },
  });

  console.log(`📊 Found ${influencers.length} influencers to process\n`);

  if (influencers.length === 0) {
    console.log('✅ No more influencers to sync!');
    await db.$disconnect();
    return;
  }

  let found = 0;
  let notFound = 0;
  let credits = 0;

  for (const inf of influencers) {
    console.log(`[${found + notFound + 1}/${influencers.length}] ${inf.displayName} (${Number(inf.totalReach).toLocaleString()} reach)`);

    try {
      if (PLATFORM === 'TIKTOK') {
        // Search TikTok
        const results = await searchTikTok(inf.displayName);
        credits++;

        if (results.length === 0) {
          console.log(`   ❌ No results - skipping`);
          await db.influencer.update({ where: { id: inf.id }, data: { tiktokUsername: 'NOT_FOUND' } });
          notFound++;
          continue;
        }

        // Score and pick best
        const scored = results.map(r => scoreTikTokResult(r, inf.displayName, Number(inf.totalReach)));
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        console.log(`   🔍 Best: @${best.result.user_info.unique_id} (${best.followers?.toLocaleString()} followers, score: ${best.score.toFixed(0)})`);

        // Get full profile
        const profile = await getTikTokProfile(best.result.user_info.unique_id);
        credits++;

        if (!profile) {
          console.log(`   ❌ Profile fetch failed - skipping`);
          await db.influencer.update({ where: { id: inf.id }, data: { tiktokUsername: 'NOT_FOUND' } });
          notFound++;
          continue;
        }

        const followers = parseInt(profile.followerCount) || 0;
        const hearts = parseInt(profile.heartCount) || 0;

        // Update influencer
        await db.influencer.update({
          where: { id: inf.id },
          data: {
            tiktokId: profile.id || profile.uniqueId,
            tiktokUsername: profile.uniqueId,
            tiktokDisplayName: profile.nickname,
            tiktokFollowers: followers,
            tiktokAvatar: profile.avatarLarger,
            tiktokUrl: `https://tiktok.com/@${profile.uniqueId}`,
            tiktokVerified: profile.verified || false,
            tiktokLikes: BigInt(hearts),
            tiktokVideos: parseInt(profile.videoCount) || 0,
            totalReach: BigInt(Number(inf.totalReach) + followers),
            platformCount: { increment: 1 },
          },
        });

        console.log(`   ✅ Saved! ${followers.toLocaleString()} followers, ${hearts.toLocaleString()} likes`);
        found++;

      } else if (PLATFORM === 'INSTAGRAM') {
        // Search Instagram
        const results = await searchInstagram(inf.displayName);
        credits++;

        if (results.length === 0) {
          console.log(`   ❌ No results`);
          notFound++;
          continue;
        }

        // Score and pick best
        const scored = results.map(r => scoreInstagramResult(r, inf.displayName, Number(inf.totalReach)));
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        console.log(`   🔍 Best: @${best.result.username} (${best.followers?.toLocaleString()} followers, score: ${best.score.toFixed(0)})`);

        // Get full profile
        const profile = await getInstagramProfile(best.result.username);
        credits++;

        if (!profile) {
          console.log(`   ❌ Profile fetch failed`);
          notFound++;
          continue;
        }

        // Update influencer
        await db.influencer.update({
          where: { id: inf.id },
          data: {
            instagramId: profile.id,
            instagramUsername: profile.username,
            instagramDisplayName: profile.full_name,
            instagramFollowers: profile.follower_count || 0,
            instagramAvatar: profile.profile_pic_url,
            instagramUrl: `https://instagram.com/${profile.username}`,
            instagramVerified: profile.is_verified || false,
            instagramLikes: BigInt(profile.total_likes || 0),
            instagramPosts: profile.media_count || 0,
            totalReach: BigInt(Number(inf.totalReach) + (profile.follower_count || 0)),
            platformCount: { increment: 1 },
          },
        });

        console.log(`   ✅ Saved! ${(profile.follower_count || 0).toLocaleString()} followers`);
        found++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      notFound++;
    }
  }

  console.log(`\n🎉 Done! Found: ${found}, Not found: ${notFound}, Credits used: ~${credits}`);

  // Show remaining count
  const remaining = await db.influencer.count({ where: whereClause });
  console.log(`📊 Remaining without ${PLATFORM}: ${remaining}`);

  await db.$disconnect();
}

run().catch(console.error);
