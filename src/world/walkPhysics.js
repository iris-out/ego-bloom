import { hitsAnyBuilding } from './solidIndex.js';
import { hitsVehicle, inWater, slideAlongWall } from './carPhysics.js';
import { walkSpawn } from './models/airportLayout.js';
import { cockpitFov } from './eyePoints.js';
import { MASS_LOT_RATIO } from './cityModels.js';

/** 도보 모드의 이동과 사격. 순수 함수이며 Three, React, 네트워크에 의존하지 않는다.
 * 총알은 hitscan 이다. 사람 모델이 없으므로 사람은 쏘지 못하고 AI 차량만 맞는다.
 * 체력을 깎는 것도 AI 차량뿐이다. 차도에 서 있으면 치인다.
 */
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));

export const EYE_HEIGHT = 1.68;
export const WALK_SPEED = 4.4;
export const RUN_SPEED = 8.2;

/** 정조준은 걸음을 늦추고 산포와 반동을 줄인다. 배수이며 1 이 정조준하지 않은 값이다. */
export const ADS_SPEED = 0.45, ADS_SPREAD = 0.3, ADS_RECOIL = 0.6;

/** 체력이다. 맞은 뒤 REGEN_DELAY 가 지나면 초당 최대치의 REGEN_RATE 만큼 차오른다. */
export const MAX_HP = 200, REGEN_DELAY = 4, REGEN_RATE = 0.22;
/** 차에 깔려 있는 동안의 초당 피해다. 한 번 스치는 정도로는 죽지 않는다. */
export const CAR_DPS = 260;
/** 차가 몸에 닿는 첫 순간에 한 번 들어가는 충격이다. 차에 치이는 것은 계속 타는 불이
 * 아니라 한 번의 충돌이라 지속 피해만으로는 스쳐도 안 아프다. 최대 체력의 절반 가까이
 * 깎아 한 번 치이면 반드시 위험해지게 한다. */
export const CAR_IMPACT = 85;
/** 보행자 충돌 상자는 발바닥부터 눈 위 머리까지다. */
const WALK_RADIUS = 0.42, WALK_HEADROOM = 0.22, LEGACY_CAR_HEIGHT = 2;
/** 쓰러진 뒤 출발 지점으로 돌아가기까지의 시간이다. 익사와 같다. */
export const DOWN_TIME = 3;

/** 달리기 지구력이다. 0 에서 1 이며 비면 걷기로 떨어진다.
 * 가득 찬 상태에서 1/DRAIN 초 동안 달린다. 멈추고 STAMINA_DELAY 가 지나야 다시 찬다. */
export const STAMINA_DRAIN = 1 / 6.5, STAMINA_RECOVER = 1 / 9, STAMINA_DELAY = 0.7;
/** 지구력이 바닥나면 이 값을 넘길 때까지 다시 달리지 못한다. 한 걸음씩 끊기는 것을 막는다. */
export const SPRINT_FLOOR = 0.18;

/** 피킹이다. 눈을 옆으로 이 거리만큼 밀고 화면을 이 각도만큼 기울인다. */
export const LEAN_OFFSET = 0.62, LEAN_ROLL = 0.22, LEAN_RATE = 7;

/** 점프다. JUMP_SPEED 로 차올라 GRAVITY 로 떨어진다. 최고 높이는 v*v/(2g) 다. */
export const JUMP_SPEED = 6, GRAVITY = 18;

/** 반동이 제자리로 돌아오는 속도다. 초당 감쇠 계수이며 클수록 빨리 잡힌다. */
export const RECOIL_RECOVER = 5.5;

/** rpm 은 분당 발사 수, spread 는 라디안 오차, recoil 은 한 발당 조준 흔들림이다.
 * kick 은 한 발이 총구를 들어 올리는 각(라디안), sway 는 좌우로 튀는 각이다.
 * ads 는 정조준 화각(도) 이고, mag 이 0 이면 탄창 개념이 없다. range 를 넘는 목표는 맞지 않는다.
 * hits 는 AI 차량 한 대를 부수는 데 맞아야 하는 탄수다. 명중할 때마다 1/hits 만큼 깎는다.
 * pellets, pelletSpread 가 있으면 한 발에 여러 pellet 이 각자 독립으로 맞는 산탄총이다.
 * tube 가 참이면 관형 탄창이라 재장전이 한 번에 한 발씩만 채워지고 사격으로 끊을 수 있다.
 */
