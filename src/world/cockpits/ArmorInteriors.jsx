import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bolts, CanopyArc, Dial, GlassPane, GrabHandle, Knob, Panel, Seat, Stick, Toggle, Yoke } from './parts.jsx';
import { MAX_RPM, REDLINE_RPM } from '../carGauges.js';
import { VEHICLES } from '../carPhysics.js';
import { GROUND_GUNS } from '../groundWeapons.js';
import { eyePoint } from '../eyePoints.js';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import { ARMOR_DIAL, GUNNER_CONSOLES } from './vehicleInteriorLayout.js';
import { CabinLamp } from './CabinLamp.jsx';
import { detailLevel } from './detail.js';

/** 전투 차량(전차, 자주포, 장갑차, 대공포) 1인칭 실내다. 전차, 자주포, 대공포는 포수가
 * 포탑 바스켓 왼쪽에 앉고 포탑이 곧 시점이다. CarMode 가 Cockpit 전체를 pivot
 * (GROUND_GUNS[vehicle].turret) 에 둔 group 으로 감싸 aim.yaw 로 돌리므로(포탑 dynamic
 * group 과 같은 값), 이 세 기종의 조각은 eyePoint 가 아니라 그 pivot 기준으로 그린다.
 * basket() 이 그 좌표를 만든다. 장갑차는 무인 포탑이 아니라 운전석 위 큐폴라에 차장이
 * 앉으므로 포탑과 함께 돌지 않는다(CarMode 도 armored 는 바스켓으로 감싸지 않는다).
 * hull() 이 그 좌표(eyePoint 기준, 회전 없음) 를 만든다.
 * aimRef 는 포탑 상대각, statusRef 는 carStatus() 값이다. 둘 다 매 프레임 ref 로 읽는다. */

const DEG = 180 / Math.PI;

/** pivot(바스켓 원점) 기준 좌표다. offset 은 eyeInBasket(눈 - pivot) 에 더하는 값이라
 * 예전 cabinLayout.js 의 at(vehicle, offset) 과 같은 감각으로 쓴다. 포탑이 aim.yaw 로 돌아도
 * 이 좌표들은 바스켓 group 의 자식이라 화면에서 그대로 있고, 바깥의 포신만 따로 움직인다.
 * 전차, 자주포, 대공포가 쓴다. */
function basket(vehicle, offset) {
  const { eyeInBasket } = GUNNER_CONSOLES[vehicle];
  return [eyeInBasket[0] + offset[0], eyeInBasket[1] + offset[1], eyeInBasket[2] + offset[2]];
}

/** eyePoint(vehicle) 기준 좌표다. 포탑을 따라 돌지 않는 장갑차 큐폴라가 쓴다. */
function hull(vehicle, offset) {
  const eye = eyePoint(vehicle);
  return [eye[0] + offset[0], eye[1] + offset[1], eye[2] + offset[2]];
}

/** 눈 기준 y 오프셋을 pivot 기준 절대 y 로 바꾼다. 바닥, 지붕, 벽처럼 x, z 는 pivot 기준
 * (walls AABB 원값) 인데 높이만 "눈 위/아래" 로 적어 둔 조각에 쓴다. x, z 까지 basket() 으로
 * 눈에 맞춰 옮기면(round 2 이전 버그) 벽이 눈을 따라다니며 커지거나 좁아진다. */
function eyeAbsY(vehicle, offset) {
  return GUNNER_CONSOLES[vehicle].eyeInBasket[1] + offset;
}

/** CabinLamp(WP1 소유) 는 eyePoint(vehicle) 에 offset 을 더한 자리에 켠다. 바스켓 group 안에서
 * 같은 자리를 켜려면 pivot 만큼 미리 빼 둬야 한다(eyePoint + (offset - pivot) = eyeInBasket + offset).
 * 장갑차는 바스켓이 없어 offset 을 그대로 쓴다(hull() 과 같은 기준이라 보정이 필요 없다). */
function lampOffset(vehicle, offset) {
  const { pivot } = GUNNER_CONSOLES[vehicle];
  return [offset[0] - pivot[0], offset[1] - pivot[1], offset[2] - pivot[2]];
}

/** 포신 앙각이다. 없으면 0 이다. AA 와 자주포의 앙각 계기, GunnerSight 의 앙각 표식이 함께 쓴다. */
function barrelAngle(aim) {
  const pitch = Number(aim?.pitch);
  return Number.isFinite(pitch) ? Math.max(0, pitch) : 0;
}

/** 포탑 상대각을 0~360 도로 감는다. 방위 다이얼과 GunnerSight 의 방위 표시가 함께 읽는다. */
function bearingDeg(aim) {
  const yaw = Number(aim?.yaw);
  if (!Number.isFinite(yaw)) return 0;
  return ((yaw * DEG) % 360 + 360) % 360;
}

