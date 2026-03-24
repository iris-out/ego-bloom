import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Moon, Sun, TrendingUp, Sparkles, Star, Award, Lightbulb, Trophy, Hash } from 'lucide-react';
import { formatCompactNumber, formatNumber, toKST, getCharacterTier, CHARACTER_TIERS } from '../utils/tierCalculator';
import GemTierBadge from './GemTierBadge';
import { getPlotImageUrl, proxyImageUrl } from '../utils/imageUtils';
import { computeEarnedTitles, BADGE_COLOR_MAP } from '../data/badges';

const TOTAL_SLIDES = 11;

// 슬라이드 전환 variants
const slideVariants = {
    enter: (dir) => ({ opacity: 0, y: dir > 0 ? 56 : -56 }),
    center: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.32, 0, 0.67, 0] } },
    exit: (dir) => ({ opacity: 0, y: dir > 0 ? -56 : 56, transition: { duration: 0.28, ease: [0.32, 0, 0.67, 0] } }),
};

// 배경 전환 variants
const bgVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1, transition: { duration: 0.7 } },
    exit: { opacity: 0, transition: { duration: 0.4 } },
};

// 숫자 카운트업 훅
function useCountUp(target, active, duration = 1200) {
    const [value, setValue] = useState(0);
    const rafRef = useRef(null);
    useEffect(() => {
        if (!active) { setValue(0); return; }
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            // ease-out
            const eased = 1 - Math.pow(1 - p, 3);
            setValue(Math.floor(eased * target));
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
            else setValue(target);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, active, duration]);
    return value;
}

// stagger container/item variants
const staggerContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const staggerItem = {
    hidden: { opacity: 0, scale: 0.75, y: 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 22 } },
};

// 애니메이션 바 컴포넌트
function AnimatedBar({ widthPct, color, delay = 0, active }) {
    return (
        <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: '0%' }}
            animate={active ? { width: `${widthPct}%` } : { width: '0%' }}
            transition={{ duration: 0.55, delay, ease: 'easeOut' }}
        />
    );
}

