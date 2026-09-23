/** Flight controller only: visual models live in models/.
 * Obstacle dimensions below approximate civic/airport meshes; review them when
 * changing those models. Input, physics, weapons and network pose publication share
 * the same local state; never move the aircraft by editing the visual Jet itself.
 */
/* eslint-disable react-hooks/immutability -- controlsRef is an intentionally shared imperative input ref, synchronized with the cockpit controls. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import PlaneModel from './models/PlaneModel';
import { cockpitFov, eyePoint, FAR_COCKPIT, FAR_DEFAULT, FOV_DEFAULT, NEAR_COCKPIT, NEAR_DEFAULT } from './eyePoints.js';
import { airImpact } from './reticle.js';
import { playBoom, playBombDrop, playCannon, playMissileLaunch, playSonicBoom, playTick } from './sound.js';
import { createEngineVoice } from './engineSound.js';
import AimMarker from './models/AimMarker';
import Cockpit from './cockpits';
import Projectiles from './models/Projectiles';
import Blast from './models/Blast';
import { armamentOf } from './hardpoints.js';
import { createHealth, hullRatio, hurt, repair } from './health.js';
import { BOMB, createArsenal, muzzleAim, stepWeapons, toWorld } from './weapons.js';
import { projectAim } from './aimScreen.js';
import { clearAimScreen, setAimScreen } from './aimScreenStore.js';
import { createLock, lockProgress, stepLock } from './missileLock.js';
import { clearLockScreen, setLockScreen } from './lockStore.js';
import { airTrafficTargets, applyAirHit, collidesWith, downAirTraffic } from './airTraffic.js';
import { scoreTimeAttack, tickTimeAttack } from './timeAttackStore.js';
import { trafficBoxes } from './traffic.js';
import { createFlightState, stepFlight, flightStatus, hasOverdrive, isDry, machOf } from './flightPhysics.js';
import { createRotorState, stepRotor } from './rotorPhysics.js';
import { createAutopilot, stepAutopilot } from './autopilot.js';

/** 추락 폭발은 발사체 폭발과 같은 Blast 를 쓴다. 나이는 물리가 세는 crashElapsed 뿐이다.
 * 'crashed' 로 들어가고 나갈 때만 마운트를 바꾸고, 그 사이는 Blast 가 ageOf 로 스스로 읽는다
 * (추락마다 최대 두 번의 setState). */
function CrashBlast({ state }) {
  const crashing = useRef(false);
  const [origin, setOrigin] = useState(null);
  useFrame(() => {
    const flight = state.current;
    const isCrashed = flight.phase === 'crashed';
    if (isCrashed && !crashing.current) {
      crashing.current = true;
      setOrigin({ x: flight.x, y: flight.y, z: flight.z });
    } else if (!isCrashed && crashing.current) {
      crashing.current = false;
      setOrigin(null);
    }
  });
  if (!origin) return null;
  return <Blast kind="crash" x={origin.x} y={origin.y} z={origin.z}
    ageOf={() => state.current.crashElapsed || 0} life={3} size={14} />;
}

/** 3인칭 추적 거리다. 기체가 클수록 멀리 잡아야 전체가 들어온다.
 * 폭격기는 날개가 30m 라 기본 거리로는 화면을 벗어난다. */
const CHASE_DISTANCE = Object.freeze({ default: 43, bomber: 68, prop: 36, interceptor: 40 });
/** 부스트 중 추적 거리 배수와 넓어지는 화각(도) 이다. 화면이 뒤로 빠지며 시야가 열린다. */
const BOOST_PULLBACK = 1.18, BOOST_FOV = 7;
/** 초음속에서 더해지는 추적 거리 배수와 화각(도) 이다. 부스트 위에 얹혀 속도감을 키운다. */
const SONIC_PULLBACK = 1.1, SONIC_FOV = 6;
/** AI 항공기 피격 판정을 보는 거리다. 미사일 사거리보다 넉넉하게 잡는다. */
const AIR_TARGET_RANGE = 1600;
/** 지상 소사 판정을 보는 고도와 거리다. 높이 날면 지상 차량을 목록에 담지 않는다. */
const GROUND_STRAFE_CEILING = 420, GROUND_STRAFE_RANGE = 320;
/** 공중 충돌 판정에 쓰는 내 기체 반경이다. onFlightPose 가 내보내는 값과 같다. */
const SELF_RADIUS = 6;
/** 탄착 해답이 아직 없을 때 조준선을 맺는 거리(m) 다. 시차 보정에만 쓴다. */
const AIM_REACH = 400;

