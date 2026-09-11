import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WORLD } from '../../shared/worldLayout.js';
import { buildArchitecture, createBatches, QUALITY } from './cityModels.js';
import { altitudeInput, boundedTarget, damping, focusPose, safeDelta } from './controls.js';
import { proxyThumbnailUrl } from '../utils/imageUtils.js';
import { addCivicScenery } from './civicModels.js';
import FlightMode, { Airport } from './FlightMode';
import SkyEffects from './SkyEffects';

const SKY = {
  day: { background: '#c8dfe5', sun: '#fff3dc', ambient: 1.4, intensity: 2.8, position: [140, 230, 90] },
  dawn: { background: '#e8d5ce', sun: '#ffcdad', ambient: 1.1, intensity: 2.1, position: [-190, 100, 90] },
  sunset: { background: '#d9c0bd', sun: '#ffb980', ambient: 1.0, intensity: 2.4, position: [180, 85, -80] },
  night: { background: '#172634', sun: '#b4cfff', ambient: 0.85, intensity: 1.1, position: [-100, 180, 70] },
};

function useResources(night, snow) {
  const resources = useMemo(() => {
    const roofProfile = new THREE.Shape();
    roofProfile.moveTo(-0.5, -0.5); roofProfile.lineTo(0, 0.5); roofProfile.lineTo(0.5, -0.5); roofProfile.closePath();
    const gable = new THREE.ExtrudeGeometry(roofProfile, { depth: 1, bevelEnabled: false });
    gable.translate(0, 0, -0.5);
    const geometries = {
      gable,
      box: new THREE.BoxGeometry(1, 1, 1),
      octagon: new THREE.CylinderGeometry(1, 1, 1, 8),
      spire: new THREE.ConeGeometry(1, 1, 5),
      tree: new THREE.IcosahedronGeometry(1, 1),
      trunk: new THREE.CylinderGeometry(0.7, 1, 1, 5),
      hill: new THREE.SphereGeometry(1, 12, 8),
    };
    const palette = {
      stone: '#e8e3d6', brick: '#ad7760', sand: '#dbcdab', violet: '#777d99',
      roof: '#647a78', dark: '#45545a', pavement: '#d9d9ce', road: '#7b898d',
      marking: '#e9e2c5', water: '#73b8c4', bank: '#b7c5b1', ground: '#a8bc9a',
      green: '#769d72', leaf: '#88ae74', wood: '#9b7c56', accent: '#ffffff',
      glass: '#6b939e', blueglass: '#88b5cd', lamp: '#ffecb2', car: '#ffffff', pick: '#ffffff',
    };
    const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key,
      new THREE.MeshStandardMaterial({ color, roughness: ['glass', 'blueglass', 'water'].includes(key) ? 0.3 : 0.82,
        metalness: ['glass', 'blueglass', 'accent'].includes(key) ? 0.18 : 0,
      }),
    ]));
    materials.pick.setValues({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    return { geometries, materials };
  }, []);
  useLayoutEffect(() => {
    resources.materials.glass.color.set(night ? '#f2d596' : '#6b939e');
    resources.materials.glass.emissive.set(night ? '#eeb974' : '#000000');
    resources.materials.glass.setValues({ emissiveIntensity: night ? 0.55 : 0 });
    resources.materials.lamp.emissive.set('#ffdb92');
    resources.materials.lamp.setValues({ emissiveIntensity: night ? 1.6 : 0.15 });
    resources.materials.ground.color.set(snow ? '#d5e0dc' : '#a8bc9a');
    resources.materials.leaf.color.set(snow ? '#c9d9c9' : '#88ae74');
  }, [resources, night, snow]);
  useEffect(() => () => {
    Object.values(resources.geometries).forEach((geometry) => geometry.dispose());
    Object.values(resources.materials).forEach((material) => material.dispose());
  }, [resources]);
  return resources;
}

