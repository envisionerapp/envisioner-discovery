// Comprehensive script to populate ALL streamers with real iGaming intelligence scores
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function populateAllStreamersComprehensive() {
  const db = new PrismaClient();

  try {
    console.log('🤖 Starting COMPREHENSIVE iGaming intelligence analysis...');

    // Get total count
    const totalStreamers = await db.streamer.count();
    console.log(`📊 Found ${totalStreamers} total streamers in database`);

    // Count existing scores
    const existingScores = await db.streamer.count({
      where: {
        igamingScore: { gt: 0 }
      }
    });
    console.log(`✅ ${existingScores} streamers already have iGaming scores`);
    console.log(`🎯 Need to analyze ${totalStreamers - existingScores} remaining streamers`);

    let totalAnalyzed = existingScores; // Start with existing count

    console.log('🔄 Using comprehensive API-based population approach...');

    // Create comprehensive queries to cover different streamer types
    const comprehensiveQueries = [
      // Gaming streamers
      "Find all gaming streamers for gambling partnerships",
      "Show me esports streamers for betting campaigns",
      "Get gaming content creators for casino promotions",
      "Find Minecraft streamers for gaming partnerships",
      "Show Fortnite streamers for betting campaigns",
      "Get Call of Duty streamers for gambling promotions",
      "Find League of Legends streamers for casino campaigns",
      "Show Valorant streamers for betting partnerships",

      // Regional coverage
      "Find gambling streamers from Brazil for casino campaigns",
      "Show betting streamers from Mexico for partnerships",
      "Get casino streamers from Argentina for promotions",
      "Find gambling streamers from Colombia for campaigns",
      "Show betting streamers from Chile for partnerships",
      "Get casino streamers from Peru for promotions",
      "Find gambling streamers from Ecuador for campaigns",
      "Show betting streamers from Spain for partnerships",

      // Entertainment categories
      "Find entertainment streamers for gambling campaigns",
      "Show variety streamers for betting partnerships",
      "Get comedy streamers for casino promotions",
      "Find music streamers for gambling campaigns",
      "Show sports streamers for betting partnerships",
      "Get lifestyle streamers for casino promotions",

      // Platform coverage
      "Find YouTube streamers for gambling campaigns",
      "Show Twitch streamers for betting partnerships",
      "Get TikTok creators for casino promotions",
      "Find Instagram streamers for gambling campaigns",

      // Size categories
      "Find large streamers for premium gambling campaigns",
      "Show medium streamers for standard betting partnerships",
      "Get emerging streamers for casino promotions",
      "Find micro influencers for gambling campaigns",

      // Language coverage
      "Find Spanish speaking streamers for gambling campaigns",
      "Show Portuguese streamers for betting partnerships",
      "Get English streamers for casino promotions",

      // Additional comprehensive coverage
      "Find all content creators suitable for iGaming partnerships",
      "Show streamers with high audience engagement for betting",
      "Get content creators with premium audiences for gambling",
      "Find streamers with excellent brand safety for casino campaigns",
      "Show content creators with high conversion potential",
      "Get streamers suitable for responsible gambling campaigns"
    ];

    console.log(`📦 Will run ${comprehensiveQueries.length} comprehensive queries to cover all streamers`);

    const baseURL = 'http://localhost:8080';

    for (let i = 0; i < comprehensiveQueries.length; i++) {
      const query = comprehensiveQueries[i];
      console.log(`\n📊 Query ${i + 1}/${comprehensiveQueries.length}: "${query}"`);

      try {
        const response = await axios.post(`${baseURL}/api/chat/search`, {
          query: query
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minute timeout
        });

        if (response.data.success) {
          const streamersWithScores = response.data.data.streamers.filter(s => s.igamingScore > 0);
          totalAnalyzed += streamersWithScores.length;

          console.log(`   ✅ Analyzed ${streamersWithScores.length} streamers`);
          console.log(`   📈 Running total: ${totalAnalyzed} streamers with real AI scores`);

          // Show progress percentage
          const progressPercentage = ((totalAnalyzed / totalStreamers) * 100).toFixed(2);
          console.log(`   📊 Database coverage: ${progressPercentage}%`);

          // Show top performers
          if (streamersWithScores.length > 0) {
            const topPerformers = streamersWithScores
              .sort((a, b) => b.igamingScore - a.igamingScore)
              .slice(0, 2);

            console.log('   🏆 Top performers:');
            topPerformers.forEach((s, idx) => {
              console.log(`      ${idx + 1}. ${s.displayName}: ${s.igamingScore}/100 (${s.riskAssessment?.tier || 'N/A'})`);
            });
          }

        } else {
          console.log(`   ❌ Query failed: ${response.data.error}`);
        }

      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          console.log(`   ⏱️  Query timed out - continuing with next query`);
        } else {
          console.log(`   ❌ Error processing query: ${error.message}`);
        }
      }

      // Progress check every 10 queries
      if ((i + 1) % 10 === 0) {
        const currentCoverage = ((totalAnalyzed / totalStreamers) * 100).toFixed(2);
        console.log(`\n🎯 Progress Check: ${totalAnalyzed}/${totalStreamers} streamers analyzed (${currentCoverage}%)`);

        if (totalAnalyzed >= totalStreamers * 0.9) {
          console.log(`\n🎉 Achieved 90%+ coverage! Stopping early.`);
          break;
        }
      }

      // Small delay between queries
      if (i < comprehensiveQueries.length - 1) {
        console.log('   ⏱️  Waiting 2 seconds before next query...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 Comprehensive iGaming analysis complete!');
    console.log(`📈 Final Results:`);
    console.log(`   - Total Streamers: ${totalStreamers}`);
    console.log(`   - Successfully Analyzed: ${totalAnalyzed}`);
    console.log(`   - Database Coverage: ${((totalAnalyzed/totalStreamers) * 100).toFixed(1)}%`);

    // Final verification
    console.log('\n🔍 Final database verification...');
    const finalVerification = await axios.post(`${baseURL}/api/chat/search`, {
      query: "Show me comprehensive statistics of all streamers with iGaming intelligence"
    });

    if (finalVerification.data.success) {
      const allWithScores = finalVerification.data.data.streamers.filter(s => s.igamingScore > 0);
      console.log(`📊 Final verification: ${allWithScores.length} streamers have real AI scores`);

      // Show score distribution
      const scoreRanges = {
        'Excellent (80-100)': allWithScores.filter(s => s.igamingScore >= 80).length,
        'Good (60-79)': allWithScores.filter(s => s.igamingScore >= 60 && s.igamingScore < 80).length,
        'Average (40-59)': allWithScores.filter(s => s.igamingScore >= 40 && s.igamingScore < 60).length,
        'Below Average (0-39)': allWithScores.filter(s => s.igamingScore < 40).length
      };

      console.log('\n🏆 Score Distribution:');
      Object.entries(scoreRanges).forEach(([range, count]) => {
        console.log(`   ${range}: ${count} streamers`);
      });
    }

  } catch (error) {
    console.error('❌ Error in comprehensive analysis:', error.message);
  } finally {
    await db.$disconnect();
  }
}

populateAllStreamersComprehensive();