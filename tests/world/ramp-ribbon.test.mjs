import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { ROAD_STRUCTURE_DEFAULTS, addRamp } from '../../src/world/models/roadStructures.js';
import { roadSurface } from '../../src/world/roadSurface.js';
import { buildUrbanScenery } from '../../src/world/UrbanScenery.js';

const EPS = 1e-7;
const LOCAL_TOP = [[-.5, .5, -.5], [.5, .5, -.5], [-.5, .5, .5]];

function collect(points, options = {}) {
  const parts = [], faces = [];
  addRamp((material, position, scale, owner, shape, rotation, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  }, { x: points[0][0], z: points[0][1], y: points[0][2] },
  { x: points.at(-1)[0], z: points.at(-1)[1], y: points.at(-1)[2] },
  { quality: 'medium', points, ...options,
    addRoadTriangle: (triangle, surface) => faces.push({ triangle, ...surface }) });
  return { parts, faces };
}

function transformed(part, points) {
  const euler = new Euler(...part.rotation, 'YXZ');
  const scale = new Vector3(...part.scale), position = new Vector3(...part.position);
  return points.map((point) => new Vector3(...point).multiply(scale).applyEuler(euler).add(position).toArray());
}

const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < EPS;

test('rendered ramp triangles and physical surface share the exact corner and taper footprint', () => {
  const points = [[0, 0, 2, 10], [0, 20, 6, 8], [15, 20, 9, 4]];
  const { parts, faces } = collect(points);
  const decks = faces.filter((face) => face.face === 'top');
  assert.equal(decks.length, 4, 'each ribbon span needs its two canonical top triangles');
  assert.equal(parts.filter((part) => part.material === 'road').length, 0,
    'polyline deck leaked back into transformed model parts');

  const plan = { roads: [], ramps: [{ points }] };
  for (const deck of decks) {
    const top = deck.triangle;
    const centroid = top.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / 3), [0, 0, 0]);
    for (const [x, y, z] of [...top, centroid]) {
      const surface = roadSurface(plan, x, z, y);
      assert.ok(Math.abs(surface.top - y) < EPS,
        `rendered ramp at ${x.toFixed(3)},${z.toFixed(3)} has physical top ${surface.top}, expected ${y}`);
    }
  }
});

test('ramp shell has one continuous top and only true perimeter walls', () => {
  const points = [[0, 0, 2, 10], [0, 20, 6, 8], [15, 20, 9, 4]];
  const { faces } = collect(points);
  assert.equal(faces.filter((face) => face.face === 'top').length, 4);
  assert.equal(faces.filter((face) => face.face === 'bottom').length, 4);
  assert.equal(faces.filter((face) => face.face === 'wall').length, 12,
    'two outer sides and two end caps should be the only vertical walls');
  assert.equal(new Set(faces.filter((face) => face.face === 'wall').map((face) => face.group)).size, 6,
    'each perimeter quad should own two triangles with one flat normal group');
});

test('urban scenery aggregates every ramp into one shared indexed road surface', () => {
  const scenery = buildUrbanScenery([], 1000, 'low');
  const ramps = scenery.surfaces.filter((surface) => surface.category === 'ramp-road');
  assert.equal(ramps.length, 1, 'ramp tops must not create a draw call per ramp');
  const [{ mesh, source }] = ramps;
  assert.equal(source, 'roadRibbon');
  assert.ok(mesh.topIndexCount > 0 && mesh.topIndexCount < mesh.indices.length);
  const top = mesh.indices.slice(0, mesh.topIndexCount);
  assert.ok(new Set(top).size < top.length, 'adjacent top triangles must share exact buffer vertices');
  assert.ok(!Object.values(scenery.batches).some((batch) => batch.shape === 'roadTriangle'));
});

test('ramp rails follow inset edge endpoints and clip height along the actual 3D rail', () => {
  const points = [[0, 0, 2, 12], [0, 20, 6, 8]], calls = [];
  const clearance = {
    clearSpans(source, offset, margin) { calls.push({ source, offset, margin }); return [[.25, .75]]; },
    pointClear() { return false; },
  };
  const { parts } = collect(points, { clearance, sourceRoad: 'ramp-source' });
  assert.equal(calls.length, 2, 'both rail edges must consult clearance');
  assert.ok(calls.every((call) => call.offset === 0), 'clearance must receive the actual edge, not a centreline offset');
  assert.ok(calls.every((call) => call.source.sourceRoad === 'ramp-source'));

  const edges = [
    [[-5.7, 2, 0], [-3.7, 6, 20]],
    [[5.7, 2, 0], [3.7, 6, 20]],
  ];
  for (const edge of edges) {
    assert.ok(calls.some(({ source }) => close([source.x1, source.y1, source.z1], edge[0])
      && close([source.x2, source.y2, source.z2], edge[1])), `missing clearance edge ${JSON.stringify(edge)}`);
  }

  const lift = ROAD_STRUCTURE_DEFAULTS.deckThickness / 2 + ROAD_STRUCTURE_DEFAULTS.guardHeight / 2;
  const expected = edges.map(([a, b]) => [.25, .75].map((t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t + lift,
    a[2] + (b[2] - a[2]) * t,
  ]));
  const rails = parts.filter((part) => part.material === 'steel'
    && part.scale[1] === ROAD_STRUCTURE_DEFAULTS.guardHeight);
  assert.equal(rails.length, 2);
  const actual = rails.map((rail) => transformed(rail, [[0, 0, -.5], [0, 0, .5]]));
  for (const line of expected) {
    assert.ok(actual.some((ends) => (close(ends[0], line[0]) && close(ends[1], line[1]))
      || (close(ends[1], line[0]) && close(ends[0], line[1]))), `rail endpoints do not match ${JSON.stringify(line)}`);
  }
});

test('ramp rails stay off spans whose start is below the minimum deck height', () => {
  const points = [[0, 0, 0, 10], [0, 10, .5, 10], [0, 20, 2, 10]];
  const rails = collect(points).parts.filter((part) => part.material === 'steel'
    && part.scale[1] === ROAD_STRUCTURE_DEFAULTS.guardHeight);
  assert.equal(rails.length, 0);
});

test('the inward rail stays open for the whole flat merge while the outer rail remains', () => {
  const left = [0, 1];
  const points = [[0, 0, 14, 12, left], [10, 0, 14, 10, left], [20, 0, 14, 8, left]];
  const rails = collect(points, { inward: left }).parts.filter((part) => part.material === 'steel'
    && part.scale[1] === ROAD_STRUCTURE_DEFAULTS.guardHeight);
  assert.equal(rails.length, 2, 'an inward guard still blocks a shrinking merge span');
  assert.ok(rails.every((rail) => rail.position[2] < 0), 'the outer merge guard was removed');
});
