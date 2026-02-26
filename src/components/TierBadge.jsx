import React, { useState } from 'react';
import { getTierTooltip } from '../utils/tierCalculator';

// Colors and Gradients per tier (X, SR, R, S, A, B)
const TIER_STYLES = {
  b: { fill: '#A0AEC0', grad: 'from-gray-400 to-gray-500', text: '#FFFFFF', initial: 'B' },
  a: { fill: '#48BB78', grad: 'from-emerald-400 to-green-600', text: '#FFFFFF', initial: 'A' },
  s: { fill: '#4299E1', grad: 'from-blue-400 to-blue-600', text: '#FFFFFF', initial: 'S' },
  r: { fill: '#9F7AEA', grad: 'from-purple-400 to-indigo-600', text: '#FFFFFF', initial: 'R' },
  sr: { fill: '#ED8936', grad: 'from-orange-400 to-red-500', text: '#FFFFFF', initial: 'SR', fontSizeRatio: 0.45 },
  x: { fill: '#F56565', grad: 'from-red-400 to-rose-700', text: '#FFFFFF', initial: 'X' },
};

/** Badge with tooltip showing tier criteria on hover */
export function TierBadgeWithTooltip({ tierKey, size = 32, className = '' }) {
  const [show, setShow] = useState(false);
  const tooltip = getTierTooltip(tierKey);

  return (
    <span
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <TierBadge tierKey={tierKey} size={size} />
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 text-[10px] font-bold rounded-lg shadow-2xl border border-white/10 bg-[rgba(20,20,30,0.95)] backdrop-blur-md text-white whitespace-nowrap z-50 pointer-events-none animate-fade-in">
          {tooltip}
        </div>
      )}
    </span>
  );
}

/** Enhanced Tier Badge with Gradient and Depth */
export function TierBadge({ tierKey, size = 32, className = '' }) {
  const style = TIER_STYLES[tierKey] || TIER_STYLES.b;
  const fontSize = size * (style.fontSizeRatio || 0.6);

  return (
    <div
      className={`flex items-center justify-center font-black shadow-lg overflow-hidden relative group/tier ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: fontSize,
        fontFamily: 'var(--font-heading, sans-serif)',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
      role="img"
      aria-label={`${tierKey} tier`}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${style.grad}`} />

      {/* Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-50" />

      {/* Dynamic Border */}
      <div className="absolute inset-0 border border-white/20 rounded-lg" />

      <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
        {style.initial}
      </span>
    </div>
  );
}

/** Tier label with badge + text (for cards) */
export function TierLabel({ tierKey, tierName, size = 'sm', className = '' }) {
  const style = TIER_STYLES[tierKey] || TIER_STYLES.b;

  const badgeSize = size === 'sm' ? 18 : 24;
  const fontSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-2 py-1 gap-1.5' : 'px-3 py-1.5 gap-2';

  return (
    <span
      className={`inline-flex items-center font-black rounded-full ${fontSize} ${padding} ${className} backdrop-blur-sm border shadow-sm transition-all hover:brightness-110`}
      style={{
        backgroundColor: `${style.fill}20`,
        color: style.fill,
        borderColor: `${style.fill}40`,
      }}
      title={getTierTooltip(tierKey)}
    >
      <TierBadge tierKey={tierKey} size={badgeSize} />
      <span className="tracking-tight uppercase">{tierName}</span>
    </span>
  );
}

/** Creator tier icon - used in smaller lists */
export function CreatorTierIcon({ tierKey, size = 32, className = '' }) {
  const CREATOR_STYLES = {
    beginner: { grad: 'from-gray-300 to-gray-500', initial: 'B' },
    apprentice: { grad: 'from-green-300 to-green-600', initial: 'A' },
    skilled: { grad: 'from-cyan-300 to-cyan-600', initial: 'S' },
    expert: { grad: 'from-purple-300 to-purple-600', initial: 'P' },
    diamond: { grad: 'from-blue-300 to-blue-600', initial: 'D' },
    master: { grad: 'from-amber-300 to-orange-600', initial: 'M' },
    champion: { grad: 'from-red-400 to-rose-700', initial: 'C' },
  };

  const style = CREATOR_STYLES[tierKey] || CREATOR_STYLES.beginner;

  return (
    <div
      className={`flex items-center justify-center font-black uppercase shadow-lg overflow-hidden relative ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 75%, 50% 100%, 0% 75%)',
      }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${style.grad}`} />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-40" />
      <div className="absolute inset-0 border border-white/20" />
      <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        {style.initial}
      </span>
    </div>
  );
}

export default TierBadge;

