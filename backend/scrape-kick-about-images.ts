import puppeteer from 'puppeteer';
import { db } from './src/utils/database';

/**
 * Improved Kick panel scraper that clicks the About tab first
 */

async function scrapeKickAboutImages(username: string) {
  let browser;

  try {
    console.log(`\n🔍 Scraping ${username}...`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = `https://kick.com/${username}`;
    console.log(`  📄 Loading ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to find and click the About tab
    try {
      console.log(`  🖱️  Looking for About tab...`);

      // Common selectors for the About tab on Kick
      const aboutSelectors = [
        'button:has-text("About")',
        'a:has-text("About")',
        '[role="tab"]:has-text("About")',
        'button[class*="about"]',
        'a[href*="about"]',
      ];

      let clicked = false;
      for (const selector of aboutSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            console.log(`  ✅ Clicked About tab`);
            clicked = true;
            break;
          }
        } catch {}
      }

      if (!clicked) {
        // Try using evaluate to find and click
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const aboutButton = buttons.find(btn =>
            btn.textContent?.toLowerCase().includes('about')
          );
          if (aboutButton) {
            (aboutButton as HTMLElement).click();
          }
        });
      }

      // Wait for content to load after clicking
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.log(`  ⚠️  Could not find About tab, scraping visible content`);
    }

    // Extract all images from the page
    const panelImages = await page.evaluate(() => {
      const images: Array<{ url: string; alt?: string }> = [];
      const foundUrls = new Set<string>();

      // Get all images
      const allImages = document.querySelectorAll('img');

      allImages.forEach((img) => {
        const src = img.src || img.getAttribute('data-src') || '';

        // Filter criteria - only get panel/content images, not UI elements
        if (src &&
            src.startsWith('http') &&
            !foundUrls.has(src) &&
            !src.includes('/profile_pic') &&
            !src.includes('/avatar') &&
            !src.includes('/logo') &&
            !src.includes('/banner') &&
            !src.includes('/thumbnail') &&
            !src.includes('/offline') &&
            !src.includes('/subcategories') &&
            !src.includes('/emote') &&
            !src.includes('/badge') &&
            !src.includes('unavatar.io')) {

          // Check if this looks like a panel image (usually wider and in content area)
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          // Panel images are usually at least 200px wide
          if (width >= 200 || width === 0) { // width 0 means not loaded yet, include it
            foundUrls.add(src);
            images.push({
              url: src,
              alt: img.alt || undefined
            });
          }
        }
      });

      return images;
    });

    console.log(`  📸 Found ${panelImages.length} images`);

    if (panelImages.length > 0) {
      console.log(`  First image: ${panelImages[0].url}`);
    }

    await browser.close();

    return panelImages;

  } catch (error: any) {
    if (browser) await browser.close();
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting Kick About Images Scraper\n');

  // Get a few Kick streamers to test
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'KICK',
    },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
    take: 10
  });

  console.log(`Found ${streamers.length} Kick streamers to scrape\n`);

  let updated = 0;
  let failed = 0;

  for (const streamer of streamers) {
    try {
      const images = await scrapeKickAboutImages(streamer.username);

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
        console.log(`  ⚠️  No images found for ${streamer.displayName}\n`);
        failed++;
      }

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error: any) {
      console.error(`  ❌ Failed to process ${streamer.username}: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ❌ Failed/No images: ${failed}`);
  console.log(`  📈 Success rate: ${((updated / streamers.length) * 100).toFixed(1)}%`);

  await db.$disconnect();
}

main().catch(console.error);
