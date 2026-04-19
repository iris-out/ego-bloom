import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber, getCreatorTier } from '../../utils/tierCalculator';
import TierIcon from '../ui/TierIcon';

const PAGE_SIZE = 20;
const TOTAL_PAGES = 5;

const TIER_KO = {
  Unranked: '언랭',
  Bronze: '브론즈',
  Silver: '실버',
  Gold: '골드',
  Platinum: '플래티넘',
  Diamond: '다이아몬드',
  Master: '마스터',
  Champion: '챔피언',
};

// Top 1~3 스트라이프 + rank-box 색상
const STRIPE_COLORS = ['#e9c46a', '#c9c6c0', '#c08457'];
const RANK_BOX_FONT = "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif";
const RANK_BOX_BORDER = '1px solid rgba(255,255,255,0.06)';

function splitFormatted(str) {
  const match = str.match(/^(-?[0-9,.]+)([만천억]?)$/);
  if (match) return { num: match[1], unit: match[2] };
  return { num: str, unit: '' };
}

function StatVal({ count, label, numSize = '17px', labelSize = '11px' }) {
  const { num, unit } = splitFormatted(formatNumber(count ?? 0));
  return (
    <span className="tabular-nums" style={{ letterSpacing: '-0.02em' }}>
      <span style={{ fontSize: numSize, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{num}</span>
      {unit && <span style={{ fontSize: labelSize, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginLeft: '1px' }}>{unit}</span>}
      <span style={{ fontSize: labelSize, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginLeft: '3px' }}>{label}</span>
    </span>
  );
}

function getTierKey(tierName = '') {
  const t = tierName.toUpperCase();
  if (t.startsWith('CHAMPION')) return 'champion';
  if (t.startsWith('MASTER'))   return 'master';
  if (t.startsWith('DIAMOND'))  return 'diamond';
  if (t.startsWith('PLATINUM')) return 'platinum';
  if (t.startsWith('GOLD'))     return 'gold';
  if (t.startsWith('SILVER'))   return 'silver';
  if (t.startsWith('BRONZE'))   return 'bronze';
  return 'unranked';
}

export default function CreatorRankingList() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch('/api/get-rankings')
      .then(r => r.json())
      .then(data => setCreators(data.rankings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col divide-y divide-white/5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-3 py-2.5 px-2">
            {/* Row 1 스켈레톤 */}
            <div className="flex items-center gap-3 w-full">
              <div className="w-16 h-6 rounded bg-white/10 animate-pulse shrink-0" />
              <div className="w-11 h-11 rounded-full bg-white/10 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 rounded bg-white/10 animate-pulse w-2/3" />
                <div className="h-3 rounded bg-white/5 animate-pulse w-1/3" />
              </div>
              <div className="sm:hidden w-7 h-7 rounded-full bg-white/10 animate-pulse shrink-0" />
            </div>
            {/* Row 2 스켈레톤 (모바일) */}
            <div className="sm:hidden flex items-center gap-3 mt-1.5 pl-[124px]">
              <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
            </div>
            {/* 데스크탑 스켈레톤 */}
            <div className="hidden sm:block w-20 space-y-1.5 shrink-0">
              <div className="h-4 rounded bg-white/10 animate-pulse" />
              <div className="h-3 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const pageCreators = creators.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const globalOffset = page * PAGE_SIZE;

  return (
    <div className="flex flex-col gap-3">
      {/* 페이지네이션 */}
      <div className="flex gap-0.5">
        {Array.from({ length: TOTAL_PAGES }, (_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-9 h-9 sm:w-7 sm:h-7 rounded-md text-[14px] sm:text-[12px] font-medium transition-colors ${
              page === i
                ? 'bg-indigo-500/30 text-indigo-300'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {i + 1}
          </button>
        ))}
        <span className="ml-1 text-[11px] text-white/20 self-center">
          {globalOffset + 1}–{Math.min(globalOffset + PAGE_SIZE, creators.length)}위
        </span>
      </div>

      <div className="flex flex-col divide-y divide-white/[0.08]">
        {pageCreators.map((creator, i) => {
          const globalRank = globalOffset + i;
          const imageUrl = creator.profile_image_url;
          const tierKey = getTierKey(creator.tier_name);
          const tierData = getCreatorTier(creator.elo_score ?? 0);
          const tierKoName = TIER_KO[tierData.name] ?? tierData.name;
          const tierLabel = globalRank < 10
            ? `${globalRank + 1}위`
            : `${tierKoName}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`;
          const tierLabelStyle = globalRank < 10
            ? { color: globalRank < 3 ? STRIPE_COLORS[globalRank] : 'rgba(255,255,255,0.7)' }
            : { color: tierData.color };

          const stripeColor = globalRank < 3 ? STRIPE_COLORS[globalRank] : null;
          const rankBoxColor = globalRank < 3 ? STRIPE_COLORS[globalRank] : 'rgba(255,255,255,0.35)';

          return (
            <button
              key={creator.id}
              onClick={() => creator.handle && navigate(`/profile?creator=${encodeURIComponent(creator.handle)}`)}
              className={`relative flex flex-col sm:flex-row sm:items-stretch gap-0 sm:gap-3 py-2.5 pr-2 rounded-lg hover:bg-white/5 transition-colors text-left w-full ${creator.handle ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* 좌측 3px 컬러 스트라이프 (top 1~3) */}
              {stripeColor && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 4,
                    bottom: 4,
                    width: '3px',
                    background: stripeColor,
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Row 1 (항상): rank-box + 아바타 + 닉네임/핸들 + (모바일)티어 */}
              <div className="flex items-stretch gap-3 w-full">
                {/* rank-box 64px */}
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: '64px',
                    borderRight: RANK_BOX_BORDER,
                    fontFamily: RANK_BOX_FONT,
                    fontSize: '22px',
                    fontWeight: 700,
                    color: rankBoxColor,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                >
                  {globalRank + 1}
                </div>

                <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-white/10 self-center">
                  {imageUrl ? (
                    <img
                      src={proxyThumbnailUrl(imageUrl, 64)}
                      alt={creator.nickname}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[13px] text-white/30">
                      {(creator.nickname || '?')[0]}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 self-center">
                  <p className="text-[14px] font-medium text-white truncate">{creator.nickname}</p>
                  <p className="text-[12px] text-white/35 truncate">@{creator.handle}</p>
                </div>

                {/* 티어 아이콘 + 라벨: 모바일에서는 Row 1 끝 */}
                <div className="sm:hidden flex flex-col items-center gap-0.5 shrink-0 self-center">
                  <TierIcon tier={tierKey} rank={globalRank + 1} size={30} />
                  <span className="text-[9px] font-semibold tracking-wider" style={tierLabelStyle}>
                    {tierLabel}
                  </span>
                </div>
              </div>

              {/* 모바일 전용: 스탯 */}
              <div className="sm:hidden mt-1.5 pl-[124px]">
                <div className="flex items-center gap-3">
                  <StatVal count={creator.plot_interaction_count} label="대화" numSize="16px" />
                  <StatVal count={creator.follower_count} label="팔로워" numSize="16px" />
                </div>
              </div>

              {/* 데스크탑(sm+) 전용: 우측 스탯 블록 */}
              <div className="hidden sm:flex items-center gap-4 shrink-0 ml-auto">
                <div className="flex items-center gap-2">
                  <StatVal count={creator.plot_interaction_count} label="대화" />
                  <span className="text-white/20 text-[12px]">·</span>
                  <StatVal count={creator.follower_count} label="팔로워" />
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 w-[64px]"
                  style={{ marginRight: '6px' }}>
                  <TierIcon tier={tierKey} rank={globalRank + 1} size={40} />
                  <p className="text-[10px] font-semibold leading-none text-center w-full" style={tierLabelStyle}>
                    {tierLabel}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
