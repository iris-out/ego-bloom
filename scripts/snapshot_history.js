import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local if it exists (local dev)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* .env.local not present in CI — env vars come from GH secrets */ }

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  return kst.toISOString().split('T')[0];
}

async function snapshotHistory() {
  const today = getTodayKST();
  console.log(`📸 Snapshotting account_current → account_history for ${today}`);

  try {
    const { data, error } = await supabase
      .from('account_current')
      .select('id, nickname, handle, elo_score, follower_count, plot_interaction_count, plot_count, tier_name, voice_play_count')
      .gt('elo_score', 0);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log('ℹ️  No records found in account_current.');
      return;
    }

    console.log(`Found ${data.length} records to snapshot.`);

    const CHUNK_SIZE = 500;
    const batch = data.map(row => ({ ...row, record_date: today }));

    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      const chunk = batch.slice(i, i + CHUNK_SIZE);
      const { error: upsertErr } = await supabase
        .from('account_history')
        .upsert(chunk, { onConflict: 'id,record_date' });
      if (upsertErr) throw upsertErr;
      console.log(`  Upserted ${Math.min(i + CHUNK_SIZE, batch.length)} / ${batch.length}`);
    }

    console.log(`✅ Snapshot complete: ${data.length} records saved for ${today}`);
  } catch (err) {
    console.error('❌ Snapshot failed:', err);
    process.exit(1);
  }
}

snapshotHistory();
