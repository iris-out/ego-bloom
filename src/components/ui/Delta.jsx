import { formatNumber } from '../../utils/tierCalculator';

/**
 * 증감 pill 이다. 값이 0/null/NaN 이면 아무것도 렌더하지 않는다.
 * 색만으로 신호를 주지 않도록 ▲/▼ 글리프를 항상 함께 그린다.
 * @param {object} props
 * @param {number|null|undefined} props.value 증감량(현재값 - 기준값).
 * @param {(n: number) => string} [props.format] 절대값 표시 포맷터. 기본 formatNumber. ELO 등 다른 스케일에 사용.
 * @param {string} [props.className]
 */
export default function Delta({ value, format = formatNumber, className = '' }) {
  if (value == null || !Number.isFinite(value) || value === 0) return null;

  const up = value > 0;
  const colorVar = up ? '--up' : '--down';
  const glyph = up ? '▲' : '▼';
  const label = format(Math.abs(value));

  return (
    <span
      className={`t-label inline-flex items-center gap-0.5 h-5 px-1.5 tabular-nums ${className}`}
      style={{
        borderRadius: 'var(--radius-pill)',
        background: `color-mix(in srgb, var(${colorVar}) 16%, var(--bg))`,
        color: `var(${colorVar})`,
      }}
      title={`${up ? '+' : '-'}${label}`}
    >
      <span aria-hidden="true" style={{ fontSize: '8px', lineHeight: 1 }}>{glyph}</span>
      {label}
    </span>
  );
}
