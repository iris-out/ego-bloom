import test from 'node:test';
import assert from 'node:assert/strict';

import { bridgeSegment, onBridge } from '../../shared/bridgeGeometry.js';
import { addBridge, addInterchange, TRANSIT_MODEL_DEFAULTS } from '../../src/world/models/transitModels.js';
import { roadSurface } from '../../src/world/roadSurface.js';
import { roadRibbon } from '../../shared/roadRibbon.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { CAR_GROUND, createCarState, inWater, stepCar } from '../../src/world/carPhysics.js';
import { roadClearance } from '../../shared/roadClearance.js';
import { hitsBuilding } from '../../src/world/solidIndex.js';

function collectBridge(bridge, options = {}) {
  const parts = [];
  addBridge((material, position, scale, owner, shape, rotation) => {
    parts.push({ material, position, scale, owner, shape, rotation });
  }, bridge, 'medium', options);
  return parts;
}

test('endpoint and legacy bridges share one oriented deck footprint', () => {
  const oblique = { x1: 0, z1: 0, x2: 60, z2: 80, width: 15 };
  const segment = bridgeSegment(oblique);
  assert.deepEqual(
    { x1: segment.x1, z1: segment.z1, x2: segment.x2, z2: segment.z2, length: segment.length, width: segment.width },
    { x1: 0, z1: 0, x2: 60, z2: 80, length: 100, width: 15 },
  );
  assert.ok(Math.abs(segment.rotation - Math.atan2(60, 80)) < 1e-12);
  assert.equal(onBridge(oblique, 30, 40), true);
  assert.equal(onBridge(oblique, -30, 40), false);

  const legacy = bridgeSegment({ x: 12, z: -8, axis: 'x', length: 50, width: 10 });
  const endpoints = bridgeSegment({ x1: -13, z1: -8, x2: 37, z2: -8, width: 10 });
  for (const field of ['x1', 'z1', 'x2', 'z2', 'cx', 'cz', 'length', 'width', 'rotation', 'ux', 'uz', 'px', 'pz']) {
    assert.equal(legacy[field], endpoints[field], field);
  }
});

test('canonical bridge segment preserves source and elevation identity for clearance consumers', () => {
  const sourceRoad = { id: 'support-road' };
  const segment = bridgeSegment({ x1: 0, z1: 0, x2: 0, z2: 20, width: 12, sourceRoad, sourcePath: 'ring', deckY: 4 });
  assert.equal(segment.sourceRoad, sourceRoad);
  assert.equal(segment.sourcePath, 'ring');
  assert.equal(segment.deckY, 4);
});

test('arbitrary-angle bridge deck, marking and rails use the canonical orientation', () => {
  const bridge = { x1: 0, z1: 0, x2: 60, z2: 80, width: 15, big: false };
  const parts = collectBridge(bridge);
  const deck = parts.find((part) => part.material === 'road');
  const marking = parts.find((part) => part.material === 'marking');
  const rails = parts.filter((part) => part.material === 'steel');

  assert.deepEqual(deck.position.slice(0, 1).concat(deck.position[2]), [30, 40]);
  assert.deepEqual(deck.scale, [15, TRANSIT_MODEL_DEFAULTS.bridgeDeckThickness, 100]);
  assert.ok(Math.abs(deck.rotation - Math.atan2(60, 80)) < 1e-12);
  assert.equal(marking.rotation, deck.rotation);
  assert.equal(rails.length, 2);
  assert.ok(rails.every((rail) => rail.rotation === deck.rotation && rail.scale[2] === 100));
});

test('bridge rails are sliced into the clear spans reported for each side', () => {
  const bridge = { x1: 0, z1: 0, x2: 60, z2: 80, width: 15, big: false };
  const calls = [];
  const clearance = {
    clearSpans(segment, offset, margin) {
      calls.push({ segment, offset, margin });
      return [[0, 0.35], [0.65, 1]];
    },
  };
  const rails = collectBridge(bridge, { clearance }).filter((part) => part.material === 'steel');

  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ segment }) => segment.x1 === 0 && segment.z2 === 80));
  assert.deepEqual(calls.map(({ offset }) => Math.sign(offset)).sort(), [-1, 1]);
  assert.ok(calls.every(({ margin }) => margin > 0));
  assert.equal(rails.length, 4);
  assert.ok(rails.every((rail) => Math.abs(rail.scale[2] - 35) < 1e-9));
});

