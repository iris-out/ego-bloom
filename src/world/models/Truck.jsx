import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Shell } from './SurfaceParts.jsx';
import { Wheel } from './carParts.jsx';
import { CAR_PALETTE as P, GLASS_OPACITY, MAX_STEER, rollWheels, steerAngle } from './carGeometry.js';
import { PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 플레이어가 모는 캡오버 박스 트럭이다. Sedan 과 같은 축 규약이다. 원점은 차체 중심, 앞이 -Z 다.
 * 바퀴 최하단은 -0.9, 적재함 꼭대기는 2.0 이다. 전장 Z ±3.8, 전폭 X ±1.25 다(VEHICLES.truck).
 * 캡은 Z -3.8..-1.7 이고 1인칭 눈은 캡 안(eyePoints.truck) 이다. 뒷바퀴는 두 축이며 복륜이다.
 * firstPerson 이면 캡 group 을 숨긴다. */
const CAB = '#2f6f9e';
const CAB_DARK = '#255a80';
const BOX = '#d8d5cc';
const BOX_DARK = '#b9b6ad';
const FRAME = '#3a3f42';
const WHEEL_RADIUS = 0.5;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -2.7, REAR_Z = [1.9, 3.0], TRACK_X = 1.02;
const HALF_PI = Math.PI / 2;

export default function Truck({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const wheels = useRef([]);
  const steering = useRef([]);
  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    steering.current.forEach((group) => { if (group) group.rotation.y = angle; });
  }, [steer]);
  /* wheelsRef 가 있으면(CarMode 주행 중) 조향과 회전을 매 프레임 직접 읽는다. */
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      steering.current.forEach((group) => { if (group) group.rotation.y = angle; });
    }
    rollWheels(wheels.current, delta, live ? live.speed : speed);
  });

  return <group>
    {/* 앞부분, 1인칭에서도 항상 보인다 */}
    <StaticBatch>
      {/* 사다리꼴 프레임과 연료탱크, 뒤 언더런 바 */}
      {[-1, 1].map((side) => <Block key={side} position={[side * 0.55, -0.45, 0.2]} scale={[0.16, 0.3, 7.2]} color={FRAME} />)}
      <mesh position={[1.05, -0.45, -0.6]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 1.2, 10]} /><meshStandardMaterial color={P.trim} metalness={0.5} roughness={0.4} />
      </mesh>
      <Block position={[0, -0.6, 3.72]} scale={[2.2, 0.1, 0.1]} color={FRAME} />
      {/* 캡 지붕 위 바람막이. 지붕 자체가 아니라 얹힌 페어링이라 앞부분에 둔다 */}
      <Shell color={CAB_DARK} stations={[{z:-2.6,rx:.88,ry:.025,cy:1.8,power:3},{z:-2.1,rx:1,ry:.12,cy:1.91,power:4},{z:-1.75,rx:1,ry:.17,cy:1.94,power:4}]}/>
      <Block position={[0, -0.3, -3.78]} scale={[2.34, 0.34, 0.14]} color={P.trim} />
      <PanelSeam position={[0, 0.28, -3.58]} scale={[1.8, 0.02, 0.04]} color={CAB_DARK} />
      {/* 도어 라인, 손잡이, 사이드미러(긴 팔), 발판 */}
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.17, 0.35, -2.75]} scale={[0.02, 0.9, 1.7]} color={CAB_DARK} />
        <Block position={[side * 1.18, 0.55, -3.3]} scale={[0.05, 0.06, 0.22]} color={P.trim} />
        <Block position={[side * 1.34, 1.15, -3.55]} scale={[0.32, 0.05, 0.05]} color={FRAME} />
        <Block position={[side * 1.48, 1.05, -3.55]} scale={[0.06, 0.42, 0.2]} color={CAB_DARK} />
        <Block position={[side * 1.1, -0.55, -2.4]} scale={[0.3, 0.05, 0.6]} color={FRAME} />
      </group>)}
      {/* 그릴, 헤드램프, 캡 지붕 마커등 */}
      <Block position={[0, 0.05, -3.78]} scale={[1.4, 0.3, 0.06]} color={P.grille} />
      <SurfaceVent position={[0, -0.18, -3.8]} scale={[0.84, 0.018, 0.06]} />
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.82, 0.05, -3.78]}>
        <boxGeometry args={[0.36, 0.22, 0.08]} />
        <meshStandardMaterial color={P.headLamp} emissive={P.headLamp} emissiveIntensity={0.9} roughness={0.3} />
      </mesh>)}
      {[-0.7, -0.35, 0, 0.35, 0.7].map((x) => <mesh key={x} position={[x, 1.82, -3.24]}>
        <boxGeometry args={[0.12, 0.06, 0.06]} />
        <meshStandardMaterial color={P.headLamp} emissive={P.headLamp} emissiveIntensity={0.6} roughness={0.4} />
      </mesh>)}
      {/* 적재함. 밝은 상자에 모서리 보강재와 뒷문 두 짝이다 */}
      <Block position={[0, 0.9, 1.1]} scale={[2.4, 2.2, 5.2]} color={BOX} />
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.21, 0.9, -1.48]} scale={[0.04, 2.2, 0.08]} color={BOX_DARK} />
        <Block position={[side * 1.21, 0.9, 3.68]} scale={[0.04, 2.2, 0.08]} color={BOX_DARK} />
        <Block position={[side * 1.21, -0.16, 1.1]} scale={[0.04, 0.08, 5.2]} color={BOX_DARK} />
        <Block position={[side * 1.21, 1.96, 1.1]} scale={[0.04, 0.08, 5.2]} color={BOX_DARK} />
      </group>)}
      <Block position={[0, 0.9, 3.71]} scale={[0.04, 2.1, 0.03]} color={BOX_DARK} />
      <PanelSeam position={[0, 0.92, 3.735]} scale={[1.6, 0.018, 0.02]} color={BOX_DARK} />
      {[-0.6, 0.6].map((x) => <Block key={x} position={[x, 0.7, 3.72]} scale={[0.06, 0.4, 0.04]} color={FRAME} />)}
      {/* 뒤 범퍼, 테일램프, 번호판, 머드가드 */}
      <Block position={[0, -0.32, 3.76]} scale={[2.3, 0.22, 0.1]} color={P.trim} />
      <Block position={[0, -0.05, 3.76]} scale={[0.5, 0.24, 0.04]} color={P.plate} />
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.95, -0.05, 3.76]}>
        <boxGeometry args={[0.3, 0.16, 0.06]} />
        <meshStandardMaterial color={P.tailLamp} emissive={P.tailLamp} emissiveIntensity={0.6} roughness={0.35} />
      </mesh>)}
      {[-1, 1].map((side) => <Block key={side} position={[side * TRACK_X, -0.2, 2.45]} scale={[0.72, 0.08, 1.9]} color={FRAME} />)}
    </StaticBatch>

    {/* 캡, firstPerson 이면 숨긴다(실내 모델이 대신 그린다) */}
    <group visible={!firstPerson}>
      <StaticBatch>
        {/* 캡. 앞이 수직에 가깝다 */}
        <Shell color={CAB} stations={[{z:-3.75,rx:1.04,ry:.86,cy:.7,power:5},{z:-3.45,rx:1.15,ry:.95,cy:.7,power:7},{z:-2,rx:1.15,ry:.95,cy:.7,power:7},{z:-1.75,rx:1.08,ry:.9,cy:.7,power:5}]}/>
        <Block position={[0, 1.72, -2.55]} scale={[2.2, 0.16, 1.4]} color={CAB_DARK} />
        {/* 앞유리, 측면 창 */}
        <mesh position={[0, 1.05, -3.74]} scale={[2.0, 0.9, 0.06]} rotation={[0.08, 0, 0]}>
          <boxGeometry /><meshStandardMaterial color={P.glass} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 1.16, 1.05, -2.85]} scale={[0.04, 0.8, 1.2]}>
          <boxGeometry /><meshStandardMaterial color={P.glass} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>)}
      </StaticBatch>
    </group>

    {/* 앞바퀴 조향, 뒷바퀴 두 축 복륜. 조향과 회전이 걸리므로 정적 병합에서 뺀다 */}
    {[-1, 1].map((side, index) => <group key={side} ref={(el) => { steering.current[index] = el; }} position={[side * TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true }}>
      <group ref={(el) => { wheels.current[index] = el; }}><Wheel radius={WHEEL_RADIUS} brake /></group>
    </group>)}
    {REAR_Z.map((z, axle) => [-1, 1].map((side, index) => <group key={`${z}-${side}`} position={[side * (TRACK_X - 0.12), WHEEL_Y, z]} userData={{ dynamic: true }}>
      <group ref={(el) => { wheels.current[2 + axle * 2 + index] = el; }}><Wheel radius={WHEEL_RADIUS} dual /></group>
    </group>))}
  </group>;
}
