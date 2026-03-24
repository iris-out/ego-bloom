import React, { useMemo } from 'react';
import { toKST, formatCompactNumber } from '../utils/tierCalculator';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function StatsTab({ stats, characters }) {
  // ── 심화 수치 3종 ──────────────────────────────────────
  const advanced = useMemo(() => {
    if (!stats || !characters || characters.length === 0) return null;
    const unlimitedCount = characters.filter(c => c.unlimitedAllowed).length;
    const freedomRatio = (unlimitedCount / characters.length) * 100;
    const followers = stats.followerCount || 0;
    const loyaltyRatio = followers / characters.length;
    const totalInteractions = stats.plotInteractionCount || 0;
    let blockbusterRatio = 0;
    if (totalInteractions > 0) {
      const sorted = [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
      const top2 = (sorted[0]?.interactionCount || 0) + (sorted[1]?.interactionCount || 0);
      blockbusterRatio = (top2 / totalInteractions) * 100;
    }
    return { freedomRatio, loyaltyRatio, blockbusterRatio };
  }, [stats, characters]);

  // ── 요일별 제작 수 ─────────────────────────────────────
  const weekdayData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // 일~토
    (characters || []).forEach(c => {
      const d = c.createdAt || c.createdDate;
      if (!d) return;
      const kst = toKST(d);
      counts[kst.getDay()]++;
    });
    const max = Math.max(1, ...counts);
    return counts.map((count, i) => ({ label: DAY_LABELS[i], count, pct: (count / max) * 100 }));
  }, [characters]);

  // ── 태그별 평균 대화량 (상위 10개 태그) ─────────────────
  const tagAvgData = useMemo(() => {
    if (!characters?.length) return [];
    const tagMap = {};
    characters.forEach(c => {
      const interactions = c.interactionCount || 0;
      (c.hashtags || c.tags || []).forEach(tag => {
        const t = String(tag).trim();
        if (!t) return;
        if (!tagMap[t]) tagMap[t] = { total: 0, count: 0 };
        tagMap[t].total += interactions;
        tagMap[t].count += 1;
      });
    });
    const entries = Object.entries(tagMap)
      .map(([tag, { total, count }]) => ({ tag, avg: Math.round(total / count), count }))
      .filter(e => e.count >= 2)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
    const maxAvg = Math.max(1, ...entries.map(e => e.avg));
    return entries.map(e => ({ ...e, pct: (e.avg / maxAvg) * 100 }));
  }, [characters]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* 심화 수치 3종 */}
      {advanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="매혹도"
            value={advanced.loyaltyRatio.toFixed(1)}
            sub="캐릭터 1개당 유입되는 팔로워 수"
          />
          <StatCard
            label="언리밋 비율"
            value={`${advanced.freedomRatio.toFixed(1)}%`}
            sub="무제한 대화 허용 캐릭터 비율"
          />
          <StatCard
            label="히트 쏠림도"
            value={`${advanced.blockbusterRatio.toFixed(1)}%`}
            sub="상위 2개 캐릭터의 대화량 지분"
          />
        </div>
      )}

      {/* 요일별 제작 마르 */}
      <div className="card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">요일별 제작 분포</h3>
        <div className="flex items-end gap-2 h-28">
          {weekdayData.map(({ label, count, pct }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[var(--text-tertiary)] font-mono">{count}</span>
              <div className="w-full rounded-t-sm transition-all duration-700" style={{
                height: `${Math.max(4, pct * 0.72)}px`,
                background: 'var(--accent)',
                opacity: pct > 0 ? 0.5 + pct * 0.005 : 0.2,
              }} />
              <span className="text-[10px] font-bold text-[var(--text-tertiary)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 태그별 평균 대화량 */}
      {tagAvgData.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">태그별 평균 대화량</h3>
          <div className="space-y-2">
            {tagAvgData.map(({ tag, avg, count, pct }) => (
              <div key={tag} className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-secondary)] w-[90px] text-right shrink-0 truncate">#{tag}</span>
                <div className="flex-1 h-4 bg-[var(--bg-secondary)] rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm transition-all duration-700"
                    style={{ width: `${pct}%`, background: 'var(--accent)', opacity: 0.7 }} />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-14 text-right shrink-0">
                  {formatCompactNumber(avg)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-3">2개 이상 보유한 태그만 표시 · 태그 보유 캐릭터 기준 평균</p>
        </div>
      )}
    </div>
  );
}
