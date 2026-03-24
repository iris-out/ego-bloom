import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const TIER_ABBREV = {
  unranked: '?', bronze: 'B', silver: 'S', gold: 'G',
  platinum: 'P', diamond: 'D', master: 'M', champion: 'C',
};

const TIER_KO = {
  unranked: 'Unranked', bronze: '브론즈', silver: '실버', gold: '골드',
  platinum: '플래티넘', diamond: '다이아몬드', master: '마스터', champion: '챔피언',
};

const TIER_RANK = {
  unranked: 0, bronze: 1, silver: 2, gold: 3,
  platinum: 4, diamond: 5, master: 6, champion: 7,
};

const TIER_COLORS = {
  unranked: { c1: '#7080A0', c2: '#3C4860', c3: '#181E30' },
  bronze:   { c1: '#E89040', c2: '#9C3C0E', c3: '#4C1600' },
  silver:   { c1: '#D8E6F0', c2: '#6888A8', c3: '#304C68' },
  gold:     { c1: '#FFE240', c2: '#CC6E00', c3: '#6A3600' },
  platinum: { c1: '#44EEE6', c2: '#0AA898', c3: '#004C48' },
  diamond:  { c1: '#80D8FF', c2: '#0C64D8', c3: '#022080' },
  master:   { c1: '#E055FF', c2: '#8818CC', c3: '#240050' },
  champion: { c1: '#FF5050', c2: '#BB1818', c3: '#480000' },
};

const TIER_GUIDE = [
  { key: 'champion',  name: '챔피언',    range: '81,000,000 이상',           color: '#F87070' },
  { key: 'master',    name: '마스터',    range: '18,000,000 ~ 80,999,999',   color: '#E055FF' },
  { key: 'diamond',   name: '다이아몬드', range: '4,050,000 ~ 17,999,999',  color: '#80D8FF' },
  { key: 'platinum',  name: '플래티넘',  range: '900,000 ~ 4,049,999',       color: '#44EEE6' },
  { key: 'gold',      name: '골드',      range: '182,250 ~ 899,999',         color: '#FFE240' },
  { key: 'silver',    name: '실버',      range: '40,500 ~ 182,249',          color: '#D8E6F0' },
  { key: 'bronze',    name: '브론즈',    range: '0 ~ 40,499',                color: '#E89040' },
  { key: 'unranked',  name: 'Unranked',  range: 'ELO 0 미만',               color: '#7080A0' },
];

const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

const SIZE_H = { sm: 36, md: 50, lg: 64, xl: 92 };

