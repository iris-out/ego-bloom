import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DIAL_SEGMENTS, DIAL_TICKS } from './triangles.js';
import {
  DIAL_FACE, DIAL_SWEEP, DIAL_TEXT, dialAngle, dialFaceAngle, dialFaceNumbers, dialFacePoint,
  dialNumberSize, dialNumberStride,
} from './dialScale.js';
import { MAT, registerPanelEmissive } from './materials.js';
import { GLASS_RAIN, GLASS_SMUDGE, refreshRain } from './glassTexture.js';
import StaticBatch from '../StaticBatch.jsx';

/** 콕핏 실내 공용 조각이다. 시각만 맡는다. 키보드, 카메라, 네트워크, 상태 전이를
 * 이곳에 넣지 않는다. material 은 모듈 스코프에서 한 번 만들어 전 기종이 공유한다.
 * 프레임마다 geometry 나 material 을 새로 만들지 않는다.
 *
 * 좌표는 three 규약이다. x 가 오른쪽, y 가 위, +z 가 눈 쪽이고 진행 방향이 -z 다. */

const NEEDLE_SEGMENTS = 3;

/** status 는 0.15초 주기로만 갱신되므로 값을 그대로 쓰면 바늘이 계단처럼 튄다.
 * 지수 감쇠로 프레임률과 무관하게 따라가고, 프레임 하나가 길어도 튀지 않게 막는다. */
const MAX_STEP = 0.05;
function approach(current, target, damping, delta) {
  return current + (target - current) * (1 - Math.exp(-Math.min(delta, MAX_STEP) * damping));
}

const canvas2d = (width, height) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
};

const sRGBTexture = (canvas) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** 눈금은 원판 면에 붙어 정면에서만 보이므로 평면 한 장이면 된다. 박스로 깔면
 * 뒷면과 옆면이 보이지 않는데도 계기당 144 삼각형을 먹어 계기가 많은 기종이 예산을 넘는다. */
const TICK_RADIUS = 0.87;
const TICK_WIDTH = 0.05;
const TICK_LENGTH = 0.12;
const TICK_LENGTH_END = 0.22;

const GEO = {
  dialFace: new THREE.CircleGeometry(1, DIAL_SEGMENTS),
  dialBezel: new THREE.CylinderGeometry(1, 1, 0.08, DIAL_SEGMENTS, 1, true),
  // 바깥 금속 링이다. 검은 테보다 크고 깊어 원판이 한 단 안으로 들어가 보인다.
  dialRing: new THREE.CylinderGeometry(1.09, 1.09, 0.17, DIAL_SEGMENTS, 1, true),
  // 후드는 위쪽만 덮는 반원통 챙이다. 축을 z 로 눕히면 theta pi/2 에서 pi 만큼이 위쪽 반이고
  // 아래는 열린 채로 남아 계기 아랫부분을 가리지 않는다.
  dialHood: new THREE.CylinderGeometry(1.12, 1.12, 0.36, DIAL_SEGMENTS / 2, 1, true, Math.PI / 2, Math.PI),
  dialGlass: new THREE.CircleGeometry(1.0, DIAL_SEGMENTS),
  // 바늘은 끝으로 갈수록 가늘어지는 삼각 기둥이다. 면 하나가 눈을 보게 돌려 두었고
  // 삼각형 수는 예전 상자와 같은 12 다.
  needle: new THREE.CylinderGeometry(0.014, 0.05, 0.80, 3).rotateY(Math.PI / 3),
  hub: new THREE.CylinderGeometry(0.15, 0.15, 0.07, NEEDLE_SEGMENTS * 3),
  box: new THREE.BoxGeometry(1, 1, 1),
  rim: new THREE.TorusGeometry(1, 0.09, 8, 20),
  tick: new THREE.PlaneGeometry(1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  // 노브와 볼트는 축이 +z 다. 미리 돌려 두어야 호출자가 준 rotation 이 그대로 먹는다.
  knob: new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2),
  bolt: new THREE.CylinderGeometry(1, 1, 1, 6).rotateX(Math.PI / 2),
  // 기어봉 축이다. 손에 가려 뚜껑이 보이지 않아 열어 둔다.
  shaft: new THREE.CylinderGeometry(0.8, 1, 1, 6, 1, true),
  ball: new THREE.SphereGeometry(1, 12, 8),
  ballBezel: new THREE.TorusGeometry(0.97, 0.1, 6, 16),
};

// 눈금 재질은 MAT 에 없다. materials.js 는 건드리지 않고 여기서 한 번만 만든다.
const TICK_MARK = new THREE.MeshStandardMaterial({ color: '#c7ced6', roughness: 0.62 });
const TICK_WARN = new THREE.MeshStandardMaterial({ color: '#c0442c', emissive: '#c0442c', emissiveIntensity: 0.4, roughness: 0.5 });
const DIAL_FACE_CACHE = new Map();

/** 항공기 계기의 고정 눈금판이다. label 이 없는 기존 차량 계기는 MAT.face 를 그대로
 * 쓰므로 차량별 머티리얼이나 삼각형 예산을 바꾸지 않는다. 한 라벨 조합당 텍스처 하나만 만든다. */
