import React, { useMemo, useState, useEffect } from 'react';
import { formatNumber, toKST } from '../utils/tierCalculator';
import { computeEarnedTitles } from '../data/badges';
import { Globe, Crown, Medal, BarChart3, Tag, PartyPopper, TrendingUp, MessageCircle, Users, CalendarDays, Layers, ChevronRight } from 'lucide-react';
import { proxyImageUrl } from '../utils/imageUtils';

// ===== 격려 배너 — 가장 가까운 미획득 칭호 2개 표시 =====
export function EncouragementBanner({ characters, stats }) {
    const near = useMemo(() => {
        const all = computeEarnedTitles({ characters, stats });
        return all
            .filter(t => !t.earned && t.progress && t.progress.max > 0)
            .map(t => ({ ...t, ratio: t.progress.current / t.progress.max }))
            .sort((a, b) => b.ratio - a.ratio)
            .slice(0, 2);
    }, [characters, stats]);

    if (near.length === 0) return null;

    return (
        <div className="stagger-1 glass-card-sm p-4 border border-[var(--accent)]/20">
            <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <TrendingUp size={11} /> 이 칭호들이 가까워요
            </p>
            <div className="space-y-2.5">
                {near.map(t => (
                    <div key={t.title} className="flex items-center gap-3">
                        <span className="text-lg shrink-0">{t.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[12px] font-bold text-white/80 truncate">{t.title}</span>
                                <span className="text-[10px] text-[var(--accent)] font-mono shrink-0 ml-2">
                                    {Math.round(t.ratio * 100)}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${Math.round(t.ratio * 100)}%`,
                                        background: `linear-gradient(to right, var(--accent), var(--accent-bright))`,
                                        transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                {t.progress.label}: {t.progress.current.toLocaleString()} / {t.progress.max.toLocaleString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}



// ===== 카테고리 정의 =====
const CATEGORIES = [
    {
        key: 'interaction',
        label: '대화량',
        icon: <MessageCircle size={13} className="text-amber-400" />,
        color: 'text-amber-400',
    },
    {
        key: 'char_interaction',
        label: '캐릭터',
        icon: <TrendingUp size={13} className="text-teal-400" />,
        color: 'text-teal-400',
    },
    {
        key: 'follower',
        label: '팔로워',
        icon: <Users size={13} className="text-blue-400" />,
        color: 'text-blue-400',
    },
    {
        key: 'tag',
        label: '태그',
        icon: <Tag size={13} className="text-violet-400" />,
        color: 'text-violet-400',
    },
    {
        key: 'creation',
        label: '제작 이력',
        icon: <Layers size={13} className="text-lime-400" />,
        color: 'text-lime-400',
    },
    {
        key: 'activity',
        label: '활동 기간',
        icon: <CalendarDays size={13} className="text-cyan-400" />,
        color: 'text-cyan-400',
    },
];


// ===== 칭호/랭킹 탭 (단일 소스: src/data/badges.js) =====
export default function AchievementsTab({ stats, characters }) {
    const titles = useMemo(
        () => computeEarnedTitles({ characters, stats }),
        [characters, stats]
    );

    // 진행 바 마운트 애니메이션용
    const [barReady, setBarReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setBarReady(true), 100);
        return () => clearTimeout(t);
    }, []);

    const [rankingUpdatedAt, setRankingUpdatedAt] = useState(null);
    useEffect(() => {
        fetch('/data/ranking_latest.json')
            .then(res => res.json())
            .then(data => {
                if (data && data.updatedAt) setRankingUpdatedAt(toKST(data.updatedAt));
            })
            .catch(() => {});
    }, []);

    // 랭킹 캐릭터 계산 (파생 값 — useMemo)
    const rankedChars = useMemo(() =>
        (characters || [])
            .filter(c => c.trendingRank != null || c.bestRank != null || c.newRank != null)
            .sort((a, b) => {
                const ar = Math.min(...[a.trendingRank, a.bestRank, a.newRank].filter(x => x != null));
                const br = Math.min(...[b.trendingRank, b.bestRank, b.newRank].filter(x => x != null));
                return ar - br;
            })
    , [characters]);

    const earned = titles.filter(t => t.earned);
    const totalCount = titles.length;

    // 색상 매핑
    const colorMap = {
        pink: { bg: 'bg-pink-500/15', border: 'border-pink-400/30', text: 'text-pink-300', dot: 'bg-pink-400' },
        red: { bg: 'bg-red-500/15', border: 'border-red-400/30', text: 'text-red-300', dot: 'bg-red-400' },
        blue: { bg: 'bg-blue-500/15', border: 'border-blue-400/30', text: 'text-blue-300', dot: 'bg-blue-400' },
        emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
        yellow: { bg: 'bg-yellow-500/15', border: 'border-yellow-400/30', text: 'text-yellow-300', dot: 'bg-yellow-400' },
        amber: { bg: 'bg-amber-500/15', border: 'border-amber-400/30', text: 'text-amber-300', dot: 'bg-amber-400' },
        cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-400/30', text: 'text-cyan-300', dot: 'bg-cyan-400' },
        violet: { bg: 'bg-violet-500/15', border: 'border-violet-400/30', text: 'text-violet-300', dot: 'bg-violet-400' },
        indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-400/30', text: 'text-indigo-300', dot: 'bg-indigo-400' },
        purple: { bg: 'bg-purple-500/15', border: 'border-purple-400/30', text: 'text-purple-300', dot: 'bg-purple-400' },
        slate: { bg: 'bg-slate-500/15', border: 'border-slate-400/30', text: 'text-slate-300', dot: 'bg-slate-400' },
        teal: { bg: 'bg-teal-500/15', border: 'border-teal-400/30', text: 'text-teal-300', dot: 'bg-teal-400' },
        orange: { bg: 'bg-orange-500/15', border: 'border-orange-400/30', text: 'text-orange-300', dot: 'bg-orange-400' },
        sky: { bg: 'bg-sky-500/15', border: 'border-sky-400/30', text: 'text-sky-300', dot: 'bg-sky-400' },
        rose: { bg: 'bg-rose-500/15', border: 'border-rose-400/30', text: 'text-rose-300', dot: 'bg-rose-400' },
        lime: { bg: 'bg-lime-500/15', border: 'border-lime-400/30', text: 'text-lime-300', dot: 'bg-lime-400' },
    };

    const renderTitle = (t) => {
        const isGradient = t.color === 'gradient';
        const c = colorMap[t.color] || colorMap.slate;

        // 순애 ↔ NTR 상호 배타 이스터에그
        const easterEgg = t.id === 'sunae'
            ? '순애의 지조를 잃지 말아 주세요.'
            : t.id === 'ntr'
            ? '순애기사가 당신을 기억할 것입니다'
            : null;

        return (
            <div
                key={t.title}
                className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all overflow-hidden ${t.earned
                    ? isGradient
                        ? 'border-purple-400/30 shadow-sm'
                        : `${c.bg} ${c.border} shadow-sm`
                    : 'bg-[var(--bg-secondary)]/30 border-white/[0.08] opacity-50'
                    }`}
                style={t.earned && isGradient ? { background: 'linear-gradient(135deg, rgba(74,127,255,0.15), rgba(59,130,246,0.15))' } : {}}
            >
                <div className={`text-xl shrink-0 mt-0.5 ${!t.earned ? 'grayscale' : ''}`}>{t.emoji}</div>
                <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-bold leading-tight ${t.earned ? (isGradient ? 'text-blue-300' : c.text) : 'text-white/40'}`}>
                        {t.title}
                        {(t.id === 'sunae' || t.id === 'ntr') && t.earned && (
                            <span className="ml-1.5 text-[11px] opacity-60">🔒</span>
                        )}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
                        {t.desc}
                    </div>
                    {/* 진행도 바 (미획득 + progress 있는 경우) */}
                    {!t.earned && t.progress && (
                        <div className="mt-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-white/30">{t.progress.label}</span>
                                <span className="text-[10px] text-white/40 font-mono">
                                    {t.progress.current.toLocaleString()} / {t.progress.max.toLocaleString()}
                                </span>
                            </div>
                            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-[var(--accent)]"
                                    style={{
                                        width: barReady ? `${Math.min(100, (t.progress.current / t.progress.max) * 100)}%` : '0%',
                                        opacity: 0.7,
                                        transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
                {t.earned && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isGradient ? '' : c.dot}`}
                        style={isGradient ? { background: 'linear-gradient(135deg, #4A7FFF, #3B82F6)' } : {}}
                    >
                        <span className="text-white text-[10px] font-bold">✓</span>
                    </div>
                )}
                {/* 이스터에그 호버 오버레이 (순애 / NTR) */}
                {easterEgg && (
                    <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                        style={{
                            background: t.id === 'sunae'
                                ? 'rgba(236,72,153,0.85)'
                                : 'rgba(220,38,38,0.85)',
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        <p style={{
                            fontFamily: '"Nanum Myeongjo", "Noto Serif KR", "Apple Myungjo", "Batang", Georgia, serif',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.95)',
                            textAlign: 'center',
                            padding: '0 12px',
                            letterSpacing: '0.04em',
                            lineHeight: 1.6,
                        }}>
                            {easterEgg}
                        </p>
                    </div>
                )}
            </div>
        );
    };


    // 랭킹 카드 색상
    const rankCardStyle = (idx) => {
        if (idx === 0) return {
            background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(234,179,8,0.10))',
            border: '1px solid rgba(251,191,36,0.30)',
        };
        if (idx === 1) return {
            background: 'linear-gradient(135deg, rgba(203,213,225,0.15), rgba(148,163,184,0.08))',
            border: '1px solid rgba(203,213,225,0.25)',
        };
        if (idx === 2) return {
            background: 'linear-gradient(135deg, rgba(217,119,6,0.18), rgba(180,83,9,0.10))',
            border: '1px solid rgba(217,119,6,0.30)',
        };
        return {
            background: 'linear-gradient(135deg, rgba(109,40,217,0.12), rgba(37,99,235,0.10))',
            border: '1px solid rgba(109,40,217,0.20)',
        };
    };

    const rankBadgeColor = (idx) => {
        if (idx === 0) return 'text-yellow-400';
        if (idx === 1) return 'text-slate-300';
        if (idx === 2) return 'text-orange-500';
        return 'text-violet-400';
    };

    const rankIcon = (idx) => {
        if (idx === 0) return <Crown size={14} className="text-yellow-400" fill="currentColor" />;
        if (idx === 1) return <Medal size={14} className="text-slate-300" fill="currentColor" />;
        if (idx === 2) return <Medal size={14} className="text-orange-500" fill="currentColor" />;
        return <span className="text-[11px] font-black text-violet-400">#{idx + 1}</span>;
    };

    return (
        <div className="space-y-5 pb-8">
            {/* 격려 배너 */}
            <EncouragementBanner characters={characters} stats={stats} />


            {/* 칭호 총 진행도 */}
            <div className="stagger-2 glass-card-sm p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Tag size={14} className="text-[var(--text-tertiary)]" /> <span>칭호</span>
                    </h3>
                    <span className="text-xs font-mono text-[var(--accent)] font-bold">{earned.length} / {totalCount}</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--accent)] to-indigo-400 rounded-full transition-all duration-700"
                        style={{ width: `${totalCount > 0 ? (earned.length / totalCount) * 100 : 0}%` }}
                    />
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-medium flex items-center gap-1.5">
                    {earned.length === totalCount && totalCount > 0
                        ? <><PartyPopper size={12} className="text-yellow-400" /> 모든 칭호를 획득하셨습니다!</>
                        : `${totalCount - earned.length}개의 칭호를 더 획득할 수 있습니다.`
                    }
                </p>
            </div>

            {/* 카테고리별 칭호 목록 */}
            {CATEGORIES.map((cat, ci) => {
                const catTitles = titles.filter(t => t.category === cat.key);
                if (catTitles.length === 0) return null;
                const catEarned = catTitles.filter(t => t.earned);
                const sorted = [...catTitles.filter(t => t.earned), ...catTitles.filter(t => !t.earned)];

                return (
                    <div key={cat.key} className={`stagger-${ci + 3}`}>
                        {/* 카테고리 헤더 */}
                        <div className="flex items-center gap-2 mb-2 px-1">
                            {cat.icon}
                            <span className={`text-[12px] font-bold ${cat.color} uppercase tracking-wider`}>{cat.label}</span>
                            <span className="text-[10px] font-mono text-[var(--text-tertiary)] ml-auto">
                                {catEarned.length}/{catTitles.length}
                            </span>
                        </div>
                        {/* 칭호 리스트 — 카드 내 카드 없이 직접 그리드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sorted.map(renderTitle)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
