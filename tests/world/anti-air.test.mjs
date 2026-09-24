import test from 'node:test';
import assert from 'node:assert/strict';
import { AIM_LIMITS, GROUND_GRAVITY, GROUND_GUNS, RECOIL_KICK, createGroundArsenal, isCombatVehicle, muzzlePoint, recoilKick, roundsPerMinute, shellGravity, stepGroundWeapons } from '../../src/world/groundWeapons.js';
import { AIR_HITS, airSpecOf, airTrafficPose, applyAirHit, createAirCombat } from '../../src/world/airTraffic.js';
import { EYE_POINTS, FOV_DEFAULT, cockpitFov, nextScope, scopeFov, scopeSteps } from '../../src/world/eyePoints.js';
import { VEHICLE_KEYS, VEHICLE_META } from '../../src/world/identity.js';
import { QUALITY } from '../../src/world/cityModels.js';
import { HULL, createHealth, isArmed } from '../../src/world/health.js';
import { RETICLE, dropLadder, groundImpact } from '../../src/world/reticle.js';
import { VEHICLES } from '../../src/world/carPhysics.js';
import { RIDE_GROUPS } from '../../src/world/rideSpecs.js';
import { COCKPIT_PARTS } from '../../src/world/cockpits/triangles.js';

test('대공포가 모든 등록부에 들어 있다', () => {
  assert.ok(VEHICLE_KEYS.includes('aa'), 'identity');
  assert.ok(VEHICLE_META.aa, 'meta');
  assert.ok(VEHICLES.aa, 'carPhysics');
  assert.ok(GROUND_GUNS.aa, 'groundWeapons');
  assert.ok(AIM_LIMITS.aa, 'aimLimits');
  assert.ok(EYE_POINTS.aa, 'eyePoints');
  assert.ok(COCKPIT_PARTS.aa, 'cockpit');
  assert.ok(RETICLE.aa, 'reticle');
  assert.ok(HULL.aa > 0, 'health');
  assert.equal(isArmed('car', 'aa'), true);
  assert.equal(isCombatVehicle('aa'), true);
  assert.equal(createHealth('car', 'aa').max, HULL.aa);
  assert.ok(RIDE_GROUPS[1].rides.some((ride) => ride.key === 'aa'), 'rideSpecs');
});

test('분당 750발로 쏜다', () => {
  assert.equal(roundsPerMinute('aa'), 750);
  assert.equal(GROUND_GUNS.aa.cooldown, 60 / 750);
  // 1초를 쏘면 열두 발이 나간다. 750/60 = 12.5 인데 60분의 1초 단위로 쿨다운을 세므로 반 발이 남는다.
  let arsenal = createGroundArsenal();
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  for (let frame = 0; frame < 60; frame += 1) {
    arsenal = stepGroundWeapons(arsenal, { dt: 1 / 60, fire: true, pose, aim: { yaw: 0, pitch: 0.2 }, vehicle: 'aa' });
  }
  assert.equal(arsenal.shots, 12);
  // 같은 시간 장갑차는 여섯 발, 전차는 한 발이다. 대공포가 가장 빠르다.
  let tank = createGroundArsenal();
  for (let frame = 0; frame < 60; frame += 1) {
    tank = stepGroundWeapons(tank, { dt: 1 / 60, fire: true, pose, aim: { yaw: 0, pitch: 0 }, vehicle: 'tank' });
  }
  assert.ok(arsenal.shots > tank.shots, `대공포 ${arsenal.shots} 전차 ${tank.shots}`);
});

test('포신이 거의 수직까지 올라간다', () => {
  assert.ok(AIM_LIMITS.aa.pitch[1] > AIM_LIMITS.howitzer.pitch[1], '자주포보다 높이 든다');
  assert.ok(AIM_LIMITS.aa.pitch[1] > 1.4, `앙각 ${AIM_LIMITS.aa.pitch[1]}`);
  // 거의 수직으로 들면 발사 방향이 위를 향하고 포구가 수평일 때보다 높이 올라간다.
  // 포구 좌표의 구성(turret, pivot, reach) 은 모델 쪽 표라 여기서 읽지 않는다.
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  const up = muzzlePoint(pose, { yaw: 0, pitch: AIM_LIMITS.aa.pitch[1] }, 'aa');
  const flat = muzzlePoint(pose, { yaw: 0, pitch: 0 }, 'aa');
  assert.ok(up.forward.y > 0.99, `수직 성분 ${up.forward.y}`);
  assert.ok(up.y > flat.y + 2, `포구 높이 ${flat.y} -> ${up.y}`);
  assert.ok(Math.abs(up.z - pose.z) < Math.abs(flat.z - pose.z), '들수록 앞으로 덜 나간다');
});

