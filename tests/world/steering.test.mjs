import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_STEER, steerAngle } from '../../src/world/models/carGeometry.js';
import { createCarState, stepCar } from '../../src/world/carPhysics.js';

/** 앞바퀴가 가리키는 방향과 차가 도는 방향이 같아야 한다. 예전에는 부호가 반대라
 * 오른쪽으로 돌 때 앞바퀴가 왼쪽을 가리켰다. */

/** 모델 로컬에서 yaw θ 인 바퀴의 진행 방향이다. 전진이 -Z 라는 규약을 그대로 쓴다. */
const wheelForward = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

test('steerAngle 은 입력을 -1 에서 1 로 자르고 부호를 뒤집는다', () => {
  // -0 도 0 이다. Object.is 로 갈리지 않게 값으로만 본다.
  assert.ok(steerAngle(0) === 0);
  assert.ok(steerAngle(1) < 0);
  assert.ok(steerAngle(-1) > 0);
  assert.equal(steerAngle(2), steerAngle(1));
  assert.equal(steerAngle(-2), steerAngle(-1));
  assert.equal(steerAngle(1, 0.45), -0.45);
  assert.equal(steerAngle(1), -MAX_STEER);
});

test('D 로 오른쪽을 조향하면 앞바퀴도 오른쪽을 가리킨다', () => {
  // 오른쪽은 +X 다. 조향 입력 +1 이 D 이며 carPhysics 가 heading 을 줄여 오른쪽으로 돈다.
  assert.ok(wheelForward(steerAngle(1)).x > 0, '앞바퀴가 +X 를 가리켜야 한다');
  assert.ok(wheelForward(steerAngle(-1)).x < 0, '왼쪽 조향은 -X 다');
});

test('앞바퀴 방향과 차체가 도는 방향의 부호가 같다', () => {
  const extent = 1857;
  let state = { ...createCarState(extent), speed: 14, heading: 0 };
  for (let frame = 0; frame < 30; frame += 1) {
    state = stepCar(state, { steer: 1, throttle: 0, brake: false }, 1 / 60, extent, [], 'sedan');
  }
  // heading 이 줄면 진행 방향이 +X 로 기운다. 바퀴도 같은 쪽이어야 한다.
  assert.ok(state.heading < 0, `우회전이면 heading 이 줄어야 한다: ${state.heading}`);
  const body = { x: -Math.sin(state.heading), z: -Math.cos(state.heading) };
  assert.ok(body.x > 0, '차체가 +X 로 기울어야 한다');
  assert.ok(wheelForward(steerAngle(state.steer)).x > 0, '앞바퀴도 +X 여야 한다');
});
