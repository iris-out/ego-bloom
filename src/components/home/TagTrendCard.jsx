import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReactOfficial from 'highcharts-react-official';
// Vite CJS interop: module.exports 전체가 default로 들어오므로 .default를 명시적으로 참조
const HighchartsReact = HighchartsReactOfficial?.default ?? HighchartsReactOfficial;

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

export default function TagTrendCard({ label, hoverLabel, dataPoints, timeWindow = '6h', maxDelta, combinedScore, scoreDelta, deltaRefHours }) {
  // timeWindow 기준으로 timestamp 필터링
  const windowedPoints = useMemo(() => {
    const pts = dataPoints || [];
    const hours = parseInt(timeWindow, 10) || 4;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const filtered = pts.filter(p => new Date(p.ts).getTime() >= cutoff);
    // 데이터 부족 시 있는 것 중 최근 2개 이상 사용
    return filtered.length >= 1 ? filtered : pts.slice(-2);
  }, [dataPoints, timeWindow]);

  // windowed delta: 슬라이스의 첫 → 마지막 점수 차이
  const windowedDelta = useMemo(() => {
    if (windowedPoints.length < 2) return scoreDelta ?? null;
    return windowedPoints[windowedPoints.length - 1].score - windowedPoints[0].score;
  }, [windowedPoints, scoreDelta]);

  const delta = windowedDelta;
  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;
  const color = isDown ? '#f87171' : getCyanColor(delta, maxDelta);

  // Highcharts 옵션은 windowedPoints·isUp·isDown이 바뀔 때만 재생성
  const chartOptions = useMemo(() => {
    const rawScores = windowedPoints.map(d => d.score);
    const scores = rawScores.length >= 2
      ? rawScores
      : rawScores.length === 1
        ? [rawScores[0], rawScores[0]]
        : [0, 0];
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    const yPad = scoreRange > 0 ? scoreRange * 0.20 : (maxScore > 0 ? maxScore * 0.001 : 1);
    const lineColor = isUp ? '#34d399' : isDown ? '#f87171' : '#818cf8';
    const fillTop = isUp ? 'rgba(52,211,153,0.18)' : isDown ? 'rgba(248,113,113,0.15)' : 'rgba(129,140,248,0.15)';
    return {
      chart: {
        type: 'areaspline',
        width: 68,
        height: 44,
        backgroundColor: 'transparent',
        margin: [2, 2, 2, 2],
        animation: false,
      },
      title: { text: null },
      xAxis: { visible: false, minPadding: 0.05, maxPadding: 0.05 },
      yAxis: {
        visible: false,
        min: Math.max(0, minScore - yPad),
        max: maxScore + yPad,
      },
      legend: { enabled: false },
      tooltip: { enabled: false },
      credits: { enabled: false },
      plotOptions: {
        areaspline: {
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
      series: [{ data: scores }],
    };
  }, [windowedPoints, isUp, isDown]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-none w-[196px] rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 flex flex-row items-center gap-3 shrink-0">
      {/* 차트 — 좌측 */}
      <div className="shrink-0">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>

      {/* 텍스트 — 우측 */}
      <div className="flex flex-col min-w-0 flex-1">
        {/* 라벨 */}
        <div className="relative group/label">
          <span className="text-[11px] text-white/45 truncate block">{label}</span>
          {hoverLabel && (
            <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 hidden group-hover/label:block whitespace-nowrap rounded-md bg-[#1e1b4b] border border-indigo-500/30 px-2 py-1 text-[11px] text-white/70 shadow-lg">
              {hoverLabel}
            </div>
          )}
        </div>

        {/* 점수 */}
        <span className="text-[15px] font-bold text-white/90 tabular-nums leading-tight">
          {combinedScore != null ? combinedScore.toLocaleString() : '—'}
        </span>

        {/* 변동 + 기준 시각 */}
        {delta != null && delta !== 0 ? (
          <span className="text-[12px] font-semibold tabular-nums leading-tight" style={{ color }}>
            {formatDelta(delta)}
            <span className="text-[9px] font-normal text-white/25 ml-1">({timeWindow})</span>
          </span>
        ) : (
          <span className="text-[11px] text-white/20">—</span>
        )}
      </div>
    </div>
  );
}
