import React, { useMemo } from 'react';
import ContributionGraph from './ContributionGraph';
import { getCharacterTier, CHARACTER_TIERS, formatNumber, formatCompactNumber, formatDate } from '../utils/tierCalculator';
import { WordCloud } from './ExtraCharts';
import CreatorRadarChart from './CreatorRadarChart';
import { TierBadge } from './TierBadge';
import { MessageCircle, Users, BarChart3 } from 'lucide-react';

export default function DetailTab({ stats, characters }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* 0. 요약 스탯 그리드 */}
      <SummaryStatGrid stats={stats} characters={characters} />

      {/* 2. 크리에이터 스탯 레이더 (ProfileHeader에서 이동됨) */}
      <div className="card px-4 sm:px-5 py-3 sm:py-3.5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">크리에이터 스탯 레이더</h3>
        <CreatorRadarChart stats={stats} characters={characters} />
      </div>

      {/* 3. 생성 히스토리 (GitHub style) */}
      <ContributionGraph characters={characters} />

      {/* 4. 티어 분포 */}
      <TierDistribution characters={characters} />

      {/* 5. 해시태그 클라우드 */}
      <WordCloud characters={characters} />
    </div>
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

// ===== 통합 스탯 그리드 =====
function SummaryStatGrid({ stats, characters }) {
  const totalInteractions = stats?.plotInteractionCount || (characters || []).reduce((s, c) => s + (c.interactionCount || 0), 0);
  const avgInteractions = characters?.length > 0 ? Math.round(totalInteractions / characters.length) : 0;
  const followers = stats?.followerCount || 0;
  const following = stats?.followingCount || 0;
  const cards = [
    { label: '캐릭터 수',       value: formatNumber(stats?.plotCount || characters?.length || 0), icon: <BarChart3 size={14} /> },
    { label: '팔로워/팔로잉',   value: following === 0 && followers === 0 ? '-' : (following > 0 ? (followers / following).toFixed(2) : followers.toLocaleString('ko-KR')), icon: <Users size={14} /> },
    { label: '평균 대화',       value: formatCompactNumber(avgInteractions),                       icon: <BarChart3 size={14} /> },
    { label: '대화/팔로워',     value: followers > 0 ? (totalInteractions / followers).toFixed(2) : '-', icon: <MessageCircle size={14} /> },
  ];

  return (
    <div className="stat-grid">
      {cards.map(({ label, value, icon }) => (
        <div key={label} className="stat-card">
          <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-1">{icon}<span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span></div>
          <div className="text-lg font-black text-[var(--text-primary)]">{value}</div>
        </div>
      ))}
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

// ===== 추가 스탯 카드 =====
function AdditionalStats({ stats, characters }) {
  const data = useMemo(() => {
    if (!stats || !characters || characters.length === 0) return null;

    // 14. 자유도의 수호자 (Freedom Advocate)
    const unlimitedCount = characters.filter(c => c.unlimitedAllowed).length;
    const freedomRatio = (unlimitedCount / characters.length) * 100;

    // 21. 충성도 (Loyalty Ratio)
    const followers = stats.followerCount || 0;
    const loyaltyRatio = followers / characters.length;

    // 3. 히트 쏠림도 (Blockbuster Ratio)
    const totalInteractions = stats.plotInteractionCount || 0;
    let blockbusterRatio = 0;

    if (totalInteractions > 0) {
      const sortedByInteraction = [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
      const top2Interactions = (sortedByInteraction[0]?.interactionCount || 0) + (sortedByInteraction[1]?.interactionCount || 0);
      blockbusterRatio = (top2Interactions / totalInteractions) * 100;
    }

    return { freedomRatio, loyaltyRatio, blockbusterRatio };
  }, [stats, characters]);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        label="언리밋 비율"
        value={`${data.freedomRatio.toFixed(1)}%`}
        sub="무제한 대화 허용 캐릭터 비율"
      />
      <StatCard
        label="매혹도"
        value={data.loyaltyRatio.toFixed(1)}
        sub="캐릭터 1개당 유입되는 팔로워 수"
      />
      <StatCard
        label="히트 쏠림도"
        value={`${data.blockbusterRatio.toFixed(1)}%`}
        sub="상위 2개 캐릭터의 대화량 지분"
      />
    </div>
  );
}
