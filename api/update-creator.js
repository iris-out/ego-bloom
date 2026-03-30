import { createClient } from '@supabase/supabase-js';

// 환경 변수 검증
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  // CORS 처리 (필요에 따라 설정)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabase) {
    console.error('Supabase credentials are not set in environment variables.');
    return res.status(500).json({ error: 'Database connection not configured' });
  }

  try {
    const { 
      id, 
      handle, 
      nickname, 
      profileImageUrl, 
      followerCount, 
      plotInteractionCount, 
      voicePlayCount, 
      eloScore, 
      tierName 
    } = req.body;

    if (!id || !nickname) {
      return res.status(400).json({ error: 'Missing required fields (id, nickname)' });
    }

    // KST(한국 표준시) 기준으로 오늘 날짜(YYYY-MM-DD) 계산
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 60 * 60 * 1000));
    const recordDate = kst.toISOString().split('T')[0];

    // 1. account_current에 UPSERT (덮어쓰기)
    const blacklist = (process.env.RANK_BLACKLIST || '').split(',').map(s => s.trim()).filter(Boolean);
    if (blacklist.includes(id)) {
      return res.status(200).json({ success: true, message: 'Creator is blacklisted, skipping update' });
    }

    const { error: currentError } = await supabase
      .from('account_current')
      .upsert({
        id,
        handle: handle || null,
        nickname,
        profile_image_url: profileImageUrl || null,
        follower_count: followerCount || 0,
        plot_interaction_count: plotInteractionCount || 0,
        voice_play_count: voicePlayCount || 0,
        elo_score: eloScore || 0,
        tier_name: tierName || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (currentError) {
      console.error('Error upserting to account_current:', currentError);
      throw currentError;
    }

    // 2. account_history에 UPSERT (오늘 날짜 기준 덮어쓰기 혹은 새 날짜면 INSERT)
    const { error: historyError } = await supabase
      .from('account_history')
      .upsert({
        id,
        record_date: recordDate,
        handle: handle || null,
        nickname,
        follower_count: followerCount || 0,
        plot_interaction_count: plotInteractionCount || 0,
        voice_play_count: voicePlayCount || 0,
        elo_score: eloScore || 0,
        tier_name: tierName || null
      }, {
        onConflict: 'id, record_date'
      });

    if (historyError) {
      console.error('Error upserting to account_history:', historyError);
      throw historyError;
    }

    return res.status(200).json({ success: true, message: 'Creator ranking updated' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
