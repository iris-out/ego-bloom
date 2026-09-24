import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriftEffects, stepDriftEffects, rearContacts } from '../../src/world/driftEffects.js';

const car = extra => ({ x: 0, y: .9, z: 0, heading: 0, speed: 15, phase: 'drive', drift: true, roadPitch: 0, ...extra });
const live = pool => pool.filter(item => item.active);

test('rear contact marks follow both tires at road height including incline and heading', () => {
  const flat = rearContacts(car());
  assert.deepEqual(flat, [[-1.035, 0, 1.37], [1.035, 0, 1.37]]);
  const uphill = rearContacts(car({ heading: Math.PI / 2, roadPitch: .2 }));
  assert.ok(uphill[0][1] < 0, 'rear axle follows rising forward road');
  assert.ok(uphill[0][0] > 1, 'rear wheels rotate with heading');
  assert.ok(uphill[0][2] > 1, 'left wheel rotates into positive Z');
});

test('moving drift leaves paired marks and smoke while idle/crash/straight driving emits nothing', () => {
  for (const inactive of [{ speed: 0 }, { drift: false }, { phase: 'crashed' }, { phase: 'sinking' }]) {
    const fx = createDriftEffects();
    stepDriftEffects(fx, car(inactive), .1);
    stepDriftEffects(fx, car({ ...inactive, z: -1 }), .1);
    assert.equal(live(fx.skids).length + live(fx.smoke).length, 0);
  }
  const fx = createDriftEffects();
  stepDriftEffects(fx, car(), .06);
  stepDriftEffects(fx, car({ z: -.6 }), .06);
  assert.equal(live(fx.skids).length, 2);
  assert.ok(live(fx.smoke).length >= 2);
  assert.ok(live(fx.skids).every(mark => Math.abs(mark.a[0]) === 1.035));
});

test('teleports and drift gaps never connect distant tire streaks', () => {
  const fx = createDriftEffects();
  stepDriftEffects(fx, car(), .1);
  stepDriftEffects(fx, car({ x: 100 }), .1);
  assert.equal(live(fx.skids).length, 0);
  stepDriftEffects(fx, car({ x: 100, drift: false }), .1);
  stepDriftEffects(fx, car({ x: 200 }), .1);
  assert.equal(live(fx.skids).length, 0);
});

test('a fast-car reset cannot draw a long stripe during a slow frame', () => {
  const fx = createDriftEffects();
  stepDriftEffects(fx, car({ speed: 68 }), .2);
  stepDriftEffects(fx, car({ speed: 68, x: 20 }), .2);
  assert.equal(live(fx.skids).length, 0);
});

test('effect pools stay bounded, expire, and freeze completely while paused', () => {
  const fx = createDriftEffects();
  for (let i = 0; i < 1000; i++) stepDriftEffects(fx, car({ z: -i * .3 }), .02);
  assert.equal(fx.skids.length, 320);
  assert.equal(fx.smoke.length, 64);
  const snapshot = JSON.stringify(fx);
  stepDriftEffects(fx, car(), 20, { paused: true });
  assert.equal(JSON.stringify(fx), snapshot);
  stepDriftEffects(fx, car({ drift: false }), 13);
  assert.equal(live(fx.skids).length + live(fx.smoke).length, 0);
});

test('reduced motion preserves tire evidence but suppresses airborne smoke', () => {
  const fx = createDriftEffects();
  stepDriftEffects(fx, car(), .1, { reducedMotion: true });
  stepDriftEffects(fx, car({ z: -1 }), .1, { reducedMotion: true });
  assert.equal(live(fx.skids).length, 2);
  assert.equal(live(fx.smoke).length, 0);
});

test('slow rendering frames keep effects on the car simulation clock and still emit', () => {
  const fx = createDriftEffects();
  const options = { drivingFrame: true };
  stepDriftEffects(fx, car(), .4, options);
  stepDriftEffects(fx, car({ z: -.75 }), .4, options);
  assert.equal(fx.time, .1);
  assert.equal(live(fx.skids).length, 2);
  assert.equal(live(fx.smoke).length, 2);
  const snapshot = JSON.stringify(fx);
  for (const delta of [NaN, Infinity, -1, 0]) stepDriftEffects(fx, car(), delta, options);
  stepDriftEffects(fx, car(), 10, { ...options, paused: true });
  assert.equal(JSON.stringify(fx), snapshot);
  stepDriftEffects(fx, car({ x: 100 }), .4, options);
  assert.equal(live(fx.skids).length, 2, 'teleports remain disconnected');
});
