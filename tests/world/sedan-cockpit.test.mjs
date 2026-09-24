import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import * as THREE from 'three';
const { Object3D } = THREE;
import { surfaceFixtures } from './model-surface-fixtures.mjs';
import { MODERN_DISPLAYS, curvedDisplayGeometry, steeringRimGeometry } from '../../src/world/cockpits/modernCabinGeometry.js';
import { VEHICLES } from '../../src/world/carPhysics.js';
import { ROAD_CABINS } from '../../src/world/cockpits/vehicleInteriorLayout.js';
import { at, cabin } from '../../src/world/cockpits/cabinLayout.js';

async function mountSedanInterior() {
  const source = await readFile(new URL('../../src/world/cockpits/RoadInteriors.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source.replace(/^import .*;$/gm, '').replace(/export function /g, 'function '),
    'RoadInteriors.jsx', { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  const h = (type, nodeProps = {}, ...children) => {
    nodeProps ||= {};
    if (typeof type === 'function') return type({ ...nodeProps, children });
    const node = new Object3D();
    node.userData = { type, ...nodeProps.userData };
    if (nodeProps.geometry) node.geometry = nodeProps.geometry;
    if (nodeProps.position) node.position.fromArray(nodeProps.position);
    if (nodeProps.rotation) node.rotation.fromArray(nodeProps.rotation);
    if (nodeProps.scale) node.scale.fromArray(nodeProps.scale);
    for (const child of children.flat(Infinity)) if (child instanceof Object3D) node.add(child);
    return node;
  };
  const stub = name => props => h(name, props);
  const names = ['Bolts', 'Dial', 'GearLever', 'GlassPane', 'GrabHandle', 'Knob', 'Panel', 'Pedals',
    'PushButton', 'Seat', 'ShadeStrip', 'Toggle', 'Wipers', 'Yoke'];
  const components = Object.fromEntries(names.map(name => [name, stub(name.toLowerCase())]));
  const modernNames = ['ModernDashboard', 'ModernConsole', 'ModernDoor', 'ModernWheel', 'ModernSeats'];
  const modernSource = await readFile(new URL('../../src/world/cockpits/ModernRoadCabin.jsx', import.meta.url), 'utf8');
  const modernCode = (await transformWithOxc(modernSource.replace(/^import .*;$/gm, '').replace(/export function /g, 'function '),
    'ModernRoadCabin.jsx', { jsx: { runtime: 'classic', pragma: 'h' } })).code;
  const Shell = surfaceFixtures(h).Shell;
  const modern = new Function('h', 'THREE', 'useMemo', 'useEffect', 'useRef', 'useFrame', 'Shell', 'useSurfaceMaterial', 'Panel', 'Knob', 'PushButton', 'StaticBatch', 'at', 'cabin', 'drawInstrument', 'MODERN_DISPLAYS', 'curvedDisplayGeometry', 'steeringRimGeometry', `${modernCode}; return [${modernNames.join(',')}];`)(
    h, THREE, fn => fn(), () => {}, () => ({current: null}), () => {}, Shell, properties => new THREE.MeshStandardMaterial(properties), components.Panel, components.Knob, components.PushButton,
    props => h('group', {}, props.children), at, cabin, () => {}, MODERN_DISPLAYS, curvedDisplayGeometry, steeringRimGeometry);
  const SedanInterior = new Function(
    'h', 'Fragment', 'Shell', ...modernNames, ...names, 'MAX_RPM', 'REDLINE_RPM', 'VEHICLES', 'InstrumentDisplay', 'Mirrors',
    'ROAD_CABINS', 'at', 'cabin', 'wiperPhase', 'CabinLamp', 'detailLevel',
    `${code}; return SedanInterior;`,
  )(
    h, 'fragment', Shell, ...modern, ...names.map(name => components[name]), 8000, 6500, VEHICLES,
    stub('instrument-display'), stub('mirrors'), ROAD_CABINS, at, cabin, () => 0, stub('cabin-lamp'),
    () => ({ mid: true, high: true }),
  );
  return SedanInterior({ statusRef: { current: {} }, quality: 'high', weather: 'clear' });
}

test('세단의 실제 1인칭 콕핏은 G60형 디지털 구성이고 아날로그 원형 계기를 쓰지 않는다', async () => {
  const root = await mountSedanInterior();
  const parts = new Map();
  root.traverse((node) => {
    if (node.userData.part) parts.set(node.userData.part, (parts.get(node.userData.part) || 0) + 1);
  });
  assert.ok(parts.get('g60-curved-display') > 0, '커브드 디스플레이가 없다');
  assert.ok(parts.get('g60-interaction-bar') > 0, '인터랙션 바가 없다');
  assert.ok(parts.get('g60-floating-console') > 0, '플로팅 콘솔이 없다');
  let analogueDials = 0;
  root.traverse((node) => { if (node.userData.type === 'dial') analogueDials += 1; });
  assert.equal(analogueDials, 0);
});

test('rendered sedan uses one continuous curved glass backing inside the cabin', async () => {
  const root = await mountSedanInterior();
  let display;
  root.traverse(node => { if(node.userData.part === 'g60-curved-display') display=node; });
  assert.ok(display);
  const backing=display.children.find(node=>node.geometry);
  assert.ok(backing, 'continuous display geometry is missing');
  backing.geometry.computeBoundingBox();
  const box=backing.geometry.boundingBox;
  assert.ok(box.max.z > box.min.z, 'display must curve toward the passenger');
  assert.ok(box.max.x-box.min.x < ROAD_CABINS.sedan.innerWidth);
  assert.equal(ROAD_CABINS.sedan.screens.length,2);
  assert.deepEqual(ROAD_CABINS.sedan.screens.map(s=>s.mode),['executiveCluster','roadnav']);
});
