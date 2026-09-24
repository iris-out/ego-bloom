import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import Block from './ModelBlock';
import { fuselageGeometry, airfoilGeometry } from './vehicleSurfaces.js';
import { Airfoil, Duct, CanopyFrame } from './SurfaceParts.jsx';
import { FUSELAGE_PROFILE, PLANE_DIMENSIONS, WING_THICKNESS } from './planeDimensions.js';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** Shared visual model for parked, local and remote aircraft.
 * Local origin: fuselage center; +Y up, nose toward -Z, wings span X.
 * Parent owns world position and YXZ attitude. Keep controls/networking out of here.
 * Wheel bottoms are about -1.9: FLIGHT_GROUND=2.1 places them on the runway.
 * Outer dimensions live in planeDimensions.js and must not change: Airport.jsx
 * parking and flightPhysics.js collision margins depend on them.
 * See ../README.md before changing the silhouette.
 * firstPerson 이면 눈을 감싸는 캐노피와 동체 조종석 구간을 숨긴다. 3인칭 실루엣은 그대로다.
 */
const HALF_SPAN = PLANE_DIMENSIONS.jet.span / 2;

/** 눈 [0,1.02,-3.4] 이 지나는 동체 구간을 잘라내는 경계다. 조종석 구간만 캐빈으로 두고
 * 코와 꼬리는 앞부분에 남긴다. eyePoints.EYE_POINTS.jet 을 바꾸면 이 값도 다시 본다. */
const CABIN_NOSE_Z = -4.4, CABIN_TAIL_Z = -2.4;

/** FUSELAGE_PROFILE 두 점 사이를 선형 보간한다. lathe 프로파일 자체가 직선 구간이라
 * 경계에 점을 끼워 넣어도 실루엣이 바뀌지 않는다. */
function radiusAt(z) {
  for (let i = 0; i < FUSELAGE_PROFILE.length - 1; i++) {
    const [r0, z0] = FUSELAGE_PROFILE[i], [r1, z1] = FUSELAGE_PROFILE[i + 1];
    if (z >= z0 && z <= z1) return r0 + (r1 - r0) * (z - z0) / (z1 - z0);
  }
  return FUSELAGE_PROFILE[FUSELAGE_PROFILE.length - 1][0];
}
const CABIN_NOSE_R = radiusAt(CABIN_NOSE_Z), CABIN_TAIL_R = radiusAt(CABIN_TAIL_Z);
const NOSE_PROFILE = [...FUSELAGE_PROFILE.filter(([, z]) => z <= CABIN_NOSE_Z), [CABIN_NOSE_R, CABIN_NOSE_Z]];
const CABIN_PROFILE = [[CABIN_NOSE_R, CABIN_NOSE_Z], ...FUSELAGE_PROFILE.filter(([, z]) => z > CABIN_NOSE_Z && z < CABIN_TAIL_Z), [CABIN_TAIL_R, CABIN_TAIL_Z]];
const REAR_PROFILE = [[CABIN_TAIL_R, CABIN_TAIL_Z], ...FUSELAGE_PROFILE.filter(([, z]) => z >= CABIN_TAIL_Z)];

function latheOf(profile) {
  return fuselageGeometry(FUSELAGE_PROFILE, profile[0][1], profile.at(-1)[1], 1);
}

