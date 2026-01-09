const fs = require('fs');
const { parse } = require('csv-parse');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

// LATAM countries to filter for
const LATAM_COUNTRIES = [
  'mexico', 'colombia', 'argentina', 'chile', 'peru', 'venezuela',
  'ecuador', 'bolivia', 'paraguay', 'uruguay', 'costa rica', 'panama',
  'guatemala', 'el salvador', 'honduras', 'nicaragua', 'dominican republic',
  'puerto rico', 'brazil'
];

const REGION_MAP = {
  'mexico': 'MEXICO',
  'colombia': 'COLOMBIA',
  'argentina': 'ARGENTINA',
  'chile': 'CHILE',
  'peru': 'PERU',
  'venezuela': 'VENEZUELA',
  'ecuador': 'ECUADOR',
  'bolivia': 'BOLIVIA',
  'paraguay': 'PARAGUAY',
  'uruguay': 'URUGUAY',
  'costa rica': 'COSTA_RICA',
  'panama': 'PANAMA',
  'guatemala': 'GUATEMALA',
  'el salvador': 'EL_SALVADOR',
  'honduras': 'HONDURAS',
  'nicaragua': 'NICARAGUA',
  'dominican republic': 'DOMINICAN_REPUBLIC',
  'puerto rico': 'PUERTO_RICO',
  'brazil': 'BRAZIL'
};

function parseNumber(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).toLowerCase().replace(/[,\s]/g, '');
  if (str.includes('m')) {
    return Math.floor(parseFloat(str) * 1000000);
  } else if (str.includes('k')) {
    return Math.floor(parseFloat(str) * 1000);
  }
  return parseInt(str) || 0;
}

function isLatamStreamer(record) {
  // Check country field from CSV
  const country = record.Country || record.country;
  if (country && LATAM_COUNTRIES.includes(country.toLowerCase().trim())) {
    return true;
  }

  // Check language - Spanish or Portuguese usually indicates LATAM
  const language = record.Language || record.language;
  if (language && ['spanish', 'es', 'portuguese', 'pt'].includes(language.toLowerCase())) {
    return true;
  }

  return false;
}

function getRegion(record) {
  const country = record.Country || record.country;

  if (country) {
    const countryName = country.toLowerCase().trim();
    if (REGION_MAP[countryName]) {
      return REGION_MAP[countryName];
    }
  }

  // Default to Mexico if Spanish language
  const language = record.Language || record.language;
  if (language && ['es', 'spanish'].includes(language.toLowerCase())) {
    return 'MEXICO';
  }

  return 'MEXICO'; // Default
}

async function importCSVFile(filePath, platform = 'TWITCH') {
  console.log(`📊 Importing ${platform} data from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return 0;
  }

  const csvData = fs.readFileSync(filePath, 'utf8');
  const records = await new Promise((resolve, reject) => {
    parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  console.log(`📝 Found ${records.length} total records`);

  // Filter for LATAM only
  const latamRecords = records.filter(isLatamStreamer);
  console.log(`🎯 Filtered to ${latamRecords.length} LATAM streamers`);

  let imported = 0;

  for (const record of latamRecords) {
    try {
      // Extract data from CSV columns (matching your combined.csv structure)
      const username = record['Channel name'] || record.username || record.handle;

      if (!username) {
        console.log('⚠️ Skipping record - no username found');
        continue;
      }

      const displayName = record['Channel name'] || username;
      const followers = parseNumber(record.Followers || record.followers);
      const country = record.Country || record.country;

      // For now, we'll set all as not live since the CSV doesn't have live status
      const isLive = false;
      const currentViewers = null;

      // Get average viewers from CSV
      const avgViewers = parseNumber(record['Average Viewers'] || record.avg_viewers || 0);

      const language = record.Language || record.language || 'es';
      const region = getRegion(record);

      // Get profile URL from CSV or construct it
      const profileUrl = record['Channel url'] || `https://kick.com/${username}`;

      // Import to database
      const saved = await db.streamer.upsert({
        where: {
          platform_username: {
            platform: platform,
            username: username.toLowerCase()
          }
        },
        update: {
          displayName: displayName,
          followers: followers,
          currentViewers: currentViewers,
          isLive: isLive,
          language: language,
          region: region,
          updatedAt: new Date()
        },
        create: {
          platform: platform,
          username: username.toLowerCase(),
          displayName: displayName,
          profileUrl: profileUrl,
          followers: followers,
          currentViewers: currentViewers,
          isLive: isLive,
          language: language,
          region: region,
          tags: ['GAMING'],
          usesCamera: true,
          isVtuber: false,
          fraudCheck: 'CLEAN'
        }
      });

      imported++;
      if (imported <= 5) {
        console.log(`✅ ${saved.displayName} - ${saved.followers.toLocaleString()} followers`);
      }

    } catch (error) {
      console.log(`❌ Error importing ${record.username || 'unknown'}:`, error.message);
    }
  }

  console.log(`📊 Imported ${imported} ${platform} streamers\n`);
  return imported;
}

async function main() {
  console.log('🎬 LATAM STREAMER CSV IMPORT');
  console.log('============================\n');

  // CSV FILES TO IMPORT
  const csvFiles = [
    { path: './csv/combined.csv', platform: 'KICK' }
  ];

  console.log('📂 Importing from combined CSV file with real LATAM streamers\n');

  let totalImported = 0;

  for (const file of csvFiles) {
    const count = await importCSVFile(file.path, file.platform);
    totalImported += count;
  }

  console.log(`🎉 IMPORT COMPLETE`);
  console.log(`✅ Total LATAM streamers imported: ${totalImported}\n`);

  // Show database stats
  const stats = await db.streamer.groupBy({
    by: ['region'],
    _count: { region: true }
  });

  console.log('📊 Database summary by region:');
  stats.forEach(stat => {
    console.log(`   ${stat.region}: ${stat._count.region} streamers`);
  });

  await db.$disconnect();
}

main().catch(console.error);