import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Wheel } from './carParts.jsx';
import { CAR_PALETTE as P, extrudeUpright, GLASS_OPACITY, MAX_STEER, rollWheels, steerAngle } from './carGeometry.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 플레이어가 모는 SUV 시각 모델이다. Sedan 과 같은 축 규약이다. 원점은 차체 중심, 앞이 -Z 다.
 * 바퀴 최하단은 -0.9, 지붕 레일 꼭대기는 1.02 다. 전장 Z ±2.45, 전폭 X ±1.15 다(VEHICLES.suv).
 * 1인칭 눈높이는 eyePoints.suv 다. 실내는 cockpits/VehicleInteriors 의 SuvInterior 가 따로 그린다.
 * firstPerson 이면 캐빈 group 을 숨긴다. */
const BODY = '#6b4f3a';
const BODY_DARK = '#54402f';
const WHEEL_RADIUS = 0.48;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -1.6, REAR_Z = 1.65, TRACK_X = 1.02;

export default function Suv({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const wheels = useRef([]);
  const steering = useRef([]);
  const geometries = useMemo(() => ({
    // 세단보다 높고 각진 캐빈이다. 뒷기둥이 굵고 창 아래선이 높다.
    cabinSide: extrudeUpright([[-1.45, 0.1], [-1.1, 0.78], [1.55, 0.78], [1.8, 0.1]], 0.06),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
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
      {/* 섀시, 보닛, 짧은 뒤 오버행 */}
      <Block position={[0, -0.32, 0]} scale={[2.2, 0.76, 4.8]} color={BODY} />
      <Block position={[0, 0.22, -1.75]} scale={[2.1, 0.34, 1.2]} color={BODY} />
      <Block position={[0, 0.18, 2.05]} scale={[2.1, 0.26, 0.7]} color={BODY} />
      {/* 보닛과 카울 사이 패널 실선. 보닛 표면 위라 앞부분에 둔다 */}
      <PanelSeam position={[0, 0.34, -1.72]} scale={[1.62, 0.018, 0.04]} color={BODY_DARK} />
      {/* 도어 라인, 손잡이, 사이드미러, 사이드스텝. 기둥은 캐빈 쪽에 있다 */}
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.1, -0.1, 0.1]} scale={[0.02, 0.8, 3.4]} color={BODY_DARK} />
        <Block position={[side * 1.12, 0.12, -0.6]} scale={[0.06, 0.07, 0.24]} color={P.trim} />
        <Block position={[side * 1.12, 0.12, 0.75]} scale={[0.06, 0.07, 0.24]} color={P.trim} />
        <Block position={[side * 1.16, 0.5, -1.15]} scale={[0.18, 0.15, 0.09]} color={BODY_DARK} />
        <Block position={[side * 1.14, -0.72, 0.1]} scale={[0.14, 0.05, 2.6]} color={P.tire} />
      </group>)}
      {/* 앞 범퍼, 그릴, 헤드램프, 스키드 플레이트 */}
      <Block position={[0, -0.35, -2.42]} scale={[2.1, 0.5, 0.16]} color={P.trim} />
      <SurfaceVent position={[0, -0.27, -2.42]} scale={[0.74, 0.018, 0.07]} />
      <Block position={[0, -0.68, -2.4]} scale={[1.2, 0.14, 0.12]} color={P.grille} />
      {[-0.1, 0.05, 0.2].map((y) => <Block key={y} position={[0, y, -2.4]} scale={[1.2, 0.03, 0.08]} color={P.grille} />)}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.78, 0.12, -2.4]}>
        <boxGeometry args={[0.34, 0.2, 0.08]} />
        <meshStandardMaterial color={P.headLamp} emissive={P.headLamp} emissiveIntensity={0.9} roughness={0.3} />
      </mesh>)}
      {[-1, 1].map((side) => <DetailLamp key={`lamp-${side}`} position={[side * 0.78, 0.12, -2.47]} color={P.headLamp} scale={0.05} />)}
      {/* 뒤 범퍼, 세로 테일램프, 번호판, 예비 타이어 */}
      <Block position={[0, -0.35, 2.42]} scale={[2.1, 0.5, 0.16]} color={P.trim} />
      <Block position={[0, 0.02, 2.44]} scale={[0.5, 0.26, 0.05]} color={P.plate} />
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.88, 0.32, 2.42]}>
        <boxGeometry args={[0.16, 0.5, 0.06]} />
        <meshStandardMaterial color={P.tailLamp} emissive={P.tailLamp} emissiveIntensity={0.6} roughness={0.35} />
      </mesh>)}
      <mesh position={[0.35, 0.42, 2.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.18, 12]} /><meshStandardMaterial color={P.tire} roughness={0.9} />
      </mesh>
    </StaticBatch>

    {/* 캐빈, firstPerson 이면 숨긴다(실내 모델이 대신 그린다) */}
    <group visible={!firstPerson}>
      <StaticBatch>
        {/* 캐빈 상자와 지붕, 지붕 레일 */}
        <Block position={[0, 0.5, 0.15]} scale={[1.9, 0.8, 3.3]} color={BODY} />
        <Block position={[0, 0.92, 0.15]} scale={[1.8, 0.08, 3.1]} color={BODY_DARK} />
        {[-1, 1].map((side) => <Block key={side} position={[side * 0.7, 1.0, 0.15]} scale={[0.08, 0.06, 2.6]} color={P.trim} />)}
        {/* 측면 창, 앞뒤 유리 */}
        {[-1, 1].map((side) => <mesh key={side} geometry={geometries.cabinSide} position={[side * 0.96, 0.32, 0]} scale={[side, 1, 1]} dispose={null}>
          <meshStandardMaterial color={P.glass} metalness={0.25} roughness={0.2} transparent opacity={GLASS_OPACITY} />
        </mesh>)}
        <mesh position={[0, 0.62, -1.28]} scale={[1.66, 0.62, 0.08]} rotation={[0.42, 0, 0]}>
          <boxGeometry /><meshStandardMaterial color={P.glass} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>
        <mesh position={[0, 0.62, 1.78]} scale={[1.66, 0.58, 0.08]} rotation={[-0.25, 0, 0]}>
          <boxGeometry /><meshStandardMaterial color={P.glass} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>
        {/* A, B, C 필러 */}
        {[-1, 1].map((side) => <group key={side}>
          <Block position={[side * 0.95, 0.5, -1.05]} scale={[0.07, 0.8, 0.14]} rotation={[0, 0, side * 0.05]} color={BODY_DARK} />
          <Block position={[side * 0.95, 0.5, 0.2]} scale={[0.07, 0.8, 0.1]} color={BODY_DARK} />
          <Block position={[side * 0.95, 0.5, 1.5]} scale={[0.07, 0.8, 0.22]} color={BODY_DARK} />
        </group>)}
        {/* 실내 최소 조각. 밖에서 유리 너머로 보이는 좌석과 대시보드다 */}
        <Block position={[0, 0.48, -0.95]} scale={[1.7, 0.1, 0.5]} color={P.cabinDark} />
        {[-0.5, 0.5].map((x) => <group key={x}>
          <Block position={[x, 0.1, 0.2]} scale={[0.5, 0.18, 0.56]} color={P.leather} />
          <Block position={[x, 0.45, 0.48]} scale={[0.48, 0.6, 0.14]} color={P.leather} />
        </group>)}
        <Block position={[0, 0.4, 1.35]} scale={[1.7, 0.55, 0.16]} color={P.leather} />
      </StaticBatch>
    </group>

    {/* 바퀴. 앞은 조향 group 안이다. 조향과 회전이 걸리므로 정적 병합에서 뺀다 */}
    {[-1, 1].map((side, index) => <group key={side} ref={(el) => { steering.current[index] = el; }} position={[side * TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true }}>
      <group ref={(el) => { wheels.current[index] = el; }}><Wheel radius={WHEEL_RADIUS} brake /></group>
    </group>)}
    {[-1, 1].map((side, index) => <group key={side} position={[side * TRACK_X, WHEEL_Y, REAR_Z]} userData={{ dynamic: true }}>
      <group ref={(el) => { wheels.current[2 + index] = el; }}><Wheel radius={WHEEL_RADIUS} /></group>
    </group>)}
  </group>;
}
