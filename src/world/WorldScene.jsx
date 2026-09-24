import ActorLabels from './ActorLabels';
/** Scene assembly and shared GPU resource ownership. Model sources and change
 * dependencies are indexed in README.md. Keep geometry edits separate from
 * CameraRig, picking, networking, and readiness/error handling.
 */
import RemoteActors from './RemoteActors';
import RemoteCombat from './RemoteCombat';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { installSimulationClock } from './simulationClock.js';
import { discardUnconfiguredRoot } from './rendererFailure.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { buildArchitecture, buildSilhouetteArchitecture, lodBands, lotSizeOf, MASS_LOT_RATIO, QUALITY, reduceArchitecture } from './cityModels.js';
import { PALETTE, SHAPES } from './shapes.js';
import { applyStorefrontShader, paintStorefrontAtlas } from './models/storefronts.js';
import { buildCasterIndex, casterFrustum, countCasters, fillCasters, fitTileSize, freezeStatic, selectCasterCells,
  splitBatches, tileBatches, tileCells, TILE_DRAW_BUDGET } from './cityTiles.js';
import { altitudeInput, boundedTarget, damping, focusPose, safeDelta } from './controls.js';
import NearbyLabels from './NearbyCreators';
import StreetLamps from './StreetLamps';
import FlightMode from './FlightMode';
import CarMode from './CarMode';
import WalkMode from './WalkMode';
import { establishingPose } from './establishingShot.js';
import TrafficCars from './TrafficCars';
import AirTraffic from './AirTraffic';
import { createAirCombat } from './airTraffic.js';
import { isArmed } from './health.js';
import Airport from './models/Airport';
import { airportBoxes } from './models/airportLayout.js';
import SkyEffects from './SkyEffects';
import Ocean from './Ocean';
import ShaderPrewarm from './ShaderPrewarm';
import AdaptiveResolution from './AdaptiveResolution';
import { registerCityLod } from './cityLod.js';
import { shouldRebuildCasters, worldFrame } from './mirrorSchedule.js';
import { getAtmosphere } from './season';
import { applySurfaceShader } from './shaders/surfaces';
import { buildNpcBuildings, buildUrbanScenery, npcSolids } from './UrbanScenery.js';

// 도시 전체가 부모 렌더마다 다시 조정되지 않게 props 가 같으면 건너뛴다. 콜백과 ref 는 안정된 참조다.
const Labels = memo(NearbyLabels);
const Traffic = memo(TrafficCars);
const Remotes = memo(RemoteActors);
const RemoteFire = memo(RemoteCombat);
const Walk = memo(WalkMode);
const Drive = memo(CarMode);
const Fly = memo(FlightMode);

function useResources(night, snow, season) {
  const resources = useMemo(() => {
    const roofProfile = new THREE.Shape();
    roofProfile.moveTo(-0.5, -0.5); roofProfile.lineTo(0, 0.5); roofProfile.lineTo(0.5, -0.5); roofProfile.closePath();
    const gable = new THREE.ExtrudeGeometry(roofProfile, { depth: 1, bevelEnabled: false });
    gable.translate(0, 0, -0.5);
    // 세그먼트 수의 단일 출처는 shapes.js 다. 테스트의 삼각형 예산이 같은 표를 읽는다.
    const geometries = {
      gable,
      box: new THREE.BoxGeometry(1, 1, 1),
      pane: new THREE.PlaneGeometry(1,1),
      octagon: new THREE.CylinderGeometry(1, 1, 1, SHAPES.octagon.radial),
      spire: new THREE.ConeGeometry(1, 1, SHAPES.spire.radial),
      tree: new THREE.IcosahedronGeometry(1, SHAPES.tree.detail),
      trunk: new THREE.CylinderGeometry(0.7, 1, 1, SHAPES.trunk.radial),
      hill: new THREE.SphereGeometry(1, SHAPES.hill.radial, SHAPES.hill.height),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, SHAPES.cylinder.radial),
      cone: new THREE.ConeGeometry(1, 1, SHAPES.cone.radial),
      pyramid: new THREE.ConeGeometry(1, 1, SHAPES.pyramid.radial).rotateY(Math.PI / 4).scale(Math.SQRT1_2, 1, Math.SQRT1_2),
      dome: new THREE.SphereGeometry(1, SHAPES.dome.radial, SHAPES.dome.height, 0, Math.PI * 2, 0, Math.PI / 2),
    };
    const signCanvas = document.createElement('canvas');
    signCanvas.width = signCanvas.height = 512;
    paintStorefrontAtlas(signCanvas.getContext('2d'));
    const signTexture = new THREE.CanvasTexture(signCanvas);
    signTexture.colorSpace = THREE.SRGBColorSpace;
    signTexture.anisotropy = 4;
    const palette = PALETTE;
    const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key,
      new THREE.MeshStandardMaterial({ color, roughness: key === 'tint' ? 0.28 : key === 'steel' ? 0.45 : ['glass', 'blueglass', 'water'].includes(key) ? 0.3 : 0.82,
        metalness: key === 'tint' ? 0.2 : key === 'steel' ? 0.5 : ['glass', 'blueglass', 'accent'].includes(key) ? 0.18 : 0,
      }),
    ]));
    for(const key of ['stone','brick','sand','glass','blueglass','tint'])applySurfaceShader(materials[key],['glass','blueglass','tint'].includes(key)?'glass':'stone');
    materials.shopfront.setValues({ map: signTexture, emissiveMap: signTexture, emissive: '#ffffff', emissiveIntensity: .08, roughness: .65 });
    applyStorefrontShader(materials.shopfront);
    // picking 상자는 그리지 않는다. three 의 raycast 는 재질의 visible 을 보지 않으므로 클릭은 그대로 잡힌다.
    materials.pick.setValues({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, visible: false });
    // 빛 웅덩이는 노면 위에 겹쳐 깔린다. 깊이를 쓰지 않고 더해서 그려야 도로 무늬가 비친다.
    materials.glow.setValues({ transparent: true, opacity: 0.42, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false });
    // 차량 등화는 스스로 빛난다. 세기는 밤 전환에서 useLayoutEffect 가 다시 정한다.
    for (const key of ['tail', 'head']) materials[key].setValues({ emissive: new THREE.Color(PALETTE[key]), emissiveIntensity: 0.2, toneMapped: false });
    return { geometries, materials, signTexture };
  }, []);
  useLayoutEffect(() => {
    // 공유 재질은 시간대마다 값만 바꾸는 명령형 객체다. 새로 만들면 셰이더를 다시 컴파일한다.
    /* eslint-disable react-hooks/immutability */
    resources.materials.glass.color.set(night ? '#f2d596' : '#6b939e');
    resources.materials.glass.emissive.set(night ? '#eeb974' : '#000000');
    resources.materials.glass.setValues({ emissiveIntensity: night ? 0.8 : 0 });
    resources.materials.tint.emissive.set(night ? '#d9a95c' : '#000000');
    resources.materials.tint.setValues({ emissiveIntensity: night ? 0.5 : 0 });
    resources.materials.blueglass.emissive.set(night ? '#9cc4e6' : '#000000');
    resources.materials.blueglass.setValues({ emissiveIntensity: night ? 0.5 : 0 });
    // ZETA 간판. 낮에는 인스턴스 색(금색)만 보이고 밤에만 자체 발광한다.
    resources.materials.shopfront.emissiveIntensity = night ? .8 : .08;
    resources.materials.sign.emissive.set(night ? '#ffd76a' : '#000000');
    resources.materials.sign.setValues({ emissiveIntensity: night ? 1.8 : 0 });
    resources.materials.lamp.emissive.set('#ffdb92');
    resources.materials.lamp.setValues({ emissiveIntensity: night ? 3.4 : 0.15 });
    // 낮에는 웅덩이를 완전히 감춘다. 켜져 있으면 노면에 흰 얼룩으로 보인다. 불투명도 0 으로만 두면
    // 웅덩이 1만여 개를 더하기 혼합으로 계속 그리므로 재질째 끈다. visible 은 프로그램 키가 아니다.
    resources.materials.glow.setValues({ opacity: night ? 0.5 : 0, visible: night });
    resources.materials.ground.color.set(snow ? '#d5e0dc' : season.ground);
    resources.materials.leaf.color.set(snow ? '#c9d9c9' : season.leaf);
    /* eslint-enable react-hooks/immutability */
  }, [resources, night, snow, season]);
  useEffect(() => () => {
    resources.signTexture.dispose();
    Object.values(resources.geometries).forEach((geometry) => geometry.dispose());
    Object.values(resources.materials).forEach((material) => material.dispose());
  }, [resources]);
  return resources;
}

