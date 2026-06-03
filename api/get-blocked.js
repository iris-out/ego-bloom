import { createClient } from '@supabase/supabase-js';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// 차단된 크리에이터의 id/handle 일괄 조회 — 메인(태그별 TOP 제작자) 클라이언트 필터용.
// 데이터 파이프라인(fetch_ranking.js)이 이미 플롯을 거르지만, ranking_latest.json이
// DB 접근 없이 생성된 경우(필터 미적용)에도 메인에서 실시간으로 차단 제작자를 가린다.
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' }));

  // 자주 바뀌지 않으므로 짧은 CDN 캐시 — 차단 반영은 최대 60초 지연.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  // DB 미설정 시에도 메인이 깨지지 않도록 빈 목록 반환.
  if (!supabase) return res.status(200).end(JSON.stringify({ ids: [], handles: [] }));

  try {
    const { data, error } = await supabase
      .from('account_current')
      .select('id, handle')
      .eq('is_blocked', true);
    if (error) throw error;

    const ids = [];
    const handles = [];
    for (const row of (data || [])) {
      if (row.id) ids.push(row.id);
      if (row.handle) handles.push(row.handle.toLowerCase());
    }
    return res.status(200).end(JSON.stringify({ ids, handles }));
  } catch (err) {
    console.error('get-blocked error:', err.message);
    return res.status(200).end(JSON.stringify({ ids: [], handles: [] }));
  }
}
