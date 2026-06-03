// Shared metadata + color anchors for tier-icon theme mockups.
// Every theme component renders the SAME tier ladder using these anchors,
// interpreting them in its own visual language so the variations stay
// comparable tier-for-tier on the /tier-preview test gallery.

export const SIZES = { sm: 36, md: 50, lg: 64, xl: 92 };

export function resolveSize(size) {
  return typeof size === 'number' ? size : (SIZES[size] || 50);
}

// Ordered tier ladder (matches CREATOR_TIERS in utils/tierCalculator.js).
export const TIERS = [
  { key: 'unranked', name: 'Unranked', index: 0 },
  { key: 'bronze', name: 'Bronze', index: 1 },
  { key: 'silver', name: 'Silver', index: 2 },
  { key: 'gold', name: 'Gold', index: 3 },
  { key: 'platinum', name: 'Platinum', index: 4 },
  { key: 'diamond', name: 'Diamond', index: 5 },
  { key: 'master', name: 'Master', index: 6 },
  { key: 'champion', name: 'Champion', index: 7 },
];

// Color anchors per tier. Each theme decides HOW to use these
// (metal, gem, neon, glass, etc.) but the hue progression is shared.
// glow = recommended outer-glow / particle color. effect = escalation level 0..3.
export const TIER_ANCHORS = {
  unranked: { primary: '#4A5568', secondary: '#2D3748', accent: '#718096', glow: 'transparent', effect: 0 },
  bronze:   { primary: '#EAA678', secondary: '#C58356', accent: '#8B4513', glow: '#C58356', effect: 1 },
  silver:   { primary: '#E5E7EB', secondary: '#9CA3AF', accent: '#4B5563', glow: '#D1D5DB', effect: 1 },
  gold:     { primary: '#FDE68A', secondary: '#F59E0B', accent: '#B45309', glow: '#FBBF24', effect: 2 },
  platinum: { primary: '#FFFFFF', secondary: '#CBD5E1', accent: '#64748B', glow: '#E2E8F0', effect: 2 },
  diamond:  { primary: '#EFF6FF', secondary: '#60A5FA', accent: '#2563EB', glow: '#93C5FD', effect: 3 },
  master:   { primary: '#FDF4FF', secondary: '#E879F9', accent: '#701A75', glow: '#E879F9', effect: 3 },
  champion: { primary: '#FEF08A', secondary: '#F97316', accent: '#DC2626', glow: '#F97316', effect: 3 },
};

// Special-rank treatments layered on top of any theme.
// rank === 1  -> apex (#1)
// rank 2..10  -> top-10 prestige
export const SPECIAL = {
  rank1: { label: '#1', glow: '#FFD700' },
  top10: { label: 'Top 10', glow: '#00F0FF' },
};

export function rankKind(rank) {
  if (rank === 1) return 'rank1';
  if (typeof rank === 'number' && rank >= 2 && rank <= 10) return 'top10';
  return null;
}

// Theme registry metadata (components wired up in index.js).
// Two families × 4 variations (simple → ornate). Tier shape grows per rank.
export const THEME_META = [
  // ── Constellation family — 별자리가 티어별 광물 형태를 그림 (마스터·챔피언은 왕관) ──
  { id: 'constellation-min', name: 'Constellation · Minimal', ko: '별자리 · 미니멀', family: 'Constellation', variant: '미니멀' },
  { id: 'constellation-balance', name: 'Constellation · Balanced', ko: '별자리 · 밸런스', family: 'Constellation', variant: '밸런스' },
  { id: 'constellation-glow', name: 'Constellation · Glow', ko: '별자리 · 글로우', family: 'Constellation', variant: '글로우' },
  { id: 'constellation-ornate', name: 'Constellation · Ornate', ko: '별자리 · 오너트', family: 'Constellation', variant: '오너트' },
  // ── Celestial Body family — 티어별 천체 (소행성→달→행성→고리행성→별→펄사→초신성) ──
  { id: 'celestial-min', name: 'Celestial · Minimal', ko: '천체 · 미니멀', family: 'Cosmic', variant: '미니멀' },
  { id: 'celestial-balance', name: 'Celestial · Balanced', ko: '천체 · 밸런스', family: 'Cosmic', variant: '밸런스' },
  { id: 'celestial-glow', name: 'Celestial · Glow', ko: '천체 · 글로우', family: 'Cosmic', variant: '글로우' },
  { id: 'celestial-ornate', name: 'Celestial · Ornate', ko: '천체 · 오너트', family: 'Cosmic', variant: '오너트' },
];