/** 본 화면 배치다. 그림자는 ShadowCasters 가 따로 던지므로 여기서는 받기만 한다. */
const Instances = memo(function Instances({ batch, resources, shadows, onSelect, meshRef }) {
  const localMesh = useRef();
  const mesh = meshRef || localMesh;
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    batch.parts.forEach((part, i) => {
      transform.position.fromArray(part.position);
      transform.scale.fromArray(part.scale);
      if (Array.isArray(part.rotation)) transform.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2], 'YXZ');
      else transform.rotation.set(0, part.rotation, 0);
      transform.updateMatrix();
      mesh.current.setMatrixAt(i, transform.matrix);
      mesh.current.setColorAt(i, color.set(part.color || '#ffffff'));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [batch, mesh]);
  const select = (event) => {
    if (event.delta > 4) return;
    const owner = batch.parts[event.instanceId]?.owner;
    if (owner != null) { event.stopPropagation(); onSelect?.(owner); }
  };
  return <instancedMesh ref={mesh} args={[resources.geometries[batch.shape], resources.materials[batch.material], batch.parts.length]}
    castShadow={false} receiveShadow={shadows} onClick={onSelect ? select : undefined} dispose={null} />;
});

const SurfaceMesh = memo(function SurfaceMesh({ surface, resources, shadows }) {
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry();
    value.setAttribute('position', new THREE.Float32BufferAttribute(surface.mesh.positions, 3));
    value.setIndex(surface.mesh.indices);
    value.computeVertexNormals();
    value.computeBoundingSphere();
    return value;
  }, [surface]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} renderOrder={surface.path ? 2 : surface.canonical ? 1 : 0}
    material={resources.materials[surface.material]}
    receiveShadow={shadows} castShadow={false} />;
});

/** 타일마다 상세 단계를 셋 두고 카메라 거리로 하나만 켠다. near 는 원본 모델 그대로고 mid 는
 * 같은 모델에서 화면에 몇 픽셀도 안 되는 파트만 빠진다. far 에서는 제작자 건물이 티어별
 * 축약형으로 바뀐다(cityModels.buildSilhouetteArchitecture). NPC 배경 건물은 far 도 크기 축소다.
 * 타일이 나뉘어 있으므로 computeBoundingSphere 가 좁은 구를 만들고 frustum culling 이 실제로 동작한다.
 */
const CityTiles = memo(function CityTiles({ cells, resources, shadows, bands }) {
  const groups = useRef([]), checked = useRef(-1), levels = useRef([]), forced = useRef(null);
  const show = useCallback((index, level) => {
    const nodes = groups.current[index];
    if (!nodes) return;
    for (let l = 0; l < nodes.length; l++) {
      const node = nodes[l];
      if (node && node.visible !== (l === level)) node.visible = l === level;
    }
  }, []);
  // 거울 패스가 패스 앞뒤로 이 콜백을 불러 도시를 통째로 먼 단계로 내렸다 되돌린다.
  useEffect(() => registerCityLod((level) => {
    forced.current = level;
    for (let i = 0; i < cells.length; i++) show(i, level == null ? (levels.current[i] ?? 0) : level);
  }), [cells, show]);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - checked.current < 0.12) return;
    checked.current = clock.elapsedTime;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const dx = camera.position.x - cell.x, dy = camera.position.y, dz = camera.position.z - cell.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) - cell.radius;
      const level = distance <= bands.near ? 0 : distance <= bands.mid ? 1 : 2;
      levels.current[i] = level;
      if (forced.current == null) show(i, level);
    }
  });
  return cells.map((cell, index) => <group key={cell.key}>
    {cell.levels.map((tiles, level) => <group key={level} visible={level === 0}
      ref={(node) => { (groups.current[index] ||= [])[level] = node; }}>
      {tiles.map((tile) => <Instances key={tile.key} batch={tile} resources={resources} shadows={shadows} />)}
    </group>)}
  </group>);
});