export default function RecapModal({ isOpen, onClose, characters, stats, profile, tier, score }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(1);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentSlide]);

    // 모달 열릴 때 슬라이드 리셋
    useEffect(() => {
        if (isOpen) setCurrentSlide(0);
    }, [isOpen]);

    const go = (dir) => {
        setDirection(dir);
        setCurrentSlide((p) => Math.min(Math.max(p + dir, 0), TOTAL_SLIDES - 1));
    };

    // ── 데이터 계산 ──────────────────────────────────────────
    const sortedByInteraction = useMemo(
        () => [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0)),
        [characters]
    );
    const sortedByDate = useMemo(
        () => [...characters].sort((a, b) => toKST(a.createdAt || 0) - toKST(b.createdAt || 0)),
        [characters]
    );

    const topChar    = sortedByInteraction[0] || characters[0];
    const oldestChar = sortedByDate[0] || characters[0];
    const newestChar = sortedByDate[sortedByDate.length - 1] || characters[characters.length - 1];

    const firstDate  = toKST(oldestChar?.createdAt || Date.now());
    const daysSince  = Math.max(1, Math.floor((toKST().getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));

    const totalInteractionCount = useMemo(
        () => (stats?.plotInteractionCount ?? stats?.totalInteractionCount)
            ?? characters.reduce((s, c) => s + (c.interactionCount || 0), 0),
        [characters, stats]
    );

    // 활동 시간대
    const timeSlots = useMemo(() => {
        const slots = { dawn: 0, morning: 0, afternoon: 0, night: 0 };
        characters.forEach(c => {
            const d = c.createdAt || c.createdDate || c.updatedAt;
            if (!d) return;
            const h = toKST(d).getHours();
            if (h < 6) slots.dawn++;
            else if (h < 12) slots.morning++;
            else if (h < 18) slots.afternoon++;
            else slots.night++;
        });
        return slots;
    }, [characters]);

    const maxSlot   = Object.entries(timeSlots).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const isNightOwl = maxSlot === 'night' || maxSlot === 'dawn';

    // 캐릭터 티어 분포
    const tierDist = useMemo(() => {
        const counts = {};
        CHARACTER_TIERS.forEach(t => { counts[t.key] = 0; });
        characters.forEach(c => {
            const t = getCharacterTier(c.interactionCount || 0);
            counts[t.key] = (counts[t.key] || 0) + 1;
        });
        return CHARACTER_TIERS.map(t => ({ ...t, count: counts[t.key] || 0 })).reverse();
    }, [characters]);

    const maxTierCount = useMemo(() => Math.max(1, ...tierDist.map(t => t.count)), [tierDist]);

    // 태그 분석
    const topTags = useMemo(() => {
        const freq = {};
        characters.forEach(c => {
            (c.hashtags || c.tags || []).forEach(tag => {
                const t = String(tag).trim();
                if (t) freq[t] = (freq[t] || 0) + 1;
            });
        });
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7)
            .map(([tag, count]) => ({ tag, count }));
    }, [characters]);

    const maxTagCount = useMemo(() => Math.max(1, ...(topTags.map(t => t.count))), [topTags]);

    // 배지
    const allPills = useMemo(
        () => computeEarnedTitles({ characters, stats }).filter(t => t.earned),
        [characters, stats]
    );

    // 배경 이미지
    const bgUrl = useMemo(() => {
        switch (currentSlide) {
            case 0:  return getPlotImageUrl(topChar);
            case 1:  return getPlotImageUrl(topChar);
            case 2:  return '';
            case 3:  return '';
            case 4:  return '';
            case 5:  return getPlotImageUrl(oldestChar);
            case 6:  return getPlotImageUrl(topChar);
            case 7:  return getPlotImageUrl(newestChar);
            case 8:  return profile?.profileImageUrl || getPlotImageUrl(topChar);
            case 9:  return getPlotImageUrl(newestChar);
            case 10: return '';
            default: return '';
        }
    }, [currentSlide, topChar, oldestChar, newestChar, profile]);

    const bgGradient = useMemo(() => {
        if (currentSlide === 4) return isNightOwl ? 'from-indigo-950 via-slate-900 to-black' : 'from-sky-900 via-blue-900 to-black';
        if (currentSlide === 2) return 'from-slate-950 via-gray-900 to-black';
        if (currentSlide === 3) return 'from-violet-950 via-slate-900 to-black';
        if (currentSlide === 10) return `from-gray-900 via-black to-black`;
        return 'from-gray-900 via-black to-black';
    }, [currentSlide, isNightOwl]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-0 min-h-[100dvh] safe-area-recap">
            <div className="relative w-full h-[100dvh] max-h-[100dvh] bg-[var(--card)] shadow-2xl flex flex-col mx-auto overflow-hidden rounded-none">

                {/* 배경 */}
                <AnimatePresence mode="wait">
                    {bgUrl ? (
                        <motion.div key={`bg-img-${currentSlide}`} className="absolute inset-0 z-0"
                            variants={bgVariants} initial="enter" animate="center" exit="exit">
                            <img src={proxyImageUrl(bgUrl)} alt="" className="w-full h-full object-cover blur-md scale-110 opacity-30 mix-blend-screen" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/80 to-black" />
                        </motion.div>
                    ) : (
                        <motion.div key={`bg-grad-${currentSlide}`} className={`absolute inset-0 z-0 bg-gradient-to-br ${bgGradient}`}
                            variants={bgVariants} initial="enter" animate="center" exit="exit" />
                    )}
                </AnimatePresence>

                {/* 상단 인디케이터 + 닫기 */}
                <div className="absolute top-0 inset-x-0 z-50 p-3 sm:p-5 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center gap-1 mb-4">
                        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                            <button key={i} onClick={() => { setDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
                                className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full transition-all duration-300"
                                    style={{ width: i <= currentSlide ? '100%' : '0%' }} />
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center text-white/80">
                        <span className="text-xs font-black tracking-widest uppercase opacity-90 drop-shadow-md flex items-center gap-1.5">
                            <Sparkles size={14} className="text-purple-400" /> EGO-BLOOM RECAP
                        </span>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md">
                            <X size={26} />
                        </button>
                    </div>
                </div>

                {/* 좌우 터치 영역 */}
                <div className="absolute left-0 z-40 w-[28%] cursor-pointer"
                    style={{ top: 'calc(12% + env(safe-area-inset-top, 0px))', bottom: 'calc(12% + env(safe-area-inset-bottom, 0px))' }}
                    onClick={() => go(-1)} aria-hidden />
                <div className="absolute right-0 z-40 w-[28%] cursor-pointer"
                    style={{ top: 'calc(12% + env(safe-area-inset-top, 0px))', bottom: 'calc(12% + env(safe-area-inset-bottom, 0px))' }}
                    onClick={() => go(1)} aria-hidden />

                {/* 슬라이드 콘텐츠 */}
                <div className="relative z-30 flex-1 min-h-0 overflow-y-auto overflow-x-hidden text-center px-4 py-6 sm:p-8 sm:py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <div className="flex flex-col items-center justify-center min-h-full">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={currentSlide}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="w-full flex flex-col items-center"
                            >
                                <SlideContent
                                    slide={currentSlide}
                                    topChar={topChar}
                                    oldestChar={oldestChar}
                                    newestChar={newestChar}
                                    daysSince={daysSince}
                                    totalInteractionCount={totalInteractionCount}
                                    timeSlots={timeSlots}
                                    isNightOwl={isNightOwl}
                                    tierDist={tierDist}
                                    maxTierCount={maxTierCount}
                                    topTags={topTags}
                                    maxTagCount={maxTagCount}
                                    allPills={allPills}
                                    characters={characters}
                                    stats={stats}
                                    profile={profile}
                                    tier={tier}
                                    score={score}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SlideContent(props) {
    const { slide } = props;
    switch (slide) {
        case 0:  return <Slide0TotalInteraction {...props} />;
        case 1:  return <Slide1BestChar {...props} />;
        case 2:  return <Slide2TierDist {...props} />;
        case 3:  return <Slide3Tags {...props} />;
        case 4:  return <Slide4TimeAnalysis {...props} />;
        case 5:  return <Slide5Origin {...props} />;
        case 6:  return <Slide6Growth {...props} />;
        case 7:  return <Slide7Newest {...props} />;
        case 8:  return <Slide8Community {...props} />;
        case 9:  return <Slide9Badges {...props} />;
        case 10: return <Slide10Finale {...props} />;
        default: return null;
    }
}

// ── [0] 종합 대화량 ────────────────────────────────────────
function Slide0TotalInteraction({ topChar, totalInteractionCount }) {
    const count = useCountUp(totalInteractionCount, true, 1400);
    return (
        <div className="space-y-6">
            <motion.div
                className="w-32 h-32 mx-auto rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.4)] ring-2 ring-white/20 mb-10"
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            >
                <img src={proxyImageUrl(getPlotImageUrl(topChar))} alt="Top Char" className="w-full h-full object-cover" />
            </motion.div>
            <motion.p className="text-sm text-gray-300 font-medium tracking-wide"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                지금까지 달성한 총 대화 기록,
            </motion.p>
            <motion.h2 className="text-5xl md:text-6xl font-black text-white leading-tight drop-shadow-lg flex flex-col gap-2"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]">
                    {formatCompactNumber(count)}
                </span>
                <span className="text-3xl">대화</span>
            </motion.h2>
        </div>
    );
}

// ── [1] 최고 성적 캐릭터 ────────────────────────────────────
function Slide1BestChar({ topChar }) {
    const charTier = topChar ? getCharacterTier(topChar.interactionCount || 0) : null;
    const count = useCountUp(topChar?.interactionCount || 0, true, 1400);
    return (
        <div className="space-y-5 w-full max-w-xs mx-auto">
            <motion.p className="text-[10px] font-black text-amber-400/80 uppercase tracking-[0.25em] mb-2"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                #1 Most Interacted
            </motion.p>
            <motion.div
                className="w-36 h-36 mx-auto rounded-2xl overflow-hidden shadow-[0_0_32px_rgba(251,191,36,0.35)] ring-2 ring-amber-400/50"
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.15 }}
            >
                <img src={proxyImageUrl(getPlotImageUrl(topChar))} alt={topChar?.name} className="w-full h-full object-cover" />
            </motion.div>
            <motion.h2 className="text-3xl font-black text-white leading-snug drop-shadow-md px-2"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                "{topChar?.name}"
            </motion.h2>
            {charTier && (
                <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.38, type: 'spring' }}>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: charTier.color }}>
                        CHARACTER {charTier.name} TIER
                    </span>
                </motion.div>
            )}
            <motion.div className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
                <span className="text-4xl font-black text-amber-300">{formatCompactNumber(count)}</span>
                <span className="text-xs text-gray-400 font-medium">대화</span>
            </motion.div>
        </div>
    );
}

