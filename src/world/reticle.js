import { hitsAnyBuilding } from './solidIndex.js';
import { GROUND_GUNS, muzzlePoint, shellGravity } from './groundWeapons.js';
import { BOMB, MISSILE, gunOf, muzzleAim, toWorld } from './weapons.js';
import { armamentOf } from './hardpoints.js';

/** 조준선이 쓰는 탄도 계산이다. 순수 함수이며 Three, React, 네트워크에 의존하지 않는다.
 *
 * 조준선은 화면 중앙의 십자가 아니라 포탄이 실제로 떨어지는 자리를 가리켜야 쓸모가 있다.
 * 그래서 발사와 같은 적분을 한 번 미리 돌려 탄착점을 구한다. 발사체를 만드는 곳은
 * weapons.js 와 groundWeapons.js 이고 여기서는 같은 상수와 같은 포구를 읽어 미리 굴려만 본다.
 * 두 곳의 중력이나 속도를 고치면 조준선이 따라 움직인다.
 */

/** 지상 포탄의 중력이다. stepGroundWeapons 와 같은 값을 쓴다. */
export const GROUND_GRAVITY = 9.8;
/** 탄착 판정 높이다. stepGroundWeapons 가 0.25 에서 터뜨린다. */
export const GROUND_FLOOR = 0.25;
/** 미리 굴려 보는 적분 간격이다. 실제 발사보다 거칠게 잡아 한 프레임에 끝낸다. */
export const PROBE_STEP = 1 / 30;
/** 굴려 보는 최대 시간이다. 포탄 수명과 같다. */
export const PROBE_LIFE = 4;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** 포탄 하나를 탄착까지 굴린다. 지면이나 건물에 닿으면 그 지점을, 못 닿으면 수명 끝 지점을 준다.
 * range 는 발사점에서 탄착점까지의 수평 거리다. */
export function probeShell(start, velocity, { gravity = GROUND_GRAVITY, life = PROBE_LIFE, step = PROBE_STEP, buildings = [], floor = GROUND_FLOOR, accel = 0 } = {}) {
  let x = finite(start?.x), y = finite(start?.y), z = finite(start?.z);
  let vx = finite(velocity?.x), vy = finite(velocity?.y), vz = finite(velocity?.z);
  const span = Math.max(step, Math.min(finite(life, PROBE_LIFE), 12));
  for (let time = 0; time < span; time += step) {
    const from = { x, y, z };
    if (accel) {
      const speed = Math.hypot(vx, vy, vz) || 1;
      const gain = accel * step;
      vx += vx / speed * gain; vy += vy / speed * gain; vz += vz / speed * gain;
    }
    vy -= gravity * step;
    x += vx * step; y += vy * step; z += vz * step;
    if (![x, y, z].every(Number.isFinite)) break;
    const to = { x, y, z };
    if (y <= floor) {
      return { x, y: floor, z, range: Math.hypot(x - finite(start?.x), z - finite(start?.z)), time: time + step, hit: 'ground' };
    }
    if (hitsAnyBuilding(from, to, buildings)) {
      return { x, y, z, range: Math.hypot(x - finite(start?.x), z - finite(start?.z)), time: time + step, hit: 'building' };
    }
  }
  return { x, y, z, range: Math.hypot(x - finite(start?.x), z - finite(start?.z)), time: span, hit: 'none' };
}

/** 전차, 자주포, 장갑차의 탄착점이다. 포구와 포 속도는 GROUND_GUNS 한 곳에서 나온다. */
export function groundImpact(pose, aim, vehicle = 'tank', buildings = []) {
  const spec = GROUND_GUNS[vehicle];
  if (!spec) return null;
  // muzzlePoint 는 null 을 받지 않는다. 조준선은 자세가 아직 없는 첫 프레임에도 불린다.
  const mouth = muzzlePoint(pose || {}, aim || {}, vehicle);
  const velocity = { x: mouth.forward.x * spec.speed, y: mouth.forward.y * spec.speed, z: mouth.forward.z * spec.speed };
  // 낙차는 기종이 정한다. stepGroundWeapons 와 같은 값을 읽어야 표식과 탄착이 맞는다.
  return { ...probeShell(mouth, velocity, { buildings, gravity: shellGravity(vehicle) }), weapon: vehicle };
}

/** 전투기의 탄착점이다. 기관포는 중력이 없고(weapons.js 가 미사일에만 중력을 준다)
 * 미사일은 중력과 가속을 함께 받는다. 기체 속도가 탄속에 더해지는 것도 같게 맞춘다. */
