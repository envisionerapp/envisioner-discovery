/**
 * CONTINUOUS POPULATION SCRIPT
 * Discovers creators from Twitch, YouTube, Kick APIs
 * Enriches with social profiles via ScrapeCreators
 * Uploads avatars to Bunny CDN
 * Links unified influencer profiles
 *
 * Run: node continuous_population.js
 * Stop: Ctrl+C
 */

require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

// ============ CONFIGURATION ============
const CONFIG = {
  MIN_FOLLOWERS: 1000,
  RATE_LIMITS: {
    TWITCH_BATCH_DELAY: 2000,      // 2s between batches
    KICK_BATCH_DELAY: 2000,        // 2s between batches
    YOUTUBE_BATCH_DELAY: 3000,     // 3s between batches (quota sensitive)
    SCRAPECREATORS_DELAY: 1000,    // 1s between requests
    BUNNY_UPLOAD_DELAY: 500,       // 0.5s between uploads
    CYCLE_DELAY: 60000,            // 1 min between full cycles
  },
  BATCH_SIZES: {
    TWITCH_STREAMS: 100,
    KICK_STREAMS: 30,
    YOUTUBE_SEARCH: 50,
    SOCIAL_ENRICHMENT: 10,
  }
};

// Country code to Region mapping
const COUNTRY_TO_REGION = {
  'MX': 'MEXICO', 'CO': 'COLOMBIA', 'AR': 'ARGENTINA', 'CL': 'CHILE',
  'PE': 'PERU', 'VE': 'VENEZUELA', 'EC': 'ECUADOR', 'BO': 'BOLIVIA',
  'PY': 'PARAGUAY', 'UY': 'URUGUAY', 'CR': 'COSTA_RICA', 'PA': 'PANAMA',
  'GT': 'GUATEMALA', 'SV': 'EL_SALVADOR', 'HN': 'HONDURAS', 'NI': 'NICARAGUA',
  'DO': 'DOMINICAN_REPUBLIC', 'PR': 'PUERTO_RICO', 'BR': 'BRAZIL',
  'US': 'USA', 'CA': 'CANADA',
  'GB': 'UK', 'UK': 'UK', 'ES': 'SPAIN', 'DE': 'GERMANY', 'FR': 'FRANCE',
  'IT': 'ITALY', 'PT': 'PORTUGAL', 'NL': 'NETHERLANDS', 'SE': 'SWEDEN',
  'NO': 'NORWAY', 'DK': 'DENMARK', 'FI': 'FINLAND', 'PL': 'POLAND', 'RU': 'RUSSIA',
  'JP': 'JAPAN', 'KR': 'SOUTH_KOREA', 'CN': 'CHINA', 'TW': 'TAIWAN',
  'TH': 'THAILAND', 'VN': 'VIETNAM', 'ID': 'INDONESIA', 'MY': 'MALAYSIA',
  'PH': 'PHILIPPINES', 'IN': 'INDIA',
  'AU': 'AUSTRALIA', 'NZ': 'NEW_ZEALAND',
};

function getRegion(countryCode) {
  if (!countryCode) return 'OTHER';
  return COUNTRY_TO_REGION[countryCode.toUpperCase()] || 'OTHER';
}

// Language code to region mapping (for Kick/Twitch)
const LANGUAGE_TO_REGION = {
  'en': null, // English is too broad
  'es': 'SPAIN', // Could be LATAM, default to Spain
  'pt': 'BRAZIL',
  'de': 'GERMANY',
  'fr': 'FRANCE',
  'it': 'ITALY',
  'ja': 'JAPAN',
  'ko': 'SOUTH_KOREA',
  'ru': 'RUSSIA',
  'pl': 'POLAND',
  'nl': 'NETHERLANDS',
  'sv': 'SWEDEN',
  'no': 'NORWAY',
  'da': 'DENMARK',
  'fi': 'FINLAND',
};

function getRegionFromLanguage(langCode) {
  if (!langCode) return null;
  return LANGUAGE_TO_REGION[langCode.toLowerCase()] || null;
}

// Parse location string to extract country
function parseLocationToRegion(location) {
  if (!location) return null;
  const loc = location.toLowerCase();

  // Direct country mentions
  const countryPatterns = [
    [/\busa\b|\bunited states\b|\bamerica\b/, 'USA'],
    [/\buk\b|\bunited kingdom\b|\bengland\b|\bbritain\b/, 'UK'],
    [/\bcanada\b/, 'CANADA'],
    [/\bbrasil\b|\bbrazil\b/, 'BRAZIL'],
    [/\bm[eé]xico\b|\bmexico\b/, 'MEXICO'],
    [/\bargentina\b/, 'ARGENTINA'],
    [/\bchile\b/, 'CHILE'],
    [/\bcolombia\b/, 'COLOMBIA'],
    [/\bspain\b|\bespa[nñ]a\b/, 'SPAIN'],
    [/\bgermany\b|\bdeutschland\b/, 'GERMANY'],
    [/\bfrance\b/, 'FRANCE'],
    [/\bitaly\b|\bitalia\b/, 'ITALY'],
    [/\bportugal\b/, 'PORTUGAL'],
    [/\bjapan\b/, 'JAPAN'],
    [/\bkorea\b/, 'SOUTH_KOREA'],
    [/\baustralia\b/, 'AUSTRALIA'],
    [/\bperu\b|\bperú\b/, 'PERU'],
    [/\bvenezuela\b/, 'VENEZUELA'],
    [/\becuador\b/, 'ECUADOR'],
  ];

  for (const [pattern, region] of countryPatterns) {
    if (pattern.test(loc)) return region;
  }

  return null;
}

// ============ STATE ============
let stats = {
  cycleCount: 0,
  discovered: { twitch: 0, kick: 0, youtube: 0, instagramSimilar: 0 },
  enriched: { tiktok: 0, instagram: 0, x: 0, linkedin: 0, facebook: 0 },
  cleanup: { avatarsFixed: 0, regionsFixed: 0 },
  avatarsUploaded: 0,
  influencersLinked: 0,
  errors: 0,
  startTime: new Date(),
};

let twitchToken = null;
let twitchTokenExpiry = 0;
let kickToken = null;
let kickTokenExpiry = 0;

