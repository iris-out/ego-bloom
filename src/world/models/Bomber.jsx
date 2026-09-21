import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { PLANE_DIMENSIONS } from './planeDimensions.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 폭격기다. Jet 과 같은 규약을 지킨다. 원점은 동체 중심, 코는 -Z, 날개는 X,
 * 바퀴 바닥은 약 -1.9 라서 FLIGHT_GROUND=2.1 이면 활주로에 닿는다.
 * 외곽 치수는 planeDimensions 가 정한다. 실루엣을 다듬어도 그 숫자는 바꾸지 않는다.
 *
 * 폭탄창은 동체 아래 문 두 짝이다. bay 가 0 이면 닫혀 있고 1 이면 완전히 열린다.
 * 문이 열리면 안쪽 격벽과 걸려 있는 폭탄이 보인다. 실제 투하는 weapons.js 가 맡는다.
 *
 * firstPerson 이면 조종석 캐노피와 그 구간 동체를 숨긴다. 폭격수석 유리는 코 쪽이라 남는다.
 */
const HALF_PI = Math.PI / 2;
const HALF_SPAN = PLANE_DIMENSIONS.bomber.span / 2;

const SKIN = '#8f9ba2', SKIN_DARK = '#6e7a82', PANEL = '#5b666d';
const GLASS = '#4a6f80', METAL = '#3d4a50', BAY = '#23292d', BOMB = '#4d5a46';

/** 문이 열리는 각이다. 90도까지 열면 날개 아래로 튀어나와 보인다. */
const DOOR_OPEN = 1.35;
/** 문이 따라 움직이는 속도다. 초당 감쇠 계수이며 클수록 빨리 열린다. */
const DOOR_RATE = 6;
const MAX_STEP = 0.05;

/** 네 발 엔진의 좌우 위치다. 안쪽 두 발이 동체에 가깝다. hardpoints 의 노즐과 같이 움직인다. */
const ENGINE_X = [2.9, 5.6];

/** 동체 프로파일에 이미 있는 두 점([-6.4], [-3.4])을 경계로 쓴다. 눈 [-0.46,1.35,-5.6] 가
 * 그 사이를 지나 반지름 약 1.44 로 감싸므로 보간 없이 그대로 자를 수 있다. */
const CABIN_NOSE_Z = -6.4, CABIN_TAIL_Z = -3.4;
/** [반지름, z] 프로파일이다. 코에서 꼬리로 늘어놓는다. */
const FUSELAGE_PROFILE = [
  [0.12, -11.2], [0.72, -10.2], [1.15, -8.6], [1.42, -6.4], [1.5, -3.4],
  [1.5, 2.0], [1.38, 5.4], [1.1, 8.0], [0.66, 10.2], [0.18, 11.4],
];
const NOSE_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z <= CABIN_NOSE_Z);
const CABIN_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_NOSE_Z && z <= CABIN_TAIL_Z);
const REAR_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_TAIL_Z);

function latheOf(profile) {
  const points = profile.map(([radius, z]) => new THREE.Vector2(radius, z));
  const geometry = new THREE.LatheGeometry(points, 16);
  geometry.rotateX(HALF_PI);
  geometry.computeVertexNormals();
  return geometry;
}

