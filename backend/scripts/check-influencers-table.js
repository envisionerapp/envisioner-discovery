const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // Get columns
  const columns = await db.$queryRawUnsafe(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'influencers'
    ORDER BY ordinal_position;
  `);
  console.log('=== INFLUENCERS TABLE COLUMNS ===');
  console.log(JSON.stringify(columns, null, 2));

  // Get sample row
  const sample = await db.$queryRawUnsafe(`
    SELECT * FROM influencers LIMIT 1;
  `);
  console.log('\n=== SAMPLE ROW ===');
  console.log(JSON.stringify(sample, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
