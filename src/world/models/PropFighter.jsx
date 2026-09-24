import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { fuselageGeometry, airfoilGeometry } from './vehicleSurfaces.js';
import { Airfoil, CanopyFrame } from './SurfaceParts.jsx';
import { PLANE_DIMENSIONS } from './planeDimensions.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 프로펠러 전투기다. Jet 과 같은 규약을 지킨다. 원점은 동체 중심, 코는 -Z, 날개는 X,
 * 바퀴 바닥은 약 -1.9 다. 외곽 치수는 planeDimensions 가 정한다.
 *
 * 프로펠러는 스로틀에 따라 돈다. 빠르게 돌면 날이 원판으로 보이므로 날 세 장과
 * 반투명 원판을 함께 두고 회전수에 따라 원판의 불투명도를 올린다.
 *
 * firstPerson 이면 버블 캐노피와 동체 조종석 구간을 숨긴다. 3인칭 실루엣은 그대로다.
 */
const HALF_PI = Math.PI / 2;
const HALF_SPAN = PLANE_DIMENSIONS.prop.span / 2;

/** 동체 프로파일에 이미 있는 두 점([-1.8], [0.4])을 경계로 쓴다. 눈 [0,0.62,-0.7] 이
 * 그 사이를 지나 반지름 약 0.81 로 감싸므로 보간 없이 그대로 자를 수 있다. */
const CABIN_NOSE_Z = -1.8, CABIN_TAIL_Z = 0.4;

const SKIN = '#5c6f62', SKIN_DARK = '#47564c', TRIM = '#c9a227';
const METAL = '#38424a', RUBBER = '#2c3338';

/** 프로펠러 회전 속도다. 공회전에서도 돌고 스로틀 1 에서 가장 빠르다(rad/s). */
const PROP_IDLE = 9, PROP_MAX = 58;
/** 원판이 완전히 불투명해지는 회전 속도다. 이보다 느리면 날이 하나씩 보인다. */
const DISC_FULL = 40;
const BLADES = [0, 1, 2];
const MAX_STEP = 0.05;

/** [반지름, z] 프로파일이다. 코에서 꼬리로 늘어놓는다. */
const FUSELAGE_PROFILE = [
  [0.34, -4.9], [0.62, -4.4], [0.78, -3.4], [0.82, -1.8],
  [0.8, 0.4], [0.66, 2.2], [0.46, 3.6], [0.22, 4.7],
];
const NOSE_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z <= CABIN_NOSE_Z);
const CABIN_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_NOSE_Z && z <= CABIN_TAIL_Z);
const REAR_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_TAIL_Z);

function latheOf(profile) {
  return fuselageGeometry(FUSELAGE_PROFILE, profile[0][1], profile.at(-1)[1], 1);
}

