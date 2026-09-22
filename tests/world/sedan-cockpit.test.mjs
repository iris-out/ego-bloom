import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { Object3D } from 'three';
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
  const SedanInterior = new Function(
    'h', 'Fragment', ...names, 'MAX_RPM', 'REDLINE_RPM', 'VEHICLES', 'InstrumentDisplay', 'Mirrors',
    'ROAD_CABINS', 'at', 'cabin', 'CabinLamp', 'detailLevel',
    `${code}; return SedanInterior;`,
  )(
    h, 'fragment', ...names.map(name => components[name]), 8000, 6500, VEHICLES,
    stub('instrument-display'), stub('mirrors'), ROAD_CABINS, at, cabin, stub('cabin-lamp'),
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

test('세단의 렌더된 두 화면은 캐빈 폭 안에서 각 받침판보다 눈 쪽에 있다', async () => {
  const root = await mountSedanInterior();
  const facets = [];
  root.traverse((node) => { if (node.userData.part === 'display-facet') facets.push(node); });
  assert.equal(facets.length, 2);
  for (const facet of facets) {
    const backing = facet.children.find(node => node.userData.type === 'panel');
    const screen = facet.children.find(node => node.userData.type === 'instrument-display');
    assert.ok(backing && screen, `${facet.userData.display} facet is incomplete`);
    const left = facet.position.x - backing.scale.x / 2;
    const right = facet.position.x + backing.scale.x / 2;
    assert.ok(left >= -ROAD_CABINS.sedan.innerWidth / 2 && right <= ROAD_CABINS.sedan.innerWidth / 2,
      `${facet.userData.display} display leaves cabin width`);
    assert.ok(screen.position.z + 0.008 > backing.scale.z / 2,
      `${facet.userData.display} screen is behind its backing`);
  }
});
