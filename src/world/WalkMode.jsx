/** 1인칭 도보 모드. 조작과 카메라만 맡고 이동과 사격 규칙은 walkPhysics.js 가 계산한다.
 * 사람 모델이 없으므로 사람은 쏘지 못한다. 목표는 도시를 도는 AI 차량뿐이다.
 * 좌클릭이 사격, 우클릭이 정조준이다. 정조준은 화각을 당기고 산포와 반동을 줄인다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import WeaponView from './models/WeaponView';
import Blast from './models/Blast';
import VehicleHealthBar from './VehicleHealthBar';
import { trafficBoxes } from './traffic.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { FAR_COCKPIT, FAR_DEFAULT, FOV_DEFAULT, NEAR_COCKPIT, NEAR_DEFAULT } from './eyePoints.js';
import { closeAudio, playBoom, playClick, playHit, playPumpRack, playShot, playStep } from './sound.js';
import {
  EYE_HEIGHT, canAim, createWalkState, crosshairSpread, fireWeapon, leanOffset,
  reloadProgress, selectWeapon, startReload, stepWalk, toggleTorch, vehicleHits, viewAngles, walkFov, weaponSpec,
} from './walkPhysics.js';

const WEAPON_KEY = { Digit1: 'fist', Digit2: 'pistol', Digit3: 'smg', Digit4: 'sniper', Digit5: 'shotgun' };
const BLAST_LIFE = 1.6;
/** 정조준 화각은 한 번에 바뀌지 않는다. 초당 감쇠 계수이며 클수록 빨리 당겨진다. */
const FOV_LERP = 12;
/** 차에 치이는 판정은 코앞만 본다. 도시 전체 차량을 매 프레임 훑지 않는다. */
const THREAT_RADIUS = 12;
/** 총 아래 손전등이다. 거리와 각도는 좁은 손전등 하나만큼이고 그림자는 만들지 않는다. */
const TORCH = { distance: 46, angle: 0.42, penumbra: 0.45, intensity: 22, target: [0, 0, -12] };

/** 총알이 닿은 자리에 이펙트를 띄운다. 차가 부서졌으면 vehicle, 스쳤을 뿐이면 spark 다.
 * 최대 여섯 개만 들고 있는다. 목록이 늘거나(생성) 줄 때(만료)만 다시 렌더한다.
 * 함수형 setState 가 원래 배열을 그대로 돌려주면 React 가 재렌더를 건너뛰므로, 아무것도
 * 바뀌지 않은 프레임에는 커밋이 생기지 않는다. 각 Blast 는 age 를 props 로 받지 않고
 * ageOf() 로 스스로 시간을 읽는다. */
function Blasts({ shots }) {
  const [list, setList] = useState([]);
  const clock = useThree((state) => state.clock);

  useFrame(() => {
    const now = clock.elapsedTime;
    const pending = shots.current.splice(0, shots.current.length);
    if (!pending.length) {
      setList((current) => {
        if (!current.length) return current;
        const alive = current.filter((blast) => now - blast.start < BLAST_LIFE);
        return alive.length === current.length ? current : alive;
      });
      return;
    }
    setList((current) => {
      const grown = current.concat(pending.map((shot) => ({ id: shot.id, kind: shot.kind, x: shot.x, z: shot.z, start: now })));
      const trimmed = grown.length > 6 ? grown.slice(-6) : grown;
      return trimmed.filter((blast) => now - blast.start < BLAST_LIFE);
    });
  });

  return list.map((blast) => <Blast key={blast.id} kind={blast.kind} x={blast.x} y={1.2} z={blast.z}
    ageOf={() => clock.elapsedTime - blast.start} life={BLAST_LIFE} size={blast.kind === 'vehicle' ? 3.2 : 1.4} />);
}

