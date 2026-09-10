import { formatNumber } from '../../utils/tierCalculator';

const UNIT_RE = /^([+-]?[\d,]+(?:\.\d+)?)(.*)$/;

/**
 * "2.72억" 같은 포맷 문자열을 숫자부와 단위부로 나눠 각각 다른 스타일로 그린다.
 * 단위는 본문 서체 0.62em, --fg-2, 숫자 앞에 공백 없이 붙는다.
 * @param {object} props
 * @param {number|string} props.value 숫자면 formatNumber 로 포맷한다. 문자열이면 그대로 쓰고 끝의 한글을 단위로 분리한다.
 * @param {string} [props.unit] 단위를 직접 지정한다(자동 분리 대신).
 * @param {'display'|'h1'|'figure'|'body'} [props.size] 숫자부 타입 롤. 기본 figure.
 * @param {string} [props.className]
 */
export default function Num({ value, unit, size = 'figure', className = '' }) {
  const str = typeof value === 'number' ? formatNumber(value) : String(value ?? '');
  let figure = str;
  let unitPart = unit ?? '';
  if (unit == null) {
    const m = str.match(UNIT_RE);
    if (m) {
      figure = m[1];
      unitPart = m[2];
    }
  }

  const sizeClass = { display: 't-display', h1: 't-h1', figure: 't-figure', body: 't-body' }[size] || 't-figure';

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      <span className={sizeClass}>{figure}</span>
      {unitPart && (
        <span style={{ fontSize: '0.62em', fontWeight: 600, color: 'var(--fg-2)', marginLeft: 0 }}>{unitPart}</span>
      )}
    </span>
  );
}