// ============ LOGGING ============
function log(level, message, data = null) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERR ]', success: '[ OK ]' }[level] || '[LOG ]';
  const output = `${timestamp} ${prefix} ${message}` + (data ? ' ' + JSON.stringify(data) : '');
  process.stdout.write(output + '\n');
}

function printStats() {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000 / 60);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    POPULATION STATS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Uptime: ${uptime} minutes | Cycles: ${stats.cycleCount}`);
  console.log(`  Discovered: Twitch=${stats.discovered.twitch} | Kick=${stats.discovered.kick} | YouTube=${stats.discovered.youtube} | IG-Similar=${stats.discovered.instagramSimilar}`);
  console.log(`  Enriched: TikTok=${stats.enriched.tiktok} | IG=${stats.enriched.instagram} | X=${stats.enriched.x} | LinkedIn=${stats.enriched.linkedin} | FB=${stats.enriched.facebook}`);
  console.log(`  Cleanup: Avatars=${stats.cleanup.avatarsFixed} | Regions=${stats.cleanup.regionsFixed}`);
  console.log(`  Avatars uploaded: ${stats.avatarsUploaded} | Influencers linked: ${stats.influencersLinked}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============ BUNNY CDN ============
async function uploadToBunny(imageUrl, platform, username) {
  try {
    if (!imageUrl || imageUrl.includes('media.envr.io')) return imageUrl; // Already on Bunny

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
      headers: {
        'AccessKey': process.env.BUNNY_STORAGE_API_KEY,
        'Content-Type': `image/${ext}`
      },
      timeout: 30000
    });

    stats.avatarsUploaded++;
    return `https://${process.env.BUNNY_CDN_HOSTNAME}/${filename}`;
  } catch (error) {
    log('warn', `Failed to upload avatar for ${username}: ${error.message}`);
    return imageUrl; // Return original URL as fallback
  }
}

// ============ TWITCH API ============
async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;

  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    }
  });

  twitchToken = res.data.access_token;
  twitchTokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
  return twitchToken;
}

async function discoverTwitchChannels() {
  log('info', 'Discovering Twitch channels...');
  try {
    log('info', 'Getting Twitch token...');
    const token = await getTwitchToken();
    log('info', 'Token obtained');
    let cursor = null;
    let totalDiscovered = 0;

  // Iterate through pages of live streams
  for (let page = 0; page < 5; page++) { // Max 5 pages per cycle
    try {
      log('info', `Twitch page ${page}: Fetching streams...`);
      const params = { first: CONFIG.BATCH_SIZES.TWITCH_STREAMS };
      if (cursor) params.after = cursor;

      const streamsRes = await axios.get('https://api.twitch.tv/helix/streams', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        },
        params,
        timeout: 15000
      });

      const streams = streamsRes.data.data || [];
      cursor = streamsRes.data.pagination?.cursor;
      log('info', `Twitch page ${page}: Got ${streams.length} streams`);

      if (streams.length === 0) break;

      // Filter by minimum viewers (proxy for followers)
      const qualifiedStreams = streams.filter(s => s.viewer_count >= 100);
      log('info', `Twitch page ${page}: ${qualifiedStreams.length} qualified (100+ viewers)`);

      // Get user details
      const userLogins = qualifiedStreams.map(s => s.user_login);
      if (userLogins.length === 0) continue;

      const usersRes = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        },
        params: { login: userLogins },
        timeout: 15000
      });

      const users = usersRes.data.data || [];
      log('info', `Twitch page ${page}: Got ${users.length} user profiles`);

      // Process each discovered channel
      for (const stream of qualifiedStreams) {
        const user = users.find(u => u.login === stream.user_login);
        if (!user) continue;

        // Check if already exists
        const existing = await db.streamer.findFirst({
          where: { platform: 'TWITCH', username: stream.user_login.toLowerCase() }
        });

        if (existing) {
          // Update live status
          await db.streamer.update({
            where: { id: existing.id },
            data: {
              isLive: true,
              currentViewers: stream.viewer_count,
              currentGame: stream.game_name,
              lastSeenLive: new Date(),
            }
          });
          continue;
        }

        // Upload avatar to Bunny
        const avatarUrl = await uploadToBunny(user.profile_image_url, 'TWITCH', stream.user_login);

        // Create new streamer
        await db.streamer.create({
          data: {
            platform: 'TWITCH',
            username: stream.user_login.toLowerCase(),
            displayName: stream.user_name,
            avatarUrl,
            profileUrl: `https://twitch.tv/${stream.user_login}`,
            profileDescription: user.description,
            followers: 0, // Will be updated by sync job
            currentViewers: stream.viewer_count,
            currentGame: stream.game_name,
            isLive: true,
            lastSeenLive: new Date(),
            lastScrapedAt: new Date(),
            syncTier: 'HOT',
            region: 'OTHER', // Will be inferred later
          }
        });

        totalDiscovered++;
        stats.discovered.twitch++;
      }

      if (!cursor) break;
      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.TWITCH_BATCH_DELAY));

    } catch (error) {
      log('error', `Twitch discovery page ${page}: ${error.message}`);
      stats.errors++;
      break;
    }
  }

  log('success', `Twitch: Discovered ${totalDiscovered} new channels`);
  return totalDiscovered;
  } catch (error) {
    log('error', `Twitch discovery failed: ${error.message}`);
    stats.errors++;
    return 0;
  }
}

