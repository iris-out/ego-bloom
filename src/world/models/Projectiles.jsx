import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlastField } from './Blast';

const HALF_PI = Math.PI / 2;
const MAX_TRACERS = 64, MAX_MISSILES = 8, MAX_BOMBS = 12;
// 예광은 프레임 사이가 이어져 보일 만큼 길어야 한다. 짧으면 점선처럼 끊겨 보인다.
const TRACER_LENGTH = 4.6;
const TRAIL_SPEED = 70, TRAIL_MAX = 48;
const UP = new THREE.Vector3(0, 1, 0);
// Fighter.jsx 의 날개 밑 미사일과 같은 팔레트다.
const BODY = '#b9bfc2', METAL = '#394649', NOZZLE = '#1a1f22', FLAME = '#ffb347', TRAIL = '#c9ccd0', TRACER = '#fff2a8';
// 폭탄은 올리브색 동체에 회색 꼬리날개다. 미사일과 구별되게 두껍고 짧다.
const BOMB_BODY = '#4d5a46', BOMB_BAND = '#ffcf5c', BOMB_TRAIL = '#ffe9a8';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// geometry, material 모두 모듈 스코프에서 한 번만 만든다. 무장 있는 기체를 처음 탈
// 때까지 마운트가 미뤄져도, 도시가 준비된 뒤 ShaderPrewarm 이 이 재질들을
// gl.compileAsync 로 미리 찾아 컴파일할 수 있어야 첫 발사에서 셰이더 링크가 멈추지 않는다.
const GEOMETRIES = (() => {
  const tracer = new THREE.CapsuleGeometry(0.2, 1, 2, 6);
  const nose = new THREE.ConeGeometry(0.13, 0.5, 8);
  nose.rotateX(-HALF_PI);
  const body = new THREE.CylinderGeometry(0.13, 0.13, 2.4, 8);
  body.rotateX(HALF_PI);
  const fin = new THREE.BoxGeometry(1, 1, 1);
  const nozzle = new THREE.CylinderGeometry(0.1, 0.12, 0.3, 6);
  nozzle.rotateX(HALF_PI);
  const flame = new THREE.SphereGeometry(0.16, 8, 6);
  // 트레일은 뒤(+Z) 로 갈수록 굵어지는 원통이다. z 스케일이 길이다.
  const trail = new THREE.CylinderGeometry(0.85, 0.15, 1, 6, 1, true);
  trail.rotateX(HALF_PI);
  // 폭탄은 미사일보다 굵고 짧다. 추적 카메라에서 보이도록 크게 잡는다.
  const bombBody = new THREE.CapsuleGeometry(0.52, 1.9, 4, 10);
  bombBody.rotateX(HALF_PI);
  // 탄체 허리의 노란 띠다. 실제 항공 폭탄의 식별 밴드처럼 눈에 띈다.
  const bombBand = new THREE.CylinderGeometry(0.56, 0.56, 0.3, 10);
  bombBand.rotateX(HALF_PI);
  return { tracer, nose, body, fin, nozzle, flame, trail, bombBody, bombBand };
})();

