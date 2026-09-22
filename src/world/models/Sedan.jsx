import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Wheel } from './carParts.jsx';
import {
  beamBetween, createVehicleBodyGeometries, flatPolygonGeometry, loftBody, quadGeometry,
  steerAngle, VEHICLE_SHAPES,
} from './carGeometry.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';
import { SEDAN_FRONT_LIGHTS, SEDAN_REAR_LIGHTS } from '../headlights.js';

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

const BODY = '#315d70';
const BODY_DARK = '#244653';
const BODY_HIGHLIGHT = '#477b8e';
const GLASS = '#203d4b';
const TIRE = '#2a3134';
const RIM = '#c7ccce';
const TRIM = '#aeb9bd';
const HEAD_LAMP = '#e8f5ff';
const TAIL_LAMP = '#ef3348';
const GRILLE = '#171e22';
const PLATE = '#dfe2e0';

const GLASS_OPACITY = 0.68;

const WHEEL_RADIUS = 0.42;
const WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -1.55;
const REAR_Z = 1.55;
const TRACK_X = 0.98;
const SHAPE = VEHICLE_SHAPES.sedan;
const GRILLE_RIGHT = Object.freeze([
  [0.045, 0.105], [0.15, 0.14], [0.49, 0.14], [0.55, 0.09],
  [0.54, -0.09], [0.44, -0.18], [0.12, -0.18], [0.045, -0.13],
]);
const mirroredOutline = points => points.map(([x, y]) => [-x, y]);

function mirroredPane(points) {
  return points.map(([x, y, z]) => [-x, y, z]);
}

function FrameBeam({ from, to, width = 0.055, depth = 0.075, color = BODY_DARK }) {
  const beam = beamBetween(from, to);
  return <mesh position={beam.position} quaternion={beam.quaternion} scale={[width, beam.length, depth]}>
    <boxGeometry />
    <meshStandardMaterial color={color} metalness={0.32} roughness={0.4} />
  </mesh>;
}