function Instances({ batch, resources, shadows, onSelect, meshRef }) {
  const localMesh = useRef();
  const mesh = meshRef || localMesh;
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    batch.parts.forEach((part, i) => {
      transform.position.fromArray(part.position);
      transform.scale.fromArray(part.scale);
      transform.rotation.set(0, part.rotation, 0);
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
    castShadow={shadows && !['pavement', 'ground', 'road', 'glass', 'water', 'pick'].includes(batch.material)} receiveShadow={shadows}
    onClick={onSelect ? select : undefined} dispose={null} />;
}

function makeLandscape(buildings, extent, quality) {
  const { batches, add } = createBatches();
  const budget = QUALITY[quality];
  const roadStep = WORLD.spacing * WORLD.roadEvery;
  const roadWidth = 15;
  add('ground', [0, -2, 0], [extent * 2 + 36, 4, extent * 2 + 36]);
  // A low rolling edge frames the level city grid without displacing creator plots.
  for (let i = 0; i < 12; i++) {
    const along = -extent + 36 + i * (extent * 2 - 72) / 11;
    for (const side of [-1, 1]) {
      if (Math.abs(along - WORLD.riverZ) > WORLD.riverWidth + 28)
        add('ground', [side * (extent + 3), -2, along], [16, 7 + i % 4, 27], null, 'hill', 0, i % 2 ? '#b4c49c' : '#ffffff');
      add('ground', [along, -2, side * (extent + 3)], [25, 6 + i % 5, 17], null, 'hill');
    }
  }
  add('bank', [0, -0.02, WORLD.riverZ], [extent * 2 + 32, 0.2, WORLD.riverWidth + 8]);
  add('water', [0, 0.11, WORLD.riverZ], [extent * 2 + 32, 0.15, WORLD.riverWidth]);
  for (let p = Math.ceil(-extent / roadStep) * roadStep; p <= extent; p += roadStep) {
    add('pavement', [p, 0.12, 0], [roadWidth + 5, 0.22, extent * 2]);
    add('road', [p, 0.25, 0], [roadWidth, 0.12, extent * 2]);
    if (Math.abs(p - WORLD.riverZ) > WORLD.riverWidth) {
      add('pavement', [0, 0.12, p], [extent * 2, 0.22, roadWidth + 5]);
      add('road', [0, 0.26, p], [extent * 2, 0.12, roadWidth]);
    }
    // The bridge has solid stone abutments, raised parapets, and pale rail caps.
    for (const side of [-1, 1]) {
      add('stone', [p + side * 9, 1.3, WORLD.riverZ], [0.9, 2, WORLD.riverWidth + 7]);
      add('sand', [p + side * 9, 2.35, WORLD.riverZ], [1.2, 0.25, WORLD.riverWidth + 8]);
      for (let offset = -WORLD.riverWidth / 2 - 3; offset <= WORLD.riverWidth / 2 + 3; offset += 5)
        add('stone', [p + side * 9, 1.7, WORLD.riverZ + offset], [1.3, 2.7, 1.3]);
      for (const end of [-1, 1]) {
        add('dark', [p + side * 9, 3.5, WORLD.riverZ + end * 17], [0.25, 5, 0.25]);
        add('lamp', [p + side * 9, 6, WORLD.riverZ + end * 17], [1, 0.6, 1]);
      }
    }
    for (let q = -extent + 8; q < extent; q += 16) {
      const nearCrossing = Math.abs(q / roadStep - Math.round(q / roadStep)) * roadStep < 13;
      if (!nearCrossing) {
        add('marking', [p, 0.335, q], [0.35, 0.04, 5]);
        if (Math.abs(p - WORLD.riverZ) > WORLD.riverWidth) add('marking', [q, 0.345, p], [5, 0.04, 0.35]);
      }
    }
    for (let q = Math.ceil(-extent / roadStep) * roadStep; q < extent; q += roadStep) {
      for (const side of [-1, 1]) for (let stripe = -2; stripe <= 2; stripe++) {
        add('marking', [p + stripe * 2, 0.35, q + side * 11], [1.15, 0.05, 3.5]);
        add('marking', [p + side * 11, 0.35, q + stripe * 2], [3.5, 0.05, 1.15]);
      }
    }
  }
  buildings.forEach((building, index) => {
    if ((index * 0.61803398875) % 1 > budget.trees) return;
    for (const side of [-1, 1]) {
      const x = building.x + side * 11, z = building.z - 10;
      const height = 4.4 + (index % 4) * 0.45;
      add('wood', [x, 1.5, z], [0.45, 3, 0.45], null, 'trunk');
      add('leaf', [x, height, z], [2.6, 3.3, 2.6], null, 'tree', index, index % 3 ? '#ffffff' : '#b7c995');
      add('stone', [x, 0.4, z], [3.2, 0.4, 3.2]);
    }
    if (index % (quality === 'low' ? 8 : 3) === 0) {
      const x = building.x + 12, z = building.z + 11;
      add('dark', [x, 2.4, z], [0.2, 4.8, 0.2]);
      add('dark', [x - 0.65, 4.75, z], [1.5, 0.18, 0.18]);
      add('lamp', [x - 1.3, 4.65, z], [0.9, 0.22, 0.65]);
    }
  });
  // Water ripples are lit geometry, avoiding a separate unlit visual language.
  for (let i = 0; i < 36; i++) {
    const x = -extent + (i + 0.5) * extent * 2 / 36;
    if (Math.abs(x / roadStep - Math.round(x / roadStep)) * roadStep > 13)
      add('water', [x, 0.205, WORLD.riverZ + Math.sin(i * 2.7) * 8], [5 + i % 5, 0.04, 0.12], null, 'box', 0, '#c5e3e3');
  }
  addCivicScenery(add, quality);
  return batches;
}

function Cars({ resources, extent, quality }) {
  const bodies = useRef(), roofs = useRef();
  const count = QUALITY[quality].cars;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => ['#eee8d8', '#bb785f', '#7298a0', '#d4b768', '#65747d'].map((color) => new THREE.Color(color)), []);
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) bodies.current.setColorAt(i, colors[i % colors.length]);
    bodies.current.instanceColor.needsUpdate = true;
  }, [count, colors]);
  useFrame(({ clock }) => {
    const step = WORLD.spacing * WORLD.roadEvery;
    const lanes = Math.max(1, Math.floor(extent / step));
    for (let i = 0; i < count; i++) {
      const direction = i % 2 ? 1 : -1;
      const road = (i % (lanes * 2 + 1) - lanes) * step;
      const travel = ((clock.elapsedTime * (5 + i % 4) + i * 83) % (extent * 2)) - extent;
      dummy.position.set(road + direction * 3.6, 1, direction * travel);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(2.2, 1.25, 4.3); dummy.updateMatrix(); bodies.current.setMatrixAt(i, dummy.matrix);
      dummy.position.setY(1.9); dummy.scale.set(1.85, 0.7, 2.2); dummy.updateMatrix(); roofs.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    roofs.current.instanceMatrix.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={bodies} args={[resources.geometries.box, resources.materials.car, count]} frustumCulled={false} dispose={null} />
    <instancedMesh ref={roofs} args={[resources.geometries.box, resources.materials.glass, count]} frustumCulled={false} dispose={null} />
  </>;
}

function CameraRig({ extent, focusTarget, onCameraChange, joystickValues }) {
  const controls = useRef();
  const keys = useRef(new Set());
  const destination = useRef(null);
  const lastReport = useRef(0);
  const scratch = useMemo(() => ({ forward: new THREE.Vector3(), right: new THREE.Vector3(), shift: new THREE.Vector3() }), []);
  const { camera, gl } = useThree();
  useEffect(() => {
    const keydown = (event) => {
      if (event.target.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault(); keys.current.add(event.code); destination.current = null;
      }
    };
    const keyup = (event) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    const cancelFocus = () => { destination.current = null; };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clear);
    gl.domElement.addEventListener('pointerdown', cancelFocus);
    gl.domElement.addEventListener('wheel', cancelFocus);
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear);
      gl.domElement.removeEventListener('pointerdown', cancelFocus); gl.domElement.removeEventListener('wheel', cancelFocus);
    };
  }, [gl]);
  useEffect(() => {
    if (focusTarget) {
      if (!Number.isFinite(focusTarget.x) || !Number.isFinite(focusTarget.z)) return;
      const { target, position } = focusPose(focusTarget, extent);
      destination.current = { ...target, view: new THREE.Vector3(position.x, position.y, position.z) };
    }
  }, [focusTarget, extent]);
  useFrame(({ clock }, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    if (![camera.position.x, camera.position.y, camera.position.z, orbit.target.x, orbit.target.y, orbit.target.z].every(Number.isFinite)) {
      orbit.target.set(0, 4, 0); camera.position.set(150, 155, 185); destination.current = null;
    }
    const dt = safeDelta(delta);
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
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={28} maxDistance={Math.max(500, extent * 1.8)}
    minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.35} target={[0, 4, 0]} zoomSpeed={0.75} panSpeed={0.7}
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

function RenderStatus({ onReady, onPerformance }) {
  const first = useRef(true), samples = useRef({ frames: 0, elapsed: 0 });
  useFrame(({ gl }, delta) => {
    if (first.current) { first.current = false; requestAnimationFrame(() => onReady?.()); }
    samples.current.frames++; samples.current.elapsed += delta;
    if (samples.current.elapsed >= 2) {
      onPerformance?.({ fps: Math.round(samples.current.frames / samples.current.elapsed), calls: gl.info.render.calls, triangles: gl.info.render.triangles });
      samples.current = { frames: 0, elapsed: 0 };
    }
  });
  return null;
}

function ContextHealth() {
  const { gl } = useThree();
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const handleLoss = (event) => { event.preventDefault(); setLost(true); };
    gl.domElement.addEventListener('webglcontextlost', handleLoss);
    return () => gl.domElement.removeEventListener('webglcontextlost', handleLoss);
  }, [gl]);
  if (lost) throw new Error('WebGL context lost');
  return null;
}

