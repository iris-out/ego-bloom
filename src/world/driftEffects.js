import { FOUR_VEHICLE_LAYOUT } from './models/fourVehicleLayout.js';

export const SKID_LIFE = 12;
export const SMOKE_LIFE = 1.5;
const REAR_Z = FOUR_VEHICLE_LAYOUT.convertible.wheels.rearZ;
// DriftCar's widened track; its donor still supplies axle position and contact height.
const TRACK = 1.035;
const CONTACT_Y = FOUR_VEHICLE_LAYOUT.convertible.wheels.y - FOUR_VEHICLE_LAYOUT.convertible.wheels.radius;

export function rearContacts(state) {
  const pitch = state.roadPitch || 0, heading = state.heading;
  const localZ = CONTACT_Y * Math.sin(pitch) + REAR_Z * Math.cos(pitch);
  const y = state.y + CONTACT_Y * Math.cos(pitch) - REAR_Z * Math.sin(pitch);
  return [-1, 1].map(side => [
    state.x + side * TRACK * Math.cos(heading) + localZ * Math.sin(heading),
    y,
    state.z - side * TRACK * Math.sin(heading) + localZ * Math.cos(heading),
  ]);
}

export function createDriftEffects() {
  return {
    time: 0, previous: null, skidCursor: 0, smokeCursor: 0, smokeClock: 0, serial: 0,
    skids: Array.from({ length: 320 }, () => ({ active: false, born: 0, a: [0, 0, 0], b: [0, 0, 0] })),
    smoke: Array.from({ length: 64 }, () => ({ active: false, born: 0, position: [0, 0, 0], seed: 0 })),
  };
}

export function stepDriftEffects(fx, state, delta, { paused = false, reducedMotion = false, drivingFrame = false } = {}) {
  // CarMode/carPhysics advance at most 50ms per rendered frame. Keep both
  // emission and fading on that same clock, including software rendering.
  if (drivingFrame) delta = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .05)) : 0;
  if (paused || !Number.isFinite(delta) || delta <= 0) return fx;
  fx.time += delta;
  for (const mark of fx.skids) if (fx.time - mark.born >= SKID_LIFE) mark.active = false;
  for (const puff of fx.smoke) if (reducedMotion || fx.time - puff.born >= SMOKE_LIFE) puff.active = false;
  const valid = state && ['x', 'y', 'z', 'heading', 'speed'].every(key => Number.isFinite(state[key]));
  if (!valid || state.phase !== 'drive' || !state.drift || Math.abs(state.speed) < 3 || delta > .25) {
    fx.previous = null;
    fx.smokeClock = 0;
    return fx;
  }
  const contacts = rearContacts(state);
  const previous = fx.previous;
  const distance = previous ? Math.hypot(...contacts[0].map((value, axis) => value - previous[0][axis])) : 0;
  if (previous && distance > Math.min(8, Math.max(3, Math.abs(state.speed) * delta * 3 + 1))) {
    fx.previous = contacts;
    fx.smokeClock = 0;
    return fx;
  }
  if (previous && distance >= .18) {
    for (let side = 0; side < 2; side++) {
      const mark = fx.skids[fx.skidCursor];
      mark.active = true;
      mark.born = fx.time;
      for (let axis = 0; axis < 3; axis++) {
        mark.a[axis] = previous[side][axis];
        mark.b[axis] = contacts[side][axis];
      }
      fx.skidCursor = (fx.skidCursor + 1) % fx.skids.length;
    }
    fx.previous = contacts;
  } else if (!previous) fx.previous = contacts;
  fx.smokeClock += delta;
  if (!reducedMotion && fx.smokeClock >= .06) {
    fx.smokeClock %= .06;
    for (const contact of contacts) {
      const puff = fx.smoke[fx.smokeCursor];
      puff.active = true;
      puff.born = fx.time;
      puff.seed = fx.serial++;
      for (let axis = 0; axis < 3; axis++) puff.position[axis] = contact[axis];
      fx.smokeCursor = (fx.smokeCursor + 1) % fx.smoke.length;
    }
  }
  return fx;
}