// ============ KICK API ============
async function getKickToken() {
  if (kickToken && Date.now() < kickTokenExpiry) return kickToken;

  const res = await axios.post('https://id.kick.com/oauth/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KICK_CLIENT_ID,
      client_secret: process.env.KICK_CLIENT_SECRET
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  kickToken = res.data.access_token;
  kickTokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes
  return kickToken;
}

async function discoverKickChannels() {
  log('info', 'Discovering Kick channels...');
  const token = await getKickToken();
  let totalDiscovered = 0;
  let cursor = null;

  for (let page = 0; page < 5; page++) {
    try {
      const params = { limit: CONFIG.BATCH_SIZES.KICK_STREAMS };
      if (cursor) params.cursor = cursor;

      const liveRes = await axios.get('https://api.kick.com/public/v1/livestreams', {
        headers: { 'Authorization': `Bearer ${token}` },
        params
      });

      const streams = liveRes.data.data || [];
      cursor = liveRes.data.next_cursor;

      if (streams.length === 0) break;

      // Filter by viewer count
      const qualifiedStreams = streams.filter(s => s.viewer_count >= 50);

      for (const stream of qualifiedStreams) {
        const slug = stream.channel?.slug || stream.slug;
        if (!slug) continue;

        // Check if already exists
        const existing = await db.streamer.findFirst({
          where: { platform: 'KICK', username: slug.toLowerCase() }
        });

        if (existing) {
          await db.streamer.update({
            where: { id: existing.id },
            data: {
              isLive: true,
              currentViewers: stream.viewer_count,
              currentGame: stream.category?.name,
              lastSeenLive: new Date(),
            }
          });
          continue;
        }

        // Upload avatar to Bunny (Kick has profile_picture at root, thumbnail is a string)
        const originalAvatar = stream.profile_picture || stream.thumbnail;
        const avatarUrl = originalAvatar ? await uploadToBunny(originalAvatar, 'KICK', slug) : null;

        // Infer region from language
        const kickRegion = getRegionFromLanguage(stream.language) || 'OTHER';

        await db.streamer.create({
          data: {
            platform: 'KICK',
            username: slug.toLowerCase(),
            displayName: stream.stream_title?.substring(0, 50) || slug,
            avatarUrl,
            profileUrl: `https://kick.com/${slug}`,
            followers: stream.channel?.followers_count || 0,
            currentViewers: stream.viewer_count,
            currentGame: stream.category?.name,
            isLive: true,
            lastSeenLive: new Date(),
            lastScrapedAt: new Date(),
            syncTier: 'HOT',
            region: kickRegion,
            inferredCountry: stream.language ? `lang:${stream.language}` : null,
          }
        });

        totalDiscovered++;
        stats.discovered.kick++;
      }

      if (!cursor) break;
      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.KICK_BATCH_DELAY));

    } catch (error) {
      log('error', `Kick discovery page ${page}: ${error.message}`);
      stats.errors++;
      break;
    }
  }

  log('success', `Kick: Discovered ${totalDiscovered} new channels`);
  return totalDiscovered;
}

// ============ YOUTUBE API ============
async function discoverYouTubeChannels() {
  log('info', 'Discovering YouTube channels...');
  let totalDiscovered = 0;

  // Search queries for discovery
  const searchQueries = [
    'live stream gaming', 'streaming now', 'live gaming',
    'gameplay live', 'twitch streamer youtube', 'kick streamer'
  ];

  for (const query of searchQueries) {
    try {
      // Search for live videos
      const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          part: 'snippet',
          type: 'video',
          eventType: 'live',
          q: query,
          maxResults: 20,
          relevanceLanguage: 'en'
        }
      });

      const videos = searchRes.data.items || [];
      const channelIds = [...new Set(videos.map(v => v.snippet.channelId))];

      if (channelIds.length === 0) continue;

      // Get channel details
      const channelsRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          part: 'snippet,statistics',
          id: channelIds.join(',')
        }
      });

      const channels = channelsRes.data.items || [];

      for (const channel of channels) {
        const subs = parseInt(channel.statistics.subscriberCount) || 0;
        if (subs < CONFIG.MIN_FOLLOWERS) continue;

        const username = channel.snippet.customUrl?.replace('@', '') || channel.id;

        // Check if exists
        const existing = await db.streamer.findFirst({
          where: {
            OR: [
              { platform: 'YOUTUBE', username: username.toLowerCase() },
              { platform: 'YOUTUBE', username: channel.id }
            ]
          }
        });

        if (existing) {
          await db.streamer.update({
            where: { id: existing.id },
            data: {
              followers: subs,
              totalViews: parseInt(channel.statistics.viewCount) || 0,
              lastSeenLive: new Date(),
            }
          });
          continue;
        }

        // Upload avatar to Bunny
        const originalAvatar = channel.snippet.thumbnails?.high?.url;
        const avatarUrl = await uploadToBunny(originalAvatar, 'YOUTUBE', username);

        await db.streamer.create({
          data: {
            platform: 'YOUTUBE',
            username: username.toLowerCase(),
            displayName: channel.snippet.title,
            avatarUrl,
            profileUrl: `https://youtube.com/${channel.snippet.customUrl || 'channel/' + channel.id}`,
            profileDescription: channel.snippet.description?.substring(0, 2000),
            followers: subs,
            totalViews: parseInt(channel.statistics.viewCount) || 0,
            inferredCountry: channel.snippet.country,
            lastScrapedAt: new Date(),
            syncTier: subs > 100000 ? 'HOT' : subs > 10000 ? 'ACTIVE' : 'STANDARD',
            region: getRegion(channel.snippet.country),
          }
        });

        totalDiscovered++;
        stats.discovered.youtube++;
      }

      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.YOUTUBE_BATCH_DELAY));

    } catch (error) {
      if (error.response?.status === 403) {
        log('warn', 'YouTube API quota likely exceeded, skipping...');
        break;
      }
      log('error', `YouTube discovery for "${query}": ${error.message}`);
      stats.errors++;
    }
  }

  log('success', `YouTube: Discovered ${totalDiscovered} new channels`);
  return totalDiscovered;
}

