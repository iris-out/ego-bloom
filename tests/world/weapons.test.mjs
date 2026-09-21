import test from 'node:test';
import assert from 'node:assert/strict';
import { CANNON, MISSILE, createArsenal, stepWeapons, toWorld } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';

const mounts = armamentOf('fighter');
const airborne = { x: 0, y: 60, z: 0, heading: 0, pitch: 0, roll: 0, speed: 80, phase: 'airborne' };
const run = (state, options) => stepWeapons(state, { dt: 1 / 60, pose: airborne, mounts, ...options });

test('기수 방향 변환이 비행 물리의 진행 방향과 일치한다', () => {
  const pose = { heading: 0.7, pitch: 0.2, roll: 0.4 };
  const forward = toWorld(pose, [0, 0, -1]);
  assert.ok(Math.abs(forward.x - -Math.sin(pose.heading) * Math.cos(pose.pitch)) < 1e-12);
  assert.ok(Math.abs(forward.y - Math.sin(pose.pitch)) < 1e-12);
  assert.ok(Math.abs(forward.z - -Math.cos(pose.heading) * Math.cos(pose.pitch)) < 1e-12);
});

test('연사 간격과 잔탄이 기관총 발사를 제한한다', () => {
  let state = run(createArsenal(), { fire: { cannon: true } });
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.cannonAmmo, CANNON.ammo - 1);
  state = run(state, { fire: { cannon: true } });
  assert.equal(state.projectiles.length, 1, '쿨다운 중에는 새 탄이 생기지 않는다');
  for (let i = 0; i < 4; i += 1) state = run(state, { fire: {} });
  state = run(state, { fire: { cannon: true } });
  assert.equal(state.cannonAmmo, CANNON.ammo - 2);
  const empty = run({ ...createArsenal(), cannonAmmo: 0 }, { fire: { cannon: true } });
  assert.equal(empty.projectiles.length, 0);
});

test('미사일은 쿨다운과 동시 발사 수 상한을 지킨다', () => {
  let state = run(createArsenal(), { fire: { missile: true } });
  assert.equal(state.missileAmmo, MISSILE.ammo - 1);
  state = run(state, { fire: { missile: true } });
  assert.equal(state.projectiles.filter(p => p.kind === 'missile').length, 1);
  const saturated = { ...createArsenal(), projectiles: Array.from({ length: MISSILE.flying }, (_, i) => ({ id: i, kind: 'missile', x: 0, y: 60, z: -30 - i, vx: 0, vy: 0, vz: -150, age: 0, life: MISSILE.life })) };
  const blocked = run(saturated, { fire: { missile: true } });
  assert.equal(blocked.missileAmmo, MISSILE.ammo);
});

test('지상에서는 쏘지 못하고 활주로에 서면 재장전한다', () => {
  const parked = { ...airborne, phase: 'runway' };
  const state = stepWeapons({ ...createArsenal(), cannonAmmo: 3, missileAmmo: 0 }, { dt: 1 / 60, pose: parked, mounts, fire: { cannon: true, missile: true } });
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.cannonAmmo, CANNON.ammo);
  assert.equal(state.missileAmmo, MISSILE.ammo);
});

test('바닥과 건물에 닿으면 발사체가 폭발로 바뀐다', () => {
  const falling = { ...createArsenal(), projectiles: [{ id: 1, kind: 'missile', x: 0, y: 1, z: 0, vx: 0, vy: -80, vz: 0, age: 0, life: MISSILE.life }] };
  const ground = stepWeapons(falling, { dt: 1 / 30, pose: airborne, mounts });
  assert.equal(ground.projectiles.length, 0);
  assert.equal(ground.blasts.length, 1);
  assert.equal(ground.blasts[0].size, MISSILE.blast);

  const building = { x: 0, z: -40, height: 50, width: 20, depth: 20 };
  const incoming = { ...createArsenal(), projectiles: [{ id: 2, kind: 'cannon', x: 0, y: 20, z: -20, vx: 0, vy: 0, vz: -320, age: 0, life: CANNON.life }] };
  const hit = stepWeapons(incoming, { dt: 1 / 30, pose: airborne, mounts, obstacles: [building] });
  assert.equal(hit.projectiles.length, 0);
  assert.equal(hit.blasts[0].size, CANNON.blast);
});

test('수명이 끝난 발사체와 폭발은 사라지고 입력 상태를 건드리지 않는다', () => {
  const source = { ...createArsenal(),
    projectiles: [{ id: 3, kind: 'cannon', x: 0, y: 60, z: 0, vx: 0, vy: 0, vz: -320, age: CANNON.life, life: CANNON.life }],
    blasts: [{ id: 4, kind: 'cannon', x: 0, y: 5, z: 0, age: CANNON.blastLife, life: CANNON.blastLife, size: CANNON.blast }] };
  const snapshot = JSON.stringify(source);
  const state = stepWeapons(source, { dt: 1 / 60, pose: airborne, mounts, fire: { cannon: true } });
  assert.equal(state.projectiles.filter(p => p.age > 1).length, 0);
  assert.equal(state.blasts.length, 0);
  assert.equal(JSON.stringify(source), snapshot, '입력 상태는 변형하지 않는다');
});

test('비정상 delta 와 좌표는 발사체를 날려버리지 않는다', () => {
  let state = run(createArsenal(), { fire: { cannon: true } });
  state = stepWeapons(state, { dt: NaN, pose: airborne, mounts });
  assert.ok(state.projectiles.every(p => [p.x, p.y, p.z].every(Number.isFinite)));
  const far = stepWeapons({ ...createArsenal(), projectiles: [{ id: 5, kind: 'cannon', x: 9000, y: 60, z: 0, vx: 320, vy: 0, vz: 0, age: 0, life: CANNON.life }] },
    { dt: 1 / 60, pose: airborne, mounts, extent: 400 });
  assert.equal(far.projectiles.length, 0);
});
