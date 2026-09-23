import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import PlaneModel from './models/PlaneModel';
import Blast from './models/Blast';
import { mergeStatic } from './staticBatch.js';
import { markMoved, snapshotPoses } from './cityTiles.js';
import { AIR_MARK_RANGE, AIR_MODEL_RANGE, AIR_WRECK_LIFE, airHealthBarScale, airTrafficPose, reviveAirTraffic, showAirHealthBar, wreckAge } from './airTraffic.js';

/** 도시 상공을 도는 AI 항공기다. 좌표는 airTraffic.js 가 시간마다 다시 계산하는 값이므로
 * 이 파일은 매 프레임 같은 index 로 자세를 구해 모델을 옮기기만 한다. 상태를 들고 있지 않다.
 *
 * combatRef 는 FlightMode 와 나눠 쓰는 격추 진행도다. 여기서는 읽기만 한다.
 * 표식과 체력 막대는 React state 를 거치지 않고 DOM 과 Three 객체를 직접 고친다.
 * 여러 대가 동시에 맞아도 리렌더가 쌓이지 않는다.
 */

/** marked 는 표식을 볼 자격이다. 무장한 탈것과 도보만 켠다. 세단이나 라이트 제트처럼
 * 쏠 수단이 없는 자리에서는 점이 정보가 아니라 화면 잡음이다.
 */
// 표식과 모델 거리는 airTraffic.js 의 체력바 가시 거리와 함께 정한다.
/** 모델 마운트 목록을 다시 정하는 주기다. 매 프레임 바꾸면 거리 경계에서 기체가 깜빡인다. */
const MODEL_REFRESH = 0.35;
/** 동시에 모델을 그리는 기체 수다. 모델은 정지 부품을 재질별로 합쳐 제트 한 대가 draw 20개 안쪽이다.
 * 나머지는 점만 남는다. 멀리서 기체를 찾는 일은 어차피 점이 맡는다. */
const MODEL_BUDGET = 5;
// 화면에서 차지하는 점의 크기다. 화면 높이 대비 비율이라 거리와 무관하다.
const DOT_SCALE = 0.008;
// WebGL 은 CSS 변수를 못 읽어 hex 를 쓴다. WorldPage 의 티어 색 표와 같은 예외다.
const DOT_COLOR = '#ff5b47';
/** 모델이 뜬 뒤 이 프레임부터 자세를 적어 두고, WATCH_FRAMES 뒤에 달라진 가지를 찾는다. */
const WATCH_FROM = 2, WATCH_FRAMES = 3;

/** 점 하나짜리 스프라이트 텍스처다. 사각형을 쓰면 점이 아니라 네모로 보인다. */
function makeDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const paint = canvas.getContext('2d');
  paint.fillStyle = '#ffffff';
  paint.beginPath();
  paint.arc(32, 32, 26, 0, Math.PI * 2);
  paint.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 모델을 몇 프레임 지켜본 뒤 움직이지 않는 mesh 를 재질별로 합친다. 로터와 배기 불꽃처럼
 * 스스로 움직이는 가지는 그 사이 자세가 바뀌므로 빼고, 로터는 그 가지 안에서 따로 합친다.
 * 기종 모델 파일을 고치지 않고 PlaneModel 을 그대로 쓴다. */
function SettledModel({ children }) {
  const root = useRef();
  const stage = useRef({ frame: 0, poses: null, undo: null });
  useFrame(() => {
    const state = stage.current, group = root.current;
    if (state.undo || !group) return;
    state.frame += 1;
    if (state.frame === WATCH_FROM) state.poses = snapshotPoses(group);
    else if (state.frame === WATCH_FROM + WATCH_FRAMES) state.undo = settle(group, state.poses);
  });
  useEffect(() => () => stage.current.undo?.(), []);
  return <group ref={root}>{children}</group>;
}

function settle(group, poses) {
  markMoved(group, poses);
  const roots = [group];
  group.traverse((node) => { if (node !== group && node.userData.dynamic) roots.push(node); });
  const added = [], hidden = [];
  for (const branch of roots) {
    // mergeStatic 은 dynamic 표시가 붙은 root 를 건너뛴다. 가지 안을 합치는 동안만 표시를 뗀다.
    const flag = branch.userData.dynamic;
    branch.userData.dynamic = false;
    const { merged, hidden: originals } = mergeStatic(branch);
    branch.userData.dynamic = flag;
    for (const mesh of merged) { branch.add(mesh); added.push([branch, mesh]); }
    hidden.push(...originals);
  }
  return () => {
    for (const [branch, mesh] of added) { branch.remove(mesh); mesh.geometry.dispose(); }
    for (const original of hidden) original.visible = true;
  };
}

