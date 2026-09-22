import { hitsAnyBuilding } from './solidIndex.js';
import { hitsSphere } from './airTraffic.js';
import { hitsVehicle } from './carPhysics.js';

/** Pure weapon simulation for the fighter. No Three, no React, no network.
 * Positions are city world units and share the flight frame: nose -Z, +Y up.
 * Buildings are never destroyed; a hit only spawns a blast.
 */
export const CANNON = { interval: 1 / 18, speed: 320, life: 1.2, ammo: 600, blast: 1.5, blastLife: 0.3 };
/** turn 은 유도 미사일이 초당 꺾는 각이다(rad). 락온하고 쏜 탄만 쓴다. 3.0 이면 탄속
 * 120 에서 선회 반경이 40m 라 스쳐 지나가도 다시 붙는다. 뒤로 되돌아오지는 못한다.
 * proximity 는 근접 신관이 터지는 여유다. 기체 피격 구(반지름 7) 에 더해 본다.
 * 실제 공대공 미사일처럼 옆을 스치기만 해도 터진다. 유도탄에만 쓴다. */
export const MISSILE = { cooldown: 1.2, speed: 120, accel: 110, life: 6, gravity: 5.5, ammo: 6, flying: 6, blast: 11, blastLife: 1.4, turn: 3, proximity: 12 };
/** 폭탄이다. 스스로 나아가지 않는다. 투하 순간의 기체 속도만 받고 중력으로 떨어진다.
 * 폭탄창 문이 열려야 나가고, 마지막 투하 뒤 BOMB.bayHold 가 지나면 문이 닫힌다. */
export const BOMB = { cooldown: 0.6, speed: 0, life: 14, gravity: 9.8, ammo: 24, blast: 18, blastLife: 1.8, bayOpen: 0.5, bayHold: 1.6 };

/** 기관총 탄이 포구에서 날아갈 수 있는 최대 거리다. 맵 너비(extent 의 두 배) 의 1/3 이다.
 * 기종의 life 가 정하는 거리와 둘 중 짧은 쪽이 실제 사거리가 된다. */
export function cannonRange(extent, plane = null) {
  if (plane === 'interceptor' || plane === 'shotgun') return gunOf(plane).range;
  return Math.max(200, finite(extent, 180) * 2 / 3);
}

/** 기종별 기관총이다. 프로펠러기는 탄속이 낮은 대신 전투기보다 빠르게 쏜다.
 * interval 은 한 발 사이의 초다. 전 기종을 예전 값의 0.8 배로 줄여 연사를 20% 올렸다. */
