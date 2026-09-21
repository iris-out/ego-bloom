import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import StaticBatch from '../StaticBatch.jsx';
import * as THREE from 'three';
import Block from './ModelBlock';
import { PanelSeam, SurfaceVent } from './exteriorDetails.jsx';

/** 플레이어가 모는 자주포(자주곡사포) 시각 모델이다. Sedan, Helicopter 와 같은 축 규약을 따른다.
 * 로컬 원점은 차체 중심, +Y 위, 차 앞이 -Z, 좌우가 X 다. 부모가 위치와 자세를 준다.
 * 궤도 최하단은 정확히 -0.9, 포탑 지붕은 1.9 를 넘지 않는다.
 * 차체는 Z -4..4, X ±2 안쪽이다. 포신이 들리면 전체 높이가 y 4 까지 올라간다.
 * 포탑 회전(turretYaw)과 포신 앙각(barrelPitch)은 이 컴포넌트가 직접 그룹 회전으로 처리한다.
 * firstPerson 이면 포탑 상자, 측면 장갑, 뒤쪽 지붕 연장만 숨긴다(실내가 대신 그린다).
 * 전면 마운트, 지붕 해치, 포신, 포탑 dynamic group 자체는 남는다. scoped 는 조준경을 켠
 * 동안 같은 조각을 숨긴다. 3인칭 평소 외형은 둘 다 false 라 바뀌지 않는다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const MAX_STEP = 0.05;

const OLIVE = '#5d6350';
const DARK_OLIVE = '#464b3d';
const TRACK_METAL = '#2a3134';
const STEEL = '#394649';
const MUZZLE = '#8e979b';

const TRACK_X = 1.75;
const TRACK_TOP = -0.2;
const TRACK_BOTTOM = -0.9;
const WHEEL_RADIUS = 0.32;
const WHEEL_Y = TRACK_BOTTOM + WHEEL_RADIUS;
const WHEEL_Z = [-3.1, -2.07, -1.03, 0, 1.03, 2.07, 3.1];
const BOGIE_Z = [-3.5, 3.5];

/* 포신 회전축(주퇴복좌기 포함) 터렛 로컬 좌표다. 터렛 그룹 안에서 -Z 방향으로 포신이 뻗는다.
 * 포구 제퇴기 중심은 이 지점에서 로컬 z -2.75, 포구 끝은 z -2.9 다. */
const BARREL_PIVOT = [0, 0.55, -1.3];

/* Sedan.jsx 의 extrudeUpright 와 짝을 이루는 정면 판재용 헬퍼다. shape 의 x, y 는 그대로 X, Y 축이고
 * depth 만큼 Z 로 두께를 준 뒤 원점에 맞춰 가운데 정렬한다. 스페이드(주퇴판) 처럼 뒤를 바라보는 평판에 쓴다. */
function extrudeFacing(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** 굴러가는 보기륜이다. 매 프레임 도는 조각이라 정적 병합에서 뺀다. */
function RoadWheel({ innerRef }) {
  return <mesh ref={innerRef} userData={{ dynamic: true }} rotation={[0, 0, HALF_PI]} castShadow>
    <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 10]} />
    <meshStandardMaterial color={TRACK_METAL} roughness={0.85} />
  </mesh>;
}

