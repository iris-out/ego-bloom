import React from 'react';
import { proxyThumbnailUrl, getPlotImageUrl } from '../../utils/imageUtils';
import { getCharacterTier } from '../../utils/tierCalculator';
import CharCard from '../ui/CharCard';
import Num from '../ui/Num';
import Delta from '../ui/Delta';

function plotZetaUrl(id) {
  return id ? `https://zeta-ai.io/ko/plots/${id}/profile` : null;
}

function plotRarity(interactionCount) {
  return getCharacterTier(interactionCount || 0).key;
}

// ─── Rank change indicator (▲ up / ▼ down / NEW) ───────────────────────────
// 순위 변동은 Delta 와 같은 pill 이지만 값이 "만/억" 단위가 아니라 계단 수이므로
// format 을 그대로 절대값 문자열로 넘긴다. NEW 는 Delta 가 표현하지 못하는 상태라 별도 칩이다.
function RankChange({ rankChange }) {
  if (rankChange === null) {
    return (
      <span
        className="t-label shrink-0 inline-flex items-center h-5 px-1.5"
        style={{
          borderRadius: 'var(--radius-pill)',
          background: `color-mix(in srgb, var(--accent-ink) 16%, var(--bg))`,
          color: 'var(--accent-ink)',
        }}
      >
        NEW
      </span>
    );
  }
  if (!rankChange) return null;
  return <Delta value={rankChange} format={(n) => String(n)} />;
}

// ─── Top 10 카드 — CharCard 'grid', 1~3위는 금/은/동 40px 메달 배지 ─────────
export function PlotTopCard({ plot, rank, priority = false }) {
  const { id, name, imageUrl, interactionCount = 0, creatorHandle } = plot;
  const zetaUrl = plotZetaUrl(id);
  const cover = getPlotImageUrl(plot) || imageUrl;

  return (
    <CharCard
      name={name}
      imageUrl={cover ? proxyThumbnailUrl(cover, 360) : null}
      rarity={plotRarity(interactionCount)}
      rank={rank}
      count={interactionCount}
      countLabel="대화"
      creator={creatorHandle ? `@${creatorHandle}` : undefined}
      size="grid"
      href={zetaUrl || undefined}
      target="_blank"
      priority={priority}
    />
  );
}

// ─── 11위~100위 행 — eb-row, 60 tall ────────────────────────────────────────
export function PlotRow({ plot, rank }) {
  const { id, name, imageUrl, hashtags = [], interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const zetaUrl = plotZetaUrl(id);
  const tags = hashtags.filter(Boolean).slice(0, 2);

  return (
    <a
      href={zetaUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="eb-row flex items-center gap-3 px-3 no-underline"
      style={{ height: 60, borderBottom: '1px solid var(--line)' }}
    >
      <span
        className="shrink-0 text-right tabular-nums"
        style={{ width: 36, fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--fg-2)' }}
      >
        {rank}
      </span>

      <CharCard
        name={name}
        imageUrl={imageUrl ? proxyThumbnailUrl(imageUrl, 64) : null}
        rarity={plotRarity(interactionCount)}
        size="mini"
        interactive={false}
      />

      <div className="min-w-0 flex-1" style={{ minWidth: '50%' }}>
        <p className="t-h3 truncate">{name}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          {creatorHandle && <p className="t-small truncate" style={{ color: 'var(--fg-2)' }}>@{creatorHandle}</p>}
          <RankChange rankChange={rankChange} />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="hidden sm:flex shrink-0 items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="eb-chip">{t}</span>
          ))}
        </div>
      )}

      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <Num value={interactionCount} />
        <Delta value={interactionDelta} />
      </div>
    </a>
  );
}

export default function PlotRankingItem({ plot, rank }) {
  if (rank <= 10) {
    return <PlotTopCard plot={plot} rank={rank} />;
  }
  return <PlotRow plot={plot} rank={rank} />;
}
