import test from 'node:test';
import assert from 'node:assert/strict';
import { AIM_LIMITS, AIM_RATE, SCOPE_EYE, aimGroundWeapon, aimKeyboard, isCombatVehicle, muzzlePoint, scopePoint } from '../../src/world/groundWeapons.js';
import { VEHICLES } from '../../src/world/carPhysics.js';

/** 전차, 자주포, APC, 대공포는 방향키로 포탑을 돌린다. 마우스 커서로 즉시 스냅하던
 * 방식은 조준이 튀었고, 각도가 초당 6.7 회만 모델에 닿아 포신이 끊겨 보였다.
 * 1인칭에서는 포탑이 곧 시점이라 마우스 드래그도 같은 값을 움직인다.
 */
const start = { yaw: 0, pitch: 0.04 };

test('좌우 방향키는 포탑을, 위아래는 포신을 움직인다', () => {
  const left = aimKeyboard(start, 1, 0, 0.5, 'tank');
  const right = aimKeyboard(start, -1, 0, 0.5, 'tank');
  assert.ok(left.yaw > start.yaw, '왼쪽은 yaw 를 늘린다');
  assert.ok(right.yaw < start.yaw);
  assert.equal(left.pitch, start.pitch, '좌우는 앙각을 건드리지 않는다');
  const up = aimKeyboard(start, 0, 1, 0.5, 'tank');
  assert.ok(up.pitch > start.pitch);
  assert.equal(up.yaw, start.yaw);
});

test('조준 속도는 프레임 수가 아니라 시간에 비례한다', () => {
  // 60fps 로 여섯 프레임과 0.1초 한 번이 같은 각도여야 한다. dt 상한 0.1 아래에서 비교한다.
  let slow = start;
  for (let i = 0; i < 6; i += 1) slow = aimKeyboard(slow, 1, 0, 1 / 60, 'tank');
  const fast = aimKeyboard(start, 1, 0, 0.1, 'tank');
  assert.ok(Math.abs(slow.yaw - fast.yaw) < 1e-6, `${slow.yaw} vs ${fast.yaw}`);
  assert.ok(Math.abs(fast.yaw - start.yaw - AIM_RATE.yaw * 0.1) < 1e-9);
});

test('기종별 앙각 한계를 넘지 않는다', () => {
  for (const vehicle of Object.keys(AIM_LIMITS)) {
    const [low, high] = AIM_LIMITS[vehicle].pitch;
    let aim = start;
    for (let i = 0; i < 200; i += 1) aim = aimKeyboard(aim, 0, 1, 1 / 60, vehicle);
    assert.ok(Math.abs(aim.pitch - high) < 1e-9, `${vehicle} 최대 ${aim.pitch}`);
    for (let i = 0; i < 400; i += 1) aim = aimKeyboard(aim, 0, -1, 1 / 60, vehicle);
    assert.ok(Math.abs(aim.pitch - low) < 1e-9, `${vehicle} 최소 ${aim.pitch}`);
    assert.ok(isCombatVehicle(vehicle));
  }
});

test('포탑은 한 바퀴 돌아도 각이 -PI 와 PI 사이로 감긴다', () => {
  let aim = start;
  for (let i = 0; i < 600; i += 1) aim = aimKeyboard(aim, 1, 0, 1 / 60, 'tank');
  assert.ok(aim.yaw >= -Math.PI && aim.yaw <= Math.PI, `yaw ${aim.yaw}`);
});

test('잘못된 입력과 큰 dt 가 조준을 망가뜨리지 않는다', () => {
  const wild = aimKeyboard({ yaw: NaN, pitch: NaN }, 99, -99, 5, 'howitzer');
  assert.ok(Number.isFinite(wild.yaw) && Number.isFinite(wild.pitch));
  // dt 는 0.1 로 묶어 한 프레임에 포탑이 튀지 않게 한다.
  assert.ok(Math.abs(aimKeyboard(start, 1, 0, 5, 'tank').yaw) <= AIM_RATE.yaw * 0.1 + 1e-9);
});

