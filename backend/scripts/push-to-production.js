const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 PUSHING LOCAL DATABASE TO PRODUCTION');

try {
  // 1. Export local database to SQL
  console.log('📦 Exporting local database...');
  execSync('pg_dump "postgresql://postgres:Abiola123@localhost:5432/mielo_dev" --data-only --table=streamers > /tmp/production_sync.sql', { stdio: 'inherit' });

  // 2. Upload to production (you'll need to run this manually)
  console.log('📋 SQL file created: /tmp/production_sync.sql');
  console.log('');
  console.log('🎯 TO COMPLETE THE SYNC:');
  console.log('1. Go to your Render Database');
  console.log('2. Connect to PostgreSQL');
  console.log('3. Run: TRUNCATE TABLE streamers;');
  console.log('4. Import: \\i /tmp/production_sync.sql');
  console.log('');
  console.log('OR use this command if you have production DB access:');
  console.log('psql $DATABASE_URL -c "TRUNCATE TABLE streamers;" && psql $DATABASE_URL < /tmp/production_sync.sql');

} catch (error) {
  console.error('❌ Error:', error.message);

  // Fallback: use the SQL file we already created
  console.log('📋 Using existing SQL file: /tmp/sync_streamers.sql');
  console.log('');
  console.log('🎯 TO SYNC YOUR LOCAL DATA TO PRODUCTION:');
  console.log('1. Copy the SQL file content from /tmp/sync_streamers.sql');
  console.log('2. Go to Render Dashboard > Database');
  console.log('3. Open database shell');
  console.log('4. Run: TRUNCATE TABLE streamers;');
  console.log('5. Paste and run the SQL from the file');
  console.log('');
  console.log('This will give you EXACTLY what you have locally!');
}