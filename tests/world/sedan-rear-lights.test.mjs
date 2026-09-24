import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { Object3D } from 'three';
import * as THREE from 'three';
import {
  SEDAN_FRONT_LIGHTS, SEDAN_REAR_LIGHTS, SUV_FRONT_LIGHTS, SUV_REAR_LIGHTS,
  beamCone, isBeamOn, rearLampIntensity, reverseLampIntensity,
} from '../../src/world/headlights.js';
import { flatPolygonGeometry, quadGeometry } from '../../src/world/models/carGeometry.js';
import { FOUR_VEHICLE_LAYOUT } from '../../src/world/models/fourVehicleLayout.js';

async function mountRuntimeLights({ vehicle = 'sedan', night = false, braking = false, reversing = false, beam = 'off' } = {}) {
  const source = await readFile(new URL('../../src/world/CarMode.jsx', import.meta.url), 'utf8');
  const stripped = source.replace(/import[\s\S]*?from ['"][^'"]+['"];\n/g, '')
    .replace('export default function CarMode', 'function CarMode');
  const { code } = await transformWithOxc(stripped, 'CarMode.jsx',
    { jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' } });
  let frame;
  const h = (type, props = {}, ...children) => {
    props ||= {};
    const node = new Object3D();
    node.userData = { type, ...props.userData };
    if (props.position) node.position.fromArray(props.position);
    if (props.rotation) node.rotation.fromArray(props.rotation);
    if (props.scale) node.scale.fromArray(props.scale);
    for (const child of children.flat(Infinity)) {
      if (child?.isTestMaterial) node.material = child;
      else if (child instanceof Object3D) node.add(child);
    }
    if (typeof props.ref === 'function') props.ref(node);
    else if (props.ref) props.ref.current = node;
    if (type === 'meshStandardMaterial') return { isTestMaterial: true, ...props };
    return node;
  };
  const Lights = new Function(
    'h', 'Fragment', 'THREE', 'useRef', 'useMemo', 'useEffect', 'useFrame',
    'SEDAN_FRONT_LIGHTS', 'SEDAN_REAR_LIGHTS', 'SUV_FRONT_LIGHTS', 'SUV_REAR_LIGHTS',
    'beamCone', 'isBeamOn', 'rearLampIntensity', 'reverseLampIntensity', 'flatPolygonGeometry', 'quadGeometry', 'FOUR_VEHICLE_LAYOUT',
    `${code}; return Lights;`,
  )(
    h, 'fragment', THREE, value => ({ current: value }), factory => factory(), () => {}, callback => { frame = callback; },
    SEDAN_FRONT_LIGHTS, SEDAN_REAR_LIGHTS, SUV_FRONT_LIGHTS, SUV_REAR_LIGHTS,
    beamCone, isBeamOn, rearLampIntensity, reverseLampIntensity,
    flatPolygonGeometry, quadGeometry, FOUR_VEHICLE_LAYOUT,
  );
  const lamps = { current: { braking, reversing } };
  const root = Lights({ vehicle, night, beam, lamps });
  return { root, lamps, advance: () => frame() };
}

function parts(root, name) {
  const found = [];
  root.traverse(node => { if (node.userData.part === name) found.push(node); });
  return found;
}

test('실제 CarMode 세단 등화 분기는 넓은 한 줄 대신 여섯 개 브레이크 행과 작은 후진등을 만든다', async () => {
  const { root } = await mountRuntimeLights();
  assert.equal(parts(root, 'brake-lamp-row').length, 6);
  assert.equal(parts(root, 'reverse-lamp').length, 2);
  const redMeshes = [];
  root.traverse(node => { if (node.material?.emissive === '#d94f3d') redMeshes.push(node); });
  assert.equal(redMeshes.length, 0, 'legacy broad one-row rear lamps still render for sedan');
});

test('실제 CarMode SUV 등화 분기는 broad box 대신 공유한 앞뒤 두 줄을 상태에 맞춰 갱신한다', async () => {
  const { root, lamps, advance } = await mountRuntimeLights({ vehicle: 'suv', beam: 'low' });
  const frontRows = parts(root, 'suv-headlight-row');
  const rearRows = parts(root, 'suv-brake-lamp-row');
  const reverseLamps = parts(root, 'suv-reverse-lamp');
  assert.equal(frontRows.length, 4);
  assert.equal(rearRows.length, 4);
  assert.equal(reverseLamps.length, 2);
  assert.equal(parts(root, 'generic-headlight').length, 0);
  assert.ok(frontRows.every(node => node.position.z <= SUV_FRONT_LIGHTS.rowZ - 0.006),
    'runtime SUV headlights z-fight the static rows');
  advance();
  assert.ok(frontRows.every(node => node.material.emissiveIntensity === 3.4));
  assert.ok(rearRows.every(node => node.material.emissiveIntensity === 0.1));
  lamps.current.braking = true;
  lamps.current.reversing = true;
  advance();
  assert.ok(rearRows.every(node => node.material.emissiveIntensity === 3.4));
  assert.ok(reverseLamps.every(node => node.material.emissiveIntensity === 2.8));
});

test('실제 CarMode 프레임 갱신이 여섯 줄 모두를 브레이크 밝기로 바꾼다', async () => {
  const { root, lamps, advance } = await mountRuntimeLights();
  const rows = parts(root, 'brake-lamp-row');
  advance();
  assert.ok(rows.every(row => row.material.emissiveIntensity === 0.1));
  lamps.current.braking = true;
  advance();
  assert.ok(rows.every(row => row.material.emissiveIntensity === 3.4));
});

test('실제 CarMode 세단 전조등 분기는 broad bar 대신 projector와 L-DRL을 같은 밝기로 갱신한다', async () => {
  const { root, advance } = await mountRuntimeLights({ beam: 'low' });
  const projectors = parts(root, 'headlight-projector');
  const drls = parts(root, 'headlight-drl');
  assert.equal(projectors.length, 4);
  assert.equal(drls.length, 8);
  assert.ok(projectors.every((node, index) => node.position.z <= SEDAN_FRONT_LIGHTS.projectors[index].position[2] - 0.006),
    'runtime projectors z-fight the static lenses');
  assert.ok(drls.every((node, index) => node.position.z <= SEDAN_FRONT_LIGHTS.drlSegments[index].position[2] - 0.006),
    'runtime DRLs z-fight the static lenses');
  advance();
  assert.ok([...projectors, ...drls].every(node => node.material.emissiveIntensity === 3.4));
  const broad = [];
  root.traverse(node => { if (node.userData.part === 'generic-headlight') broad.push(node); });
  assert.equal(broad.length, 0);
});
