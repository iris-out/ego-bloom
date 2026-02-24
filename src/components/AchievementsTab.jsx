import React, { useMemo } from 'react';
import { formatNumber } from '../utils/tierCalculator';
import mediaFranchises from '../data/mediaFranchises.json';

// 2차창작 감지용 Set
const MEDIA_SET = new Set([
    ...mediaFranchises.mobileGames,
    ...mediaFranchises.anime,
    ...mediaFranchises.movies,
    ...mediaFranchises.roblox,
    ...mediaFranchises.tags,
].map(t => t.toLowerCase()));

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

// ===== 칭호/랭킹 탭 =====
export default function AchievementsTab({ stats, characters }) {
    // --- 칭호 계산 ---
    const titles = useMemo(() => {
        if (!characters?.length) return [];
        const list = [];
        const allTags = characters.flatMap(c => (c.hashtags || c.tags || []).map(t => t.toLowerCase()));
        const tagSet = new Set(allTags);
        const totalInteractions = stats?.plotInteractionCount || 0;
        const followers = stats?.followerCount || 0;
        const topCharInt = Math.max(0, ...characters.map(c => c.interactionCount || 0));
        const dates = characters.map(c => c.createdAt || c.createdDate).filter(Boolean).map(d => new Date(d));
        const earliest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
        const activityDays = earliest ? (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24) : 0;
        const activityMonths = activityDays / 30;

        // ===== 헬퍼: 태그 매칭 캐릭터 이름 =====
        const charactersWithInteraction = (min) => characters.filter(c => (c.interactionCount || 0) >= min);
        const charsWithTag = (tag) => characters.filter(c => (c.hashtags || c.tags || []).some(t => t.toLowerCase() === tag)).map(c => c.name);
        const charsWithAnyTag = (tags) => characters.filter(c => (c.hashtags || c.tags || []).some(t => tags.includes(t.toLowerCase()))).map(c => c.name);

        // ===== 크리에이터 특성 칭호 =====
        const hasSunae = tagSet.has('순애');
        const hasNtr = tagSet.has('ntr') || tagSet.has('ntl') || tagSet.has('뺏기') || tagSet.has('빼앗기');
        const unlimitedChars = characters.filter(c => c.unlimitedAllowed);

        list.push({
            emoji: '💕', title: '순애보',
            desc: '#순애 태그가 있으며, NTR/NTL 태그 없음',
            earned: hasSunae && !hasNtr,
            color: 'pink',
            chars: charsWithTag('순애'),
        });
        list.push({
            emoji: '💔', title: '사랑 파괴자',
            desc: '#NTR, #NTL, #뺏기, #빼앗기 태그 보유',
            earned: hasNtr,
            color: 'red',
            chars: charsWithAnyTag(['ntr', 'ntl', '뺏기', '빼앗기', '뺏김', '빼앗김']),
        });
        const mediaChars = characters.filter(c => (c.hashtags || c.tags || []).some(t => MEDIA_SET.has(t.toLowerCase()))).map(c => c.name);
        list.push({
            emoji: '🎨', title: '2차창작',
            desc: '게임, 애니, 영화 등 기존 IP 관련 태그 보유',
            earned: mediaChars.length > 0,
            color: 'blue',
            chars: mediaChars,
        });
        const fantasyChars = charsWithAnyTag(['판타지', '마법', '기사', '마왕', '용사', '엘프', '드래곤']);
        list.push({
            emoji: '🗡️', title: '판타지',
            desc: '#판타지, #마법, #기사, #마왕 등 태그 보유',
            earned: fantasyChars.length > 0,
            color: 'indigo',
            chars: fantasyChars,
        });
        list.push({
            emoji: '🌱', title: '뉴비',
            desc: '활동 기간 3개월 이하',
            earned: activityMonths <= 3 && activityMonths > 0,
            color: 'emerald',
        });
        const cyberChars = charsWithAnyTag(['사이버펑크', 'cyberpunk']);
        list.push({
            emoji: '⚡', title: '사펑',
            desc: '#사이버펑크 태그 보유',
            earned: cyberChars.length > 0,
            color: 'gradient',
            chars: cyberChars,
        });
        const mesuChars = charsWithAnyTag(['메스가키', '도발']);
        list.push({
            emoji: '🩷', title: '허접',
            desc: '#메스가키 또는 #도발 태그 보유',
            earned: mesuChars.length > 0,
            color: 'pink',
            chars: mesuChars,
        });
        list.push({
            emoji: '🔮', title: '언리밋',
            desc: 'Unlimited 설정된 캐릭터 보유',
            earned: unlimitedChars.length > 0,
            color: 'violet',
            chars: unlimitedChars.map(c => c.name),
        });

        // ===== 통계 기반 칭호 =====
        list.push({
            emoji: '💬', title: '밀리언',
            desc: '총 대화수 100만 이상',
            earned: totalInteractions >= 1000000,
            color: 'amber',
        });
        list.push({
            emoji: '🎬', title: '천만관객',
            desc: '총 대화수 1,000만 이상',
            earned: totalInteractions >= 10000000,
            color: 'yellow',
        });
        list.push({
            emoji: '🌌', title: '우주대스타',
            desc: '팔로워 10,000명 이상',
            earned: followers >= 10000,
            color: 'gradient',
        });
        list.push({
            emoji: '🎩', title: '해트트릭',
            desc: '100만 이상 대화량 캐릭터 3개 이상 보유',
            earned: charactersWithInteraction(1000000).length >= 3,
            color: 'indigo',
            chars: charactersWithInteraction(1000000).map(c => c.name),
        });
        list.push({
            emoji: '💿', title: '플래티넘 디스크',
            desc: '100만 이상 대화량 캐릭터 보유',
            earned: charactersWithInteraction(1000000).length > 0,
            color: 'slate',
            chars: charactersWithInteraction(1000000).map(c => c.name),
        });
        list.push({
            emoji: '📀', title: '골든 디스크',
            desc: '50만 이상 대화량 캐릭터 보유',
            earned: charactersWithInteraction(500000).length > 0,
            color: 'yellow',
            chars: charactersWithInteraction(500000).map(c => c.name),
        });
        list.push({
            emoji: '🐾', title: '털',
            desc: '#수인, #수인형, #퍼리 태그 보유',
            earned: ['수인', '수인형', '퍼리', 'furry'].some(t => tagSet.has(t)),
            color: 'amber',
            chars: charsWithAnyTag(['수인', '수인형', '퍼리', 'furry']),
        });
        list.push({
            emoji: '🎂', title: '벌써 1년',
            desc: '활동 기간 1년(365일) 이상',
            earned: activityDays >= 365,
            color: 'emerald',
        });
        list.push({
            emoji: '🎖️', title: '이병부터 병장까지',
            desc: '활동 기간 1년 6개월(548일) 이상',
            earned: activityDays >= 548,
            color: 'blue',
        });

        // 새 칭호 (얼리버드/야행성/올라운더/다작가/인기작가/트렌디/명작가 제거, 아래로 통일)
        list.push({
            emoji: '👨‍👩‍👧‍👦', title: '또 하나의 가족',
            desc: '50명 이상의 캐릭터 제작',
            earned: characters.length >= 50,
            color: 'rose',
        });
        list.push({
            emoji: '🌾', title: '다산의 상징',
            desc: '100명 이상의 캐릭터 제작',
            earned: characters.length >= 100,
            color: 'lime',
        });
        list.push({
            emoji: '🏀', title: '야 체육 안가고 뭐해',
            desc: '캐릭터 중 #일진 태그 보유',
            earned: tagSet.has('일진'),
            color: 'orange',
            chars: charsWithTag('일진'),
        });
        list.push({
            emoji: '🚶', title: '니 애인 지나간다',
            desc: '캐릭터 중 #찐따 태그 보유',
            earned: tagSet.has('찐따'),
            color: 'slate',
            chars: charsWithTag('찐따'),
        });
        const hasNo2nd = !characters.some(c => (c.hashtags || c.tags || []).some(t => MEDIA_SET.has(t.toLowerCase())));
        list.push({
            emoji: '✨', title: '오리지널',
            desc: '게임/애니/영화 등 2차창작 태그 없이 오리지널만 제작',
            earned: hasNo2nd && characters.length > 0,
            color: 'sky',
        });

        return list;
    }, [characters, stats]);

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