// ============ HELPER: Add social profile to DB ============
async function addSocialProfile(platform, handle, sourceStreamerId) {
  if (!handle) return null;
  handle = handle.toLowerCase().replace('@', '');

  // Check if already exists
  const existing = await db.streamer.findFirst({
    where: { platform, username: handle }
  });
  if (existing) return existing.id;

  try {
    let profileData = null;
    let avatarUrl = null;

    if (platform === 'TIKTOK') {
      const res = await axios.get('https://api.scrapecreators.com/v1/tiktok/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle },
        timeout: 30000
      });
      if (res.data.success && res.data.user) {
        const tt = res.data;
        const followers = parseInt(tt.statsV2?.followerCount) || tt.stats?.followerCount || 0;
        if (followers < CONFIG.MIN_FOLLOWERS) return null;
        avatarUrl = await uploadToBunny(tt.user.avatarLarger, 'TIKTOK', tt.user.uniqueId);
        profileData = {
          platform: 'TIKTOK',
          username: tt.user.uniqueId.toLowerCase(),
          displayName: tt.user.nickname,
          avatarUrl,
          profileUrl: `https://tiktok.com/@${tt.user.uniqueId}`,
          profileDescription: tt.user.signature,
          followers,
          totalLikes: parseInt(tt.statsV2?.heartCount) || 0,
          region: 'OTHER',
        };
        stats.enriched.tiktok++;
      }
    } else if (platform === 'INSTAGRAM') {
      const res = await axios.get('https://api.scrapecreators.com/v1/instagram/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle },
        timeout: 30000
      });
      if (res.data.success && res.data.data?.user) {
        const ig = res.data.data.user;
        const followers = ig.edge_followed_by?.count || 0;
        if (followers < CONFIG.MIN_FOLLOWERS) return null;
        avatarUrl = await uploadToBunny(ig.profile_pic_url_hd || ig.profile_pic_url, 'INSTAGRAM', ig.username);
        profileData = {
          platform: 'INSTAGRAM',
          username: ig.username.toLowerCase(),
          displayName: ig.full_name,
          avatarUrl,
          profileUrl: `https://instagram.com/${ig.username}`,
          profileDescription: ig.biography,
          followers,
          region: 'OTHER',
        };
        stats.enriched.instagram++;
      }
    } else if (platform === 'X') {
      const res = await axios.get('https://api.scrapecreators.com/v1/twitter/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle },
        timeout: 30000
      });
      if (res.data.success) {
        const x = res.data.data || res.data.legacy || res.data;
        const followers = x.followers_count || 0;
        if (followers < CONFIG.MIN_FOLLOWERS) return null;
        const xUsername = x.screen_name || x.username || handle;
        avatarUrl = await uploadToBunny(x.profile_image_url_https || res.data.avatar, 'X', xUsername);
        const locationStr = res.data.location?.location || x.location;
        profileData = {
          platform: 'X',
          username: xUsername.toLowerCase(),
          displayName: x.name,
          avatarUrl,
          profileUrl: `https://x.com/${xUsername}`,
          profileDescription: x.description,
          followers,
          region: parseLocationToRegion(locationStr) || 'OTHER',
          inferredCountry: locationStr,
        };
        stats.enriched.x++;
      }
    } else if (platform === 'LINKEDIN') {
      // LinkedIn requires full URL
      const url = handle.startsWith('http') ? handle : `https://linkedin.com/in/${handle}`;
      const res = await axios.get('https://api.scrapecreators.com/v1/linkedin/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { url },
        timeout: 30000
      });
      if (res.data.success || res.data.data) {
        const li = res.data.data || res.data;
        const followers = li.followers_count || li.followerCount || 0;
        const username = li.public_identifier || li.username || url.split('/in/')[1]?.split('/')[0] || handle;
        avatarUrl = await uploadToBunny(li.profile_pic_url || li.avatar, 'LINKEDIN', username);
        const locationStr = li.location?.name || li.location;
        profileData = {
          platform: 'LINKEDIN',
          username: username.toLowerCase(),
          displayName: li.full_name || li.name,
          avatarUrl,
          profileUrl: url,
          profileDescription: li.headline || li.summary,
          followers,
          region: parseLocationToRegion(locationStr) || 'OTHER',
          inferredCountry: locationStr,
        };
        stats.enriched.linkedin++;
      }
    } else if (platform === 'FACEBOOK') {
      // Facebook requires full URL
      const url = handle.startsWith('http') ? handle : `https://facebook.com/${handle}`;
      const res = await axios.get('https://api.scrapecreators.com/v1/facebook/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { url },
        timeout: 30000
      });
      if (res.data.success || res.data.data) {
        const fb = res.data.data || res.data;
        const followers = fb.followers_count || fb.follower_count || fb.likes || 0;
        const username = fb.username || fb.id || url.split('facebook.com/')[1]?.split('/')[0] || handle;
        avatarUrl = await uploadToBunny(fb.profile_pic_url || fb.avatar, 'FACEBOOK', username);
        profileData = {
          platform: 'FACEBOOK',
          username: username.toLowerCase(),
          displayName: fb.name,
          avatarUrl,
          profileUrl: url,
          profileDescription: fb.about || fb.bio,
          followers,
          region: 'OTHER',
        };
        stats.enriched.facebook++;
      }
    }

    if (profileData) {
      const created = await db.streamer.create({
        data: { ...profileData, lastScrapedAt: new Date() }
      });
      log('info', `  + ${platform}: ${profileData.username} (${profileData.followers?.toLocaleString()} followers)`);
      return created.id;
    }
  } catch (e) {
    // Profile not found or error, continue
  }

  await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
  return null;
}

// ============ SCRAPECREATORS ENRICHMENT ============

// Helper to extract linked socials from any ScrapeCreators response
function extractLinkedSocials(data) {
  const linked = {
    ig: null,
    tiktok: null,
    twitter: null,
    youtube: null,
    twitch: null,
    kick: null,
    linkedin: null,
    facebook: null,
    links: []
  };

  if (!data) return linked;

  // Direct fields
  linked.ig = data.ig || data.instagram || null;
  linked.tiktok = data.tiktok || null;
  linked.twitter = data.twitter || data.x || null;
  linked.youtube = data.youtube || null;
  linked.twitch = data.twitch || null;
  linked.kick = data.kick || null;
  linked.linkedin = data.linkedin || null;
  linked.facebook = data.facebook || data.fb || null;
  linked.links = data.links || [];

  // Also check description/bio for social links
  const bio = data.description || data.bio || data.about || '';
  if (bio) {
    // Extract Instagram handle from bio
    if (!linked.ig) {
      const igMatch = bio.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i) || bio.match(/@([a-zA-Z0-9_.]+)\s*(?:on\s*)?ig/i);
      if (igMatch) linked.ig = igMatch[1];
    }
    // Extract TikTok handle from bio
    if (!linked.tiktok) {
      const ttMatch = bio.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i);
      if (ttMatch) linked.tiktok = ttMatch[1];
    }
    // Extract Twitter/X handle from bio
    if (!linked.twitter) {
      const xMatch = bio.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
      if (xMatch) linked.twitter = xMatch[1];
    }
    // Extract LinkedIn URL from bio
    if (!linked.linkedin) {
      const liMatch = bio.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
      if (liMatch) linked.linkedin = `https://linkedin.com/in/${liMatch[1]}`;
    }
    // Extract Facebook URL from bio
    if (!linked.facebook) {
      const fbMatch = bio.match(/facebook\.com\/([a-zA-Z0-9_.]+)/i);
      if (fbMatch) linked.facebook = `https://facebook.com/${fbMatch[1]}`;
    }
  }

  // Also scan links array for LinkedIn and Facebook
  for (const link of linked.links) {
    if (!linked.linkedin && link.includes('linkedin.com/')) {
      linked.linkedin = link;
    }
    if (!linked.facebook && link.includes('facebook.com/')) {
      linked.facebook = link;
    }
  }

  return linked;
}

