import { createClient } from '@supabase/supabase-js';
import { getCreatorTierName } from '../shared/creatorTiers.js';
import { createZetaSource } from '../shared/zetaSource.js';

export { getCreatorTierName } from '../shared/creatorTiers.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function toKST(now) {
  const date = new Date(now);
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (9 * 60 * 60 * 1000));
}

// 서버사이드 ELO 계산 - src/utils/tierCalculator.js V4.2 와 같은 공식이다.
// 한쪽을 고치면 다른 쪽도 고쳐야 한다.
export function calculateEloScore({ followerCount, plotInteractionCount, voicePlayCount, plotCount, topCharInteractions, oldestCharCreatedAt }, now = Date.now()) {
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
      activityDays = Math.max(1, (toKST(now).getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));
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

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HANDLE_RE = /^[a-zA-Z0-9가-힣._-]{1,50}$/;

/** 같은 제작자를 다시 읽기까지 기다리는 시간이다. 프로필을 새로고침할 때마다 제타에
 * 캐릭터 목록을 다시 요청하면 상류에 부담이 가고 응답도 느리다. 이 창 안의 요청은
 * 저장을 건너뛰고 바로 성공으로 답한다. */
export const MIN_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

export function isAllowedOrigin(origin, env = process.env) {
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS || 'https://ego-bloom.vercel.app,http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}

export function sanitizeProfileImageUrl(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 500) return null;
  if (url.startsWith('/zeta-image/') || url.startsWith('/zeta-s3/')) return url;
  if (url.startsWith('https://image.zeta-ai.io/') ||
      url.startsWith('https://zeta-image.s3.ap-northeast-2.amazonaws.com/')) return url;
  return null;
}

/** 핸들러를 의존성 주입 형태로 만든다. dev mock(vite.config.js) 과 단위 테스트가
 * 같은 구현을 쓰고, 두 경로가 서로 다르게 동작하는 일이 없다. */
export function createUpdateCreatorHandler({
  supabase,
  fetchSnapshot,
  now = () => Date.now(),
  env = process.env,
  minIntervalMs = MIN_UPDATE_INTERVAL_MS,
} = {}) {
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Origin 검사는 CSRF 성격의 방어일 뿐이다. 브라우저 밖에서는 임의로 넣을 수 있으므로
    // 이것만으로 쓰기를 지키지 않는다. 지표는 아래에서 서버가 직접 읽는다.
    if (!isAllowedOrigin(req.headers?.origin, env)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!supabase) {
      console.error('Supabase credentials are not set in environment variables.');
      return res.status(500).json({ error: 'Database connection not configured' });
    }

    try {
      const id = (req.body || {}).id;
      if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid creator ID' });
      }

      const blacklist = (env.RANK_BLACKLIST || '')
        .split(',').map(s => s.trim()).filter(s => UUID_RE.test(s));
      if (blacklist.includes(id)) {
        return res.status(200).json({ success: true, message: 'Creator is blacklisted, skipping update' });
      }

      const { data: existing, error: readError } = await supabase
        .from('account_current')
        .select('updated_at')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw readError;

      const stamp = now();
      const lastUpdate = existing?.updated_at ? Date.parse(existing.updated_at) : NaN;
      if (Number.isFinite(lastUpdate) && stamp - lastUpdate < minIntervalMs) {
        return res.status(200).json({ success: true, message: 'Recently updated, skipping' });
      }

      // 클라이언트가 보낸 수치는 쓰지 않는다. 제타 공개 API 에서 다시 읽는다.
      const snapshot = await fetchSnapshot(id);
      if (!snapshot) {
        return res.status(404).json({ error: 'Creator not found upstream' });
      }

      const safeHandle = (typeof snapshot.handle === 'string' && HANDLE_RE.test(snapshot.handle.replace(/^@/, '')))
        ? snapshot.handle.replace(/^@/, '').slice(0, 50)
        : null;

      const eloScore = calculateEloScore(snapshot, stamp);
      const tierName = getCreatorTierName(eloScore);

      const { error: currentError } = await supabase
        .from('account_current')
        .upsert({
          id,
          handle: safeHandle,
          nickname: String(snapshot.nickname || 'Unknown').slice(0, 100),
          profile_image_url: sanitizeProfileImageUrl(snapshot.profileImageUrl),
          follower_count:         snapshot.followerCount,
          plot_interaction_count: snapshot.plotInteractionCount,
          voice_play_count:       snapshot.voicePlayCount,
          elo_score:  eloScore,
          tier_name:  tierName,
          updated_at: new Date(stamp).toISOString()
        }, { onConflict: 'id' });

      if (currentError) throw currentError;

      // account_history 는 scripts/snapshot_history.js 한 곳만 쓴다.

      return res.status(200).json({ success: true, message: 'Creator ranking updated' });
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  };
}

let defaultHandler = null;

export default async function handler(req, res) {
  if (!defaultHandler) {
    const supabase = (supabaseUrl && supabaseServiceKey)
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    const source = supabase ? createZetaSource() : null;
    defaultHandler = createUpdateCreatorHandler({
      supabase,
      fetchSnapshot: (id) => source.creatorSnapshot(id),
    });
  }
  return defaultHandler(req, res);
}