/** GUNNER_CONSOLES[vehicle].walls(AABB 목록) 의 바깥 경계다. 바닥, 지붕 판 크기와 해치
 * 중심을 여기서 구한다. 벽과 같은 pivot 기준 원값이라 basket() 을 거치지 않는다. */
function wallsBounds(walls) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const wall of walls) {
    xMin = Math.min(xMin, wall.x[0]); xMax = Math.max(xMax, wall.x[1]);
    yMin = Math.min(yMin, wall.y[0]); yMax = Math.max(yMax, wall.y[1]);
    zMin = Math.min(zMin, wall.z[0]); zMax = Math.max(zMax, wall.z[1]);
  }
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}

/** 포탑 바스켓 외피다. round 2 이전에는 벽 좌표를 basket()(눈 기준) 으로 만들어 반지름이
 * 조금만 작아도(전차 0.55, 자주포 0.75) 눈이 벽 밖으로 나가거나(전차 실제 거리 0.67, 자주포
 * 0.91) 정면 각도 부호가 뒤집혀(대공포) 엉뚱한 벽이 뚫렸다. 지금은 GUNNER_CONSOLES 의
 * walls(pivot 기준 AABB, 외장 포탑 상자에서 구한 값) 를 그대로 그린다. 벽마다 Panel 하나고,
 * 전차와 자주포는 앞벽이 네 조각(위 아래 좌우) 이라 가운데가 뚫려 있다(조준경 개구부).
 * 대공포는 앞벽 자체가 목록에 없다(SkyWindow 가 유리로 채운다). 바닥, 지붕도 walls 의
 * x, z 경계를 그대로 쓴다. 해치 링(CanopyArc, high) 과 손잡이도 그 경계 중심에 둔다. */
/** 관측창이다. 불투명 벽 대신 유리 한 장과 둘레 프레임 네 줄을 세운다. 대공포처럼 좁은
 * 포탑에서는 눈 옆 30도에 선 흰 판 한 장이 화면 3분의 1을 민무늬로 덮는다. */
const WINDOW_FRAME = 0.035;
function ObservationWindow({ wall }) {
  const x = (wall.x[0] + wall.x[1]) / 2;
  const y = (wall.y[0] + wall.y[1]) / 2, height = wall.y[1] - wall.y[0];
  const z = (wall.z[0] + wall.z[1]) / 2, depth = wall.z[1] - wall.z[0];
  const thick = wall.x[1] - wall.x[0];
  return <group>
    <GlassPane position={[x, y, z]} rotation={[0, Math.PI / 2, 0]} scale={[depth, height, 1]} smudge={false} />
    {[-1, 1].map((side) => <Panel key={`v${side}`} material="trim"
      position={[x, y, z + side * (depth - WINDOW_FRAME) / 2]} scale={[thick, height, WINDOW_FRAME]} />)}
    {[-1, 1].map((side) => <Panel key={`h${side}`} material="trim"
      position={[x, y + side * (height - WINDOW_FRAME) / 2, z]} scale={[thick, WINDOW_FRAME, depth]} />)}
  </group>;
}

