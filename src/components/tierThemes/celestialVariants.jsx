import React, { useId } from 'react';
import { resolveSize, TIER_ANCHORS, rankKind } from './themeMeta';

// Celestial Body family — 5 variations spanning minimal ↔ ornate.
// Every tier is a celestial body whose TYPE climbs with rank, so the body reads
// the tier even at 36px:
//   bronze   asteroid (rock)      silver   moon (cratered sphere)
//   gold     banded planet        platinum ringed planet
//   diamond  radiant star         master   star + orbital rings
//   champion supernova core (burst + rings)   (#1 / Top-10 → gold / cyan)
//
// The 5 variations share this body vocabulary; what changes is the elaboration
// LEVEL (1..5): shading, glow, ring weight, corona, particle stars, animation —
// from a flat line/fill body to a fully lit, ringed, glowing, animated badge.
//
// One shared <CelestialBadge> engine + 5 thin named wrappers, so tuning the look
// updates every variation at once. All ids/keyframes are namespaced with a
// per-instance `p` prefix; animation is gated behind `animate`.

const ORDER = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'champion'];

// Per-tier celestial configuration (shared by all 5 variations).
//   kind  : 'rock' | 'sphere' | 'star'
//   band  : equatorial band (gas giant)        craters: count of surface craters
//   rings : orbital ring count                  rays: 0 none · 1 corona · 2 supernova burst
const CELESTIAL = {
  bronze: { kind: 'rock', craters: 3, band: false, rings: 0, rays: 0 },
  silver: { kind: 'sphere', craters: 3, band: false, rings: 0, rays: 0 },
  gold: { kind: 'sphere', craters: 0, band: true, rings: 0, rays: 0 },
  platinum: { kind: 'sphere', craters: 0, band: true, rings: 1, rays: 0 },
  diamond: { kind: 'star', craters: 0, band: false, rings: 0, rays: 1 },
  master: { kind: 'star', craters: 0, band: false, rings: 2, rays: 1 },
  champion: { kind: 'star', craters: 0, band: false, rings: 2, rays: 2 },
};

// Elaboration levels: simple (1) → ornate (5).
//   shade : 'flat' | 'twotone' | 'soft' | 'lit'
const LEVELS = {
  1: { shade: 'flat', glow: 0, ring: 1.1, ringGrad: false, corona: 0, stars: 0, anim: false },
  2: { shade: 'twotone', glow: 0, ring: 1.5, ringGrad: false, corona: 0, stars: 0, anim: false },
  3: { shade: 'soft', glow: 0.4, ring: 1.8, ringGrad: false, corona: 0.45, stars: 0, anim: false },
  4: { shade: 'lit', glow: 0.55, ring: 2.1, ringGrad: true, corona: 0.65, stars: 4, anim: false },
  5: { shade: 'lit', glow: 0.75, ring: 2.5, ringGrad: true, corona: 0.9, stars: 7, anim: true },
};

// Irregular asteroid silhouette (centred ~50,52).
const ROCK = 'M50 34 C59 33 65 38 66 46 C70 51 67 59 60 62 C57 69 47 70 42 65 C35 65 31 58 34 51 C31 45 39 35 50 34 Z';

// 4-point sparkle star.
function spark(x, y, r) {
  const r2 = r * 0.36;
  return `M${x} ${(y - r).toFixed(1)} L${(x + r2).toFixed(1)} ${(y - r2).toFixed(1)} L${(x + r).toFixed(1)} ${y} L${(x + r2).toFixed(1)} ${(y + r2).toFixed(1)} L${x} ${(y + r).toFixed(1)} L${(x - r2).toFixed(1)} ${(y + r2).toFixed(1)} L${(x - r).toFixed(1)} ${y} L${(x - r2).toFixed(1)} ${(y - r2).toFixed(1)} Z`;
}

