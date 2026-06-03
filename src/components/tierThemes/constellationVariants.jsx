import React, { useId } from 'react';
import { resolveSize, TIER_ANCHORS, rankKind } from './themeMeta';

// Constellation family — 5 variations spanning minimal ↔ ornate.
// Every tier's stars connect into the SILHOUETTE of its material, so the shape
// itself reads the tier even at 36px:
//   bronze  triangle shard      silver  rhombus
//   gold    pentagon gem        platinum hexagon crystal
//   diamond brilliant-cut       master  plain crown
//   champion ornate jewelled crown   (#1 / Top-10 → ornate crown, gold / cyan)
//
// The 5 variations share this shape vocabulary; what changes is the elaboration
// LEVEL (1..5): line weight, node style, facet fill, glow, sparkle, animation —
// from a bare line-constellation to a fully jewelled, glowing, animated badge.
//
// One shared <ConstellationBadge> engine + 5 thin named wrappers, so tuning the
// look updates every variation at once. All ids/keyframes are namespaced with a
// per-instance `p` prefix; animation is gated behind `animate`.

const ORDER = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'champion'];

// Shape vocabulary. nodes are [x,y] in 0..100 space (centred ~50,52).
// outline = ordered node indices (auto-closed); facets = extra internal lines;
// peaks = the bright "lead" stars; crown/jewel mark the regalia tiers.
const SHAPES = {
  bronze: { nodes: [[50, 30], [71, 66], [29, 66]], outline: [0, 1, 2], facets: [], peaks: [0] },
  silver: { nodes: [[50, 28], [73, 52], [50, 76], [27, 52]], outline: [0, 1, 2, 3], facets: [[1, 3]], peaks: [0] },
  gold: { nodes: [[50, 28], [27, 45], [36, 72], [64, 72], [73, 45]], outline: [0, 1, 2, 3, 4], facets: [], peaks: [0] },
  platinum: { nodes: [[50, 28], [29, 40], [29, 64], [50, 76], [71, 64], [71, 40]], outline: [0, 1, 2, 3, 4, 5], facets: [[0, 3]], peaks: [0, 3] },
  diamond: { nodes: [[40, 34], [60, 34], [72, 46], [50, 78], [28, 46]], outline: [0, 1, 2, 3, 4], facets: [[0, 3], [1, 3], [4, 2]], peaks: [0, 1] },
  master: { nodes: [[30, 66], [30, 49], [40, 58], [50, 43], [60, 58], [70, 49], [70, 66]], outline: [0, 1, 2, 3, 4, 5, 6], facets: [], peaks: [1, 3, 5], crown: true },
  champion: { nodes: [[26, 68], [26, 50], [34, 60], [40, 45], [46, 58], [50, 35], [54, 58], [60, 45], [66, 60], [74, 50], [74, 68]], outline: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], facets: [], peaks: [1, 3, 5, 7, 9], crown: true, jewel: 5 },
};

// Elaboration levels: simple (1) → ornate (5).
const LEVELS = {
  1: { line: 1.1, lineOp: 0.8, dot: 1.2, fill: 0, glow: 0, spark: 0, grad: false, twinkle: false, particles: false },
  2: { line: 1.5, lineOp: 0.9, dot: 1.6, fill: 0.06, glow: 0, spark: 0, grad: false, twinkle: false, particles: false },
  3: { line: 1.9, lineOp: 1, dot: 2.0, fill: 0.12, glow: 0.4, spark: 1, grad: false, twinkle: false, particles: false },
  4: { line: 2.3, lineOp: 1, dot: 2.3, fill: 0.18, glow: 0.55, spark: 1, grad: true, twinkle: false, particles: false },
  5: { line: 2.9, lineOp: 1, dot: 2.7, fill: 0.26, glow: 0.72, spark: 2, grad: true, twinkle: true, particles: true },
};

// 4-point sparkle star path.
function spark(x, y, r) {
  const r2 = r * 0.36;
  return `M${x} ${(y - r).toFixed(1)} L${(x + r2).toFixed(1)} ${(y - r2).toFixed(1)} L${(x + r).toFixed(1)} ${y} L${(x + r2).toFixed(1)} ${(y + r2).toFixed(1)} L${x} ${(y + r).toFixed(1)} L${(x - r2).toFixed(1)} ${(y + r2).toFixed(1)} L${(x - r).toFixed(1)} ${y} L${(x - r2).toFixed(1)} ${(y - r2).toFixed(1)} Z`;
}

