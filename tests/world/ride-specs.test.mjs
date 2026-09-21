import test from 'node:test';
import assert from 'node:assert/strict';
import { RIDE_GROUPS, rideOf } from '../../src/world/rideSpecs.js';
import { PLANE_KEYS, VEHICLE_KEYS } from '../../src/world/identity.js';

const all = RIDE_GROUPS.flatMap((group) => group.rides);

test('세 그룹이 등록부와 같은 수를 담는다', () => {
  assert.deepEqual(RIDE_GROUPS.map((group) => group.key), ['flight', 'car', 'walk']);
  const counts = Object.fromEntries(RIDE_GROUPS.map((group) => [group.key, group.rides.length]));
  // 손으로 적은 숫자를 두지 않는다. 탈것을 더할 때마다 이 테스트가 먼저 깨진다.
  assert.deepEqual(counts, { flight: PLANE_KEYS.length, car: VEHICLE_KEYS.length, walk: 1 });
  assert.ok(counts.flight >= 6 && counts.car >= 6, `항공기 ${counts.flight} 차량 ${counts.car}`);
});

test('키 목록이 identity 와 어긋나지 않는다', () => {
  assert.deepEqual(RIDE_GROUPS[0].rides.map((ride) => ride.key), PLANE_KEYS);
  assert.deepEqual(RIDE_GROUPS[1].rides.map((ride) => ride.key), VEHICLE_KEYS);
});

test('모든 탈것이 이름과 코드와 설명을 갖는다', () => {
  for (const ride of all) {
    for (const field of ['ko', 'code', 'eyebrow', 'note']) {
      assert.ok(typeof ride[field] === 'string' && ride[field].length > 0,
        `${ride.key} 에 ${field} 가 없다`);
    }
  }
});

test('막대는 0 과 1 사이이고 셋 다 있다', () => {
  for (const ride of all) {
    for (const bar of ['speed', 'agility', 'stability']) {
      const value = ride.bars[bar];
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1,
        `${ride.key} 의 ${bar} 가 ${value} 다`);
    }
  }
});

test('차량 막대는 물리 상수를 따라간다', () => {
  const sedan = rideOf('car', 'sedan'), bike = rideOf('car', 'motorcycle'), tank = rideOf('car', 'tank');
  assert.ok(bike.bars.speed > sedan.bars.speed, '오토바이가 세단보다 빠르다');
  assert.ok(sedan.bars.stability > bike.bars.stability, '세단이 접지력이 좋다');
  assert.ok(sedan.bars.speed > tank.bars.speed, '전차가 가장 느리다');
  assert.ok(bike.bars.agility > tank.bars.agility, '전차가 가장 둔하다');
});

test('항공기 막대는 기종별 성능을 따라간다', () => {
  const jet = rideOf('flight', 'jet'), fighter = rideOf('flight', 'fighter');
  const bomber = rideOf('flight', 'bomber'), prop = rideOf('flight', 'prop');
  assert.ok(fighter.bars.speed > jet.bars.speed);
  assert.ok(jet.bars.speed > bomber.bars.speed);
  assert.ok(bomber.bars.speed > prop.bars.speed, '프로펠러기가 가장 느리다');
  assert.ok(prop.bars.agility > bomber.bars.agility, '프로펠러기가 가장 잘 돈다');
  assert.ok(fighter.bars.agility > bomber.bars.agility);
  // 요격기가 가장 빠르다. 부스트를 빼고 기본 최고 속도만 비교한다.
  const interceptor = rideOf('flight', 'interceptor');
  assert.ok(interceptor.bars.speed > fighter.bars.speed, '요격기가 가장 빠르다');
  assert.ok(jet.bars.stability > fighter.bars.stability, '실속 속도가 낮은 제트가 더 안정적이다');
});

test('없는 탈것은 null 이다', () => {
  assert.equal(rideOf('car', 'ufo'), null);
  assert.equal(rideOf('boat', 'sedan'), null);
  assert.equal(rideOf(undefined, undefined), null);
});
