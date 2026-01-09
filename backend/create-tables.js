// Script to create discovery tables
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function createTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'prisma/migrations/create_discovery_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute entire script
    console.log('Creating discovery tables...');
    await client.query(sql);

    console.log('\n✅ Discovery tables created successfully!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'discovery_%'
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    result.rows.forEach(row => console.log('  - ' + row.table_name));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('Tables already exist - this is OK');
    }
  } finally {
    await client.end();
  }
}

createTables();
