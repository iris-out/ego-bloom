import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyePoint, cockpitFov } from '../../src/world/eyePoints.js';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';

function bounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse(n => { if(n.geometry) { n.geometry.computeBoundingBox(); box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld)); } });
  return box;
}

test('airship fits the landing plane and conservative collision envelope', async () => {
  const { default: Airship } = await loadModelFixture('src/world/models/Airship.jsx');
  const root = Airship({}); const box = bounds(root);
  assert.ok(Math.abs(box.min.y + 1.9) < .001, `landing bottom ${box.min.y}`);
  assert.ok(box.min.x >= -7 && box.max.x <= 7);
  assert.ok(box.min.z >= -17 && box.max.z <= 17 && box.max.y <= 16);
  // Collision volume is centred above the gondola, at local y=7.
  root.traverse(n => {
    const vertices = n.geometry?.attributes.position;
    if (!vertices) return;
    for (let i = 0; i < vertices.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(n.matrixWorld);
      assert.ok(point.distanceTo(new THREE.Vector3(0, 7, 0)) <= 18, 'visual geometry outside collision sphere');
    }
  });
  let envelope, propellers = [];
  root.traverse(n => { if(n.userData.part === 'airship-envelope') envelope = n; if(n.userData.part === 'airship-propeller') propellers.push(n); });
  assert.ok(envelope); const balloon = bounds(envelope);
  assert.ok(balloon.max.z - balloon.min.z >= 31 && balloon.max.y - balloon.min.y >= 9.9);
  assert.equal(propellers.length, 2);
  assert.ok(propellers.every(n => n.userData.dynamic));
});

test('first-person airship hides exterior cabin without hiding the envelope', async () => {
  const { default: Airship } = await loadModelFixture('src/world/models/Airship.jsx');
  const root = Airship({firstPerson: true}); let exterior, envelope;
  root.traverse(n => { if(n.userData.part === 'airship-exterior-cabin') exterior = n; if(n.userData.part === 'airship-envelope') envelope = n; });
  assert.equal(exterior?.visible, false);
  assert.equal(envelope?.visible, true);
});

test('panoramic cabin keeps forward and lateral eye rays clear within the low triangle budget', async () => {
  const { default: Cabin } = await loadModelFixture('src/world/cockpits/AirshipCabin.jsx');
  for(const quality of ['low', 'medium', 'high']) {
    const cabin = Cabin({quality}); cabin.updateMatrixWorld(true);
    assert.ok(modelTriangles(cabin) < 1800, `${quality}: ${modelTriangles(cabin)}`);
    const eye = new THREE.Vector3(0,.9,-5.2);
    for(const direction of [[0,0,-1],[-1,0,0],[1,0,0],[-.6,0,-1],[.6,0,-1]]) {
      const ray = new THREE.Ray(eye, new THREE.Vector3(...direction).normalize());
      cabin.traverse(n => {
        if(!n.geometry || n.userData.glass) return;
        n.geometry.computeBoundingBox();
        assert.equal(ray.intersectsBox(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld)), false, `${quality}: eye blocked ${direction}`);
      });
    }
  }
});

test('airship flight screen fits the forward vertical field of view', async () => {
  const { default: Cabin } = await loadModelFixture('src/world/cockpits/AirshipCabin.jsx');
  const cabin = Cabin({quality: 'low'}); cabin.updateMatrixWorld(true);
  // InstrumentDisplay owns a unit box scaled to its bezel width and height.
  let display;
  cabin.traverse(n => { if(n.geometry?.type === 'BoxGeometry' && Math.abs(n.scale.x - 1.57) < .0001) display = n; });
  assert.ok(display, 'flight screen bezel missing');
  const box = bounds(display), eye = eyePoint('airship');
  const half = cockpitFov('airship') / 2;
  for(const y of [box.min.y, box.max.y]) {
    const downward = Math.atan2(eye[1] - y, eye[2] - box.max.z) * 180 / Math.PI;
    assert.ok(downward > 0 && downward < half - 1, `flight screen ${downward.toFixed(1)} degrees below eye exceeds ${half - 1}`);
  }
  for (const x of [box.min.x, 0, box.max.x]) for (const y of [box.min.y, box.max.y]) {
    const origin = new THREE.Vector3(...eye), target = new THREE.Vector3(x, y, box.max.z + .001);
    const distance = origin.distanceTo(target);
    const ray = new THREE.Ray(origin, target.sub(origin).normalize());
    cabin.traverse(n => {
      if (!n.geometry || n === display || n.userData.glass) return;
      n.geometry.computeBoundingBox();
      const hit = ray.intersectBox(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld), new THREE.Vector3());
      assert.ok(!hit || origin.distanceTo(hit) >= distance, 'dashboard or controls obscure the flight display');
    });
  }
});