function Aircraft({ index, extent, combatRef, onBar, onNear, onDot, modelled, marked }) {
  const body = useRef();
  // 기종은 index 가 정하므로 궤도가 살아 있는 동안 바뀌지 않는다.
  const pose = useMemo(() => airTrafficPose(index, 0, extent), [index, extent]);
  const label = pose.plane === 'helicopter' ? 4.4 : 6;
  // 품질을 낮춰 기체 수가 줄면 빠진 기체의 표식과 막대가 남지 않게 지운다.
  useEffect(() => () => { onDot(index, null); onNear(index, null); onBar(index, null, null); }, [index, onDot, onNear, onBar]);

  useFrame(({ clock, camera }) => {
    const now = clock.elapsedTime;
    const combat = combatRef.current;
    const group = body.current;
    if (!group) return;
    const next = airTrafficPose(index, now, extent);
    group.position.set(next.x, next.y, next.z);
    group.rotation.set(next.pitch, next.heading, next.roll, 'YXZ');
    // 격추된 기체는 폭발이 끝나기 전에도 껍데기를 감춘다. 불덩이만 남는다.
    const down = combat.downed.has(index);
    const range = camera.position.distanceTo(group.position);
    const near = !down && range < AIR_MARK_RANGE;
    group.visible = near;
    onDot(index, near ? group : null, label);
    const hurt = combat.damage.get(index) || 0;
    onBar(index, marked && showAirHealthBar(hurt, down, range) ? hurt : null, next, range);
    // 멀면 기체 모델을 아예 마운트하지 않는다. 감추기만 하면 mesh 가 장면에 남아
    // 매 프레임 행렬을 다시 쓴다.
    onNear(index, !down && range < AIR_MODEL_RANGE ? range : null);
  });

  return <group ref={body}>
    {modelled && <SettledModel><PlaneModel plane={pose.plane} throttle={0.65} phase="airborne" /></SettledModel>}
  </group>;
}

/** 기체를 찾는 붉은 점이다. 기체마다 sprite 를 두면 점마다 draw call 이 하나라 Points 하나로
 * 모은다. 건물 뒤에 있어도 보이도록 깊이 검사를 끈다. 크기는 sizeAttenuation 을 끈 sprite 와
 * 같게 화각과 화면 높이에서 구한다. */
