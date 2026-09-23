import { hitsAnyBuilding } from './solidIndex.js';
import { hitsVehicle } from './carPhysics.js';
import { GROUND_GUNS, hullBox, muzzlePoint } from './groundWeapons.js';
import { MISSILE, gunOf, muzzleAim, pelletOffset, toWorld } from './weapons.js';
import { armamentOf } from './hardpoints.js';
import { damageOf, isArmed } from './health.js';

/** 남이 쏜 포탄을 내 화면에서 다시 그린다. 순수 함수이며 Three, React, 네트워크에 의존하지 않는다.
 *
 * 네트워크로 오는 것은 발사 횟수 하나뿐이고 탄도는 각 브라우저가 같은 식으로 다시 계산한다.
 * 포탄 좌표를 100ms 마다 보내면 대역폭이 발사 수에 비례해 늘고 궤적도 끊긴다.
 *
 * 피해 판정은 맞는 쪽만 한다. 내 화면에서 내 차체에 닿은 포탄만 내 체력을 깎고,
 * 깎인 체력을 다시 broadcast 해 남이 내 게이지를 본다. 공격자가 남의 체력을 대신
 * 깎지 않으므로 두 브라우저가 서로 다른 답을 내놓고 다투는 일이 없다.
 */

/** 한 화면에 남길 원격 포탄 수다. 넘으면 오래된 것부터 버린다. */
export const REMOTE_SHELL_MAX = 160;
/** 한 번의 수신에서 받아들일 발사 수다. 끊긴 뒤 한꺼번에 들어온 숫자로 탄막을 만들지 않는다. */
export const BURST_MAX = 4;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** 무기별 탄도다. 값의 출처는 각각 groundWeapons 와 weapons 이고 여기서 새로 정하지 않는다. */
const SHELLS = Object.freeze({
  tank: { speed: GROUND_GUNS.tank.speed, gravity: 9.8, life: 4, blast: GROUND_GUNS.tank.blast },
  howitzer: { speed: GROUND_GUNS.howitzer.speed, gravity: 9.8, life: 4, blast: GROUND_GUNS.howitzer.blast },
  armored: { speed: GROUND_GUNS.armored.speed, gravity: 9.8, life: 4, blast: GROUND_GUNS.armored.blast },
  aa: { speed: GROUND_GUNS.aa.speed, gravity: 9.8, life: 4, blast: GROUND_GUNS.aa.blast },
  missile: { speed: MISSILE.speed, gravity: MISSILE.gravity, accel: MISSILE.accel, life: MISSILE.life, blast: MISSILE.blast },
});

/** 기관포는 발사한 기종의 탄속·낙차를 쓴다. 나머지 무기는 공통 표를 읽는다. */
function shellSpec(weapon, plane) {
  return weapon === 'cannon' || weapon === 'shotgun' ? gunOf(plane) : SHELLS[weapon];
}

export function createRemoteCombat() {
  return { shells: [], blasts: [], fired: {}, nextId: 1, damage: 0, weapon: null };
}

/** 지상 전투 차량의 포구다. 로컬 발사와 같은 muzzlePoint 를 쓴다. */
function groundMuzzle(pose, index) {
  const point = muzzlePoint(pose, { yaw: finite(pose.turret), pitch: finite(pose.barrel) }, pose.key, index);
  return { x: point.x, y: point.y, z: point.z, forward: point.forward };
}

/** 전투기 포구다. 기관포는 기수 포트, 미사일은 파일런이다. */
function airMuzzle(pose, weapon, index, pellet = null) {
  const mounts = armamentOf(pose.key);
  const ports = (weapon === 'missile' ? mounts?.missile : mounts?.cannon) || [[0, 0, -5]];
  const port = ports[index % ports.length];
  const local = toWorld(pose, port);
  const aim = muzzleAim(port, weapon === 'missile' ? 0 : mounts?.converge);
  if (pellet !== null) {
    const spec = gunOf(pose.key);
    const [dx, dy] = pelletOffset(pellet, spec.pellets, spec.spread);
    aim[0] += dx; aim[1] += dy;
    const length = Math.hypot(...aim) || 1;
    aim[0] /= length; aim[1] /= length; aim[2] /= length;
  }
  const forward = toWorld(pose, aim);
  return { x: finite(pose.x) + local.x, y: finite(pose.y) + local.y, z: finite(pose.z) + local.z, forward };
}

function spawn(state, pose, weapon, index, pellet = null) {
  const spec = shellSpec(weapon, pose.key);
  if (!spec) return null;
  const mouth = pose.kind === 'car' ? groundMuzzle(pose, index) : airMuzzle(pose, weapon, index, pellet);
  if (![mouth.x, mouth.y, mouth.z].every(Number.isFinite)) return null;
  const speed = spec.speed + (weapon === 'shotgun' ? finite(pose.speed) : 0);
  return {
    id: state.nextId++, weapon, owner: pose.id,
    x: mouth.x, y: mouth.y, z: mouth.z,
    vx: mouth.forward.x * speed, vy: mouth.forward.y * speed, vz: mouth.forward.z * speed,
    age: 0, life: spec.life, travel: 0, plane: pose.kind === 'flight' ? pose.key : null,
  };
}

