import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 헬리콥터 시각 모델. Jet 과 같은 축 규약을 따른다.
 * 로컬 원점은 동체 중심, +Y 위, 기수 -Z, 가로 X 다. 부모가 위치와 YXZ 자세를 준다.
 * 스키드 최하단은 정확히 -1.9 다. FLIGHT_GROUND=2.1 이 활주로 착지 높이를 맞춘다.
 * 전장 Z -6..9, 메인 로터 반지름 7, 전체 높이 y 4.5 를 넘기지 않는다. 비행 물리와 카메라가 이 크기를 전제한다.
 * 로터 회전은 이 컴포넌트가 직접 돌린다. 부모는 자세만 준다.
 * firstPerson 이면 노즈 캐노피, 글레어실드, 문, 동체 캐빈 몸통을 숨긴다. 3인칭 실루엣은 그대로다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

const BODY = '#3f6b73';
const BODY_LIGHT = '#52818a';
const IVORY = '#e8e3d6';
const METAL = '#394649';
const GLASS = '#385c6d';
const STRUT = '#78898c';
const BLADE = '#2f373a';
const INTAKE = '#1d2427';
const EXHAUST = '#0f1214';

const MAIN_ROTOR_SPEED = 24;
const TAIL_ROTOR_SPEED = 58;
const MAX_STEP = 0.05;
const BLADE_DROOP = 0.035;
const MAIN_BLADES = [0, 1, 2, 3];
const TAIL_BLADES = [0, 1, 2];

