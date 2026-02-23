
import React, { useMemo } from 'react';

// 1. Keyword Cloud (Hashtags)
export function WordCloud({ characters }) {
    const keywords = useMemo(() => {
        if (!characters) return [];
        const counts = {};

        characters.forEach(c => {
            const tags = c.hashtags || c.tags || [];
            tags.forEach(tag => {
                if (!tag) return;
                const normalized = tag.trim();
                if (normalized.length < 1) return;
                counts[normalized] = (counts[normalized] || 0) + 1;
            });
        });

        // Convert to array and sort
        return Object.entries(counts)
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 30); // Top 30
    }, [characters]);

    if (keywords.length === 0) return null;

    const maxCount = keywords[0]?.count || 1;
    const minCount = keywords[keywords.length - 1]?.count || 0;

    // Font size scale: 0.8rem to 2.0rem
    const getFontSize = (count) => {
        if (maxCount === minCount) return '1rem';
        const ratio = (count - minCount) / (maxCount - minCount);
        return `${0.8 + ratio * 1.2}rem`;
    };

    // Opacity: 0.6 to 1.0
    const getOpacity = (count) => {
        if (maxCount === minCount) return 1;
        const ratio = (count - minCount) / (maxCount - minCount);
        return 0.6 + ratio * 0.4;
    };

    return (
        <div className="card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">주요 해시태그 (Top Keywords)</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center items-baseline content-center">
                {keywords.map((w) => (
                    <span
                        key={w.text}
                        className="inline-block font-bold transition-all hover:scale-110 hover:text-[var(--accent)] cursor-default"
                        style={{
                            fontSize: getFontSize(w.count),
                            opacity: getOpacity(w.count),
                            color: w.count === maxCount ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                        title={`${w.count}회 사용됨`}
                    >
                        #{w.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

// 2. Mock Radar Chart (Stats Dimensions)
export function CreatorRadar({ stats, characters }) {
    const data = useMemo(() => {
        if (!stats || !characters) return null;

        // Derived metrics (normalized 0-100)
        const totalChars = characters.length;
        const totalInt = stats.plotInteractionCount || 0;

        // 1. Productivity: Based on char count (e.g. 50+ is max)
        const productivity = Math.min(100, (totalChars / 50) * 100);

        // 2. Popularity: Based on total interactions (e.g. 10k is max)
        const popularity = Math.min(100, (totalInt / 10000) * 100);

        // 3. Consistency: (Mocked based on ID hash or random)
        // We don't have real "consistency" data without full history traversal, so we'll mock it slightly or use "followers"
        const content = Math.min(100, ((stats.postCount || 0) / 20) * 100);

        // 4. Engagement: Avg interaction per char
        const avg = totalChars ? totalInt / totalChars : 0;
        const engagement = Math.min(100, (avg / 200) * 100);

        // 5. Growth: Following count (proxy for social)
        const social = Math.min(100, ((stats.followingCount || 0) / 100) * 100);

        return [
            { label: '활동성', value: productivity },
            { label: '인기도', value: popularity },
            { label: '참여도', value: engagement },
            { label: '소셜', value: social },
            { label: '창작력', value: content || 50 }
        ];
    }, [stats, characters]);

    if (!data) return null;

    // SVG Config
    const size = 200;
    const center = size / 2;
    const radius = (size - 60) / 2;
    const angleSlice = (Math.PI * 2) / 5;

    const points = data.map((d, i) => {
        const val = (d.value / 100) * radius;
        const x = center + val * Math.cos(angleSlice * i - Math.PI / 2);
        const y = center + val * Math.sin(angleSlice * i - Math.PI / 2);
        return `${x},${y}`;
    }).join(' ');

    const axes = data.map((d, i) => {
        const x = center + radius * Math.cos(angleSlice * i - Math.PI / 2);
        const y = center + radius * Math.sin(angleSlice * i - Math.PI / 2);
        return { x, y, label: d.label };
    });

    return (
        <div className="card p-4 sm:p-5 flex flex-col items-center">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 w-full text-left">크리에이터 분석</h3>
            <div className="relative">
                <svg width={size} height={size}>
                    {/* Grid Circles */}
                    {[0.2, 0.4, 0.6, 0.8, 1].map(r => (
                        <circle
                            key={r}
                            cx={center}
                            cy={center}
                            r={radius * r}
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                        />
                    ))}

                    {/* Axes */}
                    {axes.map((a, i) => (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={a.x}
                            y2={a.y}
                            stroke="var(--border)"
                            strokeWidth="1"
                        />
                    ))}

                    {/* Data Polygon */}
                    <polygon points={points} fill="var(--accent)" fillOpacity="0.2" stroke="var(--accent)" strokeWidth="2" />

                    {/* Points */}
                    {data.map((d, i) => {
                        const val = (d.value / 100) * radius;
                        const x = center + val * Math.cos(angleSlice * i - Math.PI / 2);
                        const y = center + val * Math.sin(angleSlice * i - Math.PI / 2);
                        return (
                            <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
                        );
                    })}

                    {/* Labels */}
                    {axes.map((a, i) => {
                        // Offset text
                        const x = center + (radius + 20) * Math.cos(angleSlice * i - Math.PI / 2);
                        const y = center + (radius + 20) * Math.sin(angleSlice * i - Math.PI / 2);
                        return (
                            <text
                                key={i}
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="10"
                                fill="var(--text-secondary)"
                                className="font-medium"
                            >
                                {a.label}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

// 3. Activity Hour Distribution
export function ActivityHourChart({ characters }) {
    const hours = useMemo(() => {
        if (!characters) return [];
        const counts = new Array(24).fill(0);
        characters.forEach(c => {
            if (!c.createdAt) return;
            const h = new Date(c.createdAt).getHours();
            counts[h]++;
        });
        return counts;
    }, [characters]);

    if (!characters?.length) return null;

    const max = Math.max(1, ...hours);

    return (
        <div className="card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">활동 시간대</h3>
            <div className="flex items-end gap-0.5 h-24">
                {hours.map((count, h) => (
                    <div key={h} className="flex-1 flex flex-col items-center group relative">
                        <div
                            className="w-full bg-[var(--accent)] opacity-50 hover:opacity-100 transition-all rounded-t-sm"
                            style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 2 : 0 }}
                        />
                        {h % 6 === 0 && (
                            <span className="text-[9px] text-[var(--text-tertiary)] absolute top-full mt-1">
                                {h}시
                            </span>
                        )}
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 bg-black text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                            {h}시: {count}개
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
