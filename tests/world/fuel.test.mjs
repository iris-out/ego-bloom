import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOST_BURN, FUEL_LAPS, OVERDRIVE_BURN, PLANES, SUPERSONIC_BURN, createFlightState, displaySpeed,
  flightStatus, fuelSeconds, hasOverdrive, isDry, machOf, speedOf, stepFlight, usesFuel,
} from '../../src/world/flightPhysics.js';
import { PLANE_KEYS } from '../../src/world/identity.js';
import { boostStages } from '../../src/world/ui/boostStages.js';

const EXTENT = 1000;
/** 공중에서 수평 비행을 이어간다. 활주로 로직을 건너뛰려고 상태를 직접 세운다. */
// 구역 가장자리에서 도시 쪽으로 날아 들어간다. 바깥으로 날면 비행 구역 경계가
// 스로틀을 뺏어 연료 소모와 속도 비교가 흐트러진다.
const airborne = (over = {}) => ({
  ...createFlightState(EXTENT, 'interceptor'), x: 0, z: 1500, heading: 0, phase: 'airborne',
  y: 400, speed: 150, pitch: 0, ...over,
});
const fly = (state, input, seconds) => {
  let next = state;
  for (let i = 0; i < seconds * 60; i++) next = stepFlight(next, input, 1 / 60, EXTENT, [], 'interceptor');
  return next;
};

test('요격기 동체 두 기종만 연료를 갖는다', () => {
  for (const key of ['interceptor', 'shotgun']) assert.equal(usesFuel(key), true, `${key} 연료`);
  for (const key of PLANE_KEYS.filter((key) => !['interceptor', 'shotgun'].includes(key))) assert.equal(usesFuel(key), false);
  assert.equal(createFlightState(EXTENT, 'jet').fuel, undefined);
  assert.equal(createFlightState(EXTENT, 'interceptor').fuel, 1);
  assert.equal(flightStatus(createFlightState(EXTENT, 'jet')).fuel, null);
  assert.equal(flightStatus(createFlightState(EXTENT, 'interceptor')).fuel, 1);
});

test('연료량은 비행 구역 두 바퀴다. 도시가 커지면 함께 늘어난다', () => {
  assert.equal(FUEL_LAPS, 2);
  const small = fuelSeconds(300, 'interceptor'), big = fuelSeconds(3000, 'interceptor');
  assert.ok(big > small, `작은 도시 ${small}, 큰 도시 ${big}`);
  // 순항 속도로 그 시간을 날면 두 바퀴 거리가 나온다.
  const distance = fuelSeconds(EXTENT, 'interceptor') * PLANES.interceptor.maxSpeed;
  assert.ok(Math.abs(distance / (2 * Math.PI * Math.max(1400, EXTENT + 900)) - FUEL_LAPS) < 1e-6);
  assert.equal(fuelSeconds(EXTENT, 'jet'), Infinity);
});

test('부스트는 더 빠르고 초음속에 들어가면 연료를 두 배로 쓴다', () => {
  assert.equal(BOOST_BURN, 1.3);
  assert.equal(SUPERSONIC_BURN, 2);
  const cruise = fly(airborne(), { throttle: 1 }, 12);
  const boosted = fly(airborne(), { throttle: 1, boost: true }, 12);
  assert.ok(boosted.speed > cruise.speed, `부스트 ${boosted.speed} 순항 ${cruise.speed}`);
  assert.ok(displaySpeed(boosted.speed) > 900, `부스트 속도 ${displaySpeed(boosted.speed)} km/h`);
  assert.ok(cruise.speed <= PLANES.interceptor.maxSpeed + 1e-6, '부스트 없이는 기본 상한을 넘지 않는다');
  assert.equal(boosted.boost, true);
  // 요격기는 부스트를 켜야 음속을 넘는다. 순항은 아음속이다.
  assert.ok(machOf(cruise.speed) < 1, `순항 마하 ${machOf(cruise.speed)}`);
  assert.ok(machOf(boosted.speed) >= 1, `부스트 마하 ${machOf(boosted.speed)}`);

  // 배수 자체는 한 걸음으로 잰다. 여러 초를 날리면 부스트를 끈 쪽이 상한 180 으로 떨어져
  // 도중에 아음속이 되고, 1.3배와 2배가 섞인 평균이 나온다.
  const drop = (over, order) => {
    const before = airborne(over);
    return before.fuel - stepFlight(before, order, 1 / 60, EXTENT, [], 'interceptor').fuel;
  };
  const fast = { speed: PLANES.interceptor.boostSpeed };
  assert.ok(machOf(PLANES.interceptor.boostSpeed) >= 1, '부스트 최고 속도는 초음속이다');
  const sonic = drop(fast, { throttle: 1 });
  const subsonic = drop({ speed: 90 }, { throttle: 1 });
  assert.ok(Math.abs(sonic / subsonic - SUPERSONIC_BURN) < 0.02, `소모비 ${sonic / subsonic}`);
  // 부스트 배수와 초음속 배수는 곱하지 않는다. 초음속이면 부스트를 켜도 2배 그대로다.
  assert.ok(Math.abs(drop(fast, { throttle: 1, boost: true }) / sonic - 1) < 1e-9, '배수가 겹치지 않는다');
});

