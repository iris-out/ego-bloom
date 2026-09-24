import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { inIslandPolygon, inWaterBody, riverCenter, riverHalf } from '../../shared/river.js';
import { pedestrianSurface } from '../../shared/pedestrianSurface.js';

const EXTENTS = [1000, 1600, 1844, 2164, 3600];
const ROAD_HALF = { arterial: 11, collector: 7.5, lane: 5, alley: 3, highway: 14 };
const roadDistance = (x, z, road) => {
  const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((x - road.x1) * dx + (z - road.z1) * dz) / length2)) : 0;
  return Math.hypot(x - road.x1 - dx * t, z - road.z1 - dz * t);
};

test('all required city sizes have deterministic destinations and three distinct pavilions', () => {
  for (const extent of EXTENTS) {
    const plan = createUrbanPlan(extent), front = plan.riverfront;
    const ids = new Set(front.areas.map(area => area.id));
    for (const id of ['south-lawn', 'south-picnic', 'south-grove', 'south-terraces',
      'west-greenery', 'culture-island', 'south-pavilion-1', 'south-pavilion-2', 'south-pavilion-3']) {
      assert.ok(ids.has(id), `${extent}: missing ${id}`);
    }
    const pavilions = front.structures.filter(structure => structure.kind === 'pavilion');
    assert.equal(pavilions.length, 3);
    assert.equal(new Set(pavilions.map(pavilion => pavilion.width)).size, 3);
    assert.ok(front.paths.every(path => path.access === 'pedestrian'));
    assert.ok(front.paths.every(path => !plan.roads.includes(path)), 'pedestrian paths stay out of AI roads');
    for (const gate of front.vehicleBarriers) {
      assert.ok(plan.roads.filter(road => !road.elevated && !road.tunnel).every(road =>
        roadDistance(gate.x, gate.z, road) > (ROAD_HALF[road.kind] || 4) + gate.depth + 2),
      `${extent} ${gate.id} blocks an ordinary road`);
      assert.ok(front.reservations.filter(item => item.id.startsWith('turnaround-')).every(turnaround =>
        Math.hypot(gate.x - turnaround.x, gate.z - turnaround.z) > 12),
      `${extent} ${gate.id} blocks a road turnaround`);
    }
    assert.deepEqual(createUrbanPlan(extent).riverfront, front);
    assert.deepEqual(front.diagnostics.skippedCandidates, []);
  }
});

test('sites clear roads, bridges, and ponds at each required extent', () => {
  for (const extent of EXTENTS) {
    const plan = createUrbanPlan(extent);
    for (const area of plan.riverfront.areas.filter(area => !area.kind.includes('island')
      && area.kind !== 'west-greenery' && area.kind !== 'pavilion')) {
      const corners = [[0, 0], [-area.width / 2, -area.depth / 2], [area.width / 2, -area.depth / 2],
        [-area.width / 2, area.depth / 2], [area.width / 2, area.depth / 2]];
      assert.ok(corners.every(([dx, dz]) => !inWaterBody(extent, area.x + dx, area.z + dz)), `${extent} ${area.id} wet`);
      assert.ok(plan.ponds.every(pond => Math.abs(pond.x - area.x) >= pond.rx + area.width / 2
        || Math.abs(pond.z - area.z) >= pond.rz + area.depth / 2), `${extent} ${area.id} pond`);
      assert.ok(plan.bridges.every(bridge => Math.abs(bridge.x - area.x) >= bridge.width / 2 + area.width / 2
        || Math.abs(bridge.z - area.z) >= bridge.length / 2 + area.depth / 2), `${extent} ${area.id} bridge`);
      assert.ok(plan.roads.filter(road => !road.elevated && !road.tunnel).every(road =>
        roadDistance(area.x, area.z, road) > Math.hypot(area.width, area.depth) / 2 + (ROAD_HALF[road.kind] || 4)),
      `${extent} ${area.id} road`);
    }
  }
});

test('three adjacent pavilions stand entirely over river water east of the culture island', () => {
  for (const extent of EXTENTS) {
    const plan = createUrbanPlan(extent), front = plan.riverfront;
    const island = plan.islands.find(item => item.id === 'nodeul');
    const pavilions = [1, 2, 3].map(index => front.areas.find(area => area.id === `south-pavilion-${index}`));
    assert.ok(pavilions[0].x - pavilions[0].width / 2 > island.x + island.rx,
      `${extent} pavilion cluster is not east of the culture island`);
    assert.ok(pavilions[2].x + pavilions[2].width / 2 - (pavilions[0].x - pavilions[0].width / 2) <= 120,
      `${extent} pavilion cluster is dispersed`);
    for (const pavilion of pavilions) {
      assert.equal(pavilion.height, .32);
      const structure = front.structures.find(item => item.id === pavilion.id);
      assert.equal(structure.groundY, .32);
      for (const dx of [-pavilion.width / 2, 0, pavilion.width / 2]) {
        for (const dz of [-pavilion.depth / 2, 0, pavilion.depth / 2]) {
          const x = pavilion.x + dx, z = pavilion.z + dz;
          assert.equal(inWaterBody(extent, x, z), true, `${extent} ${pavilion.id} floor is on land`);
          assert.ok(plan.bridges.every(bridge => Math.hypot(x - bridge.x, z - bridge.z) > 30),
            `${extent} ${pavilion.id} hits a road bridge`);
        }
      }
      assert.equal(pedestrianSurface(front, pavilion.x, pavilion.z, .32)?.top, .32);
    }
  }
});

