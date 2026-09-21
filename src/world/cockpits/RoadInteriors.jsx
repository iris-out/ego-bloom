import { Bolts, Dial, GearLever, GlassPane, GrabHandle, Knob, Panel, Pedals, PushButton, Seat, ShadeStrip, Toggle, Wipers, Yoke } from './parts.jsx';
import { MAX_RPM, REDLINE_RPM } from '../carGauges.js';
import { VEHICLES } from '../carPhysics.js';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';
import { ROAD_CABINS } from './vehicleInteriorLayout.js';
import { at, cabin } from './cabinLayout.js';
import { CabinLamp } from './CabinLamp.jsx';
import { detailLevel } from './detail.js';

/** 승용차 계열(세단, SUV, 오픈카, 트럭) 1인칭 실내다. 치수는 vehicleInteriorLayout 의
 * ROAD_CABINS 한 곳에서 나오고 그 값은 외장 모델(models/Sedan.jsx 등) 좌표에서 파생했다.
 * 1인칭에서는 외장의 앞부분(보닛, 펜더, 사이드미러, 섀시) 이 함께 그려지므로 실내는
 * 캐빈 안쪽만 그린다. 외장이 이미 가진 조각(오픈카의 앞유리 틀, 좌석, 스티어링 림, 롤바,
 * 토노 커버) 은 다시 그리지 않는다.
 *
 * statusRef 는 carStatus() 값을 담은 ref 다. 계기는 이 ref 를 매 프레임 읽어 스스로 움직이고,
 * 부모(CarMode) 는 0.15초마다 ref 의 내용만 바꿔 넣을 뿐 다시 렌더하지 않는다.
 * quality 는 detailLevel 로 두 불리언이 된다. mid 는 유리, 좌석, 손, 계기 후드, 노브, 접촉
 * 그림자, 와이퍼, 페달이고 high 는 소품(컵홀더, 선바이저, 손잡이, 스토크, 볼트) 이다. */

const HALF_PI = Math.PI / 2;

/** 앞유리 헤더의 두께다. HEADER 는 유리면을 따라가는 높이, HEADER_IN 은 눈 쪽으로 들어오는
 * 깊이다. 아가리 위끝은 유리 윗모서리가 정하고 헤더는 그 위에 얹히므로, 눈에 가장 가까운
 * 아래 모서리가 윗모서리에서 법선으로 HEADER_IN 만큼 간 자리다. ROAD_CABINS 의 glass 높이를
 * 이 값에서 거꾸로 구했다(윗모서리 y = roofY + HEADER_IN * sin(기울기)). */
const HEADER = 0.09, HEADER_IN = 0.10;

/** 속도계 눈금이다. 최고 속도(m/s) 를 km/h 로 바꿔 20 의 배수로 올린다.
 * 숫자가 아홉 칸을 넘으면 40 단위로 벌린다. 작은 원판에 열세 칸을 적으면 글자가 12px 까지
 * 줄어 읽히지 않는다. 보조 눈금이 칸마다 넷씩 들어가 40 단위여도 8 단위까지 읽힌다. */
function speedScale(top) {
  const reach = Math.ceil((Number(top) || 0) * 3.6 / 20) * 20;
  const step = reach > 160 ? 40 : 20;
  const max = Math.ceil(reach / step) * step;
  const numbers = [];
  for (let value = 0; value <= max; value += step) numbers.push(value);
  return { max, numbers };
}

/** 회전계는 x1000 으로 읽는다. 숫자는 0~8 이고 바늘 범위는 실제 MAX_RPM 이다. */
const RPM_NUMBERS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);
/** 나침반은 한 바퀴를 다 쓰면 0 과 360 이 같은 자리에 겹쳐 글자가 뭉갠다. 조금 덜 돌린다. */
const COMPASS_SWEEP = 6.02;
const COMPASS_NUMBERS = Object.freeze([0, 90, 180, 270, 360]);

/** 와이퍼 한 번 왕복에 걸리는 시간이다. */
const WIPER_PERIOD = 1.4;

/** 비가 올 때만 위상을 준다. Wipers 의 get 이 매 프레임 부르므로 여기서 시각을 직접 읽어도
 * 실내에 useFrame 을 두지 않는다. 0 을 주면 Wipers 가 눕힌 자리에 그대로 둔다. */
function wiperPhase(weather) {
  if (weather !== 'rain') return 0;
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  return (now / 1000 / WIPER_PERIOD) % 1;
}

/** 누운 판(대시 상판, 후드, 헤드라이너) 의 자세다. 앞점에서 뒷점으로 눕는다.
 * 박스의 로컬 +z 가 (0, -sin, cos) 로 가므로 뒷점이 낮으면 각이 양수다. */
function lying(y0, z0, y1, z1) {
  const dy = y1 - y0, dz = z1 - z0;
  return { y: (y0 + y1) / 2, z: (z0 + z1) / 2, length: Math.hypot(dy, dz), angle: Math.atan2(-dy, dz) };
}

/** 선 판(대시 앞면, 필러, 센터 스택) 의 자세다. 아래점에서 윗점으로 선다.
 * 박스의 로컬 +y 가 (0, cos, sin) 로 가므로 윗점이 눈 쪽이면 각이 양수다. */
