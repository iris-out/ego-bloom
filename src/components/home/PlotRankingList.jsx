import React, { useState, useMemo } from 'react';
import PlotRankingItem from './PlotRankingItem';
import FilterDropdown from './FilterDropdown';

const SUB_TABS = ['트렌딩', '베스트', '신작'];
const DATA_KEYS = { '트렌딩': 'trendingPlots', '베스트': 'bestPlots', '신작': 'newPlots' };

const PAGE_RANGES = [
  { label: '1', start: 0,  end: 30  },
  { label: '2', start: 30, end: 60  },
  { label: '3', start: 60, end: 100 },
];

function applyFilter(plots, sortBy, direction) {
  const sorted = [...plots].sort((a, b) => {
    if (sortBy === '순위') return a.rank - b.rank;
    if (sortBy === '상승률') {
      const aBase = a.interactionCount - (a.interactionDelta || 0);
      const bBase = b.interactionCount - (b.interactionDelta || 0);
      const aRate = aBase > 0 && a.interactionDelta ? a.interactionDelta / aBase : 0;
      const bRate = bBase > 0 && b.interactionDelta ? b.interactionDelta / bBase : 0;
      return bRate - aRate;
    }
    if (sortBy === '대화량') return b.interactionCount - a.interactionCount;
    return 0;
  });
  return direction === '오름차순' ? sorted.reverse() : sorted;
}

function formatKST(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mo = kst.getUTCMonth() + 1;
  const dd = kst.getUTCDate();
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mo}월 ${dd}일 ${hh}:${mm} 기준`;
}

export default function PlotRankingList({ rankingData }) {
  const [subTab, setSubTab] = useState('트렌딩');
  const [filter, setFilter] = useState({ sortBy: '순위', direction: '내림차순' });
  const [page, setPage] = useState(0);

  const rawPlots = rankingData?.[DATA_KEYS[subTab]] || [];
  const plots = useMemo(() => applyFilter(rawPlots, filter.sortBy, filter.direction), [rawPlots, filter]);
  const maxDelta = useMemo(() => Math.max(0, ...plots.map(p => p.interactionDelta ?? 0)), [plots]);

  // 데이터가 있는 페이지만 (인덱스가 PAGE_RANGES와 1:1 대응)
  const pageCount = PAGE_RANGES.filter(pr => pr.start < plots.length).length;
  const activePage = Math.min(page, Math.max(0, pageCount - 1));
  const { start, end } = PAGE_RANGES[activePage];
  const pagePlots = plots.slice(start, end);

  function handleSubTab(t) {
    setSubTab(t);
    setPage(0);
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        {/* 서브탭 + 기준 시각 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {SUB_TABS.map(t => (
              <button
                key={t}
                onClick={() => handleSubTab(t)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[13px] sm:text-[15px] font-semibold transition-all ${
                  subTab === t
                    ? 'bg-indigo-500/50 text-white border border-indigo-400/70 shadow-sm shadow-indigo-500/20'
                    : 'bg-white/[0.07] text-white/50 border border-white/[0.13] hover:bg-white/[0.12] hover:text-white/75 hover:border-white/25'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {rankingData?.updatedAt && (
            <span className="text-[11px] text-white/25 shrink-0">
              {formatKST(rankingData.updatedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {PAGE_RANGES.map((pr, i) => {
              const hasData = pr.start < plots.length;
              const isActive = activePage === i;
              return (
                <button
                  key={pr.label}
                  onClick={() => hasData && setPage(i)}
                  disabled={!hasData}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-[13px] sm:text-[15px] font-semibold transition-colors ${
                    isActive && hasData
                      ? 'bg-indigo-500/50 text-white border border-indigo-400/60'
                      : hasData
                        ? 'bg-white/[0.07] text-white/50 border border-white/[0.10] hover:bg-white/[0.12] hover:text-white/80'
                        : 'text-white/15 cursor-not-allowed'
                  }`}
                >
                  {pr.label}
                </button>
              );
            })}
          </div>
          <FilterDropdown
            sortBy={filter.sortBy}
            direction={filter.direction}
            onChange={setFilter}
          />
        </div>
      </div>

      {/* 데스크탑 헤더 (sm+): 5열 그리드 */}
      <div className="hidden sm:grid plot-ranking-grid items-center gap-x-2 px-2 mb-1">
        <span className="text-[13px] text-white/20 text-center">#</span>
        <span className="text-[13px] text-white/20">플롯</span>
        <span className="text-[13px] text-white/20 text-right">태그</span>
        <span className="text-[13px] text-white/20 text-right">대화량</span>
        <span className="text-[13px] text-white/20 text-right">상승</span>
      </div>
      {/* 모바일 헤더 (< sm): 2열 단순화 */}
      <div className="sm:hidden flex items-center px-2 mb-1 gap-x-2">
        <span className="text-[11px] text-white/20 w-5 text-center shrink-0">#</span>
        <span className="text-[11px] text-white/20 flex-1">플롯</span>
        <span className="text-[11px] text-white/20">대화량 / 상승</span>
      </div>

      {!rankingData ? (
        /* 스켈레톤 */
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-white/5">
              {/* 데스크탑 스켈레톤 (sm+) */}
              <div className="hidden sm:grid plot-ranking-grid items-center gap-x-2 py-3 px-2">
                <div className="h-4 w-4 rounded bg-white/10 animate-pulse mx-auto" />
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 rounded bg-white/10 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-white/5 animate-pulse w-1/2" />
                  </div>
                </div>
                <div className="h-5 rounded-full bg-white/5 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-2 rounded-full bg-white/5 animate-pulse" />
              </div>
              {/* 모바일 스켈레톤 (< sm): 2줄 */}
              <div className="sm:hidden py-3 px-2">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-5 h-4 rounded bg-white/10 animate-pulse shrink-0" />
                  <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 rounded bg-white/10 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-white/5 animate-pulse w-1/2" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-20">
                  <div className="h-3 w-12 rounded-full bg-white/5 animate-pulse" />
                  <div className="h-3 w-10 rounded bg-white/10 animate-pulse ml-auto" />
                  <div className="w-10 h-2 rounded-full bg-white/5 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : plots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/20 text-[14px]">
          데이터 없음
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {pagePlots.map((plot, i) => (
            <PlotRankingItem
              key={plot.id}
              plot={plot}
              rank={start + i + 1}
              maxDelta={maxDelta}
            />
          ))}
        </div>
      )}
    </div>
  );
}
