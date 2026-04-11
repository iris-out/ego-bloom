import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!supabase) return res.status(500).json({ error: 'Database connection not configured' });

  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getUTCFullYear();
    const month = parseInt(req.query.month) || (now.getUTCMonth() + 1);
    const seasonStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const blacklist = (process.env.RANK_BLACKLIST || '')
      .split(',').map(s => s.trim()).filter(s => UUID_RE.test(s));

    // Get all current scores
    let query = supabase
      .from('account_current')
      .select('id, nickname, handle, elo_score, tier_name, follower_count, plot_interaction_count')
      .gt('elo_score', 0);

    if (blacklist.length > 0) {
      query = query.not('id', 'in', `(${blacklist.join(',')})`);
    }

    const { data: current, error: currentErr } = await query;
    if (currentErr) throw currentErr;

    if (!current || current.length === 0) {
      return res.status(200).json({ rankings: [], season: { year, month, start: seasonStart } });
    }

    const ids = current.map(r => r.id);

    // Get earliest history records at/after season start for each creator
    // 청크를 병렬로 실행하여 응답 지연 최소화
    const CHUNK = 400;
    const chunkPromises = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      chunkPromises.push(
        supabase
          .from('account_history')
          .select('id, elo_score, record_date')
          .gte('record_date', seasonStart)
          .in('id', chunk)
          .order('record_date', { ascending: true })
      );
    }
    const chunkResults = await Promise.all(chunkPromises);
    let allHistory = [];
    for (const { data: rows, error: histErr } of chunkResults) {
      if (histErr) throw histErr;
      allHistory = allHistory.concat(rows || []);
    }

    // Build map: id → earliest elo in the season
    const seasonStartElo = {};
    for (const row of allHistory) {
      if (!seasonStartElo[row.id]) {
        seasonStartElo[row.id] = row.elo_score;
      }
    }

    // Compute elo_change and return top 30 by change
    const ranked = current
      .filter(c => seasonStartElo[c.id] != null)
      .map(creator => ({
        ...creator,
        start_elo: seasonStartElo[creator.id],
        elo_change: creator.elo_score - seasonStartElo[creator.id],
      }))
      .sort((a, b) => b.elo_change - a.elo_change)
      .slice(0, 30);

    return res.status(200).json({
      rankings: ranked,
      season: { year, month, start: seasonStart },
    });
  } catch (err) {
    console.error('Season rankings API error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
