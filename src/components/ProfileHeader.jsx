import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  formatCompactNumber, getCreatorTier, CREATOR_TIERS,
  calculateCreatorScore, toKST, getCharacterTier
} from '../utils/tierCalculator';
import TierIcon from './ui/TierIcon';
import HoverNumber from './HoverNumber';
import { Pin, Link2, Check, Heart } from 'lucide-react';
import { computeEarnedTitles, BADGE_COLOR_MAP, FIXED_BADGE_IDS } from '../data/badges';
import ImageWithFallback from './ImageWithFallback';
import { getCreatorBadge, saveCreatorBadge } from '../utils/storage';
import LiveViewModal from './LiveViewModal';

// A2: 카운트업 훅 — 0 → target easeOut 애니메이션
function useCountUp(target, duration) {
  const prefersReduced = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const isMobile = useMemo(() =>
    typeof window !== 'undefined' && window.innerWidth < 640, []);
  const d = prefersReduced ? 0 : (isMobile ? 800 : (duration || 1200));
  const [val, setVal] = useState(prefersReduced ? target : 0);

  useEffect(() => {
    if (prefersReduced || d === 0) { setVal(target); return; }
    setVal(0);
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / d);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return val;
}

// 티어 공개 연출용 — start()를 호출하기 전까지 카운팅 안 함
function useTierRevealScore(target, onComplete) {
  const prefersReduced = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [val, setVal] = useState(prefersReduced ? target : 0);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (prefersReduced) {
      setVal(target);
      onComplete?.();
      return;
    }
    const d = typeof window !== 'undefined' && window.innerWidth < 640 ? 280 : 300;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const progress = Math.min(1, (now - t0) / d);
      const eased = 1 - Math.pow(1 - progress, 2.5);
      setVal(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(target);
        onComplete?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [target, prefersReduced, onComplete]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { val, start };
}

const TIER_KO = {
  unranked: 'UNRANKED', bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD',
  platinum: 'PLATINUM', diamond: 'DIAMOND', master: 'MASTER', champion: 'CHAMPION',
};

// _ 로 시작하면 첫 번째 비-underscore 글자 반환
function getInitial(nickname) {
  const str = nickname || '?';
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== '_') return str[i];
  }
  return '?';
}

// 별 파티클 생성 — 매 마운트마다 무작위
function generateSparkles() {
  return Array.from({ length: 9 }, (_, i) => {
    const angle = (i / 9) * Math.PI * 2 + (Math.random() * 0.9 - 0.45);
    const r = 30 + Math.random() * 38;
    return {
      tx: `${Math.round(Math.cos(angle) * r)}px`,
      ty: `${Math.round(Math.sin(angle) * r)}px`,
      size: (1.5 + Math.random() * 2.5).toFixed(1),
      dur: `${(2.2 + Math.random() * 2.4).toFixed(1)}s`,
      delay: `-${(Math.random() * 3).toFixed(1)}s`, // 음수 딜레이로 이미 진행 중인 것처럼
      op: (0.35 + Math.random() * 0.45).toFixed(2),
    };
  });
}

// 오로라 블롭 생성 — 매 마운트마다 무작위
function generateAuroras() {
  return [
    { tx: `${-18 + Math.round(Math.random() * 12)}px`, ty: `${-38 + Math.round(Math.random() * 10)}px`, w: 82 + Math.round(Math.random() * 30), h: 52 + Math.round(Math.random() * 18), dur: `${(6.5 + Math.random() * 2).toFixed(1)}s`, delay: '0s',    op: (0.14 + Math.random() * 0.08).toFixed(2) },
    { tx: `${28 + Math.round(Math.random() * 14)}px`,  ty: `${12 + Math.round(Math.random() * 10)}px`,  w: 62 + Math.round(Math.random() * 24), h: 44 + Math.round(Math.random() * 16), dur: `${(8 + Math.random() * 2).toFixed(1)}s`,   delay: '-2.1s', op: (0.11 + Math.random() * 0.07).toFixed(2) },
    { tx: `${-32 + Math.round(Math.random() * 10)}px`, ty: `${18 + Math.round(Math.random() * 12)}px`,  w: 54 + Math.round(Math.random() * 20), h: 38 + Math.round(Math.random() * 14), dur: `${(5.5 + Math.random() * 2).toFixed(1)}s`, delay: '-1.3s', op: (0.10 + Math.random() * 0.06).toFixed(2) },
  ];
}