function labelledDialFace(label, unit, max) {
  if (!label) return MAT.face;
  const key = `${label}|${unit}|${max}`;
  const cached = DIAL_FACE_CACHE.get(key);
  if (cached) return cached;
  const surface = canvas2d(192, 192);
  if (!surface) return MAT.face;
  const { canvas, ctx } = surface;
  ctx.fillStyle = '#11171c';
  ctx.fillRect(0, 0, 192, 192);
  ctx.strokeStyle = '#63727a';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(96, 96, 88, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#d7e0dc';
  ctx.textAlign = 'center';
  ctx.font = '700 32px monospace';
  ctx.fillText(label, 96, 72);
  ctx.fillStyle = '#92a79a';
  ctx.font = '21px monospace';
  ctx.fillText(unit, 96, 98);
  ctx.textAlign = 'left';
  ctx.fillText('0', 28, 152);
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.round(max)), 166, 152);
  const texture = sRGBTexture(canvas);
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: '#1b2b21', emissiveMap: texture, emissiveIntensity: 0.12, roughness: 0.55 });
  DIAL_FACE_CACHE.set(key, registerPanelEmissive(material, 0.12, 0.5));
  return material;
}

/** 숫자와 레드존이 있는 계기 눈금판이다. 눈금 각도는 dialScale.js 가 바늘과 같은 식으로 준다.
 * 그래서 바늘이 가리키는 자리와 숫자가 어긋나지 않는다. */
function dialFace({ label = '', unit = '', max = 1, numbers, redline = null, sweep = DIAL_SWEEP }) {
  const key = `n|${label}|${unit}|${max}|${Array.isArray(numbers) ? numbers.join(',') : numbers}|${redline}|${sweep}`;
  const cached = DIAL_FACE_CACHE.get(key);
  if (cached) return cached;
  const surface = canvas2d(DIAL_FACE.size, DIAL_FACE.size);
  if (!surface) return MAT.face;
  const { canvas, ctx } = surface;
  const values = dialFaceNumbers(numbers, max);
  const top = values[values.length - 1] || Number(max) || 1;
  const canvasAngle = (ratio) => dialFaceAngle(ratio, sweep);
  const at = (ratio, radius) => dialFacePoint(ratio, radius, sweep);

  const { size: side, centre } = DIAL_FACE;
  const TAU = Math.PI * 2;
  ctx.fillStyle = '#05080b';
  ctx.fillRect(0, 0, side, side);
  // 원판을 세 단으로 깐다. 바깥 밝은 테, 그 안 검은 홈, 가장 안쪽 눈금판이다.
  // 이 세 단이 mesh 링과 겹쳐 계기가 판에 얹힌 스티커가 아니라 박힌 것으로 읽힌다.
  ctx.fillStyle = '#39434d';
  ctx.beginPath(); ctx.arc(centre, centre, DIAL_FACE.disc, 0, TAU); ctx.fill();
  ctx.fillStyle = '#080d12';
  ctx.beginPath(); ctx.arc(centre, centre, DIAL_FACE.bezel, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0f171e';
  ctx.beginPath(); ctx.arc(centre, centre, DIAL_FACE.bezel - 9, 0, TAU); ctx.fill();

  // 레드존은 눈금 안쪽 호다. redline 비율부터 끝까지 칠한다. 짧고 굵어야 한눈에 읽힌다.
  const limit = Number(redline);
  if (Number.isFinite(limit) && limit >= 0 && limit < 1) {
    ctx.strokeStyle = '#d24428';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(centre, centre, DIAL_FACE.arc, canvasAngle(limit), canvasAngle(1));
    ctx.stroke();
  }

  // 보조 눈금은 주 눈금 사이를 넷으로 나눈다. 주 눈금보다 짧고 가늘다.
  ctx.strokeStyle = '#8b9ba6';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let step = 0; step < values.length - 1; step++) {
    for (let minor = 1; minor < 5; minor++) {
      const ratio = (step + minor / 5) / (values.length - 1);
      const [x0, y0] = at(ratio, DIAL_FACE.tickOuter);
      const [x1, y1] = at(ratio, DIAL_FACE.tickMinor);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = '#f2f7fa';
  ctx.lineWidth = 9;
  ctx.beginPath();
  values.forEach((_, index) => {
    const ratio = index / (values.length - 1);
    const [x0, y0] = at(ratio, DIAL_FACE.tickOuter);
    const [x1, y1] = at(ratio, DIAL_FACE.tickMajor);
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  });
  ctx.stroke();

  // 숫자는 칸이 아홉을 넘으면 한 칸 걸러 적는다. 남은 칸은 주 눈금만으로도 읽힌다.
  const stride = dialNumberStride(values.length);
  const texts = values.map((value) => (top >= 20 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)));
  const digits = texts.reduce((most, text) => Math.max(most, text.length), 1);
  const size = dialNumberSize(values.length, digits, sweep, stride);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  texts.forEach((text, index) => {
    if (index % stride !== 0) return;
    const [x, y] = at(index / (values.length - 1), DIAL_FACE.number);
    ctx.fillText(text, x, y);
  });

  ctx.textBaseline = 'alphabetic';
  if (label) {
    ctx.fillStyle = '#cfdce3';
    ctx.font = '700 26px monospace';
    ctx.fillText(label, centre, centre + DIAL_TEXT.label);
  }
  if (unit) {
    ctx.fillStyle = '#8ca0ac';
    ctx.font = '20px monospace';
    ctx.fillText(unit, centre, centre + DIAL_TEXT.unit);
  }

  // 유리 반사 한 줄이다. 왼쪽 위에서 오른쪽 아래로 흐르는 옅은 사선 두 줄이고 원판 안에서만
  // 잘린다. 재질을 늘리지 않고 눈금판 텍스처에 그대로 그린다.
  ctx.save();
  ctx.beginPath(); ctx.arc(centre, centre, DIAL_FACE.bezel - 9, 0, TAU); ctx.clip();
  ctx.translate(centre, centre);
  ctx.rotate(-0.62);
  ctx.fillStyle = 'rgba(216, 234, 246, 0.075)';
  ctx.fillRect(-side, -side * 0.34, side * 2, side * 0.22);
  ctx.fillStyle = 'rgba(216, 234, 246, 0.04)';
  ctx.fillRect(-side, -side * 0.06, side * 2, side * 0.09);
  ctx.restore();

  const texture = sRGBTexture(canvas);
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: '#1b2b21', emissiveMap: texture, emissiveIntensity: 0.12, roughness: 0.55 });
  DIAL_FACE_CACHE.set(key, registerPanelEmissive(material, 0.12, 0.5));
  return material;
}