// Process linked socials and add to database
async function processLinkedSocials(linkedSocials, sourceStreamer, sourcePlatform) {
  let added = 0;

  // Add Instagram
  if (linkedSocials.ig) {
    const handle = linkedSocials.ig.replace(/.*instagram\.com\//i, '').split('/')[0].replace('@', '');
    const result = await addSocialProfile('INSTAGRAM', handle, sourceStreamer.id);
    if (result) added++;
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
  }

  // Add TikTok
  if (linkedSocials.tiktok) {
    const handle = linkedSocials.tiktok.replace(/.*tiktok\.com\/@?/i, '').split('/')[0].replace('@', '');
    const result = await addSocialProfile('TIKTOK', handle, sourceStreamer.id);
    if (result) added++;
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
  }

  // Add Twitter/X
  if (linkedSocials.twitter) {
    const handle = linkedSocials.twitter.replace(/.*(?:twitter|x)\.com\//i, '').split('/')[0].split('?')[0].replace('@', '');
    const result = await addSocialProfile('X', handle, sourceStreamer.id);
    if (result) added++;
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
  }

  // Add LinkedIn
  if (linkedSocials.linkedin) {
    const result = await addSocialProfile('LINKEDIN', linkedSocials.linkedin, sourceStreamer.id);
    if (result) added++;
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
  }

  // Add Facebook
  if (linkedSocials.facebook) {
    const result = await addSocialProfile('FACEBOOK', linkedSocials.facebook, sourceStreamer.id);
    if (result) added++;
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
  }

  // Add YouTube (if source is not YouTube)
  if (linkedSocials.youtube && sourcePlatform !== 'YOUTUBE') {
    const handle = linkedSocials.youtube.replace(/.*youtube\.com\/@?/i, '').replace(/\/channel\//i, '').split('/')[0];
    // Add as streamer if not exists
    const existing = await db.streamer.findFirst({ where: { platform: 'YOUTUBE', username: handle.toLowerCase() } });
    if (!existing) {
      log('info', `    + Found linked YouTube: ${handle}`);
    }
  }

  // Parse links array for additional socials
  for (const link of linkedSocials.links) {
    if (!linkedSocials.twitter && (link.includes('twitter.com/') || link.includes('x.com/'))) {
      const xHandle = link.replace(/.*(?:twitter|x)\.com\//i, '').split('/')[0].split('?')[0];
      const result = await addSocialProfile('X', xHandle, sourceStreamer.id);
      if (result) added++;
      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    }
    if (!linkedSocials.ig && link.includes('instagram.com/')) {
      const igHandle = link.replace(/.*instagram\.com\//i, '').split('/')[0];
      const result = await addSocialProfile('INSTAGRAM', igHandle, sourceStreamer.id);
      if (result) added++;
      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    }
    if (!linkedSocials.tiktok && link.includes('tiktok.com/')) {
      const ttHandle = link.replace(/.*tiktok\.com\/@?/i, '').split('/')[0];
      const result = await addSocialProfile('TIKTOK', ttHandle, sourceStreamer.id);
      if (result) added++;
      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    }
  }

  return added;
}

async function enrichWithSocials() {
  log('info', 'Enriching creators with social profiles...');
  let socialsLinked = 0;

  // ============ ENRICH TWITCH STREAMERS ============
  const twitchStreamers = await db.streamer.findMany({
    where: { platform: 'TWITCH' },
    orderBy: { lastScrapedAt: 'desc' },
    take: CONFIG.BATCH_SIZES.SOCIAL_ENRICHMENT
  });

  log('info', `Processing ${twitchStreamers.length} streamers for social enrichment...`);

  for (const streamer of twitchStreamers) {
    try {
      // Fetch Twitch profile from ScrapeCreators to get linked socials
      const res = await axios.get('https://api.scrapecreators.com/v1/twitch/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle: streamer.username },
        timeout: 30000
      });

      if (res.data.success || res.data.data) {
        const data = res.data.data || res.data;
        const linkedSocials = extractLinkedSocials(data);

        const hasLinks = linkedSocials.ig || linkedSocials.tiktok || linkedSocials.twitter;
        if (hasLinks) {
          log('info', `Linked ${hasLinks ? '1+' : '0'} socials for ${streamer.displayName || streamer.username}`);
        }

        const added = await processLinkedSocials(linkedSocials, streamer, 'TWITCH');
        socialsLinked += added;
      }

      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    } catch (e) {
      // Profile not found or error, continue
    }
  }

  // ============ ENRICH KICK STREAMERS ============
  const kickStreamers = await db.streamer.findMany({
    where: { platform: 'KICK' },
    orderBy: { lastScrapedAt: 'desc' },
    take: CONFIG.BATCH_SIZES.SOCIAL_ENRICHMENT
  });

  for (const streamer of kickStreamers) {
    try {
      // Fetch Kick profile from ScrapeCreators
      const res = await axios.get('https://api.scrapecreators.com/v1/kick/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle: streamer.username },
        timeout: 30000
      });

      if (res.data.success || res.data.data) {
        const data = res.data.data || res.data;
        const linkedSocials = extractLinkedSocials(data);

        const hasLinks = linkedSocials.ig || linkedSocials.tiktok || linkedSocials.twitter;
        if (hasLinks) {
          log('info', `Linked ${hasLinks ? '1+' : '0'} socials for ${streamer.displayName || streamer.username}`);
        }

        const added = await processLinkedSocials(linkedSocials, streamer, 'KICK');
        socialsLinked += added;
      }

      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    } catch (e) {
      // Profile not found or error, continue
    }
  }

  // ============ ENRICH YOUTUBE CHANNELS ============
  const youtubeStreamers = await db.streamer.findMany({
    where: { platform: 'YOUTUBE', followers: { gte: CONFIG.MIN_FOLLOWERS } },
    orderBy: { lastScrapedAt: 'desc' },
    take: CONFIG.BATCH_SIZES.SOCIAL_ENRICHMENT
  });

  for (const streamer of youtubeStreamers) {
    try {
      // Fetch YouTube channel from ScrapeCreators
      const res = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle: streamer.username },
        timeout: 30000
      });

      if (res.data.success || res.data.data) {
        const data = res.data.data || res.data;
        const linkedSocials = extractLinkedSocials(data);

        const hasLinks = linkedSocials.ig || linkedSocials.tiktok || linkedSocials.twitter || linkedSocials.twitch;
        if (hasLinks) {
          log('info', `Linked ${hasLinks ? '1+' : '0'} socials for ${streamer.displayName || streamer.username}`);
        }

        const added = await processLinkedSocials(linkedSocials, streamer, 'YOUTUBE');
        socialsLinked += added;
      }

      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    } catch (e) {
      // Channel not found or error, continue
    }
  }

  log('success', `Enrichment complete: TikTok=${stats.enriched.tiktok}, IG=${stats.enriched.instagram}, X=${stats.enriched.x}, LinkedIn=${stats.enriched.linkedin}, FB=${stats.enriched.facebook}`);
}