const GUNS = Object.freeze({
  fighter: CANNON,
  prop: { interval: 1 / 24, speed: 240, life: 1.1, ammo: 900, blast: 1.2, blastLife: 0.26 },
  // 요격기는 근거리용 30mm 2연장이다. 기준 300m/s 탄보다 20% 느리고, 기존 설정 대비 연사는 20% 더 빠르며 낙차가 크다.
  interceptor: { interval: 1 / (8.4 * 1.1 * 1.2), speed: 240, gravity: 12.25, range: 300, life: 1.3, ammo: 360, blast: 2.2, blastLife: 0.34 },
  // 샷거너는 요격기 동체를 공유하는 근거리 산탄 전투기다. 한 번 누르면 두 포신을
  // 0.10초 간격으로 쏘고, 두 번째 포신 뒤 0.9초 동안 다시 장전한다.
  shotgun: { interval: 0.10, cooldown: 0.9, speed: 260, life: 0.7, range: 150, ammo: 80, pellets: 8, spread: 0.11, blast: 1.4, blastLife: 0.28 },
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
  return { projectiles: [], blasts: [], airHits: [], hits: [], cannonTimer: 0, shotgunTimer: 0, shotgunStage: 0, cannonHeld: false, missileTimer: 0, bombTimer: 0,
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

function spawn(state, kind, pose, mount, speed, life, converge = 0, seek = null, spread = null) {
  const local = toWorld(pose, mount);
  const aim = muzzleAim(mount, converge);
  if (spread) {
    aim[0] += spread[0]; aim[1] += spread[1];
    const length = Math.hypot(aim[0], aim[1], aim[2]) || 1;
    aim[0] /= length; aim[1] /= length; aim[2] /= length;
  }
  const forward = toWorld(pose, aim);
  const carried = finite(pose.speed);
  return {
    id: state.nextId++, kind,
    x: finite(pose.x) + local.x, y: finite(pose.y) + local.y, z: finite(pose.z) + local.z,
    vx: forward.x * (speed + carried), vy: forward.y * (speed + carried), vz: forward.z * (speed + carried),
    age: 0, life: finite(life, CANNON.life), travel: 0,
    // 락온하고 쏜 미사일만 목표 번호를 갖는다. null 이면 예전처럼 곧게 날아간다.
    seek: Number.isFinite(seek) ? seek : null,
  };
}

// 근접 신관 판정에 쓰는 그릇이다. 후보마다 객체를 새로 만들면 연사 중에 쓰레기가 쌓인다.
const fuze = { x: 0, y: 0, z: 0, radius: 0 };

/** 판정에 쓸 구다. 유도탄이 쫓던 기체면 근접 신관 여유를 더하고, 아니면 목표 그대로다. */
function fuzeOf(projectile, target) {
  if (projectile.kind !== 'missile' || projectile.seek == null || projectile.seek !== target.index) return target;
  fuze.x = finite(target.x); fuze.y = finite(target.y); fuze.z = finite(target.z);
  fuze.radius = finite(target.radius) + MISSILE.proximity;
  return fuze;
}

/** 유도 미사일의 속도 방향을 목표 쪽으로 한 걸음 꺾는다. 속력은 그대로 두고 방향만 돌린다.
 * 한 걸음에 MISSILE.turn * step 라디안을 넘지 않아 눈앞에서 직각으로 꺾이지 않는다. */
function steerMissile(missile, target, step) {
  if (!target) return;
  const speed = Math.hypot(missile.vx, missile.vy, missile.vz);
  if (!(speed > 1e-6)) return;
  const dx = finite(target.x) - missile.x, dy = finite(target.y) - missile.y, dz = finite(target.z) - missile.z;
  const reach = Math.hypot(dx, dy, dz);
  if (!(reach > 1e-6)) return;
  const wantX = dx / reach, wantY = dy / reach, wantZ = dz / reach;
  const nowX = missile.vx / speed, nowY = missile.vy / speed, nowZ = missile.vz / speed;
  const cos = Math.max(-1, Math.min(1, nowX * wantX + nowY * wantY + nowZ * wantZ));
  const apart = Math.acos(cos);
  if (apart <= 1e-6) return;
  const share = Math.min(1, (MISSILE.turn * step) / apart);
  const mixX = nowX + (wantX - nowX) * share;
  const mixY = nowY + (wantY - nowY) * share;
  const mixZ = nowZ + (wantZ - nowZ) * share;
  const length = Math.hypot(mixX, mixY, mixZ) || 1;
  missile.vx = mixX / length * speed;
  missile.vy = mixY / length * speed;
  missile.vz = mixZ / length * speed;
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

export function stepWeapons(previous, { dt = 0, pose, fire = {}, mounts = {}, obstacles = [], airTargets = [], traffic = [], extent = 180, plane = 'fighter', seek = null } = {}) {
  const step = Math.max(0, Math.min(finite(dt), 0.05));
  const state = { ...previous, projectiles: [], blasts: [], airHits: [], hits: [] };
  const airborne = pose?.phase === 'airborne';
  const gun = gunOf(plane);
  // 활주로에 서면 재장전한다. 지상에서는 쏘지 않는다.
  if (!airborne) { state.cannonAmmo = gun.ammo; state.missileAmmo = MISSILE.ammo; state.bombAmmo = BOMB.ammo; }
  // 사격 중에는 현재 프레임이 발사 시각을 넘긴 만큼을 다음 주기로 이월한다.
  // 손을 떼어 이미 준비된 0은 음수로 누적하지 않아, 다시 누르면 한 발만 즉시 나간다.
  state.cannonTimer = finite(state.cannonTimer) > 0 ? finite(state.cannonTimer) - step : 0;
  state.shotgunTimer = Math.max(0, finite(state.shotgunTimer) - step);
  state.missileTimer = Math.max(0, finite(state.missileTimer) - step);
  state.bombTimer = Math.max(0, finite(state.bombTimer) - step);

  const active = [...previous.projectiles];
  // 장착점이 없는 무장은 쏘지 않는다. 폭격기는 기관총이 없으므로 같은 키를 눌러도 총알이 나가면 안 된다.
  const trigger = !!fire.cannon && !state.cannonHeld;
  state.cannonHeld = !!fire.cannon;
  if (plane === 'shotgun') {
    const ports = mounts.cannon;
    const fireBarrel = (barrel) => {
      if (!ports?.length || state.cannonAmmo <= 0) return false;
      const mount = ports[barrel % ports.length];
      const pellets = Math.max(1, Math.floor(gun.pellets || 1));
      for (let index = 0; index < pellets; index += 1) {
        const angle = (index / pellets) * Math.PI * 2;
        const radius = index === 0 ? 0 : gun.spread;
        active.push(spawn(state, 'cannon', pose, mount, gun.speed, gun.life, mounts.converge, null,
          [Math.cos(angle) * radius, Math.sin(angle) * radius]));
      }
      state.cannonAmmo -= 1;
      state.shots = (state.shots || 0) + 1;
      return true;
    };
    if (airborne && trigger && state.shotgunStage === 0 && fireBarrel(0)) {
      state.shotgunStage = 1;
      state.shotgunTimer = gun.interval;
    } else if (airborne && state.shotgunStage === 1 && state.shotgunTimer <= 0 && fireBarrel(1)) {
      state.shotgunStage = 2;
      state.shotgunTimer = gun.cooldown;
    } else if (state.shotgunStage === 2 && state.shotgunTimer <= 0) {
      state.shotgunStage = 0;
    }
  } else if (airborne && fire.cannon && mounts.cannon?.length && state.cannonTimer <= 0 && state.cannonAmmo > 0) {
    const ports = mounts.cannon;
    const volley = plane === 'interceptor' ? ports : [ports[(finite(state.muzzle) + 1) % ports.length]];
    state.muzzle = (finite(state.muzzle) + 1) % ports.length;
    for (const port of volley) active.push(spawn(state, 'cannon', pose, port, gun.speed, gun.life, mounts.converge));
    state.cannonTimer += gun.interval;
    state.cannonAmmo -= 1;
    state.shots = (state.shots || 0) + 1;
  }
  const flying = active.filter((projectile) => projectile.kind === 'missile').length;
  if (airborne && fire.missile && mounts.missile?.length && state.missileTimer <= 0 && state.missileAmmo > 0 && flying < MISSILE.flying) {
    const ports = mounts.missile;
    active.push(spawn(state, 'missile', pose, ports[(MISSILE.ammo - state.missileAmmo) % ports.length], MISSILE.speed, MISSILE.life, 0, seek));
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
  const range = cannonRange(extent, plane);
  const blasts = [];
  const hitIndexes = new Set();
  const recordHit = (target) => {
    if (!target || hitIndexes.has(target.index)) return;
    hitIndexes.add(target.index);
    state.hits.push(target);
  };
  const bombHits = (point) => {
    for (const target of traffic) {
      if (Math.hypot(finite(target.x) - point.x, finite(target.y) - point.y, finite(target.z) - point.z) <= BOMB.blast) recordHit(target);
    }
  };
  for (const projectile of active) {
    const moved = { ...projectile, age: projectile.age + step };
    if (moved.kind === 'bomb') moved.vy -= BOMB.gravity * step;
    if (moved.kind === 'cannon') moved.vy -= finite(gun.gravity) * step;
    if (moved.kind === 'missile') {
      const speed = Math.hypot(moved.vx, moved.vy, moved.vz) || 1;
      const gain = MISSILE.accel * step;
      moved.vx += moved.vx / speed * gain;
      moved.vy += moved.vy / speed * gain - MISSILE.gravity * step;
      moved.vz += moved.vz / speed * gain;
      // 목표를 들고 있으면 그 기체 쪽으로 속도를 꺾는다. 목표가 목록에서 빠지면
      // (격추되었거나 사거리 밖) 그대로 곧게 날아간다.
      if (moved.seek != null) steerMissile(moved, airTargets.find((target) => target.index === moved.seek), step);
    }
    moved.x += moved.vx * step; moved.y += moved.vy * step; moved.z += moved.vz * step;
    moved.travel = finite(projectile.travel) + Math.hypot(moved.x - projectile.x, moved.y - projectile.y, moved.z - projectile.z);
    if (![moved.x, moved.y, moved.z].every(Number.isFinite)) continue;
    // 지상 AI 차량이다. 기관총, 미사일, 폭탄 모두 부순다. 지면 판정보다 먼저 본다.
    const car = traffic.find((box) => hitsVehicle(projectile, moved, box, 0.8));
    if (car) {
      blasts.push(burst(moved.kind, { x: moved.x, y: Math.max(0.4, moved.y), z: moved.z }, plane));
      if (moved.kind === 'bomb') { recordHit(car); bombHits(moved); } else recordHit(car);
      continue;
    }
    if (moved.y <= 0) {
      const point = { x: moved.x, y: 0.3, z: moved.z };
      blasts.push(burst(moved.kind, point, plane));
      if (moved.kind === 'bomb') bombHits(point);
      continue;
    }
    if (hitsAnyBuilding(projectile, moved, obstacles)) {
      blasts.push(burst(moved.kind, moved, plane));
      if (moved.kind === 'bomb') bombHits(moved);
      continue;
    }
    // AI 항공기는 구 하나로 판정한다. 맞으면 발사체가 거기서 끝나고 호출자가 격추를 센다.
    // 유도탄은 자기가 쫓던 기체에 한해 근접 신관 여유를 더한 구로 본다.
    const struck = airTargets.find((target) => hitsSphere(projectile, moved, fuzeOf(moved, target)));
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
