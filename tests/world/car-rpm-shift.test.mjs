import test from 'node:test';
import assert from 'node:assert/strict';
import { carStatus, createCarState, stepCar, VEHICLES } from '../../src/world/carPhysics.js';
import { ROWS, cityExtentForCount } from '../../shared/urbanPlan.js';

const EXTENT = cityExtentForCount(1000);
const DT_RATES = [30, 60, 120];

function onRoad(kind) {
  return { ...createCarState(EXTENT, kind), x: 0, z: ROWS[1] * EXTENT, heading: Math.PI / 2 };
}

function targetRpm(kind, gear, speed) {
  const spec = VEHICLES[kind];
  const ceiling = spec.top * spec.gears[gear - 1];
  return Math.round(Math.min(spec.maxRpm || 8000,
    800 + Math.min(Math.abs(speed) / ceiling, 1.13) * ((spec.shiftRpm || 7200) - 800)));
}

test('upshift RPM falls across a short interval and reaches the new gear at 30, 60 and 120 Hz', () => {
  for (const fps of DT_RATES) {
    const dt = 1 / fps;
    let state = { ...onRoad('supercar'), speed: 10.5, gear: 1, rpm: 8000 };
    state = stepCar(state, { throttle: 1 }, dt, EXTENT, [], 'supercar');
    assert.equal(state.gear, 2);
    assert.ok(state.rpm < 8000, `${fps} Hz should start the drop`);
    assert.ok(state.rpm > targetRpm('supercar', 2, state.speed) + 500,
      `${fps} Hz should not drop instantly`);
    assert.equal(carStatus(state, 'supercar').rpm, state.rpm);
    for (let frame = 1; frame < Math.ceil(.25 * fps); frame++) {
      state = stepCar(state, { throttle: 1 }, dt, EXTENT, [], 'supercar');
    }
    assert.ok(Math.abs(state.rpm - targetRpm('supercar', 2, state.speed)) <= 1,
      `${fps} Hz should settle by 0.25 s`);
  }
});

test('downshift RPM rises smoothly and ordinary RPM has no added lag', () => {
  for (const fps of DT_RATES) {
    const dt = 1 / fps;
    let state = { ...onRoad('supercar'), speed: 6.8, gear: 2, rpm: 3500 };
    state = stepCar(state, {}, dt, EXTENT, [], 'supercar');
    assert.equal(state.gear, 1);
    assert.ok(state.rpm > 3500 && state.rpm < targetRpm('supercar', 1, state.speed),
      `${fps} Hz downshift should start rising without jumping`);
    for (let frame = 1; frame < Math.ceil(.25 * fps); frame++) {
      state = stepCar(state, {}, dt, EXTENT, [], 'supercar');
    }
    assert.ok(Math.abs(state.rpm - targetRpm('supercar', 1, state.speed)) <= 1);
    state = stepCar(state, { throttle: 1 }, dt, EXTENT, [], 'supercar');
    assert.equal(state.rpm, targetRpm('supercar', state.gear, state.speed),
      `${fps} Hz normal driving RPM should follow speed directly`);
  }
});

test('switching between forward and reverse does not jump RPM', () => {
  let state = { ...onRoad('sedan'), speed: -0.2, gear: 1, rpm: 3000 };
  state = stepCar(state, { reverse: 1 }, 1 / 60, EXTENT, [], 'sedan');
  assert.equal(state.gear, 'R');
  assert.ok(state.rpm < 3000 && state.rpm > 1000);
  state = stepCar({ ...state, speed: 0.2 }, { throttle: 1 }, 1 / 60, EXTENT, [], 'sedan');
  assert.equal(state.gear, 1);
  assert.ok(state.rpm > 800 && state.rpm < 3000);
});

test('electric drive and respawn clear shift RPM state', () => {
  const electric = stepCar({ ...onRoad('electric'), rpm: 7000, rpmShiftElapsed: .05, rpmShiftFrom: 7000 },
    { throttle: 1 }, 1 / 60, EXTENT, [], 'electric');
  assert.equal(electric.rpm, 0);
  assert.equal(carStatus(electric, 'electric').rpm, 0);
  assert.equal(electric.rpmShiftElapsed, undefined);
  assert.equal(electric.rpmShiftFrom, undefined);

  const crashed = { ...onRoad('supercar'), phase: 'crashed', crashElapsed: 0,
    rpmShiftElapsed: .05, rpmShiftFrom: 8000 };
  const stopped = stepCar(crashed, {}, 1 / 60, EXTENT, [], 'supercar');
  assert.equal(stopped.rpmShiftElapsed, undefined);
  assert.equal(stopped.rpmShiftFrom, undefined);
  const respawned = stepCar({ ...stopped, crashElapsed: 2.99 }, {}, 1 / 60, EXTENT, [], 'supercar');
  assert.equal(respawned.rpm, 800);
  assert.equal(respawned.rpmShiftElapsed, undefined);
  assert.equal(respawned.rpmShiftFrom, undefined);
});
