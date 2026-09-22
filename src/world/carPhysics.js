import { hitsAnyBuilding } from './solidIndex.js';
import { WORLD } from '../../shared/worldLayout.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { onBridge } from '../../shared/bridgeGeometry.js';
import { roadSurface } from './roadSurface.js';
import { inWaterBody, riverCenter, riverClearance } from '../../shared/river.js';
import { inPond } from '../../shared/nature.js';
import { AIRPORT_OFFSET, carSpawn, onAirportLand } from './models/airportLayout.js';

/** 지상 차량 물리. 순수 함수이며 Three, React, 네트워크에 의존하지 않는다.
 * 지상 도로와 연결된 램프·고가 노면의 높이를 따라 달린다.
 * 세단과 오토바이는 같은 모델을 쓰되 가속, 최고 속도, 접지력, 기울기만 다르다.
 */
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));

/** 모든 차량이 쓰는 자동변속기의 유효 범위다. rpm 은 엔진 상태이고 화면에서만 만든 값이 아니다. */
export const IDLE_RPM = 800, REDLINE_RPM = 6800, SHIFT_RPM = 7200, MAX_RPM = 8000;

/** 도로 상판이 지면보다 높은 값이다. AI 차량 상자의 바닥도 이 높이에서 잰다. */
export const ROAD_TOP = 0.31;
/** 도로 상판에 바퀴 반지름 0.9 를 더해 차가 도로에 얹히게 한다. */
export const CAR_GROUND = ROAD_TOP + 0.9;
/** lean 은 차체가 기우는 정도다. 두 바퀴인 오토바이만 기울고 네 바퀴와 궤도는 기울지 않는다.
 * combat 이 참인 차량은 민간 AI 차량을 들이받으면 상대를 부순다. 민간 차량은 서로 터지지
 * 않고 차체만 깎인다. 깎는 것은 health.bump 이고 여기서는 부딪혔다는 것만 알린다.
 */
// width 와 depth 는 차체 충돌 상자다. 남의 포탄이 나를 맞혔는지 보는 데 쓰므로
// models/ 의 실루엣 크기와 맞춘다. 모델을 키우면 이 값도 함께 키운다.
export const VEHICLES = {
  sedan: { accel: 13, reverse: 5, top: 62, brake: 26, grip: 1, steerRate: 1.5, lean: 0, width: 2.2, depth: 4.6, gears: [0.16, 0.29, 0.43, 0.60, 0.79, 1], ko: '세단' },
  motorcycle: { accel: 19, reverse: 4, top: 74, brake: 22, grip: 0.82, steerRate: 1.9, lean: 0.7, width: 1, depth: 2.2, gears: [0.18, 0.32, 0.48, 0.65, 0.82, 1], ko: '오토바이' },
  suv: { accel: 12, reverse: 5, top: 58, brake: 24, grip: 0.97, steerRate: 1.35, lean: 0, width: 2.3, depth: 4.9, gears: [0.17, 0.3, 0.45, 0.62, 0.8, 1], ko: 'SUV' },
  convertible: { accel: 16, reverse: 5, top: 70, brake: 27, grip: 0.95, steerRate: 1.6, lean: 0, width: 2.1, depth: 4.4, gears: [0.16, 0.28, 0.42, 0.59, 0.78, 1], ko: '오픈카' },
  // 현대식 포뮬러 머신이다. top 은 300km/h 를 m/s 로 바꾼 값이다. 고속 조향 손실을
  // 크게 두어 최고속도에서 키 한 번으로 차체가 돌아서지 않고, 핸드브레이크를 잡았을 때만
  // 낮은 속도 영역에서 뒷축이 적극적으로 흐른다.
  formula: {
    accel: 31, reverse: 4, top: 300 / 3.6, brake: 34, grip: 1.06, steerRate: 1.65, lean: 0,
    width: 2.0, depth: 5.55, gears: [0.12, 0.22, 0.33, 0.45, 0.58, 0.72, 0.86, 1], ko: '포뮬러',
    handbrakeBrake: 0.34, driftYaw: 2.15, driftMinSpeed: 10, driftSteerMin: 0.18,
    highSpeedSteerLoss: 0.78,
  },
  truck: { accel: 7, reverse: 3.5, top: 44, brake: 18, grip: 1, steerRate: 0.85, lean: 0, width: 2.5, depth: 7.6, gears: [0.14, 0.25, 0.38, 0.54, 0.74, 1], ko: '트럭' },
  tank: { accel: 7, reverse: 3, top: 22, brake: 16, grip: 1, steerRate: 0.9, lean: 0, width: 3.6, depth: 7.2, gears: [0.19, 0.36, 0.57, 0.78, 1], ko: '전차', combat: true },
  howitzer: { accel: 6, reverse: 3, top: 19, brake: 14, grip: 1, steerRate: 0.8, lean: 0, width: 3.4, depth: 7.6, gears: [0.20, 0.39, 0.61, 0.81, 1], ko: '자주포', combat: true },
  armored: { accel: 11, reverse: 4, top: 32, brake: 18, grip: 0.95, steerRate: 1.2, lean: 0, width: 3, depth: 6.4, gears: [0.17, 0.31, 0.46, 0.63, 0.81, 1], ko: '장갑차', combat: true },
  // 대공포는 장갑차 차대에 포탑만 올린 것이다. 포탑이 무거워 조금 느리고 덜 돈다.
  aa: { accel: 10, reverse: 4, top: 29, brake: 17, grip: 0.94, steerRate: 1.1, lean: 0, width: 3, depth: 6.4, gears: [0.18, 0.33, 0.49, 0.67, 0.84, 1], ko: '대공포', combat: true },
};