test('same-level crossing cuts both bridge rails without treating the supporting road as a blocker', () => {
  const bridge = { x1: -100, z1: 0, x2: 100, z2: 0, width: 20, big: false, sourceRoad: 'bridge-road' };
  const supportingRoad = { id: 'bridge-road', x1: -120, z1: 0, x2: 120, z2: 0, kind: 'arterial' };
  const crossingRoad = { id: 'crossing-road', x1: 0, z1: -100, x2: 0, z2: 100, kind: 'lane' };
  const clearance = roadClearance({ roads: [supportingRoad, crossingRoad], ramps: [], bridges: [bridge] });
  const rails = collectBridge(bridge, { clearance }).filter((part) => part.material === 'steel');

  assert.equal(rails.length, 4, 'each side rail should retain one piece before and after the crossing');
  const xRanges = rails.map((rail) => [rail.position[0] - rail.scale[2] / 2, rail.position[0] + rail.scale[2] / 2]);
  assert.ok(xRanges.every(([from, to]) => to <= -5 || from >= 5), 'a rail still crosses the intersecting lane');
  assert.ok(xRanges.some(([from]) => from <= -99.9) && xRanges.some(([, to]) => to >= 99.9), 'own road removed bridge end rails');
});

test('interchange forwards shared clearance so ramp rails open at same-level crossings', () => {
  const ramp = {
    from: { x: -100, z: 0, y: 5 }, to: { x: 100, z: 0, y: 5 }, width: 15,
    points: [[-100, 0, 5, 15], [100, 0, 5, 15]], kind: 'ic',
  };
  const crossing = { id: 'deck-crossing', x1: 0, z1: -100, x2: 0, z2: 100,
    kind: 'lane', elevated: true, deckY: 5 };
  const clearance = roadClearance({ roads: [crossing], ramps: [ramp], bridges: [], highwayDeck: 5 });
  const parts = [];
  addInterchange((material, position, scale, owner, shape, rotation) => {
    parts.push({ material, position, scale, owner, shape, rotation });
  }, { kind: 'IC', x: 0, z: 0, ramps: [ramp] }, 'medium', { clearance });
  const rails = parts.filter((part) => part.material === 'steel');
  assert.equal(rails.length, 4, 'crossing should split both ramp rails');
});

test('ramp and merge surface remains continuous in both travel directions', () => {
  const ramp = { points: [
    [0, 100, -0.27, 10],
    [0, 50, 7, 10],
    [0, 0, 14, 10],
    [20, 0, 14, 2],
  ] };
  const plan = { roads: [], ramps: [ramp] };
  const triangles = roadRibbon(ramp.points, { offsetY: .6 }).triangles;
  const renderedTop = (x, z) => {
    for (const triangle of triangles) {
      const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = triangle;
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denominator) < 1e-9) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
      const w = 1 - u - v;
      if (u >= -1e-8 && v >= -1e-8 && w >= -1e-8) return u * ay + v * by + w * cy;
    }
    return null;
  };
  for (const points of [ramp.points, [...ramp.points].reverse()]) {
    let top = points[0][2] + 0.6;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i];
      for (let step = 0; step <= 40; step += 1) {
        const t = step / 40;
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const expected = renderedTop(x, z);
        assert.notEqual(expected, null, `rendered ribbon gap at span ${i}, t=${t}`);
        const next = roadSurface(plan, x, z, top);
        assert.ok(Math.abs(next.top - expected) < 1e-9, `surface gap at span ${i}, t=${t}`);
        assert.ok(Math.abs(next.top - top) < 0.2, `height cap at span ${i}, t=${t}`);
        top = next.top;
      }
    }
  }
});

test('merge surface follows its narrowing width without lifting a ground vehicle', () => {
  const plan = { roads: [], ramps: [{ points: [[0, 0, 14, 10], [20, 0, 14, 2]] }] };
  for (const z of [-1.39, 1.39]) {
    assert.equal(roadSurface(plan, 18, z, 14.6).top, 14.6, `visible tapered deck lost support at z=${z}`);
  }
  for (const z of [-1.41, 1.41]) {
    assert.equal(roadSurface(plan, 18, z, 14.6).top, 0.33, `average-width shelf remains at z=${z}`);
  }
  assert.equal(roadSurface(plan, 18, 0, 0.33).top, 0.33, 'ground vehicle teleported to the merge deck');
});

