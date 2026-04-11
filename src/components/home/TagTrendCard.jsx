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

export default function TagTrendCard({ label, dataPoints, maxDelta, combinedScore, scoreDelta, deltaRefHours }) {
  // delta, isUp, isDown은 JSX 렌더링에도 사용 → useMemo 밖에 유지
  const delta = scoreDelta ?? null;
  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;
  const color = isDown ? '#f87171' : getCyanColor(delta, maxDelta);

  // Highcharts 옵션은 dataPoints·isUp·isDown이 바뀔 때만 재생성
  const chartOptions = useMemo(() => {
    const rawScores = (dataPoints || []).map(d => d.score);
    // 데이터가 부족해도 평탄한 그래프를 표시 (0점이면 [0,0], 1점이면 [score,score])
    const scores = rawScores.length >= 2
      ? rawScores
      : rawScores.length === 1
        ? [rawScores[0], rawScores[0]]
        : [0, 0];
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    // 변화폭이 없으면 최댓값의 0.1%를 패딩으로 사용, 있으면 범위의 20%
    const yPad = scoreRange > 0 ? scoreRange * 0.20 : (maxScore > 0 ? maxScore * 0.001 : 1);
    const lineColor = isUp ? '#34d399' : isDown ? '#f87171' : '#818cf8';
    const fillTop = isUp ? 'rgba(52,211,153,0.25)' : isDown ? 'rgba(248,113,113,0.20)' : 'rgba(129,140,248,0.20)';
    return {
      chart: {
        type: 'areaspline',
        height: 40,
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
  }, [dataPoints, isUp, isDown]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-none w-[160px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex flex-col gap-1 shrink-0">
      {/* 라벨 */}
      <div className="flex items-center">
        <span className="text-[12px] font-bold text-white/80 truncate">{label}</span>
      </div>

      {/* 현재 점수 + 변동 */}
      <div className="flex items-baseline justify-between gap-1">
        <div className="min-w-0">
          <span className="text-[14px] font-bold text-white/90 tabular-nums">
            {combinedScore != null ? combinedScore.toLocaleString() : '—'}
          </span>
          <span className="text-[10px] text-white/30 ml-0.5">포인트</span>
        </div>
        {delta != null && delta !== 0 ? (
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
              {formatDelta(delta)}
            </span>
            {deltaRefHours != null && (
              <span className="text-[9px] text-white/25 leading-none">{deltaRefHours}시간 전</span>
            )}
          </div>
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
