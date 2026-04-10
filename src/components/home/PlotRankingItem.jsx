import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReactOfficial from 'highcharts-react-official';
const HighchartsReact = HighchartsReactOfficial?.default ?? HighchartsReactOfficial;
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

const CYAN_COLORS = ['#22d3ee', '#5eead4', '#67e8f9', '#a5f3fc', '#cffafe', '#d9f9f9', '#e8fbfb'];

function getCyanColor(delta, maxDelta) {
  if (!maxDelta || delta == null || delta <= 0) return '#e8fbfb';
  const ratio = delta / maxDelta;
  if (ratio >= 0.85) return CYAN_COLORS[0];
  if (ratio >= 0.70) return CYAN_COLORS[1];
  if (ratio >= 0.55) return CYAN_COLORS[2];
  if (ratio >= 0.40) return CYAN_COLORS[3];
  if (ratio >= 0.25) return CYAN_COLORS[4];
  if (ratio >= 0.10) return CYAN_COLORS[5];
  return CYAN_COLORS[6];
}

function pctStr(delta, current) {
  if (delta == null || !current || delta <= 0) return null;
  const base = current - delta;
  if (base <= 0) return null;
  return ((delta / base) * 100).toFixed(1) + '%';
}

// delta: 이번 2시간 증가량, maxDelta: 목록 내 최대 증가량 (y축 기준 통일)
// size: 'md'(데스크탑 38px) | 'sm'(모바일 28px)
const PlotSparkline = React.memo(function PlotSparkline({ delta, maxDelta, size = 'md' }) {
  const isUp = delta != null && delta > 0;
  const lineColor = isUp ? '#34d399' : '#818cf8';
  const fillTop = isUp ? 'rgba(52,211,153,0.22)' : 'rgba(129,140,248,0.12)';
  const height = size === 'sm' ? 28 : 38;
  // 목록 전체의 maxDelta를 y축 최대로 설정 → 상승폭이 클수록 기울기가 큼
  const yMax = (maxDelta > 0 ? maxDelta : (delta || 1)) * 1.25;

  const options = useMemo(() => ({
    chart: {
      type: 'area',
      height,
      backgroundColor: 'transparent',
      margin: [1, 0, 1, 0],
      animation: false,
      spacing: [0, 0, 0, 0],
    },
    title: { text: null },
    xAxis: { visible: false },
    yAxis: { visible: false, min: 0, max: yMax },
    legend: { enabled: false },
    tooltip: { enabled: false },
    credits: { enabled: false },
    plotOptions: {
      area: {
        marker: { enabled: false },
        lineWidth: 1.5,
        fillOpacity: 1,
        color: lineColor,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, fillTop], [1, 'rgba(0,0,0,0)']],
        },
      },
    },
    series: [{ data: [0, isUp ? delta : 0] }],
  }), [delta, maxDelta, height, yMax, lineColor, fillTop, isUp]); // eslint-disable-line react-hooks/exhaustive-deps

  return <HighchartsReact highcharts={Highcharts} options={options} />;
});

