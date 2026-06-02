// 메인(태그별 TOP 제작자) 집계 유틸 — 순수 함수.
// ranking_latest.json의 trendingPlots/bestPlots/newPlots(플롯별 creator+hashtags+interactionCount)를
// 클라이언트에서 집계해 태그별 제작자 리더보드를 만든다. 백엔드 변경 없음.

// 피처드 태그 정의 (scripts/fetch_ranking.js의 분류 체계 차용).
// match: 플롯 hashtag(lowercase)가 이 셋과 교집합이면 해당 태그로 분류.
export const FEATURED_TAGS = [
  { key: '순애',      label: '순애보',           emoji: '💗', accent: '#f0abfc', match: ['순애'] },
  { key: 'ntr_agg',   label: '사랑 파괴자',      emoji: '💔', accent: '#fb7185', match: ['빼앗김', '뺏김', '불륜', '바람'] },
  { key: 'hpj_agg',   label: '후회·피폐·집착',   emoji: '🖤', accent: '#94a3b8', match: ['후회', '피폐', '집착'] },
  { key: '짝사랑',    label: '짝사랑',           emoji: '🌙', accent: '#f9a8d4', match: ['짝사랑'] },
  { key: '혐관',      label: '혐관',             emoji: '⚔️', accent: '#c084fc', match: ['혐관'] },
  { key: '능글',      label: '능글남·능글녀',    emoji: '😏', accent: '#fbbf24', match: ['능글'] },
  { key: 'harem_agg', label: '하렘·역하렘',      emoji: '👑', accent: '#818cf8', match: ['하렘', '역하렘'] },
  { key: 'bl',        label: 'BL',               emoji: '💙', accent: '#38bdf8', match: ['bl'] },
  { key: 'gl',        label: 'GL',               emoji: '💜', accent: '#a78bfa', match: ['gl'] },
  { key: '소꿉친구',  label: '소꿉친구',         emoji: '🍃', accent: '#2dd4bf', match: ['소꿉친구'] },
  { key: '배신',      label: '배신',             emoji: '🗡️', accent: '#f43f5e', match: ['배신'] },
];

const lower = (s) => (s == null ? '' : String(s).toLowerCase());

// 세 랭킹 리스트를 합쳐 plot id 기준 중복 제거(최대 interactionCount 채택).
function buildPlotPool(rankingData) {
  const byId = new Map();
  const lists = [rankingData?.trendingPlots, rankingData?.bestPlots, rankingData?.newPlots];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      if (!p || !p.id) continue;
      const prev = byId.get(p.id);
      const cur = p.interactionCount ?? 0;
      if (!prev || cur > (prev.interactionCount ?? 0)) byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}

/**
 * 태그별 제작자 리더보드 생성.
 * @returns Array<{ key,label,emoji,accent, creators: Array<{
 *   handle, nickname, imageUrl, score, plotCount, topPlot:{id,name,imageUrl}
 * }> }>
 */
export function buildTagLeaderboards(rankingData, { topN = 10 } = {}) {
  const pool = buildPlotPool(rankingData);
  if (!pool.length) return [];

  return FEATURED_TAGS.map((tag) => {
    const matchSet = new Set(tag.match.map(lower));
    const byCreator = new Map();

    for (const p of pool) {
      const tags = (p.hashtags || []).map(lower);
      if (!tags.some((t) => matchSet.has(t))) continue;
      const handle = p.creatorHandle;
      if (!handle) continue;
      const interaction = p.interactionCount ?? 0;

      let entry = byCreator.get(handle);
      if (!entry) {
        entry = {
          handle,
          nickname: p.creatorNickname || handle,
          imageUrl: p.creatorImageUrl || null,
          score: 0,
          plotCount: 0,
          topPlot: null,
        };
        byCreator.set(handle, entry);
      }
      entry.score += interaction;
      entry.plotCount += 1;
      if (!entry.imageUrl && p.creatorImageUrl) entry.imageUrl = p.creatorImageUrl;
      if (!entry.topPlot || interaction > (entry.topPlot.interactionCount ?? 0)) {
        entry.topPlot = { id: p.id, name: p.name || '', imageUrl: p.imageUrl || null, interactionCount: interaction };
      }
    }

    const creators = [...byCreator.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    return { key: tag.key, label: tag.label, emoji: tag.emoji, accent: tag.accent, match: tag.match, creators };
  }).filter((t) => t.creators.length > 0);
}

/**
 * 히어로 빌보드용 — 모든 태그의 1위 중 태그-누적점수가 가장 큰 제작자.
 * @returns {{handle,nickname,imageUrl,score,topPlot,tagKey,tagLabel,emoji,accent}|null}
 */
export function pickBillboard(leaderboards) {
  let best = null;
  for (const tag of leaderboards) {
    const leader = tag.creators[0];
    if (!leader) continue;
    if (!best || leader.score > best.score) {
      best = { ...leader, tagKey: tag.key, tagLabel: tag.label, emoji: tag.emoji, accent: tag.accent };
    }
  }
  return best;
}

/**
 * get-rankings 응답(top100)을 handle(lowercase) → 티어 정보 맵으로.
 * @param rankings Array<{handle, tier_name, elo_score}>
 */
export function buildTierMap(rankings) {
  const map = new Map();
  if (!Array.isArray(rankings)) return map;
  for (const r of rankings) {
    if (!r?.handle) continue;
    map.set(lower(r.handle), { tierName: r.tier_name, eloScore: r.elo_score ?? 0 });
  }
  return map;
}
