import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import StaticBatch from '../StaticBatch.jsx';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Wheel as RoadWheel } from './carParts.jsx';
import { ArmorShell } from './SurfaceParts.jsx';
import { PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import { steerAngle } from './carGeometry.js';

/** 플레이어가 모는 자주 대공포다. 장갑차와 같은 차륜 차대에 쌍열 대공 포탑을 올렸다.
 * Sedan, ArmoredCar 와 같은 축 규약을 따른다. 원점은 차체 중심, +Y 위, 앞이 -Z, 좌우가 X 다.
 * 바퀴 최하단은 정확히 -0.9 이고, 포신을 수평으로 내렸을 때 끝이 z -4.4 까지 나간다.
 * 포탑 회전과 포신 앙각은 이 컴포넌트가 직접 처리한다. 부모는 값만 준다.
 * firstPerson 이면 포탑 몸통과 포탑 지붕만 숨긴다(실내가 대신 그린다). 차체, 바퀴, 포신 둘과
 * 포가, 조준경, 레이더, 포탑 dynamic group 자체는 남는다. scoped 는 조준경을 켠 동안 같은
 * 조각을 숨긴다. 3인칭 평소 외형은 둘 다 false 라 바뀌지 않는다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const MAX_STEER = 0.45;
const MAX_STEP = 0.05;

const OLIVE = '#57604f';
const OLIVE_DARK = '#414a3c';
const TIRE = '#2a3134';
const METAL = '#394649';
const METAL_DARK = '#2a3134';
const OPTIC = '#385c6d';
const RADAR = '#7f8a7a';

const WHEEL_RADIUS = 0.46;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const TRACK_X = 1.05;
const AXLE_Z = [-1.85, -0.68, 0.5, 1.68];
const STEER_AXLE_COUNT = 2;

/** 포탑 피벗 높이다. GROUND_GUNS.aa.muzzle 의 y 3.4 는 차체 원점이 지면 위 1.21 인
 * 주행 좌표 기준이라 여기 값과 직접 비교하지 않는다. */
const TURRET_Y = 0.78;
/** 앙각 한계다. groundWeapons.AIM_LIMITS.aa 와 같은 값을 쓴다. 한쪽만 고치면 포신이 모델을 뚫는다. */
const PITCH_MIN = -0.08, PITCH_MAX = 1.45;

function Wheel({ radius }) {
  return <RoadWheel radius={radius} width={.4} spokes={5} spokeColor={METAL}/>;
}

/** 쌍열 포신 한 벌이다. 총열 덮개, 포신, 소염기를 둔다. */
function Barrel({ side }) {
  return <group position={[side * 0.17, 0, 0]}>
    <mesh position={[0, 0, -0.55]} rotation={[HALF_PI, 0, 0]} castShadow>
      <cylinderGeometry args={[0.06, 0.07, 0.7, 24]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.45} />
    </mesh>
    <mesh position={[0, 0, -1.85]} rotation={[HALF_PI, 0, 0]} castShadow>
      <cylinderGeometry args={[0.035, 0.042, 2.0, 24]} />
      <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0, -2.95]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.055, 0.055, 0.22, 24]} />
      <meshStandardMaterial color={METAL_DARK} roughness={0.5} />
    </mesh>
    {/* 소염기 구멍이다. 옆으로 뚫린 홈을 얕게 낸다. */}
    {[0.5, 1.5].map((turn) => <mesh key={turn} position={[0, 0, -2.95]} rotation={[0, turn * HALF_PI, 0]}>
      <boxGeometry args={[0.012, 0.09, 0.14]} />
      <meshStandardMaterial color={METAL_DARK} roughness={0.6} />
    </mesh>)}
  </group>;
}

