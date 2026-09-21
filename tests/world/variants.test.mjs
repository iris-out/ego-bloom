import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchitecture, TIER_COLORS } from '../../src/world/cityModels.js';
import { modelVariant, VARIANT_NAMES } from '../../src/world/modelVariant.js';
import { lotOf, variantCountOf } from '../../src/world/models/tierBuildings.js';

test('explicit model_variant wins and ids spread over every model deterministically', () => {
  assert.equal(modelVariant({ id: 'x', model_variant: 4 }), 4);
  assert.equal(modelVariant({ id: 'x', model_variant: variantCountOf('bronze') }), modelVariant({ id: 'x' }));
  for (const tier of Object.keys(TIER_COLORS)) {
    const count = variantCountOf(tier);
    assert.equal(VARIANT_NAMES[tier].length, count, tier);
    const spread = new Set(Array.from({ length: 200 }, (_, i) => modelVariant({ id: `creator-${tier}-${i}`, tier_name: tier })));
    assert.deepEqual([...spread].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i), tier);
  }
});

test('all eight tiers build distinct models inside their lot with consistent ownership', () => {
  for (const tier_name of Object.keys(TIER_COLORS)) {
    const count = variantCountOf(tier_name);
    const signatures = [];
    for (let model_variant = 0; model_variant < count; model_variant++) {
      const source = { id: 'same', x: 0, z: 0, height: 90, tier_name, model_variant };
      const batches = buildArchitecture([source], 'low');
      assert.deepEqual(batches, buildArchitecture([source], 'low'));
      signatures.push(JSON.stringify(batches));
      for (const part of Object.values(batches).flatMap((b) => b.parts)) {
        assert.equal(part.owner, 'same');
        assert.ok([...part.position, ...part.scale, part.rotation].every(Number.isFinite));
        assert.ok(Math.abs(part.position[0]) <= lotOf(tier_name) / 2 + 1 && Math.abs(part.position[2]) <= lotOf(tier_name) / 2 + 1);
      }
    }
    assert.equal(new Set(signatures).size, count, tier_name);
  }
});

test('accent parts carry the tier colour and explicit colours pass through', () => {
  const championBatches = buildArchitecture([{ id: 'c', x: 0, z: 0, height: 120, tier_name: 'champion', model_variant: 0 }], 'medium');
  const championAccents = Object.values(championBatches).filter((b) => b.material === 'accent').flatMap((b) => b.parts);
  assert.ok(championAccents.some((p) => p.color === TIER_COLORS.champion));

  const bronzeBatches = buildArchitecture([{ id: 'b', x: 0, z: 0, height: 20, tier_name: 'bronze', model_variant: 0 }], 'medium');
  const bronzeAccents = Object.values(bronzeBatches).filter((b) => b.material === 'accent').flatMap((b) => b.parts);
  assert.ok(bronzeAccents.some((p) => p.color && p.color !== TIER_COLORS.bronze));
});
