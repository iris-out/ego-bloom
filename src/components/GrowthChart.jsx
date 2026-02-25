import React, { useMemo } from 'react';
import { formatNumber, toKST } from '../utils/tierCalculator';

export default function GrowthChart({ characters }) {
    const yearlyData = useMemo(() => {
        if (!characters?.length) return [];

        // 연도별 집계
        const byYear = {};
        characters.forEach(c => {
            const date = c.createdAt || c.createdDate;
            if (!date) return;
            const year = toKST(date).getFullYear();
            if (!byYear[year]) byYear[year] = { count: 0, interactions: 0 };
            byYear[year].count += 1;
            byYear[year].interactions += c.interactionCount || 0;
        });

        const years = Object.keys(byYear).map(Number).sort();
        if (years.length === 0) return [];

        // 누적 계산
        let cumCount = 0;
        let cumInteractions = 0;
        return years.map(year => {
            cumCount += byYear[year].count;
            cumInteractions += byYear[year].interactions;
            return {
                year,
                count: byYear[year].count,        // 연도별 신규 캐릭터
                interactions: byYear[year].interactions, // 연도별 대화량
                cumCount,                           // 누적 캐릭터
                cumInteractions,                    // 누적 대화량
            };
        });
    }, [characters]);

    if (yearlyData.length < 2) return null;

    // SVG 설정
    const W = 560;
    const H = 180;
    const PAD = { top: 20, right: 16, bottom: 36, left: 50 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const maxCumCount = Math.max(...yearlyData.map(d => d.cumCount));
    const maxInteractions = Math.max(...yearlyData.map(d => d.interactions));

    const xStep = chartW / (yearlyData.length - 1);

    const toX = (i) => PAD.left + i * xStep;
    const toYCount = (v) => PAD.top + chartH - (v / maxCumCount) * chartH;
    const toYInteraction = (v) => PAD.top + chartH - (v / maxInteractions) * chartH;

    // polyline points
    const countLine = yearlyData.map((d, i) => `${toX(i)},${toYCount(d.cumCount)}`).join(' ');
    const interactionBars = yearlyData.map((d, i) => ({
        x: toX(i),
        y: toYInteraction(d.interactions),
        h: chartH - (toYInteraction(d.interactions) - PAD.top),
        interactions: d.interactions,
        count: d.count,
        year: d.year,
        cumCount: d.cumCount,
    }));

    return (
        <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">연도별 성장 추이</h3>
                <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 bg-[var(--accent)] rounded" />
                        누적 캐릭터
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-2 rounded-sm bg-[var(--accent)] opacity-30" />
                        연도별 대화량
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
                    {/* 배경 격자 */}
                    {[0.25, 0.5, 0.75, 1].map(r => (
                        <line
                            key={r}
                            x1={PAD.left} y1={PAD.top + chartH * (1 - r)}
                            x2={PAD.left + chartW} y2={PAD.top + chartH * (1 - r)}
                            stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4"
                        />
                    ))}

                    {/* 대화량 바 (연도별) */}
                    {interactionBars.map((b, i) => (
                        <g key={b.year} className="group">
                            <rect
                                x={b.x - 10}
                                y={b.y}
                                width={20}
                                height={b.h}
                                fill="var(--accent)"
                                fillOpacity="0.2"
                                rx="2"
                            />
                            {/* 호버 툴팁 */}
                            <rect x={b.x - 10} y={PAD.top} width={20} height={chartH} fill="transparent" className="cursor-default" />
                            <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <rect
                                    x={Math.min(b.x - 60, W - 130)}
                                    y={b.y - 52}
                                    width={120}
                                    height={48}
                                    rx="6"
                                    fill="rgba(0,0,0,0.85)"
                                />
                                <text x={Math.min(b.x - 60, W - 130) + 8} y={b.y - 36} fill="white" fontSize="10" fontWeight="bold">{b.year}년</text>
                                <text x={Math.min(b.x - 60, W - 130) + 8} y={b.y - 22} fill="#D6BCFA" fontSize="9">신규 {b.count}개 | 누적 {b.cumCount}개</text>
                                <text x={Math.min(b.x - 60, W - 130) + 8} y={b.y - 10} fill="#9F7AEA" fontSize="9">대화 {formatNumber(b.interactions)}</text>
                            </g>
                        </g>
                    ))}

                    {/* 누적 캐릭터 라인 */}
                    <polyline
                        points={countLine}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {/* 데이터 포인트 */}
                    {yearlyData.map((d, i) => (
                        <circle
                            key={d.year}
                            cx={toX(i)}
                            cy={toYCount(d.cumCount)}
                            r="3.5"
                            fill="var(--accent)"
                            stroke="var(--card)"
                            strokeWidth="2"
                        />
                    ))}

                    {/* Y축 (캐릭터 수) */}
                    {[0, 0.5, 1].map(r => (
                        <text
                            key={r}
                            x={PAD.left - 6}
                            y={PAD.top + chartH * (1 - r) + 4}
                            textAnchor="end"
                            fill="var(--text-tertiary)"
                            fontSize="9"
                        >
                            {Math.round(maxCumCount * r)}
                        </text>
                    ))}

                    {/* X축 연도 레이블 */}
                    {yearlyData.map((d, i) => (
                        <text
                            key={d.year}
                            x={toX(i)}
                            y={H - 6}
                            textAnchor="middle"
                            fill="var(--text-tertiary)"
                            fontSize="10"
                            fontWeight={i === yearlyData.length - 1 ? 'bold' : 'normal'}
                        >
                            {d.year}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
}
