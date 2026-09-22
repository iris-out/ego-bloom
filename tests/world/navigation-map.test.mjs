import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_ANCHOR, navigationRadius, stableHeading, tierMarker, toNavigationPoint,
  toNavigationSegment,
} from '../../src/world/navigationMap.js';

test('내비 반경은 정차 75m에서 300km/h 300m까지 단조롭게 넓어진다', () => {
  const samples = [0, 30, 80, 160, 300].map(navigationRadius);
  assert.deepEqual(samples, [75, 95, 140, 215, 300]);
  for (let index = 1; index < samples.length; index += 1) assert.ok(samples[index] >= samples[index - 1]);
  assert.equal(navigationRadius(Number.NaN), 75);
  assert.equal(navigationRadius(-40), 75);
  assert.equal(navigationRadius(900), 300);
});

test('헤딩업 투영은 진행 방향을 위로, 오른쪽 길을 오른쪽으로 보낸다', () => {
  const north = { x: 0, z: 0, heading: 0 };
  const ahead = toNavigationPoint({ x: 0, z: -50 }, north, 100);
  const right = toNavigationPoint({ x: 50, z: 0 }, north, 100);
  assert.deepEqual({ x: ahead.x, y: ahead.y }, { x: NAV_ANCHOR.x, y: 41 });
  assert.deepEqual({ x: right.x, y: right.y }, { x: 75, y: NAV_ANCHOR.y });

  // 동쪽(+X)을 향할 때 동쪽 점은 위, 남쪽(+Z) 점은 오른쪽이다.
  const east = { x: 0, z: 0, heading: 90 };
  const eastAhead = toNavigationPoint({ x: 50, z: 0 }, east, 100);
  const eastRight = toNavigationPoint({ x: 0, z: 50 }, east, 100);
  assert.ok(eastAhead.y < NAV_ANCHOR.y && Math.abs(eastAhead.x - NAV_ANCHOR.x) < 1e-9);
  assert.ok(eastRight.x > NAV_ANCHOR.x && Math.abs(eastRight.y - NAV_ANCHOR.y) < 1e-9);
});

test('지도 밖 점과 비정상 좌표는 유한한 숨김 좌표로 정규화한다', () => {
  assert.equal(toNavigationPoint({ x: 0, z: -500 }, { x: 0, z: 0, heading: 0 }, 100).visible, false);
  const invalid = toNavigationPoint({ x: NaN, z: Infinity }, { x: 0, z: 0, heading: 0 }, 100);
  assert.ok(Number.isFinite(invalid.x) && Number.isFinite(invalid.y));
  assert.equal(invalid.visible, false);
  const badPose = toNavigationPoint({ x: 5, z: -5 }, { x: NaN, z: Infinity, heading: NaN }, NaN);
  assert.ok(Number.isFinite(badPose.x) && Number.isFinite(badPose.y));
});

test('정차 중 헤딩은 마지막 방향을 유지하고 움직일 때만 새 방향을 쓴다', () => {
  assert.equal(stableHeading(275, 10, 0), 275);
  assert.equal(stableHeading(275, 10, 1.99), 275);
  assert.equal(stableHeading(275, 370, 2), 10);
  assert.equal(stableHeading(275, Number.NaN, 30), 275);
  assert.equal(stableHeading(Number.NaN, Number.NaN, 0), 0);
});

test('건물 티어는 서로 다른 내비 마커 모양과 크기를 쓴다', () => {
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const markers = tiers.map(tierMarker);
  assert.equal(new Set(markers.map((marker) => marker.shape)).size, tiers.length);
  assert.deepEqual(markers.map((marker) => marker.size), [0.9, 1, 1.1, 1.25, 1.4]);
  assert.deepEqual(tierMarker('unknown'), tierMarker('bronze'));
});

test('도로 선분은 두 끝이 밖에 있어도 화면을 가로지르면 표시한다', () => {
  const pose = { x: 0, z: 0, heading: 0 };
  const crossing = toNavigationSegment({ x: -180, z: -30 }, { x: 180, z: -30 }, pose, 100);
  assert.equal(crossing.visible, true);
  assert.ok(crossing.a.x < 0 && crossing.b.x > 100);

  const distant = toNavigationSegment({ x: 300, z: 300 }, { x: 400, z: 300 }, pose, 100);
  assert.equal(distant.visible, false);
});
