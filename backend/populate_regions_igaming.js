// Regional-focused script to populate streamers with iGaming intelligence by region
const axios = require('axios');

async function populateRegionalStreamers() {
  try {
    console.log('🌍 Starting REGIONAL iGaming intelligence analysis...');

    const regionalQueries = [
      // Major regions - comprehensive coverage
      "Find all streamers from Brazil for gambling campaigns",
      "Show me all streamers from Mexico for betting partnerships",
      "Get all streamers from Argentina for casino promotions",
      "Find all streamers from Colombia for gambling campaigns",
      "Show me all streamers from Chile for betting partnerships",
      "Get all streamers from Peru for casino promotions",
      "Find all streamers from Ecuador for gambling campaigns",
      "Show me all streamers from Venezuela for betting partnerships",
      "Get all streamers from Uruguay for casino promotions",
      "Find all streamers from Spain for gambling campaigns",
      "Show me all streamers from USA for betting partnerships",
      "Get all streamers from Canada for casino promotions",

      // Additional Latin American countries
      "Find all streamers from Guatemala for gambling campaigns",
      "Show me all streamers from Costa Rica for betting partnerships",
      "Get all streamers from Panama for casino promotions",
      "Find all streamers from Honduras for gambling campaigns",
      "Show me all streamers from Nicaragua for betting partnerships",
      "Get all streamers from El Salvador for casino promotions",
      "Find all streamers from Bolivia for gambling campaigns",
      "Show me all streamers from Paraguay for betting partnerships",

      // Language-based regional queries
      "Find all Spanish-speaking streamers for gambling campaigns",
      "Show me all Portuguese-speaking streamers for betting partnerships",
      "Get all English-speaking streamers for casino promotions",

      // Cross-regional queries
      "Find all LATAM streamers for comprehensive gambling campaigns",
      "Show me all North American streamers for betting partnerships",
      "Get all European streamers for casino promotions"
    ];

    console.log(`🌍 Will run ${regionalQueries.length} regional queries`);

    const baseURL = 'http://localhost:8080';
    let totalAnalyzed = 0;

    for (let i = 0; i < regionalQueries.length; i++) {
      const query = regionalQueries[i];
      console.log(`\n🌍 Regional Query ${i + 1}/${regionalQueries.length}: "${query}"`);

      try {
        const response = await axios.post(`${baseURL}/api/chat/search`, {
          query: query
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 90000
        });

        if (response.data.success) {
          const streamersWithScores = response.data.data.streamers.filter(s => s.igamingScore > 0);
          totalAnalyzed += streamersWithScores.length;

          console.log(`   ✅ Analyzed ${streamersWithScores.length} regional streamers`);
          console.log(`   📈 Regional total: ${totalAnalyzed} streamers analyzed`);

          if (streamersWithScores.length > 0) {
            const topPerformer = streamersWithScores
              .sort((a, b) => b.igamingScore - a.igamingScore)[0];
            console.log(`   🏆 Top regional performer: ${topPerformer.displayName} (${topPerformer.igamingScore}/100)`);
          }
        } else {
          console.log(`   ❌ Regional query failed: ${response.data.error}`);
        }

      } catch (error) {
        console.log(`   ❌ Error in regional query: ${error.message}`);
      }

      // Progress check every 5 queries
      if ((i + 1) % 5 === 0) {
        console.log(`\n🌍 Regional Progress: ${totalAnalyzed} streamers analyzed through ${i + 1} queries`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n🌍 Regional analysis complete! Total analyzed: ${totalAnalyzed} streamers`);

  } catch (error) {
    console.error('❌ Error in regional analysis:', error.message);
  }
}

populateRegionalStreamers();