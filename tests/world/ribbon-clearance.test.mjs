import test from 'node:test';
import assert from 'node:assert/strict';
import { roadClearance } from '../../shared/roadClearance.js';

test('ramp clearance contains the outer miter, not only the centerline half-width capsule', () => {
  const ramp = {width: 10, points: [[0, 0, 4, 10], [20, 0, 4, 10], [20, 20, 4, 10]]};
  const clearance = roadClearance({roads: [], bridges: [], ramps: [ramp]});
  // The shared outer corner is (25,-5). It lies outside either old radius-5 endpoint cap.
  assert.equal(clearance.columnClear(24.9, -4.9, 0, 0, 7), false);
  const source = {x1: 24.9, z1: -6, x2: 24.9, z2: -4, y: 4};
  assert.notDeepEqual(clearance.clearSpans(source), [[0, 1]], 'a rail can pierce the outer miter');
  assert.equal(clearance.columnClear(40, -20, 0, 0, 7), true);
  assert.equal(clearance.columnClear(24.9, -4.9, 0, 12, 15), true, 'unrelated upper level should stay clear');
});