const MATERIALS = {
  tracer: new THREE.MeshBasicMaterial({ color: TRACER, toneMapped: false }),
  body: new THREE.MeshStandardMaterial({ color: BODY, metalness: 0.3, roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: METAL }),
  nozzle: new THREE.MeshStandardMaterial({ color: NOZZLE, metalness: 0.5, roughness: 0.6 }),
  flame: new THREE.MeshBasicMaterial({ color: FLAME, toneMapped: false }),
  // 미사일 트레일은 탄마다 사라지는 속도가 달라 불투명도가 다르다. 공유 재질 하나를
  // 쓰고 mesh.userData.opacity 를 onBeforeRender 로 옮겨 칠한다(Blast.jsx 와 같은 방식).
  trail: new THREE.MeshBasicMaterial({ color: TRAIL, transparent: true, depthWrite: false }),
  // 폭탄 트레일은 불투명도가 늘 0.42 로 고정이라 인스턴스마다 다르게 칠할 필요가 없다.
  bombTrail: new THREE.MeshBasicMaterial({ color: BOMB_TRAIL, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
  bomb: new THREE.MeshStandardMaterial({ color: BOMB_BODY, roughness: 0.7 }),
  bombBand: new THREE.MeshStandardMaterial({ color: BOMB_BAND, emissive: BOMB_BAND, emissiveIntensity: 0.4, roughness: 0.5 }),
};

// 기체와 같은 YXZ 오일러다. 기수가 -Z 를 향하므로 yaw 는 atan2(-vx, -vz) 다.
function attitude(projectile) {
  const speed = Math.hypot(projectile.vx, projectile.vy, projectile.vz) || 1;
  const pitch = Math.asin(clamp(projectile.vy / speed, -1, 1));
  const yaw = Math.atan2(-projectile.vx, -projectile.vz);
  return [Number.isFinite(pitch) ? pitch : 0, Number.isFinite(yaw) ? yaw : 0];
}

/** arsenalRef.current.projectiles 에서 kind 가 일치하는 것만 골라 instancedMesh 하나로
 * 그린다. 상태로 올리지 않고 매 프레임 ref 를 직접 읽어, 부모가 다시 렌더하지 않아도
 * 예광이 끊기지 않는다. */
function CannonTracers({ arsenalRef, geometry, material, max = MAX_TRACERS }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const target = mesh.current;
    if (!target) return;
    const list = arsenalRef.current?.projectiles || [];
    let count = 0;
    for (let index = 0; index < list.length && count < max; index += 1) {
      const projectile = list[index];
      if (projectile.kind !== 'cannon') continue;
      direction.set(projectile.vx, projectile.vy, projectile.vz);
      if (direction.lengthSq() < 1e-6) direction.copy(UP);
      direction.normalize();
      dummy.position.set(projectile.x, projectile.y, projectile.z);
      dummy.quaternion.setFromUnitVectors(UP, direction);
      dummy.scale.set(1, TRACER_LENGTH, 1);
      dummy.updateMatrix();
      target.setMatrixAt(count, dummy.matrix);
      count += 1;
    }
    target.count = count;
    target.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, material, max]} frustumCulled={false} dispose={null} />;
}

