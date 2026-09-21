/** 지상 주행 모드. 조작과 카메라만 맡고 시각 모델은 models/ 에 있다.
 * 1인칭은 대시보드 시점, 3인칭은 차 뒤를 따라간다. 물리는 carPhysics.js 가 전부 계산한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import VehicleModel from './models/VehicleModel';
import Blast, { BlastField } from './models/Blast';
import Tracers from './models/Tracers';
import { carStatus, createCarState, stepCar, vehicleBox } from './carPhysics.js';
import { clearTrafficYield, createTrafficPool, fillTrafficNear, narrowTraffic, updateTrafficYield } from './traffic.js';
import { aimGroundWeapon, aimKeyboard, createGroundArsenal, GROUND_GUNS, isCombatVehicle, recoilKick, roundsPerMinute, scopePoint, stepGroundWeapons , muzzlePoint } from './groundWeapons.js';
import { airTrafficTargets, applyAirHit } from './airTraffic.js';
import { scoreTimeAttack, tickTimeAttack } from './timeAttackStore.js';
import { cockpitFov, eyePoint, FAR_COCKPIT, FAR_DEFAULT, FOV_DEFAULT, NEAR_COCKPIT, NEAR_DEFAULT, nextScope, scopeFov, scopeSteps } from './eyePoints.js';
import { bump, createHealth, hullRatio, hurt, repair } from './health.js';
import { groundImpact } from './reticle.js';
import { projectAim } from './aimScreen.js';
import { clearAimScreen, setAimScreen } from './aimScreenStore.js';
import { playBoom, playTankShot , playTick } from './sound.js';
import { createEngineVoice } from './engineSound.js';
import { IDLE_RPM } from './carGauges.js';
import AimMarker from './models/AimMarker';
import Cockpit from './cockpits';


// 조준 레이캐스트용 위쪽 축이다. 프레임마다 새로 만들지 않는다.

/** 충돌 폭발이다. 차가 'crashed' 로 들어가고 나갈 때만 마운트를 바꾸고, 그 사이의
 * 나이는 Blast 가 ageOf 로 스스로 state.current.crashElapsed 를 읽는다. 차체는 멈춰
 * 서므로 폭발 위치는 crashed 진입 순간에 한 번만 잡으면 된다(충돌마다 최대 두 번의 setState). */
function CrashBlast({ state }) {
  const crashing = useRef(false);
  const [origin, setOrigin] = useState(null);
  useFrame(() => {
    const car = state.current;
    const isCrashed = car.phase === 'crashed';
    if (isCrashed && !crashing.current) {
      crashing.current = true;
      setOrigin({ x: car.x, y: car.y, z: car.z });
    } else if (!isCrashed && crashing.current) {
      crashing.current = false;
      setOrigin(null);
    }
  });
  if (!origin) return null;
  return <Blast kind="crash" x={origin.x} y={origin.y} z={origin.z}
    ageOf={() => state.current.crashElapsed || 0} life={3} size={8} />;
}

const SHELL_MAX = 48;

/** 3인칭 추적 카메라다. distance 는 기본 거리, near/far 는 휠로 갈 수 있는 범위,
 * pitch 는 기본 올려다보는 각이다. 기본값은 지금까지의 13m 뒤, 5.2m 위와 같은 구도다. */
/** 대공 사격 판정을 보는 거리다. 대공포 탄속 320 에 수명 4초면 이 안에서 끝난다. */
const AIR_TARGET_RANGE = 1400;

/** 변속 끊김이 풀리는 시간 상수(초) 다. 실제 자동변속기 한 번이 0.2초 안팎이다. */
const SHIFT_CUT = 0.14;

/** 탄착 해답이 아직 없을 때 조준선을 맺는 거리(m) 다. 시차 보정에만 쓴다. */
const AIM_REACH = 300;

/** 조준경 카메라가 바라보는 앞쪽 거리다. 방향만 정하므로 값이 크기만 하면 된다. */
const SCOPE_REACH = 400;
/** 조준경으로 들어가고 나오는 속도다. 한 프레임에 끊으면 화면이 튄다. */
const SCOPE_BLEND = 11;

const CHASE = Object.freeze({ distance: 13, near: 5.5, far: 52, pitch: 0.38 });
/** 이 픽셀 넘게 끌면 시점 조작으로 본다. 그보다 작으면 클릭이다. */
const DRAG_SLOP = 6;

/** 전조등과 후미등이다. 밤에는 늘 켜지고, 브레이크를 밟으면 붉게 밝아지고 후진하면 흰 등이 켜진다. */
/** 등화 자리다. 모델의 범퍼 끝과 램프 간격이라 VEHICLES 의 충돌 상자와 조금 다르다. */
const LAMP_REACH = Object.freeze({
  motorcycle: { wide: 0, nose: 1.35, tail: 1.35, lift: 0 },
  suv: { wide: 0.78, nose: 2.42, tail: 2.42, lift: 0.22 },
  convertible: { wide: 0.68, nose: 2.2, tail: 2.2, lift: 0.1 },
  truck: { wide: 0.82, nose: 3.78, tail: 3.76, lift: 0.15 },
});
const LAMP_DEFAULT = Object.freeze({ wide: 0.78, nose: 2.45, tail: 2.45, lift: 0 });

/** 전조등, 후미등, 후진등이다. 예전에는 1인칭에서 외장 전체를 언마운트해 대시 너머로
 * 램프 상자가 비쳐 보였다(bodyHidden 으로 램프만 따로 숨겼다). 지금은 VehicleModel 을 항상
 * 마운트하고 firstPerson 이 캐빈만 숨기므로 보닛이 램프를 앞에서 가린다. 이 램프는 그래서
 * 항상 그린다(bodyHidden 없이). 실제로 가려지는지는 화면에서 확인이 필요하다. */
