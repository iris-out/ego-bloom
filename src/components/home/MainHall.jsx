import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroBillboard from './HeroBillboard';
import CreatorRail from './CreatorRail';
import { buildTagLeaderboards, pickBillboard, buildTierMap } from '../../utils/hallOfFame';

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
 * 메인 뷰 — 시네마틱 빌보드 + 태그별 TOP 제작자 레일.
 * props: { rankingData, focusTag }
 */
export default function MainHall({ rankingData, focusTag }) {
  const navigate = useNavigate();
  const [tierMap, setTierMap] = useState(() => new Map());

  const leaderboards = useMemo(() => buildTagLeaderboards(rankingData), [rankingData]);
  const billboard = useMemo(() => pickBillboard(leaderboards), [leaderboards]);

  // ELO 티어 뱃지용 — get-rankings(top100) handle→tier 매핑. 실패해도 메인은 정상 렌더.
  useEffect(() => {
    let alive = true;
    fetch('/api/get-rankings')
      .then((r) => r.json())
      .then((data) => { if (alive) setTierMap(buildTierMap(data?.rankings)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 인기 태그 탭 등에서 점프해온 경우 해당 레일로 스크롤
  useEffect(() => {
    if (!focusTag) return;
    const el = document.getElementById(`rail-${focusTag}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusTag, leaderboards]);

  const goCreator = (creator) => {
    if (creator?.handle) navigate(`/profile?creator=${encodeURIComponent(creator.handle)}`);
  };

  if (!rankingData) {
    return (
      <div className="flex flex-col gap-7">
        <div className="w-full rounded-2xl bg-white/[0.06] animate-pulse" style={{ aspectRatio: '16 / 7' }} />
        <RailSkeleton />
        <RailSkeleton />
      </div>
    );
  }

  if (!leaderboards.length) {
    return (
      <div className="py-20 text-center text-white/40 text-[14px]">
        랭킹 데이터를 준비 중입니다.
      </div>
    );
  }

  const billboardTier = billboard ? tierMap.get((billboard.handle || '').toLowerCase()) : null;

  return (
    <div className="flex flex-col gap-7 sm:gap-9">
      <HeroBillboard billboard={billboard} tier={billboardTier} onClick={() => goCreator(billboard)} />
      {leaderboards.map((tag) => (
        <CreatorRail key={tag.key} tag={tag} tierMap={tierMap} onCreatorClick={goCreator} />
      ))}
    </div>
  );
}