/** 상대가 든 주무기 이름이다. 지상은 차종이 곧 포 이름이고 전투기는 기관포다. */
function primaryOf(peer) {
  return peer.kind === 'car' || peer.key === 'shotgun' ? peer.key : 'cannon';
}

/** 상대가 새로 쏜 만큼 포탄을 만든다. 발사 횟수는 단조 증가하므로 차이만큼 만들면 된다. */
function launchFrom(state, peers, fired) {
  const fresh = [];
  for (const peer of peers) {
    if (!peer || !isArmed(peer.kind, peer.key)) continue;
    if (peer.phase === 'crashed') continue;
    for (const [field, weapon] of [['shots', primaryOf(peer)], ['rockets', 'missile']]) {
      const count = Math.max(0, Math.floor(finite(peer[field])));
      const key = `${peer.id}:${field}`;
      const seen = fired[key];
      // 처음 본 상대의 누적 발사 수는 과거의 합이다. 기준만 잡고 탄을 만들지 않는다.
      if (seen === undefined) { fired[key] = count; continue; }
      fired[key] = count;
      const added = Math.min(BURST_MAX, count - seen);
      for (let index = 0; index < added; index += 1) {
        const pellets = weapon === 'shotgun' ? gunOf(peer.key).pellets : 1;
        for (let pellet = 0; pellet < pellets; pellet += 1) {
          const shell = spawn(state, peer, weapon, seen + index, weapon === 'shotgun' ? pellet : null);
          if (shell) fresh.push(shell);
        }
      }
    }
  }
  return fresh;
}

/** 내 차체에 닿았는지 본다. 지상은 상자, 공중은 구로 본다.
 * 지상 상자는 hullBox 가 바닥과 전고를 채운 것이라 세 축을 모두 본다. 채우기 전에는
 * 남의 포탄이 내 차 200m 위를 지나가도 수평만 겹치면 체력이 깎였다. */
function hitsSelf(from, to, self) {
  if (!self) return false;
  if (self.kind === 'car' || self.kind === 'walk') return hitsVehicle(from, to, self, 0.6);
  const radius = finite(self.radius, 7);
  return Math.hypot(to.x - self.x, to.y - finite(self.y), to.z - self.z) <= radius;
}

/** 원격 포탄을 한 걸음 굴린다. peers 는 pose 를 펼친 배열이고 self 는 내 탈것의 충돌 상자다.
 * self 가 무장하지 않았거나 없으면 피해를 계산하지 않는다. 세단과 오토바이, 도보는 터지지 않는다.
 */
export function stepRemoteCombat(previous, { dt = 0, peers = [], self = null, buildings = [] } = {}) {
  const step = Math.max(0, Math.min(finite(dt), 0.05));
  const fired = { ...previous.fired };
  const state = { ...previous, shells: [], blasts: [], fired, damage: 0, weapon: null };
  // 떠난 상대의 기준값은 버린다. 다시 들어오면 그때 다시 잡는다.
  const present = new Set(peers.map((peer) => peer?.id));
  for (const key of Object.keys(fired)) if (!present.has(key.slice(0, key.lastIndexOf(':')))) delete fired[key];

  const active = [...(previous.shells || []), ...launchFrom(state, peers, fired)];
  const vulnerable = self && isArmed(self.kind, self.key);
  // 세로를 채운 상자는 프레임마다 한 번만 만든다. 포탄 160발이 같은 상자를 읽는다.
  const target = vulnerable && self.kind === 'car' ? hullBox(self) : self;
  const blasts = [];
  for (const shell of active.slice(-REMOTE_SHELL_MAX)) {
    const spec = shellSpec(shell.weapon, shell.plane);
    const moved = { ...shell, age: shell.age + step };
    if (spec.accel) {
      const speed = Math.hypot(moved.vx, moved.vy, moved.vz) || 1;
      const gain = spec.accel * step;
      moved.vx += moved.vx / speed * gain;
      moved.vz += moved.vz / speed * gain;
      moved.vy += moved.vy / speed * gain;
    }
    moved.vy -= finite(spec.gravity) * step;
    moved.x += moved.vx * step; moved.y += moved.vy * step; moved.z += moved.vz * step;
    moved.travel = finite(shell.travel) + Math.hypot(moved.x - shell.x, moved.y - shell.y, moved.z - shell.z);
    if (![moved.x, moved.y, moved.z].every(Number.isFinite)) continue;
    const struck = vulnerable && hitsSelf(shell, moved, target);
    if (struck) {
      state.damage += damageOf(shell.weapon);
      state.weapon = shell.weapon;
    }
    if (struck || moved.y <= 0.25 || hitsAnyBuilding(shell, moved, buildings)) {
      blasts.push({ id: state.nextId++, x: moved.x, y: Math.max(0.3, moved.y), z: moved.z, age: 0, life: 0.9, size: spec.blast });
      continue;
    }
    if (moved.age < moved.life && (shell.weapon !== 'shotgun' || moved.travel <= spec.range)) state.shells.push(moved);
  }
  state.blasts = [...(previous.blasts || []), ...blasts]
    .map((blast) => ({ ...blast, age: blast.age + step }))
    .filter((blast) => blast.age < blast.life);
  return state;
}