function standing(y0, z0, y1, z1) {
  const dy = y1 - y0, dz = z1 - z0;
  return { y: (y0 + y1) / 2, z: (z0 + z1) / 2, length: Math.hypot(dy, dz), angle: Math.atan2(dz, dy) };
}

/** 앞유리 아가리의 위(+1) 또는 아래(-1) 모서리다. 눈 기준 [y, z] 를 준다. */
function glassEdge(spec, sign) {
  const [, y, z, , height] = spec.glass;
  const half = (height / 2) * sign;
  return [y + half * Math.cos(spec.glassAngle), z + half * Math.sin(spec.glassAngle)];
}

/** 헤더 바로 뒤 천장 자리다. 오버헤드 콘솔과 마커등 스위치 판이 여기 붙는다. */
function roofPanelZ(spec) {
  return glassEdge(spec, 1)[1] + 0.3;
}

/** 계기 후드가 덮는 좌우 범위다. 계기 배치에서 그대로 나온다. */
function clusterSpan(spec) {
  const xs = spec.dials.map((dial) => dial[0]);
  const lo = Math.min(...xs) - spec.dialRadius - 0.02;
  const hi = Math.max(...xs) + spec.dialRadius + 0.02;
  return { x: (lo + hi) / 2, width: hi - lo };
}

/** 센터 스택 한 덩어리의 자리다. 공조 노브 줄(switches) 과 비상등(hazard) 에서 거꾸로 구해
 * 배치 데이터에 숫자를 더 적지 않는다. 두 줄이다. 윗줄이 송풍구 둘과 그 사이 비상등,
 * 아랫줄이 공조 노브 셋이다. 세 줄로 벌리면 대시가 얕은 오픈카에서 판이 대시 위로 솟는다.
 * 윗변은 대시가 꺾이는 자리 바로 아래, 아랫변은 대시 앞면 밑선을 넘지 않는다.
 * 좌표는 전부 눈 기준이라 at() 이 짝이다. */
function stackSpan(spec) {
  const xs = spec.switches.map((knob) => knob[0]);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const top = spec.dashBreakY - 0.015;
  const bottom = Math.max(spec.switches[0][1] - 0.075, spec.dashFaceY - 0.02);
  return {
    x: (lo + hi) / 2, width: hi - lo + 0.14, z: spec.switches[0][2],
    ventY: spec.hazard[1], y: (top + bottom) / 2, height: top - bottom,
  };
}

/** 조수석 앞 글로브박스 윤곽이다. 대시 앞면 위에 ㄷ 자 세 줄로만 긋는다.
 * 운전석이 -x 쪽이므로 글로브박스는 차체 +x 쪽이다. */
function gloveBox(spec) {
  return { x: spec.innerWidth * 0.25, width: spec.innerWidth * 0.32, height: 0.19 };
}

/** 바닥, 헤드라이너, 앞유리 헤더, A 필러, B 필러, 뒷벽이다. 지붕이 없는 오픈카는
 * 헤드라이너 대신 외장 앞유리 틀 안쪽 트림만 둔다. */
