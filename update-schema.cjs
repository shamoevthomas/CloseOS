const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qwjvdwpixewsctircibl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3anZkd3BpeGV3c2N0aXJjaWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI1ODQ3NiwiZXhwIjoyMDgxODM0NDc2fQ.QjBgFC5NnIN3fz72Hi82oHEV-ADZPw0ffA1dcksDRA0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching an offer to get a valid user_id...');
  const { data: offers, error: fetchError } = await supabase.from('offers').select('id, user_id').limit(1);
  if (fetchError || !offers || offers.length === 0) {
    console.error('Failed to fetch offer:', fetchError);
    return;
  }
  const offer = offers[0];
  console.log('Got offer:', offer);

  console.log('Updating offer to trigger schema update for crm_mapping, has_fixed_fee, fixed_fee_amount...');
  const { data, error } = await supabase.from('offers').update({
    crm_mapping: {},
    has_fixed_fee: false,
    fixed_fee_amount: null
  }).eq('id', offer.id);
  
  console.log('Result:', error || 'Success');
}
run();