function BasketWalls({ vehicle, mid, high, roof = true }) {
  const { walls } = GUNNER_CONSOLES[vehicle];
  const { xMin, xMax, yMin, yMax, zMin, zMax } = wallsBounds(walls);
  const cx = (xMin + xMax) / 2, cz = (zMin + zMax) / 2;
  const wallY = (yMin + yMax) / 2, wallHeight = yMax - yMin, depth = zMax - zMin;
  return <group>
    <Panel material="dark" position={[cx, yMin, cz]} scale={[xMax - xMin, 0.03, zMax - zMin]} />
    {/* 대공포는 지붕을 통째로 덮지 않는다(roof=false). 뒤쪽 절반만 AntiAirInterior 가 따로
        그리고 앞쪽은 SkyWindow 가 맡는다(round 2 항목 5, 지붕이 천장창을 덮던 문제). */}
    {roof && <Panel material="white" position={[cx, yMax, cz]} scale={[xMax - xMin, 0.03, zMax - zMin]} />}
    {walls.map((wall, index) => (wall.glass
      ? <ObservationWindow key={index} wall={wall} />
      : <Panel key={index} material="white"
        position={[(wall.x[0] + wall.x[1]) / 2, (wall.y[0] + wall.y[1]) / 2, (wall.z[0] + wall.z[1]) / 2]}
        scale={[wall.x[1] - wall.x[0], wall.y[1] - wall.y[0], wall.z[1] - wall.z[0]]} />))}
    {/* 세로 보강 리브 셋이다. 민무늬 흰 판이 옆을 볼 때 판 한 장으로 읽히던 것을 이 결이 막는다. */}
    {mid && [-1, 1].flatMap((side) => [-0.3, 0, 0.3].map((along) => <Panel key={`rib${side}${along}`} material="trim"
      position={[side < 0 ? xMin + 0.04 : xMax - 0.04, wallY, cz + along * depth * 0.32]}
      scale={[0.035, wallHeight * 0.84, 0.05]} />))}
    {/* 배선 관이다. 오른쪽 벽 윗단을 따라 앞뒤로 지나는 얇고 긴 원통이다. */}
    {mid && <Knob position={[xMax - 0.07, yMax - 0.09, cz]} radius={0.022} height={depth - 0.12}
      material="dark" pointer={false} />}
    {/* 뒷벽 이음새 볼트 줄이다. */}
    {mid && <Bolts radius={0.011} points={[0, 1, 2, 3, 4, 5].map((index) => [
      xMin + 0.14 + index * ((xMax - xMin - 0.28) / 5), yMax - 0.07, zMax - 0.04,
    ])} />}
    {/* 천장 환기구와 등 하나다. 지붕이 통째로 있을 때만 걸 자리가 있다. */}
    {roof && mid && <Panel material="dark" position={[cx, yMax - 0.035, cz - depth * 0.16]} scale={[0.22, 0.03, 0.22]} />}
    {roof && mid && <Panel material="glow" position={[cx + 0.18, yMax - 0.032, cz + depth * 0.12]} scale={[0.14, 0.02, 0.09]} />}
    {/* 해치 링과 손잡이는 지붕이 통째로 있을 때만(roof) 의미가 있다. 대공포는 지붕 절반이
        비어 있어(위 roof prop) 이 자리에 걸 지붕이 없다. */}
    {roof && high && <CanopyArc position={[cx, yMax - 0.02, cz]} rotation={[Math.PI / 2, 0, 0]}
      radius={Math.min(xMax - xMin, zMax - zMin) * 0.28} thickness={0.012} sweep={Math.PI * 2} />}
    {roof && high && <GrabHandle position={[cx + 0.08, yMax - 0.06, cz - 0.04]} rotation={[0, 0, Math.PI / 2]} length={0.14} />}
  </group>;
}

/** 대공포 바스켓 정면 창이다. 앞벽이 아예 없는 자리(GUNNER_CONSOLES.aa.walls 참고) 에 큰
 * 앞창과, 그 위에서 뒤로 이어지는 기울어진 천장창을 둔다. 둘 사이는 두께 0.03 프레임
 * 한 줄만 남긴다. xRange, frontZ 는 옆벽 x 경계와 몸통 앞면이고 전부 pivot 기준 원값이다
 * (round 2 항목 1: 이전에는 isFrontArc 부호가 뒤집혀 눈 뒤(z=+r) 셋이 뚫리고 정면에 흰
 * 벽이 남았었다. 지금은 앞벽 자체가 목록에 없어 부호 문제가 생길 수 없다). topY, bottomY 는
 * 눈 기준 오프셋이라 eyeAbsY() 를 거친다. */
function SkyWindow({ vehicle, xRange, frontZ }) {
  const width = xRange[1] - xRange[0];
  const cx = (xRange[0] + xRange[1]) / 2;
  const topY = eyeAbsY(vehicle, 0.35), bottomY = eyeAbsY(vehicle, -0.15);
  const midY = (topY + bottomY) / 2;
  // 천장창은 앞창 위 모서리(topY, frontZ) 에서 시작해 기울기 tilt 로 뒤로 skyLength 만큼 눕는다.
  const tilt = 1.1, skyLength = 0.6;
  const skyY = topY + (skyLength / 2) * Math.cos(tilt);
  const skyZ = frontZ + (skyLength / 2) * Math.sin(tilt);
  return <group>
    <GlassPane position={[cx, midY, frontZ]} scale={[width, topY - bottomY, 1]} />
    <Panel material="trim" position={[cx, topY, frontZ]} scale={[width, 0.03, 0.03]} />
    <GlassPane position={[cx, skyY, skyZ]} rotation={[tilt, 0, 0]} scale={[width, skyLength, 1]} />
  </group>;
}

/** 포미 블록이다. GROUND_GUNS[vehicle].pivot(포신 회전축) 은 이미 바스켓 로컬 좌표라
 * basket() 을 거치지 않고 그대로 쓴다. 포탑이 돌아도 포신과 같은 바스켓 자식이라 함께 돈다.
 * twin 이면 대공포처럼 쌍열 포미 뿌리 두 개로 그리고 장전 손잡이를 생략한다(벨트 급탄이라
 * 사람이 손으로 밀어 넣지 않는다). */