test('12발을 맞히면 AI 항공기가 터진다', () => {
  assert.equal(AIR_HITS.aa, 12);
  const combat = createAirCombat();
  for (let shot = 1; shot < 12; shot += 1) {
    assert.equal(applyAirHit(combat, { index: 3, weapon: 'aa', now: 1 }).downed, false, `${shot}발째는 살아 있다`);
  }
  assert.equal(applyAirHit(combat, { index: 3, weapon: 'aa', now: 1 }).downed, true);
  assert.equal(combat.kills, 1);
});

test('대공포 포탄이 공중 목표를 맞히면 airHits 에 남는다', () => {
  const target = { index: 7, x: 0, y: 140, z: -300, radius: 7 };
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  // 목표를 향해 포신을 올린다. 사거리 300, 고도 140 이라 앙각은 약 0.44rad 이다.
  const aim = { yaw: 0, pitch: Math.atan2(target.y - 1.2, 300) };
  let arsenal = createGroundArsenal();
  for (let frame = 0; frame < 240 && !arsenal.airHits.length; frame += 1) {
    arsenal = stepGroundWeapons(arsenal, { dt: 1 / 60, fire: frame === 0, pose, aim, vehicle: 'aa', airTargets: [target] });
  }
  assert.equal(arsenal.airHits.length, 1, '목표를 맞힌다');
  assert.equal(arsenal.airHits[0].index, 7);
  assert.equal(arsenal.airHits[0].weapon, 'aa');
  assert.equal(arsenal.shells.length, 0, '맞은 포탄은 사라진다');
});

test('공중 목표가 없으면 포탄이 그대로 날아간다', () => {
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  let arsenal = createGroundArsenal();
  arsenal = stepGroundWeapons(arsenal, { dt: 1 / 60, fire: true, pose, aim: { yaw: 0, pitch: 0.44 }, vehicle: 'aa' });
  for (let frame = 0; frame < 30; frame += 1) {
    arsenal = stepGroundWeapons(arsenal, { dt: 1 / 60, fire: false, pose, aim: { yaw: 0, pitch: 0.44 }, vehicle: 'aa' });
  }
  assert.equal(arsenal.airHits.length, 0);
  assert.equal(arsenal.shells.length, 1);
});

test('조준경 배율은 1배에서 12배까지 V 키 순서로 돈다', () => {
  assert.deepEqual(scopeSteps('aa'), [1, 2, 3, 4, 6, 8, 12]);
  assert.equal(scopeSteps('tank'), null, '고정 배율 탈것은 단계를 갖지 않는다');
  const base = cockpitFov('aa');
  assert.ok(Math.abs(scopeFov('aa', 1) - base) < 1e-9);
  assert.ok(Math.abs(scopeFov('aa', 12) - base / 12) < 1e-9);
  // 단계가 오를수록 화각이 좁아진다.
  const fovs = scopeSteps('aa').map((step) => scopeFov('aa', step));
  for (let i = 1; i < fovs.length; i += 1) assert.ok(fovs[i] < fovs[i - 1], `${fovs[i]} < ${fovs[i - 1]}`);
  // 끝에서 처음으로 돈다.
  assert.equal(nextScope('aa', 1), 2);
  assert.equal(nextScope('aa', 12), 1);
  assert.equal(nextScope('aa', 999), 1, '모르는 값은 첫 단계로 돌아간다');
  assert.equal(nextScope('tank', 2), 1, '조준경이 없으면 배율이 없다');
  // 조준경이 없는 탈것은 기본 화각 그대로다.
  assert.equal(scopeFov('tank', 4), cockpitFov('tank'));
});

test('적기가 느려지고 수가 늘었다', () => {
  // 요청대로 속도는 20% 느리게, 수는 40% 많게 잡았다.
  assert.ok(Math.abs(airSpecOf('jet').speed - 62 * 0.8) < 1e-9, `제트 ${airSpecOf('jet').speed}`);
  assert.ok(Math.abs(airSpecOf('helicopter').speed - 26 * 0.8) < 1e-9, `헬기 ${airSpecOf('helicopter').speed}`);
  assert.ok(airSpecOf('jet').speed > airSpecOf('helicopter').speed, '제트가 여전히 더 빠르다');
  assert.deepEqual([QUALITY.low.aircraft, QUALITY.medium.aircraft, QUALITY.high.aircraft], [14, 25, 39]);
  // 느려졌어도 한 바퀴는 돌아야 한다. 같은 시간에 자리가 바뀌는지 본다.
  const now = airTrafficPose(1, 0, 900), later = airTrafficPose(1, 30, 900);
  assert.ok(Math.hypot(now.x - later.x, now.z - later.z) > 50, '30초면 눈에 띄게 움직인다');
});

