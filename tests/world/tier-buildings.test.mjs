import test from 'node:test';
import assert from 'node:assert/strict';
import { addTierBuilding, BUILDING_NAMES, LOW_RISE, TIER_HEIGHT_RANGE, lotOf, variantCountOf } from '../../src/world/models/tierBuildings.js';
import { CIVIC_BUILDINGS } from '../../src/world/models/civicBuildings.js';
import { QUALITY, TIER_COLORS, createBatches } from '../../src/world/cityModels.js';

const TIERS = Object.keys(TIER_COLORS);
const RADIAL = ['cylinder', 'cone', 'octagon', 'spire', 'trunk', 'tree', 'dome', 'hill'];

// Footprint half-extents along world X/Z after the Y rotation; radial shapes use unit radius.
function extents(part) {
  if (RADIAL.includes(part.shape)) return [part.scale[0], part.scale[2]];
  const w = part.scale[0] / 2, d = part.scale[2] / 2;
  const c = Math.abs(Math.cos(part.rotation)), s = Math.abs(Math.sin(part.rotation));
  return [c * w + s * d, s * w + c * d];
}

function collect(tier, variant, h, quality = 'medium') {
  const { batches, add } = createBatches();
  const part = (mat, dx, y, dz, w, height, d, shape = 'box', rotation = 0, color) =>
    add(mat, [dx, y + 0.5, dz], [w, height, d], 'owner', shape, rotation, color);
  const built = addTierBuilding(tier, variant, h, part, QUALITY[quality]);
  return { built, parts: Object.values(batches).flatMap((batch) => batch.parts.map((part) => ({ ...part, shape: batch.shape }))) };
}

// 티어마다 변형 수가 다를 수 있어 0..variantCountOf(tier)-1 을 매번 새로 만든다.
const variantsOf = (tier) => Array.from({ length: variantCountOf(tier) }, (_, i) => i);

test('every tier has named models that build deterministically', () => {
  for (const tier of TIERS) {
    const count = variantCountOf(tier);
    assert.equal(BUILDING_NAMES[tier].length, count, tier);
    const signatures = new Set();
    for (const variant of variantsOf(tier)) {
      const first = collect(tier, variant, 48);
      const second = collect(tier, variant, 48);
      assert.ok(first.built, `${tier} ${variant}`);
      assert.deepEqual(first.parts, second.parts);
      signatures.add(JSON.stringify(first.parts));
    }
    assert.equal(signatures.size, count, tier);
  }
});

test('unknown tiers or variants are refused instead of drawing garbage', () => {
  assert.equal(collect('bronze', variantCountOf('bronze'), 30).built, false);
  assert.equal(collect('platinum-plus', 0, 30).built, false);
});

test('parts stay finite, positive and inside the lot at every tier height', () => {
  for (const tier of TIERS) for (const variant of variantsOf(tier)) {
    const [low, high] = TIER_HEIGHT_RANGE[tier];
    for (const h of [low, (low + high) / 2, high]) {
      const { parts } = collect(tier, variant, h, 'high');
      for (const part of parts) {
        assert.ok([...part.position, ...part.scale, part.rotation].every(Number.isFinite), `${tier} ${variant}`);
        assert.ok(part.scale.every((n) => n > 0), `${tier} ${variant} scale`);
        const [ex, ez] = extents(part);
        assert.ok(Math.abs(part.position[0]) + ex <= lotOf(tier) / 2 + 0.01, `${tier} ${variant} x overflow`);
        assert.ok(Math.abs(part.position[2]) + ez <= lotOf(tier) / 2 + 0.01, `${tier} ${variant} z overflow`);
        assert.ok(part.position[1] - part.scale[1] / 2 >= -0.3, `${tier} ${variant} below ground`);
      }
      const top = Math.max(...parts.map((part) => part.position[1] + part.scale[1] / 2));
      if (LOW_RISE[tier]?.includes(variant)) assert.ok(top >= 6 && top <= Math.max(24, h), `${tier} ${variant} low-rise top ${top}`);
      else assert.ok(top >= h * 0.95 && top <= h * 1.3 + 4, `${tier} ${variant} top ${top} for h ${h}`);
    }
  }
});

test('part counts respect the quality budget for instancing', () => {
  const limits = { low: 90, medium: 150, high: 220 }, campus = { low: 150, medium: 250, high: 360 };
  for (const [quality, limit] of Object.entries(limits)) for (const tier of TIERS) for (const variant of variantsOf(tier)) {
    const { parts } = collect(tier, variant, TIER_HEIGHT_RANGE[tier][1], quality);
    assert.ok(parts.length <= (tier === 'champion' ? campus[quality] : limit), `${tier} ${variant} ${quality} uses ${parts.length} parts`);
  }
});

test('civic buildings build at any origin without owners and stay inside their plot', () => {
  for (const [key, civic] of Object.entries(CIVIC_BUILDINGS)) {
    for (const quality of ['low', 'high']) {
      const { batches, add } = createBatches();
      civic.build(add, 100, -50, quality);
      const parts = Object.values(batches).flatMap((batch) => batch.parts.map((part) => ({ ...part, shape: batch.shape })));
      assert.ok(parts.length > 8, key);
      for (const part of parts) {
        assert.equal(part.owner, null, key);
        assert.ok([...part.position, ...part.scale].every(Number.isFinite), key);
        const [ex, ez] = extents(part);
        assert.ok(Math.abs(part.position[0] - 100) + ex <= civic.size[0] / 2 + 0.01, `${key} x`);
        assert.ok(Math.abs(part.position[2] + 50) + ez <= civic.size[1] / 2 + 0.01, `${key} z`);
      }
    }
    assert.ok(typeof civic.name === 'string' && civic.name.length > 0);
  }
});
