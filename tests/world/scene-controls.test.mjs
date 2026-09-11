import test from 'node:test';
import assert from 'node:assert/strict';
import { damping, boundedTarget, safeDelta, altitudeInput, focusPose } from '../../src/world/controls.js';

test('camera interpolation is independent of frame frequency', () => {
  let thirty = 0, sixty = 0;
  for (let i = 0; i < 30; i++) thirty += (100 - thirty) * damping(1 / 30);
  for (let i = 0; i < 60; i++) sixty += (100 - sixty) * damping(1 / 60);
  assert.ok(Math.abs(thirty - sixty) < 1e-9);
  assert.ok(thirty > 99 && thirty < 100);
});

test('resuming a background tab caps travel and invalid frame time cannot move camera', () => {
  assert.equal(safeDelta(60), 0.05);
  assert.equal(safeDelta(-1), 0);
  assert.equal(safeDelta(NaN), 0);
});

test('camera cannot leave actual city bounds or go underground', () => {
  assert.deepEqual(boundedTarget({ x: 999, y: -5, z: -999 }, 150), { x: 150, y: 2, z: -150 });
  assert.deepEqual(boundedTarget({ x: 25, y: 900, z: 40 }, 150), { x: 25, y: 140, z: 40 });
});

test('invalid focus coordinates and extent always resolve to a finite home target', () => {
  assert.deepEqual(boundedTarget({ x: NaN, y: Infinity, z: undefined }, 150), { x: 0, y: 4, z: 0 });
  assert.deepEqual(boundedTarget({ x: 999, y: 5, z: -999 }, NaN), { x: 180, y: 5, z: -180 });
  assert.deepEqual(boundedTarget(null, 150), { x: 0, y: 4, z: 0 });
});

test('focus frames a tall landmark farther away and honors its elevated focus point', () => {
  const low = focusPose({ x: 32, z: 32, height: 20, y: 7 }, 500);
  const tall = focusPose({ x: 32, z: 32, height: 182, y: 63.7 }, 500);
  assert.equal(tall.target.y, 63.7);
  assert.ok(tall.position.z - tall.target.z > (low.position.z - low.target.z) * 2);
  assert.deepEqual(focusPose({ x: 0, z: 0 }, 500).position, { x: 150, y: 155, z: 185 });
});

test('altitude aliases agree without doubling speed and opposing keys cancel', () => {
  for (const code of ['KeyE', 'Space', 'ShiftLeft', 'ShiftRight']) assert.equal(altitudeInput(new Set([code])), 1);
  for (const code of ['KeyQ', 'ControlLeft', 'ControlRight']) assert.equal(altitudeInput(new Set([code])), -1);
  assert.equal(altitudeInput(new Set(['Space', 'ShiftLeft', 'KeyE'])), 1);
  assert.equal(altitudeInput(new Set(['Space', 'ControlLeft'])), 0);
});
