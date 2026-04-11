import React, { useMemo } from 'react';
import { formatNumber } from '../../utils/tierCalculator';
import AnnouncementTicker from './AnnouncementTicker';

function KpiCell({ label, value, change, up, isAccent }) {
  return (
    <div className="px-4 first:pl-0 shrink-0 border-r border-white/[0.06] last:border-r-0 pr-4">
      <div style={{
        color: 'var(--c-label)',
        fontSize: '9px',
        letterSpacing: 'var(--label-tracking)',
        textTransform: 'uppercase',
        marginBottom: '2px',
      }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: isAccent ? '12px' : '15px',
          fontWeight: 800,
          color: isAccent ? 'var(--accent-bright)' : '#fff',
          letterSpacing: '-0.03em',
          whiteSpace: 'nowrap',
          maxWidth: isAccent ? '130px' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
        }}>
          {value}
        </span>
        {change && (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: up ? 'var(--c-up)' : 'var(--c-down)',
            flexShrink: 0,
          }}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MarketDataBar({ rankingData }) {
  const metrics = useMemo(() => {
    if (!rankingData) return null;
    // trendingPlots has actual plot objects with interactionCount/Delta/creatorHandle
    // rankingData.combined is tag-score data, not plots
    const combined = rankingData.trendingPlots || [];

    // 24H total chat delta
    const chats24h = combined.reduce((sum, p) => sum + (p.interactionDelta || 0), 0);

    // Active unique creators
    const creatorSet = new Set(combined.map(p => p.creatorHandle).filter(Boolean));
    const activeCreators = creatorSet.size;

    // Top mover by % change
    let topMover = null;
    let topPct = 0;
    for (const p of combined) {
      if (!p.interactionDelta || !p.interactionCount) continue;
      const base = p.interactionCount - p.interactionDelta;
      if (base <= 0) continue;
      const pct = p.interactionDelta / base;
      if (pct > topPct) { topPct = pct; topMover = p; }
    }

    // Creator index: total volume proxy (sum of top 100 interactionCount / 10000)
    const top100 = combined.slice(0, 100);
    const creatorIndex = Math.round(
      top100.reduce((sum, p) => sum + (p.interactionCount || 0), 0) / 10000
    );

    return { chats24h, activeCreators, topMover, topPct, creatorIndex };
  }, [rankingData]);

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* KPI bar */}
      <div
        className="max-w-7xl mx-auto px-4 py-2 flex items-center overflow-x-auto"
        style={{ background: 'rgba(5,5,18,0.6)', backdropFilter: 'blur(8px)', scrollbarWidth: 'none' }}
      >
        {metrics ? (
          <>
            <KpiCell
              label="크리에이터 지수"
              value={metrics.creatorIndex.toLocaleString('ko-KR')}
              change={null}
            />
            <KpiCell
              label="24H 대화량"
              value={formatNumber(metrics.chats24h)}
              change={metrics.chats24h > 0 ? '▲' : null}
              up
            />
            <KpiCell
              label="활성 크리에이터"
              value={String(metrics.activeCreators)}
              change={null}
            />
            {metrics.topMover && (
              <KpiCell
                label="TOP 무버"
                value={metrics.topMover.name}
                change={`+${(metrics.topPct * 100).toFixed(1)}%`}
                up
                isAccent
              />
            )}
          </>
        ) : (
          /* skeleton while loading */
          <div className="flex gap-8">
            {[80, 64, 56, 100].map((w, i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 rounded" style={{ width: `${w / 2}px`, background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-4 rounded" style={{ width: `${w}px`, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Announcement ticker (moved from top-level) */}
      <AnnouncementTicker compact />
    </div>
  );
}
