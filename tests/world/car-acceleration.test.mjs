import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES, carStatus, createCarState, stepCar } from '../../src/world/carPhysics.js';
import { ROWS, cityExtentForCount } from '../../shared/urbanPlan.js';

const EXTENT = cityExtentForCount(1000);
const TARGETS = {
  sedan: [100, 5.5], suv: [100, 6], coupe: [100, 4.9],
  supercar: [100, 2.4], convertible: [100, 4.4], formula: [100, 2.7],
  electric: [100, 3.2], motorcycle: [100, 3.21], drift: [100, 4],
  truck: [100, 18], tank: [32, 7], howitzer: [32, 9],
  armored: [60, 12], aa: [60, 14],
};

function onRoad(kind) {
  return { ...createCarState(EXTENT, kind), x: 0, z: ROWS[1] * EXTENT, heading: Math.PI / 2 };
}

function sprint(kind, kmh, fps) {
  const threshold = kmh / 3.6, dt = 1 / fps;
  let state = onRoad(kind), shifts = 0, priorGear = state.gear;
  for (let frame = 0; frame < 30 * fps; frame++) {
    const previousSpeed = state.speed;
    state = stepCar(state, { throttle: 1 }, dt, EXTENT, [], kind);
    assert.equal(state.phase, 'drive', `${kind} left the clear road`);
    if (state.gear !== priorGear) shifts += 1;
    priorGear = state.gear;
    if (state.speed >= threshold) {
      const fraction = (threshold - previousSpeed) / (state.speed - previousSpeed);
      return { seconds: (frame + fraction) * dt, shifts, state };
    }
  }
  throw new Error(`${kind} did not reach ${kmh} km/h`);
}

test('every ground vehicle reaches its measured or gameplay sprint target at 30, 60 and 120 Hz', () => {
  assert.deepEqual(Object.keys(VEHICLES).sort(), Object.keys(TARGETS).sort());
  for (const [kind, [kmh, target]] of Object.entries(TARGETS)) {
    for (const fps of [30, 60, 120]) {
      const result = sprint(kind, kmh, fps);
      assert.ok(Math.abs(result.seconds - target) < 0.12,
        `${kind} ${kmh} km/h at ${fps} Hz: ${result.seconds.toFixed(3)}s, target ${target}s`);
      if (kind === 'electric') assert.equal(result.shifts, 0);
      else assert.ok(result.shifts > 0, `${kind} must shift while accelerating`);
    }
  }
});

test('drive force still approaches top speed and braking and reverse work', () => {
  for (const kind of Object.keys(VEHICLES)) {
    const spec = VEHICLES[kind];
    let state = { ...onRoad(kind), speed: spec.top * 0.9 };
    for (let frame = 0; frame < 180; frame++) state = stepCar(state, { throttle: 1 }, 1 / 60, EXTENT, [], kind);
    assert.ok(state.speed > spec.top * 0.9 && state.speed <= spec.top,
      `${kind} no longer approaches its configured top speed`);
    for (let frame = 0; frame < 360; frame++) state = stepCar(state, { brake: true }, 1 / 60, EXTENT, [], kind);
    assert.equal(state.speed, 0, `${kind} brakes to rest`);
    for (let frame = 0; frame < 60; frame++) state = stepCar(state, { reverse: 1 }, 1 / 60, EXTENT, [], kind);
    assert.ok(state.speed < 0, `${kind} reverses`);
  }
});

test('supercar eight-speed telemetry permits 8500 RPM on a 10000 RPM dial', () => {
  assert.equal(VEHICLES.supercar.gears.length, 8);
  const atTop = stepCar({ ...onRoad('supercar'), gear: 8, speed: VEHICLES.supercar.top },
    { throttle: 1 }, 1 / 60, EXTENT, [], 'supercar');
  assert.equal(atTop.rpm, 8500);
  const status = carStatus({ ...onRoad('supercar'), gear: 8, rpm: 8500 }, 'supercar');
  assert.equal(status.rpm, 8500);
  assert.equal(status.maxRpm, 8500);
  assert.equal(status.redlineRpm, 8000);
  assert.equal(status.dialMaxRpm, 10000);
  assert.equal(status.redline, true);
  assert.equal(carStatus({ ...onRoad('sedan'), rpm: 9000 }, 'sedan').rpm, 8000);
});
