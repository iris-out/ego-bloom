import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYE_HEIGHT, GRAVITY, JUMP_SPEED, MAX_HP, WALK_WEAPONS, aimVector, bearing, canAim, createWalkState,
  crosshairSpread, fireWeapon, leanOffset, selectWeapon, startReload, stepWalk, toggleTorch,
  viewAngles, walkFov, weaponSpec,
} from '../../src/world/walkPhysics.js';
import { WORLD } from '../../shared/worldLayout.js';
import { cityExtentForCount, createUrbanPlan } from '../../shared/urbanPlan.js';
import { riverCenter } from '../../shared/river.js';
import { airportBoxes, walkSpawn } from '../../src/world/models/airportLayout.js';
import { hitsAnyBuilding } from '../../src/world/solidIndex.js';

const EXTENT = 300;
/** 강 판정은 실제 도시 크기에서만 맞다. 살아 있는 규격에서 끌어온다. */
const CITY = cityExtentForCount(1000);
/** 출발 지점은 공항 터미널 앞이고 도시(서쪽)를 본다. 아래 검사들은 기수 0(-Z) 기준으로
 * 앞과 옆을 재므로 자리만 두고 기수를 0 으로 돌린다. 북쪽으로 300 까지 공항 땅이다. */
const spawn = (extent = EXTENT) => ({ ...createWalkState(extent), heading: 0 });
const walk = (state, input, frames = 60, buildings = []) => {
  let next = state;
  for (let i = 0; i < frames; i++) next = stepWalk(next, input, 1 / 60, EXTENT, buildings);
  return next;
};
/** 쿨다운과 재장전을 흘려보낸다. stepWalk 이 한 번에 0.05 까지만 받는다. */
const wait = (state, seconds) => walk(state, {}, Math.ceil(seconds * 60));

test('앞으로 걸으면 기수 방향으로 가고 달리면 더 멀리 간다', () => {
  const home = spawn();
  const walked = walk(home, { forward: 1 }, 60);
  const ran = walk(home, { forward: 1, run: true }, 60);
  assert.ok(walked.z < home.z - 3, `걸은 거리 ${home.z - walked.z}`);
  assert.ok(home.z - ran.z > home.z - walked.z, '달리면 더 간다');
  assert.equal(walked.x, home.x);
  assert.equal(walked.y, EYE_HEIGHT);
});

test('시선은 좌우로 돌고 위아래는 한계가 있다', () => {
  const turned = stepWalk(spawn(), { lookYaw: 0.4, lookPitch: 9 }, 1 / 60, EXTENT);
  assert.ok(Math.abs(turned.heading + 0.4) < 1e-9);
  assert.equal(turned.pitch, -1.2);
  const aim = aimVector({ heading: 0, pitch: 0 });
  assert.ok(Math.abs(aim.z + 1) < 1e-9 && Math.abs(aim.x) < 1e-9);
});

test('건물은 통과하지 못하고 강에 들어가면 빠진다', () => {
  const home = spawn();
  const wall = { x: home.x, z: home.z - 6, height: 20, width: 12, depth: 6 };
  const blocked = walk(home, { forward: 1 }, 120, [wall]);
  assert.ok(blocked.z > wall.z + 3, `벽 앞에서 멈춘다 ${blocked.z}`);

  // 작은 extent 로는 강도 바다로 잡힌다. 다리에서 떨어진 강 위를 고른다.
  const plan = createUrbanPlan(CITY);
  let offBridge = 0;
  for (let x = 0; x < CITY && plan.bridges.some((bridge) => Math.abs(offBridge - bridge.x) <= 60); x += 10) offBridge = x;
  let soaked = stepWalk({ ...createWalkState(CITY), x: offBridge, z: riverCenter(CITY, offBridge) }, { forward: 1 }, 1 / 60, CITY);
  assert.equal(soaked.phase, 'drowned');
  assert.match(soaked.message, /물/);
  for (let i = 0; i < 200; i++) soaked = stepWalk(soaked, {}, 1 / 60, CITY);
  assert.equal(soaked.phase, 'walk');
  // 출발 지점은 강 위치에서 계산하므로 도시 크기마다 다르다. home 은 작은 extent 것이다.
  assert.equal(soaked.z, createWalkState(CITY).z);
});

