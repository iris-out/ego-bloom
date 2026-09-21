/** 나중에 처음 그려질 셰이더 프로그램을 도시가 뜬 뒤 한가할 때 미리 만든다.
 *
 * three 의 프로그램 키에는 광원 개수와 톤매핑이 들어간다. 도보 첫 사격(총구 섬광 점광원), 손전등과
 * 야간 전조등(스폿), 1인칭 실내등(점광원) 이 켜지는 순간 도시 전체 재질이 새 키로 다시 link 되고,
 * 승용차 룸미러는 render target 에 그려 톤매핑 없는 키가 또 생긴다. 여기서 그 조합을 미리 컴파일한다.
 *
 * - 도시 재질: 지금 장면의 광원에 점광원, 스폿, 둘 다를 더한 조합과 거울 조합을 컴파일한다.
 * - 뒤에 뜨는 재질: 실내, 총, 폭발, 예광을 떼어 둔 group 에 잠깐 마운트해 재질을 모으고 바로 내린다.
 *   모은 재질은 dispose 를 막아 프로그램이 지워지지 않게 붙들어 둔다. three 는 프로그램을 쓰는 재질이
 *   하나도 없으면 프로그램을 지우므로, 붙들지 않으면 실제로 탈 때 다시 컴파일한다.
 * - 일은 requestIdleCallback 조각으로 나눠 입력을 막지 않는다. 탈것을 타는 동안은 멈춘다.
 */
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Cockpit from './cockpits';
import WeaponView from './models/WeaponView';
import Blast from './models/Blast';
import Tracers from './models/Tracers';
import { PLANE_KEYS, VEHICLE_KEYS } from './identity.js';
import { WEAPON_KEYS } from './walkPhysics.js';

/** 도시가 뜨고 첫 프레임들의 업로드가 끝난 뒤 시작한다. 탈것을 바로 타는 사람도 조명 조합까지는
 * 미리 만들어 두게 짧게 잡는다. 실제 컴파일은 requestIdleCallback 조각 안에서만 돈다. */
const START_DELAY = 1200;
/** 한 조각에서 이만큼 시간이 남아 있을 때만 다음 컴파일을 이어 간다. */
const SLICE_MARGIN = 4;
/** 마운트 신호가 오지 않으면 이 시간 뒤 다음 단계로 넘어간다. */
const MOUNT_TIMEOUT = 2000;

/** 기본 광원 위에 더해지는 광원 조합이다. 점광원 하나는 도보 섬광과 실내등, 스폿 하나는 손전등과 야간 전조등이다. */
const EXTRA = Object.freeze({ none: { point: 0, spot: 0 }, point: { point: 1, spot: 0 }, spot: { point: 0, spot: 1 }, both: { point: 1, spot: 1 } });
const MAIN_VARIANTS = [EXTRA.point, EXTRA.spot, EXTRA.both];
const CONTENT_VARIANTS = [EXTRA.none, EXTRA.point, EXTRA.spot, EXTRA.both];
/** 룸미러가 있는 승용차 넷은 낮에 실내등 하나(오픈카는 없음), 밤에 실내등과 전조등이 켜진다. */
const MIRROR_VARIANTS = [EXTRA.none, EXTRA.point, EXTRA.both];
const SLICES = ['aircraft', 'vehicles', 'arms'];

const NOOP = () => {};
// 계기와 조종간이 계산에 쓰는 값을 모두 0 으로 채운다. 비워 두면 NaN 자세가 생긴다.
const STILL = Object.freeze({ throttle: 0, speed: 0, rpm: 0, altitude: 0, fuel: 1, steer: 0, heading: 0, gear: 1 });
const COCKPIT_PROPS = Object.freeze({
  status: STILL, controls: { pitch: 0, roll: 0, yaw: 0, throttle: 0 },
  statusRef: { current: STILL }, poseRef: { current: {} }, aimRef: { current: { yaw: 0, pitch: 0 } },
  turretYaw: 0, barrelPitch: 0,
});
const NO_SHELLS = { current: { shells: [] } };

