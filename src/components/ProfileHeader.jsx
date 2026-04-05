import React, { useState, useCallback, useMemo, useEffect } from 'react';
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

const TIER_KO = {
  unranked: 'UNRANKED', bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD',
  platinum: 'PLATINUM', diamond: 'DIAMOND', master: 'MASTER', champion: 'CHAMPION',
};

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

export default function ProfileHeader({ profile, stats, characters, onLiveClick, editing: editingProp, setEditing: setEditingProp }) {
  const navigate = useNavigate();
  const [showRecap, setShowRecap] = useState(false);
  const [editingInternal, setEditingInternal] = useState(false);
  const editing = editingProp !== undefined ? editingProp : editingInternal;
  const setEditing = setEditingProp || setEditingInternal;
  const [copied, setCopied] = useState(false);

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
  const animScore = useCountUp(score, 1400);

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
                    {(profile.nickname || '?')[0]}
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
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full blur-2xl" style={{ background: `${tierColor}30` }} />
            <button
              onClick={() => navigate('/tier')}
              className="relative z-10 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              title="티어 가이드 보기"
            >
              <TierIcon tier={tier.key} size={70} />
            </button>
            <div className="mt-4 flex flex-col items-center z-10">
              <span
                className="text-[12px] sm:text-[16px] font-black tracking-[0.15em] sm:tracking-[0.25em] uppercase bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(to right, ${tierColor}, ${tierColor}CC)` }}
              >
                {tierLabel}
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
              <span className="text-[10px] text-gray-500 font-medium">
                {formatCompactNumber(animScore)}
                {tier.nextGoalScore && tier.key !== 'champion' && (
                  <span className="text-gray-600"> / {formatCompactNumber(tier.nextGoalScore)}</span>
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

  // 초기값: 저장된 배지 있으면 그걸, 없으면 첫 4개
  const defaultIds = useMemo(() => allEarned.slice(0, 4).map(p => p.id), [allEarned]);

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