test('3인칭에서도 조준경 배율이 화각을 좁힌다', () => {
  // 1인칭은 조준경 화각, 3인칭은 기본 화각을 배율로 나눈 값이다. 둘 다 배율이 오르면 좁아진다.
  const first = scopeSteps('aa').map((step) => scopeFov('aa', step));
  const third = scopeSteps('aa').map((step) => FOV_DEFAULT / step);
  for (let i = 1; i < first.length; i += 1) {
    assert.ok(first[i] < first[i - 1], `1인칭 ${first[i]} < ${first[i - 1]}`);
    assert.ok(third[i] < third[i - 1], `3인칭 ${third[i]} < ${third[i - 1]}`);
  }
  // 배율 1 이면 평소 화각 그대로다. 조준경을 놓으면 이 값으로 돌아온다.
  assert.equal(FOV_DEFAULT / 1, FOV_DEFAULT);
});

test('대공포 탄은 빠르고 곧게 난다', () => {
  // 탄속은 25% 올렸고 낙차는 기종별 중력으로 따로 줄였다.
  assert.equal(GROUND_GUNS.aa.speed, 400);
  assert.equal(GROUND_GUNS.aa.gravity, 3.36);
  assert.ok(GROUND_GUNS.aa.speed > GROUND_GUNS.armored.speed, '지상 포 중 가장 빠르다');
  assert.ok(shellGravity('aa') < shellGravity('tank'), `대공 ${shellGravity('aa')} 전차 ${shellGravity('tank')}`);
  // 다른 기종은 그대로다. 대공포만 따로 적었다.
  for (const vehicle of ['tank', 'howitzer', 'armored']) assert.equal(shellGravity(vehicle), GROUND_GRAVITY);

  // 같은 사거리에서 낙차가 전차보다 훨씬 작다.
  const [aa] = dropLadder('aa', [600]);
  const [tank] = dropLadder('tank', [600]);
  assert.ok(aa.drop < tank.drop * 0.2, `대공 ${aa.drop.toFixed(1)}m 전차 ${tank.drop.toFixed(1)}m`);
});

test('발사와 조준 표식이 같은 낙차를 쓴다', () => {
  // 둘이 다른 중력을 읽으면 표식이 가리키는 곳과 실제 탄착이 어긋난다.
  // 대공포 탄은 4초 수명 안에 땅에 닿지 않으므로(그만큼 평탄하다) 1초 뒤 낙차를 직접 잰다.
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  const aim = { yaw: 0, pitch: 0.12 };
  const mouth = muzzlePoint(pose, aim, 'aa');
  let arsenal = createGroundArsenal();
  arsenal = stepGroundWeapons(arsenal, { dt: 1 / 60, fire: true, pose, aim, vehicle: 'aa' });
  for (let frame = 1; frame < 60; frame += 1) {
    arsenal = stepGroundWeapons(arsenal, { dt: 1 / 60, fire: false, pose, aim, vehicle: 'aa' });
  }
  const shell = arsenal.shells[0];
  assert.ok(shell, '1초 뒤에도 살아 있다');
  // 중력이 없었다면 있었을 높이에서 얼마나 떨어졌는지 본다.
  const flown = Math.hypot(shell.x - mouth.x, shell.z - mouth.z) / Math.cos(aim.pitch);
  const straight = mouth.y + Math.sin(aim.pitch) * flown;
  const drop = straight - shell.y;
  const expected = 0.5 * shellGravity('aa') * 1 * 1;
  assert.ok(Math.abs(drop - expected) < 0.4, `낙차 ${drop.toFixed(2)}m 기대 ${expected.toFixed(2)}m`);
});

test('평탄한 탄도라 4초 수명 안에 땅에 닿지 않는다', () => {
  // 전차는 같은 조준에서 땅을 때린다. 대공포는 수명이 끝날 때까지 날아간다.
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  const aim = { yaw: 0, pitch: 0.12 };
  assert.equal(groundImpact(pose, aim, 'tank', []).hit, 'ground');
  assert.equal(groundImpact(pose, aim, 'aa', []).hit, 'none');
  assert.ok(groundImpact(pose, aim, 'aa', []).range > groundImpact(pose, aim, 'tank', []).range, '훨씬 멀리 간다');
});

test('대공포 반동이 기존 값보다 40퍼센트 낮다', () => {
  // 반동 표는 순수 모듈에 있다. 예전에는 CarMode.jsx 원문을 정규식으로 파싱했다.
  assert.equal(RECOIL_KICK.armored, 0.008, '기관포');
  assert.equal(RECOIL_KICK.default, 0.035, '기본 포');
  assert.ok(Math.abs(RECOIL_KICK.aa - 0.0298 * 0.6) < 1e-9, `대공포 반동 ${RECOIL_KICK.aa}`);
  // 표에 없는 기종은 기본 포 반동을 쓴다.
  assert.equal(recoilKick('aa'), RECOIL_KICK.aa);
  assert.equal(recoilKick('tank'), RECOIL_KICK.default);
  assert.equal(recoilKick('howitzer'), RECOIL_KICK.default);
  // 연사가 빠를수록 한 발이 약하다. 분당 발사 수와 반동의 곱이 뒤집히지 않는지 본다.
  assert.ok(recoilKick('armored') < recoilKick('aa'), '장갑차 기관포가 가장 약하다');
});
