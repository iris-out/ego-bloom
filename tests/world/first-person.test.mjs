import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYE_POINTS, eyePoint, hasFirstPerson,
  cockpitFov, FOV_DEFAULT, NEAR_COCKPIT, NEAR_DEFAULT, FAR_COCKPIT, FAR_DEFAULT,
} from '../../src/world/eyePoints.js';
import { PLANE_KEYS, VEHICLE_KEYS } from '../../src/world/identity.js';
import { GROUND_GUNS, SCOPE_EYE } from '../../src/world/groundWeapons.js';

// 접지면 위 눈높이다. 지상 차량은 CAR_GROUND 1.21, 항공기는 FLIGHT_GROUND 2.1 에서
// 모델 원점 보정을 뺀 값이다. 단위는 미니어처 도시의 월드 단위이고 미터가 아니다.
const aboveGround = (key) => (PLANE_KEYS.includes(key)
  ? 2.1 + eyePoint(key)[1] - 0.2
  : 1.21 + eyePoint(key)[1] - 0.31);

test('아홉 종 모두 전용 눈높이를 갖는다', () => {
  for (const key of [...PLANE_KEYS, ...VEHICLE_KEYS]) {
    const point = eyePoint(key);
    assert.ok(Array.isArray(point) && point.length === 3, `${key} 에 눈높이가 없다`);
    assert.ok(point.every(Number.isFinite), `${key} 눈높이에 유한하지 않은 값이 있다`);
    assert.equal(hasFirstPerson(key), true);
  }
  assert.equal(Object.keys(EYE_POINTS).length, PLANE_KEYS.length + VEHICLE_KEYS.length);
});

test('없는 키는 폴백하지 않는다', () => {
  assert.equal(eyePoint('ufo'), null);
  assert.equal(eyePoint(undefined), null);
  assert.equal(hasFirstPerson('walk'), false);
});

test('눈높이는 모두 서로 다르고 접지면 위에 있다', () => {
  const seen = new Set();
  for (const [key, point] of Object.entries(EYE_POINTS)) {
    const signature = point.join(',');
    assert.ok(!seen.has(signature), `${key} 가 다른 탈것과 같은 좌표를 쓴다`);
    seen.add(signature);
    assert.ok(point[1] > -1.9, `${key} 눈높이가 접지면 아래다`);
  }
});

test('항공기 조종석은 코 쪽에 있다', () => {
  for (const key of PLANE_KEYS) {
    assert.ok(eyePoint(key)[2] < 0, `${key} 조종석이 코 반대쪽이다`);
  }
});

test('축마다 값이 겹치지 않는다', () => {
  // 좌표 세 개를 이어 붙인 비교는 한 축만 같은 경우를 놓친다. 0 은 중앙을 뜻하는
  // 기본값이라 여러 탈것이 함께 쓴다.
  for (const axis of [0, 1, 2]) {
    const owner = new Map();
    for (const [key, point] of Object.entries(EYE_POINTS)) {
      const value = point[axis];
      if (value === 0) continue;
      assert.equal(owner.has(value), false, `${key} 와 ${owner.get(value)} 가 ${axis} 축에서 ${value} 를 공유한다`);
      owner.set(value, key);
    }
  }
});

test('우측통행이라 운전석과 기장석은 왼쪽이다', () => {
  // carPhysics 의 시작 좌표 x=6 이 대로의 오른쪽 차선이므로 이 도시는 우측통행이다.
  // 우측통행에서 조작석은 차체 왼쪽, 즉 음수 x 에 있다. 헬기만 오른쪽 기장석을 따른다.
  for (const key of ['sedan', 'armored', 'bomber']) {
    assert.ok(eyePoint(key)[0] < 0, `${key} 조작석이 오른쪽에 있다`);
  }
  assert.ok(eyePoint('helicopter')[0] > 0, '헬기 기장석이 왼쪽으로 갔다');
});

test('화각은 아홉 종 모두 유한하고 배율이 있는 탈것만 좁아진다', () => {
  const zoomed = ['tank', 'howitzer', 'armored'];
  for (const key of [...PLANE_KEYS, ...VEHICLE_KEYS]) {
    const wide = cockpitFov(key);
    const narrow = cockpitFov(key, true);
    assert.ok(Number.isFinite(wide) && wide > 0, `${key} 화각이 유한하지 않다`);
    assert.ok(Number.isFinite(narrow) && narrow > 0, `${key} 조준 화각이 유한하지 않다`);
    assert.ok(wide > FOV_DEFAULT, `${key} 1인칭 화각이 3인칭보다 좁다`);
    if (zoomed.includes(key)) assert.ok(narrow < wide, `${key} 조준경이 좁아지지 않는다`);
    else assert.equal(narrow, wide, `${key} 는 배율이 없는데 화각이 바뀐다`);
  }
});