test('무기마다 연사 간격과 탄창을 지키고 다 쓰면 재장전에 들어간다', () => {
  const spec = weaponSpec('pistol');
  let state = createWalkState(EXTENT);
  const first = fireWeapon(state, {});
  state = first.state;
  assert.equal(state.ammo.pistol.mag, spec.mag - 1);
  assert.equal(fireWeapon(state, {}).state.ammo.pistol.mag, spec.mag - 1, '쿨다운 중에는 나가지 않는다');
  for (let i = 1; i < spec.mag; i++) state = fireWeapon(wait(state, 0.3), {}).state;
  assert.equal(state.ammo.pistol.mag, 0);
  state = fireWeapon(wait(state, 0.3), {}).state;
  assert.ok(state.reloading > 0, '빈 탄창이면 스스로 재장전한다');
  state = wait(state, spec.reload + 0.2);
  assert.equal(state.ammo.pistol.mag, spec.mag);
  assert.equal(state.ammo.pistol.reserve, spec.reserve - spec.mag);
});

test('조준선 위의 AI 차량만 맞고 벽 뒤나 사거리 밖은 맞지 않는다', () => {
  const home = spawn();
  const ahead = { index: 7, x: home.x, z: home.z - 20, width: 2.2, depth: 4.3 };
  assert.equal(fireWeapon(home, { targets: [ahead] }).hit?.index, 7);

  const beside = { index: 8, x: home.x + 24, z: home.z - 20, width: 2.2, depth: 4.3 };
  assert.equal(fireWeapon(home, { targets: [beside] }).hit, null);

  const wall = { x: home.x, z: home.z - 10, height: 20, width: 14, depth: 6 };
  assert.equal(fireWeapon(home, { targets: [ahead], buildings: [wall] }).hit, null);

  const faraway = { index: 9, x: home.x, z: home.z - 200, width: 2.2, depth: 4.3 };
  assert.equal(fireWeapon(home, { targets: [faraway] }).hit, null, '권총 사거리 밖이다');
  // 무기를 바꾸면 잠깐 못 쏜다. 그 시간을 흘려보낸 뒤 쏜다.
  assert.equal(fireWeapon(wait(selectWeapon(home, 'sniper'), 0.4), { targets: [faraway] }).hit?.index, 9, '저격총은 닿는다');
});

test('주먹은 코앞만 닿고 탄약을 쓰지 않는다', () => {
  const home = wait(selectWeapon(createWalkState(EXTENT), 'fist'), 0.4);
  const close = { index: 1, x: home.x, z: home.z - 2, width: 2.2, depth: 4.3 };
  const far = { index: 2, x: home.x, z: home.z - 9, width: 2.2, depth: 4.3 };
  assert.equal(fireWeapon(home, { targets: [close] }).hit?.index, 1);
  assert.equal(fireWeapon(wait(home, 1), { targets: [far] }).hit, null, '주먹 사거리 밖이다');
  assert.equal(fireWeapon(home, { targets: [close] }).state.ammo.fist.mag, 0);
});

test('반동은 쏘면 커지고 시간이 지나면 가라앉는다', () => {
  const fired = fireWeapon(wait(selectWeapon(createWalkState(EXTENT), 'sniper'), 0.4), {}).state;
  assert.ok(fired.recoil > 0.3, `반동 ${fired.recoil}`);
  assert.ok(wait(fired, 1.2).recoil < fired.recoil);
  assert.equal(wait(fired, 4).recoil, 0);
});

