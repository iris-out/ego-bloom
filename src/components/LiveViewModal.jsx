import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { X, ChevronDown, RefreshCw } from 'lucide-react';
import { formatCompactNumber, toKST, getCharacterTier } from '../utils/tierCalculator';
import { proxyImageUrl } from '../utils/imageUtils';
import { computeEarnedTitles } from '../data/badges';
import TierIcon from './ui/TierIcon';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

const TIER_COLORS_MAP = {
  bronze: '#C58356',
  silver: '#9CA3AF',
  gold: '#FBBF24',
  platinum: '#E2E8F0',
  diamond: '#3B82F6',
  master: '#D946EF',
  champion: '#F97316',
  unranked: '#718096',
};

// ============================================================
// 공통: 세로 스크롤 감지 훅
// ============================================================
function useScrollIndicator(ref) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 4;
      const notAtBottom = el.scrollTop < el.scrollHeight - el.clientHeight - 16;
      setShow(canScroll && notAtBottom);
    };

    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [ref]);

  return show;
}

// ============================================================
// 공통: 스크롤 힌트 오버레이 (슬라이드 wrapper에 absolute)
// ============================================================
function ScrollDownHint({ show, light = false }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none flex flex-col items-center justify-end pb-3 transition-opacity duration-300"
      style={{
        height: 72,
        opacity: show ? 1 : 0,
        background: light
          ? 'linear-gradient(to top, rgba(241,245,249,0.6) 30%, transparent)'
          : 'linear-gradient(to top, rgba(0,0,0,0.45) 30%, transparent)',
      }}
    >
      <div
        className="flex flex-col items-center gap-0.5"
        style={{ animation: show ? 'scrollBounce 1.4s ease-in-out infinite' : 'none' }}
      >
        <ChevronDown
          className="w-5 h-5"
          style={{ color: light ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.5)' }}
        />
        <span
          className="text-[9px] font-medium tracking-widest uppercase"
          style={{ color: light ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.35)' }}
        >
          스크롤
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Slide 1: Ivory Planetarium — 밤하늘 + 프로필 카드 (앞/뒷면 flip)
// ============================================================
const IVORY = '#f5ecd9';
const IVORY_DIM = 'rgba(245,236,217,0.55)';
const IVORY_LINE = 'rgba(245,236,217,0.28)';
const IVORY_DOT = 'rgba(245,236,217,0.2)';

// 마일스톤 카테고리별 우선순위 (높은 등급 → 낮은 등급). 첫번째 earned 를 선택.
const MILESTONE_PRIORITY = {
  interaction:      ['100m_total', '10m', '1m', '100k', '10k', '1k'],
  char_interaction: ['100m_zeta', 'char_10m', 'platinum', 'char_500k', 'char_100k', 'char_10k'],
  follower:         ['superstar', 'follower_5k', 'follower_1k', 'follower_100'],
  creation:         ['factory', 'fertile', 'streak_14', 'streak_7', 'streak_3', 'daily_6', 'daily_4', 'daily_2'],
};
const TAG_PRIORITY = ['sunae', 'ntr'];

function StarField() {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            'radial-gradient(0.7px 0.7px at 5% 7%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(0.7px 0.7px at 12% 22%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(1px 1px at 22% 12%, #fff, transparent)',
            'radial-gradient(0.7px 0.7px at 31% 38%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.7px 0.7px at 40% 8%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(1.2px 1.2px at 48% 58%, #fff, transparent)',
            'radial-gradient(0.7px 0.7px at 57% 16%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.7px 0.7px at 66% 44%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(0.9px 0.9px at 74% 24%, #fff, transparent)',
            'radial-gradient(0.7px 0.7px at 83% 68%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.7px 0.7px at 91% 14%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(0.8px 0.8px at 97% 45%, #fff, transparent)',
            'radial-gradient(0.7px 0.7px at 8% 55%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.7px 0.7px at 17% 72%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(1px 1px at 27% 85%, #fff, transparent)',
            'radial-gradient(0.7px 0.7px at 36% 92%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.9px 0.9px at 45% 78%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(0.7px 0.7px at 55% 88%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.7px 0.7px at 63% 95%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(1.1px 1.1px at 72% 80%, #fff, transparent)',
            'radial-gradient(0.7px 0.7px at 80% 90%, rgba(255,255,255,0.85), transparent)',
            'radial-gradient(0.8px 0.8px at 88% 78%, rgba(255,255,255,0.9), transparent)',
            'radial-gradient(0.7px 0.7px at 95% 94%, rgba(255,255,255,0.85), transparent)',
          ].join(', '),
          opacity: 0.85,
        }}
      />
      {[
        { top: '11%', left: '16%' },
        { top: '26%', right: '20%' },
        { top: '62%', left: '8%' },
        { bottom: '16%', right: '13%' },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            ...pos,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 6px #fff, 0 0 14px rgba(255,255,255,0.35)',
          }}
        />
      ))}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 55% 32% at 28% 80%, rgba(90,78,140,0.22), transparent),' +
            'radial-gradient(ellipse 42% 28% at 76% 22%, rgba(78,95,140,0.2), transparent)',
        }}
      />
    </>
  );
}

