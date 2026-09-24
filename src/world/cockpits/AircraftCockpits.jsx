import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  AttitudeBall, Bolts, CanopyArc, CanopyShell, Dial, GearLever, GlassPane, GrabHandle, Knob,
  Lever, Panel, Pedals, PushButton, Quadrant, Seat, ShadeStrip, Stick, StickHand, Toggle, Yoke,
} from './parts.jsx';
import { BOX, MAT } from './materials.js';
import { detailLevel } from './detail.js';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import FighterHud from './FighterHud.jsx';
import { eyePoint } from '../eyePoints.js';
import {
  AIRCRAFT_PLACARDS, BOARD_OUT, BOARD_THICK, COCKPIT_FRAME, HUD_COMBINER, INSTRUMENT_OUT,
  LAMP_COLOUR, PLACARD, SCREEN_ACCENT, panelSlots, placardToggles,
} from './aircraftDetail.js';

/** 기종별 1인칭 실내다. 좌표는 각 기체 모델과 같은 로컬 공간이고 눈 위치는 eyePoints 가 정한다.
 * 치수는 전부 aircraftDetail.js 의 COCKPIT_FRAME 에서 나온다. 여기에 숫자를 직접 적지 않는다.
 *
 * statusRef 는 flightStatus() 값(0.15초 주기), poseRef 는 비행 상태 그대로(매 프레임, 라디안),
 * controlsRef 는 조종 입력이다. 셋 다 ref 라 부모가 다시 렌더하지 않아도 계기가 스스로 움직인다.
 *
 * 1인칭에서는 외장의 캐빈 group 이 꺼진다. 눈을 감싸는 면(바닥, 옆 벽, 뒤 격벽, 캐노피 유리)은
 * 전부 실내가 만든다. 하나라도 빠지면 그 방향으로 바깥이 그대로 보인다. */

const DEG2RAD = Math.PI / 180;

/** 눈 기준 좌표를 기체 로컬 좌표로 옮긴다. */
function deck(plane, offset) {
  const eye = eyePoint(plane) || [0, 0.8, -3];
  return [eye[0] + offset[0], eye[1] + offset[1], eye[2] + offset[2]];
}

/** 계기가 매 프레임 읽는 값이다. multiplier 는 0~1 비율을 퍼센트로, offset 은 음수 눈금을
 * 0 기준으로 옮긴다(V/S 의 0 이 눈금 한가운데다). */
const dialReader = (statusRef, spec) => () => (
  (Number(statusRef?.current?.[spec.field]) || 0) * (spec.multiplier || 1) + (spec.offset || 0)
);

/** 자세계가 읽는 각이다. poseRef 는 매 프레임 갱신되는 라디안이고 statusRef 는 0.15초마다 오는
 * 정수 도수라, 있으면 poseRef 를 먼저 쓴다. 둘 다 같은 부호 규약(기수를 들면 pitch 가 양수)이다. */
const attitudeReader = (poseRef, statusRef) => () => {
  const pose = poseRef?.current;
  if (pose && Number.isFinite(pose.pitch) && Number.isFinite(pose.roll)) return pose;
  const status = statusRef?.current || {};
  return { pitch: (Number(status.pitch) || 0) * DEG2RAD, roll: (Number(status.roll) || 0) * DEG2RAD };
};

/** 계기판 판 위의 좌표계다. 판을 뒤로 눕힌 group 하나를 두고 자식은 판 좌표(x, 위, 판 밖)로 적는다.
 * 세 축이 aircraftDetail 의 panelPlace 와 같은 식이라 테스트가 검사한 각이 화면 각과 같다.
 * three 의 x 축 +회전은 판의 법선을 아래로 돌리므로 눈을 향하려면 부호가 -여야 한다. */
function PanelFrame({ plane, children }) {
  const { panel } = COCKPIT_FRAME[plane];
  return <group position={deck(plane, [panel.x || 0, panel.y, panel.z])} rotation={[-panel.tilt, 0, 0]}>
    {children}
  </group>;
}

/** 계기판 받침이다. 받침 판을 계기 원판보다 먼 z(BOARD_OUT) 에 두는 것이 핵심이다.
 * 예전 배치는 받침 윗변이 계기보다 눈 쪽으로 나와 아랫줄 계기와 화면 아랫단을 가렸다.
 * 코밍은 캐노피 안쪽 폭까지만 둔 얇은 차양이고 그 아래에 접촉 그림자를 깐다.
 * low 판 3(받침, 코밍, 아래 스위치 띠), mid 그림자 2, high 볼트 6 */
function PanelBoard({ plane, mid, high }) {
  const { panel, canopy } = COCKPIT_FRAME[plane];
  const brow = Math.min(panel.halfWidth * 2, canopy.radius * 1.8);
  const foot = -panel.halfHeight - 0.04;
  return <group>
    <Panel material="shell" position={[0, 0, BOARD_OUT]}
      scale={[panel.halfWidth * 2, panel.halfHeight * 2, BOARD_THICK]} />
    <Panel material="trim" position={[0, panel.halfHeight + 0.035, 0.06]} rotation={[0.55, 0, 0]}
      scale={[brow, 0.025, 0.17]} />
    <Panel material="trim" position={[0, foot, 0.012]} scale={[panel.halfWidth * 1.5, 0.07, 0.05]} />
    {mid && <ShadeStrip position={[0, panel.halfHeight - 0.045, 0.006]} scale={[brow * 0.96, 0.10, 1]} />}
    {mid && <ShadeStrip position={[0, foot - 0.075, 0.006]} scale={[panel.halfWidth * 1.4, 0.09, 1]} />}
    {high && <Bolts radius={0.007} points={[-1, 1].flatMap((side) => [
      [side * (panel.halfWidth - 0.02), panel.halfHeight - 0.02, 0.004],
      [side * (panel.halfWidth - 0.02), 0, 0.004],
      [side * (panel.halfWidth - 0.02), -panel.halfHeight + 0.02, 0.004],
    ])} />}
  </group>;
}

