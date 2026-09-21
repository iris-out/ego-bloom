import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCasterIndex, casterFrustum, composePart, countCasters, fillCasters, freezeStatic, markMoved,
  NO_CAST_MATERIALS, selectCasterCells, snapshotPoses } from '../../src/world/cityTiles.js';

const SHAPES = ['box', 'octagon', 'cylinder', 'tree', 'trunk', 'cone'];

/** 결정적인 도시 조각이다. 높은 건물, 나무, 얇은 노면 표시가 섞인다. */
function scatter(count = 3000, span = 1600) {
  const batches = new Map();
  for (let i = 0; i < count; i++) {
    const shape = SHAPES[i % SHAPES.length];
    const material = i % 17 === 0 ? 'road' : i % 5 === 0 ? 'leaf' : 'stone';
    const key = `${shape}-${material}`;
    if (!batches.has(key)) batches.set(key, { shape, material, parts: [] });
    const x = Math.sin(i * 12.9898) * span, z = Math.cos(i * 78.233) * span;
    const flat = i % 7 === 0;
    const height = flat ? 0.05 : 2 + (i % 13) * 9;
    batches.get(key).parts.push({
      position: [x, flat ? 0.36 : height / 2, z], scale: [3 + (i % 4), height, 2 + (i % 3)],
      rotation: i % 11 === 0 ? [0.3, i * 0.1, 0.05] : i * 0.37, owner: null,
    });
  }
  return [...batches.values()];
}

/** three 의 실제 그림자 카메라와 Frustum 으로 구가 보이는지 본다. */
function threeFrustum({ x, z, half, direction }) {
  const far = 340 + half * 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, far);
  camera.position.set(x + direction[0] * 320, direction[1] * 320, z + direction[2] * 320);
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  return frustum;
}

test('바닥 재질과 얇게 깔린 조각은 그림자 파트에서 빠진다', () => {
  const batches = scatter();
  const index = buildCasterIndex(batches);
  const kept = index.cells.flatMap((cell) => Object.values(cell.byShape).flat());
  const expected = batches.filter((batch) => !NO_CAST_MATERIALS.includes(batch.material))
    .flatMap((batch) => batch.parts.filter((part) => !(part.scale[1] < 0.3 && part.position[1] < 0.8 && !Array.isArray(part.rotation)
      && ['box', 'octagon', 'cylinder'].includes(batch.shape))));
  assert.equal(kept.length, expected.length);
  assert.ok(index.shapes.length <= SHAPES.length, '그림자 패스 draw call 은 shape 수를 넘지 않는다');
});

const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1), octagon: new THREE.CylinderGeometry(1, 1, 1, 8), cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  tree: new THREE.IcosahedronGeometry(1, 1), trunk: new THREE.CylinderGeometry(0.7, 1, 1, 7), cone: new THREE.ConeGeometry(1, 1, 8),
};

/** 파트의 실제 모양을 변환한 월드 AABB 다. */
function worldBox(shape, part) {
  const object = new THREE.Mesh(GEOMETRY[shape]);
  object.position.fromArray(part.position);
  object.scale.fromArray(part.scale);
  if (Array.isArray(part.rotation)) object.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2], 'YXZ');
  else object.rotation.set(0, part.rotation, 0);
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object, true);
}

test('절두체에 닿는 파트는 모두 고른 칸에 들어간다', () => {
  const index = buildCasterIndex(scatter(4000));
  for (const direction of [[-0.45, 0.63, -0.62], [0.74, 0.065, -0.67], [-0.48, 0.43, -0.76]]) {
    for (const [x, z, half] of [[0, 0, 96], [420, -380, 192], [-900, 600, 384]]) {
      const frustum = casterFrustum({ x, z, half, far: 340 + half * 2, direction });
      const picked = new Set(selectCasterCells(index, frustum).flatMap((cell) => Object.values(cell.byShape).flat()));
      const reference = threeFrustum({ x, z, half, direction });
      let inside = 0;
      for (const cell of index.cells) for (const [shape, parts] of Object.entries(cell.byShape)) for (const part of parts) {
        if (!reference.intersectsBox(worldBox(shape, part))) continue;
        inside += 1;
        assert.ok(picked.has(part), `절두체 안 파트가 빠졌다 (${direction}, ${x}, ${z}, ${half})`);
      }
      assert.ok(inside > 0, '시험 절두체가 비어 있으면 검사가 의미가 없다');
      assert.ok(picked.size < index.cells.reduce((sum, cell) => sum + Object.values(cell.byShape).flat().length, 0),
        '도시 전체가 아니라 절두체 근처만 고른다');
    }
  }
});

test('행렬은 Object3D 의 변환과 같다', () => {
  const object = new THREE.Object3D();
  const out = new Float32Array(16);
  for (const part of [
    { position: [3, 4, -5], scale: [2, 7, 0.5], rotation: 0.83 },
    { position: [-8, 1, 2], scale: [1, 0.2, 9], rotation: [0.4, -1.1, 0.25] },
  ]) {
    object.position.fromArray(part.position);
    object.scale.fromArray(part.scale);
    if (Array.isArray(part.rotation)) object.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2], 'YXZ');
    else object.rotation.set(0, part.rotation, 0);
    object.updateMatrix();
    composePart(part, out, 0);
    object.matrix.elements.forEach((value, i) => assert.ok(Math.abs(value - out[i]) < 1e-5, `원소 ${i}`));
  }
});

test('고른 칸의 shape 별 파트를 빈틈없이 채운다', () => {
  const index = buildCasterIndex(scatter(1500));
  const cells = index.cells.slice(0, 12);
  for (const shape of index.shapes) {
    const count = countCasters(cells, shape);
    const out = new Float32Array(Math.max(1, count) * 16);
    assert.equal(fillCasters(cells, shape, out), count);
    for (let i = 0; i < count; i++) assert.equal(out[i * 16 + 15], 1);
  }
});

test('고정한 가지는 자동 갱신을 끄고 dynamic 가지는 그대로 둔다', () => {
  const root = new THREE.Group();
  const still = new THREE.Mesh();
  still.position.set(1, 2, 3);
  const moving = new THREE.Group();
  moving.userData.dynamic = true;
  const child = new THREE.Mesh();
  moving.add(child);
  root.add(still, moving);
  freezeStatic(root);
  assert.equal(root.matrixAutoUpdate, false);
  assert.equal(still.matrixAutoUpdate, false);
  assert.equal(still.matrix.elements[12], 1);
  assert.equal(moving.matrixAutoUpdate, true);
  assert.equal(child.matrixAutoUpdate, true);
});

test('몇 프레임 사이에 스스로 움직인 가지만 dynamic 으로 표시한다', () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const rotor = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const flame = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4 }));
  rotor.add(blade);
  root.add(body, rotor, flame);
  const before = snapshotPoses(root);
  rotor.rotation.y += 0.7;
  flame.material.opacity = 0.55;
  assert.equal(markMoved(root, before), 2);
  assert.equal(rotor.userData.dynamic, true);
  assert.equal(flame.userData.dynamic, true);
  assert.equal(blade.userData.dynamic, undefined, '돌아가는 가지 안의 조각은 가지와 함께 움직일 뿐이다');
  assert.equal(body.userData.dynamic, undefined);
});
