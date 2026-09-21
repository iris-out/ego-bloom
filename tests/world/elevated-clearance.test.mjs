import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUrbanScenery } from '../../src/world/UrbanScenery.js';
import { clearOfRoads, createUrbanPlan, surfaceRoadIndex, HIGHWAY_DECK } from '../../shared/urbanPlan.js';
import { ROAD_STRUCTURE_DEFAULTS } from '../../src/world/models/roadStructures.js';
import { createCarState, stepCar } from '../../src/world/carPhysics.js';

const EXTENT = 900;

/** 상판 하나가 차지하는 세로 폭이다. 밑면 보가 아래로, 난간이 위로 붙는다. */
function deckEnvelope(deckY) {
  const D = ROAD_STRUCTURE_DEFAULTS;
  return { bottom: deckY - D.deckThickness / 2 - 0.55 - 1.1 / 2, top: deckY + D.deckThickness / 2 + D.guardHeight };
}

test('순환로와 방사선은 같은 상판 높이에서 JC로 이어진다', () => {
  const plan = createUrbanPlan(EXTENT);
  const levels = new Map();
  for (const road of plan.roads) if (road.elevated) levels.set(road.id.replace(/-\d+$/, ''), road.deckY);
  assert.ok(levels.size >= 2, `고가 갈래가 ${levels.size} 개다`);
  assert.equal(levels.get('highway'), HIGHWAY_DECK, '순환로는 기준 높이다');
  for (const [id, deckY] of levels) assert.equal(deckY,HIGHWAY_DECK,`${id} 가 JC 높이에서 끊겼다`);
});

test('고가 도로망은 하나의 연결된 높이를 쓴다', () => {
  const plan = createUrbanPlan(EXTENT);
  const heights = [...new Set(plan.roads.filter((road) => road.elevated).map((road) => road.deckY))].sort((a, b) => a - b);
  assert.deepEqual(heights,[HIGHWAY_DECK]);
  assert.ok(deckEnvelope(HIGHWAY_DECK).bottom<deckEnvelope(HIGHWAY_DECK).top);
});

test('고가 교각이 지상 도로 한복판에 서지 않는다', () => {
  const plan = createUrbanPlan(EXTENT);
  const index = surfaceRoadIndex(plan);
  for (const quality of ['low', 'medium', 'high']) {
    const { obstacles } = buildUrbanScenery([], EXTENT, quality);
    assert.ok(obstacles.length > 0, `${quality} 에서 구조물이 나온다`);
    // 사장교 주탑은 다리 상판 위 중앙분리대에 선다. 지상 도로 판정에서 빼고 본다.
    const piers = obstacles.filter((item) => item.height < 30);
    const blocking = piers.filter((pier) => !clearOfRoads(index, pier.x, pier.z, 0));
    assert.equal(blocking.length, 0, `${quality} 에서 도로 위에 선 교각이 없다`);
  }
});

test('구조물에 부딪히면 차가 터지지 않고 멈춘다', () => {
  const { obstacles } = buildUrbanScenery([], EXTENT, 'medium');
  const pier = obstacles.find((item) => item.height < 30);
  assert.ok(pier, '교각이 하나는 있다');
  // 교각 남쪽에서 북쪽(heading 0 은 -Z) 으로 달려 들어간다.
  let car = { ...createCarState(EXTENT), x: pier.x, z: pier.z + 14, heading: 0, speed: 20, phase: 'drive' };
  for (let step = 0; step < 60 && car.speed > 0; step += 1) {
    car = stepCar(car, { throttle: 1 }, 1 / 60, EXTENT, [pier], 'sedan', []);
  }
  assert.equal(car.speed, 0, '멈춘다');
  assert.equal(car.phase, 'drive', '터지지 않는다');
  assert.equal(car.message, '막혔다');
  assert.ok(car.z > pier.z, '교각을 통과하지 않는다');
});

test('구조물이 없으면 그대로 달린다', () => {
  let car = { ...createCarState(EXTENT), x: 0, z: 0, heading: 0, speed: 20, phase: 'drive' };
  for (let step = 0; step < 30; step += 1) car = stepCar(car, { throttle: 1 }, 1 / 60, EXTENT, [], 'sedan', []);
  assert.ok(car.speed > 0);
  assert.equal(car.message, '');
});

test('도로 옆 빈 자리는 교각을 세울 수 있다고 본다', () => {
  const plan = createUrbanPlan(EXTENT);
  const index = surfaceRoadIndex(plan);
  const road = plan.roads.find((item) => !item.elevated && item.kind === 'arterial');
  const mid = { x: (road.x1 + road.x2) / 2, z: (road.z1 + road.z2) / 2 };
  assert.equal(clearOfRoads(index, mid.x, mid.z, 0), false, '도로 한복판은 막힌다');
  assert.equal(clearOfRoads(index, 1e6, 1e6, 0), true, '도시 밖은 비어 있다');
  assert.equal(clearOfRoads(index, NaN, 0, 0), false, '비정상 좌표는 막는다');
});