/** 판에 얹는 계기다. 자리와 눈금 정의는 aircraftDetail 의 panelSlots 가 준다.
 * low 는 바늘과 mesh 눈금뿐이고 mid 부터 숫자 눈금판과 후드가 붙는다.
 * 6홀 가운데 위(ATT) 는 mid 에서 구형 자세계로 바뀐다. */
function Instruments({ plane, statusRef, poseRef, night, mid }) {
  const accent = SCREEN_ACCENT[plane];
  const attitude = attitudeReader(poseRef, statusRef);
  return <group>
    {panelSlots(plane).map((slot) => {
      const position = [slot.x, slot.up, INSTRUMENT_OUT];
      if (slot.kind === 'screen') {
        if (slot.tier === 'mid' && !mid) return null;
        return <InstrumentDisplay key={slot.id} mode={slot.mode} title={slot.title} statusRef={statusRef}
          night={night} position={position} width={slot.width} height={slot.height} accent={accent} />;
      }
      if (slot.kind === 'ball') return mid ? <AttitudeBall key={slot.id} get={attitude} position={position} radius={slot.radius} /> : null;
      if (slot.ball && mid) {
        return <AttitudeBall key={slot.id} get={attitude} position={[slot.ball.x, slot.ball.up, INSTRUMENT_OUT]} radius={slot.ball.radius} />;
      }
      const spec = slot.spec;
      return <Dial key={slot.id} get={dialReader(statusRef, spec)} max={spec.max} label={spec.label}
        unit={spec.unit} position={position} radius={slot.radius} danger={spec.danger ?? null}
        numbers={mid ? spec.numbers : null} redline={mid ? (spec.redline ?? null) : null} hood={mid} />;
    })}
  </group>;
}

/** 조종석 상자다. 바닥, 앞 격벽, 옆 벽, 뒤 격벽 넉 장이 눈을 감싼다.
 * mid 에서 캐노피 반원통 유리와 활 프레임, 레일, 손잡이가 붙는다.
 * low 판 5, mid 판 2(레일) + 유리 1 + 활 2 + 그림자 1 + 손잡이 1, high 활 1 */
function Tub({ plane, mid, high }) {
  const { tub, panel, canopy } = COCKPIT_FRAME[plane];
  const x = tub.x || 0;
  // 옆 벽과 바닥은 캐노피 유리 앞 끝까지 간다. 계기판에서 끊으면 유리 밑선 아래 앞쪽이
  // 뚫려 옆을 볼 때 잔디가 그대로 보이고 사이드 콘솔이 허공에 뜬 것처럼 읽힌다.
  const front = Math.min(canopy.z - canopy.length / 2 + 0.04, panel.z + 0.03);
  const length = tub.rear - front, middle = (tub.rear + front) / 2;
  const panelFoot = panel.y - panel.halfHeight * Math.cos(panel.tilt);
  const noseTop = tub.noseTop ?? panelFoot;
  const arcs = canopy.arcs.slice(0, high ? 3 : 2);
  return <group>
    <Panel material="grip" position={deck(plane, [x, tub.floor, middle])}
      scale={[tub.halfWidth * 2, 0.05, length]} />
    <Panel material="shell" position={deck(plane, [x, (tub.floor + noseTop) / 2, panel.z + 0.03])}
      scale={[tub.halfWidth * 2, noseTop - tub.floor, 0.05]} />
    {[-1, 1].map((side) => <Panel key={side} material="shell"
      position={deck(plane, [x + side * tub.halfWidth, (tub.floor + tub.wallTop) / 2, middle])}
      scale={[0.05, tub.wallTop - tub.floor, length]} />)}
    <Panel material="shell" position={deck(plane, [x, (tub.floor + tub.wallTop) / 2 + 0.12, tub.rear])}
      scale={[tub.halfWidth * 2, tub.wallTop - tub.floor + 0.24, 0.05]} />
    {mid && <>
      {/* 납작하고 넓은 캐노피(폭격기) 는 반원통으로 벽까지 덮을 수 없다. 평면 유리 지붕과
          가로 프레임으로 대신한다. 나머지 기종은 반원통과 활 프레임이다. */}
      {canopy.flat
        ? <GlassPane position={deck(plane, [canopy.x, canopy.y, canopy.z])} rotation={[-Math.PI / 2, 0, 0]}
          scale={[canopy.radius * 2, canopy.length, 1]} smudge={false} />
        : <CanopyShell position={deck(plane, [canopy.x, canopy.y, canopy.z])}
          radius={canopy.radius} length={canopy.length} segments={12} />}
      {arcs.map((z) => (canopy.flat
        ? <Panel key={z} material="trim" position={deck(plane, [canopy.x, canopy.y, z])}
          scale={[canopy.radius * 2, 0.03, 0.05]} />
        : <CanopyArc key={z} position={deck(plane, [canopy.x, canopy.y, z])}
          radius={canopy.radius + 0.012} thickness={0.016} />))}
      {/* 캐노피 레일이다. 유리 가장자리를 따라 좌우로 한 줄씩 간다. 눈에서 0.6m 라
          0.035 폭이면 3.4도짜리 밝은 띠가 되므로 가늘게 두고 밝은 metal 대신 trim 을 쓴다. */}
      {[-1, 1].map((side) => <Panel key={side} material="trim"
        position={deck(plane, [canopy.x + side * canopy.radius, canopy.y, canopy.z])}
        scale={[0.022, 0.02, canopy.length * 0.9]} />)}
      {/* 바닥 접촉 그림자와 캐노피 잠금 손잡이다. */}
      <ShadeStrip position={deck(plane, [x, tub.floor + 0.14, middle - length * 0.3])}
        rotation={[-Math.PI / 2, 0, 0]} scale={[tub.halfWidth * 1.8, length * 0.5, 1]} />
      <GrabHandle position={deck(plane, [canopy.x + canopy.radius * 0.75, canopy.y + canopy.radius * 0.5, canopy.z + canopy.length * 0.18])}
        rotation={[0, Math.PI / 2, 0]} length={0.16} />
    </>}
  </group>;
}

