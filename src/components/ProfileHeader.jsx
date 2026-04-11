import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  formatCompactNumber, getCreatorTier, CREATOR_TIERS,
  calculateCreatorScore, toKST, getCharacterTier, formatNumber
} from '../utils/tierCalculator';
import TierIcon from './ui/TierIcon';
import HoverNumber from './HoverNumber';
import { Pin, Link2, Check, Heart } from 'lucide-react';
import { computeEarnedTitles, BADGE_COLOR_MAP, FIXED_BADGE_IDS } from '../data/badges';
import ImageWithFallback from './ImageWithFallback';
import { getCreatorBadge, saveCreatorBadge } from '../utils/storage';
import LiveViewModal from './LiveViewModal';
import { Star, ChatTeardropDots, Users, Trophy } from '@phosphor-icons/react';

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
  const [tierVisible, setTierVisible] = useState(false);
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

  const topCharacter = useMemo(() => {
    if (!characters || characters.length === 0) return null;
    return [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))[0];
  }, [characters]);

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
    setTierVisible(true);
    onTierReveal?.();
  }, [onTierReveal]);

  const { val: animScore, start: startScore } = useTierRevealScore(score, handleScoreDone);

  useEffect(() => {
    const tCount = setTimeout(() => { startScore(); }, 50);
    return () => { clearTimeout(tCount); };
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
      {/* 수평 프로필 헤더 */}
      <div className="flex items-center justify-between mb-3 px-0">

        {/* 좌: 아바타 + 핸들/닉네임 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-[46px] h-[46px] lg:w-[56px] lg:h-[56px] rounded-2xl overflow-hidden"
              style={{
                boxShadow: tierVisible
                  ? `0 0 0 1.5px ${tierColor}60`
                  : '0 0 0 1.5px rgba(255,255,255,0.08)',
                transition: 'box-shadow 0.8s ease',
              }}
            >
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt={profile.nickname}
                  crossOrigin="anonymous"
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500/30 to-blue-500/30 flex items-center justify-center">
                  <span className="text-xl font-black text-white/70">{getInitial(profile.nickname)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-[15px] lg:text-[18px] font-bold text-white leading-tight truncate min-w-0">
                {profile.nickname}
              </h1>
              {breakdown?.activityDays > 0 && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-[2px] rounded-md"
                  style={{
                    color: '#a5b4fc',
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(139,92,246,0.2)',
                  }}
                >
                  D+{breakdown.activityDays}
                </span>
              )}
              {globalRank != null && globalRank <= 50 && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-[2px] rounded-md"
                  style={{
                    color: '#fbbf24',
                    background: 'rgba(251,191,36,0.12)',
                    border: '1px solid rgba(251,191,36,0.25)',
                  }}
                >
                  #{globalRank}
                </span>
              )}
            </div>
            <p className="text-[12px] lg:text-[14px] text-white/40 mt-0.5">@{profile.username}</p>
          </div>
        </div>

        {/* 우: 티어 아이콘 블록 */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {/* 이펙트 기준 래퍼 — 버튼(46×46)에만 centered */}
          <div className="relative w-[46px] h-[46px] lg:w-[56px] lg:h-[56px]">
            {/* 티어 링 + 아이콘 */}
            <button
              onClick={() => navigate('/tier')}
              className="tier-erupt absolute inset-0 w-full h-full rounded-2xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 z-10"
              style={{
                background: `${tierColor}12`,
                border: 'none',
                boxShadow: tierVisible ? `0 0 0 1.5px ${tierColor}30` : 'none',
                opacity: tierVisible ? undefined : 0,
                animationPlayState: tierVisible ? 'running' : 'paused',
                pointerEvents: tierVisible ? 'auto' : 'none',
                transition: 'box-shadow 0.8s ease',
              }}
              title="티어 가이드 보기"
            >
              <TierIcon tier={tier.key} size={32} rank={globalRank} />
            </button>
          </div>

          {/* 등급명 */}
          <span
            className="text-[10px] lg:text-[12px] font-black tracking-wide uppercase z-10 relative"
            style={{
              color: tierColor,
              opacity: tierVisible ? 1 : 0,
              transition: 'opacity 0.5s ease 0.2s',
            }}
          >
            {globalRank && globalRank <= 10 ? `TOP ${globalRank}` : tierLabel}
          </span>
        </div>
      </div>

      {/* Fintech KPI Strip */}
      {breakdown && (
        <div
          className="grid grid-cols-2 gap-px mb-4 rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
        >
          {/* ELO Score */}
          <div className="flex flex-col gap-0.5 px-4 py-3 lg:px-5 lg:py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--c-label)', fontSize: '10px', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' }}>
              <Star size={12} weight="fill" style={{ color: 'var(--accent)' }} />
              ELO SCORE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 3.5vw, 30px)', fontWeight: 900, color: 'var(--accent-bright)', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {formatNumber(animScore)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-label)' }}>{tierLabel}</div>
          </div>

          {/* Total Chats */}
          <div className="flex flex-col gap-0.5 px-4 py-3 lg:px-5 lg:py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--c-label)', fontSize: '10px', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' }}>
              <ChatTeardropDots size={12} weight="fill" style={{ color: 'rgba(99,102,241,0.8)' }} />
              TOTAL CHATS
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 3.5vw, 30px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {formatNumber(animInteractions)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-label)' }}>{formatNumber(Math.floor(breakdown.avgInteractions || 0))} avg/캐릭터</div>
          </div>

          {/* Followers */}
          <div className="flex flex-col gap-0.5 px-4 py-3 lg:px-5 lg:py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--c-label)', fontSize: '10px', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' }}>
              <Users size={12} weight="fill" style={{ color: 'rgba(74,222,128,0.8)' }} />
              FOLLOWERS
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 3.5vw, 30px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {formatNumber(animFollowers)}
            </div>
            {globalRank && (
              <div style={{ fontSize: '11px', color: 'var(--c-label)' }}>전체 #{globalRank}위</div>
            )}
          </div>

          {/* Top Character */}
          <div className="flex flex-col gap-0.5 px-4 py-3 lg:px-5 lg:py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--c-label)', fontSize: '10px', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' }}>
              <Trophy size={12} weight="fill" style={{ color: 'rgba(251,191,36,0.8)' }} />
              TOP CHARACTER
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--accent-bright)',
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {topCharacter?.name || '—'}
            </div>
            {topCharacter && (
              <div style={{ fontSize: '11px', color: 'var(--c-label)' }}>{formatNumber(topCharacter.interactionCount)} chats</div>
            )}
          </div>
        </div>
      )}

      {/* 칭호 편집 모달 (유지) */}
      <CreatorPills
        characters={characters}
        stats={stats}
        creatorId={profile.id || profile.username || 'unknown'}
        editing={editing}
        setEditing={setEditing}
      />

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
    <div className="flex flex-wrap justify-start gap-2 mt-3 mb-3">
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
