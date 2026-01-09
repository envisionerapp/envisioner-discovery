const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function exportAllStreamers() {
  try {
    const allStreamers = await prisma.streamer.findMany();

    console.log(`Exporting ${allStreamers.length} streamers from local database`);

    // Write to file
    fs.writeFileSync('/tmp/all_local_streamers.json', JSON.stringify(allStreamers, null, 2));
    console.log('Exported to /tmp/all_local_streamers.json');

    // Also create SQL statements for direct database sync
    const sqlStatements = allStreamers.map(s => {
      const values = [
        `'${s.platform}'`,
        `'${s.username.replace(/'/g, "''")}'`,
        `'${s.displayName.replace(/'/g, "''")}'`,
        s.profileUrl ? `'${s.profileUrl.replace(/'/g, "''")}'` : 'NULL',
        s.avatarUrl ? `'${s.avatarUrl.replace(/'/g, "''")}'` : 'NULL',
        s.followers || 0,
        s.currentViewers || 'NULL',
        s.highestViewers || 'NULL',
        s.lastStreamed ? `'${s.lastStreamed.toISOString()}'` : 'NULL',
        s.isLive,
        s.currentGame ? `'${s.currentGame.replace(/'/g, "''")}'` : 'NULL',
        `ARRAY[${s.topGames.map(g => `'${g.replace(/'/g, "''")}'`).join(',')}]::text[]`,
        `ARRAY[${s.tags.map(t => `'${t}'`).join(',')}]::text[]`,
        `'${s.region}'`,
        `'${s.language}'`,
        `'${s.fraudCheck}'`
      ];

      return `INSERT INTO streamers (platform, username, "displayName", "profileUrl", "avatarUrl", followers, "currentViewers", "highestViewers", "lastStreamed", "isLive", "currentGame", "topGames", tags, region, language, "fraudCheck") VALUES (${values.join(', ')}) ON CONFLICT (platform, username) DO UPDATE SET "displayName" = EXCLUDED."displayName", "profileUrl" = EXCLUDED."profileUrl", "avatarUrl" = EXCLUDED."avatarUrl", followers = EXCLUDED.followers, "currentViewers" = EXCLUDED."currentViewers", "highestViewers" = EXCLUDED."highestViewers", "lastStreamed" = EXCLUDED."lastStreamed", "isLive" = EXCLUDED."isLive", "currentGame" = EXCLUDED."currentGame", "topGames" = EXCLUDED."topGames", tags = EXCLUDED.tags, region = EXCLUDED.region, language = EXCLUDED.language, "fraudCheck" = EXCLUDED."fraudCheck";`;
    });

    fs.writeFileSync('/tmp/sync_streamers.sql', sqlStatements.join('\n'));
    console.log('Created SQL sync file: /tmp/sync_streamers.sql');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportAllStreamers();