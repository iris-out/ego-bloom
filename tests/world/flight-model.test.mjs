import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_GROUND, GRAVITY, PLANES, createFlightState, stepFlight } from '../../src/world/flightPhysics.js';
import { FUSELAGE_PROFILE, WING_THICKNESS, dimensionsOf } from '../../src/world/models/planeDimensions.js';

const airborne = (overrides = {}) => ({ ...createFlightState(300), phase: 'airborne', y: 200, speed: 60, ...overrides });

test('상승하면 속도를 잃고 하강하면 속도를 얻는다', () => {
  const climb = stepFlight(airborne({ pitch: 0.35 }), { throttle: 0.5 }, 0.05, 300);
  const dive = stepFlight(airborne({ pitch: -0.35 }), { throttle: 0.5 }, 0.05, 300);
  assert.ok(dive.speed > 60, '하강은 가속한다');
  assert.ok(climb.speed < dive.speed);
});

test('항력이 속도의 제곱으로 붙어 최고 속도가 유한하다', () => {
  let state = airborne({ speed: 0 });
  for (let i = 0; i < 3600; i++) state = stepFlight(state, { throttle: 1 }, 1 / 60, 300);
  assert.ok(state.speed > 80 && state.speed <= PLANES.jet.maxSpeed);
});

test('세 기종의 최고 속도가 예전 값의 90퍼센트다', () => {
  // 왼쪽이 예전 값이다. 표를 다시 고칠 때 이 숫자도 같이 고친다.
  for (const [key, before] of [['jet', 125], ['fighter', 168]]) {
    assert.ok(Math.abs(PLANES[key].maxSpeed - before * 0.9) <= 0.5, `${key} 최고 속도 ${PLANES[key].maxSpeed}`);
  }
  // 실속 속도는 그대로 두었으므로 최고 속도 대비 비가 좁아진다. 셋 다 2.3 배 위에 남는지 본다.
  for (const key of Object.keys(PLANES)) {
    assert.ok(PLANES[key].maxSpeed / PLANES[key].stallSpeed > 2.3, `${key} 속도 폭이 좁다`);
  }
});

test('같은 스로틀에서 기수를 들수록 속도가 줄고 내릴수록 는다', () => {
  const speeds = [0.6, 0.3, 0, -0.3, -0.6].map((pitch) =>
    stepFlight(airborne({ pitch }), { throttle: 0.6 }, 0.05, 300).speed);
  for (let i = 1; i < speeds.length; i += 1) {
    assert.ok(speeds[i] > speeds[i - 1], `기수 자세와 속도가 단조롭지 않다: ${speeds}`);
  }
  // 수평에서 한 걸음의 변화량이 중력 성분보다 작다. 에너지 교환이 자세에서만 나온다.
  const level = stepFlight(airborne({ pitch: 0 }), { throttle: 0.6 }, 0.05, 300).speed;
  assert.ok(Math.abs(level - 60) < GRAVITY * 0.05 + 0.5);
});

test('급강하는 최고 속도를 넘지만 1.45 배 안에 머문다', () => {
  // 1.45 는 flightPhysics 의 DIVE_MARGIN 0.45 에서 나온다. 수직 강하가 상한이다.
  let state = airborne({ pitch: -1.15, speed: 60, y: 4000 });
  for (let i = 0; i < 3600; i++) state = stepFlight({ ...state, y: 4000 }, { throttle: 1, pitch: -1 }, 1 / 60, 300);
  assert.ok(state.speed > PLANES.jet.maxSpeed, `강하가 최고 속도를 넘지 못했다: ${state.speed}`);
  assert.ok(state.speed <= PLANES.jet.maxSpeed * 1.45 + 1e-6, `강하 속도가 상한을 넘었다: ${state.speed}`);
});

test('활주로에서는 기수각이 속도를 거의 바꾸지 않는다', () => {
  // 지상에서는 중력 성분을 빼므로 남는 차이는 기수각에 붙는 유도항력뿐이다.
  // 같은 기수각을 공중에서 주면 차이가 열 배 넘게 벌어진다.
  const ground = { ...createFlightState(300), speed: 20 };
  const flat = stepFlight({ ...ground, pitch: 0 }, { throttle: 0.5 }, 0.05, 300);
  const raised = stepFlight({ ...ground, pitch: 0.2 }, { throttle: 0.5 }, 0.05, 300);
  const onGround = Math.abs(flat.speed - raised.speed);
  const inAir = Math.abs(stepFlight(airborne({ pitch: 0, speed: 20 }), { throttle: 0.5 }, 0.05, 300).speed
    - stepFlight(airborne({ pitch: 0.2, speed: 20 }), { throttle: 0.5 }, 0.05, 300).speed);
  assert.ok(onGround < 0.05, `지상 차이가 크다: ${onGround}`);
  assert.ok(inAir > onGround * 10, `공중에서 더 벌어지지 않았다: ${inAir} 대 ${onGround}`);
});

