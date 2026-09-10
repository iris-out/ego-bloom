import React, { useState, useMemo } from 'react';
import Segmented from '../ui/Segmented';
import Delta from '../ui/Delta';
import Sparkline from '../ui/Sparkline';
import Num from '../ui/Num';

// 카테고리 / 카드 키 + 라벨은 TagBubbleSection 과 동일하게 유지한다.
const CATEGORIES = [
  {
    key: 'romance',
    label: '로맨스 / 감정',
    cards: [
      { key: '순애',      label: '순애',        subLabel: '순수 로맨스' },
      { key: 'bl',        label: 'BL',          subLabel: 'Boys Love' },
      { key: 'gl',        label: 'GL',          subLabel: 'Girls Love' },
      { key: 'ntr_agg',   label: 'NTR계열',     subLabel: '빼앗김 · 불륜 계열' },
      { key: 'hpj_agg',   label: '후/피/집',    subLabel: '후회 · 피폐 · 집착' },
      { key: 'harem_agg', label: '하렘/역하렘', subLabel: '하렘 · 역하렘' },
      { key: '혐관',      label: '혐관',        subLabel: '혐오 관계물' },
      { key: '능글',      label: '능글',        subLabel: '능글맞은 상대' },
      { key: '소꿉친구',  label: '소꿉친구',    subLabel: '소꿉친구 설정' },
      { key: '배신',      label: '배신',        subLabel: '배신 서사' },
      { key: '오지콤',    label: '오지콤',      subLabel: '오지랖 콤플렉스' },
      { key: '짝사랑',    label: '짝사랑',      subLabel: '짝사랑 설정' },
    ],
  },
  {
    key: 'genre',
    label: '세계관 / 장르',
    cards: [
      { key: 'fantasy_agg', label: '판타지계열',       subLabel: '판타지 · 현대판타지' },
      { key: 'isekai_agg',  label: '이세계/전생/회귀', subLabel: '이세계 · 전생 · 회귀 · 빙의' },
      { key: '무협',         label: '무협',             subLabel: '무협 · 무가' },
      { key: 'sf',           label: 'SF',               subLabel: 'SF · 사이버펑크' },
      { key: 'thriller_agg', label: '스릴러/공포',      subLabel: '스릴러 · 공포' },
      { key: '학원',          label: '학원',             subLabel: '학원물' },
      { key: '현대',          label: '현대',             subLabel: '현대 배경' },
      { key: '수인',          label: '수인',             subLabel: '수인 캐릭터' },
    ],
  },
  {
    key: 'setting',
    label: '설정 / 상황',
    cards: [
      { key: '재벌',     label: '재벌',     subLabel: '재벌 · 부잣집' },
      { key: '연예계',   label: '연예계',   subLabel: '아이돌 · 배우' },
      { key: '게임',     label: '게임',     subLabel: '게임 · 가상현실' },
      { key: '일상',     label: '일상',     subLabel: '일상 · 힐링' },
      { key: '대학생',   label: '대학생',   subLabel: '대학교 배경' },
      { key: '일진',     label: '일진',     subLabel: '일진 · 학교폭력' },
      { key: '조직',     label: '조직',     subLabel: '조직 · 마피아' },
      { key: '정략결혼', label: '정략결혼', subLabel: '정략결혼 설정' },
    ],
  },
];

function TagCard({ card, score, delta, trendPoints, onTagClick }) {
  const sparkValues = useMemo(
    () => (trendPoints || []).map((p) => (typeof p?.score === 'number' ? p.score : null)).filter((v) => v != null),
    [trendPoints]
  );

  return (
    <button
      type="button"
      onClick={() => onTagClick?.(card.key)}
      className="eb-tile flex flex-col gap-2 text-left transition-transform duration-[120ms] ease-out hover:-translate-y-0.5 motion-reduce:transform-none"
    >
      <div className="min-w-0">
        <h2 className="t-h2 truncate">{card.label}</h2>
        <p className="t-small truncate" style={{ color: 'var(--fg-3)' }}>{card.subLabel}</p>
      </div>

      <div className="flex items-baseline gap-1.5">
        <Num value={score} size="h1" />
        <span className="t-small" style={{ color: 'var(--fg-3)' }}>pt</span>
      </div>

      <Delta value={delta} />

      {sparkValues.length >= 2 && (
        <Sparkline values={sparkValues} className="w-full h-7 sm:h-9" />
      )}
    </button>
  );
}

/**
 * 인기 태그 화면 — 카테고리 세그먼트 + 태그 트렌드 타일 그리드.
 * 카드 클릭 시 메인 탭의 해당 태그 레일로 점프(onTagClick).
 * props: { tagScores, tagScoresDelta, tagTrend, onTagClick, activeTabOverride }
 */
export default function TagTrendCards({
  tagScores = null,
  tagScoresDelta = null,
  tagTrend = null,
  onTagClick = null,
  activeTabOverride = null,
}) {
  // 사용자가 직접 선택한 카테고리. null 이면 override / 기본값을 따른다.
  const [userCategory, setUserCategory] = useState(null);

  // activeTabOverride(카테고리 키 또는 카드 키)를 카테고리 키로 정규화
  const overrideCategory = useMemo(() => {
    if (!activeTabOverride) return null;
    if (CATEGORIES.some((c) => c.key === activeTabOverride)) return activeTabOverride;
    const owner = CATEGORIES.find((c) => c.cards.some((card) => card.key === activeTabOverride));
    return owner ? owner.key : null;
  }, [activeTabOverride]);

  const activeCategory = userCategory ?? overrideCategory ?? 'romance';
  const current = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  // 점수 있는 카드만, 점수 내림차순 정렬
  const visibleCards = useMemo(() => {
    if (!tagScores) return [];
    return current.cards
      .map((card) => ({ card, score: tagScores[card.key] ?? 0 }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [current, tagScores]);

  if (!tagScores) return null;

  const segOptions = CATEGORIES.map((c) => ({ value: c.key, label: c.label }));

  return (
    <section className="flex flex-col gap-4" aria-label="인기 태그">
      <Segmented options={segOptions} value={activeCategory} onChange={setUserCategory} className="w-fit" />

      {visibleCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visibleCards.map(({ card, score }) => (
            <TagCard
              key={card.key}
              card={card}
              score={score}
              delta={tagScoresDelta?.[card.key] ?? null}
              trendPoints={tagTrend?.[card.key] ?? null}
              onTagClick={onTagClick}
            />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center t-body" style={{ color: 'var(--fg-3)' }}>표시할 태그 데이터가 없습니다.</p>
      )}
    </section>
  );
}
