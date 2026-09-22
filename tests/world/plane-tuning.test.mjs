import test from 'node:test';
import assert from 'node:assert/strict';
import { CEILING, FLIGHT_GROUND, createFlightState, fuelSeconds, stepFlight } from '../../src/world/flightPhysics.js';
import { createRotorState, stepRotor } from '../../src/world/rotorPhysics.js';
import { CANNON, cannonRange, createArsenal, gunOf, muzzleAim, stepWeapons, toWorld } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';
import { airImpact } from '../../src/world/reticle.js';

const EXTENT = 900;

test('전투기 기관총이 프로펠러기보다는 느리고 예전보다는 빠르다', () => {
  assert.equal(CANNON.interval, 1 / 18, '분당 1080발이다');
  assert.ok(CANNON.interval < 1 / 15, '예전 분당 900발보다 빠르다');
  assert.ok(gunOf('prop').interval < CANNON.interval, '프로펠러기가 여전히 가장 빠르다');
});

test('기관총은 맵 너비의 1/3 을 넘겨 날아가지 않는다', () => {
  // 작은 도시에서는 사거리가 상한에 걸리고, 큰 도시에서는 탄의 수명이 먼저 끊는다.
  assert.equal(Math.round(cannonRange(600)), 400);
  assert.ok(cannonRange(3233) > 2000);
  assert.equal(cannonRange(0), 200, '아주 작은 값에도 바닥이 있다');
  assert.equal(cannonRange(180, 'interceptor'), 300, '요격기 기관포는 300m 안에서만 쓴다');
});

test('프로펠러기 기관총 네 정이 기수 앞 한 점으로 모인다', () => {
  const mounts = armamentOf('prop');
  const converge = mounts.converge;
  assert.ok(converge > 0, '수렴 거리가 있다');
  for (const port of mounts.cannon) {
    const aim = muzzleAim(port, converge);
    // 포구에서 수렴 거리만큼 나아가면 중심선(x=0, y=0) 에 닿아야 한다.
    const travel = (-converge - port[2]) / aim[2];
    const x = port[0] + aim[0] * travel, y = port[1] + aim[1] * travel;
    assert.ok(Math.hypot(x, y) < 1e-6, `포구 ${port} 가 중심선에서 ${Math.hypot(x, y)} 벗어났다`);
  }
});

test('수렴 사격 탄이 실제로 중심선으로 모인다', () => {
  const mounts = armamentOf('prop');
  const pose = { x: 0, y: 400, z: 0, pitch: 0, roll: 0, heading: 0, speed: 0, phase: 'airborne' };
  // 네 포구에서 한 발씩 뽑아 수렴 거리까지 굴린다.
  const spread = [];
  for (let shot = 0; shot < 4; shot += 1) {
    let arsenal = createArsenal('prop');
    arsenal.muzzle = shot;
    arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: 'prop', fire: { cannon: true } });
    const bullet = arsenal.projectiles[0];
    // 탄은 이미 한 걸음 나아가 있다. 수렴면(z = -converge) 까지 남은 시간을 탄에서 직접 푼다.
    const time = (-mounts.converge - bullet.z) / bullet.vz;
    spread.push(Math.abs(bullet.x + bullet.vx * time));
  }
  // 포구는 중심선에서 1.9~2.6 벌어져 있다. 수렴 지점에서는 거의 한 점이다.
  assert.ok(Math.max(...spread) < 0.05, `수렴 지점 좌우 편차 ${Math.max(...spread)}`);
});

test('전투기만 평행 사격을 쓰고 요격기는 수렴 사격한다', () => {
  assert.deepEqual(muzzleAim([-2, 0, -3], 0), [0, 0, -1]);
  assert.equal(armamentOf('fighter').converge, undefined);
  assert.equal(armamentOf('interceptor').converge, 100);
});

test('프로펠러기 조준 표식이 수렴 방향을 따른다', () => {
  const pose = { x: 0, y: 300, z: 0, pitch: 0, roll: 0, heading: 0, speed: 0, key: 'prop' };
  const hit = airImpact(pose, 'cannon', []);
  // 좌현 포구에서 쏘지만 표식은 기체 중심선 쪽으로 붙어야 한다.
  assert.ok(Math.abs(hit.x) < Math.abs(armamentOf('prop').cannon[0][0]), `표식 x ${hit.x}`);
});