export default function WalkMode({ paused = false, inputBlocked = false, extent, buildings = [], controlsRef, pilotName, trafficCount = 0, onCameraChange, onStatus, onKill, onPose }) {
  const riverfront = useMemo(() => createUrbanPlan(extent).riverfront, [extent]);
  const state = useRef(createWalkState(extent)), keys = useRef(new Set());
  const shots = useRef([]), nextId = useRef(1);
  const firing = useRef(false), aiming = useRef(false), look = useRef({ yaw: 0, pitch: 0 });
  const resetNonce = useRef(undefined), reloadNonce = useRef(undefined), lastReport = useRef(-1);
  const kills = useRef(0), lastKill = useRef('');
  const torchLight = useRef();
  const fov = useRef(walkFov('pistol', false));
  const stepTimer = useRef(0);
  // 차량별로 쌓인 피해다. index -> 0(멀쩡)~1(파괴) 비율. 죽으면 지운다.
  const damage = useRef(new Map());
  const [damaged, setDamaged] = useState([]);
  // weapon/torch/scoped 는 뷰모델이 어떤 가지를 그릴지를 바꾸므로 state 로 남긴다.
  // recoil/걸음/조준/재장전 진행도는 매 프레임 바뀌지만 그림 자체는 바뀌지 않으므로
  // ref 하나(gunLive)에 담아 WeaponView 가 자기 useFrame 에서 직접 읽게 한다.
  const [gun, setGun] = useState({ weapon: 'pistol', torch: false, scoped: false });
  const gunLive = useRef({ recoil: 0, walk: 0, aim: 0, reload: 0 });
  const lastReloadTicks = useRef(0);
  const { camera, gl } = useThree();
  const rig = useRef();
  const scratch = useMemo(() => ({ euler: new THREE.Euler(0, 0, 0, 'YXZ') }), []);
  // 손전등이 비출 방향이다. 리그의 자식이라 총구가 향하는 곳을 그대로 따라간다.
  const torchTarget = useMemo(() => new THREE.Object3D(), []);

  /* eslint-disable react-hooks/immutability -- Three 카메라는 명령형 객체다. 투영 갱신은 직접 고치는 것 말고 방법이 없다. */
  useEffect(() => {
    // 도보는 언제나 1인칭이다. near 0.5 는 손에 든 총을 통째로 잘라낸다.
    camera.near = NEAR_COCKPIT; camera.far = FAR_COCKPIT;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = FOV_DEFAULT; camera.near = NEAR_DEFAULT; camera.far = FAR_DEFAULT;
      camera.updateProjectionMatrix();
    };
  }, [camera]);
  /* eslint-enable react-hooks/immutability */

  useEffect(() => {
    if (inputBlocked) return;
    const canvas = gl.domElement;
    const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyC', 'KeyE', 'KeyR', 'Space',
      'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    const down = (event) => {
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (!codes.includes(event.code)) return;
      event.preventDefault();
      keys.current.add(event.code);
      const pick = WEAPON_KEY[event.code];
      if (pick && pick !== state.current.weapon) { state.current = selectWeapon(state.current, pick); playClick('switch'); }
      if (event.code === 'KeyR') state.current = startReload(state.current);
      // 손전등은 누를 때 한 번만 바뀐다. 길게 눌러도 깜박이지 않는다.
      if (event.code === 'KeyE' && !event.repeat) { state.current = toggleTorch(state.current); playClick('click'); }
    };
    const up = (event) => keys.current.delete(event.code);
    const clear = () => { keys.current.clear(); firing.current = false; aiming.current = false; };
    // 포인터 잠금이 되면 마우스 이동이 그대로 시선이다. 잠기지 않으면 끌어서 돌린다.
    const move = (event) => {
      if (document.pointerLockElement !== canvas && !(event.buttons & 1)) return;
      look.current.yaw += event.movementX * 0.0022;
      look.current.pitch += event.movementY * 0.0022;
    };
    const start = (event) => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      if (event.button === 2) { aiming.current = true; return; }
      if (event.button !== 0) return;
      firing.current = true;
    };
    // 우클릭은 정조준이다. 기본 메뉴가 뜨면 놓는 순간을 받지 못한다.
    const menu = (event) => event.preventDefault();
    const stop = (event) => {
      if (event.button === 2) { aiming.current = false; return; }
      firing.current = false;
    };
    // 크롬은 한 버튼을 이미 누른 채 다른 버튼을 누르면 pointerdown 을 다시 쏘지 않는다.
    // mousedown 은 버튼마다 매번 쏘므로, 우클릭을 쥔 채 좌클릭할 때는 이쪽만 들어온다.
    // 반대로 두 버튼 중 나중까지 남은 버튼이 아닌 쪽을 떼면 pointerup 도 오지 않으므로
    // mouseup 도 똑같이 받아야 정조준을 쥔 채 쏜 사격이 떼는 순간 풀리지 않는다.
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('contextmenu', menu);
    window.addEventListener('pointerup', stop); window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('contextmenu', menu);
      window.removeEventListener('pointerup', stop); window.removeEventListener('mouseup', stop);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      clear();
    };
  }, [gl, inputBlocked]);

  useEffect(() => () => closeAudio(), []);

  useEffect(() => { state.current = createWalkState(extent); lastReloadTicks.current = 0; }, [extent]);

  useFrame(({ clock }, delta) => {
    if (paused) return;
    const controls = controlsRef?.current || {};
    if (resetNonce.current === undefined) resetNonce.current = controls.resetNonce;
    else if (controls.resetNonce !== resetNonce.current) { resetNonce.current = controls.resetNonce; state.current = createWalkState(extent); lastReloadTicks.current = 0; }
    // HUD 버튼이 누른 무기와 재장전이다. 무기는 지금 든 것과 다를 때만, 재장전은 번호가 바뀔 때만 받는다.
    // controlsRef 는 WorldPage 의 것이라 여기서 값을 지우지 않는다.
    if (controls.weapon && controls.weapon !== state.current.weapon) { state.current = selectWeapon(state.current, controls.weapon); playClick('switch'); }
    if (reloadNonce.current === undefined) reloadNonce.current = controls.reloadNonce;
    else if (controls.reloadNonce !== reloadNonce.current) { reloadNonce.current = controls.reloadNonce; state.current = startReload(state.current); }

    const input = keys.current;
    const lookYaw = look.current.yaw + (Number(controls.lookYaw) || 0) * delta;
    const lookPitch = look.current.pitch + (Number(controls.lookPitch) || 0) * delta;
    look.current = { yaw: 0, pitch: 0 };
    // 차에 치이는 판정은 사격 목표와 같은 표를 쓴다. 반경만 좁다.
    const threats = trafficBoxes(trafficCount, clock.elapsedTime, extent, state.current, THREAT_RADIUS);
    const next = stepWalk(state.current, {
      forward: Number(input.has('KeyW')) - Number(input.has('KeyS')) + (Number(controls.forward) || 0),
      strafe: Number(input.has('KeyD')) - Number(input.has('KeyA')) + (Number(controls.strafe) || 0),
      lean: Number(input.has('KeyC')) - Number(input.has('KeyQ')) + (Number(controls.lean) || 0),
      jump: input.has('Space') || !!controls.jump,
      run: input.has('ShiftLeft') || input.has('ShiftRight') || !!controls.run,
      aim: aiming.current || !!controls.aim,
      threats, lookYaw, lookPitch,
    }, delta, extent, buildings, riverfront);
    // 탄이 한 발 채워질 때마다 소리를 낸다. 관형 탄창은 재장전 한 번에 여러 번 울린다.
    // 관형 탄창은 한 발 들어갈 때마다 소리가 난다. 쓰러져 다시 시작하면 숫자가 0 으로 돌아가므로
    // 늘어났을 때만 울린다.
    if (next.reloadTicks > lastReloadTicks.current) playClick('load');
    lastReloadTicks.current = next.reloadTicks;
    state.current = next;

    // 발소리다. 땅에 붙어 걷거나 뛸 때만 주기적으로 낸다. 뛰면 더 잦고 크다.
    if (next.phase === 'walk' && next.moving > 0.05 && !next.airborne) {
      stepTimer.current -= delta;
      if (stepTimer.current <= 0) {
        playStep(next.running);
        stepTimer.current = next.running ? 0.32 : next.aiming ? 0.5 : 0.4;
      }
    } else {
      stepTimer.current = 0;
    }

    if ((firing.current || controls.fire) && next.phase === 'walk') {
      const spec = weaponSpec(next.weapon);
      const targets = trafficBoxes(trafficCount, clock.elapsedTime, extent, next, Math.min(spec.range, 160));
      const shot = fireWeapon(next, { targets, buildings, seed: clock.elapsedTime });
      // 실제로 한 발 나갔을 때만 총성을 낸다. 쿨다운 중이면 아무 소리도 나지 않는다.
      if (shot.state.cooldown > next.cooldown) {
        playShot(next.weapon);
        // 산탄총은 쏜 직후 펌프를 당겨 다음 발을 챔버에 넣는다.
        if (next.weapon === 'shotgun') playPumpRack();
      } else if (shot.state.reloading > 0 && next.reloading === 0) playClick('dry');
      state.current = shot.state;
      if (shot.hits && shot.hits.length) {
        // 산탄총은 pellet 여러 개가 같은 차를 동시에 맞힐 수 있다. 피해는 pellet 마다 쌓되
        // 이펙트와 처치 기록은 차 한 대당 한 번만 낸다.
        const perPellet = 1 / vehicleHits(next.weapon);
        const perCar = new Map();
        for (const hit of shot.hits) perCar.set(hit.index, { hit, count: (perCar.get(hit.index)?.count || 0) + 1 });
        for (const { hit, count } of perCar.values()) {
          const already = damage.current.get(hit.index) || 0;
          const total = already + perPellet * count;
          if (total >= 0.999) {
            damage.current.delete(hit.index);
            shots.current.push({ id: nextId.current++, x: hit.x, z: hit.z, kind: 'vehicle' });
            // 명중 표식과 처치 기록은 같은 수를 읽는다.
            kills.current += 1;
            lastKill.current = hit.truck ? '트럭' : '차량';
            // hideTraffic 은 hit 객체 전체(.index)를 받는다. 인덱스만 보내면 차가 안 사라진다.
            onKill?.(hit, clock.elapsedTime);
            playBoom('car');
            setDamaged((current) => current.includes(hit.index) ? current.filter((index) => index !== hit.index) : current);
          } else {
            damage.current.set(hit.index, total);
            shots.current.push({ id: nextId.current++, x: hit.x, z: hit.z, kind: 'spark' });
            setDamaged((current) => current.includes(hit.index) ? current : [...current, hit.index]);
          }
        }
        playHit();
      }
      // 연발이 아닌 무기는 한 번 누를 때 한 발만 나간다.
      if (next.weapon !== 'smg') firing.current = false;
    }

    const aimed = state.current;
    const view = viewAngles(aimed);
    const peek = leanOffset(aimed);
    camera.position.set(aimed.x + peek.x, aimed.y, aimed.z + peek.z);
    scratch.euler.set(view.pitch, view.heading, peek.roll);
    camera.quaternion.setFromEuler(scratch.euler);
    if (rig.current) { rig.current.position.copy(camera.position); rig.current.quaternion.copy(camera.quaternion); }
    // 손전등은 상태를 다시 렌더하지 않고 조명 하나만 켜고 끈다. 켜는 순간 광원 개수가 바뀌어
    // 도시 재질이 다시 컴파일되는 것은 ShaderPrewarm 이 미리 만들어 막는다. 늘 켜 두면
    // 조명 하나가 매 프레임 모든 화소에서 계산돼 도보가 13% 느려진다.
    if (torchLight.current) torchLight.current.visible = !!aimed.torch;
    // 뷰모델 애니메이션은 매 프레임 이 ref 만 바꾼다. React state 가 아니라 재렌더가 없다.
    const live = gunLive.current;
    live.recoil = aimed.recoil;
    live.walk = aimed.moving;
    live.aim = aimed.aiming ? 1 : 0;
    live.reload = aimed.reloading > 0 ? reloadProgress(aimed) : 0;

    /* eslint-disable react-hooks/immutability -- 카메라 화각은 명령형 객체의 필드다. */
    const wanted = walkFov(aimed.weapon, aimed.aiming);
    if (Math.abs(camera.fov - wanted) > 0.05) {
      fov.current += (wanted - fov.current) * Math.min(1, Math.max(0, delta) * FOV_LERP);
      camera.fov = fov.current;
      camera.updateProjectionMatrix();
    }
    /* eslint-enable react-hooks/immutability */

    if (clock.elapsedTime - lastReport.current > 0.12) {
      lastReport.current = clock.elapsedTime;
      onCameraChange?.({ x: aimed.x, z: aimed.z });
      onPose?.({ x: aimed.x, y: aimed.y || 0, z: aimed.z, heading: aimed.heading || 0, pitch: aimed.pitch || 0, roll: 0, phase: aimed.phase, kind: 'walk', key: 'walk' });
      const pouch = aimed.ammo[aimed.weapon];
      onStatus?.({
        weapon: aimed.weapon, mag: pouch.mag, reserve: pouch.reserve,
        reloading: aimed.reloading > 0, reloadAt: reloadProgress(aimed),
        spread: crosshairSpread(aimed), aiming: aimed.aiming, canAim: canAim(aimed.weapon),
        hp: aimed.hp, maxHp: aimed.maxHp, hurt: aimed.hurt, hurtFrom: aimed.hurtFrom,
        stamina: aimed.stamina, lean: aimed.lean, torch: aimed.torch, airborne: aimed.airborne,
        kills: kills.current, killLabel: lastKill.current,
        recoil: aimed.recoil, phase: aimed.phase, message: aimed.message, running: aimed.running,
      });
      // 저격 조준경을 쓰는 동안은 총기 뷰모델을 숨긴다. 2D 조준경과 3D 총구 렌즈가
      // 동시에 보이면 조준점이 두 개로 갈라진다. weapon/torch/scoped 만 어떤 가지를
      // 그릴지 바꾸므로, 이 셋이 실제로 바뀔 때만 다시 렌더한다.
      const scoped = aimed.aiming && aimed.weapon === 'sniper';
      if (aimed.weapon !== gun.weapon || aimed.torch !== gun.torch || scoped !== gun.scoped) {
        setGun({ weapon: aimed.weapon, torch: aimed.torch, scoped });
      }
    }
  });

  return <>
    <group ref={rig}>
      {!gun.scoped && <WeaponView weapon={gun.weapon} torch={gun.torch} live={gunLive} />}
      <primitive object={torchTarget} position={TORCH.target} />
      <spotLight ref={torchLight} visible={false} position={[0.1, -0.16, -0.34]} target={torchTarget}
        distance={TORCH.distance} angle={TORCH.angle} penumbra={TORCH.penumbra} intensity={TORCH.intensity} castShadow={false} />
    </group>
    <Blasts shots={shots} />
    {damaged.map((index) => <VehicleHealthBar key={index} index={index} extent={extent} trafficCount={trafficCount} damageRef={damage} />)}
    {pilotName && null}
    <mesh position={[0, EYE_HEIGHT, 0]} visible={false} />
  </>;
}