/** 바늘과 같은 범위에 눈금을 깐다. 0 과 최대값 자리만 길게 두어 양 끝을 읽게 한다. */
function tickMarks(count, sweep, danger) {
  const total = Math.max(2, Math.round(Number(count) || 0));
  const limit = Number.isFinite(Number(danger)) ? Number(danger) : null;
  return Array.from({ length: total }, (_, index) => {
    const ratio = index / (total - 1);
    const angle = dialAngle(ratio, sweep);
    const end = index === 0 || index === total - 1;
    return {
      key: index,
      // 원판이 뒤로 물러앉았으므로 눈금도 그 면에 붙인다. 앞에 띄우면 그림자 없이 뜬다.
      position: [-Math.sin(angle) * TICK_RADIUS, Math.cos(angle) * TICK_RADIUS, -0.025],
      scale: [TICK_WIDTH, end ? TICK_LENGTH_END : TICK_LENGTH, 1],
      rotation: [0, 0, angle],
      warn: limit !== null && ratio >= limit,
    };
  });
}

/** 아날로그 계기다. label/unit 이 있으면 공유 캔버스 눈금판을 얹고, 없으면 기존 무문자
 * 계기다. danger 는 0 에서 1 사이 비율이고 그 위 눈금만 경고색으로 칠한다.
 * numbers 를 주면 숫자와 레드존이 그려진 눈금판을 쓰고 mesh 눈금은 만들지 않는다.
 *
 * get 은 매 프레임 읽는 판독값 함수다. status 가 ref 로 들어오므로 부모가 다시 렌더하지
 * 않아도 바늘은 계속 움직인다. value 를 직접 주면 그 값 하나로 고정된다(정적인 계기용). */
export function Dial({
  get, value, max = 1, position = [0, 0, 0], radius = 0.16, sweep = DIAL_SWEEP, damping = 9,
  ticks = DIAL_TICKS, danger = null, label = '', unit = '', numbers = null, redline = null, hood = false,
}) {
  const needle = useRef();
  const settled = useRef(false);
  const printed = !!numbers;
  const marks = useMemo(() => (printed ? [] : tickMarks(ticks, sweep, danger)), [printed, ticks, sweep, danger]);
  const face = useMemo(
    () => (printed ? dialFace({ label, unit, max, numbers, redline, sweep }) : labelledDialFace(label, unit, max)),
    [printed, label, unit, max, numbers, redline, sweep],
  );
  useFrame((_, delta) => {
    if (!needle.current) return;
    const reading = get ? get() : value;
    const ratio = Math.max(0, Math.min(1, (Number(reading) || 0) / (max || 1)));
    // 시계 7시에서 5시까지 240도를 쓴다. 위쪽이 절반이다.
    const target = dialAngle(ratio, sweep);
    // 첫 프레임은 바로 맞춘다. 감쇠하면 0 에서 쓸어 올라오는 것이 보인다.
    needle.current.rotation.z = settled.current
      ? approach(needle.current.rotation.z, target, damping, delta)
      : target;
    settled.current = true;
  });
  // 원판을 링 안쪽으로 밀어 넣어 깊이를 만든다. 바늘과 허브는 그보다 앞, 덮개 유리는 링 앞면이다.
  return <group position={position} scale={radius}>
    <mesh geometry={GEO.dialFace} material={face} position={[0, 0, -0.035]} dispose={null} />
    <mesh geometry={GEO.dialBezel} material={MAT.trim} rotation={[Math.PI / 2, 0, 0]} dispose={null} />
    {marks.map((mark) => <mesh key={mark.key} geometry={GEO.tick} material={mark.warn ? TICK_WARN : TICK_MARK}
      position={mark.position} scale={mark.scale} rotation={mark.rotation} />)}
    <group ref={needle} position={[0, 0, 0.02]} userData={{ dynamic: true }}>
      <mesh geometry={GEO.needle} material={MAT.needle} position={[0, 0.34, 0]} dispose={null} />
    </group>
    <mesh geometry={GEO.hub} material={MAT.trim} position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]} dispose={null} />
    {/* 바깥 금속 링, 위만 덮는 챙, 덮개 유리 세 조각이 mid 부터 붙는다. */}
    {hood && <mesh geometry={GEO.dialRing} material={MAT.metal} rotation={[Math.PI / 2, 0, 0]} dispose={null} />}
    {hood && <mesh geometry={GEO.dialHood} material={MAT.trim} position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]} dispose={null} />}
    {hood && <mesh geometry={GEO.dialGlass} material={MAT.screenGlass} position={[0, 0, 0.072]} dispose={null} />}
  </group>;
}