/** id 하나가 arsenalRef.current.projectiles 안에서 살아있는 동안의 값이다. 없으면 null. */
function liveProjectile(arsenalRef, id) {
  const list = arsenalRef.current?.projectiles;
  if (!list) return null;
  for (let i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
  return null;
}

/** kind 가 일치하는 발사체의 id 목록이다. 아이디 집합이 바뀔 때만 다시 렌더한다.
 * 개별 발사체의 위치는 각 항목이 매 프레임 스스로 읽는다. */
function useMembership(arsenalRef, kind, max) {
  const [ids, setIds] = useState([]);
  const key = useRef('');
  useFrame(() => {
    const list = arsenalRef.current?.projectiles || [];
    const matched = [];
    for (let i = 0; i < list.length && matched.length < max; i += 1) if (list[i].kind === kind) matched.push(list[i].id);
    const signature = matched.join(',');
    if (signature === key.current) return;
    key.current = signature;
    setIds(matched);
  });
  return ids;
}

function Missile({ id, arsenalRef }) {
  const group = useRef();
  const trail = useRef();
  useLayoutEffect(() => {
    if (trail.current) trail.current.onBeforeRender = () => { MATERIALS.trail.opacity = trail.current.userData.opacity || 0; };
  }, []);
  useFrame(() => {
    const projectile = liveProjectile(arsenalRef, id);
    if (!projectile || !group.current) return;
    group.current.position.set(projectile.x, projectile.y, projectile.z);
    const [pitch, yaw] = attitude(projectile);
    group.current.rotation.set(pitch, yaw, 0, 'YXZ');
    const trailLength = Math.min((projectile.age || 0) * TRAIL_SPEED, TRAIL_MAX);
    const trailFade = 1 - clamp((projectile.age || 0) / (projectile.life || 1), 0, 1) * 0.5;
    if (trail.current) {
      const visible = trailLength > 0.1;
      trail.current.visible = visible;
      if (visible) {
        trail.current.position.z = 1.6 + trailLength / 2;
        trail.current.scale.set(1, 1, trailLength);
        // 트레일 재질은 미사일마다 공유하므로 불투명도는 userData 에 적어 두고
        // onBeforeRender 가 그리기 직전에 옮긴다. Blast.jsx 와 같은 방식이다.
        trail.current.userData.opacity = 0.35 * trailFade;
      }
    }
  });
  return <group ref={group}>
    <mesh geometry={GEOMETRIES.nose} material={MATERIALS.metal} position={[0, 0, -1.45]} dispose={null} />
    <mesh geometry={GEOMETRIES.body} material={MATERIALS.body} dispose={null} />
    <mesh geometry={GEOMETRIES.fin} material={MATERIALS.body} position={[0, 0, 0.9]} scale={[0.7, 0.04, 0.4]} dispose={null} />
    <mesh geometry={GEOMETRIES.fin} material={MATERIALS.body} position={[0, 0, 0.9]} scale={[0.04, 0.7, 0.4]} dispose={null} />
    <mesh geometry={GEOMETRIES.nozzle} material={MATERIALS.nozzle} position={[0, 0, 1.3]} dispose={null} />
    <mesh geometry={GEOMETRIES.flame} material={MATERIALS.flame} position={[0, 0, 1.55]} dispose={null} />
    <mesh ref={trail} geometry={GEOMETRIES.trail} material={MATERIALS.trail} dispose={null} />
  </group>;
}

function MissileField({ arsenalRef }) {
  const ids = useMembership(arsenalRef, 'missile', MAX_MISSILES);
  return <>{ids.map((id) => <Missile key={id} id={id} arsenalRef={arsenalRef} />)}</>;
}

/** 폭탄이다. 추진이 없으므로 화염도 연기도 없다. 속도 방향으로 코를 든 채 떨어진다. */
function Bomb({ id, arsenalRef }) {
  const group = useRef();
  const trail = useRef();
  useFrame(() => {
    const projectile = liveProjectile(arsenalRef, id);
    if (!projectile || !group.current) return;
    group.current.position.set(projectile.x, projectile.y, projectile.z);
    const [pitch, yaw] = attitude(projectile);
    group.current.rotation.set(pitch, yaw, 0, 'YXZ');
    // 낙하 궤적이 눈에 띄도록 꼬리에 밝은 줄무늬 띠를 붙인다. 멀리서도 떨어지는 것이 보인다.
    const streak = Math.min(14, 2 + (projectile.age || 0) * 9);
    if (trail.current) { trail.current.position.z = 1.6 + streak / 2; trail.current.scale.set(0.5, 0.5, streak); }
  });
  return <group ref={group}>
    <mesh geometry={GEOMETRIES.bombBody} material={MATERIALS.bomb} dispose={null} />
    <mesh geometry={GEOMETRIES.nose} material={MATERIALS.bomb} position={[0, 0, -1.55]} scale={[3.2, 3.2, 2.2]} dispose={null} />
    <mesh geometry={GEOMETRIES.bombBand} material={MATERIALS.bombBand} position={[0, 0, -0.2]} dispose={null} />
    {[0, 1].map((index) => <mesh key={index} geometry={GEOMETRIES.fin} material={MATERIALS.metal}
      position={[0, 0, 1.3]} scale={index ? [0.12, 1.2, 0.9] : [1.2, 0.12, 0.9]} dispose={null} />)}
    <mesh ref={trail} geometry={GEOMETRIES.trail} material={MATERIALS.bombTrail} dispose={null} />
  </group>;
}

function BombField({ arsenalRef }) {
  const ids = useMembership(arsenalRef, 'bomb', MAX_BOMBS);
  return <>{ids.map((id) => <Bomb key={id} id={id} arsenalRef={arsenalRef} />)}</>;
}

/** 전투기 무장 발사체와 폭발이다. 좌표는 전부 월드 좌표이고 장면 루트에 놓는다.
 * 위치와 속도는 weapons.js 가 계산한 값을 그대로 쓰고 여기서는 적분하지 않는다.
 * arsenalRef.current 에 { projectiles, blasts } 가 있으면 되고, 부모(FlightMode)는
 * 매 프레임 새 상태를 넣기만 하면 된다. React 재렌더는 예광 외에는 발사체 종류별
 * 아이디 집합이 바뀔 때만 일어난다. blastKind 를 주면 blasts 의 kind 대신 그 값을 쓴다.
 * geometry, material 은 모듈 스코프라 여기서 만들거나 해제하지 않는다.
 */
export default function Projectiles({ arsenalRef, blastKind }) {
  return <group>
    <CannonTracers arsenalRef={arsenalRef} geometry={GEOMETRIES.tracer} material={MATERIALS.tracer} />
    <MissileField arsenalRef={arsenalRef} />
    <BombField arsenalRef={arsenalRef} />
    <BlastField arsenalRef={arsenalRef} kind={blastKind} />
  </group>;
}