/* 세로로 세운 압출 규약이다. shape 의 x 는 Z 축, y 는 Y 축, 두께는 X 로 가운데 정렬한다. */
function extrudeUpright(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => (index ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateY(-HALF_PI);
  geometry.translate(depth / 2, 0, 0);
  return geometry;
}

function Lamp({ position, radius, color }) {
  return <mesh position={position}><sphereGeometry args={[radius, 8, 6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.4} /></mesh>;
}

function MainBlade() {
  return <group rotation={[BLADE_DROOP, 0, 0]}>
    <Block position={[0, 0, 3.4]} scale={[0.34, 0.07, 6.4]} color={BLADE} />
    <Block position={[0, 0.005, 6.35]} scale={[0.35, 0.075, 0.5]} color={IVORY} />
  </group>;
}

/* 로컬 Y 가 회전축이다. 부모 group 이 Z 로 90도 돌려서 회전축을 월드 X 로 맞춘다. */
function TailBlade() {
  return <Block position={[0, 0, 0.62]} scale={[0.2, 0.04, 1.1]} color={BLADE} />;
}

export default function Helicopter({ firstPerson = false }) {
  const mainRotor = useRef();
  const tailRotor = useRef();

  const geometries = useMemo(() => ({
    fin: extrudeUpright([[6.7, 0.35], [7.5, 2.7], [8.4, 2.7], [8.55, 0.35]], 0.2),
    ventralFin: extrudeUpright([[7.2, 0.4], [8.3, 0.4], [8.1, -0.5], [7.5, -0.5]], 0.16),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  /* 탭이 뒤에서 돌아온 뒤 큰 delta 로 블레이드가 튀지 않게 한 프레임 회전량을 막는다. */
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP);
    if (mainRotor.current) mainRotor.current.rotation.y = (mainRotor.current.rotation.y + MAIN_ROTOR_SPEED * step) % TWO_PI;
    if (tailRotor.current) tailRotor.current.rotation.y = (tailRotor.current.rotation.y + TAIL_ROTOR_SPEED * step) % TWO_PI;
  });

  return <group>
    <StaticBatch>
      <mesh position={[0, -0.3, -4.5]} scale={[1.25, 0.9, 1.45]} castShadow><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={BODY} metalness={0.15} roughness={0.45} /></mesh>
      <Block position={[0, -0.6, -1.4]} scale={[2.5, 1.1, 4.6]} color={BODY} />
      <Block position={[0, 0.25, 1.7]} scale={[2.1, 1.9, 2.2]} color={BODY_LIGHT} />
      <Block position={[0, -0.35, -1.3]} scale={[2.56, 0.34, 4.9]} color={IVORY} />
      <PanelSeam position={[0, 0.82, -1.3]} scale={[0.55, 0.025, 3.2]} color={BODY_LIGHT} />

      <mesh position={[0, -1.12, -4.6]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.12, 10]} /><meshStandardMaterial color={IVORY} emissive={IVORY} emissiveIntensity={0.8} roughness={0.3} /></mesh>

      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.2, 0, -0.95]} scale={[0.06, 1.9, 0.06]} color={METAL} />
        <Block position={[side * 1.24, 0.05, -1.25]} scale={[0.08, 0.08, 0.32]} color={METAL} />
        <Block position={[side * 1.2, 0.45, -2.75]} scale={[0.1, 0.2, 0.12]} color={METAL} />
        <Block position={[side * 1.2, -0.45, -2.75]} scale={[0.1, 0.2, 0.12]} color={METAL} />
        <Lamp position={[side * 1.3, -0.35, -0.6]} radius={0.09} color={side < 0 ? '#ff3b30' : '#35d072'} />
        <SurfaceVent position={[side * 1.22, 0.18, 0.35]} scale={[0.42, 0.02, 0.08]} />
        <PanelSeam position={[side * 1.27, 0.1, -1.45]} scale={[0.018, 0.54, 2.2]} color={BODY_LIGHT} />

        <mesh position={[side * 0.5, 1.6, 2.45]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.17, 0.19, 0.7, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[side * 0.5, 1.6, 2.81]}><circleGeometry args={[0.15, 10]} /><meshStandardMaterial color={EXHAUST} /></mesh>
        <Block position={[side * 0.35, 2.85, 0.2]} scale={[0.05, 0.6, 0.05]} color={STRUT} />
        <Block position={[side * 1.3, 0.85, 6]} scale={[0.06, 0.55, 0.75]} color={BODY} />

        <mesh position={[side * 1.35, -1.81, -1.4]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.09, 0.09, 5.6, 8]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>
        <mesh position={[side * 1.35, -1.55, -4.56]} rotation={[-0.95, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.9, 8]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>
        {[-3.1, 0.3].map((z) => <mesh key={z} position={[side * 1.25, -1.5, z]} rotation={[0, 0, side * 0.317]}><cylinderGeometry args={[0.07, 0.07, 0.66, 8]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>)}
      </group>)}

      <Block position={[0, 1.55, 0.3]} scale={[1.5, 0.75, 3.2]} color={BODY_LIGHT} />
      <Block position={[0, 1.55, -1.3]} scale={[1.2, 0.5, 0.2]} color={INTAKE} />
      <mesh position={[0, 1.55, 1.9]} scale={[0.75, 0.37, 0.7]} castShadow><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={BODY_LIGHT} roughness={0.6} /></mesh>

      <mesh position={[0, 2.35, 0.2]}><cylinderGeometry args={[0.14, 0.18, 1, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 2.55, 0.2]}><cylinderGeometry args={[0.45, 0.45, 0.12, 12]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      {/* 로터가 계속 돌므로 정적 병합에서 뺀다 */}
      <group ref={mainRotor} position={[0, 3.2, 0.2]} userData={{ dynamic: true }}>
        <mesh castShadow><cylinderGeometry args={[0.3, 0.3, 0.32, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
        {MAIN_BLADES.map((index) => <group key={index} rotation={[0, index * HALF_PI, 0]}><MainBlade /></group>)}
      </group>
      {/* 빠르게 도는 블레이드의 깜빡임을 가리는 반투명 원판이다. 그림자는 만들지 않는다. */}
      <mesh position={[0, 3.25, 0.2]} rotation={[-HALF_PI, 0, 0]}><circleGeometry args={[6.6, 24]} /><meshStandardMaterial color={BLADE} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} /></mesh>

      {/* 꼬리 쪽이 가늘다. 회전 뒤 radiusTop 이 +Z 로 간다. */}
      <mesh position={[0, 0.55, 5.1]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.26, 0.6, 5.2, 10]} /><meshStandardMaterial color={BODY} metalness={0.15} roughness={0.45} /></mesh>
      <mesh position={[0, 0.55, 7.7]}><sphereGeometry args={[0.26, 10, 8]} /><meshStandardMaterial color={BODY} roughness={0.5} /></mesh>
      <Block position={[0, 0.95, 5]} scale={[0.2, 0.16, 4.6]} rotation={[0.068, 0, 0]} color={BODY_LIGHT} />
      <mesh geometry={geometries.fin} castShadow dispose={null}><meshStandardMaterial color={BODY_LIGHT} roughness={0.55} /></mesh>
      <mesh geometry={geometries.ventralFin} dispose={null}><meshStandardMaterial color={BODY} roughness={0.55} /></mesh>
      <Block position={[0, 0.85, 6]} scale={[2.6, 0.08, 0.7]} color={BODY_LIGHT} />
      <Block position={[0.3, 1.7, 7.6]} scale={[0.36, 0.3, 0.3]} color={METAL} />
      <group position={[0.55, 1.7, 7.6]} rotation={[0, 0, HALF_PI]}>
        <group ref={tailRotor} userData={{ dynamic: true }}>
          <mesh><cylinderGeometry args={[0.12, 0.12, 0.16, 8]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
          {TAIL_BLADES.map((index) => <group key={index} rotation={[0, index * TWO_PI / 3, 0]}><TailBlade /></group>)}
        </group>
        <mesh rotation={[HALF_PI, 0, 0]}><torusGeometry args={[1.3, 0.04, 6, 16]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>
      </group>
      <Lamp position={[0, 2.75, 8.4]} radius={0.08} color="#f0e9d4" />
      <DetailLamp position={[0, 0.9, -5.6]} color="#f0e9d4" scale={0.07} />

      <Block position={[0, 1.55, -2.4]} scale={[0.05, 0.5, 0.45]} color={IVORY} />
      <mesh position={[0, 1.6, 4]}><cylinderGeometry args={[0.015, 0.025, 1, 5]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} /></mesh>
    </StaticBatch>
    {/* 노즈 캐노피, 글레어실드, 문, 동체 캐빈 몸통. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
    <group visible={!firstPerson}>
      <StaticBatch>
        {/* 앞유리 중앙 기둥. 깊이 0.5 라 1인칭에서 두꺼운 날개판처럼 보여 캐빈과 함께 숨기고 실내가 얇은 기둥을 그린다 */}
        <Block position={[0, 0.75, -5.2]} scale={[0.08, 1.2, 0.5]} rotation={[0.5, 0, 0]} color={BODY} />
        <mesh position={[0, 0.1, -1.6]} rotation={[HALF_PI, 0, 0]} castShadow><capsuleGeometry args={[1.2, 3.6, 6, 12]} /><meshStandardMaterial color={BODY} metalness={0.15} roughness={0.45} /></mesh>
        <mesh position={[0, 0.6, -3.9]} scale={[1.15, 0.95, 1.6]} castShadow><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={GLASS} metalness={0.3} roughness={0.2} /></mesh>
        <Block position={[0, 1.45, -3.2]} scale={[1.2, 0.14, 1.5]} color={BODY} />
        {[-1, 1].map((side) => <Block key={side} position={[side * 1.16, 0.55, -1.9]} scale={[0.1, 0.8, 1.4]} color={GLASS} />)}
      </StaticBatch>
    </group>
  </group>;
}
