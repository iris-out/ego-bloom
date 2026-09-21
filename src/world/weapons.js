import { hitsAnyBuilding } from './solidIndex.js';
import { hitsSphere } from './airTraffic.js';
import { hitsVehicle } from './carPhysics.js';

/** Pure weapon simulation for the fighter. No Three, no React, no network.
 * Positions are city world units and share the flight frame: nose -Z, +Y up.
 * Buildings are never destroyed; a hit only spawns a blast.
 */
export const CANNON = { interval: 1 / 18, speed: 320, life: 1.2, ammo: 600, blast: 1.5, blastLife: 0.3 };
export const MISSILE = { cooldown: 1.2, speed: 120, accel: 110, life: 6, gravity: 5.5, ammo: 6, flying: 6, blast: 11, blastLife: 1.4 };
/** 폭탄이다. 스스로 나아가지 않는다. 투하 순간의 기체 속도만 받고 중력으로 떨어진다.
 * 폭탄창 문이 열려야 나가고, 마지막 투하 뒤 BOMB.bayHold 가 지나면 문이 닫힌다. */
export const BOMB = { cooldown: 0.6, speed: 0, life: 14, gravity: 9.8, ammo: 24, blast: 18, blastLife: 1.8, bayOpen: 0.5, bayHold: 1.6 };

/** 기관총 탄이 포구에서 날아갈 수 있는 최대 거리다. 맵 너비(extent 의 두 배) 의 1/3 이다.
 * 기종의 life 가 정하는 거리와 둘 중 짧은 쪽이 실제 사거리가 된다. */
export function cannonRange(extent) {
  return Math.max(200, finite(extent, 180) * 2 / 3);
}

/** 기종별 기관총이다. 프로펠러기는 탄속이 낮은 대신 전투기보다 빠르게 쏜다.
 * interval 은 한 발 사이의 초다. 전 기종을 예전 값의 0.8 배로 줄여 연사를 20% 올렸다. */
const GUNS = Object.freeze({
  fighter: CANNON,
  prop: { interval: 1 / 24, speed: 240, life: 1.1, ammo: 900, blast: 1.2, blastLife: 0.26 },
  // 요격기는 기수에 모은 30mm 네 문이다. 느리게 쏘고 한 발이 크다.
  interceptor: { interval: 1 / 8.4, speed: 300, life: 1.3, ammo: 360, blast: 2.2, blastLife: 0.34 },
});

/** 없는 기종에는 전투기 기관총을 준다. 호출자가 무장 여부를 먼저 본다. */
export function gunOf(plane) {
  return GUNS[plane] || CANNON;
}

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** plane 을 주면 그 기종의 기관총 탄약으로 시작한다. 폭탄은 폭격기만 쓴다. */
export function createArsenal(plane = 'fighter') {
  const gun = gunOf(plane);
  // shots, rockets, bombs 는 누적 발사 수다. 남의 화면이 이 숫자의 증가만 보고 예광을 만든다.
  // airHits 는 이번 걸음에 AI 항공기를 맞힌 발사체 목록이다. 호출자가 읽고 버린다.
  // hits 는 이번 걸음에 부순 지상 AI 차량이다. airHits 와 같은 계약으로 호출자가 읽고 버린다.
  return { projectiles: [], blasts: [], airHits: [], hits: [], cannonTimer: 0, missileTimer: 0, bombTimer: 0,
    cannonAmmo: gun.ammo, missileAmmo: MISSILE.ammo, bombAmmo: BOMB.ammo,
    bayOpen: 0, bayTimer: 0, muzzle: 0, nextId: 1, shots: 0, rockets: 0, bombs: 0 };
}

// three.js applies a YXZ euler as Ry * Rx * Rz; the aircraft transform must match.
export function toWorld(pose, offset) {
  const [ox, oy, oz] = offset;
  const cp = Math.cos(finite(pose.pitch)), sp = Math.sin(finite(pose.pitch));
  const cr = Math.cos(finite(pose.roll)), sr = Math.sin(finite(pose.roll));
  const ch = Math.cos(finite(pose.heading)), sh = Math.sin(finite(pose.heading));
  const rx = ox * cr - oy * sr, ry = ox * sr + oy * cr;
  const py = ry * cp - oz * sp, pz = ry * sp + oz * cp;
  return { x: rx * ch + pz * sh, y: py, z: -rx * sh + pz * ch };
}

