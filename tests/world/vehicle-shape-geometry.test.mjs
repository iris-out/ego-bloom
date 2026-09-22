import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as carGeometry from '../../src/world/models/carGeometry.js';

function assertFiniteGeometry(geometry, label) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  assert.ok(positions?.count > 0, `${label} has no positions`);
  assert.equal(normals?.count, positions.count, `${label} normals do not match positions`);
  for (const value of positions.array) assert.ok(Number.isFinite(value), `${label} has a non-finite position`);
  for (const value of normals.array) assert.ok(Number.isFinite(value), `${label} has a non-finite normal`);
  const index = geometry.getIndex();
  assert.ok(index && index.count % 3 === 0, `${label} is not indexed triangles`);
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 2));
    assert.ok(new THREE.Triangle(a, b, c).getArea() > 1e-8, `${label} has a degenerate triangle at ${i / 3}`);
  }
}

function hitsAt(geometry, origin, direction) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  return new THREE.Raycaster(origin, direction.clone().normalize()).intersectObject(mesh, false);
}

test('loft roof rings rise monotonically from lower edge to shoulder and crown', () => {
  const geometry = carGeometry.loftBody([
    { z: -0.9, width: 0.68, lowerY: 0.61, shoulderY: 0.67, topWidth: 0.61, topY: 0.72 },
    { z: -0.55, width: 0.8, lowerY: 0.68, shoulderY: 0.76, topWidth: 0.7, topY: 0.8 },
  ]);
  const p = geometry.getAttribute('position');
  assert.ok(p.getY(0) < p.getY(1), 'lower bevel has no rise');
  assert.ok(p.getY(1) < p.getY(2), 'lower bevel folds above the shoulder');
  assert.ok(p.getY(2) < p.getY(3), 'shoulder does not rise into roof top');
});

test('loft end caps face outward at both ends', () => {
  const geometry = carGeometry.loftBody([
    { z: -1, width: 0.8, lowerY: -0.5, shoulderY: 0.1, topWidth: 0.7, topY: 0.2 },
    { z: 1, width: 0.8, lowerY: -0.5, shoulderY: 0.1, topWidth: 0.7, topY: 0.2 },
  ]);
  const p = geometry.getAttribute('position'), index = geometry.getIndex();
  const signs = { front: [], rear: [] };
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 2));
    if (a.z === -1 && b.z === -1 && c.z === -1) signs.front.push(b.clone().sub(a).cross(c.clone().sub(a)).z);
    if (a.z === 1 && b.z === 1 && c.z === 1) signs.rear.push(b.clone().sub(a).cross(c.clone().sub(a)).z);
  }
  assert.ok(signs.front.length && signs.front.every(value => value < 0), 'front cap normals point into the loft');
  assert.ok(signs.rear.length && signs.rear.every(value => value > 0), 'rear cap normals point into the loft');
});

for (const key of ['sedan', 'suv']) {
  test(`${key} generated lower body leaves the passenger well open and cuts real wheel arches`, () => {
    assert.equal(typeof carGeometry.createVehicleBodyGeometries, 'function', 'vehicle body geometry builder is missing');
    const body = carGeometry.createVehicleBodyGeometries(key);
    for (const [name, geometry] of Object.entries(body)) assertFiniteGeometry(geometry, `${key}.${name}`);

    const shape = carGeometry.VEHICLE_SHAPES[key];
    const cabinRay = hitsAt(body.sideSkin, new THREE.Vector3(0, shape.beltY - 0.03, 0), new THREE.Vector3(0, -1, 0));
    assert.equal(cabinRay.length, 0, `${key} side skin closes over the center passenger well`);

    for (const wheelZ of shape.wheels.z) {
      const opening = hitsAt(body.sideSkin,
        new THREE.Vector3(shape.skinX + 0.3, shape.wheels.y + shape.wheels.radius * 0.62, wheelZ),
        new THREE.Vector3(-1, 0, 0));
      assert.equal(opening.length, 0, `${key} body still covers the wheel opening at z ${wheelZ}`);
      const shoulderY = key === 'sedan' ? 0.12 : 0.20;
      const shoulder = hitsAt(body.sideSkin,
        new THREE.Vector3(shape.skinX + 0.3, shoulderY, wheelZ),
        new THREE.Vector3(-1, 0, 0));
      assert.ok(shoulder.length > 0, `${key} fender has no painted shoulder above z ${wheelZ}`);
    }
    Object.values(body).forEach(geometry => geometry.dispose());
  });

  test(`${key} shared glass anchors stay joined below the roof envelope`, () => {
    assert.ok(carGeometry.VEHICLE_SHAPES?.[key], `${key} shared shape anchors are missing`);
    const shape = carGeometry.VEHICLE_SHAPES[key];
    for (const corner of shape.windshield) {
      assert.ok(corner.every(Number.isFinite), `${key} windshield has a non-finite corner`);
      assert.ok(corner[1] <= shape.roofMax, `${key} windshield rises above roof`);
    }
    const [bottomLeft, bottomRight, topRight, topLeft] = shape.windshield;
    assert.ok(Math.abs(bottomLeft[0] + bottomRight[0]) < 1e-9, `${key} windshield base is not symmetric`);
    assert.ok(Math.abs(topLeft[0] + topRight[0]) < 1e-9, `${key} windshield top is not symmetric`);
    assert.deepEqual(shape.sideWindows.left.front[0], bottomLeft, `${key} side glass misses windshield base`);
    assert.deepEqual(shape.sideWindows.left.front[1], topLeft, `${key} side glass misses windshield top`);
    for (const pane of Object.values(shape.sideWindows.left)) {
      for (const vertex of pane) assert.ok(vertex[1] <= shape.roofMax, `${key} side glass rises above roof`);
    }
  });
}
