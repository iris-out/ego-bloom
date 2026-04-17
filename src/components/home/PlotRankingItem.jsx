import React from 'react';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

const GENRE_TAGS = new Set(['로맨스','판타지','무협','sf','스릴러','공포','현대','게임','스포츠','일상','학원','이세계','전생','회귀','빙의','시스템','성좌','대체역사','밀리터리','추리','착각','아포칼립스','디스토피아','사이버펑크','스팀펑크','로판','무가','하렘','역하렘','피카레스크','군상극','먼치킨','착각계','전문직','인방','재벌','연예계','요리','음악','미술']);
const ORIENTATION_TAGS = new Set(['hl','bl','gl','백합','비엘','언리밋']);
const DYNAMIC_TAGS = new Set(['순애','빼앗김','뺏김','불륜','배신','바람','ntr']);

// Top 1~3 스트라이프 + rank-box 색상
const STRIPE_COLORS = ['#e9c46a', '#c9c6c0', '#c08457'];
const RANK_BOX_FONT = "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif";
const RANK_BOX_BORDER = '1px solid rgba(255,255,255,0.06)';

function prioritizeTags(hashtags) {
  if (!hashtags || hashtags.length === 0) return [];
  let genre = null, orientation = null, dynamic = null;
  const rest = [];
  for (const tag of hashtags) {
    if (!tag) continue;
    const lower = tag.toLowerCase();
    if (!genre && GENRE_TAGS.has(lower)) { genre = tag; continue; }
    if (!orientation && ORIENTATION_TAGS.has(lower)) { orientation = tag; continue; }
    if (!dynamic && DYNAMIC_TAGS.has(lower)) { dynamic = tag; continue; }
    rest.push(tag);
  }
  return [genre, orientation, dynamic, ...rest].filter(Boolean).slice(0, 3);
}

function splitFormatted(str) {
  const match = str.match(/^(-?[0-9,.]+)([만천억]?)$/);
  if (match) return { num: match[1], unit: match[2] };
  return { num: str, unit: '' };
}

function pctStr(delta, current) {
  if (delta == null || !current || delta <= 0) return null;
  const base = current - delta;
  if (base <= 0) return null;
  return ((delta / base) * 100).toFixed(1) + '%';
}

export default function PlotRankingItem({ plot, rank }) {
  const { id, name, imageUrl, hashtags = [], interactionCount = 0, interactionDelta, creatorHandle } = plot;
  const pct = pctStr(interactionDelta, interactionCount);
  const tags = prioritizeTags(hashtags);
  const zetaUrl = id ? `https://zeta-ai.io/ko/plots/${id}/profile` : null;

  const stripeColor = rank <= 3 ? STRIPE_COLORS[rank - 1] : null;
  const rankBoxColor = rank <= 3 ? STRIPE_COLORS[rank - 1] : 'rgba(255,255,255,0.35)';

  return (
    <a
      href={zetaUrl || undefined}
      target={zetaUrl ? '_blank' : undefined}
      rel={zetaUrl ? 'noopener noreferrer' : undefined}
      className="relative block py-3 pr-3 sm:pr-0 rounded transition-colors cursor-pointer no-underline hover:bg-white/[0.04]"
    >
      {/* 좌측 3px 컬러 스트라이프 (top 1~3) */}
      {stripeColor && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            bottom: 4,
            width: '3px',
            background: stripeColor,
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Row 1: rank-box + 이미지 + 이름/핸들 (항상 표시) */}
      <div className="flex items-center gap-2.5 lg:gap-2">
        {/* rank-box 64px */}
        <div
          className="shrink-0 flex items-center justify-center self-stretch"
          style={{
            width: '64px',
            borderRight: RANK_BOX_BORDER,
            fontFamily: RANK_BOX_FONT,
            fontSize: '22px',
            fontWeight: 700,
            color: rankBoxColor,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {rank}
        </div>

        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white/10">
          {imageUrl ? (
            <img
              src={proxyThumbnailUrl(imageUrl, 64)}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-white/30">
              {(name || '?')[0]}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[16px] sm:text-[15px] font-semibold sm:font-medium text-white truncate min-w-0 leading-tight">{name}</p>
          </div>
          {creatorHandle && (
            <p className="text-[13px] text-white/35 truncate">@{creatorHandle}</p>
          )}
        </div>

        {/* 데스크탑(sm+) 전용: 태그 열 */}
        <div className="hidden sm:flex gap-1 shrink-0 overflow-hidden items-center justify-end" style={{ width: '188px' }}>
          {tags.map((t, i) => (
            <span
              key={i}
              className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/50 whitespace-nowrap overflow-hidden text-ellipsis shrink"
              style={{ maxWidth: '72px', minWidth: '24px' }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* 데스크탑(sm+) 전용: 대화량 열 */}
        <div className="hidden sm:block text-right shrink-0" style={{ width: '80px' }}>
          {(() => { const { num, unit } = splitFormatted(formatNumber(interactionCount)); return (
            <span className="tabular-nums" style={{ letterSpacing: '-0.03em', fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif" }}>
              <span className="text-[20px] font-bold" style={{ color: '#fff' }}>{num}</span>
              {unit && <span className="text-[13px] font-semibold text-white/50 ml-[1px]">{unit}</span>}
            </span>
          ); })()}
        </div>

        {/* 데스크탑(sm+) 전용: 2시간 상승량+상승률 열 */}
        <div className="hidden sm:flex flex-col items-end justify-center shrink-0 pr-2" style={{ width: '80px' }}>
          {interactionDelta != null && interactionDelta > 0 ? (
            <>
              {pct && (
                <span
                  className="text-[15px] font-bold tabular-nums"
                  style={{ color: 'var(--c-up)', fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif" }}
                >
                  +{pct}
                </span>
              )}
              <span
                className="text-[13px] tabular-nums leading-tight"
                style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif" }}
              >
                +{formatNumber(interactionDelta)}
              </span>
            </>
          ) : (
            <span className="text-[13px]" style={{ color: 'var(--c-neutral)' }}>—</span>
          )}
        </div>

        {/* 모바일 전용: 대화량 (Row 1 우측, 크게) */}
        <div className="sm:hidden shrink-0 ml-auto text-right">
          {(() => { const { num, unit } = splitFormatted(formatNumber(interactionCount)); return (
            <span className="tabular-nums" style={{ letterSpacing: '-0.03em', fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif" }}>
              <span className="text-[22px] font-bold" style={{ color: '#fff' }}>{num}</span>
              {unit && <span className="text-[13px] font-semibold text-white/50 ml-[1px]">{unit}</span>}
            </span>
          ); })()}
        </div>
      </div>

      {/* Row 2: 모바일(< sm) 전용 — 태그(좌) + 상승률·상승량(우) */}
      <div className="sm:hidden flex items-center gap-1.5 mt-1" style={{ paddingLeft: '108px' }}>
        {tags.slice(0, 2).map((t, i) => (
          <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/50 truncate max-w-[80px]">
            {t}
          </span>
        ))}
        {interactionDelta != null && interactionDelta > 0 && (
          <div className="ml-auto flex items-baseline gap-1.5 shrink-0">
            {pct && (
              <span
                className="text-[12px] font-bold tabular-nums"
                style={{ color: '#34d399', fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif" }}
              >
                +{pct}
              </span>
            )}
            <span
              className="text-[11px] tabular-nums"
              style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif" }}
            >
              +{formatNumber(interactionDelta)}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}
