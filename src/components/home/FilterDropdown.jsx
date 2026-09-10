import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';

const SORT_BY = ['순위', '상승률', '대화량'];
const DIRECTIONS = ['내림차순', '오름차순'];

/**
 * 정렬 기준/방향을 고르는 토큰 팝오버다. eb-btn-secondary 트리거 + eb-panel 목록.
 * @param {object} props
 * @param {string} props.sortBy
 * @param {string} props.direction
 * @param {(next: { sortBy: string, direction: string }) => void} props.onChange
 */
export default function FilterDropdown({ sortBy, direction, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="eb-btn eb-btn-secondary !h-9 !px-3 !text-[12px] gap-1.5"
      >
        <SlidersHorizontal size={13} />
        <span>{sortBy} {direction === '내림차순' ? '↓' : '↑'}</span>
      </button>

      {open && (
        <div
          className="eb-panel absolute left-0 sm:left-auto sm:right-0 top-10 z-50 w-44 overflow-hidden py-1"
          style={{ boxShadow: 'var(--shadow-overlay)' }}
          role="listbox"
        >
          <div className="t-label px-3 py-1.5" style={{ color: 'var(--fg-3)' }}>정렬 기준</div>
          {SORT_BY.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ sortBy: s, direction })}
              className="t-body w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
              style={{ color: sortBy === s ? 'var(--fg)' : 'var(--fg-2)' }}
              role="option"
              aria-selected={sortBy === s}
            >
              <span>{s}</span>
              {sortBy === s && <Check size={13} style={{ color: 'var(--accent-ink)' }} />}
            </button>
          ))}
          <div className="my-1 h-px" style={{ background: 'var(--line)' }} />
          <div className="t-label px-3 py-1.5" style={{ color: 'var(--fg-3)' }}>방향</div>
          {DIRECTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ sortBy, direction: d })}
              className="t-body w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
              style={{ color: direction === d ? 'var(--fg)' : 'var(--fg-2)' }}
              role="option"
              aria-selected={direction === d}
            >
              <span>{d}</span>
              {direction === d && <Check size={13} style={{ color: 'var(--accent-ink)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
