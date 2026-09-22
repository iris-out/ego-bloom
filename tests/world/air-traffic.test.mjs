import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIR_HITS, AIR_RESPAWN, AIR_WRECK_LIFE, airPlaneOf, airTrafficPose, airTrafficTargets,
  applyAirHit, collidesWith, createAirCombat, downAirTraffic, hitsSphere, reviveAirTraffic, wreckAge,
} from '../../src/world/airTraffic.js';
import { createArsenal, stepWeapons, toWorld } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';
import { flightBoundary } from '../../src/world/flightPhysics.js';

const EXTENT = 900;

test('같은 시간과 같은 index 는 항상 같은 자세를 준다', () => {
  for (const index of [0, 1, 5, 9, 13]) {
    assert.deepEqual(airTrafficPose(index, 12.5, EXTENT), airTrafficPose(index, 12.5, EXTENT));
  }
  assert.notDeepEqual(airTrafficPose(3, 0, EXTENT), airTrafficPose(3, 9, EXTENT));
});

test('비전투 기종만 띄우고 모든 값이 유한하다', () => {
  for (const extent of [EXTENT, 180, 0, NaN, -40]) {
    for (let index = 0; index < 28; index += 1) {
      const pose = airTrafficPose(index, index * 0.71, extent);
      assert.ok(['jet', 'helicopter'].includes(pose.plane), '전투 기체를 띄우지 않는다');
      for (const key of ['x', 'y', 'z', 'heading', 'pitch', 'roll', 'radius']) {
        assert.ok(Number.isFinite(pose[key]), `${key} 가 유한하다`);
      }
      assert.ok(pose.y > 20, '지면에 닿지 않는다');
    }
  }
});

test('궤도는 비행 구역 안에 있고 고도가 건물 위다', () => {
  const limit = flightBoundary(EXTENT);
  for (let index = 0; index < 28; index += 1) {
    for (const time of [0, 37, 211]) {
      const pose = airTrafficPose(index, time, EXTENT);
      assert.ok(Math.hypot(pose.x, pose.z) < limit, '경계를 넘지 않는다');
    }
  }
});

test('기수가 진행 방향을 본다', () => {
  // 기수는 -Z 이고 회전은 YXZ 다. 조금 뒤 위치와 기수 방향이 같아야 한다.
  for (let index = 0; index < 8; index += 1) {
    const now = airTrafficPose(index, 40, EXTENT), soon = airTrafficPose(index, 40.4, EXTENT);
    const travel = Math.hypot(soon.x - now.x, soon.z - now.z);
    const nose = toWorld({ ...now, speed: 0 }, [0, 0, -1]);
    const dot = ((soon.x - now.x) * nose.x + (soon.z - now.z) * nose.z) / (travel || 1);
    assert.ok(dot > 0.99, `기수와 진행 방향이 같다 (index ${index}, dot ${dot})`);
  }
});

test('헬기가 제트기보다 낮고 느리게 돈다', () => {
  const heli = airTrafficPose(3, 0, EXTENT), jet = airTrafficPose(4, 0, EXTENT);
  assert.equal(airPlaneOf(3), 'helicopter');
  assert.equal(airPlaneOf(4), 'jet');
  assert.ok(heli.y < jet.y, '헬기가 더 낮다');
});

test('선분과 구의 교차 판정', () => {
  const target = { x: 0, y: 100, z: 0, radius: 7 };
  assert.equal(hitsSphere({ x: -20, y: 100, z: 0 }, { x: 20, y: 100, z: 0 }, target), true);
  assert.equal(hitsSphere({ x: -20, y: 130, z: 0 }, { x: 20, y: 130, z: 0 }, target), false);
  // 걸음이 구 앞에서 끝나면 아직 맞지 않았다.
  assert.equal(hitsSphere({ x: -20, y: 100, z: 0 }, { x: -10, y: 100, z: 0 }, target), false);
  // 시작점이 구 안이면 맞은 것이다.
  assert.equal(hitsSphere({ x: 0, y: 100, z: 0 }, { x: 1, y: 100, z: 0 }, target), true);
  assert.equal(hitsSphere({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0, radius: 0 }), false);
});

test('기관총 14발, 미사일 한 발에 격추된다', () => {
  assert.equal(AIR_HITS.cannon, 14);
  assert.equal(AIR_HITS.missile, 1);
  const combat = createAirCombat();
  for (let shot = 1; shot < 14; shot += 1) {
    assert.equal(applyAirHit(combat, { index: 2, weapon: 'cannon', now: 1 }).downed, false, `${shot}발째는 살아 있다`);
  }
  assert.equal(applyAirHit(combat, { index: 2, weapon: 'cannon', now: 1 }).downed, true);
  assert.equal(combat.kills, 1);
  assert.equal(combat.damage.has(2), false, '격추되면 진행도를 지운다');

  const rocket = createAirCombat();
  assert.equal(applyAirHit(rocket, { index: 1, weapon: 'missile', now: 0 }).downed, true, '미사일은 직격 한 발이다');
  assert.equal(rocket.damage.has(1), false);
});

test('격추된 기체는 더 맞지 않고 목표 목록에서 빠진다', () => {
  const combat = createAirCombat();
  applyAirHit(combat, { index: 0, weapon: 'bomb', now: 5 });
  assert.equal(combat.downed.has(0), true);
  assert.equal(applyAirHit(combat, { index: 0, weapon: 'missile', now: 6 }).downed, false);
  assert.equal(combat.kills, 1, '한 번 격추한 기체를 두 번 세지 않는다');
  const targets = airTrafficTargets(6, 5, EXTENT, null, 1e9, combat.downed);
  assert.equal(targets.some((target) => target.index === 0), false);
});

