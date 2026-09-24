import { useSurfaceMaterial } from './useSurfaceMaterial.js';
import { useEffect, useMemo } from 'react';
import StaticBatch from '../StaticBatch.jsx';
import { tireGeometry } from './vehicleSurfaces.js';
import { CAR_PALETTE, createVehicleBodyGeometries } from './carGeometry.js';

/** 승용차 계열(세단, SUV, 오픈카, 트럭) 이 함께 쓰는 바퀴다. 모델마다 바퀴를 다시 만들지 않는다.
 * 축 규약은 Sedan 과 같다. 바깥 group 이 rotation.x 로 굴리고 안쪽이 원통 축을 X 로 눕힌다. */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const THREE_SPOKES = [0, 1, 2];
const FIVE_SPOKES = [0, 1, 2, 3, 4];

export function Wheel({ radius, brake = false, width = 0.34, dual = false, spokes = 3, spokeColor = CAR_PALETTE.tire }) {
  const tireMaterial=useSurfaceMaterial({color:CAR_PALETTE.tire,roughness:.9});
  const tread = dual ? width * 1.9 : width;
  const spokeOffsets = spokes === 5 ? FIVE_SPOKES : THREE_SPOKES;
  const tire = useMemo(() => tireGeometry(radius, tread), [radius, tread]);
  useEffect(() => () => tire.dispose(), [tire]);
  return <group rotation={[0, 0, HALF_PI]}><StaticBatch>
    <mesh castShadow geometry={tire} material={tireMaterial} dispose={null}/>
    <mesh position={[0, 0.005, 0]}><cylinderGeometry args={[radius * 0.58, radius * 0.58, tread + 0.01, 32]} /><meshStandardMaterial color={CAR_PALETTE.rim} metalness={0.5} roughness={0.35} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[0, side * (tread / 2 + .006), 0]} rotation={[HALF_PI, 0, 0]}>
      <torusGeometry args={[radius * .65, radius * .045, 6, 32]} /><meshStandardMaterial color={CAR_PALETTE.rim} metalness={.8} roughness={.23}/>
    </mesh>)}
    {spokeOffsets.map((index) => <mesh key={index} position={[0, 0.005, 0]} rotation={[0, index * TWO_PI / spokeOffsets.length, 0]}>
      <boxGeometry args={[spokes === 5 ? 0.045 : 0.07, tread + 0.02, radius * 1.05]} />
      <meshStandardMaterial color={spokeColor} metalness={spokes === 5 ? 0.55 : 0} roughness={0.42} />
    </mesh>)}
    <mesh position={[0, -0.01, 0]}><cylinderGeometry args={[radius * 0.4, radius * 0.4, 0.05, 16]} /><meshStandardMaterial color={CAR_PALETTE.disc} metalness={0.7} roughness={0.3} /></mesh>
    {brake && <mesh position={[0, radius * 0.32, 0]}>
      <boxGeometry args={[0.1, 0.14, 0.09]} />
      <meshStandardMaterial color={CAR_PALETTE.caliper} roughness={0.5} />
    </mesh>}
  </StaticBatch></group>;
}

/** Roadster uses the same open passenger tub and cut wheel arches, resized at the
 * geometry level so the steering axis and wheel positions remain independent. */
export function RoadsterBody({ color }) {
  const material=useSurfaceMaterial({color,metalness:.38,roughness:.28,side:2});
  const parts = useMemo(() => createVehicleBodyGeometries('sedan'), []);
  useEffect(() => () => Object.values(parts).forEach(g => g.dispose()), [parts]);
  return <group scale={[.947, .95, .916]} position={[0,-.044,0]}>
    {Object.entries(parts).map(([key,geometry])=><mesh key={key} geometry={geometry} material={material} dispose={null}/>)}
  </group>;
}