test('the canonical paths link roads, both banks, Nodeul on both sides, and every pavilion', () => {
  for (const extent of EXTENTS) {
    const plan = createUrbanPlan(extent), paths = new Map(plan.riverfront.paths.map(path => [path.id, path]));
    for (const id of ['bank-south', 'bank-north', 'island-link-nodeul', 'island-link-nodeul-north',
      'island-link-yeoui', 'pavilion-link-1', 'pavilion-link-2', 'pavilion-link-3',
      'pavilion-access-1', 'pavilion-access-2', 'pavilion-access-3', 'terrace-bypass']) assert.ok(paths.has(id), `${extent} ${id}`);
    for (const path of plan.riverfront.paths) {
      for (const [x, z, y] of path.points) {
        const support = pedestrianSurface(plan.riverfront, x, z, y);
        assert.ok(support && support.top >= y - .03 && support.top <= y + .55,
          `${extent} ${path.id} ${x} ${z}: ${support?.top} / ${y}`);
      }
    }
    const north = paths.get('island-link-nodeul-north');
    const south = paths.get('island-link-nodeul');
    assert.ok(north.points[0][1] < riverCenter(extent, north.points[0][0]) - riverHalf(extent, north.points[0][0]));
    assert.ok(south.points[0][1] > riverCenter(extent, south.points[0][0]) + riverHalf(extent, south.points[0][0]));
    for (let index = 1; index <= 3; index++) {
      const pavilion = plan.riverfront.areas.find(area => area.id === `south-pavilion-${index}`);
      assert.deepEqual(paths.get(`pavilion-link-${index}`).points.at(-1).slice(0, 2), [pavilion.x, pavilion.z]);
      if (index > 1) {
        const previous = plan.riverfront.areas.find(area => area.id === `south-pavilion-${index - 1}`);
        assert.deepEqual(paths.get(`pavilion-link-${index}`).points[0].slice(0, 2), [previous.x, previous.z]);
      }
      assert.ok(paths.get(`pavilion-access-${index}`).points[0][1] >
        riverCenter(extent, pavilion.x) + riverHalf(extent, pavilion.x));
    }
    const riverRoads = plan.roads.filter(road => road.path === 'river-south');
    for (const path of plan.riverfront.paths.filter(path => path.id.startsWith('access-south-')
      || path.id.startsWith('pavilion-access-'))) {
      const [x, z] = path.points.at(-1);
      assert.ok(riverRoads.some(road => {
        const t = (x - road.x1) / (road.x2 - road.x1);
        return t >= 0 && t <= 1 && Math.abs(z - (road.z1 + t * (road.z2 - road.z1))) < .01;
      }), `${extent} ${path.id} lacks real riverside-road endpoint`);
    }
  }
});

test('surface support comes only from canonical triangles and respects island water edges', () => {
  const plan = createUrbanPlan(1844), front = plan.riverfront;
  assert.equal(pedestrianSurface(front, 9000, 9000, 0), null);
  for (const surface of front.surfaces) {
    for (const triangle of surface.triangles) {
      const [a, b, c] = triangle;
      const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      assert.ok(up > 0, `${surface.id} faces downward`);
      const x = triangle.reduce((sum, point) => sum + point[0], 0) / 3;
      const z = triangle.reduce((sum, point) => sum + point[2], 0) / 3;
      const top = triangle.reduce((sum, point) => sum + point[1], 0) / 3;
      const support = pedestrianSurface(front, x, z, top);
      assert.ok(support && support.top >= top - .02 && support.top <= top + .55, `${surface.id} triangle mismatch`);
    }
  }
  const island = plan.islands.find(item => item.id === 'nodeul');
  assert.ok(inIslandPolygon(island, island.x, island.z));
  assert.equal(inWaterBody(plan.extent, island.x, island.z), false);
  const outside = island.x + island.rx * 1.03;
  assert.equal(inIslandPolygon(island, outside, island.z), false);
  assert.equal(inWaterBody(plan.extent, outside, island.z), true);
  const mid = front.paths.find(path => path.id === 'island-link-nodeul').points[2];
  assert.equal(pedestrianSurface(front, mid[0], mid[1], -1), null, 'below-deck feet cannot snap up');
});