/** 스로틀이나 콜렉티브 레버다. get() 이 0 에서 1 사이 값을 돌려주면 stroke 만큼 앞뒤로 움직인다. */
export function Lever({ get, value = 0, position = [0, 0, 0], stroke = 0.34, knob = '#b8452f', damping = 9 }) {
  const arm = useRef();
  const settled = useRef(false);
  const knobMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: knob, roughness: 0.7 }), [knob]);
  useFrame((_, delta) => {
    if (!arm.current) return;
    const reading = get ? get() : value;
    const target = -Math.max(0, Math.min(1, Number(reading) || 0)) * stroke;
    arm.current.position.z = settled.current ? approach(arm.current.position.z, target, damping, delta) : target;
    settled.current = true;
  });
  return <group position={position}>
    <mesh geometry={GEO.box} material={MAT.shell} scale={[0.1, 0.04, stroke + 0.14]} dispose={null} />
    <group ref={arm} userData={{ dynamic: true }}>
      <mesh geometry={GEO.box} material={MAT.trim} scale={[0.035, 0.16, 0.035]} position={[0, 0.09, 0]} dispose={null} />
      <mesh geometry={GEO.box} material={knobMaterial} scale={[0.07, 0.05, 0.05]} position={[0, 0.18, 0]} dispose={null} />
    </group>
  </group>;
}


/** 조종간이다. get() 이 { pitch, roll } 을 돌려주면 그 입력을 그대로 따라 기운다.
 * hand 가 참이면 그립을 쥔 손이 함께 기운다. */
export function Stick({ get, position = [0, 0, 0], limit = [0.3, 0.42], damping = 14, hand = false }) {
  const arm = useRef();
  const settled = useRef(false);
  useFrame((_, delta) => {
    if (!arm.current) return;
    const { pitch = 0, roll = 0 } = get ? get() || {} : {};
    const targetPitch = Math.max(-limit[0], Math.min(limit[0], Number(pitch) || 0)) * limit[0];
    const targetRoll = -Math.max(-limit[1], Math.min(limit[1], Number(roll) || 0)) * limit[1];
    if (!settled.current) {
      arm.current.rotation.x = targetPitch;
      arm.current.rotation.z = targetRoll;
      settled.current = true;
      return;
    }
    arm.current.rotation.x = approach(arm.current.rotation.x, targetPitch, damping, delta);
    arm.current.rotation.z = approach(arm.current.rotation.z, targetRoll, damping, delta);
  });
  return <group position={position}>
    <mesh geometry={GEO.box} material={MAT.shell} scale={[0.14, 0.05, 0.14]} dispose={null} />
    <group ref={arm} userData={{ dynamic: true }}>
      <StaticBatch version={`${hand}`}>
        <mesh geometry={GEO.box} material={MAT.trim} scale={[0.045, 0.34, 0.045]} position={[0, 0.17, 0]} dispose={null} />
        <mesh geometry={GEO.box} material={MAT.grip} scale={[0.09, 0.13, 0.08]} position={[0, 0.38, 0]} dispose={null} />
        {hand && <StickHand />}
      </StaticBatch>
    </group>
  </group>;
}


/** 폭격기 요크와 차량 스티어링 휠이 같은 모양을 쓴다. get() 이 돌려주는 각도(roll 이나
 * steer 에서 구한 값)로 돈다. hands 가 참이면 10시와 2시를 쥔 손이 함께 돈다.
 * 림과 스포크만 radius 로 줄이고 손은 미터 좌표로 둔다. 손 크기는 휠 크기를 따라가지 않는다. */
export function Yoke({ get, angle = 0, position = [0, 0, 0], radius = 0.19, tilt = -0.35, damping = 14, hands = false }) {
  const wheel = useRef();
  const settled = useRef(false);
  useFrame((_, delta) => {
    if (!wheel.current) return;
    const reading = get ? get() : angle;
    const target = -(Number(reading) || 0);
    wheel.current.rotation.z = settled.current ? approach(wheel.current.rotation.z, target, damping, delta) : target;
    settled.current = true;
  });
  return <group position={position} rotation={[tilt, 0, 0]}>
    <group ref={wheel} userData={{ dynamic: true }}>
      {/* 휠과 손은 통째로 같이 도는 한 덩이다. 바깥 StaticBatch 는 dynamic 가지를 건너뛰므로
          여기서 다시 합친다. 림, 스포크, 손 열네 조각이 재질 세 벌로 줄어든다. */}
      <StaticBatch version={`${radius}:${hands}`}>
        <group scale={radius}>
          <mesh geometry={GEO.rim} material={MAT.grip} dispose={null} />
          {/* 3시, 6시, 9시 스포크다. 12시에 스포크를 두면 계기 화면 가운데를 세로로 가린다 */}
          {[Math.PI / 2, Math.PI, Math.PI * 1.5].map((spoke) => <mesh key={spoke} geometry={GEO.box} material={MAT.grip}
            scale={[0.14, 0.9, 0.09]} position={[Math.sin(spoke) * 0.45, Math.cos(spoke) * 0.45, 0]} rotation={[0, 0, -spoke]} />)}
        </group>
        {hands && <Hands radius={radius} />}
      </StaticBatch>
    </group>
    <mesh geometry={GEO.box} material={MAT.trim} scale={[0.06, 0.06, 0.14]} position={[0, 0, -0.08]} dispose={null} />
  </group>;
}

