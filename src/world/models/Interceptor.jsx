import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import Block from './ModelBlock';
import { fuselageGeometry, airfoilGeometry } from './vehicleSurfaces.js';
import { Airfoil, Duct, CanopyFrame } from './SurfaceParts.jsx';
import { PLANE_DIMENSIONS } from './planeDimensions.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 요격기다. Me 262 의 실루엣을 따른다. 삼각 단면의 상어코 동체, 얕게 뒤로 젖힌 주익,
 * 주익 밑에 매단 나셀 두 개, 뒤로 물러난 수직 미익과 높이 달린 수평 미익이다.
 * Jet 과 같은 규약을 지킨다. 원점은 동체 중심, 코는 -Z, 날개는 X, 바퀴 바닥은 약 -1.9 다.
 * 외곽 치수는 planeDimensions 가 정한다.
 * firstPerson 이면 캐노피와 동체 조종석 구간을 숨긴다. 앞유리 틀은 앞부분에 남는다.
 */
const HALF_PI = Math.PI / 2;
const HALF_SPAN = PLANE_DIMENSIONS.interceptor.span / 2;

const SKIN = '#6c757a', SKIN_DARK = '#525c61', BELLY = '#8a949a';
const METAL = '#333c42', GUN = '#20262a';

/** 동체 프로파일의 두 점([-3.4], [-0.6])을 경계로 쓴다. 눈 [0,0.86,-2.4] 와 실내 계기판(z 약 -3.2)
 * 이 그 사이에 든다. 경계를 -2.6 에 두면 코 껍데기 윗면이 1인칭 계기판 아랫줄을 덮는다.
 * [-3.4] 점은 [-4.0]과 [-2.6] 을 잇는 직선 위라 실루엣이 바뀌지 않는다. */
const CABIN_NOSE_Z = -3.4, CABIN_TAIL_Z = -0.6;
/** [반지름, z] 프로파일이다. 코에서 꼬리로 늘어놓는다. */
const FUSELAGE_PROFILE = [
  [0.08, -5.6], [0.42, -5.0], [0.66, -4.0], [0.7114, -3.4], [0.78, -2.6], [0.8, -0.6],
  [0.74, 1.2], [0.6, 2.8], [0.42, 4.1], [0.16, 5.2],
];
const NOSE_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z <= CABIN_NOSE_Z);
const CABIN_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_NOSE_Z && z <= CABIN_TAIL_Z);
const REAR_PROFILE = FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_TAIL_Z);

function latheOf(profile) {
  return fuselageGeometry(FUSELAGE_PROFILE, profile[0][1], profile.at(-1)[1], .92);
}

