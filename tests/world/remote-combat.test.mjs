import test from 'node:test';
import assert from 'node:assert/strict';
import { BURST_MAX, createRemoteCombat, stepRemoteCombat } from '../../src/world/remoteCombat.js';
import { DAMAGE } from '../../src/world/health.js';
import { GROUND_GUNS, HULL_HEIGHT, hullBox } from '../../src/world/groundWeapons.js';
import { CAR_GROUND } from '../../src/world/carPhysics.js';
import { VEHICLE_KEYS } from '../../src/world/identity.js';
import { createArsenal, stepWeapons } from '../../src/world/weapons.js';
import { armamentOf } from '../../src/world/hardpoints.js';

/** 원점에서 -Z 를 보고 선 상대 전차다. shots 만 올리면 한 발 쏜 것이다. */
const tank = (shots) => ({ id: 'other', kind: 'car', key: 'tank', x: 0, y: 1.2, z: 0,
  heading: 0, pitch: 0, roll: 0, phase: 'drive', hull: 1, shots, rockets: 0, turret: 0, barrel: 0 });
const fighter = (shots, rockets, key = 'fighter') => ({ id: 'air', kind: 'flight', key, x: 0, y: 60, z: 0,
  heading: 0, pitch: 0, roll: 0, phase: 'airborne', hull: 1, shots, rockets, turret: 0, barrel: 0 });
/** -Z 쪽 20m 앞에 선 내 전차다. */
const selfTank = { kind: 'car', key: 'tank', x: 0, y: 1.2, z: -20, width: 3.6, depth: 7 };

function run(state, peers, { steps = 1, self = null, buildings = [], dt = 0.05 } = {}) {
  let next = state;
  for (let index = 0; index < steps; index += 1) next = stepRemoteCombat(next, { dt, peers, self, buildings });
  return next;
}

test('처음 본 상대의 누적 발사 수로는 탄막을 만들지 않는다', () => {
  const state = run(createRemoteCombat(), [tank(120)]);
  assert.equal(state.shells.length, 0);
  // 기준을 잡은 뒤 한 발 더 쏘면 그 한 발만 생긴다.
  const fired = run(state, [tank(121)]);
  assert.equal(fired.shells.length, 1);
  assert.equal(fired.shells[0].weapon, 'tank');
});

test('포탄은 포구에서 나가고 포 속도를 그대로 쓴다', () => {
  const state = run(run(createRemoteCombat(), [tank(0)]), [tank(1)]);
  const shell = state.shells[0];
  const spec = GROUND_GUNS.tank;
  // 포구는 차체보다 앞(-Z)이고 포탑 높이만큼 올라와 있다.
  assert.ok(shell.z < spec.turret[2] + spec.pivot[2] - spec.reach * 0.5, `포탄이 포구 앞에서 나오지 않았다: ${shell.z}`);
  assert.ok(shell.y > 1.2, '포탄이 차체 높이에서 나왔다');
  assert.ok(Math.abs(Math.hypot(shell.vx, shell.vy, shell.vz) - spec.speed) < 1);
});

test('한 번에 받아들이는 발사 수에 상한이 있다', () => {
  const state = run(run(createRemoteCombat(), [tank(0)]), [tank(99)]);
  assert.equal(state.shells.length, BURST_MAX);
});

test('내 전차에 닿으면 무기 피해량만큼 쌓인다', () => {
  let state = run(createRemoteCombat(), [tank(0)], { self: selfTank });
  state = stepRemoteCombat(state, { dt: 0.05, peers: [tank(1)], self: selfTank });
  let total = state.damage;
  for (let index = 0; index < 8 && state.shells.length; index += 1) {
    state = stepRemoteCombat(state, { dt: 0.05, peers: [tank(1)], self: selfTank });
    total += state.damage;
  }
  assert.equal(total, DAMAGE.tank);
  assert.equal(state.shells.length, 0);
});

