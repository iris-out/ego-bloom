import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** 포탄 예광이다. 내 포탄과 상대 포탄이 같은 모양을 쓴다.
 * ref 를 매 프레임 읽어 instancedMesh 둘로 그린다. 상태로 올리면 갱신 주기만큼
 * 궤적이 끊기고, 탄마다 mesh 를 만들면 프레임마다 geometry 가 새로 생긴다.
 * 예광 길이는 속도에 비례해 프레임 사이가 이어져 보인다.
 */
const UP = new THREE.Vector3(0, 1, 0);

/** 포탄 굵기다. 1 이 기본 capsule 반지름 0.3 이고 지상 포는 포신 구경에 맞춰 줄인다.
 * 전차포 0.12, 자주포 0.15, 기관포와 대공포 0.06 이다. 항공기 기관포와 미사일은 그대로다. */
export const SHELL_SCALE = Object.freeze({ tank: 0.4, howitzer: 0.5, armored: 0.2, aa: 0.12 });
const shellScale = (shell) => SHELL_SCALE[shell.vehicle || shell.weapon] ?? 1;

export default function Tracers({ shellsRef, max = 48, color = '#ffe08a', halo = '#fff3c4' }) {
  const streak = useRef(), glow = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const heading = useMemo(() => new THREE.Vector3(), []);
  const parts = useMemo(() => ({
    streak: new THREE.CapsuleGeometry(0.3, 1, 3, 7),
    halo: new THREE.SphereGeometry(0.78, 8, 6),
    streakMaterial: new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    haloMaterial: new THREE.MeshBasicMaterial({ color: halo, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
  }), [color, halo]);
  useEffect(() => () => Object.values(parts).forEach((part) => part.dispose()), [parts]);
  useFrame(() => {
    const shells = shellsRef.current?.shells || [];
    const count = Math.min(shells.length, max);
    for (let index = 0; index < count; index += 1) {
      const shell = shells[index];
      heading.set(shell.vx, shell.vy, shell.vz);
      const speed = heading.length();
      if (speed < 1e-6) heading.copy(UP); else heading.divideScalar(speed);
      const girth = shellScale(shell);
      dummy.position.set(shell.x, shell.y, shell.z);
      dummy.quaternion.setFromUnitVectors(UP, heading);
      dummy.scale.set(girth, Math.min(6, Math.max(1.8, speed / 34)), girth);
      dummy.updateMatrix();
      streak.current.setMatrixAt(index, dummy.matrix);
      dummy.quaternion.identity();
      dummy.scale.setScalar(girth);
      dummy.updateMatrix();
      glow.current.setMatrixAt(index, dummy.matrix);
    }
    streak.current.count = count; glow.current.count = count;
    // count 가 0 이면 setMatrixAt 을 한 번도 안 불렀으니 버퍼를 다시 올릴 필요가 없다.
    if (count > 0) {
      streak.current.instanceMatrix.needsUpdate = true;
      glow.current.instanceMatrix.needsUpdate = true;
    }
  });
  return <>
    <instancedMesh ref={streak} args={[parts.streak, parts.streakMaterial, max]} frustumCulled={false} dispose={null} />
    <instancedMesh ref={glow} args={[parts.halo, parts.haloMaterial, max]} frustumCulled={false} dispose={null} />
  </>;
}
