import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { GROUND_GRAVITY, RETICLE, airImpact, angleToScreen, dropLadder, effectiveRange, groundImpact, probeShell, reticleOf } from '../../src/world/reticle.js';
import { GROUND_GUNS } from '../../src/world/groundWeapons.js';
import { CANNON } from '../../src/world/weapons.js';

const tank = { x: 0, y: 1.2, z: 0, heading: 0, pitch: 0, roll: 0 };
const level = { yaw: 0, pitch: 0 };

test('포신을 수평으로 두면 탄착점이 앞쪽 지면이다', () => {
  const hit = groundImpact(tank, level, 'tank');
  assert.equal(hit.hit, 'ground');
  // 기수 0 은 -Z 를 본다. 좌우로는 거의 벗어나지 않는다.
  assert.ok(hit.z < -20, `탄착점이 앞이 아니다: ${hit.z}`);
  assert.ok(Math.abs(hit.x) < 1, `탄착점이 옆으로 틀어졌다: ${hit.x}`);
  assert.ok(hit.range > 20 && hit.range < 400);
});

test('포신을 들면 탄착점이 멀어지고 내리면 가까워진다', () => {
  const near = groundImpact(tank, { yaw: 0, pitch: -0.1 }, 'tank');
  const flat = groundImpact(tank, level, 'tank');
  const far = groundImpact(tank, { yaw: 0, pitch: 0.3 }, 'tank');
  assert.ok(near.range < flat.range, `${near.range} < ${flat.range}`);
  assert.ok(flat.range < far.range, `${flat.range} < ${far.range}`);
});

test('포탑을 돌리면 탄착점도 같은 쪽으로 돈다', () => {
  const left = groundImpact(tank, { yaw: 0.5, pitch: 0 }, 'tank');
  const right = groundImpact(tank, { yaw: -0.5, pitch: 0 }, 'tank');
  // aimAtPoint 와 같은 기준이다. yaw 가 커지면 월드 방위가 반시계로 돈다.
  assert.ok(left.x < 0 && right.x > 0, `${left.x}, ${right.x}`);
  assert.ok(Math.abs(left.range - right.range) < 2, '좌우 사거리가 달라졌다');
});

test('앞에 건물이 있으면 건물에서 멈춘다', () => {
  const wall = [{ x: 0, z: -40, width: 40, depth: 6, height: 30 }];
  const blocked = groundImpact(tank, level, 'tank', wall);
  assert.equal(blocked.hit, 'building');
  assert.ok(blocked.range < 45, `건물을 지나쳤다: ${blocked.range}`);
  assert.ok(groundImpact(tank, level, 'tank').range > blocked.range);
});

test('자주포는 같은 앙각에서 전차보다 가까이 떨어진다', () => {
  // 탄속이 115 와 150 이므로 같은 각도면 곡사포가 먼저 떨어진다.
  assert.ok(GROUND_GUNS.howitzer.speed < GROUND_GUNS.tank.speed);
  const howitzer = groundImpact({ ...tank }, { yaw: 0, pitch: 0.2 }, 'howitzer');
  const direct = groundImpact({ ...tank }, { yaw: 0, pitch: 0.2 }, 'tank');
  assert.ok(howitzer.range < direct.range, `${howitzer.range} < ${direct.range}`);
});

test('전투기 기관포는 중력을 받지 않아 거의 직선으로 간다', () => {
  const pose = { x: 0, y: 120, z: 0, heading: 0, pitch: 0, roll: 0, speed: 0, key: 'fighter' };
  const gun = airImpact(pose, 'cannon');
  assert.equal(gun.hit, 'none');
  // 수평으로 쏘면 고도가 유지된다. 120 에서 떨어지지 않는다.
  assert.ok(Math.abs(gun.y - 120) < 1, `기관포가 떨어졌다: ${gun.y}`);
  assert.ok(Math.abs(gun.range - CANNON.speed * CANNON.life) < 20);
  // 미사일은 중력을 받아 같은 자세에서 아래로 처진다.
  const rocket = airImpact(pose, 'missile');
  assert.ok(rocket.y < gun.y, `미사일이 처지지 않았다: ${rocket.y}`);
});

test('기체 속도가 탄속에 더해져 사거리가 늘어난다', () => {
  const still = airImpact({ x: 0, y: 150, z: 0, heading: 0, pitch: 0, roll: 0, speed: 0, key: 'fighter' }, 'cannon');
  const fast = airImpact({ x: 0, y: 150, z: 0, heading: 0, pitch: 0, roll: 0, speed: 160, key: 'fighter' }, 'cannon');
  assert.ok(fast.range > still.range, `${fast.range} > ${still.range}`);
});

test('사거리 눈금은 거리 제곱에 비례해 내려간다', () => {
  const ladder = dropLadder('tank', [200, 400, 800]);
  assert.equal(ladder.length, 3);
  const [close, mid] = ladder;
  // 거리가 두 배면 낙차는 네 배다.
  assert.ok(Math.abs(mid.drop / close.drop - 4) < 0.01, `${mid.drop} / ${close.drop}`);
  assert.ok(ladder.every((mark) => mark.angle > 0 && mark.angle < 1));
  // 각도는 거리가 늘수록 커진다. 눈금이 아래로 벌어진다.
  assert.ok(close.angle < mid.angle);
  const expected = 0.5 * GROUND_GRAVITY * (200 / GROUND_GUNS.tank.speed) ** 2;
  assert.ok(Math.abs(close.drop - expected) < 1e-9);
  assert.deepEqual(dropLadder('sedan', [200]), []);
  assert.deepEqual(dropLadder('tank', [0, NaN, -5]), []);
});