test('무기 교체와 수동 재장전, 비정상 입력을 견딘다', () => {
  const home = createWalkState(EXTENT);
  assert.equal(selectWeapon(home, 'ufo'), home);
  assert.equal(selectWeapon(home, 'smg').weapon, 'smg');
  assert.equal(startReload(home), home, '가득 찬 탄창은 재장전하지 않는다');
  const spent = { ...home, ammo: { ...home.ammo, pistol: { mag: 3, reserve: 20 } } };
  assert.ok(startReload(spent).reloading > 0);
  for (const dt of [NaN, Infinity, -1, 100, 0.016]) {
    const state = stepWalk(home, { forward: NaN, strafe: Infinity, lookYaw: NaN }, dt, EXTENT);
    for (const field of ['x', 'y', 'z', 'heading', 'pitch', 'recoil']) assert.ok(Number.isFinite(state[field]), field);
  }
  assert.equal(Object.keys(WALK_WEAPONS).length, 5);
});

test('정조준은 걸음을 늦추고 조준선을 좁힌다. 주먹은 겨누지 못한다', () => {
  const home = spawn();
  const hip = walk(home, { forward: 1 }, 60);
  const ads = walk(home, { forward: 1, aim: true }, 60);
  assert.ok(home.z - ads.z < (home.z - hip.z) * 0.6, `정조준 이동 ${home.z - ads.z}`);
  assert.equal(ads.aiming, true);
  assert.ok(crosshairSpread(ads) < crosshairSpread(hip), '조준선이 좁아진다');

  assert.equal(canAim('fist'), false);
  assert.equal(walk(selectWeapon(home, 'fist'), { aim: true }, 2).aiming, false);
  assert.ok(walkFov('sniper', true) < walkFov('sniper', false), '저격 조준경이 화각을 당긴다');
  assert.equal(walkFov('fist', true), walkFov('fist', false), '주먹은 배율이 없다');
});

test('한 발마다 총구가 올라가고 놓으면 제자리로 돌아온다', () => {
  const ready = wait(selectWeapon(createWalkState(EXTENT), 'sniper'), 0.4);
  const kicked = fireWeapon(ready, { seed: 1 }).state;
  assert.ok(kicked.recoilPitch > 0.05, `총구 상승 ${kicked.recoilPitch}`);
  assert.ok(viewAngles(kicked).pitch > viewAngles(ready).pitch, '조준각이 같이 올라간다');
  assert.ok(wait(kicked, 1.5).recoilPitch < kicked.recoilPitch * 0.2, '시간이 지나면 잡힌다');

  // 정조준은 반동을 줄인다. 같은 무기, 같은 순번으로 비교한다.
  const aimed = fireWeapon({ ...ready, aiming: true }, { seed: 1 }).state;
  assert.ok(aimed.recoilPitch < kicked.recoilPitch, `정조준 반동 ${aimed.recoilPitch}`);
});

test('지구력이 바닥나면 걷기로 떨어지고 멈춰 있으면 다시 찬다', () => {
  const home = spawn();
  const sprint = { forward: 1, run: true };
  // 지구력이 빌 때까지 달린다. 비는 순간 달리기가 끊긴다.
  let runner = home;
  for (let i = 0; i < 60 * 20 && runner.stamina > 0; i++) runner = stepWalk(runner, sprint, 1 / 60, EXTENT);
  assert.equal(runner.stamina, 0);
  assert.equal(stepWalk(runner, sprint, 1 / 60, EXTENT).running, false, '지구력이 비면 달리지 못한다');

  const tired = walk(runner, sprint, 30);
  assert.ok(tired.z - runner.z < 0, '지쳐도 걷기는 한다');
  const rested = walk(runner, {}, 60 * 6);
  assert.ok(rested.stamina > 0.5, `회복 ${rested.stamina}`);
  assert.ok(walk(rested, sprint, 30).running, '회복하면 다시 달린다');
});

test('Q/E 피킹은 눈을 옆으로 밀고 벽에 막힌다', () => {
  const home = spawn();
  const right = walk(home, { lean: 1 }, 60);
  assert.ok(right.lean > 0.9, `피킹 ${right.lean}`);
  const peek = leanOffset(right);
  // 기수 0 은 -Z 를 본다. 오른쪽 피킹은 +X 로 밀리고 화면은 반대로 기운다.
  assert.ok(peek.x > 0.5 && Math.abs(peek.z) < 1e-6, `눈 위치 ${peek.x}`);
  assert.ok(peek.roll < 0, '오른쪽으로 기울면 화면은 왼쪽으로 돈다');
  assert.equal(leanOffset({ heading: 0, lean: 0 }).x, 0);

  const wall = { x: home.x + 1, z: home.z, height: 20, width: 1.2, depth: 6 };
  assert.equal(walk(home, { lean: 1 }, 60, [wall]).lean, 0, '벽 쪽으로는 내밀지 못한다');
});