function StatRow({ label, value, unit }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(245,236,217,0.6)', flexShrink: 0, letterSpacing: '-0.01em' }}>
        {label}
      </span>
      <span
        style={{
          flex: 1,
          borderBottom: `1px dotted ${IVORY_DOT}`,
          height: 0,
          alignSelf: 'flex-end',
          marginBottom: 9,
        }}
      />
      <span
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 13, fontWeight: 600, color: IVORY_DIM, marginLeft: 3, letterSpacing: 0 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function BadgePill({ badge }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'rgba(245,236,217,0.06)',
        border: '1px solid rgba(245,236,217,0.2)',
        fontSize: 11.5,
        fontWeight: 600,
        color: IVORY,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}
    >
      <span style={{ fontSize: 13 }}>{badge.emoji}</span>
      <span>{badge.title}</span>
    </div>
  );
}

function BadgeRow({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: 'rgba(245,236,217,0.4)',
          flexShrink: 0,
          width: 38,
          textAlign: 'right',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {items.map((b) => (
          <BadgePill key={b.id} badge={b} />
        ))}
      </div>
    </div>
  );
}

function CardFront({ profile, tier, stats, activityDays, characters, badges, globalRank, todayKST, onFlip }) {
  const tierName = (tier.name || 'UNRANKED').toUpperCase();
  const tierSub = ROMAN[tier.subdivision] || '';
  const charCount = characters?.length ?? stats.plotCount ?? 0;

  const milestones = useMemo(() => {
    const byId = Object.fromEntries((badges || []).map((b) => [b.id, b]));
    return Object.values(MILESTONE_PRIORITY)
      .map((ids) => ids.find((id) => byId[id]))
      .filter(Boolean)
      .map((id) => byId[id]);
  }, [badges]);

  const tagBadges = useMemo(() => {
    const earnedTags = (badges || []).filter((b) => b.category === 'tag');
    const byId = Object.fromEntries(earnedTags.map((b) => [b.id, b]));
    const pinned = TAG_PRIORITY.map((id) => byId[id]).filter(Boolean);
    const rest = earnedTags.filter((b) => !TAG_PRIORITY.includes(b.id));
    return [...pinned, ...rest].slice(0, 4);
  }, [badges]);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        padding: '52px 22px 56px',
        color: IVORY,
        fontFamily: "'SUIT Variable', 'SUIT', 'Pretendard', system-ui, sans-serif",
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {/* 프로필 + 이름 */}
      <div className="flex items-start gap-3.5 mb-[18px]">
        <div className="relative shrink-0" style={{ width: 62, height: 62 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background:
                'conic-gradient(from 140deg, #f5ecd9 0deg, rgba(245,236,217,0.15) 90deg, #e8d28a 180deg, rgba(245,236,217,0.15) 270deg, #f5ecd9 360deg)',
              padding: 1.5,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2d2a3f, #4a4563)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: IVORY,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)',
              }}
            >
              {profile.profileImageUrl ? (
                <img
                  src={proxyImageUrl(profile.profileImageUrl)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                (profile.nickname || '?')[0]
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0" style={{ paddingTop: 4 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              color: IVORY,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {profile.nickname || '—'}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: IVORY_DIM }}>
            @{profile.username || 'unknown'}
          </div>
        </div>
      </div>

      {/* 티어 존 */}
      <div
        className="flex items-center justify-center"
        style={{
          marginBottom: 14,
          padding: '12px 0 10px',
          borderTop: `1px solid ${IVORY_LINE}`,
          borderBottom: `1px solid ${IVORY_LINE}`,
          gap: 12,
        }}
      >
        <div style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.3))', flexShrink: 0 }}>
          <TierIcon tier={tier.key} size={40} />
        </div>
        <div className="flex flex-col" style={{ gap: 3 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'rgba(245,236,217,0.45)' }}>
            현재 티어
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', color: IVORY }}>
            {tierName}
            {tierSub && (
              <span style={{ fontWeight: 600, color: 'rgba(245,236,217,0.7)', marginLeft: 4 }}>{tierSub}</span>
            )}
          </div>
        </div>
        {globalRank != null && (
          <>
            <div style={{ width: 1, height: 34, background: 'rgba(245,236,217,0.2)', margin: '0 2px' }} />
            <div className="flex flex-col" style={{ gap: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(245,236,217,0.45)', letterSpacing: '0.04em' }}>
                <span style={{ letterSpacing: '0.22em' }}>순위</span>
                <span style={{ marginLeft: 5, fontSize: 9, color: 'rgba(245,236,217,0.35)', letterSpacing: '0.05em' }}>
                  (에고블룸 기준)
                </span>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: IVORY,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(245,236,217,0.6)', marginRight: 2 }}>#</span>
                {globalRank}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 업적 — 마일스톤 + 태그 */}
      {(milestones.length > 0 || tagBadges.length > 0) && (
        <div className="flex flex-col" style={{ gap: 7, marginBottom: 10 }}>
          <BadgeRow label="MILE" items={milestones} />
          <BadgeRow label="TAG" items={tagBadges} />
        </div>
      )}

      {/* 스탯 — 강조 */}
      <div className="flex flex-col mt-auto" style={{ gap: 14 }}>
        <StatRow label="대화량" value={formatCompactNumber(stats.plotInteractionCount)} />
        <StatRow label="팔로워" value={formatCompactNumber(stats.followerCount)} />
        <StatRow label="캐릭터" value={formatCompactNumber(charCount)} unit="개" />
        <StatRow label="제작" value={formatCompactNumber(activityDays)} unit="일째" />
      </div>

      {/* 푸터 — 좌측 브랜드만, 우측은 flip 버튼 공간 */}
      <div
        className="flex items-center"
        style={{
          marginTop: 14,
          paddingTop: 10,
          paddingRight: 52,
          borderTop: `1px dashed rgba(245,236,217,0.18)`,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: 'rgba(245,236,217,0.4)',
        }}
      >
        <span>EGO · BLOOM</span>
        <span style={{ marginLeft: 10, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em', opacity: 0.7 }}>
          {todayKST}
        </span>
      </div>

      <FlipButton onClick={onFlip} ariaLabel="뒤집어서 상위 캐릭터 보기" />
    </div>
  );
}

function CardBack({ profile, characters, todayKST, onFlip }) {
  const topChars = useMemo(() => {
    if (!characters?.length) return [];
    return [...characters]
      .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
      .slice(0, 10);
  }, [characters]);

  const totalCount = characters?.length ?? 0;
  const nowMs = useMemo(() => toKST().getTime(), []);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        padding: '44px 18px 56px',
        color: IVORY,
        fontFamily: "'SUIT Variable', 'SUIT', 'Pretendard', system-ui, sans-serif",
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-baseline justify-between" style={{ marginBottom: 10, paddingInline: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: IVORY }}>
          상위 캐릭터
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(245,236,217,0.5)',
            letterSpacing: '0.1em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          TOP {topChars.length} · 총 {totalCount}개
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        {topChars.length > 0 ? (
          topChars.map((c, idx) => {
            const charTier = getCharacterTier(c.interactionCount || 0);
            const isTop3 = idx < 3;
            const tags = (c.hashtags || c.tags || []).filter((t) => t && typeof t === 'string');
            const topTags = tags.slice(0, 2);
            const raw = c.createdAt || c.createdDate;
            let daysAgo = null;
            if (raw) {
              const created = toKST(raw).getTime();
              if (!Number.isNaN(created)) {
                daysAgo = Math.max(0, Math.floor((nowMs - created) / 86400000));
              }
            }

            return (
              <div
                key={c.id || idx}
                className="grid items-center"
                style={{
                  gridTemplateColumns: '20px 38px 1fr auto',
                  gap: 10,
                  padding: '9px 4px',
                  borderBottom:
                    idx < topChars.length - 1 ? '1px dotted rgba(245,236,217,0.12)' : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: isTop3 ? 13 : 12,
                    fontWeight: 800,
                    color: isTop3 ? IVORY : 'rgba(245,236,217,0.5)',
                    textAlign: 'center',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {idx + 1}
                </span>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: 'linear-gradient(135deg, #2b3250, #4a5280)',
                    border: '1px solid rgba(245,236,217,0.15)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'rgba(245,236,217,0.85)',
                  }}
                >
                  {c.imageUrl ? (
                    <img
                      src={proxyImageUrl(c.imageUrl)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (c.name || '?')[0]
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: IVORY,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.15,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.name || '—'}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10.5,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <span
                      style={{
                        color: 'rgba(245,236,217,0.55)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      대화 {formatCompactNumber(c.interactionCount || 0)}
                    </span>
                    {topTags.length > 0 ? (
                      <>
                        <span style={{ color: 'rgba(245,236,217,0.3)', margin: '0 6px' }}>·</span>
                        {topTags.map((t, i) => (
                          <span key={t + i}>
                            {i > 0 && <span style={{ color: 'rgba(148,193,255,0.4)', margin: '0 4px' }}>·</span>}
                            <span style={{ color: '#a9c7ff', fontWeight: 600 }}>#{t}</span>
                          </span>
                        ))}
                      </>
                    ) : daysAgo !== null ? (
                      <>
                        <span style={{ color: 'rgba(245,236,217,0.3)', margin: '0 6px' }}>·</span>
                        <span style={{ color: 'rgba(245,236,217,0.55)', fontVariantNumeric: 'tabular-nums' }}>
                          {daysAgo}일 전 제작
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 5,
                    border: '1px solid rgba(245,236,217,0.28)',
                    background: 'rgba(245,236,217,0.06)',
                    color: IVORY,
                    letterSpacing: '0.04em',
                  }}
                >
                  {charTier.name}
                </span>
              </div>
            );
          })
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ padding: '40px 0', fontSize: 13, color: 'rgba(245,236,217,0.4)' }}
          >
            캐릭터 정보가 없습니다
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div
        className="flex justify-between items-center mt-auto"
        style={{
          paddingTop: 10,
          borderTop: `1px dashed rgba(245,236,217,0.18)`,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: 'rgba(245,236,217,0.4)',
        }}
      >
        <span>@{profile.username || 'unknown'}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em' }}>{todayKST}</span>
      </div>

      <FlipButton onClick={onFlip} ariaLabel="앞면으로 돌아가기" />
    </div>
  );
}

function FlipButton({ onClick, ariaLabel }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'rgba(245,236,217,0.06)',
        border: '1px solid rgba(245,236,217,0.22)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(245,236,217,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(245,236,217,0.06)';
      }}
    >
      <RefreshCw size={14} style={{ color: IVORY }} />
    </button>
  );
}

function Slide1({ profile, tier, stats, activityDays, characters, badges, globalRank, vh }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const todayKST = useMemo(() => {
    const d = toKST();
    return `${d.getFullYear()} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const handleFlip = useCallback(() => setIsFlipped((v) => !v), []);

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{ height: vh, background: '#040814', perspective: '1800px' }}
    >
      <StarField />

      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          transition: 'transform 0.7s cubic-bezier(0.4,0,0.2,1)',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}
      >
        <CardFront
          profile={profile}
          tier={tier}
          stats={stats}
          activityDays={activityDays}
          characters={characters}
          badges={badges}
          globalRank={globalRank}
          todayKST={todayKST}
          onFlip={handleFlip}
        />
        <CardBack
          profile={profile}
          characters={characters}
          todayKST={todayKST}
          onFlip={handleFlip}
        />
      </div>
    </div>
  );
}

// ============================================================
// Slide 2: 블랙 미니멀 — 타이포 중심
// ============================================================
function Slide2({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  const scrollRef = useRef(null);
  const showHint = useScrollIndicator(scrollRef);

  return (
    <div className="w-full relative overflow-hidden bg-[#050505]" style={{ height: vh }}>
      <div
        ref={scrollRef}
        className="w-full h-full flex flex-col pt-14 pb-10 px-8 overflow-y-auto scrollbar-hide"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
            {profile.profileImageUrl ? (
              <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-black text-black">{(profile.nickname || '?')[0]}</span>
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{profile.nickname}</h1>
            <p className="text-xs text-gray-500 font-mono">@{profile.username}</p>
          </div>
        </div>

        {/* Big number */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="mb-6">
            <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.3em] mb-2 border-l border-white/20 pl-3">총 대화수</p>
            <h2 className="text-[76px] font-black leading-none tracking-tighter text-white">
              {formatCompactNumber(stats.plotInteractionCount)
                .replace(/([억만천])$/, '')}
              <span className="text-gray-600 text-[60px]">
                {formatCompactNumber(stats.plotInteractionCount).match(/[억만천]$/)?.[0] || ''}
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.3em] mb-2 border-l border-white/20 pl-3">팔로워</p>
              <h3 className="text-4xl font-black tracking-tight text-white">
                {formatCompactNumber(stats.followerCount).replace(/([억만천])$/, '')}
                <span className="text-gray-600">{formatCompactNumber(stats.followerCount).match(/[억만천]$/)?.[0] || ''}</span>
              </h3>
            </div>
            <div>
              <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.3em] mb-2 border-l border-white/20 pl-3">캐릭터</p>
              <h3 className="text-4xl font-black tracking-tight text-white">{characters?.length ?? stats.plotCount ?? 0}</h3>
            </div>
          </div>

          {/* Tier + badges */}
          <div className="border-t border-white/10 pt-6 pb-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                  <TierIcon tier={tier.key} size={16} />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-white">
                  {tier.name} {ROMAN[tier.subdivision] || ''}
                </span>
              </div>
              {activityDays > 0 && <span className="text-[10px] text-gray-500">제작 {activityDays}일째</span>}
            </div>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badges.map(b => (
                  <span key={b.id} className="text-[10px] font-mono border border-white/20 px-2 py-1 rounded-sm text-gray-300">
                    {b.emoji} {b.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[8px] text-white/10 tracking-widest mt-2">EGO-BLOOM</p>
      </div>

      <ScrollDownHint show={showHint} />
    </div>
  );
}

// ============================================================
// Slide 3: EGO-BLOOM 푸른 톤 관찰 보고서
// ============================================================
function Slide3({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  const scrollRef = useRef(null);
  const showHint = useScrollIndicator(scrollRef);

  const badgeText = badges.length > 0
    ? `[${badges.map(b => b.title).join(', ')}] 칭호를 획득한 이력으로 보아 평범한 인물은 아닙니다.`
    : `아직 눈에 띄는 칭호는 없으나 잠재력이 엿보입니다.`;

  const topCharacters = characters?.slice(0, 2).map(c => c.name).join(', ') || '알 수 없는 자아들';
  const charCount = characters?.length ?? stats.plotCount ?? 0;

  return (
    <div
      className="w-full relative overflow-hidden bg-slate-100"
      style={{ height: vh, fontFamily: "'Inter', sans-serif" }}
    >
      <div
        ref={scrollRef}
        className="w-full h-full overflow-y-auto scrollbar-hide"
      >
        {/* Block Acid -> Blue 100 */}
        <section className="bg-blue-100 text-blue-950 p-6 relative min-h-[45vh] flex flex-col overflow-hidden shrink-0">
          <header className="flex justify-between items-center relative z-10 mb-8">
            <div className="font-medium tracking-tight">EGO-BLOOM</div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest cursor-pointer">
              <div className="flex flex-col gap-1.5">
                <span className="block h-[2px] w-6 bg-blue-950"></span>
                <span className="block h-[2px] w-4 bg-blue-950"></span>
              </div>
              REPORT
            </div>
          </header>

          {/* 배경에 깔리는 거대한 프로필 이미지 워터마크 */}
          <div className="absolute top-1/4 -left-16 w-80 h-80 rounded-full overflow-hidden opacity-10 pointer-events-none transform -rotate-12 border-[16px] border-blue-950/20 mix-blend-multiply">
            {profile.profileImageUrl ? (
              <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-200 flex items-center justify-center text-9xl font-black text-blue-950">
                {(profile.nickname || '?')[0]}
              </div>
            )}
          </div>

          <div className="relative z-10 mt-auto pb-4 flex flex-col gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-950 shadow-sm shrink-0 bg-white">
              {profile.profileImageUrl ? (
                <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-200 flex items-center justify-center text-3xl font-black text-blue-950">
                  {(profile.nickname || '?')[0]}
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold mb-1 block text-blue-800">
                Subject #{profile.username || 'UNKNOWN'}
              </span>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight">
                {profile.nickname}
              </h1>
            </div>
          </div>
        </section>

        {/* Block Taupe -> Blue 800 */}
        <section className="bg-blue-800 text-white p-8 relative shrink-0">
          <p className="text-[17px] leading-relaxed font-medium mb-6 tracking-tight">
            해당 크리에이터({profile.nickname})는 엄청난 창작 에너지를 발산 중입니다. {activityDays > 0 ? `${activityDays}일째 활동하며 ` : ''}{topCharacters} 등 총 {charCount}개의 새로운 자아를 세상에 투영했습니다.
          </p>
          <p className="text-sm leading-relaxed text-white/80 mb-10 max-w-[90%]">
            조사 결과, {badgeText} 현재까지 <strong>{formatCompactNumber(stats.plotInteractionCount)}번의 대화</strong>를 통해 자신의 우주를 확장하고 있으며, 앞으로의 관찰이 강력히 요구됩니다.
          </p>

          <div className="flex justify-between items-end mb-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-white/70 mb-1">활동 기간</span>
              <span className="text-4xl font-bold leading-none tracking-tighter">{activityDays} DAYS</span>
            </div>
          </div>

          {/* Action Square */}
          <div className="absolute bottom-0 right-0 w-24 h-16 bg-blue-950 flex justify-center items-center cursor-pointer hover:bg-blue-900 transition-colors">
            <div className="flex gap-1 text-blue-100">
               <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M4 2v20l17-10z"></path></svg>
               <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M4 2v20l17-10z"></path></svg>
            </div>
          </div>
        </section>

        {/* Block Mauve -> Slate 100 */}
        <section className="bg-slate-100 text-blue-950 pt-10 pb-8 flex flex-col shrink-0 min-h-[30vh]">
          <div className="px-6 mb-8">
            <h2 className="text-2xl font-medium leading-tight tracking-tight max-w-[80%]">
              Ego Data Metrics
            </h2>
          </div>

          <div className="bg-slate-200 p-6 border-y border-blue-950/10">
            <div className="grid grid-cols-3 divide-x divide-blue-950/20">
              <div className="flex flex-col px-2 pl-0">
                <span className="text-[10px] font-medium mb-2">총 대화량</span>
                <span className="text-2xl font-semibold tracking-tight">{formatCompactNumber(stats.plotInteractionCount)}</span>
              </div>
              <div className="flex flex-col px-2">
                <span className="text-[10px] font-medium mb-2">팔로워</span>
                <span className="text-2xl font-semibold tracking-tight">{formatCompactNumber(stats.followerCount)}</span>
              </div>
              <div className="flex flex-col px-2 pr-0 text-right">
                <span className="text-[10px] font-medium mb-2">캐릭터 수</span>
                <span className="text-2xl font-semibold tracking-tight">{charCount}</span>
              </div>
            </div>
          </div>

          <div className="p-6 pt-10 flex justify-between items-end">
            <span className="text-[10px] uppercase tracking-widest font-bold text-blue-950">System Diagnostics</span>
            <div className="text-right text-lg leading-tight text-blue-950/60 font-medium">
              Status<br/>Level<br/>Achieved
            </div>
          </div>

          <div className="px-6 mt-2 pb-6">
            <span className="text-[10px] uppercase tracking-widest font-bold text-blue-950 mb-2 block">CURRENT TIER</span>
            <h3 className="text-5xl font-bold tracking-tighter leading-none flex items-center gap-3">
              <div className="text-blue-600">
                <TierIcon tier={tier.key} size={42} />
              </div>
              <div>
                {tier.name} <span className="text-2xl text-blue-950/50">{ROMAN[tier.subdivision] || ''}</span>
              </div>
            </h3>
          </div>
        </section>
      </div>

      <ScrollDownHint show={showHint} light />
    </div>
  );
}

// ============================================================
// Slide 4: 다크 애널리틱스 — 데이터 대시보드
// ============================================================
function Slide4({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  const tierColor = TIER_COLORS_MAP[tier.key] || TIER_COLORS_MAP.unranked;
  const scrollRef = useRef(null);
  const showHint = useScrollIndicator(scrollRef);
  const r = 45;

  return (
    <div className="w-full relative overflow-hidden bg-[#0a0c10] text-gray-100" style={{ height: vh }}>
      <div
        ref={scrollRef}
        className="w-full h-full flex flex-col pt-14 pb-10 px-4 overflow-y-auto scrollbar-hide"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5 px-2">
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Creator Overview
          </h2>
          <span className="text-[10px] font-medium bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">Live Data</span>
        </div>

        {/* Profile + creation time */}
        <div
          className="rounded-2xl p-4 mb-4 flex items-center justify-between"
          style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden p-[2px]" style={{ background: 'linear-gradient(135deg, #4A7FFF, #6366f1)' }}>
              <div className="w-full h-full rounded-full bg-[#13161f] flex items-center justify-center overflow-hidden">
                {profile.profileImageUrl ? (
                  <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="font-bold text-lg text-white">{(profile.nickname || '?')[0]}</span>
                )}
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-sm text-white leading-tight">{profile.nickname}</h1>
              <p className="text-[11px] text-gray-400">@{profile.username}</p>
            </div>
          </div>
          {activityDays > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Creation Time</div>
              <div className="text-xs font-semibold text-white bg-white/5 px-2 py-1 rounded border border-white/5">제작 {activityDays}일째</div>
            </div>
          )}
        </div>

        {/* Tier + followers/chars */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Circular tier */}
          <div
            className="rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden"
            style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="absolute inset-0 bg-blue-500/5" />
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2433" strokeWidth="8" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <TierIcon tier={tier.key} size={20} />
                <span className="text-[8px] font-bold text-white uppercase mt-1">{tier.name}</span>
                <span className="text-[7px] text-gray-400">{ROMAN[tier.subdivision] || ''}</span>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 font-medium">Rank Status</div>
          </div>

          {/* Followers + chars */}
          <div className="flex flex-col gap-3">
            <div
              className="rounded-2xl p-4 flex-1 flex flex-col justify-center relative overflow-hidden"
              style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="text-[10px] text-gray-400 font-medium mb-1">Followers</div>
              <div className="text-2xl font-bold text-white">{formatCompactNumber(stats.followerCount)}</div>
            </div>
            <div
              className="rounded-2xl p-4 flex-1 flex flex-col justify-center"
              style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="text-[10px] text-gray-400 font-medium mb-1">Characters</div>
              <div className="text-2xl font-bold text-white">{characters?.length ?? stats.plotCount ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Total conversations */}
        <div
          className="rounded-2xl p-4 mb-3"
          style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Total Conversations</div>
            <div className="text-lg font-bold text-white">{formatCompactNumber(stats.plotInteractionCount)}</div>
          </div>
          {/* Decorative chart line */}
          <div className="w-full h-10 relative">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="chartGrad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 30 L0 15 Q 10 5, 20 12 T 40 20 T 60 10 T 80 18 T 100 5 L100 30 Z" fill="url(#chartGrad4)" />
              <path d="M0 15 Q 10 5, 20 12 T 40 20 T 60 10 T 80 18 T 100 5" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
              <circle cx="100" cy="5" r="3" fill="#ec4899" stroke="#13161f" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Milestones / badges */}
        {badges.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-2"
            style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-3">Key Milestones</div>
            <div className="grid grid-cols-2 gap-2">
              {badges.slice(0, 4).map(b => (
                <div key={b.id} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[12px]">{b.emoji}</div>
                  <span className="text-[10px] font-medium text-gray-200 truncate">{b.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[8px] text-white/10 tracking-widest mt-auto pt-4">EGO-BLOOM</p>
      </div>

      <ScrollDownHint show={showHint} />
    </div>
  );
}

const SLIDES = [
  { id: 'showcase', component: Slide1 },
  { id: 'minimal', component: Slide2 },
  { id: 'cyberpunk', component: Slide3 },
  { id: 'analytics', component: Slide4 },
];

export default function LiveViewModal({ isOpen, onClose, characters, stats, profile, tier, score, globalRank }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const sliderRef = useRef(null);
  const touchStartX = useRef(null);
  const isScrolling = useRef(false);

  const badges = useMemo(() => {
    if (!characters || !stats) return [];
    return computeEarnedTitles({ characters, stats }).filter(b => b.earned);
  }, [characters, stats]);

  const activityDays = useMemo(() => {
    if (!characters) return 0;
    const dates = characters
      .map(c => c.createdAt || c.createdDate)
      .filter(Boolean)
      .map(d => toKST(d).getTime())
      .filter(t => !isNaN(t));
    if (dates.length === 0) return 0;
    return Math.floor((toKST().getTime() - Math.min(...dates)) / 86400000);
  }, [characters]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Sync scroll → dot index
  const handleScroll = useCallback(() => {
    if (!sliderRef.current || isScrolling.current) return;
    const el = sliderRef.current;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentIdx(idx);
  }, []);

  // Navigate by index
  const goTo = useCallback((idx) => {
    if (!sliderRef.current) return;
    isScrolling.current = true;
    sliderRef.current.scrollTo({ left: idx * sliderRef.current.clientWidth, behavior: 'smooth' });
    setCurrentIdx(idx);
    setTimeout(() => { isScrolling.current = false; }, 400);
  }, []);

  // Tap zones: left half = prev, right half = next
  const handleTap = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      goTo(Math.max(0, currentIdx - 1));
    } else {
      goTo(Math.min(SLIDES.length - 1, currentIdx + 1));
    }
  }, [currentIdx, goTo]);

  // Touch swipe
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleWheel = useCallback((e) => { e.stopPropagation(); }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) goTo(Math.min(SLIDES.length - 1, currentIdx + 1));
      else goTo(Math.max(0, currentIdx - 1));
    }
    touchStartX.current = null;
  }, [currentIdx, goTo]);

  if (!isOpen) return null;

  const slideProps = {
    profile: profile || {},
    tier: tier || {},
    score: score || 0,
    stats: stats || {},
    badges,
    activityDays,
    characters: characters || [],
    globalRank: globalRank ?? null,
  };

  const VH = '100vh';

  return (
    <div
      className="fixed z-[9999] bg-black"
      style={{ top: 0, left: 0, width: '100vw', height: VH }}
    >
      {/* Story-style wrapper: full screen on mobile, full-height 9:16 centered on desktop */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: 0,
          height: VH,
          left: '50%',
          transform: 'translateX(-50%)',
          width: `min(calc(${VH} * 9 / 16), 100vw)`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[10000] w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Dot indicators */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 pointer-events-none">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: 48,
                background: i === currentIdx ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>

        {/* Slider */}
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="flex overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{ width: '100%', height: VH, scrollSnapType: 'x mandatory', scrollBehavior: 'auto', overscrollBehavior: 'contain' }}
        >
          {SLIDES.map(({ id, component: SlideComponent }) => (
            <div
              key={id}
              className="shrink-0"
              style={{ width: '100%', height: VH, scrollSnapAlign: 'center' }}
              onClick={handleTap}
            >
              <SlideComponent {...slideProps} vh={VH} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