export default function Jet({ firstPerson = false }) {
  /** 동체를 코, 조종석, 꼬리 세 조각으로 나눈다. 조종석 조각만 캐빈이다. */
  const fuselageNose = useMemo(() => latheOf(NOSE_PROFILE), []);
  const fuselageCabin = useMemo(() => latheOf(CABIN_PROFILE), []);
  const fuselageRear = useMemo(() => latheOf(REAR_PROFILE), []);

  /** 날개는 앞이 두껍고 뒤가 얇은 익형 단면이다. 뿌리에서 끝으로 갈수록 좁아진다. */
  const wing = useMemo(() => airfoilGeometry([{x:1,front:-2.2,back:2.7,thickness:WING_THICKNESS.root},{x:HALF_SPAN*.45,front:1.4,back:3.6,thickness:.28,y:.09},{x:HALF_SPAN,front:3,back:4.5,thickness:WING_THICKNESS.tip,y:.18}]), []);

  useEffect(() => () => {
    fuselageNose.dispose(); fuselageCabin.dispose(); fuselageRear.dispose(); wing.dispose();
  }, [fuselageNose, fuselageCabin, fuselageRear, wing]);

  return <group>
    <StaticBatch>
      <mesh geometry={fuselageNose} castShadow dispose={null}>
        <meshStandardMaterial color="#ebe8df" metalness={0.15} roughness={0.45} />
      </mesh>
      <mesh geometry={fuselageRear} castShadow dispose={null}>
        <meshStandardMaterial color="#ebe8df" metalness={0.15} roughness={0.45} />
      </mesh>
      <PanelSeam position={[0, 0.55, -1.55]} scale={[0.42, 0.018, 1.35]} color="#b7b9b0" />
      <SurfaceVent position={[0, -0.58, -2.25]} scale={[0.6, 0.022, 0.1]} rotation={[0, 0, 0]} />
      {[1, -1].map((side) => <mesh key={side} geometry={wing} scale={[side, 1, 1]} castShadow dispose={null}>
        <meshStandardMaterial color="#deded4" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>)}
      {/* 수직 미익과 수평 미익 */}
      <Airfoil color="#628e9b" rotation={[0,0,Math.PI/2]} stations={[{x:.15,front:2.2,back:5.6,thickness:.24},{x:3.08,front:4.55,back:5.72,thickness:.075}]}/>
      {[-1,1].map(side => <Airfoil key={side} position={[0,.55,0]} scale={[side,1,1]} color="#628e9b" stations={[{x:.15,front:3.65,back:5.2,thickness:.22},{x:3.25,front:4.3,back:5.25,thickness:.06}]}/>)}
      {[-1, 1].map((side) => <group key={side}>
        {/* 엔진을 파일런으로 날개 밑에 매단다. hardpoints.js 의 노즐 좌표와 같이 움직인다. */}
        <Block position={[side * 3.4, -0.42, 2.2]} scale={[0.2, 0.5, 0.7]} color="#a3afb0" />
        <Duct position={[side*3.4,-.82,2.7]} radius={.62} length={2.6} color="#a3afb0"/>
        <SurfaceVent position={[side * 3.4, -0.58, 2.1]} scale={[0.42, 0.018, 0.08]} rotation={[0, 0, 0]} />
        <DetailLamp position={[side * (HALF_SPAN - 0.42), 0.17, 3.42]} color={side < 0 ? '#ff3b30' : '#35d072'} scale={0.07} />
        {/* 주 랜딩기어. 스트럿, 토크링크, 바퀴 두 개다. */}
        <Block position={[side * 2, -1.05, 1]} scale={[0.14, 1.2, 0.14]} color="#78898c" />
        <Block position={[side * 2, -1.42, 1.12]} scale={[0.1, 0.5, 0.1]} color="#66767a" rotation={[0.5, 0, 0]} />
        {[-0.2, 0.2].map((offset) => <mesh key={offset} position={[side * 2 + offset, -1.62, 1]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 10]} /><meshStandardMaterial color="#394649" />
        </mesh>)}
        {/* 날개끝 항법등. 왼쪽은 붉고 오른쪽은 녹색이다. */}
        <Block position={[side * (HALF_SPAN - 0.4), 0.1, 3.7]} scale={[0.36, 0.16, 1]} color={side < 0 ? '#bd7467' : '#78a987'} />
      </group>)}
      {/* 앞바퀴 */}
      <Block position={[0, -1.05, -3.7]} scale={[0.14, 1.2, 0.14]} color="#78898c" />
      <mesh position={[0, -1.62, -3.7]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 10]} /><meshStandardMaterial color="#394649" />
      </mesh>
    </StaticBatch>
    {/* 캐노피와 조종석 구간 동체. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
    <group visible={!firstPerson}>
      <StaticBatch>
        <mesh geometry={fuselageCabin} castShadow dispose={null}>
          <meshStandardMaterial color="#ebe8df" metalness={0.15} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.74, -3.5]} scale={[0.82, 0.6, 1.85]} castShadow>
          <sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#15303d" metalness={0.12} roughness={0.22} />
        </mesh>
      <CanopyFrame position={[0,.74,-3.5]} rx={0.82} ry={0.6} rz={1.85} color="#45545e"/>
      </StaticBatch>
    </group>
  </group>;
}
