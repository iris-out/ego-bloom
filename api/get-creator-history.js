import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function getTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  return kst.toISOString().split('T')[0];
}

// 두 날짜(YYYY-MM-DD) 사이의 일수 차이
function daysBetween(fromDate, toDate) {
  const a = new Date(`${fromDate}T00:00:00Z`).getTime();
  const b = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

// 특정 크리에이터의 "오늘 이전" 가장 최신 스냅샷을 반환.
// 1일 전 대비 성장을 보여주기 위한 기준점(baseline)으로 사용한다.
// 어제 스냅샷이 없으면(데이터 공백) 그 이전 최신 스냅샷으로 폴백하고,
// 실제 경과 일수(daysAgo)를 함께 반환해 UI가 정확히 라벨링할 수 있게 한다.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!supabase) return res.status(500).json({ error: 'Database connection not configured' });

  try {
    const id = String(req.query.id || '');
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid creator ID' });
    }

    const today = getTodayKST();

    const { data, error } = await supabase
      .from('account_history')
      .select('record_date, elo_score, follower_count, plot_interaction_count, voice_play_count, plot_count, tier_name')
      .eq('id', id)
      .lt('record_date', today)
      .order('record_date', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(200).json({ found: false });
    }

    const baseline = data[0];
    return res.status(200).json({
      found: true,
      baseline,
      recordDate: baseline.record_date,
      daysAgo: daysBetween(baseline.record_date, today),
    });
  } catch (error) {
    console.error('Creator History API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
