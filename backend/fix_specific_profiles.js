/**
 * Quick fix script for specific profiles
 * Fixes avatar URLs and region data
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const db = new PrismaClient();

async function uploadToBunny(imageUrl, platform, username) {
  if (!imageUrl || imageUrl.includes('media.envr.io')) return imageUrl;
  try {
    const imageRes = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const buffer = Buffer.from(imageRes.data);
    const ext = imageUrl.includes('.png') ? 'png' : 'jpg';
    const filename = `avatars/${platform.toLowerCase()}/${username.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;
    const uploadUrl = `https://${process.env.BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${filename}`;
    await axios.put(uploadUrl, buffer, {
      headers: { 'AccessKey': process.env.BUNNY_STORAGE_API_KEY, 'Content-Type': `image/${ext}` },
      timeout: 30000
    });
    return `https://${process.env.BUNNY_CDN_HOSTNAME}/${filename}`;
  } catch (e) {
    console.log('Upload failed:', e.message);
    return imageUrl;
  }
}

async function fixInstagramProfile(handle) {
  console.log(`\n=== Fixing @${handle} ===`);

  // Get from DB
  const profile = await db.streamer.findFirst({
    where: { platform: 'INSTAGRAM', username: handle.toLowerCase() }
  });

  if (!profile) {
    console.log('Profile not found in DB');
    return;
  }

  console.log('Current avatar:', profile.avatarUrl);
  console.log('Avatar on Bunny?', profile.avatarUrl?.includes('media.envr.io'));
  console.log('Current region:', profile.region);
  console.log('Current country:', profile.inferredCountry);

  // Fetch fresh data from ScrapeCreators
  const res = await axios.get('https://api.scrapecreators.com/v1/instagram/profile', {
    headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
    params: { handle },
    timeout: 30000
  });

  if (res.data.success && res.data.data?.user) {
    const ig = res.data.data.user;
    const freshAvatar = ig.profile_pic_url_hd || ig.profile_pic_url;
    console.log('Fresh avatar URL:', freshAvatar);

    // Upload to Bunny
    const newAvatarUrl = await uploadToBunny(freshAvatar, 'INSTAGRAM', ig.username);

    console.log('New Bunny URL:', newAvatarUrl);

    // Update DB
    await db.streamer.update({
      where: { id: profile.id },
      data: {
        avatarUrl: newAvatarUrl,
        region: 'OTHER', // Instagram doesn't provide real country
        inferredCountry: null,
        displayName: ig.full_name,
        followers: ig.edge_followed_by?.count || profile.followers,
        lastScrapedAt: new Date()
      }
    });

    console.log('FIXED! Avatar uploaded to Bunny, region set to OTHER');
  } else {
    console.log('Failed to fetch from ScrapeCreators');
  }
}

async function fixTikTokProfile(handle) {
  console.log(`\n=== Fixing TikTok @${handle} ===`);

  // Get from DB
  const profile = await db.streamer.findFirst({
    where: { platform: 'TIKTOK', username: handle.toLowerCase() }
  });

  if (!profile) {
    console.log('Profile not found in DB');
    return;
  }

  console.log('Current avatar:', profile.avatarUrl);
  console.log('Avatar on Bunny?', profile.avatarUrl?.includes('media.envr.io'));

  // Fetch fresh data from ScrapeCreators
  const res = await axios.get('https://api.scrapecreators.com/v1/tiktok/profile', {
    headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
    params: { handle },
    timeout: 30000
  });

  if (res.data.success && res.data.user) {
    const tt = res.data;
    const freshAvatar = tt.user.avatarLarger;
    console.log('Fresh avatar URL:', freshAvatar);

    // Upload to Bunny
    const newAvatarUrl = await uploadToBunny(freshAvatar, 'TIKTOK', tt.user.uniqueId);

    console.log('New Bunny URL:', newAvatarUrl);

    // Update DB
    await db.streamer.update({
      where: { id: profile.id },
      data: {
        avatarUrl: newAvatarUrl,
        displayName: tt.user.nickname,
        followers: parseInt(tt.statsV2?.followerCount) || tt.stats?.followerCount || profile.followers,
        lastScrapedAt: new Date()
      }
    });

    console.log('FIXED! Avatar uploaded to Bunny');
  } else {
    console.log('Failed to fetch from ScrapeCreators');
  }
}

async function main() {
  console.log('Starting profile fixes...\n');

  // Fix Instagram profiles
  await fixInstagramProfile('instagram');
  await fixInstagramProfile('annehathaway');
  await fixInstagramProfile('blackpinkofficial');

  // Fix TikTok profiles (BlackPink is bp_tiktok)
  await fixTikTokProfile('bp_tiktok');

  console.log('\n=== Done ===');
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  await db.$disconnect();
  process.exit(1);
});
