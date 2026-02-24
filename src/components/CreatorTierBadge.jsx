import React, { useState } from 'react';

export default function CreatorTierBadge({ tier, stats, score: propScore, breakdown, tierMode }) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!tier) return null;

    const score = propScore ?? (stats?.plotInteractionCount || 0);

    // 다음 목표(세부 티어)까지의 진행률
    const nextGoalLabel = tier.nextGoalLabel || (tier.nextTier ? tier.nextTier.name : 'Max');
    const nextGoalScore = tier.nextGoalScore || (tier.nextTier ? tier.nextTier.min : 0);
    const remaining = (nextGoalScore - score).toLocaleString();
    const progressPercent = tier.subProgress ?? tier.progress;

    // 티어별 스타일 설정
    const getTierStyle = (key) => {
        switch (key) {
            case 'unranked':
                return {
                    stops: [
                        { offset: '0%', color: '#2D3748' },
                        { offset: '100%', color: '#1A202C' }
                    ],
                    stroke: '#718096',
                    strokeDasharray: '6, 4',
                    strokeWidth: 2,
                    glow: false
                };
            case 'bronze':
                return {
                    stops: [
                        { offset: '0%', color: '#E8C39E' },
                        { offset: '50%', color: '#CD7F32' },
                        { offset: '100%', color: '#8B4513' }
                    ],
                    stroke: '#8B4513',
                    glow: false
                };
            case 'silver':
                return {
                    stops: [
                        { offset: '0%', color: '#F5F5F5' },
                        { offset: '50%', color: '#C0C0C0' },
                        { offset: '100%', color: '#757575' }
                    ],
                    stroke: '#757575',
                    glow: false
                };
            case 'gold':
                return {
                    stops: [
                        { offset: '0%', color: '#FFF9C4' },
                        { offset: '50%', color: '#FFD700' },
                        { offset: '100%', color: '#B8860B' }
                    ],
                    stroke: '#B8860B',
                    glow: true,
                    glowColor: 'rgba(255, 215, 0, 0.4)'
                };
            case 'platinum':
                return {
                    stops: [
                        { offset: '0%', color: '#E0F7FA' },
                        { offset: '50%', color: '#26C6DA' },
                        { offset: '100%', color: '#006064' }
                    ],
                    stroke: '#006064',
                    glow: true,
                    glowColor: 'rgba(38, 198, 218, 0.4)'
                };
            case 'diamond':
                return {
                    stops: [ // Sky to Purple
                        { offset: '0%', color: '#81D4FA' }, // Sky
                        { offset: '50%', color: '#9575CD' }, // Purple
                        { offset: '100%', color: '#4A148C' }  // Dark Purple
                    ],
                    stroke: '#4A148C',
                    glow: true,
                    glowColor: 'rgba(149, 117, 205, 0.5)'
                };
            case 'master':
                return {
                    stops: [ // Beige/Gold inner
                        { offset: '0%', color: '#FFF8E1' },
                        { offset: '50%', color: '#FFE0B2' },
                        { offset: '100%', color: '#FFB74D' }
                    ],
                    stroke: '#FFD700', // Gold Border
                    strokeWidth: 3,
                    glow: true,
                    glowColor: 'rgba(255, 215, 0, 0.6)'
                };
            case 'champion':
                return {
                    stops: [ // Red
                        { offset: '0%', color: '#FFEBEE' },
                        { offset: '50%', color: '#E57373' },
                        { offset: '100%', color: '#B71C1C' }
                    ],
                    stroke: '#FF5252',
                    strokeWidth: 3,
                    glow: true,
                    glowColor: 'rgba(255, 82, 82, 0.7)'
                };
            default:
                return {
                    stops: [{ offset: '0%', color: '#ccc' }, { offset: '100%', color: '#666' }],
                    stroke: '#666',
                    glow: false
                };
        }
    };

    const style = getTierStyle(tier.key);

    // 티어별 한글명
    const tierKoNames = {
        unranked: 'Unranked',
        bronze: '브론즈',
        silver: '실버',
        gold: '골드',
        platinum: '플래티넘',
        diamond: '다이아몬드',
        master: '마스터',
        champion: '챔피언'
    };

    // 티어별 모양 (SVG Path)
    const getTierShape = (key) => {
        if (key === 'champion') {
            // 각진 날개 모양 (Angled Wings / Gundam V-Fin style crest)
            // Center is roughly 50,50.
            return "M50 2 L20 15 L2 5 L2 45 L25 75 L50 98 L75 75 L98 45 L98 5 L80 15 Z";
        } else {
            // Master & Others (including Unranked): Regular Hexagon (Diamond shape)
            return "M50 5 L95 27.5 L95 72.5 L50 95 L5 72.5 L5 27.5 Z";
        }
    };

    const shapePath = getTierShape(tier.key);
    const isHighTier = ['master', 'champion'].includes(tier.key);

    return (
        <div
            className="relative flex items-center justify-center cursor-help group"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {/* 스파크 효과 (마스터 이상) */}
            {isHighTier && (
                <>
                    <div className="absolute top-0 left-0 w-full h-full animate-spin-slow opacity-50 pointer-events-none">
                        <div className="sparkle w-1 h-1 top-2 right-4" style={{ animationDelay: '0s' }} />
                        <div className="sparkle w-1.5 h-1.5 bottom-3 left-2" style={{ animationDelay: '1s' }} />
                        <div className="sparkle w-1 h-1 top-10 -right-2" style={{ animationDelay: '0.5s' }} />
                    </div>
                </>
            )}

            {/* SVG 크기 */}
            <svg
                width="64"
                height="64"
                viewBox="0 0 100 100"
                className={`transition-all duration-300 transform hover:scale-110 ${style.glow ? 'drop-shadow-lg' : 'drop-shadow-md'}`}
                style={style.glow ? { filter: `drop-shadow(0 0 10px ${style.glowColor})` } : {}}
            >
                <defs>
                    <linearGradient id={`grad-${tier.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        {style.stops.map((stop, i) => (
                            <stop key={i} offset={stop.offset} stopColor={stop.color} />
                        ))}
                    </linearGradient>
                </defs>

                {/* 모양 */}
                <path
                    d={shapePath}
                    fill={`url(#grad-${tier.key})`}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth || 2}
                    strokeDasharray={style.strokeDasharray}
                />

                {/* 내부 고리 */}
                <circle
                    cx="50"
                    cy="50"
                    r={isHighTier ? 25 : 30}
                    fill="rgba(0,0,0,0.15)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={isHighTier ? 2 : 1}
                />

                {/* 세부 티어 숫자 */}
                {tier.subdivision && (
                    <text
                        x="50"
                        y={isHighTier ? "80" : "82"}
                        textAnchor="middle"
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.6)' }}
                    >
                        {tier.subdivision}
                    </text>
                )}

                {/* 티어 이니셜 */}
                <text
                    x="50"
                    y={tier.subdivision ? (isHighTier ? "55" : "55") : "60"}
                    textAnchor="middle"
                    fill="white"
                    fontSize="26"
                    fontWeight="900"
                    style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.6)' }}
                >
                    {tier.key[0].toUpperCase()}
                </text>
            </svg>

            {/* 툴팁 */}
            {showTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-3 bg-[rgba(20,20,30,0.95)] backdrop-blur-md border border-[var(--border)] rounded-xl shadow-xl z-50 text-white animate-fade-in-up">
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-8 border-transparent border-b-[rgba(20,20,30,0.95)]"></div>

                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                        <span className="font-bold text-base" style={{ color: style.stops[1].color }}>
                            {tierKoNames[tier.key]} {tier.subdivision || ''}
                        </span>
                    </div>

                    {/* ELO 점수 강조 표시 */}
                    <div className="mb-3 text-center py-2 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[10px] text-gray-400 mb-0.5">ELO Score</div>
                        <div className="text-xl font-black font-mono" style={{ color: style.stops[1].color }}>
                            {score.toLocaleString()}
                        </div>
                    </div>


                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-400">총 대화 (×3)</span>
                            <span className="font-mono text-white">{(breakdown?.interactions || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">팔로워 (×300)</span>
                            <span className="font-mono text-white">{(breakdown?.followers || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">캐릭터 평균 (×20)</span>
                            <span className="font-mono text-white">
                                {Math.floor(breakdown?.avgInteractions || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">음성 (분) (×100)</span>
                            <span className="font-mono text-white">{(breakdown?.voicePlays || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-gray-500 text-center">
                        * Top 20 보너스 ({((breakdown?.top20Sum || 0) * 0.5).toLocaleString()}점) 포함
                    </div>

                    {tier.nextTier && (
                        <div className="pt-2 mt-1 border-t border-white/10">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>다음: {nextGoalLabel.replace(tier.name, tierKoNames[tier.key] || tier.name)}</span>
                                <span>{remaining}점 남음</span>
                            </div>
                            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--accent)]" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                    )}

                    <p className="text-[10px] text-gray-400 mt-2 border-t border-white/10 pt-2">
                        <span className="font-bold text-[var(--accent)]">점수 산정 기준:</span><br />
                        '(대화량×3) + (팔로워×300) + (Top20 50%) + (평균×20) + (음성×100)'
                    </p>
                </div>
            )}
        </div>
    );
}
