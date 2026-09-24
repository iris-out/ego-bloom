import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';
import { FOUR_VEHICLE_LAYOUT } from '../../src/world/models/fourVehicleLayout.js';

const parts = await loadModelFixture(new URL('../../src/world/models/FourVehicleParts.jsx', import.meta.url).pathname);

test('shared wheels mount four real wheels at authored contact points', () => {
  for (const layout of Object.values(FOUR_VEHICLE_LAYOUT)) {
    const root = parts.VehicleWheels({ layout });
    const wheels = [];
    root.traverse(node => { if (node.userData.part === 'wheel-hub') wheels.push(node); });
    assert.equal(wheels.length, 4);
    assert.deepEqual(wheels.map(w => w.position.z), [layout.wheels.frontZ, layout.wheels.frontZ, layout.wheels.rearZ, layout.wheels.rearZ]);
    assert.ok(modelTriangles(root) > 100);
  }
});

test('curved seat has distinct cushion, backrest and headrest surfaces', () => {
  const root = parts.CabinSeat({ position: [0,-.25,.2], sport: true });
  const boxes = new Set();
  root.traverse(node => { if (node.geometry?.type) boxes.add(node.geometry.type); });
  assert.ok(boxes.has('SphereGeometry'));
  assert.ok(modelTriangles(root) > 150);
});

test('low detail retains seat contours and steering shape at a bounded cost', () => {
  const seat = parts.CabinSeat({ position: [0,0,0], quality: 'low', sport: true });
  const wheel = parts.CabinSteering({ position: [0,0,0], quality: 'low', yoke: true });
  assert.ok(modelTriangles(seat) >= 100 && modelTriangles(seat) <= 150);
  assert.ok(modelTriangles(wheel) <= 200);
  assert.ok(modelTriangles(parts.CabinSeat({ position: [0,0,0], quality: 'medium' })) > modelTriangles(seat));
});

test('shared steering distinguishes yoke and wheel while retaining dynamic rim branch', () => {
  for (const yoke of [false, true]) {
    const root = parts.CabinSteering({ position: [0,0,0], yoke });
    let dynamic = 0;
    root.traverse(node => { if (node.userData.dynamic) dynamic++; });
    assert.equal(dynamic, 1);
    assert.ok(modelTriangles(root) > 50);
  }
});

test('round steering wheel carries three spokes into its rotating branch', () => {
  const root = parts.CabinSteering({ position: [0,0,0] });
  let spokes = 0;
  root.traverse(node => { if (node.geometry?.type === 'BoxGeometry') spokes++; });
  assert.equal(spokes, 3);
});

test('curved pane spans the actual windshield corners', () => {
  const corners = FOUR_VEHICLE_LAYOUT.electric.windshield;
  const root = parts.CabinPane({ corners });
  let geometry;
  root.traverse(node => { if (node.geometry) geometry = node.geometry; });
  assert.ok(geometry?.attributes.position.count > 4);
  assert.ok(modelTriangles(root) >= 24 && modelTriangles(root) <= 48);
});
