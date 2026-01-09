// Category-focused script to populate streamers with iGaming intelligence by content type
const axios = require('axios');

async function populateCategoryStreamers() {
  try {
    console.log('🎮 Starting CATEGORY-based iGaming intelligence analysis...');

    const categoryQueries = [
      // Gaming categories
      "Find all Minecraft streamers for gambling partnerships",
      "Show me all Fortnite streamers for betting campaigns",
      "Get all Call of Duty streamers for casino promotions",
      "Find all League of Legends streamers for gambling partnerships",
      "Show me all Valorant streamers for betting campaigns",
      "Get all FIFA streamers for casino promotions",
      "Find all GTA streamers for gambling partnerships",
      "Show me all Among Us streamers for betting campaigns",
      "Get all Roblox streamers for casino promotions",
      "Find all Fall Guys streamers for gambling partnerships",
      "Show me all Apex Legends streamers for betting campaigns",
      "Get all Counter-Strike streamers for casino promotions",
      "Find all Dota 2 streamers for gambling partnerships",
      "Show me all Overwatch streamers for betting campaigns",
      "Get all Rocket League streamers for casino promotions",

      // Entertainment categories
      "Find all comedy streamers for gambling partnerships",
      "Show me all variety streamers for betting campaigns",
      "Get all entertainment streamers for casino promotions",
      "Find all music streamers for gambling partnerships",
      "Show me all lifestyle streamers for betting campaigns",
      "Get all sports streamers for casino promotions",
      "Find all talk show streamers for gambling partnerships",
      "Show me all reaction streamers for betting campaigns",
      "Get all podcast streamers for casino promotions",

      // Educational and other categories
      "Find all tech streamers for gambling partnerships",
      "Show me all cooking streamers for betting campaigns",
      "Get all travel streamers for casino promotions",
      "Find all fitness streamers for gambling partnerships",
      "Show me all art streamers for betting campaigns",
      "Get all ASMR streamers for casino promotions",

      // Mixed content queries
      "Find all variety gaming streamers for gambling partnerships",
      "Show me all multi-category streamers for betting campaigns",
      "Get all creative content streamers for casino promotions",
      "Find all IRL streamers for gambling partnerships",
      "Show me all Just Chatting streamers for betting campaigns"
    ];

    console.log(`🎮 Will run ${categoryQueries.length} category queries`);

    const baseURL = 'http://localhost:8080';
    let totalAnalyzed = 0;

    for (let i = 0; i < categoryQueries.length; i++) {
      const query = categoryQueries[i];
      console.log(`\n🎮 Category Query ${i + 1}/${categoryQueries.length}: "${query}"`);

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

          console.log(`   ✅ Analyzed ${streamersWithScores.length} category streamers`);
          console.log(`   📈 Category total: ${totalAnalyzed} streamers analyzed`);

          if (streamersWithScores.length > 0) {
            const topPerformer = streamersWithScores
              .sort((a, b) => b.igamingScore - a.igamingScore)[0];
            console.log(`   🏆 Top category performer: ${topPerformer.displayName} (${topPerformer.igamingScore}/100)`);
          }
        } else {
          console.log(`   ❌ Category query failed: ${response.data.error}`);
        }

      } catch (error) {
        console.log(`   ❌ Error in category query: ${error.message}`);
      }

      // Progress check every 5 queries
      if ((i + 1) % 5 === 0) {
        console.log(`\n🎮 Category Progress: ${totalAnalyzed} streamers analyzed through ${i + 1} queries`);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`\n🎮 Category analysis complete! Total analyzed: ${totalAnalyzed} streamers`);

  } catch (error) {
    console.error('❌ Error in category analysis:', error.message);
  }
}

populateCategoryStreamers();