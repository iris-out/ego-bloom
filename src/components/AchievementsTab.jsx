import React, { useMemo, useState } from 'react';
import { formatNumber } from '../utils/tierCalculator';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

// ===== 접기/펴기 카테고리 =====
function CollapsibleCategory({ name, earned, total, children, defaultOpen = true }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="card overflow-hidden transition-all duration-300">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg-secondary)]/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{name}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${earned === total && total > 0 ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'}`}>
                        {earned}/{total}
                    </span>
                </div>
            </button>
            {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
}

// ===== 업적 탭 =====
export default function AchievementsTab({ stats, characters }) {
    const achievements = useMemo(() => {
        if (!characters?.length) return [];
        const list = [];
        const totalInteractions = stats?.plotInteractionCount || 0;
        const followers = stats?.followerCount || 0;
        const dates = characters.map(c => c.createdAt || c.createdDate).filter(Boolean).map(d => new Date(d));
        const earliest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
        const allTags = new Set();
        characters.forEach(c => (c.hashtags || c.tags || []).forEach(t => allTags.add(t)));
        const topCharInt = characters.length > 0
            ? Math.max(...characters.map(c => c.interactionCount || 0))
            : 0;
        const unlimitedCount = characters.filter(c => c.unlimitedAllowed).length;

        // ===== 제작 업적 =====
        list.push({ cat: '제작', emoji: '🌱', title: '첫 발자국', desc: '첫 캐릭터 제작', done: characters.length >= 1 });
        list.push({ cat: '제작', emoji: '✌️', title: '두 번째 이야기', desc: '캐릭터 2개 보유', done: characters.length >= 2 });
        list.push({ cat: '제작', emoji: '🎯', title: '꾸준한 제작자', desc: '캐릭터 5개 이상', done: characters.length >= 5 });
        list.push({ cat: '제작', emoji: '🎨', title: '다작 크리에이터', desc: '캐릭터 10개 이상', done: characters.length >= 10 });
        list.push({ cat: '제작', emoji: '📦', title: '캐릭터 수집가', desc: '캐릭터 20개 이상', done: characters.length >= 20 });
        list.push({ cat: '제작', emoji: '🏭', title: '캐릭터 공장', desc: '캐릭터 30개 이상', done: characters.length >= 30 });
        list.push({ cat: '제작', emoji: '🌌', title: '세계관 건설자', desc: '캐릭터 50개 이상', done: characters.length >= 50 });
        list.push({ cat: '제작', emoji: '🏰', title: '유니버스 아키텍트', desc: '캐릭터 100개 이상', done: characters.length >= 100 });
        list.push({ cat: '제작', emoji: '🌐', title: '다중 우주의 지배자', desc: '캐릭터 200개 이상', done: characters.length >= 200 });

        // ===== 대화 업적 (총 대화수 테마) =====
        list.push({ cat: '총 대화수', emoji: '🎵', title: '데뷔 싱글', desc: '총 대화수 100회', done: totalInteractions >= 100 });
        list.push({ cat: '총 대화수', emoji: '🎶', title: '첫 EP 앨범', desc: '총 대화수 1,000회', done: totalInteractions >= 1000 });
        list.push({ cat: '총 대화수', emoji: '💿', title: '실버 레코드', desc: '총 대화수 5,000회', done: totalInteractions >= 5000 });
        list.push({ cat: '총 대화수', emoji: '📀', title: '골드 레코드', desc: '총 대화수 10,000회', done: totalInteractions >= 10000 });
        list.push({ cat: '총 대화수', emoji: '🥈', title: '플래티넘 디스크', desc: '총 대화수 50,000회', done: totalInteractions >= 50000 });
        list.push({ cat: '총 대화수', emoji: '🥇', title: '멀티 플래티넘', desc: '총 대화수 100,000회', done: totalInteractions >= 100000 });
        list.push({ cat: '총 대화수', emoji: '💎', title: '다이아몬드 레코드', desc: '총 대화수 1,000,000회', done: totalInteractions >= 1000000 });
        list.push({ cat: '총 대화수', emoji: '👑', title: '더블 다이아몬드', desc: '총 대화수 5,000,000회', done: totalInteractions >= 5000000 });
        list.push({ cat: '총 대화수', emoji: '🌌', title: '천만 그랜드슬램', desc: '총 대화수 10,000,000회', done: totalInteractions >= 10000000 });

        // ===== 인기 캐릭터 업적 =====
        list.push({ cat: '인기 캐릭터', emoji: '⭐', title: '루키 탄생', desc: '단일 캐릭터 1,000회', done: topCharInt >= 1000 });
        list.push({ cat: '인기 캐릭터', emoji: '🌟', title: '라이징 스타', desc: '단일 캐릭터 5,000회', done: topCharInt >= 5000 });
        list.push({ cat: '인기 캐릭터', emoji: '💫', title: '인기 캐릭터', desc: '단일 캐릭터 10,000회', done: topCharInt >= 10000 });
        list.push({ cat: '인기 캐릭터', emoji: '🔮', title: '티켓 파워', desc: '단일 캐릭터 100,000회', done: topCharInt >= 100000 });
        list.push({ cat: '인기 캐릭터', emoji: '👸', title: '전설의 캐릭터', desc: '단일 캐릭터 1,000,000회', done: topCharInt >= 1000000 });
        list.push({ cat: '인기 캐릭터', emoji: '🔱', title: '신화의 반열', desc: '단일 캐릭터 5,000,000회', done: topCharInt >= 5000000 });
        list.push({ cat: '인기 캐릭터', emoji: '✨', title: '우주적 존재', desc: '단일 캐릭터 10,000,000회', done: topCharInt >= 10000000 });

        // ===== 커뮤니티 업적 =====
        list.push({ cat: '커뮤니티', emoji: '👋', title: '첫 팔로워', desc: '팔로워 1명 돌파', done: followers >= 1 });
        list.push({ cat: '커뮤니티', emoji: '🤝', title: '작은 팬덤', desc: '팔로워 10명 돌파', done: followers >= 10 });
        list.push({ cat: '커뮤니티', emoji: '🎊', title: '인기 작가', desc: '팔로워 100명 돌파', done: followers >= 100 });
        list.push({ cat: '커뮤니티', emoji: '🌸', title: '팬클럽 결성', desc: '팔로워 1,000명 돌파', done: followers >= 1000 });
        list.push({ cat: '커뮤니티', emoji: '💎', title: '유명 인사', desc: '팔로워 3,000명 돌파', done: followers >= 3000 });
        list.push({ cat: '커뮤니티', emoji: '🌟', title: '인플루언서', desc: '팔로워 5,000명 돌파', done: followers >= 5000 });
        list.push({ cat: '커뮤니티', emoji: '🏆', title: '네임드', desc: '팔로워 10,000명 돌파', done: followers >= 10000 });
        list.push({ cat: '커뮤니티', emoji: '👑', title: '정점의 작가', desc: '팔로워 20,000명 돌파', done: followers >= 20000 });
        list.push({ cat: '커뮤니티', emoji: '🔥', title: '시대의 아이콘', desc: '팔로워 50,000명 돌파', done: followers >= 50000 });

        // ===== 다양성 업적 =====
        list.push({ cat: '다양성', emoji: '🔖', title: '태그 입문', desc: '3개 이상 태그', done: allTags.size >= 3 });
        list.push({ cat: '다양성', emoji: '🎭', title: '다재다능', desc: '5개 이상 태그', done: allTags.size >= 5 });
        list.push({ cat: '다양성', emoji: '🌈', title: '장르 콜렉터', desc: '10개 이상 태그', done: allTags.size >= 10 });
        list.push({ cat: '다양성', emoji: '🎪', title: '카멜레온', desc: '20개 이상 태그', done: allTags.size >= 20 });

        // ===== 활동 기간 업적 =====
        if (earliest) {
            const months = (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 30);
            list.push({ cat: '활동 기록', emoji: '🌱', title: '한 달의 시작', desc: '1개월 이상 활동', done: months >= 1 });
            list.push({ cat: '활동 기록', emoji: '🌿', title: '계절의 변화', desc: '3개월 이상 활동', done: months >= 3 });
            list.push({ cat: '활동 기록', emoji: '🌳', title: '베테랑', desc: '6개월 이상 활동', done: months >= 6 });
            list.push({ cat: '활동 기록', emoji: '🎂', title: '영광의 1주년', desc: '1년 이상 활동', done: months >= 12 });
            list.push({ cat: '활동 기록', emoji: '🏅', title: '살아있는 전설', desc: '2년 이상 활동', done: months >= 24 });
            list.push({ cat: '활동 기록', emoji: '👑', title: '불멸의 기록', desc: '3년 이상 활동', done: months >= 36 });
        }

        // ===== 특별 업적 =====
        const recent30 = characters.filter(c => {
            const d = c.updatedAt || c.createdAt;
            return d && (Date.now() - new Date(d).getTime()) < 30 * 24 * 60 * 60 * 1000;
        });
        list.push({ cat: '특별', emoji: '✨', title: '현재 진행형', desc: '최근 30일 내 활동', done: recent30.length > 0 });
        const hasVoice = (stats?.voicePlaySeconds || stats?.voicePlayCount || 0) > 0;
        list.push({ cat: '특별', emoji: '🎤', title: '보이스 마스터', desc: '음성 제작 기록 보유', done: hasVoice });
        list.push({ cat: '특별', emoji: '🔮', title: 'Unlimited', desc: 'Unlimited 설정 보유', done: unlimitedCount > 0 });

        return list;
    }, [characters, stats]);

    const categories = useMemo(() => {
        const cats = [...new Set(achievements.map(a => a.cat))];
        return cats.map(cat => ({
            name: cat,
            items: achievements.filter(a => a.cat === cat),
            earned: achievements.filter(a => a.cat === cat && a.done).length,
            total: achievements.filter(a => a.cat === cat).length,
        }));
    }, [achievements]);

    const totalEarned = achievements.filter(a => a.done).length;
    const totalCount = achievements.length;

    return (
        <div className="space-y-4 animate-fade-in-up pb-8">
            {/* 전체 진행률 */}
            <div className="card p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        🏆 <span className="mt-0.5">업적 마일스톤</span>
                    </h3>
                    <span className="text-xs font-mono text-[var(--accent)] font-bold">{totalEarned} / {totalCount}</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--accent)] to-purple-400 rounded-full transition-all duration-700"
                        style={{ width: `${(totalEarned / totalCount) * 100}%` }}
                    />
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-medium">
                    {totalEarned === totalCount
                        ? '🎉 모든 업적을 달성하셨습니다! 당신은 진정한 전설입니다.'
                        : `아직 ${totalCount - totalEarned}개의 도전 과제가 남아있습니다.`
                    }
                </p>
            </div>

            {/* 카테고리별 업적 */}
            {categories.map((cat, idx) => (
                <CollapsibleCategory
                    key={cat.name}
                    name={cat.name}
                    earned={cat.earned}
                    total={cat.total}
                    defaultOpen={idx === 0}
                >
                    <div className="grid grid-cols-1 gap-2">
                        {cat.items.map(a => (
                            <div
                                key={a.title}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-all duration-300 ${a.done
                                    ? 'bg-[var(--accent-soft)] border-[var(--accent)]/20 shadow-sm'
                                    : 'bg-[var(--bg-secondary)]/30 border-[var(--border)] opacity-60 grayscale'
                                    }`}
                            >
                                <div className="text-2xl flex-shrink-0">{a.emoji}</div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold leading-tight ${a.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                                        {a.title}
                                    </div>
                                    <div className="text-[9px] text-[var(--text-tertiary)] mt-1 truncate">{a.desc}</div>
                                </div>
                                {a.done && (
                                    <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-[10px] font-bold">✓</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleCategory>
            ))}
        </div>
    );
}
