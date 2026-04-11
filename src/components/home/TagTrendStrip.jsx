import React, { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import TagTrendCard from './TagTrendCard';

const CARDS = [
  { key: '순애', label: '순애', tooltip: '순수한 사랑/애정 장르 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
  { key: 'ntr_agg', label: 'NTR·NTL', tooltip: '빼앗김, 뺏김, 불륜, 바람 등 NTR/NTL 계열 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)', ntrAgg: true },
  { key: 'bl', label: 'BL', tooltip: 'Boys Love 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
  { key: 'gl', label: 'GL', tooltip: 'Girls Love (백합) 태그 랭킹 점수 합산 (트렌딩·베스트·신작 순위 반영)' },
];

const NTR_TAGS_AGG = ['빼앗김', '뺏김', '불륜', '바람'];

// tagScores: fetch_ranking.js에서 직접 계산한 현재 랭킹 점수 (combined top30 외 NTR 포함)
// combined: top30 태그 배열 (fallback)
function getCombinedScore(card, tagScores, combined) {
  const fromTagScores = tagScores?.[card.key];
  if (fromTagScores != null) return fromTagScores;
  return combined.find(c => c.tag === card.key)?.score ?? null;
}

export default function TagTrendStrip({ tagTrend = {}, combined = [], tagScores = null, tagScoresDelta = null, tagScoresDeltaRef = null }) {
  const ref = useRef(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

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

  // maxDelta: tagScoresDelta 기반 (신뢰할 수 있는 ranking score 변동)
  const deltas = CARDS.map(card => tagScoresDelta?.[card.key] ?? null);
  const maxDelta = Math.max(0, ...deltas.filter(d => d != null && d > 0));

  return (
    <div className="flex flex-col gap-1.5">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold tracking-widest text-white/30 uppercase">태그 트렌드</span>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="flex items-center gap-1 text-white/25 hover:text-white/55 transition-colors"
          >
            <Info size={11} />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-5 z-50 w-64 rounded-lg bg-[#1e1b4b] border border-indigo-500/30 p-3 text-[11px] leading-relaxed shadow-xl">
              <p className="font-bold text-white/75 mb-2">태그 트렌드 카드</p>
              <div className="flex flex-col gap-2">
                {CARDS.map(card => (
                  <div key={card.key}>
                    <span className="font-semibold text-white/60">{card.label}</span>
                    <span className="text-white/40"> — {card.tooltip}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-white/10">
                <p className="text-white/40">포인트: 트렌딩·베스트·신작 랭킹 상위권 진입 시 부여되는 점수의 합산값</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 카드 스크롤 영역 */}
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
            dataPoints={tagTrend[card.key] || []}
            maxDelta={maxDelta}
            combinedScore={getCombinedScore(card, tagScores, combined)}
            scoreDelta={tagScoresDelta?.[card.key] ?? null}
            deltaRefHours={tagScoresDeltaRef?.[card.key] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