export default function Bomber({ glowRef, bay = 0, firstPerson = false }) {
  const doors = useRef([]);
  const open = useRef(0);

  /** 동체를 코, 조종석, 꼬리 세 조각으로 나눈다. 조종석 조각만 캐빈이다. */
  const fuselageNose = useMemo(() => latheOf(NOSE_PROFILE), []);
  const fuselageCabin = useMemo(() => latheOf(CABIN_PROFILE), []);
  const fuselageRear = useMemo(() => latheOf(REAR_PROFILE), []);

  /** 주익이다. 뿌리가 두껍고 끝으로 갈수록 좁아지는 사다리꼴이다. */
  const wing = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.4, -3.2); shape.lineTo(HALF_SPAN, -0.6);
    shape.lineTo(HALF_SPAN, 1.2); shape.lineTo(1.4, 3.4);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    // shape 의 x 가 날개 span, y 가 기체 z 다. 두께가 Y 로 서게 눕힌다.
    geometry.rotateX(HALF_PI);
    geometry.translate(0, 0.25, 0);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  /** 수평 미익이다. 주익과 같은 방식으로 만든다. */
  const stabilizer = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.8, 8.2); shape.lineTo(5.4, 9.6);
    shape.lineTo(5.4, 10.6); shape.lineTo(0.8, 11.0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false });
    geometry.rotateX(HALF_PI);
    geometry.translate(0, 0.14, 0);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  useEffect(() => () => {
    fuselageNose.dispose(); fuselageCabin.dispose(); fuselageRear.dispose(); wing.dispose(); stabilizer.dispose();
  }, [fuselageNose, fuselageCabin, fuselageRear, wing, stabilizer]);

  /* glowRef 가 있으면(FlightMode 조종 중) bay 를 매 프레임 직접 읽는다. */
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP);
    const live = glowRef?.current;
    const target = Math.max(0, Math.min(1, Number(live ? live.bay : bay) || 0));
    open.current += (target - open.current) * Math.min(1, step * DOOR_RATE);
    for (const [index, door] of doors.current.entries()) {
      if (!door) continue;
      // 문 두 짝이 바깥으로 벌어진다. 왼쪽은 -Z 축, 오른쪽은 +Z 축으로 돈다.
      door.rotation.z = (index === 0 ? 1 : -1) * open.current * DOOR_OPEN;
    }
  });

  return <group>
    <StaticBatch>
      <mesh geometry={fuselageNose} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN} metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh geometry={fuselageRear} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN} metalness={0.2} roughness={0.5} />
      </mesh>

      {/* 유리 폭격수석. 코 쪽이라 조종석보다 앞부분에 남는다. */}
      <mesh position={[0, 0.35, -9.4]} scale={[1.05, 0.85, 1.5]} castShadow>
        <sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color={GLASS} metalness={0.35} roughness={0.2} />
      </mesh>
      <PanelSeam position={[0, 1.0, 1.8]} scale={[0.75, 0.025, 5.5]} color={PANEL} />

      {/* 주익. 동체 어깨에 붙는 고익이다. */}
      {[1, -1].map((side) => <mesh key={side} geometry={wing} scale={[side, 1, 1]} position={[0, 0.75, 0]} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN_DARK} roughness={0.58} side={THREE.DoubleSide} />
      </mesh>)}

      {/* 수직 미익 하나와 수평 미익 두 장 */}
      <Block position={[0, 2.6, 9.8]} scale={[0.3, 4.2, 3.2]} color={PANEL} rotation={[-0.22, 0, 0]} />
      {[1, -1].map((side) => <mesh key={side} geometry={stabilizer} scale={[side, 1, 1]} position={[0, 0.5, 0]} castShadow dispose={null}>
        <meshStandardMaterial color={PANEL} roughness={0.58} side={THREE.DoubleSide} />
      </mesh>)}

      {/* 네 발 엔진. 나셀, 배기구, 파일런이다. */}
      {[1, -1].flatMap((side) => ENGINE_X.map((x) => <group key={`${side}-${x}`} position={[side * x, 0.45, 0.4]}>
        <Block position={[0, 0.2, -0.6]} scale={[0.34, 0.5, 1.2]} color={SKIN_DARK} />
        <mesh position={[0, -0.2, 0.1]} rotation={[HALF_PI, 0, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.7, 3.4, 14]} /><meshStandardMaterial color={SKIN} metalness={0.3} roughness={0.42} />
        </mesh>
        <mesh position={[0, -0.2, 1.82]} rotation={[HALF_PI, 0, 0]}>
          <circleGeometry args={[0.5, 14]} /><meshStandardMaterial color={METAL} />
        </mesh>
        <SurfaceVent position={[0, 0.12, 0.35]} scale={[0.52, 0.018, 0.08]} />
      </group>))}

      {/* 폭탄창. 격벽과 폭탄 네 발이 문 안쪽에 보인다. */}
      <Block position={[0, -1.12, -0.6]} scale={[1.9, 0.12, 6.4]} color={BAY} />
      {[-2.2, -0.7, 0.8, 2.3].map((z) => <mesh key={z} position={[0, -1.02, z]} rotation={[HALF_PI, 0, 0]} castShadow>
        <capsuleGeometry args={[0.24, 1.0, 4, 8]} /><meshStandardMaterial color={BOMB} roughness={0.7} />
      </mesh>)}
      {/* 문 두 짝. 경첩이 바깥쪽 모서리라 그 자리를 회전축으로 삼는다. 여닫히므로 정적 병합에서 뺀다 */}
      {[0, 1].map((index) => <group key={index} ref={(node) => { doors.current[index] = node; }}
        position={[(index === 0 ? -1 : 1) * 0.95, -1.18, -0.6]} userData={{ dynamic: true }}>
        <Block position={[(index === 0 ? 1 : -1) * 0.48, 0, 0]} scale={[0.96, 0.1, 6.4]} color={SKIN_DARK} />
      </group>)}

      {/* 주 랜딩기어는 안쪽 엔진 나셀 아래, 앞바퀴는 코 밑이다. */}
      {[1, -1].map((side) => <group key={`gear${side}`}>
        <Block position={[side * 2.9, -1.15, 0.9]} scale={[0.2, 1.5, 0.2]} color="#78898c" />
        {[-0.3, 0.3].map((offset) => <mesh key={offset} position={[side * 2.9 + offset, -1.62, 0.9]} rotation={[0, 0, HALF_PI]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.26, 10]} /><meshStandardMaterial color={METAL} />
        </mesh>)}
        {/* 날개끝 항법등. 왼쪽이 붉고 오른쪽이 녹색이다. */}
        <Block position={[side * (HALF_SPAN - 0.5), 0.85, 0.4]} scale={[0.4, 0.18, 1.1]} color={side < 0 ? '#bd7467' : '#78a987'} />
        <DetailLamp position={[side * (HALF_SPAN - 0.5), 1.0, 0.28]} color={side < 0 ? '#ff3b30' : '#35d072'} scale={0.07} />
      </group>)}
      <Block position={[0, -1.2, -8.2]} scale={[0.18, 1.4, 0.18]} color="#78898c" />
      <mesh position={[0, -1.66, -8.2]} rotation={[0, 0, HALF_PI]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.24, 10]} /><meshStandardMaterial color={METAL} />
      </mesh>
    </StaticBatch>
    {/* 조종석 캐노피와 그 구간 동체. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
    <group visible={!firstPerson}>
      <StaticBatch>
        <mesh geometry={fuselageCabin} castShadow dispose={null}>
          <meshStandardMaterial color={SKIN} metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.32, -5.6]} scale={[1.1, 0.62, 2.4]} castShadow>
          <sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color={GLASS} metalness={0.35} roughness={0.2} />
        </mesh>
      </StaticBatch>
    </group>
  </group>;
}