function CabinShell({ vehicle, spec, mid }) {
  const half = spec.innerWidth / 2;
  const open = spec.roofY === null;
  const [topY, topZ] = glassEdge(spec, 1);
  const [baseY, baseZ] = glassEdge(spec, -1);
  const pillar = standing(baseY, baseZ, topY, topZ);
  // 필러는 유리 면에서 안쪽(눈 쪽) 으로 조금 물러나 앉는다. 유리와 겹치지 않는다.
  const inset = 0.05, nz = Math.cos(spec.glassAngle), ny = -Math.sin(spec.glassAngle);
  // 헤더는 유리 윗모서리 위에 얹는다. 아랫면이 아가리 위끝과 같아 시야를 먹지 않는다.
  // 유리면을 따라 올라가는 방향이 (0, cos, sin) 이고 눈 쪽 법선이 (0, -sin, cos) 다.
  // 눈에 가장 가까운 아래 모서리는 윗모서리에서 법선으로 HEADER_IN 만큼 간 자리다.
  const up = [Math.cos(spec.glassAngle), Math.sin(spec.glassAngle)];
  const headerY = topY + (HEADER / 2) * up[0] + (HEADER_IN / 2) * ny;
  const headerZ = topZ + (HEADER / 2) * up[1] + (HEADER_IN / 2) * nz;
  const floorZ = (spec.dashZ + spec.rear.z) / 2, floorDepth = spec.rear.z - spec.dashZ;
  const roofZ = (topZ + spec.rear.z) / 2, roofDepth = spec.rear.z - topZ;
  return <group>
    <Panel material={vehicle === 'truck' ? 'rubber' : 'fabric'}
      position={cabin(vehicle, [0, spec.floorY - 0.02, floorZ])} scale={[spec.innerWidth - 0.05, 0.04, floorDepth]} />
    {!open && <Panel material="fabric" position={cabin(vehicle, [0, spec.roofY + 0.02, roofZ])}
      scale={[spec.innerWidth - 0.07, 0.04, roofDepth]} />}
    {/* 앞유리 헤더다. 아랫면이 유리 윗모서리와 같아 아가리를 가리지 않는다. */}
    <Panel material="trim" position={cabin(vehicle, [0, headerY, headerZ])}
      scale={[spec.glass[3] - 0.04, HEADER, HEADER_IN]} rotation={[spec.glassAngle, 0, 0]} />
    {[-1, 1].map((side) => <Panel key={side} material="trim"
      position={cabin(vehicle, [side * spec.pillarX, pillar.y + ny * inset, pillar.z + nz * inset])}
      scale={[0.06, pillar.length, 0.08]} rotation={[pillar.angle, 0, 0]} />)}
    {spec.bPillarZ !== null && [-1, 1].map((side) => <Panel key={side} material="trim"
      position={cabin(vehicle, [side * (half - 0.015), (spec.sillY + spec.roofY) / 2, spec.bPillarZ])}
      scale={[0.05, spec.roofY - spec.sillY, 0.13]} />)}
    {/* 뒷벽이다. 승용차는 뒷좌석 등받이, 트럭은 적재함 앞면에 닿는 캡 뒷벽, 오픈카는 좌석 뒤 판이다. */}
    <Panel material={vehicle === 'truck' ? 'shell' : 'fabric'}
      position={cabin(vehicle, [0, spec.rear.y, spec.rear.z])}
      scale={[spec.rear.width, spec.rear.height, 0.12]} rotation={[vehicle === 'truck' ? 0 : -0.1, 0, 0]} />
    {/* A 필러 안쪽 천 마감 띠다. 민무늬 회색 판에 결을 한 줄 넣어 판 한 장으로 읽히지 않게 한다. */}
    {mid && [-1, 1].map((side) => <Panel key={`wrap${side}`} material="fabric"
      position={cabin(vehicle, [side * (spec.pillarX - 0.035), pillar.y + ny * inset, pillar.z + nz * inset + 0.045])}
      scale={[0.02, pillar.length - 0.04, 0.05]} rotation={[pillar.angle, 0, 0]} />)}
    {/* 헤더 안쪽 천 마감이다. 헤더 아랫면 뒤 모서리를 따라 한 줄만 간다. */}
    {mid && <Panel material="fabric" position={cabin(vehicle, [0, headerY - HEADER / 2 + 0.012, headerZ + HEADER_IN * 0.42])}
      scale={[spec.glass[3] - 0.12, 0.018, 0.03]} rotation={[spec.glassAngle, 0, 0]} />}
    {mid && <ShadeStrip position={cabin(vehicle, [0, spec.floorY + 0.14, floorZ - floorDepth / 2 + 0.03])}
      scale={[spec.innerWidth - 0.1, 0.28, 1]} />}
    {/* 헤더가 천장에 지우는 그림자다. 유리 아가리를 덮지 않도록 천장 면에 눕힌다. */}
    {mid && !open && <ShadeStrip position={cabin(vehicle, [0, spec.roofY - 0.004, topZ + 0.16])}
      rotation={[-HALF_PI, 0, 0]} scale={[spec.glass[3] - 0.1, 0.3, 1]} />}
  </group>;
}

/** 문 안쪽 판이다. 창틀 레일 아래 큰 판에 팔걸이와 도어 포켓을 붙이고 창 스위치를 하나 둔다.
 * 앞뒤 구간은 콘솔과 같은 자리를 쓰되 앞바퀴 집과 뒷좌석까지 조금 더 길다. */
function DoorCard({ vehicle, spec, side, mid, high }) {
  const x = side * (spec.innerWidth / 2);
  const depth = spec.console.depth + 0.36, z = spec.console.z;
  const height = spec.sillY - spec.floorY - 0.06;
  const armY = spec.sillY - 0.12;
  return <group>
    <Panel material="shell" position={cabin(vehicle, [x, spec.floorY + 0.03 + height / 2, z])}
      scale={[0.05, height, depth]} />
    <Panel material="trim" position={cabin(vehicle, [x - side * 0.01, spec.sillY, z])}
      scale={[0.07, 0.05, depth]} />
    {mid && <Panel material="leather" position={cabin(vehicle, [x - side * 0.045, armY, z - 0.06])}
      scale={[0.1, 0.06, depth * 0.44]} />}
    {mid && <Panel material="dark" position={cabin(vehicle, [x - side * 0.05, armY - 0.16, z - 0.02])}
      scale={[0.08, 0.16, depth * 0.34]} rotation={[0, 0, side * 0.12]} />}
    {mid && <PushButton position={cabin(vehicle, [x - side * 0.075, armY + 0.035, z - 0.06])}
      rotation={[HALF_PI, 0, 0]} size={0.026} />}
    {/* 어깨 라인 띠다. 창틀 레일 바로 아래를 한 줄 지나 문 안쪽 판을 위아래로 나눈다. */}
    {mid && <Panel material="trim" position={cabin(vehicle, [x - side * 0.022, spec.sillY - 0.055, z])}
      scale={[0.03, 0.022, depth * 0.94]} />}
    {/* 스피커 원이다. 납작한 노브 한 개라 원으로 읽힌다. */}
    {mid && <Knob position={cabin(vehicle, [x - side * 0.03, armY - 0.10, z + depth * 0.30])}
      rotation={[0, side * HALF_PI, 0]} radius={0.058} height={0.014} material="dark" pointer={false} />}
    {/* 도어 포켓 입구 띠다. 포켓 판 윗변을 따라가 주머니가 파인 것으로 읽힌다. */}
    {mid && <Panel material="trim" position={cabin(vehicle, [x - side * 0.055, armY - 0.085, z - 0.02])}
      scale={[0.05, 0.016, depth * 0.34]} />}
    {high && <GrabHandle position={cabin(vehicle, [x - side * 0.055, spec.sillY - 0.02, z - depth * 0.3])}
      rotation={[0, side * HALF_PI, 0]} length={0.16} />}
    {mid && <ShadeStrip position={cabin(vehicle, [x - side * 0.035, spec.floorY + 0.16, z])}
      rotation={[0, -side * HALF_PI, 0]} scale={[depth * 0.9, 0.3, 1]} />}
  </group>;
}

