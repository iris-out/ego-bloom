import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { pedestrianSurface } from '../../shared/pedestrianSurface.js';
import { inWaterBody, riverCenter } from '../../shared/river.js';
import { createWalkState, EYE_HEIGHT, stepWalk } from '../../src/world/walkPhysics.js';
import { hitsAnyBuilding } from '../../src/world/solidIndex.js';

const extent = 1844;
const front = createUrbanPlan(extent).riverfront;

function followPath(path, buildings = []) {
  const first = path.points[0];
  let state = { ...createWalkState(extent), x: first[0], z: first[1],
    y: EYE_HEIGHT + pedestrianSurface(front, first[0], first[1], first[2]).top };
  for (const target of path.points.slice(1)) {
    for (let frame = 0; frame < 3000 && Math.hypot(target[0] - state.x, target[1] - state.z) > .01; frame++) {
      const dx = target[0] - state.x, dz = target[1] - state.z;
      state.heading = Math.atan2(-dx, -dz);
      state = stepWalk(state, { forward: 1 }, Math.min(.05, Math.hypot(dx, dz) / 4.4), extent, buildings, front);
      assert.equal(state.phase, 'walk', `${path.id} drowned near ${state.x},${state.z}`);
      const support = pedestrianSurface(front, state.x, state.z, state.y - EYE_HEIGHT);
      assert.ok(support && state.y >= EYE_HEIGHT + support.top - .03, `${path.id} lost visible floor`);
    }
    assert.ok(Math.hypot(target[0] - state.x, target[1] - state.z) <= .01, `${path.id} missed a waypoint`);
  }
  return state;
}

test('ordinary ground, jump landing, and water drowning remain available', () => {
  const home = createWalkState(extent);
  const ground = stepWalk(home, {}, 1 / 60, extent, [], front);
  assert.equal(ground.y, EYE_HEIGHT);
  let jump = stepWalk(ground, { jump: true }, 1 / 60, extent, [], front);
  assert.ok(jump.airborne && jump.y > ground.y);
  for (let i = 0; i < 70; i++) jump = stepWalk(jump, {}, 1 / 60, extent, [], front);
  assert.equal(jump.airborne, false);
  assert.equal(jump.y, EYE_HEIGHT);
  const wetX = Array.from({ length: 31 }, (_, index) => (index - 15) * extent / 20)
    .find(x => inWaterBody(extent, x, riverCenter(extent, x))
      && !pedestrianSurface(front, x, riverCenter(extent, x), 0));
  assert.ok(Number.isFinite(wetX));
  const water = stepWalk({ ...home, x: wetX, z: riverCenter(extent, wetX) }, {}, 1 / 60, extent, [], front);
  assert.equal(water.phase, 'drowned');
});

test('walking the culture island deck uses its surface and stepping off drowns', () => {
  const deck = front.paths.find(path => path.id === 'island-link-nodeul');
  const start = [deck.points[1][0], (deck.points[1][1] + deck.points[2][1]) / 2, .32];
  const surface = pedestrianSurface(front, start[0], start[1], .32);
  assert.ok(surface);
  let walker = { ...createWalkState(extent), x: start[0], z: start[1], y: EYE_HEIGHT + surface.top };
  walker = stepWalk(walker, { forward: 1 }, 1 / 60, extent, [], front);
  assert.equal(walker.phase, 'walk');
  assert.ok(Math.abs(walker.y - EYE_HEIGHT - .32) < .02);
  // The deck is six metres wide. Its water edge is immediately outside x=+3.
  walker = stepWalk({ ...walker, x: start[0] + 2.95, z: start[1], heading: 0 },
    { strafe: 1 }, .05, extent, [], front);
  assert.equal(walker.phase, 'drowned');
  const below = stepWalk({ ...createWalkState(extent), x: start[0], z: start[1], y: EYE_HEIGHT - 1,
    airborne: true, vy: -1 }, {}, 1 / 60, extent, [], front);
  assert.equal(below.phase, 'drowned', 'a bridge footprint alone must not make submerged feet dry');
});

