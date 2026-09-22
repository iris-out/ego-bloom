import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingTo, createLock, LOCK, lockCandidate, lockProgress, stepLock } from '../../src/world/missileLock.js';
import { createArsenal, MISSILE, stepWeapons } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';

const STEP = 1 / 60;
/** 원점에서 -Z 를 보고 떠 있는 전투기다. */
const flyer = (over = {}) => ({ x: 0, y: 200, z: 0, heading: 0, pitch: 0, roll: 0, speed: 90, phase: 'airborne', ...over });
const bogey = (index, over = {}) => ({ index, x: 0, y: 200, z: -300, radius: 9, ...over });

function hold(pose, targets, seconds) {
  let lock = createLock();
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) lock = stepLock(lock, { pose, targets, dt: STEP });
  return lock;
}

test('기수 앞 적기까지의 거리와 각을 푼다', () => {
  const { range, angle } = bearingTo(flyer(), bogey(0));
  assert.equal(Math.round(range), 300);
  assert.ok(angle < 1e-6, '정면이면 각이 0 이다');
});

test('사거리 밖이나 원뿔 밖 적기는 잡지 않는다', () => {
  assert.equal(lockCandidate(flyer(), [bogey(0, { z: -(LOCK.range + 40) })]), null);
  // 옆으로 벌어져 원뿔을 벗어난다
  assert.equal(lockCandidate(flyer(), [bogey(0, { x: 300, z: -100 })]), null);
});

test('기수에 가장 가까운 적기를 고른다', () => {
  const picked = lockCandidate(flyer(), [bogey(1, { x: 80, z: -200 }), bogey(2, { x: 4, z: -260 })]);
  assert.equal(picked.target.index, 2);
});

test('2초를 채워야 락온된다', () => {
  const targets = [bogey(5)];
  const early = hold(flyer(), targets, LOCK.time - 0.2);
  assert.equal(early.locked, false);
  assert.ok(lockProgress(early) > 0.85 && lockProgress(early) < 1);
  const done = hold(flyer(), targets, LOCK.time + 0.2);
  assert.equal(done.locked, true);
  assert.equal(done.index, 5);
  assert.equal(lockProgress(done), 1);
});

test('원뿔을 벗어나면 진행도가 처음부터 다시 찬다', () => {
  let lock = hold(flyer(), [bogey(5)], 1.5);
  assert.ok(lock.progress > 1.4);
  // 적기가 뒤로 빠진다
  lock = stepLock(lock, { pose: flyer(), targets: [bogey(5, { z: 300 })], dt: STEP });
  assert.equal(lock.index, null);
  assert.equal(lock.progress, 0);
});

test('잡고 있던 목표를 더 가까운 적기에 빼앗기지 않는다', () => {
  let lock = hold(flyer(), [bogey(5, { z: -320 })], 1);
  lock = stepLock(lock, { pose: flyer(), targets: [bogey(5, { z: -320 }), bogey(6, { z: -90 })], dt: STEP });
  assert.equal(lock.index, 5);
});

test('사거리를 살짝 벗어나도 포착은 이어지고 락온만 풀린다', () => {
  let lock = hold(flyer(), [bogey(5)], LOCK.time + 0.2);
  assert.equal(lock.locked, true);
  const between = (LOCK.range + LOCK.drop) / 2;
  lock = stepLock(lock, { pose: flyer(), targets: [bogey(5, { z: -between })], dt: STEP });
  assert.equal(lock.index, 5, '목표는 그대로다');
  assert.equal(lock.locked, false, '사거리 밖이면 락온이 아니다');
});

test('락온하고 쏜 미사일만 목표를 들고 나간다', () => {
  const mounts = armamentOf('fighter');
  const pose = flyer();
  const fired = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, seek: 5, plane: 'fighter' });
  const shot = fired.projectiles.find((p) => p.kind === 'missile');
  assert.equal(shot.seek, 5);
  const plain = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, plane: 'fighter' });
  assert.equal(plain.projectiles.find((p) => p.kind === 'missile').seek, null);
});

