import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUrbanScenery, npcSolids } from '../../src/world/UrbanScenery.js';
import { guardrails } from '../../src/world/roadFurniture.js';
import { clearOfRoads, createUrbanPlan, surfaceRoadIndex } from '../../shared/urbanPlan.js';
import { buildWorld } from '../../shared/worldLayout.js';
import { hitsAnyBuilding, hitsBuilding } from '../../src/world/solidIndex.js';
import { NPC_OPEN, NPC_PLAN } from '../../src/world/models/npcBuildings.js';
import { airportBoxes } from '../../src/world/models/airportLayout.js';
import { createCarState, slideAlongWall, stepCar } from '../../src/world/carPhysics.js';

const EXTENT = 900;
const TIERS = ['Champion', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
const rows = (count) => Array.from({ length: count }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  nickname: `제작자 ${i}`, handle: `creator${i}`, elo_score: (count - i) * 100000, tier_name: TIERS[i % 7],
}));

/** 레일 조각의 중심선을 1 간격으로 훑는다. 상자가 얇아 중심만 보면 걸치는 조각을 놓친다. */
function railSamples(part) {
  const [, position, scale, , , rotation] = part;
  const length = scale[2], ux = Math.sin(rotation || 0), uz = Math.cos(rotation || 0);
  const points = [];
  for (let d = -length / 2; d <= length / 2 + 1e-6; d += 1) points.push({ x: position[0] + ux * d, z: position[2] + uz * d });
  return points;
}

test('가드레일은 다른 도로 노면을 가로지르지 않는다', () => {
  const plan = createUrbanPlan(EXTENT);
  const index = surfaceRoadIndex(plan);
  const { parts } = guardrails(plan, 'medium');
  let samples = 0;
  for (const part of parts) {
    // 로터리 연석은 섬 위에 있고 레일이 아니다.
    if (part[2][0] > 1) continue;
    for (const point of railSamples(part)) {
      samples += 1;
      assert.ok(clearOfRoads(index, point.x, point.z, 0), `레일이 노면 위에 있다 (${point.x.toFixed(1)}, ${point.z.toFixed(1)})`);
    }
  }
  assert.ok(samples > 2000, `레일 표본이 ${samples} 개뿐이다`);
});

test('가드레일은 강변과 순환로와 공항로에 남는다', () => {
  const plan = createUrbanPlan(EXTENT);
  const { parts, solids } = guardrails(plan, 'medium');
  assert.ok(parts.length > 100, `조각이 ${parts.length} 개다`);
  assert.equal(solids.length, parts.filter((part) => part[2][0] <= 1).length, '연석을 뺀 레일마다 충돌 상자가 하나다');
  for (const solid of solids) {
    assert.ok(solid.margin < 1, '레일 여유는 차선을 먹지 않을 만큼 좁다');
    assert.ok(Number.isFinite(solid.rotation), '레일은 돌아간 상자다');
  }
});

test('돌아간 상자는 긴 쪽만 막는다', () => {
  const rail = { x: 0, z: 0, height: 1.1, width: 0.2, depth: 20, rotation: Math.PI / 2, margin: 0.3 };
  // 레일이 x 축을 따라 눕는다. 가로지르면 막히고 나란히 지나가면 지나간다.
  assert.ok(hitsBuilding({ x: 3, y: 1, z: -4 }, { x: 3, y: 1, z: 4 }, rail), '가로지르면 막힌다');
  assert.ok(!hitsBuilding({ x: -20, y: 1, z: 5 }, { x: 20, y: 1, z: 5 }, rail), '5 만큼 떨어져 나란히 가면 지나간다');
  // 같은 상자를 축 정렬로 보면 20x20 이 되어 옆 차선까지 막힌다. 회전을 봐야 한다.
  const square = { ...rail, rotation: 0, width: 20, depth: 20 };
  assert.ok(hitsBuilding({ x: -20, y: 1, z: 5 }, { x: 20, y: 1, z: 5 }, square));
});

test('충돌 여유는 상자마다 다르게 준다', () => {
  const wide = { x: 0, z: 0, height: 10, width: 10, depth: 10 };
  const tight = { ...wide, margin: 0.3 };
  const path = [{ x: -20, y: 1, z: 7 }, { x: 20, y: 1, z: 7 }];
  assert.ok(hitsBuilding(path[0], path[1], wide), '기본 여유 3 이면 7 에서 막힌다');
  assert.ok(!hitsBuilding(path[0], path[1], tight), '여유 0.3 이면 7 에서 지나간다');
});

test('배경 건물은 막히고 공터와 주차장은 뚫린다', () => {
  const buildings = buildWorld(rows(200));
  const solids = npcSolids(buildings);
  assert.ok(solids.length > 100, `배경 건물 상자가 ${solids.length} 개다`);
  for (const solid of solids) {
    assert.ok([solid.x, solid.z, solid.width, solid.depth].every(Number.isFinite));
    assert.ok(solid.width > 4 && solid.width < 100, `상자 폭 ${solid.width}`);
    assert.ok(solid.margin <= 1, '배경 건물 여유는 골목을 먹지 않는다');
  }
  // 열린 종류는 도면 폭이 있어도 상자를 만들지 않는다.
  assert.ok(NPC_OPEN.has('parking') && NPC_OPEN.has('pocketPark'));
  for (const kind of NPC_OPEN) assert.ok(NPC_PLAN[kind] > 0, `${kind} 는 도면이 있는 종류다`);
});

