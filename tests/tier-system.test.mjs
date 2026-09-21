import test from 'node:test';
import assert from 'node:assert/strict';

import * as rankingApi from '../api/get-rankings.js';
import * as updateCreatorApi from '../api/update-creator.js';
import { getCreatorTier } from '../src/utils/tierCalculator.js';
import { formatTierDivision, getCreatorTierMeta } from '../src/design/tiers.js';

test('fixed upper-tier cuts spread high scores across diamond through champion', () => {
  const cases = [
    [19_999_999, 'platinum'],
    [20_000_000, 'diamond'],
    [49_999_999, 'diamond'],
    [50_000_000, 'master'],
    [119_999_999, 'master'],
    [120_000_000, 'grandmaster'],
    [249_999_999, 'grandmaster'],
    [250_000_000, 'champion'],
  ];

  for (const [score, expected] of cases) {
    assert.equal(getCreatorTier(score).key, expected, `${score} should be ${expected}`);
  }
});

test('grandmaster has display metadata and divisions', () => {
  const meta = getCreatorTierMeta('GRANDMASTER');
  assert.equal(meta?.code, 'GM');
  assert.equal(formatTierDivision(meta, 4), '그랜드마스터 IV');
});

test('server writes and ranking responses use the same tier boundaries as the client', () => {
  const cases = [
    [20_000_000, 'DIAMOND'],
    [50_000_000, 'MASTER'],
    [120_000_000, 'GRANDMASTER'],
    [250_000_000, 'CHAMPION'],
  ];

  for (const [eloScore, expected] of cases) {
    assert.equal(updateCreatorApi.getCreatorTierName?.(eloScore), expected);
    assert.equal(
      rankingApi.tierNameForRanking?.({ elo_score: eloScore, tier_name: 'MASTER' }),
      expected,
    );
  }
});