/** 그림자 카메라가 시점을 따라간다. 도시 전체를 덮으면 텍셀이 낭비되고 비용만 두 배가 된다.
 * 초점을 텍셀 격자에 스냅해 카메라가 움직일 때 그림자 가장자리가 떨리지 않게 한다.
 */
/** 이 높이를 넘으면 지형과 도로 구조물이 그림자를 던지지 않는다. 상공에서 그림자는
 * 화면에서 거의 구분되지 않는데 도시 기하를 그림자 패스에서 한 번 더 그린다. */
const SHADOW_SKY_LIMIT = 240;

/** 카메라 높이를 낮은 주기로만 본다. 매 프레임 state 를 올리면 도시가 다시 렌더된다. */
function useGroundedCamera() {
  const [grounded, setGrounded] = useState(true);
  const checked = useRef(-1);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - checked.current < 0.3) return;
    checked.current = clock.elapsedTime;
    const low = camera.position.y < SHADOW_SKY_LIMIT;
    setGrounded((previous) => previous === low ? previous : low);
  });
  return grounded;
}

/** 그림자 카메라의 반폭 사다리다. 한 단이 2배라 texel 크기가 단 안에서 변하지 않는다.
 * 단을 바꿀 때만 격자가 한 번 갈아탄다. */
const SHADOW_STEPS = Object.freeze([96, 192, 384, 768]);
/** 빛을 초점에서 이만큼 떨어뜨려 둔다. 그림자 카메라의 far 와 ShadowCasters 의 절두체가 같은 값을 쓴다. */
const SUN_DISTANCE = 320;

function shadowHalf(distance) {
  const want = Number.isFinite(distance) ? distance * 0.62 : SHADOW_STEPS[0];
  return SHADOW_STEPS.find((step) => want <= step) ?? SHADOW_STEPS[SHADOW_STEPS.length - 1];
}

/** frustumRef 에 지금 그림자 절두체를 적어 ShadowCasters 가 읽게 한다. */
function SunLight({ atmosphere, quality, cameraRef, frustumRef }) {
  const light = useRef(), anchor = useRef(), applied = useRef({ x: NaN, z: NaN, half: 0, direction: null });
  const size = QUALITY[quality].shadows ? (quality === 'high' ? 2048 : 1024) : 512;
  useLayoutEffect(() => { if (light.current && anchor.current) light.current.target = anchor.current; }, []);
  useFrame(({ camera }) => {
    const sun = light.current;
    if (!sun || !anchor.current) return;
    const focus = cameraRef?.current;
    const fx = Number.isFinite(focus?.x) ? focus.x : camera.position.x;
    const fz = Number.isFinite(focus?.z) ? focus.z : camera.position.z;
    const distance = Math.hypot(camera.position.x - fx, camera.position.y, camera.position.z - fz);
    // 그림자 범위를 2배씩 오르는 사다리로 끊는다. 범위가 고정이면 스냅 격자도 고정이라
    // 카메라가 움직여도 지형과 그림자 경계가 texel 에 붙어 선다.
    const half = shadowHalf(distance);
    const texel = (half * 2) / size;
    const x = Math.round(fx / texel) * texel, z = Math.round(fz / texel) * texel;
    const direction = atmosphere.direction;
    const last = applied.current;
    if (x === last.x && z === last.z && half === last.half && direction === last.direction) return;
    applied.current = { x, z, half, direction };
    anchor.current.position.set(x, 0, z);
    sun.position.set(x + direction[0] * SUN_DISTANCE, direction[1] * SUN_DISTANCE, z + direction[2] * SUN_DISTANCE);
    const shadow = sun.shadow.camera;
    const far = 340 + half * 2;
    shadow.left = -half; shadow.right = half; shadow.top = half; shadow.bottom = -half;
    shadow.far = far;
    shadow.updateProjectionMatrix();
    if (frustumRef) frustumRef.current = { x, z, half, far, direction, distance: SUN_DISTANCE };
  });
  return <>
    <object3D ref={anchor} />
    <directionalLight ref={light} position={atmosphere.direction.map((n) => n * SUN_DISTANCE)} color={atmosphere.sun} intensity={atmosphere.intensity}
      castShadow={QUALITY[quality].shadows} shadow-mapSize={[size, size]}
      shadow-camera-near={1} shadow-bias={-0.0002} shadow-normalBias={0.3} />
  </>;
}

/** 선택한 caster 를 이만큼 넓게 잡아 두고, 초점이 그 안에서 움직이는 동안은 다시 채우지 않는다. */
const CASTER_MARGIN = 40;

/** 도시의 정적 그림자다. 본 화면 배치는 그림자를 던지지 않고, 그림자 절두체 근처의 파트만
 * shape 별 instancedMesh 에 다시 담아 그림자 패스에서만 그린다. 그림자 draw 는 shape 수(12) 를
 * 넘지 않는다. 그림자 패스 앞뒤로 visible 을 바꾸려고 renderer.shadowMap.render 를 감싼다.
 * 움직이는 탈것과 항공기는 매 프레임 그대로 그림자를 던진다. */