export const WALK_WEAPONS = {
  fist: { ko: '주먹', rpm: 70, mag: 0, reserve: 0, spread: 0, recoil: 0.012, range: 2.6, reload: 0, kick: 0, sway: 0, ads: 0, hits: 6 },
  pistol: { ko: '권총', rpm: 260, mag: 12, reserve: 72, spread: 0.012, recoil: 0.035, range: 120, reload: 1.4, kick: 0.02, sway: 0.008, ads: 46, hits: 10 },
  smg: { ko: '기관총', rpm: 720, mag: 30, reserve: 210, spread: 0.03, recoil: 0.022, range: 90, reload: 2.1, kick: 0.014, sway: 0.011, ads: 52, hits: 15 },
  sniper: { ko: '저격총', rpm: 45, mag: 5, reserve: 25, spread: 0.001, recoil: 0.12, range: 420, reload: 2.8, kick: 0.09, sway: 0.012, ads: 14, hits: 4 },
  shotgun: { ko: '산탄총', rpm: 70, mag: 6, reserve: 24, spread: 0.02, pellets: 9, pelletSpread: 0.16,
    recoil: 0.06, range: 45, reload: 0.5, kick: 0.055, sway: 0.02, ads: 64, hits: 27, tube: true },
};
export const WEAPON_KEYS = Object.keys(WALK_WEAPONS);

export function weaponSpec(key) {
  return WALK_WEAPONS[key] || WALK_WEAPONS.fist;
}

/** 차량 한 대를 부수는 데 필요한 탄수다. 명중 한 발의 피해량은 이 값의 역수다. */
export function vehicleHits(weapon) {
  return weaponSpec(weapon).hits || 10;
}

/** 도보 화각이다. 기본값은 다른 1인칭과 같은 표에서 나오고 정조준 배율만 무기가 정한다. */
export function walkFov(weapon, aiming = false) {
  const base = cockpitFov('walk');
  const spec = weaponSpec(weapon);
  return aiming && spec.ads ? spec.ads : base;
}

/** 정조준할 수 있는 무기인지 본다. 주먹은 겨눌 것이 없다. */
export function canAim(weapon) {
  return weaponSpec(weapon).ads > 0;
}

export function createWalkState(extent = 180) {
  // 동쪽 공항 터미널 앞 apron 이다. 공항로 밖이라 차에 치이지 않는다.
  const spawn = walkSpawn(finite(extent, 180));
  return { x: spawn.x, y: EYE_HEIGHT, z: spawn.z, heading: spawn.heading, pitch: 0, weapon: 'pistol',
    ammo: Object.fromEntries(WEAPON_KEYS.map((key) => [key, { mag: WALK_WEAPONS[key].mag, reserve: WALK_WEAPONS[key].reserve }])),
    cooldown: 0, reloading: 0, reloadFrom: 0, reloadTicks: 0, recoil: 0, recoilPitch: 0, recoilYaw: 0,
    moving: 0, running: false, aiming: false, lean: 0, vy: 0, airborne: false, torch: false,
    hp: MAX_HP, maxHp: MAX_HP, regenDelay: 0, hurt: 0, hurtFrom: 0, struck: false,
    stamina: 1, staminaDelay: 0,
    phase: 'walk', message: '', extent: finite(extent, 180) };
}

/** 시선 방향 단위 벡터다. heading 0 이 -Z 이며 차량, 비행기와 같은 규약이다. */
export function aimVector(state) {
  const cp = Math.cos(finite(state.pitch));
  return { x: -Math.sin(finite(state.heading)) * cp, y: Math.sin(finite(state.pitch)), z: -Math.cos(finite(state.heading)) * cp };
}

/** 반동까지 더한 실제 조준 방향이다. 총알과 카메라가 같은 각을 쓴다. */
export function viewAngles(state) {
  return { heading: finite(state.heading) + finite(state.recoilYaw), pitch: clamp(finite(state.pitch) + finite(state.recoilPitch), -1.4, 1.4) };
}

/** 피킹으로 눈이 옆으로 밀린 양이다. roll 은 화면 기울기(라디안) 다. */
export function leanOffset(state) {
  const lean = clamp(state?.lean, -1, 1);
  const heading = finite(state?.heading);
  // 기수 0 이 -Z 를 볼 때 오른쪽은 +X 다. 차량, 비행기와 같은 규약이다.
  return { x: Math.cos(heading) * lean * LEAN_OFFSET, z: -Math.sin(heading) * lean * LEAN_OFFSET, roll: -lean * LEAN_ROLL };
}