export default function Howitzer({ turretYaw = 0, barrelPitch = 0, wheelsRef, speed = 0, aimRef, firstPerson = false, scoped = false }) {
  const turretRef = useRef();
  const barrelRef = useRef();
  const wheelRefs = useRef([]);

  /* 스페이드(차체 뒤 주퇴판) 만 사다리꼴이라 커스텀 geometry 로 만든다. 나머지는 Block 조합이다. */
  const geometries = useMemo(() => ({
    spade: extrudeFacing([[-0.85, -0.55], [0.85, -0.55], [0.55, 0.25], [-0.55, 0.25]], 0.14),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useEffect(() => {
    if (turretRef.current) turretRef.current.rotation.y = turretYaw;
  }, [turretYaw]);

  useEffect(() => {
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(barrelPitch, -0.1, 1.1);
  }, [barrelPitch]);

  /* 조종 중에는 aimRef 를 매 프레임 읽는다. props 로 받으면 상태 갱신 주기만큼 포탑이 끊긴다. */
  useFrame(() => {
    const aim = aimRef?.current;
    if (!aim) return;
    if (turretRef.current) turretRef.current.rotation.y = aim.yaw;
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(aim.pitch, -0.1, 1.1);
  });

  /* 보기륜만 굴러가는 흐름을 표현한다. 새 객체를 만들지 않고 ref 의 rotation.x 만 누적한다.
   * wheelsRef 가 있으면(CarMode 주행 중) 매 프레임 그 값을 읽는다. */
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP) * (wheelsRef?.current ? wheelsRef.current.speed : speed);
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x = (wheel.rotation.x + step) % TWO_PI;
    });
  });

  return <group>
    {/* 차체와 궤도, 1인칭에서도 항상 보인다 */}
    <StaticBatch>
      {/* 하부 차체, 상부 조종실, 엔진 데크, 전면 경사장갑, 후면판 */}
      <Block position={[0, -0.4, 0]} scale={[2.6, 0.7, 7.2]} color={OLIVE} />
      <Block position={[0, 0.15, -2.0]} scale={[2.4, 0.9, 2.8]} color={OLIVE} />
      <Block position={[0, 0.05, 1.8]} scale={[2.4, 0.7, 3.2]} color={DARK_OLIVE} />
      <Block position={[0, -0.05, -3.5]} scale={[2.3, 0.9, 0.5]} rotation={[0.5, 0, 0]} color={OLIVE} />
      <Block position={[0, -0.3, 3.6]} scale={[2.4, 0.6, 0.25]} color={DARK_OLIVE} />

      {/* 엔진 데크 그릴 */}
      {[-0.7, 0, 0.7].map((x) => <Block key={x} position={[x, 0.42, 2.2]} scale={[0.5, 0.06, 1.6]} color={STEEL} />)}
      <SurfaceVent position={[0, 0.48, 2.2]} scale={[0.78, 0.018, 0.08]} />
      <PanelSeam position={[0, 0.32, -2.2]} scale={[1.7, 0.018, 0.04]} color={DARK_OLIVE} />

      {/* 전면 견인 고리 */}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.6, -0.55, -3.85]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[0.14, 0.035, 6, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.4} />
      </mesh>)}

      {/* 엔진 데크 안테나 */}
      <mesh position={[0.9, 0.7, 2.5]}><cylinderGeometry args={[0.015, 0.025, 1.1, 6]} /><meshStandardMaterial color={STEEL} metalness={0.4} roughness={0.5} /></mesh>

      {/* 궤도, 사이드스커트 */}
      {[-1, 1].map((side) => <Block key={side} position={[side * TRACK_X, (TRACK_TOP + TRACK_BOTTOM) / 2, 0]} scale={[0.42, TRACK_TOP - TRACK_BOTTOM, 6.9]} color={TRACK_METAL} />)}
      {[-1, 1].map((side) => <Block key={side} position={[side * 1.95, -0.15, 0]} scale={[0.06, 1.0, 7.0]} color={DARK_OLIVE} />)}

      {/* 보기륜(양쪽 7개씩) */}
      {[-1, 1].map((side) => WHEEL_Z.map((z, index) => <group key={`${side}-${z}`} position={[side * TRACK_X, WHEEL_Y, z]}>
        <RoadWheel innerRef={(el) => { wheelRefs.current[side < 0 ? index : index + WHEEL_Z.length] = el; }} />
      </group>))}

      {/* 유동륜(전방), 기동륜(후방)과 허브캡 */}
      {[-1, 1].map((side) => BOGIE_Z.map((z) => <group key={`${side}-${z}`} position={[side * TRACK_X, TRACK_TOP - 0.1, z]}>
        <mesh rotation={[0, 0, HALF_PI]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.34, 12]} /><meshStandardMaterial color={TRACK_METAL} roughness={0.8} /></mesh>
        <mesh rotation={[0, 0, HALF_PI]}><cylinderGeometry args={[0.14, 0.14, 0.36, 8]} /><meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.4} /></mesh>
      </group>))}

      {/* 스페이드(차체 뒤 주퇴판)와 지지대 */}
      <mesh geometry={geometries.spade} position={[0, -0.15, 3.9]} castShadow dispose={null}>
        <meshStandardMaterial color={STEEL} roughness={0.7} />
      </mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.4, -0.35, 3.75]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.35, 6]} /><meshStandardMaterial color={STEEL} metalness={0.4} roughness={0.5} />
      </mesh>)}
    </StaticBatch>

    {/* 포탑, 포신을 turretYaw 로 통째로 돌린다. dynamic 이라 위 StaticBatch 병합에서 빠진다.
        포탑 안은 이전부터 개별 mesh 로 그렸고 병합하지 않았다. 캐빈(상자, 측면 장갑, 뒤 지붕
        연장)만 따로 묶어 firstPerson 일 때 숨긴다 */}
    <group userData={{ dynamic: true }} ref={turretRef} position={[0, 0.8, -0.3]}>
      {/* 포탑 뒤 조각. 전면 마운트는 아래 캐빈 group 으로 갔다 */}

      {/* 캐빈: 포탑 상자, 측면 장갑, 뒤쪽 지붕 연장. firstPerson 이거나 조준경을 켠 동안 숨긴다 */}
      <group visible={!firstPerson && !scoped}>
        {/* 전면 마운트. 1인칭 조준선을 막으므로 캐빈과 함께 숨긴다 */}
        <Block position={[0, 0.35, -1.35]} scale={[1.7, 0.7, 0.35]} rotation={[0.35, 0, 0]} color={DARK_OLIVE} />
        <Block position={[0, 0.5, 0]} scale={[1.9, 1.0, 2.6]} color={OLIVE} />
        {[-1, 1].map((side) => <Block key={side} position={[side * 0.98, 0.55, 0.3]} scale={[0.06, 1.0, 1.6]} color={DARK_OLIVE} />)}
        <Block position={[0, 0.5, 1.55]} scale={[1.6, 0.9, 0.9]} color={DARK_OLIVE} />
      </group>

      {/* 지붕 해치 두 개와 페리스코프 */}
      {[[-0.5, -0.2], [0.5, 0.3]].map(([x, z]) => <group key={`${x}-${z}`} position={[x, 1.05, z]}>
        <mesh castShadow><cylinderGeometry args={[0.3, 0.3, 0.1, 10]} /><meshStandardMaterial color={STEEL} roughness={0.6} /></mesh>
        <Block position={[0.18, 0.06, 0]} scale={[0.08, 0.02, 0.08]} color={TRACK_METAL} />
      </group>)}

      {/* 지붕 기관총과 거치대 */}
      <group position={[0.5, 1.0, -0.15]}>
        <Block scale={[0.15, 0.1, 0.15]} color={STEEL} />
        <mesh position={[0, 0.02, -0.28]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.025, 0.03, 0.5, 8]} /><meshStandardMaterial color={TRACK_METAL} metalness={0.5} roughness={0.4} /></mesh>
      </group>

      {/* 연막탄 발사기 (양쪽 3발씩) */}
      {[-1, 1].map((side) => [0, 1, 2].map((row) => <mesh key={`${side}-${row}`} position={[side * 0.88, 0.55 + row * 0.1, -1.15]} rotation={[-0.3, 0, side * 0.15]}>
        <cylinderGeometry args={[0.045, 0.045, 0.32, 8]} /><meshStandardMaterial color={TRACK_METAL} roughness={0.7} />
      </mesh>))}

      {/* 포탑 뒤 안테나 마운트 */}
      <mesh position={[0.85, 1.1, 1.7]}><cylinderGeometry args={[0.02, 0.03, 0.9, 6]} /><meshStandardMaterial color={STEEL} metalness={0.4} roughness={0.5} /></mesh>

      {/* 포신 group, barrelPitch 는 rotation.x 로만 처리한다. 회전축과 포구 끝은 GROUND_GUNS.howitzer 의 pivot, reach 와 같다 */}
      <group ref={barrelRef} position={BARREL_PIVOT}>
        <mesh position={[0, 0, 0]} rotation={[0, HALF_PI, 0]}><torusGeometry args={[0.2, 0.06, 8, 14]} /><meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.4} /></mesh>
        <Block position={[0, 0, 0.25]} scale={[0.5, 0.5, 0.6]} color={DARK_OLIVE} />

        {/* 주퇴복좌기 (포신 위 두 개) */}
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.18, 0.16, -1.0]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.6, 8]} /><meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.35} />
        </mesh>)}

        {/* 대구경 포신 (뒤가 굵고 앞으로 갈수록 가늘다) */}
        <mesh position={[0, 0, -0.9]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.14, 0.16, 1.6, 10]} /><meshStandardMaterial color={TRACK_METAL} metalness={0.4} roughness={0.5} /></mesh>
        <mesh position={[0, 0, -2.2]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.115, 0.14, 1.0, 10]} /><meshStandardMaterial color={TRACK_METAL} metalness={0.4} roughness={0.5} /></mesh>

        {/* 포구 제퇴기 */}
        <mesh position={[0, 0, -2.75]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.2, 0.17, 0.3, 10]} /><meshStandardMaterial color={MUZZLE} metalness={0.3} roughness={0.4} /></mesh>
        {[-2.62, -2.88].map((z) => <mesh key={z} position={[0, 0, z]} rotation={[HALF_PI, 0, 0]}><torusGeometry args={[0.19, 0.02, 6, 12]} /><meshStandardMaterial color={MUZZLE} metalness={0.3} roughness={0.4} /></mesh>)}
      </group>
    </group>
  </group>;
}