test('long highway endpoints do not create scale-dependent flat caps over a ramp', () => {
  const plan = {
    highwayDeck: 14,
    roads: [{ id: 'long-highway', x1: 0, z1: -3154, x2: 0, z2: 3154, kind: 'highway', elevated: true, deckY: 14 }],
    ramps: [{ points: [[0, -3154, 14, 28], [0, -3173.1666666666665, 13.606674440609577, 28]] }],
  };
  const z = -3165.5;
  const t = (z + 3154) / (-3173.1666666666665 + 3154);
  const expected = 14 + (13.606674440609577 - 14) * t + 0.6;
  assert.ok(Math.abs(roadSurface(plan, 0, z, 14.6).top - expected) < 1e-9);
});

test('surface accepts floating-point endpoint drift but not a visible cap extension', () => {
  const plan = { roads: [], ramps: [{ points: [[0, 0, 14, 10], [10, 0, 14, 10]] }] };
  assert.equal(roadSurface(plan, 10 + 1e-11, 0, 14.6).top, 14.6);
  assert.equal(roadSurface(plan, 10 + 1e-3, 0, 14.6).top, 0.33);
});

test('support solids can end at their visible roof while ordinary buildings keep roof clearance', () => {
  const from = { x: -2, y: 15.48, z: 0 }, to = { x: 2, y: 15.48, z: 0 };
  const support = { x: 0, z: 0, width: 2, depth: 2, height: 13.4, roofMargin: 0 };
  assert.equal(hitsBuilding(from, to, support), false);
  assert.equal(hitsBuilding(from, to, { ...support, roofMargin: undefined }), true);
});

test('stepCar crosses a ramp support below the visible deck instead of stopping on its roof padding', () => {
  const extent = 1000, plan = createUrbanPlan(extent), ramp = plan.ramps.find((candidate) => candidate.kind === 'ic');
  const index = ramp.points.findIndex((point) => point[2] > 6);
  const point = ramp.points[index], before = ramp.points[index - 1];
  const dx = point[0] - before[0], dz = point[1] - before[1], run = Math.hypot(dx, dz);
  const ux = dx / run, uz = dz / run;
  const x = point[0] - ux * 0.6, z = point[1] - uz * 0.6;
  const top = roadSurface(plan, x, z, point[2] + 0.6).top;
  const state = { ...createCarState(extent), x, z, y: CAR_GROUND + top - 0.33,
    heading: Math.atan2(-ux, -uz), speed: 12 };
  const support = { x: point[0], z: point[1], width: 2, depth: 2,
    height: point[2] - 0.6, roofMargin: 0 };
  const next = stepCar(state, {}, 0.05, extent, [support]);
  assert.notEqual(next.message, '막혔다');
  assert.ok(Math.hypot(next.x - state.x, next.z - state.z) > 0.4, 'vehicle did not cross the support footprint');
});

test('generated oblique stream bridge keeps audited road samples out of water', () => {
  const extent = 1769;
  const plan = createUrbanPlan(extent);
  const audited = [
    [1155.6123530608218, -1261.1319767962732],
    [1180.9244435207615, -1230.1669345973057],
  ];
  const bridge = plan.bridges.find((candidate) => audited.every(([x, z]) => onBridge(candidate, x, z, 4)));
  assert.ok(bridge, 'audited skew crossing has no canonical bridge deck');
  assert.ok(Math.abs(bridge.x2 - bridge.x1) > 1 && Math.abs(bridge.z2 - bridge.z1) > 1, 'bridge is not oblique');
  for (const [x, z] of audited) assert.equal(inWater(x, z, extent), false, `bridge sample ${x},${z} is wet`);

  const segment = bridgeSegment(bridge);
  const offDeckX = segment.cx + segment.px * (segment.width / 2 + 4.5);
  const offDeckZ = segment.cz + segment.pz * (segment.width / 2 + 4.5);
  assert.equal(inWater(offDeckX, offDeckZ, extent), true, 'bridge exclusion leaked into adjacent stream water');
});