/** 조준선이 벌어진 정도다. 0 이 가장 좁고 1 이 가장 넓다.
 * 뛰면 벌어지고 정조준하면 좁아진다. 화면의 조준선과 실제 산포가 같은 값을 읽는다. */
export function crosshairSpread(state) {
  const spec = weaponSpec(state?.weapon);
  const base = Math.min(1, spec.spread / 0.03);
  const move = clamp(state?.moving, 0, 1) * (state?.running ? 0.55 : 0.3);
  const kick = clamp(state?.recoil, 0, 1) * 0.6;
  // 공중에서는 조준이 흔들린다. 뛰면서 쏘면 잘 맞지 않는다.
  const air = state?.airborne ? 0.45 : 0;
  const spread = base * 0.35 + move + kick + air;
  return clamp(state?.aiming ? spread * ADS_SPREAD : spread, 0, 1);
}

/** 재장전 진행도다. 0 이 시작, 1 이 완료이며 게이지가 이 값을 읽는다. */
export function reloadProgress(state) {
  if (!state || state.reloading <= 0 || !state.reloadFrom) return 0;
  return clamp(1 - state.reloading / state.reloadFrom, 0, 1);
}

/** 시선을 기준으로 한 방위각이다. 0 이 정면, 양수가 오른쪽, ±PI 가 등 뒤다.
 * 기수 0 이 -Z 를 보고 오른쪽이 +X 인 규약을 따른다. */
export function bearing(heading, dx, dz) {
  const sin = Math.sin(finite(heading)), cos = Math.cos(finite(heading));
  const right = finite(dx) * cos - finite(dz) * sin;
  const front = -finite(dx) * sin - finite(dz) * cos;
  return Math.atan2(right, front);
}

/** margin 없이 건물 몸통 자체의 반폭이다. hitsAnyBuilding 이 쓰는 buildingHalf 는 margin(기본 3)을
 * 더해 사람을 벽에서 3m 밖부터 막는데, 갇힘 판정에 그 여유까지 "몸속"으로 치면 벽에 살짝
 * 닿기만 해도 통과해 버린다. 진짜로 몸통 안에 있을 때만 막지 않아야 한다. */
function solidHalf(building, axis) {
  const given = axis === 'x' ? building.width : building.depth;
  if (Number.isFinite(given) && given > 0) return given / 2;
  const lot = Number.isFinite(building.lot) && building.lot > 0 ? building.lot * MASS_LOT_RATIO : 20;
  return lot / 2;
}

/** 점이 상자 중 하나의 몸통 안에 있는지 본다. hitsAnyBuilding 은 선분이라 갇힌 사람이 조금만
 * 움직여도 전체 이동이 상자 안에 머물러 계속 막힌 것으로 나온다. 탈출 규칙에만 쓴다. */
function insideAnyBuilding(point, buildings) {
  if (!buildings?.length || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  return buildings.some((building) => {
    if (!Number.isFinite(building.x) || !Number.isFinite(building.z) || !Number.isFinite(building.height)) return false;
    const turn = finite(building.rotation);
    let dx = point.x - building.x, dz = point.z - building.z;
    if (turn) {
      const cos = Math.cos(turn), sin = Math.sin(turn);
      const rx = cos * dx - sin * dz;
      dz = sin * dx + cos * dz;
      dx = rx;
    }
    const y = finite(point.y, EYE_HEIGHT);
    return Math.abs(dx) <= solidHalf(building, 'x') && Math.abs(dz) <= solidHalf(building, 'z')
      && y >= -2 && y <= building.height + 4;
  });
}

/** 차에 깔렸는지 본다. 사람은 상자 하나로 본다. */
function runOver(state, threats) {
  const feet = finite(state.y, EYE_HEIGHT) - EYE_HEIGHT;
  const head = finite(state.y, EYE_HEIGHT) + WALK_HEADROOM;
  for (const box of threats) {
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.z)) continue;
    if (Math.abs(box.x - state.x) > (finite(box.width, 2.2) / 2 + WALK_RADIUS)) continue;
    if (Math.abs(box.z - state.z) > (finite(box.depth, 4.3) / 2 + WALK_RADIUS)) continue;
    // traffic 상자의 y는 바닥이다. 높이가 없던 예전 호출부는 지상 차량으로 다룬다.
    const bottom = finite(box.y);
    const top = bottom + Math.max(0, finite(box.height, LEGACY_CAR_HEIGHT));
    if (top < feet || bottom > head) continue;
    return box;
  }
  return null;
}