/** 대시다. 상판과 앞면을 각도가 다른 두 판으로 잇고 운전자 앞에만 계기 후드를 세운다.
 * 후드 입술은 눈에서 계기 윗모서리로 가는 시선보다 위에 두어 계기를 가리지 않는다. */
function Dashboard({ vehicle, spec, mid }) {
  const pad = lying(spec.dashTopY, spec.dashZ, spec.dashBreakY, spec.dashBreakZ);
  const face = standing(spec.dashFaceY, spec.dashFaceZ, spec.dashBreakY, spec.dashBreakZ);
  const hood = lying(spec.hoodY - 0.07, spec.hoodZ - 0.18, spec.hoodY, spec.hoodZ);
  const cluster = clusterSpan(spec);
  const glove = gloveBox(spec);
  // 앞면 판 좌표계다. 판을 세웠으므로 로컬 위쪽(+y) 이 (0, cos, sin) 으로 간다.
  const up = [Math.cos(face.angle), Math.sin(face.angle)];
  const onFace = (lift, out) => [face.y + up[0] * lift - up[1] * out, face.z + up[1] * lift + up[0] * out];
  const [gloveTopY, gloveTopZ] = onFace(glove.height / 2, 0.028);
  const [gloveMidY, gloveMidZ] = onFace(0, 0.028);
  return <group>
    <Panel material="shell" position={cabin(vehicle, [0, pad.y, pad.z])}
      scale={[spec.dashWidth, 0.05, pad.length]} rotation={[pad.angle, 0, 0]} />
    <Panel material="shell" position={cabin(vehicle, [0, face.y, face.z])}
      scale={[spec.dashWidth, face.length, 0.05]} rotation={[face.angle, 0, 0]} />
    <Panel material="trim" position={at(vehicle, [cluster.x, hood.y, hood.z])}
      scale={[cluster.width, 0.04, hood.length]} rotation={[hood.angle, 0, 0]} />
    {/* 조수석 에어백과 글로브박스 이음선이다. 얇은 홈이라 앞면 위에 한 줄만 긋는다. */}
    <Panel material="dark" position={cabin(vehicle, [glove.x, face.y + 0.03, face.z + 0.03])}
      scale={[spec.innerWidth * 0.32, 0.012, 0.03]} rotation={[face.angle, 0, 0]} />
    {/* 대시 상판과 앞면 사이 이음선이다. 두 판이 꺾이는 자리에 두께 0.012 띠를 한 줄 끼운다. */}
    {mid && <Panel material="trim" position={cabin(vehicle, [0, spec.dashBreakY - 0.015, spec.dashBreakZ + 0.03])}
      scale={[spec.dashWidth - 0.03, 0.012, 0.04]} />}
    {/* 글로브박스 윤곽이다. 위와 좌우 세 줄만 긋고 아래는 대시 밑선이 대신한다. */}
    {mid && <Panel material="dark" position={cabin(vehicle, [glove.x, gloveTopY, gloveTopZ])}
      scale={[glove.width, 0.012, 0.03]} rotation={[face.angle, 0, 0]} />}
    {mid && [-1, 1].map((side) => <Panel key={side} material="dark"
      position={cabin(vehicle, [glove.x + side * glove.width / 2, gloveMidY, gloveMidZ])}
      scale={[0.012, glove.height, 0.03]} rotation={[face.angle, 0, 0]} />)}
    {mid && <ShadeStrip position={cabin(vehicle, [0, spec.dashFaceY - 0.11, spec.dashFaceZ + 0.04])}
      scale={[spec.dashWidth - 0.06, 0.22, 1]} />}
  </group>;
}

/** 대시 양쪽 끝 에어벤트 둘이다. 센터 스택 것과 달리 운전자 바깥쪽을 향한다. */
function DashControls({ vehicle, spec }) {
  return <group>
    {spec.vents.map((vent) => <Knob key={`vent-${vent[0]}`} position={at(vehicle, vent)}
      radius={0.034} height={0.024} material="dark" />)}
  </group>;
}

/** 센터 스택이다. 계기판 아래 가운데에 송풍구 둘, 비상등, 공조 노브 셋을 한 덩어리로 모으고
 * 둘레에 금속 베젤 네 줄을 두른다. 예전에는 노브 줄만 평판 위에 떠 있어 주위에 아무것도
 * 없었다. 자리는 stackSpan 이 switches 와 hazard 에서 거꾸로 구한다. */