test('시야각을 픽셀로 바꾸면 화각이 좁을 때 더 크게 벌어진다', () => {
  const wide = angleToScreen(0.05, 62, 900);
  const narrow = angleToScreen(0.05, 42, 900);
  assert.ok(narrow > wide, `${narrow} > ${wide}`);
  assert.equal(angleToScreen(0, 62, 900), 0);
  // 화면이 두 배 높으면 같은 각이 두 배 픽셀이다.
  assert.ok(Math.abs(angleToScreen(0.05, 62, 1800) - wide * 2) < 1e-9);
  assert.equal(Number.isFinite(angleToScreen(NaN, NaN, NaN)), true);
});

test('조준선은 무장한 탈것만 갖고 유효 사거리가 탄속에서 나온다', () => {
  assert.equal(reticleOf('car', 'tank'), RETICLE.tank);
  assert.equal(reticleOf('flight', 'fighter'), RETICLE.fighter);
  for (const [kind, key] of [['car', 'sedan'], ['car', 'motorcycle'], ['flight', 'jet'], ['walk', 'walk']]) {
    assert.equal(reticleOf(kind, key), null, `${key} 에 조준선이 붙었다`);
  }
  assert.equal(effectiveRange('flight', 'fighter'), CANNON.speed * CANNON.life);
  assert.ok(effectiveRange('car', 'armored') > effectiveRange('car', 'howitzer'));
  assert.equal(effectiveRange('car', 'sedan'), 0);
});

test('비정상 입력에도 탄착점이 유한하다', () => {
  for (const bad of [null, undefined, { x: NaN, y: NaN, z: NaN }]) {
    const hit = groundImpact(bad, bad, 'tank');
    assert.ok([hit.x, hit.y, hit.z, hit.range].every(Number.isFinite));
  }
  assert.equal(groundImpact(tank, level, 'sedan'), null);
  assert.equal(airImpact({ ...tank, key: 'jet' }, 'cannon'), null);
  const odd = probeShell({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: -100 }, { life: NaN });
  assert.ok([odd.x, odd.y, odd.z].every(Number.isFinite));
});

/** HitMarker.jsx(명중, 격추 표식)를 실제 React 없이 평가한다. JSX 를 h() 호출로 낮춰
 * 컴포넌트 함수만 그대로 돌리고, h 는 { type, props, children } 를 담는 순수 객체를 만든다.
 * 같은 key 면 React 가 DOM 을 그대로 두고, key 가 바뀌어야 새로 마운트해 forwards 애니메이션이
 * 다시 도는 것은 React 의 조정 규칙이 보장한다. 여기서는 컴포넌트가 그 key 로 count 를
 * 그대로 거는지, 0 이하에서는 아무것도 내지 않는지를 확인한다. */
async function loadHitMarker() {
  const source = await readFile(new URL('../../src/world/ui/HitMarker.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source, 'HitMarker.jsx',
    { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  return new Function('h', 'Fragment', `${code.replace(/^export function/gm, 'function')}; return { HitFlash, KillFlash };`)(h, 'fragment');
}

test('명중, 격추 표식은 0 이거나 값이 없으면 아무것도 내지 않는다', async () => {
  const { HitFlash, KillFlash } = await loadHitMarker();
  for (const count of [0, undefined, null, -1, NaN]) {
    assert.equal(HitFlash({ count }), null, `HitFlash(${count}) 가 떴다`);
    assert.equal(KillFlash({ count }), null, `KillFlash(${count}) 가 떴다`);
  }
});

test('명중, 격추 표식은 누적 수를 그대로 key 로 걸어 값이 바뀔 때만 다시 뜬다', async () => {
  const { HitFlash, KillFlash } = await loadHitMarker();
  const hit = HitFlash({ count: 3 });
  assert.equal(hit.type, 'svg');
  assert.equal(hit.props.key, 3, 'key 가 count 와 달라 값이 그대로여도 remount 될 수 있다');

  const kill = KillFlash({ count: 5 });
  assert.equal(kill.type, 'span');
  assert.equal(kill.props.key, 5);
  // 빨간 X 자와 해골 두 조각이 함께 떠야 한다.
  assert.equal(kill.children.length, 2);
  assert.ok(kill.children.every((child) => child.type === 'svg'));
  assert.equal(kill.children[0].props.className, 'wui-hitmark wui-hitmark-kill');
  assert.equal(kill.children[1].props.className, 'wui-killmark-skull');

  // 같은 count 로 다시 호출해도(리렌더와 같다) key 가 같으므로 React 는 새 노드로 보지 않는다.
  const hitAgain = HitFlash({ count: 3 });
  assert.equal(hitAgain.props.key, hit.props.key);
});
