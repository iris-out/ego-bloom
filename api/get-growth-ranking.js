import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

function getKSTDateString(daysAgo = 0) {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  kst.setDate(kst.getDate() - daysAgo);
  return kst.toISOString().split('T')[0];
}

function assignGrowthTier(rank, total) {
  const pct = rank / total;
  if (pct <= 0.01) return { tier: 'champion', name: 'CHAMPION', color: '#F97316' };
  if (pct <= 0.05) return { tier: 'master',   name: 'MASTER',   color: '#D946EF' };
  if (pct <= 0.15) return { tier: 'diamond',  name: 'DIAMOND',  color: '#3B82F6' };
  if (pct <= 0.30) return { tier: 'platinum', name: 'PLATINUM', color: '#E2E8F0' };
  if (pct <= 0.50) return { tier: 'gold',     name: 'GOLD',     color: '#FBBF24' };
  if (pct <= 0.70) return { tier: 'silver',   name: 'SILVER',   color: '#9CA3AF' };
  return                  { tier: 'bronze',   name: 'BRONZE',   color: '#C58356' };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not configured' });
  }

  try {
    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const blacklist = (process.env.RANK_BLACKLIST || '')
      .split(',').map(s => s.trim()).filter(s => UUID_RE.test(s));

    const todayKST     = getKSTDateString(0);
    const threeDaysAgo = getKSTDateString(3);

    // 최근 3일치 history 조회
    const { data: historyRows, error: histErr } = await supabase
      .from('account_history')
      .select('id, record_date, elo_score, follower_count, plot_interaction_count, nickname, handle, tier_name')
      .gte('record_date', threeDaysAgo)
      .lte('record_date', todayKST)
      .order('record_date', { ascending: true });

    if (histErr) throw histErr;

    if (!historyRows || historyRows.length === 0) {
      return res.status(200).json({ rankings: [], dataAvailable: false });
    }

    // 이 윈도우에 포함된 크리에이터 ID 목록
    const windowIds = [...new Set(historyRows.map(r => r.id))].filter(id => !blacklist.includes(id));

    // 크리에이터별 전체 레코드 수 조회 (등록 기간 판단)
    let totalRecordMap = {};
    const CHUNK = 400;
    for (let i = 0; i < windowIds.length; i += CHUNK) {
      const chunk = windowIds.slice(i, i + CHUNK);
      const { data: allRows } = await supabase
        .from('account_history')
        .select('id')
        .in('id', chunk);
      if (allRows) {
        for (const row of allRows) {
          totalRecordMap[row.id] = (totalRecordMap[row.id] || 0) + 1;
        }
      }
    }

    // 크리에이터별 그룹화
    const byCreator = {};
    for (const row of historyRows) {
      if (blacklist.includes(row.id)) continue;
      if (!byCreator[row.id]) byCreator[row.id] = [];
      byCreator[row.id].push(row);
    }

    // 성장 점수 계산
    // - 조건: 윈도우 내 레코드 >= 2개 AND 전체 레코드 > 3개 (3일 이하 등록자 제외)
    const growthList = [];

    for (const [id, records] of Object.entries(byCreator)) {
      if (records.length < 2) continue;
      if ((totalRecordMap[id] || 0) <= 3) continue; // 전체 등록 기록 3일 이하면 제외

      const oldest = records[0];
      const latest = records[records.length - 1];
      const growthScore = (latest.elo_score || 0) - (oldest.elo_score || 0);

      growthList.push({
        id,
        nickname: latest.nickname,
        handle: latest.handle,
        elo_score: latest.elo_score || 0,
        elo_oldest: oldest.elo_score || 0,
        elo_oldest_date: oldest.record_date,
        elo_latest_date: latest.record_date,
        growth_score: growthScore,
        follower_count: latest.follower_count || 0,
        follower_count_oldest: oldest.follower_count || 0,
        plot_interaction_count: latest.plot_interaction_count || 0,
        plot_interaction_oldest: oldest.plot_interaction_count || 0,
        tier_name: latest.tier_name,
        data_points: records.length,
      });
    }

    growthList.sort((a, b) => b.growth_score - a.growth_score);

    const positiveGrowth = growthList.filter(c => c.growth_score > 0);
    const top10 = positiveGrowth.slice(0, 10);
    const total = positiveGrowth.length;

    const rankings = top10.map((creator, i) => {
      const tierInfo = assignGrowthTier(i + 1, total);
      return {
        ...creator,
        growth_rank: i + 1,
        growth_tier: tierInfo.tier,
        growth_tier_name: tierInfo.name,
        growth_tier_color: tierInfo.color,
      };
    });

    return res.status(200).json({
      rankings,
      dataAvailable: true,
      totalWithGrowth: total,
      windowDays: 3,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Growth Ranking API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