function CentreStack({ vehicle, spec, mid }) {
  const box = stackSpan(spec);
  const half = box.width / 2;
  return <group>
    {/* 판을 눕히지 않는다. 베젤과 노브, 버튼은 눈 기준 좌표를 그대로 쓰므로 판만 기울이면
        위아래 띠가 판 면에서 떨어진다. */}
    <Panel material="trim" position={at(vehicle, [box.x, box.y, box.z - 0.035])}
      scale={[box.width, box.height, 0.05]} />
    {mid && <>
      {/* 안쪽으로 한 단 들어간 검은 면이다. 노브와 버튼이 이 면 위에 선다. */}
      <Panel material="dark" position={at(vehicle, [box.x, box.y, box.z - 0.014])}
        scale={[box.width - 0.05, box.height - 0.05, 0.03]} />
      {[-1, 1].map((sign) => <Panel key={`h${sign}`} material="metal"
        position={at(vehicle, [box.x, box.y + sign * box.height / 2, box.z - 0.006])}
        scale={[box.width, 0.014, 0.022]} />)}
      {[-1, 1].map((sign) => <Panel key={`v${sign}`} material="metal"
        position={at(vehicle, [box.x + sign * half, box.y, box.z - 0.006])}
        scale={[0.014, box.height, 0.022]} />)}
      {/* 송풍구 둘이다. 비상등과 같은 줄 좌우에 놓아 대시가 얕은 차에서도 한 줄에 들어간다. */}
      {[-1, 1].map((sign) => <Panel key={`vent${sign}`} material="dark"
        position={at(vehicle, [box.x + sign * (half - 0.075), box.ventY, box.z])}
        scale={[0.11, 0.036, 0.022]} />)}
      {spec.switches.map((knob) => <Knob key={`knob-${knob[0]}`} position={at(vehicle, knob)}
        radius={0.024} height={0.02} material="metal" />)}
      <PushButton position={at(vehicle, spec.hazard)} size={0.032} lit material="warn" />
    </>}
  </group>;
}

/** 계기 둘 또는 셋과 그 사이 계기 화면이다. 숫자 눈금판을 쓰므로 mesh 눈금은 만들지 않는다.
 * 후드와 덮개 유리는 mid 부터 붙는다. */
function Cluster({ vehicle, spec, statusRef, night, mid }) {
  const speed = speedScale(VEHICLES[vehicle].top);
  const [speedAt, rpmAt, compassAt] = spec.dials;
  const [dx, dy, dz, width, height] = spec.display;
  return <group>
    <Dial get={() => statusRef?.current?.speed || 0} max={speed.max} numbers={speed.numbers}
      label="SPEED" unit="KM/H" hood={mid} radius={spec.dialRadius} position={at(vehicle, speedAt)} />
    <Dial get={() => statusRef?.current?.rpm || 0} max={MAX_RPM} numbers={RPM_NUMBERS}
      redline={REDLINE_RPM / MAX_RPM} label="RPM" unit="x1000" hood={mid}
      radius={spec.dialRadius} position={at(vehicle, rpmAt)} />
    {compassAt && <Dial get={() => Number(statusRef?.current?.heading) || 0} max={360} sweep={COMPASS_SWEEP}
      numbers={COMPASS_NUMBERS} label="HDG" unit="DEG" hood={mid}
      radius={spec.dialRadius} position={at(vehicle, compassAt)} />}
    <InstrumentDisplay mode="cluster" statusRef={statusRef} night={night}
      position={at(vehicle, [dx, dy, dz])} width={width} height={height} accent="#ffe3b0" />
  </group>;
}

/** 센터 콘솔이다. 트럭은 이 자리에 엔진 덮개가 솟으므로 TruckExtras 가 따로 그린다. */
function CentreConsole({ vehicle, spec, mid, high }) {
  const box = spec.console;
  const height = box.top - spec.floorY;
  return <group>
    <Panel material="shell" position={cabin(vehicle, [box.x, spec.floorY + height / 2, box.z])}
      scale={[box.width, height, box.depth]} />
    {mid && <Panel material="leather" position={cabin(vehicle, [box.x, box.top + 0.03, box.z + box.depth * 0.3])}
      scale={[box.width - 0.04, 0.06, box.depth * 0.34]} />}
    {mid && <Panel material="grip" position={cabin(vehicle, [box.x - box.width * 0.34, box.top + 0.06, box.z + box.depth * 0.06])}
      scale={[0.04, 0.05, 0.22]} rotation={[-0.5, 0, 0]} />}
    {mid && <GearLever position={cabin(vehicle, [box.x, box.top + 0.01, box.z - box.depth * 0.22])}
      get={() => 0.5} length={0.14} />}
    {high && [-0.055, 0.055].map((offset) => <Knob key={offset} material="dark"
      position={cabin(vehicle, [box.x + offset, box.top + 0.005, box.z + box.depth * 0.06])}
      rotation={[HALF_PI, 0, 0]} radius={0.046} height={0.05} pointer={false} />)}
  </group>;
}