// ── [2] 캐릭터 티어 분포 ────────────────────────────────────
function Slide2TierDist({ tierDist, maxTierCount }) {
    const hasAny = tierDist.some(t => t.count > 0);
    return (
        <div className="space-y-5 w-full max-w-sm mx-auto">
            <motion.p className="text-[10px] font-black text-cyan-400/80 uppercase tracking-[0.25em]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
                Character Tier Distribution
            </motion.p>
            <motion.h2 className="text-2xl font-black text-white leading-snug"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                캐릭터 티어 분포
            </motion.h2>
            {hasAny ? (
                <motion.div className="space-y-2.5 w-full"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    {tierDist.map((t, i) => (
                        <div key={t.key} className="flex items-center gap-3">
                            <span className="text-[11px] font-black w-6 text-right shrink-0" style={{ color: t.color }}>{t.name}</span>
                            <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
                                <AnimatedBar
                                    widthPct={maxTierCount > 0 ? (t.count / maxTierCount) * 100 : 0}
                                    color={t.color}
                                    delay={0.22 + i * 0.07}
                                    active={true}
                                />
                            </div>
                            <span className="text-[11px] font-bold text-white/70 w-6 text-left shrink-0">{t.count}</span>
                        </div>
                    ))}
                </motion.div>
            ) : (
                <p className="text-gray-400 text-sm">캐릭터 데이터가 없습니다.</p>
            )}
        </div>
    );
}

