import test from 'node:test';
import assert from 'node:assert/strict';
import { HARD_LANDING, HOVER_COLLECTIVE, createRotorState, stepRotor } from '../../src/world/rotorPhysics.js';
import { FLIGHT_GROUND } from '../../src/world/flightPhysics.js';

const hover = (overrides = {}) => ({ ...createRotorState(300), phase: 'airborne', y: 80, ...overrides });
const run = (state, input, frames = 60, buildings = []) => {
  let next = state;
  for (let i = 0; i < frames; i++) next = stepRotor(next, input, 1 / 60, 300, buildings);
  return next;
};

test('헬기 시작 위치는 공항 장애물과 활주로를 피한다', () => {
  const extent = 300;
  const state = createRotorState(extent);
  const obstacles = [
    { x: extent + 70, z: 33, height: 9, width: 29, depth: 48 },
    { x: extent + 69, z: 101, height: 11, width: 33, depth: 36 },
    { x: extent + 67, z: -13, height: 27, width: 12, depth: 11 },
  ];
  for (const box of obstacles) {
    const clear = Math.abs(state.x - box.x) > box.width / 2 + 3 || Math.abs(state.z - box.z) > box.depth / 2 + 3;
    assert.ok(clear, `${box.x},${box.z} 충돌 상자 안에서 시작한다`);
  }
  assert.ok(Math.abs(state.x - (extent + 110)) > 14, '활주로 폭 밖에서 시작한다');
});

test('로터 출력이 무게를 넘어야 뜬다', () => {
  const idle = run(createRotorState(300), { throttle: 0.3 }, 120);
  assert.equal(idle.phase, 'runway');
  assert.equal(idle.y, FLIGHT_GROUND);
  const lifting = run(createRotorState(300), { throttle: 0.85 }, 120);
  assert.equal(lifting.phase, 'airborne');
  assert.ok(lifting.y > FLIGHT_GROUND + 5, `고도 ${lifting.y}`);
});

test('호버 출력에서는 고도가 거의 유지된다', () => {
  const state = run(hover({ y: 120 }), { throttle: HOVER_COLLECTIVE }, 180);
  assert.ok(Math.abs(state.y - 120) < 12, `고도 변화 ${state.y - 120}`);
  assert.ok(Math.abs(state.climb) < 3);
});

test('cyclic 은 기체를 기울여 그 방향으로 밀고 pedal 은 기수를 돌린다', () => {
  const forward = run(hover(), { throttle: 0.6, pitch: 1 }, 90);
  assert.ok(forward.z < hover().z, '기수를 숙이면 앞으로 간다');
  assert.ok(forward.speed > 5, `속도 ${forward.speed}`);
  const turned = run(hover(), { throttle: 0.5, roll: 1 }, 60);
  assert.ok(turned.heading < 0);
  assert.equal(run(hover(), { throttle: 0.5 }, 60).heading, 0);
});

test('부드럽게 내려오면 착지하고 내려꽂으면 추락한다', () => {
  const soft = stepRotor(hover({ y: FLIGHT_GROUND + 0.05, vy: -3 }), { throttle: HOVER_COLLECTIVE }, 0.05, 300);
  assert.equal(soft.phase, 'runway');
  assert.equal(soft.y, FLIGHT_GROUND);
  const hard = stepRotor(hover({ y: FLIGHT_GROUND + 0.05, vy: -(HARD_LANDING + 6) }), { throttle: 0 }, 0.05, 300);
  assert.equal(hard.phase, 'crashed');
});

test('활주로 밖 평지에도 내려앉는다', () => {
  const field = stepRotor(hover({ x: 0, z: 0, y: FLIGHT_GROUND + 0.05, vy: -2 }), { throttle: HOVER_COLLECTIVE }, 0.05, 300);
  assert.equal(field.phase, 'runway');
});

test('건물에 부딪히면 추락하고 3초 뒤 착륙장으로 돌아온다', () => {
  const building = { x: 0, z: 0, height: 90, width: 20, depth: 20 };
  let state = run(hover({ x: 0, z: 30, y: 40, vz: -60 }), { throttle: 0.5 }, 24, [building]);
  assert.equal(state.phase, 'crashed');
  for (let i = 0; i < 50; i++) state = stepRotor(state, {}, 0.05, 300, [building]);
  assert.equal(state.phase, 'crashed');
  for (let i = 0; i < 20; i++) state = stepRotor(state, {}, 0.05, 300, [building]);
  assert.equal(state.phase, 'runway');
  assert.equal(state.y, FLIGHT_GROUND);
});

test('비정상 입력과 프레임 시간에도 상태가 유한하다', () => {
  for (const dt of [NaN, Infinity, -1, 100, 0.016]) {
    const state = stepRotor(createRotorState(300), { throttle: 9, pitch: NaN, roll: Infinity, yaw: -Infinity }, dt, 300);
    for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'pitch', 'roll', 'heading', 'speed', 'throttle']) assert.ok(Number.isFinite(state[field]), field);
    assert.ok(state.throttle >= 0 && state.throttle <= 1);
  }
  assert.equal(stepRotor({ ...createRotorState(300), x: NaN }, {}, 0.016, 300).x, 355);
});
