import { FLIGHT_CLEARANCE, hitsAnyBuilding, hitsBuilding } from './solidIndex.js';

export { hitsBuilding };

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));
export const FLIGHT_GROUND = 2.1;
/** 상승 한계다. HUD 의 고도는 지면 기준이라 월드 높이로는 FLIGHT_GROUND 를 더한 값이 천장이다.
 * 고정익과 헬기가 같은 값을 쓴다. */
export const CEILING = 1000;
export const STALL_AOA = 0.36;
// 중력이다. 기수 자세에 따른 속도 교환과 선회율이 이 값 하나를 같이 쓴다.
export const GRAVITY = 9.8;
// 급강하에서 최고 속도를 넘길 수 있는 여유다. 수직에 가까우면 1.45 배까지 허용한다.
const DIVE_MARGIN = 0.45;
/** A/D 선회 입력에서 기체가 실제로 누우는 비율이다. 나머지 선회력은 러더와
 * 날개 조종면이 보충한다고 보아, 기존 방향 전환력은 유지한다. */
export const TURN_BANK_RATIO = 0.4;
// 이륙 속도는 기종 실속 속도에서 파생한다. 최고 속도를 깎아도 이륙 난이도가 따라 변하지 않는다.
const ROTATE_RATIO = 1.03;

/** 계기 속도 보정이다. 물리를 건드리지 않고 읽는 숫자만 키운다.
 * 예전 눈금으로 500km/h 이던 속도가 600km/h 로 표시된다. */
export const SPEED_DISPLAY = 1.2;
/** 계기 기준 음속이다. 고고도(약 11km) 음속을 쓴다. 이 눈금에서 요격기는 부스트를 켜야 넘는다. */
export const MACH_KMH = 1062;

/** 계기에 뜨는 km/h 다. 물리 속도(m/s) 에 보정을 곱한 값이다. */
export function displaySpeed(metersPerSecond) {
  return finite(metersPerSecond) * 3.6 * SPEED_DISPLAY;
}

/** displaySpeed 의 역이다. 성능 표에 계기 숫자를 그대로 적으려고 쓴다. */
export function speedOf(kmh) {
  return finite(kmh) / (3.6 * SPEED_DISPLAY);
}

/** 계기 속도 기준 마하수다. 1 을 넘으면 초음속이다. */
export function machOf(metersPerSecond) {
  return displaySpeed(metersPerSecond) / MACH_KMH;
}

// 기종별 성능이다. 헬기는 rotorPhysics 가 따로 맡으므로 여기에 없다.
// 값을 바꾸면 rideSpecs.js 의 카드 막대가 함께 움직인다.
// rollAuthority 는 A/D 한 번에 기체가 눕는 각이다. 눕는 만큼 기수가 돌아가므로
// 선회율도 같이 정한다. 전 기종을 예전 값의 0.8 배로 낮췄다.
export const PLANES = Object.freeze({
  jet: { thrust: 17, maxSpeed: 112, pitchAuthority: 0.80, rollAuthority: 1.12, stallSpeed: 33 },
  // 폭격기는 무겁다. 느리게 붙고 느리게 돌지만 실속 속도가 높아 저속에서 위험하다.
  bomber: { thrust: 13, maxSpeed: 92, pitchAuthority: 0.5, rollAuthority: 0.62, stallSpeed: 38 },
  // 프로펠러기는 가장 느리지만 가장 잘 돈다. 실속 속도도 가장 낮다.
  prop: { thrust: 11, maxSpeed: 72, pitchAuthority: 1.25, rollAuthority: 1.84, stallSpeed: 27 },
  fighter: { thrust: 24, maxSpeed: 151, pitchAuthority: 1.05, rollAuthority: 1.68, stallSpeed: 37 },
  // 요격기다. 유일하게 연료가 있고 Shift 부스트로 최고 속도가 열린다.
  // 속도는 m/s 이고 괄호 안이 계기에 뜨는 km/h 다. 기본 180 은 778, 부스트 250 은 1080 이다.
  // 강화 부스트는 Q 로 켜는 두 번째 단계다. 계기 1340km/h 를 그대로 적고 speedOf 가 m/s 로 바꾼다.
  // 추력은 그 속도의 항력(약 88) 보다 넉넉해야 상한에 실제로 닿는다.
  interceptor: { thrust: 30, maxSpeed: 180, pitchAuthority: 0.95, rollAuthority: 1.6, stallSpeed: 42,
    boostSpeed: 250, boostThrust: 58, overdriveSpeed: speedOf(1340), overdriveThrust: 105 },
  // 샷거너는 요격기와 같은 기체 성능을 쓴다. 차이는 전방 산탄 무장뿐이다.
  shotgun: { thrust: 30, maxSpeed: 180, pitchAuthority: 0.95, rollAuthority: 1.6, stallSpeed: 42,
    boostSpeed: 250, boostThrust: 58, overdriveSpeed: speedOf(1340), overdriveThrust: 105 },
});

