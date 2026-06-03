import React, { useRef } from 'react';
import RailCharacterCard from './RailCharacterCard';
import ScrollArrows from '../ui/ScrollArrows';

/**
 * 한 타이틀(비슷한 태그 묶음)의 가로 스크롤 레일 — 헤더 + 캐릭터 포스터 카드들.
 * 항상 전부 펼친 상태로 노출하고 가로 스크롤로 탐색한다(접기/더보기 없음).
 * props: { tag }
 *   tag = { key, label, emoji, accent, match, characters[] }
 */
export default function CharacterRail({ tag }) {
  const scrollerRef = useRef(null);

  const characters = tag.characters;

  return (
    <section id={`rail-${tag.key}`} className="scroll-mt-24">
      <div className="flex items-center gap-2 mb-1 px-0.5">
        <span className="text-[16px]" aria-hidden="true">{tag.emoji}</span>
        <h3 className="text-[15px] sm:text-[16px] font-bold text-white tracking-[-0.01em]">
          {tag.label}
          <span className="ml-1.5 text-[12px] font-semibold" style={{ color: tag.accent }}>TOP</span>
        </h3>
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

      {/* 스크롤 영역 — 스크롤 가능 방향에만 원형 화살표 노출 */}
      <div className="relative">
        <ScrollArrows targetRef={scrollerRef} />

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
