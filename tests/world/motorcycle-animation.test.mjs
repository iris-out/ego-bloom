import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { Object3D, Vector3 } from 'three';
import { steerAngle } from '../../src/world/models/carGeometry.js';

// Evaluate the actual JSX hierarchy and frame callback without a WebGL renderer.
// Three still computes every parent/child transform used by the model.
async function mountMotorcycle(props) {
  const source = await readFile(new URL('../../src/world/models/Motorcycle.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source.replace(/^import .*;$/gm, '')
    .replace('export default function Motorcycle', 'function Motorcycle'), 'Motorcycle.jsx',
  { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  let frame;
  const h = (type, props = {}, ...children) => {
    props ||= {};
    if (typeof type === 'function') return type({ ...props, children });
    const node = new Object3D();
    node.userData = { type, ...props };
    if (props.position) node.position.fromArray(props.position);
    if (props.rotation) node.rotation.fromArray(props.rotation);
    if (props.scale) node.scale.fromArray(props.scale);
    for (const child of children.flat(Infinity)) if (child instanceof Object3D) node.add(child);
    if (props.ref) props.ref.current = node;
    return node;
  };
  // 이 하네스는 import 를 지우고 필요한 것만 넣어 준다. 모델이 쓰는 값이 늘면 여기도 같이 넣는다.
  const Model = new Function('h', 'Fragment', 'useRef', 'useFrame', 'Block', 'StaticBatch', 'steerAngle', `${code}; return Motorcycle;`)(
    h, 'fragment', () => ({ current: null }), callback => { frame = callback; },
    props => h('block', props),
    // StaticBatch merges meshes for draw calls only; this harness never renders, so it's a passthrough.
    ({ children }) => h('fragment', null, children),
    steerAngle,
  );
  const root = Model(props);
  const tires = [], calipers = [];
  root.traverse(node => {
    if (node.children.some(child => child.userData.type === 'cylinderGeometry' && child.userData.args[0] === 0.32)) tires.push(node);
    if (node.userData.type === 'block' && node.scale.equals(new Vector3(0.06, 0.1, 0.05))) calipers.push(node);
  });
  return { root, tires, calipers, advance: dt => frame({}, dt) };
}

for (const steer of [0, 0.7]) {
  test(`motorcycle wheels roll around fixed hubs and calipers stay still (steer ${steer})`, async () => {
    const { tires, calipers, advance } = await mountMotorcycle({ speed: 2, steer });
    assert.equal(tires.length, 2);
    assert.equal(calipers.length, 2);
    const centers = tires.map(tire => tire.getWorldPosition(new Vector3()));
    const fixed = calipers.map(part => part.getWorldPosition(new Vector3()));
    const tread = tires.map(tire => tire.localToWorld(new Vector3(0.32, 0, 0)));
    for (let i = 0; i < 20; i++) {
      advance(1 / 60);
      tires.forEach((tire, index) => assert.ok(tire.getWorldPosition(new Vector3()).distanceTo(centers[index]) < 1e-10, 'wheel hub moves while spinning'));
      calipers.forEach((part, index) => assert.ok(part.getWorldPosition(new Vector3()).distanceTo(fixed[index]) < 1e-10, 'caliper rotates with tire'));
    }
    tires.forEach((tire, index) => assert.ok(tire.localToWorld(new Vector3(0.32, 0, 0)).distanceTo(tread[index]) > 0.1, 'tire must actually rotate'));
  });
}

test('motorcycle tire contact moves opposite travel for forward and reverse', async () => {
  for (const speed of [2, -2]) {
    const { tires, advance } = await mountMotorcycle({ speed });
    const contact = tires.map(tire => tire.worldToLocal(tire.getWorldPosition(new Vector3()).add(new Vector3(0, -0.32, 0))));
    const before = tires.map((tire, index) => tire.localToWorld(contact[index].clone()));
    advance(1 / 60);
    tires.forEach((tire, index) => {
      const dz = tire.localToWorld(contact[index].clone()).z - before[index].z;
      assert.ok(dz * speed > 0, 'contact point must roll toward +Z when driving toward -Z');
    });
  }
});