test('이륙 속도는 기종 실속 속도를 따른다', () => {
  // 여객기는 실속 속도가 높아 제트보다 늦게 뜬다. 예전에는 셋 다 34 로 같았다.
  for (const key of Object.keys(PLANES)) {
    const spec = PLANES[key];
    const slow = stepFlight({ ...createFlightState(300), speed: spec.stallSpeed * 0.9, pitch: 0.12 }, { throttle: 1 }, 0.02, 300, [], key);
    const fast = stepFlight({ ...createFlightState(300), speed: spec.stallSpeed * 1.1, pitch: 0.12 }, { throttle: 1 }, 0.02, 300, [], key);
    assert.equal(slow.phase, 'runway', `${key} 가 너무 일찍 떴다`);
    assert.equal(fast.phase, 'airborne', `${key} 가 뜨지 못했다`);
  }
});

test('실속 속도 아래에서는 가라앉고 경고를 띄운다', () => {
  const stalled = stepFlight(airborne({ speed: 10, pitch: 0 }), { throttle: 0 }, 0.05, 300);
  assert.ok(stalled.y < 200);
  assert.match(stalled.message, /실속/);
  const fast = stepFlight(airborne({ speed: 90, pitch: 0 }), { throttle: 0.6 }, 0.05, 300);
  assert.equal(fast.message, '');
});

test('느릴수록 기수와 뱅크가 덜 듣는다', () => {
  const slow = stepFlight(airborne({ speed: 15 }), { throttle: 0.5, pitch: 1, roll: 1 }, 0.05, 300);
  const fast = stepFlight(airborne({ speed: 90 }), { throttle: 0.5, pitch: 1, roll: 1 }, 0.05, 300);
  assert.ok(fast.pitch > slow.pitch);
  assert.ok(Math.abs(fast.roll) > Math.abs(slow.roll));
});

test('충분한 속도에서는 기수와 뱅크를 크게 꺾을 수 있다', () => {
  let climb = airborne({ speed: 110 });
  for (let i = 0; i < 90; i++) climb = stepFlight(climb, { throttle: 1, pitch: 1 }, 1 / 60, 300);
  assert.ok(climb.pitch > 0.75, `기수 ${climb.pitch}`);
  let bank = airborne({ speed: 110 });
  for (let i = 0; i < 90; i++) bank = stepFlight(bank, { throttle: 1, roll: 1 }, 1 / 60, 300);
  assert.ok(Math.abs(bank.roll) > 1, `뱅크 ${bank.roll}`);
});

test('기수를 든 채 속도를 잃으면 실속하고 조종간을 당겨도 기수가 떨어진다', () => {
  let state = airborne({ speed: 45, pitch: 0.5, y: 500 });
  for (let i = 0; i < 300; i++) state = stepFlight(state, { throttle: 0.15, pitch: 1 }, 1 / 60, 300);
  assert.match(state.message, /실속/);
  const held = state.pitch;
  for (let i = 0; i < 60; i++) state = stepFlight(state, { throttle: 0.15, pitch: 1 }, 1 / 60, 300);
  assert.ok(state.pitch < held, '조종간을 당겨도 기수가 떨어진다');
  const stalledAltitude = state.y;
  for (let i = 0; i < 300; i++) state = stepFlight(state, { throttle: 1 }, 1 / 60, 300);
  assert.ok(state.y < stalledAltitude, '회복하는 동안 고도를 내준다');
  assert.ok(state.speed > 45, `회복 속도 ${state.speed}`);
  assert.equal(state.message, '');
});

test('충분한 속도로 상승하며 선회해도 기수가 강제로 내려가지 않는다', () => {
  let state = airborne({ speed: 80, pitch: 0.2, climb: 15, y: 300 });
  const start = state.y;
  for (let i = 0; i < 300; i++) state = stepFlight(state, { throttle: 0.8, pitch: 0.6, roll: 1 }, 1 / 60, 300);
  assert.ok(state.y > start + 100, `선회 중에도 고도를 얻는다 ${state.y}`);
  assert.ok(state.pitch > 0.5, `기수 ${state.pitch}`);
  assert.ok(Math.abs(state.roll) > 1, `뱅크 ${state.roll}`);
  assert.equal(state.message, '');
});

