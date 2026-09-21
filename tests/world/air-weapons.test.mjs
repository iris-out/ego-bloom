import test from 'node:test';
import assert from 'node:assert/strict';
import { BOMB, CANNON, MISSILE, createArsenal, gunOf, stepWeapons } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';
import { airImpact } from '../../src/world/reticle.js';
import { PLANE_KEYS } from '../../src/world/identity.js';
import { PLANES } from '../../src/world/flightPhysics.js';

const pose = (over = {}) => ({ x: 0, y: 240, z: 0, heading: 0, pitch: 0, roll: 0, speed: 70, phase: 'airborne', ...over });
const run = (state, plane, fire, frames, extra = {}) => {
  let next = state;
  for (let i = 0; i < frames; i++) {
    next = stepWeapons(next, { dt: 1 / 60, pose: pose(extra.pose), fire, mounts: armamentOf(plane), plane, ...extra.options });
  }
  return next;
};

test('기종 표가 여섯 기종을 갖고 폭격기, 프로펠러기, 요격기가 들어 있다', () => {
  assert.deepEqual(PLANE_KEYS, ['jet', 'fighter', 'prop', 'interceptor', 'bomber', 'helicopter']);
  assert.ok(PLANES.bomber && PLANES.prop && PLANES.interceptor, '세 기종의 비행 성능이 있다');
  assert.equal(armamentOf('interceptor').bomb, undefined, '요격기는 폭탄이 없다');
  assert.equal(armamentOf('prop').missile, undefined, '프로펠러기는 미사일이 없다');
  assert.equal(armamentOf('bomber').cannon, undefined, '폭격기는 기관총이 없다');
  assert.equal(armamentOf('jet'), null, '라이트 제트는 무장이 없다');
});

test('프로펠러기 기관총이 전투기보다 빠르게 나가고 탄속은 더 느리다', () => {
  const prop = gunOf('prop'), fighter = gunOf('fighter');
  assert.ok(prop.interval < fighter.interval, `프로펠러 ${prop.interval} 전투기 ${fighter.interval}`);
  assert.ok(prop.speed < fighter.speed);
  assert.equal(fighter, CANNON);

  // 1초를 쏘면 연사 간격만큼 나간다. 프로펠러기가 더 많이 쏜다.
  const propShots = run(createArsenal('prop'), 'prop', { cannon: true }, 60).shots;
  const fighterShots = run(createArsenal('fighter'), 'fighter', { cannon: true }, 60).shots;
  assert.ok(propShots > fighterShots, `프로펠러 ${propShots} 발, 전투기 ${fighterShots} 발`);
  // 발사 간격은 프레임 단위로 끊기므로 이론값보다 적게 나간다. 전투기 이론값보다는 많아야 한다.
  assert.ok(propShots >= 1 / fighter.interval, `프로펠러 ${propShots} 발`);
});

test('폭탄창이 열려야 폭탄이 나가고 손을 떼면 닫힌다', () => {
  let state = createArsenal('bomber');
  assert.equal(state.bayOpen, 0);
  assert.equal(state.bombAmmo, BOMB.ammo);

  // 문이 열리는 동안에는 한 발도 나가지 않는다.
  const opening = run(state, 'bomber', { bomb: true }, 12);
  assert.ok(opening.bayOpen > 0 && opening.bayOpen < 1, `문 ${opening.bayOpen}`);
  assert.equal(opening.bombs, 0);

  state = run(state, 'bomber', { bomb: true }, 120);
  assert.equal(state.bayOpen, 1);
  assert.ok(state.bombs >= 2, `투하 ${state.bombs} 발`);
  assert.equal(state.bombAmmo, BOMB.ammo - state.bombs);

  // 손을 떼면 유지 시간이 지난 뒤 문이 닫힌다.
  const closed = run(state, 'bomber', {}, 60 * 3);
  assert.equal(closed.bayOpen, 0);
  assert.equal(closed.bombs, state.bombs, '문이 닫히는 동안 더 나가지 않는다');
});

test('폭탄은 추진 없이 떨어져 지면에서 터진다', () => {
  const dropped = run(createArsenal('bomber'), 'bomber', { bomb: true }, 60);
  const bomb = dropped.projectiles.find((projectile) => projectile.kind === 'bomb');
  assert.ok(bomb, '폭탄이 날아가고 있다');
  // 투하 순간에는 기체 속도만 갖는다. 아래로 가속만 붙는다.
  assert.ok(bomb.vy < 0, `수직 속도 ${bomb.vy}`);
  assert.ok(Math.abs(Math.hypot(bomb.vx, bomb.vz) - 70) < 2, '수평 속도는 기체 속도 그대로다');

  // 낙하시켜 지면 폭발을 확인한다. 그 전에 새 폭탄이 섞이지 않게 투하를 멈춘다.
  let state = dropped;
  let seen = 0;
  for (let i = 0; i < 60 * 12 && !seen; i++) {
    state = stepWeapons(state, { dt: 1 / 60, pose: pose(), fire: {}, mounts: armamentOf('bomber'), plane: 'bomber' });
    seen = state.blasts.filter((blast) => blast.kind === 'bomb').length;
  }
  assert.ok(seen > 0, '폭탄이 지면에서 터졌다');
  const blast = state.blasts.find((entry) => entry.kind === 'bomb');
  assert.equal(blast.size, BOMB.blast);
  assert.ok(BOMB.blast > MISSILE.blast, '폭탄이 미사일보다 크게 터진다');
});