// ── [3] 태그 스타일 분석 ────────────────────────────────────
function Slide3Tags({ topTags, maxTagCount }) {
    const topTag = topTags[0];
    return (
        <div className="space-y-5 w-full max-w-sm mx-auto">
            <motion.p className="text-[10px] font-black text-violet-400/80 uppercase tracking-[0.25em]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
                Genre DNA
            </motion.p>
            {topTag && (
                <motion.div className="flex items-center justify-center gap-2"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12, type: 'spring', stiffness: 250 }}>
                    <Hash size={22} className="text-violet-400" />
                    <span className="text-3xl font-black text-white">#{topTag.tag}</span>
                </motion.div>
            )}
            <motion.p className="text-xs text-gray-400"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
                당신의 장르 DNA
            </motion.p>
            {topTags.length > 0 ? (
                <motion.div className="space-y-2 w-full"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
                    {topTags.map((t, i) => (
                        <div key={t.tag} className="flex items-center gap-3">
                            <span className="text-[10px] text-gray-300 w-[100px] text-right shrink-0 truncate">#{t.tag}</span>
                            <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                                <AnimatedBar
                                    widthPct={(t.count / maxTagCount) * 100}
                                    color={`hsl(${260 + i * 18}, 70%, 65%)`}
                                    delay={0.3 + i * 0.06}
                                    active={true}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-white/60 w-6 shrink-0">{t.count}</span>
                        </div>
                    ))}
                </motion.div>
            ) : (
                <p className="text-gray-400 text-sm">태그 데이터가 없습니다.</p>
            )}
        </div>
    );
}