/** 화면 좌표로 끄는 것을 흉내 낸다. 위로 끌면 dy 가 음수다. */
const drag = (vehicle, dx, dy, steps = 800) => {
  let aim = { yaw: 0, pitch: 0 };
  for (let step = 0; step < steps; step += 1) aim = aimGroundWeapon(aim, dx, dy, vehicle);
  return aim;
};

test('위로 끌면 위를 보고 아래로 끌면 아래를 본다', () => {
  for (const vehicle of ['tank', 'howitzer', 'armored', 'aa']) {
    // 화면에서 위로 끌면 clientY 가 줄어 dy 가 음수다.
    const up = drag(vehicle, 0, -10);
    assert.ok(Math.abs(up.pitch - AIM_LIMITS[vehicle].pitch[1]) < 1e-9, `${vehicle} 위로 끌면 최대 앙각 ${up.pitch}`);
    const down = drag(vehicle, 0, 10);
    assert.ok(Math.abs(down.pitch - AIM_LIMITS[vehicle].pitch[0]) < 1e-9, `${vehicle} 아래로 끌면 최소 앙각 ${down.pitch}`);
  }
  // 대공포는 전차보다 훨씬 높이 든다. 마우스로도 하늘을 겨눌 수 있어야 한다.
  assert.ok(drag('aa', 0, -10).pitch > 1.4, '대공포는 하늘을 본다');
  assert.ok(drag('tank', 0, -10).pitch < 0.6, '전차는 그만큼 들지 못한다');
});

test('오른쪽으로 끌면 포탑이 오른쪽을 본다', () => {
  // muzzlePoint 는 heading + yaw 로 방위를 만들고, +yaw 는 왼쪽이다.
  // 화면에서 오른쪽으로 끌면(dx 양수) yaw 가 줄어야 포구가 오른쪽으로 간다.
  const right = aimGroundWeapon({ yaw: 0, pitch: 0 }, 40, 0, 'aa');
  assert.ok(right.yaw < 0, `오른쪽 드래그 yaw ${right.yaw}`);
  const nose = muzzlePoint({ x: 0, y: 1.2, z: 0, heading: 0 }, right, 'aa');
  assert.ok(nose.forward.x > 0, `포구가 +X(오른쪽) 를 본다 ${nose.forward.x}`);
  const left = aimGroundWeapon({ yaw: 0, pitch: 0 }, -40, 0, 'aa');
  assert.ok(muzzlePoint({ x: 0, y: 1.2, z: 0, heading: 0 }, left, 'aa').forward.x < 0, '왼쪽 드래그는 -X 를 본다');
});

test('포탑 좌우는 한 바퀴 돌아도 -PI 와 PI 사이에 남는다', () => {
  const aim = drag('aa', 10, 0, 3000);
  assert.ok(aim.yaw >= -Math.PI && aim.yaw <= Math.PI, `yaw ${aim.yaw}`);
  assert.ok(Number.isFinite(aim.yaw));
});

test('감도는 화면 절반을 끌면 90도 안팎이다', () => {
  // 너무 느리면 하늘을 따라가지 못하고 너무 빠르면 조준이 튄다.
  const half = 480;
  const turn = Math.abs(aimGroundWeapon({ yaw: 0, pitch: 0 }, half, 0, 'aa').yaw);
  assert.ok(turn > 1.2 && turn < 2.0, `480px 회전 ${turn}rad`);
});

/** 조준경 카메라 자리다. 포신 축 위, 포구 앞에 있어야 자기 장갑이 화면에 들어오지 않는다. */
const HULL = { x: 0, y: 1.21, z: 0, heading: 0 };

