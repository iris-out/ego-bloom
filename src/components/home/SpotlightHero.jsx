import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CharCard from '../ui/CharCard';
import Delta from '../ui/Delta';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber, getCharacterTier } from '../../utils/tierCalculator';
import { characterZetaUrl } from '../../utils/tagCharacters';

const ROTATE_MS = 8000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return reduced;
}

function StatPanel({ label, children }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-center min-w-0"
      style={{ background: 'var(--surface)', border: 'var(--border-w) solid var(--line)', borderRadius: 'var(--radius-m)' }}
    >
      <div className="t-figure leading-none" style={{ fontSize: 24 }}>
        {children}
      </div>
      <div className="t-small truncate" style={{ color: 'var(--fg-3)' }}>{label}</div>
    </div>
  );
}

/**
 * 메인 상단 "오늘의 카드" 스포트라이트 — 트렌딩 우선 상위 캐릭터를 히어로 카드로 번갈아 보여준다.
 * 카드/CTA는 제타 캐릭터 페이지로 향하는 외부 링크(새 탭).
 * props: { spotlights: Array<Character & {tagKey,tagLabel,emoji,accent}> }
 */
const SWIPE_THRESHOLD = 40; // px — 이보다 크게 가로로 끌면 슬라이드 전환으로 간주

export default function SpotlightHero({ spotlights }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const timerRef = useRef(null);
  const touchStartRef = useRef(null); // { x, y }
  const swipedRef = useRef(false);    // 스와이프 직후 링크 내비게이션 차단용

  const count = spotlights?.length ?? 0;
  const safeIndex = count > 0 ? index % count : 0; // 데이터가 줄어도 항상 유효 범위

  // 자동 회전 — reduced-motion이거나 hover/focus 중이면 멈춤
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timerRef.current);
  }, [reduced, paused, count]);

  // 모바일 스와이프 — 가로 드래그로 이전/다음 카드 이동
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
    setPaused(true);
  };
  const handleTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setPaused(false);
    if (!start || count <= 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 가로 이동이 충분하고 세로 스크롤보다 우세할 때만 전환
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true; // 곧바로 발생할 click(링크 이동) 차단
      const dir = dx < 0 ? 1 : -1; // 왼쪽으로 밀면 다음
      setIndex((i) => (i + dir + count) % count);
    }
  };
  const handleClick = (e) => {
    if (swipedRef.current) {
      e.preventDefault(); // 스와이프 제스처는 링크로 처리하지 않음
      swipedRef.current = false;
    }
  };

  if (!count) return null;

  const active = spotlights[safeIndex];
  const href = characterZetaUrl(active.id);
  const poster = active.imageUrl ? proxyThumbnailUrl(active.imageUrl, 560) : null;
  const rarity = getCharacterTier(active.interactionCount ?? 0).key;
  const kicker = active.hashtags?.[0] || active.tagKey || null;

  return (
    <div
      className="select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {/* 히어로 카드 — CharCard 의 size="hero" 가 자체 반응형 치수(모바일 200x280, sm 280x392)를 갖는다.
            key 를 safeIndex 에 걸어 카드가 바뀔 때마다 리마운트시키고, eb-crossfade 애니메이션으로
            200ms 페이드인한다. from/to 애니메이션이라 대기 상태는 항상 opacity: 1 로 안착한다. */}
        <div key={`card-${safeIndex}`} className="shrink-0 mx-auto sm:mx-0 eb-crossfade motion-reduce:animate-none">
          <CharCard
            name={active.name}
            imageUrl={poster}
            rarity={rarity}
            rank={safeIndex + 1}
            count={active.interactionCount}
            countLabel="대화"
            creator={active.creatorNickname}
            size="hero"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            priority={safeIndex === 0}
          />
        </div>

        {/* 정보 패널 */}
        <div key={`info-${safeIndex}`} className="w-full sm:flex-1 min-w-0 flex flex-col gap-3 eb-crossfade motion-reduce:animate-none">
          {kicker && <span className="eb-chip w-fit" style={{ color: 'var(--accent-ink)' }}>#{kicker}</span>}

          <h2 className="t-display truncate">{active.name}</h2>

          {active.creatorNickname && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--surface-2)' }}>
                {active.creatorImageUrl ? (
                  <img
                    src={proxyThumbnailUrl(active.creatorImageUrl, 48)}
                    alt=""
                    width={24}
                    height={24}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : null}
              </span>
              <h3 className="t-h3 truncate">{active.creatorNickname}</h3>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:max-w-md">
            <StatPanel label="누적 대화">
              {formatNumber(active.interactionCount ?? 0)}
            </StatPanel>
            <StatPanel label="매칭 태그">
              {active.hashtags?.length ?? 0}
              <span style={{ fontSize: '0.62em', fontWeight: 600, color: 'var(--fg-2)' }}>개</span>
            </StatPanel>
            <StatPanel label="순위 변동">
              {active.rankChange ? <Delta value={active.rankChange} format={(n) => `${n}위`} /> : <span style={{ color: 'var(--fg-3)' }}>-</span>}
            </StatPanel>
          </div>

          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className="eb-btn eb-btn-primary w-fit"
            >
              제타에서 보기
              <ChevronRight size={16} />
            </a>
          )}

          {count > 1 && (
            <div className="flex flex-col gap-2 mt-1">
              <span className="t-small" style={{ color: 'var(--fg-3)' }}>다른 카드</span>
              <div className="flex items-center gap-2.5">
                {spotlights.map((s, i) => {
                  const sRarity = getCharacterTier(s.interactionCount ?? 0).key;
                  const sPoster = s.imageUrl ? proxyThumbnailUrl(s.imageUrl, 120) : null;
                  const isActive = i === safeIndex;
                  return (
                    <div
                      key={s.id || i}
                      style={isActive ? { outline: '2px solid var(--accent-ink)', outlineOffset: 2, borderRadius: 'var(--radius-m)' } : undefined}
                    >
                      <CharCard
                        name={s.name}
                        imageUrl={sPoster}
                        rarity={sRarity}
                        size="mini"
                        onClick={() => setIndex(i)}
                        className="cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
