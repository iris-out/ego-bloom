import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRPORT_OFFSET, AIRPORT_ROAD, FACILITIES, airportBoxes, airportCenter, carSpawn, walkSpawn } from '../../src/world/models/airportLayout.js';

const EXTENT = 300;

test('공항 중심은 도시 밖으로 AIRPORT_OFFSET 만큼 떨어진 거울 위치다', () => {
  assert.deepEqual(airportCenter(EXTENT, 1), { x: EXTENT + AIRPORT_OFFSET, z: 0 });
  assert.deepEqual(airportCenter(EXTENT, -1), { x: -(EXTENT + AIRPORT_OFFSET), z: 0 });
});

test('충돌 상자는 동서 양쪽으로 거울 변환되고 활주로, 유도로, 주차장은 빠진다', () => {
  const boxes = airportBoxes(EXTENT);
  const solidCount = FACILITIES.filter((f) => f.kind === 'building' || f.kind === 'tank').length;
  assert.equal(boxes.length, solidCount * 2);
  for (const box of boxes) {
    assert.ok(Number.isFinite(box.x) && Number.isFinite(box.z), '유한한 좌표');
    assert.ok(box.width > 0 && box.depth > 0, '충돌 상자는 넓이를 가진다');
  }
  // 동서 대칭이다. 같은 순서로 나오므로 짝을 맞춰 비교한다.
  const east = boxes.slice(0, solidCount), west = boxes.slice(solidCount);
  for (let i = 0; i < solidCount; i++) {
    assert.ok(Math.abs(east[i].x + west[i].x) < 1e-9, `x 대칭 ${east[i].x} ${west[i].x}`);
    assert.ok(Math.abs(east[i].z + west[i].z) < 1e-9, `z 대칭 ${east[i].z} ${west[i].z}`);
  }
});

test('어떤 충돌 상자도 활주로 띠(|x|<14, |z|<270)를 침범하지 않는다', () => {
  const boxes = airportBoxes(EXTENT);
  for (const side of [1, -1]) {
    const centerX = side * (EXTENT + AIRPORT_OFFSET);
    for (const box of boxes) {
      const localX = (box.x - centerX) * side;
      if (Math.abs(box.z) >= 270 + box.depth / 2) continue;
      assert.ok(Math.abs(localX) >= 14 + box.width / 2, `활주로를 침범한 상자 x=${localX}`);
    }
  }
});

test('새로 생긴 시설(격납고, 화물, 연료, 소방대, 레이더)은 헬리패드를 침범하지 않는다', () => {
  // 터미널, 캐노피, 관제탑은 원래도 헬리패드와 가깝게 붙어 있던 배치라 그 근접 관계를 그대로 -20 만큼만 옮겼다.
  // 여기서는 이번에 새로 추가되는 시설만 검사한다.
  const helipad = FACILITIES.find((f) => f.key === 'helipad');
  assert.ok(helipad, '헬리패드 정의가 있다');
  assert.equal(helipad.kind, 'pad', '헬리패드는 충돌 상자를 만드는 kind 가 아니다');
  assert.equal(helipad.x, -55);
  const NEW_KEYS = new Set(['hangar-1', 'hangar-2', 'cargo', 'fuel-1', 'fuel-2', 'fuel-3', 'fire-station', 'radar']);
  const padRadius = helipad.w / 2;
  for (const box of FACILITIES.filter((f) => NEW_KEYS.has(f.key))) {
    const half = box.kind === 'tank' ? box.r : box.w / 2;
    const dx = Math.max(0, Math.abs(box.x - helipad.x) - half - padRadius);
    const dz = Math.max(0, Math.abs(box.z - helipad.z) - (box.d ? box.d / 2 : half) - padRadius);
    assert.ok(dx > 0 || dz > 0, `헬리패드와 겹치는 새 시설 ${box.key}`);
  }
});

test('차량과 도보 출발점은 공항로 띠 위에 있고 도시를 향해 선다', () => {
  const car = carSpawn(EXTENT), walk = walkSpawn(EXTENT);
  const centerX = EXTENT + AIRPORT_OFFSET;
  for (const spawn of [car, walk]) {
    assert.equal(spawn.heading, Math.PI / 2, 'forward=(-sin h,-cos h)=(-1,0), 도시(-x) 방향');
  }
  const localCarX = car.x - centerX;
  assert.ok(localCarX >= AIRPORT_ROAD.localX0 && localCarX <= AIRPORT_ROAD.localX1, '공항로 x 범위 안');
  assert.ok(Math.abs(car.z - AIRPORT_ROAD.z) < 1e-9, '공항로 위 z');
});

test('차량과 도보 출발점은 어떤 공항 충돌 상자에도 들지 않고 최소 2m 여유를 둔다', () => {
  // WP9: 도보 출발점이 canopy 상자 안이라 사방이 막혔던 문제(wp9-brief.md)의 회귀 검사다.
  // extent 마다 상자와 출발점이 같은 양만큼 옮겨가므로 결과는 extent 에 무관해야 한다.
  for (const extent of [180, 1857, 2164]) {
    const boxes = airportBoxes(extent);
    for (const [label, spawn] of [['car', carSpawn(extent)], ['walk', walkSpawn(extent)]]) {
      for (const box of boxes) {
        const dx = Math.abs(spawn.x - box.x) - box.width / 2;
        const dz = Math.abs(spawn.z - box.z) - box.depth / 2;
        assert.ok(dx > 2 || dz > 2, `${label} 출발점(${spawn.x.toFixed(1)},${spawn.z.toFixed(1)})이 상자(${box.x.toFixed(1)},${box.z.toFixed(1)})에 너무 가깝다 (dx=${dx.toFixed(1)}, dz=${dz.toFixed(1)})`);
      }
    }
  }
});