export function stepWalk(previous, input = {}, delta = 0, extent = 180, buildings = []) {
  const dt = clamp(delta, 0, 0.05);
  const state = { ...previous };
  if (!['x', 'z', 'heading'].every((field) => Number.isFinite(state[field]))) return createWalkState(extent);
  if (state.phase === 'drowned' || state.phase === 'down') {
    const drowned = state.phase === 'drowned';
    state.drownElapsed = (state.drownElapsed || 0) + Math.max(0, finite(delta));
    if (state.drownElapsed >= DOWN_TIME - 1e-9) return createWalkState(extent);
    state.y = drowned ? Math.max(-2.4, EYE_HEIGHT - state.drownElapsed * 1.4) : Math.max(0.45, EYE_HEIGHT - state.drownElapsed * 2.2);
    state.message = drowned ? '물에 빠졌다 · 잠시 후 출발 지점으로 돌아갑니다' : '쓰러졌다 · 잠시 후 출발 지점으로 돌아갑니다';
    return state;
  }

  state.heading = finite(state.heading) - finite(input.lookYaw);
  state.pitch = clamp(finite(state.pitch) - finite(input.lookPitch), -1.2, 1.2);
  // 반동은 시간이 지나면 가라앉는다. 조준점이 스스로 내려온다.
  state.recoil = Math.max(0, finite(state.recoil) - dt * 1.9);
  const settle = Math.exp(-dt * RECOIL_RECOVER);
  state.recoilPitch = finite(state.recoilPitch) * settle;
  state.recoilYaw = finite(state.recoilYaw) * settle;
  state.hurt = Math.max(0, finite(state.hurt) - dt * 1.6);

  const forward = clamp(input.forward, -1, 1), strafe = clamp(input.strafe, -1, 1);
  const move = Math.min(1, Math.hypot(forward, strafe));
  // 정조준 중에는 달리지 못한다. 지구력이 바닥나면 회복선을 넘을 때까지 걷는다.
  state.aiming = !!input.aim && canAim(state.weapon);
  const wants = !!input.run && !state.aiming && forward > 0.1;
  const rested = finite(state.stamina, 1) > (previous?.running ? 0 : SPRINT_FLOOR);
  state.running = wants && rested && finite(state.stamina) > 0;
  if (state.running) {
    state.stamina = Math.max(0, finite(state.stamina, 1) - STAMINA_DRAIN * dt);
    state.staminaDelay = STAMINA_DELAY;
  } else {
    state.staminaDelay = Math.max(0, finite(state.staminaDelay) - dt);
    if (state.staminaDelay === 0) state.stamina = Math.min(1, finite(state.stamina, 1) + STAMINA_RECOVER * dt);
  }

  const pace = state.aiming ? WALK_SPEED * ADS_SPEED : state.running ? RUN_SPEED : WALK_SPEED;
  const length = Math.hypot(forward, strafe) || 1;
  const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
  const step = pace * move * dt;
  const from = { x: state.x, y: EYE_HEIGHT, z: state.z };
  const next = {
    x: state.x + (-sin * (forward / length) + cos * (strafe / length)) * step,
    y: EYE_HEIGHT,
    z: state.z + (-cos * (forward / length) - sin * (strafe / length)) * step,
  };
  // 건물은 막되 carPhysics 와 같은 방식으로 미끄러진다. 비스듬히 닿으면 한 축만 열어
  // 벽을 따라 걷고, 정면으로 막히면 제자리다. 이미 상자 안(트랩)이면 막지 않아 빠져나간다.
  if (insideAnyBuilding(from, buildings) || !hitsAnyBuilding(from, next, buildings)) {
    state.x = next.x; state.z = next.z;
  } else {
    const slid = slideAlongWall(from, next, buildings);
    if (slid) { state.x = slid.x; state.z = slid.z; }
  }
  state.moving = move;

  // 점프는 땅에 있을 때만 시작한다. 공중에서는 중력만 받는다.
  const height = Math.max(0, finite(state.y, EYE_HEIGHT) - EYE_HEIGHT);
  let vy = finite(state.vy);
  if (!state.airborne && input.jump && height <= 1e-6) { vy = JUMP_SPEED; state.airborne = true; }
  if (state.airborne) {
    vy -= GRAVITY * dt;
    const lifted = height + vy * dt;
    if (lifted <= 0) { state.airborne = false; vy = 0; state.y = EYE_HEIGHT; }
    else state.y = EYE_HEIGHT + lifted;
  } else {
    state.y = EYE_HEIGHT;
  }
  state.vy = vy;

  // 피킹은 벽에 막힌다. 벽 너머로 몸을 통과시키지 않는다.
  const want = clamp(input.lean, -1, 1);
  const eased = finite(state.lean) + (want - finite(state.lean)) * Math.min(1, dt * LEAN_RATE);
  const peek = leanOffset({ heading: state.heading, lean: eased });
  const wall = hitsAnyBuilding(
    { x: state.x, y: EYE_HEIGHT, z: state.z }, { x: state.x + peek.x, y: EYE_HEIGHT, z: state.z + peek.z }, buildings);
  state.lean = wall ? 0 : eased;

  if (inWater(state.x, state.z, extent)) {
    return { ...state, phase: 'drowned', drownElapsed: 0, message: '물에 빠졌다 · 잠시 후 출발 지점으로 돌아갑니다' };
  }

  const car = runOver(state, Array.isArray(input.threats) ? input.threats : []);
  if (car) {
    // 닿은 첫 프레임에만 충격을 준다. 계속 깔려 있으면 그 뒤로는 지속 피해가 이어진다.
    const impact = state.struck ? 0 : CAR_IMPACT;
    state.struck = true;
    state.hp = Math.max(0, finite(state.hp, MAX_HP) - impact - CAR_DPS * dt);
    state.regenDelay = REGEN_DELAY;
    state.hurt = 1;
    // 맞은 방향은 화면 표시에만 쓴다. 시선 기준 각이라 0 이 정면, 양수가 오른쪽이다.
    state.hurtFrom = bearing(state.heading, car.x - state.x, car.z - state.z);
    state.message = '차에 치였다';
    if (state.hp <= 0) return { ...state, phase: 'down', drownElapsed: 0, message: '쓰러졌다 · 잠시 후 출발 지점으로 돌아갑니다' };
  } else {
    state.struck = false;
    state.regenDelay = Math.max(0, finite(state.regenDelay) - dt);
    if (state.regenDelay === 0 && state.hp < state.maxHp) {
      state.hp = Math.min(finite(state.maxHp, MAX_HP), finite(state.hp, MAX_HP) + finite(state.maxHp, MAX_HP) * REGEN_RATE * dt);
    }
    if (state.message === '차에 치였다') state.message = '';
  }

  state.cooldown = Math.max(0, finite(state.cooldown) - dt);
  if (state.reloading > 0) {
    state.reloading = Math.max(0, state.reloading - dt);
    if (state.reloading === 0) {
      const spec = weaponSpec(state.weapon), pouch = state.ammo[state.weapon];
      // 관형 탄창은 한 번에 한 발만 채운다. 다 찰 때까지 같은 시간으로 다음 발을 이어 넣는다.
      const need = spec.tube ? Math.min(1, spec.mag - pouch.mag) : spec.mag - pouch.mag;
      const taken = Math.min(need, pouch.reserve);
      const filled = pouch.mag + taken, left = pouch.reserve - taken;
      state.ammo = { ...state.ammo, [state.weapon]: { mag: filled, reserve: left } };
      // 탄이 한 발 채워질 때마다 늘린다. 관형 탄창은 한 번의 재장전에도 여러 번 늘어나
      // 소리(sound.js 의 shell insert click) 가 발마다 울리게 한다.
      state.reloadTicks = finite(state.reloadTicks) + 1;
      if (spec.tube && filled < spec.mag && left > 0) {
        state.reloading = spec.reload;
        state.reloadFrom = spec.reload;
      } else {
        state.reloadFrom = 0;
        state.message = '';
      }
    }
  }
  return state;
}