function ShadowCasters({ index, geometries, active, frustumRef }) {
  const gl = useThree((state) => state.gl);
  const root = useMemo(() => {
    const group = new THREE.Group();
    group.visible = false;
    group.matrixAutoUpdate = false;
    group.userData.noPrewarm = true;
    return group;
  }, []);
  const material = useMemo(() => new THREE.MeshBasicMaterial(), []);
  const slots = useRef(new Map());
  const built = useRef(null);
  const live = useRef(false);
  useEffect(() => { live.current = Boolean(active && index); }, [active, index]);
  useEffect(() => {
    const shadowMap = gl.shadowMap, render = shadowMap.render;
    shadowMap.render = function renderWithCasters(...args) {
      root.visible = live.current;
      try { return render.apply(this, args); } finally { root.visible = false; }
    };
    return () => { shadowMap.render = render; };
  }, [gl, root]);
  useEffect(() => () => {
    for (const mesh of slots.current.values()) { root.remove(mesh); mesh.dispose(); }
    slots.current.clear();
    material.dispose();
  }, [root, material]);
  useFrame(({ clock }) => {
    const frustum = frustumRef.current;
    if (!live.current || !index || !frustum) return;
    const last = built.current;
    if (last && last.index === index && last.half === frustum.half && last.direction === frustum.direction
      && Math.hypot(frustum.x - last.x, frustum.z - last.z) < CASTER_MARGIN * 0.75) return;
    // 재구성은 40 단위를 움직일 때 한 번이지만 그 한 번이 거울 패스와 겹치면 두 비용이 한 프레임에 몰린다.
    if (!shouldRebuildCasters(worldFrame(clock.elapsedTime))) return;
    built.current = { ...frustum, index };
    const cells = selectCasterCells(index, casterFrustum(frustum), CASTER_MARGIN);
    for (const shape of index.shapes) {
      const count = countCasters(cells, shape);
      let mesh = slots.current.get(shape);
      if (!mesh || mesh.instanceMatrix.count < count) {
        if (mesh) { root.remove(mesh); mesh.dispose(); }
        mesh = new THREE.InstancedMesh(geometries[shape], material, Math.max(64, Math.ceil(count * 1.5)));
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        Object.assign(mesh, { castShadow: true, receiveShadow: false, frustumCulled: false, matrixAutoUpdate: false });
        slots.current.set(shape, mesh);
        root.add(mesh);
      }
      fillCasters(cells, shape, mesh.instanceMatrix.array);
      mesh.count = count;
      mesh.visible = count > 0;
      // 올릴 것이 없으면 아예 올리지 않는다. WebGL2 의 bufferSubData 는 길이 0 을 "나머지 전부" 로
      // 읽어서 빈 구간을 주면 버퍼 전체가 올라간다. TrafficCars 의 upload 와 같은 규약이다.
      if (count > 0) {
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, count * 16);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });
  return <primitive object={root} />;
}

const whenIdle = (callback) => (typeof requestIdleCallback === 'function'
  ? { idle: requestIdleCallback(callback, { timeout: 1500 }) } : { timer: setTimeout(callback, 200) });
const cancelIdle = (handle) => {
  if (handle?.idle !== undefined && typeof cancelIdleCallback === 'function') cancelIdleCallback(handle.idle);
  if (handle?.timer !== undefined) clearTimeout(handle.timer);
};

/** caster 색인은 파트 16만 개를 한 번 훑는다(50~80ms). 첫 화면은 상공 전경이라 그림자 caster 가
 * 꺼져 있으므로 브라우저가 한가할 때 만든다. */
function useCasterIndex(batchLists, enabled) {
  const [built, setBuilt] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const handle = whenIdle(() => { if (!cancelled) setBuilt({ source: batchLists, index: buildCasterIndex(batchLists) }); });
    return () => { cancelled = true; cancelIdle(handle); };
  }, [batchLists, enabled]);
  return enabled && built?.source === batchLists ? built.index : null;
}

function CameraRig({ inputBlocked = false, extent, focusTarget, onCameraChange, joystickValues, locked, onUnlock }) {
  const controls = useRef();
  const keys = useRef(new Set());
  const destination = useRef(null);
  const lastReport = useRef(0);
  const scratch = useMemo(() => ({ forward: new THREE.Vector3(), right: new THREE.Vector3(), shift: new THREE.Vector3() }), []);
  const { camera, gl } = useThree();
  useEffect(() => {
    keys.current.clear();
    if (inputBlocked) return;
    const keydown = (event) => {
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code==='Space' && event.target.closest?.('button,a,[role="button"]')) return;
      // 전경 정지 상태에서 조작 키를 누르면 자유 카메라로 넘어간다. Space 는 탈것 선택이 먼저 잡는다.
      if (locked) { if (event.code !== 'Space') onUnlock?.(); return; }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault(); keys.current.add(event.code); destination.current = null;
      }
    };
    const keyup = (event) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    const cancelFocus = () => { destination.current = null; if (locked) onUnlock?.(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clear);
    gl.domElement.addEventListener('pointerdown', cancelFocus);
    gl.domElement.addEventListener('wheel', cancelFocus);
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear);
      gl.domElement.removeEventListener('pointerdown', cancelFocus); gl.domElement.removeEventListener('wheel', cancelFocus);
    };
  }, [gl, locked, onUnlock, inputBlocked]);
  useEffect(() => {
    if (!locked) return;
    // 도시 크기가 인원수에 따라 바뀌므로 extent 비례 포즈를 쓴다. 입력은 받지 않는다.
    const pose = establishingPose(extent);
    camera.position.set(...pose.position);
    if (controls.current) { controls.current.target.set(...pose.lookAt); controls.current.update(0); }
    destination.current = null;
    keys.current.clear();
  }, [locked, extent, camera]);
  useEffect(() => {
    if (focusTarget) {
      if (!Number.isFinite(focusTarget.x) || !Number.isFinite(focusTarget.z)) return;
      const { target, position } = focusPose(focusTarget, extent);
      destination.current = { ...target, view: new THREE.Vector3(position.x, position.y, position.z) };
    }
  }, [focusTarget, extent]);
  useFrame(({ clock }, delta) => {
    const orbit = controls.current;
    if (!orbit || inputBlocked) return;
    if (![camera.position.x, camera.position.y, camera.position.z, orbit.target.x, orbit.target.y, orbit.target.z].every(Number.isFinite)) {
      orbit.target.set(0, 4, 0); camera.position.set(220, 260, 300); destination.current = null;
    }
    const dt = safeDelta(delta);
    if (locked) { orbit.update(dt); return; }
    const joystick = joystickValues?.current;
    const input = keys.current;
    const moveX = Number(input.has('KeyD') || input.has('ArrowRight')) - Number(input.has('KeyA') || input.has('ArrowLeft')) + (joystick?.move?.x || 0);
    const moveZ = Number(input.has('KeyW') || input.has('ArrowUp')) - Number(input.has('KeyS') || input.has('ArrowDown')) + (joystick?.move?.y || 0);
    const vertical = altitudeInput(input) + (joystick?.vertical || 0);
    camera.getWorldDirection(scratch.forward); scratch.forward.setY(0); scratch.forward.normalize();
    scratch.right.crossVectors(scratch.forward, camera.up).normalize();
    const speed = Math.max(25, camera.position.distanceTo(orbit.target) * 0.45) * dt;
    scratch.shift.copy(scratch.right).multiplyScalar(moveX).addScaledVector(scratch.forward, moveZ);
    if (scratch.shift.lengthSq() > 1) scratch.shift.normalize();
    scratch.shift.multiplyScalar(speed); scratch.shift.setY(vertical * speed);
    if (moveX || moveZ || vertical) destination.current = null;
    if (destination.current) {
      scratch.shift.set(destination.current.x - orbit.target.x, destination.current.y - orbit.target.y, destination.current.z - orbit.target.z).multiplyScalar(damping(dt));
      if (scratch.shift.lengthSq() < 0.00001 && camera.position.distanceToSquared(destination.current.view) < 0.01) destination.current = null;
    }
    const bound = boundedTarget({ x: orbit.target.x + scratch.shift.x, y: orbit.target.y + scratch.shift.y, z: orbit.target.z + scratch.shift.z }, extent);
    scratch.shift.set(bound.x - orbit.target.x, bound.y - orbit.target.y, bound.z - orbit.target.z);
    orbit.target.add(scratch.shift); camera.position.add(scratch.shift);
    if (destination.current) camera.position.lerp(destination.current.view, damping(dt));
    const rotate = joystick?.rotate;
    if (rotate?.x || rotate?.y) {
      scratch.shift.copy(camera.position).sub(orbit.target);
      const spherical = new THREE.Spherical().setFromVector3(scratch.shift);
      spherical.theta -= rotate.x * dt * 1.5;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + rotate.y * dt, 0.2, Math.PI / 2.35);
      scratch.shift.setFromSpherical(spherical); camera.position.copy(orbit.target).add(scratch.shift);
    }
    orbit.update(dt);
    if (clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = clock.elapsedTime;
      onCameraChange?.({ x: orbit.target.x, z: orbit.target.z });
    }
  });
  return <OrbitControls enabled={!inputBlocked} ref={controls} makeDefault enableDamping={false} minDistance={28} maxDistance={Math.max(500, extent * 1.8)}
    minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.02} target={[0, 4, 0]} zoomSpeed={0.75} panSpeed={0.7}
    mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />;
}

