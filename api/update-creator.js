import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

function toKST() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (9 * 60 * 60 * 1000));
}

// 서버사이드 ELO 계산 — src/utils/tierCalculator.js V4.2와 동일한 공식
// 클라이언트가 전송한 eloScore를 신뢰하지 않고 raw stats에서 직접 계산
function calculateEloScore({ followerCount, plotInteractionCount, voicePlayCount, plotCount, topCharInteractions, oldestCharCreatedAt }) {
  const totalInteractions = plotInteractionCount || 0;
  const followers = followerCount || 0;
  const voicePlays = voicePlayCount || 0;

  const top20Sum = (topCharInteractions || []).slice(0, 20).reduce((a, b) => a + (b || 0), 0);
  const numChars = Math.max(1, plotCount || 1);
  const avgInteractions = totalInteractions / numChars;

  let score = (totalInteractions * 3.0)
    + (followers * 300.0)
    + (top20Sum * 0.5)
    + (avgInteractions * 20.0)
    + (voicePlays * 100.0);

  let activityDays = 365;
  if (oldestCharCreatedAt) {
    const oldest = new Date(oldestCharCreatedAt);
    if (!isNaN(oldest.getTime())) {
      activityDays = Math.max(1, (toKST().getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  if (numChars <= 20 && (totalInteractions > 10000 || followers > 50)) {
    const rosterFactor = (20 - numChars) / 20;
    const impact = totalInteractions / 10000 + followers / 10;
    score += Math.min(score * 0.15, rosterFactor * impact * 1200);
  }

  if (activityDays < 365 && activityDays >= 7 && (totalInteractions > 5000 || followers > 30)) {
    const tenureFactor = (365 - activityDays) / 365;
    const dailyImpact = totalInteractions / activityDays + followers * 2;
    score += Math.min(score * 0.10, tenureFactor * dailyImpact * 75);
  }

  return Math.floor(score);
}

const CREATOR_TIERS = [
  { name: 'BRONZE', min: 0 },
  { name: 'SILVER', min: 12000 },
  { name: 'GOLD', min: 85000 },
  { name: 'PLATINUM', min: 868500 },
  { name: 'DIAMOND', min: 3908250 },
  { name: 'MASTER', min: 17370000 },
  { name: 'CHAMPION', min: 78165000 },
];

function getCreatorTierName(score) {
  let tier = CREATOR_TIERS[0];
  for (let i = CREATOR_TIERS.length - 1; i >= 0; i--) {
    if (score >= CREATOR_TIERS[i].min) { tier = CREATOR_TIERS[i]; break; }
  }
  return tier.name;
}

export default async function handler(req, res) {
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
      plotCount,
      topCharInteractions,
      oldestCharCreatedAt,
    } = req.body;

    // 입력값 검증
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid creator ID' });
    }
    if (!nickname || typeof nickname !== 'string') {
      return res.status(400).json({ error: 'Missing required field: nickname' });
    }

    const safeFollower     = Math.max(0, Math.floor(Number(followerCount)        || 0));
    const safeInteraction  = Math.max(0, Math.floor(Number(plotInteractionCount) || 0));
    const safeVoice        = Math.max(0, Math.floor(Number(voicePlayCount)       || 0));
    const safePlotCount    = Math.max(0, Math.floor(Number(plotCount)            || 0));
    const safeTopChars     = Array.isArray(topCharInteractions)
      ? topCharInteractions.slice(0, 20).map(n => Math.max(0, Math.floor(Number(n) || 0)))
      : [];

    const blacklist = (process.env.RANK_BLACKLIST || '').split(',').map(s => s.trim()).filter(Boolean);
    if (blacklist.includes(id)) {
      return res.status(200).json({ success: true, message: 'Creator is blacklisted, skipping update' });
    }

    // 서버에서 ELO/티어 재계산 (클라이언트 제공값 무시)
    const eloScore = calculateEloScore({
      followerCount:        safeFollower,
      plotInteractionCount: safeInteraction,
      voicePlayCount:       safeVoice,
      plotCount:            safePlotCount,
      topCharInteractions:  safeTopChars,
      oldestCharCreatedAt:  oldestCharCreatedAt || null,
    });
    const tierName = getCreatorTierName(eloScore);

    const kst = toKST();
    const recordDate = kst.toISOString().split('T')[0];

    const { error: currentError } = await supabase
      .from('account_current')
      .upsert({
        id,
        handle: handle || null,
        nickname: String(nickname).slice(0, 100),
        profile_image_url: profileImageUrl || null,
        follower_count:         safeFollower,
        plot_interaction_count: safeInteraction,
        voice_play_count:       safeVoice,
        elo_score:  eloScore,
        tier_name:  tierName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (currentError) throw currentError;

    const { error: historyError } = await supabase
      .from('account_history')
      .upsert({
        id,
        record_date: recordDate,
        handle: handle || null,
        nickname: String(nickname).slice(0, 100),
        follower_count:         safeFollower,
        plot_interaction_count: safeInteraction,
        voice_play_count:       safeVoice,
        elo_score: eloScore,
        tier_name: tierName,
      }, { onConflict: 'id, record_date' });

    if (historyError) throw historyError;

    return res.status(200).json({ success: true, message: 'Creator ranking updated' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
