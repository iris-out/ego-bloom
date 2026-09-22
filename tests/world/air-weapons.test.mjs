import test from 'node:test';
import assert from 'node:assert/strict';
import { BOMB, CANNON, MISSILE, cannonRange, createArsenal, gunOf, muzzleAim, stepWeapons } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';
import { airImpact, effectiveRange } from '../../src/world/reticle.js';
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

test('기종 표가 샷거너를 포함한 일곱 기종을 갖는다', () => {
  assert.deepEqual(PLANE_KEYS, ['jet', 'fighter', 'prop', 'interceptor', 'shotgun', 'bomber', 'helicopter']);
  assert.ok(PLANES.bomber && PLANES.prop && PLANES.interceptor && PLANES.shotgun, '비행 성능이 있다');
  assert.equal(armamentOf('interceptor').bomb, undefined, '요격기는 폭탄이 없다');
  assert.equal(armamentOf('prop').missile, undefined, '프로펠러기는 미사일이 없다');
  assert.equal(armamentOf('bomber').cannon, undefined, '폭격기는 기관총이 없다');
  assert.equal(armamentOf('jet'), null, '라이트 제트는 무장이 없다');
});

test('샷거너는 한 번 누르면 산탄을 팡-팡 두 번 쏘고 0.9초 대기한다', () => {
  const gun = gunOf('shotgun');
  assert.equal(gun.range, 150);
  assert.equal(gun.pellets, 8);
  let state = createArsenal('shotgun');
  const options = { pose: pose({ speed: 0 }), mounts: armamentOf('shotgun'), plane: 'shotgun' };
  state = stepWeapons(state, { ...options, dt: 1 / 60, fire: { cannon: true } });
  assert.equal(state.shots, 1);
  assert.equal(state.projectiles.length, gun.pellets);
  state = stepWeapons(state, { ...options, dt: 1 / 60, fire: { cannon: true } });
  assert.equal(state.shots, 1, '첫 포신 직후에는 다시 쏘지 않는다');
  for (let i = 0; i < 6; i += 1) state = stepWeapons(state, { ...options, dt: 1 / 60, fire: { cannon: true } });
  assert.equal(state.shots, 2);
  assert.equal(state.projectiles.length, gun.pellets * 2);
  assert.equal(state.shotgunStage, 2);
  for (let i = 0; i < 53; i += 1) state = stepWeapons(state, { ...options, dt: 1 / 60, fire: { cannon: true } });
  assert.equal(state.shots, 2, '두 번째 포신 뒤 0.9초 동안은 잠긴다');
  state = stepWeapons(state, { ...options, dt: 1 / 60, fire: {} });
  state = stepWeapons(state, { ...options, dt: 1 / 60, fire: { cannon: true } });
  assert.equal(state.shots, 3, '손을 뗐다 다시 누르면 새 더블 샷이 시작된다');
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

test('요격기 2연장 기관포는 100m 앞 중심선으로 모인다', () => {
  const mounts = armamentOf('interceptor');
  assert.equal(mounts.cannon.length, 2);
  assert.equal(mounts.converge, 100);
  for (const port of mounts.cannon) {
    const aim = muzzleAim(port, mounts.converge);
    const travel = (-mounts.converge - port[2]) / aim[2];
    assert.ok(Math.hypot(port[0] + aim[0] * travel, port[1] + aim[1] * travel) < 1e-6);
  }
});

test('요격기 기관포는 기존보다 32% 빠른 연사력으로 10초에 약 111발을 쏜다', () => {
  const gun = gunOf('interceptor');
  assert.equal(gun.interval, 1 / (8.4 * 1.1 * 1.2));
  const fired = run(createArsenal('interceptor'), 'interceptor', { cannon: true }, 600, { pose: { speed: 0 } });
  assert.ok(fired.shots >= 110 && fired.shots <= 113, `발사 수 ${fired.shots}`);
});

test('요격기 기관포는 탄속을 20% 낮추고 낙차와 300m 사거리를 갖는다', () => {
  const gun = gunOf('interceptor');
  assert.equal(gun.speed, 240);
  assert.ok(gun.gravity > 0);
  assert.equal(gun.range, 300);
  assert.equal(cannonRange(180, 'interceptor'), 300);
  assert.equal(effectiveRange('flight', 'interceptor'), 300);
  const fired = stepWeapons(createArsenal('interceptor'), {
    dt: 1 / 60, pose: pose({ speed: 0 }), mounts: armamentOf('interceptor'), plane: 'interceptor', fire: { cannon: true },
  });
  const shell = fired.projectiles[0];
  assert.ok(Math.abs(Math.hypot(shell.vx, shell.vz) - 240) < 0.1, `탄속 ${Math.hypot(shell.vx, shell.vz)}`);
  // y=0.1 포구가 중심선으로 향하는 초기 수직 속도를 빼고, 한 프레임의 중력 가속도만 본다.
  const convergenceVy = -0.1 / Math.hypot(0.3, 0.1, 95.4) * 240;
  assert.ok(Math.abs((shell.vy - convergenceVy) + gun.gravity / 60) < 1e-9, `수직 속도 ${shell.vy}`);
});

test('요격기 기관포 한 번의 발사 이벤트에서 두 포신이 동시에 나간다', () => {
  const fired = stepWeapons(createArsenal('interceptor'), {
    dt: 1 / 60, pose: pose({ speed: 0 }), mounts: armamentOf('interceptor'), plane: 'interceptor', fire: { cannon: true },
  });
  assert.equal(fired.projectiles.filter((projectile) => projectile.kind === 'cannon').length, 2);
  assert.equal(fired.shots, 1, '두 포신은 하나의 연사 이벤트로 기록한다');
  assert.equal(fired.cannonAmmo, gunOf('interceptor').ammo - 1, '탄약은 발사 이벤트 단위로 차감한다');
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

test('폭탄 폭발은 18m 안의 모든 AI 차량을 격파한다', () => {
  const traffic = [
    { index: 1, x: 0, y: 0.31, z: 0, width: 2.2, depth: 4.3, height: 1.6 },
    { index: 2, x: 15, y: 0.31, z: 0, width: 2.2, depth: 4.3, height: 1.6 },
    { index: 3, x: 19, y: 0.31, z: 0, width: 2.2, depth: 4.3, height: 1.6 },
  ];
  let state = {
    ...createArsenal('bomber'),
    projectiles: [{ id: 7, kind: 'bomb', x: 0, y: 0.35, z: 0, vx: 0, vy: -8, vz: 0, age: 1, life: BOMB.life, travel: 0 }],
  };
  state = stepWeapons(state, { dt: 1 / 60, pose: pose(), mounts: armamentOf('bomber'), plane: 'bomber', traffic });
  assert.deepEqual(state.hits.map((hit) => hit.index).sort(), [1, 2]);
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
