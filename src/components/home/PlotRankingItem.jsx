import React from 'react';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';
import { ArrowUp, ArrowDown } from '@phosphor-icons/react';

const GENRE_TAGS = new Set(['로맨스','판타지','무협','sf','스릴러','공포','현대','게임','스포츠','일상','학원','이세계','전생','회귀','빙의','시스템','성좌','대체역사','밀리터리','추리','착각','아포칼립스','디스토피아','사이버펑크','스팀펑크','로판','무가','하렘','역하렘','피카레스크','군상극','먼치킨','착각계','전문직','인방','재벌','연예계','요리','음악','미술']);
const ORIENTATION_TAGS = new Set(['hl','bl','gl','백합','비엘','언리밋']);
const DYNAMIC_TAGS = new Set(['순애','빼앗김','뺏김','불륜','배신','바람','ntr']);

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

const CYAN_COLORS = ['#22d3ee', '#5eead4', '#67e8f9', '#a5f3fc', '#cffafe', '#d9f9f9', '#e8fbfb'];

function splitFormatted(str) {
  const match = str.match(/^(-?[0-9,.]+)([만천억]?)$/);
  if (match) return { num: match[1], unit: match[2] };
  return { num: str, unit: '' };
}

function getCyanColor(delta, maxDelta) {
  if (!maxDelta || delta == null || delta <= 0) return '#e8fbfb';
  const ratio = delta / maxDelta;
  if (ratio >= 0.85) return CYAN_COLORS[0];
  if (ratio >= 0.70) return CYAN_COLORS[1];
  if (ratio >= 0.55) return CYAN_COLORS[2];
  if (ratio >= 0.40) return CYAN_COLORS[3];
  if (ratio >= 0.25) return CYAN_COLORS[4];
  if (ratio >= 0.10) return CYAN_COLORS[5];
  return CYAN_COLORS[6];
}

function pctStr(delta, current) {
  if (delta == null || !current || delta <= 0) return null;
  const base = current - delta;
  if (base <= 0) return null;
  return ((delta / base) * 100).toFixed(1) + '%';
}

export default function PlotRankingItem({ plot, rank, maxDelta }) {
  const { id, name, imageUrl, hashtags = [], interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const color = getCyanColor(interactionDelta, maxDelta);
  const pct = pctStr(interactionDelta, interactionCount);
  const tags = prioritizeTags(hashtags);
  const zetaUrl = id ? `https://zeta-ai.io/ko/plots/${id}/profile` : null;

  const medalBg =
    rank === 1 ? 'bg-yellow-400/[0.05]' :
    rank === 2 ? 'bg-slate-300/[0.04]' :
    rank === 3 ? 'bg-amber-600/[0.05]' :
    '';

  return (
    <a
      href={zetaUrl || undefined}
      target={zetaUrl ? '_blank' : undefined}
      rel={zetaUrl ? 'noopener noreferrer' : undefined}
      className={`block py-3 pr-3 sm:pr-0 rounded transition-colors cursor-pointer no-underline hover:bg-white/[0.04] ${medalBg}`}
      style={{
        borderLeft: maxDelta > 0 && interactionDelta > 0
          ? `2px solid rgba(74,222,128,${Math.max(0.12, Math.min(0.85, interactionDelta / maxDelta))})`
          : '2px solid transparent',
        paddingLeft: '10px',
      }}
    >
      {/* Row 1: 순위 + 이미지 + 이름/핸들 (항상 표시) */}
      <div className="flex items-center gap-2.5 lg:gap-2">
        <span className={`text-[15px] font-bold text-center tabular-nums w-5 shrink-0 ${
          rank === 1 ? 'text-yellow-400' : rank <= 3 ? 'text-white/70' : 'text-white/30'
        }`}>
          {rank}
        </span>

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
            {rankChange === null ? (
              <span className="shrink-0 text-[10px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30" style={{ fontFamily: 'var(--font-mono)' }}>NEW</span>
            ) : rankChange > 0 ? (
              <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-bold" style={{ color: 'var(--c-up)' }}>
                <ArrowUp size={10} weight="bold" />{rankChange}
              </span>
            ) : rankChange < 0 ? (
              <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-bold" style={{ color: 'var(--c-down)' }}>
                <ArrowDown size={10} weight="bold" />{Math.abs(rankChange)}
              </span>
            ) : null}
          </div>
          {creatorHandle && (
            <p className="text-[13px] text-white/35 truncate">@{creatorHandle}</p>
          )}
        </div>

        {/* 데스크탑(sm+) 전용: 태그 열 */}
        <div className="hidden sm:flex gap-1 shrink-0 w-[188px] overflow-hidden items-center justify-end">
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
        <div className="hidden sm:block text-right shrink-0 w-[88px]">
          {(() => { const { num, unit } = splitFormatted(formatNumber(interactionCount)); return (
            <span className="tabular-nums" style={{ letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
              <span className="text-[20px] font-bold" style={{ color: '#fff' }}>{num}</span>
              {unit && <span className="text-[13px] font-semibold text-white/50 ml-[1px]">{unit}</span>}
            </span>
          ); })()}
        </div>

        {/* 데스크탑(sm+) 전용: 상승량+상승률 열 */}
        <div className="hidden sm:flex flex-col items-end justify-center shrink-0 w-[80px] pr-2">
          {interactionDelta != null && interactionDelta > 0 ? (
            <>
              {pct && (
                <span className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--c-up)', fontFamily: 'var(--font-mono)' }}>
                  +{pct}
                </span>
              )}
              <span className="text-[13px] tabular-nums leading-tight" style={{ color, fontFamily: 'var(--font-mono)' }}>
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
            <span className="tabular-nums" style={{ letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
              <span className="text-[22px] font-bold" style={{ color: '#fff' }}>{num}</span>
              {unit && <span className="text-[13px] font-semibold text-white/50 ml-[1px]">{unit}</span>}
            </span>
          ); })()}
        </div>
      </div>

      {/* Row 2: 모바일(< sm) 전용 — 태그(좌) + 상승률·상승량(우) */}
      <div className="sm:hidden flex items-center gap-1.5 mt-1 pl-20">
        {tags.slice(0, 2).map((t, i) => (
          <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/50 truncate max-w-[80px]">
            {t}
          </span>
        ))}
        {interactionDelta != null && interactionDelta > 0 && (
          <div className="ml-auto flex items-baseline gap-1.5 shrink-0">
            {pct && (
              <span className="text-[12px] font-bold tabular-nums" style={{ color: '#34d399' }}>
                +{pct}
              </span>
            )}
            <span className="text-[11px] tabular-nums" style={{ color }}>
              +{formatNumber(interactionDelta)}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}
