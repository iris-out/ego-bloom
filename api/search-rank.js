import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!supabase) return res.status(500).json({ error: 'Database connection not configured' });

  const raw = (req.query.q || '').trim();
  if (!raw) return res.status(400).json({ error: '검색어를 입력해주세요.' });

  // @ 제거 후 검색
  const q = raw.startsWith('@') ? raw.slice(1) : raw;

  try {
    // 닉네임 또는 핸들로 검색
    const { data: users, error: searchErr } = await supabase
      .from('account_current')
      .select('*')
      .or(`nickname.ilike.%${q}%,handle.ilike.%${q}%`)
      .order('elo_score', { ascending: false })
      .limit(1);

    if (searchErr) throw searchErr;
    if (!users || users.length === 0) {
      return res.status(404).json({ error: '해당 크리에이터를 찾을 수 없습니다.' });
    }

    const user = users[0];

    // 이 유저보다 ELO가 높은 수 + 1 = 순위
    const { count, error: rankErr } = await supabase
      .from('account_current')
      .select('*', { count: 'exact', head: true })
      .gt('elo_score', user.elo_score);

    if (rankErr) throw rankErr;

    return res.status(200).json({ user, rank: (count ?? 0) + 1 });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
