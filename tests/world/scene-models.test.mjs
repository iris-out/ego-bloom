import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchitecture } from '../../src/world/cityModels.js';

test('landmark geometry honors incoming heights above the former 70-unit limit', () => {
  for (const tier of ['champion', 'master']) {
    const batches = buildArchitecture([{ id: tier, x: 32, z: 32, height: 182, tier_name: tier }]);
    const parts = Object.values(batches).flatMap((batch) => batch.parts);
    const top = Math.max(...parts.map((part) => part.position[1] + part.scale[1] / 2));
    assert.ok(top >= 175 && top < 190, `${tier} roof height ${top}`);
    assert.ok(parts.every((part) => [...part.position, ...part.scale].every(Number.isFinite)));
  }
});