/** 차체를 축에 맞춘 상자로 본다. 옆을 보고 있으면 가로와 세로가 바뀐다.
 * hitsVehicle 이 축 정렬 상자만 받으므로 traffic.js 의 AI 차량과 같은 방식을 쓴다. */
export function vehicleBox(state, kind = 'sedan') {
  const spec = vehicleSpec(kind);
  const sideways = Math.abs(Math.sin(finite(state?.heading))) > 0.7;
  return {
    x: finite(state?.x), y: finite(state?.y, CAR_GROUND), z: finite(state?.z),
    width: sideways ? spec.depth : spec.width,
    depth: sideways ? spec.width : spec.depth,
  };
}

export function vehicleSpec(kind) {
  return VEHICLES[kind] || VEHICLES.sedan;
}

/** 강과 바다 판정. 다리 위는 물이 아니고 강 안의 섬도 물이 아니다.
 * 중심선이 굽어 있으므로 z 를 상수와 비교하지 않고 river 모듈에 묻는다. */
export function inWater(x, z, extent = 180) {
  const span = finite(extent, 180);
  // 도시 밖은 바다다. 공항 땅과 둑만 뭍이다.
  if (Math.abs(x) > span + 16 || Math.abs(z) > span + 16) return !onAirportLand(span, x, z);
  const plan = createUrbanPlan(span);
  if (inPond(plan, x, z)) return true;
  if (!inWaterBody(span, x, z)) return false;
  // 렌더와 같은 방향성 상판 안은 뭍이다. 진입부까지 차 폭만큼 여유를 둔다.
  return !plan.bridges.some(bridge => onBridge(bridge, x, z, 4));
}

/** 출발 지점의 z 다. 강이 굽으면서 예전 고정값 240 이 물속이 됐다. 남안 강변도로
 * 바깥으로 나가야 마른 땅이다. 도보 출발 지점도 같은 값을 읽는다. */
export function spawnZ(extent = 180) {
  const span = finite(extent, 180);
  return riverCenter(span, 6) + riverClearance(span, 6, 1) + span * 0.065;
}

export function createCarState(extent = 180) {
  // 동쪽 공항 터미널 앞 공항로다. 도시를 향해 서 있어 곧장 둑을 건너 순환로로 들어간다.
  const spawn = carSpawn(finite(extent, 180));
  return { x: spawn.x, y: CAR_GROUND, z: spawn.z, heading: spawn.heading, steer: 0, lean: 0, speed: 0, throttle: 0, gear: 1, rpm: IDLE_RPM,
    phase: 'drive', message: '', extent: finite(extent, 180) };
}