function Precipitation({ weather, quality }) {
  const points = useRef();
  const { camera } = useThree();
  const count = QUALITY[quality].particles;
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { values[i * 3] = Math.sin(i * 127.1) * 120; values[i * 3 + 1] = i * 17.7 % 110; values[i * 3 + 2] = Math.cos(i * 311.7) * 120; }
    return values;
  }, [count]);
  useFrame((_, delta) => {
    points.current.position.set(camera.position.x, Math.max(0, camera.position.y - 85), camera.position.z);
    const vertices = points.current.geometry.attributes.position.array;
    for (let i = 1; i < vertices.length; i += 3) vertices[i] = (vertices[i] - safeDelta(delta) * (weather === 'rain' ? 45 : 7) + 110) % 110;
    points.current.geometry.attributes.position.needsUpdate = true;
  });
  return <points ref={points} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial size={weather === 'snow' ? 0.7 : 0.3} color={weather === 'snow' ? '#f6ffff' : '#c1dce6'} transparent opacity={0.7} depthWrite={false} />
  </points>;
}

/** 첫 프레임과 2초마다의 성능 표본을 알린다. 콜백은 ref 로 읽어 부모가 새 함수를 넘겨도
 * 이 컴포넌트가 다시 렌더되지 않는다. */
function RenderStatus({ onReady, onPerformance }) {
  const callbacks = useRef({ onReady, onPerformance });
  useLayoutEffect(() => { callbacks.current = { onReady, onPerformance }; }, [onReady, onPerformance]);
  const first = useRef(true), samples = useRef({ frames: 0, elapsed: 0 });
  useFrame(({ gl }, delta) => {
    if (first.current) { first.current = false; requestAnimationFrame(() => callbacks.current.onReady?.()); }
    samples.current.frames++; samples.current.elapsed += delta;
    if (samples.current.elapsed >= 2) {
      callbacks.current.onPerformance?.({ fps: Math.round(samples.current.frames / samples.current.elapsed), calls: gl.info.render.calls, triangles: gl.info.render.triangles });
      samples.current = { frames: 0, elapsed: 0 };
    }
  });
  return null;
}

function ContextHealth({ onContextLost, onContextRestored }) {
  const { gl } = useThree();
  const [isLost, setIsLost] = useState(false);
  useEffect(() => {
    const dom = gl.domElement;
    let restoreTimeout = null;
    const handleLoss = (event) => {
      event.preventDefault();
      console.warn('WebGL context lost, waiting for restoration...');
      setIsLost(true);
      onContextLost?.(false);
      // 4초 내 복구 이벤트가 오지 않으면 영구 손실로 간주하여 상위에 알림
      restoreTimeout = setTimeout(() => {
        onContextLost?.(true);
      }, 4000);
    };
    const handleRestore = () => {
      if (restoreTimeout) clearTimeout(restoreTimeout);
      console.info('WebGL context restored');
      setIsLost(false);
      onContextRestored?.();
    };
    dom.addEventListener('webglcontextlost', handleLoss);
    dom.addEventListener('webglcontextrestored', handleRestore);
    return () => {
      if (restoreTimeout) clearTimeout(restoreTimeout);
      dom.removeEventListener('webglcontextlost', handleLoss);
      dom.removeEventListener('webglcontextrestored', handleRestore);
    };
  }, [gl, onContextLost, onContextRestored]);

  if (isLost) {
    return <Html center zIndexRange={[100, 50]}>
      <div className="world-context-lost-notice" style={{
        background: 'rgba(20, 20, 25, 0.88)',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        pointerEvents: 'none',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.18)',
        whiteSpace: 'nowrap'
      }}>
        3D 그래픽 컨텍스트 복구 중…
      </div>
    </Html>;
  }
  return null;
}


/** 두 배치 맵을 shape-material 키로 합친다. 제작자 실루엣과 배경 건물의 축소본을
 * 한 상세 단계로 섞을 때 쓴다. */
function mergeBatches(a, b) {
  const merged = { ...a };
  for (const [key, batch] of Object.entries(b)) {
    const found = merged[key];
    merged[key] = found ? { ...found, parts: found.parts.concat(batch.parts) } : batch;
  }
  return merged;
}