function Lights({ vehicle, night, lamps }) {
  const front = useRef(), rearLeft = useRef(), rearRight = useRef(), reverse = useRef();
  const reach = LAMP_REACH[vehicle] || LAMP_DEFAULT;
  const { wide, lift } = reach, nose = -reach.nose, tail = reach.tail;
  useFrame(() => {
    const { braking, reversing } = lamps.current;
    const head = night ? 2.6 : 0.25;
    if (front.current) front.current.material.emissiveIntensity = head;
    for (const lamp of [rearLeft.current, rearRight.current]) {
      if (lamp) lamp.material.emissiveIntensity = braking ? 3.4 : night ? 1.1 : 0.1;
    }
    if (reverse.current) reverse.current.material.emissiveIntensity = reversing ? 2.8 : 0;
  });
  return <group>
    <mesh ref={front} position={[0, -0.1 + lift, nose]} dispose={null}>
      <boxGeometry args={[wide ? 1.9 : 0.34, 0.16, 0.08]} />
      <meshStandardMaterial color="#fff3d5" emissive="#fff3d5" emissiveIntensity={0.25} toneMapped={false} />
    </mesh>
    {[-1, 1].map((side) => <mesh key={side} ref={side < 0 ? rearLeft : rearRight} position={[side * wide, -0.05 + lift, tail]} dispose={null}>
      <boxGeometry args={[wide ? 0.5 : 0.26, 0.14, 0.07]} />
      <meshStandardMaterial color="#d94f3d" emissive="#d94f3d" emissiveIntensity={0.1} toneMapped={false} />
    </mesh>)}
    <mesh ref={reverse} position={[0, -0.16 + lift, tail]} dispose={null}>
      <boxGeometry args={[wide ? 0.42 : 0.18, 0.1, 0.07]} />
      <meshStandardMaterial color="#e8e3d6" emissive="#e8e3d6" emissiveIntensity={0} toneMapped={false} />
    </mesh>
    {night && <spotLight position={[0, 0.3 + lift, nose]} target-position={[0, -0.6, nose - 24]} angle={0.5} penumbra={0.6} distance={70} intensity={22} color="#fff3d5" castShadow={false} />}
  </group>;
}

