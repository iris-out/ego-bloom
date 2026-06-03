import React, { useEffect, useMemo } from 'react';
import SpotlightHero from './SpotlightHero';
import CharacterRail from './CharacterRail';
import { buildTagCharacterRails, pickSpotlights } from '../../utils/tagCharacters';

function RailSkeleton() {
  return (
    <div>
      <div className="h-4 w-28 rounded bg-white/10 animate-pulse mb-3" />
      <div className="flex gap-5 overflow-hidden pl-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-[124px] h-[176px] sm:w-[148px] sm:h-[208px] rounded-xl bg-white/[0.06] animate-pulse shrink-0" />
        ))}
      </div>
    </div>
  );
}

/**
 * 메인 뷰 — 캐릭터(스토리) 중심. 시네마틱 스포트라이트 + 비슷한 태그를 모은 타이틀별 캐릭터 레일.
 * 카드 클릭 시 해당 캐릭터의 제타 페이지(새 탭)로 이동.
 * props: { rankingData, focusTag }
 */
export default function MainHall({ rankingData, focusTag }) {
  const rails = useMemo(() => buildTagCharacterRails(rankingData), [rankingData]);
  const spotlights = useMemo(() => pickSpotlights(rankingData, rails), [rankingData, rails]);

  // 인기 태그 탭 등에서 점프해온 경우 해당 레일로 스크롤
  useEffect(() => {
    if (!focusTag) return;
    const el = document.getElementById(`rail-${focusTag}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusTag, rails]);

  if (!rankingData) {
    return (
      <div className="flex flex-col gap-7">
        <div className="w-full rounded-2xl bg-white/[0.06] animate-pulse" style={{ aspectRatio: '16 / 5' }} />
        <RailSkeleton />
        <RailSkeleton />
      </div>
    );
  }

  if (!rails.length) {
    return (
      <div className="py-20 text-center text-white/40 text-[14px]">
        랭킹 데이터를 준비 중입니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 sm:gap-9">
      <SpotlightHero spotlights={spotlights} />
      {rails.map((tag) => (
        <CharacterRail key={tag.key} tag={tag} />
      ))}
    </div>
  );
}
