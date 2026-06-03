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
// `onImage` (poster usage) wraps the arrow in a dark backing pill so it stays
// legible over bright cover art; in dense rows it renders as bare text.
function RankChange({ rankChange, size = 'md', onImage = false }) {
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
          boxShadow: onImage ? '0 1px 4px rgba(0,0,0,0.5)' : undefined,
        }}
      >
        NEW
      </span>
    );
  }
  if (rankChange === 0) return null;
  const up = rankChange > 0;
  const pillStyle = onImage
    ? {
        padding: '1px 5px',
        borderRadius: '5px',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }
    : null;
  return (
    <span
      className="shrink-0 font-bold tabular-nums"
      style={{ fontSize: fs, color: up ? '#4ade80' : '#f87171', ...pillStyle }}
    >
      {up ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
    </span>
  );
}

// ─── Poster card (rank 1~10) — Netflix cover treatment ─────────────────────
// Main-page style: the giant rank numeral lives OUTSIDE the card, overlapping
// its bottom-left edge, so the whole card surface is free for name + creator +
// an emphasized 대화량(interaction) stat block.
export function PlotPosterCard({ plot, rank }) {
  const { id, name, imageUrl, interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const zetaUrl = plotZetaUrl(id);
  const cover = getPlotImageUrl(plot) || imageUrl;
  const posterSrc = cover ? proxyThumbnailUrl(cover, 360) : null;
  const strokeColor = RANK_STROKE_COLORS[rank - 1] || 'rgba(255,255,255,0.45)';
  const { num, unit } = splitFormatted(formatNumber(interactionCount));
  const pct = pctStr(interactionDelta, interactionCount);
  const hasDelta = interactionDelta != null && interactionDelta > 0;

  return (
    <div className="flex items-end shrink-0 snap-start select-none">
      {/* Rank numeral — outside the card, overlapping its left edge (메인 style) */}
      <span
        aria-hidden="true"
        className="font-black leading-[0.8] -mr-3 sm:-mr-4 z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        style={{
          fontFamily: NUM_FONT,
          fontSize: 'clamp(54px, 7vw, 88px)',
          letterSpacing: rank >= 10 ? '-0.12em' : '-0.03em',
          color: 'transparent',
          WebkitTextStroke: `2.5px ${strokeColor}`,
        }}
      >
        {rank}
      </span>

      <a
        href={zetaUrl || undefined}
        target={zetaUrl ? '_blank' : undefined}
        rel={zetaUrl ? 'noopener noreferrer' : undefined}
        className="poster-card group relative z-20 block w-[120px] sm:w-[140px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] no-underline shadow-lg shadow-black/30 transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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

        {/* Bottom scrim — tall enough to seat the emphasized stat block */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-4/5"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.94))' }}
        />
        {/* Top accent line in the rank color */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: strokeColor }} />

        {/* Rank change badge (top-right) */}
        <div className="absolute right-2 top-2 z-10">
          <RankChange rankChange={rankChange} onImage />
        </div>

        {/* Metadata — full width now that the numeral lives outside */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
          <p className="truncate text-[13px] font-bold leading-tight text-white drop-shadow" title={name}>
            {name}
          </p>
          {creatorHandle && (
            <p className="truncate text-[11px] leading-tight text-white/55">@{creatorHandle}</p>
          )}
          {/* 대화량 — hero number, big bold white */}
          <div
            className="mt-1.5 flex items-baseline gap-0.5 whitespace-nowrap tabular-nums"
            style={{ fontFamily: NUM_FONT, letterSpacing: '-0.03em' }}
          >
            <span className="text-[22px] font-extrabold leading-none text-white">{num}</span>
            {unit && <span className="text-[13px] font-bold text-white/65">{unit}</span>}
          </div>
          {/* 상승률 + 상승량 — emphasized */}
          {hasDelta && (
            <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
              {pct && <span className="text-[13px] font-extrabold" style={{ color: '#4ade80' }}>+{pct}</span>}
              <span className="text-[11px] font-semibold" style={{ color: 'rgba(134,239,172,0.85)' }}>
                +{formatNumber(interactionDelta)}
              </span>
            </div>
          )}
        </div>
      </a>
    </div>
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
      className="row-card group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:py-2.5 no-underline transition-transform duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:border-white/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start gap-1.5">
          <p className="text-[14px] sm:text-[15px] font-semibold leading-[1.2] text-white line-clamp-2" title={name}>{name}</p>
          <div className="mt-0.5 shrink-0">
            <RankChange rankChange={rankChange} size="sm" />
          </div>
        </div>
        {creatorHandle && (
          <p className="text-[11px] sm:text-[12px] text-white/45 mt-0.5 leading-tight">@{creatorHandle}</p>
        )}
      </div>

      {/* 대화량 (hero, 우측 볼드 흰색) + 상승률/상승량 */}
      <div className="shrink-0 flex items-center gap-3 sm:gap-4">
        <div className="text-right leading-none whitespace-nowrap" style={{ fontFamily: NUM_FONT, letterSpacing: '-0.03em' }}>
          <span className="tabular-nums">
            <span className="text-[19px] font-bold text-white">{num}</span>
            {unit && <span className="ml-px text-[12px] font-semibold text-white/55">{unit}</span>}
          </span>
          <div className="mt-0.5 text-[10px] font-medium text-white/35">대화</div>
        </div>
        <div className="w-[56px] shrink-0 text-right">
          {interactionDelta != null && interactionDelta > 0 ? (
            <>
              {pct && (
                <div className="text-[14px] font-extrabold tabular-nums" style={{ color: '#4ade80', fontFamily: NUM_FONT }}>
                  +{pct}
                </div>
              )}
              <div className="mt-0.5 text-[11px] font-semibold tabular-nums" style={{ color: 'rgba(134,239,172,0.8)', fontFamily: NUM_FONT }}>
                +{formatNumber(interactionDelta)}
              </div>
            </>
          ) : (
            <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
          )}
        </div>
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