export default function PropFighter({ glowRef, throttle = 0, phase = 'runway', firstPerson = false }) {
  const hub = useRef();
  const disc = useRef();

  /** 동체를 코, 조종석, 꼬리 세 조각으로 나눈다. 조종석 조각만 캐빈이다. */
  const fuselageNose = useMemo(() => latheOf(NOSE_PROFILE), []);
  const fuselageCabin = useMemo(() => latheOf(CABIN_PROFILE), []);
  const fuselageRear = useMemo(() => latheOf(REAR_PROFILE), []);

  /** 타원형 주익이다. 뿌리에서 끝까지 앞뒤가 함께 좁아진다. */
  const wing = useMemo(() => airfoilGeometry([{x:.5,front:-1.5,back:1.6,thickness:.35},{x:2.8,front:-1.37,back:1.38,thickness:.26},{x:4.9,front:-.92,back:.95,thickness:.15},{x:HALF_SPAN,front:-.35,back:.35,thickness:.045,y:.15}]), []);

  const blade = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.12, 0); shape.lineTo(-0.07, 1.5); shape.lineTo(0.07, 1.5); shape.lineTo(0.12, 0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    geometry.center();
    geometry.translate(0, 0.75, 0);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  useEffect(() => () => {
    fuselageNose.dispose(); fuselageCabin.dispose(); fuselageRear.dispose(); wing.dispose(); blade.dispose();
  }, [fuselageNose, fuselageCabin, fuselageRear, wing, blade]);

  /* glowRef 가 있으면(FlightMode 조종 중) throttle/phase 를 매 프레임 직접 읽는다. */
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP);
    const live = glowRef?.current;
    const liveThrottle = live ? live.throttle : throttle, livePhase = live ? live.phase : phase;
    // 추락하면 프로펠러가 멈춘다. 멈춘 기체가 계속 도는 것보다 낫다.
    const spin = livePhase === 'crashed' ? 0 : PROP_IDLE + Math.max(0, Math.min(1, Number(liveThrottle) || 0)) * (PROP_MAX - PROP_IDLE);
    if (hub.current) hub.current.rotation.z += spin * step;
    // 재질은 마운트 뒤에 붙는다. 첫 프레임에 없을 수 있으므로 있는지 본다.
    if (disc.current?.material) disc.current.material.opacity = Math.min(0.5, (spin / DISC_FULL) * 0.5);
  });

  return <group>
    <StaticBatch>
      <mesh geometry={fuselageNose} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN} metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh geometry={fuselageRear} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN} metalness={0.25} roughness={0.5} />
      </mesh>

      {/* 스피너와 프로펠러. 날 세 장과 회전 원판이 같은 축에 있다. */}
      <mesh position={[0, 0, -5.05]} rotation={[-HALF_PI, 0, 0]} castShadow>
        <coneGeometry args={[0.34, 0.8, 12]} /><meshStandardMaterial color={TRIM} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* 회전판과 회전 원판. 스로틀로 계속 돌고 불투명도가 바뀌므로 정적 병합에서 뺀다 */}
      <group ref={hub} position={[0, 0, -5.2]} userData={{ dynamic: true }}>
        {BLADES.map((index) => <mesh key={index} geometry={blade} rotation={[0, 0, (index * Math.PI * 2) / 3]} dispose={null}>
          <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>)}
      </group>
      <mesh ref={disc} position={[0, 0, -5.24]} rotation={[HALF_PI, 0, 0]} userData={{ dynamic: true }}>
        <circleGeometry args={[1.5, 20]} />
        <meshBasicMaterial color="#b8c2c6" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <PanelSeam position={[0, 0.44, 1.3]} scale={[0.58, 0.018, 2.2]} color={SKIN_DARK} />
      <SurfaceVent position={[0, 0.04, -3.3]} scale={[0.48, 0.02, 0.08]} />

      {/* 주익과 기관총. 총구는 hardpoints 의 좌표와 같이 움직인다. */}
      {[1, -1].map((side) => <group key={side}>
        <mesh geometry={wing} scale={[side, 1, 1]} position={[0, -0.25, -0.4]} castShadow dispose={null}>
          <meshStandardMaterial color={SKIN_DARK} roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        {[1.9, 2.6].map((x) => <mesh key={x} position={[side * x, -0.18, -2.0]} rotation={[HALF_PI, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.9, 8]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.35} />
        </mesh>)}
        {/* 고정식 주 랜딩기어. 다리와 바퀴, 페어링이다. */}
        <Block position={[side * 1.5, -0.95, -0.9]} scale={[0.14, 1.1, 0.16]} color="#7d8a86" />
        <mesh position={[side * 1.5, -1.62, -0.9]} rotation={[0, 0, HALF_PI]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 10]} /><meshStandardMaterial color={RUBBER} />
        </mesh>
        {/* 날개끝 항법등 */}
        <Block position={[side * (HALF_SPAN - 0.3), -0.1, -0.4]} scale={[0.26, 0.12, 0.7]} color={side < 0 ? '#bd7467' : '#78a987'} />
        {/* 코 옆 배기관 여섯 개 */}
        {[-3.6, -3.2, -2.8].map((z) => <Block key={z} position={[side * 0.8, 0.12, z]} scale={[0.12, 0.12, 0.22]} color={METAL} />)}
        <DetailLamp position={[side * (HALF_SPAN - 0.3), -0.02, -0.4]} color={side < 0 ? '#ff3b30' : '#35d072'} scale={0.055} />
      </group>)}

      {/* 꼬리 날개와 꼬리 바퀴 */}
      <Airfoil color={SKIN_DARK} rotation={[0,0,Math.PI/2]} stations={[{x:0,front:2.65,back:4.5,thickness:.18},{x:1.3,front:3.25,back:4.6,thickness:.12},{x:1.8,front:3.8,back:4.4,thickness:.06}]}/>
      {[-1,1].map(side=><Airfoil key={side} position={[0,.1,0]} scale={[side,1,1]} color={SKIN_DARK} stations={[{x:.2,front:3.3,back:4.5,thickness:.16},{x:1.4,front:3.5,back:4.4,thickness:.1},{x:1.8,front:3.8,back:4.2,thickness:.035}]}/>)}

      <Block position={[0, -1.25, 4.2]} scale={[0.1, 0.7, 0.1]} color="#7d8a86" />
      <mesh position={[0, -1.66, 4.2]} rotation={[0, 0, HALF_PI]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.16, 8]} /><meshStandardMaterial color={RUBBER} />
      </mesh>
    </StaticBatch>
    {/* 버블 캐노피와 조종석 구간 동체. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
    <group visible={!firstPerson}>
      <StaticBatch>
        <mesh geometry={fuselageCabin} castShadow dispose={null}>
          <meshStandardMaterial color={SKIN} metalness={0.25} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.62, -0.6]} scale={[0.6, 0.52, 1.3]} castShadow>
          <sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#1c3542" metalness={0.12} roughness={0.2} />
        </mesh>
      <CanopyFrame position={[0,.62,-.6]} rx={0.6} ry={0.52} rz={1.3} color="#45545e"/>
      </StaticBatch>
    </group>
  </group>;
}