test('지상에서 브레이크를 잡으면 빠르게 서고 이륙하지 않는다', () => {
  let rolling = { ...createFlightState(300), speed: 60 };
  let coasting = { ...rolling };
  for (let i = 0; i < 60; i++) {
    rolling = stepFlight(rolling, { throttle: 0, brake: true }, 1 / 60, 300);
    coasting = stepFlight(coasting, { throttle: 0 }, 1 / 60, 300);
  }
  assert.ok(rolling.speed < coasting.speed - 10, `브레이크 ${rolling.speed} 관성 ${coasting.speed}`);
  let held = { ...createFlightState(300), speed: 60 };
  for (let i = 0; i < 60; i++) held = stepFlight(held, { throttle: 1, brake: true, pitch: 1 }, 1 / 60, 300);
  assert.equal(held.phase, 'runway', '브레이크를 잡은 채로는 뜨지 않는다');
});

test('지상 조향은 멈춰 있으면 듣지 않고 빠를수록 둔해진다', () => {
  const still = stepFlight({ ...createFlightState(300), speed: 0 }, { roll: 1 }, 0.1, 300);
  assert.equal(still.heading, 0);
  const taxi = stepFlight({ ...createFlightState(300), speed: 12 }, { roll: 1 }, 0.1, 300);
  const fast = stepFlight({ ...createFlightState(300), speed: 70 }, { roll: 1 }, 0.1, 300);
  assert.ok(Math.abs(taxi.heading) > 0);
  assert.ok(Math.abs(taxi.heading) > Math.abs(fast.heading));
});

test('활주로가 길어져 예전 끝자락에서는 아직 이탈이 아니다', () => {
  const inside = stepFlight({ ...createFlightState(300), z: -200, speed: 40 }, { throttle: 1 }, 0.05, 300);
  assert.equal(inside.phase, 'runway');
  const outside = stepFlight({ ...createFlightState(300), z: -269, speed: 40 }, { throttle: 1 }, 0.05, 300);
  assert.equal(outside.phase, 'crashed');
});

test('같은 뱅크라도 빠를수록 선회가 완만하다', () => {
  const slow = stepFlight(airborne({ speed: 40, roll: -0.5 }), { throttle: 0.5 }, 0.05, 300);
  const fast = stepFlight(airborne({ speed: 110, roll: -0.5 }), { throttle: 0.5 }, 0.05, 300);
  assert.ok(Math.abs(slow.heading) > Math.abs(fast.heading));
});

test('기체 외곽 치수는 충돌과 주차가 의존하는 값이므로 고정한다', () => {
  // 이 숫자를 바꾸면 Airport.jsx 주차 좌표와 flightPhysics 충돌 여유가 어긋난다.
  assert.deepEqual(dimensionsOf('jet'), { span: 20, length: 12.2, wheelBottom: -1.9 });
  for (const plane of ['jet', 'bomber', 'prop', 'fighter', 'helicopter']) {
    const box = dimensionsOf(plane);
    assert.equal(box.wheelBottom, -1.9, `${plane} 접지면이 -1.9 가 아니다`);
    assert.ok(box.span > 0 && box.length > 0);
    // FLIGHT_GROUND 가 접지면을 활주로 높이 0 으로 올린다.
    assert.ok(Math.abs(FLIGHT_GROUND + box.wheelBottom) < 0.3, `${plane} 이 활주로에 닿지 않는다`);
  }
  assert.deepEqual(dimensionsOf('없는기종'), dimensionsOf('jet'));
});

test('동체 프로파일은 코에서 꼬리로 이어지고 최대 반지름이 캡슐과 같다', () => {
  const zs = FUSELAGE_PROFILE.map(([, z]) => z);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] > zs[i - 1], `프로파일 z 가 ${i} 에서 뒤집힌다`);
  const radii = FUSELAGE_PROFILE.map(([r]) => r);
  assert.equal(Math.max(...radii), 1.1, '최대 반지름이 기존 캡슐 1.1 과 달라졌다');
  // 노즈와 테일은 거의 한 점으로 모인다. 같은 반구가 아니다.
  assert.ok(radii[0] < 0.1 && radii.at(-1) < 0.2);
  assert.ok(Math.abs(zs.at(-1) - zs[0]) <= dimensionsOf('jet').length + 0.2);
});

test('날개 익형은 뿌리가 끝보다 두껍다', () => {
  assert.ok(WING_THICKNESS.root > WING_THICKNESS.tip);
  assert.ok(WING_THICKNESS.root <= 0.5 && WING_THICKNESS.tip > 0);
});