test('shallow water below a deck cannot snap feet up or launch a jump through it', () => {
  const deck = front.paths.find(path => path.id === 'island-link-nodeul');
  const x = deck.points[1][0], z = (deck.points[1][1] + deck.points[2][1]) / 2;
  assert.equal(inWaterBody(extent, x, z), true);
  for (const feet of [0, .15, .31]) {
    assert.equal(pedestrianSurface(front, x, z, feet), null, `underdeck feet ${feet} were supported`);
    const next = stepWalk({ ...createWalkState(extent), x, z, y: EYE_HEIGHT + feet },
      {}, 1 / 60, extent, [], front);
    assert.equal(next.phase, 'drowned', `underdeck feet ${feet} stayed dry`);
  }
  const jumped = stepWalk({ ...createWalkState(extent), x, z }, { jump: true },
    1 / 60, extent, [], front);
  assert.equal(jumped.phase, 'drowned', 'jumping from water cannot establish deck support');
  const risingThrough = stepWalk({ ...createWalkState(extent), x, z,
    y: EYE_HEIGHT + .25, airborne: true, vy: 6 }, {}, .05, extent, [], front);
  assert.equal(risingThrough.phase, 'drowned', 'rising through the deck cannot land from below');
  const descending = stepWalk({ ...createWalkState(extent), x, z,
    y: EYE_HEIGHT + .6, airborne: true, vy: -6 }, {}, .05, extent, [], front);
  assert.equal(descending.phase, 'walk', 'descending feet can land on the deck from above');
  assert.equal(descending.airborne, false);
  assert.ok(Math.abs(descending.y - EYE_HEIGHT - .32) < 1e-6);
});

test('pavilion deck walking and landing retain feet on visible triangles', () => {
  const pavilion = front.areas.find(area => area.id === 'south-pavilion-1');
  const top = pedestrianSurface(front, pavilion.x, pavilion.z, .32).top;
  assert.equal(inWaterBody(extent, pavilion.x, pavilion.z), true);
  let walker = { ...createWalkState(extent), x: pavilion.x, z: pavilion.z, y: EYE_HEIGHT + top };
  walker = stepWalk(walker, { jump: true }, 1 / 60, extent, [], front);
  assert.ok(walker.airborne);
  for (let i = 0; i < 70; i++) walker = stepWalk(walker, {}, 1 / 60, extent, [], front);
  assert.equal(walker.phase, 'walk');
  assert.ok(Math.abs(walker.y - EYE_HEIGHT - top) < .02);
  const last = front.areas.find(area => area.id === 'south-pavilion-3');
  const offZ = last.z + last.depth / 2 + 3;
  assert.equal(inWaterBody(extent, last.x, offZ), true);
  assert.equal(pedestrianSurface(front, last.x, offZ, .32), null);
  const offDeck = stepWalk({ ...walker, x: last.x, z: offZ, y: EYE_HEIGHT + .32 },
    {}, 1 / 60, extent, front.obstacles, front);
  assert.equal(offDeck.phase, 'drowned', 'pavilion water is dry only on visible floor triangles');
});

test('actual walk updates traverse Nodeul deck and a pavilion link', () => {
  for (const id of ['island-link-nodeul', 'island-link-nodeul-north',
    'pavilion-link-1', 'pavilion-link-2', 'pavilion-link-3']) {
    const path = front.paths.find(item => item.id === id);
    const end = followPath(path, front.obstacles);
    assert.ok(Math.abs(end.x - path.points.at(-1)[0]) < .02);
  }
});

test('deck entrances keep a walkable gate while vehicle collision closes that gap', () => {
  const gates = front.vehicleBarriers;
  assert.ok(gates.length >= 10);
  assert.ok(gates.some(gate => gate.pathId === 'pavilion-link-1'));
  for (const gate of gates) {
    const ux = Math.sin(gate.rotation), uz = Math.cos(gate.rotation);
    const from = { x: gate.x - ux * 2, y: 1.2, z: gate.z - uz * 2 };
    const to = { x: gate.x + ux * 2, y: 1.2, z: gate.z + uz * 2 };
    assert.ok(hitsAnyBuilding(from, to, [gate]), `${gate.id} lets a vehicle through`);
    const posts = front.obstacles.filter(obstacle =>
      obstacle.id === `gate-post-${gate.gateId}--1` || obstacle.id === `gate-post-${gate.gateId}-1`);
    assert.equal(posts.length, 2, `${gate.id} lacks visible gate posts`);
    assert.equal(hitsAnyBuilding({ ...from, y: EYE_HEIGHT }, { ...to, y: EYE_HEIGHT }, posts), false,
      `${gate.id} closes the pedestrian opening`);
  }
});

test('bank walks cross each tributary on their raised pedestrian surfaces', () => {
  for (const [bank, ratio] of [['bank-south', .24], ['bank-north', -.72], ['bank-north', .66]]) {
    const source = front.paths.find(path => path.id === bank);
    const points = source.points.filter(point => Math.abs(point[0] - ratio * extent) < 45);
    assert.ok(points.length >= 4, `${bank} has no tributary crossing`);
    followPath({ id: `${bank}-stream`, points }, front.obstacles);
  }
});
