import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../shared/elevation.js';
import { roadLaneLayout } from '../../shared/roadProfile.js';
import { addBridge, TRANSIT_MODEL_DEFAULTS } from '../../src/world/models/transitModels.js';

const bridge = { x1: 0, z1: -100, x2: 0, z2: 100, width: 40, big: true,
  sourceRoad: 'arterial-main' };
const sourceRoad = { id: 'arterial-main', kind: 'arterial', width: 22,
  x1: 0, z1: -140, x2: 0, z2: 140 };

function collect(quality = 'medium', options = {}) {
  const parts = [];
  addBridge((material, position, scale, owner, shape = 'box', rotation = 0, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  }, bridge, quality, { sourceRoad, ...options });
  return parts;
}

const hasScale = (part, scale) => Array.isArray(scale)
  && scale.every((value, index) => Math.abs(part.scale[index] - value) < 1e-9);

test('bridge paint keeps the canonical six-lane carriageway inside the wider structural deck', () => {
  const calls = [];
  const clearance = { clearSpans(segment, offset, margin) {
    calls.push({ segment, offset, margin });
    return [[0, 1]];
  }, columnClear() { return true; } };
  const parts = collect('medium', { clearance });
  const paint = parts.filter((part) => part.material === 'marking' || part.material === 'centerline');
  const layout = roadLaneLayout(sourceRoad.kind, sourceRoad.width);
  const whiteOffsets = [...new Set(paint.filter((part) => part.material === 'marking')
    .map((part) => Math.abs(part.position[0])).map((value) => value.toFixed(6)))].map(Number).sort((a, b) => a - b);

  assert.ok(paint.some((part) => part.material === 'centerline'), 'canonical yellow centre paint is missing');
  assert.deepEqual(whiteOffsets, [...layout.dividerOffsets, layout.edgeOffset].map((value) => +value.toFixed(6)));
  assert.ok(paint.every((part) => Math.abs(part.position[0]) <= sourceRoad.width / 2),
    'paint expanded onto the structural shoulders');
  const paintCalls = calls.filter((call) => Math.abs(call.offset) <= sourceRoad.width / 2);
  assert.ok(paintCalls.length > 2, 'six-lane paint did not consult crossing clearance');
  assert.ok(paintCalls.every((call) => call.segment.kind === sourceRoad.kind
    && call.segment.sourceRoad === sourceRoad && call.segment.joinIn === 0 && call.segment.joinOut === 0));
});

test('bridge detail adds a readable outer shell and cable hardware by quality', () => {
  const low = collect('low'), medium = collect('medium'), high = collect('high');
  assert.ok(low.length < medium.length && medium.length < high.length,
    `quality counts are not monotonic: ${low.length}/${medium.length}/${high.length}`);
  assert.ok(low.length <= 40 && medium.length <= 160 && high.length <= 240,
    `bridge detail exceeded budget: ${low.length}/${medium.length}/${high.length}`);

  assert.equal(low.filter((part) => hasScale(part, [TRANSIT_MODEL_DEFAULTS.bridgeFasciaWidth,
    TRANSIT_MODEL_DEFAULTS.bridgeFasciaHeight, 200])).length, 2, 'both fascia strips are required at low');
  assert.ok(low.filter((part) => hasScale(part, [bridge.width,
    TRANSIT_MODEL_DEFAULTS.bridgeTransitionHeight, TRANSIT_MODEL_DEFAULTS.bridgeTransitionDepth])).length === 2,
  'both bridge transitions need an expansion-joint detail');
  assert.ok(medium.some((part) => part.material === 'pavement'
    && part.scale[1] === TRANSIT_MODEL_DEFAULTS.bridgeWalkwayHeight), 'raised shoulder walkways are missing');
  assert.ok(medium.some((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgePylonBase)), 'pylon bases are missing');
  assert.ok(medium.some((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgePylonCap)), 'pylon caps are missing');
  assert.ok(medium.some((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgeCableAnchor)), 'cable anchors are missing');
  assert.ok(medium.some((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgeRailPost)), 'railing posts are missing');
  assert.ok(medium.some((part) => part.material === 'accent'), 'railing reflectors are missing');
  assert.ok(!medium.some((part) => part.material === 'lamp'), 'lamp fixtures are high-detail only');
  assert.ok(high.some((part) => part.material === 'lamp'), 'high detail needs lamp fixtures');
});