/** 사출좌석이다. low 는 방석, 등받이, 헤드박스 판 세 장이고 mid 에서 좌석 조각과
 * 어깨 벨트 두 줄, 무릎 두 개로 바뀐다. 무릎은 고개를 숙이면 화면 아래에 들어온다.
 * low 판 3, mid 좌석 1 + 판 4(벨트 2, 무릎 2) - 판 3 */
function PilotSeat({ plane, seat, mid, material = 'fabric', knees = true }) {
  if (!mid) {
    return <group>
      <Panel material="grip" position={deck(plane, [seat.x, seat.y - 0.03, seat.z])} scale={[seat.width, 0.06, seat.depth]} />
      <Panel material="grip" position={deck(plane, [seat.x, seat.y + seat.height * 0.46, seat.z + seat.depth * 0.5])}
        scale={[seat.width, seat.height, 0.07]} rotation={[0.14, 0, 0]} />
      <Panel material="grip" position={deck(plane, [seat.x, seat.y + seat.height * 0.96, seat.z + seat.depth * 0.5 + 0.04])}
        scale={[seat.width * 0.44, 0.14, 0.09]} />
    </group>;
  }
  return <group>
    <Seat position={deck(plane, [seat.x, seat.y, seat.z])} width={seat.width} depth={seat.depth}
      height={seat.height} material={material} />
    {[-1, 1].map((side) => <Panel key={side} material="dark"
      position={deck(plane, [seat.x + side * seat.width * 0.24, seat.y + seat.height * 0.40, seat.z + seat.depth * 0.40])}
      scale={[0.05, seat.height * 0.80, 0.014]} rotation={[0.2, 0, side * 0.07]} />)}
    {knees && [-1, 1].map((side) => <Panel key={`knee${side}`} material="sleeve"
      position={deck(plane, [seat.x + side * seat.width * 0.36, seat.y + 0.12, seat.z - seat.depth - 0.1])}
      scale={[0.15, 0.16, 0.40]} rotation={[0.22, 0, 0]} />)}
  </group>;
}

/** 팔걸이 콘솔이다. 오른쪽 콘솔 위에 명판을 눕히고 라벨 칸마다 토글을 세운다.
 * 회로 차단기는 왼쪽 콘솔이고 high 에서만 나온다.
 * low 판 2 + 명판 1, mid 토글 4 + 그림자 2 + 노브 2, high 버튼 6 */
function Consoles({ plane, mid, high, sides = [-1, 1] }) {
  const { side: rail } = COCKPIT_FRAME[plane];
  return <group>
    {sides.map((sign) => <Panel key={sign} material="shell"
      position={deck(plane, [sign * rail.x, rail.y - 0.05, rail.z])}
      scale={[rail.width, 0.10, rail.length]} rotation={[0, 0, sign * 0.06]} />)}
    <SwitchPlacard plane={plane} />
    {mid && placardToggles().map(([x, z], index) => <Toggle key={index}
      position={deck(plane, [rail.x + x, rail.y + 0.02, rail.z + z])} rotation={[-Math.PI / 2, 0, 0]}
      on={index % 2 === 0} />)}
    {mid && sides.map((sign) => <ShadeStrip key={sign}
      position={deck(plane, [sign * rail.x, rail.y - 0.11, rail.z])} rotation={[0, sign * Math.PI / 2, 0]}
      scale={[rail.length, 0.12, 1]} />)}
    {mid && [0, 1].map((index) => <Knob key={index}
      position={deck(plane, [-rail.x + (index - 0.5) * 0.07, rail.y + 0.02, rail.z + rail.length * 0.28])}
      rotation={[-Math.PI / 2, 0, 0]} radius={0.022} height={0.022} />)}
    {high && [0, 1, 2, 3, 4, 5].map((index) => <PushButton key={index}
      position={deck(plane, [-rail.x + ((index % 3) - 1) * 0.045, rail.y + 0.01, rail.z - rail.length * (0.18 + Math.floor(index / 3) * 0.1)])}
      rotation={[-Math.PI / 2, 0, 0]} size={0.026} lit={index === 1} />)}
  </group>;
}

/** 스로틀이다. low 는 레버뿐이고 mid 에서 슬롯이 있는 쿼드런트와 왼손이 붙는다.
 * 프로펠러기는 스로틀, 혼합비, 프로펠러 피치 세 레버, 폭격기는 4발 엔진 레버 넷이다. */
function Throttle({ plane, spot, get, knobs, stroke = 0.34, lowLevers = 1, mid }) {
  const base = deck(plane, [spot.x, spot.y, spot.z]);
  if (!mid) {
    return <group>
      {knobs.slice(0, lowLevers).map((knob, index) => <Lever key={index} get={index === 0 ? get : undefined}
        value={index === 0 ? undefined : 0.45} knob={knob} stroke={stroke}
        position={[base[0] + (index - (lowLevers - 1) / 2) * 0.12, base[1], base[2]]} />)}
    </group>;
  }
  const width = 0.09 * knobs.length + 0.05;
  return <group>
    <Quadrant position={base} width={width} levers={knobs.map((knob, index) => ({
      get: index === 0 ? get : undefined, value: index === 0 ? undefined : 0.45, knob, stroke,
    }))} />
    {/* 왼손은 첫 레버 그립 위에 정적으로 둔다. 레버가 움직여도 손은 따라가지 않는다. */}
    <StickHand position={[base[0] - width / 2 + width / (knobs.length * 2), base[1] + 0.19, base[2] - stroke * 0.45]} />
  </group>;
}

