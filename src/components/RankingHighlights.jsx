import React, { useMemo } from 'react';
import { formatNumber } from '../utils/tierCalculator';
import ImageWithFallback from './ImageWithFallback';
import { ExternalLink } from 'lucide-react';

function CharRow({ char, showRank }) {
    const url = `https://zeta-ai.io/ko/plots/${char.id}/profile`;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
        >
            {/* Thumbnail */}
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--border)]">
                <ImageWithFallback
                    src={char.imageUrl}
                    fallbackSrcs={(char.imageUrls || []).slice(1)}
                    alt={char.name}
                    className="w-full h-full object-cover"
                />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {char.name}
                </div>
                <div className="text-[10px] text-[var(--accent-bright)] font-bold">
                    {formatNumber(char.interactionCount || 0)}
                </div>
            </div>
            {/* Rank indicator */}
            {showRank && char.globalRank != null && (
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[10px] font-black text-violet-300">
                        #{char.globalRank}
                    </span>
                    {char.rankDiff != null && char.rankDiff !== 0 && (
                        <div className="flex items-center gap-1 mt-0.5" title={`어제 대비 ${Math.abs(char.rankDiff)}순위 ${char.rankDiff > 0 ? '상승' : '하락'}`}>
                            <span className={`text-[9px] font-bold ${char.rankDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {char.rankDiff > 0 ? '▲' : '▼'}{Math.abs(char.rankDiff)}
                            </span>
                            <svg width="18" height="10" viewBox="0 0 20 10" className="opacity-70">
                                <polyline
                                    points={`0,${char.rankDiff > 0 ? 8 : 2} 10,5 20,${char.rankDiff > 0 ? 2 : 8}`}
                                    fill="none"
                                    stroke={char.rankDiff > 0 ? '#10b981' : '#ef4444'}
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                    )}
                </div>
            )}
            {showRank && char.isNew && (
                <span className="text-[9px] font-black text-orange-400 shrink-0 animate-pulse ml-1">NEW</span>
            )}
            <ExternalLink size={10} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-60 shrink-0" />
        </a>
    );
}

export default function RankingHighlights({ characters }) {
    const ranked = useMemo(() =>
        (characters || [])
            .filter(c => c.globalRank != null)
            .sort((a, b) => a.globalRank - b.globalRank)
            .slice(0, 8),
        [characters]);

    const top5 = useMemo(() =>
        (characters || [])
            .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
            .slice(0, 5),
        [characters]);

    return (
        <div className="space-y-3">
            {/* 글로벌 트렌딩 — ranked 캐릭터 있을 때만 */}
            {ranked.length > 0 && (
                <div className="card p-4">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                        <span>🌐</span> 글로벌 트렌딩
                        <span className="ml-auto text-[10px] font-normal text-[var(--text-tertiary)] opacity-60">
                            TOP {ranked[ranked.length - 1]?.globalRank}↑
                        </span>
                    </h3>
                    <div className="mt-2">
                        {ranked.map(char => (
                            <CharRow key={char.id} char={char} showRank={true} />
                        ))}
                    </div>
                </div>
            )}

            {/* TOP 5 인기 캐릭터 — 항상 표시 */}
            <div className="card p-4">
                <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-1">
                    ⭐ 인기 TOP 5
                </h3>
                <div className="mt-2">
                    {top5.map((char, i) => (
                        <div key={char.id} className="flex items-center gap-1">
                            <span className={`w-4 text-[10px] font-black text-center shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-[var(--text-tertiary)]'
                                }`}>
                                {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <CharRow char={char} showRank={char.globalRank != null} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