test('차에 치이면 체력이 깎이고 쓰러지면 출발 지점으로 돌아온다', () => {
  const home = spawn();
  const car = { index: 3, x: home.x, z: home.z, width: 2.2, depth: 4.3 };
  // 스치듯 한 프레임만 닿아도 충격 피해로 체력이 절반 가까이 날아간다.
  const hit = walk(home, { threats: [car] }, 1);
  assert.ok(hit.hp < MAX_HP * 0.6 && hit.hp > 0, `남은 체력 ${hit.hp}`);
  assert.ok(hit.hurt > 0 && Number.isFinite(hit.hurtFrom));
  // 충격은 닿는 동안 한 번뿐이다. 계속 깔려 있으면 그 뒤로는 지속 피해만 쌓인다.
  const pinned = walk(hit, { threats: [car] }, 1);
  assert.ok(MAX_HP - hit.hp > hit.hp - pinned.hp, '두 번째 프레임에도 충격이 또 들어갔다');
  // 반 초를 깔려 있으면 죽는다.
  assert.equal(walk(home, { threats: [car] }, 30).phase, 'down');

  // 맞지 않으면 잠시 뒤 스스로 회복한다.
  assert.equal(walk(hit, {}, 60 * 2).hp, hit.hp, '맞은 직후에는 차지 않는다');
  assert.ok(walk(hit, {}, 60 * 8).hp > hit.hp, '시간이 지나면 회복한다');

  let down = { ...home, hp: 12 };
  for (let i = 0; i < 30; i++) down = stepWalk(down, { threats: [car] }, 1 / 60, EXTENT);
  assert.equal(down.phase, 'down');
  assert.match(down.message, /쓰러졌다/);
  for (let i = 0; i < 60 * 4; i++) down = stepWalk(down, {}, 1 / 60, EXTENT);
  assert.equal(down.phase, 'walk');
  assert.equal(down.hp, MAX_HP);
  assert.equal(down.z, home.z);
});

test('출발 지점은 공항 터미널 앞 뭍이다', () => {
  const home = createWalkState(CITY);
  assert.ok(home.x > CITY, '공항 쪽이다');
  assert.equal(home.heading, Math.PI / 2);
  assert.equal(stepWalk(home, {}, 1 / 60, CITY).phase, 'walk', '출발 지점에서 빠진다');
});

test('도보 출발점은 어떤 extent 에서도 공항 충돌 상자 밖이다', () => {
  // WP9 회귀 검사다. 예전 값은 canopy 상자 안이라 사방이 막혀 있었다.
  for (const extent of [180, 1857, 2164]) {
    const spawn = walkSpawn(extent);
    const point = { x: spawn.x, y: EYE_HEIGHT, z: spawn.z };
    assert.ok(!hitsAnyBuilding(point, point, airportBoxes(extent)), `출발점 (${spawn.x}, ${spawn.z}) 이 상자 안이다`);
  }
});

test('출발 직후 공항 건물 사이에서도 실제로 앞으로 나아간다', () => {
  const extent = 1857;
  const buildings = airportBoxes(extent);
  let state = createWalkState(extent);
  const start = { x: state.x, z: state.z };
  for (let i = 0; i < 20; i++) state = stepWalk(state, { forward: 1 }, 0.05, extent, buildings);
  const moved = Math.hypot(state.x - start.x, state.z - start.z);
  assert.ok(moved >= 2, `1초 동안 ${moved.toFixed(2)}m 만 갔다`);
});