export default function CarMode({ extent, buildings = [], controlsRef, vehicle = 'sedan', pilotName, view = 'third', trafficCount = 0, night = false, quality = 'medium', weather = 'clear', onCameraChange, onStatus, onTrafficHit, onPose, incomingRef, airCount = 0, airCombatRef }) {
  const obstacles = useMemo(() => buildings, [buildings]);
  const body = useRef(), state = useRef(createCarState(extent)), keys = useRef(new Set());
  // 전투 차량 포탑 바스켓이다. Cockpit 을 감싸 GROUND_GUNS[vehicle].turret 에 두고
  // aim.yaw 로 돌린다. 비전투 차량과 3인칭에서는 마운트되지 않아 null 로 남는다.
  const basket = useRef();
  const orbit = useRef({ yaw: 0, pitch: 0 });
  // 3인칭 카메라 거리다. 휠로 바꾸고 범위를 넘지 않는다. 차가 화면에서 사라질 만큼 멀어지지 않는다.
  const zoom = useRef(CHASE.distance);
  // 전투 차량은 좌클릭 드래그를 조준에 쓴다. 고개만 돌리는 값은 Q, E 가 따로 만든다.
  const head = useRef(0);
  const pointer = useRef({ id: null, x: 0, yaw: 0 });
  // 발사 반동만 충격량을 쌓고 지수 감쇠로 푼다. 주행 중에는 인위적인 진동을 넣지 않는다.
  const shake = useRef({ pitch: 0, shots: 0 });
  const calm = useRef(false);
  const solution = useRef(null), lastSolve = useRef(-1);
  // 드래그로 시점을 돌렸는지 본다. 전투 차량은 끌지 않고 눌렀다 뗐을 때만 발사한다.
  const dragged = useRef(false), tapShot = useRef(null);
  const kills = useRef(0), lastKill = useRef('');
  // 적기에 맞힌 누적 수다. 조준선이 이 값이 바뀔 때만 번쩍인다.
  const airHits = useRef(0);
  const aim=useRef({yaw:0,pitch:.04}),firing=useRef(false),arsenal=useRef(createGroundArsenal()),destroyed=useRef(new Set());
  // 폭발음을 파괴당 한 번만 낸다. phase 를 바꾸는 경로가 여러 갈래라 값 비교로는 놓친다.
  const boomed=useRef(false);
  const resetNonce = useRef(undefined), lastReport = useRef(-1), mounted = useRef(vehicle);
  // 바퀴 조향과 속도다. 차량 모델(civilian, 전투 차량 모두)이 aimRef 와 같은 방식으로
  // 매 프레임 이 ref 를 직접 읽으므로 상태로 올리지 않는다.
  const wheelsRef = useRef({ steer: 0, speed: 0 });
  // 1인칭 계기 판독값이다. ref 로 두어 0.15초마다 값만 바꾼다. Cockpit 은 다시 렌더하지
  // 않고 매 프레임 이 ref 를 스스로 읽는다.
  const cockpitStatusRef = useRef({});
  // 고정 조준경과 대공포 배율 조준경 모두 우클릭으로 당겨 본다.
  const scoped = cockpitFov(vehicle, true) < cockpitFov(vehicle) || Boolean(scopeSteps(vehicle));
  const [zoomed, setZoomed] = useState(false);
  // 배율 조준경을 쓰는 탈것(대공포) 의 현재 배율이다. 없으면 null 이다.
  const steps = useMemo(() => scopeSteps(vehicle), [vehicle]);
  const [scope, setScope] = useState(() => scopeSteps(vehicle)?.[0] ?? 1);
  useEffect(() => { setScope(scopeSteps(vehicle)?.[0] ?? 1); }, [vehicle]);
  // 조준경을 켠 상태다. 화각을 좁히는 조건과 같다. 1인칭은 조준경이 있는 전투 차량이 우클릭한
  // 동안, 3인칭은 배율 조준경을 1배보다 크게 당긴 동안이다. 카메라 자리와 외장 숨김이 이 값을 읽는다.
  // 조준경은 시점과 배율에 상관없이 우클릭으로 걸린다. 3인칭에서 배율 조건을 걸면
  // 전차는 우클릭을 해도 아무 일이 없고 대공포는 1배에서 암전만 뜬다.
  const scopeOn = isCombatVehicle(vehicle) && zoomed;
  // 조준경 카메라로 옮겨 가는 정도다(0 평소, 1 조준경). 한 프레임에 끊으면 화면이 튄다.
  const scopeBlend = useRef(0);
  const lamps = useRef({ braking: false, reversing: false });
  // 엔진 소리다. 차종마다 하나를 만들어 두고 매 프레임 회전수만 옮긴다.
  const engine = useRef(null);
  // 변속 끊김이다. 단수가 바뀐 프레임에 1 로 올리고 지수로 푼다.
  const shift = useRef({ gear: 1, cut: 0 });
  // 체력은 무장 차량만 갖는다. 세단과 오토바이는 max 가 0 이라 어떤 포탄도 통하지 않는다.
  const health = useRef(createHealth('car', vehicle));
  // 차에서 내리면 늦춰 둔 AI 차를 풀어 준다. 그대로 두면 다음 탑승에서 굳어 있다.
  useEffect(() => clearTrafficYield, []);
  // 조준선도 같이 비운다. 남겨 두면 다음 탑승의 첫 프레임에 지난 자리가 잠깐 보인다.
  useEffect(() => clearAimScreen, []);
  // AI 차량 그릇 둘이다. wide 는 사거리 안 전체, close 는 그 가운데 충돌 반경 안이다.
  const wide = useRef(createTrafficPool()), close = useRef(createTrafficPool());
  // size 는 캔버스의 화면 상자다(width, height 와 화면 왼쪽 위에서의 left, top). 캔버스가
  // 헤더 아래에 붙어 화면 전체가 아니므로 화면 고정인 조준선은 이 오프셋까지 알아야 한다.
  const { camera, gl, size } = useThree();
  /* eslint-disable react-hooks/immutability -- Three 카메라는 명령형 객체다. 투영 갱신은 직접 고치는 것 말고 방법이 없다. */
  useEffect(() => {
    // near 0.5 는 눈에서 0.42 인 조준경과 천장을 잘라낸다. 1인칭에서만 내리고 far 도 같이 줄인다.
    const first = view === 'first';
    // 배율 조준경이 있는 탈것은 3인칭에서도 조준경이 걸린다. 오른쪽 버튼을 누른 동안만이고
    // 배율은 Z 가 고른 단계다. 누르지 않으면 1배라 평소 화각 그대로다.
    const glass = steps && zoomed ? scope : 1;
    camera.fov = steps
      ? (first ? scopeFov(vehicle, glass) : FOV_DEFAULT / glass)
      : first ? cockpitFov(vehicle, zoomed) : FOV_DEFAULT;
    camera.near = first ? NEAR_COCKPIT : NEAR_DEFAULT;
    camera.far = first ? FAR_COCKPIT : FAR_DEFAULT;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = FOV_DEFAULT; camera.near = NEAR_DEFAULT; camera.far = FAR_DEFAULT;
      camera.updateProjectionMatrix();
    };
  }, [camera, view, vehicle, zoomed, steps, scope]);
  /* eslint-enable react-hooks/immutability */

  // 값은 마운트 때 한 번만 읽는다. 참이면 반동과 진동을 0 으로 둔다.
  useEffect(() => { calm.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }, []);

  // 엔진 소리는 차종마다 하나다. 차종을 바꾸거나 주행을 끝내면 끈다.
  useEffect(() => {
    engine.current = createEngineVoice(vehicle);
    return () => { engine.current?.stop(); engine.current = null; };
  }, [vehicle]);

  const vectors = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }), []);
  // 조준경 카메라의 자세만 만드는 빈 카메라다. Object3D 의 lookAt 은 +Z 를 목표로 돌리므로
  // 그대로 쓰면 시선이 180도 뒤집힌다. 카메라여야 -Z 가 목표를 본다.
  const rig = useMemo(() => new THREE.PerspectiveCamera(), []);

  useEffect(() => {
    const canvas = gl.domElement;
    const codes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyV', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const down = (event) => {
      if (event.target.closest?.('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space' && event.target.closest?.('button,a,[role="button"]')) return;
      if (codes.includes(event.code)) { event.preventDefault(); keys.current.add(event.code); }
      // V 는 배율 조준경 단계다. 누를 때마다 한 단계 올라가고 끝에서 처음으로 돈다.
      // 키를 누르고 있는 동안 계속 도는 것을 막으려 repeat 를 거른다.
      if (event.code === 'KeyV' && !event.repeat && steps) setScope((current) => nextScope(vehicle, current));
    };
    const up = (event) => keys.current.delete(event.code);
    const clear = () => {
      keys.current.clear(); setZoomed(false); firing.current = false;
      clearTimeout(tapShot.current);
      pointer.current = { id: null, x: 0, yaw: 0 };
    };
    const start = (event) => {
      if (event.pointerType !== 'mouse') return;
      // 커서가 화면 끝에 닿으면 movementX 가 0 이 되어 포탑이 그 자리에서 멈춘다. 전투 차량은
      // 캔버스를 클릭했을 때만 포인터를 잠근다. 잠그기 전까지는 HUD 버튼을 그대로 누를 수 있고,
      // 잠근 뒤에는 Escape 로 푼다. 잠금을 거부한 브라우저에서도 movementX/Y 로 돈다.
      if (isCombatVehicle(vehicle) && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* 잠금 없이도 조준은 된다 */ }
      }
      if (event.button === 2) {
        if (scoped) setZoomed(true);
        // 오른쪽 버튼도 포탑을 돌린다. 조준경을 당긴 채로 시점을 옮길 수 있어야 한다.
        // 3인칭에서는 아래 궤도 카메라가 이 기록을 읽으므로 궤도의 yaw 와 pitch 를 함께 남긴다.
        // pitch 를 빼먹으면 첫 이동에서 궤도 pitch 가 NaN 이 되어 장면이 통째로 사라진다.
        if (isCombatVehicle(vehicle)) {
          pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
            yaw: view === 'first' ? aim.current.yaw : orbit.current.yaw, pitch: orbit.current.pitch };
          try { canvas.setPointerCapture(event.pointerId); } catch { /* 잠금 중이거나 이미 놓친 포인터다 */ }
        }
        return;
      }
      if (event.button !== 0) return;
      dragged.current = false;
      // 1인칭 전투 차량은 끌어서 포탑을 돌린다. 포탑이 곧 시점이라 이것이 시점 조작이다.
      // 왼쪽 버튼은 끌면서 쏘고, 오른쪽 버튼은 쏘지 않고 돌리기만 한다.
      if (view === 'first' && isCombatVehicle(vehicle)) {
        // 누르고 있는 동안 쏘지 않는다. 시점을 돌리려고 끌 때마다 포탄이 나가면 못 쓴다.
        // 끌지 않고 떼면 한 발 나가고, 계속 쏠 때는 Space 를 누른다. HUD 가 그 단축키를 적어 둔다.
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: aim.current.yaw };
        try { canvas.setPointerCapture(event.pointerId); } catch { /* 잠금 중이거나 이미 놓친 포인터다 */ }
        return;
      }
      // 3인칭은 어떤 차종이든 끌어서 시점을 돌린다. 전투 차량의 발사는 뗄 때 판정한다.
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: orbit.current.yaw, pitch: orbit.current.pitch };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* 잠금 중이거나 이미 놓친 포인터다 */ }
    };
    // 휠은 3인칭 거리다. 범위를 좁게 두어 차가 점이 되거나 차체를 뚫고 들어가지 않는다.
    const wheel = (event) => {
      if (view === 'first') return;
      event.preventDefault();
      const next = zoom.current * (1 + Math.max(-1, Math.min(1, event.deltaY / 240)) * 0.18);
      zoom.current = Math.max(CHASE.near, Math.min(CHASE.far, next));
    };
    // 우클릭은 조준경 배율이다. 기본 메뉴가 뜨면 놓는 순간을 받지 못한다.
    const menu = (event) => event.preventDefault();
    // 크롬은 두 버튼을 함께 쓰면 나중까지 남지 않은 버튼의 pointerup 을 빠뜨린다.
    // 그러면 조준경이 켜진 채로 남아 시점이 돌아오지 않는다. mouseup 도 같이 받는다(WalkMode 와 같다).
    const release = (event) => { if (event.button === 2) setZoomed(false); };
    const move = (event) => {
    // 전투 차량의 포탑 조준이다. 버튼을 누르지 않은 마우스 이동은 1인칭과 3인칭 모두에서
    // 포탑을 돌린다. 좌클릭을 누른 채 끄는 동안은 시점 조작이라 3인칭에서는 아래 궤도
    // 카메라로 내려가고, 1인칭에서는 포탑이 곧 시점이라 여기서 같이 돈다.
    // 손가락은 예전처럼 어느 시점에서나 끌어서 조준한다. 방향키 조준도 그대로 남는다.
    // 버튼 없는 마우스 이동으로 조준하는 것은 포인터가 잠겨 있을 때만이다. 잠금이 없으면
    // 커서를 HUD 버튼에서 화면 가운데로 옮기는 동작까지 조준으로 들어가 포가 홱 돈다.
    // 잠금은 캔버스를 한 번 클릭하면 걸리고 Escape 로 풀린다.
    const freeAim = event.buttons === 0 && document.pointerLockElement === canvas;
    const turning = isCombatVehicle(vehicle)
      && (event.pointerType !== 'mouse' || freeAim
        || (view === 'first' && event.pointerId === pointer.current.id));
    if (turning) {
      const dx=Number.isFinite(event.movementX)&&event.movementX!==0?event.movementX:event.clientX-(pointer.current.x||event.clientX);
      const dy=Number.isFinite(event.movementY)&&event.movementY!==0?event.movementY:event.clientY-(pointer.current.y||event.clientY);
      if (Math.hypot(dx, dy) > DRAG_SLOP) dragged.current = true;
      // 여기서 state 를 올리지 않는다. 포인터 이벤트마다 렌더를 돌리면 초당 백 번 넘게
      // 차량 모델과 실내가 다시 조정된다. 모델과 실내 모두 aim ref 를 매 프레임 읽는다.
      aim.current=aimGroundWeapon(aim.current,dx,dy,vehicle);
      pointer.current.x=event.clientX;pointer.current.y=event.clientY;
      return;
    }
    if (isCombatVehicle(vehicle) && view === 'first') return;
      if (event.pointerId !== pointer.current.id) return;
      // 포인터가 잠겨 있으면 clientX 가 멈춰 있다. 이동량만큼 드래그 시작점을 뒤로 물려
      // 아래의 "시작점에서 얼마나 끌었나" 식을 그대로 쓴다. 잠금이 없으면 예전과 같다.
      if (document.pointerLockElement === canvas) {
        pointer.current.x -= Number(event.movementX) || 0;
        pointer.current.y -= Number(event.movementY) || 0;
      }
      const dx = event.clientX - pointer.current.x, dy = event.clientY - pointer.current.y;
      if (Math.hypot(dx, dy) > DRAG_SLOP) dragged.current = true;
      const from = { yaw: pointer.current.yaw ?? orbit.current.yaw, pitch: pointer.current.pitch ?? orbit.current.pitch };
      orbit.current.yaw = from.yaw - dx * 0.006;
      // 아래로 끌면 아래를 본다. 위로는 더 넓게 두어 신호등과 건물 상단이 보인다.
      orbit.current.pitch = THREE.MathUtils.clamp(from.pitch - dy * 0.004, -0.35, 0.5);
    };
    const stop = (event) => {
      // 전투 차량은 끌지 않고 눌렀다 뗀 클릭만 발사로 친다. 시점을 돌리다 쏘지 않는다.
      if (isCombatVehicle(vehicle) && event.button === 0
        && pointer.current.id === event.pointerId && !dragged.current) {
        firing.current = true;
        clearTimeout(tapShot.current);
        tapShot.current = setTimeout(() => { firing.current = false; }, 90);
      } else {
        firing.current = false;
      }
      if (pointer.current.id !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pointer.current = { id: null, x: 0, yaw: 0 };
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    window.addEventListener('pointerup', release); window.addEventListener('mouseup', release);
    canvas.addEventListener('contextmenu', menu);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop); canvas.addEventListener('lostpointercapture', stop);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      window.removeEventListener('pointerup', release); window.removeEventListener('mouseup', release);
      canvas.removeEventListener('contextmenu', menu);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', stop); canvas.removeEventListener('pointercancel', stop); canvas.removeEventListener('lostpointercapture', stop);
      if (pointer.current.id !== null && canvas.hasPointerCapture(pointer.current.id)) canvas.releasePointerCapture(pointer.current.id);
      // 잠금을 남겨 두면 차에서 내린 뒤에도 커서가 사라진 채로 남는다.
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      clear();
    };
  }, [gl,vehicle,scoped,view,steps]);

  useEffect(() => {
    state.current = createCarState(extent);
    camera.position.set(state.current.x, 6, state.current.z + 14);
  }, [extent, camera]);

  useFrame(({ clock }, delta) => {
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.05)) : 0;
    // 타임어택 시계는 조종 루프가 흘린다. 판이 걸려 있지 않으면 아무 일도 하지 않는다.
    tickTimeAttack(clock.elapsedTime);
    // 뒤따라오는 AI 차가 내 차를 보고 늦춘다. 자리 계산 전에 지난 프레임 자리로 정한다.
    updateTrafficYield(vehicleBox(state.current, vehicle), dt);
    const controls = controlsRef?.current || {};
    // 반경 판정과 파괴 판정을 한 루프에서 끝내고 차 객체는 그릇에서 다시 쓴다. filter 두 번과
    // 차 객체 수백 개를 매 프레임 새로 만들던 자리다.
    const allNear = fillTrafficNear(wide.current, trafficCount, clock.elapsedTime, extent, state.current,
      isCombatVehicle(vehicle) ? 260 : 40, destroyed.current);
    const near = narrowTraffic(close.current, allNear, state.current, 40);
    if (resetNonce.current === undefined) resetNonce.current = controls.resetNonce;
    else if (controls.resetNonce !== resetNonce.current) {
      resetNonce.current = controls.resetNonce;
      state.current = createCarState(extent);
      health.current = createHealth('car', vehicle);
      keys.current.clear();
    }
    // 출발 지점에서 멀리 떨어져 차종을 바꾸면 타던 차가 터지고 3초 뒤 새 차로 다시 탄다.
    if (mounted.current !== vehicle) {
      mounted.current = vehicle;
      health.current = createHealth('car', vehicle);
      // 탈것이 바뀌면 시선과 반동을 0 으로 돌린다. 전차의 포탑각을 세단이 물려받지 않는다.
      orbit.current = { yaw: 0, pitch: 0 }; head.current = 0; shake.current = { pitch: 0, shots: 0 };
      const home = createCarState(extent);
      if (Math.hypot(state.current.x - home.x, state.current.z - home.z) > 40 && state.current.phase !== 'crashed') {
        state.current = { ...state.current, phase: 'crashed', speed: 0, crashElapsed: 0, message: '차종 변경 · 3초 후 새 차량으로 탑승합니다' };
      }
    }
    // 남이 쏜 포탄의 피해는 RemoteCombat 이 한 방향 대기열에 쌓아 둔다. 여기서 읽고 비운다.
    // 차체가 부서지면 이번 프레임부터 폭발이 시작되고 3초 뒤 출발 지점으로 돌아간다.
    const taken = incomingRef?.current;
    if (taken && taken.amount > 0) {
      health.current = hurt(health.current, taken.amount, clock.elapsedTime);
      // eslint-disable-next-line react-hooks/immutability -- incomingRef 는 RemoteCombat 과 공유하는 한 방향 대기열이다. 읽은 뒤 비워야 같은 피해가 두 번 들어오지 않는다.
      taken.amount = 0;
      if (health.current.wrecked && state.current.phase !== 'crashed') {
        state.current = { ...state.current, phase: 'crashed', speed: 0, crashElapsed: 0, message: '차체 파괴 · 3초 후 출발 지점으로 돌아갑니다' };
      }
    }
    health.current = repair(health.current, dt, clock.elapsedTime);
    const wasPhase = state.current.phase;

    const input = keys.current;
    // 전투 차량은 방향키가 포탑 조준이다. 주행은 WASD 만 받는다.
    const combat = isCombatVehicle(vehicle);
    const arrowDrive = (code) => !combat && input.has(code);
    // S 는 달리는 중이면 브레이크, 멈춰 있으면 후진이다. Space 는 핸드브레이크다.
    const backward = input.has('KeyS') || arrowDrive('ArrowDown') || !!controls.reverse;
    const rolling = state.current.speed > 1.5;
    const next = stepCar(state.current, {
      throttle: Math.max(Number(controls.throttle) || 0, Number(input.has('KeyW') || arrowDrive('ArrowUp'))),
      reverse: backward && !rolling ? 1 : 0,
      brake: (backward && rolling) || !!controls.brake,
      handbrake: !combat && (input.has('Space') || !!controls.handbrake),
      steer: (Number(controls.steer) || 0) + Number(input.has('KeyD') || arrowDrive('ArrowRight')) - Number(input.has('KeyA') || arrowDrive('ArrowLeft')),
    }, delta, extent, obstacles, vehicle, near);
    // 어떤 경로로 부서지든 'crashed' 로 들어가는 순간은 한 번뿐이다. 여기서 소리를 낸다.
    // 차끼리 부딪히면 터지지 않고 차체만 깎인다. 무적 시간은 health 가 본다.
    if (next.bumped) {
      const before = health.current;
      health.current = bump(health.current, clock.elapsedTime);
      if (health.current !== before) playBoom('bump');
      if (health.current.wrecked && next.phase !== 'crashed') {
        next.phase = 'crashed'; next.speed = 0; next.crashElapsed = 0;
        next.message = '차체 파괴 · 3초 후 출발 지점으로 돌아갑니다';
      }
    }
    if (next.phase === 'crashed' && !boomed.current) { boomed.current = true; playBoom('self'); }
    else if (next.phase !== 'crashed') boomed.current = false;
    state.current = next;
    // 바퀴 모델이 매 프레임 이 ref 를 읽는다. 0.15초 상태로 올리면 조향이 끊긴다.
    wheelsRef.current = { steer: next.steer, speed: next.speed };
    // 복귀하면 차체를 새로 받는다. 부서진 채로 다시 달리지 않는다.
    if (next.phase === 'drive' && wasPhase !== 'drive') health.current = createHealth('car', vehicle);
    if(combat){
      // 좌우는 포탑, 위아래는 포신이다. 커서 위치로 즉시 스냅하던 방식은 조준이 튀었다.
      const yawInput = Number(input.has('ArrowLeft')) - Number(input.has('ArrowRight'));
      const pitchInput = Number(input.has('ArrowUp')) - Number(input.has('ArrowDown'));
      if (yawInput || pitchInput) aim.current = aimKeyboard(aim.current, yawInput, pitchInput, dt, vehicle);
      const headInput = Number(input.has('KeyQ')) - Number(input.has('KeyE'));
      if (headInput) head.current = THREE.MathUtils.clamp(head.current + headInput * dt * 1.6, -1.2, 1.2);
      // 포탑 바스켓(실내) 이 외장 포탑 dynamic group 과 같은 값으로 돈다. 둘이 어긋나면
      // 실내가 포신을 따라가지 못하고 시야에서 미끄러진다.
      if (basket.current) basket.current.rotation.y = aim.current.yaw;
    }
    const hits=[...(next.kills||[])];
    if(hits.length){
      const spawned=hits.map(hit=>({id:arsenal.current.nextId++,x:hit.x,y:.8,z:hit.z,age:0,life:.9,size:6}));
      arsenal.current={...arsenal.current,blasts:[...arsenal.current.blasts,...spawned]};
    }
    // 대공 사격 목표다. 사거리 안쪽 AI 항공기만 넘긴다. 격추된 기체는 목록에서 빠진다.
    const airTargets = isCombatVehicle(vehicle) && airCombatRef
      ? airTrafficTargets(airCount, clock.elapsedTime, extent, next, AIR_TARGET_RANGE, airCombatRef.current.downed)
      : [];
    arsenal.current=stepGroundWeapons(arsenal.current,{dt,fire:isCombatVehicle(vehicle)&&(firing.current||input.has('Space')||!!controls.fire),pose:next,aim:aim.current,vehicle,buildings:obstacles,traffic:allNear,airTargets});
    // 명중한 AI 항공기에 격추 진행도를 쌓는다. AirTraffic 이 같은 그릇을 읽어 표식과 폭발을 그린다.
    for (const hit of (airCombatRef ? arsenal.current.airHits || [] : [])) {
      const result = applyAirHit(airCombatRef.current, { ...hit, now: clock.elapsedTime });
      // 한 발 맞을 때마다 틱을 치고 조준선을 번쩍인다. 격추는 그 위에 폭발음을 얹는다.
      airHits.current += 1;
      playTick();
      if (result.downed) { kills.current = airCombatRef.current.kills; lastKill.current = airCombatRef.current.label; playBoom('car'); scoreTimeAttack(1); }
    }
    hits.push(...arsenal.current.hits);
    for(const hit of hits)if(!destroyed.current.has(hit.index)){
      destroyed.current.add(hit.index);
      // 화면에 띄울 처치 기록이다. 도보에서 총으로 부순 것과 같은 줄을 쓴다.
      kills.current += 1; lastKill.current = hit.truck ? '트럭' : '차량'; scoreTimeAttack(1);
      playBoom('car');
      onTrafficHit?.(hit);
    }
    // 포탄과 폭발은 더 이상 state 로 올리지 않는다. Tracers 와 BlastField 가 arsenal
    // ref 를 매 프레임 직접 읽으므로 25Hz 로 실내 전체를 다시 조정할 필요가 없다.

    // 엔진 소리다. 회전계와 같은 rpm 을 읽어 귀와 계기가 어긋나지 않는다.
    // 부서졌거나 물에 빠지면 공회전으로 떨어뜨려 소리가 잦아든다.
    const running = next.phase === 'drive';
    // 단수가 바뀌면 잠깐 힘이 빠진다. 회전수는 기어마다 이미 떨어지지만 그것만으로는
    // 변속이 아니라 음이 미끄러지는 것처럼 들린다.
    if (next.gear !== shift.current.gear) { shift.current.gear = next.gear; shift.current.cut = 1; }
    shift.current.cut *= Math.exp(-dt / SHIFT_CUT);
    engine.current?.set({
      throttle: running ? next.throttle || 0 : 0,
      rpm: running ? next.rpm : IDLE_RPM,
      shift: running ? shift.current.cut : 0,
    });
    // 누적 발사 수가 늘어난 프레임에만 충격량을 쌓는다. 기관포는 연사가 빨라 한 발을 약하게 둔다.
    const fired = Math.max(0, (arsenal.current.shots || 0) - shake.current.shots);
    shake.current.shots = arsenal.current.shots || 0;
    if (fired) playTankShot();
    if (fired && !calm.current) shake.current.pitch = Math.min(0.11, shake.current.pitch + recoilKick(vehicle) * fired);
    shake.current.pitch *= Math.exp(-dt * 7);
    // 탄착 해답은 0.05초마다만 다시 푼다. 매 프레임 적분하면 포탄 수명 4초를 프레임마다 굴린다.
    if (combat) {
      if (clock.elapsedTime - lastSolve.current > 0.05) {
        lastSolve.current = clock.elapsedTime;
        solution.current = groundImpact(next, aim.current, vehicle, obstacles);
      }
    } else solution.current = null;

    lamps.current.braking = !!next.braking;
    lamps.current.reversing = next.speed < -0.5;
    body.current.visible = next.phase !== 'crashed';
    body.current.position.set(next.x, next.y, next.z);
    body.current.rotation.set(next.roadPitch || 0, next.heading, next.lean, 'YXZ');

    // 차량도 항공기와 같은 pose 를 내보낸다. 남의 화면이 이 값으로 차체와 포탑, 체력을 그린다.
    onPose?.({
      ...vehicleBox(next, vehicle),
      heading: next.heading, pitch: next.roadPitch || 0, roll: next.lean || 0,
      phase: next.phase === 'sinking' ? 'sinking' : next.phase === 'crashed' ? 'crashed' : 'drive',
      kind: 'car', key: vehicle, hull: hullRatio(health.current) ?? 1,
      shots: arsenal.current.shots || 0, rockets: 0,
      turret: aim.current.yaw, barrel: aim.current.pitch,
    });

    const eye = view === 'first' ? eyePoint(vehicle) : null;
    if (eye) {
      // 폴백하지 않는다. 좌표가 없으면 3인칭을 그대로 쓴다.
      body.current.updateMatrixWorld(true);
      // 전차, 자주포, 대공포는 눈도 포탑 pivot 을 축으로 aim.yaw 만큼 돈다:
      // eye' = pivot + Ry(yaw)(eye - pivot). 포탑 바스켓(실내) 이 그 pivot 에서 같은 각으로
      // 돌므로, 이렇게 하지 않으면 실내가 화면 안에서 미끄러지고 고정돼 있어야 할 계기와
      // 좌석이 옆으로 지나가 버린다. 장갑차는 무인 포탑이 아니라 운전석 위 큐폴라에 차장이
      // 앉으므로(round 1) 눈이 포탑과 함께 돌지 않는다. 시선(카메라 회전) 만 지금처럼
      // aim.yaw, aim.pitch 를 따른다.
      let eyeX = eye[0], eyeZ = eye[2];
      if (combat && vehicle !== 'armored') {
        const [pivotX, , pivotZ] = GROUND_GUNS[vehicle].turret;
        const yaw = aim.current.yaw, cos = Math.cos(yaw), sin = Math.sin(yaw);
        const dx = eye[0] - pivotX, dz = eye[2] - pivotZ;
        eyeX = pivotX + dx * cos + dz * sin;
        eyeZ = pivotZ - dx * sin + dz * cos;
      }
      camera.position.copy(body.current.localToWorld(vectors.position.set(eyeX, eye[1], eyeZ)));
      camera.quaternion.copy(body.current.quaternion);
      // 차체 roll 의 30퍼센트를 되돌려 오토바이 기울기를 70퍼센트만 전달한다. 멀미를 줄이려는 보정이다.
      if (next.lean) camera.rotateZ(-next.lean * 0.3);
      // 전투 차량은 포탑을 따라보고 Q, E 로 고개만 더 돌린다. 비전투는 드래그 값을 쓴다.
      camera.rotateY(combat ? aim.current.yaw + head.current : orbit.current.yaw);
      // 상하도 포신을 따라간다. 예전에는 전투 차량도 orbit.pitch 를 읽었는데 1인칭에서는
      // 그 값을 아무도 건드리지 않아, 포신만 올라가고 시선은 수평에 붙어 있었다.
      // 대공포처럼 하늘을 겨누는 차량은 이래서는 목표를 볼 수 없다.
      // 물에 빠지면 차체가 앞으로 기울어 시선도 같이 내려간다.
      const look = combat ? aim.current.pitch : THREE.MathUtils.clamp(orbit.current.pitch, -0.35, 0.5);
      camera.rotateX(look - (next.pitchDown || 0) + shake.current.pitch);
    } else {
      // 파괴되면 화면을 뒤로 빼 폭발 전체가 들어오게 한다.
      const blast = next.phase === 'crashed' ? Math.min(1, (next.crashElapsed || 0) / 1.1) : 0;
      const viewYaw = next.heading + orbit.current.yaw, back = zoom.current + blast * 34;
      // 끌어올린 만큼 카메라가 높아진다. 기본 각은 지금까지의 13m 뒤, 5.2m 위와 같다.
      const lift = THREE.MathUtils.clamp(CHASE.pitch + orbit.current.pitch, 0.08, 1.15);
      vectors.position.set(
        next.x + Math.sin(viewYaw) * Math.cos(lift) * back,
        next.y + Math.sin(lift) * back + 1.2 + blast * 12,
        next.z + Math.cos(viewYaw) * Math.cos(lift) * back);
      camera.position.lerp(vectors.position, 1 - Math.exp(-dt * (blast ? 2.6 : 7)));
      vectors.position.set(next.x, next.y + 1.4, next.z);
      camera.lookAt(vectors.position);
      // 발사할 때만 3인칭 시선에도 반동을 적용한다.
      if (shake.current.pitch) camera.rotateX(shake.current.pitch * 0.6);
    }

    // 조준경이다. 눈에서 화각만 좁히면 1인칭은 포방패와 포신이, 3인칭은 차체가 화면을 채운다.
    // 켠 동안에는 카메라를 광학 조준경 자리(포구 앞, 포신 축 위) 로 옮겨 포신 방향을 그대로
    // 본다. 자기 장갑이 카메라 뒤에 남으므로 조준경 안에 목표만 들어온다. 위 분기가 정한
    // 자리와 자세에서 blend 만큼 섞어 켜고 끌 때 화면이 튀지 않게 한다.
    // 카메라를 옮기는 것은 3인칭뿐이다. 1인칭은 포수가 이미 조준경 뒤에 앉아 있어 자리를
    // 옮길 필요가 없고, 옮기면 조준경을 뗀 뒤 실내로 돌아오지 못하는 자리가 생긴다.
    // 1인칭에서 장갑이 가리는 것은 scoped 가 캐빈을 숨겨 해결한다.
    const scopeCamera = scopeOn && view !== 'first';
    scopeBlend.current += (Number(scopeCamera && next.phase === 'drive') - scopeBlend.current) * (1 - Math.exp(-dt * SCOPE_BLEND));
    if (scopeBlend.current > 0.002) {
      const sight = scopePoint(next, aim.current, vehicle);
      vectors.position.set(sight.x, sight.y, sight.z);
      vectors.target.set(sight.x + sight.forward.x * SCOPE_REACH, sight.y + sight.forward.y * SCOPE_REACH,
        sight.z + sight.forward.z * SCOPE_REACH);
      rig.position.copy(vectors.position);
      rig.lookAt(vectors.target);
      if (shake.current.pitch) rig.rotateX(shake.current.pitch * 0.6);
      camera.position.lerp(vectors.position, scopeBlend.current);
      camera.quaternion.slerp(rig.quaternion, scopeBlend.current);
    }

    // DOM 조준선이 읽을 화면 좌표다. 1인칭은 눈과 포구가 어긋나 있고 3인칭은 추적 카메라라
    // 어느 쪽도 화면 정중앙이 포구 방향이 아니다. 포구에서 탄착 거리만큼 나간 점을 카메라로
    // 투영해 그 자리를 넘긴다. 포탑을 돌리면 조준선이 그쪽으로 미끄러진다.
    // 탄착점이 있으면 그 점을 그대로 쓴다. 포신 직선 위의 점을 쓰면 포를 들었을 때 낙차만큼
    // 위로 어긋나고, 조금만 들어도 조준선이 화면 밖으로 나간다. 해답이 아직 없을 때만 직선이다.
    if (combat) {
      // 이 프레임에 옮긴 카메라 자세를 반영한다. 렌더러는 이 뒤에 맞추므로 그대로 두면 한 프레임 늦는다.
      camera.updateMatrixWorld();
      const impact = solution.current;
      if (impact && Number.isFinite(impact.x)) setAimScreen(projectAim(camera, impact, null, 0, size));
      else {
        const mouth = muzzlePoint(next, aim.current, vehicle);
        setAimScreen(projectAim(camera, mouth, mouth.forward, AIM_REACH, size));
      }
    }

    if (clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = clock.elapsedTime;
      onCameraChange?.({ x: next.x, z: next.z });
      const report = { ...carStatus(next, vehicle), hull: hullRatio(health.current),
        kills: kills.current, killLabel: lastKill.current, airHits: airHits.current };
      // DOM 조준선이 이 값으로 각도를 픽셀로 바꾼다. 필드 이름을 바꾸면 조준선이 어긋난다.
      if (combat) {
        const hit = solution.current;
        report.aim = { yaw: aim.current.yaw, pitch: aim.current.pitch };
        report.range = hit ? Math.round(hit.range) : null;
        report.impact = hit ? hit.hit : null;
        report.fov = camera.fov; report.zoomed = zoomed;
        // 배율 조준경을 쓰는 탈것만 배율을 올린다. 화면이 이 값으로 눈금을 그린다.
        if (steps) { report.scope = scope; report.scopeSteps = steps; report.scoped = zoomed; }
        // rpm 은 엔진 회전수라 이름을 나눠 쓰지 않는다. 분당 발사 수는 따로 올린다.
        report.roundsPerMinute = roundsPerMinute(vehicle);
      }
      onStatus?.(report);
      // Cockpit 은 이 ref 를 매 프레임 스스로 읽으므로 여기서는 값만 바꾼다. 렌더가 돌지 않는다.
      cockpitStatusRef.current = { ...report, steer: next.steer, weather };
    }
  });

  // 전차, 자주포, 대공포만 바스켓으로 감싼다. 장갑차는 무인 포탑이 아니라 운전석 위 큐폴라에
  // 차장이 앉으므로(round 1) 실내가 포탑과 함께 돌지 않는다. isCombatVehicle 은 무기 조준
  // 판정(GROUND_GUNS) 기준이라 armored 도 여전히 true 지만, 실내 마운트는 따로 가른다.
  const basketFirstPerson = view === 'first' && isCombatVehicle(vehicle) && vehicle !== 'armored';
  return <>
    <group ref={body}>
      {/* 외장은 항상 마운트한다. firstPerson 이 캐빈(대시, 좌석, 포탑 상자, 볼 장갑, 해치) 만
          숨기고 보닛, 펜더, 포신, 포미 마운트, 차체 앞부분은 1인칭에서도 남는다(WP5a). 탈것을
          갈아탈 때 마운트가 끊기지 않아 firstPerson 만 바뀌어도 StaticBatch 가 다시 합쳐진다.
          scoped 는 조준경을 켠 동안 같은 캐빈을 숨긴다. 카메라가 포구 앞으로 나가 있으므로
          대개는 보이지 않지만, 어떤 자세에서도 장갑이 조준경 안에 들어오지 않게 하는 보험이다. */}
      <VehicleModel vehicle={vehicle} wheelsRef={wheelsRef} aimRef={aim} firstPerson={view === 'first'} scoped={scopeOn} />
      {/* 1인칭 전용 실내와 실제 상태를 읽는 계기다. status, 포탑각, 날씨 모두 ref 나 prop 으로
          넘긴다. 전차, 자주포, 대공포는 Cockpit 을 포탑 pivot(GROUND_GUNS[vehicle].turret) 에
          둔 바스켓 group 으로 감싸 aim.yaw 로 돌린다. 바깥 포신(모델의 포탑 dynamic group) 과
          같은 값을 읽으므로 실내가 시야에 고정된 채 포신만 앞에 남는다. 장갑차는 차체(body)
          에 바로 둔다. */}
      {basketFirstPerson
        ? <group ref={basket} position={GROUND_GUNS[vehicle].turret}>
          <Cockpit rideKey={vehicle} statusRef={cockpitStatusRef} aimRef={aim} night={night} quality={quality} weather={weather} />
        </group>
        : view === 'first' && <Cockpit rideKey={vehicle} statusRef={cockpitStatusRef} aimRef={aim} night={night} quality={quality} weather={weather} />}
      <Lights vehicle={vehicle} night={night} lamps={lamps} />
      {pilotName && view !== 'first' && <Html position={[0, 2.2, 0]} center zIndexRange={[14, 1]} distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <span className="world-pilot-label" data-self="">{pilotName}</span>
      </Html>}
    </group>
    <CrashBlast state={state} />
    <Tracers shellsRef={arsenal} max={SHELL_MAX}/>
    <BlastField arsenalRef={arsenal} kind="cannon" />
    {isCombatVehicle(vehicle) && vehicle !== 'aa' && <AimMarker solutionRef={solution} tone="ground" />}
  </>;
}