test('모르는 키의 화각은 기본값으로 떨어진다', () => {
  // eyePoint 와 달리 화각은 폴백해도 카메라가 빈 공간에 놓이지 않는다.
  assert.equal(cockpitFov('ufo'), 62);
  assert.equal(cockpitFov(undefined, true), 62);
});

test('1인칭 근접면은 실내 조각보다 가깝다', () => {
  assert.ok(NEAR_COCKPIT < NEAR_DEFAULT, '1인칭 근접면이 기본값보다 멀다');
  assert.ok(FAR_COCKPIT < FAR_DEFAULT, '1인칭 원거리면이 기본값보다 멀다');
  // 0.30 은 전투 차량 포수 조준경 아이컵 틀 앞면까지 거리다(GUNNER_CONSOLES 의 tank/howitzer
  // sight.distance 0.35 에서 OpticFrame 두께 0.012 의 절반을 뺀 값, ArmorInteriors 의 GunnerSight).
  assert.ok(NEAR_COCKPIT < 0.30, '근접면이 조준경 아이컵 틀을 잘라낸다');
});

test('접지면 위 눈높이가 탈것 종류에 맞는다', () => {
  const planeLow = Math.min(...PLANE_KEYS.map(aboveGround));
  const vehicleHigh = Math.max(...VEHICLE_KEYS.map(aboveGround));
  assert.ok(vehicleHigh < planeLow, '지상 차량 눈높이가 항공기보다 높다');
  assert.ok(aboveGround('motorcycle') > aboveGround('sedan'), '오토바이가 세단보다 낮다');
  for (const key of ['tank', 'howitzer', 'armored']) {
    assert.ok(aboveGround(key) > aboveGround('sedan'), `${key} 가 세단보다 낮다`);
  }
});

test('바스켓 회전 전투 차량 셋의 눈이 GROUND_GUNS 의 turret 축 근처(수평 0.7 안) 에 있다', () => {
  // CarMode 가 Cockpit 을 GROUND_GUNS[vehicle].turret 에 둔 바스켓 group 으로 감싸 aim.yaw 로
  // 돌리므로, 눈이 그 축에서 수평으로 너무 멀면 포탑이 돌 때 눈이 바스켓 밖으로 빠져나간다.
  // x, z 를 축마다 따로 본다(대각선 유클리드 거리로 묶으면 howitzer 의 z 오프처럼 한 축만
  // 큰 경우를 놓친다). 장갑차는 무인 포탑이 아니라 운전석 위 큐폴라에 차장이 앉고(round 1)
  // CarMode 도 armored 는 바스켓으로 감싸지 않으므로 이 검사에서 뺀다.
  for (const vehicle of ['tank', 'howitzer', 'aa']) {
    const eye = eyePoint(vehicle);
    const [pivotX, , pivotZ] = GROUND_GUNS[vehicle].turret;
    assert.ok(Math.abs(eye[0] - pivotX) <= 0.7, `${vehicle} 눈이 포탑 축에서 x 로 ${eye[0] - pivotX} 만큼 멀다`);
    assert.ok(Math.abs(eye[2] - pivotZ) <= 0.7, `${vehicle} 눈이 포탑 축에서 z 로 ${eye[2] - pivotZ} 만큼 멀다`);
  }
});

test('전투 차량마다 조준경 자리가 있고 포구보다 앞이다', () => {
  // 조준경을 켜면 카메라가 눈이 아니라 이 자리로 간다. 기종이 빠지면 전차 표로 떨어져
  // 차체 안에서 보게 된다.
  for (const [vehicle, gun] of Object.entries(GROUND_GUNS)) {
    const seat = SCOPE_EYE[vehicle];
    assert.ok(seat, `${vehicle} 조준경 자리가 없다`);
    assert.ok(seat.out > gun.reach, `${vehicle} 조준경이 포구 뒤(${seat.out} <= ${gun.reach}) 다`);
    assert.ok(seat.rise > 0, `${vehicle} 조준경이 포신 위가 아니다`);
  }
  assert.equal(Object.keys(SCOPE_EYE).length, Object.keys(GROUND_GUNS).length);
});
