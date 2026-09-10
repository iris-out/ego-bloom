import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { formatEloScore, toKST, getCharacterTier } from '../utils/tierCalculator';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import { computeEarnedTitles } from '../data/badges';
import TierMark from './ui/TierMark';
import RarityTab from './ui/RarityTab';
import CharCard from './ui/CharCard';
import PlayerCard from './ui/PlayerCard';
import Num from './ui/Num';
import { getCreatorTierMeta, formatTierDivision } from '../design/tiers';

const BINDER_SLOT_COUNT = 9;
const TOP_CHAR_PREVIEW_COUNT = 6;
const BADGE_PREVIEW_COUNT = 6;
const TAG_BAR_COUNT = 5;

/** 대화량 내림차순 상위 n개 캐릭터를 뽑는다. */
function topCharactersBy(characters, count) {
  if (!characters?.length) return [];
  return [...characters]
    .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
    .slice(0, count);
}

/** 캐릭터 hashtags/tags 빈도 상위 n개를 [태그, 개수] 쌍으로 반환한다. */
function useTopTags(characters, count) {
  return useMemo(() => {
    const counts = new Map();
    (characters || []).forEach((c) => {
      const tags = (c.hashtags || c.tags || []).filter((t) => t && typeof t === 'string');
      tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
  }, [characters, count]);
}

/** 카드/분석 슬라이드가 공통으로 쓰는 surface-2 위 통계 타일. */
function StatTile({ label, value, unit }) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5"
      style={{ background: 'var(--surface-2)', border: 'var(--border-w) solid var(--line)', borderRadius: 'var(--radius-m)' }}
    >
      <span className="t-small" style={{ color: 'var(--fg-2)' }}>{label}</span>
      <Num value={value} unit={unit} size="h2" />
    </div>
  );
}

