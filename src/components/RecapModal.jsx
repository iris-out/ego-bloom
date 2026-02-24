import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, Moon, Sun, TrendingUp, Sparkles, Zap, Star, Award } from 'lucide-react';
import { formatCompactNumber, formatNumber } from '../utils/tierCalculator';
import CreatorTierBadge from './CreatorTierBadge';
import { getPlotImageUrl, proxyImageUrl } from '../utils/imageUtils';
import mediaFranchises from '../data/mediaFranchises.json';

const MEDIA_SET = new Set([
    ...mediaFranchises.mobileGames,
    ...mediaFranchises.anime,
    ...mediaFranchises.movies,
    ...mediaFranchises.roblox,
    ...mediaFranchises.tags,
].map(t => t.toLowerCase()));

export default function RecapModal({ isOpen, onClose, characters, stats, profile, tier, score }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const totalSlides = 8; // 8 슬라이드로 확장

    // 외부 ESC 키 & 좌우 방향키 네비게이션 적용
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
            if (e.key === 'ArrowRight' && isOpen) nextSlide();
            if (e.key === 'ArrowLeft' && isOpen) prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentSlide]);

    const nextSlide = () => setCurrentSlide((p) => Math.min(p + 1, totalSlides - 1));
    const prevSlide = () => setCurrentSlide((p) => Math.max(p - 1, 0));

    const handleAreaClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.3) prevSlide();
        else nextSlide();
    };

    // 캐릭터 정렬 캐싱
    const sortedByInteraction = [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    const sortedByDate = [...characters].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const topChar = sortedByInteraction[0] || characters[0];
    const oldestChar = sortedByDate[0] || characters[0];
    const newestChar = sortedByDate[sortedByDate.length - 1] || characters[characters.length - 1];

    // 활동일수 계산
    const firstDate = new Date(oldestChar?.createdAt || Date.now());
    const daysSince = Math.max(1, Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));

    // 총 대화 수: API는 plotInteractionCount 사용, 없으면 캐릭터 합계로 폴백
    const totalInteractionCount = (stats?.plotInteractionCount ?? stats?.totalInteractionCount) ?? (characters?.reduce((s, c) => s + (c.interactionCount || 0), 0) || 0);

    // 주간/야간 활동 비율 분석
    const timeSlots = { dawn: 0, morning: 0, afternoon: 0, night: 0 };
    characters.forEach(c => {
        const d = c.createdAt || c.createdDate || c.updatedAt;
        if (!d) return;
        const h = new Date(d).getHours();
        if (h >= 0 && h < 6) timeSlots.dawn++;
        else if (h >= 6 && h < 12) timeSlots.morning++;
        else if (h >= 12 && h < 18) timeSlots.afternoon++;
        else timeSlots.night++;
    });

    const maxSlot = Object.entries(timeSlots).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const isNightOwl = maxSlot === 'night' || maxSlot === 'dawn';

    // 칭호 로직
    const allPills = useMemo(() => {
        if (!characters || characters.length === 0) return [];
        const result = [];
        const allTags = characters.flatMap(c => (c.hashtags || c.tags || []).map(t => t.toLowerCase()));
        const tagSet = new Set(allTags);
        const hasSunae = tagSet.has('순애');
        const hasNtr = tagSet.has('ntr') || tagSet.has('ntl') || tagSet.has('뺏기') || tagSet.has('빼앗기');
        const unlimitedCount = characters.filter(c => c.unlimitedAllowed).length;
        const interactionStats = characters.reduce((s, c) => s + (c.interactionCount || 0), 0);

        if (hasSunae && !hasNtr) result.push({ id: 'sunae', label: '💕 순애보', text: 'text-pink-300', bg: 'bg-pink-500/20', border: 'border-pink-500/50' });
        if (hasNtr) result.push({ id: 'ntr', label: '💔 사랑 파괴자', text: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/50' });
        if (allTags.some(t => MEDIA_SET.has(t))) result.push({ id: '2nd', label: '🎨 2차창작', text: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/50' });
        if (['판타지', '마법', '기사', '마왕', '용사', '엘프', '드래곤'].some(t => tagSet.has(t))) result.push({ id: 'fantasy', label: '🗡️ 판타지', text: 'text-indigo-300', bg: 'bg-indigo-500/20', border: 'border-indigo-500/50' });

        if (daysSince <= 90) result.push({ id: 'newbie', label: '🌱 뉴비', text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50' });
        if (daysSince >= 548) result.push({ id: 'military', label: '🎖️ 이병부터 병장까지', text: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/50' });
        else if (daysSince >= 365) result.push({ id: 'oneyear', label: '🎂 벌써 1년', text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50' });

        if (tagSet.has('사이버펑크') || tagSet.has('cyberpunk')) result.push({ id: 'cyber', label: '⚡ 사펑', gradient: true });
        if (tagSet.has('메스가키') || tagSet.has('도발')) result.push({ id: 'mesu', label: '🩷 허접', text: 'text-pink-400', bg: 'bg-pink-600/20', border: 'border-pink-600/50' });
        if (unlimitedCount > 0) result.push({ id: 'unlimit', label: '🔮 언리밋', text: 'text-violet-300', bg: 'bg-violet-500/20', border: 'border-violet-500/50' });
        if (['수인', '수인형', '퍼리', 'furry'].some(t => tagSet.has(t))) result.push({ id: 'furry', label: '🐾 털', text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50' });

        const hasMillionChar = characters.some(c => (c.interactionCount || 0) >= 1000000);
        const hasHalfMillionChar = characters.some(c => (c.interactionCount || 0) >= 500000);
        const hatTrick = characters.filter(c => (c.interactionCount || 0) >= 1000000).length >= 3;

        if (hatTrick) result.push({ id: 'hattrick', label: '🎩 해트트릭', text: 'text-indigo-300', bg: 'bg-indigo-500/20', border: 'border-indigo-500/50' });
        if (hasMillionChar) result.push({ id: 'platinum', label: '💿 플래티넘 디스크', text: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/50' });
        else if (hasHalfMillionChar) result.push({ id: 'gold_disc', label: '📀 골든 디스크', text: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' });

        const totalInteractionStats = characters.reduce((s, c) => s + (c.interactionCount || 0), 0);
        if (totalInteractionStats >= 10000000) result.push({ id: '10m', label: '🎬 천만관객', text: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' });
        else if (totalInteractionStats >= 1000000) result.push({ id: '1m', label: '💬 밀리언', text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50' });

        if ((stats.followerCount || 0) >= 10000) result.push({ id: 'superstar', label: '🌌 우주대스타', gradient: true });

        // 새 칭호: 데이터 기반 (시간대 제거 후 추가)
        if (characters.length >= 50) result.push({ id: 'family', label: '👨‍👩‍👧‍👦 또 하나의 가족', text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/50' });
        if (characters.length >= 100) result.push({ id: 'fertile', label: '🌾 다산의 상징', text: 'text-lime-300', bg: 'bg-lime-500/20', border: 'border-lime-500/50' });
        if (tagSet.has('일진')) result.push({ id: 'iljin', label: '🏀 야 체육 안가고 뭐해', text: 'text-orange-300', bg: 'bg-orange-500/20', border: 'border-orange-500/50' });
        if (tagSet.has('찐따')) result.push({ id: 'jjindda', label: '🚶 니 애인 지나간다', text: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/50' });
        const hasNo2nd = !allTags.some(t => MEDIA_SET.has(t));
        if (hasNo2nd && characters.length > 0) result.push({ id: 'original', label: '✨ 오리지널', text: 'text-sky-300', bg: 'bg-sky-500/20', border: 'border-sky-500/50' });

        return result;
    }, [characters, daysSince, stats]);

    // 배경 이미지 로드
    const getBackgroundForSlide = (index) => {
        switch (index) {
            case 0: return getPlotImageUrl(topChar);
            case 1: return ''; // 주야간 슬라이드는 CSS 레이어로 덮음
            case 2: return getPlotImageUrl(oldestChar);
            case 3: return getPlotImageUrl(topChar);
            case 4: return getPlotImageUrl(newestChar);
            case 5: return profile?.profileImageUrl || getPlotImageUrl(topChar);
            case 6: return getPlotImageUrl(newestChar);
            case 7: return ''; // CSS 그라데이션
            default: return '';
        }
    };

    const bgUrl = getBackgroundForSlide(currentSlide);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in transition-all duration-500">
            {/* 메인 컨테이너 (PC에서는 화면 중앙 레터박스) */}
            <div className="relative w-full h-full max-w-[480px] bg-stone-900 overflow-hidden shadow-2xl flex flex-col mx-auto">

                {/* === 백그라운드 레이어 === */}
                {bgUrl ? (
                    <div className="absolute inset-0 z-0">
                        <img src={proxyImageUrl(bgUrl)} alt="background" className="w-full h-full object-cover blur-md scale-110 opacity-30 mix-blend-screen transition-all duration-1000" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/80 to-black transition-all duration-1000" />
                    </div>
                ) : (
                    currentSlide === 1 ? (
                        <div className={`absolute inset-0 z-0 bg-gradient-to-br transition-all duration-1000 ${isNightOwl ? 'from-indigo-950 via-slate-900 to-black' : 'from-sky-900 via-blue-900 to-black'}`} />
                    ) : (
                        <div className={`absolute inset-0 z-0 bg-gradient-to-br from-${tier?.color?.split('-')[1] || 'gray'}-900 via-black to-black transition-all duration-1000`} />
                    )
                )}

                {/* === 상단 인디케이터 바 및 닫기 버튼 === */}
                <div className="absolute top-0 inset-x-0 z-50 p-4 sm:p-5">
                    <div className="flex items-center gap-1.5 mb-5">
                        {Array.from({ length: totalSlides }).map((_, i) => (
                            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all duration-300 ease-out"
                                    style={{ width: i < currentSlide ? '100%' : i === currentSlide ? '100%' : '0%' }}
                                />
                            </div>
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

                {/* === 좌우 이동용 클릭 액션 구역 === */}
                <div className="absolute inset-x-0 bottom-[10%] top-[15%] z-40 cursor-pointer" onClick={handleAreaClick} />

                {/* === 메인 슬라이드 컨텐츠 === */}
                <div className="relative z-30 flex-1 flex flex-col items-center justify-center p-8 sm:p-10 text-center pointer-events-none">

                    {/* [0] 종합 대화량 */}
                    {currentSlide === 0 && (
                        <div className="animate-slide-up space-y-6">
                            <div className="w-32 h-32 mx-auto rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.4)] ring-2 ring-white/20 mb-10 transform hover:scale-105 transition-transform duration-700">
                                <img src={proxyImageUrl(getPlotImageUrl(topChar))} alt="Top Char" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-sm md:text-base text-gray-300 font-medium tracking-wide">지금까지 달성한 총 대화 기록,</p>
                            <h2 className="text-5xl md:text-6xl font-black text-white leading-tight drop-shadow-lg flex flex-col gap-2">
                                <span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]" style={{ animation: 'pulse-slow 3s infinite' }}>{formatCompactNumber(totalInteractionCount)}</span>
                                <span className="text-3xl">대화</span>
                            </h2>
                        </div>
                    )}

                    {/* [1] 활동 시간 분석 */}
                    {currentSlide === 1 && (
                        <div className="animate-slide-up space-y-8 flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md shadow-inner ring-1 ring-white/20 mb-6">
                                {isNightOwl ? <Moon size={48} className="text-indigo-400 animate-pulse" /> : <Sun size={48} className="text-amber-400 animate-pulse" />}
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm md:text-base text-gray-300 font-medium animate-fade-in-up delay-100">당신의 창작 뮤즈가 깨어나는 시간은</p>
                                <h2 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r animate-fade-in-up delay-200 ${isNightOwl ? 'from-indigo-400 to-purple-400' : 'from-amber-400 to-orange-400'} leading-tight drop-shadow-lg pb-1`}>
                                    {isNightOwl ? '깊은 밤의 올빼미' : '이른 아침의 얼리버드'}
                                </h2>
                                <p className="text-xs text-gray-400 mt-2 px-6 leading-relaxed animate-fade-in-up delay-300">자정의 고요함, 혹은 햇살이 내리쬐는 오후, 당신의 창의력은 언제나 빛을 발했습니다.</p>

                                <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-xs mx-auto animate-fade-in-up delay-500">
                                    {[
                                        { label: '새벽 (00~06시)', count: timeSlots.dawn, color: 'text-indigo-300' },
                                        { label: '아침 (06~12시)', count: timeSlots.morning, color: 'text-emerald-300' },
                                        { label: '오후 (12~18시)', count: timeSlots.afternoon, color: 'text-amber-300' },
                                        { label: '저녁 (18~24시)', count: timeSlots.night, color: 'text-purple-300' }
                                    ].map(slot => (
                                        <div key={slot.label} className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col items-center justify-center gap-1">
                                            <span className="text-[10px] text-gray-400">{slot.label}</span>
                                            <span className={`text-lg font-bold ${slot.color}`}>{slot.count}회</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* [2] 오리진 캐릭터 */}
                    {currentSlide === 2 && (
                        <div className="animate-slide-up space-y-6">
                            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-emerald-500/50 mb-8 transform scale-100 animate-[bounce-subtle_3s_ease-in-out_infinite]">
                                <img src={proxyImageUrl(getPlotImageUrl(oldestChar))} alt="Oldest Char" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-sm md:text-base text-gray-300 font-medium">모든 이야기의 시작,</p>
                            <h2 className="text-3xl font-black text-white leading-snug drop-shadow-md mb-6 px-4">
                                "{oldestChar?.name}"
                            </h2>
                            <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                                <span className="text-emerald-400 font-bold tracking-tight">처음 만났던 첫 캐릭터</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-4">만난 지 <span className="text-emerald-300 font-bold">{daysSince.toLocaleString()}</span>일이 되었어요</p>
                        </div>
                    )}

                    {/* [3] 단기 압축 성장량 */}
                    {currentSlide === 3 && (
                        <div className="animate-slide-up space-y-8">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)] mb-4 transform hover:rotate-12 transition-transform">
                                <TrendingUp size={40} className="text-white" />
                            </div>
                            <p className="text-sm md:text-base text-gray-300 font-medium animate-fade-in-up delay-100">쉼 없이 달려온 여정</p>
                            <h2 className="flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0 leading-tight drop-shadow-lg animate-fade-in-up delay-200 max-w-[90vw]">
                                <span className="text-white font-black text-2xl sm:text-3xl md:text-4xl">제작을 시작한 지</span>
                                <span className="text-cyan-400 font-black shrink-0" style={{ fontSize: 'clamp(1.5rem, 7vw, 2.25rem)' }}>{daysSince.toLocaleString()}</span>
                                <span className="text-white font-black text-2xl sm:text-3xl md:text-4xl">일 만에</span>
                            </h2>
                            <h3 className="text-xl md:text-2xl font-bold text-gray-100 animate-fade-in-up delay-300">
                                무려 <span className="text-cyan-300 text-3xl font-black">{characters.length}</span>개의 스토리를 탄생시켰습니다.
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-4 animate-fade-in-up delay-500 max-w-xs mx-auto px-4 bg-white/5 py-2.5 rounded-full border border-white/10">
                                💡 평균적으로 <strong>{Math.max(1, Math.round(daysSince / characters.length))}</strong>일에 1번씩 꾸준히 업데이트 되었습니다!
                            </p>
                        </div>
                    )}

                    {/* [4] 최신 캐릭터 */}
                    {currentSlide === 4 && (
                        <div className="animate-slide-up space-y-6">
                            <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden shadow-[0_0_20px_rgba(236,72,153,0.4)] ring-2 ring-pink-500/50 mb-8 filter contrast-125 transform scale-100 animate-[pulse-slow_4s_infinite]">
                                <img src={proxyImageUrl(getPlotImageUrl(newestChar))} alt="Newest Char" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-sm md:text-base text-gray-300 font-medium animate-fade-in-up delay-100">그리고 지금 이 순간에도 이어지는 이야기,</p>
                            <h2 className="text-3xl font-black text-white leading-snug drop-shadow-lg mb-4 animate-fade-in-up delay-200">
                                "{newestChar?.name}"
                            </h2>
                            <div className="text-pink-400 text-xs font-bold uppercase tracking-[0.2em] mt-2 animate-fade-in-up delay-300">The latest Creation</div>

                            {/* 최신 캐릭터의 주요 태그들 */}
                            <div className="flex justify-center gap-2 mt-6 animate-fade-in-up delay-500">
                                {(newestChar?.hashtags || newestChar?.tags || []).slice(0, 3).map((tag, i) => (
                                    <span key={i} className="px-3 py-1.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* [5] 커뮤니티 파워 (팔로워) */}
                    {currentSlide === 5 && (
                        <div className="animate-slide-up space-y-8">
                            <div className="w-36 h-36 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-blue-500/40 bg-stone-800 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)] animate-fade-in">
                                <img src={proxyImageUrl(profile?.profileImageUrl || getPlotImageUrl(topChar))} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm md:text-base text-gray-300 font-medium animate-fade-in-up delay-100">수많은 유저들이 당신의 세계관에 매료되었습니다.</p>
                                <h2 className="text-5xl font-black text-white leading-tight drop-shadow-lg flex flex-col items-center justify-center gap-3 animate-fade-in-up delay-200">
                                    <div className="flex items-center gap-3">
                                        <Users size={40} className="text-blue-400" />
                                        <span className="text-blue-400">{formatNumber(stats.followerCount || 0)}</span>
                                    </div>
                                    <span className="text-2xl text-gray-200">팔로워</span>
                                </h2>
                            </div>
                        </div>
                    )}

                    {/* [6] 업적 및 칭호 타임라인 */}
                    {currentSlide === 6 && (
                        <div className="animate-slide-up space-y-8 w-full">
                            <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center shadow-lg mb-2">
                                <Award size={32} className="text-yellow-400" />
                            </div>
                            <p className="text-sm md:text-base text-gray-300 font-medium mb-6">여정의 발자취가 새겨진 특별한 칭호들</p>
                            <div className="flex flex-wrap justify-center gap-2.5 px-4 h-[250px] overflow-hidden content-center">
                                {allPills.slice(0, 10).map((pill, idx) => (
                                    pill.gradient ? (
                                        <div key={pill.id} className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-xl transform hover:scale-110 transition-transform flex items-center gap-1.5"
                                            style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', animation: `slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.15 + 0.2}s both` }}>
                                            {pill.label}
                                        </div>
                                    ) : (
                                        <div key={pill.id} className={`px-5 py-2.5 rounded-full ${pill.bg} border ${pill.border} ${pill.text} font-bold text-sm shadow-xl backdrop-blur-md transform hover:scale-110 transition-transform flex items-center gap-1.5`}
                                            style={{ animation: `slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.15 + 0.2}s both` }}>
                                            {pill.label}
                                        </div>
                                    )
                                ))}
                                {allPills.length === 0 && (
                                    <div className="text-gray-400 text-sm mt-4">아직 획득한 특수 칭호가 없습니다.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* [7] 피날레: 티어 */}
                    {currentSlide === 7 && (
                        <div className="animate-slide-up space-y-6 flex flex-col items-center">
                            <div className="mb-6 transform scale-[1.7] md:scale-[2.0] mt-8">
                                <CreatorTierBadge tier={tier} score={score} />
                            </div>
                            <div className="mt-16 space-y-2">
                                <p className="text-sm md:text-base text-gray-300 font-medium tracking-wide">달성한 종합 티어</p>
                                <h2 className="text-5xl md:text-6xl font-black leading-tight drop-shadow-md py-1" style={{ color: tier?.color ?? '#9ca3af' }}>
                                    {tier?.name || '티어 없음'}
                                </h2>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 mt-2">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ELO Score</span>
                                    <span className="text-lg font-black font-mono text-[var(--accent)]">{(score || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mt-8">We Support Your Next Journey</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
