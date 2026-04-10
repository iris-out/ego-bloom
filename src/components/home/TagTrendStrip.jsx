import React, { useRef } from 'react';
import TagTrendCard from './TagTrendCard';

const CARDS = [
  { key: '순애', label: '순애', tooltip: '순수한 사랑/애정 장르 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
  { key: 'ntr_agg', label: 'NTR·NTL', tooltip: '빼앗김, 뺏김, 불륜, 바람 등 NTR/NTL 계열 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
  { key: 'bl', label: 'BL', tooltip: 'Boys Love 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
  { key: 'gl', label: 'GL', tooltip: 'Girls Love (백합) 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
];

export default function TagTrendStrip({ tagTrend = {} }) {
  const ref = useRef(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = (e) => {
    drag.current = { active: true, startX: e.pageX, scrollLeft: ref.current.scrollLeft };
    ref.current.style.cursor = 'grabbing';
  };
  const onMouseMove = (e) => {
    if (!drag.current.active) return;
    ref.current.scrollLeft = drag.current.scrollLeft - (e.pageX - drag.current.startX);
  };
  const onMouseUp = () => {
    drag.current.active = false;
    if (ref.current) ref.current.style.cursor = '';
  };

  const deltas = CARDS.map(card => {
    const pts = tagTrend[card.key] || [];
    const scores = pts.map(d => d.score);
    const l = scores[scores.length - 1];
    const p = scores[scores.length - 2];
    return l != null && p != null ? l - p : null;
  });
  const maxDelta = Math.max(0, ...deltas.filter(d => d != null));

  return (
    <div
      ref={ref}
      className="flex gap-3 overflow-x-auto pb-1 cursor-grab select-none scrollbar-none"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {CARDS.map((card) => (
        <TagTrendCard
          key={card.key}
          label={card.label}
          tooltip={card.tooltip}
          dataPoints={tagTrend[card.key] || []}
          maxDelta={maxDelta}
        />
      ))}
    </div>
  );
}
