// Efficient script to populate streamers with real iGaming scores using API calls
const axios = require('axios');

async function populateStreamersViaAPI() {
  try {
    console.log('🤖 Starting efficient iGaming intelligence population...');

    // Use multiple gambling-related queries to trigger the analysis
    const gamblingQueries = [
      "Find top gambling streamers for casino partnerships",
      "I need high-conversion betting streamers from Brazil",
      "Show me gambling streamers from Mexico and Argentina",
      "Find the best casino streamers from Chile and Colombia",
      "I want betting streamers with premium audience from LATAM",
      "Show gambling streamers from Ecuador and Peru",
      "Find high-risk gambling streamers for betting campaigns",
      "I need casino streamers with excellent brand safety",
      "Show me gambling streamers with aggressive risk tolerance",
      "Find premium gambling streamers for high-stakes campaigns"
    ];

    let totalAnalyzed = 0;

    for (let i = 0; i < gamblingQueries.length; i++) {
      const query = gamblingQueries[i];
      console.log(`\n📦 Query ${i + 1}/${gamblingQueries.length}: "${query}"`);

      try {
        const response = await axios.post('http://localhost:8080/api/chat/search', {
          query: query
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout for AI analysis
        });

        if (response.data.success) {
          const streamersWithScores = response.data.data.streamers.filter(s => s.igamingScore > 0);
          totalAnalyzed += streamersWithScores.length;

          console.log(`   ✅ Analyzed ${streamersWithScores.length} streamers`);
          console.log(`   📊 Running total: ${totalAnalyzed} streamers with real AI scores`);

          // Show sample of top performers from this batch
          const topPerformers = streamersWithScores
            .sort((a, b) => b.igamingScore - a.igamingScore)
            .slice(0, 3);

          if (topPerformers.length > 0) {
            console.log('   🏆 Top performers:');
            topPerformers.forEach((s, idx) => {
              console.log(`      ${idx + 1}. ${s.displayName}: ${s.igamingScore}/100 (${s.riskAssessment?.tier})`);
            });
          }

        } else {
          console.log(`   ❌ Query failed: ${response.data.error}`);
        }

      } catch (error) {
        console.log(`   ❌ Error processing query: ${error.message}`);
      }

      // Small delay between queries to prevent overwhelming the system
      if (i < gamblingQueries.length - 1) {
        console.log('   ⏱️  Waiting 3 seconds before next query...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n🎉 Efficient population complete!');
    console.log(`📈 Total streamers analyzed: ${totalAnalyzed}`);

    // Verify the final database state
    console.log('\n🔍 Verifying database population...');

    const verifyResponse = await axios.post('http://localhost:8080/api/chat/search', {
      query: "Show me all streamers with iGaming intelligence scores"
    });

    if (verifyResponse.data.success) {
      const allWithScores = verifyResponse.data.data.streamers.filter(s => s.igamingScore > 0);
      console.log(`📊 Database verification: ${allWithScores.length} streamers have real AI scores`);

      // Show distribution of tiers
      const tiers = {};
      allWithScores.forEach(s => {
        const tier = s.riskAssessment?.tier || 'Unknown';
        tiers[tier] = (tiers[tier] || 0) + 1;
      });

      console.log('🏆 Tier Distribution:');
      Object.entries(tiers).forEach(([tier, count]) => {
        console.log(`   ${tier}: ${count} streamers`);
      });
    }

  } catch (error) {
    console.error('❌ Error in efficient population:', error.message);
  }
}

populateStreamersViaAPI();