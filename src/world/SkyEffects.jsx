import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function SkyEffects({ timeOfDay, weather, quality, extent }) {
  const sky = useRef(), clouds = useRef();
  const cloudy = weather !== 'clear';
  const night = timeOfDay === 'night';
  const cloudCount = ({ low: 7, medium: 14, high: 22 }[quality]) * (cloudy ? 3 : 1);
  const stars = useMemo(() => {
    const count = { low: 140, medium: 320, high: 600 }[quality];
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = i * 2.399963, y = 0.08 + (i + 0.5) / count * 0.92;
      const radius = Math.sqrt(1 - y * y);
      positions.set([Math.cos(theta) * radius * 1900, y * 1900, Math.sin(theta) * radius * 1900], i * 3);
    }
    return positions;
  }, [quality]);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    for (let i = 0; i < cloudCount; i++) {
      const cluster = Math.floor(i / 3), lobe = i % 3;
      const span = Math.max(460, extent * 1.7);
      transform.position.set(Math.sin(cluster * 2.399) * span + lobe * 25, 270 + cluster % 4 * 15 + (lobe === 1 ? 8 : 0), Math.cos(cluster * 4.117) * span + lobe * 8);
      transform.scale.set(38 + cluster % 3 * 8, 10 + (lobe === 1 ? 7 : 0), 23 + cluster % 4 * 4);
      transform.rotation.set(0, cluster, 0); transform.updateMatrix(); clouds.current.setMatrixAt(i, transform.matrix);
    }
    clouds.current.instanceMatrix.needsUpdate = true;
    clouds.current.computeBoundingSphere();
  }, [cloudCount, extent]);
  useFrame(({ camera, clock }) => {
    sky.current.position.copy(camera.position);
    clouds.current.position.x = Math.sin(clock.elapsedTime * 0.015) * 35;
  });
  const cloudColor = night ? '#627483' : weather === 'rain' ? '#929fa9' : '#f1f0e8';
  return <>
    <group ref={sky}>
      {night ? <>
        <mesh position={[-650, 420, -950]}><sphereGeometry args={[29, 20, 12]} /><meshBasicMaterial color="#e5ebdc" fog={false} /></mesh>
        <mesh position={[-638, 426, -943]}><sphereGeometry args={[26, 20, 12]} /><meshBasicMaterial color="#273b4a" fog={false} /></mesh>
        <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[stars, 3]} /></bufferGeometry><pointsMaterial color="#e5edff" size={2.2} sizeAttenuation fog={false} transparent opacity={cloudy ? 0.35 : 0.85} depthWrite={false} /></points>
      </> : <mesh position={[-650, timeOfDay === 'day' ? 620 : 180, -950]}>
        <sphereGeometry args={[timeOfDay === 'day' ? 35 : 48, 24, 16]} /><meshBasicMaterial color={timeOfDay === 'sunset' ? '#ffc496' : '#fff0c5'} fog={false} />
      </mesh>}
    </group>
    <instancedMesh ref={clouds} args={[null, null, cloudCount]}>
      <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={cloudColor} roughness={1} transparent opacity={cloudy ? 0.94 : 0.83} depthWrite={false} />
    </instancedMesh>
  </>;
}
