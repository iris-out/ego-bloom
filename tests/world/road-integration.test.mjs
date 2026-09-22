import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../../shared/worldLayout.js';
import { createUrbanPlan, ROAD_WIDTH } from '../../shared/urbanPlan.js';
import { roadClearance } from '../../shared/roadClearance.js';
import { buildUrbanScenery, npcSolids } from '../../src/world/UrbanScenery.js';
import { CAR_GROUND, ROAD_TOP } from '../../src/world/carPhysics.js';
import { hitsAnyBuilding } from '../../src/world/solidIndex.js';
import { roadSurface } from '../../src/world/roadSurface.js';
import {
  TRAFFIC_BODY,
  TRAFFIC_TOP_SPEED,
  clearTrafficYield,
  trafficBoxes,
  trafficFrame,
  trafficPose,
  trafficTrack,
  updateTrafficYield,
} from '../../src/world/traffic.js';

const EXTENT = 1600;
const DECK_TOP_OFFSET = 0.6;

const records = (count = 200) => Array.from({ length: count }, (_, index) => ({
  id: `road-integration-${index}`,
  nickname: `road integration ${index}`,
  elo_score: (count - index) * 10000,
  tier_name: ['Champion', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'][index % 7],
}));

function flatParts(scene) {
  return Object.values(scene.batches).flatMap((batch) => batch.parts.map((part) => ({
    ...part,
    material: batch.material,
    shape: batch.shape,
  })));
}

function routeDistance(route, x, z) {
  let best = Infinity;
  for (let index = 1; index < route.points.length; index += 1) {
    const [ax, az] = route.points[index - 1], [bx, bz] = route.points[index];
    const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

test('legacy roundabout records render as open quality-independent junctions', () => {
  const plan = createUrbanPlan(EXTENT);
  assert.ok(plan.roundabouts.length > 0, 'the regression fixture needs legacy roundabout records');

  for (const quality of ['low', 'medium', 'high']) {
    const scene = buildUrbanScenery([], EXTENT, quality);
    const parts = flatParts(scene);
    for (const junction of plan.roundabouts) {
      const centred = parts.filter((part) => part.position[0] === junction.x && part.position[2] === junction.z);
      assert.ok(centred.some((part) => part.material === 'road'), `${quality} omits the canonical junction road fill`);
      assert.ok(centred.some((part) => part.material === 'pavement'), `${quality} omits the canonical junction apron`);
      assert.equal(centred.some((part) => part.material === 'green' || part.material === 'stone'), false,
        `${quality} leaves a central island in a straight-through junction`);
    }
  }
});

test('all ground-level scene trees and slender poles clear canonical road volumes', () => {
  const city = buildWorld(records(80));
  const extent = city[0].cityExtent;
  const scene = buildUrbanScenery(city, extent, 'medium');
  const clearance = roadClearance(scene.plan);
  const lowObstacles = flatParts(scene).filter((part) => {
    const verticalRadius = part.shape === 'tree' ? part.scale[1] : part.scale[1] / 2;
    const bottom = part.position[1] - verticalRadius;
    const slenderPole = part.material === 'dark' && part.shape === 'box'
      && part.scale[1] >= 3 && Math.max(part.scale[0], part.scale[2]) <= 1;
    const crown = part.material === 'leaf' && part.shape === 'tree';
    return crown || (bottom < 1 && (part.shape === 'trunk' || slenderPole));
  });

  assert.ok(lowObstacles.length > 100, 'the regression fixture needs scenery obstacles');
  for (const part of lowObstacles) {
    const radial = part.shape === 'trunk' || part.shape === 'tree' ? 2 : 1;
    const width = Math.abs(part.scale[0]) * radial, depth = Math.abs(part.scale[2]) * radial;
    const radius = part.shape === 'trunk' || part.shape === 'tree'
      ? Math.max(width, depth) / 2 : Math.hypot(width, depth) / 2;
    const verticalRadius = part.shape === 'tree' ? Math.abs(part.scale[1]) : Math.abs(part.scale[1]) / 2;
    assert.equal(clearance.columnClear(part.position[0], part.position[2], radius,
      part.position[1] - verticalRadius, part.position[1] + verticalRadius), true,
      `${part.shape}/${part.material} intrudes a road at ${part.position[0].toFixed(1)}, ${part.position[2].toFixed(1)}`);
  }
});

test('NPC collision envelopes below highway decks do not block the emitted driving lanes', () => {
  const city = buildWorld(records());
  const extent = city[0].cityExtent;
  const plan = createUrbanPlan(extent);
  const solids = npcSolids(city);
  assert.ok(solids.length > 100, 'the regression fixture needs emitted NPC solids');

  for (const road of plan.roads.filter((candidate) => candidate.elevated)) {
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length = Math.hypot(dx, dz);
    const width = road.width ?? ROAD_WIDTH[road.kind];
    for (const offset of [0, width / 4, -width / 4, width / 2 - 1.2, -width / 2 + 1.2]) {
      let previous = null;
      const count = Math.ceil(length / 5);
      for (let index = 0; index <= count; index += 1) {
        const t = index / count;
        const point = {
          x: road.x1 + dx * t - dz / length * offset,
          z: road.z1 + dz * t + dx / length * offset,
          y: CAR_GROUND + (road.deckY ?? plan.highwayDeck) + DECK_TOP_OFFSET - ROAD_TOP,
        };
        assert.equal(hitsAnyBuilding(previous ?? point, point, solids), false,
          `NPC collision blocks elevated lane ${road.id} at offset ${offset.toFixed(1)}`);
        previous = point;
      }
    }
  }
});

test('highway traffic follows the closed physical deck with stable height and separated lanes', () => {
  const plan = createUrbanPlan(EXTENT);
  const route = plan.highwayRoutes.find((candidate) => candidate.id === 'highway-loop');
  assert.ok(route, 'canonical elevated highway route is absent');
  const expectedY = route.deckY + DECK_TOP_OFFSET;
  const byLane = new Map();
  const highway = [];

  for (let index = 0; index < 900; index += 1) {
    const track = trafficTrack(index, 37.25, EXTENT);
    if (track.route !== route.id) continue;
    const pose = trafficPose(index, 37.25, EXTENT);
    highway.push({ index, pose, track });
    assert.equal(pose.y, expectedY, `highway car ${index} has the wrong deck height`);
    assert.ok(routeDistance(route, pose.x, pose.z) < ROAD_WIDTH.highway / 2,
      `highway car ${index} leaves the physical deck`);
    const top = roadSurface(plan, pose.x, pose.z, pose.y).top;
    assert.ok(Math.abs(top - pose.y) < 0.12,
      `highway car ${index} is at y=${pose.y}, but its rendered deck top is ${top}`);
    const gaps = byLane.get(track.lane) ?? [];
    gaps.push(routeDistance(route, pose.x, pose.z));
    byLane.set(track.lane, gaps);
  }

  assert.ok(highway.length > 20, `only ${highway.length} highway cars were assigned`);
  assert.deepEqual([...byLane.keys()].sort(), [0, 1], 'both highway lanes must carry traffic');
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(average(byLane.get(1)) > average(byLane.get(0)) + 4,
    'the outer highway lane is not separated from the inner lane');

  const sample = highway[0];
  const next = trafficPose(sample.index, 37.25 + 1 / 60, EXTENT);
  assert.ok(Math.hypot(next.x - sample.pose.x, next.z - sample.pose.z) <= TRAFFIC_TOP_SPEED / 60 + 1e-6,
    'the closed highway loop teleports at its seam');
});

test('traffic frame, pose, collision boxes, and yield keep the same road elevation', () => {
  clearTrafficYield();
  const time = 61.5;
  const count = 900;
  const frame = trafficFrame(count, time, EXTENT);
  const target = Array.from({ length: count }, (_, index) => index)
    .find((index) => trafficTrack(index, time, EXTENT).route === 'highway-loop');
  assert.notEqual(target, undefined, 'no highway traffic target was assigned');
  const initial = trafficPose(target, time, EXTENT);
  assert.equal(frame.y[target], initial.y);
  const box = trafficBoxes(count, time, EXTENT).find((candidate) => candidate.index === target);
  assert.equal(box.y, initial.y);
  assert.equal(initial.y, createUrbanPlan(EXTENT).highwayRoutes[0].deckY + DECK_TOP_OFFSET);
  assert.equal(TRAFFIC_BODY.base, ROAD_TOP, 'ground traffic body baseline changed');

  // Keep a ground-level player directly ahead of the elevated target. A 2D-only yield
  // check incorrectly slows the highway car even though the two vehicles are grade-separated.
  for (let step = 0; step < 90; step += 1) {
    const pose = trafficPose(target, time, EXTENT);
    updateTrafficYield({
      x: pose.x + Math.sin(pose.angle) * 12,
      y: CAR_GROUND,
      z: pose.z + Math.cos(pose.angle) * 12,
      width: 2.2,
      depth: 4.6,
    }, 1 / 60);
    trafficFrame(count, time, EXTENT);
  }
  const after = trafficPose(target, time, EXTENT);
  assert.equal(after.x, initial.x);
  assert.equal(after.y, initial.y);
  assert.equal(after.z, initial.z);
  assert.equal(after.speed, initial.speed);
  assert.equal(after.braking, initial.braking);
  clearTrafficYield();
});