test('벽을 비스듬히 스치면 완전히 멈추지 않고 미끄러진다', () => {
  const home = spawn(); // heading 0, -Z 를 본다
  // 오른쪽 앞으로 긴 벽을 세운다. strafe(+x) 는 벽에 걸리지만 forward(-z) 는 옆으로 흐른다.
  const wall = { x: home.x + 10, z: home.z - 15, height: 20, width: 4, depth: 80 };
  let state = home;
  const at = {};
  for (let i = 1; i <= 300; i++) {
    state = stepWalk(state, { forward: 1, strafe: 0.3 }, 1 / 30, EXTENT, [wall]);
    if (i === 100 || i === 200 || i === 300) at[i] = state.z;
  }
  assert.ok(at[200] < at[100] - 1, '벽에 닿은 뒤 100~200 구간에서도 앞으로 갔다');
  assert.ok(at[300] < at[200] - 1, '200~300 구간에서도 계속 갔다');
  assert.ok(state.x < wall.x, '벽 안으로 파고들지 않는다');
});

test('상자 안에 강제로 놓여도 걸어서 빠져나올 수 있다', () => {
  // 상자 몸통(반폭 5)을 벗어난 뒤에는 보통 벽처럼 margin 에 다시 걸린다. 여기서는
  // 몸통 밖으로 실제 빠져나왔는지만 본다(margin 경계에 딱 붙는 값은 프레임 양자화로 흔들린다).
  // 출발 지점(뭍) 을 그대로 써서 물에 빠지는 판정이 섞이지 않게 한다.
  const home = spawn();
  const wall = { x: home.x, z: home.z, height: 20, width: 10, depth: 10 };
  const escaped = walk(home, { forward: 1 }, 120, [wall]);
  const moved = Math.hypot(escaped.x - home.x, escaped.z - home.z);
  assert.ok(moved > 3, `갇힌 자리에서 ${moved.toFixed(2)}m 밖에 움직이지 못했다`);
});