// ============ INSTAGRAM SIMILAR PROFILES CRAWLER ============
async function crawlInstagramSimilarProfiles() {
  log('info', 'Crawling Instagram similar profiles...');
  let totalDiscovered = 0;

  // Get total count for random offset
  const totalCount = await db.streamer.count({
    where: {
      platform: 'INSTAGRAM',
      followers: { gte: CONFIG.MIN_FOLLOWERS }
    }
  });

  // Use random offset to get variety (not just top accounts)
  const randomOffset = Math.floor(Math.random() * Math.max(0, totalCount - 10));

  // Get Instagram profiles to crawl - mix of random + oldest scraped
  const instagramProfiles = await db.streamer.findMany({
    where: {
      platform: 'INSTAGRAM',
      followers: { gte: CONFIG.MIN_FOLLOWERS }
    },
    orderBy: { lastScrapedAt: 'asc' }, // Oldest scraped first (haven't been checked recently)
    skip: randomOffset,
    take: 10 // Process 10 profiles per cycle for more coverage
  });

  log('info', `Processing ${instagramProfiles.length} Instagram profiles for similar accounts (offset: ${randomOffset})...`);

  for (const profile of instagramProfiles) {
    try {
      // Fetch profile with similar accounts from ScrapeCreators
      const res = await axios.get('https://api.scrapecreators.com/v1/instagram/profile', {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
        params: { handle: profile.username },
        timeout: 30000
      });

      if (!res.data.success || !res.data.data?.user) continue;

      const relatedProfiles = res.data.data.user.edge_related_profiles?.edges || [];

      if (relatedProfiles.length > 0) {
        log('info', `  @${profile.username}: Found ${relatedProfiles.length} similar profiles`);
      }

      // Process each similar profile
      for (const edge of relatedProfiles) {
        const similar = edge.node;
        if (!similar?.username) continue;

        // Check if already exists
        const existing = await db.streamer.findFirst({
          where: { platform: 'INSTAGRAM', username: similar.username.toLowerCase() }
        });

        if (existing) continue;

        // Fetch full profile data for the similar account
        try {
          const similarRes = await axios.get('https://api.scrapecreators.com/v1/instagram/profile', {
            headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
            params: { handle: similar.username },
            timeout: 30000
          });

          if (similarRes.data.success && similarRes.data.data?.user) {
            const ig = similarRes.data.data.user;
            const followers = ig.edge_followed_by?.count || 0;

            if (followers < CONFIG.MIN_FOLLOWERS) continue;

            // Upload avatar to Bunny
            const avatarUrl = await uploadToBunny(
              ig.profile_pic_url_hd || ig.profile_pic_url,
              'INSTAGRAM',
              ig.username
            );

            // Create the profile
            await db.streamer.create({
              data: {
                platform: 'INSTAGRAM',
                username: ig.username.toLowerCase(),
                displayName: ig.full_name,
                avatarUrl,
                profileUrl: `https://instagram.com/${ig.username}`,
                profileDescription: ig.biography,
                followers,
                region: 'OTHER',
                lastScrapedAt: new Date(),
              }
            });

            totalDiscovered++;
            stats.discovered.instagramSimilar++;
            log('info', `    + @${ig.username} (${followers.toLocaleString()} followers) ${ig.is_verified ? '[verified]' : ''}`);

            // Now enrich this new profile with their linked socials
            const bio = ig.biography || '';
            const bioLinks = ig.bio_links || [];
            const externalUrl = ig.external_url || '';

            // Extract socials from bio and links
            let tiktokHandle = null;
            let twitterHandle = null;
            let youtubeHandle = null;
            let facebookUrl = null;
            let linkedinUrl = null;

            // Check bio for handles
            const ttMatch = bio.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i) || bio.match(/tiktok:\s*@?([a-zA-Z0-9_.]+)/i);
            if (ttMatch) tiktokHandle = ttMatch[1];

            const xMatch = bio.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i) || bio.match(/twitter:\s*@?([a-zA-Z0-9_]+)/i);
            if (xMatch) twitterHandle = xMatch[1];

            const ytMatch = bio.match(/youtube\.com\/@?([a-zA-Z0-9_-]+)/i) || bio.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/i);
            if (ytMatch) youtubeHandle = ytMatch[1];

            // Check bio_links
            for (const link of bioLinks) {
              const url = link.url || link.lynx_url || '';
              if (!tiktokHandle && url.includes('tiktok.com')) {
                const m = url.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i);
                if (m) tiktokHandle = m[1];
              }
              if (!twitterHandle && (url.includes('twitter.com') || url.includes('x.com'))) {
                const m = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
                if (m) twitterHandle = m[1];
              }
              if (!youtubeHandle && url.includes('youtube.com')) {
                const m = url.match(/youtube\.com\/@?([a-zA-Z0-9_-]+)/i);
                if (m) youtubeHandle = m[1];
              }
              if (!facebookUrl && url.includes('facebook.com')) {
                facebookUrl = url;
              }
              if (!linkedinUrl && url.includes('linkedin.com')) {
                linkedinUrl = url;
              }
            }

            // Check external_url
            if (externalUrl) {
              if (!tiktokHandle && externalUrl.includes('tiktok.com')) {
                const m = externalUrl.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i);
                if (m) tiktokHandle = m[1];
              }
              if (!twitterHandle && (externalUrl.includes('twitter.com') || externalUrl.includes('x.com'))) {
                const m = externalUrl.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
                if (m) twitterHandle = m[1];
              }
            }

            // Add linked socials
            if (tiktokHandle) {
              await addSocialProfile('TIKTOK', tiktokHandle, null);
              await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
            }
            if (twitterHandle) {
              await addSocialProfile('X', twitterHandle, null);
              await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
            }
            if (facebookUrl) {
              await addSocialProfile('FACEBOOK', facebookUrl, null);
              await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
            }
            if (linkedinUrl) {
              await addSocialProfile('LINKEDIN', linkedinUrl, null);
              await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
            }
          }

          await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
        } catch (e) {
          // Similar profile fetch failed, continue
        }
      }

      // Mark this profile as recently crawled for similar
      await db.streamer.update({
        where: { id: profile.id },
        data: { lastScrapedAt: new Date() }
      });

      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY * 2));
    } catch (e) {
      log('warn', `Failed to crawl similar for @${profile.username}: ${e.message}`);
      stats.errors++;
    }
  }

  log('success', `Instagram similar: Discovered ${totalDiscovered} new profiles`);
  return totalDiscovered;
}

