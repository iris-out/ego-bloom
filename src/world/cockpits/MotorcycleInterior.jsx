import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Dial, GlassPane, Panel } from './parts.jsx';
import { MAX_RPM, REDLINE_RPM } from '../carGauges.js';
import { VEHICLES } from '../carPhysics.js';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';
import { at } from './cabinLayout.js';
import { BIKE_CLUSTER } from './vehicleInteriorLayout.js';
import { CabinLamp } from './CabinLamp.jsx';

/** 오토바이 1인칭이다. 외장(models/Motorcycle.jsx)은 그대로 두고, 그 steerGroup 과
 * 같은 pivot, 같은 부호로 도는 계기와 손만 실내가 그린다. firstPerson 이면 외장은 계기
 * 클러스터와 백미러 판(거울면)만 숨기고 미러 스템, 윈드스크린, 그립, 레버, 트리플 클램프는
 * 그대로 둔다. 여기서는 그 빈 자리를 채운다. */

/** models/Motorcycle.jsx 의 frontGroup 은 position [0,0,FRONT_Z] 에서
 * rotation.y = clamp(steer,-1,1) * MAX_STEER 로 돈다. 여기 두 값이 그 값을 그대로 옮긴 것이다.
 * 값이 어긋나면 계기와 손이 핸들과 다른 각도로 돌아 바로 눈에 띈다. 외장을 고치면 여기도 맞춘다. */
const STEER_PIVOT_Z = BIKE_CLUSTER.steerPivotZ;
const MAX_STEER = 0.55;

/** 계기 나셀 자리와 크기는 vehicleInteriorLayout 의 BIKE_CLUSTER 한 곳에 있다. 계기가
 * 핸들바 가로대 위로 올라오는지 테스트가 그 값으로 검사한다. */
const CLUSTER_POSITION = BIKE_CLUSTER.position;
const CLUSTER_ROTATION = BIKE_CLUSTER.rotation;

const SIDES = [-1, 1];

/** 윈드스크린 한 장이다. 자리와 기울기는 외장 판(models/Motorcycle.jsx) 과 같다. */
const SCREEN = BIKE_CLUSTER.windscreen;

/** 손, 레버, 스로틀이 파생하는 그립 자리다. models/Motorcycle.jsx 의 핸들바 끝(클립온
 * 그립 실린더, steerGroup 로컬 [±0.38, 0.42, 0.78], 반지름 0.045, 길이 0.14)과 같다. */
const gripAt = (side) => [side * 0.38, 0.42, 0.78];
// 손가락이 그립 앞(작은 z)을 감싸는 깊이와 손가락 박스의 z 두께다.
const FINGER_FORWARD = 0.045;
const FINGER_DEPTH = 0.05;
// 레버는 손가락 앞면에서 3cm 더 앞에 둬 손이 레버를 덮지 않는다.
const LEVER_GAP = 0.03;
const LEVER_LENGTH = 0.13;

const TOP_KMH = VEHICLES.motorcycle.top * 3.6;
// 20 단위로 반올림해 마지막 눈금과 바늘의 max 가 같은 자리에서 만나게 한다.
const SPEED_MAX = Math.ceil(TOP_KMH / 20) * 20;
const SPEED_NUMBERS = Array.from({ length: SPEED_MAX / 20 + 1 }, (_, index) => index * 20);
// 회전계는 x1000 rpm 단위로 0~8 을 적는다. max 는 실제 rpm 값(MAX_RPM)과 맞춘다.
const RPM_NUMBERS = Array.from({ length: 9 }, (_, index) => index);
const RPM_REDLINE = REDLINE_RPM / MAX_RPM;

export function MotorcycleInterior({ statusRef, night = false, quality = 'medium' }) {
  return <group>
    {night && <CabinLamp vehicle="motorcycle" offset={[0, -0.08, -0.42]} intensity={0.35} />}
    <Mirrors vehicle="motorcycle" layout="motorcycle" quality={quality} />
    {/* 핸들바 전체다. steer 에 맞춰 외장과 같은 pivot 으로 함께 돈다. */}
    <Handlebar statusRef={statusRef} night={night} />
    {/* 무릎 둘. 연료탱크는 외장에 있으므로 여기서는 그 옆, 화면 아래 모서리만 채운다. */}
    <Panel material="sleeve" position={at('motorcycle', [-0.26, -0.58, -0.32])} scale={[0.16, 0.24, 0.12]} rotation={[0.12, 0, 0.1]} />
    <Panel material="sleeve" position={at('motorcycle', [0.26, -0.58, -0.32])} scale={[0.16, 0.24, 0.12]} rotation={[0.12, 0, -0.1]} />
  </group>;
}

/** 오토바이 핸들바 전체다. models/Motorcycle.jsx 의 frontGroup 과 같은 pivot, 같은 부호로
 * 도는 dynamic group 이다. 계기, 손, 레버, 스로틀 그립이 모두 이 안에서 함께 돈다.
 * 부모가 통째로 dynamic 이므로 자식을 StaticBatch 가 건드리지 않는다. */
