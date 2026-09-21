import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Wheel } from './carParts.jsx';
import { extrudeUpright, steerAngle } from './carGeometry.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 플레이어가 모는 세단 시각 모델이다. Jet, Helicopter 와 같은 축 규약을 따른다.
 * 로컬 원점은 차체 중심, +Y 위, 차 앞이 -Z, 좌우가 X 다. 부모가 위치와 자세를 준다.
 * 바퀴 최하단은 정확히 -0.9, 지붕 꼭대기는 0.85 를 넘지 않는다.
 * 전장 Z -2.6..2.6, 전폭 X ±1.15 를 넘기지 않는다. 카메라와 충돌 판정이 이 크기를 전제한다.
 * 조향과 바퀴 회전은 이 컴포넌트가 직접 처리한다. 부모는 steer, speed 값만 준다.
 * 1인칭 눈높이는 차체 로컬 좌표 [-0.55, 0.55, -0.15] 다(eyePoints.js EYE_POINTS.sedan). 실내 배치는 이 값을 기준으로 삼는다.
 * firstPerson 이면 캐빈 group 을 숨긴다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const MAX_STEER = 0.5;
const MAX_STEP = 0.05;

const BODY = '#527f8c';
const BODY_DARK = '#446a75';
const GLASS = '#385c6d';
const TIRE = '#2a3134';
const RIM = '#c7ccce';
const TRIM = '#8e979b';
const HEAD_LAMP = '#ffe6a0';
const TAIL_LAMP = '#d94f3d';
const GRILLE = '#3a4245';
const PLATE = '#dfe2e0';
const EXHAUST = '#5b6467';

/* 실내 전용 팔레트다. 색은 hex 리터럴만 쓴다. */
const CABIN_DARK = '#3a3f42';
const CABIN_DARK2 = '#4a5054';
const LEATHER = '#5a5450';
const GAUGE_BEZEL = '#2a3134';
const GAUGE_GLOW = '#88b5cd';

const GLASS_OPACITY = 0.45;

const WHEEL_RADIUS = 0.42;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -1.55;
const REAR_Z = 1.55;
const TRACK_X = 0.98;

const STEER_SPOKES = [0, 1, 2];
const GRILLE_SLATS = [-0.07, 0, 0.07];
const VENT_X = [-0.28, -0.09, 0.09, 0.28];