/** 대시보드, 글레어실드, 프레임 같은 판이다. 회전과 크기만 다르다. */
export function Panel({ position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], material = 'shell' }) {
  return <mesh geometry={GEO.box} material={MAT[material] || MAT.shell} position={position} scale={scale} rotation={rotation} dispose={null} />;
}

/** 회전 노브다. 축이 +z 라 계기판 앞면에 그대로 붙는다. pointer 는 지금 돌아간 자리를 읽는 표식이다. */
export function Knob({ position = [0, 0, 0], rotation = [0, 0, 0], radius = 0.02, height = 0.02, material = 'metal', pointer = true }) {
  return <group position={position} rotation={rotation}>
    <mesh geometry={GEO.knob} material={MAT[material] || MAT.metal} scale={[radius, radius, height]} dispose={null} />
    {pointer && <mesh geometry={GEO.box} material={MAT.face}
      scale={[radius * 0.22, radius * 0.8, 0.004]} position={[0, radius * 0.42, height * 0.5 + 0.002]} dispose={null} />}
  </group>;
}

/** 토글 스위치다. 받침은 판에 붙고 레버만 위아래로 기운다. on 은 정적인 상태라 매 프레임 읽지 않는다. */
export function Toggle({ position = [0, 0, 0], rotation = [0, 0, 0], on = false }) {
  return <group position={position} rotation={rotation}>
    <mesh geometry={GEO.box} material={MAT.trim} scale={[0.03, 0.03, 0.008]} dispose={null} />
    <group rotation={[on ? -0.55 : 0.55, 0, 0]}>
      <mesh geometry={GEO.box} material={MAT.metal} scale={[0.009, 0.009, 0.034]} position={[0, 0, 0.018]} dispose={null} />
    </group>
  </group>;
}

/** 누름 버튼이다. lit 이면 캡이 발광 재질로 바뀐다. 밤낮 밝기는 MAT.glow 가 함께 따른다. */
export function PushButton({ position = [0, 0, 0], rotation = [0, 0, 0], size = 0.03, lit = false, material = 'glow' }) {
  return <group position={position} rotation={rotation}>
    <mesh geometry={GEO.box} material={MAT.trim} scale={[size, size, 0.008]} dispose={null} />
    <mesh geometry={GEO.box} material={lit ? (MAT[material] || MAT.glow) : MAT.face}
      scale={[size * 0.76, size * 0.76, 0.012]} position={[0, 0, 0.008]} dispose={null} />
  </group>;
}

/** 좌석이다. position 은 방석 윗면 한가운데다. 등받이는 눈 쪽(+z) 으로 서고 조금 눕는다.
 * 볼스터는 방석 양옆 턱이라 1인칭에서 무릎 옆에 보인다. */
export function Seat({
  position = [0, 0, 0], rotation = [0, 0, 0], width = 0.5, depth = 0.5, height = 0.55,
  material = 'leather', headrest = true, bolsters = true,
}) {
  const skin = MAT[material] || MAT.leather;
  return <group position={position} rotation={rotation}>
    <mesh geometry={GEO.box} material={skin} scale={[width, 0.1, depth]} position={[0, -0.05, 0]} dispose={null} />
    <mesh geometry={GEO.box} material={skin} scale={[width, height, 0.1]}
      position={[0, height * 0.46, depth * 0.5 - 0.01]} rotation={[0.14, 0, 0]} dispose={null} />
    {headrest && <mesh geometry={GEO.box} material={skin} scale={[width * 0.42, 0.14, 0.09]}
      position={[0, height * 0.96, depth * 0.5 + 0.04]} rotation={[0.14, 0, 0]} dispose={null} />}
    {bolsters && [-1, 1].map((side) => <mesh key={side} geometry={GEO.box} material={skin}
      scale={[0.07, 0.09, depth * 0.9]} position={[side * (width * 0.5 - 0.03), 0.01, 0]} dispose={null} />)}
  </group>;
}

/** 손 하나다. 손등, 감아쥔 손가락, 엄지 세 상자로 만든다. 로컬 +x 가 쥔 것의 길이 방향,
 * +y 가 림 안쪽, +z 가 눈 쪽이다. thumb 이 -1 이면 엄지가 -x 로 간다.
 *
 * 손등은 림 뒤(눈 쪽) 에 서고 손가락 덩어리는 림을 넘어 안쪽 아래로 감긴다. 예전에는 셋이
 * 한 평면에 눌려 있어 납작한 살색 상자로 보였다. 엄지만 림 안쪽에 얹어 방향을 읽게 한다. */