test('고정익과 헬기의 천장이 1000m 로 같다', () => {
  assert.equal(CEILING, 1000);
  const roof = CEILING + FLIGHT_GROUND;
  let plane = { ...createFlightState(EXTENT, 'fighter'), phase: 'airborne', y: 900, speed: 120, pitch: 0.5 };
  for (let frame = 0; frame < 3600; frame += 1) plane = stepFlight(plane, { throttle: 1, pitch: 1 }, 1 / 60, EXTENT, [], 'fighter');
  assert.ok(plane.y <= roof + 1e-6, `고정익 고도 ${plane.y}`);
  assert.ok(plane.y > 900, '천장까지는 올라간다');

  let heli = { ...createRotorState(EXTENT), phase: 'airborne', y: 900, vy: 30 };
  for (let frame = 0; frame < 3600; frame += 1) heli = stepRotor(heli, { throttle: 1, pitch: 0 }, 1 / 60, EXTENT, []);
  assert.ok(heli.y <= roof + 1e-6, `헬기 고도 ${heli.y}`);
});

test('요격기 연료가 예전보다 20% 빨리 준다', () => {
  const burn = (throttle) => {
    let state = { ...createFlightState(EXTENT, 'interceptor'), phase: 'airborne', y: 300, speed: 150, throttle, fuel: 1 };
    for (let frame = 0; frame < 60; frame += 1) state = stepFlight(state, { throttle }, 1 / 60, EXTENT, [], 'interceptor');
    return 1 - state.fuel;
  };
  const full = burn(1);
  // 연료량 자체(fuelSeconds) 는 그대로고 소모 속도만 1.2 배다.
  const expected = 1.2 / fuelSeconds(EXTENT, 'interceptor');
  assert.ok(Math.abs(full - expected) / expected < 0.05, `1초 소모 ${full} 기대 ${expected}`);
  assert.ok(burn(0) < full, '스로틀을 놓으면 덜 먹는다');
});

test('연료가 없는 기종은 그대로다', () => {
  assert.equal(fuelSeconds(EXTENT, 'fighter'), Infinity);
  let jet = { ...createFlightState(EXTENT, 'jet'), phase: 'airborne', y: 300, speed: 90 };
  jet = stepFlight(jet, { throttle: 1 }, 1 / 60, EXTENT, [], 'jet');
  assert.equal(jet.fuel, undefined);
});

test('기수 방향 변환은 수렴이 없으면 예전과 같다', () => {
  const pose = { x: 0, y: 0, z: 0, pitch: 0.3, roll: 0.2, heading: 1.1 };
  assert.deepEqual(toWorld(pose, muzzleAim([1, 2, -3], 0)), toWorld(pose, [0, 0, -1]));
});

test('비행기 무장이 지상 AI 차량을 부순다', () => {
  const pose = { x: 0, y: 60, z: 0, pitch: -0.5, roll: 0, heading: 0, speed: 0, phase: 'airborne' };
  // 기수를 아래로 숙여 앞쪽 지면의 차를 겨눈다. 미사일은 주익 파일런에서 나가므로
  // 기체 중심선이 아니라 그 파일런 아래를 지난다. 무장마다 차를 그 선에 둔다.
  // 폭탄은 추진이 없어 기체 속도만 받는다. 정지한 기체에서는 바로 아래로 떨어지므로
  // 차를 발 밑에 둔다. 기관총과 미사일은 앞으로 나가므로 앞쪽에 둔다.
  const lanes = [
    { plane: 'fighter', weapon: 'cannon', x: 0, z: -80 },
    { plane: 'fighter', weapon: 'missile', x: armamentOf('fighter').missile[0][0], z: -80 },
    { plane: 'bomber', weapon: 'bomb', x: 0, z: 0 },
  ];
  for (const lane of lanes) {
    const mounts = armamentOf(lane.plane);
    const car = { index: 9, x: lane.x, z: lane.z, width: 2.2, depth: 4.3 };
    let arsenal = createArsenal(lane.plane);
    let hit = null;
    for (let frame = 0; frame < 300 && !hit; frame += 1) {
      arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: lane.plane, traffic: [car],
        fire: frame < 40 ? { [lane.weapon]: true } : {} });
      hit = arsenal.hits[0] || null;
    }
    assert.ok(hit, `${lane.plane} ${lane.weapon} 이 차를 맞힌다`);
    assert.equal(hit.index, 9);
  }
});

test('지상 차량이 없으면 hits 가 비어 있다', () => {
  const mounts = armamentOf('fighter');
  const pose = { x: 0, y: 60, z: 0, pitch: -0.5, roll: 0, heading: 0, speed: 0, phase: 'airborne' };
  let arsenal = createArsenal('fighter');
  for (let frame = 0; frame < 60; frame += 1) {
    arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: 'fighter', fire: { cannon: frame < 10 } });
  }
  assert.deepEqual(arsenal.hits, []);
});
