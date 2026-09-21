import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLabelIds } from '../../src/world/labelCandidates.js';

const buildings = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, x: i * 10, z: 0, height: 20 }));

function pick(overrides = {}) {
  return pickLabelIds({
    buildings,
    anchorOf: (building) => ({ x: building.x, y: building.height + 7, z: building.z }),
    distanceOf: (building) => building.x,
    reachOf: () => 200,
    project: () => ({ x: 0, y: 0, z: 0.5 }),
    isOccluded: () => false,
    limit: 6,
    ...overrides,
  });
}

test('가까운 순서로 limit 만큼 고른다', () => {
  assert.deepEqual(pick(), ['b0', 'b1', 'b2', 'b3', 'b4', 'b5']);
});

test('reach 밖은 후보에 넣지 않는다', () => {
  assert.deepEqual(pick({ reachOf: () => 25, limit: 6 }), ['b0', 'b1', 'b2']);
});

test('화면 밖으로 투영되면 뺀다', () => {
  const ids = pick({ project: (point) => ({ x: point.x > 25 ? 1.4 : 0, y: 0, z: 0.5 }) });
  assert.deepEqual(ids, ['b0', 'b1', 'b2']);
});

test('깊이가 절두체 밖이면 뺀다', () => {
  assert.deepEqual(pick({ project: () => ({ x: 0, y: 0, z: 1.2 }) }), []);
});

test('가린 건물은 건너뛰고 다음 후보로 채운다', () => {
  const ids = pick({ limit: 3, isOccluded: (_point, building) => ['b0', 'b2'].includes(building.id) });
  assert.deepEqual(ids, ['b1', 'b3', 'b4']);
});

test('고른 제작자는 멀어도 먼저 온다', () => {
  const ids = pick({ selectedId: 'b20', limit: 3 });
  assert.deepEqual(ids, ['b20', 'b0', 'b1']);
});

test('가림 판정은 앞쪽 후보 몇 개만 본다', () => {
  let probes = 0;
  const ids = pick({ limit: 6, isOccluded: () => { probes += 1; return true; } });
  assert.deepEqual(ids, []);
  assert.ok(probes <= 14, `가림 판정 ${probes}회`);
});