export default function FlightMode({ extent, buildings=[], controlsRef, onCameraChange, onStatus, onFlightPose, plane, pilotName, view = 'third', incomingRef, airCount = 0, airCombatRef, trafficCount = 0, onTrafficHit, peersRef, night = false, weather = 'clear'}) {
  // 폭발음을 파괴당 한 번만 낸다. phase 를 바꾸는 경로가 여러 갈래라 값 비교로는 놓친다.
  const boomed=useRef(false);
  // 엔진 소리다. 기종마다 하나를 만들어 두고 매 프레임 값만 옮긴다.
  const engine=useRef(null);
  // 음속을 넘는 순간에만 한 번 울린다. 마하 근처에서 값이 오르내려도 다시 울리지 않게 상태로 센다.
  const sonic=useRef(false);
  // 격추 수와 마지막 기종이다. HUD 의 처치 기록이 이 두 값을 읽는다.
  const kills=useRef(0), killed=useRef('');
  // 적기에 맞힌 누적 수다. 조준선이 이 값이 바뀔 때만 번쩍인다.
  const airHits=useRef(0);
  // 이미 부순 지상 차량이다. 같은 차를 두 번 세지 않는다.
  const wrecked=useRef(new Set());
  // 막히는 것은 WorldScene 이 한 배열로 모아 준다. 지상과 하늘이 같은 목록을 봐야
  // 차가 부딪히는 자리에서 기체도 부딪힌다.
  const obstacles=buildings;
  const orbit=useRef({yaw:0,pitch:.32});
  // 발사 반동만 충격량을 쌓고 지수 감쇠로 푼다. 비행 중에는 인위적인 진동을 넣지 않는다.
  const shake=useRef({pitch:0,shots:0,rockets:0,bombs:0});
  const calm=useRef(false);
  const gunHit=useRef(null), missileHit=useRef(null), bombHit=useRef(null);
  // 미사일 포착이다. 사거리 안 적기를 기수에 담고 있으면 진행도가 차고, 다 차면 락온이다.
  // 락온한 채로 쏜 미사일만 유도된다. 판정은 missileLock.js 한 곳이 한다.
  const lock = useRef(createLock());
  // 1인칭 계기 판독값이다. ref 로 두어 0.15초마다 값만 바꾼다. Cockpit 은 다시 렌더하지
  // 않고 매 프레임 이 ref 를 스스로 읽는다.
  const cockpitStatusRef=useRef({});
  // 헬기는 고정익과 상태 모양이 같고 물리만 다르다. 카메라, 네트워크, 라벨은 그대로 쓴다.
  const rotor = plane === 'helicopter';
  // 헬리패드가 터미널 단지와 함께 서쪽으로 20 옮겨 로컬 x -55 가 됐다. 카메라 홈도 같이 옮긴다.
  const home = useMemo(() => rotor ? { x: extent + 55, z: -20, look: -60 } : { x: extent + 110, z: 176, look: 125 }, [rotor, extent]);
  const jet = useRef(), state = useRef(rotor ? createRotorState(extent) : createFlightState(extent)), keys = useRef(new Set());
  const arsenal = useRef(createArsenal(plane));
  // 체력은 무장한 기체만 갖는다. 제트와 헬기는 max 가 0 이라 포탄이 통하지 않는다.
  const health = useRef(createHealth('flight', plane));
  const autopilot = useRef(createAutopilot());
  const applied = useRef({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
  // Q 로 고르는 부스트 단계다. 요격기만 쓰고 다른 기종에서는 물리가 무시한다. */
  const overdrive = useRef(false);
  const mounted = useRef(plane);
  const mounts = useMemo(()=>armamentOf(plane),[plane]);
  // 배기 효과(PlaneModel, EngineGlow)가 aimRef 와 같은 방식으로 매 프레임 이 ref 를 직접
  // 읽으므로 상태로 올리지 않는다.
  const glowRef = useRef({ throttle: 0, phase: 'runway', bay: 0 });
  const pointer = useRef({ id: null, x: 0, y: 0, pitch: 0, yaw: 0 });
  const resetNonce = useRef(controlsRef?.current?.resetNonce), lastReport = useRef(-1);
  // size 는 캔버스의 화면 상자다(width, height 와 화면 왼쪽 위에서의 left, top). 캔버스가
  // 헤더 아래에 붙어 화면 전체가 아니므로 화면 고정인 조준선은 이 오프셋까지 알아야 한다.
  const { camera, gl, size } = useThree();
  // 기체에서 내리면 조준선을 비운다. 남겨 두면 다음 탑승의 첫 프레임에 지난 자리가 잠깐 보인다.
  useEffect(() => clearAimScreen, []);
  // 기종을 바꾸거나 내리면 포착 네모를 지운다. 남겨 두면 다음 탑승 첫 프레임에 지난 자리가 보인다.
  useEffect(() => { lock.current = createLock(); return clearLockScreen; }, [plane]);
  useEffect(() => {
    // near 0.5 는 눈에서 0.5 인 캐노피 레일과 조종간 그립을 경계에서 자른다. 1인칭에서만 내린다.
    const first = view === 'first';
    camera.fov = first ? cockpitFov(plane) : FOV_DEFAULT;
    camera.near = first ? NEAR_COCKPIT : NEAR_DEFAULT;
    camera.far = first ? FAR_COCKPIT : FAR_DEFAULT;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = FOV_DEFAULT; camera.near = NEAR_DEFAULT; camera.far = FAR_DEFAULT;
      camera.updateProjectionMatrix();
    };
  }, [camera, view, plane]);
  // 값은 마운트 때 한 번만 읽는다. 참이면 발사 반동을 0 으로 둔다.
  useEffect(() => { calm.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }, []);

  // 엔진 소리는 기종마다 하나다. 기종을 바꾸거나 비행을 끝내면 끈다.
  useEffect(() => {
    engine.current = createEngineVoice(plane);
    return () => { engine.current?.stop(); engine.current = null; };
  }, [plane]);

  const vectors = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }), []);
  useEffect(() => {
    const canvas = gl.domElement;
    const codes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyV', 'Space', 'ShiftLeft', 'ShiftRight',
      'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'ArrowUp', 'ArrowDown'];
    const down = (event) => {
      if (event.target.closest?.('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space' && event.target.closest?.('button,a,[role="button"]')) return;
      if (codes.includes(event.code)) { event.preventDefault(); keys.current.add(event.code); }
      // 누른 순간에만 단계를 바꾼다. 누르고 있으면 repeat 가 초당 수십 번 들어와 단계가 떨린다.
      // 단계가 없는 기종에서도 값만 바뀌고 물리는 이 값을 읽지 않는다.
      if (event.code === 'KeyQ' && !event.repeat) overdrive.current = !overdrive.current;
    };
    const up = (event) => keys.current.delete(event.code);
    const clear = () => { keys.current.clear(); pointer.current = { id: null, pitch: 0, yaw: 0 }; };
    const start = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, orbitYaw:orbit.current.yaw, orbitPitch:orbit.current.pitch };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event) => {
      const drag = pointer.current;
      if (event.pointerId !== drag.id) return;
      orbit.current.pitch = THREE.MathUtils.clamp(drag.orbitPitch+(event.clientY-drag.y)*.004,-.2,1.2);
      orbit.current.yaw = drag.orbitYaw-(event.clientX-drag.x)*.006;
    };
    const stop = (event) => {
      if (pointer.current.id !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pointer.current = { id: null, pitch: 0, yaw: 0 };
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop); canvas.addEventListener('lostpointercapture', stop);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', stop); canvas.removeEventListener('pointercancel', stop); canvas.removeEventListener('lostpointercapture', stop);
      if (pointer.current.id !== null && canvas.hasPointerCapture(pointer.current.id)) canvas.releasePointerCapture(pointer.current.id);
      clear();
    };
  }, [gl]);
  useEffect(() => {
    state.current = rotor ? createRotorState(extent) : createFlightState(extent, plane);
    arsenal.current = createArsenal(plane);
    overdrive.current = false;
    camera.position.set(home.x, 15, home.z);
    camera.lookAt(home.x, 3, home.look);
  }, [extent, camera, rotor, home, plane]);
  useFrame(({ clock }, delta) => {
    tickTimeAttack(clock.elapsedTime);
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.05)) : 0;
    const controls = controlsRef?.current || {};
    if (controls.resetNonce !== resetNonce.current) {
      resetNonce.current = controls.resetNonce;
      overdrive.current = false;
      state.current = rotor ? createRotorState(extent) : createFlightState(extent, plane);
      arsenal.current = createArsenal(plane);
      health.current = createHealth('flight', plane);
      autopilot.current = createAutopilot();
      controls.throttle = 0;
      keys.current.clear(); pointer.current.pitch = 0; pointer.current.yaw = 0;
      camera.position.set(home.x, 15, home.z);
    }
    // 활주로 밖에서 기종을 바꾸면 타던 기체가 터지고 3초 뒤 새 기체로 다시 탄다.
    if (mounted.current !== plane) {
      mounted.current = plane;
      health.current = createHealth('flight', plane);
      // 기종이 바뀌면 반동과 탄착 해답을 비운다. 전투기의 표식이 다음 기체에 남지 않는다.
      shake.current = { pitch: 0, shots: 0, rockets: 0, bombs: 0 };
      gunHit.current = null; missileHit.current = null; bombHit.current = null;
      if (state.current.phase === 'airborne') {
        state.current = { ...state.current, phase: 'crashed', speed: 0, crashElapsed: 0, message: '기종 변경 · 3초 후 새 기체로 탑승합니다' };
        controls.throttle = 0;
      }
    }
    // 남이 쏜 포탄의 피해는 RemoteCombat 이 한 방향 대기열에 쌓아 둔다. 여기서 읽고 비운다.
    const taken = incomingRef?.current;
    if (taken && taken.amount > 0) {
      health.current = hurt(health.current, taken.amount, clock.elapsedTime);
      taken.amount = 0;
      if (health.current.wrecked && state.current.phase !== 'crashed') {
        state.current = { ...state.current, phase: 'crashed', speed: 0, crashElapsed: 0, message: '피탄 · 3초 후 새 기체로 탑승합니다' };
        controls.throttle = 0;
      }
    }
    health.current = repair(health.current, dt, clock.elapsedTime);

    const input = keys.current;
    const staged = hasOverdrive(plane);
    const throttleChange = Number(input.has('Equal') || input.has('NumpadAdd') || input.has('ArrowUp')) - Number(input.has('Minus') || input.has('NumpadSubtract') || input.has('ArrowDown'));
    if (throttleChange) controls.throttle = THREE.MathUtils.clamp((Number(controls.throttle) || 0) + throttleChange * dt * 0.35, 0, 1);
    let command = {
      throttle: controls.throttle || 0,
      brake: input.has('Space') || !!controls.brake,
      pitch: (Number(controls.pitch) || 0) + Number(input.has('KeyW')) - Number(input.has('KeyS')),
      roll: (Number(controls.roll) || 0) + Number(input.has('KeyD')) - Number(input.has('KeyA')),
      // 왼쪽 러더는 Q 와 Z 다. 요격기는 Q 가 부스트 단계 전환이라 Z 만 남는다.
      yaw: (Number(controls.yaw) || 0) + Number(input.has('KeyE'))
        - Number(input.has('KeyZ')) - Number(!staged && input.has('KeyQ')),
      // 부스트는 연료가 있는 기종만 쓴다. 다른 기종은 flightPhysics 가 무시한다.
      boost: input.has('ShiftLeft') || input.has('ShiftRight') || !!controls.boost,
      // 고른 단계는 부스트를 놓아도 남는다. Shift 를 누르는 순간 이 단계로 가속한다.
      overdrive: staged && overdrive.current,
    };
    // 자동 비행은 조종 입력을 대신 만든다. 스로틀 값은 조종석 슬라이더와 맞춰 둔다.
    const auto = !!controls.autopilot;
    if (!auto) { if (autopilot.current.mode !== 'depart') autopilot.current = createAutopilot(); }
    else {
      const guided = stepAutopilot(autopilot.current, state.current, { extent, dt, rotor });
      autopilot.current = guided.ap;
      command = guided.input;
      controls.throttle = guided.input.throttle;
    }
    // 자동 비행은 조종 입력을 통째로 갈아치운다. 부스트 단계는 조종이 아니라 모드라 그대로 남긴다.
    if (staged) command = { ...command, overdrive: overdrive.current };
    // 콕핏 조종간은 실제로 적용된 입력을 봐야 한다. controls 에는 터치 조이스틱 값만 들어오므로
    // 키보드로만 조종하면 조종간이 꿈쩍하지 않았다. 자동 비행 입력도 같은 자리를 지난다.
    applied.current.pitch = command.pitch; applied.current.roll = command.roll;
    applied.current.yaw = command.yaw; applied.current.throttle = command.throttle;
    const next = rotor ? stepRotor(state.current, command, delta, extent, obstacles)
      : stepFlight(state.current, command, delta, extent, obstacles, plane);
    if (next.phase==='crashed' || (state.current.phase==='crashed' && next.phase==='runway')) controls.throttle = 0;
    const respawned=state.current.phase==='crashed' && next.phase==='runway';
    if(respawned){camera.position.set(home.x,15,home.z);orbit.current={yaw:0,pitch:.32};health.current=createHealth('flight',plane);}
    // 격추, 추락, 충돌 어느 쪽이든 'crashed' 진입은 한 번뿐이다. 여기서 소리를 낸다.
    // 마하 1 을 넘은 순간 한 번 울린다. 되돌아올 때는 0.97 아래로 떨어져야 다시 무장한다.
    if (next.supersonic && !sonic.current) { sonic.current = true; playSonicBoom(); }
    else if (sonic.current && machOf(next.speed) < 0.97) sonic.current = false;
    if (next.phase === 'crashed' && !boomed.current) { boomed.current = true; playBoom('self'); }
    else if (next.phase !== 'crashed') boomed.current = false;
    state.current = next;
    // AI 항공기 목표는 사거리 안쪽만 추린다. 도시 전체를 매 프레임 훑지 않는다.
    const airTargets = mounts && airCombatRef
      ? airTrafficTargets(airCount, clock.elapsedTime, extent, next, AIR_TARGET_RANGE, airCombatRef.current.downed)
      : [];
    // 미사일을 든 기종만 포착한다. 목표는 지금 프레임의 airTargets 에서 고른다.
    lock.current = mounts?.missile?.length && next.phase === 'airborne'
      ? stepLock(lock.current, { pose: next, targets: airTargets, dt })
      : createLock();
    // 지상 AI 차량이다. 기관포는 저공의 기체 주변, 폭탄은 현재 낙하 위치 주변을 본다.
    // 폭격기가 투하 후 멀리 지나가도 폭발 반경 안의 차량이 판정에서 빠지지 않는다.
    const traffic = [], trafficSeen = new Set();
    const trafficOrigins = [];
    if (mounts && next.y < GROUND_STRAFE_CEILING) trafficOrigins.push([next, GROUND_STRAFE_RANGE]);
    for (const projectile of arsenal.current.projectiles || []) {
      if (projectile.kind === 'bomb') trafficOrigins.push([projectile, BOMB.blast + 8]);
    }
    for (const [origin, radius] of trafficOrigins) {
      for (const box of trafficBoxes(trafficCount, clock.elapsedTime, extent, origin, radius)) {
        if (wrecked.current.has(box.index) || trafficSeen.has(box.index)) continue;
        trafficSeen.add(box.index); traffic.push(box);
      }
    }
    if (mounts) arsenal.current = stepWeapons(arsenal.current, {
      dt, pose: next, mounts, obstacles, airTargets, traffic, extent, plane,
      // 락온했을 때만 목표 번호를 넘긴다. 아니면 예전처럼 곧게 나간다.
      seek: lock.current.locked ? lock.current.index : null,
      fire: {
        cannon: input.has('Space') || !!controls.fireCannon,
        missile: input.has('KeyV') || !!controls.fireMissile,
        // 폭격기는 Space 가 투하다. 기관총이 없어 같은 키를 나눠 쓰지 않는다.
        bomb: input.has('Space') || !!controls.fireBomb,
      },
    });
    // 배기, 프로펠러, 폭탄창 문이 매 프레임 이 ref 를 읽는다. 0.1 단위 버킷으로 반올림하지
    // 않는다. 렌더를 다시 돌리는 게 아니라 ref 를 바꾸는 것뿐이라 매 프레임 값 그대로 써도 된다.
    glowRef.current = { throttle: isDry(next) ? 0 : (next.throttle || 0), phase: next.phase, bay: arsenal.current.bayOpen || 0 };
    // 부순 지상 차량은 화면에서 지우고 처치 기록에 올린다. 주행, 도보와 같은 경로다.
    for (const hit of arsenal.current.hits || []) {
      if (wrecked.current.has(hit.index)) continue;
      wrecked.current.add(hit.index);
      kills.current += 1; killed.current = hit.truck ? '트럭' : '차량'; scoreTimeAttack(1);
      playBoom('car');
      onTrafficHit?.(hit, clock.elapsedTime);
    }
    // 명중한 AI 항공기에 격추 진행도를 쌓는다. 격추 표시와 폭발은 AirTraffic 이 같은 그릇을 읽는다.
    for (const hit of (airCombatRef ? arsenal.current.airHits || [] : [])) {
      const result = applyAirHit(airCombatRef.current, { ...hit, now: clock.elapsedTime });
      // 한 발 맞을 때마다 틱을 치고 조준선을 번쩍인다. 격추는 그 위에 폭발음을 얹는다.
      airHits.current += 1;
      playTick();
      if (result.downed) { kills.current = airCombatRef.current.kills; killed.current = airCombatRef.current.label; playBoom('car'); scoreTimeAttack(1); }
    }
    // 공중 충돌이다. AI 항공기든 다른 조종사든 닿으면 둘 다 터진다.
    // 상대 조종사 쪽은 그 브라우저가 같은 판정을 따로 하므로 여기서는 내 기체만 부순다.
    if (next.phase === 'airborne') {
      const me = { x: next.x, y: next.y, z: next.z, radius: SELF_RADIUS };
      const struck = collidesWith(me, airTargets)
        || collidesWith(me, peersRef?.current
          ?.filter((peer) => peer.pose?.kind === 'flight' && peer.pose.phase === 'airborne')
          .map((peer) => ({ x: peer.pose.x, y: peer.pose.y, z: peer.pose.z, radius: peer.pose.radius || SELF_RADIUS })) || []);
      if (struck) {
        if (Number.isFinite(struck.index) && airCombatRef) downAirTraffic(airCombatRef.current, struck.index, clock.elapsedTime);
        state.current = { ...next, phase: 'crashed', speed: 0, crashElapsed: 0, message: '공중 충돌 · 3초 후 새 기체로 탑승합니다' };
        controls.throttle = 0;
      }
    }
    // 발사 수를 센 뒤에 내보낸다. 같은 프레임의 발사가 남의 화면에서 한 틱 늦지 않게 한다.
    // radius 는 공중 충돌 판정용 구다. 상자를 쓰면 기체가 기울 때 판정이 어긋난다.
    onFlightPose?.({ ...next, kind: 'flight', key: plane, radius: 6, hull: hullRatio(health.current) ?? 1,
      shots: arsenal.current.shots || 0, rockets: arsenal.current.rockets || 0, turret: 0, barrel: 0 });
    // 엔진 소리다. 추락하면 스로틀을 0 으로 보내 소리가 잦아든다.
    // 연료가 마르면 엔진이 선다. 스로틀 레버는 그대로여도 소리와 배기는 끊긴다.
    // 추력은 이미 flightPhysics 가 0 으로 두므로 여기서는 소리만 같은 조건으로 맞춘다.
    engine.current?.set({
      throttle: next.phase === 'crashed' || isDry(next) ? 0 : next.throttle || 0,
      boost: !!next.boost,
    });
    // 기관총은 아주 약하게, 미사일은 중간으로 얹는다. 연사 중에도 같은 값이 계속 쌓인다.
    const firedGun = Math.max(0, (arsenal.current.shots || 0) - shake.current.shots);
    const firedRocket = Math.max(0, (arsenal.current.rockets || 0) - shake.current.rockets);
    const firedBomb = Math.max(0, (arsenal.current.bombs || 0) - shake.current.bombs);
    shake.current.shots = arsenal.current.shots || 0; shake.current.rockets = arsenal.current.rockets || 0;
    shake.current.bombs = arsenal.current.bombs || 0;
    if (firedGun) playCannon();
    if (firedRocket) playMissileLaunch();
    if (firedBomb) playBombDrop();
    if ((firedGun || firedRocket) && !calm.current) shake.current.pitch = Math.min(0.06, shake.current.pitch + firedGun * 0.002 + firedRocket * 0.016);
    shake.current.pitch *= Math.exp(-dt * 8);
    // 탄착 해답은 현재 발사 자세와 맞춰 매 프레임 갱신한다. 오래된 화면 좌표를 쓰면
    // 기체가 빠르게 선회할 때 실제 탄도와 조준선이 벌어진다.
    if (mounts) {
      // 기종마다 푸는 해답이 다르다. 전투기는 기관총과 미사일, 프로펠러기는 기관총, 폭격기는 폭탄이다.
      gunHit.current = mounts.cannon ? airImpact({ ...next, key: plane }, 'cannon', obstacles) : null;
      missileHit.current = mounts.missile ? airImpact({ ...next, key: plane }, 'missile', obstacles) : null;
      bombHit.current = mounts.bomb ? airImpact({ ...next, key: plane }, 'bomb', obstacles) : null;
    }
    // 부스트 화각이다. 한 번에 바꾸지 않고 따라가게 해 화면이 튀지 않는다.
    const wantFov = (view==='first' ? cockpitFov(plane) : FOV_DEFAULT) + (next.boost ? BOOST_FOV : 0) + (next.supersonic ? SONIC_FOV : 0);
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }
    jet.current.visible=next.phase!=='crashed';
    jet.current.position.set(next.x, next.y, next.z);
    jet.current.rotation.set(next.pitch, next.heading, next.roll, 'YXZ');
    orbit.current.yaw-=(Number(controls.cameraYaw)||0)*dt*1.7;
    orbit.current.pitch=THREE.MathUtils.clamp(orbit.current.pitch-(Number(controls.cameraPitch)||0)*dt,-.2,1.2);
    const eye=view==='first'?eyePoint(plane):null;
    if(eye){
      // 기체 자세를 그대로 따라간다. orbit 은 고개만 돌리는 값이다.
      jet.current.updateMatrixWorld(true);
      camera.position.copy(jet.current.localToWorld(vectors.position.set(eye[0],eye[1],eye[2])));
      camera.quaternion.copy(jet.current.quaternion);
      camera.rotateY(orbit.current.yaw);
      camera.rotateX(-orbit.current.pitch+.32+shake.current.pitch);
    } else {
      // 추락하면 화면을 뒤로 빼 폭발 전체가 들어오게 한다. 3초 복귀 동안 천천히 벌어진다.
      const blast=next.phase==='crashed'?Math.min(1,(next.crashElapsed||0)/1.1):0;
      // 부스트 중에는 카메라를 조금 더 빼 속도감을 준다.
      const base=CHASE_DISTANCE[plane]??CHASE_DISTANCE.default;
      const viewYaw=next.heading+orbit.current.yaw, distance=base*(next.boost?BOOST_PULLBACK:1)*(next.supersonic?SONIC_PULLBACK:1);
      const lookPitch=orbit.current.pitch+blast*.22;
      vectors.position.set(next.x+Math.sin(viewYaw)*Math.cos(lookPitch)*(distance+blast*74),
        Math.max(3,next.y+Math.sin(lookPitch)*distance+blast*16),next.z+Math.cos(viewYaw)*Math.cos(lookPitch)*distance);
      camera.position.lerp(vectors.position, 1 - Math.exp(-dt * (blast?2.4:5)));
      vectors.target.set(next.x, next.y+1, next.z);
      camera.lookAt(vectors.target);
      // 발사할 때만 3인칭 시선에도 반동을 적용한다.
      if (shake.current.pitch) camera.rotateX(shake.current.pitch*.6);
    }
    // DOM 조준선이 읽을 화면 좌표다. 1인칭 카메라는 기수보다 아래를 보고(위의 +.32) 3인칭은
    // 추적 카메라라 어느 쪽도 화면 정중앙이 총구 방향이 아니다. 총구에서 탄착 거리만큼 나간
    // 점을 카메라로 투영해 그 자리를 넘긴다. 기수를 들면 조준선이 위로 간다.
    // 폭탄은 중력을 받아 기수 방향과 다른 곳에 떨어지므로 낙하점을 그대로 쓴다.
    if (mounts) {
      // 이 프레임에 옮긴 카메라 자세를 반영한다. 렌더러는 이 뒤에 맞추므로 그대로 두면 한 프레임 늦는다.
      camera.updateMatrixWorld();
      // 포착 네모는 조준선과 달리 적기 자리에 얹는다. 목표가 없으면 store 를 비운다.
      const marked = lock.current.target;
      if (marked) {
        const screen = projectAim(camera, marked, null, 0, size);
        setLockScreen({ x: screen.x, y: screen.y, behind: screen.behind || screen.clamped,
          progress: lockProgress(lock.current), locked: lock.current.locked, range: lock.current.range });
      } else clearLockScreen();
      const port = mounts.cannon?.[0];
      if (port) {
        // 탄착점이 풀렸으면 그 점을 그대로 쓴다. 직선 위의 점을 쓰면 낙차만큼 위로 어긋난다.
        const impact = gunHit.current;
        if (impact && Number.isFinite(impact.x)) setAimScreen(projectAim(camera, impact, null, 0, size));
        else {
          // 발사와 같은 식을 쓴다(weapons.spawn). 수렴 사격을 하는 기종은 포구마다 방향이 다르다.
          const local = toWorld(next, port), forward = toWorld(next, muzzleAim(port, mounts.converge || 0));
          setAimScreen(projectAim(camera,
            { x: next.x + local.x, y: next.y + local.y, z: next.z + local.z }, forward, AIM_REACH, size));
        }
      } else if (bombHit.current) {
        setAimScreen(projectAim(camera, bombHit.current, null, 0, size));
      }
    }
    if (clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = clock.elapsedTime;
      onCameraChange?.({ x: next.x, z: next.z });
      const report={ ...flightStatus(next), climb: next.climb, armed: !!mounts, autopilot: auto ? autopilot.current.mode : null,
        cannonAmmo: arsenal.current.cannonAmmo, missileAmmo: arsenal.current.missileAmmo,
        bombAmmo: arsenal.current.bombAmmo, bayOpen: arsenal.current.bayOpen > 0.02,
        hull: hullRatio(health.current), kills: kills.current, killLabel: killed.current, airHits: airHits.current };
      // DOM 조준선이 이 값으로 각도를 픽셀로 바꾼다. 필드 이름을 바꾸면 조준선이 어긋난다.
      if (mounts) {
        const hit = gunHit.current || bombHit.current;
        report.range = hit ? Math.round(hit.range) : null;
        report.impact = hit ? hit.hit : null;
        report.fov = camera.fov; report.zoomed = false;
      }
      onStatus?.(report);
      // Cockpit 은 이 ref 를 매 프레임 스스로 읽으므로 여기서는 값만 바꾼다. 렌더가 돌지 않는다.
      // weather 는 report 자체(HUD 로 나가는 값) 에는 넣지 않고 콕핏이 읽는 복사본에만 더한다.
      if(view==='first')cockpitStatusRef.current={ ...report, weather };
    }
  });
  return <><group ref={jet}>
    {/* 외장은 항상 마운트한다. firstPerson 이 조종석 캐노피, 대시, 좌석 같은 캐빈만 숨기고
        기수, 날개, 동체, 랜딩기어는 1인칭에서도 남는다(WP5b). 실내 구조는 Cockpit 이 그린다. */}
    <PlaneModel plane={plane} glowRef={glowRef} firstPerson={view === 'first'} />
    {/* 콕핏은 카메라가 실내에 있을 때만 마운트한다. 3인칭에서는 삼각형을 쓰지 않는다. */}
    {/* status, 조종간, 자세, 날씨 모두 ref 나 prop 이다. Cockpit 과 계기는 부모가 다시 렌더하지
        않아도 매 프레임 스스로 읽는다. */}
    {view==='first' && <Cockpit rideKey={plane} statusRef={cockpitStatusRef} controlsRef={applied} poseRef={state} night={night} weather={weather} />}
    {pilotName && view!=='first' && <Html position={[0,6,0]} center zIndexRange={[14,1]} distanceFactor={24} style={{pointerEvents:'none'}}><span className="world-pilot-label" data-self="">{pilotName}</span></Html>}
  </group>
  {mounts && <Projectiles arsenalRef={arsenal} />}
  {mounts?.cannon && <AimMarker solutionRef={gunHit} tone="air" />}
  {mounts?.missile && <AimMarker solutionRef={missileHit} tone="missile" />}
  {mounts?.bomb && <AimMarker solutionRef={bombHit} tone="bomb" />}
  <CrashBlast state={state} /></>;
}