/** ownerIds 에 속한 파트를 뺀다. 배경 건물만 남기고 제작자 몫은 실루엣으로 대체할 때 쓴다. */
function withoutOwners(batches, ownerIds) {
  const stripped = {};
  for (const [key, batch] of Object.entries(batches)) {
    const parts = batch.parts.filter((part) => !ownerIds.has(part.owner));
    if (parts.length) stripped[key] = { ...batch, parts };
  }
  return stripped;
}

function City({ multiplayer = false, scoreSession, onConfirmAI, onConfirmFatal, paused = false, inputBlocked = false, reducedMotion = false, buildings, selectedId, onSelect, focusTarget, quality, timeOfDay, weather, anonymous, cameraRef, onReady, onPerformance, joystickValues, flightMode, flightControls, onFlightStatus, onFlightPose, peersRef, season, plane, pilotName, gallery, carMode, carControls, onCarStatus, vehicle, carView, rideView, walkMode, walkControls, onWalkStatus, cameraLocked, ridePending, onExplore, onContextLost, onContextRestored }) {
  const pickMesh = useRef(), aircraft=useRef(null), reported=useRef(0), staticRoot = useRef(), shadowFrustum = useRef(null);
  // 남이 쏜 포탄이 쌓아 두는 피해 대기열이다. 주행 모드가 매 프레임 읽고 0 으로 비운다.
  const incoming = useRef({ amount: 0, weapon: null });
  // AI 항공기 격추 진행도다. FlightMode 가 쓰고 AirTraffic 이 읽는다. 이 화면에만 남는다.
  const airCombat = useRef(createAirCombat());
  // 부서진 AI 차량 번호다. TrafficCars 가 매 프레임 이 Set 을 읽으므로 state 로 올릴 이유가 없다.
  // 한 대 부술 때마다 도시 전체가 다시 조정되던 자리다.
  const hiddenTraffic = useRef(new Set());
  const hideTraffic = useCallback((hit) => {
    if (hiddenTraffic.current.has(hit.index)) return;
    hiddenTraffic.current.add(hit.index); onConfirmAI?.(`ground:${hit.index}`);
  }, [onConfirmAI]);
  useEffect(() => { hiddenTraffic.current.clear(); airCombat.current = createAirCombat(); }, [scoreSession]);
  // 항공기와 차량이 같은 경로로 자세를 올린다. aircraft 는 근접 라벨과 피탄 판정이 읽고,
  // onFlightPose 는 네트워크로 내보낸다. validPose 가 모르는 필드는 버린다.
  const reportPose=useCallback(pose=>{aircraft.current=pose;onFlightPose?.(pose);},[onFlightPose]);
  // 카메라 보고는 state 가 아니라 ref 다. 자식은 그대로 콜백을 부르고 여기서 0.15초에 한 번만 기록한다.
  const reportCamera = useCallback((pose) => {
    const slot = cameraRef?.current;
    if (!slot || !pose) return;
    const now = performance.now();
    if (now - reported.current < 150) return;
    reported.current = now;
    // eslint-disable-next-line react-hooks/immutability -- cameraRef 는 WorldPage 가 넘긴 공유 출력 ref 다. setState 를 쓰면 매 이동마다 도시가 다시 렌더된다.
    slot.x = pose.x; slot.z = pose.z;
  }, [cameraRef]);
  // picking 콜백은 한 번만 만든다. 바뀌는 값은 ref 로 읽어 1000개 상자를 가진 mesh 가 다시 렌더되지 않는다.
  const latest = useRef({ flightMode, inputBlocked, buildings, onSelect });
  useLayoutEffect(() => { latest.current = { flightMode, inputBlocked, buildings, onSelect }; }, [flightMode, inputBlocked, buildings, onSelect]);
  const pickBuilding = useCallback((id) => {
    const { flightMode: flying, inputBlocked: blocked, buildings: records, onSelect: select } = latest.current;
    if (flying || blocked) return;
    const building = records.find((record) => record.id === id);
    if (building) select?.(building);
  }, []);
  // 탈것에서 내리면 자세를 비운다. 남겨 두면 내리고 난 자리에서 포탄이 나를 계속 맞힌다.
  useEffect(() => {
    if (carMode || flightMode || walkMode) return;
    aircraft.current = null; incoming.current.amount = 0; incoming.current.hits = [];
  }, [carMode, flightMode, walkMode]);
  const extent = useMemo(() => Math.max(180, ...buildings.map((b) => b.cityExtent||Math.max(Math.abs(b.x), Math.abs(b.z)) + 40)), [buildings]);
  const night = timeOfDay === 'night';
  const shadows = QUALITY[quality].shadows;
  const resources = useResources(night, weather === 'snow', season);
  const bands = useMemo(() => lodBands(quality, extent), [quality, extent]);
  const scenery = useMemo(() => buildUrbanScenery(buildings, extent, quality, gallery), [buildings, extent, quality, gallery]);
  const landscape = scenery.batches;
  // 막히는 것을 한 배열에 모은다. 제작자 건물, 배경 건물, 랜드마크 몸통, 가드레일,
  // 고가 교각과 사장교 주탑이 모두 같은 상자 판정을 쓴다. 도보와 포탄도 이 배열을 읽는다.
  const solids = useMemo(() => [...buildings, ...scenery.obstacles, ...airportBoxes(extent),
    ...(gallery ? [] : npcSolids(buildings))], [buildings, scenery, extent, gallery]);
  const vehicleSolids = useMemo(() => [...solids, ...scenery.vehicleBarriers], [solids, scenery]);
  const cells = useMemo(() => {
    const budget = QUALITY[quality];
    const creatorIds = new Set(buildings.map((building) => building.id));
    // 배경 건물도 같은 타일과 상세 단계를 탄다. 제작자 건물과 함께 멀어지고 함께 가까워진다.
    const near = mergeBatches(buildArchitecture(buildings, quality), gallery ? {} : buildNpcBuildings(buildings, quality));
    const { tiled, whole } = splitBatches(near);
    // 지형, picking mesh, 통짜 배치는 항상 그려지므로 타일 예산에서 먼저 뺀다.
    const reserve = Object.keys(landscape).length + whole.length + 1;
    // 제작자 건물은 far 에서만 티어 실루엣으로 바꾼다. mid 까지 바꾸면 조감 시점에서 변형이 모두 같은 상자가 된다.
    const silhouette = buildSilhouetteArchitecture(buildings);
    const mid = reduceArchitecture(tiled, budget.midDrop);
    const far = mergeBatches(silhouette, withoutOwners(reduceArchitecture(tiled, budget.farDrop, true), creatorIds));
    const tileSize = fitTileSize(tiled, extent, bands.near, TILE_DRAW_BUDGET - reserve, far);
    return { whole, near, cells: tileCells([tiled, mid, far].map((level) => tileBatches(level, tileSize))) };
  }, [buildings, quality, extent, bands, landscape, gallery]);
  // 그림자는 상세 단계 모델로 던진다. 지상에서 그림자 절두체는 늘 상세 단계 반경 안이다.
  const casterSource = useMemo(() => [...Object.values(cells.near), ...Object.values(landscape)], [cells, landscape]);
  const casterIndex = useCasterIndex(casterSource, shadows);
  const pickBatch = useMemo(() => ({ shape: 'box', material: 'pick', parts: buildings.map((building) => {
    const mass = lotSizeOf(building) * MASS_LOT_RATIO;
    return { position: [building.x, (building.height + 4) / 2, building.z], scale: [mass, building.height + 4, mass], owner: building.id, rotation: 0 };
  }) }), [buildings]);
  // 도시 배치는 움직이지 않는다. 행렬을 한 번만 계산해 두면 매 프레임 수천 개 노드를 다시 곱하지 않는다.
  useLayoutEffect(() => { freezeStatic(staticRoot.current); }, [scenery, cells, pickBatch, resources, shadows]);
  const selected = buildings.find((building) => building.id === selectedId);
  // 선택 링은 picking box 의 절반 대각선 바깥에 놓는다.
  const selectedRing = selected ? lotSizeOf(selected) * MASS_LOT_RATIO * Math.SQRT1_2 + 0.6 : 0;
  const lighting=useMemo(()=>getAtmosphere(timeOfDay,season,weather),[timeOfDay,season,weather]);
  const grounded = useGroundedCamera();
  // AI 항공기 표식은 쏠 수 있는 자리에서만 켠다. 도보는 총이 있으므로 늘 켠다.
  const marked = walkMode || (carMode && isArmed('car', vehicle)) || (flightMode && isArmed('flight', plane));
  return <>
    <color attach="background" args={[lighting.fog]} />
    <fog attach="fog" args={[lighting.fog, extent * 0.85 + 200, extent * 3 + 500]} />
    <SkyEffects timeOfDay={timeOfDay} weather={weather} quality={quality} extent={extent} atmosphere={lighting} />
    <Ocean extent={extent} quality={quality} timeOfDay={timeOfDay} atmosphere={lighting} />
    <hemisphereLight args={[lighting.horizon, season.ground, lighting.ambient]} />
    <SunLight atmosphere={lighting} quality={quality} cameraRef={cameraRef} frustumRef={shadowFrustum} />
    {shadows && <ShadowCasters index={casterIndex} geometries={resources.geometries} active={grounded} frustumRef={shadowFrustum} />}
    <group ref={staticRoot}>
      {scenery.surfaces.map((surface, index) => <SurfaceMesh key={`surface-${surface.material}-${index}`}
        surface={surface} resources={resources} shadows={shadows} />)}
      {Object.entries(landscape).map(([key, batch]) => <Instances key={key} batch={batch} resources={resources} shadows={shadows} />)}
      {cells.whole.map((batch) => <Instances key={`whole-${batch.key}`} batch={batch} resources={resources} shadows={shadows} />)}
      <CityTiles cells={cells.cells} resources={resources} shadows={shadows} bands={bands} />
      <Instances batch={pickBatch} resources={resources} shadows={false} meshRef={pickMesh} onSelect={pickBuilding} />
    </group>
    <Labels buildings={buildings} selectedId={selectedId} onSelect={inputBlocked ? undefined : onSelect} pickMesh={pickMesh} resources={resources} flightMode={flightMode} aircraft={aircraft} driving={carMode} anonymous={anonymous} />
    <StreetLamps lamps={scenery.lamps} night={night} cap={QUALITY[quality].streetlights} />
    <Traffic resources={resources} extent={extent} quality={quality} hiddenRef={hiddenTraffic} night={night} />
    <AirTraffic extent={extent} count={QUALITY[quality].aircraft} combatRef={airCombat} marked={marked} />
    <Airport extent={extent} parked={!flightMode} plane={plane} night={night} />
    {/* 서쪽 공항은 같은 모델을 180도 돌려 놓은 것이다. 주기 기체는 동쪽에만 둔다. */}
    <Airport extent={extent} parked={false} plane={plane} night={night} mirrored />
    {/* 움직이지 않는 간판이지만 Html 은 매 프레임 DOM 행렬을 고쳐 쓴다. 주행과 비행 중에는
        읽히지도 않으므로 띄우지 않는다. */}
    {!gallery && !carMode && !flightMode && <Html position={[43, 16.4, -69.8]} transform distanceFactor={24} zIndexRange={[15, 1]}><span className="world-civic-label" style={{ display: 'block', whiteSpace: 'nowrap', color: '#4f5b56', fontSize: 18, fontWeight: 700, letterSpacing: 6, pointerEvents: 'none' }}>은행</span></Html>}
    {!gallery && !carMode && !flightMode && <Html position={[85, 9.5, -72.1]} transform distanceFactor={24} zIndexRange={[15, 1]}><span className="world-civic-label" style={{ display: 'block', whiteSpace: 'nowrap', color: '#456a8b', fontSize: 17, fontWeight: 700, letterSpacing: 3, pointerEvents: 'none' }}>경찰서</span></Html>}
    {selected && <mesh position={[selected.x, 0.8, selected.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[selectedRing - 0.4, selectedRing + 0.4, 48]} /><meshBasicMaterial color="#fff5bb" transparent opacity={0.95} depthWrite={false} />
    </mesh>}
    {(weather === 'rain' || weather === 'snow') && <Precipitation weather={weather} quality={quality} />}
    <Remotes peersRef={peersRef} buildings={solids} />
    {!gallery && scoreSession && <ActorLabels extent={extent} trafficCount={QUALITY[quality].cars} airCount={QUALITY[quality].aircraft} hiddenRef={hiddenTraffic} airCombatRef={airCombat} buildings={solids} />}
    <RemoteFire key={scoreSession || "local"} extent={extent} peersRef={multiplayer ? peersRef : null} buildings={solids} selfRef={aircraft} incomingRef={incoming} />
    {walkMode ? <Walk paused={paused} inputBlocked={inputBlocked} reducedMotion={reducedMotion} extent={extent} buildings={solids} controlsRef={walkControls} pilotName={pilotName}
      trafficCount={QUALITY[quality].cars} onCameraChange={reportCamera} onStatus={onWalkStatus} onKill={hideTraffic} onPose={reportPose} />
      : carMode ? <Drive paused={paused} inputBlocked={inputBlocked} reducedMotion={reducedMotion} extent={extent} buildings={vehicleSolids} controlsRef={carControls} vehicle={vehicle} view={carView} quality={quality}
      pilotName={pilotName} trafficCount={QUALITY[quality].cars} night={night} weather={weather} onCameraChange={reportCamera} onStatus={onCarStatus} onTrafficHit={hideTraffic}
      onPose={reportPose} incomingRef={incoming} onFatal={onConfirmFatal} onAirKill={onConfirmAI} airCount={QUALITY[quality].aircraft} airCombatRef={airCombat} />
      : flightMode ? <Fly paused={paused} inputBlocked={inputBlocked} reducedMotion={reducedMotion} extent={extent} buildings={solids} controlsRef={flightControls} view={rideView} onCameraChange={reportCamera} onStatus={onFlightStatus} onFlightPose={reportPose} plane={plane} pilotName={pilotName} incomingRef={incoming} onFatal={onConfirmFatal} onAirKill={onConfirmAI} airCount={QUALITY[quality].aircraft} airCombatRef={airCombat} trafficCount={QUALITY[quality].cars} onTrafficHit={hideTraffic} peersRef={peersRef} night={night} weather={weather} />
      : <CameraRig inputBlocked={inputBlocked} extent={extent} focusTarget={focusTarget} onCameraChange={reportCamera} joystickValues={joystickValues} locked={cameraLocked} onUnlock={onExplore} />}
    {/* 조종 중에는 멈추고, 탈것을 고른 뒤 카운트다운 동안에는 도시 조명 조합만 미리 만든다.
        무거운 실내 묶음까지 돌리면 조종에 들어가는 첫 프레임이 늦는다. */}
    <ShaderPrewarm night={night} quality={quality}
      phase={walkMode || carMode || flightMode ? 'off' : ridePending ? 'lights' : 'all'} />
    <RenderStatus onReady={onReady} onPerformance={onPerformance} />
    <ContextHealth onContextLost={onContextLost} onContextRestored={onContextRestored} />
  </>;
}

/** Keep one shared simulation time for traffic, weapons, animation and timers. */
function SimulationClock({ paused }) {
  const clock = useThree(state => state.clock);
  const pausedRef = useRef(paused);
  useLayoutEffect(() => { pausedRef.current = paused; }, [paused]);
  useLayoutEffect(() => installSimulationClock(clock, () => pausedRef.current), [clock]);
  return null;
}

/** 품질 등급이 정한 dpr 을 화면 배율 안에서 고른다. 자동 조절은 이 값 아래로만 간다. */
function baseDpr(level) {
  const screen = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(Math.max(1, screen), QUALITY[level].dpr);
}

/** 렌더러를 한 번 설정한다. Canvas 의 dpr prop 을 비워 두었으므로 첫 dpr 도 여기서 정한다. */
function prepareRenderer({ gl, scene, setDpr }, dpr) {
  setDpr(dpr);
  gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
  // production 에서 link 마다 로그를 동기로 읽으면 첫 사격과 1인칭 전환에서 수십 ms 씩 멈춘다.
  // 셰이더 오류는 개발 빌드가 잡는다.
  if (import.meta.env.PROD) gl.debug.checkShaderErrors = false;
  // 장면 루트가 매 프레임 자기 행렬을 새로 만들면 모든 자식에게 강제 갱신이 내려간다.
  // 루트는 움직이지 않으므로 끄고, 움직이는 객체는 각자 matrixAutoUpdate 로 갱신한다.
  scene.matrixAutoUpdate = false;
  scene.updateMatrix();
}

function WorldScene({ quality = 'medium', timeOfDay = 'day', weather = 'clear', ...props }) {
  const level = QUALITY[quality] ? quality : 'medium';
  const [rendererError, setRendererError] = useState(null);
  const createRenderer = useCallback(defaults => {
    try {
      return new THREE.WebGLRenderer({ ...defaults, antialias: level !== 'low', powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    } catch (error) {
      // R3F awaits renderer creation outside its render error boundary. Re-throw
      // through React state and stop this failed configure task until unmount.
      discardUnconfiguredRoot(defaults.canvas);
      setRendererError(error);
      return new Promise(() => {});
    }
  }, [level]);
  if (rendererError) throw rendererError;
  const dpr = baseDpr(level);
  // 조종 중에는 해상도를 올리지 않는다. 한 번의 전환이 100ms 넘게 멈추므로 화면이 흔들리는
  // 자리에서는 되돌리지 않고 조감 카메라에서만 여유를 본다.
  const piloting = Boolean(props.walkMode || props.carMode || props.flightMode);
  return <Canvas className="world-canvas" shadows={QUALITY[level].shadows ? 'percentage' : false} dpr={null}
    camera={{ position: [220, 260, 300], fov: 38, near: 0.5, far: 5000 }}
    // 도시 반폭이 2400 을 넘는데 near 0.5, far 5000 이면 거리 300 에서 이미 깊이 해상도가
    // 0.011 이다. 지면 판과 지구 바닥, 노면과 차선이 0.01 에서 0.1 간격이라 카메라가 움직일
    // 때마다 승자가 바뀌어 바닥이 깜빡였다. 로그 깊이 버퍼는 이 거리에서 해상도가 0.002 다.
    gl={createRenderer}
    onCreated={(state) => prepareRenderer(state, dpr)}>
    <SimulationClock paused={!!props.paused} />
    <City {...props} quality={level} timeOfDay={timeOfDay} weather={weather} />
    <AdaptiveResolution key={level} base={dpr} piloting={piloting} />
  </Canvas>;
}

export default memo(WorldScene);
