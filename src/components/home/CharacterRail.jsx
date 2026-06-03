import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RailCharacterCard from './RailCharacterCard';

const COLLAPSED = 8;

// 모바일(<640px) 여부 — 모바일에선 접기/더보기 없이 전부 펼쳐 가로 스크롤.
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 639px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setMobile(mq.matches);
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return mobile;
}

/**
 * 한 타이틀(비슷한 태그 묶음)의 가로 스크롤 레일 — 헤더 + 캐릭터 포스터 카드들 + 더보기.
 * props: { tag }
 *   tag = { key, label, emoji, accent, match, characters[] }
 */
export default function CharacterRail({ tag }) {
  const [expanded, setExpanded] = useState(false);
  const scrollerRef = useRef(null);
  const isMobile = useIsMobile();

  // 모바일은 항상 전부 노출(가로 스크롤). 데스크탑만 접기/더보기.
  const showAll = isMobile || expanded;
  const characters = showAll ? tag.characters : tag.characters.slice(0, COLLAPSED);
  const canExpand = !isMobile && tag.characters.length > COLLAPSED;

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' });
  };

  return (
    <section id={`rail-${tag.key}`} className="scroll-mt-24">
      <div className="flex items-center gap-2 mb-1 px-0.5">
        <span className="text-[16px]" aria-hidden="true">{tag.emoji}</span>
        <h3 className="text-[15px] sm:text-[16px] font-bold text-white tracking-[-0.01em]">
          {tag.label}
          <span className="ml-1.5 text-[12px] font-semibold" style={{ color: tag.accent }}>TOP</span>
        </h3>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-[12px] font-medium text-white/45 hover:text-white/80 transition-colors"
          >
            {expanded ? '접기' : '더보기'}
          </button>
        )}
      </div>

      {/* 이 레일을 묶은 기준 해시태그 */}
      {tag.match?.length > 0 && !tag.hideMatch && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-2 px-0.5 text-[11px] text-white/40">
          <span className="text-white/30">포함 태그</span>
          {tag.match.map((m) => (
            <span key={m} style={{ color: tag.accent, opacity: 0.85 }}>#{m}</span>
          ))}
        </div>
      )}

      {/* 스크롤 영역 — 좌우 비네팅 화살표(데스크탑, hover 시 노출) */}
      <div className="group relative">
        {/* 왼쪽: 비네팅 + < 버튼 */}
        <div className="hidden sm:flex absolute inset-y-0 left-0 z-30 w-16 items-center justify-start pl-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none motion-reduce:transition-none">
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <button
            type="button" aria-label="왼쪽으로" onClick={() => scrollBy(-1)}
            className="relative pointer-events-none group-hover:pointer-events-auto w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm ring-1 ring-white/15 text-white/90 hover:bg-black/80 hover:text-white flex items-center justify-center transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* 오른쪽: 비네팅 + > 버튼 */}
        <div className="hidden sm:flex absolute inset-y-0 right-0 z-30 w-16 items-center justify-end pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none motion-reduce:transition-none">
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/30 to-transparent" />
          <button
            type="button" aria-label="오른쪽으로" onClick={() => scrollBy(1)}
            className="relative pointer-events-none group-hover:pointer-events-auto w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm ring-1 ring-white/15 text-white/90 hover:bg-black/80 hover:text-white flex items-center justify-center transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden pb-3 pt-3 pl-2 snap-x snap-mandatory scrollbar-hide"
        >
          {characters.map((character, i) => (
            <RailCharacterCard
              key={character.id || i}
              rank={i + 1}
              accent={tag.accent}
              character={character}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