/** 랜딩기어 레버다. 손잡이 위에 빨간 캡을 얹어 다른 레버와 구분한다. mid 판 1 + 기어 1 */
function GearHandle({ plane, spot }) {
  const base = deck(plane, [spot.x, spot.y, spot.z]);
  return <group>
    <GearLever position={base} length={0.14} />
    <Panel material="warn" position={[base[0], base[1] + 0.175, base[2]]} scale={[0.055, 0.045, 0.055]} />
  </group>;
}

/** Revi 형 반사식 조준기다. 하우징 상자, 뒤로 기운 유리, 발광 십자 둘이다. 프로펠러기가 쓴다.
 * 요격기는 같은 자리에 combiner 를 두고 십자 대신 HUD 사다리를 얹는다. low 판 4 */
function ReviSight({ plane, sight }) {
  const glass = deck(plane, [0, sight.y, sight.z]);
  // 하우징 윗면이 유리 밑변에 닿게 놓는다. 유리보다 위로 올라오면 조준선을 하우징이 먹는다.
  const mount = sight.y - sight.height / 2 - sight.housing[1] / 2;
  return <group>
    <Panel material="dark" position={deck(plane, [0, mount, sight.z + 0.03])} scale={sight.housing} />
    <Panel material="glass" position={glass} scale={[sight.width, sight.height, 0.008]} rotation={[sight.tilt, 0, 0]} />
    <Panel material="glow" position={[glass[0], glass[1], glass[2] + 0.004]} scale={[sight.width * 0.5, 0.004, 0.004]} />
    <Panel material="glow" position={[glass[0], glass[1], glass[2] + 0.004]} scale={[0.004, sight.height * 0.5, 0.004]} />
  </group>;
}

/** HUD combiner 다. 옅은 녹색 유리 한 장과 그 둘레를 두르는 얇은 금속 프레임 네 줄이다.
 * 예전에는 위아래 틀만 low 에 있고 좌우가 mid 라 두꺼운 회색 상자로 보였다. 네 줄을 모두
 * low 로 내리고 두께를 0.016 에서 0.010(요격기 0.009) 으로 줄여 유리가 먼저 읽히게 했다.
 * 사다리 평면은 유리와 같은 크기라 상이 유리 밖 허공에 뜨지 않는다. low 판 5, mid 그림자 1 */
function HudCombiner({ plane, poseRef, statusRef, mid }) {
  const hud = HUD_COMBINER[plane];
  const [x, y, z] = deck(plane, hud.position);
  const [width, height] = hud.glass;
  const edge = hud.frame;
  return <group position={[x, y, z]} rotation={[-hud.tilt, 0, 0]}>
    <Panel material="hudGlass" position={[0, 0, 0]} scale={[width, height, 0.006]} />
    {[-1, 1].map((sign) => <Panel key={sign} material="metal"
      position={[0, sign * (height / 2 + edge / 2), 0]} scale={[width + edge * 2, edge, 0.014]} />)}
    {[-1, 1].map((sign) => <Panel key={`v${sign}`} material="metal"
      position={[sign * (width / 2 + edge / 2), 0, 0]} scale={[edge, height, 0.014]} />)}
    <FighterHud poseRef={poseRef} statusRef={statusRef} weapons={hud.weapons} plane={plane}
      position={[0, 0, 0.006]} width={hud.plane[0]} height={hud.plane[1]} />
    {mid && <ShadeStrip position={[0, -height / 2 - edge - 0.03, 0.01]} scale={[width, 0.06, 1]} />}
  </group>;
}

/** 오버헤드 패널이다. 폭격기와 헬기 머리 위에 있고 high 에서 스위치가 붙는다.
 * low 판 1, high 토글 6 + 노브 2(폭격기만) */
function Overhead({ plane, panel, high, rotaries = 0 }) {
  return <group>
    <Panel material="trim" position={deck(plane, [panel.x, panel.y, panel.z])}
      scale={[panel.width, 0.04, panel.depth]} rotation={[0.12, 0, 0]} />
    {high && [0, 1, 2, 3, 4, 5].map((index) => <Toggle key={index}
      position={deck(plane, [panel.x + ((index % 3) - 1) * 0.16, panel.y - 0.03, panel.z + (Math.floor(index / 3) - 0.5) * 0.14])}
      rotation={[Math.PI / 2, 0, 0]} on={index % 2 === 1} />)}
    {high && Array.from({ length: rotaries }, (_, index) => <Knob key={`k${index}`}
      position={deck(plane, [panel.x + (index - 0.5) * 0.24, panel.y - 0.035, panel.z - panel.depth * 0.34])}
      rotation={[Math.PI / 2, 0, 0]} radius={0.026} height={0.024} />)}
  </group>;
}

/** 코 위 덮개다. 외장 동체 lathe 는 면이 한 겹이라 조종석 안에서는 뒷면이 잘려 보이지 않는다.
 * 눈앞에 기수가 있는 기종은 실내가 이 덮개를 그려야 코 없이 하늘만 보이지 않는다.
 * 눕히지 않고 평평하게 둔다. 기울이면 가까운 쪽이 코밍 뒤로 숨거나 조준선을 가린다. mid 판 1 */
