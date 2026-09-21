import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const HALF_PI = Math.PI / 2;
const GROUND_Y = 0.35;
const GRAVITY = 26;
const GOLDEN_ANGLE = 2.399963;

// WebGL 은 CSS 토큰을 못 읽으므로 hex 리터럴을 쓴다.
const FLASH = '#ffffff';
const FIRE_HOT = '#fff3c4', FIRE_MID = '#ff8a1f', FIRE_COOL = '#c62a12', FIRE_DEAD = '#3a1a12';
const SMOKE_LIT = '#6b4a33', SMOKE_DARK = '#232326';
const RING = '#ffd28a', DEBRIS = '#2b2724';

// size 배수다. 기관총은 짧은 스파크, 미사일은 화염구와 링, 추락은 그보다 크고 연기가 오래 남는다.
// chunk 는 파편 한 조각의 크기 배수다. 멀리서도 조각이 보이도록 추락은 크게 잡는다.
const KINDS = {
  cannon: { flash: 1.4, fire: 1.2, smoke: 1.1, rise: 1.0, ring: 0, debris: 6, throw: 3.5, smokeHold: 0.55, chunk: 1 },
  missile: { flash: 3.1, fire: 2.4, smoke: 2.6, rise: 2.4, ring: 5, debris: 20, throw: 3.6, smokeHold: 0.7, chunk: 1.5 },
  crash: { flash: 3.8, fire: 3.1, smoke: 4, rise: 3.6, ring: 7.5, debris: 34, throw: 3.4, smokeHold: 0.9, chunk: 2.4 },
  // 폭탄은 지면에서 터진다. 불기둥이 낮고 넓게 퍼지며 연기가 가장 오래 남는다.
  bomb: { flash: 3.4, fire: 2.8, smoke: 4.4, rise: 3.0, ring: 9, debris: 30, throw: 4.2, smokeHold: 1, chunk: 2 },
  // 총알이 스쳤을 뿐 차는 멀쩡하다. 불꽃 한 번뿐이고 연기와 파편을 남기지 않는다.
  spark: { flash: 0.55, fire: 0.4, smoke: 0, rise: 0, ring: 0, debris: 0, throw: 0, smokeHold: 0, chunk: 0 },
  // 도보 사격으로 차를 부순 순간이다. 승용차 크기에 맞춰 missile 보다 훨씬 작게 잡는다.
  vehicle: { flash: 1.3, fire: 1.1, smoke: 1.4, rise: 1.1, ring: 2.2, debris: 10, throw: 2.6, smokeHold: 0.5, chunk: 1 },
};

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const easeOut = (value) => 1 - (1 - value) * (1 - value) * (1 - value);
// [0,1) 결정적 잡음이다. Math.random 대신 인덱스로만 정한다.
const noise = (index, seed) => { const raw = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453; return raw - Math.floor(raw); };

