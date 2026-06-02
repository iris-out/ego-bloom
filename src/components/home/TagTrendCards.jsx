import React, { useState, useMemo } from 'react';
import { formatNumber } from '../../utils/tierCalculator';

// 카테고리 / 패밀리 키 + 라벨은 TagBubbleSection 과 동일하게 유지한다.
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

// 패밀리별 강조 색상 — 카테고리 톤을 따른다 (로맨스=로즈, 장르=인디고, 설정=앰버 계열)
const ACCENT = '#e11d48';
const FAMILY_ACCENT = {
  // 로맨스 / 감정
  순애: { color: '#f472b6', emoji: '💗' },
  bl: { color: '#60a5fa', emoji: '💙' },
  gl: { color: '#f9a8d4', emoji: '🌸' },
  ntr_agg: { color: '#fb7185', emoji: '🔥' },
  hpj_agg: { color: '#c084fc', emoji: '🥀' },
  harem_agg: { color: '#fbbf24', emoji: '👑' },
  혐관: { color: '#f87171', emoji: '⚔️' },
  능글: { color: '#fcd34d', emoji: '😏' },
  소꿉친구: { color: '#7dd3fc', emoji: '🧒' },
  배신: { color: '#fca5a5', emoji: '🗡️' },
  오지콤: { color: '#a5b4fc', emoji: '🌀' },
  짝사랑: { color: '#f9a8d4', emoji: '💌' },
  // 세계관 / 장르
  fantasy_agg: { color: '#818cf8', emoji: '✨' },
  isekai_agg: { color: '#a78bfa', emoji: '🌌' },
  무협: { color: '#fbbf24', emoji: '🥋' },
  sf: { color: '#22d3ee', emoji: '🛸' },
  thriller_agg: { color: '#f87171', emoji: '🔪' },
  학원: { color: '#5eead4', emoji: '🎓' },
  현대: { color: '#93c5fd', emoji: '🏙️' },
  수인: { color: '#fbbf24', emoji: '🐾' },
  // 설정 / 상황
  재벌: { color: '#fbbf24', emoji: '💎' },
  연예계: { color: '#f472b6', emoji: '🎤' },
  게임: { color: '#34d399', emoji: '🎮' },
  일상: { color: '#86efac', emoji: '☕' },
  대학생: { color: '#7dd3fc', emoji: '📚' },
  일진: { color: '#f87171', emoji: '💢' },
  조직: { color: '#9ca3af', emoji: '🕴️' },
  정략결혼: { color: '#fbbf24', emoji: '💍' },
};

const UP_COLOR = '#4ade80';
const DOWN_COLOR = '#f87171';
const NEUTRAL_COLOR = '#9ca3af';

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 32;

function getAccent(key) {
  return FAMILY_ACCENT[key] || { color: ACCENT, emoji: '🏷️' };
}

// tagTrend[key] 시계열을 폴리라인 좌표로 정규화
function buildSparkline(points) {
  const scores = (points || [])
    .map((p) => (typeof p?.score === 'number' ? p.score : null))
    .filter((s) => s != null);
  if (scores.length < 2) return null;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const stepX = SPARK_WIDTH / (scores.length - 1);
  const padY = 3;
  const usableH = SPARK_HEIGHT - padY * 2;

  return scores
    .map((s, i) => {
      const x = i * stepX;
      const y = padY + (1 - (s - min) / range) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function DeltaBadge({ delta, score }) {
  if (delta == null || delta === 0) {
    return <span className="text-[11px] font-semibold tabular-nums" style={{ color: NEUTRAL_COLOR }}>— 변동 없음</span>;
  }
  const isUp = delta > 0;
  const color = isUp ? UP_COLOR : DOWN_COLOR;
  const arrow = isUp ? '▲' : '▼';
  const abs = Math.abs(delta);
  const base = score != null && score - delta > 0 ? score - delta : null;
  const pct = base ? `${((abs / base) * 100).toFixed(1)}%` : null;
  return (
    <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
      {arrow} {formatNumber(abs)}
      {pct && <span className="ml-1 font-semibold opacity-80">({pct})</span>}
    </span>
  );
}

function TagCard({ card, score, delta, trendPoints, onTagClick }) {
  const accent = getAccent(card.key);
  const sparkPoints = useMemo(() => buildSparkline(trendPoints), [trendPoints]);

  return (
    <button
      type="button"
      onClick={() => onTagClick?.(card.key)}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-left transition-transform duration-200 ease-out will-change-transform hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e11d48]/60"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent.color}14 0%, rgba(255,255,255,0.03) 55%)`,
      }}
    >
      {/* 라벨 행 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span aria-hidden className="text-[14px] leading-none">{accent.emoji}</span>
        <span className="truncate text-[13px] font-bold text-white/90">{card.label}</span>
      </div>
      <span className="truncate text-[10px] text-white/35 -mt-1">{card.subLabel}</span>

      {/* 점수 */}
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: accent.color }}>
          {formatNumber(score)}
        </span>
        <span className="text-[10px] font-semibold text-white/40">pt</span>
      </div>

      {/* 변동 */}
      <DeltaBadge delta={delta} score={score} />

      {/* 스파크라인 */}
      {sparkPoints && (
        <svg
          className="mt-0.5 w-full"
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          height={SPARK_HEIGHT}
          preserveAspectRatio="none"
          aria-hidden
        >
          <polyline
            points={sparkPoints}
            fill="none"
            stroke={accent.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
      )}
    </button>
  );
}

export default function TagTrendCards({
  tagScores = null,
  tagScoresDelta = null,
  tagTrend = null,
  onTagClick = null,
  activeTabOverride = null,
}) {
  // 사용자가 직접 선택한 카테고리. null 이면 override / 기본값을 따른다.
  const [userCategory, setUserCategory] = useState(null);

  // activeTabOverride(카테고리 키 또는 패밀리 키)를 카테고리 키로 정규화
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

  return (
    <section className="flex flex-col gap-3" aria-label="인기 태그">
      {/* 카테고리 칩 */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = cat.key === activeCategory;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setUserCategory(cat.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-white/10 text-white/70 hover:bg-white/[0.16] hover:text-white/90'
              }`}
              style={isActive ? { backgroundColor: ACCENT } : undefined}
              aria-pressed={isActive}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 카드 그리드 */}
      {visibleCards.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
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
        <p className="py-6 text-center text-[12px] text-white/35">표시할 태그 데이터가 없습니다.</p>
      )}
    </section>
  );
}