// ── [4] 활동 시간 분석 ────────────────────────────────────
function Slide4TimeAnalysis({ timeSlots, isNightOwl }) {
    return (
        <div className="space-y-8 flex flex-col items-center">
            <motion.div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md shadow-inner ring-1 ring-white/20 mb-6"
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.1 }}>
                {isNightOwl
                    ? <Moon size={48} className="text-indigo-400" />
                    : <Sun size={48} className="text-amber-400" />}
            </motion.div>
            <div className="space-y-4">
                <motion.p className="text-sm text-gray-300 font-medium"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    당신이 주로 활동하는 시간대는
                </motion.p>
                <motion.h2 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${isNightOwl ? 'from-indigo-400 to-purple-400' : 'from-amber-400 to-orange-400'} leading-tight pb-1`}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    {isNightOwl ? '야행성' : '낮에 활동하는 타입'}
                </motion.h2>
                <motion.div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-xs mx-auto"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                    {[
                        { label: '새벽 (00~06시)', count: timeSlots.dawn, color: 'text-indigo-300' },
                        { label: '아침 (06~12시)', count: timeSlots.morning, color: 'text-emerald-300' },
                        { label: '오후 (12~18시)', count: timeSlots.afternoon, color: 'text-amber-300' },
                        { label: '저녁 (18~24시)', count: timeSlots.night, color: 'text-purple-300' },
                    ].map(slot => (
                        <div key={slot.label} className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] text-gray-400">{slot.label}</span>
                            <span className={`text-lg font-bold ${slot.color}`}>{slot.count}회</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
}

// ── [5] 오리진 캐릭터 ────────────────────────────────────
function Slide5Origin({ oldestChar, daysSince }) {
    return (
        <div className="space-y-6">
            <motion.div className="w-32 h-32 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-emerald-500/50 mb-8"
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}>
                <img src={proxyImageUrl(getPlotImageUrl(oldestChar))} alt="Oldest Char" className="w-full h-full object-cover" />
            </motion.div>
            <motion.p className="text-sm text-gray-300 font-medium"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                모든 이야기의 시작,
            </motion.p>
            <motion.h2 className="text-3xl font-black text-white leading-snug drop-shadow-md mb-6 px-4"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                "{oldestChar?.name}"
            </motion.h2>
            <motion.div className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.42 }}>
                <span className="text-emerald-400 font-bold tracking-tight">처음 만났던 첫 캐릭터</span>
            </motion.div>
            <motion.p className="text-sm text-gray-400 mt-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.52 }}>
                만난 지 <span className="text-emerald-300 font-bold">{daysSince.toLocaleString()}</span>일이 되었어요
            </motion.p>
        </div>
    );
}

// ── [6] 단기 성장량 ────────────────────────────────────
function Slide6Growth({ daysSince, characters }) {
    const daysCount = useCountUp(daysSince, true, 1200);
    const charCount = useCountUp(characters.length, true, 1000);
    return (
        <div className="space-y-8">
            <motion.div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)] mb-4"
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.1 }}>
                <TrendingUp size={40} className="text-white" />
            </motion.div>
            <motion.p className="text-sm text-gray-300 font-medium"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                쉼 없이 달려온 여정
            </motion.p>
            <motion.h2 className="flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0 leading-tight max-w-[90vw]"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <span className="text-white font-black text-2xl sm:text-3xl">제작을 시작한 지</span>
                <span className="text-cyan-400 font-black shrink-0" style={{ fontSize: 'clamp(1.5rem, 7vw, 2.25rem)' }}>{daysCount.toLocaleString()}</span>
                <span className="text-white font-black text-2xl sm:text-3xl">일 만에</span>
            </motion.h2>
            <motion.h3 className="text-xl font-bold text-gray-100"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                무려 <span className="text-cyan-300 text-3xl font-black">{charCount}</span>개의 스토리를 탄생시켰습니다.
            </motion.h3>
            <motion.p className="text-[11px] text-gray-400 max-w-xs mx-auto px-4 bg-white/5 py-2.5 rounded-full border border-white/10 flex items-center justify-center gap-1"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.56 }}>
                <Lightbulb size={12} className="text-yellow-400 shrink-0" />
                평균 <strong>{Math.max(1, Math.round(daysSince / characters.length))}</strong>일에 1번씩 꾸준히 업데이트
            </motion.p>
        </div>
    );
}

// ── [7] 최신 캐릭터 ────────────────────────────────────
function Slide7Newest({ newestChar }) {
    return (
        <div className="space-y-6">
            <motion.div className="w-32 h-32 mx-auto rounded-xl overflow-hidden shadow-[0_0_20px_rgba(236,72,153,0.4)] ring-2 ring-pink-500/50 mb-8"
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}>
                <img src={proxyImageUrl(getPlotImageUrl(newestChar))} alt="Newest Char" className="w-full h-full object-cover" />
            </motion.div>
            <motion.p className="text-sm text-gray-300 font-medium"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                그리고 지금 이 순간에도 이어지는 이야기,
            </motion.p>
            <motion.h2 className="text-3xl font-black text-white leading-snug drop-shadow-lg mb-4"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                "{newestChar?.name}"
            </motion.h2>
            <motion.div className="text-pink-400 text-xs font-bold uppercase tracking-[0.2em]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}>
                The Latest Creation
            </motion.div>
            <motion.div className="flex justify-center gap-2 mt-6"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
                {(newestChar?.hashtags || newestChar?.tags || []).slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                        #{tag}
                    </span>
                ))}
            </motion.div>
        </div>
    );
}

// ── [8] 커뮤니티 파워 ────────────────────────────────────
function Slide8Community({ profile, topChar, stats }) {
    const followerCount = stats?.followerCount || 0;
    const count = useCountUp(followerCount, true, 1300);
    return (
        <div className="space-y-8">
            <motion.div className="w-36 h-36 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-blue-500/40 bg-[var(--bg-secondary)]"
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}>
                <img src={proxyImageUrl(profile?.profileImageUrl || getPlotImageUrl(topChar))} alt="Profile" className="w-full h-full object-cover" />
            </motion.div>
            <motion.p className="text-sm text-gray-300 font-medium"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                수많은 유저들이 당신의 세계관에 매료되었습니다.
            </motion.p>
            <motion.h2 className="text-5xl font-black text-white leading-tight flex flex-col items-center gap-3"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <div className="flex items-center gap-3">
                    <Users size={40} className="text-blue-400" />
                    <span className="text-blue-400">{formatNumber(count)}</span>
                </div>
                <span className="text-2xl text-gray-200">팔로워</span>
            </motion.h2>
        </div>
    );
}

// ── [9] 업적 및 칭호 ────────────────────────────────────
function Slide9Badges({ allPills }) {
    return (
        <div className="space-y-8 w-full">
            <motion.div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center shadow-lg mb-2"
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}>
                <Award size={32} className="text-yellow-400" />
            </motion.div>
            <motion.p className="text-sm text-gray-300 font-medium mb-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                여정의 발자취가 새겨진 특별한 칭호들
            </motion.p>
            <motion.div
                className="flex flex-wrap justify-center gap-2.5 px-4 min-h-[140px] max-h-[40vh] sm:max-h-[250px] overflow-y-auto content-center"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
            >
                {allPills.slice(0, 10).map((pill) => {
                    const style = BADGE_COLOR_MAP[pill.color] || BADGE_COLOR_MAP.slate;
                    const isGradient = pill.color === 'gradient';
                    return (
                        <motion.div key={pill.id} variants={staggerItem}
                            className={`px-5 py-2.5 rounded-full font-bold text-sm shadow-xl backdrop-blur-md flex items-center gap-1.5 ${isGradient ? 'text-white' : `${style.bg} border ${style.border} ${style.text}`}`}
                            style={isGradient ? { background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' } : {}}>
                            {pill.emoji} {pill.title}
                        </motion.div>
                    );
                })}
                {allPills.length === 0 && (
                    <motion.p className="text-gray-400 text-sm mt-4" variants={staggerItem}>
                        아직 획득한 특수 칭호가 없습니다.
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
}

// ── [10] 피날레: 티어 ────────────────────────────────────
function Slide10Finale({ tier, score }) {
    const count = useCountUp(score || 0, true, 1500);
    return (
        <div className="space-y-4 sm:space-y-6 flex flex-col items-center">
            <motion.div className="mb-2 sm:mb-6 transform scale-[1.4] sm:scale-[1.7] md:scale-[2.0] mt-2 sm:mt-8"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.4, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}>
                <GemTierBadge tier={tier} score={score} size="lg" />
            </motion.div>
            <motion.div className="mt-8 sm:mt-16 space-y-2"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <p className="text-sm text-gray-300 font-medium tracking-wide">달성한 종합 티어</p>
                <h2 className="text-5xl md:text-6xl font-black leading-tight drop-shadow-md py-1" style={{ color: tier?.color ?? '#9ca3af' }}>
                    {tier?.name || '티어 없음'}
                </h2>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 mt-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ELO Score</span>
                    <span className="text-lg font-black font-mono text-[var(--accent)]">{count.toLocaleString()}</span>
                </div>
            </motion.div>
            <motion.p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mt-4 sm:mt-8"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                We Support Your Next Journey
            </motion.p>
        </div>
    );
}
