import { CEILING, FLIGHT_GROUND, GRAVITY, flightBoundary, GUARD_RELEASE } from './flightPhysics.js';
import { FLIGHT_CLEARANCE, hitsAnyBuilding } from './solidIndex.js';

/** 헬기 비행 물리. 고정익과 상태 모양은 같지만 양력이 속도가 아니라 로터에서 나온다.
 * 조작은 방향키가 collective(로터 추진력), WASD 가 cyclic 과 기수 방향이다.
 * 활주로가 없어도 평지에 내려앉는다. 내려꽂듯 닿으면 추락이다.
 */
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));

export const HOVER_COLLECTIVE = 0.42;
export const ROTOR_THRUST = 23;
export const HARD_LANDING = 9;
const TILT = 0.55;
// 로터 디스크를 기울이면 추력의 수평 성분이 곧 추진력이다. 기울기만으로는 너무 느려 이득을 곱한다.
// 고정익 최고 속도를 10 퍼센트 깎은 것과 맞춰 이 이득도 같은 비율로 줄였다.
const CYCLIC_GAIN = 2.16;

export function createRotorState(extent = 180) {
  // 헬리패드 자리다(airportLayout.FACILITIES 의 helipad, 로컬 -55,-60). 터미널 단지가
  // 서쪽으로 20 옮겨지며 헬리패드도 함께 옮겨 이 값도 같이 바꿨다.
  return { x: finite(extent, 180) + 55, y: FLIGHT_GROUND, z: -60, heading: 0, pitch: 0, roll: 0,
    vx: 0, vy: 0, vz: 0, speed: 0, climb: 0, throttle: 0, phase: 'runway', message: '' };
}

function crash(state) {
  return { ...state, phase: 'crashed', speed: 0, vx: 0, vy: 0, vz: 0, throttle: 0, crashElapsed: 0, message: '충돌 · 3초 후 착륙장으로 돌아갑니다' };
}

/** 페달 한 번에 기수가 도는 각속도(rad/s) 다. */
const PEDAL_RATE = 0.92;

export function stepRotor(previous, input = {}, delta = 0, extent = 180, buildings = []) {
  const dt = clamp(delta, 0, 0.05);
  const state = { ...previous };
  if (!['x', 'y', 'z', 'vx', 'vy', 'vz', 'pitch', 'roll', 'heading'].every((field) => Number.isFinite(state[field]))) return createRotorState(extent);
  if (state.phase === 'crashed') {
    state.crashElapsed = (state.crashElapsed || 0) + Math.max(0, finite(delta));
    if (state.crashElapsed >= 3 - 1e-9) return createRotorState(extent);
    state.message = `충돌 · ${Math.ceil(3 - state.crashElapsed)}초 후 착륙장으로 돌아갑니다`;
    return state;
  }
  state.throttle = clamp(input.throttle, 0, 1);
  const cyclic = clamp(input.pitch, -1, 1), pedal = clamp(input.roll, -1, 1), lateral = clamp(input.yaw, -1, 1);
  const grounded = state.phase === 'runway';

  // 기수 숙임과 옆으로 기울임이 곧 추진 방향이다. 자세는 입력을 부드럽게 따라간다.
  const follow = 1 - Math.exp(-dt * 3.4);
  state.pitch += (-cyclic * TILT - state.pitch) * follow;
  state.roll += (-lateral * TILT * 0.8 - state.roll) * follow;
  // A/D 는 꼬리 로터 페달이라 기수를 바로 돌린다. 고정익 rollAuthority 와 같이 0.8 배로 낮췄다.
  state.heading -= pedal * PEDAL_RATE * dt;

  const thrust = state.throttle * ROTOR_THRUST;
  const tiltCos = Math.cos(state.pitch) * Math.cos(state.roll);
  state.vy += (thrust * tiltCos - GRAVITY) * dt - state.vy * 0.22 * dt;

  // 접지 상태에서는 로터가 무게를 확실히 들 때만 뜬다. 그 전에는 스키드가 기체를 붙잡는다.
  if (grounded) {
    if (thrust * tiltCos > GRAVITY + 0.4) state.phase = 'airborne';
    else state.vy = Math.min(0, state.vy) * 0;
  }
  const airborne = state.phase === 'airborne';
  const forward = Math.sin(-state.pitch) * thrust * CYCLIC_GAIN, side = Math.sin(state.roll) * thrust * CYCLIC_GAIN;
  const push = airborne ? 1 : 0.25;
  state.vx += (-Math.sin(state.heading) * forward + Math.cos(state.heading) * side) * push * dt;
  state.vz += (-Math.cos(state.heading) * forward - Math.sin(state.heading) * side) * push * dt;
  // 회전익기는 전진 속도가 붙을수록 항력이 빠르게 커진다. 최고 속도는 고정익보다 낮다.
  const groundDrag = grounded ? 2.6 : 0;
  const level = Math.hypot(state.vx, state.vz);
  if (level > 0) {
    const decel = Math.min(level, (level * level * 0.003 + level * 0.22 + groundDrag) * dt);
    state.vx -= state.vx / level * decel;
    state.vz -= state.vz / level * decel;
  }
  state.vx = clamp(state.vx, -90, 90); state.vz = clamp(state.vz, -90, 90); state.vy = clamp(state.vy, -70, 60);

  // 경계를 넘으면 조종을 회수해 도시 쪽으로 끌고 온다. 안쪽으로 충분히 들어오면 돌려준다.
  // 방향은 원점을 향한 단위 벡터다. 예전 삼각함수 식은 부호가 뒤집혀 밖으로 밀었다.
  const limit = flightBoundary(extent);
  const radius = Math.hypot(state.x, state.z);
  state.guard = state.guard ? radius > limit * GUARD_RELEASE : radius > limit;
  if (state.guard) {
    const toward = Math.max(1e-6, radius);
    const want = 46;
    const tx = (-state.x / toward) * want, tz = (-state.z / toward) * want;
    const blend = 1 - Math.exp(-dt * 1.6);
    state.vx += (tx - state.vx) * blend; state.vz += (tz - state.vz) * blend;
    state.message = '비행 구역 이탈 · 자동으로 도시 안쪽으로 돌아갑니다';
  } else if (state.message?.includes('비행 구역')) state.message = '';

  const from = { x: state.x, y: state.y, z: state.z };
  state.x += state.vx * dt; state.y += state.vy * dt; state.z += state.vz * dt;
  state.speed = Math.hypot(state.vx, state.vz);
  state.climb = state.vy;
  if (hitsAnyBuilding(from, state, buildings, null, FLIGHT_CLEARANCE)) return crash(state);

  if (state.y <= FLIGHT_GROUND) {
    // 평지 어디에나 내려앉는다. 다만 내려꽂는 속도면 기체가 부서진다.
    if (airborne && state.vy < -HARD_LANDING) return crash(state);
    state.y = FLIGHT_GROUND;
    state.vy = 0;
    if (airborne) state.message = '착지 완료 · 로터 출력을 낮추세요';
    state.phase = 'runway';
  }
  // 천장은 고정익과 같다. flightPhysics 한 곳에서 읽는다.
  const roof = CEILING + FLIGHT_GROUND;
  if (state.y > roof) { state.y = roof; state.vy = Math.min(0, state.vy); }
  if (!state.message && airborne && state.throttle < HOVER_COLLECTIVE - 0.06 && state.vy < -4) state.message = '하강 중 · 방향키 위로 로터 출력을 올리세요';
  else if (state.message?.includes('하강 중') && state.vy >= -4) state.message = '';
  return state;
}
