import { tagScrapingService } from './src/services/tagScrapingService';
import { db } from './src/utils/database';

async function scrapeAllTagsContinuously() {
  let isRunning = true;
  let totalUpdated = 0;
  let totalErrors = 0;
  let runCount = 0;

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    isRunning = false;
    console.log('\n\n🛑 Stopping tag scraper...');
    process.exit(0);
  });

  while (isRunning) {
    runCount++;
    console.clear();
    console.log('═══════════════════════════════════════════════════════');
    console.log('🏷️  TAG SCRAPING - CONTINUOUS MODE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🔄 Run #${runCount}`);
    console.log(`⏱️  Started: ${new Date().toLocaleTimeString()}\n`);

    const totalStreamers = await db.streamer.count();

    if (totalStreamers === 0) {
      console.log('⚠️  NO STREAMERS IN DATABASE!');
      console.log('📝 Please run: npx ts-node latam-scraper-test.ts');
      console.log('   This will scrape and save streamers to the database first.\n');
      console.log('Press Ctrl+C to exit');
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    // Start progress display
    const progressInterval = setInterval(async () => {
      const withTags = await db.streamer.count({
        where: {
          tags: {
            isEmpty: false
          }
        }
      });

      const withoutTags = totalStreamers - withTags;
      const percentage = totalStreamers > 0 ? ((withTags / totalStreamers) * 100).toFixed(2) : '0';

      // Clear console and redraw
      console.clear();
      console.log('═══════════════════════════════════════════════════════');
      console.log('🏷️  TAG SCRAPING - CONTINUOUS MODE');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🔄 Run #${runCount} | Total Updated: ${totalUpdated} | Total Errors: ${totalErrors}`);
      console.log(`📊 Total Streamers:        ${totalStreamers.toLocaleString()}`);
      console.log(`✅ With Tags:              ${withTags.toLocaleString()} (${percentage}%)`);
      console.log(`⏳ Without Tags:           ${withoutTags.toLocaleString()}`);
      console.log('═══════════════════════════════════════════════════════');

      // Progress bar
      const barLength = 50;
      const filled = totalStreamers > 0 ? Math.floor((withTags / totalStreamers) * barLength) : 0;
      const empty = barLength - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      console.log(`\n[${bar}] ${percentage}%\n`);

      console.log('⚡ Status: Scraping tags from APIs...');
      console.log(`⏱️  Last updated: ${new Date().toLocaleTimeString()}\n`);
      console.log('Press Ctrl+C to stop');
    }, 2000); // Update every 2 seconds

    try {
      const result = await tagScrapingService.scrapeAllStreamerTags();
      clearInterval(progressInterval);

      totalUpdated += result.updated;
      totalErrors += result.errors;

      // Show completion for this run
      console.clear();
      console.log('═══════════════════════════════════════════════════════');
      console.log(`✅ RUN #${runCount} COMPLETED!`);
      console.log('═══════════════════════════════════════════════════════');
      console.log(`This run - Updated: ${result.updated}, Errors: ${result.errors}`);
      console.log(`Overall - Total Updated: ${totalUpdated}, Total Errors: ${totalErrors}`);
      console.log('═══════════════════════════════════════════════════════\n');

      const finalWithTags = await db.streamer.count({
        where: {
          tags: {
            isEmpty: false
          }
        }
      });

      const finalPercentage = totalStreamers > 0 ? ((finalWithTags / totalStreamers) * 100).toFixed(2) : '0';
      console.log(`📊 Total with tags: ${finalWithTags.toLocaleString()} / ${totalStreamers.toLocaleString()} (${finalPercentage}%)\n`);

      // Wait 10 seconds before next run
      console.log('⏳ Waiting 10 seconds before next run...');
      console.log('Press Ctrl+C to stop\n');
      await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
      clearInterval(progressInterval);
      console.error('❌ Error:', error);
      totalErrors++;

      // Wait before retrying
      console.log('\n⏳ Waiting 30 seconds before retry...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

scrapeAllTagsContinuously().catch(console.error);