function Markers({ dotsRef, capacity, marked }) {
  const points = useRef();
  const size = useThree((state) => state.size);
  const offset = useMemo(() => ({ vector: new THREE.Vector3(), euler: new THREE.Euler(0, 0, 0, 'YXZ') }), []);
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry();
    value.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, capacity) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    value.setDrawRange(0, 0);
    return value;
  }, [capacity]);
  const material = useMemo(() => new THREE.PointsMaterial({
    map: makeDotTexture(), color: DOT_COLOR, size: 10, sizeAttenuation: false,
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  useFrame(({ camera }) => {
    const node = points.current;
    if (!node) return;
    if (!marked) { node.visible = false; return; }
    // 버퍼와 재질은 ref 로 잡은 Three 객체에서 고친다. 매 프레임 값을 쓰는 명령형 상태다.
    const buffer = node.geometry.attributes.position, array = buffer.array;
    let count = 0;
    for (const [group, label] of dotsRef.current.values()) {
      if (count * 3 >= array.length) break;
      offset.vector.set(0, label, 0).applyEuler(offset.euler.copy(group.rotation));
      array[count * 3] = group.position.x + offset.vector.x;
      array[count * 3 + 1] = group.position.y + offset.vector.y;
      array[count * 3 + 2] = group.position.z + offset.vector.z;
      count += 1;
    }
    node.visible = count > 0;
    node.geometry.setDrawRange(0, count);
    buffer.needsUpdate = count > 0;
    // sizeAttenuation 을 끈 sprite 와 같은 크기다(화면 높이의 DOT_SCALE*P[1][1]/2). PointsMaterial.size 는 CSS 픽셀이다.
    node.material.size = DOT_SCALE * camera.projectionMatrix.elements[5] * size.height / 2;
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} dispose={null} />;
}

/** 피격된 기체의 체력 막대다. 화면에 보이는 목록이 바뀔 때만
 * Html 을 마운트하고 값과 위치는 DOM·Three 객체를 직접 고쳐 넣는다. */
function HealthBars({ hurtRef }) {
  const [shown, setShown] = useState([]);
  const listed = useRef('');
  const nodes = useRef(new Map());
  useFrame(() => {
    const hurt = hurtRef.current;
    const live = [...hurt.keys()].sort((a, b) => a - b);
    const key = live.join(',');
    if (key !== listed.current) { listed.current = key; setShown(live); }
    for (const index of live) {
      const slot = nodes.current.get(index);
      const entry = hurt.get(index);
      if (!slot || !entry) continue;
      if (slot.group) slot.group.position.set(entry.x, entry.y + 7.6, entry.z);
      if (slot.bar) slot.bar.style.transform = `scale(${airHealthBarScale(entry.range)})`;
      if (slot.fill) {
        const left = Math.max(0, Math.min(1, 1 - entry.hurt));
        slot.fill.style.width = `${left * 100}%`;
        slot.fill.dataset.level = left <= 0.3 ? 'critical' : left <= 0.6 ? 'warn' : 'ok';
      }
    }
  });
  return shown.map((index) => <group key={index} ref={(node) => {
    const slot = nodes.current.get(index) || {};
    slot.group = node; nodes.current.set(index, slot);
  }}>
    <Html center zIndexRange={[16, 1]} style={{ pointerEvents: 'none' }}>
      <div className="world-aircraft-hp" ref={(node) => {
        const slot = nodes.current.get(index) || {};
        slot.bar = node; nodes.current.set(index, slot);
      }}><i ref={(node) => {
        const slot = nodes.current.get(index) || {};
        slot.fill = node; nodes.current.set(index, slot);
      }} data-level="ok" /></div>
    </Html>
  </group>);
}

/** 격추 폭발이다. 격추 목록이 바뀔 때만 다시 렌더하고 나이는 Blast 가 ageOf 로 매 프레임 읽는다. */
function Wrecks({ extent, combatRef }) {
  const [live, setLive] = useState([]);
  const listed = useRef('');
  const clock = useThree((state) => state.clock);
  useFrame(({ clock: frameClock }) => {
    const now = frameClock.elapsedTime;
    const combat = reviveAirTraffic(combatRef.current, now);
    let key = '';
    for (const index of combat.downed.keys()) if (wreckAge(combat, index, now) !== null) key += `${index}@${combat.downed.get(index)},`;
    if (key === listed.current) return;
    listed.current = key;
    const burning = [];
    for (const [index, at] of combat.downed) {
      if (wreckAge(combat, index, now) === null) continue;
      const pose = airTrafficPose(index, at, extent);
      burning.push({ key: `${index}@${at}`, at, x: pose.x, y: pose.y, z: pose.z });
    }
    setLive(burning);
  });
  return live.map((wreck) => <Blast key={wreck.key} kind="crash" x={wreck.x} y={wreck.y} z={wreck.z}
    ageOf={() => clock.elapsedTime - wreck.at} life={AIR_WRECK_LIFE} size={12} />);
}

function AirTraffic({ extent, count = 0, combatRef, marked = false }) {
  const slots = useMemo(() => Array.from({ length: Math.max(0, count) }, (_, index) => index), [count]);
  // 맞은 기체만 담는다. Aircraft 가 매 프레임 채우고 HealthBars 가 읽는다.
  const hurt = useRef(new Map());
  const onBar = useCallback((index, amount, pose, range) => {
    if (amount !== null) hurt.current.set(index, { hurt: amount, x: pose.x, y: pose.y, z: pose.z, range });
    else hurt.current.delete(index);
  }, []);
  // 표식을 띄울 기체와 표식 높이다. Aircraft 가 매 프레임 채우고 Markers 가 읽는다.
  const dots = useRef(new Map());
  const onDot = useCallback((index, group, label) => {
    if (group) dots.current.set(index, [group, label]); else dots.current.delete(index);
  }, []);
  // 모델을 그릴 만큼 가까운 기체와 그 거리다. 매 프레임 채우고 낮은 주기로만 목록에 옮긴다.
  const near = useRef(new Map());
  const onNear = useCallback((index, range) => {
    if (range === null) near.current.delete(index); else near.current.set(index, range);
  }, []);
  const [modelled, setModelled] = useState(() => new Set());
  const checked = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - checked.current < MODEL_REFRESH) return;
    checked.current = clock.elapsedTime;
    // 가까운 순으로 예산만큼만 모델을 세운다.
    const want = new Set([...near.current].sort((a, b) => a[1] - b[1]).slice(0, MODEL_BUDGET).map(([index]) => index));
    setModelled((current) => current.size === want.size && [...want].every((index) => current.has(index))
      ? current : want);
  });
  if (!combatRef) return null;
  return <>
    {slots.map((index) => <Aircraft key={index} index={index} extent={extent} combatRef={combatRef}
      onBar={onBar} onNear={onNear} onDot={onDot} modelled={modelled.has(index)} marked={marked} />)}
    <Markers dotsRef={dots} capacity={slots.length} marked={marked} />
    <HealthBars hurtRef={hurt} />
    <Wrecks extent={extent} combatRef={combatRef} />
  </>;
}

export default memo(AirTraffic);
