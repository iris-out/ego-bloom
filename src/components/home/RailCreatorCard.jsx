import React from 'react';
import TierIcon from '../ui/TierIcon';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

// 순위 숫자 색 — 1·2·3위는 골드/실버/브론즈, 그 외는 태그 강조색
const RANK_COLOR = { 1: '#e9c46a', 2: '#c9c6c0', 3: '#c08457' };

function tierKeyFromName(name = '') {
  const t = String(name).toUpperCase();
  if (t.startsWith('CHAMPION')) return 'champion';
  if (t.startsWith('MASTER')) return 'master';
  if (t.startsWith('DIAMOND')) return 'diamond';
  if (t.startsWith('PLATINUM')) return 'platinum';
  if (t.startsWith('GOLD')) return 'gold';
  if (t.startsWith('SILVER')) return 'silver';
  if (t.startsWith('BRONZE')) return 'bronze';
  return null;
}

/**
 * 넷플릭스형 포스터 카드 — 대표 플롯 커버를 배경으로, 좌측에 큼직한 순위 숫자가 겹친다.
 * props: { rank, accent, creator, tier, onClick }
 */
export default function RailCreatorCard({ rank, accent = '#a78bfa', creator, tier, onClick }) {
  const numeralColor = RANK_COLOR[rank] || accent;
  const poster = creator.topPlot?.imageUrl ? proxyThumbnailUrl(creator.topPlot.imageUrl, 320) : null;
  const avatar = creator.imageUrl ? proxyThumbnailUrl(creator.imageUrl, 64) : null;
  const tierKey = tier?.tierName ? tierKeyFromName(tier.tierName) : null;

  return (
    <div className="flex items-end shrink-0 snap-start select-none">
      {/* 순위 숫자 (포스터 좌측 겹침) */}
      <span
        aria-hidden="true"
        className="font-black leading-[0.8] tabular-nums -mr-3 sm:-mr-4 z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        style={{
          fontSize: 'clamp(64px, 8vw, 104px)',
          color: 'transparent',
          WebkitTextStroke: `2px ${numeralColor}`,
          fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif",
        }}
      >
        {rank}
      </span>

      <button
        type="button"
        onClick={onClick}
        title={`${creator.nickname} — ${formatNumber(creator.score)} 대화`}
        className="group relative z-20 w-[124px] h-[176px] sm:w-[148px] sm:h-[208px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] motion-reduce:transform-none focus:outline-none focus:ring-2 focus:ring-white/40"
        style={{ '--accent': accent }}
      >
        {/* 배경: 대표 플롯 커버 */}
        {poster ? (
          <img
            src={poster}
            alt=""
            width={148}
            height={208}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${accent}33, #1a1530)` }} />
        )}

        {/* 하단 스크림 */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
        {/* 상단 강조 라인 */}
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: numeralColor }} />

        {/* 티어 뱃지 */}
        {tierKey && (
          <div className="absolute top-1.5 right-1.5 z-10 rounded-md bg-black/55 backdrop-blur-sm px-1 py-0.5 ring-1 ring-white/15">
            <TierIcon tier={tierKey} size={16} />
          </div>
        )}

        {/* 본문: 아바타 + 닉네임 + 누적 대화수 */}
        <div className="absolute inset-x-0 bottom-0 p-2 text-left">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-white/15 ring-1 ring-white/25 shrink-0">
              {avatar ? (
                <img src={avatar} alt="" width={24} height={24} loading="lazy" className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60">
                  {(creator.nickname || '?')[0]}
                </div>
              )}
            </div>
            <span className="text-[12px] font-bold text-white truncate drop-shadow">{creator.nickname}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-[13px] font-extrabold tabular-nums" style={{ color: numeralColor }}>
              {formatNumber(creator.score)}
            </span>
            <span className="text-[10px] font-medium text-white/55">대화</span>
          </div>
          {creator.topPlot?.name && (
            <div className="text-[10px] text-white/55 truncate mt-0.5">{creator.topPlot.name}</div>
          )}
        </div>
      </button>
    </div>
  );
}
