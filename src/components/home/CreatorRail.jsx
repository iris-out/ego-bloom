import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RailCreatorCard from './RailCreatorCard';

const COLLAPSED = 6;

/**
 * 한 태그의 가로 스크롤 레일 — 헤더 + 포스터 카드들 + 더보기.
 * props: { tag, tierMap, onCreatorClick }
 *   tag = { key, label, emoji, accent, creators[] }
 */
export default function CreatorRail({ tag, tierMap, onCreatorClick }) {
  const [expanded, setExpanded] = useState(false);
  const scrollerRef = useRef(null);

  const creators = expanded ? tag.creators : tag.creators.slice(0, COLLAPSED);
  const canExpand = tag.creators.length > COLLAPSED;

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
        {/* 데스크탑 스크롤 버튼 */}
        <div className="hidden sm:flex items-center gap-1" style={{ marginLeft: canExpand ? '8px' : 'auto' }}>
          <button type="button" aria-label="왼쪽으로" onClick={() => scrollBy(-1)}
            className="w-6 h-6 rounded-full bg-white/8 hover:bg-white/16 text-white/70 flex items-center justify-center transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button type="button" aria-label="오른쪽으로" onClick={() => scrollBy(1)}
            className="w-6 h-6 rounded-full bg-white/8 hover:bg-white/16 text-white/70 flex items-center justify-center transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 이 레일을 묶은 기준 해시태그 */}
      {tag.match?.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-2 px-0.5 text-[11px] text-white/40">
          <span className="text-white/30">포함 태그</span>
          {tag.match.map((m) => (
            <span key={m} style={{ color: tag.accent, opacity: 0.85 }}>#{m}</span>
          ))}
        </div>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden pb-3 pt-3 pl-2 snap-x snap-mandatory scrollbar-hide"
      >
        {creators.map((creator, i) => (
          <RailCreatorCard
            key={creator.handle || i}
            rank={i + 1}
            accent={tag.accent}
            creator={creator}
            tier={tierMap?.get((creator.handle || '').toLowerCase()) || null}
            onClick={() => onCreatorClick?.(creator)}
          />
        ))}
      </div>
    </section>
  );
}