/** 앞유리, 옆유리, 뒷유리다. 앞유리 각도는 외장과 같다. 비가 오면 빗방울 알파를 쓴다. */
function Glazing({ vehicle, spec, rain }) {
  const [, gy, gz, gw, gh] = spec.glass;
  const side = spec.sideGlass, rear = spec.rearGlass;
  return <group>
    {spec.pane && <GlassPane position={cabin(vehicle, [0, gy, gz])} rotation={[spec.glassAngle, 0, 0]}
      scale={[gw - 0.06, gh - 0.04, 1]} rain={rain} />}
    {side && [-1, 1].map((sign) => <GlassPane key={sign} position={cabin(vehicle, [sign * side[0], side[1], side[2]])}
      rotation={[0, sign * HALF_PI, 0]} scale={[side[3], side[4], 1]} />)}
    {rear && <GlassPane position={cabin(vehicle, [0, rear[1], rear[2]])} rotation={[rear[5], 0, 0]}
      scale={[rear[3], rear[4], 1]} />}
  </group>;
}

/** 룸미러 하우징과 스템이다. 화면에 뜨는 가상 거울은 Mirrors 가 따로 그린다. */
function MirrorPod({ vehicle, spec }) {
  const [topY, topZ] = glassEdge(spec, 1);
  return <group>
    <Panel material="trim" position={cabin(vehicle, [0, topY - 0.09, topZ + 0.04])} scale={[0.03, 0.06, 0.03]} />
    <Panel material="dark" position={cabin(vehicle, [0, topY - 0.13, topZ + 0.05])} scale={[0.2, 0.06, 0.05]} />
  </group>;
}

/** 방향지시등과 와이퍼 스토크 둘이다. 스티어링 컬럼 양쪽, 휠보다 뒤(먼 z) 에 붙어
 * 림 사이로 보인다. 휠보다 눈 쪽에 두면 림 앞을 가로지르는 막대로 보인다. */
function Stalks({ vehicle, spec }) {
  const wheel = spec.wheel, x = wheel.x || 0;
  return <group>
    {[-1, 1].map((side) => <Panel key={side} material="trim"
      position={at(vehicle, [x + side * 0.11, wheel.y - 0.035, wheel.z - 0.055])}
      scale={[0.17, 0.020, 0.020]} rotation={[0, 0, side * 0.30]} />)}
  </group>;
}

/** 세단만의 은색 트림 한 줄이다. 우드 트림은 두지 않는다. */
function SedanExtras({ spec, mid }) {
  const face = standing(spec.dashFaceY, spec.dashFaceZ, spec.dashBreakY, spec.dashBreakZ);
  return <group>
    <Panel material="metal" position={cabin('sedan', [0, face.y + 0.09, face.z + 0.035])}
      scale={[spec.dashWidth - 0.08, 0.018, 0.02]} rotation={[face.angle, 0, 0]} />
    {mid && <Panel material="trim" position={cabin('sedan', [0, spec.rear.y + 0.3, spec.rear.z + 0.16])}
      scale={[spec.rear.width, 0.06, 0.12]} />}
  </group>;
}

/** SUV 는 오버헤드 콘솔, 적재 공간 격벽, 은색 트림을 더 가진다. A 필러 손잡이는 high 다. */
function SuvExtras({ spec, mid, high }) {
  const pillar = standing(...glassEdge(spec, -1), ...glassEdge(spec, 1));
  const roofZ = roofPanelZ(spec);
  return <group>
    {/* 오버헤드 콘솔이다. 헤더 바로 뒤 천장에 붙어 지붕 높이를 따라간다. */}
    <Panel material="shell" position={cabin('suv', [0, spec.roofY - 0.04, roofZ])} scale={[0.34, 0.06, 0.3]} />
    <Panel material="glow" position={cabin('suv', [0, spec.roofY - 0.075, roofZ + 0.06])} scale={[0.1, 0.012, 0.08]} />
    <Panel material="fabric" position={cabin('suv', [0, spec.rear.y + 0.4, spec.rear.z + 0.5])}
      scale={[spec.innerWidth - 0.1, 0.05, 0.9]} />
    {mid && <Panel material="trim" position={cabin('suv', [0, spec.rear.y + 0.32, spec.rear.z + 0.14])}
      scale={[spec.rear.width, 0.06, 0.12]} />}
    {high && <GrabHandle position={cabin('suv', [spec.pillarX - 0.06, pillar.y + 0.1, pillar.z + 0.06])}
      rotation={[pillar.angle, HALF_PI, 0]} length={0.16} />}
  </group>;
}

/** 오픈카는 지붕과 B 필러가 없다. 발밑 킥 패널 둘과 좌석 뒤 바람막이가 특징이다.
 * 좌석, 롤바, 토노 커버, 앞유리 틀은 외장이 그리므로 여기서 다시 만들지 않는다. */
function ConvertibleExtras({ spec, mid, high }) {
  return <group>
    {[-1, 1].map((side) => <Panel key={side} material="trim"
      position={cabin('convertible', [side * (spec.innerWidth / 2 - 0.06), spec.floorY + 0.09, spec.dashZ + 0.16])}
      scale={[0.1, 0.18, 0.22]} rotation={[0, 0, side * 0.2]} />)}
    {mid && <Panel material="metal" position={cabin('convertible', [0, spec.deflector[1] - 0.11, spec.deflector[2]])}
      scale={[spec.deflector[3] + 0.04, 0.03, 0.04]} />}
    {mid && <GlassPane position={cabin('convertible', [0, spec.deflector[1], spec.deflector[2]])}
      scale={[spec.deflector[3], spec.deflector[4], 1]} />}
    {high && [-1, 1].map((side) => <Panel key={side} material="dark"
      position={cabin('convertible', [side * 0.34, spec.rear.y + 0.06, spec.rear.z - 0.14])}
      scale={[0.05, 0.14, 0.03]} />)}
  </group>;
}

