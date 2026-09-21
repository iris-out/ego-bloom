import * as THREE from 'three';

/** 움직이지 않는 mesh 를 재질별로 한 geometry 로 합친다. 순수 Three 코드라 React 없이 테스트한다.
 * 실내와 총 모델은 상자 수십 개로 되어 있어 조각마다 draw call 이 하나씩 나간다.
 * 합친 mesh 는 원본 대신 그려지고 원본은 visible 만 끈다. 원본의 재질 인스턴스를 그대로 쓴다. */

const DEFAULT_COMPILE = THREE.Material.prototype.onBeforeCompile;

const hex = (color) => (color?.isColor ? color.getHexString() : '');

/** 속성이 같은 재질은 인스턴스가 달라도 같은 서명이다. JSX 로 조각마다 만든 재질도 한데 묶인다. */
export function materialSignature(material) {
  return [
    material.type, hex(material.color), hex(material.emissive), material.emissiveIntensity,
    material.roughness, material.metalness, material.opacity, material.transparent, material.side,
    material.map?.uuid, material.emissiveMap?.uuid, material.alphaMap?.uuid, material.normalMap?.uuid,
    material.toneMapped, material.depthTest, material.depthWrite, material.colorWrite, material.blending,
    material.vertexColors, material.flatShading, material.wireframe, material.fog, material.alphaTest,
    material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits,
  ].join('|');
}

/** 합칠 수 있는 mesh 인지 본다. 애니메이션이 걸린 가지는 userData.dynamic 으로 표시해 빼 둔다. */
function mergeable(mesh) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.userData.staticBatch) return false;
  if (Array.isArray(mesh.material) || !mesh.material || !mesh.geometry?.attributes?.position) return false;
  // 셰이더를 고친 재질은 서명이 같아도 결과가 다를 수 있다. 원본 그대로 둔다.
  if (mesh.material.onBeforeCompile !== DEFAULT_COMPILE) return false;
  return mesh.geometry.morphAttributes == null || Object.keys(mesh.geometry.morphAttributes).length === 0;
}

function collect(root) {
  const found = [];
  const walk = (node, hiddenAbove) => {
    if (node.userData?.dynamic || node.userData?.staticBatch) return;
    const hidden = hiddenAbove || !node.visible;
    if (node !== root && !hidden && mergeable(node)) found.push(node);
    for (const child of node.children) walk(child, hidden);
  };
  walk(root, false);
  return found;
}

const _relative = new THREE.Matrix4(), _inverse = new THREE.Matrix4(), _normal = new THREE.Matrix3();
const _v = new THREE.Vector3();

/** mesh 하나를 root 기준 좌표의 삼각형 목록으로 풀어 배열에 붙인다. */
function append(mesh, out) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  _relative.multiplyMatrices(_inverse, mesh.matrixWorld);
  _normal.getNormalMatrix(_relative);
  // 음수 배율은 삼각형을 뒤집는다. 앞면만 그리는 재질에서 사라지지 않게 감김을 되돌린다.
  const flip = _relative.determinant() < 0;
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const start = geometry.drawRange.start, end = Math.min(count, start + geometry.drawRange.count);
  for (let i = start; i + 2 < end; i += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const k = i + (flip ? [0, 2, 1][corner] : corner);
      const vertex = index ? index.getX(k) : k;
      _v.fromBufferAttribute(position, vertex).applyMatrix4(_relative);
      out.position.push(_v.x, _v.y, _v.z);
      if (normal) _v.fromBufferAttribute(normal, vertex).applyMatrix3(_normal).normalize();
      else _v.set(0, 1, 0);
      out.normal.push(_v.x, _v.y, _v.z);
      out.uv.push(uv ? uv.getX(vertex) : 0, uv ? uv.getY(vertex) : 0);
    }
  }
}

/** root 아래 정적 mesh 를 합친다. 합친 mesh 목록과 숨긴 원본 목록을 돌려준다.
 * 호출자가 합친 mesh 를 root 에 붙이고, 되돌릴 때 geometry 를 해제하고 원본을 다시 켠다. */
export function mergeStatic(root, { minGroup = 2 } = {}) {
  root.updateWorldMatrix(true, true);
  _inverse.copy(root.matrixWorld).invert();
  const groups = new Map();
  for (const mesh of collect(root)) {
    const key = `${materialSignature(mesh.material)}#${mesh.castShadow}${mesh.receiveShadow}${mesh.renderOrder}${mesh.frustumCulled}`;
    const list = groups.get(key);
    if (list) list.push(mesh); else groups.set(key, [mesh]);
  }
  const merged = [], hidden = [];
  for (const meshes of groups.values()) {
    if (meshes.length < minGroup) continue;
    const out = { position: [], normal: [], uv: [] };
    for (const mesh of meshes) append(mesh, out);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
    geometry.computeBoundingSphere();
    const first = meshes[0];
    const mesh = new THREE.Mesh(geometry, first.material);
    Object.assign(mesh, { castShadow: first.castShadow, receiveShadow: first.receiveShadow, renderOrder: first.renderOrder, frustumCulled: first.frustumCulled });
    mesh.userData.staticBatch = true;
    merged.push(mesh);
    for (const original of meshes) { original.visible = false; hidden.push(original); }
  }
  return { merged, hidden };
}