test('랜드마크는 몸통만 막고 바닥판은 막지 않는다', () => {
  const { obstacles } = buildUrbanScenery(buildWorld(rows(200)), EXTENT, 'medium');
  const masses = obstacles.filter((solid) => solid.margin === 1);
  assert.ok(masses.length > 10, `랜드마크 몸통 상자가 ${masses.length} 개다`);
  for (const mass of masses) {
    assert.ok(mass.height >= 4, `높이 ${mass.height} 짜리 바닥판이 섞였다`);
    assert.ok(Math.min(mass.width, mass.depth) >= 2.5, '가는 깃대는 상자를 만들지 않는다');
  }
});

test('벽을 비스듬히 스치면 따라 미끄러지고 정면으로 박으면 선다', () => {
  const wall = { x: 0, z: 0, height: 12, width: 6, depth: 60, margin: 0 };
  const from = { x: -5, y: 1.2, z: 0 };
  // 벽을 향해 비스듬히 들어간다. x 는 막히고 z 는 열려 있다.
  const slid = slideAlongWall(from, { x: -2, y: 1.2, z: 4 }, [wall]);
  assert.ok(slid, '비스듬히 닿으면 미끄러진다');
  assert.equal(slid.x, from.x, '막힌 축은 그대로다');
  assert.equal(slid.z, 4, '열린 축으로는 간다');
  // 정면으로 박으면 둘 다 막힌다.
  assert.equal(slideAlongWall(from, { x: 1, y: 1.2, z: 0 }, [wall]), null);
});

test('벽을 스치는 동안 차가 서지 않는다', () => {
  const home = createCarState(EXTENT);
  // 진행 방향 왼쪽에 벽을 세우고 벽 쪽으로 조금 꺾어 붙인다.
  const forward = { x: home.x - Math.sin(home.heading) * 30, z: home.z - Math.cos(home.heading) * 30 };
  const wall = { x: forward.x, z: forward.z + 7, height: 12, width: 80, depth: 4, margin: 0 };
  let state = { ...home, speed: 20 };
  for (let i = 0; i < 90; i += 1) state = stepCar(state, { throttle: 1, steer: -0.25 }, 1 / 30, EXTENT, [wall]);
  assert.equal(state.phase, 'drive');
  const travelled = Math.hypot(state.x - home.x, state.z - home.z);
  assert.ok(travelled > 30, `벽을 스치며 ${travelled.toFixed(1)} 만 갔다`);
});

test('도시 전체 충돌 배열에서도 같은 판정이 나온다', () => {
  const buildings = buildWorld(rows(300));
  const { obstacles } = buildUrbanScenery(buildings, EXTENT, 'medium');
  const solids = [...buildings, ...obstacles, ...npcSolids(buildings)];
  assert.ok(solids.length > 1000, `충돌 상자가 ${solids.length} 개다`);
  const first = solids.find((solid) => Number.isFinite(solid.x) && Number.isFinite(solid.z) && solid.height > 4);
  const through = { x: first.x, y: 1.2, z: first.z };
  assert.ok(hitsAnyBuilding({ x: first.x - 200, y: 1.2, z: first.z }, through, solids), '격자로도 막힌다');
});

test('모든 지상 도로 중심선이 충돌 상자에서 비어 있다', () => {
  const buildings = buildWorld(rows(300));
  // 도시 크기는 배치가 정한다. 다른 값으로 지으면 도로와 건물이 서로 다른 도시의 것이 된다.
  const extent = Math.max(180, ...buildings.map((building) => building.cityExtent || 0));
  const { obstacles } = buildUrbanScenery(buildings, extent, 'medium');
  const solids = [...buildings, ...obstacles, ...airportBoxes(extent), ...npcSolids(buildings)];
  const plan = createUrbanPlan(extent);
  const blocked = [];
  let samples = 0;
  for (const road of plan.roads) {
    if (road.elevated) continue;
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length = Math.hypot(dx, dz) || 1;
    for (let d = 0; d <= length; d += 4) {
      const t = d / length, point = { x: road.x1 + dx * t, y: 1.2, z: road.z1 + dz * t };
      samples += 1;
      if (hitsAnyBuilding(point, point, solids)) blocked.push(`${road.id || road.kind} (${point.x.toFixed(0)}, ${point.z.toFixed(0)})`);
    }
  }
  assert.ok(samples > 10000, `중심선 표본이 ${samples} 개뿐이다`);
  assert.deepEqual(blocked.slice(0, 5), [], `막힌 자리 ${blocked.length} 곳`);
});
