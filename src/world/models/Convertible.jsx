import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Wheel } from './carParts.jsx';
import { CAR_PALETTE as P, GLASS_OPACITY, MAX_STEER, rollWheels, steerAngle } from './carGeometry.js';
import { DetailLamp, DriverFigure, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 플레이어가 모는 오픈카 시각 모델이다. Sedan 과 같은 축 규약이다. 원점은 차체 중심, 앞이 -Z 다.
 * 바퀴 최하단은 -0.9, 앞유리 꼭대기는 0.55 다. 전장 Z ±2.2, 전폭 X ±1.05 다(VEHICLES.convertible).
 * 지붕이 없어 1인칭에서도 외장을 숨기지 않아도 되지만 세단과 같은 규칙으로 전용 실내를 쓴다.
 * firstPerson 이면 DriverFigure, 앞유리와 틀, 낮은 대시, 스티어링 휠을 숨긴다. 헤더가 눈높이라 실내가 더 높은 틀을 그린다. */
const BODY = '#b8362f';
const BODY_DARK = '#8f2a25';
const WHEEL_RADIUS = 0.4;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -1.42, REAR_Z = 1.42, TRACK_X = 0.94;
const HALF_PI = Math.PI / 2;

export default function Convertible({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const wheels = useRef([]);
  const steering = useRef([]);
  const steeringWheel = useRef();
  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    steering.current.forEach((group) => { if (group) group.rotation.y = angle; });
    if (steeringWheel.current) steeringWheel.current.rotation.z = -angle * 2.2;
  }, [steer]);
  /* wheelsRef 가 있으면(CarMode 주행 중) 조향과 회전을 매 프레임 직접 읽는다. */
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      steering.current.forEach((group) => { if (group) group.rotation.y = angle; });
      if (steeringWheel.current) steeringWheel.current.rotation.z = -angle * 2.2;
    }
    rollWheels(wheels.current, delta, live ? live.speed : speed);
  });

  return <group>
    {/* 앞부분. 지붕이 없어 앞유리 틀, A 필러, 좌석, 대시까지 실내가 그대로 재사용한다 */}
    <StaticBatch>
      {/* 낮고 긴 차체. 보닛이 길고 트렁크가 짧다 */}
      <Block position={[0, -0.45, 0]} scale={[1.95, 0.46, 4.2]} color={BODY} />
      <Block position={[0, -0.1, -0.1]} scale={[1.9, 0.3, 4.0]} color={BODY} />
      <Block position={[0, 0.08, -1.5]} scale={[1.8, 0.14, 1.3]} color={BODY} />
      <Block position={[0, 0.1, 1.6]} scale={[1.8, 0.16, 0.9]} color={BODY} />
      <PanelSeam position={[0, 0.12, -1.45]} scale={[0.72, 0.018, 0.04]} color={BODY_DARK} />
      {/* 접힌 지붕과 뒷좌석 위 덮개, 롤바 */}
      <Block position={[0, 0.16, 1.05]} scale={[1.7, 0.16, 0.6]} color={P.cabinDark} />
      {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 0.3, 0.55]}>
        <torusGeometry args={[0.16, 0.03, 6, 10, Math.PI]} /><meshStandardMaterial color={P.trim} metalness={0.5} roughness={0.4} />
      </mesh>)}
      {/* 도어 라인, 손잡이, 사이드미러 */}
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 0.98, -0.15, -0.2]} scale={[0.02, 0.5, 1.9]} color={BODY_DARK} />
        <Block position={[side * 1.0, 0.02, -0.5]} scale={[0.06, 0.06, 0.22]} color={P.trim} />
        <Block position={[side * 1.02, 0.22, -0.68]} scale={[0.16, 0.12, 0.08]} color={BODY_DARK} />
      </group>)}
      {/* 앞 범퍼, 그릴, 헤드램프 */}
      <Block position={[0, -0.3, -2.2]} scale={[1.85, 0.36, 0.14]} color={P.trim} />
      <SurfaceVent position={[0, -0.12, -2.2]} scale={[0.58, 0.018, 0.06]} />
      <Block position={[0, -0.02, -2.18]} scale={[0.9, 0.16, 0.08]} color={P.grille} />
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.68, 0.0, -2.2]}>
        <boxGeometry args={[0.3, 0.16, 0.08]} />
        <meshStandardMaterial color={P.headLamp} emissive={P.headLamp} emissiveIntensity={0.9} roughness={0.3} />
      </mesh>)}
      {[-1, 1].map((side) => <DetailLamp key={`lamp-${side}`} position={[side * 0.68, 0.02, -2.26]} color={P.headLamp} scale={0.05} />)}
      {/* 뒤 범퍼, 가로 테일램프, 번호판, 배기구 두 개 */}
      <Block position={[0, -0.3, 2.2]} scale={[1.85, 0.36, 0.14]} color={P.trim} />
      <Block position={[0, 0.0, 2.24]} scale={[0.46, 0.22, 0.05]} color={P.plate} />
      <mesh position={[0, 0.18, 2.22]}>
        <boxGeometry args={[1.5, 0.08, 0.06]} />
        <meshStandardMaterial color={P.tailLamp} emissive={P.tailLamp} emissiveIntensity={0.7} roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.5, -0.42, 2.25]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.1, 10]} /><meshStandardMaterial color={P.exhaust} metalness={0.6} roughness={0.4} />
      </mesh>)}
      {/* 실내. 지붕이 없어 밖에서 다 보이므로 세단보다 조각을 둔다. DriverFigure 만 별도로 숨긴다 */}
      <Block position={[0.2, -0.1, 0.05]} scale={[0.26, 0.2, 0.9]} color={P.cabinDark2} />
      {[-0.5, 0.5].map((x) => <group key={x}>
        <Block position={[x, -0.16, 0.1]} scale={[0.5, 0.14, 0.5]} color={P.leather} />
        <Block position={[x, 0.16, 0.36]} scale={[0.46, 0.5, 0.12]} rotation={[-0.15, 0, 0]} color={P.leather} />
      </group>)}
    </StaticBatch>

    {/* 캐빈. DriverFigure 하나뿐이다. firstPerson 이면 플레이어 시점을 대신 쓰므로 숨긴다 */}
    <group visible={!firstPerson}>
      <StaticBatch>
        {/* 앞유리, A 필러, 헤더, 낮은 대시, 스티어링 휠. 헤더가 눈높이(0.5) 에 있어 1인칭에서 시야를 막으므로
            실내가 더 높은 틀과 대시를 대신 그린다. 좌석, 롤바, 토노 커버는 앞부분에 남아 뒤를 보면 보인다 */}
        {/* 앞유리와 A 필러. 지붕은 없다 */}
        <mesh position={[0, 0.32, -0.72]} scale={[1.5, 0.42, 0.05]} rotation={[0.5, 0, 0]}>
          <boxGeometry /><meshStandardMaterial color={P.glass} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>
        {[-1, 1].map((side) => <Block key={side} position={[side * 0.78, 0.32, -0.72]} scale={[0.05, 0.46, 0.06]} rotation={[0.5, 0, 0]} color={BODY_DARK} />)}
        <Block position={[0, 0.53, -0.62]} scale={[1.58, 0.05, 0.06]} rotation={[0.5, 0, 0]} color={BODY_DARK} />
        <Block position={[0, 0.1, -0.55]} scale={[1.6, 0.22, 0.4]} color={P.cabinDark} />
        {/* 스티어링 휠. 우측통행이라 왼쪽이다 */}
        <group position={[-0.5, 0.2, -0.55]} rotation={[-0.35, 0, 0]}>
          <group ref={steeringWheel} userData={{ dynamic: true }}>
            <mesh><torusGeometry args={[0.15, 0.02, 8, 16]} /><meshStandardMaterial color={P.cabinDark} roughness={0.5} /></mesh>
            <Block position={[0, 0, 0]} scale={[0.26, 0.03, 0.02]} color={P.cabinDark} />
          </group>
        </group>
        <DriverFigure position={[-0.5, 0.08, 0.12]} />
      </StaticBatch>
    </group>

    {/* 바퀴. 조향과 회전이 걸리므로 정적 병합에서 뺀다 */}
    {[-1, 1].map((side, index) => <group key={side} ref={(el) => { steering.current[index] = el; }} position={[side * TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true }}>
      <group ref={(el) => { wheels.current[index] = el; }}><Wheel radius={WHEEL_RADIUS} brake /></group>
    </group>)}
    {[-1, 1].map((side, index) => <group key={side} position={[side * TRACK_X, WHEEL_Y, REAR_Z]} userData={{ dynamic: true }}>
      <group ref={(el) => { wheels.current[2 + index] = el; }}><Wheel radius={WHEEL_RADIUS} /></group>
    </group>)}
  </group>;
}
