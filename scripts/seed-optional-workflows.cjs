const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const orgId = '4d885f6c-e076-4ed9-ab09-23637dbee6cd';

  // Use the RPC which now handles ALL presets (core + optional) idempotently
  const { data, error } = await supabase.rpc('seed_automation_presets', { p_org_id: orgId });
  if (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
  console.log('Seeded presets (upsert):', data);

  // Verify all presets
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('preset_key, name, is_active, trigger_event, delay_seconds')
    .eq('org_id', orgId)
    .eq('is_preset', true)
    .order('name');
  console.log('\nAll presets (' + rules.length + '):');
  rules.forEach(r => console.log(
    (r.is_active ? ' [ON] ' : ' [OFF]'),
    r.preset_key.padEnd(30),
    r.trigger_event.padEnd(22),
    'delay:', r.delay_seconds + 's'
  ));
}
run().catch(e => console.error(e.message));