function Palm({ thumb = 1 }) {
  return <group>
    <mesh geometry={GEO.box} material={MAT.skin} scale={[0.072, 0.046, 0.058]}
      position={[0, -0.012, 0.030]} dispose={null} />
    <mesh geometry={GEO.box} material={MAT.skin} scale={[0.068, 0.058, 0.034]}
      position={[0, 0.016, -0.004]} rotation={[-0.55, 0, 0]} dispose={null} />
    <mesh geometry={GEO.box} material={MAT.skin} scale={[0.024, 0.026, 0.062]}
      position={[thumb * 0.043, 0.024, 0.024]} rotation={[0, 0, thumb * -0.35]} dispose={null} />
  </group>;
}

/** 손목과 소매다. 두 조각으로 나눠 살과 옷의 경계를 만든다. 쥔 것의 로컬 회전을 따르지 않고
 * 늘 눈 쪽 아래로 내려오므로 호출자가 준 위치에 그대로 둔다. */
function Forearm({ position = [0, 0, 0] }) {
  return <group position={position}>
    <mesh geometry={GEO.box} material={MAT.skin} scale={[0.064, 0.064, 0.07]}
      position={[0, -0.018, 0.033]} rotation={[0.5, 0, 0]} dispose={null} />
    <mesh geometry={GEO.box} material={MAT.sleeve} scale={[0.086, 0.086, 0.25]}
      position={[0, -0.078, 0.145]} rotation={[0.5, 0, 0]} dispose={null} />
  </group>;
}

/** 스티어링을 쥔 두 손이다. Yoke 의 dynamic group 안에서 휠과 같이 돈다.
 * 10시(150도) 와 2시(30도) 에 두고 로컬 +x 를 림 접선에, +y 를 림 안쪽으로 맞춘다.
 * 전완은 림 접선이 아니라 휠 좌표를 그대로 써야 양팔이 아래에서 올라온 것으로 보인다. */
export function Hands({ radius = 0.18 }) {
  return <group>
    {[{ side: -1, angle: Math.PI * 5 / 6 }, { side: 1, angle: Math.PI / 6 }].map(({ side, angle }) => {
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      return <group key={side}>
        <group position={[x, y, 0]} rotation={[0, 0, angle + Math.PI / 2]}>
          <Palm thumb={side} />
        </group>
        <Forearm position={[x, y - 0.052, 0.012]} />
      </group>;
    })}
  </group>;
}

/** 조종간 그립을 쥔 손 하나다. Stick 의 dynamic group 안에 둔다. 기본 위치가 그립 높이다. */
export function StickHand({ position = [0, 0.36, 0] }) {
  return <group position={position}>
    <group rotation={[0, 0, Math.PI / 2]}>
      <Palm thumb={-1} />
    </group>
    <Forearm position={[0, -0.052, 0.012]} />
  </group>;
}

/** 페달이다. 고무 판이 눈 쪽으로 눕고 암이 바닥으로 내려간다. 세 개면 클러치까지다. */
export function Pedals({ position = [0, 0, 0], rotation = [0, 0, 0], count = 2, spacing = 0.14 }) {
  const total = Math.max(1, Math.round(Number(count) || 1));
  return <group position={position} rotation={rotation}>
    {Array.from({ length: total }, (_, index) => {
      const x = (index - (total - 1) / 2) * spacing;
      return <group key={index} position={[x, 0, 0]}>
        <mesh geometry={GEO.box} material={MAT.rubber} scale={[0.085, 0.13, 0.018]} rotation={[0.32, 0, 0]} dispose={null} />
        <mesh geometry={GEO.box} material={MAT.metal} scale={[0.028, 0.1, 0.028]} position={[0, -0.09, -0.02]} dispose={null} />
      </group>;
    })}
  </group>;
}

/** 스로틀 쿼드런트다. 받침 판과 레버가 지나는 슬롯 하나에 Lever 를 여러 개 얹는다. */
export function Quadrant({ position = [0, 0, 0], rotation = [0, 0, 0], width = 0.2, levers = [] }) {
  const count = Math.max(1, levers.length);
  return <group position={position} rotation={rotation}>
    <mesh geometry={GEO.box} material={MAT.trim} scale={[width, 0.03, 0.2]} position={[0, -0.02, 0]} dispose={null} />
    <mesh geometry={GEO.box} material={MAT.dark} scale={[width - 0.04, 0.014, 0.03]} position={[0, -0.004, 0]} dispose={null} />
    {levers.map((lever, index) => <Lever key={index} get={lever.get} value={lever.value} knob={lever.knob}
      position={[(index - (count - 1) / 2) * (width / count), 0, 0]} stroke={lever.stroke} />)}
  </group>;
}

/** 기어 레버다. get() 이 0 에서 1 이면 앞뒤로 기운다. get 이 없으면 가만히 있고
 * dynamic 표시도 달지 않아 StaticBatch 가 그대로 합친다. */
export function GearLever({ position = [0, 0, 0], get, length = 0.17 }) {
  const arm = useRef();
  useFrame((_, delta) => {
    if (!get || !arm.current) return;
    const reading = Math.max(0, Math.min(1, Number(get()) || 0));
    // 0 이 앞(-z), 1 이 뒤(+z) 다. 가운데가 중립이라 0.5 에서 곧게 선다.
    arm.current.rotation.x = approach(arm.current.rotation.x, (reading - 0.5) * 0.5, 10, delta);
  });
  return <group position={position}>
    <mesh geometry={GEO.box} material={MAT.grip} scale={[0.09, 0.04, 0.09]} dispose={null} />
    <group ref={arm} userData={get ? { dynamic: true } : undefined}>
      <mesh geometry={GEO.shaft} material={MAT.metal} scale={[0.016, length, 0.016]} position={[0, length * 0.5, 0]} dispose={null} />
      <mesh geometry={GEO.box} material={MAT.leather} scale={[0.05, 0.055, 0.05]} position={[0, length + 0.02, 0]} dispose={null} />
    </group>
  </group>;
}

