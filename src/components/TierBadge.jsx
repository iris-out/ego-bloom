import React, { useState } from 'react';
import { getTierTooltip } from '../utils/tierCalculator';

// Colors per tier (User Request: X, SR, R, S, A, B)
const TIER_STYLES = {
  b: { fill: '#A0AEC0', text: '#FFFFFF', initial: 'B' },
  a: { fill: '#48BB78', text: '#FFFFFF', initial: 'A' },
  s: { fill: '#4299E1', text: '#FFFFFF', initial: 'S' },
  r: { fill: '#9F7AEA', text: '#FFFFFF', initial: 'R' },
  sr: { fill: '#ED8936', text: '#FFFFFF', initial: 'SR', fontSizeRatio: 0.4 },
  x: { fill: '#F56565', text: '#FFFFFF', initial: 'X' },
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
      title={tooltip}
    >
      <TierBadge tierKey={tierKey} size={size} />
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg shadow-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] whitespace-nowrap z-50 pointer-events-none">
          {tooltip}
        </div>
      )}
    </span>
  );
}

/** Flat Initial Tier Badge */
export function TierBadge({ tierKey, size = 32, className = '' }) {
  const style = TIER_STYLES[tierKey] || TIER_STYLES.b; // Default to B
  const fontSize = size * (style.fontSizeRatio || 0.6);

  return (
    <div
      className={`flex items-center justify-center rounded-lg font-bold shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: style.fill,
        color: style.text,
        fontSize: fontSize,
        fontFamily: 'var(--font-heading, sans-serif)',
      }}
      role="img"
      aria-label={`${tierKey} tier`}
    >
      {style.initial}
    </div>
  );
}

/** Tier label with badge + text (for cards) */
export function TierLabel({ tierKey, tierName, size = 'sm', className = '' }) {
  const style = TIER_STYLES[tierKey] || TIER_STYLES.b; // Default to B

  // Adjusted sizes for "bigger" look
  const badgeSize = size === 'sm' ? 18 : 24;
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-1 gap-1.5' : 'px-3 py-1.5 gap-2';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-lg ${fontSize} ${padding} ${className}`}
      style={{
        backgroundColor: `${style.fill}15`, // Very transparent background
        color: style.fill,
        border: `1px solid ${style.fill}30`,
      }}
      title={getTierTooltip(tierKey)}
    >
      <TierBadge tierKey={tierKey} size={badgeSize} />
      <span className="opacity-90">{tierName}</span>
    </span>
  );
}

/** Creator tier icon (Also updated to flat style for consistency) */
export function CreatorTierIcon({ tierKey, size = 32, className = '' }) {
  // Mapping for creator tiers (which differ from character tiers)
  const CREATOR_STYLES = {
    beginner: { fill: '#CBD5E0', initial: 'B' },
    apprentice: { fill: '#68D391', initial: 'A' },
    skilled: { fill: '#4FD1C5', initial: 'S' },
    expert: { fill: '#B794F4', initial: 'E' },
    master: { fill: '#FC8181', initial: 'M' },
    grandmaster: { fill: '#F6E05E', initial: 'G' },
    legend: { fill: '#ED64A6', initial: 'L' },
  };

  const style = CREATOR_STYLES[tierKey] || CREATOR_STYLES.beginner;

  return (
    <div
      className={`flex items-center justify-center rounded-xl font-bold uppercase shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: style.fill,
        color: '#FFFFFF',
        fontSize: size * 0.55,
      }}
    >
      {style.initial}
    </div>
  );
}

export default TierBadge;
