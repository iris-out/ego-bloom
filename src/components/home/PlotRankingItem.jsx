import React from 'react';
import { proxyThumbnailUrl, getPlotImageUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

// Top 1~3 numeral stroke colors (gold / silver / bronze)
const RANK_STROKE_COLORS = ['#e9c46a', '#c9c6c0', '#c08457'];
const NUM_FONT = "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif";

function splitFormatted(str) {
  const match = str.match(/^(-?[0-9,.]+)([만천억]?)$/);
  if (match) return { num: match[1], unit: match[2] };
  return { num: str, unit: '' };
}

function pctStr(delta, current) {
  if (delta == null || !current || delta <= 0) return null;
  const base = current - delta;
  if (base <= 0) return null;
  return ((delta / base) * 100).toFixed(1) + '%';
}

function plotZetaUrl(id) {
  return id ? `https://zeta-ai.io/ko/plots/${id}/profile` : null;
}

// ─── Rank change indicator (▲ up / ▼ down / NEW) ───────────────────────────
function RankChange({ rankChange, size = 'md' }) {
  const fs = size === 'sm' ? '11px' : '12px';
  if (rankChange === null) {
    return (
      <span
        className="shrink-0 font-bold rounded"
        style={{
          fontSize: '10px',
          padding: '1px 5px',
          background: 'rgba(59,130,246,0.18)',
          color: '#93c5fd',
          border: '1px solid rgba(59,130,246,0.3)',
        }}
      >
        NEW
      </span>
    );
  }
  if (rankChange > 0) {
    return <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: fs, color: '#4ade80' }}>▲{rankChange}</span>;
  }
  if (rankChange < 0) {
    return <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: fs, color: '#f87171' }}>▼{Math.abs(rankChange)}</span>;
  }
  return null;
}

// ─── Poster card (rank 1~3) — Netflix cover treatment ──────────────────────
export function PlotPosterCard({ plot, rank }) {
  const { id, name, imageUrl, interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const zetaUrl = plotZetaUrl(id);
  const cover = getPlotImageUrl(plot) || imageUrl;
  const posterSrc = cover ? proxyThumbnailUrl(cover, 360) : null;
  const strokeColor = RANK_STROKE_COLORS[rank - 1] || 'rgba(255,255,255,0.4)';
  const { num, unit } = splitFormatted(formatNumber(interactionCount));
  const pct = pctStr(interactionDelta, interactionCount);

  return (
    <a
      href={zetaUrl || undefined}
      target={zetaUrl ? '_blank' : undefined}
      rel={zetaUrl ? 'noopener noreferrer' : undefined}
      className="poster-card group relative block overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] no-underline shadow-lg shadow-black/30 transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ aspectRatio: '2 / 3' }}
    >
      {/* Cover image */}
      {posterSrc ? (
        <img
          src={posterSrc}
          alt={name}
          width={240}
          height={360}
          loading="lazy"
          className="poster-img absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.06] text-2xl text-white/25">
          {(name || '?')[0]}
        </div>
      )}

      {/* Bottom scrim */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3/4"
        style={{ background: 'linear-gradient(transparent, #000d)' }}
      />

      {/* Giant rank numeral overlapping left edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-2 left-0 select-none font-extrabold leading-none"
        style={{
          fontFamily: NUM_FONT,
          fontSize: 'clamp(48px, 9vw, 96px)',
          color: 'transparent',
          WebkitTextStroke: `2px ${strokeColor}`,
          letterSpacing: '-0.04em',
          transform: 'translateX(-6%)',
        }}
      >
        {rank}
      </span>

      {/* Rank change badge (top-right) */}
      <div className="absolute right-2.5 top-2.5">
        <RankChange rankChange={rankChange} />
      </div>

      {/* Overlaid metadata (bottom) */}
      <div className="absolute inset-x-0 bottom-0 p-3 pl-[34%]">
        <p className="truncate text-[15px] font-bold leading-tight text-white" title={name}>
          {name}
        </p>
        {creatorHandle && (
          <p className="truncate text-[12px] text-white/60">@{creatorHandle}</p>
        )}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="tabular-nums" style={{ fontFamily: NUM_FONT, letterSpacing: '-0.03em' }}>
            <span className="text-[18px] font-bold text-white">{num}</span>
            {unit && <span className="ml-[1px] text-[12px] font-semibold text-white/55">{unit}</span>}
          </span>
          {interactionDelta != null && interactionDelta > 0 && (
            <span className="text-[12px] font-bold tabular-nums" style={{ color: '#4ade80' }}>
              {pct ? `+${pct}` : `+${formatNumber(interactionDelta)}`}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Compact dense row (rank 4+) — Netflix list treatment ──────────────────
function PlotCompactRow({ plot, rank }) {
  const { id, name, imageUrl, interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const zetaUrl = plotZetaUrl(id);
  const { num, unit } = splitFormatted(formatNumber(interactionCount));
  const pct = pctStr(interactionDelta, interactionCount);

  return (
    <a
      href={zetaUrl || undefined}
      target={zetaUrl ? '_blank' : undefined}
      rel={zetaUrl ? 'noopener noreferrer' : undefined}
      className="row-card group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 no-underline transition-transform duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:border-white/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Rank number */}
      <span
        className="w-8 shrink-0 text-center tabular-nums font-bold text-white/40"
        style={{ fontFamily: NUM_FONT, fontSize: '17px', letterSpacing: '-0.02em' }}
      >
        {rank}
      </span>

      {/* Thumbnail */}
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
        {imageUrl ? (
          <img
            src={proxyThumbnailUrl(imageUrl, 64)}
            alt={name}
            width={44}
            height={44}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-white/30">
            {(name || '?')[0]}
          </div>
        )}
      </div>

      {/* Name + creator */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-semibold leading-tight text-white" title={name}>{name}</p>
          <RankChange rankChange={rankChange} size="sm" />
        </div>
        <p className="truncate text-[12px] text-white/45">
          {creatorHandle ? `@${creatorHandle} · ` : ''}
          {num}{unit} 대화
        </p>
      </div>

      {/* Delta */}
      <div className="shrink-0 text-right">
        {interactionDelta != null && interactionDelta > 0 ? (
          <>
            {pct && (
              <div className="text-[13px] font-bold tabular-nums" style={{ color: '#4ade80', fontFamily: NUM_FONT }}>
                +{pct}
              </div>
            )}
            <div className="text-[11px] tabular-nums text-white/45" style={{ fontFamily: NUM_FONT }}>
              +{formatNumber(interactionDelta)}
            </div>
          </>
        ) : (
          <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
        )}
      </div>
    </a>
  );
}

export default function PlotRankingItem({ plot, rank }) {
  if (rank <= 3) {
    return <PlotPosterCard plot={plot} rank={rank} />;
  }
  return <PlotCompactRow plot={plot} rank={rank} />;
}
