// Sree Sai Fillings Cafe - Complete Laptop to Cloud Synchronizer
const dbManager = require('../src/database/db');
const queries = require('../src/database/queries');
const supabaseSync = require('../src/supabase/supabaseSync');

async function waitForSupabase(maxRetries = 20, delayMs = 5000) {
  console.log('Connecting to Supabase Cloud container (waking up)...');
  for (let i = 1; i <= maxRetries; i++) {
    const conn = await supabaseSync.checkConnection();
    if (conn.connected) {
      console.log(`✅ Supabase Cloud is ONLINE and healthy! (Attempt ${i})\n`);
      return true;
    }
    console.log(`[Attempt ${i}/${maxRetries}] Status: ${conn.message}. Retrying in ${delayMs / 1000}s...`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

async function main() {
  console.log('===========================================================');
  console.log('   SREE SAI FILLINGS CAFE: LAPTOP -> SUPABASE CLOUD SYNC   ');
  console.log('===========================================================\n');

  console.log('1. Initializing local database...');
  await dbManager.initDatabase();

  const isUp = await waitForSupabase();
  if (!isUp) {
    console.error('\n❌ Supabase is still spinning up. Please wait 30 seconds and run again.');
    process.exit(1);
  }

  console.log('2. Syncing Menu Categories & Menu Items...');
  const categories = queries.getAllCategories();
  const menuItems = queries.getAllMenuItems();
  await supabaseSync.syncMenu(categories, menuItems);
  console.log(`   - Synced ${categories.length} categories`);
  console.log(`   - Synced ${menuItems.length} menu items`);

  console.log('\n3. Syncing App Users & Admin Credentials...');
  const users = dbManager.queryAll('SELECT * FROM app_users');
  for (const u of users) {
    await supabaseSync.syncAdminUser(u);
  }
  console.log(`   - Synced ${users.length} user(s)`);

  console.log('\n4. Syncing Customers, Orders, and Expenses...');
  const syncResult = await supabaseSync.updateCloudData(dbManager, queries);
  console.log('Sync Result:', syncResult.message || syncResult);

  // Summary counts verification
  const client = supabaseSync.getClient();
  const [cCount, mCount, custCount, oCount] = await Promise.all([
    client.from('categories').select('*', { count: 'exact', head: true }),
    client.from('menu_items').select('*', { count: 'exact', head: true }),
    client.from('customers').select('*', { count: 'exact', head: true }),
    client.from('orders').select('*', { count: 'exact', head: true })
  ]);

  console.log('\n===========================================================');
  console.log('          CLOUD DATABASE TOTALS AFTER SYNC                ');
  console.log('===========================================================');
  console.log(`Categories in Cloud:  ${cCount.count}`);
  console.log(`Menu Items in Cloud:  ${mCount.count}`);
  console.log(`Customers in Cloud:   ${custCount.count}`);
  console.log(`Orders in Cloud:      ${oCount.count}`);
  console.log('===========================================================');
  console.log('\n🎉 ALL LAPTOP DATA HAS BEEN FULLY & SAFELY SYNCED TO SUPABASE CLOUD!');
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
