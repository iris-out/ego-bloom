import test from 'node:test';
import assert from 'node:assert/strict';

import * as worldData from '../../server/worldData.js';

test('grandmaster uses master placement while preserving its displayed tier', () => {
  assert.deepEqual(worldData.resolveWorldTier?.({ elo_score: 120_000_000, tier_name: 'MASTER' }), {
    tierName: 'GRANDMASTER',
    layoutTierName: 'MASTER',
    heightScale: 1.2,
  });
});
