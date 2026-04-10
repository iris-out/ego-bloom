import React, { useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReactOfficial from 'highcharts-react-official';
// Vite CJS interop: module.exports 전체가 default로 들어오므로 .default를 명시적으로 참조
const HighchartsReact = HighchartsReactOfficial?.default ?? HighchartsReactOfficial;
import { Info } from 'lucide-react';

const CYAN_COLORS = ['#22d3ee', '#5eead4', '#67e8f9', '#a5f3fc', '#cffafe', '#d9f9f9', '#e8fbfb'];

function getCyanColor(delta, maxDelta) {
  if (maxDelta === 0 || delta == null || delta <= 0) return '#e8fbfb';
  const ratio = delta / maxDelta;
  if (ratio >= 0.85) return CYAN_COLORS[0];
  if (ratio >= 0.70) return CYAN_COLORS[1];
  if (ratio >= 0.55) return CYAN_COLORS[2];
  if (ratio >= 0.40) return CYAN_COLORS[3];
  if (ratio >= 0.25) return CYAN_COLORS[4];
  if (ratio >= 0.10) return CYAN_COLORS[5];
  return CYAN_COLORS[6];
}

function formatDelta(n) {
  if (n == null) return null;
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}만`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}천`;
  return `${sign}${abs.toLocaleString()}`;
}

export default function TagTrendCard({ label, tooltip, dataPoints, maxDelta, combinedScore }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const rawScores = (dataPoints || []).map(d => d.score);
  const latestScore = rawScores[rawScores.length - 1] ?? null;
  const prevScore = rawScores[rawScores.length - 2] ?? null;
  const delta = (latestScore != null && prevScore != null) ? latestScore - prevScore : null;
  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;
  const color = isDown ? '#f87171' : getCyanColor(delta, maxDelta);

  // 데이터가 부족해도 평탄한 그래프를 표시 (0점이면 [0,0], 1점이면 [score,score])
  const scores = rawScores.length >= 2
    ? rawScores
    : rawScores.length === 1
      ? [rawScores[0], rawScores[0]]
      : [0, 0];
  const hasData = true;

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore;
  // 변화폭이 없으면 최댓값의 0.1%를 패딩으로 사용, 있으면 범위의 20%
  const yPad = scoreRange > 0 ? scoreRange * 0.20 : (maxScore > 0 ? maxScore * 0.001 : 1);

  const lineColor = isUp ? '#34d399' : isDown ? '#f87171' : '#818cf8';
  const fillTop = isUp ? 'rgba(52,211,153,0.25)' : isDown ? 'rgba(248,113,113,0.20)' : 'rgba(129,140,248,0.20)';

  const chartOptions = {
    chart: {
      type: 'area',
      height: 40,
      backgroundColor: 'transparent',
      margin: [2, 0, 2, 0],
      animation: false,
    },
    title: { text: null },
    xAxis: { visible: false },
    yAxis: {
      visible: false,
      min: Math.max(0, minScore - yPad),
      max: maxScore + yPad,
    },
    legend: { enabled: false },
    tooltip: { enabled: false },
    credits: { enabled: false },
    plotOptions: {
      area: {
        marker: { enabled: false },
        lineWidth: 2,
        fillOpacity: 1,
        color: lineColor,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, fillTop], [1, 'rgba(0,0,0,0)']],
        },
      },
    },
    series: [{ data: scores }],
  };

  return (
    <div className="flex-none w-[160px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex flex-col gap-1 shrink-0">
      {/* 라벨 + 툴팁 */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-white/80 truncate">{label}</span>
        <div className="relative shrink-0 ml-1">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <Info size={11} />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-5 z-50 w-48 rounded-lg bg-[#1e1b4b] border border-indigo-500/30 p-2 text-[11px] text-white/70 leading-relaxed shadow-xl">
              {tooltip}
            </div>
          )}
        </div>
      </div>

      {/* 현재 점수 + 변동 */}
      <div className="flex items-baseline justify-between gap-1">
        <div className="min-w-0">
          <span className="text-[14px] font-bold text-white/90 tabular-nums">
            {combinedScore != null ? combinedScore.toLocaleString() : '—'}
          </span>
          <span className="text-[10px] text-white/30 ml-0.5">포인트</span>
        </div>
        {delta != null ? (
          <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color }}>
            {formatDelta(delta)}
          </span>
        ) : (
          <span className="text-[11px] text-white/20 shrink-0">—</span>
        )}
      </div>

      <div className="h-10">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>
    </div>
  );
}
