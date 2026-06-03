import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber, getCreatorTier, formatEloScore } from '../../utils/tierCalculator';
import TierIcon from '../ui/TierIcon';

const PAGE_SIZE = 20;
const TOTAL_PAGES = 5;

const TIER_KO = {
  Unranked: '언랭',
  Bronze: '브론즈',
  Silver: '실버',
  Gold: '골드',
  Platinum: '플래티넘',
  Diamond: '다이아몬드',
  Master: '마스터',
  Champion: '챔피언',
};

// Top 1~3 스트라이프 + rank-box + 시상대 색상 (gold / silver / bronze)
const STRIPE_COLORS = ['#e9c46a', '#c9c6c0', '#c08457'];
const PODIUM_CROWNS = ['👑', '🥈', '🥉'];
const PODIUM_LABELS = ['1위', '2위', '3위'];
const RANK_BOX_FONT = "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif";

function splitFormatted(str) {
  const match = str.match(/^(-?[0-9,.]+)([만천억]?)$/);
  if (match) return { num: match[1], unit: match[2] };
  return { num: str, unit: '' };
}

// Pass `count` for unit-formatted stats (대화/팔로워 → 만/억) or `value` for a
// raw integer (ELO). `whitespace-nowrap` keeps the number+unit+label together so
// labels like "팔로워" never split across lines in tight columns.
function StatVal({ count, text, label, numSize = '17px', labelSize = '11px', numColor = 'rgba(255,255,255,0.92)' }) {
  const { num, unit } = text != null
    ? { num: text, unit: '' }
    : splitFormatted(formatNumber(count ?? 0));
  return (
    <span className="tabular-nums whitespace-nowrap" style={{ letterSpacing: '-0.02em' }}>
      <span style={{ fontSize: numSize, fontWeight: 800, color: numColor }}>{num}</span>
      {unit && <span style={{ fontSize: labelSize, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: '1px' }}>{unit}</span>}
      <span style={{ fontSize: labelSize, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: '3px' }}>{label}</span>
    </span>
  );
}

// 시상대 전용: 라벨(좌) · 값(우) 한 줄. whitespace-nowrap 으로 절대 줄바꿈 안 됨.
function PodiumStatRow({ label, count, text, valueColor }) {
  const { num, unit } = text != null
    ? { num: text, unit: '' }
    : splitFormatted(formatNumber(count ?? 0));
  return (
    <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
      <span className="text-[10px] font-medium text-white/40">{label}</span>
      <span className="tabular-nums" style={{ letterSpacing: '-0.02em' }}>
        <span style={{ fontSize: '15px', fontWeight: 800, color: valueColor || 'rgba(255,255,255,0.95)' }}>{num}</span>
        {unit && <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: '1px' }}>{unit}</span>}
      </span>
    </div>
  );
}

function getTierKey(tierName = '') {
  const t = tierName.toUpperCase();
  if (t.startsWith('CHAMPION')) return 'champion';
  if (t.startsWith('MASTER'))   return 'master';
  if (t.startsWith('DIAMOND'))  return 'diamond';
  if (t.startsWith('PLATINUM')) return 'platinum';
  if (t.startsWith('GOLD'))     return 'gold';
  if (t.startsWith('SILVER'))   return 'silver';
  if (t.startsWith('BRONZE'))   return 'bronze';
  return 'unranked';
}

// 티어 메타데이터 (라벨 + 색상) 계산: 리스트/시상대 공용
function deriveTierMeta(creator, globalRank) {
  const tierKey = getTierKey(creator.tier_name);
  const tierData = getCreatorTier(creator.elo_score ?? 0);
  const tierKoName = TIER_KO[tierData.name] ?? tierData.name;
  const isTop10 = globalRank < 10;
  const isTop3 = globalRank < 3;
  const tierLabel = isTop10
    ? `${globalRank + 1}위`
    : `${tierKoName}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`;
  const tierColor = isTop10
    ? (isTop3 ? STRIPE_COLORS[globalRank] : 'rgba(255,255,255,0.7)')
    : tierData.color;
  const fullTierLabel = `${tierKoName}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`;
  return { tierKey, tierData, tierKoName, tierLabel, tierColor, fullTierLabel };
}

