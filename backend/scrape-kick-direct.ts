import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from './src/utils/database';

/**
 * Direct HTML scraping approach for Kick profiles
 * Gets the initial HTML and extracts panel images
 */

async function scrapeKickDirect(username: string) {
  try {
    console.log(`\n🔍 Scraping ${username}...`);

    const url = `https://kick.com/${username}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://kick.com/'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Look for Next.js data or initial state
    const scripts = $('script').toArray();
    let panelImages: Array<{ url: string; alt?: string }> = [];

    // Method 1: Look for Next.js data
    for (const script of scripts) {
      const content = $(script).html() || '';

      // Look for __NEXT_DATA__ or similar
      if (content.includes('__NEXT_DATA__') || content.includes('props') || content.includes('pageProps')) {
        try {
          // Extract JSON data
          const jsonMatch = content.match(/{.*}/s);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);

            // Look for image URLs in the data
            const dataStr = JSON.stringify(data);
            const imageMatches = dataStr.match(/https:\/\/[^"']*\.(jpg|jpeg|png|gif|webp)[^"']*/gi);

            if (imageMatches) {
              const uniqueImages = new Set(imageMatches);
              uniqueImages.forEach(url => {
                if (!url.includes('/avatar') &&
                    !url.includes('/profile_pic') &&
                    !url.includes('/banner') &&
                    !url.includes('/logo') &&
                    !url.includes('/thumbnail')) {
                  panelImages.push({ url });
                }
              });
            }
          }
        } catch {}
      }
    }

    // Method 2: Look for meta tags with images
    $('meta[property="og:image"], meta[name="twitter:image"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content && content.startsWith('http')) {
        panelImages.push({ url: content, alt: 'Meta image' });
      }
    });

    // Method 3: Look for images in HTML
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const alt = $(el).attr('alt') || '';

      if (src.startsWith('http') &&
          src.match(/\.(jpg|jpeg|png|gif|webp)/i) &&
          !src.includes('/avatar') &&
          !src.includes('/profile_pic') &&
          !src.includes('/banner') &&
          !src.includes('/logo') &&
          !src.includes('/thumbnail')) {
        panelImages.push({ url: src, alt });
      }
    });

    // Remove duplicates
    const uniqueImages = Array.from(
      new Map(panelImages.map(img => [img.url, img])).values()
    );

    console.log(`  📸 Found ${uniqueImages.length} potential images`);

    if (uniqueImages.length > 0) {
      console.log(`  First: ${uniqueImages[0].url}`);
    }

    return uniqueImages;

  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting Direct Kick Image Scraper\n');

  // Test with a few specific users who likely have panels
  const testUsernames = [
    'kingteka',
    'spreen',
    'daarick',
    'westcol',
    'roshtein', // Known to have panels
    'trainwreckstv', // Known to have panels
    'xqc', // If they stream on Kick
  ];

  // Get actual streamers from DB
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      username: { in: testUsernames }
    },
    select: {
      id: true,
      username: true,
      displayName: true,
    }
  });

  console.log(`Found ${streamers.length} Kick streamers to scrape\n`);

  let updated = 0;

  for (const streamer of streamers) {
    try {
      const images = await scrapeKickDirect(streamer.username);

      if (images.length > 0) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            panelImages: images,
            lastEnrichmentUpdate: new Date()
          }
        });

        console.log(`  ✅ Updated ${streamer.displayName} with ${images.length} images\n`);
        updated++;
      } else {
        console.log(`  ⚠️  No images found\n`);
      }

      // Delay
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\n`);
    }
  }

  console.log(`\n📊 Summary: Updated ${updated}/${streamers.length} streamers`);

  await db.$disconnect();
}

main().catch(console.error);
