import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight, flightStatus } from '../../src/world/flightPhysics.js';

test('jet starts stationary on the runway and zero throttle keeps it parked', () => {
  let state = createFlightState(300);
  for (let i = 0; i < 120; i++) state = stepFlight(state, {}, 1 / 60, 300);
  assert.equal(state.x, 410);
  assert.equal(state.z, 140);
  assert.equal(state.speed, 0);
  assert.equal(state.phase, 'runway');
});

test('full throttle and pitch up can take off before the runway ends', () => {
  let state = createFlightState(300);
  for (let i = 0; i < 360; i++) state = stepFlight(state, { throttle: 1, pitch: 0.5 }, 1 / 60, 300);
  assert.equal(state.phase, 'airborne');
  assert.ok(state.y > 10);
  assert.ok(state.z > -180);
});

test('throttle alone keeps the jet grounded and runway excursion resets safely', () => {
  let state = createFlightState(300);
  for (let i = 0; i < 600; i++) state = stepFlight(state, { throttle: 1 }, 1 / 60, 300);
  assert.equal(state.phase, 'runway');
  assert.ok(state.z >= -170);
  assert.ok(state.y >= 2);
});

test('clamps throttle and frame time, and rejects nonfinite inputs', () => {
  for (const dt of [NaN, Infinity, -1, 100, 0.016]) {
    const state = stepFlight(createFlightState(300), { throttle: 20, pitch: NaN, roll: Infinity, yaw: -Infinity }, dt, 300);
    for (const field of ['x', 'y', 'z', 'pitch', 'roll', 'heading', 'speed', 'throttle']) assert.ok(Number.isFinite(state[field]), field);
    assert.ok(state.throttle >= 0 && state.throttle <= 1);
    assert.ok(state.speed < 2);
  }
  assert.equal(stepFlight(createFlightState(300), { throttle: -3 }, 0.016, 300).throttle, 0);
});

test('reset restores runway position and ground contact safely returns to runway', () => {
  const state = stepFlight({ ...createFlightState(300), phase: 'airborne', y: 2.01, pitch: -0.5, speed: 55 }, { throttle: 0 }, 0.05, 300);
  assert.deepEqual([state.x, state.z, state.speed, state.phase], [410, 140, 0, 'runway']);
  assert.ok(state.message);
  assert.equal(createFlightState(300).throttle, 0);
});

test('cockpit reports speed in km/h and compass clockwise degrees with pitch and bank', () => {
  const status = flightStatus({ ...createFlightState(300), speed: 50, y: 102.1, heading: -Math.PI / 2, pitch: Math.PI / 6, roll: -Math.PI / 4 });
  assert.equal(status.speed, 180);
  assert.equal(status.heading, 90);
  assert.equal(status.pitch, 30);
  assert.equal(status.roll, -45);
  assert.equal(status.altitude, 100);
  assert.equal(flightStatus({ ...createFlightState(), heading: Math.PI * 6 }).heading, 0);
});

test('mobile normalized controls accelerate, rotate, climb and bank after takeoff', () => {
  let state = createFlightState(300);
  const mobile = { throttle: 0.85, pitch: 0, roll: 0, yaw: 0 };
  for (let i = 0; i < 240; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.equal(state.phase, 'runway');
  assert.ok(state.speed > 34);
  assert.ok(state.z < 140);
  mobile.pitch = 0.65;
  for (let i = 0; i < 120; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.equal(state.phase, 'airborne');
  assert.ok(state.y > 20);
  assert.ok(state.z > -170);
  mobile.roll = 0.5; mobile.yaw = 0.2;
  for (let i = 0; i < 120; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.ok(state.x > 410);
  assert.ok(flightStatus(state).heading > 0);
  const airborneSpeed = state.speed;
  mobile.throttle = 0;
  for (let i = 0; i < 60; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.ok(state.speed < airborneSpeed);
});
