import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUrbanScenery } from '../../src/world/UrbanScenery.js';
import { hitsAnyBuilding } from '../../src/world/solidIndex.js';

const extent = 1600;

test('every visible riverfront floor uses the canonical walk triangles', () => {
  const scenery = buildUrbanScenery([], extent, 'low');
  const expected = scenery.plan.riverfront.surfaces.filter(surface => surface.kind !== 'road-bridge');
  for (const floor of expected) {
    const visible = scenery.surfaces.find(surface => surface.id === floor.id);
    assert.ok(visible, `missing ${floor.id}`);
    assert.equal(visible.mesh.indices.length, floor.triangles.length * 3);
    const actual = visible.mesh.indices.map(index => visible.mesh.positions.slice(index * 3, index * 3 + 3));
    assert.deepEqual(actual, floor.triangles.flat(), floor.id);
  }
  assert.equal(scenery.surfaces.some(surface => surface.id?.startsWith('surface-road-bridge')), false);
  assert.equal((scenery.batches['octagon-ground']?.parts || []).some(part => scenery.plan.islands.some(island =>
    part.position[0] === island.x && part.position[2] === island.z)), false);
});

test('low and high scenery share floors and riverfront obstacles exactly', () => {
  const low = buildUrbanScenery([], extent, 'low');
  const high = buildUrbanScenery([], extent, 'high');
  const floors = scene => scene.surfaces.filter(surface => surface.id?.startsWith('surface-'));
  assert.deepEqual(floors(low), floors(high));
  const riverObstacles = scene => scene.obstacles.filter(obstacle => obstacle.id?.startsWith('solid-culture-')
    || obstacle.id?.startsWith('gate-post-') || obstacle.id?.startsWith('bollard-'));
  assert.deepEqual(riverObstacles(low), low.plan.riverfront.obstacles);
  assert.deepEqual(riverObstacles(high), high.plan.riverfront.obstacles);
  assert.deepEqual(low.vehicleBarriers, low.plan.riverfront.vehicleBarriers);
  assert.deepEqual(high.vehicleBarriers, high.plan.riverfront.vehicleBarriers);
  const gate = low.vehicleBarriers[0];
  const ux = Math.sin(gate.rotation), uz = Math.cos(gate.rotation);
  const from = { x: gate.x - ux * 2, y: 1, z: gate.z - uz * 2 };
  const to = { x: gate.x + ux * 2, y: 1, z: gate.z + uz * 2 };
  assert.equal(hitsAnyBuilding(from, to, [gate]), true);
  assert.equal(hitsAnyBuilding(from, to, riverObstacles(low)), false);
});
