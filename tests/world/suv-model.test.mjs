import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { Object3D } from 'three';
import * as THREE from 'three';
import * as carGeometry from '../../src/world/models/carGeometry.js';
import { SUV_FRONT_LIGHTS, SUV_REAR_LIGHTS } from '../../src/world/headlights.js';

async function mountSuv(props = {}) {
  const source = await readFile(new URL('../../src/world/models/Suv.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source.replace(/^import .*;$/gm, '')
    .replace('export default function Suv', 'function Suv'), 'Suv.jsx',
  { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  const h = (type, nodeProps = {}, ...children) => {
    nodeProps ||= {};
    if (typeof type === 'function') return type({ ...nodeProps, children });
    const node = new Object3D();
    node.userData = { type, ...nodeProps.userData };
    if (nodeProps.position) node.position.fromArray(nodeProps.position);
    if (nodeProps.rotation) node.rotation.fromArray(nodeProps.rotation);
    if (nodeProps.scale) node.scale.fromArray(nodeProps.scale);
    if (nodeProps.geometry) node.geometry = nodeProps.geometry;
    if (nodeProps.visible === false) node.visible = false;
    for (const child of children.flat(Infinity)) if (child instanceof Object3D) node.add(child);
    if (typeof nodeProps.ref === 'function') nodeProps.ref(node);
    else if (nodeProps.ref) nodeProps.ref.current = node;
    return node;
  };
  const Suv = new Function(
    'h', 'Fragment', 'THREE', 'useEffect', 'useMemo', 'useRef', 'useFrame', 'Block', 'Wheel',
    'P', ...Object.keys(carGeometry), 'SUV_FRONT_LIGHTS', 'SUV_REAR_LIGHTS',
    'DetailLamp', 'PanelSeam', 'SurfaceVent', 'StaticBatch',
    `${code}; return Suv;`,
  )(
    h, 'fragment', THREE, effect => effect(), factory => factory(), () => ({ current: [] }), () => {},
    props => h('block', props), props => h('wheel', props), carGeometry.CAR_PALETTE, ...Object.values(carGeometry),
    SUV_FRONT_LIGHTS, SUV_REAR_LIGHTS,
    props => h('detail-lamp', props), props => h('panel-seam', props), props => h('surface-vent', props),
    ({ children }) => h('fragment', null, children),
  );
  return Suv(props);
}

test('SUV has a hollow joined body and reference-shaped front and rear treatments', async () => {
  const root = await mountSuv();
  const parts = new Map();
  root.traverse((node) => {
    if (node.userData.part) parts.set(node.userData.part, (parts.get(node.userData.part) || 0) + 1);
  });
  assert.ok(parts.get('g01-body-shell') > 0, 'hollow lower body is missing');
  assert.equal(parts.get('suv-kidney-grille'), 2);
  assert.equal(parts.get('suv-grille-slat'), 10);
  assert.equal(parts.get('suv-headlamp-housing'), 2);
  assert.equal(parts.get('suv-headlamp-line'), 4);
  assert.equal(parts.get('suv-lower-intake'), 1);
  assert.equal(parts.get('suv-air-curtain'), 2);
  assert.equal(parts.get('suv-tail-housing'), 2);
  assert.equal(parts.get('suv-tail-row'), 4);
  assert.equal(parts.get('suv-vertical-reflector'), 2);
  assert.equal(parts.get('suv-rear-diffuser'), 1);
  assert.equal(parts.get('single-grille') || 0, 0);
  assert.equal(parts.get('horizontal-tail-lamp') || 0, 0);
  assert.equal(parts.get('exhaust') || 0, 0);
  assert.equal(parts.get('external-spare') || 0, 0);

  let fascia;
  root.traverse(node => { if (node.userData.part === 'suv-rear-fascia') fascia = node; });
  assert.ok(fascia, 'rear fascia geometry is not identifiable');
  fascia.geometry.computeBoundingBox();
  assert.ok(fascia.geometry.boundingBox.max.z >= 2.473,
    'rear fascia is coplanar with the rear body face');
});

test('SUV front and rear shoulder surfaces meet the taller fascias without lowering its approved sill', () => {
  const shape = carGeometry.VEHICLE_SHAPES.suv;
  assert.ok(shape.sideUpper[0][1] >= 0.33);
  assert.ok(shape.sideUpper.at(-1)[1] >= 0.33);
  assert.equal(shape.sillY, -0.52);
  assert.deepEqual(shape.wheels, { y: -0.42, z: [-1.60, 1.65], radius: 0.53 });
});

test('SUV wheel hubs preserve physics anchors and first person hides only the cabin', async () => {
  const root = await mountSuv({ firstPerson: true });
  const hubs = [], hidden = [];
  root.traverse((node) => {
    if (node.userData.part === 'wheel-hub') hubs.push([node.position.x, node.position.y, node.position.z]);
    if (node.userData.part === 'camera-intersection' && !node.visible) hidden.push(node);
  });
  assert.deepEqual(hubs.map(point => point.map(value => Math.round(value * 100) / 100)).sort(), [
    [-1.02, -0.42, -1.6], [-1.02, -0.42, 1.65], [1.02, -0.42, -1.6], [1.02, -0.42, 1.65],
  ]);
  assert.equal(hidden.length, 1);
});
