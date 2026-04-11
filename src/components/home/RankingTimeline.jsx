import React from 'react';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

const NTR_TAGS = ['빼앗김', '뺏김', '불륜', '바람'];

function PlotRow({ plot, rank, extra, hideRank = false }) {
  const zetaUrl = plot.id ? `https://zeta-ai.io/ko/plots/${plot.id}/profile` : null;
  return (
    <a
      href={zetaUrl || undefined}
      target={zetaUrl ? '_blank' : undefined}
      rel={zetaUrl ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full no-underline"
    >
      {!hideRank && (
        <span className={`text-[12px] font-bold w-5 text-center shrink-0 ${
          typeof rank === 'number'
            ? rank === 1 ? 'text-yellow-400 tabular-nums' : rank === 2 ? 'text-white/60 tabular-nums' : rank === 3 ? 'text-white/50 tabular-nums' : 'text-white/25 tabular-nums'
            : 'text-indigo-400/80'
        }`}>{rank}</span>
      )}

      <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 bg-white/10">
        {plot.imageUrl ? (
          <img
            src={proxyThumbnailUrl(plot.imageUrl, 48)}
            alt={plot.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/90 truncate leading-tight">{plot.name}</p>
        {extra ? (
          <p className="text-[12px] text-indigo-300/70 truncate">{extra}</p>
        ) : plot.creatorHandle ? (
          <p className="text-[12px] text-white/30 truncate">@{plot.creatorHandle}</p>
        ) : null}
      </div>

      <div className="text-right shrink-0">
        <p className="text-[12px] text-white/50 tabular-nums">{formatNumber(plot.interactionCount)}</p>
        {plot.interactionDelta > 0 && (
          <p className="text-[11px] text-cyan-400 tabular-nums">+{formatNumber(plot.interactionDelta)}</p>
        )}
      </div>
    </a>
  );
}

function Section({ title, badge, children }) {
  if (!children) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[11px] font-bold tracking-widest text-white/30 uppercase">{title}</span>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{badge}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export default function RankingTimeline({ rankingData }) {
  const allPlots = [
    ...(rankingData?.trendingPlots || []),
    ...(rankingData?.bestPlots || []),
    ...(rankingData?.newPlots || []),
  ];

  // 중복 제거
  const seen = new Set();
  const uniquePlots = allPlots.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // 1. 가장 많이 오른 캐릭터
  const risingPlots = [...uniquePlots]
    .filter(p => p.interactionDelta > 0)
    .sort((a, b) => (b.interactionDelta || 0) - (a.interactionDelta || 0))
    .slice(0, 3);

  // 2. 신작/트렌딩/베스트 각 1위
  const categoryTop = [
    rankingData?.trendingPlots?.[0] ? { plot: rankingData.trendingPlots[0], label: '트렌딩' } : null,
    rankingData?.bestPlots?.[0]     ? { plot: rankingData.bestPlots[0],     label: '베스트' } : null,
    rankingData?.newPlots?.[0]      ? { plot: rankingData.newPlots[0],      label: '신작'   } : null,
  ].filter(Boolean);

  // 3. NTR 캐릭터 TOP 3
  const ntrTop = [...uniquePlots]
    .filter(p => p.hashtags?.some(h => NTR_TAGS.includes(h)))
    .sort((a, b) => b.interactionCount - a.interactionCount)
    .slice(0, 3);

  const ntrTag = (plot) => plot.hashtags?.find(h => NTR_TAGS.includes(h));

  // 4. 순애 캐릭터 TOP 3
  const sunaeTop = [...uniquePlots]
    .filter(p => p.hashtags?.includes('순애'))
    .sort((a, b) => b.interactionCount - a.interactionCount)
    .slice(0, 3);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
        <span className="text-[13px] font-semibold text-white/50">랭킹 타임라인</span>
        <span className="text-[11px] text-white/20">2시간마다 갱신</span>
      </div>

      <div>
        <Section title="가장 많이 오른 캐릭터" badge="↑">
          {risingPlots.length > 0
            ? risingPlots.map((p, i) => <PlotRow key={p.id} plot={p} rank={i + 1} />)
            : <p className="text-[11px] text-white/20 px-2 py-1">데이터 없음</p>
          }
        </Section>

        <Section title="카테고리별 1위">
          {categoryTop.length > 0
            ? categoryTop.map((item) => (
                <PlotRow key={item.plot.id} plot={item.plot} rank={item.label[0]} extra={item.label} />
              ))
            : <p className="text-[11px] text-white/20 px-2 py-1">데이터 없음</p>
          }
        </Section>

        <Section title="불륜/바람 캐릭터 TOP 3" badge="불륜">
          {ntrTop.length > 0
            ? ntrTop.map((p, i) => <PlotRow key={p.id} plot={p} rank={i + 1} extra={`# ${ntrTag(p)}`} />)
            : <p className="text-[11px] text-white/20 px-2 py-1">데이터 없음</p>
          }
        </Section>

        <Section title="순애 캐릭터 TOP 3" badge="순애">
          {sunaeTop.length > 0
            ? sunaeTop.map((p, i) => <PlotRow key={p.id} plot={p} rank={i + 1} />)
            : <p className="text-[11px] text-white/20 px-2 py-1">데이터 없음</p>
          }
        </Section>
      </div>
    </div>
  );
}
