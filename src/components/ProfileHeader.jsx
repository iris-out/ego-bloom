import React, { useState, useCallback } from 'react';
import { formatNumber, formatCompactNumber, getCreatorTier, getCharacterTier, calculateCreatorScore, calculatePercentile, toKST } from '../utils/tierCalculator';
import CreatorTierBadge from './CreatorTierBadge';
import { TierBadgeWithTooltip, TierBadge } from './TierBadge';
import HoverNumber from './HoverNumber';
import { Heart, Hash, ArrowUpRight, Target, Flame, Users, Calendar, Crown, Film, Download, Loader2, Sparkles, BarChart3, Pin, Landmark } from 'lucide-react';
import { toPng } from 'html-to-image';
import { computeEarnedTitles, BADGE_COLOR_MAP, BADGE_DEFINITIONS, FIXED_BADGE_IDS } from '../data/badges';
import ImageWithFallback from './ImageWithFallback';
import { proxyImageUrl, getPlotImageUrls } from '../utils/imageUtils';
import { getCreatorBadge, saveCreatorBadge } from '../utils/storage';
import RecapModal from './RecapModal';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import CreatorRadarChart from './CreatorRadarChart';

export default function ProfileHeader({ profile, stats, characters }) {
  // ✅ 훅은 반드시 early return 이전에 선언해야 한다.
  const [tierMode, setTierMode] = useState('total'); // 'total' | 'highlight'
  const [exporting, setExporting] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const cardRef = React.useRef(null);

  // Hash Routing 기반 Recap Modal 열기/닫기 처리 (Browser Back 연동)
  React.useEffect(() => {
    const handleHashChange = () => {
      setShowRecap(window.location.hash === '#recap');
    };
    handleHashChange(); // 초기 렌더 확인 시점
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openRecap = useCallback(() => {
    window.location.hash = 'recap';
  }, []);

  const closeRecap = useCallback(() => {
    if (window.location.hash === '#recap') {
      history.back(); // 해시를 지우고 라우터 히스토리 롤백
    } else {
      setShowRecap(false);
    }
  }, []);

  const breakdown = React.useMemo(() => {
    if (!profile || !stats) return null;
    const sorted = (characters || []).sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    const top20Sum = sorted.slice(0, 20).reduce((acc, c) => acc + (c.interactionCount || 0), 0);
    const charCount = characters?.length || (stats.plotCount || 1);
    const totalInteractions = stats.plotInteractionCount || 0;

    // Calculate activity days
    const dates = (characters || []).map(c => c.createdAt || c.createdDate).filter(Boolean).map(d => toKST(d).getTime()).filter(t => !isNaN(t));
    const activityDays = Math.max(1, dates.length > 0 ? (toKST().getTime() - Math.min(...dates)) / 86400000 : 1);

    return {
      mode: tierMode,
      interactions: totalInteractions,
      followers: stats.followerCount || 0,
      avgInteractions: charCount > 0 ? totalInteractions / charCount : 0,
      dailyAvgInteractions: totalInteractions / activityDays,
      activityDays: Math.floor(activityDays),
      voicePlays: stats.voicePlayCount || 0,
      top20Sum,
    };
  }, [tierMode, stats, characters, profile]);

  // 첫 번째 캐릭터 제작 날짜 (가장 이른 createdAt)
  const firstCharDate = React.useMemo(() => {
    if (!characters || characters.length === 0) return null;
    const dates = characters
      .map(c => c.createdAt || c.createdDate)
      .filter(Boolean)
      .map(d => toKST(d));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates));
  }, [characters]);

  // 내보내기 핸들러
  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const node = cardRef.current;
      const rect = node.getBoundingClientRect();
      // 다크/라이트 테마에 따라 직접 hex 색상 지정 (CSS var는 html-to-image에서 미지원)
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const bgColor = isDark ? '#1a1a26' : '#ffffff';
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bgColor,
        // 실제 렌더링 크기로 고정 (reflow 방지)
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      const link = document.createElement('a');
      link.download = `zeta - ${profile?.username || 'card'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  }, [profile]);

  if (!profile || !stats) return null;

  const score = calculateCreatorScore(stats, characters);

  const tier = getCreatorTier(score);
  const totalMessages = stats.plotInteractionCount || 0;
  const percentileLabel = calculatePercentile(totalMessages);

  const displayCharacters = characters; // 성장세 모드에서도 전체 캐릭터 표시

  const top20 = (displayCharacters || [])
    .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
    .slice(0, 20);

  const tierKoNames = {
    bronze: '브론즈',
    silver: '실버',
    gold: '골드',
    platinum: '플래티넘',
    diamond: '다이아몬드',
    master: '마스터',
    champion: '챔피언'
  };

  const topTags = React.useMemo(() => {
    if (!characters) return [];
    const counts = {};
    characters.forEach(c => {
      const tags = c.hashtags || c.tags || [];
      tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);
  }, [characters]);

  return (
    <div className="card p-4 sm:p-6 relative" ref={cardRef}>
      {/* Tier Mode Selector */}
      <div className="absolute top-2 left-4 sm:top-4 sm:left-6 flex items-center bg-[var(--bg-secondary)] rounded-full p-1 border border-[var(--border)] z-10">
        <button
          onClick={() => setTierMode('total')}
          className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-full transition-all ${tierMode === 'total'
            ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
        >
          전체
        </button>
        <button
          onClick={() => setTierMode('highlight')}
          className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-full transition-all ${tierMode === 'highlight'
            ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
        >
          하이라이트
        </button>
        {/* 통합 툴팁 */}
        <div className="relative group/tip ml-0.5 mr-1">
          <span className="w-4 h-4 rounded-full bg-[var(--border)] text-[var(--text-tertiary)] text-[8px] font-black flex items-center justify-center cursor-help shrink-0 hover:bg-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors">?</span>
          <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-56 p-3 bg-[rgba(20,20,30,0.97)] border border-[var(--border)] rounded-xl shadow-xl z-50 text-white text-[10px] leading-relaxed invisible group-hover/tip:visible pointer-events-none">
            <div className="font-bold text-[var(--accent)] mb-2">티어 카드 모드</div>
            <div className="mb-2">
              <div className="font-semibold text-white/90 mb-0.5 flex items-center gap-1.5"><BarChart3 size={12} /> 전체</div>
              <div className="text-gray-400">활동 내역 요약과 상위<br />캐릭터 20개의 분포 기록입니다.</div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="font-semibold text-white/90 mb-0.5 flex items-center gap-1.5"><Sparkles size={12} /> 하이라이트</div>
              <div className="text-gray-400">크리에이터를 빛낸 첫 캐릭터, 최신,<br />최고 인기 캐릭터 시상대입니다.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-2 right-4 sm:top-4 sm:right-6 z-10 flex items-center gap-1.5">
        {/* Recap Fullscreen Button */}
        <button
          onClick={openRecap}
          className="px-2.5 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-purple-500/40 text-purple-400 hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all shadow-[0_0_8px_rgba(168,85,247,0.2)] flex items-center gap-1.5"
          title="연말결산 스토리 보기"
        >
          <Film size={13} />
          <span className="text-[10px] font-black tracking-wide">RECAP</span>
        </button>

        {/* Export Button — 아이콘만 */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all disabled:opacity-50"
          title="카드 이미지로 저장"
        >
          {exporting
            ? <Loader2 size={14} className="animate-spin" />
            : <Download size={14} />
          }
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 mt-12 sm:mt-10">
        {/* Avatar */}
        <div className="relative shrink-0">
          <AvatarImage
            src={profile.profileImageUrl}
            alt={profile.nickname}
            fallback={(profile.nickname || '?')[0]}
            tierColor={tier.color}
          />
        </div>

        {/* Name & handle & Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] truncate">
              {profile.nickname}
            </h2>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">@{profile.username}</p>
          {/* 활동 기간 + 칭호 — 한 줄 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {firstCharDate !== null && (() => {
              const now = toKST();
              let years = now.getFullYear() - firstCharDate.getFullYear();
              let months = now.getMonth() - firstCharDate.getMonth();
              if (months < 0) { years--; months += 12; }
              const label = years > 0
                ? months > 0 ? `${years}년 ${months} 개월째` : `${years} 년째`
                : months > 0
                  ? `${months} 개월째`
                  : `${Math.max(1, Math.floor((now - firstCharDate) / 86400000))} 일째`;
              return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/20 text-[10px] font-semibold text-[var(--accent)]">
                  <Calendar size={11} className="mr-0.5" /> {label}
                </span>
              );
            })()}
            <CreatorPills characters={characters} stats={stats} creatorId={profile.id || profile.username || 'unknown'} />
          </div>
        </div>

        {/* Tier Badge */}
        <div className="text-right shrink-0 flex flex-col items-center">
          <CreatorTierBadge tier={tier} stats={stats} score={score} tierMode={tierMode} breakdown={breakdown} />
          <div className="text-sm font-bold mt-2" style={{ color: tier.color }}>
            {tier.subdivision ? `${tierKoNames[tier.key] || tier.name} ${tier.subdivision} ` : (tierKoNames[tier.key] || tier.name)}
          </div>
        </div>
      </div>

      {/* 하이라이트 모드일 때 추가 지표 + 시상대 노출 */}
      {tierMode === 'highlight' ? (
        <div className="mt-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-4 border-t border-[var(--border)] mb-6">
            <StatItem label="활동 일수" value={breakdown.activityDays} />
            <StatItem label="일평균 대화수" value={Math.floor(breakdown.dailyAvgInteractions)} />
          </div>
          <PodiumHighlight characters={characters} />
        </div>
      ) : (
        <>
          {/* Stats row Calculation for TOTAL mode */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-[var(--border)] animate-fade-in">
            <StatItem label="총 대화량" value={totalMessages} />
            <StatItem label="팔로워" value={stats.followerCount || 0} />
            <StatItem label="캐릭터" value={stats.plotCount || 0} />
          </div>




          {/* Top 20 character tier badges */}
          {top20.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)] animate-fade-in">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-2">
                최고 인기 20개 캐릭터 티어
              </div>
              <div className="flex flex-wrap gap-1.5">
                {top20.map((char) => {
                  const charTier = getCharacterTier(char.interactionCount || 0);
                  return (
                    <TierBadgeWithTooltip
                      key={char.id}
                      tierKey={charTier.key}
                      size={22}
                      className="shrink-0"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 주요 태그 (재배치) */}
          <div className="mt-4 pt-4 border-t border-[var(--border)] animate-fade-in">
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-2">
              크리에이터 주요 장르
            </div>
            <div className="flex flex-wrap gap-2">
              {topTags.map(tag => (
                <span key={tag} className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] shadow-sm hover:border-[var(--accent)] transition-all">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Progress bar */}
      {tier.nextTier && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1.5">
            <span>{tier.nextGoalLabel || tier.nextTier.name}까지</span>
            <span>{Math.floor(tier.subProgress ?? tier.progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${tier.gradient} transition-all duration-500`}
              style={{ width: `${tier.subProgress ?? tier.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Recap Modal 랜더링 (Z-index 오프셋 활용) */}
      <RecapModal
        isOpen={showRecap}
        onClose={closeRecap}
        characters={characters || []}
        stats={stats}
        profile={profile}
        tier={tier}
        score={score}
      />
    </div>
  );
}

function AvatarImage({ src, alt, fallback, tierColor }) {
  const [err, setErr] = useState(false);
  const showImg = src && !err;

  return (
    <div
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-[var(--card)] transition-all duration-300"
      style={{ boxShadow: `0 0 0 2.5px ${tierColor || 'var(--border)'}` }}
    >
      {showImg && (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={() => setErr(true)}
        />
      )}
      {(!showImg) && (
        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[var(--text-secondary)]">
          {fallback}
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, textValue, sub, accentSub }) {
  return (
    <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]/50">
      <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
        {textValue ? textValue : <HoverNumber value={value} />}
      </div>
      <div className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase mt-0.5">{label}</div>
      {sub && (
        <div className={`text-[9px] font-semibold mt-0.5 ${accentSub ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ===== 크리에이터 특성 Pill 뱃지 (단일 소스: src/data/badges.js) =====
function CreatorPills({ characters, stats, creatorId }) {
  const allTitles = React.useMemo(
    () => computeEarnedTitles({ characters, stats }),
    [characters, stats]
  );

  // 획득한 것만 필터링 (메모이제이션 적용으로 무한 루프 방지)
  const allEarned = React.useMemo(() => allTitles.filter(t => t.earned), [allTitles]);
  const fixedIds = FIXED_BADGE_IDS;

  const [selected, setSelected] = React.useState(null); // null = show default/stored
  const [editing, setEditing] = React.useState(false);
  const dropRef = React.useRef(null);

  React.useEffect(() => {
    // 마운트 시 저장소에서 불러오기
    if (creatorId) {
      const storedIds = getCreatorBadge(creatorId);
      if (storedIds && Array.isArray(storedIds)) {
        // 유효한 ID만 필터링 (새로운 배지가 추가/삭제됐을 수 있으므로)
        const validIds = storedIds.filter(id => allEarned.some(e => e.id === id));
        if (validIds.length > 0) {
          // 배열 내용이 다를 때만 업데이트 (무한 업데이트 방지)
          setSelected(prev => {
            if (!prev) return validIds;
            if (prev.length === validIds.length && prev.every((v, i) => v === validIds[i])) return prev;
            return validIds;
          });
        }
      }
    }
  }, [creatorId, allEarned]);

  // 모달: 외부 클릭 시 닫기
  React.useEffect(() => {
    if (!editing) return;
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setEditing(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  React.useEffect(() => {
    if (editing) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [editing]);

  // 구동: 획득 칭호 전부 (최대 8개), 고정 칭호 우선
  const activeIds = React.useMemo(() => {
    const presentFixed = allEarned.filter(p => fixedIds.includes(p.id)).map(p => p.id);
    if (selected) {
      const unified = Array.from(new Set([...presentFixed, ...selected]));
      return unified.slice(0, 8);
    }
    return allEarned.slice(0, 8).map(p => p.id);
  }, [selected, allEarned]);

  const toggleId = (id) => {
    if (fixedIds.includes(id)) return; // 고정 칭호는 토글 불가

    setSelected(prev => {
      const cur = prev || allEarned.slice(0, 8).map(p => p.id);
      let newSelection;

      if (cur.includes(id)) {
        newSelection = cur.filter(x => x !== id);
      } else if (cur.length >= 8) {
        newSelection = cur;
      } else {
        newSelection = [...cur, id];
      }

      // 스토리지에 새 선택 목록 저장
      if (creatorId) {
        saveCreatorBadge(creatorId, newSelection);
      }
      return newSelection;
    });
  };

  const visible = allEarned.filter(p => activeIds.includes(p.id));

  if (allEarned.length === 0) return null;

  return (
    <>
      {visible.map(p => {
        const style = BADGE_COLOR_MAP[p.color] || BADGE_COLOR_MAP.slate;
        const isGradient = p.color === 'gradient';
        const label = `${p.emoji} ${p.title} `;
        const desc = p.desc || '';

        return isGradient ? (
          <div key={p.id} className="relative group/pill">
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white border border-purple-400/30 cursor-default shadow-sm" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
              {label}
            </span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-[rgba(20,20,30,0.95)] border border-[var(--border)] rounded-lg shadow-lg text-[10px] text-white/90 font-medium whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity pointer-events-none z-50">
              {desc}
            </div>
          </div>
        ) : (
          <div key={p.id} className="relative group/pill">
            <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} border ${style.border} ${style.text} cursor-default shadow-sm`}>
              {label}
            </span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-[rgba(20,20,30,0.95)] border border-[var(--border)] rounded-lg shadow-lg text-[10px] text-white/90 font-medium whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity pointer-events-none z-50">
              {desc}
            </div>
          </div>
        );
      })}
      {/* 연필 편집 버튼 */}
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setEditing(true)}
          className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          title="표시할 칭호 편집"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
        {editing && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && setEditing(false)}
            role="dialog"
            aria-modal="true"
            aria-label="표시할 칭호 편집"
          >
            <div
              className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-sm font-bold text-[var(--text-primary)]">표시할 칭호</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">{activeIds.length}/8</span>
                  <button
                    onClick={() => setEditing(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label="닫기"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-1 min-h-0">
                {allEarned.map(p => {
                  const isFixed = fixedIds.includes(p.id);
                  const checked = activeIds.includes(p.id);
                  const disabled = isFixed || (!checked && activeIds.length >= 8);
                  const label = `${p.emoji} ${p.title} `;
                  const desc = p.desc || '';

                  return (
                    <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[var(--bg-secondary)] active:bg-white/10 transition-colors ${disabled ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleId(p.id)}
                        className="w-4 h-4 rounded accent-[var(--accent)] shrink-0"
                      />
                      <span className="text-sm text-[var(--text-primary)] flex items-center gap-1.5 min-w-0 flex-1">
                        {isFixed && <span className="opacity-80"><Pin size={12} className="transition-transform group-hover:rotate-45" /></span>}
                        {label}
                      </span>
                      {desc && (
                        <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 max-w-[120px] text-right leading-tight">
                          {desc}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}



// ===== 명예의 전당 (시상대 하이라이트) =====
function PodiumHighlight({ characters }) {
  const highlights = React.useMemo(() => {
    if (!characters?.length) return null;

    const withDate = characters.filter(c => c.createdAt || c.createdDate);
    const sortedByDate = [...withDate].sort((a, b) =>
      toKST(a.createdAt || a.createdDate) - toKST(b.createdAt || b.createdDate)
    );
    const sortedByInteraction = [...characters].sort((a, b) =>
      (b.interactionCount || 0) - (a.interactionCount || 0)
    );

    if (!sortedByDate.length || !sortedByInteraction.length) return null;

    const top = sortedByInteraction[0];
    let newest = sortedByDate[sortedByDate.length - 1];
    let oldest = sortedByDate[0];

    if (newest.id === top.id && sortedByDate.length > 1) newest = sortedByDate[sortedByDate.length - 2];
    if (oldest.id === top.id && sortedByDate.length > 1) oldest = sortedByDate[1];
    if (oldest.id === newest.id && sortedByDate.length > 2) oldest = sortedByDate[0];

    return [
      // 최근에 만든 캐릭터
      {
        char: newest,
        label: '최근 제작',
        icon: <Sparkles size={12} className="mr-1" />,
        pillClass: 'bg-gradient-to-r from-sky-500/50 to-cyan-400/50',
        borderClass: 'border-sky-400/70',
        order: 2
      },
      // 대화량이 가장 많은 캐릭터
      {
        char: top,
        label: '최다 대화량',
        icon: <Crown size={12} className="mr-1" />,
        pillClass: 'bg-gradient-to-r from-amber-400/50 to-orange-500/50',
        borderClass: 'border-amber-400/70',
        order: 1
      },
      // 가장 처음 만든 캐릭터
      {
        char: oldest,
        label: '첫 제작',
        icon: <Landmark size={12} className="mr-1" />,
        pillClass: 'bg-gradient-to-r from-emerald-500/50 to-teal-400/50',
        borderClass: 'border-emerald-400/70',
        order: 3
      },
    ].filter(item => item.char);
  }, [characters]);

  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="mb-2 mt-4">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Sparkles size={18} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">크리에이터 하이라이트</h3>
        </div>
      </div>
      {/* items-stretch로 각 자식 카드의 높이를 완벽하게 동일하게 유지 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 items-stretch">
        {highlights.map((item, idx) => (
          <PodiumCard key={item.char.id || idx} {...item} desktopCenter={item.order === 1} />
        ))}
      </div>
    </div>
  );
}

function PodiumCard({ char, label, icon, pillClass, borderClass, desktopCenter }) {
  if (!char) return null;
  const tier = getCharacterTier(char.interactionCount || 0);

  return (
    <a
      href={`https://zeta-ai.io/ko/plots/${char.id}/profile`}
      target="_blank"
      rel="noopener noreferrer"
      // 높이를 flex-grow를 주거나 stretch 받도록 min-h 지정, 세 카드 모두 동일 크기 유지 (중앙도 동일 스케일)
      className={`group relative flex flex-col aspect-[3/4] w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md hover:border-[var(--accent-bright)] hover:shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] transition-all duration-300 transform md:hover:-translate-y-1 ${desktopCenter ? 'z-10' : 'z-0'}`}
    >
      {/* 1. 이미지 컨테이너 - Z-index를 0으로 낮추고 이 안에서만 overflow-hidden 시킴으로써 테두리 호버 짤림 완벽 해결 */}
      < div className="absolute inset-0 rounded-2xl overflow-hidden z-0 pointer-events-none border border-transparent bg-black" >
        <ImageWithFallback
          src={proxyImageUrl(char.imageUrl)}
          fallbackSrcs={getPlotImageUrls(char.imageUrls || []).slice(1)}
          alt={char.name}
          // 확대/블러 대신 밝기·채도만 살짝 올려 선명도를 유지
          className="w-full h-full object-cover transition-all duration-500 ease-out group-hover:brightness-110 group-hover:saturate-110"
        />
      </div >

      {/* 2. 글래스모피즘 어두운 비네팅 오버레이 - 작위적이지 않게 더 부드럽고 자연스럽게 페이드 */}
      < div className="absolute inset-0 rounded-2xl pointer-events-none z-10 bg-gradient-to-t from-black/95 via-black/20 to-transparent mix-blend-multiply opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

      {/* 부드러운 하단 블러 (Css maskImage로 경계선 스무스 처리) */}
      < div
        className="absolute inset-0 rounded-2xl pointer-events-none z-10 backdrop-blur-md"
        style={{
          maskImage: 'linear-gradient(to top, black 0%, black 15%, transparent 60%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, black 15%, transparent 60%)'
        }}
      />
      < div className="absolute inset-x-0 bottom-0 h-[70%] rounded-b-2xl pointer-events-none z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* 3. 데이터 컨텐츠 컨테이너 - Z-index를 최우선으로 앞당김 */}
      < div className="relative z-20 flex flex-col h-full p-2 sm:p-3 justify-between flex-grow" >

        {/* 상단: 티어 뱃지만 우측 배치 */}
        < div className="flex justify-end items-start w-full drop-shadow-sm" >
          <div className="shrink-0 pt-0.5">
            <TierBadge tierKey={tier.key} size={18} />
          </div>
        </div >

        {/* 하단 수치 타이포그래피 및 이름 */}
        < div className="flex flex-col gap-0.5 sm:gap-1 mt-auto min-w-0" >
          {/* 대화량 텍스트: 사이즈 약간 줄이고 한 줄로 말줄임 처리하여 레이아웃 방어 */}
          < div className="flex items-baseline drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] min-w-0" >
            <span className="text-lg sm:text-xl font-black text-purple-200 tracking-tight leading-none truncate w-full" title={formatNumber(char.interactionCount || 0)}>
              {formatCompactNumber(char.interactionCount || 0)}
            </span>
          </div >

          {/* 캐릭터 이름 - 한 줄 고정 */}
          < h4 className="font-bold text-[10px] sm:text-[11px] md:text-xs text-white leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate w-full mt-0.5" title={char.name} >
            {char.name}
          </h4 >

          {/* pill: 캐릭터명과 날짜 사이, 배경 50% 투명, 테두리에 색 */}
          < div className={`flex items-center gap-0.5 w-fit px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide text-white border ${pillClass || 'bg-gray-600/50'} ${borderClass || 'border-white/25'}`}>
            {icon}
            < span className="truncate" > {label}</span >
          </div >
        </div >
      </div >
    </a >
  );
}