test('아음속 부스트는 1.3배만 쓴다', () => {
  // 부스트를 켜도 아직 느린 구간에서는 초음속 배수가 걸리지 않는다.
  const slow = () => airborne({ speed: 90 });
  const cruise = fly(slow(), { throttle: 1 }, 2);
  const boosted = fly(slow(), { throttle: 1, boost: true }, 2);
  assert.ok(machOf(boosted.speed) < 1, `마하 ${machOf(boosted.speed)}`);
  const used = 1 - cruise.fuel, usedBoost = 1 - boosted.fuel;
  assert.ok(Math.abs(usedBoost / used - BOOST_BURN) < 0.02, `소모비 ${usedBoost / used}`);
});

test('연료가 마르면 추력이 없고 착륙하면 다시 채워진다', () => {
  const nearly = airborne({ fuel: 0.004 });
  const dry = fly(nearly, { throttle: 1 }, 6);
  assert.equal(dry.fuel, 0);
  assert.match(dry.message, /연료 소진/);
  // 추력이 0 이면 수평 비행에서는 항력만 남아 속도가 준다.
  assert.ok(dry.speed < nearly.speed, `마른 뒤 속도 ${dry.speed}`);
  assert.equal(fly(dry, { throttle: 1, boost: true }, 3).boost, false, '연료 없이는 부스트도 없다');

  // 활주로에 서면 가득 찬다. 도시 한가운데가 아니라 실제 활주로 좌표에서 본다.
  const parked = { ...createFlightState(EXTENT, 'interceptor'), fuel: 0, message: dry.message };
  const landed = stepFlight(parked, { throttle: 0 }, 1 / 60, EXTENT, [], 'interceptor');
  assert.equal(landed.fuel, 1);
  assert.match(landed.message, /급유/);
});

test('연료가 마르면 엔진이 꺼진 것으로 보고한다', () => {
  // 소리와 배기 효과가 이 값 하나를 보고 꺼진다. 추력이 0 인 조건과 같아야 한다.
  const flying = airborne();
  assert.equal(isDry(flying), false);
  assert.equal(flightStatus(flying).dry, false);
  const dry = fly(airborne({ fuel: 0.004 }), { throttle: 1 }, 6);
  assert.equal(dry.fuel, 0);
  assert.equal(isDry(dry), true);
  assert.equal(flightStatus(dry).dry, true);
  // 스로틀은 조종사가 올린 그대로 남는다. 꺼지는 것은 추력과 효과다.
  assert.equal(dry.throttle, 1);
  const coasting = stepFlight(dry, { throttle: 1 }, 1 / 60, EXTENT, [], 'interceptor');
  assert.ok(coasting.speed < dry.speed, '추력이 없으니 속도가 준다');
  // 연료가 없는 기종은 마를 일이 없다.
  assert.equal(isDry({ ...createFlightState(EXTENT, 'jet'), phase: 'airborne' }), false);
  assert.equal(flightStatus(createFlightState(EXTENT, 'jet')).dry, false);
});

test('다른 기종은 부스트 입력을 무시한다', () => {
  let jet = { ...createFlightState(EXTENT, 'jet'), phase: 'airborne', y: 400, speed: 100 };
  for (let i = 0; i < 60 * 20; i++) jet = stepFlight(jet, { throttle: 1, boost: true }, 1 / 60, EXTENT, [], 'jet');
  assert.ok(jet.speed <= PLANES.jet.maxSpeed + 1e-6, `제트 속도 ${jet.speed}`);
  assert.equal(jet.fuel, undefined);
  assert.equal(jet.boost, undefined);
});

/** Q 로 고르는 강화 부스트다. 단계는 입력으로 들어오고 물리는 그 값을 그대로 쓴다. */
test('요격기 동체 두 기종만 강화 부스트를 갖고 기본 단계에서 시작한다', () => {
  for (const key of ['interceptor', 'shotgun']) assert.equal(hasOverdrive(key), true, `${key} 강화 부스트`);
  for (const key of PLANE_KEYS.filter((key) => !['interceptor', 'shotgun'].includes(key))) assert.equal(hasOverdrive(key), false);
  assert.equal(createFlightState(EXTENT, 'interceptor').overdrive, false);
  assert.equal(createFlightState(EXTENT, 'jet').overdrive, undefined);
  assert.equal(flightStatus(createFlightState(EXTENT, 'interceptor')).overdrive, false);
});

