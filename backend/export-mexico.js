const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const creators = await prisma.streamer.findMany({
    where: {
      OR: [
        { region: 'MEXICO' },
        { countryCode: 'MX' },
        { inferredCountry: 'MX' }
      ]
    },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      followers: true,
      region: true,
      countryCode: true,
      inferredCountry: true,
      primaryCategory: true,
      isLive: true,
      avatarUrl: true,
      profileUrl: true,
      language: true
    },
    orderBy: { followers: 'desc' }
  });

  // Create CSV
  const headers = ['ID', 'Platform', 'Username', 'Display Name', 'Followers', 'Region', 'Country Code', 'Inferred Country', 'Category', 'Is Live', 'Avatar URL', 'Profile URL', 'Language'];
  const csvRows = [headers.join(',')];

  for (const c of creators) {
    const row = [
      c.id,
      c.platform,
      '"' + (c.username || '').replace(/"/g, '""') + '"',
      '"' + (c.displayName || '').replace(/"/g, '""') + '"',
      c.followers || 0,
      c.region || '',
      c.countryCode || '',
      c.inferredCountry || '',
      c.primaryCategory || '',
      c.isLive ? 'Yes' : 'No',
      c.avatarUrl || '',
      c.profileUrl || '',
      c.language || ''
    ];
    csvRows.push(row.join(','));
  }

  fs.writeFileSync('mexico_creators.csv', csvRows.join('\n'), 'utf8');
  console.log('CSV created with', creators.length, 'creators');
}

main().catch(console.error).finally(() => prisma.$disconnect());
