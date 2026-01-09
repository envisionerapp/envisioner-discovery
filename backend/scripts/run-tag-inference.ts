import { tagInferenceService } from '../src/services/tagInferenceService';
import { logger } from '../src/utils/database';

/**
 * Script to run intelligent tag inference on all streamers
 *
 * This will:
 * 1. Analyze all streamers' games
 * 2. Detect iGaming content (casino, slots, poker, etc.)
 * 3. Automatically add relevant tags
 * 4. Update database with new tags
 *
 * This solves the critical issue of only having 320/10,973 streamers with casino tags.
 */

async function main() {
  console.log('🚀 Starting Intelligent Tag Inference\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Analyze database first (dry run)
    console.log('\n📊 STEP 1: Analyzing database...\n');
    const analysis = await tagInferenceService.analyzeDatabase();

    console.log('Current State:');
    console.log(`  Total Streamers: ${analysis.totalStreamers}`);
    console.log(`  Streamers with iGaming tags: ${analysis.streamersWithIGamingTags}`);
    console.log(`  Streamers playing iGaming games: ${analysis.streamersWithIGamingGames}`);
    console.log(`  Potential new tags to add: ${analysis.potentialNewTags}\n`);

    console.log('Sample Suggestions:');
    analysis.sampleResults.slice(0, 5).forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.username}:`);
      console.log(`     Tags to add: ${result.inferredTags.join(', ')}`);
      console.log(`     Confidence: ${result.confidence} | Source: ${result.source}`);
    });

    // Step 2: Confirm with user
    console.log('\n' + '='.repeat(80));
    console.log('📝 STEP 2: Running tag inference...\n');

    const startTime = Date.now();
    let lastProgress = 0;

    const result = await tagInferenceService.inferAndUpdateAllStreamers({
      dryRun: false,
      batchSize: 100,
      onProgress: (processed, total, updated) => {
        const progress = Math.floor((processed / total) * 100);
        if (progress !== lastProgress && progress % 10 === 0) {
          console.log(`  Progress: ${progress}% (${processed}/${total}) - ${updated} streamers updated`);
          lastProgress = progress;
        }
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Step 3: Show results
    console.log('\n' + '='.repeat(80));
    console.log('✅ TAG INFERENCE COMPLETE!\n');

    console.log('Results:');
    console.log(`  ✅ Processed: ${result.processed} streamers`);
    console.log(`  ✅ Updated: ${result.updated} streamers with new tags`);
    console.log(`  ⏭️  Skipped: ${result.skipped} streamers (no iGaming content detected)`);
    console.log(`  ⏱️  Duration: ${duration} seconds\n`);

    const totalNewTags = result.results.reduce((sum, r) => sum + r.inferredTags.length, 0);
    console.log(`  🏷️  Total new tags added: ${totalNewTags}`);

    // Show breakdown by confidence
    const highConfidence = result.results.filter(r => r.confidence === 'high').length;
    const mediumConfidence = result.results.filter(r => r.confidence === 'medium').length;
    const lowConfidence = result.results.filter(r => r.confidence === 'low').length;

    console.log('\nConfidence Breakdown:');
    console.log(`  High:   ${highConfidence} streamers`);
    console.log(`  Medium: ${mediumConfidence} streamers`);
    console.log(`  Low:    ${lowConfidence} streamers`);

    // Show tag distribution
    console.log('\nTag Distribution:');
    const tagCounts: Record<string, number> = {};
    result.results.forEach(r => {
      r.inferredTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`  ${tag}: +${count} streamers`);
      });

    // Show sample of updated streamers
    console.log('\n' + '='.repeat(80));
    console.log('📋 Sample of Updated Streamers:\n');

    result.results
      .filter(r => r.confidence === 'high')
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(`${i + 1}. ${r.username}`);
        console.log(`   Added: ${r.inferredTags.join(', ')}`);
        console.log(`   Confidence: ${r.confidence}`);
      });

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Tag inference complete! Your database now has much better iGaming coverage.\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error running tag inference:', error);
    logger.error('Tag inference failed', { error });
    process.exit(1);
  }
}

// Run the script
main();
