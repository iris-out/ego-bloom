import React, { useRef } from 'react';
import RailCharacterCard from './RailCharacterCard';
import ScrollArrows from '../ui/ScrollArrows';

/**
 * 한 타이틀(비슷한 태그 묶음)의 바인더 슬리브 레일 — 헤더 + 캐릭터 카드들.
 * 항상 전부 펼친 상태로 노출하고 가로 스크롤로 탐색한다(접기/더보기 없음).
 * props: { tag }
 *   tag = { key, label, match, characters[] }
 */
export default function CharacterRail({ tag }) {
  const scrollerRef = useRef(null);
  const characters = tag.characters;

  return (
    <section id={`rail-${tag.key}`} className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3 px-0.5">
        <h2 className="t-h2 truncate">{tag.label}</h2>
        <span className="eb-chip shrink-0">{characters.length}장</span>
        {tag.match?.length > 0 && !tag.hideMatch && (
          <div className="flex flex-wrap items-center gap-x-1.5 t-small" style={{ color: 'var(--fg-3)' }}>
            {tag.match.map((m) => (
              <span key={m}>#{m}</span>
            ))}
          </div>
        )}
      </div>

      {/* 스크롤 영역 — 스크롤 가능 방향에만 호버 가능 포인터에서 원형 화살표 노출 */}
      <div className="relative">
        <ScrollArrows targetRef={scrollerRef} />

        <div ref={scrollerRef} className="eb-scroll-x pb-3 pt-1 pl-0.5">
          {characters.map((character, i) => (
            <RailCharacterCard key={character.id || i} rank={i + 1} character={character} />
          ))}
        </div>
      </div>
    </section>
  );
}
