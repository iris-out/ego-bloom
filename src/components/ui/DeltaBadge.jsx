import Delta from './Delta';

/**
 * 구 화면 호환용 얇은 래퍼다. 실제 구현은 Delta.jsx 하나뿐이다.
 * @deprecated 새 코드는 Delta 를 직접 쓴다. 화면 마이그레이션 후 제거한다.
 * @param {number|null|undefined} value
 * @param {string} [className]
 * @param {(n: number) => string} [format]
 */
export default function DeltaBadge({ value, className, format }) {
  return <Delta value={value} format={format} className={className} />;
}