test('세단과 오토바이, 도보는 전차포에 맞아도 피해가 없다', () => {
  for (const key of ['sedan', 'motorcycle']) {
    const self = { ...selfTank, key };
    let state = run(createRemoteCombat(), [tank(0)], { self });
    let total = 0;
    for (let index = 0; index < 10; index += 1) {
      state = stepRemoteCombat(state, { dt: 0.05, peers: [tank(1)], self });
      total += state.damage;
    }
    assert.equal(total, 0, `${key} 가 피해를 받았다`);
  }
  let walker = run(createRemoteCombat(), [tank(0)], { self: { kind: 'walk', key: 'walk', x: 0, y: 0, z: -20, width: 1, depth: 1 } });
  for (let index = 0; index < 10; index += 1) {
    walker = stepRemoteCombat(walker, { dt: 0.05, peers: [tank(1)], self: { kind: 'walk', key: 'walk', x: 0, y: 0, z: -20, width: 1, depth: 1 } });
    assert.equal(walker.damage, 0);
  }
});

test('전투기는 기관포와 미사일을 따로 센다', () => {
  const base = run(createRemoteCombat(), [fighter(0, 0)]);
  const state = run(base, [fighter(2, 1)]);
  const weapons = state.shells.map((shell) => shell.weapon).sort();
  assert.deepEqual(weapons, ['cannon', 'cannon', 'missile']);
});

test('상대 샷거너의 한 포신은 14펠릿으로 퍼지고 가까운 전탄 명중은 100.8 피해다', () => {
  const peer = fighter(0, 0, 'shotgun');
  const self = { kind: 'flight', key: 'interceptor', x: 0, y: 60, z: -20, radius: 7 };
  const projectiles = run(run(createRemoteCombat(), [peer]), [{ ...peer, shots: 1 }]);
  assert.equal(projectiles.shells.length, 14);
  let state = run(createRemoteCombat(), [peer], { self });
  state = run(state, [{ ...peer, shots: 1 }], { self });
  let total = state.damage;
  for (let frame = 0; frame < 3; frame += 1) {
    state = run(state, [{ ...peer, shots: 1 }], { self });
    total += state.damage;
  }
  assert.ok(Math.abs(total - 100.8) < 1e-9, `총 피해 ${total}`);
});

test('비행 중 샷거너의 로컬·원격 산탄 궤적이 일치한다', () => {
  const peer = { ...fighter(0, 0, 'shotgun'), speed: 80 };
  const local = stepWeapons(createArsenal('shotgun'), {
    dt: 0.05, pose: peer, fire: { cannon: true }, mounts: armamentOf('shotgun'), plane: 'shotgun',
  });
  const remote = run(run(createRemoteCombat(), [peer]), [{ ...peer, shots: 1 }]);
  assert.equal(local.projectiles.length, 14);
  assert.equal(remote.shells.length, 14);
  for (let pellet = 0; pellet < 14; pellet += 1) {
    const mine = local.projectiles[pellet], theirs = remote.shells[pellet];
    for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz']) {
      assert.ok(Math.abs(mine[field] - theirs[field]) < 1e-6, `${pellet}번 펠릿 ${field}`);
    }
  }
});

test('원격 요격기 기관포도 100m 수렴과 240m/s 탄속·낙차를 쓴다', () => {
  const peer = fighter(0, 0, 'interceptor');
  const base = run(createRemoteCombat(), [peer]);
  const fired = run(base, [{ ...peer, shots: 1 }]);
  const shell = fired.shells[0];
  assert.ok(shell.vx > 0, `좌현 포구의 탄이 중심으로 향하지 않음: ${shell.vx}`);
  assert.ok(Math.abs(Math.hypot(shell.vx, shell.vz) - 240) < 1, `탄속 ${Math.hypot(shell.vx, shell.vz)}`);
  assert.ok(shell.vy < -0.6, `수직 속도 ${shell.vy}`);
});

test('부서진 상대는 더 쏘지 않고 떠난 상대의 기준값은 사라진다', () => {
  const base = run(createRemoteCombat(), [tank(0)]);
  const crashed = run(base, [{ ...tank(9), phase: 'crashed' }]);
  assert.equal(crashed.shells.length, 0);
  const empty = run(crashed, []);
  assert.deepEqual(empty.fired, {});
  // 다시 들어오면 기준을 처음부터 잡는다.
  assert.equal(run(empty, [tank(500)]).shells.length, 0);
});

