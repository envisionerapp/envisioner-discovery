// Direct SQL approach to clear production database
console.log('🗑️ CLEARING PRODUCTION DATABASE DIRECTLY...');

// Create SQL command to truncate the streamers table
const clearCommand = `
-- Clear all streamers from production
TRUNCATE TABLE streamers RESTART IDENTITY CASCADE;
`;

console.log('📝 SQL Command to run on production database:');
console.log(clearCommand);

console.log('');
console.log('🔗 To execute this:');
console.log('1. Connect to your Render PostgreSQL database');
console.log('2. Run the above TRUNCATE command');
console.log('3. This will instantly clear all streamers');

console.log('');
console.log('🚨 WARNING: This will permanently delete ALL streamers from production!');
console.log('✅ After this completes, production will have 0 streamers.');