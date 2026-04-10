import React from 'react';
import { formatNumber } from '../../utils/tierCalculator';

export default function TagTrendingList({ combined = [], interaction = [] }) {
  if (!combined.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/20 text-[13px]">
        데이터 없음
      </div>
    );
  }

  const maxScore = combined[0]?.score || 1;

  // interaction 배열을 tag→count 맵으로 변환 (O(1) 조회)
  const interactionMap = Object.fromEntries(interaction.map(({ tag, score }) => [tag, score]));

  return (
    <div className="flex flex-col gap-1">
      {combined.map(({ tag, score }, i) => {
        const pct = Math.round((score / maxScore) * 100);
        const interactionCount = interactionMap[tag] ?? interactionMap[tag.toLowerCase()] ?? null;

        return (
          <div key={tag} className="flex items-center gap-3 py-2.5 lg:py-2 px-2 rounded-lg hover:bg-white/5 transition-colors">
            {/* 순위 */}
            <span className="text-[14px] lg:text-[12px] text-white/25 w-5 text-right shrink-0 tabular-nums">{i + 1}</span>

            {/* 태그명 + 바 그래프 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[15px] lg:text-[13px] font-medium text-white/85 truncate">#{tag}</span>
                {interactionCount !== null && (
                  <span className="text-[12px] lg:text-[11px] text-white/35 tabular-nums ml-2 shrink-0">
                    합산 {formatNumber(interactionCount)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 lg:h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, rgba(99,102,241,0.85) 0%, rgba(167,139,250,0.65) 100%)',
                    }}
                  />
                </div>
                <span className="text-[12px] lg:text-[11px] text-indigo-300/60 tabular-nums w-8 text-right shrink-0">
                  {pct}%
                </span>
              </div>
            </div>

            {/* 포인트 */}
            <div className="text-right shrink-0 w-16">
              <span className="text-[14px] lg:text-[13px] font-medium text-white/60 tabular-nums">
                {score.toLocaleString()}
              </span>
              <p className="text-[11px] lg:text-[10px] text-white/20">포인트</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