export default function Sedan({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const rearLeftWheel = useRef();
  const rearRightWheel = useRef();
  const frontLeftWheel = useRef();
  const frontRightWheel = useRef();
  const steerGroupLeft = useRef();
  const steerGroupRight = useRef();

  const geometries = useMemo(() => {
    const body = createVehicleBodyGeometries('sedan');
    const left = SHAPE.sideWindows.left;
    return {
      ...body,
      roofShell: loftBody(SHAPE.roofSections),
      roofInset: quadGeometry([[-0.52, 0.885, 0.65], [0.52, 0.885, 0.65], [0.55, 0.895, -0.50], [-0.55, 0.895, -0.50]]),
      windshield: quadGeometry(SHAPE.windshield),
      rearWindow: quadGeometry(SHAPE.rearWindow),
      sideFrontLeft: quadGeometry(left.front),
      sideRearLeft: quadGeometry(left.rear),
      sideFrontRight: quadGeometry(mirroredPane(left.front)),
      sideRearRight: quadGeometry(mirroredPane(left.rear)),
      frontGrilles: [flatPolygonGeometry(mirroredOutline(GRILLE_RIGHT), -2.536), flatPolygonGeometry(GRILLE_RIGHT, -2.536)],
      frontLampHousings: SEDAN_FRONT_LIGHTS.housings.map(lamp => flatPolygonGeometry(lamp.rear, -2.541)),
      frontLowerIntake: flatPolygonGeometry([[-0.70, -0.235], [0.70, -0.235], [0.54, -0.46], [-0.54, -0.46]], -2.542),
      frontAirCurtains: [
        flatPolygonGeometry([[-0.98, -0.17], [-0.87, -0.20], [-0.90, -0.45], [-0.98, -0.43]], -2.543),
        flatPolygonGeometry([[0.98, -0.17], [0.98, -0.43], [0.90, -0.45], [0.87, -0.20]], -2.543),
      ],
      rearLampHousing: SEDAN_REAR_LIGHTS.housing.map(lamp => flatPolygonGeometry(lamp.rear, SEDAN_REAR_LIGHTS.housingZ)),
      rearLampHousingWrap: SEDAN_REAR_LIGHTS.housing.map(lamp => quadGeometry(lamp.wrap)),
      rearLampRows: SEDAN_REAR_LIGHTS.rows.map(row => flatPolygonGeometry(row.rear, SEDAN_REAR_LIGHTS.rowZ)),
      rearLampRowWrap: SEDAN_REAR_LIGHTS.rows.map(row => quadGeometry(row.wrap)),
      rearPlateInset: flatPolygonGeometry([[-0.35, -0.075], [0.35, -0.075], [0.29, -0.28], [-0.29, -0.28]], 2.548),
      rearDiffuser: flatPolygonGeometry([[-0.65, -0.53], [0.65, -0.53], [0.42, -0.35], [-0.42, -0.35]], 2.552),
      rearDiffuserSides: [
        flatPolygonGeometry([[-0.94, -0.14], [-0.69, -0.18], [-0.42, -0.35], [-0.65, -0.53], [-0.94, -0.47]], 2.551),
        flatPolygonGeometry([[0.94, -0.14], [0.94, -0.47], [0.65, -0.53], [0.42, -0.35], [0.69, -0.18]], 2.551),
      ],
    };
  }, []);
  useEffect(() => () => Object.values(geometries).flat().forEach((geometry) => geometry.dispose()), [geometries]);

  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    if (steerGroupLeft.current) steerGroupLeft.current.rotation.y = angle;
    if (steerGroupRight.current) steerGroupRight.current.rotation.y = angle;
  }, [steer]);

  /* wheelsRef 가 있으면(CarMode 주행 중) 조향과 바퀴 회전을 매 프레임 직접 읽는다.
   * props 로만 받으면(원격 차량) 위 effect 와 마지막 speed 값만 쓴다. */
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      if (steerGroupLeft.current) steerGroupLeft.current.rotation.y = angle;
      if (steerGroupRight.current) steerGroupRight.current.rotation.y = angle;
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
      {/* 낮고 긴 하체, 긴 보닛, 짧은 트렁크가 G60 계열의 후륜구동 비율을 만든다. */}
      {['hood', 'tail', 'sideSkin', 'frontDeck', 'rearDeck'].map((name) => <mesh key={name}
        userData={name === 'sideSkin' ? { part: 'sculpted-body-shell' } : undefined}
        geometry={geometries[name]} dispose={null}>
        <meshStandardMaterial color={BODY} metalness={0.38} roughness={0.36} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh geometry={geometries.floor} dispose={null}>
        <meshStandardMaterial color={BODY_DARK} metalness={0.22} roughness={0.48} />
      </mesh>
      <group userData={{ part: 'long-hood' }}>
        <PanelSeam position={[0, 0.17, -1.07]} scale={[1.42, 0.012, 0.025]} color={BODY_DARK} />
        {[-1, 1].map((side) => <group key={side}>
          <FrameBeam from={[side * 0.32, 0.190, -2.40]} to={[side * 0.36, 0.239, -2.18]}
            width={0.012} depth={0.012} color={BODY_HIGHLIGHT} />
          <FrameBeam from={[side * 0.36, 0.239, -2.18]} to={[side * 0.48, 0.319, -1.04]}
            width={0.012} depth={0.012} color={BODY_HIGHLIGHT} />
        </group>)}
      </group>

      {/* 선명한 숄더 라인과 플러시 손잡이로 긴 휠베이스를 강조한다. */}
      {[-1, 1].map((side) => <group key={side}>
        <Block userData={{ part: 'shoulder-line' }} position={[side * 1.025, 0.265, 0.12]} scale={[0.018, 0.025, 2.68]} color={BODY_HIGHLIGHT} />
        <PanelSeam position={[side * 1.026, -0.04, -0.38]} scale={[0.012, 0.42, 0.025]} color={BODY_DARK} />
        <Block position={[side * 1.026, 0.16, -0.55]} scale={[0.02, 0.035, 0.24]} color={BODY_DARK} />
        <Block position={[side * 1.026, 0.16, 0.73]} scale={[0.02, 0.035, 0.24]} color={BODY_DARK} />
      </group>)}

      {/* 사이드미러 */}
      {[-1, 1].map((side) => <group key={side} position={[side * 1.06, 0.33, -0.78]}>
        <Block scale={[0.18, 0.11, 0.16]} rotation={[0, side * 0.12, 0]} color={BODY_DARK} />
        <DetailLamp position={[side * 0.09, -0.015, -0.085]} color={TRIM} scale={0.025} />
      </group>)}

      {/* 전면: 독립 듀얼 그릴, 각진 프로젝터 램프와 넓은 하단 흡기구다. */}
      <Block position={[0, -0.16, -2.38]} scale={[1.96, 0.64, 0.30]} color={BODY} />
      <Block position={[0, -0.48, -2.50]} scale={[1.82, 0.07, 0.08]} color={BODY_DARK} />
      {[-1, 1].map((side, grilleIndex) => {
        const points = side < 0 ? mirroredOutline(GRILLE_RIGHT) : GRILLE_RIGHT;
        return <group key={side}>
        <mesh userData={{ part: 'kidney-grille' }} geometry={geometries.frontGrilles[grilleIndex]} dispose={null}>
          <meshStandardMaterial color={GRILLE} metalness={0.4} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        {points.map(([x, y], index) => {
          const [nextX, nextY] = points[(index + 1) % points.length];
          return <FrameBeam key={index} from={[x, y, -2.548]} to={[nextX, nextY, -2.548]}
            width={0.014} depth={0.012} color={TRIM} />;
        })}
        {Array.from({ length: 7 }, (_, index) => side * (0.105 + index * 0.062)).map(x => <Block key={x}
          userData={{ part: 'kidney-grille-slat' }} position={[x, -0.015, -2.550]}
          scale={[0.010, 0.21, 0.008]} color={TRIM} />)}
      </group>})}
      {SEDAN_FRONT_LIGHTS.housings.map((lamp, index) => <mesh key={lamp.side}
        userData={{ part: 'sedan-headlamp-housing' }} geometry={geometries.frontLampHousings[index]} dispose={null}>
        <meshStandardMaterial color={GRILLE} metalness={0.25} roughness={0.24} side={THREE.DoubleSide} />
      </mesh>)}
      {SEDAN_FRONT_LIGHTS.projectors.map((projector, index) => <mesh key={index}
        userData={{ part: 'sedan-projector' }} position={projector.position}>
        <circleGeometry args={[projector.radius, 20]} />
        <meshStandardMaterial color={HEAD_LAMP} emissive={HEAD_LAMP} emissiveIntensity={0.8}
          metalness={0.15} roughness={0.18} side={THREE.DoubleSide} />
      </mesh>)}
      {SEDAN_FRONT_LIGHTS.drlSegments.map((segment, index) => <mesh key={index}
        userData={{ part: 'sedan-drl-segment' }} position={segment.position} scale={segment.scale}>
        <boxGeometry />
        <meshStandardMaterial color={HEAD_LAMP} emissive={HEAD_LAMP} emissiveIntensity={0.7} roughness={0.2} />
      </mesh>)}
      {SEDAN_FRONT_LIGHTS.accents.map((accent, index) => <Block key={index} position={accent.position}
        scale={accent.scale} color="#57b6d8" />)}
      <mesh userData={{ part: 'front-lower-intake' }} geometry={geometries.frontLowerIntake} dispose={null}>
        <meshStandardMaterial color={GRILLE} metalness={0.18} roughness={0.38} side={THREE.DoubleSide} />
      </mesh>
      {[-0.29, -0.35, -0.41].map((y, index) => <PanelSeam key={y} position={[0, y, -2.551]}
        scale={[1.05 - index * 0.10, 0.010, 0.008]} color={BODY_DARK} />)}
      {geometries.frontAirCurtains.map((geometry, index) => <mesh key={index}
        userData={{ part: 'front-air-curtain' }} geometry={geometry} dispose={null}>
        <meshStandardMaterial color={GRILLE} metalness={0.14} roughness={0.42} side={THREE.DoubleSide} />
      </mesh>)}

      {/* 후면: 램프선에 붙는 트렁크 립, 두 줄 램프, 오목한 번호판과 넓은 검은 디퓨저다. */}
      <Block position={[0, -0.18, 2.38]} scale={[1.96, 0.64, 0.30]} color={BODY} />
      <Block userData={{ part: 'trunk-lip' }} position={[0, 0.145, 2.43]} scale={[1.82, 0.035, 0.16]} color={BODY_HIGHLIGHT} />
      <mesh userData={{ part: 'rear-plate-inset' }} geometry={geometries.rearPlateInset} dispose={null}>
        <meshStandardMaterial color={BODY_DARK} metalness={0.2} roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
      <Block position={[0, -0.15, 2.546]} scale={[0.42, 0.13, 0.012]} color={PLATE} />
      {SEDAN_REAR_LIGHTS.housing.map((lamp, index) => <group key={lamp.side}>
        <mesh userData={{ part: 'sedan-tail-lamp-housing' }} geometry={geometries.rearLampHousing[index]} dispose={null}>
          <meshStandardMaterial color={GRILLE} metalness={0.22} roughness={0.3} />
        </mesh>
        <mesh userData={{ part: 'sedan-tail-lamp-housing-wrap' }} geometry={geometries.rearLampHousingWrap[index]} dispose={null}>
          <meshStandardMaterial color={GRILLE} metalness={0.22} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh userData={{ part: 'rear-vertical-reflector' }} position={[lamp.side * 0.88, -0.29, 2.557]}
          scale={[0.025, 0.18, 0.012]}>
          <boxGeometry />
          <meshStandardMaterial color={TAIL_LAMP} emissive={TAIL_LAMP} emissiveIntensity={0.32} roughness={0.3} />
        </mesh>
      </group>)}
      {SEDAN_REAR_LIGHTS.rows.map((row, index) => <mesh key={index}
        userData={{ part: 'sedan-tail-lamp-row' }} geometry={geometries.rearLampRows[index]} dispose={null}>
        <meshStandardMaterial color={TAIL_LAMP} emissive={TAIL_LAMP} emissiveIntensity={0.28}
          roughness={0.24} side={THREE.DoubleSide} />
      </mesh>)}
      {SEDAN_REAR_LIGHTS.rows.map((row, index) => <mesh key={index}
        userData={{ part: 'sedan-tail-lamp-wrap' }} geometry={geometries.rearLampRowWrap[index]} dispose={null}>
        <meshStandardMaterial color={TAIL_LAMP} emissive={TAIL_LAMP} emissiveIntensity={0.28}
          roughness={0.24} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh userData={{ part: 'rear-diffuser' }} geometry={geometries.rearDiffuser} dispose={null}>
        <meshStandardMaterial color={GRILLE} metalness={0.16} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {geometries.rearDiffuserSides.map((geometry, index) => <mesh key={index} geometry={geometry} dispose={null}>
        <meshStandardMaterial color={GRILLE} metalness={0.16} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh position={[1.02, -0.15, 1.7]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 10]} />
        <meshStandardMaterial color={GRILLE} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* 머드플랩, 뒷바퀴 뒤쪽 */}
      {[-1, 1].map((side) => <Block key={side} position={[side * TRACK_X, -0.75, REAR_Z + 0.42]} scale={[0.32, 0.22, 0.02]} rotation={[0.15, 0, 0]} color={TIRE} />)}
    </StaticBatch>

    {/* 캐빈, firstPerson 이면 숨긴다(실내 모델이 대신 그린다) */}
    <group visible={!firstPerson} userData={{ part: 'camera-intersection' }}>
      <StaticBatch>
        {/* 캐빈은 뒤로 물리고 지붕을 낮춰 긴 보닛과 완만한 패스트백 비율을 살린다. */}
        <mesh geometry={geometries.roofShell} dispose={null}>
          <meshStandardMaterial color={BODY_DARK} metalness={0.34} roughness={0.38} />
        </mesh>
        <mesh userData={{ part: 'panoramic-roof' }} geometry={geometries.roofInset} dispose={null}>
          <meshStandardMaterial color="#111d24" metalness={0.45} roughness={0.16} />
        </mesh>
        {['windshield', 'rearWindow', 'sideFrontLeft', 'sideRearLeft', 'sideFrontRight', 'sideRearRight'].map((name) =>
          <mesh key={name} geometry={geometries[name]} dispose={null}>
            <meshStandardMaterial color={GLASS} metalness={0.18} roughness={0.16} transparent opacity={GLASS_OPACITY} side={THREE.DoubleSide} />
          </mesh>)}
        {[-1, 1].map((side) => {
          const mirror = ([x, y, z]) => [side < 0 ? x : -x, y, z];
          const front = SHAPE.sideWindows.left.front, rear = SHAPE.sideWindows.left.rear;
          return <group key={side}>
            <FrameBeam from={mirror(front[0])} to={mirror(front[1])} />
            <FrameBeam from={mirror(front[3])} to={mirror(front[2])} width={0.05} />
            <FrameBeam from={mirror(rear[3])} to={mirror(rear[2])} width={0.065} depth={0.09} />
            <FrameBeam from={mirror(front[1])} to={mirror(front[2])} width={0.045} depth={0.07} />
            <FrameBeam from={mirror(front[2])} to={mirror(rear[1])} width={0.045} depth={0.07} />
            <FrameBeam from={mirror(rear[1])} to={mirror(rear[2])} width={0.045} depth={0.07} />
          </group>;
        })}

      </StaticBatch>
    </group>

    {/* 앞바퀴, 조향 group 안에 넣는다. 캘리퍼는 앞바퀴에만 단다. 조향과 회전이 걸리므로 정적 병합에서 뺀다 */}
    <group ref={steerGroupLeft} position={[-TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true, part: 'wheel-hub', axle: 'front' }}>
      <group ref={frontLeftWheel}><Wheel radius={WHEEL_RADIUS} brake spokes={5} spokeColor={TRIM} /></group>
    </group>
    <group ref={steerGroupRight} position={[TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true, part: 'wheel-hub', axle: 'front' }}>
      <group ref={frontRightWheel}><Wheel radius={WHEEL_RADIUS} brake spokes={5} spokeColor={TRIM} /></group>
    </group>
    {/* 뒷바퀴. 회전만 걸리지만 같은 이유로 뺀다 */}
    <group position={[-TRACK_X, WHEEL_Y, REAR_Z]} userData={{ dynamic: true, part: 'wheel-hub', axle: 'rear' }}>
      <group ref={rearLeftWheel}><Wheel radius={WHEEL_RADIUS} spokes={5} spokeColor={TRIM} /></group>
    </group>
    <group position={[TRACK_X, WHEEL_Y, REAR_Z]} userData={{ dynamic: true, part: 'wheel-hub', axle: 'rear' }}>
      <group ref={rearRightWheel}><Wheel radius={WHEEL_RADIUS} spokes={5} spokeColor={TRIM} /></group>
    </group>
  </group>;
}