/** 트럭 캡이다. 엔진 덮개가 좌석 사이에 솟고 그 위에 서류 상자와 컵홀더가 있다.
 * 계기 셋은 평평한 대시 위 받침판에 서고 CB 무전기와 마커등 스위치가 옆에 붙는다. */
function TruckExtras({ spec, mid, high }) {
  const box = spec.console;
  const height = box.top - spec.floorY;
  const cluster = clusterSpan(spec);
  return <group>
    {/* 계기 받침판이다. 계기 원판보다 뒤(먼 z) 에 서서 받침이 눈을 가리지 않는다. */}
    <Panel material="shell" position={at('truck', [cluster.x, spec.dials[0][1], spec.dials[0][2] - 0.03])}
      scale={[cluster.width, spec.dialRadius * 2 + 0.1, 0.05]} />
    <Panel material="trim" position={cabin('truck', [0, spec.rear.y + spec.rear.height / 2 + 0.05, spec.rear.z - 0.05])}
      scale={[spec.rear.width, 0.07, 0.1]} />
    <Panel material="shell" position={cabin('truck', [box.x, box.top - 0.03, box.z])} scale={[box.width, 0.06, box.depth]} />
    <Panel material="shell" position={cabin('truck', [box.x, spec.floorY + height / 2, box.z - box.depth / 2])}
      scale={[box.width, height, 0.06]} />
    {[-1, 1].map((side) => <Panel key={side} material="shell"
      position={cabin('truck', [box.x + side * box.width / 2, spec.floorY + height / 2, box.z])}
      scale={[0.06, height, box.depth]} />)}
    {/* CB 무전기와 마이크다. 대시 오른쪽 끝에 건다. */}
    <Panel material="dark" position={at('truck', [0.66, -0.30, -0.86])} scale={[0.18, 0.1, 0.08]} />
    <Panel material="grip" position={at('truck', [0.76, -0.38, -0.82])} scale={[0.05, 0.11, 0.04]} rotation={[0, 0, 0.3]} />
    {/* 마커등 스위치 판이다. 지붕이 올라갔으므로 대시가 아니라 머리 위 헤더 뒤에 붙는다. */}
    <Panel material="trim" position={at('truck', [0, spec.roofY - 0.05, roofPanelZ(spec)])}
      scale={[0.3, 0.05, 0.16]} />
    {mid && [-0.09, 0, 0.09].map((offset) => <Toggle key={offset}
      position={at('truck', [offset, spec.roofY - 0.082, roofPanelZ(spec)])}
      rotation={[HALF_PI, 0, 0]} on={offset > 0} />)}
    {mid && <Panel material="fabric" position={cabin('truck', [0, spec.rear.y + 0.16, spec.rear.z - 0.14])}
      scale={[spec.rear.width - 0.3, 0.05, 0.26]} />}
    {/* 변속 레버는 엔진 덮개 왼쪽 면에 선다. 승용차와 달리 콘솔이 없다. */}
    {mid && <GearLever position={cabin('truck', [box.x - box.width * 0.5 - 0.04, box.top - 0.12, box.z - 0.22])}
      get={() => 0.5} length={0.2} />}
    {/* 서류 상자와 컵홀더 둘이 엔진 덮개 위에 올라간다. */}
    {high && <Panel material="dark" position={cabin('truck', [box.x - 0.1, box.top + 0.06, box.z - 0.2])} scale={[0.24, 0.08, 0.32]} />}
    {high && [-0.06, 0.06].map((offset) => <Knob key={offset} material="dark"
      position={cabin('truck', [box.x + 0.18 + offset, box.top + 0.005, box.z + 0.18])}
      rotation={[HALF_PI, 0, 0]} radius={0.05} height={0.06} pointer={false} />)}
    {high && [-1, 1].map((side) => <GrabHandle key={side}
      position={cabin('truck', [side * (spec.innerWidth / 2 - 0.05), spec.sillY - 0.06, box.z - 0.4])}
      rotation={[0, side * HALF_PI, 0]} length={0.2} />)}
    {high && <Bolts points={[
      cabin('truck', [-0.5, spec.rear.y + 0.3, spec.rear.z - 0.07]),
      cabin('truck', [0.5, spec.rear.y + 0.3, spec.rear.z - 0.07]),
      cabin('truck', [-0.5, spec.rear.y - 0.3, spec.rear.z - 0.07]),
      cabin('truck', [0.5, spec.rear.y - 0.3, spec.rear.z - 0.07]),
    ]} radius={0.014} />}
  </group>;
}

const EXTRAS = { sedan: SedanExtras, suv: SuvExtras, convertible: ConvertibleExtras, truck: TruckExtras };

