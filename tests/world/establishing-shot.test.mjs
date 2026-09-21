import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTABLISHING_FOV, establishingPose } from '../../src/world/establishingShot.js';
import { MAX_EXTENT, MIN_EXTENT, cityExtentForCount } from '../../shared/urbanPlan.js';

test('포즈는 extent 에 비례한다', () => {
  const small = establishingPose(MIN_EXTENT);
  const large = establishingPose(MAX_EXTENT);
  const ratio = MAX_EXTENT / MIN_EXTENT;
  for (const axis of [0, 1, 2]) {
    assert.ok(Math.abs(large.position[axis] / small.position[axis] - ratio) < 1e-6,
      `축 ${axis} 비례가 어긋난다`);
  }
  assert.equal(small.fov, ESTABLISHING_FOV);
});

test('카메라는 도시 남동쪽 상공에서 원점을 본다', () => {
  const pose = establishingPose(1000);
  assert.ok(pose.position[0] > 0, '동쪽');
  assert.ok(pose.position[2] > 0, '남쪽');
  assert.ok(pose.position[1] > 0, '상공');
  assert.deepEqual(pose.lookAt.map((v) => Math.round(v)), [0, 50, 0]);
});

test('도시 반대편 모서리가 화면 안에 들어온다', () => {
  for (const count of [1, 42, 1000, 5000]) {
    const extent = cityExtentForCount(count);
    const pose = establishingPose(extent);
    const [px, py, pz] = pose.position;
    // 카메라에서 본 방향과 가장 먼 모서리 방향 사이 각이 세로 화각 절반보다 작아야 담긴다.
    const toCentre = [-px, pose.lookAt[1] - py, -pz];
    const corner = [-extent - px, -py, -extent - pz];
    const dot = toCentre.reduce((sum, v, i) => sum + v * corner[i], 0);
    const angle = Math.acos(dot / (Math.hypot(...toCentre) * Math.hypot(...corner)));
    assert.ok(angle < (ESTABLISHING_FOV * Math.PI / 180) / 2 * 1.6,
      `인원 ${count} 에서 모서리가 화각 밖이다. ${(angle * 180 / Math.PI).toFixed(1)}도`);
  }
});

test('잘못된 값은 최소 extent 로 떨어진다', () => {
  assert.deepEqual(establishingPose(NaN), establishingPose(MIN_EXTENT));
  assert.deepEqual(establishingPose(-5), establishingPose(MIN_EXTENT));
  assert.deepEqual(establishingPose(undefined), establishingPose(MIN_EXTENT));
});