test('비정상 delta 와 좌표는 상태를 망가뜨리지 않는다', () => {
  const base = run(createRemoteCombat(), [tank(0)]);
  for (const bad of [NaN, Infinity, -1, 9]) {
    const state = stepRemoteCombat(base, { dt: bad, peers: [tank(1)], self: selfTank });
    assert.ok(state.shells.every((shell) => [shell.x, shell.y, shell.z].every(Number.isFinite)));
  }
  // 이상한 좌표는 0 으로 읽는다. 포탄을 만들더라도 NaN 이 퍼지지는 않는다.
  const broken = stepRemoteCombat(base, { dt: 0.05, peers: [{ ...tank(1), x: NaN, heading: NaN }], self: selfTank });
  assert.ok(broken.shells.every((shell) => [shell.x, shell.y, shell.z, shell.vx, shell.vy, shell.vz].every(Number.isFinite)));
  assert.equal(stepRemoteCombat(base, {}).shells.length, 0);
});

/** 세로 판정이다. 예전에는 pose 상자에 height 가 없어 남의 포탄이 내 차 위를 지나가도
 * 체력이 깎였다. hullBox 가 바닥과 전고를 채워 세 축을 모두 본다. */
test('내 차 위를 지나가는 포탄은 나를 맞히지 않는다', () => {
  // 하늘에서 내려다보며 쏘는 폭격기 대신, 내 차 200m 위를 수평으로 지나는 전차포를 만든다.
  const high = { ...tank(0), y: 201.2 };
  let state = run(createRemoteCombat(), [high], { self: selfTank });
  let total = 0;
  for (let index = 0; index < 12; index += 1) {
    state = stepRemoteCombat(state, { dt: 0.05, peers: [{ ...high, shots: 1 }], self: selfTank });
    total += state.damage;
  }
  assert.equal(total, 0, '200m 위를 지나는 탄에 맞았다');
  // 같은 높이에서 쏘면 그대로 맞는다. 세로만 보고 수평 판정을 잃지 않았다.
  let level = run(createRemoteCombat(), [tank(0)], { self: selfTank });
  let hit = 0;
  for (let index = 0; index < 12; index += 1) {
    level = stepRemoteCombat(level, { dt: 0.05, peers: [tank(1)], self: selfTank });
    hit += level.damage;
  }
  assert.equal(hit, DAMAGE.tank);
});

test('전고를 채운 상자가 차체를 땅에 붙여 둔다', () => {
  const box = hullBox({ kind: 'car', key: 'tank', x: 0, y: CAR_GROUND, z: 0, width: 3.6, depth: 7 });
  // 바닥은 도로 상판이고 지붕은 그 위 전고만큼이다. 차가 뜨거나 가라앉지 않는다.
  assert.ok(Math.abs(box.y - (CAR_GROUND - 0.9)) < 1e-9, `바닥 ${box.y}`);
  assert.equal(box.height, HULL_HEIGHT.tank);
  assert.ok(box.y + box.height > CAR_GROUND, '지붕이 차체 원점보다 높다');
  // 전고를 모르는 탈것(도보) 은 예전 상자 그대로다.
  const walker = { kind: 'walk', key: 'walk', x: 0, y: 0, z: 0, width: 1, depth: 1 };
  assert.equal(hullBox(walker), walker);
  // 모든 차종에 전고가 있다. 하나라도 빠지면 그 차만 세로를 보지 않는다.
  for (const key of VEHICLE_KEYS) assert.ok(HULL_HEIGHT[key] > 0, `${key} 전고가 없다`);
});

test('accepted remote hits retain shooter and victim life; previous shooter life shells expire', () => {
  const peer = shots => ({ ...tank(shots), life: 7 });
  const self = { ...selfTank, life: 22 };
  let state = run(createRemoteCombat(), [peer(0)], { self });
  const hits = [];
  for (let index = 0; index < 8; index++) {
    state = stepRemoteCombat(state, { dt: .05, peers: [peer(1)], self });
    hits.push(...state.hits);
  }
  assert.deepEqual(hits, [{ owner: 'other', life: 22, amount: DAMAGE.tank, weapon: 'tank' }]);
  const baseline = run(createRemoteCombat(), [peer(0)]);
  const firing = run(baseline, [peer(1)]);
  assert.ok(firing.shells.length > 0);
  assert.equal(run(firing, [{ ...peer(0), life: 8 }]).shells.length, 0);
  assert.equal(run(firing, []).shells.length, 0);
});
