import React, { useMemo } from 'react';
import ContributionGraph from './ContributionGraph';
import { getCharacterTier, CHARACTER_TIERS, formatNumber, formatDate } from '../utils/tierCalculator';
import { WordCloud } from './ExtraCharts';
import ImageWithFallback from './ImageWithFallback';
import { TierBadge } from './TierBadge';
import { Calendar } from 'lucide-react';

export default function DetailTab({ stats, characters }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* 1. Top Stats */}
      <TopStats stats={stats} characters={characters} />

      {/* 3. 가장 오래된 / 최신 캐릭터 */}
      <CharacterMilestones characters={characters} />


      {/* 5. 생성 히스토리 (GitHub style) */}
      <ContributionGraph characters={characters} />

      {/* 6. 티어 분포 */}
      <TierDistribution characters={characters} />

      {/* 7. 해시태그 클라우드 */}
      <WordCloud characters={characters} />
    </div>
  );
}

// ===== 가장 오래된 / 최신 캐릭터 =====
function CharacterMilestones({ characters }) {
  const { oldest, newest } = useMemo(() => {
    if (!characters?.length) return { oldest: null, newest: null };
    const withDate = characters.filter(c => c.createdAt || c.createdDate);
    if (!withDate.length) return { oldest: null, newest: null };
    const sorted = [...withDate].sort((a, b) =>
      new Date(a.createdAt || a.createdDate) - new Date(b.createdAt || b.createdDate)
    );
    return { oldest: sorted[0], newest: sorted[sorted.length - 1] };
  }, [characters]);

  if (!oldest || !newest || oldest.id === newest.id) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <MilestoneCard char={oldest} label="🏛 첫 번째 캐릭터" />
      <MilestoneCard char={newest} label="✨ 최신 캐릭터" />
    </div>
  );
}

function MilestoneCard({ char, label }) {
  const tier = getCharacterTier(char.interactionCount || 0);
  return (
    <a
      href={`https://zeta-ai.io/ko/plots/${char.id}/profile`}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-3 flex gap-3 hover:border-[var(--accent)] transition-all group"
    >
      {/* overflow-hidden은 이미지 div에만 적용, 배지는 바깥 relative div에 absolute 배치 */}
      <div className="relative shrink-0 w-14 h-14">
        <div className="w-full h-full rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border)]">
          <ImageWithFallback
            src={char.imageUrl}
            fallbackSrcs={(char.imageUrls || []).slice(1)}
            alt={char.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        {/* 이미지 우하단에 배지 표시 — overflow-hidden 밖에 배치 */}
        <div className="absolute -bottom-1.5 -right-1.5 bg-[var(--card)] rounded-full p-0.5 shadow-md border border-[var(--border)]">
          <TierBadge tierKey={tier.key} size={16} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-semibold text-[var(--accent)] mb-0.5">{label}</div>
        <div className="font-bold text-sm text-[var(--text-primary)] truncate leading-tight">{char.name}</div>
        <div className="text-xs text-[var(--accent-bright)] font-bold mt-0.5">
          {(char.interactionCount || 0).toLocaleString()}
        </div>
        <div className="flex items-center mt-1 text-[9px] text-[var(--text-tertiary)]">
          <Calendar size={9} className="mr-0.5" />
          {formatDate(char.createdAt || char.createdDate)}
        </div>
      </div>
    </a>
  );
}

// ===== 티어 분포 =====
function TierDistribution({ characters }) {
  const dist = useMemo(() => {
    const counts = {};
    CHARACTER_TIERS.forEach(t => { counts[t.key] = 0; });
    (characters || []).forEach(c => {
      const t = getCharacterTier(c.interactionCount || 0);
      counts[t.key] = (counts[t.key] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return CHARACTER_TIERS.map(t => ({
      ...t,
      count: counts[t.key] || 0,
      pct: ((counts[t.key] || 0) / max) * 100,
    }));
  }, [characters]);

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">캐릭터 티어 분포</h3>
      <div className="space-y-2">
        {dist.map(t => (
          <div key={t.key} className="flex items-center gap-2">
            <span className="text-[10px] w-8 text-right font-bold shrink-0" style={{ color: t.color }}>{t.name}</span>
            <div className="flex-1 h-5 bg-[var(--bg-secondary)] rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-700" style={{ width: `${t.pct}%`, backgroundColor: t.color }} />
            </div>
            <span className="text-xs font-mono text-[var(--text-tertiary)] w-8 text-right">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 상단 스탯 카드 =====
function TopStats({ stats, characters }) {
  const totalInteractions = stats?.plotInteractionCount || 0;
  const avgPerChar = characters?.length ? Math.round(totalInteractions / characters.length) : 0;
  const topChar = characters?.length
    ? [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))[0]
    : null;
  const voicePlaySeconds = stats?.voicePlaySeconds || 0;
  const voiceMinutes = Math.floor(voicePlaySeconds / 60);
  const voiceDisplay = voiceMinutes >= 60
    ? `${Math.floor(voiceMinutes / 60)}시간 ${voiceMinutes % 60}분`
    : voiceMinutes > 0
      ? `${voiceMinutes}분`
      : voicePlaySeconds > 0
        ? `${Math.round(voicePlaySeconds)}초`
        : '-';
  const followers = stats?.followerCount || 0;
  const recentlyUpdatedChar = useMemo(() => {
    if (!characters?.length) return null;
    const withUpdate = characters.filter(c => c.updatedAt);
    if (!withUpdate.length) return null;
    return withUpdate.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  }, [characters]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard label="캐릭터당 평균 대화" value={formatNumber(avgPerChar)} />
      <StatCard label="음성 재생 시간" value={voiceDisplay} />
      <StatCard label="팔로워" value={formatNumber(followers)} />
      <StatCard label="대화/팔로워 비율" value={followers > 0 ? (totalInteractions / followers).toFixed(2) : '-'} />
      <StatCard
        label="최고 인기 캐릭터"
        value={topChar?.name || '-'}
        sub={topChar ? formatNumber(topChar.interactionCount || 0) : ''}
      />
      {recentlyUpdatedChar && (
        <StatCard
          label="최근 업데이트 캐릭터"
          value={recentlyUpdatedChar.name}
          sub={formatDate(recentlyUpdatedChar.updatedAt)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase mb-1">{label}</div>
      <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

