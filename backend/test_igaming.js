// Test script to manually populate iGaming intelligence data
const { PrismaClient } = require('@prisma/client');

async function populateTestData() {
  const db = new PrismaClient();

  try {
    console.log('🔍 Finding gaming streamers to test with...');

    // Find some gaming streamers from Mexico
    const streamers = await db.streamer.findMany({
      where: {
        region: 'MEXICO',
        tags: {
          hasSome: ['GAMING']
        },
        fraudCheck: { not: 'FLAGGED' }
      },
      take: 5,
      orderBy: { followers: 'desc' }
    });

    console.log(`Found ${streamers.length} streamers for testing`);

    // Create varied test data for each streamer
    const testData = [
      {
        igamingScore: 85,
        brandSafetyScore: 90,
        gamblingCompatibility: true,
        conversionPotential: { level: 'high', confidence: 0.92 },
        audiencePsychology: {
          riskTolerance: 'aggressive',
          gamblingPropensity: 88,
          financialCapacity: 'premium'
        }
      },
      {
        igamingScore: 72,
        brandSafetyScore: 78,
        gamblingCompatibility: true,
        conversionPotential: { level: 'medium', confidence: 0.74 },
        audiencePsychology: {
          riskTolerance: 'moderate',
          gamblingPropensity: 65,
          financialCapacity: 'standard'
        }
      },
      {
        igamingScore: 45,
        brandSafetyScore: 55,
        gamblingCompatibility: false,
        conversionPotential: { level: 'low', confidence: 0.41 },
        audiencePsychology: {
          riskTolerance: 'conservative',
          gamblingPropensity: 30,
          financialCapacity: 'budget'
        }
      },
      {
        igamingScore: 91,
        brandSafetyScore: 85,
        gamblingCompatibility: true,
        conversionPotential: { level: 'high', confidence: 0.89 },
        audiencePsychology: {
          riskTolerance: 'high-roller',
          gamblingPropensity: 95,
          financialCapacity: 'whale'
        }
      },
      {
        igamingScore: 63,
        brandSafetyScore: 70,
        gamblingCompatibility: true,
        conversionPotential: { level: 'medium', confidence: 0.68 },
        audiencePsychology: {
          riskTolerance: 'moderate',
          gamblingPropensity: 58,
          financialCapacity: 'standard'
        }
      }
    ];

    // Update each streamer with test data
    for (let i = 0; i < Math.min(streamers.length, testData.length); i++) {
      const streamer = streamers[i];
      const data = testData[i];

      console.log(`\n📊 Updating ${streamer.displayName} with iGaming intelligence...`);

      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          igamingScore: data.igamingScore,
          brandSafetyScore: data.brandSafetyScore,
          gamblingCompatibility: data.gamblingCompatibility,
          conversionPotential: data.conversionPotential,
          audiencePsychology: data.audiencePsychology,
          lastIntelligenceUpdate: new Date(),
          igamingIntelligence: {
            analysisDate: new Date().toISOString(),
            campaignSuitability: data.igamingScore >= 70 ? 'excellent' : data.igamingScore >= 50 ? 'good' : 'poor',
            riskFactors: data.brandSafetyScore < 60 ? ['content_risk', 'audience_risk'] : [],
            recommendations: [
              `iGaming score: ${data.igamingScore}/100`,
              `Brand safety: ${data.brandSafetyScore}/100`,
              `Conversion potential: ${data.conversionPotential.level}`
            ]
          }
        }
      });

      console.log(`✅ Updated ${streamer.displayName}: Score=${data.igamingScore}, Safety=${data.brandSafetyScore}, Conversion=${data.conversionPotential.level}`);
    }

    console.log('\n🎉 Successfully populated test data!');
    console.log('\n📋 Test Summary:');

    // Show the updated data
    const updatedStreamers = await db.streamer.findMany({
      where: {
        id: { in: streamers.map(s => s.id) }
      },
      select: {
        displayName: true,
        igamingScore: true,
        brandSafetyScore: true,
        conversionPotential: true,
        gamblingCompatibility: true
      }
    });

    updatedStreamers.forEach(s => {
      console.log(`- ${s.displayName}: iGaming=${s.igamingScore}, Safety=${s.brandSafetyScore}, Conversion=${s.conversionPotential?.level || 'unknown'}`);
    });

    console.log('\n🚀 Now test the frontend by searching for "gambling streamers from Mexico"');

  } catch (error) {
    console.error('❌ Error populating test data:', error);
  } finally {
    await db.$disconnect();
  }
}

populateTestData();