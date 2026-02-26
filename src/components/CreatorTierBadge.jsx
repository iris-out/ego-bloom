import React, { useState } from 'react';

export default function CreatorTierBadge({ tier, stats, score: propScore, breakdown, tierMode }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [showModal, setShowModal] = useState(false);

    if (!tier) return null;

    const score = propScore ?? (stats?.plotInteractionCount || 0);

    // 다음 목표(세부 티어)까지의 진행률
    const nextGoalLabel = tier.nextGoalLabel || (tier.nextTier ? tier.nextTier.name : 'Max');
    const nextGoalScore = tier.nextGoalScore || (tier.nextTier ? tier.nextTier.min : 0);
    const remaining = (nextGoalScore - score).toLocaleString();
    const progressPercent = tier.subProgress ?? tier.progress;

    const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
    const subdivisionRoman = romanMap[tier.subdivision] || tier.subdivision;

    // 티어별 스타일 설정
    const getTierStyle = (key) => {
        switch (key) {
            case 'unranked':
                return {
                    stops: [{ offset: '0%', color: '#2D3748' }, { offset: '100%', color: '#1A202C' }],
                    stroke: '#718096', glow: false
                };
            case 'bronze':
                return {
                    stops: [{ offset: '0%', color: '#E8C39E' }, { offset: '50%', color: '#CD7F32' }, { offset: '100%', color: '#8B4513' }],
                    stroke: '#8B4513', glow: false
                };
            case 'silver':
                return {
                    stops: [{ offset: '0%', color: '#F5F5F5' }, { offset: '50%', color: '#C0C0C0' }, { offset: '100%', color: '#757575' }],
                    stroke: '#757575', glow: false
                };
            case 'gold':
                return {
                    stops: [{ offset: '0%', color: '#FFF9C4' }, { offset: '50%', color: '#FFD700' }, { offset: '100%', color: '#B8860B' }],
                    stroke: '#B8860B', glow: true, glowColor: 'rgba(255, 215, 0, 0.35)'
                };
            case 'platinum':
                return {
                    stops: [{ offset: '0%', color: '#E0F7FA' }, { offset: '50%', color: '#26C6DA' }, { offset: '100%', color: '#006064' }],
                    stroke: '#006064', glow: true, glowColor: 'rgba(38, 198, 218, 0.35)'
                };
            case 'diamond':
                return {
                    stops: [{ offset: '0%', color: '#81D4FA' }, { offset: '50%', color: '#9575CD' }, { offset: '100%', color: '#4A148C' }],
                    stroke: '#4A148C', glow: true, glowColor: 'rgba(149, 117, 205, 0.4)'
                };
            case 'master':
                return {
                    stops: [{ offset: '0%', color: '#FFF8E1' }, { offset: '50%', color: '#FFE0B2' }, { offset: '100%', color: '#FFB74D' }],
                    stroke: '#FFD700', glow: true, glowColor: 'rgba(255, 215, 0, 0.45)'
                };
            case 'champion':
                return {
                    stops: [{ offset: '0%', color: '#FFEBEE' }, { offset: '50%', color: '#E57373' }, { offset: '100%', color: '#B71C1C' }],
                    stroke: '#FF5252', glow: true, glowColor: 'rgba(255, 82, 82, 0.5)'
                };
            default:
                return { stops: [{ offset: '0%', color: '#ccc' }, { offset: '100%', color: '#666' }], stroke: '#666', glow: false };
        }
    };

    const style = getTierStyle(tier.key);
    const tierKoNames = { unranked: 'Unranked', bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', diamond: '다이아몬드', master: '마스터', champion: '챔피언' };

    const renderTierLayers = (key, style) => {
        const glowFilter = style.glow ? `url(#glow-${key})` : 'none';
        switch (key) {
            case 'unranked':
            case 'bronze':
                return (
                    <g filter={glowFilter}>
                        <path d="M25 10 L75 10 L75 55 C75 80 50 95 50 95 C50 95 25 80 25 55 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        <path d="M32 18 L68 18 L68 50 C68 70 50 82 50 82 C50 82 32 70 32 50 Z" fill="rgba(0,0,0,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                    </g>
                );
            case 'silver':
                return (
                    <g filter={glowFilter}>
                        <path d="M15 10 L85 10 L85 50 L50 98 L15 50 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        <path d="M25 18 L75 18 L75 48 L50 85 L25 48 Z" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                        <rect x="48" y="10" width="4" height="40" fill="rgba(255,255,255,0.1)" />
                    </g>
                );
            case 'gold':
                return (
                    <g filter={glowFilter}>
                        <path d="M10 25 L30 10 L50 18 L70 10 L90 25 L90 65 C90 85 70 95 50 95 C30 95 10 85 10 65 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        <path d="M20 30 L35 18 L50 25 L65 18 L80 30 L80 60 C80 75 65 85 50 85 C35 85 20 75 20 60 Z" fill="rgba(0,0,0,0.2)" stroke="rgba(255,215,0,0.4)" strokeWidth="1.5" />
                    </g>
                );
            case 'platinum':
                return (
                    <g filter={glowFilter}>
                        <path d="M10 10 L90 10 L90 70 L50 95 L10 70 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        <path d="M20 20 L80 20 L80 65 L50 85 L20 65 Z" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <path d="M10 45 L90 45 M50 10 L50 95" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                    </g>
                );
            case 'diamond':
                return (
                    <g filter={glowFilter}>
                        <path d="M15 15 L50 2 L85 15 L95 55 L50 98 L5 55 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        <path d="M25 22 L50 10 L75 22 L83 52 L50 85 L17 52 Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                        <path d="M50 2 L50 98 M5 55 L95 55 M15 15 L85 15" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    </g>
                );
            case 'master':
                // 마스터: 이미지 기반 노란색 엠블렘 보강 (Filled Yellow Emblem)
                return (
                    <g filter={glowFilter}>
                        {/* 중앙 메인 프레임 (V 형상) */}
                        <path d="M50 35 L85 10 L95 15 L95 65 L50 95 L5 65 L5 15 L15 10 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        {/* 내부 채우기 (밀도 보강) */}
                        <path d="M50 45 L78 22 L83 25 L83 60 L50 85 L17 60 L17 25 L22 22 Z" fill="rgba(255, 215, 0, 0.15)" stroke="none" />
                        {/* 중앙 Notch 디테일 (메꿔진 느낌) */}
                        <path d="M50 35 L38 22 L38 55 L50 68 L62 55 L62 22 Z" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
                        {/* 상단 다이아몬드 심볼 */}
                        <path d="M50 3 L65 18 L50 33 L35 18 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        {/* 사이드 가드 빔 (더 두껍고 꽉 찬 느낌) */}
                        <path d="M20 38 L32 50 L32 78 L20 66 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="1.5" />
                        <path d="M80 38 L68 50 L68 78 L80 66 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="1.5" />
                    </g>
                );
            case 'champion':
                // 챔피언: 날개 달린 얼티밋 이지스 (Ultimate Aegis with Wings)
                return (
                    <g filter={glowFilter}>
                        {/* 사이드 날개 (Wings) */}
                        <path d="M25 35 L-5 20 L-15 45 L-5 70 L25 55" fill="rgba(255, 82, 82, 0.3)" stroke={style.stroke} strokeWidth="2" />
                        <path d="M75 35 L105 20 L115 45 L105 70 L75 55" fill="rgba(255, 82, 82, 0.3)" stroke={style.stroke} strokeWidth="2" />
                        {/* 베이스 방패 */}
                        <path d="M50 18 L25 5 L5 15 L5 65 C5 88 28 98 50 98 C72 98 95 88 95 65 L95 15 L75 5 Z" fill={`url(#grad-${key})`} stroke={style.stroke} strokeWidth="2.5" />
                        {/* 강화 내부 프레임 */}
                        <path d="M50 28 L32 18 L15 25 L15 62 C15 78 32 88 50 88 C68 88 85 78 85 62 L85 25 L68 18 Z" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                        <circle cx="50" cy="55" r="15" fill="none" />
                    </g>
                );
            default:
                return <path d="M25 10 L75 10 L75 55 C75 80 50 95 50 95 C50 95 25 80 25 55 Z" fill="#666" />;
        }
    };

    return (
        <div
            className="relative flex items-center justify-center cursor-help group z-[60]"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowModal(true)}
        >
            <svg width="80" height="80" viewBox="0 0 100 100" className="transition-all duration-500 transform group-hover:scale-110 object-visible z-10" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`grad-${tier.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        {style.stops.map((stop, i) => <stop key={i} offset={stop.offset} stopColor={stop.color} />)}
                    </linearGradient>
                    <filter id={`glow-${tier.key}`} x="-12%" y="-12%" width="124%" height="124%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor={style.glowColor || 'rgba(0,0,0,0.45)'} />
                    </filter>
                    <radialGradient id="core-glow-gold" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FFF" /><stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="core-glow-master" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FFF" /><stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="core-glow-champion" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FFF" /><stop offset="100%" stopColor="#FF5252" stopOpacity="0" />
                    </radialGradient>
                </defs>
                {renderTierLayers(tier.key, style)}
                {/* 세부 티어 숫자 바탕 (가독성 향상) */}
                {tier.subdivision && (
                    <circle cx="50" cy="82" r="9" fill="rgba(0,0,0,0.5)" />
                )}

                {/* 세부 티어 숫자 (로마 숫자) */}
                {tier.subdivision && (
                    <text
                        x="50"
                        y="86.5"
                        textAnchor="middle"
                        fill="white"
                        fontSize={subdivisionRoman.length > 2 ? "9" : "11"}
                        fontWeight="900"
                        style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.9)' }}
                    >
                        {subdivisionRoman}
                    </text>
                )}
                <text x="50" y={tier.subdivision ? "58" : "62"} textAnchor="middle" fill="white" fontSize="28" fontWeight="900" letterSpacing="-1" style={{ textShadow: '0px 2px 8px rgba(0,0,0,0.8)' }}>{tier.key === 'champion' ? 'C' : tier.key[0].toUpperCase()}</text>
            </svg>

            {showTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-4 bg-[rgba(20,20,30,0.98)] backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[9999] text-white animate-fade-in-up pointer-events-none">
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-8 border-transparent border-b-[rgba(20,20,30,0.98)]"></div>
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                        <span className="font-bold text-base" style={{ color: style.stops[1].color }}>{tierKoNames[tier.key]} {tier.subdivision || ''}</span>
                    </div>
                    <div className="mb-3 text-center py-2 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[10px] text-gray-400 mb-0.5">ELO Score</div>
                        <div className="text-xl font-black font-mono" style={{ color: style.stops[1].color }}>{score.toLocaleString()}</div>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-gray-400">총 대화 (×3)</span><span className="font-mono text-white">{(breakdown?.interactions || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">팔로워 (×300)</span><span className="font-mono text-white">{(breakdown?.followers || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">캐릭터 평균 (×20)</span><span className="font-mono text-white">{Math.floor(breakdown?.avgInteractions || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">음성 (분) (×100)</span><span className="font-mono text-white">{(breakdown?.voicePlays || 0).toLocaleString()}</span></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 border-t border-white/10 pt-2 italic text-center">클릭하여 상세 티어 가이드 보기</p>
                </div>
            )}

            {showModal && <TierInfoModal isOpen={showModal} onClose={() => setShowModal(false)} currentTier={tier} score={score} />}
        </div>
    );
}

function TierInfoModal({ isOpen, onClose, currentTier, score }) {
    if (!isOpen) return null;
    const TIER_GUIDE = [
        { key: 'unranked', name: 'Unranked', range: '0 ~ 99', color: '#718096' },
        { key: 'bronze', name: '브론즈', range: '100 ~ 999', color: '#CD7F32' },
        { key: 'silver', name: '실버', range: '1,000 ~ 2,999', color: '#C0C0C0' },
        { key: 'gold', name: '골드', range: '3,000 ~ 9,999', color: '#FFD700' },
        { key: 'platinum', name: '플래티넘', range: '10,000 ~ 29,999', color: '#26C6DA' },
        { key: 'diamond', name: '다이아몬드', range: '30,000 ~ 99,999', color: '#9575CD' },
        { key: 'master', name: '마스터', range: '100,000 ~ 499,999', color: '#FFB74D' },
        { key: 'champion', name: '챔피언', range: '500,000 이상', color: '#FF5252' },
    ];

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-[rgba(25,25,35,0.95)] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-zoom-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/5">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><span className="text-[var(--accent)]">🛡️</span> 크리에이터 티어 가이드</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <div className="space-y-3">
                        {[...TIER_GUIDE].reverse().map((t) => {
                            const isCurrent = currentTier?.key === t.key;
                            const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
                            const currentSubRoman = romanMap[currentTier?.subdivision] || '';

                            return (
                                <div key={t.key} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isCurrent ? 'bg-white/10 border-[var(--accent)]' : 'bg-white/5 border-transparent'}`}>
                                    <div className="shrink-0 scale-75"><StaticBadge tierKey={t.key} subdivision={isCurrent ? currentTier?.subdivision : null} /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-black text-lg" style={{ color: t.color }}>
                                                {t.name} {isCurrent && currentSubRoman}
                                            </span>
                                            {isCurrent && <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[8px] font-black text-white uppercase tracking-tighter">Current</span>}
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono tracking-tight">ELO Range: {t.range}</div>
                                    </div>
                                    {isCurrent && <div className="text-right"><div className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">My Score</div><div className="text-lg font-black font-mono text-[var(--accent)]">{score.toLocaleString()}</div></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="px-6 py-5 bg-black/40 border-t border-white/5 text-center">
                    <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 p-3 rounded-xl text-[11px] leading-relaxed text-gray-300 mb-4 text-left">
                        <span className="font-bold text-white block mb-1">💡 ELO 점수 산출 공식:</span>
                        (대화량 × 3) + (팔로워 × 300) + (Top 20 50%) + (평균 × 20) + (음성 × 100)
                    </div>
                    <button onClick={onClose} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/10">닫기</button>
                </div>
            </div>
        </div>
    );
}

function StaticBadge({ tierKey, subdivision }) {
    const shapes = {
        unranked: "M25 10 L75 10 L75 55 C75 80 50 95 50 95 C50 95 25 80 25 55 Z",
        bronze: "M25 10 L75 10 L75 55 C75 80 50 95 50 95 C50 95 25 80 25 55 Z",
        silver: "M15 10 L85 10 L85 50 L50 98 L15 50 Z",
        gold: "M10 25 L30 10 L50 18 L70 10 L90 25 L90 65 C90 85 70 95 50 95 C30 95 10 85 10 65 Z",
        platinum: "M10 10 L90 10 L90 70 L50 95 L10 70 Z",
        diamond: "M15 15 L50 2 L85 15 L95 55 L50 98 L5 55 Z",
        master: "M50 35 L85 10 L95 15 L95 65 L50 95 L5 65 L5 15 L15 10 Z",
        champion: "M50 18 L25 5 L5 15 L5 65 C5 88 28 98 50 98 C72 98 95 88 95 65 L95 15 L75 5 Z"
    };
    const colors = { unranked: '#2D3748', bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#26C6DA', diamond: '#9575CD', master: '#FFB74D', champion: '#FF5252' };
    const path = shapes[tierKey] || shapes.unranked;
    const color = colors[tierKey] || colors.unranked;
    const initial = tierKey === 'champion' ? 'C' : tierKey[0].toUpperCase();

    const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
    const subRoman = subdivision ? (romanMap[subdivision] || subdivision) : null;

    return (
        <svg width="60" height="60" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
            {tierKey === 'champion' && (
                <g opacity="0.5">
                    <path d="M25 35 L-5 20 L-15 45 L-5 70 L25 55" fill={color} />
                    <path d="M75 35 L105 20 L115 45 L105 70 L75 55" fill={color} />
                </g>
            )}
            {tierKey === 'master' && (
                <>
                    <path d="M50 45 L78 22 L83 25 L83 60 L50 85 L17 60 L17 25 L22 22 Z" fill="rgba(255, 215, 0, 0.2)" />
                    <path d="M50 3 L65 18 L50 33 L35 18 Z" fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                </>
            )}
            <path d={path} fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
            <text x="50" y={subRoman ? "58" : "62"} textAnchor="middle" fill="white" fontSize="28" fontWeight="900" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{initial}</text>

            {subRoman && (
                <>
                    <circle cx="50" cy="82" r="9" fill="rgba(0,0,0,0.5)" />
                    <text x="50" y="86" textAnchor="middle" fill="white" fontSize="9" fontWeight="900">{subRoman}</text>
                </>
            )}
        </svg>
    );
}