test('지상에서는 투하하지 않고 활주로에 서면 재장전한다', () => {
  const grounded = run(createArsenal('bomber'), 'bomber', { bomb: true }, 120, { pose: { phase: 'runway', y: 2.1 } });
  assert.equal(grounded.bombs, 0);
  assert.equal(grounded.bombAmmo, BOMB.ammo);

  const spent = { ...createArsenal('bomber'), bombAmmo: 1 };
  const empty = run(spent, 'bomber', { bomb: true }, 240);
  assert.equal(empty.bombAmmo, 0);
  assert.equal(empty.bombs, 1, '탄이 없으면 더 나가지 않는다');
  const reloaded = run(empty, 'bomber', {}, 6, { pose: { phase: 'runway', y: 2.1 } });
  assert.equal(reloaded.bombAmmo, BOMB.ammo);
});

test('탄착 표식이 기종마다 다른 무장을 푼다', () => {
  const level = { ...pose(), key: 'bomber' };
  const bomb = airImpact(level, 'bomb');
  assert.equal(bomb.hit, 'ground');
  assert.ok(bomb.range > 0, `투하 거리 ${bomb.range}`);
  // 같은 고도에서 기관총은 훨씬 가까이 닿는다. 폭탄은 멀리 날아가 떨어진다.
  const gun = airImpact({ ...pose(), key: 'prop' }, 'cannon');
  assert.ok(gun.range < bomb.range);
  assert.equal(airImpact({ ...pose(), key: 'jet' }, 'cannon'), null, '무장이 없는 기종은 해답이 없다');
});

test('장착점이 없는 무장은 같은 키를 눌러도 나가지 않는다', () => {
  // 폭격기는 기관총이 없다. Space 가 투하와 같은 키라 기관총 요청이 함께 들어온다.
  const bomber = run(createArsenal('bomber'), 'bomber', { cannon: true, missile: true, bomb: true }, 120);
  assert.equal(bomber.shots, 0, '폭격기에서 총알이 나갔다');
  assert.equal(bomber.rockets, 0, '폭격기에서 미사일이 나갔다');
  assert.ok(bomber.bombs > 0, '폭탄은 나간다');
  assert.equal(bomber.projectiles.every((projectile) => projectile.kind === 'bomb'), true);

  // 프로펠러기는 미사일이 없다. 기관총만 나간다.
  const prop = run(createArsenal('prop'), 'prop', { cannon: true, missile: true, bomb: true }, 120);
  assert.ok(prop.shots > 0);
  assert.equal(prop.rockets, 0, '프로펠러기에서 미사일이 나갔다');
  assert.equal(prop.bombs, 0, '프로펠러기에서 폭탄이 나갔다');
});

/** 도로를 메운 AI 차량이다. 세로 범위는 traffic.js 가 주는 것과 같다. */
const groundCars = () => {
  const cars = [];
  for (let z = -40; z > -1200; z -= 6) cars.push({ index: cars.length, x: 0, z, y: 0.31, width: 2.2, depth: 4.3, height: 1.6 });
  return cars;
};

/** 기관총을 firing 프레임 동안 쏘고 frames 프레임을 굴려 지상 명중 수를 센다. */
function strafe(over, frames = 240, firing = 20) {
  const traffic = groundCars();
  const options = { mounts: armamentOf('fighter'), plane: 'fighter', traffic, extent: 2000 };
  let state = createArsenal('fighter'), hits = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    state = stepWeapons(state, { dt: 1 / 60, pose: pose(over), fire: { cannon: frame < firing }, ...options });
    hits += state.hits.length;
  }
  return hits;
}

test('고도 300m 에서 수평으로 쏜 기관총은 아래 차를 부수지 않는다', () => {
  assert.equal(strafe({ y: 300, pitch: 0 }), 0, '허공을 쏴도 차가 부서진다');
  // 고도만 낮춰도 같다. 탄이 차 지붕 위를 지나면 맞지 않는다.
  assert.equal(strafe({ y: 40, pitch: 0 }), 0, '40m 수평 사격이 차를 부쉈다');
  // 강하해 차체 높이로 내려오면 부순다. pitch 가 음수면 기수가 내려간다.
  assert.ok(strafe({ y: 120, pitch: -0.6 }) > 0, '강하 사격이 한 대도 못 맞혔다');
});
