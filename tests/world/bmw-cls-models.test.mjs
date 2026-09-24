import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';

const cases = [
  { key: 'convertible', model: 'Convertible', cabin: 'ConvertibleCabin', seats: 4, doors: 2, halfWidth: 1.20, halfDepth: 2.44, roof: .76 },
  { key: 'coupe', model: 'Coupe', cabin: 'CoupeCabin', seats: 5, doors: 4, halfWidth: 1.24, halfDepth: 2.55, roof: .92 },
];

async function mount(path, props = {}) {
  const { default: Component } = await loadModelFixture(new URL(`../../src/world/${path}`, import.meta.url).pathname);
  const root = Component(props);
  root.updateMatrixWorld(true);
  return root;
}

function tagged(root, part) {
  const found = [];
  root.traverse(node => { if (node.userData.part === part) found.push(node); });
  return found;
}

function inspectMeshes(root) {
  const bounds = new THREE.Box3();
  let meshes = 0;
  root.traverse(node => {
    const geometry = node.geometry;
    if (!geometry) return;
    meshes++;
    const points = geometry.attributes.position;
    assert.ok(points?.count >= 3);
    for (const value of points.array) assert.ok(Number.isFinite(value), 'non-finite model vertex');
    if (geometry.attributes.normal) {
      for (const value of geometry.attributes.normal.array) assert.ok(Number.isFinite(value), 'non-finite normal');
    }
    geometry.computeBoundingBox();
    bounds.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  assert.ok(meshes > 25, 'physical model has real component geometry');
  return bounds;
}

function rayHitsPart(root, part, origin, direction) {
  const ray = new THREE.Ray(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
  const hits = [];
  for (const node of tagged(root, part)) {
    node.updateMatrixWorld(true);
    const geometry = node.geometry, positions = geometry.attributes.position, index = geometry.getIndex();
    const count = index?.count ?? positions.count;
    for (let at = 0; at < count; at += 3) {
      const get = offset => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(at + offset) : at + offset).applyMatrix4(node.matrixWorld);
      const point = ray.intersectTriangle(get(0), get(1), get(2), false, new THREE.Vector3());
      if (point) hits.push(point.distanceTo(ray.origin));
    }
  }
  return hits;
}

for (const entry of cases) {
  test(`${entry.key} fits authored envelope and leaves its cabin physically populated`, async () => {
    const root = await mount(`models/${entry.model}.jsx`);
    const bounds = inspectMeshes(root);
    assert.ok(bounds.min.x >= -entry.halfWidth && bounds.max.x <= entry.halfWidth, 'width');
    assert.ok(bounds.min.z >= -entry.halfDepth && bounds.max.z <= entry.halfDepth, 'length');
    assert.ok(bounds.max.y <= entry.roof, 'height');
    assert.ok(Math.abs(bounds.min.y + .9) < .001, 'wheel contact');
    assert.ok(modelTriangles(root) < 34000, 'bounded triangle count');
    assert.equal(tagged(root, `${entry.key}-seat`).length, entry.seats);
    assert.equal(tagged(root, `${entry.key}-door-card`).length, entry.doors);
    assert.equal(tagged(root, `${entry.key}-dashboard`).length, 1);
    assert.equal(tagged(root, 'camera-intersection').length, 1);
  });

  test(`${entry.key} shares absolute seat and door positions across views`, async () => {
    const exterior = await mount(`models/${entry.model}.jsx`);
    const firstPerson = await mount(`cockpits/${entry.cabin}.jsx`);
    for (const part of [`${entry.key}-seat`, `${entry.key}-door-card`, `${entry.key}-dashboard`]) {
      const positions = root => tagged(root, part).map(node => {
        const p = new THREE.Vector3();
        node.getWorldPosition(p);
        return p.toArray().map(n => Number(n.toFixed(4)));
      });
      assert.deepEqual(positions(exterior), positions(firstPerson), `${part} moved between views`);
    }
  });

  test(`${entry.key} keeps an open passenger tub over its supporting floor`, async () => {
    const root = await mount(`models/${entry.model}.jsx`);
    const { FOUR_VEHICLE_LAYOUT } = await import('../../src/world/models/fourVehicleLayout.js');
    const eye = FOUR_VEHICLE_LAYOUT[entry.key].eye;
    for (const part of ['hood','deck','sides','floor']) {
      assert.equal(rayHitsPart(root, `${entry.key}-${part}`, eye, [0,0,-1]).length, 0, `${part} blocks forward sight`);
    }
    assert.ok(rayHitsPart(root, `${entry.key}-floor`, [0,-.20,.1], [0,-1,0]).length > 0, 'floor below cabin');
  });
}

test('CLS turbine vents face the occupants and sit on the dashboard fascia', async () => {
  const root = await mount('cockpits/CoupeCabin.jsx', { exterior: true });
  const { FOUR_VEHICLE_LAYOUT } = await import('../../src/world/models/fourVehicleLayout.js');
  const vents = tagged(root, 'coupe-turbine-vent');
  assert.equal(vents.length, 6, 'four central vents and two outers');
  for (const vent of vents) {
    const normal = new THREE.Vector3(0,0,1).applyQuaternion(vent.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(normal.z > .95, 'vent mouth faces the occupants');
    const position = new THREE.Vector3();
    vent.getWorldPosition(position);
    assert.ok(position.y > -.12 && position.y < 0, 'vent is on the visible fascia');
    assert.ok(Math.abs(position.z - (FOUR_VEHICLE_LAYOUT.coupe.cabin.dashZ + .225)) < .025, 'vent is seated against the wood face');
  }
});