const TIER_COLORS = {
  unranked: '#6B7280',
  bronze:   '#C58356',
  silver:   '#9CA3AF',
  gold:     '#FBBF24',
  platinum: '#E2E8F0',
  diamond:  '#3B82F6',
  master:   '#D946EF',
  champion: '#F97316',
};

export default function ProfileHeader({ profile, stats, characters, onLiveClick, editing: editingProp, setEditing: setEditingProp, onTierReveal }) {
  const navigate = useNavigate();
  const [showRecap, setShowRecap] = useState(false);
  const [editingInternal, setEditingInternal] = useState(false);
  const [revealPhase, setRevealPhase] = useState(0); // 0=초기 1=프로필인 2=카운팅 3=잠금 4=티어등장
  const [tierVisible, setTierVisible] = useState(false);
  const sparkleParticles = useMemo(() => generateSparkles(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const auroraBlobs      = useMemo(() => generateAuroras(),  []); // eslint-disable-line react-hooks/exhaustive-deps
  const editing = editingProp !== undefined ? editingProp : editingInternal;
  const setEditing = setEditingProp || setEditingInternal;
  const [copied, setCopied] = useState(false);
  const [globalRank, setGlobalRank] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    fetch('/api/get-rankings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data || !data.rankings) return;
        const idx = data.rankings.findIndex(r => r.id === profile.id);
        if (idx !== -1) setGlobalRank(idx + 1);
      }).catch(err => console.error(err));
  }, [profile?.id]);

  // Hash 기반 Recap 열기/닫기
  React.useEffect(() => {
    const handleHashChange = () => setShowRecap(window.location.hash === '#recap');
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openRecap = useCallback(() => { window.location.hash = 'recap'; }, []);
  const closeRecap = useCallback(() => {
    if (window.location.hash === '#recap') history.back();
    else setShowRecap(false);
  }, []);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, []);


  const breakdown = useMemo(() => {
    if (!profile || !stats) return null;
    const sorted = (characters || []).sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    const top20Sum = sorted.slice(0, 20).reduce((acc, c) => acc + (c.interactionCount || 0), 0);
    const charCount = characters?.length || (stats.plotCount || 1);
    const totalInteractions = stats.plotInteractionCount || 0;
    const dates = (characters || []).map(c => c.createdAt || c.createdDate).filter(Boolean).map(d => toKST(d).getTime()).filter(t => !isNaN(t));
    const activityDays = Math.max(1, dates.length > 0 ? (toKST().getTime() - Math.min(...dates)) / 86400000 : 1);
    return {
      interactions: totalInteractions,
      followers: stats.followerCount || 0,
      avgInteractions: charCount > 0 ? totalInteractions / charCount : 0,
      activityDays: Math.floor(activityDays),
      voicePlays: stats.voicePlayCount || 0,
      top20Sum,
    };
  }, [stats, characters, profile]);

  // 상위 해시태그
  const topTags = useMemo(() => {
    if (!characters) return [];
    const counts = {};
    characters.forEach(c => (c.hashtags || c.tags || []).forEach(t => { if (t) counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag]) => tag);
  }, [characters]);

  if (!profile || !stats) return null;

  const score = calculateCreatorScore(stats, characters);
  const tier = getCreatorTier(score);

  // A2: 카운트업 값
  const animInteractions = useCountUp(stats.plotInteractionCount || 0);
  const animFollowers = useCountUp(stats.followerCount || 0);
  const animCharCount = useCountUp(characters?.length ?? stats.plotCount ?? 0);

  const handleScoreDone = useCallback(() => {
    // 카운팅 완료 → 즉시 티어 등장 (효과는 이미 phase 3에서 시작됨)
    setRevealPhase(4);
    setTierVisible(true);
    onTierReveal?.();
  }, [onTierReveal]);

  const { val: animScore, start: startScore } = useTierRevealScore(score, handleScoreDone);

  // 타이밍: 50ms(딜레이) + 300ms(카운팅) = ~350ms에 카운팅 끝
  // 효과(phase 3)는 200ms에 시작 → 효과 보이고 150ms 뒤 티어 등장 (총 ~0.5s)
  useEffect(() => {
    setRevealPhase(1);
    const tCount   = setTimeout(() => { setRevealPhase(2); startScore(); }, 50);
    const tEffects = setTimeout(() => { setRevealPhase(3); },              200);
    return () => { clearTimeout(tCount); clearTimeout(tEffects); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // B2: 다음 티어 정보
  const nextTierInfo = useMemo(() => {
    if (tier.key === 'champion') return null;
    const nextTier = CREATOR_TIERS.find(t => t.min === tier.nextGoalScore);
    if (!nextTier) return null;
    const remaining = Math.max(0, tier.nextGoalScore - score);
    return { key: nextTier.key, name: nextTier.name, color: nextTier.color, remaining };
  }, [tier, score]);
  const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
  const subRoman = tier.subdivision ? (romanMap[tier.subdivision] || '') : '';
  const tierName = TIER_KO[tier.key] || tier.name?.toUpperCase() || 'UNRANKED';
  const tierLabel = `${tierName}${subRoman ? ' ' + subRoman : ''}`;
  const progressPct = tier.subProgress ?? tier.progress ?? 0;
  const tierColor = TIER_COLORS[tier.key] || TIER_COLORS.unranked;

  // ELO progress bar: current score → next tier threshold
  const nextMin = tier.nextGoalScore || score;
  const currentMin = tier.min || 0;

  return (
    <>
      <div className="ph-wrap">
        {/* 아바타 + 이름/핸들 */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="ph-avatar-ring" style={{ '--tier-color': tierColor }}>
              <div className="ph-avatar">
                {profile.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt={profile.nickname} crossOrigin="anonymous" loading="eager" />
                ) : (
                  <span className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-300 to-indigo-400">
                    {getInitial(profile.nickname)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <h1 className="font-serif-kr text-[22px] mt-4 font-bold tracking-tight text-white">{profile.nickname}</h1>
          <span className="text-[13px] text-gray-500 mt-1">@{profile.username}</span>


          {/* 칭호 pills */}
          <div className="mt-4">
            <CreatorPills
              characters={characters}
              stats={stats}
              creatorId={profile.id || profile.username || 'unknown'}
              editing={editing}
              setEditing={setEditing}
            />
          </div>
        </div>

        {/* 메인 스탯 glass card */}
        <div className="ph-stat-card">
          {/* 티어 아이콘 + 이름 */}
          <div className="flex flex-col items-center justify-center pt-[22px] pb-[19px] border-b border-white/[0.04] relative">
            {/* 앰비언트 글로우 — 티어 공개 후에만 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full pointer-events-none"
              style={{
                background: `${tierColor}40`,
                filter: 'blur(32px)',
                opacity: tierVisible ? 1 : 0,
                transition: 'opacity 0.9s ease',
              }}
            />

            {/* 별 + 오로라 — phase 3부터 페이드인, 이후 계속 유지 */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ opacity: revealPhase >= 3 ? 1 : 0, transition: 'opacity 0.5s ease' }}
            >
              {/* 오로라 블롭 */}
              {auroraBlobs.map((a, i) => (
                <div
                  key={`au-${i}`}
                  className="aurora-blob"
                  style={{
                    '--au-tx': a.tx,
                    '--au-ty': a.ty,
                    '--au-op': a.op,
                    '--au-dur': a.dur,
                    '--au-delay': a.delay,
                    width: `${a.w}px`,
                    height: `${a.h}px`,
                    marginLeft: `${-a.w / 2}px`,
                    marginTop: `${-a.h / 2}px`,
                    background: tierColor,
                    filter: 'blur(14px)',
                    animationDelay: a.delay,
                    animationDuration: a.dur,
                  }}
                />
              ))}
              {/* 별 파티클 */}
              {sparkleParticles.map((p, i) => (
                <div
                  key={`st-${i}`}
                  className="sp-star"
                  style={{
                    '--sp-tx': p.tx,
                    '--sp-ty': p.ty,
                    '--sp-dur': p.dur,
                    '--sp-delay': p.delay,
                    '--sp-op': p.op,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    marginLeft: `${-p.size / 2}px`,
                    marginTop: `${-p.size / 2}px`,
                    background: i % 3 === 0 ? '#ffffff' : tierColor,
                    boxShadow: `0 0 ${parseFloat(p.size) * 3}px ${i % 3 === 0 ? '#ffffff88' : `${tierColor}99`}`,
                    animationDelay: p.delay,
                    animationDuration: p.dur,
                  }}
                />
              ))}
            </div>

            {/* 티어 아이콘 — 공개 전까지 숨김 */}
            <button
              onClick={() => navigate('/tier')}
              className={`relative z-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform ${
                tierVisible ? 'tier-erupt' : 'opacity-0 pointer-events-none'
              }`}
              title="티어 가이드 보기"
              style={{ transformOrigin: 'center center' }}
            >
              <TierIcon tier={tier.key} size={70} rank={globalRank} />
            </button>
            <div
              className="mt-4 flex flex-col items-center z-10"
              style={{ opacity: tierVisible ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}
            >
              <span
                className="text-[12px] sm:text-[16px] font-black tracking-[0.15em] sm:tracking-[0.25em] uppercase bg-clip-text text-transparent"
                style={
                  globalRank && globalRank <= 10
                    ? { backgroundImage: `linear-gradient(to right, #FFFFFF, #E2E8F0)`, textShadow: '0 0 10px rgba(255,255,255,0.5), 0 0 4px #FFFFFF' }
                    : { backgroundImage: `linear-gradient(to right, ${tierColor}, ${tierColor}CC)` }
                }
              >
                {globalRank && globalRank <= 10 ? `TOP ${globalRank}` : tierLabel}
              </span>
            </div>
          </div>

          {/* 3열 통계 */}
          <div className="flex justify-between items-center py-6 px-4">
            <div className="flex flex-col items-center w-1/3">
              <span className="text-2xl font-black text-white tracking-tight">
                <HoverNumber value={animInteractions} />
              </span>
              <span className="text-[11px] text-gray-500 mt-1 font-semibold uppercase tracking-widest">대화량</span>
            </div>
            <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="flex flex-col items-center w-1/3">
              <span className="text-2xl font-black text-white tracking-tight">
                {animFollowers.toLocaleString()}
              </span>
              <span className="text-[11px] text-gray-500 mt-1 font-semibold uppercase tracking-widest">팔로워</span>
            </div>
            <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="flex flex-col items-center w-1/3">
              <span className="text-2xl font-black text-white tracking-tight">
                <HoverNumber value={animCharCount} />
              </span>
              <span className="text-[11px] text-gray-500 mt-1 font-semibold uppercase tracking-widest">캐릭터</span>
            </div>
          </div>

          {/* ELO 프로그레스 바 + B2 다음 티어 미터 */}
          <div className="pt-3 pb-5 px-6 border-t border-white/[0.04] bg-white/[0.01]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-gray-500 font-semibold tracking-wider">ELO SCORE</span>
              <span
                className={`text-[10px] font-medium transition-colors ${revealPhase === 3 ? 'tier-lock-flash' : ''}`}
                style={{ color: revealPhase >= 3 ? tierColor : 'rgb(107 114 128)' }}
              >
                {formatCompactNumber(animScore)}
                {tier.nextGoalScore && tier.key !== 'champion' && (
                  <span style={{ color: revealPhase >= 3 ? `${tierColor}66` : 'rgb(75 85 99)' }}> / {formatCompactNumber(tier.nextGoalScore)}</span>
                )}
              </span>
            </div>
            <div className="relative h-[4px] w-full bg-black/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, Math.max(2, progressPct))}%`,
                  background: `linear-gradient(to right, ${tierColor}99, ${tierColor}CC, ${tierColor})`,
                }}
              />
              {/* 다음 티어 목표 마커 */}
              {nextTierInfo && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[8px] rounded-full opacity-40" style={{ background: nextTierInfo.color }} />
              )}
            </div>
            {/* B2: 다음 티어까지 남은 거리 */}
            {tier.key === 'champion' ? (
              <p className="text-[10px] text-center mt-2 font-bold" style={{ color: tierColor }}>🏆 최고 티어 달성</p>
            ) : nextTierInfo && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-600">다음 티어</span>
                <span className="text-[10px] font-semibold" style={{ color: nextTierInfo.color }}>
                  {nextTierInfo.name} — {formatCompactNumber(nextTierInfo.remaining)} pt 더
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 링크 복사 버튼 (카드 하단 이동) */}
        <div className="mt-3 flex justify-center">
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.15] text-sm font-semibold text-white/70 hover:text-white transition-all active:scale-95"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Link2 size={16} />}
            <span>{copied ? '프로필 링크가 복사되었습니다!' : '프로필 링크 복사'}</span>
          </button>
        </div>

        {/* 프로필 태그 + LIVE 버튼 */}
        {(topTags.length > 0 || onLiveClick) && (
          <div className="flex items-center justify-between mt-4">
            <div className="flex flex-nowrap gap-1.5 overflow-hidden flex-1">
              {topTags.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[12px] text-gray-400 shrink-0">
                  #{tag}
                </span>
              ))}
            </div>
            <button
              onClick={onLiveClick || openRecap}
              className="ml-2 px-4 py-2 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(74,127,255,0.3), rgba(59,130,246,0.2))',
                border: '1px solid rgba(74,127,255,0.5)',
                color: '#7AA3FF',
                boxShadow: '0 0 12px rgba(74,127,255,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              LIVE
            </button>
          </div>
        )}
      </div>

      {/* LiveView 모달 — portal로 document.body에 렌더링 */}
      {showRecap && createPortal(
        <LiveViewModal
          isOpen={showRecap}
          onClose={closeRecap}
          characters={characters || []}
          stats={stats}
          profile={profile}
          tier={tier}
          score={score}
        />,
        document.body
      )}
    </>
  );
}

