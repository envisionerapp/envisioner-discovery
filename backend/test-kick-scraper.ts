import axios from 'axios';
import { chromium } from 'playwright';

/**
 * Test script to explore Kick API and scraping capabilities
 * This will test what data we can get from Kick for panels, tags, and descriptions
 */

async function testKickAPI(username: string) {
  console.log(`\n=== Testing Kick API for: ${username} ===\n`);

  try {
    // Test v2 API (newer version)
    console.log('1. Testing Kick API v2/channels endpoint...');
    const v2Response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    console.log('✅ V2 API Response received');
    console.log('Available fields:', Object.keys(v2Response.data));

    const channelData = v2Response.data;

    // Extract relevant data
    console.log('\n--- Channel Info ---');
    console.log('Username:', channelData.user?.username);
    console.log('Bio:', channelData.user?.bio);
    console.log('Category:', channelData.category?.name);
    console.log('Tags:', channelData.tags || 'None');
    console.log('Verified:', channelData.verified);
    console.log('Followers:', channelData.followers_count);
    console.log('Banner URL:', channelData.banner_image?.url);
    console.log('Recent Categories:', channelData.recent_categories);

    // Check for panel/description data
    if (channelData.user?.bio) {
      console.log('\n--- Bio/Description ---');
      console.log(channelData.user.bio);
    }

    // Save full response for inspection
    console.log('\n--- Full Response Structure ---');
    console.log(JSON.stringify(channelData, null, 2).substring(0, 2000) + '...');

  } catch (error: any) {
    console.error('❌ API Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function testKickPageScraping(username: string) {
  console.log(`\n=== Testing Kick Page Scraping for: ${username} ===\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  try {
    const page = await context.newPage();

    console.log('Loading page...');
    await page.goto(`https://kick.com/${username}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    // Extract all data we can find
    const pageData = await page.evaluate(() => {
      const data: any = {
        bio: null,
        description: null,
        panelTexts: [],
        aboutText: null,
        socialLinks: [],
        tags: [],
        allText: []
      };

      // Try to find bio/description
      const bioSelectors = [
        '[data-test="channel-bio"]',
        '.channel-bio',
        '[class*="bio"]',
        '[class*="description"]',
        '[class*="about"]'
      ];

      bioSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 10) {
            data.allText.push({ selector, text });
          }
        });
      });

      // Try to find panel-like elements
      const panelSelectors = [
        '[class*="panel"]',
        '[class*="Panel"]',
        '[class*="info"]',
        '[class*="section"]'
      ];

      panelSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 20) {
            data.panelTexts.push({ selector, text: text.substring(0, 200) });
          }
        });
      });

      // Find social links
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (
          href.includes('twitter.com') ||
          href.includes('instagram.com') ||
          href.includes('tiktok.com') ||
          href.includes('discord')
        )) {
          data.socialLinks.push(href);
        }
      });

      // Get meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        data.description = metaDesc.getAttribute('content');
      }

      return data;
    });

    console.log('\n--- Page Scraping Results ---');
    console.log('Meta Description:', pageData.description);
    console.log('Found social links:', pageData.socialLinks);
    console.log('\nAll text found:');
    pageData.allText.forEach((item: any, i: number) => {
      console.log(`${i + 1}. [${item.selector}]`, item.text.substring(0, 150));
    });
    console.log('\nPanel texts found:', pageData.panelTexts.length);
    pageData.panelTexts.slice(0, 3).forEach((item: any, i: number) => {
      console.log(`${i + 1}. [${item.selector}]`, item.text);
    });

  } catch (error: any) {
    console.error('❌ Page Scraping Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Main execution
async function main() {
  // Test with known Kick streamers
  const testUsernames = [
    'trainwreckstv',  // Popular English streamer
    'roshtein',       // Casino streamer
    'xqc'            // Very popular streamer
  ];

  for (const username of testUsernames) {
    await testKickAPI(username);
    await testKickPageScraping(username);

    console.log('\n' + '='.repeat(80) + '\n');

    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Testing complete!');
  console.log('\nNext steps:');
  console.log('1. Review the output to see what data is available');
  console.log('2. Update kickScraper.ts to include panels/descriptions');
  console.log('3. Update database schema if needed for new fields');
}

main().catch(console.error);
