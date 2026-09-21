import { CAR_PALETTE } from './carGeometry.js';

/** 승용차 계열(세단, SUV, 오픈카, 트럭) 이 함께 쓰는 바퀴다. 모델마다 바퀴를 다시 만들지 않는다.
 * 축 규약은 Sedan 과 같다. 바깥 group 이 rotation.x 로 굴리고 안쪽이 원통 축을 X 로 눕힌다. */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const SPOKES = [0, 1, 2];

export function Wheel({ radius, brake = false, width = 0.34, dual = false }) {
  const tread = dual ? width * 1.9 : width;
  return <group rotation={[0, 0, HALF_PI]}>
    <mesh castShadow><cylinderGeometry args={[radius, radius, tread, 12]} /><meshStandardMaterial color={CAR_PALETTE.tire} roughness={0.9} /></mesh>
    <mesh position={[0, 0.005, 0]}><cylinderGeometry args={[radius * 0.58, radius * 0.58, tread + 0.01, 12]} /><meshStandardMaterial color={CAR_PALETTE.rim} metalness={0.5} roughness={0.35} /></mesh>
    {SPOKES.map((index) => <mesh key={index} position={[0, 0.005, 0]} rotation={[0, index * TWO_PI / SPOKES.length, 0]}>
      <boxGeometry args={[0.07, tread + 0.02, radius * 1.05]} />
      <meshStandardMaterial color={CAR_PALETTE.tire} roughness={0.6} />
    </mesh>)}
    <mesh position={[0, -0.01, 0]}><cylinderGeometry args={[radius * 0.4, radius * 0.4, 0.05, 16]} /><meshStandardMaterial color={CAR_PALETTE.disc} metalness={0.7} roughness={0.3} /></mesh>
    {brake && <mesh position={[0, radius * 0.32, 0]}>
      <boxGeometry args={[0.1, 0.14, 0.09]} />
      <meshStandardMaterial color={CAR_PALETTE.caliper} roughness={0.5} />
    </mesh>}
  </group>;
}
