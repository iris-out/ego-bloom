import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  getCreatorTier, calculateCreatorScore, toKST, formatEloScore,
} from '../utils/tierCalculator';
import { getCreatorTierMeta } from '../design/tiers';
import PlayerCard from './ui/PlayerCard';
import HeroCard from './HeroCard';
import { Pin, Check } from 'lucide-react';
import { computeEarnedTitles, BADGE_COLOR_MAP, FIXED_BADGE_IDS } from '../data/badges';
import Modal from './ui/Modal';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import { getCreatorBadge, saveCreatorBadge } from '../utils/storage';
import { useCreatorRankings } from '../hooks/useCreatorRankings';
import { lazyWithRetry } from '../utils/lazyWithRetry';
const LiveViewModal = lazyWithRetry(() => import('./LiveViewModal'), 'LiveViewModal');

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

/** 다음 티어 진입까지 남은 점수 캡션. 챔피언이면 null. */
function nextTierCaption(tier, score) {
  if (!tier) return null;
  if (tier.key === 'champion') return '최고 등급';
  const targetKey = tier.subdivision > 1 ? tier.key : tier.nextTier?.key;
  const targetMeta = getCreatorTierMeta(targetKey);
  if (!targetMeta) return null;
  const targetSub = tier.subdivision > 1 ? tier.subdivision - 1 : 4;
  const remaining = Math.max(0, (tier.nextGoalScore ?? score) - score);
  return `${targetMeta.ko} ${ROMAN[targetSub] || ''}까지 ${formatEloScore(remaining)}`;
}