function Breech({ vehicle, size, behind, twin = false }) {
  const [hx, hy, hz] = GROUND_GUNS[vehicle].pivot;
  const z = hz + behind;
  if (twin) {
    const barrels = GROUND_GUNS[vehicle].barrels || [0];
    return <group>
      {barrels.map((side) => <Panel key={side} material="metal" position={[hx + side, hy, z]} scale={size} />)}
      <Panel material="trim" position={[hx, hy, z + size[2] / 2 + 0.02]} scale={[size[0] * 2.6, size[1] * 0.55, 0.02]} />
    </group>;
  }
  return <group>
    <Panel material="metal" position={[hx, hy, z]} scale={size} />
    <Panel material="trim" position={[hx, hy + size[1] / 2 + 0.02, z]} scale={[size[0] + 0.06, 0.025, size[2] + 0.06]} />
    <Panel material="trim" position={[hx, hy - size[1] / 2 - 0.02, z]} scale={[size[0] + 0.06, 0.025, size[2] + 0.06]} />
    <GrabHandle position={[hx - size[0] / 2 - 0.05, hy, z - size[2] / 2 + 0.1]} rotation={[0, Math.PI / 2, 0]} length={0.12} />
  </group>;
}

/** 포수 조종 핸들이다. 오토바이 핸들처럼 좌우 한 쌍이다. 실제 전차 선회 핸들은 포탑 링에
 * 기어로 물려 있어 포탑이 도는 만큼 손잡이도 함께 돈다. GRIP_GEAR 는 그 배율이고, pitch 는
 * 앙각 레버처럼 기운다. 두 값 모두 시각용이고 실제 조준은 aimRef 가 그대로 맡는다. */
const GRIP_GEAR = 3.2;
function GunnerGrips({ vehicle, aimRef, x }) {
  const left = useRef();
  const right = useRef();
  useFrame(() => {
    const aim = aimRef?.current;
    if (!aim) return;
    const twist = aim.yaw * GRIP_GEAR;
    const tilt = aim.pitch * 0.6;
    if (left.current) { left.current.rotation.z = twist; left.current.rotation.x = tilt; }
    if (right.current) { right.current.rotation.z = twist; right.current.rotation.x = tilt; }
  });
  return <group>
    <Panel material="trim" position={basket(vehicle, [0, -0.06, -0.02])} scale={[x * 2, 0.03, 0.03]} />
    {[-1, 1].map((side) => <group key={side} ref={side < 0 ? left : right}
      position={basket(vehicle, [side * x, -0.06, -0.02])} userData={{ dynamic: true }}>
      <Panel material="grip" scale={[0.05, 0.09, 0.05]} />
      <Knob position={[0, 0.05, 0.03]} radius={0.014} height={0.02} />
    </group>)}
  </group>;
}

/** 사각 틀이다. 두께(thickness) 인 얇은 판 넷(위 아래 좌우) 으로 개구부 가장자리를 두르고
 * 가운데는 완전히 비운다. 앞뒤(원통 뚜껑) 를 두지 않으므로 개구부 안쪽은 늘 뚫려 있다.
 * halfWidth/halfHeight 가 개구부의 절반 크기다. GunnerSight 의 아이컵 틀, 대물 틀이 쓴다. */
const FRAME_BAR = 0.014;
function OpticFrame({ position, halfWidth, halfHeight, thickness = 0.012, material = 'dark' }) {
  return <group position={position}>
    <Panel material={material} position={[0, halfHeight + FRAME_BAR / 2, 0]} scale={[halfWidth * 2 + FRAME_BAR * 2, FRAME_BAR, thickness]} />
    <Panel material={material} position={[0, -halfHeight - FRAME_BAR / 2, 0]} scale={[halfWidth * 2 + FRAME_BAR * 2, FRAME_BAR, thickness]} />
    <Panel material={material} position={[halfWidth + FRAME_BAR / 2, 0, 0]} scale={[FRAME_BAR, halfHeight * 2, thickness]} />
    <Panel material={material} position={[-halfWidth - FRAME_BAR / 2, 0, 0]} scale={[FRAME_BAR, halfHeight * 2, thickness]} />
  </group>;
}

/** 포수 직사 조준경이다. 이름과 기능(방위 표시, 앙각 표식)은 기존 GunnerSight 를 그대로 잇는다.
 * 예전에는 속이 찬 상자(하우징) 와 뚜껑 있는 원통(관) 을 써서 화각 26도 폭을 통째로 막았다
 * (전차 42도 화각, 0.35m 앞 0.16 상자). 지금은 OpticFrame 둘(눈에 가까운 고무 아이컵 링,
 * 그 뒤 어두운 대물 틀) 만 두고 사이를 비워 관 속이 뚫려 있다. 개구부 반각은
 * GUNNER_CONSOLES 의 sight.halfWidth 가 이미 화각 반각의 0.6 배로 잡아 뒀다(sightHalfWidth).
 * 이마 받침과 손잡이, 표식은 모두 틀 바깥(반폭보다 먼 x, y) 이라 ±12도 안쪽을 건드리지
 * 않는다. tubeLength(두 틀 사이 거리) 로 전차(길다)와 자주포(짧다)를 구분한다. */