/** 자세계 구의 텍스처다. 위 절반이 하늘, 아래 절반이 땅이고 적도가 수평선이다.
 * 구의 UV 는 세로가 위도 그대로라 위도 L 은 캔버스 y = 128 - L * 256/180 이다.
 * 눈금 기둥은 카메라를 보는 경도(u=0.25) 와 그 반대편에 둔다. */
const ATTITUDE = Object.freeze({ width: 512, height: 256, perDegree: 256 / 180 });

function attitudeFace() {
  const surface = canvas2d(ATTITUDE.width, ATTITUDE.height);
  if (!surface) return MAT.face;
  const { canvas, ctx } = surface;
  const mid = ATTITUDE.height / 2;
  ctx.fillStyle = '#4d8bd6';
  ctx.fillRect(0, 0, ATTITUDE.width, mid);
  ctx.fillStyle = '#7a5b3b';
  ctx.fillRect(0, mid, ATTITUDE.width, mid);
  ctx.fillStyle = '#f2f5f7';
  ctx.fillRect(0, mid - 2, ATTITUDE.width, 4);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const column of [ATTITUDE.width * 0.25, ATTITUDE.width * 0.75]) {
    for (let degrees = -60; degrees <= 60; degrees += 10) {
      if (degrees === 0) continue;
      const y = mid - degrees * ATTITUDE.perDegree;
      const labelled = degrees % 20 === 0;
      const half = labelled ? 34 : 17;
      ctx.fillStyle = '#eef2f5';
      ctx.fillRect(column - half, y - 1.5, half * 2, 3);
      if (!labelled) continue;
      ctx.font = '700 14px monospace';
      ctx.fillText(String(Math.abs(degrees)), column - half - 16, y);
      ctx.fillText(String(Math.abs(degrees)), column + half + 16, y);
    }
  }
  const texture = sRGBTexture(canvas);
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: '#2a3340', emissiveMap: texture, emissiveIntensity: 0.14, roughness: 0.6 });
  return registerPanelEmissive(material, 0.14, 0.55);
}

const ATTITUDE_FACE = attitudeFace();

/** 자세계다. get() 이 { pitch, roll } 을 라디안으로 준다.
 * 부호 근거는 hudLadder 와 같다. 기수를 들면(pitch > 0) 수평선이 화면 아래로 내려가야 하므로
 * 눈에 보이는 앞면(+z) 이 아래로 돌아야 한다. x 축 회전 +pitch 가 +z 를 (0, -sin, cos) 로 보낸다.
 * 오른쪽으로 기울면(roll > 0) 바깥 수평선은 왼쪽 끝이 올라가므로 구는 반대로 -roll 만큼 돈다. */
export function AttitudeBall({ get, position = [0, 0, 0], radius = 0.06, damping = 12 }) {
  const ball = useRef();
  const settled = useRef(false);
  useFrame((_, delta) => {
    if (!ball.current) return;
    const { pitch = 0, roll = 0 } = get ? get() || {} : {};
    const targetPitch = Number(pitch) || 0;
    const targetRoll = -(Number(roll) || 0);
    if (!settled.current) {
      ball.current.rotation.x = targetPitch;
      ball.current.rotation.z = targetRoll;
      settled.current = true;
      return;
    }
    ball.current.rotation.x = approach(ball.current.rotation.x, targetPitch, damping, delta);
    ball.current.rotation.z = approach(ball.current.rotation.z, targetRoll, damping, delta);
  });
  return <group position={position} scale={radius}>
    <group ref={ball} userData={{ dynamic: true }}>
      <mesh geometry={GEO.ball} material={ATTITUDE_FACE} dispose={null} />
    </group>
    <mesh geometry={GEO.ballBezel} material={MAT.trim} position={[0, 0, 0.24]} dispose={null} />
    {/* 고정 기준 날개다. 구가 돌아도 이것은 움직이지 않아 기체 자세를 읽는 기준이 된다. */}
    {[-1, 1].map((side) => <mesh key={side} geometry={GEO.box} material={MAT.needle}
      scale={[0.5, 0.07, 0.07]} position={[side * 0.55, 0, 1.04]} dispose={null} />)}
  </group>;
}

const RAIN_REDRAW = 0.15;

/** 앞유리 한 장이다. smudge 면 얼룩, rain 이면 흘러내리는 빗방울 알파를 쓴다.
 * 빗방울 캔버스는 창 수와 무관하게 한 장을 함께 쓴다. 같은 시간에는 같은 그림이라 문제가 없다. */
export function GlassPane({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], smudge = true, rain = false }) {
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (!rain) return;
    if (clock.elapsedTime - last.current < RAIN_REDRAW) return;
    last.current = clock.elapsedTime;
    refreshRain(clock.elapsedTime);
  });
  const material = (rain && GLASS_RAIN?.material) || (smudge && GLASS_SMUDGE?.material) || MAT.glassTint;
  return <mesh geometry={GEO.plane} material={material} position={position} rotation={rotation} scale={scale}
    userData={rain ? { dynamic: true } : undefined} dispose={null} />;
}