/** Gem-style SVG tier badge (T5 vertical hexagon from prototype/tier.html) */
function GemSVG({ tierKey, rank, height, uid }) {
  const vw = 46, vh = 62;
  const main = 'M23,1 L45,18 L45,44 L23,61 L1,44 L1,18 Z';
  const inner = 'M23,6 L40,20 L40,42 L23,56 L6,42 L6,20 Z';
  const tx = 23, ty = 31;
  const gId = `g-${uid}`, hlId = `hl-${uid}`;
  const { c1, c2, c3 } = TIER_COLORS[tierKey] || TIER_COLORS.unranked;
  const hlOpacity = rank >= 5 ? 0.36 : 0.28;
  const yAdj = 0;
  const fs = rank >= 6 ? 11 : 14;
  const label = TIER_ABBREV[tierKey] || '?';
  const rimColor = rank === 7 ? 'rgba(255,165,45,0.58)' : 'rgba(195,75,255,0.58)';
  const w = Math.round(height * vw / vh);

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={w} height={height} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gId} x1="0%" y1="0%" x2="65%" y2="100%">
          <stop offset="0%"   stopColor={c1} stopOpacity="1" />
          <stop offset="28%"  stopColor={c2} stopOpacity="1" />
          <stop offset="50%"  stopColor={c3} stopOpacity="1" />
          <stop offset="72%"  stopColor={c2} stopOpacity="1" />
          <stop offset="100%" stopColor={c1} stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id={hlId} cx="50%" cy="8%" r="75%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity={hlOpacity} />
          <stop offset="55%"  stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* fill + highlight + inner stroke */}
      <path d={main} fill={`url(#${gId})`} />
      <path d={main} fill={`url(#${hlId})`} />
      <path d={inner} fill="none" stroke={rank >= 5 ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.17)'} strokeWidth="1.2" />

      {/* Silver shimmer */}
      {rank === 2 && <line x1={tx-8} y1={ty-6} x2={tx+8} y2={ty-6} stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" strokeLinecap="round" />}

      {/* Gold rules + dot */}
      {rank === 3 && <>
        <line x1={tx-10} y1={ty-4.5} x2={tx+10} y2={ty-4.5} stroke="rgba(255,255,255,0.36)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1={tx-10} y1={ty+4.5} x2={tx+10} y2={ty+4.5} stroke="rgba(255,255,255,0.36)" strokeWidth="0.8" strokeLinecap="round" />
        <circle cx={tx} cy={ty} r="2.4" fill="rgba(255,255,255,0.42)" />
      </>}

      {/* Platinum corner dots */}
      {rank === 4 && [[-9,-7],[9,-7],[-9,7],[9,7]].map(([dx,dy],i) =>
        <circle key={i} cx={tx+dx} cy={ty+dy} r="1.8" fill="rgba(255,255,255,0.52)" />
      )}

      {/* Diamond X-facets + diamond shape */}
      {rank === 5 && <>
        <line x1={tx-9} y1={ty-7} x2={tx+9} y2={ty+7} stroke="rgba(255,255,255,0.28)" strokeWidth="0.9" />
        <line x1={tx+9} y1={ty-7} x2={tx-9} y2={ty+7} stroke="rgba(255,255,255,0.28)" strokeWidth="0.9" />
        <polygon points={`${tx},${ty-4} ${tx+2.2},${ty} ${tx},${ty+4} ${tx-2.2},${ty}`} fill="rgba(255,255,255,0.46)" stroke="rgba(255,255,255,0.16)" strokeWidth="0.5" />
      </>}

      {/* Master/Champion crown */}
      {rank >= 6 && (() => {
        const topCy = vh * 0.09;
        const cw = 9, ch = 7;
        const cf = rank === 7 ? 'rgba(255,200,80,0.48)' : 'rgba(220,150,255,0.42)';
        const cs = rank === 7 ? 'rgba(255,225,120,0.78)' : 'rgba(240,180,255,0.72)';
        const jewel = rank === 7 ? 'rgba(255,230,100,0.90)' : 'rgba(255,200,255,0.85)';
        const d = `M${tx-cw},${topCy+ch} L${tx-cw},${topCy+ch*0.5} L${tx-cw*0.55},${topCy} L${tx-cw*0.18},${topCy+ch*0.48} L${tx},${topCy-ch*0.08} L${tx+cw*0.18},${topCy+ch*0.48} L${tx+cw*0.55},${topCy} L${tx+cw},${topCy+ch*0.5} L${tx+cw},${topCy+ch} Z`;
        return <>
          <path d={d} fill={cf} stroke={cs} strokeWidth="0.9" strokeLinejoin="round" />
          {[tx-cw*0.55, tx, tx+cw*0.55].map((jx, i) =>
            <circle key={i} cx={jx} cy={topCy} r="1.4" fill={jewel} />
          )}
        </>;
      })()}

      {/* Champion flanking stars */}
      {rank === 7 && [tx-14, tx+14].map((sx, i) => {
        if (sx < 3 || sx > 43) return null;
        const sy = ty + 7, ss = 3;
        return <polygon key={i} fill="rgba(255,200,80,0.70)" points={`${sx},${sy-ss} ${sx+ss*0.38},${sy-ss*0.38} ${sx+ss},${sy} ${sx+ss*0.38},${sy+ss*0.38} ${sx},${sy+ss} ${sx-ss*0.38},${sy+ss*0.38} ${sx-ss},${sy} ${sx-ss*0.38},${sy-ss*0.38}`} />;
      })}

      {/* Rim for master/champion */}
      {rank >= 6 && <path d={main} fill="none" stroke={rimColor} strokeWidth="2.5" />}

      {/* Outer edge */}
      <path d={main} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />

      {/* Letter */}
      <text x={tx} y={ty + yAdj} textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.96)" fontSize={fs} fontWeight="900"
        fontFamily='"Pretendard Variable",Pretendard,sans-serif' letterSpacing="0.5">
        {label}
      </text>
    </svg>
  );
}

