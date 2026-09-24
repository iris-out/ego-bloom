import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';

async function mount(name, props = {}) {
  const { default: Model } = await loadModelFixture(new URL(`../../src/world/models/${name}.jsx`, import.meta.url).pathname);
  const root = Model(props);
  root.updateMatrixWorld(true);
  return root;
}
function parts(root, name) {
  const result = [];
  root.traverse(node => { if (node.userData.part === name) result.push(node); });
  return result;
}
function bounds(root) {
  const box = new THREE.Box3();
  root.traverse(node => {
    if (!node.geometry) return;
    for (const value of node.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    node.geometry.computeBoundingBox();
    box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  return box;
}

test('drift kit keeps wheel contact and fits its driving collision envelope', async () => {
  const root = await mount('DriftCar');
  const box = bounds(root);
  assert.ok(box.min.x >= -1.25 && box.max.x <= 1.25, 'wide kit must stay within 2.5m');
  assert.ok(box.min.z >= -2.5 && box.max.z <= 2.5, 'aero must stay within 5m');
  assert.ok(Math.abs(box.min.y + .9) < .001, 'wheel contact stays at -0.9');
  assert.equal(parts(root, 'wheel-hub').length, 4);
  assert.equal(parts(root, 'drift-fender').length, 4);
  assert.equal(parts(root, 'drift-wing').length, 1);
  assert.ok(modelTriangles(root) < 42000, 'bounded geometry budget');
});

test('drift conversion preserves original cabin anchors and first-person visibility', async () => {
  const original = await mount('Convertible');
  const drift = await mount('DriftCar', { firstPerson: true });
  for (const name of ['convertible-seat', 'convertible-dashboard', 'convertible-door-card']) {
    const positions = root => parts(root, name).map(node => node.getWorldPosition(new THREE.Vector3()).toArray());
    assert.deepEqual(positions(drift), positions(original));
  }
  assert.equal(parts(drift, 'camera-intersection')[0].visible, false);
  const eye = new THREE.Vector3(-.53, .5, -.05);
  const ray = new THREE.Ray(eye, new THREE.Vector3(0, 0, -1));
  parts(drift, 'drift-kit')[0].traverse(node => {
    if (!node.geometry) return;
    const box = bounds(node);
    assert.equal(ray.intersectsBox(box), false, 'tuning kit leaves driver forward view open');
  });
});