export default function Interceptor({ firstPerson = false }) {
  /** 동체를 코, 조종석, 꼬리 세 조각으로 나눈다. 조종석 조각만 캐빈이다. */
  const fuselageNose = useMemo(() => latheOf(NOSE_PROFILE), []);
  const fuselageCabin = useMemo(() => latheOf(CABIN_PROFILE), []);
  const fuselageRear = useMemo(() => latheOf(REAR_PROFILE), []);

  /** 주익이다. 앞전이 뒤로 젖혀져 있고 끝으로 갈수록 좁아진다. */
  const wing = useMemo(() => airfoilGeometry([{x:.65,front:-1.3,back:1.6,thickness:.29},{x:1.25,front:-1.05,back:1.6,thickness:.27},{x:HALF_SPAN,front:.7,back:1.5,thickness:.07,y:.1}]), []);

  /** 수평 미익이다. 주익과 같은 방식이고 수직 미익 중간 높이에 붙는다. */
  const stabilizer = useMemo(() => airfoilGeometry([{x:.3,front:3.6,back:5,thickness:.18},{x:2.6,front:4.3,back:4.9,thickness:.055}]), []);

  useEffect(() => () => {
    fuselageNose.dispose(); fuselageCabin.dispose(); fuselageRear.dispose(); wing.dispose(); stabilizer.dispose();
  }, [fuselageNose, fuselageCabin, fuselageRear, wing, stabilizer]);

  return <group>
    <StaticBatch>
      <mesh geometry={fuselageNose} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN} metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh geometry={fuselageRear} castShadow dispose={null}>
        <meshStandardMaterial color={SKIN} metalness={0.35} roughness={0.42} />
      </mesh>
      {/* 배 아래 밝은 도장. 위아래 색이 나뉜 실제 도장을 따른다. */}
      <Block position={[0, -0.66, -0.6]} scale={[1.0, 0.2, 6.4]} color={BELLY} />
      <PanelSeam position={[0, 0.48, 0.25]} scale={[0.5, 0.018, 3.4]} color={SKIN_DARK} />

      {/* 기수 2연장 기관포. 두 포신은 100m 앞 중심선을 향해 안쪽으로 튼다. */}
      {[-1, 1].map((side) => <group key={side} position={[side * 0.3, 0.1, -4.75]} rotation={[0, side * Math.atan2(0.3, 100 - 4.75), 0]}>
        <mesh rotation={[HALF_PI, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.7, 8]} /><meshStandardMaterial color={GUN} metalness={0.5} roughness={0.4} />
        </mesh>
      </group>)}


      {/* 주익과 엔진 나셀. 나셀은 날개 밑에 매달리고 앞쪽에 흡입구가 열려 있다. */}
      {[1, -1].map((side) => <group key={side}>
        <mesh geometry={wing} scale={[side, 1, 1]} position={[0, -0.16, 0]} castShadow dispose={null}>
          <meshStandardMaterial color={SKIN_DARK} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <Duct position={[side*2.2,-.5,.4]} radius={.48} length={3.1} color={SKIN}/>
        <SurfaceVent position={[side * 2.2, -0.5, 1.05]} scale={[0.34, 0.018, 0.08]} />
        {/* 주 랜딩기어. 나셀 안쪽 날개 밑이다. */}
        <Block position={[side * 1.25, -1.0, -0.4]} scale={[0.12, 1.0, 0.14]} color="#7d8a86" />
        <mesh position={[side * 1.25, -1.6, -0.4]} rotation={[0, 0, HALF_PI]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 10]} /><meshStandardMaterial color={METAL} />
        </mesh>
        {/* 날개끝 항법등 */}
        <Block position={[side * (HALF_SPAN - 0.25), -0.14, 0.9]} scale={[0.22, 0.1, 0.6]} color={side < 0 ? '#bd7467' : '#78a987'} />
        <DetailLamp position={[side * (HALF_SPAN - 0.25), -0.02, 0.9]} color={side < 0 ? '#ff3b30' : '#35d072'} scale={0.055} />
        <mesh geometry={stabilizer} scale={[side, 1, 1]} position={[0, 1.0, 0]} castShadow dispose={null}>
          <meshStandardMaterial color={SKIN_DARK} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>)}

      {/* 수직 미익. 뒤로 물러나 있고 위가 좁다. */}
      <Airfoil color={SKIN_DARK} rotation={[0,0,Math.PI/2]} stations={[{x:0,front:3.45,back:5.2,thickness:.18},{x:2,front:4.4,back:5.25,thickness:.055}]}/>

      {/* 앞바퀴. 삼점식이라 코 밑에 하나 더 있다. */}
      <Block position={[0, -1.05, -3.5]} scale={[0.11, 1.1, 0.12]} color="#7d8a86" />
      <mesh position={[0, -1.6, -3.5]} rotation={[0, 0, HALF_PI]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.18, 10]} /><meshStandardMaterial color={METAL} />
      </mesh>
    </StaticBatch>
    {/* 캐노피와 조종석 구간 동체. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
    <group visible={!firstPerson}>
      <StaticBatch>
      {/* 앞유리 틀. 눈 앞 0.5m 아래 10~35도를 채워 1인칭 계기판을 통째로 가리므로 캐빈과 함께 숨긴다 */}
      <Block position={[0, 0.66, -2.9]} scale={[0.3, 0.24, 0.1]} color={SKIN_DARK} />
        <mesh geometry={fuselageCabin} castShadow dispose={null}>
          <meshStandardMaterial color={SKIN} metalness={0.35} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.62, -1.9]} scale={[0.44, 0.4, 1.1]} castShadow>
          <sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#1c3542" metalness={0.12} roughness={0.2} />
        </mesh>
      <CanopyFrame position={[0,.62,-1.9]} rx={0.44} ry={0.4} rz={1.1} color="#45545e"/>
      </StaticBatch>
    </group>
  </group>;
}
