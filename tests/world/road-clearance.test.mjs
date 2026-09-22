import test from 'node:test';
import assert from 'node:assert/strict';
import { roadClearance } from '../../shared/roadClearance.js';
import { createUrbanPlan, ROAD_WIDTH } from '../../shared/urbanPlan.js';
import { lampSpots, streetTrees } from '../../src/world/roadFurniture.js';
import {
  MARKING,
  ROAD_STRUCTURE_DEFAULTS,
  addElevatedRoad,
  addRoadFurniture,
  roadMarkings,
} from '../../src/world/models/roadStructures.js';

const close = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
};

function collect(run) {
  const parts = [];
  run((material, position, scale, owner = null, shape = 'box', rotation = 0, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  });
  return parts;
}

const horizontal = { id: 'east-west', x1: -100, z1: 0, x2: 100, z2: 0, length: 200, kind: 'arterial' };
const vertical = { id: 'north-south', x1: 0, z1: -100, x2: 0, z2: 100, length: 200, kind: 'lane' };

test('clearSpans cuts the full perpendicular road footprint and excludes its own cloned segment', () => {
  const source = { ...horizontal };
  const clearance = roadClearance({ extent: 1600, roads: [horizontal, vertical], bridges: [] });
  const spans = clearance.clearSpans(source, 0, 1);

  assert.equal(spans.length, 2);
  close(spans[0][0], 0);
  close(spans[0][1], 0.47);
  close(spans[1][0], 0.53);
  close(spans[1][1], 1);
});

test('clearSpans finds a skew crossing that only clips one end of a long rail', () => {
  const source = { id: 'rail-road', x1: -100, z1: 0, x2: 100, z2: 0, kind: 'collector' };
  const skew = { id: 'skew', x1: 60, z1: -30, x2: 100, z2: 30, kind: 'lane' };
  const spans = roadClearance({ roads: [source, skew], bridges: [], ramps: [] }).clearSpans({ ...source }, 9, 0.2);

  assert.equal(spans.length, 2, 'the crossing must split the rail even though its midpoint is clear');
  assert.ok(spans[0][1] > 0.75 && spans[0][1] < 0.95, `${spans[0][1]} should cut near the far end`);
  assert.ok(spans[1][0] > spans[0][1]);
});

test('a sharp bend on the same named route still clears its neighboring road footprint', () => {
  const source = { id: 'ring', path: 'ring', x1: 0, z1: 0, x2: 100, z2: 0, kind: 'collector' };
  const bend = { id: 'ring', path: 'ring', x1: 90, z1: 0, x2: 90, z2: 100, kind: 'collector' };
  const spans = roadClearance({ roads: [source, bend] }).clearSpans({ ...source }, 9, 0.2);

  assert.equal(spans.length, 2, 'route identity must not hide an angled neighboring segment');
  assert.ok(spans[0][1] < 0.9 && spans[1][0] > 0.9);
});

test('clearance separates ground roads from elevated decks but includes a ramp footprint near ground', () => {
  const elevated = { id: 'deck', x1: -100, z1: 0, x2: 100, z2: 0, kind: 'highway', elevated: true, deckY: 14 };
  const ground = { id: 'ground', x1: 0, z1: -100, x2: 0, z2: 100, kind: 'collector' };
  const ramp = { width: 12, points: [[50, -40, 0, 12], [50, 40, 2, 12], [50, 100, 14, 12]] };
  const clearance = roadClearance({ roads: [elevated, ground], ramps: [ramp], bridges: [] });

  assert.deepEqual(clearance.clearSpans({ ...elevated }, 0, 0), [[0, 1]], 'ground crossing is below the deck');
  assert.equal(clearance.pointClear(0, 0, 0.2, 0), false, 'ground road blocks ground furniture');
  assert.equal(clearance.pointClear(0, 0, 0.2, 14), false, 'elevated road blocks deck furniture');

  const groundSource = { id: 'test-source', x1: 0, z1: 0, x2: 100, z2: 0, kind: 'lane' };
  const rampSpans = clearance.clearSpans(groundSource, 0, 0);
  assert.equal(rampSpans.length, 2, 'the low ramp crosses the ground source');
  assert.ok(rampSpans[0][1] < 0.5 && rampSpans[1][0] > 0.5);
});

