/**
 * Test the social extraction jobs
 */

import { extractTwitchSocialLinks, extractKickSocialLinks, extractYouTubeSocialLinks } from '../src/jobs/socialExtractionJob';
import { db } from '../src/utils/database';

async function main() {
  console.log('Testing Social Extraction Jobs\n');

  // Test with small batch
  const testBatch = 5;

  console.log('1. Testing Twitch extraction...');
  try {
    const twitchResult = await extractTwitchSocialLinks(testBatch);
    console.log('   Result:', twitchResult);
  } catch (e: any) {
    console.log('   Error:', e.message);
  }

  console.log('\n2. Testing Kick extraction...');
  try {
    const kickResult = await extractKickSocialLinks(testBatch);
    console.log('   Result:', kickResult);
  } catch (e: any) {
    console.log('   Error:', e.message);
  }

  console.log('\n3. Testing YouTube extraction...');
  try {
    const ytResult = await extractYouTubeSocialLinks(testBatch);
    console.log('   Result:', ytResult);
  } catch (e: any) {
    console.log('   Error:', e.message);
  }

  await db.$disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
