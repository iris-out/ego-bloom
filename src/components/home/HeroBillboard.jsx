import React from 'react';
import { ChevronRight } from 'lucide-react';
import { proxyImageUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

/**
 * 메인 상단 시네마틱 빌보드 — 종합 1위 제작자.
 * props: { billboard, tier, onClick }
 */
export default function HeroBillboard({ billboard, tier, onClick }) {
  if (!billboard) return null;
  const accent = billboard.accent || '#a78bfa';
  const bg = billboard.topPlot?.imageUrl ? proxyImageUrl(billboard.topPlot.imageUrl) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/10 text-left shadow-[0_10px_40px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-white/40"
      style={{ aspectRatio: '16 / 4.2', minHeight: 132 }}
    >
      {/* 배경 이미지 */}
      {bg ? (
        <img
          src={bg}
          alt=""
          loading="eager"
          fetchpriority="high"
          className="absolute inset-0 w-full h-full object-cover scale-105 transition-transform duration-700 group-hover:scale-110 motion-reduce:transform-none"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(110deg, ${accent}, #2a1a40)` }} />
      )}

      {/* 좌→우 그라디언트 스크림 (텍스트 가독성) */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #07060e 8%, rgba(7,6,14,0.7) 38%, transparent 75%)' }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, #07060e, transparent)' }} />

      {/* 내용 */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-7 max-w-[680px]">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] font-extrabold tracking-[0.08em]" style={{ color: accent }}>
          <span aria-hidden="true">{billboard.emoji}</span>
          <span>지금, {billboard.tagLabel}의 정점</span>
        </div>
        <div className="mt-1.5 text-[26px] sm:text-[40px] font-black text-white leading-[1.05] tracking-[-0.02em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
          {billboard.nickname}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-white/75">
          <span>
            <b className="text-white tabular-nums">{formatNumber(billboard.score)}</b> 누적 대화
          </span>
          {tier?.tierName && <span className="text-white/40">·</span>}
          {tier?.tierName && <span className="text-white/85">{tier.tierName}</span>}
          {billboard.topPlot?.name && <span className="text-white/40">·</span>}
          {billboard.topPlot?.name && <span className="truncate max-w-[260px]">대표작 «{billboard.topPlot.name}»</span>}
        </div>
        <div className="mt-3.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-3.5 py-1.5 text-[12px] sm:text-[13px] font-bold text-black transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
            프로필 보기 <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </button>
  );
}