test('강화 부스트는 계기 1340km/h 까지 열고 기본 부스트는 1080 그대로다', () => {
  assert.equal(Math.round(displaySpeed(PLANES.interceptor.boostSpeed)), 1080);
  assert.equal(Math.round(displaySpeed(PLANES.interceptor.overdriveSpeed)), 1340);
  assert.equal(PLANES.interceptor.overdriveSpeed, speedOf(1340));
  // 10초를 넘기면 비행 구역 경계에 닿아 자동 선회가 스로틀을 가져간다. 속도 비교가 흐트러진다.
  const basic = fly(airborne(), { throttle: 1, boost: true }, 10);
  const hard = fly(airborne(), { throttle: 1, boost: true, overdrive: true }, 10);
  assert.ok(basic.speed <= PLANES.interceptor.boostSpeed + 1e-6, `기본 부스트 ${displaySpeed(basic.speed)}`);
  assert.equal(Math.round(displaySpeed(hard.speed)), 1340, `강화 부스트 ${displaySpeed(hard.speed)}`);
  assert.equal(hard.overdrive, true);
  assert.ok(machOf(hard.speed) > machOf(basic.speed));
});

test('단계만 고르고 Shift 를 놓으면 기본 상한과 기본 소모를 쓴다', () => {
  const armed = fly(airborne(), { throttle: 1, overdrive: true }, 10);
  assert.ok(armed.speed <= PLANES.interceptor.maxSpeed + 1e-6, `단계만 켠 속도 ${armed.speed}`);
  assert.equal(armed.boost, false);
  // 고른 단계는 부스트를 놓아도 남는다. 화면이 이 값으로 대기 상태를 알린다.
  assert.equal(armed.overdrive, true);
  const plain = fly(airborne(), { throttle: 1 }, 10);
  assert.ok(Math.abs((1 - armed.fuel) / (1 - plain.fuel) - 1) < 1e-9, '부스트를 놓으면 소모가 같다');
});

test('강화 부스트는 연료를 2.5배로 쓴다', () => {
  assert.equal(OVERDRIVE_BURN, 2.5);
  // 배수는 한 걸음으로 잰다. 여러 초를 날리면 속도가 달라져 초음속 배수가 섞인다.
  const drop = (order) => {
    const before = airborne({ speed: 90 });
    return before.fuel - stepFlight(before, order, 1 / 60, EXTENT, [], 'interceptor').fuel;
  };
  const base = drop({ throttle: 1 });
  assert.ok(machOf(90) < 1, '비교 속도는 아음속이다');
  assert.ok(Math.abs(drop({ throttle: 1, boost: true, overdrive: true }) / base - OVERDRIVE_BURN) < 1e-9);
  assert.ok(Math.abs(drop({ throttle: 1, boost: true }) / base - BOOST_BURN) < 1e-9, '기본 부스트는 1.3배 그대로다');
  // 초음속 배수와 곱하지 않는다. 강화 단계가 더 크므로 초음속에서도 2.5배다.
  const fast = { ...airborne({ speed: PLANES.interceptor.boostSpeed }) };
  const sonic = (order) => fast.fuel - stepFlight(fast, order, 1 / 60, EXTENT, [], 'interceptor').fuel;
  assert.ok(machOf(PLANES.interceptor.boostSpeed) >= 1);
  assert.ok(Math.abs(sonic({ throttle: 1, boost: true, overdrive: true }) / sonic({ throttle: 1 }) - OVERDRIVE_BURN / SUPERSONIC_BURN) < 1e-9);
});

test('자동 선회가 조종을 가져가도 고른 단계는 남는다', () => {
  // 구역 밖에서 시작해 경계 밖을 향한다. guardInput 이 조종 입력을 통째로 갈아치우는 자리다.
  const outside = fly(airborne({ x: 0, z: -2400, heading: Math.PI }), { throttle: 1, boost: true, overdrive: true }, 1);
  assert.equal(outside.guard, true, '구역 밖이면 자동 선회가 켜진다');
  assert.equal(outside.overdrive, true, '자동 선회가 단계를 잊지 않는다');
  assert.equal(outside.boost, false, '자동 선회 중에는 부스트가 끊긴다');
});

test('강화 부스트도 연료가 마르면 멈추고 다른 기종은 단계를 무시한다', () => {
  const dry = fly(airborne({ fuel: 0.004 }), { throttle: 1, boost: true, overdrive: true }, 8);
  assert.equal(dry.fuel, 0);
  assert.equal(dry.boost, false, '연료가 없으면 부스트가 끊긴다');
  let jet = { ...createFlightState(EXTENT, 'jet'), phase: 'airborne', y: 400, speed: 100 };
  for (let i = 0; i < 60 * 20; i++) jet = stepFlight(jet, { throttle: 1, boost: true, overdrive: true }, 1 / 60, EXTENT, [], 'jet');
  assert.ok(jet.speed <= PLANES.jet.maxSpeed + 1e-6, `제트 속도 ${jet.speed}`);
  assert.equal(jet.overdrive, undefined);
});

test('부스트 단계 표가 계기 km/h 와 연료 배수를 함께 낸다', () => {
  assert.deepEqual(boostStages('interceptor'), [
    { key: 'boost', ko: '기본', kmh: 1080, burn: BOOST_BURN },
    { key: 'overdrive', ko: '강화', kmh: 1340, burn: OVERDRIVE_BURN },
  ]);
  // 부스트가 없는 기종은 빈 배열이라 화면 안내가 서지 않는다.
  assert.deepEqual(boostStages('jet'), []);
});