/** 연료를 쓰는 기종인지 본다. 다른 기종은 연료 개념이 없어 게이지도 그리지 않는다. */
export function usesFuel(plane) {
  return Boolean(planeSpec(plane).boostSpeed);
}

/** 연료가 말라 추력이 끊긴 상태다. 엔진 소리와 배기 효과가 이 값 하나를 보고 함께 꺼진다.
 * 착륙하면 곧바로 급유되므로 연료 0 은 공중에서만 나온다. */
export function isDry(state = {}) {
  return Number.isFinite(state.fuel) && state.fuel <= 0;
}

/** 부스트 단계를 바꿀 수 있는 기종인지 본다. 화면이 Q 안내를 띄울지 이 값으로 정한다. */
export function hasOverdrive(plane) {
  return Boolean(planeSpec(plane).overdriveSpeed);
}

/** 부스트를 쓰면 연료가 이 배수로 준다. */
export const BOOST_BURN = 1.3;
/** 강화 부스트의 배수다. 기본 부스트 대신 이 값을 쓴다. 두 값을 곱하지 않는다. */
export const OVERDRIVE_BURN = 2.5;
/** 가득 채운 연료로 도는 비행 구역 바퀴 수다. 이 값이 연료량을 정한다. */
export const FUEL_LAPS = 2;
/** 스로틀을 놓아도 도는 최소 소모다. 공회전에도 연료가 준다. */
const IDLE_BURN = 0.25;
/** 기본 소모에 곱하는 계수다. 연료량(fuelSeconds) 을 건드리지 않고 소모 속도만 올린다. */
const BURN_RATE = 1.2;
/** 초음속에서 연료가 주는 배수다. */
export const SUPERSONIC_BURN = 2;

/** 연료가 다 떨어지기까지의 초다. 비행 구역 둘레 FUEL_LAPS 바퀴를 순항 속도로 도는 시간이다.
 * 도시가 커지면 연료도 함께 늘어난다. */
export function fuelSeconds(extent = 180, plane = 'interceptor') {
  const spec = planeSpec(plane);
  if (!spec.boostSpeed) return Infinity;
  const lap = 2 * Math.PI * flightBoundary(extent);
  return (lap * FUEL_LAPS) / spec.maxSpeed;
}

export function planeSpec(key) {
  return PLANES[key] || PLANES.jet;
}

export function flightStatus(state) {
  const degrees = 180 / Math.PI;
  const mach = machOf(state.speed);
  return {
    speed: Math.round(displaySpeed(state.speed)), mach, supersonic: mach >= 1,
    altitude: Math.max(0, Math.round(state.y - FLIGHT_GROUND)),
    heading: ((Math.round(-state.heading * degrees) % 360) + 360) % 360,
    pitch: Math.round(state.pitch * degrees), roll: Math.round(state.roll * degrees),
    throttle: state.throttle, phase: state.phase, message: state.message,
    // 연료가 없는 기종은 null 이다. 화면이 게이지를 그릴지 이 값으로 정한다.
    fuel: Number.isFinite(state.fuel) ? state.fuel : null, boost: !!state.boost,
    // overdrive 는 지금 부스트 중인지가 아니라 Q 로 고른 단계다. 꺼져 있어도 화면이 단계를 알린다.
    overdrive: !!state.overdrive, dry: isDry(state),
  };
}

