import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { proxyImageUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';
import { characterZetaUrl } from '../../utils/tagCharacters';

const ROTATE_MS = 6000;

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
 * 메인 상단 시네마틱 스포트라이트 — 트렌딩 우선 상위 캐릭터들을 가로로 번갈아 보여준다.
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

  // 자동 회전 — reduced-motion이거나 hover 중이면 멈춤
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timerRef.current);
  }, [reduced, paused, count]);

  // 모바일 스와이프 — 가로 드래그로 이전/다음 슬라이드 이동
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

  // 이전/다음 슬라이드 이동 (좌우 화살표 버튼·스와이프 공용)
  const go = (dir) => setIndex((i) => (i + dir + count) % count);

  if (!count) return null;

  const active = spotlights[safeIndex];
  const accent = active.accent || '#a78bfa';
  const bg = active.imageUrl ? proxyImageUrl(active.imageUrl) : null;
  const href = characterZetaUrl(active.id);

  return (
    <div
      className="group relative -mx-4 sm:mx-0 lg:mx-[calc(50%-50vw)] lg:w-screen touch-pan-y select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        draggable={false}
        className="group relative block w-full overflow-hidden aspect-[16/5] lg:aspect-[64/15] rounded-b-2xl sm:rounded-2xl lg:rounded-none border-x-0 border-t-0 border-b sm:border lg:border-x-0 lg:border-t-0 lg:border-b border-white/10 text-left shadow-[0_10px_40px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-white/40 min-h-[248px] sm:min-h-[170px] lg:max-h-[450px]"
      >
        {/* 배경 이미지 — key로 크로스페이드 */}
        {bg ? (
          <img
            key={active.id}
            src={bg}
            alt=""
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-transform duration-700 group-hover:scale-110 motion-reduce:transform-none hero-fade"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(110deg, ${accent}, #2a1a40)` }} />
        )}

        {/* 스크림 */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #07060e 8%, rgba(7,6,14,0.7) 38%, transparent 75%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, #07060e, transparent)' }} />

        {/* 내용 — PC 풀블리드에서는 페이지 그리드(max-w-7xl)에 맞춰 안쪽 정렬 */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-7 lg:px-4 lg:py-9 lg:mx-auto lg:w-full max-w-[680px] lg:max-w-7xl">
         <div className="lg:max-w-[680px]">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] font-extrabold tracking-[0.08em]" style={{ color: accent }}>
            <span aria-hidden="true">{active.emoji}</span>
            <span>{active.tagLabel}</span>
          </div>
          <div className="mt-1.5 text-[26px] sm:text-[40px] font-black text-white leading-[1.05] tracking-[-0.02em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
            {active.name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-white/75">
            <span>
              <b className="text-white tabular-nums">{formatNumber(active.interactionCount)}</b> 누적 대화
            </span>
            {active.creatorNickname && <span className="text-white/40">·</span>}
            {active.creatorNickname && <span className="truncate max-w-[220px]">제작 <b className="font-bold text-white">{active.creatorNickname}</b></span>}
          </div>
          {/* 해시태그 */}
          {active.hashtags?.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {active.hashtags.slice(0, 4).map((h) => (
                <span key={h} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] sm:text-[11px] text-white/70">#{h}</span>
              ))}
            </div>
          )}
          <div className="mt-3.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-3.5 py-1.5 text-[12px] sm:text-[13px] font-bold text-black transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
              제타에서 보기 <ChevronRight size={15} />
            </span>
          </div>
         </div>
        </div>
      </a>

      {/* 좌우 이동 — 가장자리 비네팅 + 은은한 원형 화살표(데스크탑, hover 시 짙어짐) */}
      {count > 1 && (
        <>
          <div className="hidden sm:flex absolute inset-y-0 left-0 z-20 w-20 lg:w-28 items-center justify-start pl-2 lg:pl-4 pointer-events-none">
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
            <button
              type="button" aria-label="이전 배너" onClick={() => go(-1)}
              className="relative pointer-events-auto w-10 h-10 rounded-full bg-black/35 group-hover:bg-black/65 backdrop-blur-sm ring-1 ring-white/15 text-white/70 hover:text-white opacity-60 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <div className="hidden sm:flex absolute inset-y-0 right-0 z-20 w-20 lg:w-28 items-center justify-end pr-2 lg:pr-4 pointer-events-none">
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/20 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
            <button
              type="button" aria-label="다음 배너" onClick={() => go(1)}
              className="relative pointer-events-auto w-10 h-10 rounded-full bg-black/35 group-hover:bg-black/65 backdrop-blur-sm ring-1 ring-white/15 text-white/70 hover:text-white opacity-60 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}

      {/* 인디케이터 점 — PC 풀블리드에서는 페이지 그리드 우측에 맞춤 */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-end px-4 sm:px-7 lg:px-4 lg:mx-auto lg:w-full lg:max-w-7xl pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {spotlights.map((s, i) => (
              <button
                key={s.id || i}
                type="button"
                aria-label={`${i + 1}번째 캐릭터 보기`}
                aria-current={i === safeIndex}
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === safeIndex ? 18 : 6,
                  background: i === safeIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
