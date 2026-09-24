import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../../shared/worldLayout.js';
import { hitsAnyBuilding, hitsBuilding } from '../../src/world/solidIndex.js';

const tiers = ['Champion', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
const buildings = buildWorld(Array.from({ length: 1000 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  nickname: `제작자 ${i}`, handle: `creator${i}`, elo_score: (1000 - i) * 100000, tier_name: tiers[i % 7],
})));
const extent = Math.max(...buildings.map((b) => Math.max(Math.abs(b.x), Math.abs(b.z)))) + 40;

// 결정적 의사난수다. 실패하면 같은 선분으로 다시 재현된다.
let seed = 7;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
const point = (y) => ({ x: (random() * 2 - 1) * extent, y, z: (random() * 2 - 1) * extent });

test('격자 판정은 전부 훑는 판정과 답이 같다', () => {
  let hits = 0;
  for (let i = 0; i < 4000; i++) {
    const from = point(random() * 60);
    // 짧은 이동, 사격 거리, 도시를 가로지르는 선분을 섞는다.
    const reach = [1.5, 40, 420, extent * 2][i % 4];
    const angle = random() * Math.PI * 2;
    const to = { x: from.x + Math.cos(angle) * reach, y: from.y + (random() - 0.5) * 20, z: from.z + Math.sin(angle) * reach };
    const expected = buildings.some((building) => hitsBuilding(from, to, building));
    assert.equal(hitsAnyBuilding(from, to, buildings), expected, `segment ${i}`);
    if (expected) hits++;
  }
  assert.ok(hits > 200, `충돌하는 선분이 충분히 섞여야 비교가 의미 있다 (${hits})`);
});

test('배열에 건물이 더해지면 격자를 새로 만든다', () => {
  const solids = buildings.slice(0, 200);
  const far = { x: extent * 3, y: 1, z: extent * 3 };
  assert.equal(hitsAnyBuilding({ ...far, x: far.x - 5 }, { ...far, x: far.x + 5 }, solids), false);
  solids.push({ x: far.x, z: far.z, height: 20, lot: 10 });
  assert.equal(hitsAnyBuilding({ ...far, x: far.x - 5 }, { ...far, x: far.x + 5 }, solids), true);
});

test('좌표가 숫자가 아니면 예전처럼 전부 훑는 판정을 따른다', () => {
  const from = { x: NaN, y: 1, z: 0 }, to = { x: 10, y: 1, z: 0 };
  assert.equal(hitsAnyBuilding(from, to, buildings), buildings.some((building) => hitsBuilding(from, to, building)));
});

test('격자 판정은 1000채 도시에서 전부 훑기보다 빠르다', () => {
  const segments = Array.from({ length: 3000 }, () => { const from = point(1.68); return [from, { x: from.x + 0.3, y: 1.68, z: from.z + 0.2 }]; });
  for (const [from, to] of segments) hitsAnyBuilding(from, to, buildings);
  let started = performance.now();
  for (const [from, to] of segments) hitsAnyBuilding(from, to, buildings);
  const grid = performance.now() - started;
  started = performance.now();
  for (const [from, to] of segments) buildings.some((building) => hitsBuilding(from, to, building));
  const linear = performance.now() - started;
  assert.ok(grid * 4 < linear, `grid ${grid.toFixed(2)}ms linear ${linear.toFixed(2)}ms`);
});

test('except 로 준 건물은 가림 판정에서 뺀다', () => {
  const target = buildings[10];
  const from = { x: target.x, y: target.height + 40, z: target.z };
  const to = { x: target.x, y: target.height / 2, z: target.z };
  assert.equal(hitsAnyBuilding(from, to, buildings), true);
  const others = buildings.filter((building) => building !== target);
  assert.equal(hitsAnyBuilding(from, to, buildings, target), others.some((building) => hitsBuilding(from, to, building)));
});

test('raised solids collide only across their actual bottom and top', () => {
  const raised = { x: 0, z: 0, width: 4, depth: 4, bottom: 5, height: 2, margin: 0, roofMargin: 0 };
  const segment = y => [{ x: -4, y, z: 0 }, { x: 4, y, z: 0 }];
  assert.equal(hitsAnyBuilding(...segment(4.9), [raised]), false);
  assert.equal(hitsAnyBuilding(...segment(5), [raised]), true);
  assert.equal(hitsAnyBuilding(...segment(7), [raised]), true);
  assert.equal(hitsAnyBuilding(...segment(7.1), [raised]), false);
  const legacy = { x: 0, z: 0, width: 4, depth: 4, height: 2, margin: 0, roofMargin: 0 };
  assert.equal(hitsAnyBuilding(...segment(-1), [legacy]), true);
  assert.equal(hitsAnyBuilding(...segment(2.1), [legacy]), false);
});