/** 승용차 계열 실내 한 벌이다. 네 차가 같은 뼈대를 쓰고 치수와 차별 조각만 다르다. */
function RoadCabin({ vehicle, statusRef, night = false, quality, weather }) {
  const spec = ROAD_CABINS[vehicle];
  const { mid, high } = detailLevel(quality);
  const wheel = spec.wheel, seats = spec.seats;
  const Extras = EXTRAS[vehicle];
  const rain = weather === 'rain';
  const [topY, topZ] = glassEdge(spec, 1);
  const [baseY, baseZ] = glassEdge(spec, -1);
  return <group>
    <Mirrors vehicle={vehicle} quality={quality} />
    <CabinLamp vehicle={vehicle} offset={[0.1, (spec.roofY ?? 0.1) - 0.08, -0.3]} intensity={night ? 0.3 : 0.1} color="#ffd7b3" distance={1.8} />
    <CabinShell vehicle={vehicle} spec={spec} mid={mid} />
    {[-1, 1].map((side) => <DoorCard key={side} vehicle={vehicle} spec={spec} side={side} mid={mid} high={high} />)}
    <Dashboard vehicle={vehicle} spec={spec} mid={mid} />
    <CentreStack vehicle={vehicle} spec={spec} mid={mid} />
    <Cluster vehicle={vehicle} spec={spec} statusRef={statusRef} night={night} mid={mid} />
    {vehicle !== 'truck' && <CentreConsole vehicle={vehicle} spec={spec} mid={mid} high={high} />}
    <Extras spec={spec} mid={mid} high={high} />
    {mid && <DashControls vehicle={vehicle} spec={spec} />}
    {mid && <Glazing vehicle={vehicle} spec={spec} rain={rain} />}
    {/* 스티어링은 운전자 정면이다. 손은 mid 부터 림을 쥔다. */}
    <Yoke get={() => (Number(statusRef?.current?.steer) || 0) * wheel.ratio} hands={mid}
      position={at(vehicle, [wheel.x || 0, wheel.y, wheel.z])} radius={wheel.radius} tilt={wheel.tilt} />
    {/* 스티어링 컬럼과 스토크 둘이다. 컬럼은 휠 뒤에서 대시로 들어가고 스토크는 그 좌우에 붙는다. */}
    {mid && <Panel material="dark" position={at(vehicle, [wheel.x || 0, wheel.y - 0.05, wheel.z - 0.14])}
      scale={[0.11, 0.11, 0.24]} rotation={[wheel.tilt + HALF_PI, 0, 0]} />}
    {mid && <Stalks vehicle={vehicle} spec={spec} />}
    {mid && <Pedals position={at(vehicle, spec.pedals)} count={2} spacing={0.16} />}
    {mid && seats && [seats.driverX, seats.passengerX].map((x) => <Seat key={x} material={seats.material}
      position={cabin(vehicle, [x, seats.y, seats.z])} width={seats.width} depth={seats.depth} height={0.56} />)}
    {mid && <Wipers get={() => wiperPhase(statusRef?.current?.weather || weather)}
      position={cabin(vehicle, [0, spec.wiper.y, spec.wiper.z])}
      rotation={[spec.glassAngle, 0, 0]} length={spec.wiper.length} gap={spec.wiper.gap} rest={-0.4} />}
    {high && spec.roofY !== null && [-1, 1].map((side) => <Panel key={side} material="fabric"
      position={cabin(vehicle, [side * spec.innerWidth * 0.22, topY - 0.05, topZ + 0.12])}
      scale={[spec.innerWidth * 0.36, 0.02, 0.2]} rotation={[0.9, 0, 0]} />)}
    {high && vehicle !== 'truck' && <MirrorPod vehicle={vehicle} spec={spec} />}
    {high && seats && [-1, 1].map((side) => <Panel key={side} material="fabric"
      position={cabin(vehicle, [side * spec.innerWidth * 0.24, spec.rear.y - 0.26, spec.rear.z - 0.3])}
      scale={[spec.innerWidth * 0.44, 0.1, 0.52]} />)}
    {/* 앞유리 밑선 음영이다. 대시와 유리가 만나는 자리를 어둡게 눌러 준다. */}
    {mid && <ShadeStrip position={cabin(vehicle, [0, baseY + 0.02, baseZ + 0.08])}
      rotation={[-1.2, 0, 0]} scale={[spec.glass[3] - 0.1, 0.16, 1]} />}
  </group>;
}

/** 운전석 전용 실내다. 탄 가죽 시트와 검정 대시, 은색 트림 한 줄이다. */
export function SedanInterior(props) {
  return <RoadCabin vehicle="sedan" {...props} />;
}

/** SUV 운전석이다. 대시가 깊고 오버헤드 콘솔과 적재 공간 격벽이 있으며 직물 시트다. */
export function SuvInterior(props) {
  return <RoadCabin vehicle="suv" {...props} />;
}

/** 오픈카 운전석이다. 지붕과 B 필러가 없고 좌석과 앞유리 틀은 외장 것을 그대로 쓴다. */
export function ConvertibleInterior(props) {
  return <RoadCabin vehicle="convertible" {...props} />;
}

/** 트럭 캡이다. 엔진 덮개가 좌석 사이에 솟고 계기가 셋이며 뒤창 없이 캡 뒷벽이 막는다. */
export function TruckInterior(props) {
  return <RoadCabin vehicle="truck" {...props} />;
}
