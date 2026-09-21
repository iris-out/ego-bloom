import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutopilot, stepAutopilot } from '../../src/world/autopilot.js';
import { createFlightState, stepFlight } from '../../src/world/flightPhysics.js';
import { createRotorState, stepRotor } from '../../src/world/rotorPhysics.js';

const EXTENT = 300;
/* FlightMode 의 공항 장애물과 같은 값이다. 자동 비행이 터미널과 관제탑을 피하는지 본다. */
const BOXES = [
  { x: -45, z: 40, height: 17.2, width: 27, depth: 164 },
  { x: -45, z: -46, height: 14, width: 26, depth: 14 },
  { x: -29.5, z: 80, height: 7.4, width: 5.4, depth: 42 },
  { x: -23.5, z: 90, height: 8.5, width: 7, depth: 144 },
  { x: -52, z: -75, height: 41.6, width: 10, depth: 10 },
];
const OBSTACLES = [1, -1].flatMap((side) => BOXES.map((box) => ({ ...box, x: side * (EXTENT + 110) + side * box.x, z: side * box.z })));

function fly(rotor, frames = 24000) {
  let state = rotor ? createRotorState(EXTENT) : createFlightState(EXTENT);
  let ap = createAutopilot();
  const seen = new Set([ap.mode]);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const out = stepAutopilot(ap, state, { extent: EXTENT, dt: 1 / 60, rotor });
    ap = out.ap;
    seen.add(ap.mode);
    state = rotor ? stepRotor(state, out.input, 1 / 60, EXTENT, OBSTACLES) : stepFlight(state, out.input, 1 / 60, EXTENT, OBSTACLES);
    peak = Math.max(peak, state.y);
    if (state.phase === 'crashed') return { state, ap, seen, peak, crashed: true };
    if (ap.mode === 'stop' && state.speed < 1) break;
  }
  return { state, ap, seen, peak, crashed: false };
}

test('자동 비행은 이륙하고 외곽을 돈 뒤 활주로에 세운다', () => {
  const { state, ap, seen, peak, crashed } = fly(false);
  assert.equal(crashed, false, '경로 어디에서도 부딪히지 않는다');
  for (const mode of ['cruise', 'approach', 'land', 'stop']) assert.ok(seen.has(mode), `${mode} 단계를 거친다`);
  assert.ok(peak > 120, `순항 고도 ${peak}`);
  assert.equal(state.phase, 'runway');
  assert.ok(state.speed < 2, `정지 속도 ${state.speed}`);
  assert.ok(Math.abs(state.x - (EXTENT + 110)) <= 13, `중심선 이탈 ${state.x - (EXTENT + 110)}`);
  assert.ok(Math.abs(state.z) <= 270, `활주로 이탈 ${state.z}`);
});

test('헬기 자동 비행은 낮게 돌다가 제자리에 내려앉는다', () => {
  const { state, seen, peak, crashed } = fly(true);
  assert.equal(crashed, false);
  for (const mode of ['cruise', 'approach', 'land']) assert.ok(seen.has(mode), `${mode} 단계를 거친다`);
  assert.ok(peak > 40 && peak < 160, `헬기 순항 고도 ${peak}`);
  assert.equal(state.phase, 'runway');
  assert.ok(state.speed < 3);
});

test('추락하면 자동 비행 단계가 처음으로 돌아간다', () => {
  const { ap, input } = stepAutopilot({ ...createAutopilot(), mode: 'land' }, { ...createFlightState(EXTENT), phase: 'crashed' }, { extent: EXTENT, dt: 1 / 60 });
  assert.equal(ap.mode, 'depart');
  assert.equal(input.throttle, 0);
  assert.equal(input.brake, false);
});

test('입력값이 비정상이어도 조종 입력은 유한하고 범위 안이다', () => {
  for (const broken of [null, { phase: 'airborne', x: NaN, y: Infinity, z: 0, heading: NaN, speed: -Infinity }]) {
    const { input } = stepAutopilot(createAutopilot(), broken, { extent: EXTENT, dt: NaN });
    for (const key of ['throttle', 'pitch', 'roll', 'yaw']) assert.ok(Number.isFinite(input[key]), key);
    assert.ok(input.throttle >= 0 && input.throttle <= 1);
    assert.ok(Math.abs(input.pitch) <= 1 && Math.abs(input.roll) <= 1);
  }
});
