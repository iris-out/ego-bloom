import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  formatCompactNumber, getCreatorTier,
  calculateCreatorScore, toKST, getCharacterTier
} from '../utils/tierCalculator';
import GemTierBadge from './GemTierBadge';
import HoverNumber from './HoverNumber';
import { Film, Pin } from 'lucide-react';
import { computeEarnedTitles, BADGE_COLOR_MAP, FIXED_BADGE_IDS } from '../data/badges';
import ImageWithFallback from './ImageWithFallback';
import { getCreatorBadge, saveCreatorBadge } from '../utils/storage';
import RecapModal from './RecapModal';

const TIER_KO = {
  unranked: 'UNRANKED', bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD',
  platinum: 'PLATINUM', diamond: 'DIAMOND', master: 'MASTER', champion: 'CHAMPION',
};

const TIER_COLORS = {
  unranked: '#6B7280',
  bronze:   '#C07830',
  silver:   '#94A3B8',
  gold:     '#D4A820',
  platinum: '#2DD4BF',
  diamond:  '#60A5FA',
  master:   '#C084FC',
  champion: '#F87171',
};

export default function ProfileHeader({ profile, stats, characters }) {
  const [showRecap, setShowRecap] = useState(false);

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

  // 상위 캐릭터 티어 10개
  const topCharTiers = useMemo(() => {
    if (!characters?.length) return [];
    return [...characters]
      .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
      .slice(0, 10)
      .map(c => ({ name: c.name, tier: getCharacterTier(c.interactionCount || 0) }));
  }, [characters]);

  if (!profile || !stats) return null;

  const score = calculateCreatorScore(stats, characters);
  const tier = getCreatorTier(score);
  const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
  const subRoman = tier.subdivision ? (romanMap[tier.subdivision] || '') : '';
  const tierName = TIER_KO[tier.key] || tier.name?.toUpperCase() || 'UNRANKED';
  const tierLabel = `${tierName}${subRoman ? ' ' + subRoman : ''}`;
  const progressPct = tier.subProgress ?? tier.progress ?? 0;
  const tierColor = TIER_COLORS[tier.key] || TIER_COLORS.unranked;

  return (
    <>
      <div className="profile-header-wrap">
        {/* 아바타 + 이름/핸들 (좌) + 칭호 (우) */}
        <div className="flex items-center gap-3 mb-4">
          {/* 좌: 아바타 + 이름/핸들 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {profile.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt={profile.nickname} crossOrigin="anonymous" loading="eager" />
                ) : (
                  <span className="text-3xl font-black text-[var(--text-tertiary)]">
                    {(profile.nickname || '?')[0]}
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <div className="profile-name truncate">{profile.nickname}</div>
              <div className="profile-handle truncate">@{profile.username}</div>
            </div>
          </div>

          {/* 우: 칭호 pills */}
          <div className="flex-1 min-w-0">
            <CreatorPills
              characters={characters}
              stats={stats}
              creatorId={profile.id || profile.username || 'unknown'}
            />
          </div>
        </div>

        {/* ELO / 티어 카드 — 계급장 스타일 */}
        <div className={`elo-card${['diamond','master','champion'].includes(tier.key) ? ` elo-card-animated elo-card-${tier.key}` : ''}`}>
          {/* 티어명 헤더 — 계급장 */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${tierColor}60)` }} />
            <div
              className="text-[13px] font-black tracking-[0.18em] uppercase px-3"
              style={{ color: tierColor, textShadow: `0 0 12px ${tierColor}80` }}
            >
              {tierLabel}
            </div>
            <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${tierColor}60)` }} />
          </div>

          {/* 배지 + 진행 정보 */}
          <div className="flex items-center gap-4">
            <GemTierBadge tier={tier} size="xl" score={score} breakdown={breakdown} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono mb-1" style={{ color: tierColor }}>
                ELO {score.toLocaleString()}
              </div>
              <div className="progress-bar mb-1" style={{ '--tier-progress-color': tierColor }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
              </div>
              <div className="elo-next">
                <span className="font-bold" style={{ color: tierColor }}>{Math.floor(progressPct)}%</span>
                {tier.nextGoalScore && tier.key !== 'champion' && (
                  <span className="text-[var(--text-tertiary)]">
                    {formatCompactNumber(Math.max(0, tier.nextGoalScore - score))} 남음
                  </span>
                )}
              </div>
              {tier.nextGoalLabel && tier.key !== 'champion' && (
                <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                  → {tier.nextGoalLabel}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 상위 캐릭터 티어 카드 */}
        {topCharTiers.length > 0 && (
          <div className="card p-3 mb-3">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] mb-2">상위 10개 캐릭터 티어</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topCharTiers.map((item, i) => (
                <div
                  key={i}
                  title={`${item.name} (${item.tier.name})`}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border cursor-default"
                  style={{
                    color: item.tier.color,
                    borderColor: item.tier.color + '60',
                    background: item.tier.color + '18',
                  }}
                >
                  {item.tier.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 스탯 row */}
        <div className="profile-stats-row">
          <div className="profile-stat">
            <div className="profile-stat-val"><HoverNumber value={stats.followerCount || 0} /></div>
            <div className="profile-stat-key">팔로워</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val"><HoverNumber value={stats.plotCount || 0} /></div>
            <div className="profile-stat-key">캐릭터</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val"><HoverNumber value={stats.plotInteractionCount || 0} /></div>
            <div className="profile-stat-key">총 대화</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val"><HoverNumber value={stats.voicePlayCount || 0} /></div>
            <div className="profile-stat-key">음성 재생</div>
          </div>
        </div>

        {/* 프로필 태그 + RECAP 버튼 */}
        {topTags.length > 0 && (
          <div className="profile-tags" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex flex-nowrap gap-1.5 overflow-hidden">
              {topTags.map(tag => (
                <span key={tag} className="chip shrink-0">#{tag}</span>
              ))}
            </div>
            <button
              onClick={openRecap}
              className="chip bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-1 shrink-0 ml-2"
            >
              <Film size={10} />RECAP
            </button>
          </div>
        )}
      </div>

      {/* Recap 모달 — portal로 document.body에 렌더링 (stacking context 탈출) */}
      {showRecap && createPortal(
        <RecapModal
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
function CreatorPills({ characters, stats, creatorId }) {
  const allTitles = useMemo(() => computeEarnedTitles({ characters, stats }), [characters, stats]);
  const allEarned = useMemo(() => allTitles.filter(t => t.earned), [allTitles]);
  const fixedIds = FIXED_BADGE_IDS;

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);

  React.useEffect(() => {
    if (creatorId) {
      const storedIds = getCreatorBadge(creatorId);
      if (storedIds && Array.isArray(storedIds)) {
        const validIds = storedIds.filter(id => allEarned.some(e => e.id === id));
        if (validIds.length > 0) {
          setSelected(prev => {
            if (!prev) return validIds;
            if (prev.length === validIds.length && prev.every((v, i) => v === validIds[i])) return prev;
            return validIds;
          });
        }
      }
    }
  }, [creatorId, allEarned]);


  React.useEffect(() => {
    if (editing) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [editing]);

  const activeIds = useMemo(() => {
    const presentFixed = allEarned.filter(p => fixedIds.includes(p.id)).map(p => p.id);
    if (selected) {
      const unified = Array.from(new Set([...presentFixed, ...selected]));
      return unified.slice(0, 4);
    }
    return allEarned.slice(0, 4).map(p => p.id);
  }, [selected, allEarned, fixedIds]);

  const toggleId = (id) => {
    if (fixedIds.includes(id)) return;
    setSelected(prev => {
      const cur = prev || allEarned.slice(0, 8).map(p => p.id);
      let newSelection;
      if (cur.includes(id)) newSelection = cur.filter(x => x !== id);
      else if (cur.length >= 4) newSelection = cur;
      else newSelection = [...cur, id];
      if (creatorId) saveCreatorBadge(creatorId, newSelection);
      return newSelection;
    });
  };

  const visible = allEarned.filter(p => activeIds.includes(p.id));
  if (allEarned.length === 0) return null;

  const pillNodes = visible.map(p => {
    const style = BADGE_COLOR_MAP[p.color] || BADGE_COLOR_MAP.slate;
    const isGradient = p.color === 'gradient';
    const label = `${p.emoji} ${p.title}`;
    return isGradient ? (
      <div key={p.id} className="relative group/pill shrink-0">
        <span className="chip text-white border-purple-400/30" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
          {label}
        </span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity pointer-events-none z-50">
          {p.desc}
        </div>
      </div>
    ) : (
      <div key={p.id} className="relative group/pill shrink-0">
        <span className={`chip ${style.bg} border-0 ${style.text}`}>{label}</span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover/pill:opacity-100 transition-opacity pointer-events-none z-50">
          {p.desc}
        </div>
      </div>
    );
  });

  return (
    <div className="flex flex-wrap gap-1.5">
      {pillNodes}

      {/* 편집 버튼 */}
      <div className="relative">
        <button
          onClick={() => setEditing(true)}
          className="chip"
          title="칭호 편집"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
        {editing && createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={e => e.target === e.currentTarget && setEditing(false)}
          >
            <div className="w-full max-w-lg max-h-[85dvh] flex flex-col rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <span className="font-bold text-[var(--text-primary)]">표시할 칭호 ({activeIds.length}/4)</span>
                <button onClick={() => setEditing(false)} className="nav-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-1">
                {allEarned.map(p => {
                  const isFixed = fixedIds.includes(p.id);
                  const checked = activeIds.includes(p.id);
                  const disabled = isFixed || (!checked && activeIds.length >= 4);
                  return (
                    <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors ${disabled ? 'opacity-50' : ''}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleId(p.id)} className="w-4 h-4 rounded accent-[var(--accent)]" />
                      <span className="text-sm text-[var(--text-primary)] flex items-center gap-1.5 flex-1">
                        {isFixed && <Pin size={11} className="opacity-60" />}
                        {p.emoji} {p.title}
                      </span>
                      {p.desc && <span className="text-[10px] text-[var(--text-tertiary)] max-w-[130px] text-right">{p.desc}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