// 폭발이 동시에 여러 개 떠도 같은 지오메트리와 material 을 쓴다. 인스턴스마다 달라야
// 하는 색과 불투명도는 material 자체에 쓰지 않고 onBeforeRender 로 그리기 직전에 얹는다.
const GEOMETRIES = {
  puff: new THREE.IcosahedronGeometry(1, 1),
  ring: new THREE.RingGeometry(0.7, 1, 20, 1),
  chunk: new THREE.TetrahedronGeometry(1, 0),
};
const MATERIALS = {
  flash: new THREE.MeshBasicMaterial({ color: FLASH, transparent: true, depthWrite: false, toneMapped: false }),
  fire: new THREE.MeshBasicMaterial({ color: FIRE_HOT, transparent: true, depthWrite: false, toneMapped: false }),
  smokeBase: new THREE.MeshStandardMaterial({ color: SMOKE_LIT, transparent: true, depthWrite: false, roughness: 1 }),
  smokeCap: new THREE.MeshStandardMaterial({ color: SMOKE_LIT, transparent: true, depthWrite: false, roughness: 1 }),
  ring: new THREE.MeshBasicMaterial({ color: RING, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  debris: new THREE.MeshStandardMaterial({ color: DEBRIS, roughness: 0.9 }),
};
const PALETTE = {
  hot: new THREE.Color(FIRE_HOT), mid: new THREE.Color(FIRE_MID), cool: new THREE.Color(FIRE_COOL), dead: new THREE.Color(FIRE_DEAD),
  lit: new THREE.Color(SMOKE_LIT), dark: new THREE.Color(SMOKE_DARK),
};

/** 파편 인스턴스 행렬을 다시 굴린다. t, seconds, scale, floor 는 apply() 가 이미 구해 둔 값이다. */
function updateDebris(mesh, dummy, spec, scale, t, seconds, floor) {
  if (!mesh) return;
  const speed = scale * spec.throw;
  const shrink = 1 - clamp01((t - 0.55) / 0.35);
  for (let i = 0; i < spec.debris; i += 1) {
    const azimuth = i * GOLDEN_ANGLE;
    const elevation = 0.35 + noise(i, 1) * 0.9;
    const pace = speed * (0.6 + noise(i, 2) * 0.8);
    const horizontal = Math.cos(elevation) * pace * seconds;
    const px = Math.cos(azimuth) * horizontal;
    const pz = Math.sin(azimuth) * horizontal;
    const py = Math.max(floor, Math.sin(elevation) * pace * seconds - GRAVITY * seconds * seconds * 0.5);
    const chunk = scale * (0.08 + noise(i, 3) * 0.1) * (spec.chunk || 1) * shrink;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(seconds * (2 + noise(i, 4) * 4), i * 0.7, seconds * (1 + noise(i, 5) * 3));
    dummy.scale.setScalar(Math.max(0, chunk));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** age 하나로 폭발의 모든 시각 요소를 구해 refs 에 바로 쓴다. age 프롭과 ageOf 콜백
 * 둘 다 결국 이 한 함수로 모인다. 렌더 여부와 무관하게 같은 결과를 낸다. */
function applyBlast(refs, scratch, paint, spec, age, life, size, y) {
  const t = clamp01(age / (life || 1));
  const seconds = t * (Number.isFinite(life) && life > 0 ? life : 1);
  const scale = Math.max(0.01, Number.isFinite(size) ? size : 1);
  const grounded = spec.ring > 0 && y <= scale * 2;
  const floor = GROUND_Y - y;

  // 섬광은 첫 12% 안에 사라진다.
  const flashT = clamp01(t / 0.12);
  const flashScale = scale * spec.flash * (0.6 + flashT * 0.9);
  const flashOpacity = (1 - flashT) * (1 - flashT);

  // 화염구는 앞 25% 에 급팽창하고 이후 식으며 줄어든다.
  const swell = easeOut(clamp01(t / 0.25));
  const fireScale = scale * spec.fire * (0.15 + swell * 0.85) * (1 - clamp01((t - 0.45) / 0.55) * 0.5);
  const fireOpacity = clamp01(1 - clamp01((t - 0.3) / 0.5));

  // 연기는 화염이 식은 뒤에도 남아 위로 퍼진다. smokeHold 까지는 짙게 유지한다.
  const smokeFade = clamp01((t - spec.smokeHold) / (1 - spec.smokeHold));
  const smokeOpacity = 0.7 * (1 - smokeFade);
  const lift = easeOut(t) * scale * spec.rise;
  const smokeBaseScale = scale * spec.smoke * (0.25 + easeOut(t) * 0.75);
  const smokeCapScale = scale * spec.smoke * (0.15 + easeOut(t) * 0.7);

  const ringScale = scale * spec.ring * (0.15 + easeOut(t) * 0.85);
  const ringOpacity = 0.85 * (1 - t) * (1 - t);

  // fire, smoke 색은 이 인스턴스 소유 Color 에만 섞는다. material.color 를 직접
  // 덮어쓰면 같은 material 을 쓰는 다른 폭발의 색까지 바뀐다. paint 가 onBeforeRender 로
  // 그리기 직전에 이 값을 material 에 옮긴다.
  if (t < 0.2) scratch.fireColor.lerpColors(PALETTE.hot, PALETTE.mid, t / 0.2);
  else if (t < 0.55) scratch.fireColor.lerpColors(PALETTE.mid, PALETTE.cool, (t - 0.2) / 0.35);
  else scratch.fireColor.lerpColors(PALETTE.cool, PALETTE.dead, (t - 0.55) / 0.45);
  scratch.smokeBaseColor.lerpColors(PALETTE.lit, PALETTE.dark, clamp01(t / 0.5));
  scratch.smokeCapColor.lerpColors(PALETTE.lit, PALETTE.dark, clamp01(t / 0.35));

  paint.flash = flashOpacity; paint.fire = fireOpacity;
  paint.smokeBase = smokeOpacity; paint.smokeCap = smokeOpacity * 0.85; paint.ring = ringOpacity;

  const { flash, fire, smokeBase, smokeCap, ring, debris } = refs;
  if (flash.current) { flash.current.visible = flashOpacity > 0; flash.current.scale.setScalar(flashScale); }
  if (fire.current) { fire.current.visible = fireOpacity > 0; fire.current.scale.setScalar(fireScale); }
  if (smokeBase.current) { smokeBase.current.position.y = lift * 0.45; smokeBase.current.scale.setScalar(smokeBaseScale); }
  if (smokeCap.current) {
    smokeCap.current.position.set(scale * 0.2, lift, -scale * 0.15);
    smokeCap.current.scale.setScalar(smokeCapScale);
  }
  if (ring.current) { ring.current.visible = grounded && ringOpacity > 0; ring.current.position.y = floor; ring.current.scale.setScalar(ringScale); }
  updateDebris(debris.current, scratch.dummy, spec, scale, t, seconds, floor);
}

/** 무장, 추락 폭발 하나. 좌표는 월드 좌표이고 장면 루트에 놓인다.
 * 섬광, 화염구, 연기 기둥, 지면 충격파, 파편 순서로 시간을 나눠 그린다.
 *
 * age 를 직접 받으면 부모가 렌더마다 넘긴 값으로 갱신한다(기존 방식). ageOf 를
 * 받으면 매 프레임 스스로 읽어 갱신하므로 부모는 이 폭발이 켜져 있는 동안 다시
 * 렌더하지 않아도 된다. 두 방식 모두 같은 applyBlast() 를 거쳐 결과가 같다.
 */
export default function Blast({ kind = 'missile', x = 0, y = 0, z = 0, age = 0, life = 1, size = 1, ageOf }) {
  const spec = KINDS[kind] || KINDS.missile;
  const flashRef = useRef(), fireRef = useRef(), smokeBaseRef = useRef(), smokeCapRef = useRef(), ringRef = useRef(), debrisRef = useRef();
  // refs 묶음과 색·행렬 스크래치는 인스턴스마다 한 번만 만든다.
  const refs = useMemo(() => ({ flash: flashRef, fire: fireRef, smokeBase: smokeBaseRef, smokeCap: smokeCapRef, ring: ringRef, debris: debrisRef }), []);
  const scratch = useMemo(() => ({
    dummy: new THREE.Object3D(),
    fireColor: new THREE.Color(),
    smokeBaseColor: new THREE.Color(),
    smokeCapColor: new THREE.Color(),
  }), []);
  // onBeforeRender 가 그리기 직전에 읽는 그릇이다. 렌더마다 클로저를 새로 만들지 않도록
  // 마운트 한 번에만 연결하고 이후로는 이 객체의 값만 바꾼다.
  const paint = useMemo(() => ({ flash: 0, fire: 0, smokeBase: 0, smokeCap: 0, ring: 0 }), []);

  useLayoutEffect(() => {
    if (flashRef.current) flashRef.current.onBeforeRender = () => { MATERIALS.flash.opacity = paint.flash; };
    if (fireRef.current) fireRef.current.onBeforeRender = () => { MATERIALS.fire.opacity = paint.fire; MATERIALS.fire.color.copy(scratch.fireColor); };
    if (smokeBaseRef.current) smokeBaseRef.current.onBeforeRender = () => { MATERIALS.smokeBase.opacity = paint.smokeBase; MATERIALS.smokeBase.color.copy(scratch.smokeBaseColor); };
    if (smokeCapRef.current) smokeCapRef.current.onBeforeRender = () => { MATERIALS.smokeCap.opacity = paint.smokeCap; MATERIALS.smokeCap.color.copy(scratch.smokeCapColor); };
    if (ringRef.current) ringRef.current.onBeforeRender = () => { MATERIALS.ring.opacity = paint.ring; };
  }, [paint, scratch]);

  // age 방식은 부모가 넘기는 값이 바뀔 때마다 다시 계산한다(마운트 포함).
  // ageOf 방식도 첫 프레임만 여기서 맞추고 이후는 useFrame 이 이어받는다.
  useLayoutEffect(() => {
    const now = ageOf ? ageOf() : age;
    if (Number.isFinite(now)) applyBlast(refs, scratch, paint, spec, now, life, size, y);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs, scratch, paint 는 이 인스턴스에서 고정이다.
  }, [ageOf, spec, age, life, size, y]);

  useFrame(() => {
    if (!ageOf) return;
    // 목록에서 빠졌으면 마지막 모습 그대로 둔다. 곧 언마운트된다.
    const now = ageOf();
    if (Number.isFinite(now)) applyBlast(refs, scratch, paint, spec, now, life, size, y);
  });

  return <group position={[x, y, z]}>
    <mesh ref={flashRef} geometry={GEOMETRIES.puff} material={MATERIALS.flash} dispose={null} />
    <mesh ref={fireRef} geometry={GEOMETRIES.puff} material={MATERIALS.fire} dispose={null} />
    <mesh ref={smokeBaseRef} geometry={GEOMETRIES.puff} material={MATERIALS.smokeBase} dispose={null} />
    <mesh ref={smokeCapRef} geometry={GEOMETRIES.puff} material={MATERIALS.smokeCap} dispose={null} />
    {spec.ring > 0 && <mesh ref={ringRef} geometry={GEOMETRIES.ring} material={MATERIALS.ring} rotation={[-HALF_PI, 0, 0]} dispose={null} />}
    <instancedMesh ref={debrisRef} args={[GEOMETRIES.chunk, MATERIALS.debris, spec.debris]} frustumCulled={false} dispose={null} />
  </group>;
}

/** 목록에서 빠진 폭발은 null 을 돌려준다. 0 을 돌려주면 사라지기 직전 한 프레임 동안
 * 나이가 0 으로 돌아가 섬광이 다시 번쩍인다. Projectiles 의 liveProjectile 과 같은 규약이다. */
function findAge(blasts, id) {
  if (!blasts) return null;
  for (let i = 0; i < blasts.length; i += 1) if (blasts[i].id === id) return blasts[i].age;
  return null;
}

/** arsenalRef.current.blasts 목록을 그린다. 배열은 매 프레임 새로 만들어져도(불변 갱신)
 * 구성(아이디 집합)이 그대로면 다시 렌더하지 않는다. 나이는 각 Blast 가 ageOf 로
 * 스스로 읽으므로 부모는 폭발이 살아 있는 동안 손을 떼도 된다. kind 를 주면 배열의
 * kind 필드 대신 그 값을 쓴다(지상 무기 폭발처럼 kind 를 따로 담지 않는 곳).
 */
export function BlastField({ arsenalRef, kind, max = 32 }) {
  const [entries, setEntries] = useState([]);
  const idsRef = useRef('');
  useFrame(() => {
    const blasts = (arsenalRef?.current?.blasts || []).slice(-max);
    let ids = '';
    for (let i = 0; i < blasts.length; i += 1) ids += `${blasts[i].id},`;
    if (ids === idsRef.current) return;
    idsRef.current = ids;
    setEntries(blasts.map((blast) => ({ id: blast.id, kind: kind || blast.kind, x: blast.x, y: blast.y, z: blast.z, life: blast.life, size: blast.size })));
  });
  return <>{entries.map((entry) => <Blast key={entry.id} kind={entry.kind} x={entry.x} y={entry.y} z={entry.z}
    life={entry.life} size={entry.size} ageOf={() => findAge(arsenalRef?.current?.blasts, entry.id)} />)}</>;
}