// ===== 크리에이터 특성 Pill 뱃지 =====
function CreatorPills({ characters, stats, creatorId, editing, setEditing }) {
  const allTitles = useMemo(() => computeEarnedTitles({ characters, stats }), [characters, stats]);
  const allEarned = useMemo(() => allTitles.filter(t => t.earned), [allTitles]);
  const fixedIds = FIXED_BADGE_IDS;

  // 초기값: 대화량 최고 칭호 + 캐릭터 최고 칭호 + 태그 칭호 2개 (순애/NTR 있으면 0개)
  const defaultIds = useMemo(() => {
    const interactionEarned = allEarned.filter(p => p.category === 'interaction');
    const highestInteraction = interactionEarned[interactionEarned.length - 1];

    const charEarned = allEarned.filter(p => p.category === 'char_interaction');
    const highestChar = charEarned[charEarned.length - 1];

    const hasSpecialTag = allEarned.some(p => p.id === 'sunae' || p.id === 'ntr');
    const tagEarned = allEarned.filter(p => p.category === 'tag' && p.id !== 'sunae' && p.id !== 'ntr');
    const topTags = hasSpecialTag ? [] : tagEarned.slice(0, 2);

    return [highestInteraction, highestChar, ...topTags].filter(Boolean).map(p => p.id);
  }, [allEarned]);

  const [selected, setSelected] = useState(() => {
    if (creatorId) {
      const stored = getCreatorBadge(creatorId);
      if (stored && Array.isArray(stored) && stored.length > 0) return stored;
    }
    return null; // null → defaultIds 사용
  });

  React.useEffect(() => {
    if (!creatorId) return;
    const storedIds = getCreatorBadge(creatorId);
    if (storedIds && Array.isArray(storedIds) && storedIds.length > 0) {
      const validIds = storedIds.filter(id => allEarned.some(e => e.id === id));
      if (validIds.length > 0) setSelected(validIds);
    }
  }, [creatorId, allEarned]);

  React.useEffect(() => {
    if (editing) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [editing]);

  const activeIds = useMemo(() => {
    const base = selected ?? defaultIds;
    const presentFixed = allEarned.filter(p => fixedIds.includes(p.id)).map(p => p.id);
    const unified = Array.from(new Set([...presentFixed, ...base]));
    return unified.slice(0, 4);
  }, [selected, defaultIds, allEarned, fixedIds]);

  const toggleId = (id) => {
    if (fixedIds.includes(id)) return;
    setSelected(prev => {
      const cur = prev ?? defaultIds;
      let newSel;
      if (cur.includes(id)) {
        newSel = cur.filter(x => x !== id);
      } else if (cur.length >= 4) {
        // 4개 꽉 찼을 때는 교체 불가 (체크박스 disabled로 처리)
        newSel = cur;
      } else {
        newSel = [...cur, id];
      }
      if (creatorId) saveCreatorBadge(creatorId, newSel);
      return newSel;
    });
  };

  const visible = allEarned.filter(p => activeIds.includes(p.id));
  if (allEarned.length === 0) return null;

  const pillNodes = visible.map(p => {
    const style = BADGE_COLOR_MAP[p.color] || BADGE_COLOR_MAP.slate;
    const isGradient = p.color === 'gradient';
    const label = `${p.emoji} ${p.title}`;
    return (
      <div key={p.id} className="relative group/pill shrink-0">
        <span
          className={`px-3 py-1.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 ${
            isGradient
              ? 'text-white border-blue-400/30'
              : `${style.bg} border-white/5 ${style.text}`
          }`}
          style={isGradient ? { background: 'linear-gradient(135deg, #4A7FFF, #3B82F6)' } : { background: 'rgba(255,255,255,0.03)' }}
        >
          {label}
        </span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-[#1A1625] border border-white/10 rounded-lg shadow-lg text-[10px] text-gray-400 whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity pointer-events-none z-50">
          {p.desc}
        </div>
      </div>
    );
  });

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {pillNodes}

      {/* 편집 모달 */}
      {editing && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={e => e.target === e.currentTarget && setEditing(false)}
        >
          <div
            className="w-full sm:max-w-md max-h-[85dvh] flex flex-col sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ background: '#130F1E', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <span className="font-bold text-white text-[15px]">칭호 설정</span>
                <p className="text-[11px] text-gray-500 mt-0.5">최대 4개까지 표시됩니다</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-semibold text-blue-400">{activeIds.length} / 4</span>
                <button
                  onClick={() => setEditing(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
            </div>

            {/* 목록 */}
            <div className="overflow-y-auto flex-1 py-2">
              {allEarned.map(p => {
                const isFixed = fixedIds.includes(p.id);
                const checked = activeIds.includes(p.id);
                const disabled = isFixed || (!checked && activeIds.length >= 4);
                const style = BADGE_COLOR_MAP[p.color] || BADGE_COLOR_MAP.slate;

                return (
                  <button
                    key={p.id}
                    onClick={() => !disabled && toggleId(p.id)}
                    disabled={disabled && !checked}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                      checked
                        ? 'bg-white/[0.05]'
                        : disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* 체크박스 */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                        checked ? 'bg-blue-500 border-blue-500' : 'border border-white/20'
                      }`}
                    >
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>

                    {/* 칭호 뱃지 미리보기 */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${style.text}`}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {p.emoji} {p.title}
                    </span>

                    {/* 설명 */}
                    <span className="text-[12px] text-gray-500 truncate flex-1">{p.desc}</span>

                    {isFixed && (
                      <Pin size={10} className="text-gray-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