/** 손전등을 켜고 끈다. 총 아래에 달려 있어 무기를 바꿔도 그대로 남는다. */
export function toggleTorch(state) {
  return { ...state, torch: !state?.torch };
}

export function selectWeapon(state, weapon) {
  if (!WEAPON_KEYS.includes(weapon) || weapon === state.weapon) return state;
  return { ...state, weapon, reloading: 0, reloadFrom: 0, cooldown: Math.max(finite(state.cooldown), 0.25), aiming: false, message: '' };
}

export function startReload(state) {
  const spec = weaponSpec(state.weapon), pouch = state.ammo[state.weapon];
  if (!spec.mag || state.reloading > 0 || pouch.mag >= spec.mag || pouch.reserve <= 0) return state;
  return { ...state, reloading: spec.reload, reloadFrom: spec.reload, message: '재장전' };
}

/** 한 발 쏜다. 맞은 AI 차량을 돌려주고 탄창과 반동을 갱신한다.
 * hits 는 pellet 마다 맞은 목표를 모은 배열이다(한 발에 하나뿐인 무기는 최대 한 개).
 * hit 은 그 중 첫 번째로, 예전 호출부와의 하위호환을 위해 남겨 둔다. */
export function fireWeapon(previous, { targets = [], buildings = [], seed = 0 } = {}) {
  const state = { ...previous };
  const spec = weaponSpec(state.weapon);
  const pouch = state.ammo[state.weapon];
  // 관형 탄창은 약실에 이미 한 발이 있어 재장전 중에도 쏠 수 있다. 쏘면 그 자리에서 장전이 끊긴다.
  const tubeInterrupt = spec.tube && state.reloading > 0 && pouch.mag > 0;
  if (state.phase !== 'walk' || state.cooldown > 0 || (state.reloading > 0 && !tubeInterrupt)) return { state, hit: null, hits: [] };
  if (tubeInterrupt) { state.reloading = 0; state.reloadFrom = 0; state.message = ''; }
  if (spec.mag) {
    if (pouch.mag <= 0) return { state: startReload(state), hit: null, hits: [] };
    state.ammo = { ...state.ammo, [state.weapon]: { ...pouch, mag: pouch.mag - 1 } };
  }
  state.cooldown = 60 / spec.rpm;
  const damp = state.aiming ? ADS_RECOIL : 1;
  state.recoil = Math.min(1, finite(state.recoil) + spec.recoil * 8 * damp);
  // 총구가 올라가고 좌우로 튄다. 난수 대신 발사 순번으로 흔들어 같은 입력이면 같은 탄착이 된다.
  state.recoilPitch = clamp(finite(state.recoilPitch) + spec.kick * damp, -0.5, 0.5);
  state.recoilYaw = clamp(finite(state.recoilYaw) + Math.sin(seed * 41.7) * spec.sway * damp, -0.3, 0.3);

  const view = viewAngles(state);
  const muzzle = { x: state.x, y: state.y - 0.12, z: state.z };
  // pellet 이 있는 무기는 pelletSpread 로 여러 발을, 없으면 spread 로 한 발을 쏜다.
  // pellet 마다 시드를 무리수 간격으로 밀어 겹치지 않게 하는 관용구는 기존 반동 식과 같다.
  const pelletCount = Math.max(1, spec.pellets || 1);
  const cone = spec.pellets ? spec.pelletSpread : spec.spread * (1 + state.recoil * 2);
  const wobble = cone * (state.aiming ? ADS_SPREAD : 1);
  const hits = [];
  for (let p = 0; p < pelletCount; p++) {
    const pelletSeed = seed + p * 0.6180339887;
    const aim = aimVector({
      heading: view.heading + Math.sin(pelletSeed * 12.9898) * wobble,
      pitch: view.pitch + Math.cos(pelletSeed * 78.233) * wobble,
    });
    const far = { x: muzzle.x + aim.x * spec.range, y: muzzle.y + aim.y * spec.range, z: muzzle.z + aim.z * spec.range };
    // 벽 뒤의 차는 맞지 않는다. pellet 하나마다 가장 가까운 목표만 맞는다.
    let best = null;
    for (const target of targets) {
      if (!hitsVehicle(muzzle, far, target, 1.2)) continue;
      const distance = Math.hypot(target.x - muzzle.x, target.z - muzzle.z);
      if (distance > spec.range) continue;
      if (!best || distance < best.distance) best = { ...target, distance };
    }
    // 고가 차량을 지상 목표점으로 연결하면 다리 아래의 낮은 구조물이 총선을 가린 것으로 오판한다.
    const targetY = best && Number.isFinite(best.height)
      ? finite(best.y) + Math.max(0, best.height) / 2
      : 1;
    if (best && hitsAnyBuilding(muzzle, { x: best.x, y: targetY, z: best.z }, buildings)) best = null;
    if (best) hits.push(best);
  }
  return { state, hit: hits[0] ?? null, hits };
}
