// 메인(태그별 TOP 캐릭터) 집계 유틸 — 순수 함수.
// ranking_latest.json의 trendingPlots/bestPlots/newPlots(플롯=캐릭터별 hashtags+interactionCount)를
// 클라이언트에서 집계해 "비슷한 태그를 모은" 타이틀별 캐릭터 리더보드를 만든다. 백엔드 변경 없음.

// 피처드 태그 정의 — 비슷한 해시태그를 한 타이틀로 묶는다.
// match: 플롯 hashtag(lowercase)가 이 셋과 교집합이면 해당 타이틀로 분류.
export const FEATURED_TAGS = [
  { key: '순애',    label: '순애보인 당신을 위한..',     emoji: '💗', accent: '#f0abfc', match: ['순애'] },
  { key: 'ntr_agg', label: '사랑 파괴자',               emoji: '💔', accent: '#fb7185', match: ['빼앗기', '뺏기', '빼앗김', '불륜', '바람'] },
  { key: 'school',  label: '학교에서 빛나는 당신',      emoji: '🏫', accent: '#7dd3fc', match: ['학교', '학교물', '학원물', '중학교', '중학생', '고등학교', '고등학생', '대학교', '대학생', '학생', '전학생', '캠퍼스', '캠퍼스물', '아카데미', '마법학교', '제타고등학교', '하이틴'] },
  { key: 'unlimit', label: '자유로운, 제한 없는 이야기들', emoji: '🔮', accent: '#a78bfa', hideMatch: true, match: ['언리밋', '언리밋모드'] },
  { key: 'hpj_agg', label: '행복은 다음 생에',          emoji: '🖤', accent: '#94a3b8', match: ['후회', '피폐', '집착'] },
  { key: 'beast',   label: '수상한 당신을 위해',        emoji: '🐾', accent: '#fbbf24', match: ['수인', '퍼리', '케모', '인외', '묘인', '견인', '고양이', '늑대인간', '늑대수인', '토끼수인', '반려수인', '고양이수인', '여우수인', '용인', '드래곤', '짐승인', '수성'] },
  { key: 'bl',      label: '우정인 줄 알았죠?',          emoji: '💙', accent: '#38bdf8', match: ['bl'] },
];

const lower = (s) => (s == null ? '' : String(s).toLowerCase());

// 캐릭터(플롯) 외부 링크 — 제타 캐릭터 프로필.
export function characterZetaUrl(id) {
  return id ? `https://zeta-ai.io/ko/plots/${id}/profile` : null;
}

// 한 캐릭터 레코드를 카드/스포트라이트에서 쓰는 정규화 형태로.
function toCharacter(p) {
  return {
    id: p.id,
    name: p.name || '',
    imageUrl: p.imageUrl || null,
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    interactionCount: p.interactionCount ?? 0,
    rankChange: p.rankChange ?? null,
    creatorHandle: p.creatorHandle || null,
    creatorNickname: p.creatorNickname || p.creatorHandle || null,
    creatorImageUrl: p.creatorImageUrl || null,
  };
}

// 세 랭킹 리스트를 합쳐 plot id 기준 중복 제거(최대 interactionCount 채택).
// trendingRankById: trendingPlots에서의 순위(1-based) — 스포트라이트 트렌딩 우선 정렬용.
function buildPlotPool(rankingData) {
  const byId = new Map();
  const trendingRankById = new Map();

  (rankingData?.trendingPlots || []).forEach((p, i) => {
    if (p?.id != null) trendingRankById.set(p.id, i + 1);
  });

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
  return { pool: [...byId.values()], trendingRankById };
}

/**
 * 타이틀(비슷한 태그 묶음)별 캐릭터 리더보드 생성.
 * @returns Array<{ key,label,emoji,accent,match, characters: Character[] }>
 *   Character = { id,name,imageUrl,hashtags,interactionCount,rankChange,creatorHandle,creatorNickname,creatorImageUrl }
 */
export function buildTagCharacterRails(rankingData, { topN = 16 } = {}) {
  const { pool } = buildPlotPool(rankingData);
  if (!pool.length) return [];

  return FEATURED_TAGS.map((tag) => {
    const matchSet = new Set(tag.match.map(lower));
    const characters = pool
      .filter((p) => p.id && (p.hashtags || []).map(lower).some((t) => matchSet.has(t)))
      .sort((a, b) => (b.interactionCount ?? 0) - (a.interactionCount ?? 0))
      .slice(0, topN)
      .map(toCharacter);

    return { key: tag.key, label: tag.label, emoji: tag.emoji, accent: tag.accent, match: tag.match, characters };
  }).filter((t) => t.characters.length > 0);
}

/**
 * 히어로 스포트라이트용 — 트렌딩 우선으로 상위 캐릭터를 고른다.
 * trendingPlots 순위가 있는 캐릭터를 먼저, 그다음 interactionCount.
 * 각 캐릭터에 소속 타이틀(태그) 메타를 붙여 반환.
 * @returns Array<Character & { tagKey, tagLabel, emoji, accent }> (최대 count개)
 */
export function pickSpotlights(rankingData, rails, { count = 5 } = {}) {
  const { trendingRankById } = buildPlotPool(rankingData);

  // id → 소속 타이틀(첫 매칭) 메타 + 레일에 포함된 캐릭터(중복 제거)
  const tagById = new Map();
  const seen = new Map();
  for (const rail of rails) {
    for (const c of rail.characters) {
      if (!tagById.has(c.id)) {
        tagById.set(c.id, { tagKey: rail.key, tagLabel: rail.label, emoji: rail.emoji, accent: rail.accent });
      }
      if (!seen.has(c.id)) seen.set(c.id, c);
    }
  }

  const TREND_FLOOR = 9999;
  return [...seen.values()]
    .sort((a, b) => {
      const ta = trendingRankById.get(a.id) ?? TREND_FLOOR;
      const tb = trendingRankById.get(b.id) ?? TREND_FLOOR;
      if (ta !== tb) return ta - tb; // 트렌딩 순위 우선(작을수록 상위)
      return (b.interactionCount ?? 0) - (a.interactionCount ?? 0);
    })
    .slice(0, count)
    .map((c) => ({ ...c, ...(tagById.get(c.id) || {}) }));
}