export function airImpact(pose, weapon = 'cannon', buildings = []) {
  const key = pose?.key || 'fighter';
  const mounts = armamentOf(key);
  if (!mounts) return null;
  const missile = weapon === 'missile', bomb = weapon === 'bomb';
  const ports = (bomb ? mounts.bomb : missile ? mounts.missile : mounts.cannon) || [[0, 0, -5]];
  const local = toWorld(pose, ports[0]);
  // 수렴 사격을 하는 기종은 포구마다 방향이 다르다. 발사와 같은 식을 써야 표식이 맞는다.
  const forward = toWorld(pose, muzzleAim(ports[0], missile || bomb ? 0 : mounts.converge));
  const spec = bomb ? BOMB : missile ? MISSILE : gunOf(key);
  // 폭탄은 추진이 없다. 투하 순간 기체 속도만 그대로 받는다.
  const speed = spec.speed + Math.max(0, finite(pose?.speed));
  const start = { x: finite(pose?.x) + local.x, y: finite(pose?.y) + local.y, z: finite(pose?.z) + local.z };
  const velocity = { x: forward.x * speed, y: forward.y * speed, z: forward.z * speed };
  return {
    ...probeShell(start, velocity, {
      buildings, floor: 0, life: spec.life,
      gravity: bomb ? BOMB.gravity : missile ? MISSILE.gravity : 0,
      accel: missile ? MISSILE.accel : 0,
    }),
    weapon,
  };
}

/** 포신을 수평으로 두었을 때 거리별 하강량과 그 시야각이다. 조준선의 사거리 눈금이 이 표를 쓴다.
 * drop 은 월드 단위, angle 은 라디안이며 조준선 중앙에서 아래로 내려간 각이다. */
export function dropLadder(vehicle = 'tank', ranges = []) {
  const spec = GROUND_GUNS[vehicle];
  if (!spec) return [];
  const gravity = shellGravity(vehicle);
  return ranges.filter((range) => Number.isFinite(range) && range > 0).map((range) => {
    const flight = range / spec.speed;
    const drop = 0.5 * gravity * flight * flight;
    return { range, drop, angle: Math.atan2(drop, range) };
  });
}

/** 시야각을 화면 픽셀로 바꾼다. three 의 fov 는 세로 기준이라 화면 높이만 있으면 된다. */
export function angleToScreen(angle, fovDegrees = 62, heightPixels = 900) {
  const half = Math.tan(Math.max(1, finite(fovDegrees, 62)) * Math.PI / 360);
  if (half <= 0) return 0;
  return Math.tan(finite(angle)) / half * (finite(heightPixels, 900) / 2);
}

/** 기종별 조준선 생김새다. DOM 이 이 값을 읽어 그린다. 좌표를 여기서 만들지 않는다.
 * ladder 는 눈금을 둘 사거리이고 ring 은 유효 사거리를 알리는 원의 시야각(라디안) 이다. */
export const RETICLE = Object.freeze({
  // 요격기다. 기수에 모은 기관포라 산포가 좁다.
  interceptor: { type: 'pipper', ladder: [], ring: 0.032, lead: true, label: '요격' },
  // 프로펠러 전투기다. 기관총만 달았고 탄속이 낮아 유효 사거리 원이 더 좁다.
  prop: { type: 'pipper', ladder: [], ring: 0.05, lead: true, label: '기총' },
  // 폭격기다. 조준선이 아니라 투하 표식이다. 탄착점은 AimMarker 가 땅에 그린다.
  bomber: { type: 'pipper', ladder: [], ring: 0.09, lead: false, label: '투하' },
  // 직사포다. 사거리 눈금과 탄착 표식을 함께 쓴다.
  tank: { type: 'ladder', ladder: [200, 400, 600, 800], ring: 0, lead: false, label: '직사' },
  // 곡사포다. 눈금 간격이 좁고 멀리까지 간다.
  howitzer: { type: 'ladder', ladder: [200, 400, 600, 800, 1000], ring: 0, lead: false, label: '곡사' },
  // 기관포다. 연사가 빨라 이동 목표를 잡으므로 편차 표식을 쓴다.
  armored: { type: 'autocannon', ladder: [200, 400, 600], ring: 0.052, lead: true, label: '기관포' },
  // 전투기다. 기관포는 중력이 없어 눈금이 필요 없고 유효 사거리 원과 미사일 표식만 둔다.
  fighter: { type: 'pipper', ladder: [], ring: 0.035, lead: true, label: '항공' },
  // 대공포다. 배율 조준경으로 하늘을 본다. 눈금은 짧게 두고 편차 표식을 쓴다.
  aa: { type: 'autocannon', ladder: [300, 600], ring: 0.028, lead: true, label: '대공' },
});

export function reticleOf(kind, key) {
  if (kind === 'flight') return RETICLE[key] && key !== 'helicopter' ? RETICLE[key] : null;
  if (kind === 'car') return RETICLE[key] || null;
  return null;
}

/** 기관포 유효 사거리다. 탄속과 수명이 정하는 값이고 원의 의미를 이 숫자가 만든다. */
export function effectiveRange(kind, key) {
  if (kind === 'flight') {
    if (key === 'bomber') return 0;
    const gun = gunOf(key);
    return RETICLE[key] ? gun.speed * gun.life : 0;
  }
  const spec = GROUND_GUNS[key];
  if (!spec) return 0;
  // 지상 포는 포신을 수평으로 둔 채 사람 키 높이에서 쏘면 닿는 거리로 잡는다.
  return spec.speed * Math.sqrt(2 * 3 / GROUND_GRAVITY) * 2;
}