/** 포구에서 나가는 로컬 방향이다. converge 가 있으면 기수 앞 그 거리의 중심선을 겨눈다.
 * 날개에 벌려 단 기관총이 평행하게 나가면 탄이 조준점 좌우로 갈라진다.
 * 조준선(reticle.airImpact) 도 같은 식을 써야 표식과 실제 탄착이 맞는다. */
export function muzzleAim(mount, converge = 0) {
  if (!(converge > 0)) return [0, 0, -1];
  const [mx, my, mz] = mount;
  const dx = -mx, dy = -my, dz = -converge - mz;
  const length = Math.hypot(dx, dy, dz) || 1;
  return [dx / length, dy / length, dz / length];
}

function spawn(state, kind, pose, mount, speed, life, converge = 0) {
  const local = toWorld(pose, mount);
  const forward = toWorld(pose, muzzleAim(mount, converge));
  const carried = finite(pose.speed);
  return {
    id: state.nextId++, kind,
    x: finite(pose.x) + local.x, y: finite(pose.y) + local.y, z: finite(pose.z) + local.z,
    vx: forward.x * (speed + carried), vy: forward.y * (speed + carried), vz: forward.z * (speed + carried),
    age: 0, life: finite(life, CANNON.life), travel: 0,
  };
}

function specOf(kind, plane) {
  if (kind === 'missile') return MISSILE;
  if (kind === 'bomb') return BOMB;
  return gunOf(plane);
}

function burst(kind, point, plane) {
  const spec = specOf(kind, plane);
  return { kind, x: point.x, y: point.y, z: point.z, age: 0, life: spec.blastLife, size: spec.blast };
}

