import React from 'react';
import { formatNumber } from '../../utils/tierCalculator';

/**
 * 1일 전(또는 마지막 스냅샷) 대비 증감을 표시하는 작은 배지.
 * 양수=초록 ▲, 음수=빨강 ▼, 0 또는 값 없음=렌더링 안 함.
 *
 * @param {number|null|undefined} value 증감량 (현재값 - 기준값)
 * @param {string} [className]
 */
export default function DeltaBadge({ value, className = '' }) {
  if (value == null || !Number.isFinite(value) || value === 0) return null;

  const up = value > 0;
  const color = up ? '#34d399' : '#f87171';
  const bg = up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)';
  const arrow = up ? '▲' : '▼';

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1 py-[1px] text-[10px] font-bold tabular-nums align-middle ${className}`}
      style={{ color, background: bg }}
      title={`${up ? '+' : '-'}${formatNumber(Math.abs(value))}`}
    >
      <span style={{ fontSize: '7px', lineHeight: 1 }}>{arrow}</span>
      {formatNumber(Math.abs(value))}
    </span>
  );
}