function Avatar({ creator, size, className = '', style }) {
  const imageUrl = creator.profile_image_url;
  return (
    <div
      className={`rounded-full overflow-hidden bg-white/10 ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      {imageUrl ? (
        <img
          src={proxyThumbnailUrl(imageUrl, Math.max(64, size))}
          alt={creator.nickname}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white/30"
          style={{ fontSize: Math.round(size * 0.32) }}
        >
          {(creator.nickname || '?')[0]}
        </div>
      )}
    </div>
  );
}

// ── 시상대 히어로 카드 (top 1~3) ─────────────────────────────
function PodiumCard({ creator, rank, onClick, className = '' }) {
  const color = STRIPE_COLORS[rank];
  const meta = deriveTierMeta(creator, rank);
  const isFirst = rank === 0;
  const avatarSize = isFirst ? 96 : 80;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`podium-card group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.07] to-white/[0.02] transition-transform will-change-transform ${
        creator.handle ? 'cursor-pointer' : 'cursor-default'
      } p-3 sm:items-center sm:text-center ${isFirst ? 'sm:px-5 sm:pt-8 sm:pb-6 sm:-mt-3' : 'sm:px-4 sm:pt-7 sm:pb-5'} ${className}`}
      style={{
        borderColor: `${color}66`,
        boxShadow: `0 18px 50px -22px ${color}99, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* 상단 시네마틱 글로우 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-32 w-40 -translate-x-1/2 rounded-full blur-3xl opacity-40"
        style={{ background: color }}
      />

      {/* ── 모바일: 가로 컴팩트 행 (아바타 · 이름/티어 · 스탯) ── */}
      <div className="flex w-full items-center gap-3 text-left sm:hidden">
        <div className="relative shrink-0">
          <Avatar
            creator={creator}
            size={58}
            style={{ border: `2.5px solid ${color}`, boxShadow: `0 0 0 3px ${color}22` }}
          />
          <span
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-bold leading-none text-black"
            style={{ background: color }}
          >
            {PODIUM_LABELS[rank]}
          </span>
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 mt-0.5 text-[13px] leading-none drop-shadow" aria-hidden="true">
              {PODIUM_CROWNS[rank]}
            </span>
            <p className="text-[15px] font-bold text-white leading-tight line-clamp-2" style={{ letterSpacing: '-0.02em' }}>
              {creator.nickname}
            </p>
          </div>
          <p className="text-[11px] text-white/40 mt-0.5 leading-tight">@{creator.handle}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <TierIcon tier={meta.tierKey} rank={rank + 1} size={22} />
            <span className="truncate text-[10px] font-semibold tracking-wider" style={{ color: meta.tierColor }}>
              {meta.fullTierLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-0.5 rounded-lg border border-white/5 bg-black/20 px-2.5 py-1.5">
          <PodiumStatRow label="대화" count={creator.plot_interaction_count} />
          <PodiumStatRow label="팔로워" count={creator.follower_count} />
          {creator.elo_score != null && (
            <PodiumStatRow label="ELO" text={formatEloScore(creator.elo_score)} valueColor={color} />
          )}
        </div>
      </div>

      {/* ── sm+: 기존 세로 시상대 카드 ── */}
      <div className="hidden w-full flex-col items-center sm:flex">
        {/* 왕관 / 순위 배지 */}
        <span
          className="absolute left-1/2 top-2 -translate-x-1/2 text-[15px] leading-none drop-shadow"
          aria-hidden="true"
        >
          {PODIUM_CROWNS[rank]}
        </span>

        {/* 아바타 (티어/순위 컬러 링) */}
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute inset-0 -m-1 rounded-full blur-md opacity-50"
            style={{ background: color }}
          />
          <Avatar
            creator={creator}
            size={avatarSize}
            className="relative self-center"
            style={{ border: `3px solid ${color}`, boxShadow: `0 0 0 4px ${color}22` }}
          />
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none text-black"
            style={{ background: color }}
          >
            {PODIUM_LABELS[rank]}
          </span>
        </div>

        {/* 닉네임 / 핸들 */}
        <p
          className={`mt-4 w-full truncate font-bold text-white ${isFirst ? 'text-[17px]' : 'text-[15px]'}`}
          style={{ letterSpacing: '-0.02em' }}
        >
          {creator.nickname}
        </p>
        <p className="w-full truncate text-[11px] text-white/40">@{creator.handle}</p>

        {/* 티어 */}
        <div className="mt-3 flex flex-col items-center gap-1">
          <TierIcon tier={meta.tierKey} rank={rank + 1} size={isFirst ? 52 : 44} />
          <span className="text-[10px] font-semibold tracking-wider" style={{ color: meta.tierColor }}>
            {meta.fullTierLabel}
          </span>
        </div>

        {/* 헤드라인 스탯 — 세로 정렬(라벨 좌 / 값 우) */}
        <div className="mt-4 flex w-full flex-col gap-1 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
          <PodiumStatRow label="대화" count={creator.plot_interaction_count} />
          <PodiumStatRow label="팔로워" count={creator.follower_count} />
          {creator.elo_score != null && (
            <PodiumStatRow label="ELO" text={formatEloScore(creator.elo_score)} valueColor={color} />
          )}
        </div>
      </div>
    </button>
  );
}

// ── 일반 랭킹 행 (rank 4+ 또는 후속 페이지 전체) ──────────────
function CreatorRow({ creator, globalRank, onClick }) {
  const meta = deriveTierMeta(creator, globalRank);
  const isTop3 = globalRank < 3;
  const stripeColor = isTop3 ? STRIPE_COLORS[globalRank] : null;
  const rankBoxColor = isTop3 ? STRIPE_COLORS[globalRank] : 'rgba(255,255,255,0.35)';
  const tierLabelStyle = { color: meta.tierColor };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative my-1 flex w-full flex-col gap-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 sm:py-2.5 text-left shadow-sm transition-transform will-change-transform hover:-translate-y-px hover:bg-white/[0.06] sm:flex-row sm:items-stretch sm:gap-3 sm:pr-2 ${
        creator.handle ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* 좌측 컬러 스트라이프 (top 1~3) */}
      {stripeColor && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r"
          style={{ background: stripeColor, boxShadow: `0 0 10px ${stripeColor}` }}
        />
      )}

      {/* Row 1 (항상): rank-box + 아바타 + 닉네임/핸들 + (모바일)티어 */}
      <div className="flex w-full items-stretch gap-3">
        <div
          className="flex shrink-0 items-center justify-center border-r border-white/[0.06]"
          style={{
            width: '60px',
            fontFamily: RANK_BOX_FONT,
            fontSize: '22px',
            fontWeight: 700,
            color: rankBoxColor,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {globalRank + 1}
        </div>

        <Avatar
          creator={creator}
          size={44}
          className="shrink-0 self-center"
          style={isTop3 ? { border: `2px solid ${stripeColor}` } : { border: '2px solid rgba(255,255,255,0.08)' }}
        />

        <div className="min-w-0 flex-1 py-0.5 self-center">
          <p className="text-[14px] font-medium leading-tight text-white line-clamp-2">{creator.nickname}</p>
          <p className="text-[11px] text-white/35 mt-0.5 leading-tight">@{creator.handle}</p>
        </div>

        {/* 티어 아이콘 + 라벨: 모바일에서는 Row 1 끝 */}
        <div className="flex shrink-0 flex-col items-center gap-0.5 self-center sm:hidden">
          <TierIcon tier={meta.tierKey} rank={globalRank + 1} size={30} />
          <span className="text-[9px] font-semibold tracking-wider" style={tierLabelStyle}>
            {meta.tierLabel}
          </span>
        </div>
      </div>

      {/* 모바일 전용: 스탯 (대화 · 팔로워 · ELO) */}
      <div className="mt-1.5 pl-[120px] sm:hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatVal count={creator.plot_interaction_count} label="대화" numSize="18px" />
          <StatVal count={creator.follower_count} label="팔로워" numSize="18px" />
          {creator.elo_score != null && (
            <StatVal text={formatEloScore(creator.elo_score)} label="ELO" numSize="18px" numColor={meta.tierColor} />
          )}
        </div>
      </div>

      {/* 데스크탑(sm+) 전용: 우측 스탯 블록 */}
      <div className="ml-auto hidden shrink-0 items-center gap-4 sm:flex">
        <div className="flex items-center gap-2.5">
          <StatVal count={creator.plot_interaction_count} label="대화" numSize="20px" />
          <span className="text-[12px] text-white/20">·</span>
          <StatVal count={creator.follower_count} label="팔로워" numSize="20px" />
          <span className="text-[12px] text-white/20">·</span>
          <StatVal text={formatEloScore(creator.elo_score)} label="ELO" numSize="20px" numColor={meta.tierColor} />
        </div>
        <div className="flex w-[64px] flex-col items-center justify-center gap-0.5" style={{ marginRight: '6px' }}>
          <TierIcon tier={meta.tierKey} rank={globalRank + 1} size={40} />
          <p className="w-full text-center text-[10px] font-semibold leading-none" style={tierLabelStyle}>
            {meta.tierLabel}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function CreatorRankingList() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch('/api/get-rankings')
      .then(r => r.json())
      .then(data => setCreators(data.rankings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const goToProfile = (handle) => {
    if (handle) navigate(`/profile?creator=${encodeURIComponent(handle)}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-0 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
            {/* Row 1 스켈레톤 */}
            <div className="flex w-full items-center gap-3">
              <div className="h-6 w-16 shrink-0 animate-pulse rounded bg-white/10" />
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-white/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/10 sm:hidden" />
            </div>
            {/* Row 2 스켈레톤 (모바일) */}
            <div className="mt-1.5 flex items-center gap-3 pl-[120px] sm:hidden">
              <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-12 animate-pulse rounded bg-white/5" />
            </div>
            {/* 데스크탑 스켈레톤 */}
            <div className="hidden w-20 shrink-0 space-y-1.5 sm:block">
              <div className="h-4 animate-pulse rounded bg-white/10" />
              <div className="h-3 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const pageCreators = creators.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const globalOffset = page * PAGE_SIZE;
  const showPodium = page === 0 && pageCreators.length >= 3;

  // 페이지 0: 상위 3명은 시상대로, 나머지는 리스트(rank 4+)
  const podiumCreators = showPodium ? pageCreators.slice(0, 3) : [];
  const listCreators = showPodium ? pageCreators.slice(3) : pageCreators;
  const listStartRank = showPodium ? globalOffset + 3 : globalOffset;

  return (
    <div className="flex flex-col gap-4">
      {/* prefers-reduced-motion 존중 + 카드 hover lift */}
      <style>{`
        .podium-card:hover { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce) {
          .podium-card, .podium-card:hover { transform: none !important; }
        }
      `}</style>

      {/* 페이지네이션 */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: TOTAL_PAGES }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPage(i)}
            className={`h-9 w-9 rounded-md text-[14px] font-medium transition-colors sm:h-7 sm:w-7 sm:text-[12px] ${
              page === i
                ? 'bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/40'
                : 'text-white/40 hover:bg-white/5 hover:text-white/70'
            }`}
          >
            {i + 1}
          </button>
        ))}
        <span className="ml-2 self-center text-[11px] text-white/25">
          {globalOffset + 1}–{Math.min(globalOffset + PAGE_SIZE, creators.length)}위
        </span>
      </div>

      {/* 시상대 (페이지 0에서만) — 모바일: 세로 1·2·3위 / sm+: 시상대 3열(2·1·3) */}
      {showPodium && (
        <div className="flex flex-col gap-2.5 px-1 sm:grid sm:grid-cols-3 sm:items-end sm:gap-4">
          {/* 2위 (sm+ 좌 / 모바일 2번째) */}
          <PodiumCard creator={podiumCreators[1]} rank={1} className="order-2 sm:order-none" onClick={() => goToProfile(podiumCreators[1].handle)} />
          {/* 1위 (sm+ 중앙·가장 큼 / 모바일 1번째) */}
          <PodiumCard creator={podiumCreators[0]} rank={0} className="order-1 sm:order-none" onClick={() => goToProfile(podiumCreators[0].handle)} />
          {/* 3위 (sm+ 우 / 모바일 3번째) */}
          <PodiumCard creator={podiumCreators[2]} rank={2} className="order-3 sm:order-none" onClick={() => goToProfile(podiumCreators[2].handle)} />
        </div>
      )}

      {/* 랭킹 리스트 */}
      <div className="flex flex-col">
        {listCreators.map((creator, i) => {
          const globalRank = listStartRank + i;
          return (
            <CreatorRow
              key={creator.id}
              creator={creator}
              globalRank={globalRank}
              onClick={() => goToProfile(creator.handle)}
            />
          );
        })}
      </div>
    </div>
  );
}
