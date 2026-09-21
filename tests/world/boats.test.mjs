import test from 'node:test';
import assert from 'node:assert/strict';
import { BOAT_Y, boatPose, boatRoutes } from '../../shared/coast.js';
import { LEVELS } from '../../shared/elevation.js';

/** src/world/models/Boat.jsx 가 boatPose 결과로 인스턴스 행렬을 만들 때 쓰는 계약만
 * 검사한다. Boat.jsx 는 Three 와 React 를 부르므로 이 파일에서 직접 import 하지 않는다.
 * instancedMesh 갱신이나 geometry 병합 같은 렌더 자체는 이 테스트로 확인하지 않았다. */
const E = 1500;
const BOAT_KINDS = ['sail', 'ferry', 'cargo'];

test('boatPose 가 Boat.jsx 가 쓰는 다섯 필드를 전부 낸다', () => {
  for (const route of boatRoutes(E)) {
    const pose = boatPose(route, 42);
    assert.equal(Object.keys(pose).sort().join(), 'angle,kind,x,y,z');
    assert.ok(Number.isFinite(pose.x), 'x 가 숫자가 아니다');
    assert.ok(Number.isFinite(pose.y), 'y 가 숫자가 아니다');
    assert.ok(Number.isFinite(pose.z), 'z 가 숫자가 아니다');
    assert.ok(Number.isFinite(pose.angle), 'angle 이 숫자가 아니다');
    assert.ok(BOAT_KINDS.includes(pose.kind), `kind ${pose.kind} 를 모른다`);
  }
});

test('세 종류(sail, ferry, cargo) 항로가 전부 최소 하나씩 있다', () => {
  // Boat.jsx 의 quality 상한(BOAT_LIMITS)은 low 에서도 종류마다 하나를 그대로 요구한다.
  // 항로가 하나도 없는 종류가 생기면 그 instancedMesh 는 인스턴스 수 0으로 비어 렌더가 깨진다.
  const routes = boatRoutes(E);
  for (const kind of BOAT_KINDS) {
    const count = routes.filter((route) => route.kind === kind).length;
    assert.ok(count >= 1, `${kind} 항로가 없다`);
  }
});

test('배는 흘수만큼 물 밑, 상부 구조는 물 위로 걸치는 높이에 뜬다', () => {
  // Boat.jsx 로컬 원점(y=0)이 곧 BOAT_Y 다. 종류별 흘수와 프리보드는 Boat.jsx 의
  // buildSail/buildFerry/buildCargo 선체 치수(hull box 의 중심과 높이)에서 그대로 옮겼다.
  const drafts = { sail: 0.6, ferry: 1.0, cargo: 1.2 };
  const freeboards = { sail: 0.3, ferry: 0.8, cargo: 0.6 };
  for (const route of boatRoutes(E)) {
    const pose = boatPose(route, 3);
    assert.equal(pose.y, BOAT_Y);
    const hullBottom = pose.y - drafts[pose.kind];
    const deckTop = pose.y + freeboards[pose.kind];
    assert.ok(hullBottom < LEVELS.WATER, `${pose.kind} 선저가 수면 위에 떠 있다`);
    assert.ok(deckTop > LEVELS.WATER, `${pose.kind} 갑판이 물에 잠겼다`);
  }
});

test('항로마다 시각에 따라 원을 그리고 각도가 유한하다', () => {
  for (const route of boatRoutes(E)) {
    const now = boatPose(route, 0), later = boatPose(route, 250);
    assert.notEqual(now.x, later.x, `${route.id} 가 시간이 지나도 안 움직인다`);
    assert.ok(Number.isFinite(now.angle) && Number.isFinite(later.angle));
    assert.equal(Math.hypot(now.x, now.z).toFixed(3), route.radius.toFixed(3));
  }
});
