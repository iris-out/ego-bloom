import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createDriftEffects, stepDriftEffects, SKID_LIFE, SMOKE_LIFE } from '../driftEffects.js';

/** World-space, bounded tire evidence: one skid draw and one soft smoke draw. */
export default function DriftEffects({ stateRef, paused = false, reducedMotion = false }) {
  const smokeRef = useRef();
  const resources = useMemo(() => {
    const simulation = createDriftEffects();
    const skidGeometry = new THREE.BufferGeometry();
    skidGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(simulation.skids.length * 12), 3).setUsage(THREE.DynamicDrawUsage));
    skidGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(simulation.skids.length * 16), 4).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let i = 0; i < simulation.skids.length; i++) {
      const v = i * 4;
      indices.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    }
    skidGeometry.setIndex(indices);
    const skidMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
      depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const smokeGeometry = new THREE.PlaneGeometry(2, 2);
    smokeGeometry.setAttribute('puffOpacity', new THREE.InstancedBufferAttribute(new Float32Array(simulation.smoke.length), 1).setUsage(THREE.DynamicDrawUsage));
    const smokeMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `
        attribute float puffOpacity;
        varying vec2 puffUv;
        varying float puffAlpha;
        void main() {
          puffUv = uv * 2.0 - 1.0;
          puffAlpha = puffOpacity;
          vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          centre.xy += position.xy * size;
          gl_Position = projectionMatrix * centre;
        }`,
      fragmentShader: `
        varying vec2 puffUv;
        varying float puffAlpha;
        void main() {
          float radius = length(puffUv);
          float edge = 1.0 - smoothstep(0.2, 1.0, radius);
          float wisps = 0.82 + 0.18 * sin(puffUv.x * 9.0 + sin(puffUv.y * 7.0));
          float alpha = edge * edge * puffAlpha * wisps;
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(mix(vec3(0.63, 0.66, 0.67), vec3(0.91, 0.92, 0.91), edge), alpha);
        }`,
    });
    return { simulation, skidGeometry, skidMaterial, smokeGeometry, smokeMaterial, dummy: new THREE.Object3D() };
  }, []);
  useEffect(() => () => {
    resources.skidGeometry.dispose();
    resources.skidMaterial.dispose();
    resources.smokeGeometry.dispose();
    resources.smokeMaterial.dispose();
  }, [resources]);
  useFrame((_, delta) => {
    if (paused) return;
    updateEffects(resources, smokeRef.current, stateRef.current, delta, reducedMotion);
  });
  return <group userData={{ dynamic: true }} dispose={null}>
    <mesh geometry={resources.skidGeometry} material={resources.skidMaterial} frustumCulled={false} renderOrder={2}/>
    <instancedMesh ref={smokeRef} args={[resources.smokeGeometry, resources.smokeMaterial, resources.simulation.smoke.length]}
      frustumCulled={false} renderOrder={3}/>
  </group>;
}

function updateEffects(resources, smokeMesh, state, delta, reducedMotion) {
  const { simulation, skidGeometry, smokeGeometry, dummy } = resources;
  stepDriftEffects(simulation, state, delta, { reducedMotion, drivingFrame: true });
  const positions = skidGeometry.attributes.position;
  const colors = skidGeometry.attributes.color;
  simulation.skids.forEach((mark, i) => {
    const alpha = mark.active ? .50 * Math.min(1, (SKID_LIFE - (simulation.time - mark.born)) / 3) : 0;
    const dx = mark.b[0] - mark.a[0], dz = mark.b[2] - mark.a[2];
    const length = Math.hypot(dx, dz) || 1;
    const acrossX = dz / length * .145, acrossZ = -dx / length * .145;
    for (let corner = 0; corner < 4; corner++) {
      const p = corner < 2 ? mark.a : mark.b;
      const side = corner % 2 ? 1 : -1;
      positions.setXYZ(i * 4 + corner, p[0] + side * acrossX, p[1] + .012, p[2] + side * acrossZ);
      colors.setXYZW(i * 4 + corner, .045, .049, .052, alpha);
    }
  });
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  if (!smokeMesh) return;
  const opacity = smokeGeometry.attributes.puffOpacity;
  simulation.smoke.forEach((puff, i) => {
    if (!puff.active) {
      dummy.position.set(0, 0, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      smokeMesh.setMatrixAt(i, dummy.matrix);
      opacity.setX(i, 0);
      return;
    }
    const age = simulation.time - puff.born;
    const life = age / SMOKE_LIFE;
    const radius = .38 + age * .95;
    const azimuth = puff.seed * 2.399963;
    dummy.position.set(puff.position[0] + Math.sin(azimuth) * age * .20,
      puff.position[1] + .13 + age * .55, puff.position[2] + Math.cos(azimuth) * age * .20);
    dummy.scale.set(radius, radius * .82, radius);
    dummy.updateMatrix();
    smokeMesh.setMatrixAt(i, dummy.matrix);
    opacity.setX(i, .48 * (1 - life));
  });
  opacity.needsUpdate = true;
  smokeMesh.instanceMatrix.needsUpdate = true;
}
