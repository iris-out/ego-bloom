import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
export default function SpotlightHero({ spotlights }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const timerRef = useRef(null);

  const count = spotlights?.length ?? 0;
  const safeIndex = count > 0 ? index % count : 0; // 데이터가 줄어도 항상 유효 범위

  // 자동 회전 — reduced-motion이거나 hover 중이면 멈춤
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timerRef.current);
  }, [reduced, paused, count]);

  if (!count) return null;

  const active = spotlights[safeIndex];
  const accent = active.accent || '#a78bfa';
  const bg = active.imageUrl ? proxyImageUrl(active.imageUrl) : null;
  const href = characterZetaUrl(active.id);

  return (
    <div
      className="relative -mx-4 sm:mx-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block w-full overflow-hidden rounded-b-2xl sm:rounded-2xl border-x-0 border-t-0 border-b sm:border border-white/10 text-left shadow-[0_10px_40px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-white/40 min-h-[248px] sm:min-h-[170px]"
        style={{ aspectRatio: '16 / 5' }}
      >
        {/* 배경 이미지 — key로 크로스페이드 */}
        {bg ? (
          <img
            key={active.id}
            src={bg}
            alt=""
            loading="eager"
            fetchpriority="high"
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-transform duration-700 group-hover:scale-110 motion-reduce:transform-none hero-fade"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(110deg, ${accent}, #2a1a40)` }} />
        )}

        {/* 스크림 */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #07060e 8%, rgba(7,6,14,0.7) 38%, transparent 75%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, #07060e, transparent)' }} />

        {/* 내용 */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-7 max-w-[680px]">
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
      </a>

      {/* 인디케이터 점 */}
      {count > 1 && (
        <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5">
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
      )}
    </div>
  );
}
