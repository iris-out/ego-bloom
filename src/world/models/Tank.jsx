import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import StaticBatch from '../StaticBatch.jsx';
import * as THREE from 'three';
import Block from './ModelBlock';
import { ArmorShell, TrackLoop } from './SurfaceParts.jsx';
import { PanelSeam, SurfaceVent } from './exteriorDetails.jsx';

/** 플레이어가 모는 주력전차 시각 모델이다. Sedan, ArmoredCar 와 같은 축 규약을 따른다.
 * 로컬 원점은 차체 중심, +Y 위, 차체 앞이 -Z, 좌우가 X 다. 부모가 위치와 자세를 준다.
 * 궤도 최하단은 정확히 -0.9, 포탑 지붕은 1.6 을 넘지 않는다.
 * 차체 Z -3.6..3.6, X ±1.9 를 넘기지 않는다. 포신 끝은 포탑 앞으로 더 뻗는다.
 * 포탑 선회, 포신 앙각은 이 컴포넌트가 직접 처리한다. 궤도 회전만 speed 로 애니메이션한다.
 * firstPerson 이면 포탑 상자, 지붕, 볼 장갑, 해치만 숨긴다(실내가 대신 그린다). 포신과
 * 포미 마운트, 포탑 dynamic group 자체는 남는다. scoped 는 조준경을 켠 동안 같은 조각을
 * 숨긴다. 3인칭 평소 외형은 둘 다 false 라 바뀌지 않는다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const MAX_STEP = 0.05;
const BARREL_PITCH_MIN = -0.3;
const BARREL_PITCH_MAX = 0.35;

const OLIVE = '#5d6350';
const OLIVE_DARK = '#464b3d';
const METAL = '#2a3134';
const METAL_LIGHT = '#394649';
const OPTIC = '#8e979b';

const TRACK_BOTTOM = -0.9;
const TRACK_X = 1.55;

const WHEEL_RADIUS = 0.42;
const WHEEL_Y = TRACK_BOTTOM + WHEEL_RADIUS;
const IDLER_Z = -2.7;
const SPROCKET_Z = 2.7;
const ROAD_WHEEL_Z = [-1.9, -1.0, -0.1, 0.8, 1.7];
const RETURN_ROLLER_Z = [-1.1, 1.1];
const RETURN_ROLLER_Y = WHEEL_Y + 0.72;
const TURRET_BASE_Y = 0.75;
const TURRET_BASE_Z = -0.3;

/* Sedan, ArmoredCar 의 Wheel 과 같은 규약이다. 바깥 group 이 rotation.x 로 회전축을 돌리고
 * 안쪽 group 은 원통 축을 X 로 눕혀 굴러가는 방향과 맞춘다. */
function RoadWheel({ radius }) {
  return <group rotation={[0, 0, HALF_PI]}><StaticBatch>
    <mesh castShadow><cylinderGeometry args={[radius, radius, 0.46, 24]} /><meshStandardMaterial color={METAL} roughness={0.85} /></mesh>
    <mesh position={[0, 0.003, 0]}><cylinderGeometry args={[radius * 0.4, radius * 0.4, 0.47, 24]} /><meshStandardMaterial color={METAL_LIGHT} metalness={0.4} roughness={0.5} /></mesh>
  </StaticBatch></group>;
}

function SingleWheel({ radius }) {
  return <group rotation={[0, 0, HALF_PI]}><StaticBatch>
    <mesh castShadow><cylinderGeometry args={[radius, radius, 0.44, 24]} /><meshStandardMaterial color={METAL} roughness={0.85} /></mesh>
  </StaticBatch></group>;
}

