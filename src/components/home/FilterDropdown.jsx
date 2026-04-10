import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';

const SORT_BY = ['순위', '상승률', '대화량'];
const DIRECTIONS = ['내림차순', '오름차순'];

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
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors ${
          open
            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
        }`}
      >
        <SlidersHorizontal size={11} />
        <span>{sortBy} {direction === '내림차순' ? '↓' : '↑'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 rounded-xl bg-[#12102a] border border-white/10 shadow-2xl py-1 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-widest">정렬 기준</div>
          {SORT_BY.map(s => (
            <button
              key={s}
              onClick={() => onChange({ sortBy: s, direction })}
              className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            >
              <span>{s}</span>
              {sortBy === s && <Check size={12} className="text-indigo-400" />}
            </button>
          ))}
          <div className="h-px bg-white/5 my-1" />
          <div className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-widest">방향</div>
          {DIRECTIONS.map(d => (
            <button
              key={d}
              onClick={() => onChange({ sortBy, direction: d })}
              className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            >
              <span>{d}</span>
              {direction === d && <Check size={12} className="text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