function GunnerSight({ vehicle, aimRef, elevationMax, tubeLength, high }) {
  const { sight } = GUNNER_CONSOLES[vehicle];
  const eyecup = basket(vehicle, [0, 0, -sight.distance]);
  const objective = basket(vehicle, [0, 0, -(sight.distance + tubeLength)]);
  const markerPos = basket(vehicle, [sight.halfWidth + 0.05, 0, -sight.distance]);
  const elevation = useRef();
  useFrame(() => {
    const aim = aimRef?.current;
    if (!elevation.current) return;
    elevation.current.position.y = (barrelAngle(aim) / elevationMax) * 0.10;
  });
  return <group>
    <OpticFrame position={eyecup} halfWidth={sight.halfWidth} halfHeight={sight.halfHeight} material="rubber" />
    <OpticFrame position={objective} halfWidth={sight.halfWidth} halfHeight={sight.halfHeight} material="dark" />
    {/* 이마 받침이다. 틀 위쪽 바깥에만 둬 중앙 시야를 가리지 않는다. */}
    <Panel material="rubber" position={basket(vehicle, [0, sight.halfHeight + 0.035, -sight.distance])}
      scale={[sight.halfWidth * 1.4, 0.03, 0.02]} />
    {high && <Knob position={markerPos} rotation={[0, Math.PI / 2, 0]} radius={0.014} height={0.02} />}
    <Panel material="trim" position={basket(vehicle, [sight.halfWidth + 0.05, 0, -sight.distance - 0.06])} scale={[0.01, 0.16, 0.01]} />
    <group ref={elevation} position={basket(vehicle, [sight.halfWidth + 0.05, 0, -sight.distance - 0.06])} userData={{ dynamic: true }}>
      <Panel material="glow" scale={[0.02, 0.02, 0.02]} />
    </group>
  </group>;
}

/** 대공포의 반사식 조준경이다. 직사 관이 아니라 얇은 금속 링(두께 0.008, 반지름 0.07,
 * 눈 앞 0.45) 과 그 안의 유리 한 장이다. 스코프 튜브가 아니라 열린 반사경이라 유리는
 * smudge 없이 맑게 둔다. 배율 손잡이는 high 부터 더한다. */
function ReflectorSight({ vehicle, high }) {
  const { sight } = GUNNER_CONSOLES[vehicle];
  const front = basket(vehicle, [0, 0, -sight.distance]);
  return <group position={front}>
    <GlassPane scale={[sight.halfWidth * 2, sight.halfHeight * 2, 1]} smudge={false} />
    <CanopyArc radius={sight.halfWidth} thickness={0.008} sweep={Math.PI * 2} />
    {high && <Knob position={[sight.halfWidth + 0.03, 0, 0.02]} rotation={[0, Math.PI / 2, 0]} radius={0.014} height={0.02} />}
  </group>;
}

/** 탄약과 부속 장비다. rounds 는 벽에 세운 포탄(또는 급탄) 거치대 수로 mid 부터 보인다.
 * high 는 소화기, 무전기 상자, 볼트 줄, 그물망 대신 쓰는 얇은 판까지 더한다. */
function AmmoBay({ vehicle, rounds, x, mid, high }) {
  return <group>
    {mid && Array.from({ length: rounds }, (_, index) => {
      const y = -0.30 + index * (0.5 / Math.max(1, rounds - 1));
      return <group key={index}>
        <Knob position={basket(vehicle, [x, y, -0.05])} radius={0.018} height={0.20} pointer={false} />
        <Panel material="warn" position={basket(vehicle, [x, y + 0.11, -0.05])} scale={[0.045, 0.02, 0.045]} />
      </group>;
    })}
    {high && <group>
      <Knob position={basket(vehicle, [x, 0.05, -0.30])} radius={0.03} height={0.18} material="warn" pointer={false} />
      <Panel material="dark" position={basket(vehicle, [-x, -0.05, -0.30])} scale={[0.16, 0.14, 0.08]} />
      <Knob position={basket(vehicle, [-x - 0.06, 0.02, -0.27])} radius={0.012} height={0.02} />
      <Knob position={basket(vehicle, [-x - 0.06, -0.03, -0.27])} radius={0.012} height={0.02} />
      <Toggle position={basket(vehicle, [-x + 0.03, 0.03, -0.26])} />
      <Toggle position={basket(vehicle, [-x + 0.07, 0.03, -0.26])} />
      <Bolts points={[0, 1, 2, 3, 4, 5].map((index) => basket(vehicle, [x - 0.02, -0.32 + index * 0.11, 0.05]))} radius={0.009} />
      <Panel material="dark" position={basket(vehicle, [0, -0.50, 0.15])} scale={[0.3, 0.012, 0.05]} />
    </group>}
  </group>;
}

/** 속도계 눈금이다. 최고 속도(km/h, top*3.6) 바로 위의 깔끔한 단위(20 또는 40)로 끊는다.
 * VEHICLES 의 top 이 바뀌어도 계기 눈금이 따라오도록 여기서 매번 다시 계산한다. */
