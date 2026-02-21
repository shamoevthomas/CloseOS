const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qwjvdwpixewsctircibl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3anZkd3BpeGV3c2N0aXJjaWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI1ODQ3NiwiZXhwIjoyMDgxODM0NDc2fQ.QjBgFC5NnIN3fz72Hi82oHEV-ADZPw0ffA1dcksDRA0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Sending query...');
  const { error } = await supabase.from('offers').insert([{
    user_id: '00000000-0000-0000-0000-000000000000',
    name: 'Migration Dummy',
    crm_mapping: {},
    has_fixed_fee: false,
    fixed_fee_amount: '100'
  }]).select('*');
  console.log(error);
}
run();
