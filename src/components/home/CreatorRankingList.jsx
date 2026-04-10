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

// 각 등수별 스파클 설정 (랜덤성을 위해 미리 분산 배치)
const SPARKLES_BY_RANK = [
  // 1위 금색
  [
    { x: '5%',  y: '20%', s: 2,   dur: 5.2, delay: 0    },
    { x: '12%', y: '70%', s: 3,   dur: 4.1, delay: 2.3  },
    { x: '23%', y: '35%', s: 1.5, dur: 6.0, delay: 1.0  },
    { x: '31%', y: '80%', s: 2.5, dur: 4.7, delay: 3.4  },
    { x: '44%', y: '15%', s: 2,   dur: 5.5, delay: 0.6  },
    { x: '55%', y: '65%', s: 3,   dur: 4.3, delay: 2.8  },
    { x: '66%', y: '25%', s: 1.5, dur: 6.2, delay: 1.5  },
    { x: '74%', y: '75%', s: 2,   dur: 4.9, delay: 4.0  },
    { x: '83%', y: '40%', s: 2.5, dur: 5.1, delay: 0.3  },
    { x: '91%', y: '18%', s: 2,   dur: 4.6, delay: 3.1  },
    { x: '96%', y: '62%', s: 3,   dur: 5.8, delay: 1.8  },
  ],
  // 2위 은색
  [
    { x: '4%',  y: '55%', s: 2,   dur: 5.4, delay: 0.8  },
    { x: '14%', y: '22%', s: 2.5, dur: 4.2, delay: 2.6  },
    { x: '27%', y: '72%', s: 1.5, dur: 6.1, delay: 0.2  },
    { x: '38%', y: '30%', s: 2,   dur: 5.0, delay: 3.7  },
    { x: '48%', y: '78%', s: 3,   dur: 4.5, delay: 1.3  },
    { x: '59%', y: '18%', s: 1.5, dur: 5.7, delay: 0.5  },
    { x: '70%', y: '60%', s: 2.5, dur: 4.8, delay: 2.9  },
    { x: '79%', y: '28%', s: 2,   dur: 6.3, delay: 1.1  },
    { x: '88%', y: '75%', s: 3,   dur: 4.4, delay: 3.5  },
    { x: '94%', y: '38%', s: 1.5, dur: 5.3, delay: 0.7  },
  ],
  // 3위 동색
  [
    { x: '7%',  y: '40%', s: 2.5, dur: 4.9, delay: 1.4  },
    { x: '16%', y: '15%', s: 2,   dur: 5.6, delay: 0.3  },
    { x: '25%', y: '68%', s: 3,   dur: 4.2, delay: 2.7  },
    { x: '36%', y: '25%', s: 1.5, dur: 6.0, delay: 3.9  },
    { x: '46%', y: '82%', s: 2,   dur: 4.7, delay: 0.9  },
    { x: '57%', y: '35%', s: 2.5, dur: 5.3, delay: 2.1  },
    { x: '68%', y: '72%', s: 2,   dur: 4.5, delay: 1.6  },
    { x: '76%', y: '20%', s: 3,   dur: 5.9, delay: 3.2  },
    { x: '85%', y: '58%', s: 1.5, dur: 4.3, delay: 0.5  },
    { x: '93%', y: '30%', s: 2,   dur: 5.7, delay: 4.1  },
  ],
];