function speedScale(top) {
  const kmh = top * 3.6;
  const step = kmh > 90 ? 40 : 20;
  const max = Math.ceil(kmh / step) * step;
  const numbers = [];
  for (let value = 0; value <= max; value += step) numbers.push(value);
  return { max, numbers };
}

/** 속도, rpm, 방위 세 계기와 사격 통제 화면이다. numbers 는 배열이라 20 이나 40 단위처럼
 * 깔끔한 눈금이 찍힌다. hood 는 medium 부터(유리 후드) 더한다. elevationDial 이 있는 기종은
 * 앙각 계기를 하나 더 그린다(barrelAngle 이름의 기능을 잇는다). */
function Gauges({ vehicle, statusRef, aimRef, top, elevationMax, elevationNumbers, mid, night }) {
  const { max: speedMax, numbers: speedNumbers } = speedScale(top);
  // console 은 전역 객체 이름과 겹쳐 desk 로 부른다(콘솔 데이터일 뿐 로그 객체가 아니다).
  const desk = GUNNER_CONSOLES[vehicle];
  const [speedPos, rpmPos, bearingPos] = desk.dials;
  return <group>
    <Dial get={() => statusRef?.current?.speed || 0} max={speedMax} numbers={speedNumbers} hood={mid}
      position={basket(vehicle, speedPos)} radius={ARMOR_DIAL.main} />
    <Dial get={() => statusRef?.current?.rpm || 0} max={MAX_RPM} redline={REDLINE_RPM / MAX_RPM}
      numbers={[0, 2000, 4000, 6000, 8000]} hood={mid} position={basket(vehicle, rpmPos)} radius={ARMOR_DIAL.main} />
    <Dial get={() => bearingDeg(aimRef?.current)} max={360} sweep={6.28} numbers={[0, 90, 180, 270, 360]}
      hood={mid} position={basket(vehicle, bearingPos)} radius={ARMOR_DIAL.bearing} />
    {desk.elevationDial && <Dial get={() => barrelAngle(aimRef?.current) * DEG} max={elevationMax}
      numbers={elevationNumbers} hood={mid} position={basket(vehicle, desk.elevationDial)} radius={ARMOR_DIAL.bearing} />}
    <InstrumentDisplay mode="fcs" statusRef={statusRef} night={night} accent="#9fd98a"
      position={basket(vehicle, desk.display.slice(0, 3))} rotation={[0.1, -0.12, 0]}
      width={desk.display[3]} height={desk.display[4]} />
    {desk.display2 && <InstrumentDisplay mode="fcs" statusRef={statusRef} night={night} accent="#8ad0e8"
      position={basket(vehicle, desk.display2.slice(0, 3))} rotation={[0.1, -0.12, 0]}
      width={desk.display2[3]} height={desk.display2[4]} />}
  </group>;
}

const CUPOLA_ANGLES = Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI * 2);

/** 장갑차 차장 큐폴라 관측대다. 눈높이 띠(±0.06, 슬릿 높이 0.11) 에 GlassPane 슬릿 8장을
 * 팔각으로 둘러 사방을 보게 하고, 슬릿 사이(각 슬릿에서 22.5도 어긋난 자리) 에 두께 0.03
 * 프레임 기둥을 세운다. 정면(각 0) 은 슬릿이라 ±12도 원칙이 그대로 트여 있다. */
function CupolaBand({ radius }) {
  const chord = 2 * radius * Math.sin(Math.PI / 8);
  const slitWidth = chord * 0.8;
  return <group>
    {CUPOLA_ANGLES.map((angle) => <GlassPane key={`slit-${angle}`}
      position={hull('armored', [Math.sin(angle) * radius, 0, Math.cos(angle) * radius])}
      rotation={[0, angle, 0]} scale={[slitWidth, 0.11, 1]} />)}
    {CUPOLA_ANGLES.map((angle) => {
      const post = angle + Math.PI / 8;
      return <Panel key={`post-${angle}`} material="trim"
        position={hull('armored', [Math.sin(post) * radius, 0, Math.cos(post) * radius])}
        rotation={[0, post, 0]} scale={[0.03, 0.13, 0.03]} />;
    })}
  </group>;
}