export function createFlightState(extent = 180, plane = 'jet') {
  return { x: finite(extent, 180) + 110, y: FLIGHT_GROUND, z: 140, heading: 0, pitch: 0, roll: 0,
    speed: 0, climb: 0, throttle: 0, phase: 'runway', message: '', guard: false,
    // 연료가 없는 기종은 fuel 을 두지 않는다. 있는 기종만 1 로 시작한다.
    ...(usesFuel(plane) ? { fuel: 1, boost: false } : {}),
    // 부스트 단계는 기본 단계에서 시작한다. 이륙할 때마다 강화 단계가 켜져 있으면 연료가 금방 마른다.
    ...(hasOverdrive(plane) ? { overdrive: false } : {}) };
}

/** 비행 구역의 반지름이다. 도시 밖으로 얼마나 나갈 수 있는지를 정한다. */
export function flightBoundary(extent = 180) {
  // 공항이 X = extent + 110 에 있고 활주로가 Z 로 540 뻗는다. 여유가 500 뿐이면
  // 활주로 바깥으로 도는 착륙 선회가 경계에 닿아 조종을 뺏긴다. 900 으로 넓힌다.
  return Math.max(1400, finite(extent, 180) + 900);
}

/** 경계를 넘으면 조종을 회수해 도시 쪽으로 돌린다. 다시 안쪽으로 들어오고
 * 기수가 도시를 향하면 조종을 돌려준다. 히스테리시스가 없으면 경계선에서 떤다.
 */
export const GUARD_RELEASE = 0.92;
const GUARD_HEADING = 0.6;
export function guardInput(state, extent, input = {}) {
  const radius = Math.hypot(finite(state.x), finite(state.z));
  const limit = flightBoundary(extent);
  const inward = Math.atan2(finite(state.x), finite(state.z));
  const offset = Math.atan2(Math.sin(inward - finite(state.heading)), Math.cos(inward - finite(state.heading)));
  const settled = radius < limit * GUARD_RELEASE && Math.abs(offset) < GUARD_HEADING;
  const active = state.guard ? !settled : radius > limit;
  if (!active) return { active: false, input, message: null };
  // roll 입력은 각속도가 아니라 목표 뱅크각이고 부호가 반대다. heading 은 뱅크가
  // 양수일 때 늘어나므로 안쪽으로 돌리려면 roll 과 yaw 를 모두 음수로 준다.
  // 선회율은 속도에 반비례하니 스로틀은 실속을 면할 만큼만 남긴다.
  return {
    active: true,
    input: {
      throttle: clamp(input.throttle, 0.32, 0.55),
      brake: false,
      pitch: clamp(0.1 - finite(state.pitch), -0.5, 0.5),
      roll: clamp(-offset * 0.9, -0.62, 0.62),
      yaw: clamp(-offset * 0.35, -0.45, 0.45),
    },
    message: '비행 구역 이탈 · 자동으로 도시 안쪽으로 선회합니다',
  };
}

export function onRunway(state, extent) {
  // 활주로는 도시 동쪽과 서쪽에 하나씩 있다. 둘 다 같은 치수다.
  return Math.abs(Math.abs(state.x)-(finite(extent,180)+110))<=13 && Math.abs(state.z)<=270;
}

function crash(state) {
  return {...state,phase:'crashed',speed:0,throttle:0,crashElapsed:0,message:'충돌 · 3초 후 활주로로 돌아갑니다'};
}

