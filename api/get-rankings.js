import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

function getYesterdayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  kst.setDate(kst.getDate() - 1);
  return kst.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not configured' });
  }

  try {
    // Today's top 30
    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const blacklist = (process.env.RANK_BLACKLIST || '')
      .split(',').map(s => s.trim()).filter(s => UUID_RE.test(s));
    
    let query = supabase
      .from('account_current')
      .select('id, nickname, handle, elo_score, tier_name, profile_image_url, follower_count, plot_interaction_count, voice_play_count, updated_at')
      .order('elo_score', { ascending: false });

    if (blacklist.length > 0) {
      query = query.not('id', 'in', `(${blacklist.join(',')})`);
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;

    // Yesterday's elo for rank change calculation
    const yesterday = getYesterdayKST();
    const ids = data.map(r => r.id);

    let yesterdayMap = {};
    if (ids.length > 0) {
      const { data: histRows } = await supabase
        .from('account_history')
        .select('id, elo_score')
        .eq('record_date', yesterday)
        .in('id', ids);

      if (histRows) {
        for (const row of histRows) {
          yesterdayMap[row.id] = row.elo_score;
        }
      }
    }

    // Assign yesterday's ranks: sort today's 30 by yesterday elo
    const withYesterday = data.map(r => ({
      ...r,
      _yesterdayElo: yesterdayMap[r.id] ?? null,
    }));

    // Sort by yesterday elo to get yesterday positions
    const sortedByYesterday = [...withYesterday]
      .filter(r => r._yesterdayElo !== null)
      .sort((a, b) => b._yesterdayElo - a._yesterdayElo);

    const yesterdayRankMap = {};
    sortedByYesterday.forEach((r, i) => {
      yesterdayRankMap[r.id] = i + 1;
    });

    // Compute rank_change = yesterday_rank - today_rank (positive = improved)
    const rankings = data.map((r, i) => {
      const todayRank = i + 1;
      const yesterdayRank = yesterdayRankMap[r.id];
      const rank_change = yesterdayRank != null ? yesterdayRank - todayRank : null;
      return { ...r, rank_change };
    });

    return res.status(200).json({ rankings });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