/** 캐노피 활 프레임과 반원통 유리다. 반지름과 두께가 기종마다 달라 인자별로 한 번씩만 만든다.
 * 프레임마다 만들지 않으므로 공유 geometry 규칙을 지킨다. */
const ARC_CACHE = new Map();
function arcGeometry(radius, thickness, sweep) {
  const key = `${radius}|${thickness}|${sweep}`;
  let geometry = ARC_CACHE.get(key);
  if (!geometry) {
    geometry = new THREE.TorusGeometry(radius, thickness, 6, 12, sweep);
    ARC_CACHE.set(key, geometry);
  }
  return geometry;
}

export function CanopyArc({ position = [0, 0, 0], rotation = [0, 0, 0], radius = 0.5, thickness = 0.02, sweep = Math.PI }) {
  return <mesh geometry={arcGeometry(radius, thickness, sweep)} material={MAT.metal}
    position={position} rotation={rotation} dispose={null} />;
}

const SHELL_CACHE = new Map();
function shellGeometry(segments) {
  let geometry = SHELL_CACHE.get(segments);
  if (!geometry) {
    // 축이 z 가 되게 돌린 뒤 위쪽 반만 남긴다. theta pi/2 에서 pi 만큼이 그 반이다.
    geometry = new THREE.CylinderGeometry(1, 1, 1, segments, 1, true, Math.PI / 2, Math.PI);
    SHELL_CACHE.set(segments, geometry);
  }
  return geometry;
}

/** 캐노피 유리다. 축이 z 인 반원통이라 조종석 위를 덮는다. */
export function CanopyShell({ position = [0, 0, 0], radius = 0.5, length = 1, segments = 12 }) {
  return <mesh geometry={shellGeometry(segments)} material={MAT.glassTint}
    position={position} rotation={[Math.PI / 2, 0, 0]} scale={[radius, length, radius]} dispose={null} />;
}

/** 접촉 그림자다. 대시 밑, 발밑, 문 아래처럼 빛이 닿지 않는 자리에 한 장 깔면
 * 광원을 더하지 않고도 조각이 떠 보이지 않는다. */
export function ShadeStrip({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }) {
  return <mesh geometry={GEO.plane} material={MAT.shade} position={position} rotation={rotation} scale={scale} dispose={null} />;
}

const WIPER_SWEEP = 1.6;

function WiperArm({ get, offset, length, rest, sweep }) {
  const arm = useRef();
  useFrame(({ clock }) => {
    if (!arm.current) return;
    const phase = get ? Number(get(clock.elapsedTime)) : NaN;
    // 위상이 없으면 눕힌 자리에 그대로 둔다. 비가 오지 않는데 쓸면 안 된다.
    arm.current.rotation.z = Number.isFinite(phase)
      ? rest + ((1 - Math.cos(phase * Math.PI * 2)) / 2) * sweep
      : rest;
  });
  return <group ref={arm} position={[offset, 0, 0]} userData={{ dynamic: true }}>
    <mesh geometry={GEO.box} material={MAT.metal} scale={[0.02, length, 0.02]} position={[0, length * 0.5, 0]} dispose={null} />
    <mesh geometry={GEO.box} material={MAT.rubber} scale={[0.015, length * 0.9, 0.03]} position={[0, length * 0.55, 0.012]} dispose={null} />
  </group>;
}

/** 와이퍼 두 짝이다. 회전 축은 암의 아래 끝이고 둘이 같은 방향으로 쓴다.
 * get() 이 0 에서 1 사이 위상을 주면 한 바퀴에 한 번 갔다 온다. */
export function Wipers({ get, position = [0, 0, 0], rotation = [0, 0, 0], length = 0.5, gap = 0.55, rest = -0.35, sweep = WIPER_SWEEP }) {
  return <group position={position} rotation={rotation}>
    {[-gap / 2, gap / 2].map((offset) => <WiperArm key={offset} get={get} offset={offset} length={length} rest={rest} sweep={sweep} />)}
  </group>;
}

/** 볼트 머리다. 장갑판 이음새와 프레임 마디에 박는다. 축이 +z 라 판 앞면에 그대로 선다. */
export function Bolts({ points = [], radius = 0.01, material = 'metal' }) {
  return <group>
    {points.map((point, index) => <mesh key={index} geometry={GEO.bolt} material={MAT[material] || MAT.metal}
      position={point} scale={[radius, radius, radius * 0.7]} dispose={null} />)}
  </group>;
}

/** 손잡이다. 가로 막대 하나와 다리 둘로 ㄷ 자를 만든다. 다리는 -z 쪽 트림에 박힌다. */
export function GrabHandle({ position = [0, 0, 0], rotation = [0, 0, 0], length = 0.18 }) {
  return <group position={position} rotation={rotation}>
    <mesh geometry={GEO.box} material={MAT.grip} scale={[length, 0.028, 0.028]} dispose={null} />
    {[-1, 1].map((side) => <mesh key={side} geometry={GEO.box} material={MAT.trim}
      scale={[0.028, 0.028, 0.055]} position={[side * (length * 0.5 - 0.014), 0, -0.032]} dispose={null} />)}
  </group>;
}
