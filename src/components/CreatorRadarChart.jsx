import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

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
            // Find earliest and latest dates
            const dates = characters.map(c => new Date(c.createdAt || c.createdDate)).filter(d => !isNaN(d));
            if (dates.length > 0) {
                const earliest = new Date(Math.min(...dates));
                const latest = new Date(Math.max(...dates));
                const activityDays = Math.max(1, (latest - earliest) / (1000 * 60 * 60 * 24));
                const daysPerChar = activityDays / plotCount;
                daysPerCharStr = `${daysPerChar.toFixed(1)}일`;

                // 14 days = 50 pts, 3 days = 100 pts. 
                // score = 100 - (daysPerChar - 3) * (50 / 11)
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

        // 3. 소통 규모 (Traffic)
        const interactions = stats.plotInteractionCount || 0;
        const scoreTraffic = normalize(interactions, 10000, 10000000);

        // 4. 오픈소스 (Openness)
        let openCount = 0;
        characters.forEach(c => {
            if (c.isLongDescriptionPublic || c.isExampleConversationPublic || c.isAboutPublic) {
                openCount++;
            }
        });
        const openRatio = plotCount > 0 ? (openCount / plotCount) : 0;
        const scoreOpenness = normalize(openRatio, 0, 0.5); // 50% 이상 공개면 만점

        // 5. 정성 (Dedication)
        let totalTextLen = 0;
        characters.forEach(c => {
            totalTextLen += (c.shortDescription || '').length;
            totalTextLen += (c.longDescription || '').length;
            totalTextLen += (c.creatorComment || '').length;
            if (c.intros && c.intros[0] && Array.isArray(c.intros[0].conversation)) {
                c.intros[0].conversation.forEach(msg => {
                    totalTextLen += (msg.text || '').length;
                });
            }
        });
        const avgTextLen = plotCount > 0 ? (totalTextLen / plotCount) : 0;
        const scoreDedication = normalize(avgTextLen, 50, 600); // 평균 600자면 만점

        return [
            { subject: '다작 성실', A: Math.round(scoreDiligence), raw: `작품당 ${daysPerCharStr}` },
            { subject: '소통 규모', A: Math.round(scoreTraffic), raw: `${interactions.toLocaleString()}회` },
            { subject: '유저 몰입', A: Math.round(scoreRegen), raw: `${((regenRatio - 1) * 100).toFixed(1)}% 리롤` },
            { subject: '오픈소스', A: Math.round(scoreOpenness), raw: `${(openRatio * 100).toFixed(1)}% 공개` },
            { subject: '정성', A: Math.round(scoreDedication), raw: `평균 ${Math.round(avgTextLen)}자` },
        ];
    }, [stats, characters]);

    if (data.length === 0) return null;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const { subject, A, raw } = payload[0].payload;
            let desc = '';
            if (subject === '다작 성실') desc = '활동 기간 내 캐릭터를 업로드하는 평균 페이스입니다.';
            if (subject === '소통 규모') desc = '유저들과 나눈 대화의 압도적인 규모입니다.';
            if (subject === '유저 몰입') desc = '유저가 답변을 리롤(Regen)하며 몰입하는 비율입니다.';
            if (subject === '오픈소스') desc = '세부 설정 및 대화 예시를 공개한 열린 생태계 기여도입니다.';
            if (subject === '정성') desc = '캐릭터 프로필과 인사말의 텍스트 밀도와 디테일입니다.';

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