test('vertical bridge detail stays outside the canonical carriageway and clipped rail openings', () => {
  const clearance = { clearSpans(_segment, offset) {
    return Math.abs(offset) > sourceRoad.width / 2 ? [[0, .35], [.65, 1]] : [[0, 1]];
  }, columnClear() { return true; } };
  const parts = collect('high', { clearance });
  const deckTop = LEVELS.ROAD_TOP;
  const vertical = parts.filter((part) => part.position[1] - part.scale[1] / 2 >= deckTop - .01
    && part.position[1] + part.scale[1] / 2 > deckTop + .2 && part.material !== 'road');
  assert.ok(vertical.some((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgeRailPost)));
  for (const part of vertical) {
    const radius = part.shape === 'cylinder' ? part.scale[0] : part.scale[0] / 2;
    assert.ok(Math.abs(part.position[0]) - radius >= sourceRoad.width / 2 - 1e-6,
      `vertical ${part.material}/${part.shape} intrudes into the carriageway at x=${part.position[0]}`);
  }
  const posts = vertical.filter((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgeRailPost));
  assert.ok(posts.every((part) => {
    const t = (part.position[2] - bridge.z1) / (bridge.z2 - bridge.z1);
    return t <= .35 + 1e-9 || t >= .65 - 1e-9;
  }), 'railing detail survived inside a cleared intersection opening');
  const walkways = parts.filter((part) => part.material === 'pavement'
    && part.scale[1] === TRANSIT_MODEL_DEFAULTS.bridgeWalkwayHeight);
  assert.ok(walkways.length >= 4);
  assert.ok(walkways.every((part) => {
    const from = (part.position[2] - part.scale[2] / 2 - bridge.z1) / (bridge.z2 - bridge.z1);
    const to = (part.position[2] + part.scale[2] / 2 - bridge.z1) / (bridge.z2 - bridge.z1);
    return to <= .35 + 1e-9 || from >= .65 - 1e-9;
  }), 'raised walkway survived inside a cleared intersection opening');
});

test('pylon collision covers its visible base and blocked cable feet are omitted', () => {
  const pylons = [], columns = [];
  const clearance = {
    clearSpans() { return [[0, 1]]; },
    columnClear(x, z, radius, bottom, top, source) {
      columns.push({ x, z, radius, bottom, top, source });
      return radius > 1;
    },
  };
  const parts = collect('medium', { clearance, onPylon: (pylon) => pylons.push(pylon) });
  assert.equal(pylons.length, 4);
  assert.ok(pylons.every((pylon) => pylon.width === TRANSIT_MODEL_DEFAULTS.bridgePylonBase[0]
    && pylon.depth === TRANSIT_MODEL_DEFAULTS.bridgePylonBase[2] && pylon.margin === undefined));
  assert.ok(pylons.every((pylon) => Math.abs(pylon.x) - pylon.width / 2 - 3 >= sourceRoad.width / 2),
    'the conservative default collision envelope intrudes into the canonical carriageway');
  assert.ok(columns.some((call) => call.radius > 5 && call.source.sourceRoad === sourceRoad),
    'tower placement did not reserve its enlarged base with canonical source identity');
  assert.ok(columns.some((call) => call.radius < 1 && call.source.sourceRoad === sourceRoad),
    'cable anchor feet did not consult column clearance');
  assert.equal(parts.filter((part) => hasScale(part, TRANSIT_MODEL_DEFAULTS.bridgeCableAnchor)).length, 0);
  assert.equal(parts.filter((part) => part.material === 'steel' && part.shape === 'cylinder').length, 0,
    'a cable remained after its low anchor was blocked');
});