test('조준경 카메라가 포구보다 앞에 있고 포신 방향을 그대로 본다', () => {
  for (const vehicle of ['tank', 'howitzer', 'armored', 'aa']) {
    const aim = { yaw: 0, pitch: 0.1 };
    const mouth = muzzlePoint(HULL, aim, vehicle);
    const sight = scopePoint(HULL, aim, vehicle);
    // 방향은 포구와 같은 벡터다. 화면 정중앙이 곧 포신 방향이다.
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Math.abs(sight.forward[axis] - mouth.forward[axis]) < 1e-9, `${vehicle} ${axis} 방향이 어긋난다`);
    }
    // 회전축에서 잰 거리가 포구보다 멀다. 포신과 제퇴기가 카메라 뒤에 남는다.
    const toSight = Math.hypot(sight.x - mouth.hinge.x, sight.y - mouth.hinge.y, sight.z - mouth.hinge.z);
    const toMouth = Math.hypot(mouth.x - mouth.hinge.x, mouth.y - mouth.hinge.y, mouth.z - mouth.hinge.z);
    assert.ok(toSight > toMouth + 0.2, `${vehicle} 조준경 ${toSight.toFixed(2)} 포구 ${toMouth.toFixed(2)}`);
    // 포신 축에서 벗어난 거리는 SCOPE_EYE.rise 하나뿐이다. 조준경이 포신 위에 얹힌 만큼이다.
    const arm = { x: sight.x - mouth.hinge.x, y: sight.y - mouth.hinge.y, z: sight.z - mouth.hinge.z };
    const along = arm.x * sight.forward.x + arm.y * sight.forward.y + arm.z * sight.forward.z;
    const off = Math.hypot(arm.x - sight.forward.x * along, arm.y - sight.forward.y * along, arm.z - sight.forward.z * along);
    assert.ok(Math.abs(off - SCOPE_EYE[vehicle].rise) < 1e-9, `${vehicle} 축에서 ${off} 떨어졌다`);
    assert.ok(sight.y > mouth.hinge.y + sight.forward.y * along, `${vehicle} 조준경이 포신 아래에 있다`);
  }
});

test('포탑을 어디로 돌려도 조준경이 차체 상자 밖에 있다', () => {
  for (const vehicle of ['tank', 'howitzer', 'armored', 'aa']) {
    const spec = VEHICLES[vehicle];
    for (let step = 0; step < 16; step += 1) {
      const yaw = -Math.PI + (step * Math.PI * 2) / 16;
      const sight = scopePoint(HULL, { yaw, pitch: 0 }, vehicle);
      const outside = Math.abs(sight.x) > spec.width / 2 || Math.abs(sight.z) > spec.depth / 2;
      assert.ok(outside, `${vehicle} yaw ${yaw.toFixed(2)} 에서 조준경이 차체 안(${sight.x.toFixed(2)}, ${sight.z.toFixed(2)}) 이다`);
    }
  }
});

test('대공포는 포신을 세워도 조준경이 차체 위로 빠진다', () => {
  const up = scopePoint(HULL, { yaw: 0, pitch: AIM_LIMITS.aa.pitch[1] }, 'aa');
  // 차체 원점 위 1.5 가 포탑 지붕이다. 그보다 높이 올라가 차체가 화면 아래로 빠진다.
  assert.ok(up.y > HULL.y + 1.5 + 1, `조준경 높이 ${up.y}`);
  assert.ok(up.forward.y > 0.99, '거의 수직으로 본다');
  const flat = scopePoint(HULL, { yaw: 0, pitch: 0 }, 'aa');
  assert.ok(up.y > flat.y + 2, `${flat.y} -> ${up.y}`);
});

test('이상한 값이 들어와도 조준경 좌표가 유한하다', () => {
  const broken = scopePoint({ x: NaN, y: undefined, z: 0, heading: NaN }, { yaw: NaN, pitch: NaN }, 'tank');
  assert.ok([broken.x, broken.y, broken.z].every(Number.isFinite));
  // 모르는 기종은 전차 표로 떨어진다. 카메라가 빈 자리에 놓이지 않는다.
  assert.deepEqual(scopePoint(HULL, { yaw: 0, pitch: 0 }, 'ufo'), scopePoint(HULL, { yaw: 0, pitch: 0 }, 'tank'));
});