function BadgeChips({ badges, limit = BADGE_PREVIEW_COUNT }) {
  if (!badges?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.slice(0, limit).map((b) => (
        <span key={b.id} className="eb-chip inline-flex items-center gap-1.5">
          <span style={{ fontSize: 14 }} aria-hidden="true">{b.emoji}</span>
          {b.title}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// Slide 1: 플레이어 카드 — PlayerCard 앞/뒤 flip
// ============================================================
function CardBack({ characters }) {
  const topChars = useMemo(() => topCharactersBy(characters, TOP_CHAR_PREVIEW_COUNT), [characters]);
  const totalCount = characters?.length ?? 0;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        background: 'var(--surface-2)',
        border: 'var(--border-w) solid var(--line)',
        borderRadius: 'var(--radius-l)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <p className="t-h3">상위 캐릭터</p>
        <p className="t-small" style={{ color: 'var(--fg-3)' }}>
          TOP {topChars.length} / {totalCount}개
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {topChars.length > 0 ? (
          topChars.map((c, idx) => {
            const charTier = getCharacterTier(c.interactionCount || 0);
            return (
              <div
                key={c.id || idx}
                className="eb-row grid items-center gap-2 px-2 py-2"
                style={{ gridTemplateColumns: '20px auto 1fr auto' }}
              >
                <span className="t-figure" style={{ fontSize: 13, color: 'var(--fg-3)', textAlign: 'center' }}>
                  {idx + 1}
                </span>
                <CharCard
                  name={c.name}
                  imageUrl={c.imageUrl ? proxyThumbnailUrl(c.imageUrl, 96) : null}
                  rarity={charTier.key}
                  size="mini"
                />
                <div className="min-w-0">
                  <p className="t-card-name truncate">{c.name || '—'}</p>
                  <p className="t-small truncate" style={{ color: 'var(--fg-2)' }}>
                    대화 {(c.interactionCount || 0).toLocaleString('ko-KR')}
                  </p>
                </div>
                <RarityTab tier={charTier.key} />
              </div>
            );
          })
        ) : (
          <p className="t-small text-center py-8" style={{ color: 'var(--fg-3)' }}>
            캐릭터 정보가 없습니다
          </p>
        )}
      </div>
    </div>
  );
}

function Slide1({ profile, tier, score, stats, activityDays, characters, globalRank }) {
  const [flipped, setFlipped] = useState(false);
  const handleFlip = useCallback((e) => {
    e.stopPropagation();
    setFlipped((v) => !v);
  }, []);

  const charCount = characters?.length ?? stats.plotCount ?? 0;
  const playerStats = [
    { label: '대화', value: stats.plotInteractionCount || 0 },
    { label: '팔로워', value: stats.followerCount || 0 },
    { label: '캐릭터', value: charCount },
  ];

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-6 py-8"
      style={{ background: 'var(--surface)' }}
    >
      {/* 460px 고정 높이는 짧은 화면(390x780 등)에서 카드가 잘리게 했다. clamp 로
          뷰포트에 맞춰 줄어들되 상한은 유지한다. */}
      <div className="relative w-full" style={{ maxWidth: 320, height: 'clamp(320px, 52dvh, 460px)', perspective: 1400 }}>
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            transition: 'transform 300ms ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <PlayerCard
              name={profile.nickname || '—'}
              handle={profile.username}
              avatarUrl={profile.profileImageUrl ? proxyThumbnailUrl(profile.profileImageUrl, 320) : undefined}
              avatarMaxHeight={180}
              tier={tier.key}
              division={tier.subdivision}
              eloRaw={score}
              stats={playerStats}
              rank={globalRank != null && globalRank <= 3 ? globalRank : undefined}
            />
          </div>
          <CardBack characters={characters} />
        </div>
      </div>

      <button type="button" onClick={handleFlip} aria-label="카드 뒤집기" className="eb-btn-icon mt-5">
        <RefreshCw className="w-4 h-4" />
      </button>

      {globalRank != null && (
        <p className="t-small mt-2" style={{ color: 'var(--fg-2)' }}>전체 {globalRank}위</p>
      )}
      {activityDays > 0 && (
        <p className="t-small mt-1" style={{ color: 'var(--fg-3)' }}>제작 {activityDays}일째</p>
      )}
    </div>
  );
}

// ============================================================
// Slide 2: 요약 — 타이포 중심 미니멀
// ============================================================
function Slide2({ profile, tier, score, stats, activityDays, characters }) {
  const meta = getCreatorTierMeta(tier.key);
  const tierLabel = meta ? formatTierDivision(meta, tier.subdivision) : '언랭크';
  const charCount = characters?.length ?? stats.plotCount ?? 0;

  return (
    <div className="w-full h-full overflow-y-auto px-7 py-10 flex flex-col" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center gap-3 mb-9">
        <div
          className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: 'var(--surface-2)', border: 'var(--border-w) solid var(--line)' }}
        >
          {profile.profileImageUrl ? (
            <img
              src={proxyThumbnailUrl(profile.profileImageUrl, 128)}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="t-h3">{(profile.nickname || '?')[0]}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="t-h3 truncate">{profile.nickname || '—'}</p>
          <p className="t-small truncate" style={{ color: 'var(--fg-2)' }}>@{profile.username || 'unknown'}</p>
        </div>
      </div>

      <div className="mb-9">
        <p className="t-label mb-1" style={{ color: 'var(--fg-3)' }}>ELO</p>
        <p className="t-display" style={{ fontSize: 56, lineHeight: '60px' }}>{formatEloScore(score)}</p>
        <div className="mt-2 flex items-center gap-2">
          <TierMark tier={tier.key} division={tier.subdivision} size={24} />
          <span className="t-h3" style={{ color: 'var(--fg-2)' }}>{tierLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="대화" value={stats.plotInteractionCount || 0} />
        <StatTile label="팔로워" value={stats.followerCount || 0} />
        <StatTile label="캐릭터" value={charCount} unit="개" />
      </div>

      {activityDays > 0 && (
        <p className="t-small mt-6" style={{ color: 'var(--fg-3)' }}>제작 {activityDays}일째</p>
      )}
    </div>
  );
}

// ============================================================
// Slide 3: 바인더 페이지 — 상위 캐릭터 3x3 그리드
// ============================================================
function Slide3({ characters }) {
  const topChars = useMemo(() => topCharactersBy(characters, BINDER_SLOT_COUNT), [characters]);
  const slots = useMemo(
    () => Array.from({ length: BINDER_SLOT_COUNT }, (_, i) => topChars[i] || null),
    [topChars],
  );

  return (
    <div className="w-full h-full overflow-y-auto px-5 py-9 flex flex-col" style={{ background: 'var(--surface)' }}>
      <p className="t-h2 mb-1">바인더 페이지</p>
      <p className="t-small mb-5" style={{ color: 'var(--fg-2)' }}>
        대화량 상위 캐릭터 {topChars.length}장
      </p>

      <div className="grid grid-cols-3 gap-2">
        {slots.map((c, i) => {
          if (!c) {
            return (
              <div
                key={`empty-${i}`}
                className="w-full aspect-[3/4]"
                style={{ border: '2px dashed var(--line)', borderRadius: 'var(--radius-m)' }}
              />
            );
          }
          const charTier = getCharacterTier(c.interactionCount || 0);
          return (
            <CharCard
              key={c.id || i}
              name={c.name}
              imageUrl={c.imageUrl ? proxyThumbnailUrl(c.imageUrl, 240) : null}
              rarity={charTier.key}
              count={c.interactionCount}
              countLabel="대화"
              size="grid"
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Slide 4: 분석 — 태그 분포 + 대표 캐릭터 + 활동 요약
// ============================================================
function Slide4({ profile, stats, activityDays, characters, badges }) {
  const tagStats = useTopTags(characters, TAG_BAR_COUNT);
  const maxTagCount = tagStats[0]?.[1] || 1;
  const topChar = useMemo(() => topCharactersBy(characters, 1)[0] || null, [characters]);
  const topCharTier = topChar ? getCharacterTier(topChar.interactionCount || 0) : null;
  const charCount = characters?.length ?? stats.plotCount ?? 0;

  return (
    <div className="w-full h-full overflow-y-auto px-6 py-10 flex flex-col gap-7" style={{ background: 'var(--surface)' }}>
      <p className="t-h2">분석</p>

      <div>
        <p className="t-h3 mb-3" style={{ color: 'var(--fg-2)' }}>자주 쓴 태그</p>
        {tagStats.length > 0 ? (
          <div className="flex flex-col gap-3">
            {tagStats.map(([tag, count]) => (
              <div key={tag}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="t-body">#{tag}</span>
                  <span className="t-small" style={{ color: 'var(--fg-3)' }}>{count}개</span>
                </div>
                <div className="h-2.5" style={{ borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)' }}>
                  <div
                    style={{
                      width: `${Math.max(6, (count / maxTagCount) * 100)}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="t-small" style={{ color: 'var(--fg-3)' }}>태그 정보가 없습니다.</p>
        )}
      </div>

      {topChar && (
        <div>
          <p className="t-h3 mb-3" style={{ color: 'var(--fg-2)' }}>대표 캐릭터</p>
          <div
            className="flex items-center gap-3 px-3 py-2.5"
            style={{ background: 'var(--surface-2)', border: 'var(--border-w) solid var(--line)', borderRadius: 'var(--radius-l)' }}
          >
            <CharCard
              name={topChar.name}
              imageUrl={topChar.imageUrl ? proxyThumbnailUrl(topChar.imageUrl, 96) : null}
              rarity={topCharTier.key}
              size="mini"
            />
            <div className="min-w-0">
              <p className="t-card-name truncate">{topChar.name || '—'}</p>
              <div className="t-figure"><Num value={topChar.interactionCount || 0} unit="대화" /></div>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="t-h3 mb-3" style={{ color: 'var(--fg-2)' }}>활동 요약</p>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="캐릭터" value={charCount} unit="개" />
          <StatTile label="제작" value={activityDays} unit="일째" />
          <StatTile label="칭호" value={badges.length} unit="개" />
        </div>
      </div>

      <BadgeChips badges={badges} />

      <p className="t-small text-center mt-auto" style={{ color: 'var(--fg-3)' }}>
        @{profile.username || 'unknown'}
      </p>
    </div>
  );
}

const SLIDES = [
  { id: 'card', label: '플레이어 카드', component: Slide1 },
  { id: 'summary', label: '요약', component: Slide2 },
  { id: 'binder', label: '바인더 페이지', component: Slide3 },
  { id: 'analytics', label: '분석', component: Slide4 },
];

export default function LiveViewModal({ isOpen, onClose, characters, stats, profile, tier, score, globalRank }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const sliderRef = useRef(null);
  const touchStartX = useRef(null);
  const isScrolling = useRef(false);

  const badges = useMemo(() => {
    if (!characters || !stats) return [];
    return computeEarnedTitles({ characters, stats }).filter((b) => b.earned);
  }, [characters, stats]);

  const activityDays = useMemo(() => {
    if (!characters) return 0;
    const dates = characters
      .map((c) => c.createdAt || c.createdDate)
      .filter(Boolean)
      .map((d) => toKST(d).getTime())
      .filter((t) => !Number.isNaN(t));
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

  // Sync scroll → progress index
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

  return (
    <div className="fixed inset-0 z-[9999]" style={{ background: 'var(--bg)' }}>
      {/* Story frame: full screen on mobile, centered 420-wide frame on desktop */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(420px, 100vw)',
          background: 'var(--surface)',
          borderLeft: 'var(--border-w) solid var(--line)',
          borderRight: 'var(--border-w) solid var(--line)',
        }}
      >
        {/* Progress segments */}
        <div className="absolute top-3 left-3 right-14 z-[10000] flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className="h-1 flex-1"
              style={{ borderRadius: 'var(--radius-pill)', background: i <= currentIdx ? 'var(--accent)' : 'var(--line)' }}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="eb-btn-icon absolute top-2 right-3 z-[10000]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Slider */}
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="flex overflow-x-auto overflow-y-hidden scrollbar-hide w-full h-full"
          style={{ scrollSnapType: 'x mandatory', scrollBehavior: 'auto', overscrollBehavior: 'contain' }}
        >
          {SLIDES.map(({ id, label, component: SlideComponent }) => (
            <div
              key={id}
              className="shrink-0 w-full h-full"
              style={{ scrollSnapAlign: 'center' }}
              onClick={handleTap}
              role="group"
              aria-label={label}
            >
              <SlideComponent {...slideProps} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