export default function Sedan({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const rearLeftWheel = useRef();
  const rearRightWheel = useRef();
  const frontLeftWheel = useRef();
  const frontRightWheel = useRef();
  const steerGroupLeft = useRef();
  const steerGroupRight = useRef();
  const steeringWheelRef = useRef();

  /* 캐빈 측면 실루엣이다. A, B, C 필러 사이 창을 만들기 위해 지붕 라인만 세운다. */
  const geometries = useMemo(() => ({
    cabinSide: extrudeUpright(
      [[-1.05, 0.05], [-0.72, 0.5], [0.05, 0.62], [0.75, 0.5], [1.0, 0.05]],
      0.06,
    ),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    if (steerGroupLeft.current) steerGroupLeft.current.rotation.y = angle;
    if (steerGroupRight.current) steerGroupRight.current.rotation.y = angle;
    /* 스티어링 휠도 같이 돌아 실내 조향이 자연스럽다. 바퀴보다 더 크게 돈다 */
    if (steeringWheelRef.current) steeringWheelRef.current.rotation.z = -angle * 2.2;
  }, [steer]);

  /* wheelsRef 가 있으면(CarMode 주행 중) 조향과 바퀴 회전을 매 프레임 직접 읽는다.
   * props 로만 받으면(원격 차량) 위 effect 와 마지막 speed 값만 쓴다. */
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      if (steerGroupLeft.current) steerGroupLeft.current.rotation.y = angle;
      if (steerGroupRight.current) steerGroupRight.current.rotation.y = angle;
      if (steeringWheelRef.current) steeringWheelRef.current.rotation.z = -angle * 2.2;
    }
    const step = Math.min(delta, MAX_STEP) * (live ? live.speed : speed);
    if (frontLeftWheel.current) frontLeftWheel.current.rotation.x = (frontLeftWheel.current.rotation.x + step) % TWO_PI;
    if (frontRightWheel.current) frontRightWheel.current.rotation.x = (frontRightWheel.current.rotation.x + step) % TWO_PI;
    if (rearLeftWheel.current) rearLeftWheel.current.rotation.x = (rearLeftWheel.current.rotation.x + step) % TWO_PI;
    if (rearRightWheel.current) rearRightWheel.current.rotation.x = (rearRightWheel.current.rotation.x + step) % TWO_PI;
  });

  return <group>
    {/* 앞부분, 1인칭에서도 항상 보인다 */}
    <StaticBatch>
      {/* 하부 섀시, 낮은 보닛과 트렁크 */}
      <Block position={[0, -0.42, 0]} scale={[2.0, 0.5, 4.4]} color={BODY} />
      <Block position={[0, -0.1, -1.75]} scale={[1.9, 0.42, 1.0]} color={BODY} />
      <Block position={[0, -0.1, 1.85]} scale={[1.9, 0.4, 0.85]} color={BODY} />

      {/* 보닛과 카울 사이 패널 실선. 보닛 뒤 가장자리 위라 앞부분에 둔다 */}
      <PanelSeam position={[0, 0.24, -1.72]} scale={[1.42, 0.018, 0.04]} color={BODY_DARK} />


      {/* 도어 라인, 손잡이(우묵한 자리를 어두운 색으로 표현). 외장 패널 표면이라 앞부분에 둔다 */}
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.0, -0.15, -0.15]} scale={[0.02, 0.55, 2.6]} color={BODY_DARK} />
        <Block position={[side * 1.02, 0.05, -0.85]} scale={[0.06, 0.07, 0.24]} color={TRIM} />
        <Block position={[side * 1.02, 0.05, 0.55]} scale={[0.06, 0.07, 0.24]} color={TRIM} />
      </group>)}

      {/* 사이드미러 */}
      {[-1, 1].map((side) => <Block key={side} position={[side * 1.06, 0.35, -0.85]} scale={[0.16, 0.14, 0.08]} color={BODY_DARK} />)}

      {/* 앞 범퍼, 그릴(가로살 여럿), 헤드램프(프로젝터와 반사판) */}
      <Block position={[0, -0.28, -2.42]} scale={[1.9, 0.42, 0.2]} color={TRIM} />
      <SurfaceVent position={[0, -0.13, -2.5]} scale={[0.68, 0.018, 0.06]} />
      {GRILLE_SLATS.map((y) => <Block key={y} position={[0, y, -2.49]} scale={[1.1, 0.02, 0.08]} color={GRILLE} />)}
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 0.72, 0.05, -2.46]} scale={[0.32, 0.18, 0.08]} color={HEAD_LAMP} />
        <mesh position={[side * 0.72, 0.05, -2.5]} rotation={[0, 0, HALF_PI]}>
          <cylinderGeometry args={[0.02, 0.09, 0.1, 12]} />
          <meshStandardMaterial color={RIM} metalness={0.8} roughness={0.15} />
        </mesh>
        <mesh position={[side * 0.72, 0.05, -2.52]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color={HEAD_LAMP} emissive={HEAD_LAMP} emissiveIntensity={1.1} roughness={0.2} />
        </mesh>
        <Block position={[side * 0.72, -0.14, -2.47]} scale={[0.3, 0.05, 0.06]} color={TRIM} />
        <DetailLamp position={[side * 0.72, 0.06, -2.55]} color={HEAD_LAMP} scale={0.045} />
      </group>)}

      {/* 뒤 범퍼, 테일램프(분할), 번호판, 배기구, 트렁크 립, 주유구 */}
      <Block position={[0, -0.28, 2.42]} scale={[1.9, 0.42, 0.22]} color={TRIM} />
      <Block position={[0, 0.11, 2.27]} scale={[1.55, 0.03, 0.1]} color={TRIM} />
      <Block position={[0, 0.05, 2.5]} scale={[0.5, 0.3, 0.06]} color={PLATE} />
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[side * 0.75, 0.08, 2.48]}>
          <boxGeometry args={[0.26, 0.12, 0.06]} />
          <meshStandardMaterial color={TAIL_LAMP} emissive={TAIL_LAMP} emissiveIntensity={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[side * 0.75, -0.06, 2.48]}>
          <boxGeometry args={[0.26, 0.1, 0.06]} />
          <meshStandardMaterial color={TAIL_LAMP} emissive={TAIL_LAMP} emissiveIntensity={0.4} roughness={0.4} />
        </mesh>
      </group>)}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.55, -0.4, 2.5]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.1, 10]} />
        <meshStandardMaterial color={EXHAUST} metalness={0.6} roughness={0.4} />
      </mesh>)}
      <mesh position={[1.02, -0.15, 1.7]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 10]} />
        <meshStandardMaterial color={GRILLE} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* 머드플랩, 뒷바퀴 뒤쪽 */}
      {[-1, 1].map((side) => <Block key={side} position={[side * TRACK_X, -0.75, REAR_Z + 0.42]} scale={[0.32, 0.22, 0.02]} rotation={[0.15, 0, 0]} color={TIRE} />)}
    </StaticBatch>

    {/* 캐빈, firstPerson 이면 숨긴다(실내 모델이 대신 그린다) */}
    <group visible={!firstPerson}>
      <StaticBatch>
      {/* 와이퍼 두 개. 앞유리 아래 캐빈 안쪽 공중에 걸쳐 1인칭에서는 대시 위에 떠 보이므로 캐빈과 함께 숨긴다 */}
      {[-0.35, 0.35].map((x) => <Block key={x} position={[x, 0.32, -0.86]} scale={[0.035, 0.02, 0.62]} rotation={[0.5, 0, x > 0 ? 0.12 : -0.06]} color={TIRE} />)}
        {/* 캐빈 상단, 지붕 */}
        <Block position={[0, 0.42, 0]} scale={[1.72, 0.55, 2.35]} color={BODY} />
        <Block position={[0, 0.72, -0.05]} scale={[1.6, 0.1, 2.0]} color={BODY_DARK} />

        {/* 캐빈 측면 실루엣(창, 필러 라인) 양쪽. 실내가 비치도록 반투명으로 바꿨다 */}
        {[-1, 1].map((side) => <mesh key={side} geometry={geometries.cabinSide} position={[side * 0.87, 0.4, 0]} scale={[side, 1, 1]} dispose={null}>
          <meshStandardMaterial color={GLASS} metalness={0.25} roughness={0.2} transparent opacity={GLASS_OPACITY} />
        </mesh>)}

        {/* A, B, C 필러 */}
        {[-1, 1].map((side) => <group key={side}>
          <Block position={[side * 0.86, 0.42, -0.68]} scale={[0.06, 0.5, 0.12]} rotation={[0, 0, side * 0.08]} color={BODY_DARK} />
          <Block position={[side * 0.86, 0.68, 0.0]} scale={[0.06, 0.42, 0.1]} color={BODY_DARK} />
          <Block position={[side * 0.86, 0.5, 0.92]} scale={[0.06, 0.5, 0.12]} rotation={[0, 0, -side * 0.1]} color={BODY_DARK} />
        </group>)}

        {/* 앞유리, 뒷유리. 반투명이라 실내가 밖에서도 보인다 */}
        <mesh position={[0, 0.55, -0.98]} scale={[1.5, 0.55, 0.08]} rotation={[0.55, 0, 0]}>
          <boxGeometry />
          <meshStandardMaterial color={GLASS} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>
        <mesh position={[0, 0.6, 1.15]} scale={[1.5, 0.5, 0.08]} rotation={[-0.5, 0, 0]}>
          <boxGeometry />
          <meshStandardMaterial color={GLASS} metalness={0.2} roughness={0.15} transparent opacity={GLASS_OPACITY} />
        </mesh>

        {/* ---- 실내 ---- 1인칭 눈높이 [-0.55, 0.55, -0.15] 앞쪽과 아래쪽에 배치한다 */}

        {/* 대시보드 상단면과 앞면 */}
        <Block position={[0, 0.33, -0.98]} scale={[1.62, 0.06, 0.34]} color={CABIN_DARK} />
        <Block position={[0, 0.16, -1.12]} scale={[1.62, 0.32, 0.06]} rotation={[0.25, 0, 0]} color={CABIN_DARK} />

        {/* 계기판 하우징, 속도계/회전계 베젤, 사이 디스플레이 */}
        <Block position={[0.34, 0.38, -1.1]} scale={[0.46, 0.24, 0.14]} color={GAUGE_BEZEL} />
        {[-0.11, 0.11].map((offset) => <mesh key={offset} position={[0.34 + offset, 0.4, -1.17]}>
          <torusGeometry args={[0.08, 0.014, 8, 16]} />
          <meshStandardMaterial color={GAUGE_BEZEL} metalness={0.4} roughness={0.4} />
        </mesh>)}
        <mesh position={[0.34, 0.42, -1.16]}>
          <boxGeometry args={[0.1, 0.05, 0.01]} />
          <meshStandardMaterial color={GAUGE_BEZEL} emissive={GAUGE_GLOW} emissiveIntensity={0.5} roughness={0.4} />
        </mesh>

        {/* 센터페시아 : 송풍구 네 개, 화면, 버튼 줄 */}
        <Block position={[0, 0.32, -1.0]} scale={[0.6, 0.5, 0.1]} color={CABIN_DARK2} />
        <Block position={[0, 0.44, -1.03]} scale={[0.36, 0.2, 0.02]} color={GAUGE_BEZEL} />
        {VENT_X.map((x) => <Block key={x} position={[x * 0.3, 0.24, -1.03]} scale={[0.1, 0.06, 0.02]} color={CABIN_DARK} />)}
        <Block position={[0, 0.14, -1.03]} scale={[0.34, 0.04, 0.02]} color={CABIN_DARK} />

        {/* 기어 셀렉터, 콘솔 */}
        <Block position={[0.18, -0.05, -0.55]} scale={[0.3, 0.28, 0.9]} color={CABIN_DARK2} />
        <Block position={[0.18, 0.1, -0.4]} scale={[0.05, 0.14, 0.05]} color={GAUGE_BEZEL} />

        {/* 스티어링 휠 : 림, 스포크 3개, 센터 허브. steer 에 맞춰 함께 돈다. 우측통행이라 왼쪽이다 */}
        <group position={[-0.55, 0.42, -0.95]} rotation={[-0.25, 0, 0]}>
          <group ref={steeringWheelRef} userData={{ dynamic: true }}>
            <mesh><torusGeometry args={[0.16, 0.022, 8, 16]} /><meshStandardMaterial color={CABIN_DARK} roughness={0.5} /></mesh>
            {STEER_SPOKES.map((index) => <group key={index} rotation={[0, 0, index * TWO_PI / STEER_SPOKES.length]}>
              <Block position={[0, 0.08, 0]} scale={[0.03, 0.15, 0.025]} color={CABIN_DARK} />
            </group>)}
            <mesh rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.045, 0.045, 0.05, 10]} /><meshStandardMaterial color={GAUGE_BEZEL} metalness={0.4} roughness={0.4} /></mesh>
          </group>
        </group>

        {/* 룸미러 */}
        <Block position={[0, 0.76, -0.88]} scale={[0.16, 0.04, 0.03]} color={CABIN_DARK} />

        {/* 도어 트림, 창틀 (좌우) */}
        {[-1, 1].map((side) => <group key={side}>
          <Block position={[side * 0.93, -0.02, -0.1]} scale={[0.05, 0.5, 2.2]} color={CABIN_DARK} />
          <Block position={[side * 0.9, 0.36, -0.1]} scale={[0.03, 0.05, 2.15]} color={TRIM} />
        </group>)}

        {/* 앞좌석 두 개, 등받이와 헤드레스트 */}
        {[0.34, -0.34].map((x) => <group key={x}>
          <Block position={[x, -0.16, 0.05]} scale={[0.5, 0.16, 0.56]} color={LEATHER} />
          <Block position={[x, 0.16, 0.33]} scale={[0.48, 0.56, 0.14]} rotation={[-0.08, 0, 0]} color={LEATHER} />
          <Block position={[x, 0.5, 0.3]} scale={[0.28, 0.18, 0.13]} color={LEATHER} />
        </group>)}

        {/* 뒷좌석 등받이 */}
        <Block position={[0, 0.14, 1.05]} scale={[1.6, 0.5, 0.16]} rotation={[-0.06, 0, 0]} color={LEATHER} />

        {/* 바닥 카펫 */}
        <Block position={[0, -0.62, 0.15]} scale={[1.6, 0.05, 2.3]} color={CABIN_DARK} />

        {/* 페달 두 개 */}
        <Block position={[0.28, -0.55, -0.9]} scale={[0.08, 0.02, 0.16]} rotation={[0.4, 0, 0]} color={CABIN_DARK2} />
        <Block position={[0.44, -0.55, -0.88]} scale={[0.09, 0.02, 0.18]} rotation={[0.3, 0, 0]} color={CABIN_DARK2} />
      </StaticBatch>
    </group>

    {/* 앞바퀴, 조향 group 안에 넣는다. 캘리퍼는 앞바퀴에만 단다. 조향과 회전이 걸리므로 정적 병합에서 뺀다 */}
    <group ref={steerGroupLeft} position={[-TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true }}>
      <group ref={frontLeftWheel}><Wheel radius={WHEEL_RADIUS} brake /></group>
    </group>
    <group ref={steerGroupRight} position={[TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true }}>
      <group ref={frontRightWheel}><Wheel radius={WHEEL_RADIUS} brake /></group>
    </group>
    {/* 뒷바퀴. 회전만 걸리지만 같은 이유로 뺀다 */}
    <group position={[-TRACK_X, WHEEL_Y, REAR_Z]} userData={{ dynamic: true }}>
      <group ref={rearLeftWheel}><Wheel radius={WHEEL_RADIUS} /></group>
    </group>
    <group position={[TRACK_X, WHEEL_Y, REAR_Z]} userData={{ dynamic: true }}>
      <group ref={rearRightWheel}><Wheel radius={WHEEL_RADIUS} /></group>
    </group>
  </group>;
}
