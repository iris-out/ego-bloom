import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_GUNS, aimKeyboard, createGroundArsenal, muzzlePoint, stepGroundWeapons } from '../../src/world/groundWeapons.js';

/** 포탄은 포구에서 나가야 한다. 예전 식은 앙각의 수직 성분을 빼먹어 포신을
 * 들수록 탄이 차체 한가운데에서 튀어나왔다.
 */
const pose = { x: 10, y: 1.2, z: -4, heading: 0 };

test('포구는 포신 앙각을 따라 올라간다', () => {
  const flat = muzzlePoint(pose, { yaw: 0, pitch: 0 }, 'howitzer');
  const high = muzzlePoint(pose, { yaw: 0, pitch: 1 }, 'howitzer');
  assert.ok(high.y > flat.y + 2, `${flat.y} -> ${high.y}`);
  // 앙각이 커지면 앞으로 나간 거리는 줄어든다. 회전축에서 포구까지의 거리는 그대로다.
  const { reach } = GROUND_GUNS.howitzer;
  for (const aim of [{ pitch: 0 }, { pitch: 0.5 }, { pitch: 1 }]) {
    const point = muzzlePoint(pose, aim, 'howitzer');
    const { hinge } = point;
    const dx = point.x - hinge.x, dy = point.y - hinge.y, dz = point.z - hinge.z;
    assert.ok(Math.abs(Math.hypot(dx, dy, dz) - reach) < 1e-9, `pitch ${aim.pitch} 거리 ${Math.hypot(dx, dy, dz)}`);
  }
});

test('포구는 모델의 포탑 중심, 포신 회전축, 포구 끝을 그대로 따라간다', () => {
  // heading 0, yaw 0, pitch 0 이면 차체 좌표가 곧 월드 오프셋이다.
  for (const [vehicle, spec] of Object.entries(GROUND_GUNS)) {
    const point = muzzlePoint(pose, { yaw: 0, pitch: 0 }, vehicle);
    const [tx, ty, tz] = spec.turret, [px, py, pz] = spec.pivot;
    assert.ok(Math.abs(point.hinge.x - (pose.x + tx + px)) < 1e-9, `${vehicle} 회전축 x`);
    assert.ok(Math.abs(point.hinge.y - (pose.y + ty + py)) < 1e-9, `${vehicle} 회전축 y`);
    assert.ok(Math.abs(point.hinge.z - (pose.z + tz + pz)) < 1e-9, `${vehicle} 회전축 z`);
    const side = (spec.barrels || [0])[0];
    assert.ok(Math.abs(point.x - (point.hinge.x + side)) < 1e-9, `${vehicle} 포구 x`);
    assert.ok(Math.abs(point.z - (point.hinge.z - spec.reach)) < 1e-9, `${vehicle} 포구 z`);
    // 포탑 지붕(1.9) 아래에 회전축이 있고 포구는 차체(깊이 절반 4) 앞으로 나간다.
    assert.ok(ty + py < 1.9 && ty + py > 0.5, `${vehicle} 회전축 높이 ${ty + py}`);
    assert.ok(tz + pz - spec.reach < -3.6, `${vehicle} 포구가 차체 안에 있다`);
  }
});

test('쌍열 포는 발사 순서대로 좌우 포구를 번갈아 쓴다', () => {
  const left = muzzlePoint(pose, { yaw: 0, pitch: 0 }, 'aa', 0);
  const right = muzzlePoint(pose, { yaw: 0, pitch: 0 }, 'aa', 1);
  const again = muzzlePoint(pose, { yaw: 0, pitch: 0 }, 'aa', 2);
  assert.ok(Math.abs((right.x - left.x) - 0.34) < 1e-9, `${left.x} / ${right.x}`);
  assert.equal(again.x, left.x);
  assert.equal(muzzlePoint(pose, {}, 'tank', 1).x, muzzlePoint(pose, {}, 'tank', 0).x, '단열 포는 shot 과 무관하다');
});

test('포구는 포탑 회전을 따라 돈다', () => {
  const ahead = muzzlePoint(pose, { yaw: 0, pitch: 0 }, 'tank');
  const left = muzzlePoint(pose, { yaw: Math.PI / 2, pitch: 0 }, 'tank');
  const behind = muzzlePoint(pose, { yaw: Math.PI, pitch: 0 }, 'tank');
  const { turret, pivot, reach } = GROUND_GUNS.tank;
  assert.ok(ahead.z < pose.z, 'heading 0 은 -Z 를 본다');
  assert.ok(behind.z > pose.z);
  // 포탑 중심은 차체에 붙어 있고 회전축부터 포구까지만 yaw 로 돈다.
  assert.ok(Math.abs(Math.abs(left.x - pose.x) - (Math.abs(pivot[2]) + reach)) < 1e-9, `왼쪽 포구 x ${left.x - pose.x}`);
  assert.ok(Math.abs(left.z - pose.z - turret[2]) < 1e-9, `왼쪽 포구 z ${left.z - pose.z}`);
});

test('발사한 탄은 포구에서 시작하고 포신 방향으로 나간다', () => {
  for (const vehicle of Object.keys(GROUND_GUNS)) {
    const aim = { yaw: 0.4, pitch: 0.3 };
    const fired = stepGroundWeapons(createGroundArsenal(), { dt: 1 / 60, fire: true, pose, aim, vehicle });
    assert.equal(fired.shells.length, 1, vehicle);
    const shell = fired.shells[0], point = muzzlePoint(pose, aim, vehicle);
    // 한 프레임 움직인 뒤라 포구에서 그 거리만큼만 떨어져 있어야 한다.
    const travelled = Math.hypot(shell.x - point.x, shell.y - point.y, shell.z - point.z);
    assert.ok(travelled < GROUND_GUNS[vehicle].speed / 60 + 0.5, `${vehicle} 발사 지점이 ${travelled.toFixed(1)} 만큼 어긋난다`);
    assert.ok(shell.vy > 0, `${vehicle} 포신을 들었으면 위로 나가야 한다`);
  }
});

test('포탑을 돌려 조준한 방향과 탄의 진행 방향이 같다', () => {
  let aim = { yaw: 0, pitch: 0.04 };
  for (let i = 0; i < 40; i += 1) aim = aimKeyboard(aim, 1, 0, 1 / 60, 'tank');
  const shell = stepGroundWeapons(createGroundArsenal(), { dt: 1 / 60, fire: true, pose, aim, vehicle: 'tank' }).shells[0];
  const world = Math.atan2(-shell.vx, -shell.vz);
  assert.ok(Math.abs(world - (pose.heading + aim.yaw)) < 1e-6, `${world} vs ${pose.heading + aim.yaw}`);
});
