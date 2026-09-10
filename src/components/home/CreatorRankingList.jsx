import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { getCreatorTier, formatEloScore } from '../../utils/tierCalculator';
import { getCreatorTierMeta, formatTierDivision } from '../../design/tiers';
import { useCreatorRankings } from '../../hooks/useCreatorRankings';
import { useIsPC } from '../../hooks/useMediaQuery';
import PlayerCard from '../ui/PlayerCard';
import TierMark from '../ui/TierMark';
import Num from '../ui/Num';

const PAGE_SIZE = 20;
const TOTAL_PAGES = 5;

function getTierKey(tierName = '') {
  const t = tierName.toUpperCase();
  if (t.startsWith('CHAMPION')) return 'champion';
  if (t.startsWith('MASTER')) return 'master';
  if (t.startsWith('DIAMOND')) return 'diamond';
  if (t.startsWith('PLATINUM')) return 'platinum';
  if (t.startsWith('GOLD')) return 'gold';
  if (t.startsWith('SILVER')) return 'silver';
  if (t.startsWith('BRONZE')) return 'bronze';
  return 'unranked';
}

// 서버가 내려주는 tier_name(등급) 과 elo_score(세분화) 를 합쳐 TierMark/PlayerCard 에 필요한
// 메타를 한 번에 만든다. 랭킹 행 / 시상대 공용.
function deriveTierMeta(creator) {
  const tierKey = getTierKey(creator.tier_name);
  const division = getCreatorTier(creator.elo_score ?? 0).subdivision;
  const meta = getCreatorTierMeta(tierKey);
  return { tierKey: tierKey === 'unranked' ? undefined : tierKey, division, label: formatTierDivision(meta, division) };
}

function creatorStats(creator) {
  return [
    { label: '대화', value: creator.plot_interaction_count ?? 0 },
    { label: '팔로워', value: creator.follower_count ?? 0 },
  ];
}