function nextIdle() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(resolve, { timeout: 1000 });
    else setTimeout(() => resolve({ timeRemaining: () => 8 }), 50);
  });
}
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** 프로그램 키를 가르는 객체 쪽 성질이다. 같은 재질이라도 인스턴싱 여부 등이 다르면 키가 다르다. */
function programShape(object, material) {
  const geometry = object.geometry;
  return [material.id, object.type, object.instanceColor ? 1 : 0, geometry?.attributes?.tangent ? 1 : 0,
    Object.keys(geometry?.morphAttributes || {}).length, geometry?.attributes?.color?.itemSize || 0].join(':');
}

function hasLight(object) {
  let found = false;
  object.traverse((node) => { if (node.isLight) found = true; });
  return found;
}

/** root 아래에서 프로그램 모양마다 객체 하나씩 고른다. 광원을 품은 객체는 광원 수를 바꾸므로 뺀다. */
function representatives(root) {
  const found = new Map();
  const walk = (node) => {
    if (node.isLight || node.userData?.noPrewarm) return;
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    if ((node.isMesh || node.isPoints || node.isLine || node.isSprite) && !node.children.some(hasLight)) {
      for (const material of materials) {
        // 그리지 않는 재질(picking 상자, 낮의 빛 웅덩이) 은 프로그램이 필요 없다.
        if (!material.visible) continue;
        const key = programShape(node, material);
        if (!found.has(key)) found.set(key, node);
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return [...new Set(found.values())];
}

/** 장면의 보이는 광원을 종류와 그림자 여부만 같은 대역으로 옮긴다. 키에 들어가는 것은 개수뿐이다. */
function lightPlan(scene) {
  const lights = [];
  scene.traverseVisible((node) => { if (node.isLight) lights.push({ type: node.constructor, castShadow: node.castShadow, map: node.map || null }); });
  return lights;
}

function proxyScene(plan, extra, fog) {
  const proxy = new THREE.Scene();
  proxy.fog = fog;
  for (const { type, castShadow, map } of plan) {
    const light = new type();
    light.castShadow = castShadow;
    if (light.isSpotLight) light.map = map;
    proxy.add(light);
  }
  for (let i = 0; i < extra.point; i++) proxy.add(new THREE.PointLight());
  for (let i = 0; i < extra.spot; i++) proxy.add(new THREE.SpotLight());
  return proxy;
}

/** 뒤에 뜰 재질의 묶음이다. 실제 탈것과 같은 컴포넌트를 쓰고 값은 비워 둔다. */
function Slice({ name, night, quality, onMounted }) {
  useLayoutEffect(() => { onMounted(); }, [onMounted]);
  if (name === 'aircraft') return PLANE_KEYS.map((key) => <Cockpit key={key} rideKey={key} {...COCKPIT_PROPS} night={night} quality={quality} />);
  if (name === 'vehicles') return VEHICLE_KEYS.map((key) => <Cockpit key={key} rideKey={key} {...COCKPIT_PROPS} night={night} quality={quality} />);
  return <>
    {WEAPON_KEYS.map((key) => <WeaponView key={key} weapon={key} torch />)}
    <Blast kind="missile" age={0.25} life={1} />
    <Tracers shellsRef={NO_SHELLS} />
  </>;
}

/** 미리 그릴 묶음이 깨져도 월드는 계속 돈다. 신호만 보내고 비운다. */
class SliceBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    console.warn('ShaderPrewarm skipped a slice:', error);
    this.props.onFailed?.();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

/** 'all' 은 한가할 때 전부, 'lights' 는 탈것을 고른 뒤 카운트다운 동안 도시 조명 조합만,
 * 'off' 는 조종 중이라 아무것도 하지 않는다. 조명 조합은 도보 총구 섬광과 손전등, 야간 전조등이
 * 켜질 때 도시 재질이 다시 컴파일되는 것을 막는 몫이라 카운트다운의 몇 백 ms 로도 값이 있다. */
export default function ShaderPrewarm({ night = false, quality = 'medium', phase = 'all' }) {
  const { gl, scene, camera } = useThree();
  const container = useMemo(() => {
    const group = new THREE.Group();
    // 광원이 붙은 실내가 떠 있어도 광원 수에 들어가지 않게 감춘다. compile 은 숨긴 재질도 모은다.
    group.visible = false;
    return group;
  }, []);
  // 룸미러가 장면 카메라에 자식을 붙이므로 떼어 둔 카메라를 준다.
  const portalState = useMemo(() => ({ camera: new THREE.PerspectiveCamera() }), []);
  const [slice, setSlice] = useState(null);
  const signal = useRef(null);
  const done = useRef(new Set()), lit = useRef(new Set());
  const report = useCallback(() => { const resolve = signal.current; signal.current = null; resolve?.(); }, []);

  useEffect(() => {
    const key = `${quality}:${night}`;
    const full = phase === 'all';
    if (phase === 'off' || done.current.has(key) || (!full && lit.current.has(key))) return undefined;
    let cancelled = false;
    const mirror = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });

    /** 객체마다 gl.compile 을 부르되 한가한 시간 안에서만 이어 간다. */
    const compile = async (objects, extra, target, liveOnly) => {
      const proxy = proxyScene(lightPlan(scene), extra, scene.fog);
      let at = 0;
      while (at < objects.length) {
        const deadline = await nextIdle();
        if (cancelled) return;
        const previous = gl.getRenderTarget();
        if (target) gl.setRenderTarget(target);
        try {
          do {
            const object = objects[at++];
            // 그사이 장면에서 빠진 객체는 재질이 이미 해제됐을 수 있다.
            if (!liveOnly || object.parent) gl.compile(object, camera, proxy);
          } while (at < objects.length && deadline.timeRemaining() > SLICE_MARGIN);
        } finally {
          if (target) gl.setRenderTarget(previous);
        }
      }
    };

    /** 묶음을 마운트해 재질을 모으고 바로 내린다. 모은 재질은 dispose 를 막는다. */
    const gather = async (name) => {
      const mounted = new Promise((resolve) => { signal.current = resolve; });
      setSlice(name);
      await Promise.race([mounted, sleep(MOUNT_TIMEOUT)]);
      const objects = representatives(container);
      for (const object of objects) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose = NOOP;
      }
      setSlice(null);
      return objects;
    };

    (async () => {
      // 카운트다운은 3초뿐이라 기다리지 않는다.
      if (full) await sleep(START_DELAY);
      if (cancelled) return;
      const city = representatives(scene);
      for (const extra of MAIN_VARIANTS) { await compile(city, extra, null, true); if (cancelled) return; }
      lit.current.add(key);
      if (!full) return;
      for (const name of SLICES) {
        await nextIdle();
        if (cancelled) return;
        const objects = await gather(name);
        for (const extra of CONTENT_VARIANTS) { await compile(objects, extra, null, false); if (cancelled) return; }
      }
      for (const extra of MIRROR_VARIANTS) { await compile(city, extra, mirror, true); if (cancelled) return; }
      done.current.add(key);
    })().catch((error) => console.warn('ShaderPrewarm stopped:', error));

    return () => {
      cancelled = true;
      signal.current = null;
      setSlice(null);
      mirror.dispose();
    };
  }, [gl, scene, camera, container, night, quality, phase]);

  if (!slice) return null;
  return createPortal(<SliceBoundary key={slice} onFailed={report}>
    <group dispose={null}><Slice name={slice} night={night} quality={quality} onMounted={report} /></group>
  </SliceBoundary>, container, portalState);
}
