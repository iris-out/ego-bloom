import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReactOfficial from 'highcharts-react-official';

const HighchartsReact = HighchartsReactOfficial?.default ?? HighchartsReactOfficial;

function fmtScore(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDelta(delta, first) {
  if (delta == null || delta === 0 || first == null || first === 0) return null;
  const pct = (delta / Math.abs(first)) * 100;
  const sign = delta > 0 ? '▲ +' : '▼ ';
  return sign + Math.abs(pct).toFixed(1) + '%';
}

export default function TagBubbleCard({
  label,
  subLabel,
  dataPoints,
  currentScore,
  timeWindow = '6h',
}) {
  const windowedPoints = useMemo(() => {
    const pts = dataPoints || [];
    const hours = parseInt(timeWindow, 10) || 6;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const filtered = pts.filter(p => new Date(p.ts).getTime() >= cutoff);
    return filtered.length >= 1 ? filtered : pts.slice(-2);
  }, [dataPoints, timeWindow]);

  const { delta, firstScore } = useMemo(() => {
    if (windowedPoints.length < 2) return { delta: null, firstScore: null };
    const first = windowedPoints[0].score;
    const last = windowedPoints[windowedPoints.length - 1].score;
    return { delta: last - first, firstScore: first };
  }, [windowedPoints]);

  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;
  const lineColor = isUp ? '#34d399' : isDown ? '#f87171' : '#818cf8';
  const fillTop = isUp
    ? 'rgba(52,211,153,0.20)'
    : isDown
    ? 'rgba(248,113,113,0.15)'
    : 'rgba(129,140,248,0.15)';

  const deltaLabel = fmtDelta(delta, firstScore);

  const chartOptions = useMemo(() => {
    const rawPairs = windowedPoints.map(d => [new Date(d.ts).getTime(), d.score]);
    const pairs =
      rawPairs.length >= 2
        ? rawPairs
        : rawPairs.length === 1
        ? [
            [rawPairs[0][0] - 60000, rawPairs[0][1]],
            [rawPairs[0][0], rawPairs[0][1]],
          ]
        : [
            [Date.now() - 60000, 0],
            [Date.now(), 0],
          ];

    const scores = pairs.map(p => p[1]);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    const yPad = scoreRange > 0 ? scoreRange * 0.20 : maxScore > 0 ? maxScore * 0.001 : 1;

    return {
      chart: {
        type: 'areaspline',
        width: null,
        height: 52,
        backgroundColor: 'transparent',
        margin: [4, 2, 4, 2],
        animation: false,
      },
      title: { text: null },
      xAxis: {
        type: 'datetime',
        visible: false,
        minPadding: 0.02,
        maxPadding: 0.02,
        crosshair: {
          width: 1,
          color: 'rgba(255,255,255,0.2)',
          snap: true,
        },
      },
      yAxis: {
        visible: false,
        min: Math.max(0, minScore - yPad),
        max: maxScore + yPad,
      },
      legend: { enabled: false },
      credits: { enabled: false },
      tooltip: {
        enabled: true,
        outside: true,
        backgroundColor: '#1a1f2e',
        borderColor: 'rgba(255,255,255,0.1)',
        style: { color: '#fff', fontSize: '11px' },
        formatter() {
          const dateStr = new Date(this.x).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          return `${dateStr}<br/><b>${this.y.toLocaleString(undefined, { maximumFractionDigits: 2 })} pts</b>`;
        },
      },
      plotOptions: {
        areaspline: {
          marker: {
            enabled: false,
            states: { hover: { enabled: true, radius: 3 } },
          },
          lineWidth: 1.5,
          fillOpacity: 1,
          color: lineColor,
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, fillTop],
              [1, 'rgba(0,0,0,0)'],
            ],
          },
        },
      },
      series: [{ data: pairs }],
    };
  }, [windowedPoints, lineColor, fillTop]);

  return (
    <div
      className="bg-white/[0.04] border border-white/[0.08] rounded p-3 cursor-pointer
                 hover:bg-white/[0.07] hover:border-[rgba(74,127,255,0.3)] transition-all"
    >
      {/* 상단: 태그명 + 델타 */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[15px] font-semibold text-white/90 truncate">
          #{label}
        </span>
        {deltaLabel ? (
          <span
            className="text-[12px] font-semibold tabular-nums shrink-0 ml-2"
            style={{ color: lineColor }}
          >
            {deltaLabel}
          </span>
        ) : (
          <span className="text-[12px] text-white/25 shrink-0 ml-2">—</span>
        )}
      </div>

      {/* subLabel */}
      {subLabel && (
        <p className="text-[11px] text-white/35 truncate mb-1">{subLabel}</p>
      )}

      {/* 차트 */}
      <div className="w-full">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>

      {/* 하단: 현재 점수 + 기준 시간 */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[13px] font-bold text-white/85 tabular-nums">
          {fmtScore(currentScore)} <span className="text-white/40 font-normal text-[11px]">pts</span>
        </span>
        <span className="text-[10px] text-white/30">{timeWindow} 기준</span>
      </div>
    </div>
  );
}
