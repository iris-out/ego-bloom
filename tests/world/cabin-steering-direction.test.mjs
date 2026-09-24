import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { transformWithOxc } from 'vite';
import { steerAngle } from '../../src/world/models/carGeometry.js';

const source = await readFile(new URL('../../src/world/models/FourVehicleParts.jsx', import.meta.url), 'utf8');
const start = source.indexOf('export function CabinSteering');
const end = source.indexOf('/** Glazing', start);
assert.ok(start >= 0 && end > start);
const component = source.slice(start, end).replace('export function CabinSteering', 'function CabinSteering');
const { code } = await transformWithOxc(component, 'CabinSteering.jsx',
  { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });

function h(type, props = {}, ...children) {
  props ||= {};
  if (typeof type === 'function') return type({ ...props, children });
  if (type.endsWith('Geometry') || type.endsWith('Material')) return null;
  const node = new THREE.Group();
  node.userData = props.userData || {};
  if (props.position) node.position.fromArray(props.position);
  if (props.rotation) node.rotation.fromArray(props.rotation);
  if (props.scale) node.scale.fromArray(props.scale);
  for (const child of children.flat(Infinity)) if (child instanceof THREE.Object3D) node.add(child);
  if (props.ref) props.ref.current = node;
  return node;
}

function mountSteering(props) {
  let onFrame, onEffect;
  const StaticBatch = ({ children }) => h('group', {}, ...children);
  const CabinSteering = new Function('h', 'Fragment', 'useRef', 'useEffect', 'useFrame', 'steerAngle', 'StaticBatch',
    `${code}; return CabinSteering;`)(h, 'fragment', () => ({ current: null }), callback => { onEffect = callback; },
    callback => { onFrame = callback; }, steerAngle, StaticBatch);
  const root = CabinSteering({ position: [0, 0, 0], radius: .18, ...props });
  onEffect();
  return { root, tick: () => onFrame() };
}

function gripCenterX(root, yoke) {
  let rim;
  root.traverse(node => { if (node.userData.part === (yoke ? 'electric-yoke' : 'steering-wheel')) rim = node; });
  assert.ok(rim, 'mounted steering rim is missing');
  root.updateMatrixWorld(true);
  const radius = .18;
  const points = yoke
    ? [new THREE.Vector3(-radius * .86, radius * .08, .005), new THREE.Vector3(radius * .86, radius * .08, .005)]
    : [new THREE.Vector3(0, radius, 0)];
  return points.reduce((sum, point) => sum + rim.localToWorld(point).x, 0) / points.length;
}

for (const yoke of [false, true]) {
  const shape = yoke ? 'yoke' : 'round wheel';
  test(`${shape} prop and frame steering move its rim toward the pressed key`, () => {
    const centered = mountSteering({ yoke, steer: 0 });
    const origin = gripCenterX(centered.root, yoke);
    assert.ok(Math.abs(origin) < 1e-9);
    for (const steer of [-1, 1]) {
      const mounted = mountSteering({ yoke, steer });
      const direction = steer === 1 ? 1 : -1;
      assert.ok(direction * gripCenterX(mounted.root, yoke) > origin, `${shape} mount steer ${steer}`);
      mounted.tick();
      assert.ok(direction * gripCenterX(mounted.root, yoke) > origin, `${shape} frame steer ${steer}`);
    }
  });

  test(`${shape} reads live wheel ref before status ref and prop`, () => {
    const wheelsRef = { current: { steer: 1 } };
    const statusRef = { current: { steer: -1 } };
    const mounted = mountSteering({ yoke, steer: -1, wheelsRef, statusRef });
    mounted.tick();
    assert.ok(gripCenterX(mounted.root, yoke) > 0, 'live right steer must win');
    wheelsRef.current.steer = -1;
    mounted.tick();
    assert.ok(gripCenterX(mounted.root, yoke) < 0, 'live left steer must win');
    wheelsRef.current.steer = 0;
    mounted.tick();
    assert.ok(Math.abs(gripCenterX(mounted.root, yoke)) < 1e-9, 'centered live steer must not fall through');
    wheelsRef.current = null;
    statusRef.current.steer = 1;
    mounted.tick();
    assert.ok(gripCenterX(mounted.root, yoke) > 0, 'status fallback turns right');
    statusRef.current.steer = -1;
    mounted.tick();
    assert.ok(gripCenterX(mounted.root, yoke) < 0, 'status fallback turns left');
  });
}
