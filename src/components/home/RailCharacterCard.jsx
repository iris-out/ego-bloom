import React from 'react';
import { proxyThumbnailUrl, getPlotImageUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';
import { characterZetaUrl } from '../../utils/tagCharacters';

// 순위 숫자 색 — 1·2·3위는 골드/실버/브론즈, 그 외는 타이틀 강조색
const RANK_COLOR = { 1: '#e9c46a', 2: '#c9c6c0', 3: '#c08457' };
const NUM_FONT = "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif";

/**
 * 넷플릭스형 캐릭터 포스터 카드 — 캐릭터 커버를 배경으로, 좌측에 큼직한 순위 숫자가 겹친다.
 * 카드 전체가 제타 캐릭터 페이지로 향하는 외부 링크(새 탭).
 * props: { rank, accent, character }
 */
export default function RailCharacterCard({ rank, accent = '#a78bfa', character }) {
  const numeralColor = RANK_COLOR[rank] || accent;
  const href = characterZetaUrl(character.id);
  const cover = getPlotImageUrl(character) || character.imageUrl;
  const poster = cover ? proxyThumbnailUrl(cover, 360) : null;
  const avatar = character.creatorImageUrl ? proxyThumbnailUrl(character.creatorImageUrl, 48) : null;
  const topTags = (character.hashtags || []).slice(0, 2);

  return (
    <div className="flex items-end shrink-0 snap-start select-none">
      {/* 순위 숫자 (포스터 좌측 겹침) */}
      <span
        aria-hidden="true"
        className="font-black leading-[0.8] -mr-3 sm:-mr-4 z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        style={{
          fontSize: 'clamp(58px, 7vw, 92px)',
          letterSpacing: rank >= 10 ? '-0.12em' : '-0.03em',
          color: 'transparent',
          WebkitTextStroke: `2.5px ${numeralColor}`,
          fontFamily: NUM_FONT,
        }}
      >
        {rank}
      </span>

      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={`${character.name} — ${formatNumber(character.interactionCount)} 대화 · 제타에서 열기`}
        className="group relative z-20 w-[124px] h-[176px] sm:w-[148px] sm:h-[208px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] motion-reduce:transform-none focus:outline-none focus:ring-2 focus:ring-white/40"
        style={{ '--accent': accent }}
      >
        {/* 배경: 캐릭터 커버 */}
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

        {/* 상단 태그 칩 (1개) */}
        {topTags[0] && (
          <div className="absolute top-1.5 right-1.5 z-10 rounded-md bg-black/55 backdrop-blur-sm px-1.5 py-0.5 ring-1 ring-white/15">
            <span className="text-[9px] font-bold tracking-tight" style={{ color: accent }}>#{topTags[0]}</span>
          </div>
        )}

        {/* 본문: 캐릭터명 + 누적 대화수 + 제작자 크레딧 */}
        <div className="absolute inset-x-0 bottom-0 p-2 text-left">
          <div className="text-[13px] font-bold text-white truncate drop-shadow leading-tight">{character.name}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[13px] font-extrabold tabular-nums" style={{ color: numeralColor }}>
              {formatNumber(character.interactionCount)}
            </span>
            <span className="text-[10px] font-medium text-white/55">대화</span>
          </div>
          {/* 제작자 크레딧 — 비클릭 라벨 */}
          {character.creatorNickname && (
            <div className="mt-1 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full overflow-hidden bg-white/15 ring-1 ring-white/20 shrink-0">
                {avatar ? (
                  <img src={avatar} alt="" width={16} height={16} loading="lazy" className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-[8px] text-white/60">
                    {(character.creatorNickname || '?')[0]}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold text-white truncate drop-shadow">{character.creatorNickname}</span>
            </div>
          )}
        </div>
      </a>
    </div>
  );
}
