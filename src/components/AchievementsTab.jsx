import React, { useMemo } from 'react';
import { formatNumber } from '../utils/tierCalculator';
import { computeEarnedTitles } from '../data/badges';

// ===== 격려 메시지 (카드 위에 표시) =====
export function EncouragementBanner({ tier, characters, stats }) {
    const totalInteractions = stats?.plotInteractionCount || 0;
    const followers = stats?.followerCount || 0;

    const title = tier.key === 'champion' || tier.key === 'master'
        ? '🏆 돼지 합격!'
        : tier.key === 'diamond' || tier.key === 'platinum'
            ? '🌟 대화량이 돈이었으면 좋겠네요 :3'
            : tier.key === 'gold'
                ? '✨ 점점 많은 사람들이 당신의 캐릭터를 만나고 있습니다!'
                : tier.key === 'silver'
                    ? '🌿 착실하게 성장하고 있어요!'
                    : '🌱 모든 제작자들도, 여기서 시작했습니다. 무한한 가능성이 있어요.';

    const isHighTier = ['diamond', 'master', 'champion'].includes(tier.key);
    const formattedInt = formatNumber(totalInteractions);
    const formattedFollowers = formatNumber(followers);

    const message = isHighTier
        ? `지금까지 ${formattedInt}회의 대화와 ${formattedFollowers}명의 팔로워를 기록하며 엄청난 영향력을 보여주고 계시네요!`
        : `지금까지 총 ${formattedInt}회의 대화를 통해 많은 사람들에게 즐거움을 전해주셨습니다.`;

    return (
        <div className="px-3 py-2.5 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/15">
            <p className="text-xs text-[var(--accent)] font-bold">{title}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed font-medium">
                {message}
            </p>
        </div>
    );
}

// ===== 칭호/랭킹 탭 (단일 소스: src/data/badges.js) =====
export default function AchievementsTab({ stats, characters }) {
    const titles = useMemo(
        () => computeEarnedTitles({ characters, stats }),
        [characters, stats]
    );

    const earned = titles.filter(t => t.earned);
    const unearned = titles.filter(t => !t.earned);

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

        return (
            <div
                key={t.title}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${t.earned
                    ? isGradient
                        ? 'border-purple-400/30 shadow-sm'
                        : `${c.bg} ${c.border} shadow-sm`
                    : 'bg-[var(--bg-secondary)]/30 border-[var(--border)] opacity-40 grayscale'
                    }`}
                style={t.earned && isGradient ? { background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))' } : {}}
            >
                <div className="text-xl shrink-0 mt-0.5">{t.emoji}</div>
                <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold leading-tight ${t.earned ? (isGradient ? 'text-purple-300' : c.text) : 'text-[var(--text-tertiary)]'}`}>
                        {t.title}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
                        {t.desc}
                    </div>
                </div>
                {t.earned && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isGradient ? '' : c.dot}`}
                        style={isGradient ? { background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' } : {}}
                    >
                        <span className="text-white text-[10px] font-bold">✓</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-fade-in-up pb-8">
            {/* 글로벌 랭킹 섹션 */}
            {(() => {
                const ranked = (characters || [])
                    .filter(c => c.trendingRank != null || c.bestRank != null || c.newRank != null)
                    .sort((a, b) => {
                        const ar = Math.min(...[a.trendingRank, a.bestRank, a.newRank].filter(x => x != null));
                        const br = Math.min(...[b.trendingRank, b.bestRank, b.newRank].filter(x => x != null));
                        return ar - br;
                    });
                return (
                    <div className="card p-4">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
                            🌐 <span>글로벌 랭킹</span>
                        </h3>
                        {ranked.length > 0 ? (
                            <div className="space-y-2">
                                {ranked.map(char => (
                                    <div key={char.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-[var(--text-primary)] truncate mb-1">{char.name}</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {char.trendingRank != null && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300">
                                                        트렌딩 #{char.trendingRank}
                                                        {char.rankDiff !== 0 && <span className={char.rankDiff > 0 ? ' text-emerald-400' : ' text-red-400'}> {char.rankDiff > 0 ? '▲' : '▼'}{Math.abs(char.rankDiff)}</span>}
                                                    </span>
                                                )}
                                                {char.bestRank != null && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300">
                                                        베스트 #{char.bestRank}
                                                    </span>
                                                )}
                                                {char.newRank != null && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                                                        신작 #{char.newRank}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-bold text-[var(--accent-bright)]">{formatNumber(char.interactionCount || 0)}</div>
                                            <div className="text-[10px] text-[var(--text-tertiary)]">대화</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-3xl mb-2">📊</p>
                                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                                    현재 트렌딩 · 베스트 · 신작<br />랭킹에 진입한 캐릭터가 없습니다
                                </p>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* 칭호 요약 */}
            <div className="card p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        🏷️ <span>칭호</span>
                    </h3>
                    <span className="text-xs font-mono text-[var(--accent)] font-bold">{earned.length} / {titles.length}</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--accent)] to-purple-400 rounded-full transition-all duration-700"
                        style={{ width: `${titles.length > 0 ? (earned.length / titles.length) * 100 : 0}%` }}
                    />
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-medium">
                    {earned.length === titles.length && titles.length > 0
                        ? '🎉 모든 칭호를 획득하셨습니다!'
                        : `${titles.length - earned.length}개의 칭호를 더 획득할 수 있습니다.`
                    }
                </p>
            </div>

            {/* 획득한 칭호 */}
            {earned.length > 0 && (
                <div className="card p-4 sm:p-5">
                    <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                        ✅ 획득한 칭호 <span className="text-[var(--accent)]">({earned.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                        {earned.map(renderTitle)}
                    </div>
                </div>
            )}

            {/* 미획득 칭호 */}
            {unearned.length > 0 && (
                <div className="card p-4 sm:p-5">
                    <h4 className="text-xs font-bold text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
                        🔒 미획득 칭호 <span className="opacity-60">({unearned.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                        {unearned.map(renderTitle)}
                    </div>
                </div>
            )}
        </div>
    );
}