export function TankInterior({ statusRef, aimRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const top = VEHICLES.tank.top;
  return <group>
    {night && <CabinLamp vehicle="tank" offset={lampOffset('tank', [0, 0.20, -0.16])} />}
    <BasketWalls vehicle="tank" mid={mid} high={high} />
    <Breech vehicle="tank" size={[0.3, 0.3, 0.5]} behind={0.65} />
    {/* 직사 조준경이다. 관이 자주포보다 길다(전차는 직사, 자주포는 곡사라 조준선이 짧아도 된다). */}
    <GunnerSight vehicle="tank" aimRef={aimRef} elevationMax={0.5} tubeLength={0.34} high={high} />
    <GunnerGrips vehicle="tank" aimRef={aimRef} x={0.16} />
    <Gauges vehicle="tank" statusRef={statusRef} aimRef={aimRef} top={top} mid={mid} night={night} />
    <AmmoBay vehicle="tank" rounds={6} x={0.42} mid={mid} high={high} />
    {/* 페리스코프 3개 블록, 지붕 안쪽 앞이다. 조종수가 아니라 포수 자리에서 보이는 보조 관측창이다. */}
    {mid && [-0.16, 0, 0.16].map((x) => <group key={x}>
      <Panel material="dark" position={basket('tank', [x, GUNNER_CONSOLES.tank.roofY - 0.06, -0.5])} scale={[0.08, 0.04, 0.05]} />
      <GlassPane position={basket('tank', [x, GUNNER_CONSOLES.tank.roofY - 0.045, -0.475])} rotation={[1.3, 0, 0]} scale={[0.06, 0.03, 1]} />
    </group>)}
  </group>;
}

export function HowitzerInterior({ statusRef, aimRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const top = VEHICLES.howitzer.top;
  return <group>
    {night && <CabinLamp vehicle="howitzer" offset={lampOffset('howitzer', [0, 0.20, -0.16])} />}
    <BasketWalls vehicle="howitzer" mid={mid} high={high} />
    <Breech vehicle="howitzer" size={[0.32, 0.32, 0.55]} behind={0.70} />
    <GunnerSight vehicle="howitzer" aimRef={aimRef} elevationMax={1.05} tubeLength={0.22} high={high} />
    <GunnerGrips vehicle="howitzer" aimRef={aimRef} x={0.17} />
    <Gauges vehicle="howitzer" statusRef={statusRef} aimRef={aimRef} top={top}
      elevationMax={60} elevationNumbers={[0, 15, 30, 45, 60]} mid={mid} night={night} />
    {/* 장전기 트레이다. 자주포는 포탄이 길어 전차보다 거치대가 많다. */}
    <Panel material="metal" position={basket('howitzer', [-0.30, -0.30, -0.30])} scale={[0.38, 0.03, 0.16]} />
    <AmmoBay vehicle="howitzer" rounds={8} x={0.50} mid={mid} high={high} />
  </group>;
}

/** 장갑차 실내다. 무인 포탑 안에 포수를 앉히던 예전 설계를 버렸다(포탑 원통이 1인칭 화면
 * 왼쪽 0.3m 를 가득 채우고 화면 상자가 정면을 막던 문제). 차장이 운전석 위 큐폴라 해치에
 * 앉는다(eyePoints.armored). 실내는 basket() 이 아니라 hull()(eyePoint 기준, 포탑과 함께
 * 돌지 않는다) 로 그린다. 무인 포탑은 눈 뒤 오른쪽에 그대로 있어 뒤를 돌아보면 포신이 보인다. */
export function ArmoredInterior({ statusRef, aimRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const desk = GUNNER_CONSOLES.armored;
  const radius = desk.cupolaRadius;
  return <group>
    {night && <CabinLamp vehicle="armored" offset={[0, 0.16, -0.16]} />}
    <CupolaBand radius={radius} />
    {/* 해치 뚜껑 판이다. 눈 위 0.16. */}
    <Panel material="white" position={hull('armored', [0, desk.roofY, 0])} scale={[radius * 1.8, 0.03, radius * 1.8]} />
    {high && <GrabHandle position={hull('armored', [radius * 0.5, desk.roofY - 0.05, 0])} rotation={[0, 0, Math.PI / 2]} length={0.12} />}
    {/* 큐폴라 링(바닥) 과 차장 좌석이다. 링 볼트는 high 부터다. */}
    <CanopyArc position={hull('armored', [0, -0.08, 0])} rotation={[Math.PI / 2, 0, 0]} radius={radius * 0.95} thickness={0.012} sweep={Math.PI * 2} />
    {high && <Bolts points={[0, 1, 2, 3].map((index) => hull('armored',
      [Math.sin(index * Math.PI / 2) * radius * 0.95, -0.08, Math.cos(index * Math.PI / 2) * radius * 0.95]))} radius={0.008} />}
    <Seat position={hull('armored', [0, -0.48, 0.05])} width={0.40} depth={0.40} height={0.40} material="fabric" />
    {/* 사격 통제 화면과 방위 다이얼이다. 눈 아래 0.34, 앞 0.52(중앙 ±12도 밖). */}
    <InstrumentDisplay mode="fcs" statusRef={statusRef} night={night} accent="#9fd98a"
      position={hull('armored', desk.display.slice(0, 3))} rotation={[0.15, -0.12, 0]}
      width={desk.display[3]} height={desk.display[4]} />
    <Dial get={() => bearingDeg(aimRef?.current)} max={360} sweep={6.28} numbers={[0, 90, 180, 270, 360]}
      hood={mid} position={hull('armored', desk.dials[0])} radius={ARMOR_DIAL.bearing} />
    {/* 조이스틱이다. 사격 통제 콘솔 아래, 더 바깥이다. */}
    <group scale={0.55} position={hull('armored', [0, -0.50, -0.45])}>
      <Stick get={() => ({ pitch: aimRef?.current?.pitch || 0, roll: (aimRef?.current?.yaw || 0) * 0.2 })} limit={[0.5, 0.5]} />
    </group>
    {/* 운전석 대시와 스티어링이다. 앞쪽 아래에 둬 둘러볼 때만 보인다(포신 앙각 한계로도
        시선이 아래로 40도 안팎까지만 가므로 그 안에 둔다). */}
    <Panel material="shell" position={hull('armored', [0, -0.48, -0.60])} scale={[0.6, 0.28, 0.08]} />
    <Yoke get={() => (Number(statusRef?.current?.steer) || 0) * 2.2} position={hull('armored', [0, -0.42, -0.55])} radius={0.12} />
  </group>;
}

// 포탑 몸통 상자(외장 [0,0.3,0.1] scale [1.3,0.5,1.5]) 앞면이다. GUNNER_CONSOLES.aa.walls 에는
// 앞벽이 없어(round 2 항목 1) 여기서 SkyWindow 에 직접 넘긴다.
const AA_FRONT_Z = -0.625;
const AA_X_RANGE = [-0.60, 0.60];

/** 대공포 포수석이다. 장갑차와 같은 차륜 차대지만 위를 보는 천장창이 크고, 쌍열 포미 뿌리와
 * 반사식 조준경을 쓴다. 예전에는 팔각 벽 여덟 장이 정면까지 막아 조준 링 안과 화면 가장자리
 * 로만 밖이 보였다(그 뒤에는 isFrontArc 부호가 뒤집혀 눈 뒤 벽 셋이 뚫리고 정면에 흰 벽이
 * 그대로 남았었다). 지금은 GUNNER_CONSOLES.aa.walls 에 앞벽 자체가 없고 SkyWindow 가 큰
 * 앞창과 천장창으로 그 자리를 채운다. 옆과 뒤만 흰 벽으로 남는다. */
export function AntiAirInterior({ statusRef, aimRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const top = VEHICLES.aa.top;
  const barrels = GROUND_GUNS.aa.barrels || [0];
  return <group>
    {night && <CabinLamp vehicle="aa" offset={lampOffset('aa', [0, 0.22, -0.16])} />}
    <BasketWalls vehicle="aa" mid={mid} high={high} roof={false} />
    {/* 지붕은 뒤쪽 절반만이다(z 0 에서 뒷벽 0.78 까지, GUNNER_CONSOLES.aa.walls 의 뒷벽과
        같은 경계). 앞쪽(z<0, 정면 창 쪽) 은 SkyWindow 가 맡는다(round 2 항목 5, 지붕이
        천장창을 덮어 위를 봐도 지붕만 보이던 문제). */}
    <Panel material="white" position={[0, eyeAbsY('aa', GUNNER_CONSOLES.aa.roofY), 0.39]} scale={[1.2, 0.03, 0.78]} />
    <SkyWindow vehicle="aa" xRange={AA_X_RANGE} frontZ={AA_FRONT_Z} />
    <Breech vehicle="aa" size={[0.16, 0.16, 0.26]} behind={0.35} twin />
    <ReflectorSight vehicle="aa" high={high} />
    <GunnerGrips vehicle="aa" aimRef={aimRef} x={0.16} />
    <Gauges vehicle="aa" statusRef={statusRef} aimRef={aimRef} top={top}
      elevationMax={90} elevationNumbers={[0, 30, 60, 90]} mid={mid} night={night} />
    <AmmoBay vehicle="aa" rounds={6} x={0.44} mid={mid} high={high} />
    {/* 쌍열 포신 뿌리다. GROUND_GUNS.aa 의 회전축 자리에서 aimRef.pitch 로 기운다. 천장창 위로
        보이게 그대로 둔다(바깥의 진짜 포신과 짧게 겹쳐 실내에서도 뿌리가 보인다). */}
    <TwinBarrelRoots aimRef={aimRef} barrels={barrels} />
  </group>;
}

/** 대공포 쌍열 포신이 포탑 안쪽에서 시작하는 짧은 뿌리다. barrelPitch 를 그대로 읽어
 * 외장 포신과 같은 각도로 기운다. */
function TwinBarrelRoots({ aimRef, barrels }) {
  const ref = useRef();
  useFrame(() => {
    const aim = aimRef?.current;
    if (ref.current) ref.current.rotation.x = -barrelAngle(aim);
  });
  const [hx, hy, hz] = GROUND_GUNS.aa.pivot;
  return <group ref={ref} position={[hx, hy, hz]} userData={{ dynamic: true }}>
    {barrels.map((side) => <Knob key={side} position={[side, 0, 0.10]} radius={0.035} height={0.22} material="metal" pointer={false} />)}
  </group>;
}
