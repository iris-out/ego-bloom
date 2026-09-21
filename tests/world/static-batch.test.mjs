import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { materialSignature, mergeStatic } from '../../src/world/staticBatch.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const grey = () => new THREE.MeshStandardMaterial({ color: '#445566', roughness: 0.6 });

function worldBox(object) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object, true);
}

test('속성이 같은 재질은 인스턴스가 달라도 한 mesh 로 합친다', () => {
  const root = new THREE.Group();
  root.position.set(3, 1, -2);
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(box, grey());
    mesh.position.set(i * 2, 0, 0);
    mesh.rotation.set(0.2 * i, 0.4, 0);
    root.add(mesh);
  }
  const red = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#aa2222' }));
  root.add(red);
  const before = worldBox(root);
  const { merged, hidden } = mergeStatic(root);
  assert.equal(merged.length, 1, '회색 다섯 개만 합치고 하나뿐인 빨강은 그대로 둔다');
  assert.equal(hidden.length, 5);
  assert.ok(red.visible);
  merged.forEach((mesh) => root.add(mesh));
  assert.equal(merged[0].geometry.attributes.position.count, 5 * 36);
  const after = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((node) => { if (node.isMesh && node.visible) after.union(new THREE.Box3().setFromObject(node, true)); });
  assert.ok(after.min.distanceTo(before.min) < 1e-4 && after.max.distanceTo(before.max) < 1e-4, '합친 뒤에도 같은 자리를 덮는다');
});

test('움직이는 가지와 숨긴 mesh 는 합치지 않는다', () => {
  const root = new THREE.Group();
  const shared = grey();
  const needle = new THREE.Group();
  needle.userData.dynamic = true;
  needle.add(new THREE.Mesh(box, shared), new THREE.Mesh(box, shared));
  const off = new THREE.Mesh(box, shared);
  off.visible = false;
  root.add(needle, off, new THREE.Mesh(box, shared));
  const { merged } = mergeStatic(root);
  assert.equal(merged.length, 0);
});

test('음수 배율 조각은 감김을 되돌려 법선이 바깥을 본다', () => {
  const root = new THREE.Group();
  const material = grey();
  for (const side of [1, -1]) {
    const mesh = new THREE.Mesh(box, material);
    mesh.scale.set(side, 1, 1);
    mesh.position.x = side * 3;
    root.add(mesh);
  }
  const { merged } = mergeStatic(root);
  const geometry = merged[0].geometry;
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    const face = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    n.fromBufferAttribute(normal, i);
    assert.ok(face.dot(n) > 0.99, `삼각형 ${i / 3} 의 감김과 법선이 같은 쪽을 본다`);
  }
});

test('셰이더를 고친 재질은 서명이 같아도 합치지 않는다', () => {
  const root = new THREE.Group();
  const material = grey();
  material.onBeforeCompile = () => {};
  root.add(new THREE.Mesh(box, material), new THREE.Mesh(box, material));
  assert.equal(mergeStatic(root).merged.length, 0);
  assert.equal(materialSignature(grey()), materialSignature(grey()));
});
