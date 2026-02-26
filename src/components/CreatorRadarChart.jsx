import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { toKST } from '../utils/tierCalculator';

export default function CreatorRadarChart({ stats, characters }) {
    const data = useMemo(() => {
        if (!stats || !characters) return [];

        const normalize = (value, min, max) => {
            if (value <= min) return 20;
            if (value >= max) return 100;
            return 20 + ((value - min) / (max - min)) * 80;
        };

        const plotCount = stats.plotCount || characters.length || 0;

        // 1. 다작 성실 (Diligence)
        let scoreDiligence = 20;
        let daysPerCharStr = "N/A";
        if (characters.length > 0) {
            // 가장 이른 생성일 기준으로 "지금까지의" 활동 일수 계산 (ProfileHeader와 동일한 기준)
            const timestamps = characters
                .map(c => c.createdAt || c.createdDate)
                .filter(Boolean)
                .map(d => toKST(d).getTime())
                .filter(t => !isNaN(t));

            if (timestamps.length > 0 && plotCount > 0) {
                const earliest = Math.min(...timestamps);
                const now = toKST().getTime();
                const activityDays = Math.max(1, (now - earliest) / (1000 * 60 * 60 * 24));
                const daysPerChar = activityDays / plotCount;
                daysPerCharStr = `${daysPerChar.toFixed(1)}일`;

                // 14 days = 50 pts, 3 days = 100 pts.
                // score = 100 - (daysPerChar - 3) * (50 / 11) ≈ 4.545점/일 감소
                if (daysPerChar <= 3) scoreDiligence = 100;
                else if (daysPerChar >= 25) scoreDiligence = 20;
                else scoreDiligence = 100 - ((daysPerChar - 3) * 4.545);
            }
        }

        // 2. 유저 몰입 (User Engagement - Regen Ratio)
        let totalOriginal = 0;
        let totalWithRegen = 0;
        characters.forEach(c => {
            if (c.originalInteractionCount > 0) {
                totalOriginal += c.originalInteractionCount;
                totalWithRegen += c.interactionCount;
            }
        });
        const regenRatio = totalOriginal > 0 ? (totalWithRegen / totalOriginal) : 1.0;
        const scoreRegen = normalize(regenRatio, 1.0, 1.30);

        // 3. 캐릭터 평균 대화 (평균 트래픽)
        const totalInteractions = stats.plotInteractionCount || 0;
        const avgInteractions = plotCount > 0 ? totalInteractions / plotCount : 0;
        // 10,000회 이하 → 20점, 200,000회 이상 → 100점
        const scoreTraffic = normalize(avgInteractions, 10000, 200000);

        // 4. 오픈소스 (Openness)
        let openCount = 0;
        characters.forEach(c => {
            if (c.isLongDescriptionPublic) {
                openCount++;
            }
        });
        const openRatio = plotCount > 0 ? (openCount / plotCount) : 0;
        const scoreOpenness = normalize(openRatio, 0, 0.75); // 75% 이상 공개면 만점

        // 5. 다양성 (Genre Diversity)
        const uniqueHashtags = new Set();
        characters.forEach(c => {
            if (c.hashtags) {
                c.hashtags.forEach(tag => uniqueHashtags.add(tag));
            } else if (c.tags) {
                c.tags.forEach(tag => uniqueHashtags.add(tag));
            }
        });
        const tagCount = uniqueHashtags.size;
        const scoreDiversity = normalize(tagCount, 1, 15); // 해시태그 15개 이상 사용 시 만점

        return [
            { subject: '다작 성실', A: Math.round(scoreDiligence), raw: `작품당 ${daysPerCharStr}` },
            { subject: '캐릭터 평균 대화', A: Math.round(scoreTraffic), raw: `${Math.round(avgInteractions).toLocaleString()}회` },
            { subject: '유저 몰입', A: Math.round(scoreRegen), raw: `${((regenRatio - 1) * 100).toFixed(1)}% 리롤` },
            { subject: '오픈소스', A: Math.round(scoreOpenness), raw: `${(openRatio * 100).toFixed(1)}% 공개` },
            { subject: '다양성', A: Math.round(scoreDiversity), raw: `${tagCount}개 장르` },
        ];
    }, [stats, characters]);

    if (data.length === 0) return null;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const { subject, A, raw } = payload[0].payload;
            let desc = '';
            if (subject === '다작 성실') desc = '업로드 평균 페이스입니다.';
            if (subject === '캐릭터 평균 대화') desc = '캐릭터 1개당 평균 대화량입니다.';
            if (subject === '유저 몰입') desc = '답변 리롤(Regen) 비율입니다.';
            if (subject === '오픈소스') desc = '상세 설정 공개 비율입니다.';
            if (subject === '다양성') desc = '다루는 장르(해시태그) 스펙트럼입니다.';

            return (
                <div className="bg-[var(--card)] border border-[var(--border)] p-2.5 rounded-lg shadow-xl text-xs z-50 min-w-[140px]">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-[var(--accent)]">{subject}</span>
                        <span className="font-mono text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
                            {A}점
                        </span>
                    </div>
                    <p className="text-[var(--text-primary)] font-bold mb-1.5 text-sm">{raw}</p>
                    <p className="text-[var(--text-secondary)] opacity-80 text-[10px] leading-relaxed">{desc}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[220px] sm:h-[260px] animate-fade-in relative z-10" style={{ pointerEvents: 'auto' }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
                    <PolarGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Radar
                        name="스탯"
                        dataKey="A"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fill="url(#colorGradient)"
                        fillOpacity={0.6}
                    />
                    <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                        </linearGradient>
                    </defs>
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
