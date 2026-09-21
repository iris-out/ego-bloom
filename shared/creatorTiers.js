export const CREATOR_TIER_THRESHOLDS = [
  { key: 'bronze', name: 'Bronze', min: 0 },
  { key: 'silver', name: 'Silver', min: 12_000 },
  { key: 'gold', name: 'Gold', min: 85_000 },
  { key: 'platinum', name: 'Platinum', min: 868_500 },
  { key: 'diamond', name: 'Diamond', min: 20_000_000 },
  { key: 'master', name: 'Master', min: 50_000_000 },
  { key: 'grandmaster', name: 'Grandmaster', min: 120_000_000 },
  { key: 'champion', name: 'Champion', min: 250_000_000 },
];

export function getCreatorTierThreshold(score) {
  let tier = CREATOR_TIER_THRESHOLDS[0];
  for (let i = CREATOR_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= CREATOR_TIER_THRESHOLDS[i].min) {
      tier = CREATOR_TIER_THRESHOLDS[i];
      break;
    }
  }
  return tier;
}

export function getCreatorTierName(score) {
  return getCreatorTierThreshold(score).name.toUpperCase();
}
