import React, { useMemo } from 'react';
import { computeEarnedTitles, BADGE_COLOR_MAP } from '../data/badges';

export default function BadgeStrip({ stats, characters }) {
  const earned = useMemo(() => {
    if (!stats || !characters) return [];
    return computeEarnedTitles({ characters, stats }).filter(t => t.earned);
  }, [stats, characters]);

  if (earned.length === 0) return null;

  const visible = earned.slice(0, 4);
  const overflow = earned.length - 4;

  return (
    <div
      className="flex items-center gap-1.5 mb-3"
      style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
    >
      {visible.map(t => {
        const c = BADGE_COLOR_MAP[t.color] || BADGE_COLOR_MAP.violet;
        return (
          <div
            key={t.id}
            className={`flex items-center gap-1 shrink-0 rounded-full px-2.5 py-1 ${c.bg} border ${c.border}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
            <span className={`text-[10px] font-semibold whitespace-nowrap ${c.text}`}>{t.title}</span>
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="shrink-0 rounded-full px-2 py-1 text-[10px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
