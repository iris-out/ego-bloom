import test from 'node:test';
import assert from 'node:assert/strict';
import { BUMP_DAMAGE, BUMP_GRACE, BUMP_REPAIR_DELAY, DAMAGE, HULL, REPAIR_DELAY, ROAD_HULL, bump, bumpGuarded, canHarm, createHealth, damageOf, hullRatio, hurt, isArmed, repair } from '../../src/world/health.js';
import { PLANE_KEYS, VEHICLE_KEYS } from '../../src/world/identity.js';

test('무장 탈것은 무기 체력을, 민간 지상 차량은 부딪힘 체력을 갖는다', () => {
  const armed = [];
  for (const key of PLANE_KEYS) if (isArmed('flight', key)) armed.push(key);
  for (const key of VEHICLE_KEYS) if (isArmed('car', key)) armed.push(key);
  assert.deepEqual(armed, ['fighter', 'prop', 'interceptor', 'shotgun', 'bomber', 'tank', 'howitzer', 'armored', 'aa']);
  assert.equal(isArmed('walk', 'walk'), false);
  const planes = ['fighter', 'prop', 'interceptor', 'shotgun', 'bomber'];
  for (const key of armed) assert.equal(createHealth(planes.includes(key) ? 'flight' : 'car', key).max, HULL[key]);
  // 민간 차량은 무기에는 안 다치지만 부딪힘 내구도를 갖는다.
  for (const key of ['sedan', 'motorcycle']) assert.equal(createHealth('car', key).max, ROAD_HULL);
  for (const key of ['jet', 'helicopter']) assert.equal(createHealth('flight', key).max, 0);
  assert.equal(createHealth('walk', 'walk').max, 0);
});

test('비전투 탈것은 어떤 포탄에도 피해를 받지 않는다', () => {
  for (const [kind, key] of [['car', 'sedan'], ['car', 'motorcycle'], ['flight', 'jet'], ['flight', 'helicopter'], ['walk', 'walk']]) {
    const health = createHealth(kind, key);
    assert.equal(canHarm(health), false, `${key} 가 목표가 됐다`);
    for (const weapon of Object.keys(DAMAGE)) {
      assert.equal(hurt(health, damageOf(weapon), 1), health, `${key} 가 ${weapon} 에 맞았다`);
    }
  }
});

test('전차는 전차포 세 발에 부서지고 부서진 뒤에는 더 깎이지 않는다', () => {
  let tank = createHealth('car', 'tank');
  for (let shot = 0; shot < 2; shot += 1) {
    tank = hurt(tank, damageOf('tank'), shot);
    assert.equal(tank.wrecked, false);
  }
  assert.equal(tank.hp, HULL.tank - DAMAGE.tank * 2);
  tank = hurt(tank, damageOf('tank'), 3);
  assert.equal(tank.hp, 0);
  assert.equal(tank.wrecked, true);
  assert.equal(hurt(tank, damageOf('tank'), 4), tank);
  assert.equal(canHarm(tank), false);
});

test('피해량은 무기가 정하고 모르는 무기는 0 이다', () => {
  assert.equal(damageOf('missile'), DAMAGE.missile);
  assert.equal(damageOf('spoon'), 0);
  assert.equal(damageOf(undefined), 0);
  const fighter = hurt(createHealth('flight', 'fighter'), damageOf('cannon'), 0);
  assert.equal(fighter.hp, HULL.fighter - DAMAGE.cannon);
});

test('피격 후 유예 시간이 지나면 차체가 스스로 찬다', () => {
  const hit = hurt(createHealth('car', 'armored'), 300, 10);
  assert.equal(repair(hit, 0.05, 10 + REPAIR_DELAY - 0.1), hit);
  const mending = repair(hit, 0.05, 10 + REPAIR_DELAY + 1);
  assert.ok(mending.hp > hit.hp);
  assert.ok(mending.hp <= HULL.armored);
  // 부서진 차체는 되살아나지 않는다.
  const wrecked = hurt(createHealth('car', 'armored'), HULL.armored, 0);
  assert.equal(repair(wrecked, 0.05, 999), wrecked);
});

test('게이지 비율은 내구도가 있는 탈것만 주고 비정상 값을 견딘다', () => {
  assert.equal(hullRatio(createHealth('car', 'sedan')), 1);
  assert.equal(hullRatio(createHealth('flight', 'jet')), null);
  assert.equal(hullRatio(null), null);
  assert.equal(hullRatio(createHealth('car', 'tank')), 1);
  assert.equal(hullRatio(hurt(createHealth('car', 'tank'), HULL.tank / 2, 0)), 0.5);
  const odd = hurt(createHealth('car', 'tank'), NaN, NaN);
  assert.equal(odd.hp, HULL.tank);
});

test('차끼리 부딪히면 20 씩 깎이고 1.3초 동안은 다시 깎이지 않는다', () => {
  let sedan = createHealth('car', 'sedan');
  sedan = bump(sedan, 10);
  assert.equal(sedan.hp, ROAD_HULL - BUMP_DAMAGE);
  // 무적 시간 안에는 몇 번을 닿아도 그대로다.
  assert.equal(bump(sedan, 10 + BUMP_GRACE - 0.01), sedan);
  assert.equal(bumpGuarded(sedan, 10 + 0.5), true);
  assert.equal(bumpGuarded(sedan, 10 + BUMP_GRACE + 0.01), false);
  sedan = bump(sedan, 10 + BUMP_GRACE);
  assert.equal(sedan.hp, ROAD_HULL - BUMP_DAMAGE * 2);
  // 다섯 번이면 선다. 무적 시간을 넉넉히 넘겨 부른다.
  for (let i = 3; i <= 5; i += 1) sedan = bump(sedan, 10 + i * 2);
  assert.equal(sedan.hp, 0);
  assert.equal(sedan.wrecked, true);
});

test('부딪힘 체력은 20초 뒤에 천천히 찬다', () => {
  const hit = bump(createHealth('car', 'sedan'), 0);
  assert.equal(repair(hit, 0.05, BUMP_REPAIR_DELAY - 0.1), hit, '20초 전에는 차지 않는다');
  const mending = repair(hit, 0.05, BUMP_REPAIR_DELAY + 1);
  assert.ok(mending.hp > hit.hp);
  // 무장 차량보다 늦게 시작하고 느리게 찬다.
  const tank = hurt(createHealth('car', 'tank'), 100, 0);
  assert.ok(tank.repairDelay < hit.repairDelay && tank.repairRate > hit.repairRate);
});

test('민간 차량은 부딪힘 체력이 있어도 무기에는 다치지 않는다', () => {
  const sedan = createHealth('car', 'sedan');
  assert.equal(canHarm(sedan), false);
  for (const weapon of Object.keys(DAMAGE)) assert.equal(hurt(sedan, damageOf(weapon), 1), sedan);
});