/** 속도와 현재 단수로 엔진 회전을 정한다. 가속 중에는 레드존까지 올린 뒤 다음 단으로 넘긴다. */
function updateTransmission(state, spec, gas, back) {
  const gears = spec.gears;
  const top = Math.max(1, spec.top);
  const speed = Math.abs(state.speed);
  if (state.speed < -0.15 || (back > gas && speed < 0.15)) {
    const rpm = IDLE_RPM + clamp(speed / Math.max(1, top * 0.35), 0, 1) * (SHIFT_RPM - IDLE_RPM);
    state.gear = 'R'; state.rpm = Math.round(Math.min(MAX_RPM, rpm));
    return;
  }
  let gear = Number.isInteger(state.gear) ? clamp(state.gear, 1, gears.length) : 1;
  while (gear < gears.length && speed > top * gears[gear - 1] * 0.97) gear += 1;
  while (gear > 1 && speed < top * gears[gear - 2] * 0.68) gear -= 1;
  const ceiling = top * gears[gear - 1];
  const rpm = IDLE_RPM + clamp(speed / Math.max(1, ceiling), 0, 1.13) * (SHIFT_RPM - IDLE_RPM);
  state.gear = gear;
  state.rpm = Math.round(Math.min(MAX_RPM, rpm));
}

/** 세로 여유다. 수평 여유와 따로 둔다. 차 지붕 바로 위를 스치는 탄까지는 맞은 것으로 본다.
 * 전차포 포구가 2.10, 대공포가 2.33 이고 승용차 지붕이 1.91 이라 0.5 는 되어야 코앞의 차를
 * 수평으로 쏴서 맞는다. 그보다 크게 두면 허공 사격이 다시 차를 부순다. */
export const VEHICLE_LIFT = 0.5;
/** height 가 없는 상자의 세로 반폭이다. 사실상 세로를 보지 않는 값이다. */
const NO_ROOF = 1e6;

/** 차량끼리의 충돌과 탄의 명중을 본다. 건물보다 훨씬 좁은 여유로 보므로 옆 차선을 스쳐도 터지지 않는다.
 * 상자는 x, z 반폭과 세로 범위(바닥 y, 높이 height) 를 갖고 이동은 선분이다. 세 축 모두 슬랩으로
 * 보므로 차 위를 지나는 탄은 맞지 않는다. height 를 주지 않은 상자는 예전처럼 세로를 보지 않는다. */
