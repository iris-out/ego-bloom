import React from 'react';

/**
 * 글로벌 트렌딩 랭킹 배지
 * globalRank, rankDiff, isNew 모두 optional
 */
export default function RankBadge({ globalRank, rankDiff, isNew, className = '' }) {
    if (globalRank == null && !isNew) return null;

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            {globalRank != null && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded
          bg-gradient-to-r from-violet-500/20 to-indigo-500/20
          border border-violet-500/30 text-violet-300 leading-none">
                    🌐 #{globalRank}
                </span>
            )}
            {rankDiff != null && rankDiff !== 0 && (
                <span className={`text-[10px] font-bold leading-none ${rankDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {rankDiff > 0 ? '▲' : '▼'}{Math.abs(rankDiff)}
                </span>
            )}
            {isNew && (
                <span className="text-[9px] font-black text-orange-400 animate-pulse leading-none">
                    NEW
                </span>
            )}
        </div>
    );
}