export function stepWeapons(previous, { dt = 0, pose, fire = {}, mounts = {}, obstacles = [], airTargets = [], traffic = [], extent = 180, plane = 'fighter' } = {}) {
  const step = Math.max(0, Math.min(finite(dt), 0.05));
  const state = { ...previous, projectiles: [], blasts: [], airHits: [], hits: [] };
  const airborne = pose?.phase === 'airborne';
  const gun = gunOf(plane);
  // 활주로에 서면 재장전한다. 지상에서는 쏘지 않는다.
  if (!airborne) { state.cannonAmmo = gun.ammo; state.missileAmmo = MISSILE.ammo; state.bombAmmo = BOMB.ammo; }
  state.cannonTimer = Math.max(0, finite(state.cannonTimer) - step);
  state.missileTimer = Math.max(0, finite(state.missileTimer) - step);
  state.bombTimer = Math.max(0, finite(state.bombTimer) - step);

  const active = [...previous.projectiles];
  // 장착점이 없는 무장은 쏘지 않는다. 폭격기는 기관총이 없으므로 같은 키를 눌러도 총알이 나가면 안 된다.
  if (airborne && fire.cannon && mounts.cannon?.length && state.cannonTimer <= 0 && state.cannonAmmo > 0) {
    const ports = mounts.cannon;
    state.muzzle = (finite(state.muzzle) + 1) % ports.length;
    active.push(spawn(state, 'cannon', pose, ports[state.muzzle], gun.speed, gun.life, mounts.converge));
    state.cannonTimer = gun.interval;
    state.cannonAmmo -= 1;
    state.shots = (state.shots || 0) + 1;
  }
  const flying = active.filter((projectile) => projectile.kind === 'missile').length;
  if (airborne && fire.missile && mounts.missile?.length && state.missileTimer <= 0 && state.missileAmmo > 0 && flying < MISSILE.flying) {
    const ports = mounts.missile;
    active.push(spawn(state, 'missile', pose, ports[(MISSILE.ammo - state.missileAmmo) % ports.length], MISSILE.speed, MISSILE.life));
    state.missileTimer = MISSILE.cooldown;
    state.missileAmmo -= 1;
    state.rockets = (state.rockets || 0) + 1;
  }

  // 폭탄창은 투하 요청이 오면 열리고, 다 열려야 폭탄이 나간다. 마지막 투하 뒤 스스로 닫힌다.
  const wantsBomb = airborne && !!fire.bomb && state.bombAmmo > 0 && Boolean(mounts.bomb?.length);
  if (wantsBomb) state.bayTimer = BOMB.bayHold;
  else state.bayTimer = Math.max(0, finite(state.bayTimer) - step);
  const bayTarget = wantsBomb || state.bayTimer > 0 ? 1 : 0;
  const bayStep = step / BOMB.bayOpen;
  state.bayOpen = Math.max(0, Math.min(1, finite(state.bayOpen) + (bayTarget ? bayStep : -bayStep)));
  if (wantsBomb && state.bayOpen >= 1 && state.bombTimer <= 0) {
    // 폭탄은 추진이 없다. 기체 속도만 그대로 받는다.
    active.push(spawn(state, 'bomb', pose, mounts.bomb[0], BOMB.speed, BOMB.life));
    state.bombTimer = BOMB.cooldown;
    state.bombAmmo -= 1;
    state.bombs = (state.bombs || 0) + 1;
  }

  const bound = Math.max(1400, finite(extent, 180) + 900);
  const range = cannonRange(extent);
  const blasts = [];
  for (const projectile of active) {
    const moved = { ...projectile, age: projectile.age + step };
    if (moved.kind === 'bomb') moved.vy -= BOMB.gravity * step;
    if (moved.kind === 'missile') {
      const speed = Math.hypot(moved.vx, moved.vy, moved.vz) || 1;
      const gain = MISSILE.accel * step;
      moved.vx += moved.vx / speed * gain;
      moved.vy += moved.vy / speed * gain - MISSILE.gravity * step;
      moved.vz += moved.vz / speed * gain;
    }
    moved.x += moved.vx * step; moved.y += moved.vy * step; moved.z += moved.vz * step;
    moved.travel = finite(projectile.travel) + Math.hypot(moved.x - projectile.x, moved.y - projectile.y, moved.z - projectile.z);
    if (![moved.x, moved.y, moved.z].every(Number.isFinite)) continue;
    // 지상 AI 차량이다. 기관총, 미사일, 폭탄 모두 부순다. 지면 판정보다 먼저 본다.
    const car = traffic.find((box) => hitsVehicle(projectile, moved, box, 0.8));
    if (car) {
      blasts.push(burst(moved.kind, { x: moved.x, y: Math.max(0.4, moved.y), z: moved.z }, plane));
      state.hits.push(car);
      continue;
    }
    if (moved.y <= 0) { blasts.push(burst(moved.kind, { x: moved.x, y: 0.3, z: moved.z }, plane)); continue; }
    if (hitsAnyBuilding(projectile, moved, obstacles)) { blasts.push(burst(moved.kind, moved, plane)); continue; }
    // AI 항공기는 구 하나로 판정한다. 맞으면 발사체가 거기서 끝나고 호출자가 격추를 센다.
    const struck = airTargets.find((target) => hitsSphere(projectile, moved, target));
    if (struck) {
      blasts.push(burst(moved.kind, moved, plane));
      state.airHits.push({ index: struck.index, weapon: moved.kind, x: moved.x, y: moved.y, z: moved.z });
      continue;
    }
    // 기관총은 사거리로도 끊는다. 빠른 기체에서 쏘면 탄속에 기체 속도가 더해져 더 멀리 간다.
    if (moved.kind === 'cannon' && moved.travel > range) continue;
    if (moved.age >= moved.life || Math.hypot(moved.x, moved.z) > bound) continue;
    state.projectiles.push(moved);
  }
  state.blasts = [...previous.blasts, ...blasts]
    .map((blast) => ({ ...blast, age: blast.age + step, id: blast.id ?? state.nextId++ }))
    .filter((blast) => blast.age < blast.life);
  return state;
}
