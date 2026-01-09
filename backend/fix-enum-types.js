// Script to fix enum types in discovery tables
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixEnumTypes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'prisma/migrations/fix_enum_types.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute
    console.log('Fixing enum types...');
    await client.query(sql);

    console.log('\n✅ Enum types fixed successfully!');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'discovery_creators'
      AND column_name IN ('platform', 'region', 'fraudCheck')
    `);

    console.log('\nColumn types after fix:');
    result.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.udt_name}`));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\nNote: Run create-tables.js first if tables do not exist');
    }
  } finally {
    await client.end();
  }
}

fixEnumTypes();