export default function AntiAir({ turretYaw = 0, barrelPitch = 0, wheelsRef, steer = 0, speed = 0, aimRef, firstPerson = false, scoped = false }) {
  const wheelRefs = useRef([null, null, null, null, null, null, null, null]);
  const steerGroupRefs = useRef([null, null]);
  const turretRef = useRef();
  const barrelRef = useRef();
  const radarRef = useRef();

  useEffect(() => { if (turretRef.current) turretRef.current.rotation.y = turretYaw; }, [turretYaw]);
  useEffect(() => {
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(barrelPitch, PITCH_MIN, PITCH_MAX);
  }, [barrelPitch]);

  /* 조종 중에는 aimRef 를 매 프레임 읽는다. props 로 받으면 상태 갱신 주기만큼 포탑이 끊긴다.
   * wheelsRef 도 같은 이유로 조향과 회전을 매 프레임 직접 읽는다. */
  useFrame((_, delta) => {
    const aim = aimRef?.current;
    if (aim) {
      if (turretRef.current) turretRef.current.rotation.y = aim.yaw;
      if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(aim.pitch, PITCH_MIN, PITCH_MAX);
    }
    // 탐지 레이더는 늘 돈다. 포탑과 따로 도는 것이 대공 차량의 인상을 만든다.
    if (radarRef.current) radarRef.current.rotation.y = (radarRef.current.rotation.y + Math.min(delta, MAX_STEP) * 2.2) % TWO_PI;
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      steerGroupRefs.current.forEach((group) => { if (group) group.rotation.y = angle; });
    }
    const step = Math.min(delta, MAX_STEP) * (live ? live.speed : speed);
    wheelRefs.current.forEach((wheel) => { if (wheel) wheel.rotation.x = (wheel.rotation.x + step) % TWO_PI; });
  });

  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    steerGroupRefs.current.forEach((group) => { if (group) group.rotation.y = angle; });
  }, [steer]);

  return <group>
    {/* 차체와 바퀴, 1인칭에서도 항상 보인다 */}
    <StaticBatch>
      {/* 하부 섀시와 차체 */}
      <ArmorShell position={[0, -0.35, 0]} scale={[1.9, 0.6, 5.6]} color={OLIVE} />
      <ArmorShell position={[0, 0.12, 0.3]} scale={[1.85, 0.72, 4.6]} color={OLIVE} />
      <PanelSeam position={[0, 0.5, -1.0]} scale={[0.72, 0.018, 2.8]} color={OLIVE_DARK} />
      <ArmorShell position={[0, 0.04, -2.75]} scale={[1.75, 0.75, 0.7]} rotation={[0.55, 0, 0]} color={OLIVE} />

      {/* 운전석 캐빈과 페리스코프 */}
      <ArmorShell position={[-0.5, 0.6, -1.95]} scale={[0.7, 0.35, 0.9]} color={OLIVE} />
      {[-0.15, 0.15].map((dx) => <Block key={dx} position={[-0.5 + dx, 0.73, -2.35]} scale={[0.1, 0.08, 0.06]} color={OPTIC} />)}

      {/* 상부 갑판 */}
      <Block position={[0, 0.52, 1.1]} scale={[1.82, 0.15, 3.0]} color={OLIVE_DARK} />
      <SurfaceVent position={[0, 0.62, 1.1]} scale={[0.72, 0.018, 0.08]} />

      {/* 휠하우스 */}
      {AXLE_Z.map((z) => [-1, 1].map((side) => <mesh key={`${z}-${side}`} position={[side * TRACK_X, WHEEL_Y, z]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[WHEEL_RADIUS * 0.95, 0.06, 6, 14, Math.PI]} />
        <meshStandardMaterial color={OLIVE_DARK} roughness={0.7} />
      </mesh>))}

      {/* 견인 고리와 안테나 */}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.65, -0.55, -3.3]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[0.09, 0.025, 6, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>)}
      <mesh position={[0.78, 1.25, 1.9]}><cylinderGeometry args={[0.012, 0.018, 1.2, 6]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
    </StaticBatch>

    {AXLE_Z.slice(0, STEER_AXLE_COUNT).map((z, axle) => [-1, 1].map((side) => {
      const index = axle * 2 + (side < 0 ? 0 : 1);
      return <group key={`${z}-${side}`} userData={{ dynamic: true }} ref={(group) => { steerGroupRefs.current[axle] = group; }} position={[side * TRACK_X, WHEEL_Y, z]}>
        <group userData={{ dynamic: true }} ref={(wheel) => { wheelRefs.current[index] = wheel; }}><Wheel radius={WHEEL_RADIUS} /></group>
      </group>;
    }))}
    {AXLE_Z.slice(STEER_AXLE_COUNT).map((z, axle) => [-1, 1].map((side) => {
      const index = (STEER_AXLE_COUNT + axle) * 2 + (side < 0 ? 0 : 1);
      return <group key={`${z}-${side}`} position={[side * TRACK_X, WHEEL_Y, z]}>
        <group userData={{ dynamic: true }} ref={(wheel) => { wheelRefs.current[index] = wheel; }}><Wheel radius={WHEEL_RADIUS} /></group>
      </group>;
    }))}

    {/* 대공 포탑. 상자형 몸체에 쌍열 포신과 조준경, 뒤에 탄약함을 둔다. dynamic 이라
        위 StaticBatch 병합에서 빠진다. 캐빈(포탑 몸통, 포탑 지붕)만 따로 묶어 firstPerson 일 때 숨긴다. */}
    <group userData={{ dynamic: true }} ref={turretRef} position={[0, TURRET_Y, -0.2]}>
      {/* 캐빈: 포탑 몸통, 포탑 지붕. firstPerson 이거나 조준경을 켠 동안 숨긴다 */}
      <group visible={!firstPerson && !scoped}>
        <ArmorShell position={[0, 0.3, 0.1]} scale={[1.3, 0.5, 1.5]} color={OLIVE} />
        <Block position={[0, 0.58, 0.25]} scale={[1.1, 0.12, 1.2]} color={OLIVE_DARK} />
      </group>
      {/* 탄약함 두 개. 쌍열이라 좌우로 붙는다. */}
      {[-1, 1].map((side) => <Block key={side} position={[side * 0.62, 0.32, 0.55]} scale={[0.26, 0.44, 0.9]} color={OLIVE_DARK} />)}
      {/* 조준경 */}
      <Block position={[0.42, 0.56, -0.42]} scale={[0.18, 0.16, 0.24]} color={METAL} />
      <mesh position={[0.42, 0.56, -0.55]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.06, 24]} />
        <meshStandardMaterial color={OPTIC} metalness={0.4} roughness={0.15} />
      </mesh>
      {/* 탐지 레이더. 접시가 스스로 돈다. */}
      <group ref={radarRef} position={[-0.44, 0.72, 0.5]}>
        <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.05, 0.06, 0.24, 24]} /><meshStandardMaterial color={METAL} roughness={0.5} /></mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.62, 0.02, 0.26]} />
          <meshStandardMaterial color={RADAR} roughness={0.7} />
        </mesh>
      </group>
      {/* 쌍열 포신. barrelPitch 로 x 축 회전한다. */}
      <group ref={barrelRef} position={[0, 0.34, -0.6]}>
        <Block position={[0, 0, -0.12]} scale={[0.5, 0.3, 0.42]} color={METAL_DARK} />
        {[-1, 1].map((side) => <Barrel key={side} side={side} />)}
      </group>
    </group>
  </group>;
}