function NearbyLabels({ buildings, selectedId, onSelect, pickMesh, resources }) {
  const [visibleIds, setVisibleIds] = useState([]);
  const lastUpdate = useRef(-1), signature = useRef('');
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), projected: new THREE.Vector3(), direction: new THREE.Vector3(), ray: new THREE.Raycaster() }), []);
  const records = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 0.25 || !pickMesh.current) return;
    lastUpdate.current = clock.elapsedTime;
    const candidates = [];
    for (const building of buildings) {
      scratch.point.set(building.x, building.height + 7, building.z);
      const distance = camera.position.distanceTo(scratch.point);
      if (distance > 180) continue;
      scratch.projected.copy(scratch.point).project(camera);
      if (Math.abs(scratch.projected.x) > 0.9 || Math.abs(scratch.projected.y) > 0.9 || Math.abs(scratch.projected.z) > 1) continue;
      candidates.push({ building, distance });
    }
    candidates.sort((a, b) => Number(b.building.id === selectedId) - Number(a.building.id === selectedId) || a.distance - b.distance);
    const ids = [];
    // Test only a small candidate set against the cheap building hit boxes.
    for (const { building, distance } of candidates.slice(0, 14)) {
      scratch.point.set(building.x, building.height + 7, building.z);
      scratch.direction.copy(scratch.point).sub(camera.position).normalize();
      scratch.ray.set(camera.position, scratch.direction);
      const nearest = scratch.ray.intersectObject(pickMesh.current)[0];
      if (nearest && nearest.distance < distance - 0.5) continue;
      ids.push(building.id);
      if (ids.length === 6) break;
    }
    const nextSignature = JSON.stringify(ids);
    if (nextSignature !== signature.current) { signature.current = nextSignature; setVisibleIds(ids); }
  });
  return visibleIds.map((id) => {
    const building = records.get(id);
    if (!building) return null;
    const avatar = typeof building.profile_image_url === 'string' ? proxyThumbnailUrl(building.profile_image_url, 96) : null;
    return <group key={id}>
      <mesh geometry={resources.geometries.box} material={resources.materials.dark} position={[building.x, building.height + 4.5, building.z]} scale={[0.16, 5, 0.16]} dispose={null} />
      <Html position={[building.x, building.height + 7, building.z]} transform sprite distanceFactor={30} zIndexRange={[20, 1]}>
        <button type="button" className="world-building-label" data-selected={id === selectedId || undefined}
          onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect?.(building); }}
          aria-label={`${building.nickname || building.handle} 선택`}>
          {avatar ? <img className="world-building-avatar" src={avatar} alt="" width="32" height="32" loading="lazy" draggable="false" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
            : <span className="world-building-avatar" aria-hidden="true">{(building.nickname || building.handle || '?').slice(0, 1)}</span>}
          <span className="world-building-name">{building.nickname || building.handle}</span>
        </button>
      </Html>
    </group>;
  });
}