// ============ DATA CLEANUP - Fix stale avatars and incorrect regions ============
async function cleanupStaleData() {
  log('info', 'Running data cleanup for stale avatars and regions...');
  let fixed = { avatars: 0, regions: 0 };

  // First, bulk fix WORLDWIDE -> OTHER (no API calls needed)
  const worldwideFixed = await db.streamer.updateMany({
    where: { region: 'WORLDWIDE' },
    data: { region: 'OTHER' }
  });
  if (worldwideFixed.count > 0) {
    log('info', `  Bulk fixed ${worldwideFixed.count} WORLDWIDE -> OTHER regions`);
    fixed.regions += worldwideFixed.count;
    stats.cleanup.regionsFixed += worldwideFixed.count;
  }

  // Find profiles with non-Bunny avatar URLs (stale CDN links)
  const staleAvatars = await db.streamer.findMany({
    where: {
      AND: [
        { avatarUrl: { not: null } },
        { avatarUrl: { not: { contains: 'media.envr.io' } } }
      ]
    },
    orderBy: { lastScrapedAt: 'asc' },
    take: 25 // Process 25 per cycle (increased from 10)
  });

  log('info', `Found ${staleAvatars.length} profiles with stale avatars to fix...`);

  for (const profile of staleAvatars) {
    try {
      let newAvatarUrl = null;
      let newRegion = null;
      let newCountry = null;

      // Re-fetch profile data based on platform
      if (profile.platform === 'INSTAGRAM') {
        const res = await axios.get('https://api.scrapecreators.com/v1/instagram/profile', {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
          params: { handle: profile.username },
          timeout: 30000
        });

        if (res.data.success && res.data.data?.user) {
          const ig = res.data.data.user;
          const avatarSrc = ig.profile_pic_url_hd || ig.profile_pic_url;
          if (avatarSrc) {
            newAvatarUrl = await uploadToBunny(avatarSrc, 'INSTAGRAM', ig.username);
          }
          // Instagram doesn't return country, so keep region as OTHER
          // But check biography for location hints
          if (ig.biography) {
            const bioRegion = parseLocationToRegion(ig.biography);
            if (bioRegion) newRegion = bioRegion;
          }
        }
      } else if (profile.platform === 'TIKTOK') {
        const res = await axios.get('https://api.scrapecreators.com/v1/tiktok/profile', {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
          params: { handle: profile.username },
          timeout: 30000
        });

        if (res.data.success && res.data.user) {
          const tt = res.data;
          const avatarSrc = tt.user.avatarLarger;
          if (avatarSrc) {
            newAvatarUrl = await uploadToBunny(avatarSrc, 'TIKTOK', tt.user.uniqueId);
          }
          // Check for region in signature
          if (tt.user.signature) {
            const sigRegion = parseLocationToRegion(tt.user.signature);
            if (sigRegion) newRegion = sigRegion;
          }
        }
      } else if (profile.platform === 'X') {
        const res = await axios.get('https://api.scrapecreators.com/v1/twitter/profile', {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
          params: { handle: profile.username },
          timeout: 30000
        });

        if (res.data.success) {
          const x = res.data.data || res.data.legacy || res.data;
          const avatarSrc = x.profile_image_url_https || res.data.avatar;
          if (avatarSrc) {
            // Get higher res version
            const hiResAvatar = avatarSrc.replace('_normal', '_400x400');
            newAvatarUrl = await uploadToBunny(hiResAvatar, 'X', profile.username);
          }
          const locationStr = res.data.location?.location || x.location;
          if (locationStr) {
            newRegion = parseLocationToRegion(locationStr);
            newCountry = locationStr;
          }
        }
      } else if (profile.platform === 'YOUTUBE') {
        const res = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY },
          params: { handle: profile.username },
          timeout: 30000
        });

        if (res.data.success || res.data.data) {
          const yt = res.data.data || res.data;
          if (yt.avatar) {
            newAvatarUrl = await uploadToBunny(yt.avatar, 'YOUTUBE', profile.username);
          }
          if (yt.country) {
            newRegion = getRegion(yt.country);
            newCountry = yt.country;
          }
        }
      }

      // Update the profile with new data
      const updateData = { lastScrapedAt: new Date() };

      if (newAvatarUrl && newAvatarUrl.includes('media.envr.io')) {
        updateData.avatarUrl = newAvatarUrl;
        fixed.avatars++;
        stats.cleanup.avatarsFixed++;
        log('info', `  Fixed avatar: @${profile.username} (${profile.platform})`);
      }

      if (newRegion && profile.region !== newRegion) {
        updateData.region = newRegion;
        fixed.regions++;
        stats.cleanup.regionsFixed++;
      }

      if (newCountry) {
        updateData.inferredCountry = newCountry;
      }

      await db.streamer.update({
        where: { id: profile.id },
        data: updateData
      });

      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.SCRAPECREATORS_DELAY));
    } catch (e) {
      log('warn', `  Failed to fix @${profile.username}: ${e.message}`);
    }
  }

  // Also fix profiles with incorrect region (like @instagram showing as FRANCE)
  // These were likely set by language inference which is unreliable
  const incorrectRegions = await db.streamer.findMany({
    where: {
      platform: 'INSTAGRAM',
      region: { not: 'OTHER' },
      inferredCountry: null // No actual country data, just language inference
    },
    take: 10
  });

  for (const profile of incorrectRegions) {
    // Reset to OTHER since Instagram doesn't provide real country data
    await db.streamer.update({
      where: { id: profile.id },
      data: { region: 'OTHER' }
    });
    fixed.regions++;
    stats.cleanup.regionsFixed++;
    log('info', `  Fixed region: @${profile.username} (was ${profile.region}, now OTHER)`);
  }

  log('success', `Cleanup complete: ${fixed.avatars} avatars fixed, ${fixed.regions} regions corrected`);
  return fixed;
}

