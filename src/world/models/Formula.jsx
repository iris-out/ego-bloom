import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Block from './ModelBlock';
import { Wheel } from './carParts.jsx';
import { rollWheels, steerAngle } from './carGeometry.js';
import StaticBatch from '../StaticBatch.jsx';

/** 현대식 가상 포뮬러 머신이다. 앞은 -Z, 바퀴 최하단은 y -0.9 다. 외부 브랜드나
 * 실제 리버리는 쓰지 않고 흑연 차체와 도시 강조색 한 줄로 형태를 읽게 한다. */
const BODY = '#252a31';
const BODY_LIGHT = '#3b424c';
const ACCENT = '#55d6bd';
const CARBON = '#111419';
const METAL = '#8b939b';
const RED = '#d34538';
const WHEEL_RADIUS = 0.44;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -1.72;
const REAR_Z = 1.55;
const TRACK_X = 1.04;

export default function Formula({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const wheels = useRef([]);
  const steering = useRef([]);

  useEffect(() => {
    const angle = steerAngle(steer);
    steering.current.forEach((node) => { if (node) node.rotation.y = angle; });
  }, [steer]);

  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    const angle = steerAngle(live ? live.steer : steer);
    steering.current.forEach((node) => { if (node) node.rotation.y = angle; });
    rollWheels(wheels.current, delta, live ? live.speed : speed);
  });

  return <group>
    <StaticBatch>
      {/* 바닥과 모노코크. 얇은 플로어가 사이드포드와 디퓨저를 한 실루엣으로 묶는다. */}
      <group userData={{ part: 'monocoque' }}>
        <Block position={[0, -0.58, 0.25]} scale={[1.72, 0.08, 3.95]} color={CARBON} />
        <Block position={[0, -0.41, -1.72]} scale={[0.34, 0.24, 1.75]} rotation={[-0.07, 0, 0]} color={BODY_LIGHT} />
        <Block position={[0, -0.27, -2.35]} scale={[0.18, 0.18, 0.9]} color={BODY_LIGHT} />
        <Block position={[0, -0.22, -2.72]} scale={[0.1, 0.12, 0.24]} color={ACCENT} />
      </group>

      {/* 프런트 윙은 주 날개, 플랩, 끝판으로 층을 나눈다. */}
      <group userData={{ part: 'front-wing' }}>
        <Block position={[0, -0.57, -2.76]} scale={[2.08, 0.06, 0.42]} color={CARBON} />
        <Block position={[0, -0.49, -2.64]} scale={[1.76, 0.05, 0.26]} rotation={[0.12, 0, 0]} color={BODY_LIGHT} />
        {[-1, 1].map(side => <Block key={side} position={[side * 1.03, -0.43, -2.74]}
          scale={[0.05, 0.34, 0.48]} color={ACCENT} />)}
      </group>

      {/* 사이드포드와 언더컷. 위 덩어리 아래에 검은 채널을 둬 낮은 바닥이 보인다. */}
      {/* 엔진 커버와 상어지느러미, 후방 충돌 구조다. */}
      <Block position={[0, -0.45, 2.2]} scale={[0.18, 0.22, 1.05]} color={CARBON} />

      {/* 노출형 위시본. 앞뒤 각각 상하 두 줄이 허브와 차체를 잇는다. */}
      {[-1, 1].map(side => <group key={side} userData={{ part: 'suspension' }}>
        {[FRONT_Z, REAR_Z].map((z, axle) => <group key={z}>
          <Block position={[side * 0.77, -0.36, z - 0.14]} scale={[0.68, 0.035, 0.04]}
            rotation={[0, side * (axle ? -0.16 : 0.16), 0]} color={METAL} />
          <Block position={[side * 0.77, -0.55, z + 0.12]} scale={[0.68, 0.035, 0.04]}
            rotation={[0, side * (axle ? 0.16 : -0.16), 0]} color={METAL} />
        </group>)}
      </group>)}

      {/* 리어 윙과 디퓨저. */}
      <group userData={{ part: 'rear-wing' }}>
        <Block position={[0, 0.24, 2.35]} scale={[1.82, 0.1, 0.34]} rotation={[-0.08, 0, 0]} color={CARBON} />
        <Block position={[0, 0.4, 2.22]} scale={[1.7, 0.08, 0.24]} rotation={[-0.16, 0, 0]} color={ACCENT} />
        {[-1, 1].map(side => <Block key={side} position={[side * 0.86, 0.05, 2.3]}
          scale={[0.06, 0.7, 0.42]} color={BODY_LIGHT} />)}
        <Block position={[0, -0.67, 2.13]} scale={[1.15, 0.22, 0.55]} rotation={[0.15, 0, 0]} color={CARBON} />
      </group>

      <Block position={[0, -0.32, 2.62]} scale={[0.12, 0.12, 0.08]} color={RED} />
    </StaticBatch>

    {/* 헤일로는 1인칭에서도 기준 프레임으로 남는다. 중앙 기둥은 시야 중심보다 앞에 얇게 둔다. */}
    <group userData={{ part: 'halo' }}>
      <mesh position={[0, 0.31, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.028, 6, 18, Math.PI * 1.45]} />
        <meshStandardMaterial color={CARBON} roughness={0.55} metalness={0.4} />
      </mesh>
      <Block position={[0, 0.32, -0.62]} scale={[0.055, 0.52, 0.06]} rotation={[-0.18, 0, 0]} color={CARBON} />
    </group>

    {/* 카메라와 겹치는 머리받침·콕핏 두레·외장 미러는 1인칭 실내가 대신한다. */}
    <group visible={!firstPerson} userData={{ part: 'camera-intersection' }}>
      <Block position={[0, -0.55, 0.1]} scale={[0.72, 0.42, 3.7]} color={BODY} />
      <Block position={[0, -0.03, 0.72]} scale={[0.52, 0.72, 1.55]} rotation={[0.04, 0, 0]} color={BODY_LIGHT} />
      <Block position={[0, 0.28, 0.94]} scale={[0.08, 0.62, 1.15]} color={ACCENT} />
      <Block position={[0, 0.14, 0.62]} scale={[0.46, 0.56, 0.42]} rotation={[-0.18, 0, 0]} color={CARBON} />
      <Block position={[0, -0.02, -0.05]} scale={[0.74, 0.3, 1.05]} color={CARBON} />
      {[-1, 1].map(side => <group key={side}>
        <Block position={[side * 0.64, 0.11, -0.48]} scale={[0.12, 0.06, 0.48]} rotation={[0, side * 0.4, 0]} color={CARBON} />
        <Block position={[side * 0.84, 0.17, -0.66]} scale={[0.24, 0.12, 0.08]} color={BODY_LIGHT} />
      </group>)}
      {[-1, 1].map(side => <group key={`pod-${side}`} userData={{ part: 'sidepod' }}>
        <Block position={[side * 0.59, -0.28, 0.18]} scale={[0.58, 0.5, 1.65]} rotation={[0, side * 0.025, 0]} color={BODY} />
        <Block position={[side * 0.62, -0.19, -0.43]} scale={[0.48, 0.3, 0.34]} color={CARBON} />
        <Block position={[side * 0.63, -0.43, 0.32]} scale={[0.5, 0.1, 1.5]} color={ACCENT} />
      </group>)}
    </group>

    {[-1, 1].map((side, index) => <group key={`front-${side}`} ref={(node) => { steering.current[index] = node; }}
      position={[side * TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true, part: 'front-wheel' }}>
      <group ref={(node) => { wheels.current[index] = node; }} userData={{ dynamic: true, part: 'wheel-hub', axle: 'front' }}>
        <Wheel radius={WHEEL_RADIUS} width={0.34} brake />
      </group>
    </group>)}
    {[-1, 1].map((side, index) => <group key={`rear-${side}`} position={[side * TRACK_X, WHEEL_Y, REAR_Z]}
      userData={{ dynamic: true, part: 'rear-wheel' }}>
      <group ref={(node) => { wheels.current[index + 2] = node; }} userData={{ dynamic: true, part: 'wheel-hub', axle: 'rear' }}>
        <Wheel radius={WHEEL_RADIUS} width={0.42} />
      </group>
    </group>)}
  </group>;
}
