/**
 * 필 형태 세그먼트 컨트롤이다. 탭, 정렬, 카테고리 선택 등에 두루 쓴다.
 * @param {object} props
 * @param {{ value: string, label: string }[]} props.options
 * @param {string} props.value 현재 선택값.
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.className]
 * @param {string} [props['aria-label']]
 */
export default function Segmented({ options, value, onChange, className = '', ...rest }) {
  return (
    <div className={`eb-seg ${className}`} role="tablist" {...rest}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
