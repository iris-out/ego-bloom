import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FAR, FOV, MIRROR_DEPTH, MIRROR_LAYOUTS, MIRROR_PASS, SIDE_FOV, cropAspect, mirrorCameraPosition, mirrorTargetSize, mirrorYaw } from './mirrorLayout.js';
import { shouldRenderMirror, worldFrame } from '../mirrorSchedule.js';
import { forceCityLod } from '../cityLod.js';

/** 거울이 보는 도시의 상세 단계다. CityTiles 의 far 이며 448x168 에서는 상세 단계와 구분되지 않는다. */
const MIRROR_LOD = 2;

/** 룸미러는 정후방, 좌우 거울은 독립 후측방 카메라를 쓴다. 갱신 프레임에는 한 면만 그려
 * 기존 단일 미러 패스와 같은 한 번의 도시 렌더 비용을 유지한다. */

export default function Mirrors({ vehicle, layout = 'car', quality = 'medium' }) {
  const { gl, scene, camera } = useThree();
  const cameras = useRef({});
  const faces = useRef({});
  const pass = MIRROR_PASS[quality] || MIRROR_PASS.medium;
  const mirrorLayout = MIRROR_LAYOUTS[layout] || MIRROR_LAYOUTS.car;
  const mirrorKeys = useMemo(() => Object.keys(mirrorLayout), [mirrorLayout]);
  const targets = useMemo(() => Object.fromEntries(mirrorKeys.map((key) => {
    const size = mirrorTargetSize(key, pass);
    return [key, new THREE.WebGLRenderTarget(size.width, size.height, { stencilBuffer: false })];
  })), [mirrorKeys, pass]);
  // 깊이 검사를 끄고 renderOrder 를 크게 두어 대시보드와 기둥보다 늘 위에 그린다. UI 처럼 보이게 한다.
  const materials = useMemo(() => ({
    ...Object.fromEntries(mirrorKeys.map((key) => [key, new THREE.MeshBasicMaterial({ map: targets[key].texture, depthTest: false, depthWrite: false, toneMapped: true })])),
    bezel: new THREE.MeshBasicMaterial({ color: '#15171c', depthTest: false, depthWrite: false }),
  }), [mirrorKeys, targets]);
  const geometries = useMemo(() => ({
    ...Object.fromEntries(mirrorKeys.map((key) => [key, new THREE.PlaneGeometry(1, 1)])),
    bezel: new THREE.PlaneGeometry(1, 1),
  }), [mirrorKeys]);
  const turn = useRef(0);
  // 거울은 카메라의 자식이다. 기본 카메라는 장면에 들어 있지 않으므로 자식을 그리려면 장면에 넣어야 한다.
  const hud = useMemo(() => new THREE.Group(), []);
  // 거울을 그리는 동안 숨길 실내 뿌리다. Mirrors 는 실내 안에 있으므로 조상을 거슬러 찾는다.
  const anchor = useRef(), interior = useRef(null);
  useEffect(() => {
    let node = anchor.current;
    while (node && !node.userData?.cockpitRoot) node = node.parent;
    interior.current = node || null;
    return () => { interior.current = null; };
  }, []);
  useEffect(() => {
    const orphan = !camera.parent;
    if (orphan) scene.add(camera);
    camera.add(hud);
    return () => {
      camera.remove(hud);
      if (orphan) scene.remove(camera);
    };
  }, [camera, scene, hud]);
  useEffect(() => () => { Object.values(targets).forEach((target) => target.dispose()); Object.values(materials).forEach((material) => material.dispose()); }, [targets, materials]);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useFrame(({ clock }) => {
    // 화각이 차종마다 달라 매 프레임 화면 비율로 자리를 다시 잡는다. 계산 몇 줄이라 비용이 없다.
    const halfHeight = MIRROR_DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const halfWidth = halfHeight * camera.aspect;
    for (const [key, spec] of Object.entries(mirrorLayout)) {
      const node = faces.current[key];
      if (!node) continue;
      const height = spec.height * halfHeight * 2, width = height * cropAspect(key, pass);
      node.position.set(spec.x * halfWidth, spec.y * halfHeight, -MIRROR_DEPTH);
      node.scale.set(width, height, 1);
    }
    if (!shouldRenderMirror(worldFrame(clock.elapsedTime), pass)) return;
    const key = mirrorKeys[turn.current++ % mirrorKeys.length];
    const back = cameras.current[key];
    if (!back) return;
    // 부모 차체의 행렬은 CarMode 가 같은 프레임에 고친다. 여기서 조상까지 갱신해 한 프레임 늦지 않게 한다.
    back.updateWorldMatrix(true, false);
    const shadows = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    hud.visible = false;
    // 뒤를 보는 카메라에는 실내가 거의 시야를 채운다. 그려 봐야 거울에 보이는 것은
    // 차 밖이고 draw 만 두 배가 된다. 이 패스 동안만 내린다.
    const inside = interior.current;
    if (inside) inside.visible = false;
    // 도시를 먼 단계로 내린 채 그린다. 이 패스의 비용은 draw 제출과 정점이 전부다.
    forceCityLod(MIRROR_LOD);
    try {
      gl.setRenderTarget(targets[key]);
      gl.render(scene, back);
    } finally {
      gl.setRenderTarget(null);
      forceCityLod(null);
      if (inside) inside.visible = true;
      hud.visible = true;
      gl.shadowMap.autoUpdate = shadows;
    }
  });

  return <>
    <group ref={anchor} />
    {mirrorKeys.map((key) => {
      const size = mirrorTargetSize(key, pass);
      return <perspectiveCamera key={`camera-${key}`} ref={(node) => { cameras.current[key] = node; }} position={mirrorCameraPosition(vehicle, key)} rotation={[0, mirrorYaw(key), 0]}
        fov={key === 'rear' ? FOV : SIDE_FOV} aspect={size.width / size.height} near={0.5} far={FAR} onUpdate={(cam) => cam.updateProjectionMatrix()} />;
    })}
    {createPortal(mirrorKeys.map((key) => <group key={key} ref={(node) => { faces.current[key] = node; }}>
      {/* 테두리는 거울면보다 조금 크고 먼저 그린다. 크기는 부모 scale 을 따르므로 단위 평면 비율로 키운다. */}
      <mesh geometry={geometries.bezel} material={materials.bezel} scale={[1.06, 1.12, 1]} renderOrder={1000} />
      <mesh geometry={geometries[key]} material={materials[key]} renderOrder={1001} />
    </group>), hud)}
  </>;
}