function TierProgressBar({ tierKey, progressPct, caption }) {
  const fillVar = tierKey ? `var(--t-${tierKey})` : 'var(--line)';
  return (
    <div className="mt-3 w-full">
      <div className="relative w-full overflow-hidden" style={{ height: 10, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, progressPct))}%`, height: '100%', background: fillVar, borderRadius: 'var(--radius-pill)' }} />
        {[25, 50, 75].map((pct) => (
          <div key={pct} className="absolute top-0 bottom-0" style={{ left: `${pct}%`, width: 2, background: 'var(--bg)' }} />
        ))}
      </div>
      {caption && <p className="t-small mt-1.5" style={{ color: 'var(--fg-2)' }}>{caption}</p>}
    </div>
  );
}

export default function ProfileHeader({ profile, stats, characters, growthHistory, editing: editingProp, setEditing: setEditingProp }) {
  const [showRecap, setShowRecap] = useState(false);
  const [editingInternal, setEditingInternal] = useState(false);
  const editing = editingProp !== undefined ? editingProp : editingInternal;
  const setEditing = setEditingProp || setEditingInternal;

  const { data: rankingsData } = useCreatorRankings();

  useEffect(() => {
    const handleHashChange = () => setShowRecap(window.location.hash === '#recap');
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const closeRecap = useCallback(() => {
    if (window.location.hash === '#recap') history.back();
    else setShowRecap(false);
  }, []);

  const rankings = rankingsData?.rankings;
  const rankIdx = rankings && profile?.id ? rankings.findIndex((r) => r.id === profile.id) : -1;
  const globalRank = rankIdx !== -1 ? rankIdx + 1 : null;

  const breakdown = useMemo(() => {
    if (!stats) return null;
    const dates = (characters || [])
      .map((c) => c.createdAt || c.createdDate)
      .filter(Boolean)
      .map((d) => toKST(d).getTime())
      .filter((t) => !isNaN(t));
    const activityDays = dates.length > 0 ? (toKST().getTime() - Math.min(...dates)) / 86400000 : 0;
    return { activityDays: Math.floor(activityDays) };
  }, [stats, characters]);

  const topCharacter = useMemo(() => {
    if (!characters || characters.length === 0) return null;
    return [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))[0];
  }, [characters]);

  const score = useMemo(() => calculateCreatorScore(stats, characters), [stats, characters]);
  const tier = useMemo(() => getCreatorTier(score), [score]);

  // baseline(오늘 이전 최신 스냅샷) 대비 증감 — growthHistory 없으면 null → 배지 미표시
  const base = growthHistory?.baseline || null;
  const interactionDelta = base ? (stats?.plotInteractionCount || 0) - (base.plot_interaction_count || 0) : null;
  const followerDelta = base ? (stats?.followerCount || 0) - (base.follower_count || 0) : null;

  const playerCardStats = useMemo(() => ([
    { label: '대화', value: stats?.plotInteractionCount || 0 },
    { label: '팔로워', value: stats?.followerCount || 0 },
  ]), [stats]);

  if (!profile || !stats) return null;

  const caption = nextTierCaption(tier, score);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <PlayerCard
            name={profile.nickname}
            handle={profile.username}
            avatarUrl={profile.profileImageUrl ? proxyThumbnailUrl(profile.profileImageUrl, 320) : undefined}
            avatarMaxHeight={240}
            tier={getCreatorTierMeta(tier.key) ? tier.key : undefined}
            tierHref={profile.username ? `/tier?creator=${encodeURIComponent(profile.username)}` : undefined}
            division={tier.subdivision}
            eloRaw={score}
            rank={globalRank != null && globalRank <= 3 ? globalRank : undefined}
            stats={playerCardStats}
          >
            <TierProgressBar tierKey={getCreatorTierMeta(tier.key) ? tier.key : undefined} progressPct={tier.subProgress ?? 0} caption={caption} />
          </PlayerCard>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {breakdown?.activityDays > 0 && <span className="eb-chip">D+{breakdown.activityDays}</span>}
            {globalRank != null && <span className="eb-chip">전체 {globalRank}위</span>}
          </div>

          <HeroCard
            stats={stats}
            characters={characters}
            interactionDelta={interactionDelta}
            followerDelta={followerDelta}
            topCharacter={topCharacter}
          />

          <CreatorPills
            characters={characters}
            stats={stats}
            creatorId={profile.id || profile.username || 'unknown'}
            editing={editing}
            setEditing={setEditing}
          />
        </div>
      </div>

      {/* LiveView 모달 — portal 로 document.body 에 렌더링 */}
      {showRecap && createPortal(
        <Suspense fallback={null}>
          <LiveViewModal
            isOpen={showRecap}
            onClose={closeRecap}
            characters={characters || []}
            stats={stats}
            profile={profile}
            tier={tier}
            score={score}
            globalRank={globalRank}
          />
        </Suspense>,
        document.body
      )}
    </>
  );
}

// ===== 크리에이터 특성 Pill 뱃지(칭호 스티커) =====
function CreatorPills({ characters, stats, creatorId, editing, setEditing }) {
  const allTitles = useMemo(() => computeEarnedTitles({ characters, stats }), [characters, stats]);
  const allEarned = useMemo(() => allTitles.filter((t) => t.earned), [allTitles]);
  const fixedIds = FIXED_BADGE_IDS;

  // 초기값: 대화량 최고 칭호 + 캐릭터 최고 칭호 + 태그 칭호 2개 (순애/NTR 있으면 0개)
  const defaultIds = useMemo(() => {
    const interactionEarned = allEarned.filter((p) => p.category === 'interaction');
    const highestInteraction = interactionEarned[interactionEarned.length - 1];

    const charEarned = allEarned.filter((p) => p.category === 'char_interaction');
    const highestChar = charEarned[charEarned.length - 1];

    const hasSpecialTag = allEarned.some((p) => p.id === 'sunae' || p.id === 'ntr');
    const tagEarned = allEarned.filter((p) => p.category === 'tag' && p.id !== 'sunae' && p.id !== 'ntr');
    const topTags = hasSpecialTag ? [] : tagEarned.slice(0, 2);

    return [highestInteraction, highestChar, ...topTags].filter(Boolean).map((p) => p.id);
  }, [allEarned]);

  const [selected, setSelected] = useState(() => {
    if (creatorId) {
      const stored = getCreatorBadge(creatorId);
      if (stored && Array.isArray(stored) && stored.length > 0) return stored;
    }
    return null; // null → defaultIds 사용
  });

  useEffect(() => {
    if (!creatorId) return;
    const storedIds = getCreatorBadge(creatorId);
    if (storedIds && Array.isArray(storedIds) && storedIds.length > 0) {
      const validIds = storedIds.filter((id) => allEarned.some((e) => e.id === id));
      // localStorage 는 React 밖의 저장소이므로, 로드 후 한 번 동기화하는 것은 정당한 이펙트다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (validIds.length > 0) setSelected(validIds);
    }
  }, [creatorId, allEarned]);

  const activeIds = useMemo(() => {
    const base = selected ?? defaultIds;
    const presentFixed = allEarned.filter((p) => fixedIds.includes(p.id)).map((p) => p.id);
    const unified = Array.from(new Set([...presentFixed, ...base]));
    return unified.slice(0, 4);
  }, [selected, defaultIds, allEarned, fixedIds]);

  const toggleId = (id) => {
    if (fixedIds.includes(id)) return;
    setSelected((prev) => {
      const cur = prev ?? defaultIds;
      let newSel;
      if (cur.includes(id)) {
        newSel = cur.filter((x) => x !== id);
      } else if (cur.length >= 4) {
        newSel = cur; // 4개 꽉 찼을 때는 교체 불가 (체크박스 disabled 로 처리)
      } else {
        newSel = [...cur, id];
      }
      if (creatorId) saveCreatorBadge(creatorId, newSel);
      return newSel;
    });
  };

  const visible = allEarned.filter((p) => activeIds.includes(p.id));
  if (allEarned.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((p) => (
        <span
          key={p.id}
          title={p.desc}
          className="t-ui inline-flex items-center gap-1.5 shrink-0"
          style={{
            height: 32, padding: '0 12px', borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-2)', border: '2px solid var(--accent-ink)', fontWeight: 700, fontSize: 13,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">{p.emoji}</span>
          {p.title}
        </span>
      ))}

      <Modal open={editing} onClose={() => setEditing(false)} title="칭호 설정">
        <p className="t-small mb-3" style={{ color: 'var(--fg-2)' }}>
          최대 4개까지 표시됩니다 ({activeIds.length} / 4)
        </p>
        <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto -mx-2">
          {allEarned.map((p) => {
            const isFixed = fixedIds.includes(p.id);
            const checked = activeIds.includes(p.id);
            const disabled = isFixed || (!checked && activeIds.length >= 4);
            const style = BADGE_COLOR_MAP[p.color] || BADGE_COLOR_MAP.slate;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => !disabled && toggleId(p.id)}
                disabled={disabled && !checked}
                className="flex items-center gap-3 px-2 py-2.5 text-left"
                style={{ borderRadius: 'var(--radius-m)', background: checked ? 'var(--surface-2)' : 'transparent', opacity: disabled && !checked ? 0.4 : 1 }}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 20, height: 20, borderRadius: 'var(--radius-s)', background: checked ? 'var(--accent)' : 'transparent', border: checked ? 'none' : '2px solid var(--line)' }}
                >
                  {checked && <Check size={12} strokeWidth={3} style={{ color: 'var(--accent-fg)' }} />}
                </span>

                <span
                  className="t-ui shrink-0"
                  style={{ padding: '2px 10px', borderRadius: 'var(--radius-pill)', background: style.bg, border: `1px solid ${style.border}`, fontSize: 12 }}
                >
                  {p.emoji} {p.title}
                </span>

                <span className="t-small truncate flex-1" style={{ color: 'var(--fg-2)' }}>{p.desc}</span>

                {isFixed && <Pin size={12} strokeWidth={2} className="shrink-0" style={{ color: 'var(--fg-3)' }} />}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
