import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import StaticBatch from '../StaticBatch.jsx';
import * as THREE from 'three';
import Block from './ModelBlock';
import { PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import { steerAngle } from './carGeometry.js';

/** 플레이어가 모는 8x8 차륜형 장갑차(K808, 스트라이커 계열) 시각 모델이다.
 * Sedan, Helicopter 와 같은 축 규약을 따른다. 로컬 원점은 차체 중심, +Y 위, 차 앞이 -Z, 좌우가 X 다.
 * 바퀴 최하단은 정확히 -0.9, 포탑 지붕은 1.5 를 넘지 않는다.
 * 차체 Z -3.4..3.4, X ±1.6 을 넘기지 않는다. 기관포 포신 끝은 z -4.6 까지 나간다.
 * 포탑 회전, 포신 각도, 조향, 바퀴 회전은 이 컴포넌트가 직접 처리한다. 부모는 값만 준다.
 * firstPerson 이면 운전석 캐빈 Block, 해치, 페리스코프 상자와 무인 포탑 상자(포탑 dynamic group
 * 안)를 숨긴다. 글라시스, 병력실 지붕, 바퀴, 포신, 조준경 상자, 포탑 dynamic group 자체는 남는다.
 * scoped 는 조준경을 켠 동안 같은 조각을 숨긴다. 3인칭 평소 외형은 둘 다 false 라 바뀌지 않는다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const MAX_STEER = 0.45;
const MAX_STEP = 0.05;

const OLIVE = '#5d6350';
const OLIVE_DARK = '#464b3d';
const TIRE = '#2a3134';
const METAL = '#394649';
const OPTIC = '#385c6d';

const WHEEL_RADIUS = 0.46;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const TRACK_X = 1.05;
const AXLE_Z = [-1.85, -0.68, 0.5, 1.68];
const STEER_AXLE_COUNT = 2;

const HULL_TOP_Y = 0.55;
const TURRET_BASE_Y = 0.75;

function Wheel({ radius }) {
  return <group rotation={[0, 0, HALF_PI]}>
    <mesh castShadow><cylinderGeometry args={[radius, radius, 0.4, 12]} /><meshStandardMaterial color={TIRE} roughness={0.9} /></mesh>
    <mesh position={[0.11, 0, 0]}><cylinderGeometry args={[radius * 0.5, radius * 0.5, 0.18, 10]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
    <mesh position={[-0.11, 0, 0]}><cylinderGeometry args={[radius * 0.5, radius * 0.5, 0.18, 10]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
  </group>;
}

/* Sedan, Helicopter 의 extrudeUpright 와 같은 규약이다. shape 의 x 는 Z 축, y 는 Y 축, 두께는 X 로 가운데 정렬한다. */
function extrudeUpright(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => (index ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateY(-HALF_PI);
  geometry.translate(depth / 2, 0, 0);
  return geometry;
}

export default function ArmoredCar({ turretYaw = 0, barrelPitch = 0, wheelsRef, steer = 0, speed = 0, aimRef, firstPerson = false, scoped = false }) {
  const wheelRefs = useRef([null, null, null, null, null, null, null, null]);
  const steerGroupRefs = useRef([null, null]);
  const turretRef = useRef();
  const barrelRef = useRef();

  /* 경사진 전면 장갑판의 옆면 실루엣이다. */
  const geometries = useMemo(() => ({
    glacis: extrudeUpright(
      [[-3.4, -0.35], [-3.05, 0.35], [-2.2, 0.55], [-2.2, -0.35]],
      0.04,
    ),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useEffect(() => {
    if (turretRef.current) turretRef.current.rotation.y = turretYaw;
  }, [turretYaw]);

  useEffect(() => {
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(barrelPitch, -0.25, 0.6);
  }, [barrelPitch]);

  /* 조종 중에는 aimRef 를 매 프레임 읽는다. props 로 받으면 상태 갱신 주기만큼 포탑이 끊긴다. */
  useFrame(() => {
    const aim = aimRef?.current;
    if (!aim) return;
    if (turretRef.current) turretRef.current.rotation.y = aim.yaw;
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(aim.pitch, -0.25, 0.6);
  });

  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    steerGroupRefs.current.forEach((group) => {
      if (group) group.rotation.y = angle;
    });
  }, [steer]);

  /* wheelsRef 가 있으면(CarMode 주행 중) 조향과 회전을 매 프레임 직접 읽는다.
   * props 로만 받으면(원격 차량) 위 effect 와 마지막 speed 값만 쓴다. */
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      steerGroupRefs.current.forEach((group) => { if (group) group.rotation.y = angle; });
    }
    const step = Math.min(delta, MAX_STEP) * (live ? live.speed : speed);
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x = (wheel.rotation.x + step) % TWO_PI;
    });
  });

  return <group>
    {/* 앞부분, 1인칭에서도 항상 보인다 */}
    <StaticBatch>
      {/* 하부 섀시, 높고 좁은 차체 */}
      <Block position={[0, -0.35, 0]} scale={[1.9, 0.6, 5.6]} color={OLIVE} />
      <Block position={[0, 0.1, 0.3]} scale={[1.85, 0.7, 4.6]} color={OLIVE} />
      <PanelSeam position={[0, 0.48, -1.0]} scale={[0.72, 0.018, 2.8]} color={OLIVE_DARK} />

      {/* 경사진 전면 장갑, 글라시스 플레이트 */}
      <Block position={[0, 0.02, -2.75]} scale={[1.75, 0.75, 0.7]} rotation={[0.55, 0, 0]} color={OLIVE} />
      {[-1, 1].map((side) => <mesh key={side} geometry={geometries.glacis} position={[side * 0.93, 0, 0]} scale={[side, 1, 1]} dispose={null} castShadow>
        <meshStandardMaterial color={OLIVE_DARK} roughness={0.7} />
      </mesh>)}

      {/* 후방 상부 장갑, 병력실 지붕 */}
      <Block position={[0, HULL_TOP_Y, 1.0]} scale={[1.82, 0.15, 3.2]} color={OLIVE_DARK} />
      <SurfaceVent position={[0, HULL_TOP_Y + 0.1, 1.0]} scale={[0.72, 0.018, 0.08]} />

      {/* 측면 탑승문 (좌우) */}
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 0.97, -0.05, 1.5]} scale={[0.04, 0.85, 1.6]} color={OLIVE_DARK} />
        <Block position={[side * 1.0, 0.0, 1.0]} scale={[0.05, 0.06, 0.3]} color={METAL} />
      </group>)}

      {/* 후방 램프 도어 */}
      <Block position={[0, 0.05, 2.78]} scale={[1.75, 1.15, 0.1]} rotation={[-0.06, 0, 0]} color={OLIVE_DARK} />
      <Block position={[0, -0.05, 2.83]} scale={[0.16, 0.1, 0.04]} color={METAL} />

      {/* 휠하우스 8개 (섀시에 파인 자리를 표현하는 검은 안쪽 링) */}
      {AXLE_Z.map((z) => [-1, 1].map((side) => <mesh key={`${z}-${side}`} position={[side * TRACK_X, WHEEL_Y, z]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[WHEEL_RADIUS * 0.95, 0.06, 6, 14]} />
        <meshStandardMaterial color={OLIVE_DARK} roughness={0.7} />
      </mesh>))}

      {/* 예비 타이어, 후방 상판 위 */}
      <group position={[-0.6, 0.72, 2.15]} rotation={[HALF_PI, 0, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.4, 0.4, 0.28, 12]} /><meshStandardMaterial color={TIRE} roughness={0.9} /></mesh>
        <mesh><cylinderGeometry args={[0.2, 0.2, 0.29, 10]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
      </group>

      {/* 견인 고리, 전면 하단 좌우 */}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.65, -0.55, -3.3]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[0.09, 0.025, 6, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>)}

      {/* 안테나 두 개 */}
      <mesh position={[0.75, 1.35, 0.7]}><cylinderGeometry args={[0.012, 0.018, 1.3, 6]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[-0.75, 1.2, 1.6]}><cylinderGeometry args={[0.012, 0.018, 1.0, 6]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
    </StaticBatch>

    {/* 캐빈: 운전석 캐빈 Block, 해치, 페리스코프. firstPerson 이거나 조준경을 켠 동안 숨긴다 */}
    <group visible={!firstPerson && !scoped}>
      <StaticBatch>
        <Block position={[-0.5, 0.55, -1.95]} scale={[0.7, 0.35, 0.9]} color={OLIVE} />
        <mesh position={[-0.5, 0.75, -1.95]} castShadow><cylinderGeometry args={[0.22, 0.22, 0.1, 10]} /><meshStandardMaterial color={OLIVE_DARK} roughness={0.6} /></mesh>
        {[-0.15, 0.15].map((dx) => <Block key={dx} position={[-0.5 + dx, 0.68, -2.35]} scale={[0.1, 0.08, 0.06]} color={OPTIC} />)}
      </StaticBatch>
    </group>

    {/* 앞 두 축 바퀴, 조향 group 안에 넣는다 */}
    {AXLE_Z.slice(0, STEER_AXLE_COUNT).map((z, axleIndex) => [-1, 1].map((side) => {
      const wheelIndex = axleIndex * 2 + (side < 0 ? 0 : 1);
      return <group
        key={`${z}-${side}`}
        userData={{ dynamic: true }} ref={(group) => { steerGroupRefs.current[axleIndex] = group; }}
        position={[side * TRACK_X, WHEEL_Y, z]}
      >
        <group userData={{ dynamic: true }} ref={(wheel) => { wheelRefs.current[wheelIndex] = wheel; }}><Wheel radius={WHEEL_RADIUS} /></group>
      </group>;
    }))}
    {/* 뒤 두 축 바퀴, 조향하지 않는다 */}
    {AXLE_Z.slice(STEER_AXLE_COUNT).map((z, axleIndex) => [-1, 1].map((side) => {
      const wheelIndex = (STEER_AXLE_COUNT + axleIndex) * 2 + (side < 0 ? 0 : 1);
      return <group key={`${z}-${side}`} position={[side * TRACK_X, WHEEL_Y, z]}>
        <group userData={{ dynamic: true }} ref={(wheel) => { wheelRefs.current[wheelIndex] = wheel; }}><Wheel radius={WHEEL_RADIUS} /></group>
      </group>;
    }))}

    {/* 무인 포탑, turretYaw 로 y 축 회전. dynamic 이라 위 StaticBatch 병합에서 빠진다.
        포탑 안은 이전부터 개별 mesh 로 그렸고 병합하지 않았다. 캐빈(무인 포탑 상자)만 따로
        묶어 firstPerson 일 때 숨긴다 */}
    <group userData={{ dynamic: true }} ref={turretRef} position={[0, TURRET_BASE_Y, -0.3]}>
      {/* 캐빈: 무인 포탑 상자. firstPerson 이거나 조준경을 켠 동안 숨긴다 */}
      <group visible={!firstPerson && !scoped}>
        <Block position={[0, 0.28, 0]} scale={[0.95, 0.32, 1.2]} color={OLIVE} />
        <Block position={[0, 0.5, -0.1]} scale={[0.7, 0.14, 0.85]} color={OLIVE_DARK} />
      </group>

      {/* 광학 조준경 */}
      <Block position={[0.35, 0.42, -0.55]} scale={[0.16, 0.14, 0.2]} color={METAL} />
      <mesh position={[0.35, 0.42, -0.66]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.055, 0.055, 0.06, 10]} /><meshStandardMaterial color={OPTIC} metalness={0.4} roughness={0.15} /></mesh>

      {/* 연막탄 발사기, 좌우 4연장 */}
      {[-1, 1].map((side) => <group key={side} position={[side * 0.5, 0.3, -0.4]} rotation={[0.12, 0, side * 0.35]}>
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[0, 0, i * 0.11 - 0.16]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />
          <meshStandardMaterial color={METAL} roughness={0.6} />
        </mesh>)}
      </group>)}

      {/* 기관포, barrelPitch 로 x 축 회전. 전차포보다 훨씬 가는 포신 */}
      <group ref={barrelRef} position={[0, 0.32, -0.5]}>
        <mesh position={[0, 0, -0.35]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.5, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -1.95]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 2.8, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -3.4]}><cylinderGeometry args={[0.05, 0.05, 0.03, 10]} /><meshStandardMaterial color={OLIVE_DARK} roughness={0.6} /></mesh>

        {/* 동축 기관총 */}
        <mesh position={[0.13, -0.02, -1.1]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.028, 1.6, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  </group>;
}
