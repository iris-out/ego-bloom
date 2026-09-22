import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { Object3D } from 'three';
import * as THREE from 'three';
import {
  beamBetween, createVehicleBodyGeometries, flatPolygonGeometry, loftBody, quadGeometry, steerAngle,
  VEHICLE_SHAPES,
} from '../../src/world/models/carGeometry.js';
import { SEDAN_FRONT_LIGHTS, SEDAN_REAR_LIGHTS } from '../../src/world/headlights.js';

async function mountSedan(props = {}) {
  const source = await readFile(new URL('../../src/world/models/Sedan.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source.replace(/import[\s\S]*?from ['"][^'"]+['"];\n/g, '')
    .replace('export default function Sedan', 'function Sedan'), 'Sedan.jsx',
  { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  let frame;
  const h = (type, nodeProps = {}, ...children) => {
    nodeProps ||= {};
    if (type === 'meshStandardMaterial') return { isTestMaterial: true, ...nodeProps };
    if (typeof type === 'function') return type({ ...nodeProps, children });
    const node = new Object3D();
    node.userData = { type, ...nodeProps.userData };
    if (nodeProps.position) node.position.fromArray(nodeProps.position);
    if (nodeProps.rotation) node.rotation.fromArray(nodeProps.rotation);
    if (nodeProps.scale) node.scale.fromArray(nodeProps.scale);
    if (nodeProps.visible === false) node.visible = false;
    for (const child of children.flat(Infinity)) {
      if (child?.isTestMaterial) node.material = child;
      else if (child instanceof Object3D) node.add(child);
    }
    if (typeof nodeProps.ref === 'function') nodeProps.ref(node);
    else if (nodeProps.ref) nodeProps.ref.current = node;
    return node;
  };
  const Sedan = new Function(
    'h', 'Fragment', 'THREE', 'useEffect', 'useMemo', 'useRef', 'useFrame', 'Block', 'Wheel',
    'beamBetween', 'createVehicleBodyGeometries', 'flatPolygonGeometry', 'loftBody', 'quadGeometry',
    'steerAngle', 'VEHICLE_SHAPES',
    'DetailLamp', 'PanelSeam', 'SurfaceVent', 'StaticBatch', 'SEDAN_FRONT_LIGHTS', 'SEDAN_REAR_LIGHTS',
    `${code}; return Sedan;`,
  )(
    h, 'fragment', THREE, effect => effect(), factory => factory(), () => ({ current: null }), callback => { frame = callback; },
    blockProps => h('block', blockProps), wheelProps => h('wheel', { ...wheelProps, userData: { spokes: wheelProps.spokes } }),
    beamBetween, createVehicleBodyGeometries, flatPolygonGeometry, loftBody, quadGeometry, steerAngle,
    VEHICLE_SHAPES,
    props => h('detail-lamp', props), props => h('panel-seam', props), props => h('surface-vent', props),
    ({ children }) => h('fragment', null, children), SEDAN_FRONT_LIGHTS, SEDAN_REAR_LIGHTS,
  );
  const root = Sedan(props);
  return { root, advance: delta => frame({}, delta) };
}

function partsOf(root) {
  const parts = new Map();
  root.traverse((node) => {
    const part = node.userData.part;
    if (part) parts.set(part, (parts.get(part) || 0) + 1);
  });
  return parts;
}

test('세단 외관은 G60풍 비율과 전후면 디자인 단서를 갖는다', async () => {
  const { root } = await mountSedan();
  const parts = partsOf(root);
  assert.ok(parts.get('long-hood') > 0, '긴 보닛 실루엣이 없다');
  assert.ok(parts.get('sculpted-body-shell') > 0, '연속 면으로 다듬은 차체 셸이 없다');
  assert.equal(parts.get('kidney-grille'), 2);
  assert.equal(parts.get('kidney-grille-slat'), 14);
  assert.equal(parts.get('sedan-headlamp-housing'), 2);
  assert.equal(parts.get('sedan-projector'), 4);
  assert.equal(parts.get('sedan-drl-segment'), 8);
  assert.equal(parts.get('front-lower-intake'), 1);
  assert.equal(parts.get('front-air-curtain'), 2);
  assert.equal(parts.get('shoulder-line'), 2);
  assert.equal(parts.get('sedan-tail-lamp-housing'), 2);
  assert.equal(parts.get('sedan-tail-lamp-row'), 6);
  assert.equal(parts.get('rear-vertical-reflector'), 2);
  assert.equal(parts.get('rear-diffuser'), 1);
  assert.equal(parts.get('rear-plate-inset'), 1);
  assert.ok(parts.get('trunk-lip') > 0, '트렁크 립이 없다');
  assert.ok(parts.get('panoramic-roof') > 0, '파노라마 루프가 없다');
  const grilles = [];
  root.traverse(node => { if (node.userData.part === 'kidney-grille') grilles.push(node); });
  assert.ok(grilles.every(node => node.material?.side === THREE.DoubleSide), 'front kidney face is backface culled');
  const wheels = [];
  root.traverse((node) => { if (node.userData.type === 'wheel') wheels.push(node); });
  assert.ok(wheels.every(node => node.userData.spokes === 5), '세단 전용 5스포크 휠이 아니다');
});

test('세단 바퀴 접지와 축 위치는 기존 주행 계약을 유지한다', async () => {
  const { root } = await mountSedan();
  const hubs = [];
  root.traverse((node) => { if (node.userData.part === 'wheel-hub') hubs.push(node); });
  assert.equal(hubs.length, 4);
  assert.deepEqual(hubs.map(node => [node.position.x, node.position.z]).sort(), [
    [-0.98, -1.55], [-0.98, 1.55], [0.98, -1.55], [0.98, 1.55],
  ]);
  assert.ok(hubs.every(node => Math.abs(node.position.y + 0.48) < 1e-10));
});

test('1인칭에서는 캐빈만 숨고 긴 보닛과 차체는 남는다', async () => {
  const { root } = await mountSedan({ firstPerson: true });
  let cabin;
  let hood;
  root.traverse((node) => {
    if (node.userData.part === 'camera-intersection') cabin = node;
    if (node.userData.part === 'long-hood') hood = node;
  });
  assert.equal(cabin.visible, false);
  assert.equal(hood.visible, true);
});
