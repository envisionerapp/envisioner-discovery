// Comprehensive script to populate all streamers with real iGaming intelligence scores
const { PrismaClient } = require('@prisma/client');

async function populateAllIGamingScores() {
  const db = new PrismaClient();

  try {
    console.log('🤖 Starting comprehensive iGaming intelligence analysis...');

    // Get all streamers that need analysis (batch processing)
    const totalStreamers = await db.streamer.count();
    console.log(`📊 Found ${totalStreamers} total streamers in database`);

    const batchSize = 50; // Process in batches to avoid overwhelming the system
    let processed = 0;
    let analyzed = 0;

    // Import the iGaming intelligence service
    const { igamingIntelligenceService } = require('./src/services/igamingIntelligenceService');

    for (let offset = 0; offset < totalStreamers; offset += batchSize) {
      console.log(`\n📦 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalStreamers/batchSize)}`);

      const streamers = await db.streamer.findMany({
        take: batchSize,
        skip: offset,
        orderBy: { followers: 'desc' } // Start with most popular streamers
      });

      console.log(`🔍 Analyzing ${streamers.length} streamers...`);

      try {
        // Run real AI analysis on this batch
        const igamingAnalysis = await igamingIntelligenceService.analyzeStreamersForCampaign(
          streamers,
          'betting'
        );

        console.log(`✅ Generated ${igamingAnalysis.length} intelligence reports`);

        // Update each streamer with their real AI scores
        for (const analysis of igamingAnalysis) {
          try {
            await db.streamer.update({
              where: { id: analysis.streamer.id },
              data: {
                igamingScore: Math.round(analysis.overallScore * 100) / 100,
                brandSafetyScore: analysis.intelligence.advancedRiskProfile.brandSafetyScore,
                audiencePsychology: analysis.intelligence.audiencePsychology,
                conversionPotential: {
                  ctr: analysis.campaignPredictions.predictedCTR,
                  conversionRate: analysis.campaignPredictions.predictedConversions,
                  roi: analysis.campaignPredictions.predictedROI
                },
                gamblingCompatibility: analysis.overallScore >= 60,
                lastIntelligenceUpdate: new Date(),
                riskAssessment: {
                  score: analysis.overallScore,
                  tier: analysis.tier,
                  confidence: analysis.confidenceLevel,
                  riskLevel: analysis.campaignPredictions.riskLevel
                },
                igamingIntelligence: analysis.intelligence
              }
            });

            analyzed++;

            if (analyzed % 10 === 0) {
              console.log(`   💾 Saved ${analyzed} streamer intelligence profiles...`);
            }

          } catch (updateError) {
            console.error(`❌ Failed to update ${analysis.streamer.displayName}:`, updateError.message);
          }
        }

      } catch (analysisError) {
        console.error(`❌ Analysis failed for batch starting at ${offset}:`, analysisError.message);
      }

      processed += streamers.length;
      console.log(`📈 Progress: ${processed}/${totalStreamers} streamers processed (${analyzed} analyzed)`);

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 Comprehensive iGaming analysis complete!');
    console.log(`📊 Final Results:`);
    console.log(`   - Total Streamers: ${totalStreamers}`);
    console.log(`   - Successfully Analyzed: ${analyzed}`);
    console.log(`   - Analysis Coverage: ${((analyzed/totalStreamers) * 100).toFixed(1)}%`);

    // Show sample results
    const sampleResults = await db.streamer.findMany({
      where: {
        igamingScore: { gt: 0 }
      },
      select: {
        displayName: true,
        igamingScore: true,
        brandSafetyScore: true,
        riskAssessment: true,
        conversionPotential: true
      },
      orderBy: { igamingScore: 'desc' },
      take: 5
    });

    console.log('\n🏆 Top 5 iGaming Scores:');
    sampleResults.forEach((streamer, index) => {
      console.log(`${index + 1}. ${streamer.displayName}`);
      console.log(`   iGaming: ${streamer.igamingScore}/100`);
      console.log(`   Safety: ${streamer.brandSafetyScore}/100`);
      console.log(`   Tier: ${streamer.riskAssessment?.tier || 'Unknown'}`);
      console.log(`   CTR: ${streamer.conversionPotential?.ctr || 0}%`);
    });

  } catch (error) {
    console.error('❌ Error in comprehensive analysis:', error);
  } finally {
    await db.$disconnect();
  }
}

populateAllIGamingScores();