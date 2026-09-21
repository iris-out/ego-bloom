import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, flightBoundary, guardInput, stepFlight } from '../../src/world/flightPhysics.js';
import { createRotorState, stepRotor } from '../../src/world/rotorPhysics.js';

/** 비행 구역을 벗어나면 조종을 회수해 도시 안쪽으로 돌린 뒤 돌려준다.
 * 조종사가 계속 바깥으로 밀어도 빠져나가지 못해야 한다.
 */
const EXTENT = 300;
const LIMIT = flightBoundary(EXTENT);
const outside = (heading) => ({ ...createFlightState(EXTENT), phase: 'airborne', x: LIMIT + 400, z: 0, y: 200, speed: 70, heading });
// 바깥으로 계속 밀어붙이는 입력이다.
const fighting = { throttle: 1, roll: 1, pitch: 0.4, yaw: 1 };

test('구역 안에서는 조종을 가로채지 않는다', () => {
  const inside = { ...createFlightState(EXTENT), phase: 'airborne', x: 200, z: 0, y: 200, speed: 70 };
  const guard = guardInput(inside, EXTENT, fighting);
  assert.equal(guard.active, false);
  assert.equal(guard.input, fighting);
  assert.equal(stepFlight(inside, fighting, 1 / 60, EXTENT).guard, false);
});

test('구역을 벗어나면 조종 입력을 무시하고 경고를 띄운다', () => {
  const guard = guardInput(outside(0), EXTENT, fighting);
  assert.equal(guard.active, true);
  assert.notEqual(guard.input.roll, fighting.roll);
  assert.equal(guard.input.brake, false);
  assert.ok(guard.message.includes('비행 구역'));
  const stepped = stepFlight(outside(0), fighting, 1 / 60, EXTENT);
  assert.equal(stepped.guard, true);
  assert.ok(stepped.message.includes('비행 구역'));
});

test('어느 방향으로 이탈해도 도시 안으로 돌아오고 조종을 돌려준다', () => {
  for (const heading of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    let state = outside(heading), peak = 0, released = -1;
    for (let frame = 0; frame < 1800; frame += 1) {
      state = stepFlight(state, fighting, 1 / 60, EXTENT);
      peak = Math.max(peak, Math.hypot(state.x, state.z));
      if (released < 0 && frame > 30 && !state.guard) released = frame / 60;
    }
    const label = `heading ${heading.toFixed(2)}`;
    assert.equal(state.phase, 'airborne', `${label} 추락하면 안 된다`);
    assert.ok(peak < LIMIT * 1.6, `${label} 이탈 최대 반경 ${Math.round(peak)}`);
    assert.ok(released > 0 && released < 25, `${label} 조종 반환 ${released}s`);
    // 조종사가 계속 바깥으로 미는 상황이라 기체는 경계선에 붙어 들락거린다.
    // 마지막 한 프레임이 선 안쪽인지는 우연이므로 경계에서 5% 안쪽이면 갇힌 것으로 본다.
    assert.ok(Math.hypot(state.x, state.z) < LIMIT * 1.05, `${label} 최종 반경 ${Math.round(Math.hypot(state.x, state.z))}`);
  }
});

test('되돌리는 동안 스로틀은 실속 아래로 떨어지지 않는다', () => {
  let state = outside(0);
  for (let frame = 0; frame < 600; frame += 1) {
    state = stepFlight(state, { throttle: 0, roll: 0, pitch: 0, yaw: 0 }, 1 / 60, EXTENT);
    if (state.guard) assert.ok(state.throttle >= 0.3, `throttle ${state.throttle}`);
  }
});

test('헬기도 같은 규칙으로 돌아온다. 예전 식은 부호가 뒤집혀 바깥으로 밀었다', () => {
  let state = { ...createRotorState(EXTENT), x: LIMIT + 400, z: 0, y: 120, vx: 40, vz: 0 };
  const first = stepRotor(state, { lift: 0.5, forward: 1 }, 1 / 60, EXTENT);
  assert.equal(first.guard, true);
  assert.ok(first.vx < state.vx, '안쪽으로 감속해야 한다');
  let released = -1;
  for (let frame = 0; frame < 1800; frame += 1) {
    state = stepRotor(state, { lift: 0.5, forward: 1 }, 1 / 60, EXTENT);
    if (released < 0 && frame > 30 && !state.guard) released = frame / 60;
  }
  assert.ok(released > 0 && released < 25, `조종 반환 ${released}s`);
  assert.ok(Math.hypot(state.x, state.z) < LIMIT);
});