test('피격 방위는 시선 기준이다', () => {
  // 기수 0 은 -Z 를 본다. 정면은 0, 오른쪽은 +PI/2, 등 뒤는 ±PI 다.
  assert.ok(Math.abs(bearing(0, 0, -5)) < 1e-9);
  assert.ok(Math.abs(bearing(0, 5, 0) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(Math.abs(bearing(0, 0, 5)) - Math.PI) < 1e-9);
  assert.ok(Number.isFinite(bearing(NaN, NaN, NaN)));
});

test('Space 로 뛰어올랐다 내려오고 공중에서는 조준이 흔들린다', () => {
  const home = spawn();
  const jumped = stepWalk(home, { jump: true }, 1 / 60, EXTENT);
  assert.equal(jumped.airborne, true);
  assert.ok(jumped.y > EYE_HEIGHT, `이륙 높이 ${jumped.y}`);

  // 최고점은 v*v/(2g) 언저리다. 적분 간격 때문에 정확히 같지는 않다.
  let air = jumped, peak = jumped.y;
  for (let i = 0; i < 60 * 2 && air.airborne; i++) {
    air = stepWalk(air, {}, 1 / 60, EXTENT);
    peak = Math.max(peak, air.y);
  }
  const ideal = EYE_HEIGHT + (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
  assert.ok(Math.abs(peak - ideal) < 0.2, `최고점 ${peak}, 이론값 ${ideal}`);
  assert.equal(air.airborne, false, '다시 땅에 선다');
  assert.equal(air.y, EYE_HEIGHT);

  assert.ok(crosshairSpread({ ...home, airborne: true }) > crosshairSpread(home), '공중에서는 조준선이 벌어진다');
  // 공중에서 다시 차오르지 않는다.
  assert.ok(stepWalk(jumped, { jump: true }, 1 / 60, EXTENT).vy < jumped.vy);
});

test('산탄총은 pellet 9개를 결정적인 패턴으로 쏘고 퍼짐이 pelletSpread 안이다', () => {
  const spec = weaponSpec('shotgun');
  assert.equal(spec.pellets, 9);
  const home = wait(selectWeapon(spawn(), 'shotgun'), 0.4);
  // hit 은 맞은 목표 자체를 돌려줄 뿐 pellet 개별 탄착점은 담지 않으므로, 표적 폭을 바꿔가며
  // 몇 개가 맞는지로 퍼짐을 잰다. 표적은 정면(사거리만큼 -Z) 에 둔다.
  const wide = { index: 1, x: home.x, z: home.z - spec.range, width: 40, depth: 6 };
  const shot = fireWeapon(home, { targets: [wide], seed: 3 });
  assert.equal(shot.hits.length, spec.pellets, 'pellet 전부가 넉넉한 폭의 표적을 맞힌다');
  assert.equal(shot.hit, shot.hits[0]);

  // 같은 seed 는 같은 명중 수를 낸다. 난수가 아니라 결정적이다.
  const repeat = fireWeapon(home, { targets: [wide], seed: 3 });
  assert.equal(repeat.hits.length, shot.hits.length);

  // 좁은 표적은 pellet 이 퍼져 있어야 전부 맞히지 못한다.
  const narrow = { index: 2, x: home.x, z: home.z - spec.range, width: 1, depth: 6 };
  const narrowShot = fireWeapon(home, { targets: [narrow], seed: 3 });
  assert.ok(narrowShot.hits.length < spec.pellets, `좁은 표적 명중 ${narrowShot.hits.length}`);

  // 퍼짐은 pelletSpread 각도가 만드는 폭을 넘지 않는다. 그 폭 밖의 좁은 표적은 하나도 맞지 않는다.
  const maxOffset = spec.range * Math.sin(spec.pelletSpread);
  const beyond = { index: 3, x: home.x - maxOffset - 4, z: home.z - spec.range, width: 2, depth: 6 };
  assert.equal(fireWeapon(home, { targets: [beyond], seed: 3 }).hits.length, 0, 'pelletSpread 밖은 맞지 않는다');
});

test('산탄총은 사거리를 넘으면 맞지 않는다', () => {
  const spec = weaponSpec('shotgun');
  const home = wait(selectWeapon(spawn(), 'shotgun'), 0.4);
  const far = { index: 5, x: home.x, z: home.z - (spec.range + 20), width: 40, depth: 6 };
  const shot = fireWeapon(home, { targets: [far], seed: 4 });
  assert.equal(shot.hits.length, 0, '사거리 밖이다');
  assert.equal(shot.hit, null);
});

test('관형 탄창은 한 발씩 채우고 사격이 재장전을 끊는다', () => {
  const spec = weaponSpec('shotgun');
  let state = selectWeapon(createWalkState(EXTENT), 'shotgun');
  state = startReload({ ...state, ammo: { ...state.ammo, shotgun: { mag: 2, reserve: 10 } } });
  assert.ok(state.reloading > 0);

  state = wait(state, spec.reload + 0.02);
  assert.equal(state.ammo.shotgun.mag, 3, '한 주기에 한 발만 채운다');
  assert.equal(state.ammo.shotgun.reserve, 9);
  assert.ok(state.reloading > 0, '탄창이 덜 찼으면 이어서 채운다');

  // 재장전 중에 쏘면 약실의 한 발이 나가고 장전이 끊긴다.
  const shot = fireWeapon(state, { targets: [], seed: 1 });
  assert.equal(shot.state.reloading, 0, '사격이 재장전을 끊는다');
  assert.equal(shot.state.ammo.shotgun.mag, 2, '쏜 발만큼 준다');

  // 끊지 않고 계속 두면 다 찰 때까지 한 발씩 이어 채운다.
  let filling = state;
  for (let i = 0; i < spec.mag; i++) filling = wait(filling, spec.reload + 0.02);
  assert.equal(filling.ammo.shotgun.mag, spec.mag);
  assert.equal(filling.reloading, 0, '탄창이 차면 멈춘다');
});

test('손전등은 누를 때마다 켜지고 꺼지며 무기를 바꿔도 남는다', () => {
  const home = createWalkState(EXTENT);
  assert.equal(home.torch, false);
  const on = toggleTorch(home);
  assert.equal(on.torch, true);
  assert.equal(toggleTorch(on).torch, false);
  assert.equal(selectWeapon(on, 'smg').torch, true);
  assert.equal(walk(on, { forward: 1 }, 30).torch, true);
});