function NoseDeck({ plane, deckSpec }) {
  return <Panel material="shell" position={deck(plane, [0, deckSpec.y, deckSpec.z])}
    scale={[deckSpec.width, 0.05, deckSpec.depth]} />;
}

const PLACARD_GEOMETRY = new THREE.PlaneGeometry(1, 1);
const PLACARD_MATERIALS = new Map();

/** 기종별 스위치 명판 하나다. 기능명만 적고 없는 상태나 센서 수치를 만들어 내지 않는다.
 * 정적 텍스처와 재질은 기종별로 하나씩만 캐시되어 프레임마다 할당하거나 다시 그리지 않는다. */
function placardMaterial(plane) {
  const cached = PLACARD_MATERIALS.get(plane);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const spec = AIRCRAFT_PLACARDS[plane];
  if (!spec) return null;
  const canvas = document.createElement('canvas');
  const size = PLACARD.canvas;
  canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#151c20'; ctx.fillRect(0, 0, size.width, size.height);
  ctx.strokeStyle = '#849398'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, size.width - 4, size.height - 4);
  ctx.fillStyle = '#d5c989'; ctx.font = '700 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText(spec.title, size.width / 2, 22);
  spec.labels.forEach((label, index) => {
    const column = index % 2, row = Math.floor(index / 2);
    const x = size.x + column * size.stepX, y = size.y + row * size.stepY;
    ctx.fillStyle = '#29363a'; ctx.fillRect(x, y, size.cell[0], size.cell[1]);
    ctx.strokeStyle = '#728184'; ctx.lineWidth = 1; ctx.strokeRect(x, y, size.cell[0], size.cell[1]);
    ctx.fillStyle = '#b9cbb6'; ctx.font = '14px monospace'; ctx.textAlign = 'left'; ctx.fillText(label, x + 28, y + 20);
    ctx.fillStyle = '#9d5743'; ctx.beginPath(); ctx.arc(x + 14, y + 14, 5, 0, Math.PI * 2); ctx.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: '#332f1e', emissiveMap: texture, emissiveIntensity: 0.16, roughness: 0.62 });
  PLACARD_MATERIALS.set(plane, material);
  return material;
}

/** 명판은 오른쪽 콘솔 위에 눕는다. 평면의 위쪽이 앞(-z) 으로 가므로 토글 자리도 같은 규약이다. */
function SwitchPlacard({ plane }) {
  const material = useMemo(() => placardMaterial(plane), [plane]);
  const { side: rail } = COCKPIT_FRAME[plane];
  if (!material) return null;
  return <mesh geometry={PLACARD_GEOMETRY} material={material}
    position={deck(plane, [rail.x, rail.y + 0.002, rail.z])} rotation={[-Math.PI / 2, 0, 0]}
    scale={[PLACARD.width, PLACARD.height, 1]} />;
}

/** 계기판 위 실내등이다. 코밍 밑에 두어 계기판과 조종간이 아래에서 빛을 받는다.
 * distance 를 좁혀 도시까지 새지 않게 하고 그림자 맵을 늘리지 않는다. 광원은 이것 하나뿐이다. */
function PanelLamp({ plane, colour, intensity = 0.6 }) {
  const { panel } = COCKPIT_FRAME[plane];
  return <pointLight position={deck(plane, [panel.x || 0, panel.y + panel.halfHeight + 0.06, panel.z + 0.18])}
    color={colour} intensity={intensity} distance={2.4} castShadow={false} />;
}

/** 폭탄창 스위치 세 칸이다. 가운데 칸이 bayOpen 여부에 따라 켜지고 꺼진다. 재질
 * 자체가 바뀌는 유일한 실내 장식이라 StaticBatch 대상에서 빼고 직접 material 을 바꾼다. */
function BaySwitches({ plane, statusRef }) {
  const meshes = useRef([null, null, null]);
  const { panel } = COCKPIT_FRAME[plane];
  useFrame(() => {
    const open = !!statusRef?.current?.bayOpen;
    meshes.current.forEach((mesh, index) => {
      if (!mesh) return;
      const material = open && index === 1 ? MAT.glow : MAT.trim;
      if (mesh.material !== material) mesh.material = material;
    });
  });
  return <group position={deck(plane, [panel.x || 0, panel.y, panel.z])} rotation={[-panel.tilt, 0, 0]} userData={{ dynamic: true }}>
    {[-0.07, 0, 0.07].map((x, index) => <mesh key={x} ref={(node) => { meshes.current[index] = node; }}
      geometry={BOX} material={MAT.trim} position={[0.24 + x, -0.13, INSTRUMENT_OUT]} scale={[0.055, 0.045, 0.03]} />)}
  </group>;
}

/** 제트다. 요크가 아니라 중앙 스틱을 쓰는 일반 항공 배치이고, 좌우 콘솔이 좁다.
 * 앞유리 틀은 캐노피 앞쪽에 기둥 둘과 윗보 하나로 세운다. */