/* Sedan, ArmoredCar 의 extrudeUpright 와 같은 규약이다. shape 의 x 는 Z 축, y 는 Y 축, 두께는 X 로 가운데 정렬한다. */
function extrudeUpright(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => (index ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateY(-HALF_PI);
  geometry.translate(depth / 2, 0, 0);
  return geometry;
}

export default function Tank({ turretYaw = 0, barrelPitch = 0, wheelsRef, speed = 0, aimRef, firstPerson = false, scoped = false }) {
  const turretRef = useRef();
  const barrelRef = useRef();
  const rollingRefs = useRef([]);
  const rollingCount = 2 + 2 + ROAD_WHEEL_Z.length * 2;
  if (rollingRefs.current.length !== rollingCount) {
    rollingRefs.current = Array.from({ length: rollingCount }, () => null);
  }

  /* 전면 경사 장갑판 옆면 실루엣이다. */
  const geometries = useMemo(() => ({
    glacisSide: extrudeUpright(
      [[-2.95, -0.05], [-2.55, 0.55], [-1.9, 0.55], [-1.9, -0.05]],
      0.05,
    ),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useEffect(() => {
    if (turretRef.current) turretRef.current.rotation.y = turretYaw;
  }, [turretYaw]);

  useEffect(() => {
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(barrelPitch, BARREL_PITCH_MIN, BARREL_PITCH_MAX);
  }, [barrelPitch]);

  /* 조종 중에는 aimRef 를 매 프레임 읽는다. props 로 받으면 상태 갱신 주기만큼 포탑이 끊긴다. */
  useFrame(() => {
    const aim = aimRef?.current;
    if (!aim) return;
    if (turretRef.current) turretRef.current.rotation.y = aim.yaw;
    if (barrelRef.current) barrelRef.current.rotation.x = THREE.MathUtils.clamp(aim.pitch, BARREL_PITCH_MIN, BARREL_PITCH_MAX);
  });

  /* 기동륜, 유동륜, 보기륜의 rotation.x 만 누적한다. 프레임마다 새 객체를 만들지 않는다.
   * wheelsRef 가 있으면(CarMode 주행 중) 매 프레임 그 값을 읽는다. */
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP) * (wheelsRef?.current ? wheelsRef.current.speed : speed);
    rollingRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x = (wheel.rotation.x + step) % TWO_PI;
    });
  });

  let rollingIndex = 0;
  const nextRollingIndex = () => rollingIndex++;

  return <group>
    {/* 차체와 궤도, 1인칭에서도 항상 보인다 */}
    <StaticBatch>
      {/* 하부 차체, 경사 장갑 글라시스 */}
      <ArmorShell position={[0, -0.55, 0.1]} scale={[2.3, 0.5, 6.2]} color={OLIVE} castShadow />
      <ArmorShell position={[0, -0.15, -2.7]} scale={[2.2, 0.6, 1.2]} rotation={[0.42, 0, 0]} color={OLIVE} castShadow />
      <ArmorShell position={[0, -0.5, -3.15]} scale={[2.15, 0.35, 0.4]} rotation={[0.7, 0, 0]} color={OLIVE_DARK} castShadow />
      {[-1, 1].map((side) => <mesh key={side} geometry={geometries.glacisSide} position={[side * 1.12, 0, 0]} scale={[side, 1, 1]} dispose={null} castShadow>
        <meshStandardMaterial color={OLIVE_DARK} roughness={0.7} />
      </mesh>)}

      {/* 상부 차체 지붕, 후방 엔진 데크 */}
      <ArmorShell position={[0, -0.02, 0.2]} scale={[2.2, 0.32, 3.2]} color={OLIVE_DARK} castShadow />
      <ArmorShell position={[0, -0.05, 2.95]} scale={[2.15, 0.4, 1.15]} color={OLIVE} castShadow />
      <Block position={[0, 0.16, 2.9]} scale={[1.6, 0.06, 0.9]} color={METAL} />
      <SurfaceVent position={[0, 0.21, 2.9]} scale={[0.66, 0.018, 0.08]} />
      <mesh position={[0, -0.28, 3.5]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.14, 24]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>

      {/* 사이드 스커트, 궤도 상부를 가리는 판 */}
      {[-1, 1].map((side) => <Block key={side} position={[side * 1.42, -0.35, 0]} scale={[0.4, 0.3, 5.6]} color={OLIVE_DARK} castShadow />)}

      {/* 조종수 해치, 페리스코프 */}
      <mesh position={[-0.55, 0.16, -2.3]} castShadow><cylinderGeometry args={[0.24, 0.24, 0.1, 24]} /><meshStandardMaterial color={OLIVE_DARK} roughness={0.6} /></mesh>
      {[-0.16, 0.16].map((dx) => <Block key={dx} position={[-0.55 + dx, 0.28, -2.6]} scale={[0.1, 0.07, 0.06]} color={OPTIC} />)}

      {/* 전조등 */}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.85, -0.35, -3.34]}><boxGeometry args={[0.22, 0.16, 0.08]} /><meshStandardMaterial color={OPTIC} emissive={OPTIC} emissiveIntensity={0.6} roughness={0.35} /></mesh>)}

      {/* 견인 고리, 전면 하단 좌우 */}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.55, -0.78, -3.35]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[0.09, 0.025, 6, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>)}

      {/* 공구 상자, 후방 사이드 스커트 위 */}
      <Block position={[1.35, -0.05, 2.5]} scale={[0.3, 0.22, 0.75]} color={OLIVE_DARK} castShadow />
      <PanelSeam position={[1.36, 0.08, 2.5]} scale={[0.018, 0.18, 0.56]} color={OLIVE} />

      {/* 예비 궤도 링크, 글라시스 앞면에 거치 */}
      <Block position={[0.65, -0.1, -2.85]} scale={[0.4, 0.2, 0.16]} rotation={[0.42, 0, 0]} color={METAL_LIGHT} />

      {/* 배기 그릴, 후미 배기구 */}
      {[-0.5, 0.5].map((dx) => <Block key={dx} position={[dx, 0.14, 3.5]} scale={[0.7, 0.05, 0.1]} color={METAL} />)}

      {/* 궤도, 좌우 대칭. 하단 -0.9 를 보장하는 정적 궤도 하우징 */}
      {[-1, 1].map((side) => <group key={side}>
        <TrackLoop position={[side*TRACK_X,-.265,0]} length={6.24} height={1.27} width={.50} color={METAL}/>

        {/* 유동륜(전방) */}
        <group position={[side * TRACK_X, WHEEL_Y, IDLER_Z]}>
          <group userData={{ dynamic: true }} ref={(wheel) => { rollingRefs.current[nextRollingIndex()] = wheel; }}><RoadWheel radius={WHEEL_RADIUS} /></group>
        </group>
        {/* 기동륜(후방) */}
        <group position={[side * TRACK_X, WHEEL_Y, SPROCKET_Z]}>
          <group userData={{ dynamic: true }} ref={(wheel) => { rollingRefs.current[nextRollingIndex()] = wheel; }}><RoadWheel radius={WHEEL_RADIUS} /></group>
        </group>
        {/* 보기륜 */}
        {ROAD_WHEEL_Z.map((z) => <group key={z} position={[side * TRACK_X, WHEEL_Y, z]}>
          <group userData={{ dynamic: true }} ref={(wheel) => { rollingRefs.current[nextRollingIndex()] = wheel; }}><SingleWheel radius={WHEEL_RADIUS * 0.92} /></group>
        </group>)}
        {/* 상부 지지륜 */}
        {RETURN_ROLLER_Z.map((z) => <mesh key={z} position={[side * TRACK_X, RETURN_ROLLER_Y, z]} rotation={[0, 0, HALF_PI]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.4, 24]} />
          <meshStandardMaterial color={METAL_LIGHT} roughness={0.7} />
        </mesh>)}
      </group>)}
    </StaticBatch>

    {/* 포탑, turretYaw 로 y 축 회전. dynamic 이라 위 StaticBatch 병합에서 빠진다.
        포탑 안은 이전부터 개별 mesh 로 그렸고 병합하지 않았다. 캐빈(상자, 지붕, 볼 장갑, 해치)만
        따로 묶어 firstPerson 일 때 숨긴다 */}
    <group ref={turretRef} position={[0, TURRET_BASE_Y, TURRET_BASE_Z]} userData={{ dynamic: true }}>
      {/* 후방 버슬. 전면 경사판과 맨틀릿은 아래 캐빈 group 으로 갔다 */}
      <ArmorShell position={[0, 0.24, 1.0]} scale={[1.3, 0.4, 0.7]} color={OLIVE_DARK} castShadow />

      {/* 캐빈: 포탑 상자, 포탑 지붕, 볼 장갑, 큐폴라/해치/페리스코프, 로더 해치.
          firstPerson 이거나 조준경을 켠 동안 숨긴다 */}
      <group visible={!firstPerson && !scoped}>
        {/* 전면 경사판과 맨틀릿. 포수 조준선 정면 1.2~1.6m 를 채워 1인칭 조준경 안이 이 판이므로 캐빈과 함께 숨긴다 */}
        <ArmorShell position={[0, 0.14, -0.95]} scale={[1.5, 0.55, 0.4]} rotation={[0.3, 0, 0]} color={OLIVE_DARK} castShadow />
        <Block position={[0, 0.14, -1.02]} scale={[0.6, 0.5, 0.3]} color={METAL_LIGHT} />
        <ArmorShell position={[0, 0.2, 0]} scale={[1.7, 0.45, 2.0]} color={OLIVE} castShadow />
        <Block position={[0, 0.44, 0.05]} scale={[1.5, 0.1, 1.8]} color={OLIVE_DARK} castShadow />
        {[-1, 1].map((side) => <Block key={side} position={[side * 0.82, 0.2, 0.1]} scale={[0.32, 0.4, 1.9]} rotation={[0, 0, side * 0.14]} color={OLIVE} castShadow />)}

        {/* 큐폴라, 해치, 페리스코프 */}
        <mesh position={[0.55, 0.6, 0.3]} castShadow><cylinderGeometry args={[0.28, 0.28, 0.26, 24]} /><meshStandardMaterial color={OLIVE_DARK} roughness={0.6} /></mesh>
        <mesh position={[0.55, 0.75, 0.3]}><cylinderGeometry args={[0.29, 0.29, 0.06, 24]} /><meshStandardMaterial color={METAL} roughness={0.5} /></mesh>
        {[0, 1, 2].map((i) => <Block key={i} position={[0.55 + Math.cos(i * (TWO_PI / 3)) * 0.26, 0.62, 0.3 + Math.sin(i * (TWO_PI / 3)) * 0.26]} scale={[0.07, 0.06, 0.04]} color={OPTIC} />)}

        {/* 로더 해치 */}
        <mesh position={[-0.5, 0.52, 0.35]} castShadow><cylinderGeometry args={[0.24, 0.24, 0.08, 24]} /><meshStandardMaterial color={OLIVE_DARK} roughness={0.6} /></mesh>
      </group>

      {/* 측면 스토리지 빈 */}
      <Block position={[0.95, 0.12, 0.55]} scale={[0.3, 0.24, 0.8]} color={OLIVE_DARK} castShadow />

      {/* 연막탄 발사기, 좌우 2연장 */}
      {[-1, 1].map((side) => <group key={side} position={[side * 0.72, 0.28, -0.75]} rotation={[0.14, 0, side * 0.3]}>
        {[0, 1].map((i) => <mesh key={i} position={[0, 0, i * 0.15 - 0.075]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 24]} />
          <meshStandardMaterial color={METAL} roughness={0.6} />
        </mesh>)}
      </group>)}

      {/* 대공 기관총, 큐폴라 옆 거치대 */}
      <Block position={[0.35, 0.75, 0.55]} scale={[0.1, 0.1, 0.22]} color={METAL_LIGHT} />
      <mesh position={[0.35, 0.76, 0.85]} rotation={[HALF_PI, 0, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.7, 24]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* 안테나 */}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.85, 0.9, 0.95]}><cylinderGeometry args={[0.012, 0.018, 1.1, 6]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>)}

      {/* 주포와 동축 기관총, barrelPitch 로 x 축 회전. 회전축과 포구 끝은 GROUND_GUNS.tank 의 pivot, reach 와 같다 */}
      <group ref={barrelRef} position={[0, 0.14, -1.02]}>
        <mesh position={[0, 0, -1.0]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.115, 0.125, 1.6, 24]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -1.85]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.095, 0.105, 2.5, 24]} />
          <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -3.15]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.35, 24]} />
          <meshStandardMaterial color={OPTIC} metalness={0.4} roughness={0.3} />
        </mesh>
        {[-1, 1].map((side) => <Block key={side} position={[side * 0.125, 0, -3.15]} scale={[0.04, 0.2, 0.3]} color={METAL_LIGHT} />)}

        {/* 동축 기관총 */}
        <mesh position={[0.16, -0.03, -0.9]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.028, 1.5, 24]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  </group>;
}
