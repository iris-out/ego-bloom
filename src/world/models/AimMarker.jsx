import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** 탄착 표식이다. 포탄이 실제로 떨어지는 자리를 월드 공간에 그린다.
 * 탄도는 reticle.js 가 풀고 이 파일은 시각만 맡는다. 물리를 여기에 넣지 않는다.
 * 색은 hex 다. WebGL 은 CSS 변수를 못 읽어 WorldPage 의 티어 색 표와 같은 예외를 쓴다.
 */
const RING = new THREE.RingGeometry(0.82, 1, 40);
const BAR = new THREE.BoxGeometry(0.52, 0.03, 0.075);
/** 폭탄 탄착점에 세우는 기둥이다. 고고도에서는 땅에 누운 고리가 몇 픽셀로 찌그러져
 * 어디에 떨어지는지 보이지 않는다. 세로로 선 기둥은 각도와 무관하게 눈에 띈다. */
const POLE = new THREE.CylinderGeometry(0.09, 0.09, 1, 8);

const basic = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
/** tone 은 무기 종류, 두 번째 키는 탄착 대상이다. 사거리 밖이면 흐리게 둔다. */
const MATERIALS = {
  ground: { ground: basic('#ffd24a', 0.92), building: basic('#8fd6ff', 0.92), none: basic('#ffd24a', 0.3) },
  air: { ground: basic('#d8f2ff', 0.92), building: basic('#8fd6ff', 0.92), none: basic('#d8f2ff', 0.3) },
  missile: { ground: basic('#ff8a5c', 0.92), building: basic('#ffb07a', 0.92), none: basic('#ff8a5c', 0.3) },
  // 폭탄 탄착점이다. 고고도에서도 보이도록 가장 밝은 노랑을 쓴다.
  bomb: { ground: basic('#ffd24a', 0.98), building: basic('#ffe9a8', 0.98), none: basic('#ffd24a', 0.45) },
};

const materialFor = (tone, hit) => (MATERIALS[tone] || MATERIALS.ground)[hit] || (MATERIALS[tone] || MATERIALS.ground).none;

export default function AimMarker({ solutionRef, tone = 'ground' }) {
  const root = useRef(), inner = useRef(), ring = useRef(), barX = useRef(), barZ = useRef(), pole = useRef();
  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const hit = solutionRef?.current;
    if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y) || !Number.isFinite(hit.z)) { group.visible = false; return; }
    group.visible = true;
    // 지면과 같은 높이면 표식이 지면에 파묻혀 깜빡인다.
    group.position.set(hit.x, hit.y + 0.07, hit.z);
    // 멀어도 화면에서 같은 크기로 보이도록 거리에 비례해 키운다.
    // 폭탄은 훨씬 높은 곳에서 떨구므로 표식을 더 크게 키운다.
    const gain = tone === 'bomb' ? 0.055 : 0.012, cap = tone === 'bomb' ? 46 : 6;
    const size = THREE.MathUtils.clamp((Number(hit.range) || 0) * gain, 0.6, cap);
    inner.current.scale.setScalar(size);
    // 기둥은 표식과 함께 커지되 높이만 훨씬 길게 뽑는다. 굵기는 고리를 가리지 않을 만큼만 둔다.
    if (pole.current) {
      pole.current.scale.set(1, size * 26, 1);
      pole.current.position.y = size * 13;
    }
    const material = materialFor(tone, hit.hit);
    for (const mesh of [ring.current, barX.current, barZ.current, pole.current]) if (mesh && mesh.material !== material) mesh.material = material;
  });
  return <group ref={root} visible={false}>
    <group ref={inner}>
      <mesh ref={ring} geometry={RING} material={MATERIALS.ground.ground} rotation={[-Math.PI / 2, 0, 0]} dispose={null} />
      <mesh ref={barX} geometry={BAR} material={MATERIALS.ground.ground} dispose={null} />
      <mesh ref={barZ} geometry={BAR} material={MATERIALS.ground.ground} rotation={[0, Math.PI / 2, 0]} dispose={null} />
    </group>
    {/* 기둥은 안쪽 그룹 밖에 둔다. 안에 넣으면 고리 배율에 굵기까지 끌려간다. */}
    {tone === 'bomb' && <mesh ref={pole} geometry={POLE} material={MATERIALS.bomb.ground} dispose={null} />}
  </group>;
}