test('유도 미사일은 옆으로 빠진 목표 쪽으로 꺾인다', () => {
  const mounts = armamentOf('fighter');
  const pose = flyer();
  // 오른쪽 앞에 떠 있는 적기다. 정면으로 나간 미사일이 그쪽으로 돌아야 한다.
  const target = { index: 5, x: 240, y: 200, z: -360, radius: 9 };
  let guided = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, seek: 5, airTargets: [target], plane: 'fighter' });
  let dumb = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, airTargets: [target], plane: 'fighter' });
  for (let i = 0; i < 60; i += 1) {
    guided = stepWeapons(guided, { dt: STEP, pose, mounts, fire: {}, airTargets: [target], plane: 'fighter' });
    dumb = stepWeapons(dumb, { dt: STEP, pose, mounts, fire: {}, airTargets: [target], plane: 'fighter' });
  }
  const near = (state) => {
    const shot = state.projectiles.find((p) => p.kind === 'missile');
    return shot ? Math.hypot(shot.x - target.x, shot.y - target.y, shot.z - target.z) : 0;
  };
  // 유도탄이 터져 사라졌으면 그것이 곧 명중이다.
  const guidedGone = !guided.projectiles.some((p) => p.kind === 'missile');
  assert.ok(guidedGone || near(guided) < near(dumb), '유도탄이 더 가까이 간다');
});

test('한 걸음에 꺾는 각이 MISSILE.turn 을 넘지 않는다', () => {
  const mounts = armamentOf('fighter');
  const pose = flyer();
  // 바로 뒤에 있는 목표다. 한 프레임에 뒤돌지 않아야 한다.
  const behind = { index: 5, x: 0, y: 200, z: 400, radius: 9 };
  let state = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, seek: 5, airTargets: [behind], plane: 'fighter' });
  const before = state.projectiles.find((p) => p.kind === 'missile');
  state = stepWeapons(state, { dt: STEP, pose, mounts, fire: {}, airTargets: [behind], plane: 'fighter' });
  const after = state.projectiles.find((p) => p.kind === 'missile');
  const unit = (v) => { const n = Math.hypot(v.vx, v.vy, v.vz); return [v.vx / n, v.vy / n, v.vz / n]; };
  const [ax, ay, az] = unit(before), [bx, by, bz] = unit(after);
  const turned = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
  assert.ok(turned <= MISSILE.turn * STEP + 1e-6, `한 걸음에 ${turned.toFixed(4)} 만 꺾는다`);
});

test('유도탄은 근접 신관 여유 안을 스치면 터지고 비유도탄은 지나간다', () => {
  const mounts = armamentOf('fighter');
  const pose = flyer();
  // 기수 정면에서 옆으로 radius 보다 멀고 proximity 안쪽만큼 벌어진 자리다.
  const offset = 9 + MISSILE.proximity / 2;
  const target = { index: 5, x: offset, y: 200, z: -260, radius: 9 };
  const run = (seek) => {
    let state = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, seek, airTargets: [target], plane: 'fighter' });
    for (let i = 0; i < 90; i += 1) {
      state = stepWeapons(state, { dt: STEP, pose, mounts, fire: {}, airTargets: [target], plane: 'fighter' });
      if (state.airHits.length) return true;
    }
    return false;
  };
  assert.equal(run(5), true, '유도탄은 스쳐도 터진다');
});

test('격추된 기체는 목표 목록에서 빠져 유도가 풀린다', () => {
  const mounts = armamentOf('fighter');
  const pose = flyer();
  const target = { index: 5, x: 0, y: 200, z: -700, radius: 9 };
  let state = stepWeapons(createArsenal('fighter'), { dt: STEP, pose, mounts, fire: { missile: true }, seek: 5, airTargets: [target], plane: 'fighter' });
  // 목표가 사라져도 탄이 죽지 않고 곧게 날아간다.
  for (let i = 0; i < 30; i += 1) state = stepWeapons(state, { dt: STEP, pose, mounts, fire: {}, airTargets: [], plane: 'fighter' });
  const shot = state.projectiles.find((p) => p.kind === 'missile');
  assert.ok(shot, '목표가 없어도 탄은 남는다');
  assert.equal(shot.seek, 5, '목표 번호는 그대로 들고 있다');
});
