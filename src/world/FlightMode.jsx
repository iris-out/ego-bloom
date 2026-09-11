/* eslint-disable react-hooks/immutability -- controlsRef is an intentionally shared imperative input ref, synchronized with the cockpit controls. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFlightState, stepFlight, flightStatus } from './flightPhysics.js';

function Block({ position, scale, color = '#e3dece', ...props }) {
  return <mesh position={position} scale={scale} castShadow receiveShadow {...props}><boxGeometry /><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
}

function RepeatedBlocks({ parts, color }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    parts.forEach(([position, scale], index) => {
      dummy.position.fromArray(position); dummy.scale.fromArray(scale); dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} receiveShadow><boxGeometry /><meshStandardMaterial color={color} roughness={0.8} /></instancedMesh>;
}

export function Airport({ extent, parked = true }) {
  const marks = useMemo(() => {
    const parts = [];
    for (let z = -130; z <= 130; z += 20) parts.push([[0, 0.35, z], [0.65, 0.04, 9]]);
    for (const side of [-1, 1]) {
      parts.push([[side * 12.5, 0.35, 0], [0.35, 0.04, 348]]);
      for (const end of [-1, 1]) for (let i = 0; i < 4; i++) parts.push([[side * (2.5 + i * 2.3), 0.35, end * 163], [1.2, 0.04, 12]]);
      for (const end of [-1, 1]) {
        // Paired outlined threshold numerals echo a miniature runway's 18/36 signage.
        for (const x of [-2.5, 2.5]) {
          parts.push([[x - 1, 0.35, end * 147], [0.5, 0.04, 5]]);
          parts.push([[x + 1, 0.35, end * 147], [0.5, 0.04, 5]]);
          parts.push([[x, 0.35, end * 147 + side * 2.5], [2.5, 0.04, 0.5]]);
        }
      }
    }
    return parts;
  }, []);
  const fence = useMemo(() => {
    const parts = [];
    for (const side of [-1, 1]) {
      for (let z = -190; z <= 190; z += 10) parts.push([[side * 63, 1.1, z], [0.3, 2.2, 0.3]]);
      parts.push([[side * 63, 1.4, 0], [0.15, 0.15, 380]]);
    }
    return parts;
  }, []);
  const windows = useMemo(() => Array.from({ length: 8 }, (_, i) => [[-26.9, 4.3, 18 + i * 4], [0.12, 3, 2.4]]), []);
  return <group position={[extent + 110, 0, 0]}>
    <Block position={[0, -1.1, 0]} scale={[140, 2.2, 400]} color="#a8bc9a" />
    <Block position={[-65, -0.6, 30]} scale={[110, 1.2, 20]} color="#a8bc9a" />
    <Block position={[0, 0.15, 0]} scale={[28, 0.3, 360]} color="#68777b" />
    <Block position={[-32, 0.12, 45]} scale={[42, 0.24, 135]} color="#a1aaa6" />
    <Block position={[-63, 0.18, 30]} scale={[94, 0.2, 10]} color="#7b898d" />
    <Block position={[-40, 4, 33]} scale={[26, 8, 45]} />
    <Block position={[-40, 8.2, 33]} scale={[29, 0.7, 48]} color="#617c7c" />
    <RepeatedBlocks parts={windows} color="#668d98" />
    <Block position={[-41, 5, 101]} scale={[30, 10, 33]} color="#cfceb8" />
    <Block position={[-41, 10.3, 101]} scale={[33, 1.2, 36]} color="#788b86" />
    <Block position={[-25.9, 4, 101]} scale={[0.2, 7, 26]} color="#64777b" />
    <Block position={[-43, 10, -13]} scale={[6, 20, 6]} color="#ded9c8" />
    <Block position={[-43, 19, -13]} scale={[11, 4, 10]} color="#6c929a" />
    <Block position={[-43, 21.4, -13]} scale={[12, 0.8, 11]} color="#566e73" />
    <Block position={[-43, 24, -13]} scale={[0.3, 5, 0.3]} color="#59696c" />
    <RepeatedBlocks parts={marks} color="#f0e9d4" />
    <RepeatedBlocks parts={fence} color="#778779" />
    {parked && <group position={[0, 2.1, 140]}><Jet /></group>}
  </group>;
}

function Jet() {
  const wing = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1, -2.2); shape.lineTo(-10, 3); shape.lineTo(-10, 4.5); shape.lineTo(-1, 2.7);
    shape.lineTo(1, 2.7); shape.lineTo(10, 4.5); shape.lineTo(10, 3); shape.lineTo(1, -2.2); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.23, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);
  useEffect(() => () => wing.dispose(), [wing]);
  return <group>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><capsuleGeometry args={[1.1, 10, 6, 12]} /><meshStandardMaterial color="#ebe8df" metalness={0.15} roughness={0.45} /></mesh>
    <mesh geometry={wing} castShadow dispose={null}><meshStandardMaterial color="#deded4" roughness={0.55} /></mesh>
    <mesh position={[0, 0.72, -3.7]} scale={[0.9, 0.65, 1.9]} castShadow><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#385c6d" metalness={0.3} roughness={0.22} /></mesh>
    <Block position={[0, 1.6, 4.2]} scale={[0.25, 3, 2.6]} color="#628e9b" rotation={[-0.25, 0, 0]} />
    <Block position={[0, 0.55, 4.5]} scale={[6.5, 0.22, 1.6]} color="#628e9b" />
    {[-1, 1].map((side) => <group key={side}>
      <mesh position={[side * 1.6, 0.3, 3]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.6, 0.68, 2.8, 10]} /><meshStandardMaterial color="#a3afb0" metalness={0.3} /></mesh>
      <mesh position={[side * 1.6, 0.3, 4.43]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.45, 10]} /><meshStandardMaterial color="#36454a" /></mesh>
      <Block position={[side * 2, -1.1, 1]} scale={[0.16, 1.2, 0.16]} color="#78898c" />
      <mesh position={[side * 2, -1.5, 1]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.4, 0.4, 0.28, 10]} /><meshStandardMaterial color="#394649" /></mesh>
      <Block position={[side * 9.4, 0.1, 3.7]} scale={[0.4, 0.18, 1.1]} color={side < 0 ? '#bd7467' : '#78a987'} />
    </group>)}
    <Block position={[0, -1.1, -3.7]} scale={[0.16, 1.2, 0.16]} color="#78898c" />
    <mesh position={[0, -1.5, -3.7]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.28, 10]} /><meshStandardMaterial color="#394649" /></mesh>
  </group>;
}

export default function FlightMode({ extent, controlsRef, onCameraChange, onStatus }) {
  const jet = useRef(), state = useRef(createFlightState(extent)), keys = useRef(new Set());
  const pointer = useRef({ id: null, x: 0, y: 0, pitch: 0, yaw: 0 });
  const resetNonce = useRef(controlsRef?.current?.resetNonce), lastReport = useRef(-1);
  const { camera, gl } = useThree();
  const vectors = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }), []);
  useEffect(() => {
    const canvas = gl.domElement;
    const codes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract'];
    const down = (event) => {
      if (event.target.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')) return;
      if (codes.includes(event.code)) { event.preventDefault(); keys.current.add(event.code); }
    };
    const up = (event) => keys.current.delete(event.code);
    const clear = () => { keys.current.clear(); pointer.current = { id: null, pitch: 0, yaw: 0 }; };
    const start = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pitch: 0, yaw: 0 };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event) => {
      const drag = pointer.current;
      if (event.pointerId !== drag.id) return;
      drag.pitch = THREE.MathUtils.clamp((drag.y - event.clientY) / 120, -1, 1);
      drag.yaw = THREE.MathUtils.clamp((event.clientX - drag.x) / 120, -1, 1);
    };
    const stop = (event) => {
      if (pointer.current.id !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pointer.current = { id: null, pitch: 0, yaw: 0 };
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop); canvas.addEventListener('lostpointercapture', stop);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', stop); canvas.removeEventListener('pointercancel', stop); canvas.removeEventListener('lostpointercapture', stop);
      if (pointer.current.id !== null && canvas.hasPointerCapture(pointer.current.id)) canvas.releasePointerCapture(pointer.current.id);
      clear();
    };
  }, [gl]);
  useEffect(() => {
    state.current = createFlightState(extent);
    camera.position.set(extent + 110, 15, 176);
    camera.lookAt(extent + 110, 3, 125);
  }, [extent, camera]);
  useFrame(({ clock }, delta) => {
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.05)) : 0;
    const controls = controlsRef?.current || {};
    if (controls.resetNonce !== resetNonce.current) {
      resetNonce.current = controls.resetNonce;
      state.current = createFlightState(extent);
      controls.throttle = 0;
      keys.current.clear(); pointer.current.pitch = 0; pointer.current.yaw = 0;
      camera.position.set(extent + 110, 15, 176);
    }
    const input = keys.current;
    const throttleChange = Number(input.has('Equal') || input.has('NumpadAdd')) - Number(input.has('Minus') || input.has('NumpadSubtract'));
    if (throttleChange) controls.throttle = THREE.MathUtils.clamp((Number(controls.throttle) || 0) + throttleChange * dt * 0.35, 0, 1);
    const next = stepFlight(state.current, {
      throttle: controls.throttle || 0,
      pitch: (Number(controls.pitch) || 0) + Number(input.has('KeyW')) - Number(input.has('KeyS')) + pointer.current.pitch,
      roll: (Number(controls.roll) || 0) + Number(input.has('KeyD')) - Number(input.has('KeyA')),
      yaw: (Number(controls.yaw) || 0) + Number(input.has('KeyE')) - Number(input.has('KeyQ')) + pointer.current.yaw,
    }, dt, extent);
    if (next.message && next.speed === 0) controls.throttle = 0;
    state.current = next;
    jet.current.position.set(next.x, next.y, next.z);
    jet.current.rotation.set(next.pitch, next.heading, next.roll, 'YXZ');
    vectors.position.set(next.x + Math.sin(next.heading) * 38, next.y + 13, next.z + Math.cos(next.heading) * 38);
    camera.position.lerp(vectors.position, 1 - Math.exp(-dt * 4));
    vectors.target.set(next.x - Math.sin(next.heading) * 17, next.y + 2, next.z - Math.cos(next.heading) * 17);
    camera.lookAt(vectors.target);
    if (clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = clock.elapsedTime;
      onCameraChange?.({ x: next.x, z: next.z });
      onStatus?.(flightStatus(next));
    }
  });
  return <group ref={jet}><Jet /></group>;
}