export default function PlotRankingItem({ plot, rank, maxDelta }) {
  const { id, name, imageUrl, hashtags = [], interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const color = getCyanColor(interactionDelta, maxDelta);
  const pct = pctStr(interactionDelta, interactionCount);
  const tags = hashtags.filter(t => t).slice(0, 3);
  const zetaUrl = id ? `https://zeta-ai.io/ko/plots/${id}/profile` : null;

  const medalBg =
    rank === 1 ? 'bg-yellow-400/[0.05] border border-yellow-400/[0.15]' :
    rank === 2 ? 'bg-slate-300/[0.04] border border-slate-300/[0.12]' :
    rank === 3 ? 'bg-amber-600/[0.05] border border-amber-600/[0.15]' :
    '';

  return (
    <a
      href={zetaUrl || undefined}
      target={zetaUrl ? '_blank' : undefined}
      rel={zetaUrl ? 'noopener noreferrer' : undefined}
      className={`block py-3 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer no-underline ${medalBg}`}
    >
      {/* Row 1: 순위 + 이미지 + 이름/핸들 (항상 표시) */}
      <div className="flex items-center gap-2.5 lg:gap-2">
        <span className={`text-[15px] font-bold text-center tabular-nums w-5 shrink-0 ${
          rank === 1 ? 'text-yellow-400' : rank <= 3 ? 'text-white/70' : 'text-white/30'
        }`}>
          {rank}
        </span>

        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white/10">
          {imageUrl ? (
            <img
              src={proxyThumbnailUrl(imageUrl, 64)}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-white/30">
              {(name || '?')[0]}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[16px] sm:text-[15px] font-semibold sm:font-medium text-white truncate min-w-0 leading-tight">{name}</p>
            {rankChange === null ? (
              <span className="shrink-0 text-[10px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">NEW</span>
            ) : rankChange > 0 ? (
              <span className="shrink-0 text-[11px] font-bold text-emerald-400">↑{rankChange}</span>
            ) : rankChange < 0 ? (
              <span className="shrink-0 text-[11px] font-bold text-red-400">↓{Math.abs(rankChange)}</span>
            ) : null}
          </div>
          {creatorHandle && (
            <p className="text-[13px] text-white/35 truncate">@{creatorHandle}</p>
          )}
        </div>

        {/* 데스크탑(sm+) 전용: 태그 열 */}
        <div className="hidden sm:grid grid-cols-3 gap-0.5 shrink-0 w-[156px]">
          {tags.map((t, i) => (
            <span key={i} className="text-[11px] px-1 py-0.5 rounded-full bg-white/[0.08] text-white/50 truncate text-center">
              {t}
            </span>
          ))}
        </div>

        {/* 데스크탑(sm+) 전용: 대화량+증가 열 */}
        <div className="hidden sm:block text-right shrink-0 w-[100px]">
          <span className="text-[17px] font-bold text-white/80 tabular-nums">
            {formatNumber(interactionCount)}
          </span>
          {interactionDelta != null && interactionDelta > 0 && (
            <div className="text-[13px] tabular-nums leading-tight" style={{ color }}>
              (+{formatNumber(interactionDelta)})
            </div>
          )}
        </div>

        {/* 데스크탑(sm+) 전용: 스파크라인 열 */}
        <div className="hidden sm:flex flex-col justify-center shrink-0 w-[96px]">
          {interactionDelta != null && interactionDelta > 0 ? (
            <>
              <PlotSparkline delta={interactionDelta} maxDelta={maxDelta} size="md" />
              {pct && (
                <span className="text-[12px] tabular-nums text-right" style={{ color: '#34d399', opacity: 0.75 }}>
                  +{pct}
                </span>
              )}
            </>
          ) : (
            <div className="h-[38px] flex items-center justify-end">
              <span className="text-[12px] text-white/15">—</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: 모바일(< sm) 전용 — 태그 + 대화량 + 증가 + 바 */}
      {/* pl-20(80px) = rank w-5(20px) + gap-2.5(10px) + avatar w-10(40px) + gap-2.5(10px) */}
      <div className="sm:hidden flex items-center gap-2 mt-1.5 pl-20">
        {tags.slice(0, 2).map((t, i) => (
          <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/50 truncate max-w-[72px]">
            {t}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[13px] font-medium text-white/80 tabular-nums">
            {formatNumber(interactionCount)}
          </span>
          {interactionDelta != null && interactionDelta > 0 && (
            <span className="text-[12px] tabular-nums" style={{ color }}>
              +{formatNumber(interactionDelta)}
            </span>
          )}
          <div className="w-12 shrink-0">
            {interactionDelta != null && interactionDelta > 0 ? (
              <>
                <PlotSparkline delta={interactionDelta} maxDelta={maxDelta} size="sm" />
                {pct && (
                  <span className="text-[10px] tabular-nums text-right block" style={{ color: '#34d399', opacity: 0.75 }}>
                    +{pct}
                  </span>
                )}
              </>
            ) : (
              <div className="h-[28px] flex items-center justify-end">
                <span className="text-[10px] text-white/15">—</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