function Handlebar({ statusRef, night }) {
  const group = useRef();
  // statusRef 는 매 프레임 값만 바뀌는 ref 라 렌더 중에는 읽지 않는다(react-hooks/refs).
  // useFrame 안에서만 읽어 외장 frontGroup 과 같은 pivot, 같은 부호로 돈다.
  useFrame(() => {
    if (!group.current) return;
    const steer = Number(statusRef?.current?.steer) || 0;
    group.current.rotation.y = Math.max(-1, Math.min(1, steer)) * MAX_STEER;
  });
  return <group ref={group} position={[0, 0, STEER_PIVOT_Z]} userData={{ dynamic: true }}>
    {/* 윈드스크린이다. 외장의 판 둘은 1인칭에서 숨고 그 자리를 유리 한 장이 대신한다.
        불투명 판이면 도로가 그대로 가린다. 핸들과 함께 돌도록 이 group 안에 둔다. */}
    <GlassPane position={[0, SCREEN.y, SCREEN.z]} rotation={[SCREEN.tilt, 0, 0]}
      scale={[SCREEN.width, SCREEN.height, 1]} />
    <group position={CLUSTER_POSITION} rotation={CLUSTER_ROTATION}>
      {/* 나셀은 계기 뒤(먼 z)에 얇게 둔다. 계기 앞면은 나셀보다 눈 쪽(z 가 큰 쪽)에 있어
          가리지 않는다. 계기 유리는 Dial 의 hood 가 준다. */}
      <Panel material="trim" position={[0, 0, -0.035]} scale={[...BIKE_CLUSTER.nacelle]} />
      <Dial get={() => statusRef?.current?.speed || 0} max={SPEED_MAX} numbers={SPEED_NUMBERS} hood
        position={[BIKE_CLUSTER.speed.x, 0, 0]} radius={BIKE_CLUSTER.speed.radius} />
      <Dial get={() => statusRef?.current?.rpm || 0} max={MAX_RPM} numbers={RPM_NUMBERS} redline={RPM_REDLINE} hood
        position={[BIKE_CLUSTER.rpm.x, 0, 0]} radius={BIKE_CLUSTER.rpm.radius} />
      <InstrumentDisplay mode="bike" statusRef={statusRef} night={night}
        position={[BIKE_CLUSTER.display[0], BIKE_CLUSTER.display[1], 0]}
        width={BIKE_CLUSTER.display[2]} height={BIKE_CLUSTER.display[3]} accent="#ffd18a" />
    </group>
    {/* 그립을 감싸 쥔 장갑 낀 손 둘이다. 손등이 위를, 손가락이 그립 앞을 덮고 엄지는 안쪽 위에
        얹힌다. 전완은 손목에서 화면 아래 모서리(눈 쪽 아래)로 내려간다. 레버는 손가락 앞
        3cm 에 둬 손에 덮이지 않는다. */}
    {SIDES.map((side) => {
      const [gx, gy, gz] = gripAt(side);
      const fingerZ = gz - FINGER_FORWARD;
      const fingerFrontZ = fingerZ - FINGER_DEPTH / 2;
      const leverZ = fingerFrontZ - LEVER_GAP - LEVER_LENGTH / 2;
      return <group key={side}>
        {/* 손등. 그립 위쪽을 덮는다. */}
        <Panel material="skin" position={[gx, gy + 0.025, gz + 0.01]} scale={[0.09, 0.035, 0.10]} />
        {/* 손가락. 그립 앞을 감싸 쥔다. */}
        <Panel material="skin" position={[gx, gy - 0.015, fingerZ]} scale={[0.085, 0.045, FINGER_DEPTH]} rotation={[-0.5, 0, 0]} />
        {/* 엄지. 안쪽 위. */}
        <Panel material="skin" position={[gx - side * 0.05, gy + 0.04, gz - 0.005]} scale={[0.025, 0.022, 0.06]} rotation={[0, 0, side * -0.3]} />
        {/* 전완. Hands/StickHand 와 같은 offset 식(아래로, 눈 쪽으로)이다. */}
        <Panel material="sleeve" position={[gx, gy - 0.05, gz + 0.15]} scale={[0.09, 0.09, 0.32]} rotation={[0.5, 0, 0]} />
        {/* 왼손 위 클러치, 오른손 위 브레이크. 둘 다 같은 모양이다. */}
        <Panel material="metal" position={[gx - side * 0.04, gy + 0.02, leverZ]} scale={[0.018, 0.018, LEVER_LENGTH]} rotation={[0.15, 0, 0]} />
      </group>;
    })}
    {/* 스로틀 그립(오른쪽). 왼쪽은 고정 그립이라 돌지 않아 따로 두지 않는다. */}
    <Panel material="rubber" position={[0.38, 0.415, 0.83]} scale={[0.07, 0.045, 0.045]} />
  </group>;
}