test('oriented bridge endpoints contribute their full same-level footprint', () => {
  const bridge = { x1: -30, z1: -30, x2: 30, z2: 30, width: 12 };
  const ground = roadClearance({ roads: [], ramps: [], bridges: [bridge] });
  const high = roadClearance({ roads: [], ramps: [], bridges: [{ ...bridge, deckY: 12 }] });

  assert.equal(ground.pointClear(8, 4, 0.5, 0), false, 'point lies inside the diagonal deck width');
  assert.equal(ground.pointClear(12, 0, 0.5, 0), true, 'point lies outside the oriented deck rectangle');
  assert.equal(high.pointClear(8, 4, 0.5, 0), true, 'high deck does not reserve ground space');
});

test('all generated street-tree trunks stay outside every road footprint', () => {
  const plan = createUrbanPlan(1600);
  const clearance = roadClearance(plan);
  const trunks = streetTrees(plan, 'medium').filter((part) => part[4] === 'trunk');

  assert.ok(trunks.length > 1000, `expected the reported large-city population, got ${trunks.length}`);
  for (const trunk of trunks) {
    assert.equal(clearance.pointClear(trunk[1][0], trunk[1][2], trunk[2][0] / 2, 0), true,
      `tree trunk intrudes a road at ${trunk[1][0].toFixed(1)}, ${trunk[1][2].toFixed(1)}`);
  }
});

test('alley lamps are offset from the centreline endpoints and avoid the connecting street', () => {
  const alley = { id: 'alley', x1: -100, z1: 400, x2: 0, z2: 400, kind: 'alley' };
  const connector = { id: 'connector', x1: 0, z1: 330, x2: 0, z2: 470, kind: 'lane' };
  const plan = { extent: 1600, roads: [alley, connector], bridges: [], ramps: [] };
  const clearance = roadClearance(plan);
  const lamps = lampSpots(plan, 'medium').spots;

  assert.ok(lamps.length > 0);
  for (const lamp of lamps) {
    assert.ok(Math.abs(lamp.z - 400) > ROAD_WIDTH.alley / 2, 'lamp remains on the alley centreline/end cap');
    assert.equal(clearance.pointClear(lamp.x, lamp.z, 0.12, 0), true, 'lamp pole intrudes the connecting road');
  }
});

test('median intersection gaps are identical at low, medium, and high quality', () => {
  const plan = { roads: [horizontal, vertical], bridges: [], ramps: [] };
  const clearance = roadClearance(plan);
  const medianPieces = (quality) => collect((add) => addRoadFurniture(add, horizontal, {
    quality, width: ROAD_WIDTH.arterial, median: true, clearance,
  })).filter((part) => part.material === 'marking' && part.scale[0] === 1.1);

  const low = medianPieces('low');
  const medium = medianPieces('medium');
  const high = medianPieces('high');
  assert.equal(low.length, 2, 'crossing splits the median into two pieces');
  assert.deepEqual(medium, low);
  assert.deepEqual(high, low);
  for (const piece of low) assert.ok(Math.abs(piece.position[0]) - piece.scale[2] / 2 >= ROAD_WIDTH.lane / 2);
});

test('road markings share intersection gaps and elevated highway markings use the lane table at deck height', () => {
  const plan = { roads: [horizontal, vertical], bridges: [], ramps: [] };
  const clearance = roadClearance(plan);
  const cut = roadMarkings(horizontal, { quality: 'low', width: ROAD_WIDTH.arterial, clearance });
  assert.equal(cut.filter(part=>part.material==='centerline').length, 2, 'the arterial centreline is split around the perpendicular road');
  for(const part of cut)assert.ok(Math.abs(part.position[0])-part.scale[2]/2>=ROAD_WIDTH.lane/2,
    'all six-lane divider and edge strips must leave the crossing clear');

  const deckY = 14;
  const deck = { id: 'deck', x1: -100, z1: 60, x2: 100, z2: 60, length: 200, kind: 'highway', elevated: true, deckY };
  const deckParts = collect((add) => addElevatedRoad(add, deck, {
    quality: 'medium', width: ROAD_WIDTH.highway, height: deckY,
  }));
  const markings = deckParts.filter((part) => part.material === 'marking' || part.material === 'centerline');
  assert.ok(markings.some((part) => part.material === 'centerline'), 'highway uses its two-line centre marking');
  assert.ok(markings.filter((part) => part.material === 'marking').length > 2, 'highway uses divider and edge lines');
  for (const part of markings) close(part.position[1], deckY + ROAD_STRUCTURE_DEFAULTS.deckThickness / 2 + 0.02);
  assert.ok(markings.every((part) => part.position[1] !== MARKING.y), 'deck paint is not left at ground marking height');
});
