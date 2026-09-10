/**
 * 한 줄짜리 sparkline 이다. polyline 하나, non-scaling-stroke, 채움 없음.
 * @param {object} props
 * @param {number[]} props.values 최소 2개.
 * @param {number} [props.width]
 * @param {number} [props.height]
 * @param {string} [props.className]
 */
export default function Sparkline({ values = [], width = 120, height = 36, className = '' }) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