// ============ INFLUENCER UNIFICATION ============
async function unifyInfluencers() {
  log('info', 'Unifying influencer profiles...');

  // Get base streamers (Twitch, YouTube, Kick) that aren't linked to an Influencer yet
  const baseStreamers = await db.streamer.findMany({
    where: {
      platform: { in: ['TWITCH', 'YOUTUBE', 'KICK'] },
      followers: { gte: CONFIG.MIN_FOLLOWERS }
    },
    orderBy: { followers: 'desc' },
    take: 50
  });

  let linkedCount = 0;

  for (const base of baseStreamers) {
    // Find matching social accounts by username or display name
    const normalizedUsername = base.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedDisplay = base.displayName?.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Find all matching streamers across platforms
    const allMatches = await db.streamer.findMany({
      where: {
        OR: [
          { username: { equals: base.username.toLowerCase() } },
          { username: { equals: normalizedUsername } },
          ...(normalizedDisplay ? [{ displayName: { contains: base.displayName, mode: 'insensitive' } }] : [])
        ]
      }
    });

    if (allMatches.length <= 1) continue;

    // Check if influencer already exists for this creator
    const existingInfluencer = await db.influencer.findFirst({
      where: {
        OR: [
          { twitchUsername: base.username.toLowerCase() },
          { youtubeUsername: base.username.toLowerCase() },
          { kickUsername: base.username.toLowerCase() },
        ]
      }
    });

    if (existingInfluencer) continue;

    // Build unified profile
    const platforms = {};
    let totalReach = 0;

    for (const match of allMatches) {
      const p = match.platform.toLowerCase();
      platforms[p] = {
        id: match.id,
        username: match.username,
        displayName: match.displayName,
        followers: match.followers || 0,
        avatar: match.avatarUrl,
        url: match.profileUrl,
      };
      totalReach += match.followers || 0;
    }

    // Create unified influencer
    try {
      await db.influencer.create({
        data: {
          displayName: base.displayName,
          country: base.inferredCountry,
          primaryCategory: base.primaryCategory || base.inferredCategory,
          sourceStreamerIds: allMatches.map(m => m.id),
          twitchId: platforms.twitch?.id,
          twitchUsername: platforms.twitch?.username,
          twitchFollowers: platforms.twitch?.followers,
          twitchAvatar: platforms.twitch?.avatar,
          twitchUrl: platforms.twitch?.url,
          youtubeId: platforms.youtube?.id,
          youtubeUsername: platforms.youtube?.username,
          youtubeFollowers: platforms.youtube?.followers,
          youtubeAvatar: platforms.youtube?.avatar,
          youtubeUrl: platforms.youtube?.url,
          kickId: platforms.kick?.id,
          kickUsername: platforms.kick?.username,
          kickFollowers: platforms.kick?.followers,
          kickAvatar: platforms.kick?.avatar,
          kickUrl: platforms.kick?.url,
          tiktokId: platforms.tiktok?.id,
          tiktokUsername: platforms.tiktok?.username,
          tiktokFollowers: platforms.tiktok?.followers,
          tiktokAvatar: platforms.tiktok?.avatar,
          tiktokUrl: platforms.tiktok?.url,
          instagramId: platforms.instagram?.id,
          instagramUsername: platforms.instagram?.username,
          instagramFollowers: platforms.instagram?.followers,
          instagramAvatar: platforms.instagram?.avatar,
          instagramUrl: platforms.instagram?.url,
          xId: platforms.x?.id,
          xUsername: platforms.x?.username,
          xFollowers: platforms.x?.followers,
          xAvatar: platforms.x?.avatar,
          xUrl: platforms.x?.url,
          totalReach: BigInt(totalReach),
          platformCount: Object.keys(platforms).length,
        }
      });
      linkedCount++;
      stats.influencersLinked++;
    } catch (e) {
      // Likely duplicate, skip
    }
  }

  log('success', `Unified ${linkedCount} influencer profiles`);
}

// ============ MAIN LOOP ============
async function runCycle() {
  stats.cycleCount++;
  log('info', `\n========== STARTING CYCLE ${stats.cycleCount} ==========\n`);

  try {
    // 1. Discover from streaming platforms
    await discoverTwitchChannels();
    await discoverKickChannels();
    await discoverYouTubeChannels();

    // 2. Enrich with social profiles
    await enrichWithSocials();

    // 3. Crawl Instagram similar profiles (snowball discovery)
    await crawlInstagramSimilarProfiles();

    // 4. Cleanup stale avatars and incorrect regions
    await cleanupStaleData();

    // 5. Unify influencer profiles
    await unifyInfluencers();

    // Print stats
    printStats();

  } catch (error) {
    log('error', `Cycle error: ${error.message}`);
    stats.errors++;
  }
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       CONTINUOUS POPULATION - Envisioner Discovery        ║');
  console.log('║                                                           ║');
  console.log('║  Discovering: Twitch, YouTube, Kick                       ║');
  console.log('║  Enriching: TikTok, Instagram, X                          ║');
  console.log('║  Min Followers: 1,000                                     ║');
  console.log('║                                                           ║');
  console.log('║  Press Ctrl+C to stop                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    printStats();
    await db.$disconnect();
    process.exit(0);
  });

  // Run continuous loop
  while (true) {
    await runCycle();
    log('info', `Waiting ${CONFIG.RATE_LIMITS.CYCLE_DELAY / 1000}s before next cycle...`);
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMITS.CYCLE_DELAY));
  }
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await db.$disconnect();
  process.exit(1);
});