test('격추 폭발이 끝나면 자리를 비우고 시간이 지나면 다시 띄운다', () => {
  const combat = createAirCombat();
  applyAirHit(combat, { index: 4, weapon: 'bomb', now: 10 });
  assert.equal(wreckAge(combat, 4, 11), 1);
  assert.equal(wreckAge(combat, 4, 10 + AIR_WRECK_LIFE), null, '폭발이 끝나면 불덩이를 지운다');
  reviveAirTraffic(combat, 10 + AIR_RESPAWN - 1);
  assert.equal(combat.downed.has(4), true, '아직 자리가 비어 있다');
  reviveAirTraffic(combat, 10 + AIR_RESPAWN);
  assert.equal(combat.downed.has(4), false, '다시 궤도에 오른다');
});

test('주변 목표만 추리고 반경 밖은 뺀다', () => {
  const far = airTrafficTargets(28, 3, EXTENT, { x: 0, y: 0, z: 0 }, 1e9);
  assert.equal(far.length, 28);
  const near = airTrafficTargets(28, 3, EXTENT, { x: 1e6, y: 0, z: 1e6 }, 900);
  assert.equal(near.length, 0);
  assert.deepEqual(airTrafficTargets(NaN, 3, EXTENT, null), []);
});

test('기관총 탄이 AI 항공기를 맞히면 airHits 에 기록되고 사라진다', () => {
  const mounts = armamentOf('fighter');
  const target = { index: 5, x: 0, y: 300, z: -40, radius: 7 };
  // 기수를 -Z 로 두고 목표 바로 앞에서 한 발 쏜다. 다음 걸음에 목표를 지난다.
  const pose = { x: 0, y: 300, z: 0, pitch: 0, roll: 0, heading: 0, speed: 0, phase: 'airborne' };
  let arsenal = createArsenal('fighter');
  arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: 'fighter', fire: { cannon: true }, airTargets: [target] });
  assert.equal(arsenal.projectiles.length, 1, '한 발이 살아 있다');
  assert.equal(arsenal.airHits.length, 0, '아직 목표에 닿지 않았다');
  // 탄속 320 이라 0.2초면 64 를 날아 목표를 지난다.
  for (let step = 0; step < 12 && !arsenal.airHits.length; step += 1) {
    arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: 'fighter', fire: {}, airTargets: [target] });
  }
  assert.equal(arsenal.airHits.length, 1, '목표를 맞힌다');
  assert.equal(arsenal.airHits[0].index, 5);
  assert.equal(arsenal.airHits[0].weapon, 'cannon');
  assert.equal(arsenal.projectiles.length, 0, '맞은 탄은 사라진다');
  assert.ok(arsenal.blasts.length >= 1, '탄착 폭발을 남긴다');
});

test('목표가 없으면 발사체가 그대로 날아간다', () => {
  const mounts = armamentOf('fighter');
  const pose = { x: 0, y: 300, z: 0, pitch: 0, roll: 0, heading: 0, speed: 0, phase: 'airborne' };
  let arsenal = createArsenal('fighter');
  arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: 'fighter', fire: { cannon: true } });
  for (let step = 0; step < 12; step += 1) {
    arsenal = stepWeapons(arsenal, { dt: 1 / 60, pose, mounts, plane: 'fighter', fire: {} });
  }
  assert.equal(arsenal.airHits.length, 0);
  assert.equal(arsenal.projectiles.length, 1);
});

test('기체끼리 닿으면 충돌로 본다', () => {
  const me = { x: 0, y: 300, z: 0, radius: 6 };
  const far = { index: 1, x: 0, y: 300, z: -40, radius: 7 };
  const close = { index: 2, x: 0, y: 300, z: -12, radius: 7 };
  assert.equal(collidesWith(me, [far]), null, '떨어져 있으면 충돌이 아니다');
  assert.equal(collidesWith(me, [far, close]), close, '반지름 합 안쪽이면 충돌이다');
  // 경계는 반지름 합이다. 6 + 7 = 13 이므로 13 은 닿지 않고 12.9 는 닿는다.
  assert.equal(collidesWith(me, [{ index: 3, x: 0, y: 300, z: -13, radius: 7 }]), null);
  assert.ok(collidesWith(me, [{ index: 4, x: 0, y: 300, z: -12.9, radius: 7 }]));
  // 비정상 입력을 견딘다.
  assert.equal(collidesWith(null, [close]), null);
  assert.equal(collidesWith({ x: NaN, y: 0, z: 0, radius: 6 }, [close]), null);
  assert.equal(collidesWith(me, []), null);
});

test('공중 충돌은 탄수를 쌓지 않고 바로 격추다', () => {
  const combat = createAirCombat();
  assert.equal(downAirTraffic(combat, 5, 3), true);
  assert.equal(combat.downed.has(5), true);
  assert.equal(combat.kills, 1);
  assert.ok(combat.label, '기종 이름을 남긴다');
  // 이미 떨어진 기체를 다시 세지 않는다.
  assert.equal(downAirTraffic(combat, 5, 4), false);
  assert.equal(combat.kills, 1);
  // 맞던 중이었으면 진행도를 지운다.
  applyAirHit(combat, { index: 6, weapon: 'cannon', now: 1 });
  assert.ok(combat.damage.has(6));
  downAirTraffic(combat, 6, 2);
  assert.equal(combat.damage.has(6), false);
});