// ── 일반 랭킹 행 (rank 4+ 또는 후속 페이지 전체) ──────────────
function CreatorRow({ creator, globalRank, onClick }) {
  const meta = deriveTierMeta(creator);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!creator.handle}
      className="eb-row flex w-full items-center gap-3 px-3 text-left"
      style={{ height: 56, borderBottom: '1px solid var(--line)' }}
    >
      <span
        className="shrink-0 text-right tabular-nums"
        style={{ width: 32, fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--fg-2)' }}
      >
        {globalRank + 1}
      </span>

      <div className="shrink-0 rounded-full overflow-hidden" style={{ width: 36, height: 36, background: 'var(--surface-2)' }}>
        {creator.profile_image_url && (
          <img
            src={proxyThumbnailUrl(creator.profile_image_url, 64)}
            alt=""
            width={36}
            height={36}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="t-body truncate" style={{ color: 'var(--fg)' }}>{creator.nickname}</p>
        <p className="t-small truncate" style={{ color: 'var(--fg-2)' }}>@{creator.handle}</p>
      </div>

      <div className="hidden sm:flex shrink-0 items-center gap-1.5">
        <TierMark tier={meta.tierKey} division={meta.division} size={24} />
        <span className="t-small whitespace-nowrap" style={{ color: 'var(--fg-2)' }}>{meta.label}</span>
      </div>

      <div className="shrink-0 text-right" style={{ width: 88 }}>
        <span className="t-figure">{formatEloScore(creator.elo_score)}</span>
      </div>

      <div className="hidden md:block shrink-0 text-right" style={{ width: 64 }}>
        <Num value={creator.plot_interaction_count ?? 0} size="body" />
      </div>
      <div className="hidden md:block shrink-0 text-right" style={{ width: 64 }}>
        <Num value={creator.follower_count ?? 0} size="body" />
      </div>
    </button>
  );
}

// ── 시상대 (rank 1~3) — 1200: 2·1·3 순서, 390: #1 전체폭 + #2/#3 나란히 ──
function Podium({ creators, onSelect, isPC }) {
  const [first, second, third] = creators;
  const columns = isPC ? '240px 280px 240px' : '1fr 1fr';
  const areas = isPC ? "'second first third'" : "'first first' 'second third'";

  return (
    <div
      className="grid gap-3 sm:gap-4 justify-center"
      style={{ gridTemplateColumns: columns, gridTemplateAreas: areas, alignItems: 'end' }}
    >
      <div style={{ gridArea: 'first', transform: isPC ? 'translateY(-16px)' : undefined }} className={isPC ? undefined : 'mx-auto w-full max-w-[320px]'}>
        <PlayerCard
          name={first.nickname}
          handle={first.handle}
          avatarUrl={first.profile_image_url ? proxyThumbnailUrl(first.profile_image_url, 320) : null}
          tier={deriveTierMeta(first).tierKey}
          division={deriveTierMeta(first).division}
          eloRaw={first.elo_score}
          stats={creatorStats(first)}
          rank={1}
          onClick={() => onSelect(first.handle)}
        />
      </div>
      <div style={{ gridArea: 'second' }}>
        <PlayerCard
          name={second.nickname}
          handle={second.handle}
          avatarUrl={second.profile_image_url ? proxyThumbnailUrl(second.profile_image_url, 240) : null}
          tier={deriveTierMeta(second).tierKey}
          division={deriveTierMeta(second).division}
          eloRaw={second.elo_score}
          stats={creatorStats(second)}
          rank={2}
          compact={!isPC}
          onClick={() => onSelect(second.handle)}
        />
      </div>
      <div style={{ gridArea: 'third' }}>
        <PlayerCard
          name={third.nickname}
          handle={third.handle}
          avatarUrl={third.profile_image_url ? proxyThumbnailUrl(third.profile_image_url, 240) : null}
          tier={deriveTierMeta(third).tierKey}
          division={deriveTierMeta(third).division}
          eloRaw={third.elo_score}
          stats={creatorStats(third)}
          rank={3}
          compact={!isPC}
          onClick={() => onSelect(third.handle)}
        />
      </div>
    </div>
  );
}

export default function CreatorRankingList() {
  const navigate = useNavigate();
  const { data, loading } = useCreatorRankings();
  const isPC = useIsPC();
  // page 는 세션 내에서만 유효한 UI 상태라 로컬 useState 로 충분하다.
  const [page, setPage] = useState(0);

  const creators = data?.rankings || [];

  const goToProfile = (handle) => {
    if (handle) navigate(`/profile?creator=${encodeURIComponent(handle)}`);
  };

  if (loading) {
    return (
      <div className="eb-skel eb-panel overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3" style={{ height: 56, borderBottom: i < 7 ? '1px solid var(--line)' : 'none' }}>
            <div className="eb-bone" style={{ width: 24, height: 18 }} />
            <div className="eb-bone rounded-full" style={{ width: 36, height: 36 }} />
            <div className="flex-1 space-y-1.5">
              <div className="eb-bone h-4 w-1/2" />
              <div className="eb-bone h-3 w-1/3" />
            </div>
            <div className="eb-bone h-4 w-14" />
          </div>
        ))}
      </div>
    );
  }

  const pageCreators = creators.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const globalOffset = page * PAGE_SIZE;
  const showPodium = page === 0 && pageCreators.length >= 3;

  const podiumCreators = showPodium ? pageCreators.slice(0, 3) : [];
  const listCreators = showPodium ? pageCreators.slice(3) : pageCreators;
  const listStartRank = showPodium ? globalOffset + 3 : globalOffset;

  return (
    <div className="flex flex-col gap-4">
      {/* 페이지네이션 */}
      <div className="flex items-center gap-1">
        {Array.from({ length: TOTAL_PAGES }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPage(i)}
            aria-pressed={page === i}
            className="eb-chip"
            data-selected={page === i ? true : undefined}
          >
            {i + 1}
          </button>
        ))}
        <span className="ml-2 t-small" style={{ color: 'var(--fg-3)' }}>
          {globalOffset + 1}–{Math.min(globalOffset + PAGE_SIZE, creators.length)}위
        </span>
      </div>

      {showPodium && <Podium creators={podiumCreators} onSelect={goToProfile} isPC={isPC} />}

      <div className="eb-panel overflow-hidden">
        {listCreators.map((creator, i) => (
          <CreatorRow
            key={creator.id}
            creator={creator}
            globalRank={listStartRank + i}
            onClick={() => goToProfile(creator.handle)}
          />
        ))}
      </div>
    </div>
  );
}
