import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Block from './ModelBlock';
import { Wheel as RoadWheel } from './carParts.jsx';
import { Shell, Fender } from './SurfaceParts.jsx';
import StaticBatch from '../StaticBatch.jsx';
import { steerAngle } from './carGeometry.js';

/** 오토바이 시각 모델. Jet, Helicopter 와 같은 축 규약을 따른다.
 * 로컬 원점은 차체 중심, +Y 위, 앞쪽 -Z, 뒤쪽 +Z, 가로 X 다. 부모가 위치와 자세를 준다.
 * Z 는 -1.6..1.6, X 는 미러 포함 ±0.55 안쪽이다. 두 바퀴 최하단은 정확히 y=-0.9 다.
 * 꼭대기(미러, 윈드스크린)는 y=0.7 을 넘지 않는다.
 * 앞바퀴, 포크, 핸들바, 계기는 steerGroup 하나에 묶여 steer 만큼 요잉으로 돈다.
 * 두 바퀴는 이 컴포넌트가 직접 굴린다. 부모는 조향과 속도만 준다.
 * 1인칭 카메라 눈높이는 부모 좌표계 기준 [0, 0.78, 0.28] 다(eyePoints.js EYE_POINTS.motorcycle). 이 반경 0.15 안에는
 * 어떤 파트도 두지 않는다. 라이더 시야 파트(계기, 핸들바, 미러, 탱크 캡, 윈드스크린
 * 안쪽 면)는 steerGroup 로컬 z 0.3~0.85 대에 몰아서 눈높이 앞 0.2~0.9 범위에 오게 한다.
 * firstPerson 이면 계기 클러스터와 백미러 판(거울면)만 숨긴다. 실내가 살아 있는 계기와
 * 거울면을 대신 그린다. 미러 스템/암, 윈드스크린은 실내가 다시 그리지 않으므로 남긴다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const MAX_STEER = 0.55;
const MAX_STEP = 0.05;

const BODY = '#6b3f52';
const METAL = '#8e979b';
const DARK_METAL = '#394649';
const TIRE = '#2a3134';
const HEADLAMP = '#ffe6a0';
const TAILLAMP = '#d94f3d';
const SIGNAL = '#ffb020';
const PLATE = '#e8e4da';
const RADIATOR = '#4a5457';
const GLASS = '#cfe8ef';

/* 계기 클러스터 색: 규정대로 베젤, 다이얼 면, 눈금, 바늘을 고정한다 */
const GAUGE_BEZEL = '#2a3134';
const GAUGE_FACE = '#1d2427';
const TICK_COLOR = '#88b5cd';
const NEEDLE_COLOR = '#d94f3d';

const WHEEL_RADIUS = 0.32;
const WHEEL_Y = -0.58; // -0.9 + WHEEL_RADIUS. 두 바퀴 모두 이 값을 쓴다.
const FRONT_Z = -1.2;
const REAR_Z = 1.0;

const SPOKE_ANGLES = [0, Math.PI/2, Math.PI, Math.PI*1.5];
const SIDES = [-1, 1];
function Wheel({ withDisc }) {
  return <RoadWheel radius={WHEEL_RADIUS} width={.22} brake={withDisc} spokes={5} spokeColor={METAL}/>;
}