function ConstellationBadge({ tier = 'unranked', size = 'lg', rank, animate = true, level = 3, className = '' }) {
  const px = resolveSize(size);
  const raw = useId();
  const p = raw.replace(/[:|-]/g, '') + '_';
  const a = TIER_ANCHORS[tier] || TIER_ANCHORS.unranked;
  const special = rankKind(rank);
  const isApex = special === 'rank1';
  const isTop10 = special === 'top10';
  const grand = isApex || isTop10;
  const locked = tier === 'unranked';
  const L = LEVELS[level] || LEVELS[3];

  const lineColor = isApex ? '#FFD700' : isTop10 ? '#22E3D6' : a.primary;
  const nodeColor = isApex ? '#FFF4C2' : isTop10 ? '#CFFAF5' : '#FFFFFF';
  const accentColor = isApex ? '#FFD700' : isTop10 ? '#22E3D6' : a.glow;

  const idGlow = `${p}glow`;
  const idLine = `${p}line`;
  const kfTw = `${p}tw`;
  const kfPulse = `${p}pulse`;

  // ---- Locked (unranked): a single faint star + padlock ----
  if (locked) {
    return (
      <svg viewBox="0 0 100 100" width={px} height={px} className={className} style={{ overflow: 'visible' }}>
        <path d={spark(50, 40, 5)} fill="#4A5568" opacity="0.7" />
        <g fill="none" stroke="#6B7480" strokeWidth="3" opacity="0.7">
          <rect x="43" y="55" width="14" height="11" rx="2.5" fill="#3A4351" stroke="none" />
          <path d="M45.5 55 V50.5 a4.5 4.5 0 0 1 9 0 V55" />
        </g>
      </svg>
    );
  }

  const shape = SHAPES[grand ? 'champion' : tier] || SHAPES.bronze;
  const pt = (i) => shape.nodes[i];
  const outlinePath = `M${shape.outline.map((i) => pt(i).join(' ')).join(' L')} Z`;

  const rankIdx = ORDER.indexOf(tier);
  const showGlow = L.glow > 0 && (grand || rankIdx >= 4 || shape.crown);
  const stroke = L.grad ? `url(#${idLine})` : lineColor;
  const animPulse = animate && showGlow && level >= 3;
  const animTwinkle = animate && L.twinkle;

  // particle sparkles (level 5) — fixed positions so render is stable.
  const particles = L.particles
    ? [[20, 30], [80, 34], [16, 60], [84, 64], [50, 16]]
    : [];

  return (
    <svg viewBox="0 0 100 100" width={px} height={px} className={className} style={{ overflow: 'visible' }}>
      {(animPulse || animTwinkle) && (
        <style>{`@keyframes ${kfPulse}{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes ${kfTw}{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      )}

      <defs>
        {showGlow && (
          <radialGradient id={idGlow} cx="50%" cy="52%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity={L.glow} />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>
        )}
        {L.grad && (
          <linearGradient id={idLine} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} />
            <stop offset="100%" stopColor={accentColor} />
          </linearGradient>
        )}
      </defs>

      {/* Soft glow halo */}
      {showGlow && (
        <circle cx="50" cy="52" r="46" fill={`url(#${idGlow})`}
          style={animPulse ? { animation: `${kfPulse} 2.8s ease-in-out infinite` } : undefined} />
      )}

      {/* Facet fill (translucent silhouette) */}
      {L.fill > 0 && (
        <path d={outlinePath} fill={accentColor} opacity={L.fill} stroke="none" />
      )}

      {/* Drifting particles (level 5) */}
      {particles.map(([x, y], i) => (
        <path key={`${p}pt${i}`} d={spark(x, y, 1.6)} fill={nodeColor} opacity="0.5"
          style={animTwinkle ? { animation: `${kfTw} ${(1.6 + i * 0.4).toFixed(1)}s ease-in-out ${(i * 0.3).toFixed(1)}s infinite` } : undefined} />
      ))}

      {/* Constellation edges */}
      <path d={outlinePath} fill="none" stroke={stroke} strokeWidth={L.line}
        strokeOpacity={L.lineOp} strokeLinejoin="round" strokeLinecap="round" />
      {shape.facets.map(([i, j], k) => (
        <line key={`${p}f${k}`} x1={pt(i)[0]} y1={pt(i)[1]} x2={pt(j)[0]} y2={pt(j)[1]}
          stroke={stroke} strokeWidth={L.line} strokeOpacity={L.lineOp * 0.85} strokeLinecap="round" />
      ))}

      {/* Star nodes */}
      {shape.nodes.map(([x, y], i) => {
        const isPeak = shape.peaks.includes(i);
        const isJewel = shape.jewel === i;
        const asStar = L.spark >= 2 || (L.spark >= 1 && isPeak);
        const r = isPeak ? L.dot * 1.35 : L.dot;
        if (isJewel && level >= 3) {
          // Crown centre jewel
          const gem = isApex ? '#FFD700' : isTop10 ? '#22E3D6' : '#FF3B6B';
          return (
            <g key={`${p}n${i}`}>
              <path d={spark(x, y, r * 1.6)} fill={accentColor} opacity="0.5" />
              <circle cx={x} cy={y} r={r * 1.1} fill={gem} stroke={nodeColor} strokeWidth="0.6" />
            </g>
          );
        }
        const node = asStar
          ? <path d={spark(x, y, r * 1.5)} fill={isPeak ? nodeColor : lineColor} />
          : <circle cx={x} cy={y} r={r} fill={isPeak ? nodeColor : lineColor} />;
        if (animTwinkle) {
          return (
            <g key={`${p}n${i}`} style={{ animation: `${kfTw} ${(1.8 + (i % 4) * 0.3).toFixed(1)}s ease-in-out ${((i % 5) * 0.2).toFixed(1)}s infinite` }}>
              {node}
            </g>
          );
        }
        return <g key={`${p}n${i}`}>{node}</g>;
      })}
    </svg>
  );
}

// ── 5 named variations (simple → ornate) ──
export function ConstellationMinimal(props) { return <ConstellationBadge {...props} level={1} />; }
export function ConstellationClean(props) { return <ConstellationBadge {...props} level={2} />; }
export function ConstellationBalanced(props) { return <ConstellationBadge {...props} level={3} />; }
export function ConstellationGlow(props) { return <ConstellationBadge {...props} level={4} />; }
export function ConstellationOrnate(props) { return <ConstellationBadge {...props} level={5} />; }
