const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));
export const FLIGHT_GROUND = 2.1;

export function flightStatus(state) {
  const degrees = 180 / Math.PI;
  return {
    speed: Math.round(state.speed * 3.6), altitude: Math.max(0, Math.round(state.y - FLIGHT_GROUND)),
    heading: ((Math.round(-state.heading * degrees) % 360) + 360) % 360,
    pitch: Math.round(state.pitch * degrees), roll: Math.round(state.roll * degrees),
    throttle: state.throttle, phase: state.phase, message: state.message,
  };
}

export function createFlightState(extent = 180) {
  return { x: finite(extent, 180) + 110, y: FLIGHT_GROUND, z: 140, heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0, phase: 'runway', message: '' };
}

export function stepFlight(previous, input = {}, delta = 0, extent = 180) {
  const dt = clamp(delta, 0, 0.05);
  const state = { ...previous };
  if (!['x', 'y', 'z', 'speed', 'pitch', 'roll', 'heading'].every((field) => Number.isFinite(state[field]))) return createFlightState(extent);
  state.throttle = clamp(input.throttle, 0, 1);
  const pitchInput = clamp(input.pitch, -1, 1), rollInput = clamp(input.roll, -1, 1), yawInput = clamp(input.yaw, -1, 1);
  state.speed = clamp(state.speed + (state.throttle * 17 - 2.5 - state.speed * 0.075) * dt, 0, 125);
  state.pitch = clamp(state.pitch + (pitchInput * 0.55 - state.pitch * (pitchInput ? 0.12 : 0.35)) * dt, -0.6, 0.65);
  state.roll += (rollInput * -0.85 - state.roll) * (1 - Math.exp(-dt * 3));
  if (state.phase === 'runway') {
    state.y = FLIGHT_GROUND;
    state.heading = 0;
    state.x = finite(extent, 180) + 110;
    state.roll = 0;
    state.pitch = clamp(state.pitch, 0, 0.24);
    if (state.speed > 34 && state.pitch > 0.09) { state.phase = 'airborne'; state.message = ''; }
  }
  if (state.phase === 'airborne') {
    // Positive heading turns left; a right bank and right rudder turn right.
    state.heading += (state.roll * 0.58 - yawInput * 0.5) * dt;
    state.y += (Math.sin(state.pitch) * state.speed - Math.max(0, 30 - state.speed) * 0.55) * dt;
  }
  state.x -= Math.sin(state.heading) * Math.cos(state.pitch) * state.speed * dt;
  state.z -= Math.cos(state.heading) * Math.cos(state.pitch) * state.speed * dt;
  const boundary = Math.max(2000, finite(extent, 180) * 3);
  let message = '';
  if (state.phase === 'airborne' && state.y <= FLIGHT_GROUND) message = '안전하게 활주로로 돌아왔어요';
  if (state.phase === 'runway' && state.z < -170) message = '활주로 끝 · 다시 이륙해 보세요';
  if (Math.abs(state.x) > boundary || Math.abs(state.z) > boundary) message = '비행 구역 끝 · 활주로로 돌아왔어요';
  if (message) return { ...createFlightState(extent), message };
  if (state.y > 850) { state.y = 850; state.pitch = Math.min(0, state.pitch); }
  return state;
}