export default function Motorcycle({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const frontWheel = useRef();
  const rearWheel = useRef();
  const frontGroup = useRef();
  // 마운트 첫 프레임 전에도 조향각이 맞도록 초깃값을 props 로 잡는다. useFrame 이 그 뒤를 잇는다.
  const initialSteerAngle = steerAngle(steer, MAX_STEER);

  /* wheelsRef 가 있으면(CarMode 주행 중) 조향과 회전을 매 프레임 직접 읽는다.
   * 프레임 급증으로 바퀴가 튀지 않게 한 프레임 회전량을 막는다. 회전은 반지름 기준 각속도로 굴린다. */
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    const s = live ? live.steer : steer, v = live ? live.speed : speed;
    if (frontGroup.current) frontGroup.current.rotation.y = steerAngle(s, MAX_STEER);
    const step = Math.min(delta, MAX_STEP);
    const spin = -(v / WHEEL_RADIUS) * step; // 전진은 -Z 이므로 바퀴는 -X 방향으로 굴린다.
    if (frontWheel.current) frontWheel.current.rotation.x = (frontWheel.current.rotation.x + spin) % TWO_PI;
    if (rearWheel.current) rearWheel.current.rotation.x = (rearWheel.current.rotation.x + spin) % TWO_PI;
  });

  return <StaticBatch>
    {/* 프레임, 엔진, 뒤쪽은 조향과 무관하게 고정이다 */}
    <Block position={[0, 0.12, -0.35]} scale={[0.12, 0.12, 1.9]} color={DARK_METAL} />
    <mesh position={[0, 0.15, FRONT_Z]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.5, 10]} /><meshStandardMaterial color={DARK_METAL} metalness={0.4} roughness={0.5} /></mesh>

    <Block position={[0, -0.28, 0.15]} scale={[0.42, 0.38, 0.55]} color={DARK_METAL} />
    {[-0.15, -0.24, -0.33, -0.42].map((y) => <Block key={y} position={[0, y, 0.0]} scale={[0.44, 0.035, 0.5]} color={METAL} />)}
    <Block position={[0.22, -0.32, 0.25]} scale={[0.06, 0.22, 0.3]} color={METAL} />

    {/* 라디에이터, 실린더 헤드 냉각핀: 엔진 앞뒤로 붙인다 */}
    <Block position={[0, -0.22, -0.18]} scale={[0.36, 0.24, 0.05]} color={RADIATOR} />
    <Block position={[0, -0.08, 0.1]} scale={[0.34, 0.14, 0.32]} color={DARK_METAL} />
    {[0, 1].map((i) => <Block key={i} position={[0, 0.0 - i * 0.05, 0.02]} scale={[0.36, 0.02, 0.34]} color={METAL} />)}

    <mesh position={[0.18, -0.55, 0.05]} rotation={[1.3, 0, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, 0.5, 8]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
    <mesh position={[0.18, -0.62, 0.55]} rotation={[1.5, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.6, 8]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
    <mesh position={[0.2, -0.55, 1.15]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.09, 0.09, 0.55, 10]} /><meshStandardMaterial color={DARK_METAL} metalness={0.4} roughness={0.5} /></mesh>
    <mesh position={[0.2, -0.55, 1.42]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 0.05, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} /></mesh>

    <Block position={[0.24, -0.49, 0.68]} scale={[0.03, 0.15, 0.6]} rotation={[-0.28, 0, 0]} color={DARK_METAL} />
    <mesh position={[0.24, -0.38, 0.35]} rotation={[0, 0, HALF_PI]}><cylinderGeometry args={[0.09, 0.09, 0.05, 10]} /><meshStandardMaterial color={DARK_METAL} metalness={0.5} roughness={0.4} /></mesh>
    <mesh position={[0.24, -0.58, 0.95]} rotation={[0, 0, HALF_PI]}><cylinderGeometry args={[0.16, 0.16, 0.05, 12]} /><meshStandardMaterial color={DARK_METAL} metalness={0.5} roughness={0.4} /></mesh>

    {/* 체인 링크와 스프로킷 이빨: 엔진에서 뒷바퀴까지 대각선을 따라 놓는다 */}
    {[0, 1, 2].map((i) => <Block key={i} position={[0.24, -0.42 - i * 0.05, 0.4 + i * 0.18]} scale={[0.02, 0.03, 0.06]} rotation={[-0.28, 0, 0]} color={DARK_METAL} />)}
    {SPOKE_ANGLES.map((a) => <Block key={a} position={[0.24, -0.58 + Math.sin(a) * 0.18, 0.95 + Math.cos(a) * 0.18]} scale={[0.02, 0.035, 0.02]} rotation={[a, 0, 0]} color={METAL} />)}

    <Shell color={BODY} stations={[{z:-.425,rx:.1,ry:.07,cy:.14},{z:-.28,rx:.19,ry:.14,cy:.15},{z:-.05,rx:.17,ry:.12,cy:.15},{z:.125,rx:.09,ry:.06,cy:.12}]}/>
    <Block position={[0, 0.31, -0.18]} scale={[0.2, 0.015, 0.36]} color={DARK_METAL} />
    <mesh position={[0, 0.32, -0.15]}><cylinderGeometry args={[0.05, 0.05, 0.04, 8]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} /></mesh>
    {/* 연료탱크 주유구 캡: 탱크 상면 중앙 */}
    <mesh position={[0, 0.3, -0.32]}><cylinderGeometry args={[0.045, 0.045, 0.02, 10]} /><meshStandardMaterial color={METAL} metalness={0.7} roughness={0.25} /></mesh>

    {/* 배기 헤더 파이프: 실린더에서 머플러까지 곡선을 두 구간으로 근사한다 */}
    <mesh position={[0.2, -0.62, -0.05]} rotation={[0.35, 0, 0.15]}><cylinderGeometry args={[0.035, 0.035, 0.35, 8]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} /></mesh>
    <mesh position={[0.22, -0.7, 0.4]} rotation={[1.45, 0, 0.08]}><cylinderGeometry args={[0.038, 0.038, 0.65, 8]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} /></mesh>
    <mesh position={[0.24, -0.58, 0.95]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.065, 0.065, 0.06, 12]} /><meshStandardMaterial color={DARK_METAL} metalness={0.5} roughness={0.3} /></mesh>

    <Shell color={TIRE} roughness={.85} stations={[{z:.075,rx:.1,ry:.035,cy:.22,power:3},{z:.3,rx:.15,ry:.06,cy:.22,power:4},{z:.625,rx:.12,ry:.055,cy:.25,power:3}]}/>
    {[-1, 0, 1].map((offset) => <Block key={`vent-${offset}`} position={[offset * 0.08, -0.06, -0.18]} scale={[0.04, 0.015, 0.06]} color="#252c2f" />)}
    <Shell color={BODY} stations={[{z:.575,rx:.14,ry:.08,cy:.25},{z:.8,rx:.11,ry:.075,cy:.27},{z:.925,rx:.05,ry:.035,cy:.28}]}/>
    <Block position={[0, 0.22, 0.92]} scale={[0.14, 0.08, 0.04]} color={TAILLAMP} />
    {/* 번호판과 방향지시등 두 개(뒤) */}
    <Block position={[0, 0.05, 0.98]} scale={[0.14, 0.1, 0.01]} rotation={[-0.3, 0, 0]} color={PLATE} />
    {SIDES.map((side) => <mesh key={side} position={[side * 0.17, 0.2, 0.88]}><boxGeometry args={[0.04, 0.04, 0.04]} /><meshStandardMaterial color={SIGNAL} emissive={SIGNAL} emissiveIntensity={0.6} /></mesh>)}

    {/* 리어 서스펜션 스프링: 쇽 튜브를 코일로 감싼다 */}
    <mesh position={[0.18, -0.62, 0.55]} rotation={[1.5, 0, 0]}><torusGeometry args={[0.065, 0.012, 6, 12]} /><meshStandardMaterial color={METAL} metalness={0.7} roughness={0.3} /></mesh>

    <group position={[0, 0, REAR_Z]}>
      {/* 회전 원점은 허브 중심이다. 캘리퍼는 차체에 고정한다. 바퀴만 정적 병합에서 뺀다 */}
      <group ref={rearWheel} position={[0, WHEEL_Y, 0]} userData={{ dynamic: true }}><Wheel withDisc /></group>
      <Block position={[0.15, WHEEL_Y + 0.14, 0]} scale={[0.06, 0.1, 0.05]} color={DARK_METAL} />
    </group>
    <Fender position={[0,WHEEL_Y,.95]} radius={.36} width={.26} color={BODY}/>
    {/* 작고 고정된 라이더 실루엣. 눈높이와 미러 높이를 넘지 않는다. */}
    <group position={[0, 0.04, 0.34]}>
      <Block position={[0, 0.22, 0]} scale={[0.24, 0.38, 0.18]} color="#26343a" />
      <mesh position={[0, 0.5, 0]} castShadow><sphereGeometry args={[0.125, 10, 8]} /><meshStandardMaterial color="#394b52" roughness={0.55} /></mesh>
      <mesh position={[0, 0.5, -0.1]} scale={[0.8, 0.35, 0.75]}><sphereGeometry args={[0.12, 10, 6]} /><meshStandardMaterial color="#394b52" roughness={0.55} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.13, 0.28, -0.12]} rotation={[0.45, 0, side * 0.55]}>
        <cylinderGeometry args={[0.03, 0.03, 0.38, 6]} /><meshStandardMaterial color="#26343a" roughness={0.8} />
      </mesh>)}
    </group>

    {/* 앞바퀴, 포크, 핸들바, 계기, 미러는 하나로 묶여 steer 만큼 요잉으로 돈다. 이 group 전체가
        회전하므로 위 StaticBatch 병합에서 뺀다. 안쪽은 앞부분과 캐빈(계기, 백미러 판) 으로 나눠
        각각 한 번씩 정적 병합한다 */}
    <group ref={frontGroup} position={[0, 0, FRONT_Z]} rotation={[0, initialSteerAngle, 0]} userData={{ dynamic: true }}>
      <StaticBatch>
        <group ref={frontWheel} position={[0, WHEEL_Y, 0]} userData={{ dynamic: true }}><Wheel withDisc /></group>
        <Block position={[0.15, WHEEL_Y + 0.14, 0]} scale={[0.06, 0.1, 0.05]} color={DARK_METAL} />
        <Fender position={[0,WHEEL_Y,.08]} radius={.36} width={.26} color={BODY}/>

        {SIDES.map((side) => <group key={side}>
          <mesh position={[side * 0.09, 0.07, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.5, 8]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} /></mesh>
          <mesh position={[side * 0.09, -0.355, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, 0.45, 8]} /><meshStandardMaterial color={DARK_METAL} metalness={0.4} roughness={0.5} /></mesh>
        </group>)}

        {/* 상단 트리플 클램프와 볼트 */}
        <Block position={[0, 0.34, 0]} scale={[0.26, 0.05, 0.12]} color={DARK_METAL} />
        <Block position={[0, 0.0, 0]} scale={[0.26, 0.05, 0.12]} color={DARK_METAL} />
        {[-0.08, 0.08].map((x) => <mesh key={x} position={[x, 0.37, 0]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.014, 0.014, 0.03, 6]} /><meshStandardMaterial color={METAL} metalness={0.8} roughness={0.2} /></mesh>)}

        {/* 윈드스크린 안쪽 면: 라이더 눈높이 바로 앞이라 1인칭에서는 불투명한 판이 도로를
            가린다. 캐빈과 같은 기준으로 숨기고 실내(MotorcycleInterior)가 유리 한 장을 대신 세운다.
            핸들과 함께 돌아야 하므로 캐빈 group 이 아니라 여기서 감싼다 */}
        <group visible={!firstPerson}>
          <Block position={[0, 0.46, 0.42]} scale={[0.42, 0.28, 0.015]} rotation={[-0.45, 0, 0]} color={GLASS} />
          <Block position={[0, 0.52, 0.3]} scale={[0.46, 0.3, 0.015]} rotation={[-0.45, 0, 0]} color={METAL} />
        </group>

        {/* 클립온 바: 트리플 클램프에서 좌우로 뻗는다 */}
        {SIDES.map((side) => <mesh key={side} position={[side * 0.2, 0.36, 0.05]} rotation={[0, 0, side * 0.12]}><cylinderGeometry args={[0.016, 0.016, 0.14, 8]} /><meshStandardMaterial color={DARK_METAL} metalness={0.5} roughness={0.4} /></mesh>)}

        {/* 핸들바 좌우 그립, 브레이크 레버, 클러치 레버, 스위치 뭉치, 백미러 스템/암(거울면은 캐빈이다) */}
        <mesh position={[0, 0.42, 0.78]} rotation={[0, 0, HALF_PI]}><cylinderGeometry args={[0.03, 0.03, 0.8, 8]} /><meshStandardMaterial color={DARK_METAL} metalness={0.4} roughness={0.5} /></mesh>
        {SIDES.map((side) => <group key={side}>
          <mesh position={[side * 0.38, 0.42, 0.78]} rotation={[0, 0, HALF_PI]}><cylinderGeometry args={[0.045, 0.045, 0.14, 8]} /><meshStandardMaterial color={DARK_METAL} roughness={0.6} /></mesh>
          <Block position={[side * 0.3, 0.4, 0.72]} scale={[0.06, 0.05, 0.04]} color={DARK_METAL} />
          <Block position={[side * 0.34, 0.4, 0.88]} scale={[0.02, 0.02, 0.14]} rotation={[0.15, 0, 0]} color={METAL} />
          <mesh position={[side * 0.36, 0.5, 0.76]} rotation={[0, 0, side * 0.6]}><cylinderGeometry args={[0.015, 0.015, 0.16, 6]} /><meshStandardMaterial color={DARK_METAL} metalness={0.4} roughness={0.5} /></mesh>
        </group>)}

        <mesh position={[0, 0.28, -0.24]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.04, 10]} /><meshStandardMaterial color={DARK_METAL} metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0, 0.28, -0.3]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.13, 0.13, 0.08, 10]} /><meshStandardMaterial color={HEADLAMP} emissive={HEADLAMP} emissiveIntensity={0.7} roughness={0.3} /></mesh>
        {/* 앞 방향지시등 두 개 */}
        {SIDES.map((side) => <mesh key={side} position={[side * 0.18, 0.22, -0.28]}><boxGeometry args={[0.035, 0.035, 0.035]} /><meshStandardMaterial color={SIGNAL} emissive={SIGNAL} emissiveIntensity={0.6} /></mesh>)}
      </StaticBatch>

      {/* 캐빈. 계기 클러스터와 백미러 판(거울면)만 여기 있다. firstPerson 이면 숨겨 실내가 대신 그린다 */}
      <group visible={!firstPerson}>
        <StaticBatch>
          {/* 계기 클러스터: 원형 속도계, 회전계, 눈금, 바늘, 경고등 줄 */}
          <group position={[0, 0.32, 0.65]} rotation={[-0.5, 0, 0]}>
            <Block position={[0, 0, 0]} scale={[0.3, 0.14, 0.05]} color={GAUGE_BEZEL} />
            {[-0.08, 0.08].map((x) => <mesh key={x} position={[x, 0, 0.026]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 0.01, 16]} /><meshStandardMaterial color={GAUGE_FACE} roughness={0.4} /></mesh>)}
            {[-0.08, 0.08].map((x) => <mesh key={`tick-${x}`} position={[x, 0.045, 0.032]}><boxGeometry args={[0.006, 0.018, 0.004]} /><meshStandardMaterial color={TICK_COLOR} emissive={TICK_COLOR} emissiveIntensity={0.5} /></mesh>)}
            {[-0.08, 0.08].map((x) => <mesh key={`needle-${x}`} position={[x, 0.01, 0.033]} rotation={[0, 0, -0.6]}><boxGeometry args={[0.05, 0.004, 0.003]} /><meshStandardMaterial color={NEEDLE_COLOR} emissive={NEEDLE_COLOR} emissiveIntensity={0.6} /></mesh>)}
            {[-0.11, 0.11].map((x) => <mesh key={`warn-${x}`} position={[x, -0.045, 0.03]}><boxGeometry args={[0.02, 0.012, 0.004]} /><meshStandardMaterial color={SIGNAL} emissive={SIGNAL} emissiveIntensity={0.4} /></mesh>)}
            {/* 키 실린더: 계기 오른쪽 아래 */}
            <mesh position={[0.16, -0.04, 0.02]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.03, 10]} /><meshStandardMaterial color={DARK_METAL} metalness={0.6} roughness={0.3} /></mesh>
          </group>
          {/* 백미러 판(거울면). 스템과 암은 앞부분에 남아 있다 */}
          {SIDES.map((side) => <mesh key={side} position={[side * 0.48, 0.62, 0.72]}><boxGeometry args={[0.09, 0.06, 0.03]} /><meshStandardMaterial color={METAL} metalness={0.85} roughness={0.12} /></mesh>)}
        </StaticBatch>
      </group>
    </group>
  </StaticBatch>;
}