const SPARKLE_COLOR = [
  '#fbbf24', // 금
  '#cbd5e1', // 은
  '#b45309', // 동
];

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
              <div className="w-6 h-4 rounded bg-white/10 animate-pulse shrink-0" />
              <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 rounded bg-white/10 animate-pulse w-2/3" />
                <div className="h-3 rounded bg-white/5 animate-pulse w-1/3" />
              </div>
              <div className="sm:hidden w-7 h-7 rounded-full bg-white/10 animate-pulse shrink-0" />
            </div>
            {/* Row 2 스켈레톤 (모바일) */}
            <div className="sm:hidden flex items-center gap-3 mt-1.5 pl-[84px]">
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
            ? `TOP ${globalRank + 1}`
            : `${tierKoName}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`;
          const tierLabelStyle = globalRank < 10
            ? { color: '#FFF', textShadow: '0 0 8px rgba(255,255,255,0.6)' }
            : { color: tierData.color };

          const medalBg =
            globalRank === 0 ? 'border border-yellow-400/[0.18]' :
            globalRank === 1 ? 'border border-slate-300/[0.14]' :
            globalRank === 2 ? 'border border-amber-600/[0.18]' :
            '';

          const medalGradient =
            globalRank === 0 ? 'linear-gradient(120deg, rgba(251,191,36,0.08) 0%, rgba(253,224,71,0.04) 50%, rgba(245,158,11,0.07) 100%)' :
            globalRank === 1 ? 'linear-gradient(120deg, rgba(203,213,225,0.07) 0%, rgba(241,245,249,0.03) 50%, rgba(148,163,184,0.06) 100%)' :
            globalRank === 2 ? 'linear-gradient(120deg, rgba(217,119,6,0.07) 0%, rgba(253,186,116,0.04) 50%, rgba(194,65,12,0.06) 100%)' :
            '';

          const sparkles = globalRank < 3 ? SPARKLES_BY_RANK[globalRank] : null;
          const sparkleColor = globalRank < 3 ? SPARKLE_COLOR[globalRank] : null;

          return (
            <button
              key={creator.id}
              onClick={() => creator.handle && navigate(`/profile?creator=${encodeURIComponent(creator.handle)}`)}
              className={`relative flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-3 py-2.5 px-2 rounded-lg hover:bg-white/5 transition-colors text-left w-full ${medalBg} ${creator.handle ? 'cursor-pointer' : 'cursor-default'}`}
              style={medalGradient ? { background: medalGradient } : undefined}
            >
              {/* 스파클 이펙트 (overflow-hidden 전용 레이어) */}
              {sparkles && (
                <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                  {sparkles.map((sp, si) => (
                    <span
                      key={si}
                      className="sparkle-dot"
                      style={{
                        left: sp.x,
                        top: sp.y,
                        width: sp.s,
                        height: sp.s,
                        backgroundColor: sparkleColor,
                        boxShadow: `0 0 ${sp.s * 2}px ${sparkleColor}`,
                        '--dur': `${sp.dur}s`,
                        '--delay': `${sp.delay}s`,
                        opacity: 0.35,
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Row 1 (항상): 순위 + 아바타 + 닉네임/핸들 + 티어 아이콘 */}
              <div className="flex items-center gap-3 w-full">
                <span className={`text-[15px] font-bold w-6 text-center tabular-nums shrink-0 ${
                  globalRank === 0 ? 'text-yellow-400' : globalRank < 3 ? 'text-white/70' : 'text-white/30'
                }`}>
                  {globalRank + 1}
                </span>

                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/10">
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

                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-white truncate">{creator.nickname}</p>
                  <p className="text-[12px] text-white/35 truncate">@{creator.handle}</p>
                </div>

                {/* 티어 아이콘 + 라벨: 모바일에서는 Row 1 끝 */}
                <div className="sm:hidden flex flex-col items-center gap-0.5 shrink-0">
                  <TierIcon tier={tierKey} rank={globalRank + 1} size={30} />
                  <span className="text-[9px] font-black uppercase tracking-wider" style={tierLabelStyle}>
                    {tierLabel}
                  </span>
                </div>
              </div>

              {/* 모바일 전용: 스탯 */}
              <div className="sm:hidden mt-1.5 pl-[84px]">
                <div className="flex items-center gap-3">
                  <span className="text-[16px] font-bold text-white/90 tabular-nums">
                    {formatNumber(creator.plot_interaction_count)}
                    <span className="text-[12px] font-normal text-white/40 ml-0.5">대화</span>
                  </span>
                  <span className="text-[15px] font-semibold text-white/55 tabular-nums">
                    팔로워 {formatNumber(creator.follower_count)}
                  </span>
                </div>
              </div>

              {/* 데스크탑(sm+) 전용: 우측 스탯 블록 */}
              <div className="hidden sm:flex items-center gap-4 shrink-0 ml-auto">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-white/90 tabular-nums">
                    {formatNumber(creator.plot_interaction_count)}
                    <span className="text-[12px] font-normal text-white/40 ml-0.5">대화</span>
                  </span>
                  <span className="text-white/20 text-[12px]">·</span>
                  <span className="text-[16px] font-bold text-white/60 tabular-nums">
                    팔로워 {formatNumber(creator.follower_count)}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 w-[64px]"
                  style={{ marginTop: '6px', marginRight: '10px' }}>
                  <TierIcon tier={tierKey} rank={globalRank + 1} size={44} />
                  <p className="text-[10px] font-black uppercase tracking-wider leading-none text-center w-full" style={tierLabelStyle}>
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