export function stepFlight(previous, input = {}, delta = 0, extent = 180, buildings=[], plane = 'jet') {
  const dt = clamp(delta, 0, 0.05);
  const spec = planeSpec(plane);
  const state = { ...previous };
  if (!['x', 'y', 'z', 'speed', 'pitch', 'roll', 'heading'].every((field) => Number.isFinite(state[field]))) return createFlightState(extent, plane);
  if(state.phase==='crashed') {
    state.crashElapsed=(state.crashElapsed||0)+Math.max(0,finite(delta));
    if(state.crashElapsed>=3-1e-9)return createFlightState(extent, plane);
    state.message=`충돌 · ${Math.ceil(3-state.crashElapsed)}초 후 활주로로 돌아갑니다`;
    return state;
  }
  const guard = state.phase === 'airborne' ? guardInput(state, extent, input) : { active: false, input, message: null };
  state.guard = guard.active;
  // 부스트 단계는 조종 입력이 아니라 모드다. 구역 이탈 자동 선회가 조종을 가져가도 단계는 남는다.
  const overdrive = hasOverdrive(plane) && !!input.overdrive;
  input = guard.input;
  state.throttle = clamp(input.throttle, 0, 1);
  const pitchInput = clamp(input.pitch, -1, 1), rollInput = clamp(input.roll, -1, 1), yawInput = clamp(input.yaw, -1, 1);
  const ground=state.phase==='runway';
  // 연료다. 착륙해 있으면 채워지고, 날고 있으면 스로틀과 부스트에 따라 준다.
  const fuelled = usesFuel(plane);
  const dry = fuelled && !ground && finite(state.fuel, 1) <= 0;
  const boosting = fuelled && !!input.boost && !ground && !dry;
  // 부스트를 켠 동안만 강화 단계가 속도와 소모에 반영된다.
  const hard = boosting && overdrive;
  if (fuelled) {
    if (ground) {
      if (finite(state.fuel, 1) < 1) state.message = '급유 완료';
      state.fuel = 1;
    } else {
      // 초음속에서는 소모가 두 배다. 부스트 배수와 겹쳐 곱하지 않고 큰 쪽 하나만 쓴다.
      const stage = hard ? OVERDRIVE_BURN : boosting ? BOOST_BURN : 1;
      const rush = Math.max(stage, machOf(state.speed) >= 1 ? SUPERSONIC_BURN : 1);
      const burn = (IDLE_BURN + (1 - IDLE_BURN) * state.throttle) * BURN_RATE * rush;
      state.fuel = clamp(finite(state.fuel, 1) - (burn * dt) / fuelSeconds(extent, plane), 0, 1);
    }
    state.boost = boosting;
    if (hasOverdrive(plane)) state.overdrive = overdrive;
    if (dry) state.message = '연료 소진 · 착륙하면 급유된다';
    else if (state.message === '연료 소진 · 착륙하면 급유된다') state.message = '';
  }
  // 항력은 속도의 제곱에 붙고, 기수를 들면 유도항력이 더해진다.
  // 지상에서 브레이크를 잡으면 항력이 크게 늘어난다. 공중에서는 무시한다.
  const braking = ground && !!input.brake;
  const drag = state.speed * state.speed * 0.0009 + (ground ? 3.5 : 1.2) + (braking ? 20 : 0) + Math.abs(state.pitch) * state.speed * 0.02;
  // 운동 에너지와 위치 에너지를 맞바꾸는 항이다. 활주로에서는 기수각으로 속도가 변하면 이륙 조작이 이상해져 뺀다.
  const gravityAlong = ground ? 0 : Math.sin(state.pitch) * GRAVITY;
  // 수평에서는 maxSpeed 가 상한이고 내리꽂을수록 상한이 열린다. 항력만으로는 기종에 따라 상한이 제각각이다.
  // 부스트는 상한과 추력을 함께 연다. 연료가 없으면 추력 자체가 0 이라 활공만 한다.
  const top = hard ? spec.overdriveSpeed : boosting ? spec.boostSpeed : spec.maxSpeed;
  const push = dry ? 0 : hard ? spec.overdriveThrust : boosting ? spec.boostThrust : spec.thrust;
  const ceiling = top * (ground ? 1 : 1 + DIVE_MARGIN * Math.max(0, -Math.sin(state.pitch)));
  state.speed = clamp(state.speed + (state.throttle * push - drag - gravityAlong) * dt, 0, ceiling);
  // 조종면은 흐르는 공기로 듣는다. 느릴수록 기수와 뱅크가 무겁다.
  const authority = ground ? 1 : clamp(state.speed / 40, 0.32, 1.15);
  state.pitch = clamp(state.pitch + (pitchInput * spec.pitchAuthority * authority - state.pitch * (pitchInput ? 0.12 : 0.35)) * dt, -1.15, 1.15);
  state.roll += (rollInput * -spec.rollAuthority * authority * TURN_BANK_RATIO - state.roll) * (1 - Math.exp(-dt * 3));
  if (ground) {
    state.y = FLIGHT_GROUND;
    state.roll=0;state.climb=0;
    // 지상 조향은 앞바퀴가 맡는다. 멈춰 있으면 돌지 않고, 빨라질수록 조향각이 줄어든다.
    const steer = clamp(yawInput + rollInput, -1, 1);
    state.heading -= steer * 0.55 * dt * Math.min(1, state.speed / 6) * (1 - Math.min(0.65, state.speed / 80));
    state.pitch = clamp(state.pitch, 0, 0.24);
    if (braking) state.message = '브레이크';
    else if (state.message === '브레이크') state.message = '';
    if (!braking && state.speed > spec.stallSpeed * ROTATE_RATIO && state.pitch > 0.09) { state.phase = 'airborne'; state.message = ''; }
  }
  if (state.phase === 'airborne') {
    // 실제 뱅크는 얕지만 러더와 날개 조종면이 부족한 선회력을 보충한다.
    // 뱅크를 줄이기 전의 유효 각을 사용하므로 빠를수록 선회가 완만해지는 특성도 남는다.
    const effectiveRoll = state.roll / TURN_BANK_RATIO;
    state.heading += (Math.tan(clamp(effectiveRoll, -1.2, 1.2)) * GRAVITY / Math.max(30, state.speed) * 1.9 - yawInput * 0.5) * dt;
    if(guard.active) state.message=guard.message;
    else if(state.message?.includes('비행 구역')) state.message='';
    // 받음각은 기수각에서 실제 상승각을 뺀 값이다. 임계 받음각을 넘으면 양력이 무너진다.
    const climbAngle = Math.atan2(finite(state.climb), Math.max(8, state.speed * Math.cos(state.pitch)));
    const liftLoss = Math.min(0.85, Math.max(0, state.pitch - climbAngle - STALL_AOA) * 2.4);
    // 선회 중 양력 손실은 실제보다 절반만 반영한다. 기울일 때마다 고도가 뚝 떨어지면 조종이 답답하다.
    const bank = Math.max(0.68, 1 - (1 - Math.cos(clamp(effectiveRoll, -1.4, 1.4))) * 0.5);
    const lift = Math.min(1, (state.speed / spec.stallSpeed) ** 2) * (1 - liftLoss) * bank;
    // 상승률은 관성 때문에 기수를 따라 곧바로 붙지 않는다. 이 지연이 받음각을 만든다.
    const target = Math.sin(state.pitch) * state.speed * lift - (1 - lift) * 15;
    state.climb = finite(state.climb) + (target - finite(state.climb)) * (1 - Math.exp(-dt * (6 + lift * 4)));
    state.y += state.climb * dt;
    if (liftLoss > 0.3 || lift < 0.3) {
      // 실속하면 기수가 스스로 떨어지고 항력이 늘어난다. 고도를 내주고 속도를 얻어야 회복한다.
      state.pitch = clamp(state.pitch - (0.35 + liftLoss * 0.6) * dt, -1.15, 1.15);
      state.speed = clamp(state.speed - state.speed * 0.09 * dt, 0, ceiling);
      if (!guard.active) state.message = '실속 · 기수를 낮추고 속도를 올리세요';
    } else if (state.message?.includes('실속')) state.message = '';
  }
  state.x -= Math.sin(state.heading) * Math.cos(state.pitch) * state.speed * dt;
  state.z -= Math.cos(state.heading) * Math.cos(state.pitch) * state.speed * dt;
  if(hitsAnyBuilding(previous,state,buildings,null,FLIGHT_CLEARANCE))return crash(state);
  if(state.y<=FLIGHT_GROUND) {
    if(onRunway(state,extent)) {
      if(state.phase==='airborne'){state.message='착륙 완료 · 스로틀을 줄여 감속하세요';state.pitch=0;}
      state.phase='runway';state.y=FLIGHT_GROUND;state.roll=0;
    } else return crash(state);
  }
  // 화면과 소리가 같은 값을 읽도록 물리 상태에 남긴다. flightStatus 가 다시 계산하지 않아도 된다.
  state.supersonic = machOf(state.speed) >= 1 && state.phase === 'airborne';
  const roof = CEILING + FLIGHT_GROUND;
  if (state.y > roof) { state.y = roof; state.pitch = Math.min(0, state.pitch); }
  return state;
}