export default function GemTierBadge({ tier, size = 'md', score, breakdown, clickable = true }) {
  const [showModal, setShowModal] = useState(false);
  if (!tier) return null;

  const rank = TIER_RANK[tier.key] ?? 0;
  const h = typeof size === 'number' ? size : (SIZE_H[size] ?? SIZE_H.md);
  const uid = `${tier.key}-${size}-${Math.round(Math.random() * 1e6)}`;
  const subRoman = tier.subdivision ? (romanMap[tier.subdivision] || '') : null;

  return (
    <>
      <div
        className={`relative inline-flex flex-col items-center${clickable ? ' cursor-pointer' : ''}`}
        onClick={clickable ? () => setShowModal(true) : undefined}
        title={clickable ? `${TIER_KO[tier.key] || tier.key}${subRoman ? ' ' + subRoman : ''} — 클릭하여 티어 가이드 보기` : undefined}
      >
        <GemSVG tierKey={tier.key} rank={rank} height={h} uid={uid} />
        {subRoman && (
          <span style={{ fontSize: Math.max(8, h * 0.15) + 'px', marginTop: '1px', opacity: 0.85, color: 'var(--text-secondary)', fontWeight: 700, lineHeight: 1 }}>
            {subRoman}
          </span>
        )}
      </div>

      {showModal && createPortal(
        <TierInfoModal onClose={() => setShowModal(false)} currentTier={tier} score={score} breakdown={breakdown} />,
        document.body
      )}
    </>
  );
}

function TierInfoModal({ onClose, currentTier, score, breakdown }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-black text-[var(--text-primary)]">🛡️ 크리에이터 티어 가이드</h3>
          <button onClick={onClose} className="nav-btn" aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="flex flex-col gap-2">
            {TIER_GUIDE.map((t) => {
              const isCurrent = currentTier?.key === t.key;
              const sub = isCurrent && currentTier?.subdivision ? (romanMap[currentTier.subdivision] || '') : '';
              const rank = TIER_RANK[t.key] ?? 0;
              return (
                <div key={t.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${isCurrent ? 'bg-[var(--accent-soft)] border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-transparent'}`}>
                  <GemSVG tierKey={t.key} rank={rank} height={36} uid={`modal-${t.key}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: t.color }}>{t.name} {sub}</span>
                      {isCurrent && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)] text-white">현재</span>}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] font-mono">ELO {t.range}</div>
                    {isCurrent && score != null && (
                      <div className="text-xs font-bold text-[var(--accent)] mt-0.5 font-mono">내 점수: {score.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
            <span className="font-bold text-[var(--text-primary)] block mb-1">💡 ELO 점수 공식:</span>
            (대화량 × 3) + (팔로워 × 300) + (Top 20 × 0.5) + (평균 × 20) + (음성 × 100)
            {breakdown && (
              <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                <div className="flex justify-between"><span>총 대화 (×3)</span><span className="font-mono">{(breakdown.interactions || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>팔로워 (×300)</span><span className="font-mono">{(breakdown.followers || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>캐릭터 평균 (×20)</span><span className="font-mono">{Math.floor(breakdown.avgInteractions || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>음성 재생 (×100)</span><span className="font-mono">{(breakdown.voicePlays || 0).toLocaleString()}</span></div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)]">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--border)] text-[var(--text-secondary)] font-bold text-sm transition-all">닫기</button>
        </div>
      </div>
    </div>
  );
}