function City({ buildings, selectedId, onSelect, focusTarget, quality, timeOfDay, weather, onCameraChange, onReady, onPerformance, joystickValues, flightMode, flightControls, onFlightStatus }) {
  const pickMesh = useRef();
  const extent = useMemo(() => Math.max(180, ...buildings.map((b) => Math.max(Math.abs(b.x), Math.abs(b.z)) + 40)), [buildings]);
  const resources = useResources(timeOfDay === 'night', weather === 'snow');
  const buildingsBatch = useMemo(() => buildArchitecture(buildings, quality), [buildings, quality]);
  const pickBatch = useMemo(() => ({ shape: 'box', material: 'pick', parts: buildings.map((building) => ({
    position: [building.x, (building.height + 4) / 2, building.z], scale: [20, building.height + 4, 20], owner: building.id, rotation: 0,
  })) }), [buildings]);
  const landscape = useMemo(() => makeLandscape(buildings, extent, quality), [buildings, extent, quality]);
  const selected = buildings.find((building) => building.id === selectedId);
  const lighting = SKY[timeOfDay] || SKY.day;
  const cloudy = weather === 'cloudy' || weather === 'rain' || weather === 'snow';
  return <>
    <color attach="background" args={[cloudy ? (timeOfDay === 'night' ? '#202e37' : '#b9cbd0') : lighting.background]} />
    <fog attach="fog" args={[lighting.background, extent * 0.85 + 200, extent * 3 + 500]} />
    <SkyEffects timeOfDay={timeOfDay} weather={weather} quality={quality} extent={extent} />
    <hemisphereLight args={['#e4f2ff', '#718260', lighting.ambient]} />
    <directionalLight position={lighting.position} color={lighting.sun} intensity={lighting.intensity * (cloudy ? 0.55 : 1)}
      castShadow={QUALITY[quality].shadows} shadow-mapSize={[quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024]}
      shadow-camera-left={-260} shadow-camera-right={260} shadow-camera-top={260} shadow-camera-bottom={-260}
      shadow-camera-near={1} shadow-camera-far={650} shadow-bias={-0.0002} shadow-normalBias={0.3} />
    {Object.entries(landscape).map(([key, batch]) => <Instances key={key} batch={batch} resources={resources} shadows={QUALITY[quality].shadows} />)}
    {Object.entries(buildingsBatch).map(([key, batch]) => <Instances key={key} batch={batch} resources={resources} shadows={QUALITY[quality].shadows} />)}
    <Instances batch={pickBatch} resources={resources} shadows={false} meshRef={pickMesh} onSelect={(id) => {
      const building = buildings.find((record) => record.id === id);
      if (building) onSelect?.(building);
    }} />
    <NearbyLabels buildings={buildings} selectedId={selectedId} onSelect={onSelect} pickMesh={pickMesh} resources={resources} />
    <Cars resources={resources} extent={extent} quality={quality} />
    <Airport extent={extent} parked={!flightMode} />
    <Html position={[43, 16.4, -69.8]} transform distanceFactor={24} zIndexRange={[15, 1]}><span className="world-civic-label" style={{ display: 'block', whiteSpace: 'nowrap', color: '#4f5b56', fontSize: 18, fontWeight: 700, letterSpacing: 6, pointerEvents: 'none' }}>은행</span></Html>
    <Html position={[85, 9.5, -72.1]} transform distanceFactor={24} zIndexRange={[15, 1]}><span className="world-civic-label" style={{ display: 'block', whiteSpace: 'nowrap', color: '#456a8b', fontSize: 17, fontWeight: 700, letterSpacing: 3, pointerEvents: 'none' }}>경찰서</span></Html>
    {selected && <mesh position={[selected.x, 0.8, selected.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[13.8, 14.6, 48]} /><meshBasicMaterial color="#fff5bb" transparent opacity={0.95} depthWrite={false} />
    </mesh>}
    {(weather === 'rain' || weather === 'snow') && <Precipitation weather={weather} quality={quality} />}
    {flightMode ? <FlightMode extent={extent} controlsRef={flightControls} onCameraChange={onCameraChange} onStatus={onFlightStatus} />
      : <CameraRig extent={extent} focusTarget={focusTarget} onCameraChange={onCameraChange} joystickValues={joystickValues} />}
    <RenderStatus onReady={onReady} onPerformance={onPerformance} />
    <ContextHealth />
  </>;
}

export default function WorldScene({ quality = 'medium', timeOfDay = 'day', weather = 'clear', ...props }) {
  const level = QUALITY[quality] ? quality : 'medium';
  return <Canvas className="world-canvas" shadows={QUALITY[level].shadows ? 'percentage' : false} dpr={[1, QUALITY[level].dpr]}
    camera={{ position: [150, 155, 185], fov: 38, near: 0.5, far: 5000 }}
    gl={{ antialias: level !== 'low', powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}>
    <City {...props} quality={level} timeOfDay={timeOfDay} weather={weather} />
  </Canvas>;
}