export function JetCockpit({ statusRef, controlsRef, poseRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const frame = COCKPIT_FRAME.jet;
  const windscreen = frame.windscreen;
  return <group>
    {night && <PanelLamp plane="jet" colour={LAMP_COLOUR.jet} />}
    <Tub plane="jet" mid={mid} high={high} />
    <PanelFrame plane="jet">
      <PanelBoard plane="jet" mid={mid} high={high} />
      <Instruments plane="jet" statusRef={statusRef} poseRef={poseRef} night={night} mid={mid} />
    </PanelFrame>
    <PilotSeat plane="jet" seat={frame.seat} mid={mid} />
    <Consoles plane="jet" mid={mid} high={high} />
    {/* 앞유리 틀이다. 외장 캐노피가 1인칭에서 꺼지므로 창틀은 실내가 그린다. */}
    {[-1, 1].map((side) => <Panel key={side} material="trim"
      position={deck('jet', [side * frame.canopy.radius * 0.72, frame.canopy.y + frame.canopy.radius * 0.36, windscreen])}
      scale={[0.045, frame.canopy.radius * 0.8, 0.05]} rotation={[0, 0, side * 0.42]} />)}
    <Panel material="trim" position={deck('jet', [0, frame.canopy.y + frame.canopy.radius * 0.92, windscreen])}
      scale={[frame.canopy.radius * 1.5, 0.045, 0.05]} />
    <Stick get={() => controlsRef?.current} position={deck('jet', [frame.stick.x, frame.stick.y, frame.stick.z])} hand={mid} />
    <Throttle plane="jet" spot={frame.throttle} get={() => statusRef?.current?.throttle} knobs={['#c8562f']} mid={mid} />
    {mid && <Pedals position={deck('jet', [frame.pedals.x, frame.pedals.y, frame.pedals.z])} count={2} spacing={0.2} />}
    {mid && <GearHandle plane="jet" spot={{ x: -frame.side.x, y: frame.side.y + 0.03, z: frame.side.z - frame.side.length * 0.36 }} />}
    {mid && <NoseDeck plane="jet" deckSpec={frame.deck} />}
  </group>;
}

/** 폭격기다. 기장석이 왼쪽이고 오른쪽에 빈 부기장석이 있다. 요크 둘, 중앙 4발 스로틀,
 * 오버헤드 패널, 폭탄창 스위치 세 칸이다. */
export function BomberCockpit({ statusRef, controlsRef, poseRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const frame = COCKPIT_FRAME.bomber;
  const copilot = { ...frame.seat, x: 0.92 };
  return <group>
    {night && <PanelLamp plane="bomber" colour={LAMP_COLOUR.bomber} intensity={0.7} />}
    <Tub plane="bomber" mid={mid} high={high} />
    <PanelFrame plane="bomber">
      <PanelBoard plane="bomber" mid={mid} high={high} />
      <Instruments plane="bomber" statusRef={statusRef} poseRef={poseRef} night={night} mid={mid} />
    </PanelFrame>
    <BaySwitches plane="bomber" statusRef={statusRef} />
    <PilotSeat plane="bomber" seat={frame.seat} mid={mid} />
    {/* 부기장석은 빈 좌석이다. 무릎과 손은 두지 않는다. */}
    <PilotSeat plane="bomber" seat={copilot} mid={mid} knees={false} />
    <Consoles plane="bomber" mid={mid} high={high} sides={[-1]} />
    <Overhead plane="bomber" panel={frame.overhead} high={high} rotaries={2} />
    {/* 두 좌석 사이 중앙 콘솔이다. 스로틀 쿼드런트가 그 위에 앉는다. */}
    <Panel material="shell" position={deck('bomber', [frame.side.x, frame.throttle.y - 0.12, frame.throttle.z])}
      scale={[0.34, 0.2, 0.46]} />
    <Yoke get={() => controlsRef?.current?.roll} position={deck('bomber', [frame.yoke.x, frame.yoke.y, frame.yoke.z])}
      radius={frame.yoke.radius} hands={mid} />
    {mid && <Yoke get={() => controlsRef?.current?.roll} position={deck('bomber', [copilot.x, frame.yoke.y, frame.yoke.z])} radius={frame.yoke.radius} />}
    <Throttle plane="bomber" spot={frame.throttle} get={() => statusRef?.current?.throttle}
      knobs={['#c8562f', '#c8562f', '#c8562f', '#c8562f']} lowLevers={2} mid={mid} />
    {mid && <Pedals position={deck('bomber', [frame.pedals.x, frame.pedals.y, frame.pedals.z])} count={2} spacing={0.24} />}
    {mid && <GearHandle plane="bomber" spot={{ x: frame.side.x + 0.2, y: frame.throttle.y, z: frame.throttle.z + 0.2 }} />}
    {mid && <NoseDeck plane="bomber" deckSpec={frame.deck} />}
    {/* 좌우 옆 창이다. 벽 윗단에서 유리 지붕까지 한 장으로 덮는다. 지붕이 벽선까지 오므로
        예전처럼 창 위를 메우는 어깨 판이 필요 없다. */}
    {mid && [-1, 1].map((side) => <GlassPane key={side}
      position={deck('bomber', [frame.tub.x + side * frame.tub.halfWidth, frame.window.y, frame.canopy.z])}
      rotation={[0, Math.PI / 2, 0]} scale={[frame.window.length, frame.window.height, 1]} />)}
  </group>;
}

/** 프로펠러 전투기다. interior green 실내에 크고 검은 계기 여섯, Revi 형 반사 조준기,
 * 왼쪽 벽 3레버 쿼드런트(스로틀, 혼합비, 프로펠러 피치), 버블 캐노피다.
 * 랜딩기어가 고정식이라 기어 레버가 없다. */
export function PropCockpit({ statusRef, controlsRef, poseRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const frame = COCKPIT_FRAME.prop;
  return <group>
    {night && <PanelLamp plane="prop" colour={LAMP_COLOUR.prop} intensity={0.5} />}
    <Tub plane="prop" mid={mid} high={high} />
    <PanelFrame plane="prop">
      <PanelBoard plane="prop" mid={mid} high={high} />
      <Instruments plane="prop" statusRef={statusRef} poseRef={poseRef} night={night} mid={mid} />
      {/* 코밍 밑 오른쪽에 매단 자석 나침반이다. 판 좌표라 계기판과 같이 기운다. */}
      <Panel material="dark" position={[frame.compass.x, frame.compass.up, frame.compass.out - 0.04]} scale={[0.05, 0.05, 0.06]} />
      {mid && <Knob position={[frame.compass.x, frame.compass.up, frame.compass.out]} radius={frame.compass.radius} height={0.03} />}
    </PanelFrame>
    <PilotSeat plane="prop" seat={frame.seat} mid={mid} material="leather" />
    <Consoles plane="prop" mid={mid} high={high} />
    <ReviSight plane="prop" sight={frame.sight} />
    {/* 왼쪽 벽 쿼드런트 받침이다. 레버 셋이 이 판 위에서 움직인다. */}
    <Panel material="trim" position={deck('prop', [frame.throttle.x - 0.03, frame.throttle.y - 0.06, frame.throttle.z])}
      scale={[0.07, 0.12, 0.42]} />
    <Stick get={() => controlsRef?.current} position={deck('prop', [frame.stick.x, frame.stick.y, frame.stick.z])}
      limit={[0.3, 0.44]} hand={mid} />
    <Throttle plane="prop" spot={frame.throttle} get={() => statusRef?.current?.throttle}
      knobs={['#c9a227', '#b03a3a', '#2f6fb0']} mid={mid} />
    {mid && <Pedals position={deck('prop', [frame.pedals.x, frame.pedals.y, frame.pedals.z])} count={2} spacing={0.18} />}
    {mid && <NoseDeck plane="prop" deckSpec={frame.deck} />}
  </group>;
}

/** 전투기다. 중앙 스틱과 왼쪽 HOTAS 스로틀, 정사각 MFD 둘, combiner HUD, UFC 키패드다. */
export function FighterCockpit({ statusRef, controlsRef, poseRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const frame = COCKPIT_FRAME.fighter;
  return <group>
    {night && <PanelLamp plane="fighter" colour={LAMP_COLOUR.fighter} intensity={0.45} />}
    <Tub plane="fighter" mid={mid} high={high} />
    <PanelFrame plane="fighter">
      <PanelBoard plane="fighter" mid={mid} high={high} />
      <Instruments plane="fighter" statusRef={statusRef} poseRef={poseRef} night={night} mid={mid} />
      {/* UFC 키패드 받침이다. high 에서 버튼 열두 개가 격자로 붙는다. */}
      <Panel material="dark" position={[0.34, -0.02, INSTRUMENT_OUT - 0.004]} scale={[0.13, 0.15, 0.02]} />
      {high && Array.from({ length: 12 }, (_, index) => <PushButton key={index}
        position={[0.34 + ((index % 3) - 1) * 0.038, 0.036 - Math.floor(index / 3) * 0.034, INSTRUMENT_OUT + 0.008]}
        size={0.03} lit={index === 0} />)}
    </PanelFrame>
    <PilotSeat plane="fighter" seat={frame.seat} mid={mid} />
    <Consoles plane="fighter" mid={mid} high={high} />
    {/* 다리 사이 중앙 페데스탈이다. 스틱이 그 앞에서 올라온다. */}
    <Panel material="shell" position={deck('fighter', [0, frame.stick.y + 0.08, frame.stick.z + 0.12])} scale={[0.2, 0.22, 0.26]} />
    <HudCombiner plane="fighter" poseRef={poseRef} statusRef={statusRef} mid={mid} />
    {/* 중앙 스틱이다. HOTAS 라 그립이 굵다. */}
    <Stick get={() => controlsRef?.current} position={deck('fighter', [frame.stick.x, frame.stick.y, frame.stick.z])}
      limit={[0.34, 0.5]} hand={mid} />
    <Throttle plane="fighter" spot={frame.throttle} get={() => statusRef?.current?.throttle} knobs={['#c8562f']} mid={mid} />
    {mid && <Pedals position={deck('fighter', [frame.pedals.x, frame.pedals.y, frame.pedals.z])} count={2} spacing={0.2} />}
    {mid && <GearHandle plane="fighter" spot={{ x: -frame.side.x, y: frame.side.y + 0.03, z: frame.side.z - frame.side.length * 0.34 }} />}
    {mid && <NoseDeck plane="fighter" deckSpec={frame.deck} />}
  </group>;
}

/** 요격기다. 좁은 캐노피에 RLM 66 계열 회색 계기판, 유리 반사 조준기,
 * 연료계가 있는 유일한 기종이다. 사다리는 전투기와 같은 FighterHud 가 그린다. */
export function InterceptorCockpit({ rideKey = 'interceptor', statusRef, controlsRef, poseRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const frame = COCKPIT_FRAME.interceptor;
  return <group>
    {night && <PanelLamp plane="interceptor" colour={LAMP_COLOUR.interceptor} intensity={0.5} />}
    <Tub plane="interceptor" mid={mid} high={high} />
    <PanelFrame plane="interceptor">
      <PanelBoard plane="interceptor" mid={mid} high={high} />
      <Instruments plane="interceptor" statusRef={statusRef} poseRef={poseRef} night={night} mid={mid} />
    </PanelFrame>
    <PilotSeat plane="interceptor" seat={frame.seat} mid={mid} />
    <Consoles plane="interceptor" mid={mid} high={high} />
    {/* combiner 유리 아랫단에 붙는 조준기 마운트다. 이 한 조각만 남겨야 계기판이 보인다. */}
    <Panel material="dark" position={deck('interceptor', [0, frame.sight.y, frame.sight.z])} scale={frame.sight.housing} />
    <HudCombiner plane={rideKey} poseRef={poseRef} statusRef={statusRef} mid={mid} />
    <Stick get={() => controlsRef?.current} position={deck('interceptor', [frame.stick.x, frame.stick.y, frame.stick.z])}
      limit={[0.32, 0.46]} hand={mid} />
    <Throttle plane="interceptor" spot={frame.throttle} get={() => statusRef?.current?.throttle} knobs={['#c8562f']} mid={mid} />
    {mid && <Pedals position={deck('interceptor', [frame.pedals.x, frame.pedals.y, frame.pedals.z])} count={2} spacing={0.18} />}
    {mid && <GearHandle plane="interceptor" spot={{ x: -frame.side.x, y: frame.side.y + 0.03, z: frame.side.z - frame.side.length * 0.34 }} />}
  </group>;
}

/** 헬기다. 중앙 사이클릭, 왼쪽 콜렉티브, 페달, 발밑 유리와 그 틀, 오버헤드 패널,
 * 좌우 문 창이다. 앞유리 중앙 기둥은 외장에 있으므로 여기서 다시 그리지 않는다. */
export function HelicopterCockpit({ statusRef, controlsRef, poseRef, night = false, quality = 'medium' }) {
  const { mid, high } = detailLevel(quality);
  const frame = COCKPIT_FRAME.helicopter;
  const chin = frame.chin, door = frame.door;
  const windscreen = [0, frame.canopy.y + frame.canopy.radius * 0.5, frame.canopy.z - frame.canopy.length * 0.42];
  return <group>
    {night && <PanelLamp plane="helicopter" colour={LAMP_COLOUR.helicopter} />}
    <Tub plane="helicopter" mid={mid} high={high} />
    <PanelFrame plane="helicopter">
      <PanelBoard plane="helicopter" mid={mid} high={high} />
      <Instruments plane="helicopter" statusRef={statusRef} poseRef={poseRef} night={night} mid={mid} />
    </PanelFrame>
    <PilotSeat plane="helicopter" seat={frame.seat} mid={mid} />
    <Consoles plane="helicopter" mid={mid} high={high} />
    <Overhead plane="helicopter" panel={frame.overhead} high={high} />
    {/* 발밑 유리다. 계기판 아랫변에서 코 아래로 흘러내린다. 틀 세 개가 유리를 문다. */}
    <Panel material="glass" position={deck('helicopter', [0, chin.y, chin.z])}
      scale={[chin.width, chin.depth, 0.006]} rotation={[chin.tilt, 0, 0]} />
    {[-1, 1].map((side) => <Panel key={side} material="trim"
      position={deck('helicopter', [side * chin.width * 0.52, chin.y, chin.z])}
      scale={[0.04, chin.depth, 0.04]} rotation={[chin.tilt, 0, 0]} />)}
    <Panel material="trim" position={deck('helicopter', [0, chin.y - chin.depth * 0.5 * Math.cos(chin.tilt), chin.z - chin.depth * 0.5 * Math.sin(chin.tilt)])}
      scale={[chin.width, 0.04, 0.05]} />
    {/* 다리 사이 중앙 페데스탈이다. 무전기와 사이클릭 마운트가 여기 있다. */}
    <Panel material="shell" position={deck('helicopter', [0, frame.stick.y + 0.1, frame.stick.z - 0.14])} scale={[0.22, 0.24, 0.2]} />
    <Stick get={() => controlsRef?.current} position={deck('helicopter', [frame.stick.x, frame.stick.y, frame.stick.z])}
      limit={[0.26, 0.34]} hand={mid} />
    {/* 콜렉티브는 왼쪽 바닥에서 올라오는 긴 레버다. mid 에서 트위스트 그립이 붙는다. */}
    <Lever get={() => statusRef?.current?.throttle} stroke={0.42} knob="#3f6f52"
      position={deck('helicopter', [frame.collective.x, frame.collective.y, frame.collective.z])} />
    {mid && <Knob position={deck('helicopter', [frame.collective.x, frame.collective.y + 0.2, frame.collective.z - 0.12])}
      rotation={[0, Math.PI / 2, 0]} radius={0.028} height={0.05} material="grip" />}
    {mid && <StickHand position={deck('helicopter', [frame.collective.x, frame.collective.y + 0.19, frame.collective.z - 0.19])} />}
    {mid && <Pedals position={deck('helicopter', [frame.pedals.x, frame.pedals.y, frame.pedals.z])} count={2} spacing={0.22} />}
    {mid && <Quadrant position={deck('helicopter', [frame.overhead.x, frame.overhead.y - 0.06, frame.overhead.z + frame.overhead.depth * 0.3])}
      rotation={[Math.PI, 0, 0]} width={0.22} levers={[{ value: 0.8, knob: '#b8452f' }, { value: 0.8, knob: '#b8452f' }]} />}
    {/* 좌우 문 창이다. 문틀은 tub 의 옆 벽이 맡는다. */}
    {mid && [-1, 1].map((side) => <GlassPane key={side}
      position={deck('helicopter', [side === 1 ? door.x : frame.tub.x * 2 - door.x, door.y, door.z])}
      rotation={[0, Math.PI / 2, 0]} scale={[door.width, door.height, 1]} />)}
    {/* 앞유리 유리판을 따로 두지 않는다. 캐노피 반원통(CanopyShell) 이 이미 유리 한 장이라
        같은 자리에 평면을 겹치면 눈앞 1.2m 에 폭 24도짜리 뿌연 사각형이 하나 더 생긴다.
        틀은 기둥 하나로 충분하다. */}
    {/* 앞유리 중앙 기둥이다. 외장 기둥(0.08 x 1.2 x 0.5) 은 1인칭에서 숨으므로 실내가
        얇은 것으로 다시 세운다. 깊이 0.04 라 눈앞 1.2m 에서 2도 폭이다. */}
    {mid && <Panel material="metal" position={deck('helicopter', [0, windscreen[1] - 0.06, windscreen[2] + 0.01])}
      scale={[0.04, 1.0, 0.04]} rotation={[0.3, 0, 0]} />}
  </group>;
}