export function hitsVehicle(from, to, box, margin = 0.4, lift = VEHICLE_LIFT) {
  const roofed = Number.isFinite(box.height);
  const half = {
    x: (box.width || 2.2) / 2 + margin,
    y: roofed ? box.height / 2 + lift : NO_ROOF,
    z: (box.depth || 4.3) / 2 + margin,
  };
  const centre = { x: box.x, y: roofed ? finite(box.y) + box.height / 2 : 0, z: box.z };
  let enter = 0, leave = 1;
  for (const axis of ['x', 'y', 'z']) {
    const min = centre[axis] - half[axis], max = centre[axis] + half[axis];
    const start = finite(from[axis]), direction = finite(to[axis]) - start;
    if (Math.abs(direction) < 1e-9) { if (start < min || start > max) return false; }
    else {
      const a = (min - start) / direction, b = (max - start) / direction;
      enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}

/** 벽을 스칠 때 남는 속도 비율이다. 1 이면 벽을 타고 그대로 달리고 0 이면 선다. */
const SCRAPE = 0.82;
/** 차끼리 부딪혔을 때 튕겨 나가는 속도 비율이다. 부호가 뒤집혀 뒤로 조금 물러선다. */
const BUMP_REBOUND = 0.18;
/** 이 속도(m/s) 보다 느리게 닿으면 막히기만 하고 차체는 깎이지 않는다. 앞차 뒤에 붙어
 * 기어가는 동안 프레임마다 깎이면 접촉 한 번으로 차가 선다. */
const BUMP_SPEED = 5;

/** 막힌 이동을 축 하나씩 다시 본다. 한 축이 열려 있으면 그쪽으로만 옮겨 벽을 따라 흐른다.
 * 둘 다 막혔으면 null 이고 그때만 차를 세운다. 순수 함수다. */
export function slideAlongWall(from, to, buildings) {
  const alongX = { x: to.x, y: to.y, z: from.z };
  const alongZ = { x: from.x, y: to.y, z: to.z };
  // 움직이지 않는 축은 열린 것으로 치지 않는다. 정면으로 박았을 때 제자리가 답이 되면 차가 안 선다.
  const freeX = Math.abs(to.x - from.x) > 1e-6 && !hitsAnyBuilding(from, alongX, buildings);
  const freeZ = Math.abs(to.z - from.z) > 1e-6 && !hitsAnyBuilding(from, alongZ, buildings);
  if (!freeX && !freeZ) return null;
  if (freeX && freeZ) return Math.abs(to.x - from.x) >= Math.abs(to.z - from.z) ? alongX : alongZ;
  return freeX ? alongX : alongZ;
}

export function stepCar(previous, input = {}, delta = 0, extent = 180, buildings = [], kind = 'sedan', traffic = []) {
  const dt = clamp(delta, 0, 0.05);
  const state = { ...previous };
  if (!['x', 'z', 'heading', 'speed'].every((field) => Number.isFinite(state[field]))) return createCarState(extent);
  if (state.phase === 'sinking') {
    // 물에 빠지면 하찮게 가라앉는다. 조작은 받지 않는다.
    state.sinkElapsed = (state.sinkElapsed || 0) + Math.max(0, finite(delta));
    if (state.sinkElapsed >= 3 - 1e-9) return createCarState(extent);
    state.speed *= Math.max(0, 1 - dt * 3);
    state.y = Math.max(-3.6, CAR_GROUND - state.sinkElapsed * 1.8);
    state.pitchDown = Math.min(0.5, state.sinkElapsed * 0.5);
    state.x -= Math.sin(state.heading) * state.speed * dt;
    state.z -= Math.cos(state.heading) * state.speed * dt;
    state.message = '물에 빠졌다 · 잠시 후 출발 지점으로 돌아갑니다';
    return state;
  }
  if (state.phase === 'crashed') {
    state.crashElapsed = (state.crashElapsed || 0) + Math.max(0, finite(delta));
    if (state.crashElapsed >= 3 - 1e-9) return createCarState(extent);
    state.message = `충돌 · ${Math.ceil(3 - state.crashElapsed)}초 후 출발 지점으로 돌아갑니다`;
    return state;
  }
  const spec = vehicleSpec(kind);
  const gas = clamp(input.throttle, 0, 1), back = clamp(input.reverse, 0, 1);
  // 핸드브레이크는 뒷바퀴만 잠근다. 덜 서는 대신 뒤가 흘러 더 많이 돈다.
  const hand = !!input.handbrake;
  const braking = !!input.brake || hand;
  state.throttle = gas;

  // 구름 저항과 공기 저항, 브레이크가 함께 속도를 깎는다.
  const drag = state.speed * state.speed * 0.0022 + Math.abs(state.speed) * 0.12 + 0.8;
  const push = gas * spec.accel - back * spec.reverse;
  state.speed += (push - Math.sign(state.speed) * drag) * dt;
  if (braking) {
    const stop = spec.brake * (hand && !input.brake ? finite(spec.handbrakeBrake, 0.45) : 1) * dt;
    state.speed = Math.abs(state.speed) <= stop ? 0 : state.speed - Math.sign(state.speed) * stop;
  }
  if (!gas && !back && !braking && Math.abs(state.speed) < 0.6) state.speed = 0;
  state.braking = braking;
  state.speed = clamp(state.speed, -spec.top * 0.35, spec.top);
  updateTransmission(state, spec, gas, back);

  // 조향은 앞바퀴다. 멈춰 있으면 돌지 않고 빠를수록 조향각이 줄어든다.
  const wheel = clamp(input.steer, -1, 1);
  state.steer += (wheel - finite(state.steer)) * (1 - Math.exp(-dt * 9));
  const highSpeedLoss = clamp(spec.highSpeedSteerLoss, 0, 0.9) || 0.6;
  const bite = Math.min(1, Math.abs(state.speed) / 7)
    * (1 - Math.min(highSpeedLoss, Math.abs(state.speed) / (spec.top * 1.6)));
  const turn = state.steer * spec.steerRate * bite * Math.sign(state.speed || 1) * spec.grip
    * (hand ? finite(spec.driftYaw, 1.7) : 1);
  state.heading -= turn * dt;
  state.drift = hand
    && Math.abs(state.speed) > finite(spec.driftMinSpeed, 8)
    && Math.abs(state.steer) > finite(spec.driftSteerMin, 0.25);
  state.lean = finite(state.lean) + (-state.steer * spec.lean * Math.min(1, Math.abs(state.speed) / 22) - finite(state.lean)) * (1 - Math.exp(-dt * 6));

  const from = { x: state.x, y: finite(state.y,CAR_GROUND), z: state.z };
  state.x -= Math.sin(state.heading) * state.speed * dt;
  state.z -= Math.cos(state.heading) * state.speed * dt;
  const surface=roadSurface(createUrbanPlan(extent),state.x,state.z,from.y-CAR_GROUND+.33);
  state.y = CAR_GROUND+surface.top-.33;
  state.roadPitch=Math.atan(surface.slope*(-Math.sin(state.heading)*surface.dx-Math.cos(state.heading)*surface.dz));
  const to = { x: state.x, y: state.y, z: state.z };
  state.kills = [];
  // 건물이나 벽은 터지지 않고 막힌다. 비스듬히 닿았으면 벽을 따라 미끄러지고
  // 정면으로 박았을 때만 선다. 닿을 때마다 세우면 가드레일 옆을 지날 수 없다.
  if (hitsAnyBuilding(from, to, buildings)) {
    const slid = slideAlongWall(from, to, buildings);
    if (slid) {
      state.x = slid.x; state.z = slid.z; state.speed *= SCRAPE;
      if (state.message === '막혔다') state.message = '';
    } else {
      state.x = from.x; state.y = from.y; state.z = from.z; state.speed = 0; state.gear = 1; state.rpm = IDLE_RPM; state.message = '막혔다';
      return state;
    }
  } else if (state.message === '막혔다') state.message = '';
  const struck = traffic.filter((other) => Math.abs(state.y-finite(other.y,CAR_GROUND))<2 && hitsVehicle(from, to, other));
  state.bumped = false;
  if (struck.length) {
    if (spec.combat) {
      // 전투 차량은 민간 차를 밀어붙여 부순다. 부딪혀도 제 차체는 멀쩡하다.
      state.kills = struck.map((other) => ({ x: other.x, z: other.z, index: other.index }));
      state.speed *= 0.85;
    } else {
      // 민간 차끼리는 터지지 않는다. 그 자리에 서고 세게 박았을 때만 차체가 깎인다.
      // 깎는 것은 부르는 쪽이다. 여기서는 부딪혔다는 것만 알린다.
      const hard = Math.abs(state.speed) >= BUMP_SPEED;
      state.x = from.x; state.y = from.y; state.z = from.z;
      // 살짝 닿았으면 앞차 속도까지만 내며 따라간다. 0 으로 두면 붙었다 떨어졌다 하며 덜컹거린다.
      const pace = Math.max(0, Math.min(...struck.map((other) => finite(other.speed, 0))));
      state.speed = hard ? -state.speed * BUMP_REBOUND : Math.min(Math.max(0, state.speed), pace);
      state.bumped = hard;
      state.message = '충돌';
    }
  } else if (state.message === '충돌') state.message = '';

  if (surface.top <= .33 && inWater(state.x, state.z, extent)) {
    return { ...state, phase: 'sinking', sinkElapsed: 0, throttle: 0, steer: 0, lean: 0, gear: 1, rpm: IDLE_RPM,
      message: '물에 빠졌다 · 잠시 후 출발 지점으로 돌아갑니다' };
  }
  return state;
}

export function carStatus(state, kind = 'sedan') {
  const spec = vehicleSpec(kind);
  return {
    x: finite(state.x),
    z: finite(state.z),
    speed: Math.round(Math.abs(finite(state.speed)) * 3.6),
    altitude: 0,
    heading: ((Math.round(-finite(state.heading) * 180 / Math.PI) % 360) + 360) % 360,
    throttle: finite(state.throttle),
    phase: state.phase === 'crashed' || state.phase === 'sinking' ? state.phase : 'drive',
    gear: state.gear === 'R' ? 'R' : clamp(state.gear, 1, spec.gears.length),
    rpm: clamp(state.rpm, IDLE_RPM, MAX_RPM),
    redline: finite(state.rpm) >= REDLINE_RPM,
    drift: !!state.drift,
    braking: !!state.braking,
    top: spec.top,
    message: state.message,
  };
}