function CelestialBadge({ tier = 'unranked', size = 'lg', rank, animate = true, level = 3, className = '' }) {
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

  const cx = 50;
  const cy = 52;

  const idBody = `${p}body`;
  const idCorona = `${p}corona`;
  const idRing = `${p}ring`;
  const idClip = `${p}clip`;
  const kfSpin = `${p}spin`;
  const kfPulse = `${p}pulse`;
  const kfTw = `${p}tw`;

  // ---- Locked (unranked): dim asteroid + padlock ----
  if (locked) {
    return (
      <svg viewBox="0 0 100 100" width={px} height={px} className={className} style={{ overflow: 'visible' }}>
        <path d={ROCK} fill="#3A4351" stroke="#4A5568" strokeWidth="2" opacity="0.55"
          transform="scale(0.78) translate(14 14)" />
        <g fill="none" stroke="#6B7480" strokeWidth="3" opacity="0.7">
          <rect x="43" y="55" width="14" height="11" rx="2.5" fill="#3A4351" stroke="none" />
          <path d="M45.5 55 V50.5 a4.5 4.5 0 0 1 9 0 V55" />
        </g>
      </svg>
    );
  }

  const cfg = CELESTIAL[grand ? 'champion' : tier] || CELESTIAL.bronze;

  // Palette (special ranks recolour to gold / cyan).
  const bright = isApex ? '#FFE9A6' : isTop10 ? '#C2FBF4' : a.primary;
  const mid = isApex ? '#FFCB45' : isTop10 ? '#5FE9DE' : a.secondary;
  const dark = isApex ? '#A8730A' : isTop10 ? '#0E7F78' : a.accent;
  const glowC = isApex ? '#FFD700' : isTop10 ? '#22E3D6' : a.glow;

  const isStar = cfg.kind === 'star';
  const rBody = isStar ? 15 : 18;
  const showGlow = L.glow > 0 && (isStar || cfg.rings > 0 || grand);
  const coronaOn = isStar && L.corona > 0;
  const animSpin = animate && L.anim && cfg.rings > 0;
  const animPulse = animate && L.anim && (isStar || grand);
  const animTw = animate && L.anim && L.stars > 0;

  // Ring geometry (tilted ellipse). Front arc is redrawn over the body.
  const ringEls = [];
  for (let i = 0; i < cfg.rings; i += 1) {
    const rx = 34 + i * 6;
    const ry = 11 + i * 2;
    const ringStroke = L.ringGrad ? `url(#${idRing})` : bright;
    ringEls.push({ rx, ry, ringStroke });
  }

  // Surface craters (rock / moon).
  const craters = cfg.craters > 0
    ? [[44, 46, 3], [57, 55, 2.4], [48, 60, 2]].slice(0, cfg.craters)
    : [];

  // Star rays.
  const rayCount = cfg.rays === 2 ? 12 : 8;
  const rayLen = cfg.rays === 2 ? 16 : 9;
  const rays = isStar && cfg.rays > 0
    ? Array.from({ length: rayCount }, (_, i) => {
      const ang = (i / rayCount) * Math.PI * 2;
      const long = cfg.rays === 2 && i % 2 === 0 ? rayLen : rayLen * 0.6;
      const x1 = cx + (rBody + 2) * Math.cos(ang);
      const y1 = cy + (rBody + 2) * Math.sin(ang);
      const x2 = cx + (rBody + 2 + long) * Math.cos(ang);
      const y2 = cy + (rBody + 2 + long) * Math.sin(ang);
      return { x1, y1, x2, y2 };
    })
    : [];

  const stars = L.stars > 0
    ? [[18, 28], [82, 30], [22, 74], [80, 72], [50, 14], [14, 50], [86, 54]].slice(0, L.stars)
    : [];

  return (
    <svg viewBox="0 0 100 100" width={px} height={px} className={className} style={{ overflow: 'visible' }}>
      {(animSpin || animPulse || animTw) && (
        <style>{`@keyframes ${kfSpin}{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes ${kfPulse}{0%,100%{opacity:.5}50%{opacity:.9}}@keyframes ${kfTw}{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
      )}

      <defs>
        {(L.shade === 'soft' || L.shade === 'lit') && (
          <radialGradient id={idBody} cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor={isStar ? '#FFFFFF' : bright} />
            <stop offset="55%" stopColor={mid} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
        )}
        {showGlow && (
          <radialGradient id={idCorona} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowC} stopOpacity={L.glow} />
            <stop offset="100%" stopColor={glowC} stopOpacity="0" />
          </radialGradient>
        )}
        {L.ringGrad && (
          <linearGradient id={idRing} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={dark} />
            <stop offset="50%" stopColor={bright} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
        )}
        <clipPath id={idClip}>
          {cfg.kind === 'rock' ? <path d={ROCK} /> : <circle cx={cx} cy={cy} r={rBody} />}
        </clipPath>
      </defs>

      {/* Outer glow / corona halo */}
      {showGlow && (
        <circle cx={cx} cy={cy} r={isStar ? 40 : 34} fill={`url(#${idCorona})`}
          style={animPulse ? { animation: `${kfPulse} 2.8s ease-in-out infinite` } : undefined} />
      )}

      {/* Background particle stars */}
      {stars.map(([x, y], i) => (
        <path key={`${p}s${i}`} d={spark(x, y, 1.7)} fill="#FFFFFF" opacity="0.55"
          style={animTw ? { animation: `${kfTw} ${(1.6 + i * 0.3).toFixed(1)}s ease-in-out ${(i * 0.25).toFixed(1)}s infinite` } : undefined} />
      ))}

      {/* Star rays */}
      {rays.length > 0 && (
        <g stroke={bright} strokeWidth={cfg.rays === 2 ? 2 : 1.4} strokeLinecap="round" opacity={0.5 + L.corona * 0.4}
          style={animate && L.anim ? { animation: `${kfSpin} 40s linear infinite`, transformOrigin: `${cx}px ${cy}px` } : undefined}>
          {rays.map((r, i) => (
            <line key={`${p}r${i}`} x1={r.x1.toFixed(1)} y1={r.y1.toFixed(1)} x2={r.x2.toFixed(1)} y2={r.y2.toFixed(1)} />
          ))}
        </g>
      )}

      {/* Orbital rings — back half (behind the body) */}
      {ringEls.map((rg, i) => (
        <g key={`${p}rb${i}`} transform={`rotate(-18 ${cx} ${cy})`}
          style={animSpin ? { animation: `${kfSpin} ${22 + i * 6}s linear infinite`, transformOrigin: `${cx}px ${cy}px` } : undefined}>
          <ellipse cx={cx} cy={cy} rx={rg.rx} ry={rg.ry} fill="none"
            stroke={rg.ringStroke} strokeWidth={L.ring} opacity="0.9" />
        </g>
      ))}

      {/* ==== BODY ==== */}
      {(() => {
        const bodyFill = (L.shade === 'soft' || L.shade === 'lit') ? `url(#${idBody})` : (isStar ? bright : mid);
        if (cfg.kind === 'rock') {
          return <path d={ROCK} fill={bodyFill} stroke={dark} strokeWidth={L.shade === 'flat' ? 2 : 0} />;
        }
        return <circle cx={cx} cy={cy} r={rBody} fill={bodyFill} stroke={isStar ? 'none' : dark} strokeWidth={L.shade === 'flat' ? 2 : 0} />;
      })()}

      {/* Flat two-tone terminator (level 2) */}
      {L.shade === 'twotone' && !isStar && (
        <g clipPath={`url(#${idClip})`}>
          <circle cx={cx + 7} cy={cy + 5} r={rBody} fill={dark} opacity="0.9" />
        </g>
      )}

      {/* Equatorial band (gas giant) */}
      {cfg.band && (
        <g clipPath={`url(#${idClip})`}>
          <rect x={cx - rBody} y={cy - 3} width={rBody * 2} height="6" fill={dark} opacity="0.35" />
          <rect x={cx - rBody} y={cy + 5} width={rBody * 2} height="3" fill={bright} opacity="0.25" />
        </g>
      )}

      {/* Craters */}
      {craters.length > 0 && (
        <g clipPath={`url(#${idClip})`} fill={dark} opacity="0.45">
          {craters.map(([x, y, r], i) => <circle key={`${p}c${i}`} cx={x} cy={y} r={r} />)}
        </g>
      )}

      {/* Star core highlight */}
      {isStar && (
        <circle cx={cx} cy={cy} r={rBody}
          fill={L.shade === 'flat' || L.shade === 'twotone' ? bright : `url(#${idBody})`} />
      )}
      {isStar && L.corona > 0 && (
        <circle cx={cx - 3} cy={cy - 3} r={rBody * 0.45} fill="#FFFFFF" opacity={0.5 * L.corona} />
      )}

      {/* Orbital rings — front arc (over the body) */}
      {ringEls.map((rg, i) => (
        <g key={`${p}rf${i}`} transform={`rotate(-18 ${cx} ${cy})`}
          style={animSpin ? { animation: `${kfSpin} ${22 + i * 6}s linear infinite`, transformOrigin: `${cx}px ${cy}px` } : undefined}>
          <path d={`M${cx - rg.rx} ${cy} A ${rg.rx} ${rg.ry} 0 0 0 ${cx + rg.rx} ${cy}`}
            fill="none" stroke={rg.ringStroke} strokeWidth={L.ring} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

// ── 5 named variations (simple → ornate) ──
export function CelestialMinimal(props) { return <CelestialBadge {...props} level={1} />; }
export function CelestialClean(props) { return <CelestialBadge {...props} level={2} />; }
export function CelestialBalanced(props) { return <CelestialBadge {...props} level={3} />; }
export function CelestialGlow(props) { return <CelestialBadge {...props} level={4} />; }
export function CelestialOrnate(props) { return <CelestialBadge {...props} level={5} />; }
