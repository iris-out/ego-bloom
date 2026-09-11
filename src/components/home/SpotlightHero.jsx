import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CharCard from '../ui/CharCard';
import Delta from '../ui/Delta';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber, getCharacterTier } from '../../utils/tierCalculator';
import { characterZetaUrl } from '../../utils/tagCharacters';

const ROTATE_MS = 8000;
const PILL_HEIGHT = 24; // px — 태그 pill 한 줄 높이. 오버레이 max-height = PILL_HEIGHT*2 + gap(6) 로 2줄까지만 보인다

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

/**
 * 스포트라이트 캐러셀 점 인디케이터 — 비활성은 10px 원, 활성은 44x10 pill 트랙에
 * accent 색 fill 이 회전 주기(ROTATE_MS) 동안 scaleX(0→1) 로 차오른다.
 * fill 요소를 activeIndex 로 key 를 걸어 슬라이드가 바뀔 때마다 애니메이션을 재시작한다.
 * 각 점은 28px 히트 영역을 가진 버튼(키보드 포커스 가능).
 */
function SpotlightDots({ count, activeIndex, onSelect, paused, className = '', style }) {
  return (
    <div className={`flex items-center ${className}`} style={{ gap: 10, ...style }}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`${i + 1}번째 카드`}
            aria-current={isActive || undefined}
            className="flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28 }}
          >
            {isActive ? (
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: 44,
                  height: 10,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--line)',
                  overflow: 'hidden',
                }}
              >
                <span
                  key={`fill-${activeIndex}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--accent)',
                    transformOrigin: 'left',
                    animation: `eb-spotlight-fill ${ROTATE_MS}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'var(--line)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 히어로 카드 이미지 하단 비네팅 + 매칭 태그 pill 오버레이.
 * 텍스트가 라이트 테마에서도 읽히도록 스크림을 항상 어둡게 깐다(테마 무관 고정값).
 */
function HeroImageOverlay({ tags }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, transparent 45%, rgb(0 0 0 / .72) 100%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 100%, transparent 42%, rgb(0 0 0 / .22) 100%)' }}
      />
      {tags.length > 0 && (
        <div
          className="absolute flex flex-wrap content-end overflow-hidden"
          style={{ left: 12, right: 12, bottom: 12, gap: 6, maxHeight: PILL_HEIGHT * 2 + 6 }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              className="shrink-0 whitespace-nowrap"
              style={{
                height: PILL_HEIGHT,
                lineHeight: `${PILL_HEIGHT}px`,
                padding: '0 9px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgb(255 255 255 / .16)',
                border: '1px solid rgb(255 255 255 / .28)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
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

  // 자동 회전 — reduced-motion이거나 hover/focus 중이면 멈춤.
  // index 를 의존성에 넣어 수동 점 클릭 시에도 타이머와 점 fill 애니메이션이 같이 재시작되게 한다.
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    timerRef.current = setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearTimeout(timerRef.current);
  }, [reduced, paused, count, index]);

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
  const overlayTags = (active.hashtags ?? []).filter(Boolean).slice(0, 6);

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
      {/* 데스크톱은 named-areas 그리드로 카드/정보/점을 배치한다: 카드는 두 행을 모두 차지하고,
          점은 정보 패널의 버튼 바로 아래(같은 열, 다음 행)에 좌측 정렬로 붙는다.
          모바일은 단일 열로 카드 → 점 → 정보 순서를 그대로 쌓는다. */}
      <div
        className={`grid gap-x-8 gap-y-6 grid-cols-1 [grid-template-areas:'card'_'dots'_'info']
          sm:grid-cols-[auto_1fr] sm:grid-rows-[auto_1fr] sm:gap-y-4
          sm:[grid-template-areas:'card_info'_'card_dots']`}
      >
        {/* 히어로 카드 — CharCard 의 size="hero" 가 자체 반응형 치수(모바일 200x280, sm 280x392)를 갖는다.
            key 를 safeIndex 에 걸어 카드가 바뀔 때마다 리마운트시키고, eb-crossfade 애니메이션으로
            200ms 페이드인한다. from/to 애니메이션이라 대기 상태는 항상 opacity: 1 로 안착한다. */}
        <div
          key={`card-${safeIndex}`}
          className="shrink-0 justify-self-center sm:justify-self-start eb-crossfade motion-reduce:animate-none"
          style={{ gridArea: 'card' }}
        >
          <CharCard
            name={active.name}
            imageUrl={poster}
            rarity={rarity}
            rank={safeIndex + 1}
            showRarity={false}
            hideInfo
            overlay={<HeroImageOverlay tags={overlayTags} />}
            size="hero"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            priority={safeIndex === 0}
          />
        </div>

        {/* 정보 패널 */}
        <div
          key={`info-${safeIndex}`}
          className="w-full min-w-0 flex flex-col gap-3 eb-crossfade motion-reduce:animate-none"
          style={{ gridArea: 'info' }}
        >
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

          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            <StatPanel label="누적 대화">
              {formatNumber(active.interactionCount ?? 0)}
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
        </div>

        {/* 캐러셀 점 — 모바일은 카드와 정보 사이(중앙 정렬), 데스크톱은 버튼 바로 아래(좌측 정렬) 그리드 영역에 배치 */}
        {count > 1 && (
          <SpotlightDots
            count={count}
            activeIndex={safeIndex}
            onSelect={setIndex}
            paused={reduced || paused}
            className="justify-center self-start sm:justify-start"
            style={{ gridArea: 'dots' }}
          />
        )}
      </div>
    </div>
  );
}
