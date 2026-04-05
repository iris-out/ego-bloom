import React, { useId } from 'react';

const SIZES = { sm: 36, md: 50, lg: 64, xl: 92 };

const TIER_COLORS = {
  unranked:  { primary: '#4A5568', secondary: '#2D3748', accent: '#718096' },
  bronze:    { primary: '#EAA678', secondary: '#C58356', accent: '#8B4513' },
  silver:    { primary: '#D1D5DB', secondary: '#9CA3AF', accent: '#4B5563' },
  gold:      { primary: '#FDE68A', secondary: '#F59E0B', accent: '#B45309' },
  platinum:  { primary: '#FFFFFF', secondary: '#CBD5E1', accent: '#64748B' },
  diamond:   { primary: '#EFF6FF', secondary: '#60A5FA', accent: '#2563EB' },
  master:    { primary: '#FDF4FF', secondary: '#E879F9', accent: '#701A75' },
  champion:  { primary: '#FEF08A', secondary: '#F97316', accent: '#DC2626' },
};

function BronzeIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}bz1`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EAA678" /><stop offset="100%" stopColor="#8B4513" /></linearGradient>
        <linearGradient id={`${p}bz2`} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#C58356" /><stop offset="100%" stopColor="#5C3317" /></linearGradient>
      </defs>
      <polygon points="50,5 90,25 90,65 50,95 10,65 10,25" fill={`url(#${p}bz1)`} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <polygon points="50,5 90,25 50,50" fill="rgba(255,255,255,0.1)" />
      <polygon points="10,25 50,5 50,50" fill="rgba(0,0,0,0.15)" />
      <polygon points="90,25 90,65 50,95 50,50" fill="rgba(0,0,0,0.25)" />
      <polygon points="10,25 10,65 50,95 50,50" fill="rgba(0,0,0,0.4)" />
      <polygon points="50,25 70,35 70,55 50,70 30,55 30,35" fill={`url(#${p}bz2)`} />
    </>
  );
}

function SilverIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}sv1`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#D1D5DB" /><stop offset="50%" stopColor="#9CA3AF" /><stop offset="100%" stopColor="#4B5563" /></linearGradient>
      </defs>
      <polygon points="50,5 95,50 50,95 5,50" fill={`url(#${p}sv1)`} />
      <polygon points="50,5 95,50 50,50" fill="rgba(255,255,255,0.3)" />
      <polygon points="5,50 50,5 50,50" fill="rgba(255,255,255,0.1)" />
      <polygon points="95,50 50,95 50,50" fill="rgba(0,0,0,0.2)" />
      <polygon points="5,50 50,95 50,50" fill="rgba(0,0,0,0.4)" />
      <polygon points="50,20 60,40 80,50 60,60 50,80 40,60 20,50 40,40" fill="#E5E7EB" opacity="0.9" />
    </>
  );
}

function GoldIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}gd`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FDE68A" /><stop offset="50%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#B45309" /></linearGradient>
        <linearGradient id={`${p}gd2`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FEF3C7" /><stop offset="100%" stopColor="#D97706" /></linearGradient>
      </defs>
      <path d="M 50 2 L 92 18 L 92 50 C 92 82 50 98 50 98 C 50 98 8 82 8 50 L 8 18 Z" fill={`url(#${p}gd)`} stroke="#FFFBEB" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M 50 12 L 78 24 L 78 48 C 78 72 50 86 50 86 C 50 86 22 72 22 48 L 22 24 Z" fill={`url(#${p}gd2)`} />
      <path d="M 50 12 L 50 86 C 22 72 22 48 22 48 L 22 24 Z" fill="rgba(0,0,0,0.15)" />
      <polygon points="50,28 65,48 50,70 35,48" fill="#FFFBEB" filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))" />
      <polygon points="50,28 50,70 35,48" fill="#FDE68A" />
    </>
  );
}

function PlatinumIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}pt`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="50%" stopColor="#CBD5E1" /><stop offset="100%" stopColor="#64748B" /></linearGradient>
        <linearGradient id={`${p}pt2`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#94A3B8" /><stop offset="100%" stopColor="#334155" /></linearGradient>
      </defs>
      <polygon points="50,0 85,35 50,100 15,35" fill={`url(#${p}pt)`} />
      <polygon points="50,0 85,35 50,45" fill="#FFFFFF" opacity="0.8" />
      <polygon points="50,0 15,35 50,45" fill="#94A3B8" opacity="0.5" />
      <polygon points="15,35 50,100 50,45" fill={`url(#${p}pt2)`} opacity="0.9" />
      <polygon points="85,35 50,100 50,45" fill="#64748B" opacity="0.4" />
      <polygon points="50,25 65,40 50,80 35,40" fill="#F8FAFC" filter="drop-shadow(0 0 6px rgba(255,255,255,0.6))" />
      <polygon points="50,25 50,80 35,40" fill="#E2E8F0" />
      <polygon points="25,40 15,35 30,50" fill="#FFFFFF" />
      <polygon points="75,40 85,35 70,50" fill="#FFFFFF" />
    </>
  );
}

function DiamondIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}di1`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EFF6FF" /><stop offset="100%" stopColor="#DBEAFE" /></linearGradient>
        <linearGradient id={`${p}di2`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60A5FA" /><stop offset="100%" stopColor="#2563EB" /></linearGradient>
      </defs>
      <polygon points="30,20 70,20 90,40 10,40" fill={`url(#${p}di1)`} />
      <polygon points="30,20 45,20 50,40 10,40" fill="rgba(255,255,255,0.95)" />
      <polygon points="45,20 55,20 50,40" fill="#FFFFFF" />
      <polygon points="55,20 70,20 90,40 50,40" fill="rgba(255,255,255,0.6)" />
      <polygon points="10,40 90,40 50,95" fill={`url(#${p}di2)`} />
      <polygon points="10,40 50,40 50,95" fill="rgba(255,255,255,0.3)" />
      <polygon points="50,40 90,40 50,95" fill="rgba(0,0,0,0.25)" />
      <polygon points="40,40 60,40 50,75" fill="#BFDBFE" opacity="0.9" filter="drop-shadow(0 0 8px #93C5FD)" />
    </>
  );
}

function MasterIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}ma`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FDF4FF" /><stop offset="30%" stopColor="#E879F9" /><stop offset="100%" stopColor="#701A75" /></linearGradient>
        <linearGradient id={`${p}ma2`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#86198F" /><stop offset="100%" stopColor="#4A044E" /></linearGradient>
      </defs>
      <polygon points="20,25 35,15 40,60 25,65" fill="#701A75" opacity="0.8" />
      <polygon points="80,25 65,15 60,60 75,65" fill="#701A75" opacity="0.8" />
      <polygon points="50,2 75,35 50,95 25,35" fill={`url(#${p}ma)`} />
      <polygon points="50,2 75,35 50,55" fill="#F0ABFC" opacity="0.9" />
      <polygon points="50,2 25,35 50,55" fill="#C026D3" opacity="0.7" />
      <polygon points="25,35 50,95 50,55" fill={`url(#${p}ma2)`} />
      <polygon points="75,35 50,95 50,55" fill="#701A75" opacity="0.9" />
      <path d="M 5 50 Q 50 20 95 50" stroke="#F0ABFC" strokeWidth="2.5" fill="none" filter="drop-shadow(0 0 4px #D946EF)" />
      <circle cx="50" cy="45" r="4" fill="#FFFFFF" filter="drop-shadow(0 0 8px #FDF4FF)" />
      <polygon points="50,30 53,45 50,60 47,45" fill="#FFFFFF" />
    </>
  );
}

function ChampionIcon({ p }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}ch`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FEF08A" /><stop offset="50%" stopColor="#F97316" /><stop offset="100%" stopColor="#DC2626" /></linearGradient>
      </defs>
      <path d="M15 85 L85 85 L95 40 L70 60 L50 20 L30 60 L5 40 Z" fill={`url(#${p}ch)`} />
      <path d="M25 80 L75 80 L80 50 L70 65 L50 35 L30 65 L20 50 Z" fill="#FFF7ED" opacity="0.6" />
      <circle cx="50" cy="15" r="5" fill="#FFFFFF" filter="drop-shadow(0 0 10px #FFF)" />
      <circle cx="20" cy="35" r="4" fill="#FFFFFF" opacity="0.9" />
      <circle cx="80" cy="35" r="4" fill="#FFFFFF" opacity="0.9" />
      <rect x="25" y="75" width="50" height="6" fill="#7F1D1D" opacity="0.8" />
      <polygon points="45,60 55,60 50,70" fill="#EF4444" filter="drop-shadow(0 0 6px #EF4444)" />
    </>
  );
}

function UnrankedIcon() {
  return (
    <>
      <polygon points="50,5 90,25 90,65 50,95 10,65 10,25" fill="#4A5568" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <polygon points="50,25 70,35 70,55 50,70 30,55 30,35" fill="#2D3748" />
      <text x="50" y="55" textAnchor="middle" fill="#718096" fontSize="20" fontWeight="bold">?</text>
    </>
  );
}

const ICON_MAP = {
  unranked: UnrankedIcon,
  bronze: BronzeIcon,
  silver: SilverIcon,
  gold: GoldIcon,
  platinum: PlatinumIcon,
  diamond: DiamondIcon,
  master: MasterIcon,
  champion: ChampionIcon,
};

export default function TierIcon({ tier = 'unranked', size = 'md', className = '' }) {
  const uid = useId();
  // Replace ':' and '-' characters that SVG ID selectors don't handle well
  const p = uid.replace(/:/g, '').replace(/-/g, '') + '_';
  const px = typeof size === 'number' ? size : (SIZES[size] || size);
  const IconComponent = ICON_MAP[tier] || ICON_MAP.unranked;
  const colors = TIER_COLORS[tier] || TIER_COLORS.unranked;

  return (
    <svg
      viewBox="0 0 100 100"
      width={px}
      height={px}
      className={className}
      style={{ filter: `drop-shadow(0 4px 12px ${colors.secondary}aa)` }}
    >
      <IconComponent p={p} />
    </svg>
  );
}

export { TIER_COLORS };
