import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { Object3D } from 'three';
import { rollWheels, steerAngle } from '../../src/world/models/carGeometry.js';

async function mountFormula(props = {}) {
  const source = await readFile(new URL('../../src/world/models/Formula.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source.replace(/^import .*;$/gm, '')
    .replace('export default function Formula', 'function Formula'), 'Formula.jsx',
  { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  let frame;
  const h = (type, nodeProps = {}, ...children) => {
    nodeProps ||= {};
    if (typeof type === 'function') return type({ ...nodeProps, children });
    const node = new Object3D();
    node.userData = { type, ...nodeProps.userData };
    if (nodeProps.position) node.position.fromArray(nodeProps.position);
    if (nodeProps.rotation) node.rotation.fromArray(nodeProps.rotation);
    if (nodeProps.scale) node.scale.fromArray(nodeProps.scale);
    if (nodeProps.visible === false) node.visible = false;
    for (const child of children.flat(Infinity)) if (child instanceof Object3D) node.add(child);
    if (typeof nodeProps.ref === 'function') nodeProps.ref(node);
    else if (nodeProps.ref) nodeProps.ref.current = node;
    return node;
  };
  const Formula = new Function(
    'h', 'Fragment', 'useEffect', 'useRef', 'useFrame', 'Block', 'Wheel', 'StaticBatch', 'steerAngle', 'rollWheels',
    `${code}; return Formula;`,
  )(
    h, 'fragment', effect => effect(), initial => ({ current: initial ?? null }), callback => { frame = callback; },
    blockProps => h('block', blockProps), wheelProps => h('wheel', wheelProps),
    ({ children }) => h('fragment', null, children), steerAngle, rollWheels,
  );
  const root = Formula(props);
  return { root, advance: delta => frame({}, delta) };
}

test('포뮬러 외관은 현대식 오픈휠 핵심 실루엣과 네 바퀴를 갖는다', async () => {
  const { root } = await mountFormula({ speed: 20 });
  const parts = new Map();
  root.traverse(node => {
    const part = node.userData.part;
    if (part) parts.set(part, (parts.get(part) || 0) + 1);
  });
  for (const part of ['front-wing', 'rear-wing', 'halo', 'sidepod', 'suspension']) {
    assert.ok(parts.get(part) > 0, `${part} 실루엣이 없다`);
  }
  assert.equal(parts.get('wheel-hub'), 4);
  assert.equal(parts.get('front-wheel'), 2);
  assert.equal(parts.get('rear-wheel'), 2);
});

test('포뮬러 바퀴는 고정 허브에서 굴러가고 앞바퀴만 조향한다', async () => {
  const { root, advance } = await mountFormula({ speed: 18, steer: 0.7 });
  const hubs = [];
  root.traverse(node => { if (node.userData.part === 'wheel-hub') hubs.push(node); });
  const before = hubs.map(node => node.rotation.x);
  advance(1 / 60);
  hubs.forEach((node, index) => assert.notEqual(node.rotation.x, before[index]));
  const front = hubs.filter(node => node.userData.axle === 'front');
  const rear = hubs.filter(node => node.userData.axle === 'rear');
  assert.ok(front.every(node => node.parent.rotation.y === steerAngle(0.7)));
  assert.ok(rear.every(node => node.parent.rotation.y === 0));
});

test('1인칭은 눈과 겹치는 머리받침만 숨기고 헤일로와 차체는 남긴다', async () => {
  const { root } = await mountFormula({ firstPerson: true });
  const find = (part) => {
    let found;
    root.traverse(node => { if (node.userData.part === part) found = node; });
    return found;
  };
  assert.equal(find('camera-intersection').visible, false);
  assert.equal(find('halo').visible, true);
  assert.equal(find('monocoque').visible, true);
});
