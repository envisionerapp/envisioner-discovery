#!/usr/bin/env ts-node
/**
 * Manually trigger live status check on production database
 */

import { PrismaClient } from '@prisma/client';
import { liveStatusService } from './src/services/liveStatusService';

const PROD_DB = 'postgresql://mielo_dbms_user:UxAYpbAFawKzxltS9OBrq8UvzBQfwxu7@dpg-d33j19odl3ps738uaoi0-a.oregon-postgres.render.com/mielo_dbms';

// Temporarily override DATABASE_URL for this script
process.env.DATABASE_URL = PROD_DB;

async function triggerLiveCheck() {
  try {
    console.log('🔴 Starting live status check on production...');
    console.log('   This will check all streamers and may take a few minutes...');

    const result = await liveStatusService.updateStreamersLiveStatus(1000, 50);

    console.log('\n✅ Live status check complete!');
    console.log(`   Total checked: ${result.totalChecked}`);
    console.log(`   Currently live: ${result.liveCount}`);
    console.log(`   Errors: ${result.errors}`);

  } catch (error) {
    console.error('❌ Live status check failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

triggerLiveCheck();
