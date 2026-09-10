import React, { useEffect, useMemo } from 'react';
import SpotlightHero from './SpotlightHero';
import CharacterRail from './CharacterRail';
import { buildTagCharacterRails, pickSpotlights } from '../../utils/tagCharacters';

function RailSkeleton() {
  return (
    <div className="eb-skel">
      <div className="eb-bone h-5 w-28 mb-3" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="eb-bone w-32 h-[180px] sm:w-[152px] sm:h-[212px] shrink-0" />
        ))}
      </div>
    </div>
  );
}

/**
 * 메인 뷰 — 캐릭터(카드) 중심. "오늘의 카드" 스포트라이트 + 비슷한 태그를 모은 타이틀별 캐릭터 레일.
 * 카드 클릭 시 해당 캐릭터의 제타 페이지(새 탭)로 이동.
 * props: { rankingData, focusTag }
 */
export default function MainHall({ rankingData, focusTag }) {
  const rails = useMemo(() => buildTagCharacterRails(rankingData), [rankingData]);
  const spotlights = useMemo(() => pickSpotlights(rankingData, rails, { count: 4 }), [rankingData, rails]);

  // 인기 태그 탭 등에서 점프해온 경우 해당 레일로 스크롤
  useEffect(() => {
    if (!focusTag) return;
    const el = document.getElementById(`rail-${focusTag}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusTag, rails]);

  if (!rankingData) {
    return (
      <div className="flex flex-col gap-8 sm:gap-9">
        <div className="eb-skel eb-bone w-full" style={{ aspectRatio: '16 / 7' }} />
        <RailSkeleton />
        <RailSkeleton />
      </div>
    );
  }

  if (!rails.length) {
    return (
      <div className="py-20 text-center t-body" style={{ color: 'var(--fg-3)' }}>
        랭킹 데이터를 준비 중입니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-9">
      <SpotlightHero spotlights={spotlights} />
      {rails.map((tag) => (
        <CharacterRail key={tag.key} tag={tag} />
      ))}
    </div>
  );
}
