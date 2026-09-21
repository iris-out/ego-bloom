import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CROP, FAR, FOV, MIRROR_DEPTH, MIRROR_LAYOUTS, MIRROR_PASS, REAR_CAMERA, cropAspect } from './mirrorLayout.js';
import { shouldRenderMirror, worldFrame } from '../mirrorSchedule.js';
import { forceCityLod } from '../cityLod.js';

/** 거울이 보는 도시의 상세 단계다. CityTiles 의 far 이며 448x168 에서는 상세 단계와 구분되지 않는다. */
const MIRROR_LOD = 2;

/** 승용차와 오토바이 1인칭의 룸미러와 사이드미러다. layout('car' 기본, 'motorcycle') 이
 * 화면 자리 표를 고른다. 오토바이는 룸미러가 없어 좌우 둘뿐이다.
 * 뒤를 보는 카메라 한 대를 낮은 해상도 render target 에 몇 프레임에 한 번만 그리고,
 * 그 한 장을 거울들이 영역을 나눠 붙인다. 거울마다 카메라를 두면 도시를 그만큼 더 그린다.
 * 그림자 맵은 본 화면이 이미 그린 것을 그대로 쓰고 이 패스에서 다시 만들지 않는다. */
function cropGeometry([u0, u1, v0, v1]) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  // PlaneGeometry 의 정점 순서는 좌상, 우상, 좌하, 우하다. 거울이라 u 를 뒤집는다.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([u1, v1, u0, v1, u1, v0, u0, v0], 2));
  return geometry;
}

export default function Mirrors({ vehicle, layout = 'car', quality = 'medium' }) {
  const { gl, scene, camera } = useThree();
  const rear = useRef();
  const faces = useRef({});
  const pass = MIRROR_PASS[quality] || MIRROR_PASS.medium;
  const mirrorLayout = MIRROR_LAYOUTS[layout] || MIRROR_LAYOUTS.car;
  const target = useMemo(() => new THREE.WebGLRenderTarget(pass.width, pass.height, { stencilBuffer: false }), [pass]);
  // 깊이 검사를 끄고 renderOrder 를 크게 두어 대시보드와 기둥보다 늘 위에 그린다. UI 처럼 보이게 한다.
  const materials = useMemo(() => ({
    face: new THREE.MeshBasicMaterial({ map: target.texture, depthTest: false, depthWrite: false, toneMapped: true }),
    bezel: new THREE.MeshBasicMaterial({ color: '#15171c', depthTest: false, depthWrite: false }),
  }), [target]);
  const geometries = useMemo(() => ({
    ...Object.fromEntries(Object.keys(mirrorLayout).map((key) => [key, cropGeometry(CROP[key])])),
    bezel: new THREE.PlaneGeometry(1, 1),
  }), [mirrorLayout]);
  // 거울은 카메라의 자식이다. 기본 카메라는 장면에 들어 있지 않으므로 자식을 그리려면 장면에 넣어야 한다.
  const hud = useMemo(() => new THREE.Group(), []);
  useEffect(() => {
    const orphan = !camera.parent;
    if (orphan) scene.add(camera);
    camera.add(hud);
    return () => {
      camera.remove(hud);
      if (orphan) scene.remove(camera);
    };
  }, [camera, scene, hud]);
  useEffect(() => () => { target.dispose(); Object.values(materials).forEach((material) => material.dispose()); }, [target, materials]);
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
    if (!rear.current || !shouldRenderMirror(worldFrame(clock.elapsedTime), pass)) return;
    const back = rear.current;
    // 부모 차체의 행렬은 CarMode 가 같은 프레임에 고친다. 여기서 조상까지 갱신해 한 프레임 늦지 않게 한다.
    back.updateWorldMatrix(true, false);
    const shadows = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    hud.visible = false;
    // 도시를 먼 단계로 내린 채 그린다. 이 패스의 비용은 draw 제출과 정점이 전부다.
    forceCityLod(MIRROR_LOD);
    try {
      gl.setRenderTarget(target);
      gl.render(scene, back);
    } finally {
      gl.setRenderTarget(null);
      forceCityLod(null);
      hud.visible = true;
      gl.shadowMap.autoUpdate = shadows;
    }
  });

  return <>
    <perspectiveCamera ref={rear} position={REAR_CAMERA[vehicle] || REAR_CAMERA.sedan} rotation={[0, Math.PI, 0]}
      fov={FOV} aspect={pass.width / pass.height} near={0.5} far={FAR} onUpdate={(cam) => cam.updateProjectionMatrix()} />
    {createPortal(Object.keys(mirrorLayout).map((key) => <group key={key} ref={(node) => { faces.current[key] = node; }}>
      {/* 테두리는 거울면보다 조금 크고 먼저 그린다. 크기는 부모 scale 을 따르므로 단위 평면 비율로 키운다. */}
      <mesh geometry={geometries.bezel} material={materials.bezel} scale={[1.06, 1.12, 1]} renderOrder={1000} />
      <mesh geometry={geometries[key]} material={materials.face} renderOrder={1001} />
    </group>), hud)}
  </>;
}
