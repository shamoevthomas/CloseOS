import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data: offers, error } = await supabase.from('offers').select('crm_mapping, default_formula_id, has_fixed_fee, fixed_fee_amount').limit(1);
    console.log("Check columns error:", error ? error.message : "Success");
    if (error) {
       console.log("Full error:", error);
    } else {
       console.log("Data present:", !!offers);
    }
}

checkColumns();
