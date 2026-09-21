import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { enginesOf } from '../hardpoints';

/** 기종별 엔진 배기 효과. 비행기 모델 로컬 공간에 놓이며 hardpoints 의 노즐 좌표를 그대로 쓴다.
 * Jet 과 같은 축 규약이다. 기수가 -Z 이므로 불꽃은 노즐에서 +Z 로 뻗는다.
 * 부모가 위치와 자세를 주고, 이 컴포넌트는 노즐 기준 scale, opacity, 미세한 흔들림만 바꾼다.
 * 한 기체에 붙는 mesh 는 전투기 12, 라이트 제트 8, 폭격기 12 다. 수십 대가 동시에 뜨므로 이 예산을 넘기지 않는다.
 */
const HALF_PI = Math.PI / 2;
const AFTERBURNER_START = 0.75;
const RUNWAY_DAMPING = 0.6;
const HIDE_BELOW = 0.02;
const SMOKE = '#8d9195';

/* radius, length 는 노즐 반지름의 배수다. length 는 [스로틀 0 길이, 스로틀 1 에서 더해지는 길이] 다. */
const PRESETS = {
  jet: {
    flame: '#ffb35a', flameOpacity: 0.62, radius: 1.15, length: [0.7, 3.8],
    core: '#dff5ff', coreOpacity: 0.7, coreRadius: 0.55, coreLength: 0.62,
    disc: '#ffd08a', discOpacity: 0.6, rings: 0, afterburnerLength: 0,
    smokeOpacity: 0.2, smokeSpread: 1.7, blending: THREE.AdditiveBlending,
  },
  bomber: {
    // 네 발 터보팬이다. 불꽃은 옅고 연기가 길게 남는다.
    flame: '#f2dcc6', flameOpacity: 0.22, radius: 1.25, length: [0.6, 3.2],
    core: null, disc: '#e6c6a4', discOpacity: 0.3, rings: 0, afterburnerLength: 0,
    smokeOpacity: 0.3, smokeSpread: 2.3, blending: THREE.NormalBlending,
  },
  prop: {
    // 피스톤 엔진 배기다. 짧고 검은 연기만 난다. 추진은 프로펠러가 한다.
    flame: '#d9b48a', flameOpacity: 0.16, radius: 1.6, length: [0.3, 1.1],
    core: null, disc: '#d9c3a4', discOpacity: 0.14, rings: 0, afterburnerLength: 0,
    smokeOpacity: 0.3, smokeSpread: 2.6, blending: THREE.NormalBlending,
  },
  helicopter: {
    // 터보샤프트는 배기가 짧고 열기와 연기 위주다.
    flame: '#f0d2b4', flameOpacity: 0.18, radius: 1.1, length: [0.5, 2.2],
    core: null, disc: '#e0bb96', discOpacity: 0.3, rings: 0, afterburnerLength: 0,
    smokeOpacity: 0.24, smokeSpread: 2.2, blending: THREE.NormalBlending,
  },
  interceptor: {
    // 로켓처럼 밝고 긴 배기다. 부스트를 걸면 더 길어진다.
    flame: '#ff9440', flameOpacity: 0.82, radius: 1.3, length: [0.9, 4.4],
    core: '#dff0ff', coreOpacity: 0.95, coreRadius: 0.6, coreLength: 0.8,
    ring: '#bfe6ff', ringOpacity: 0.75, rings: 3,
    disc: '#ffe3b0', discOpacity: 0.72, afterburnerLength: 14,
    smokeOpacity: 0.2, smokeSpread: 1.5, blending: THREE.AdditiveBlending,
  },
  fighter: {
    flame: '#ff7a2e', flameOpacity: 0.78, radius: 1.35, length: [0.8, 3.8],
    core: '#c8ecff', coreOpacity: 0.92, coreRadius: 0.66, coreLength: 0.72,
    ring: '#a8e0ff', ringOpacity: 0.8, rings: 2,
    disc: '#ffe0a8', discOpacity: 0.68, afterburnerLength: 11,
    smokeOpacity: 0.22, smokeSpread: 1.6, blending: THREE.AdditiveBlending,
  },
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function makeMaterial(color, blending) {
  if (!color) return null;
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, blending, toneMapped: false, side: THREE.DoubleSide,
  });
}

export default function EngineGlow({ plane = 'jet', glowRef, throttle = 0, phase = 'runway' }) {
  const preset = PRESETS[plane] || PRESETS.jet;
  const ports = enginesOf(plane);

  /* 원뿔은 밑면을 원점에 두고 꼭짓점이 +Z 를 향하게 구워 둔다. scale.z 만 바꾸면 노즐에 붙은 채 길이가 변한다. */
  const geometries = useMemo(() => {
    const cone = new THREE.ConeGeometry(1, 1, 10, 1, true);
    cone.translate(0, 0.5, 0);
    cone.rotateX(HALF_PI);
    const ring = new THREE.TorusGeometry(1, 0.12, 5, 12);
    const disc = new THREE.CircleGeometry(1, 12);
    return { cone, ring, disc };
  }, []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  const materials = useMemo(() => ({
    flame: makeMaterial(preset.flame, preset.blending),
    core: makeMaterial(preset.core, preset.blending),
    ring: makeMaterial(preset.ring, preset.blending),
    disc: makeMaterial(preset.disc, preset.blending),
    // 연기는 불꽃과 달리 화면을 밝히지 않는다. 항상 normal blending 이다.
    smoke: makeMaterial(SMOKE, THREE.NormalBlending),
  }), [preset]);
  useEffect(() => () => Object.values(materials).forEach((material) => material && material.dispose()), [materials]);

  const group = useRef();
  const parts = useRef([]);
  const partAt = (index) => (parts.current[index] ||= { flame: null, core: null, disc: null, smoke: null, rings: [] });

  /* glowRef 가 있으면(FlightMode 조종 중) throttle/phase 를 매 프레임 직접 읽는다.
   * props 로만 받으면(주기, 원격 기체) 마지막 값을 그대로 쓴다. */
  useFrame(({ clock }) => {
    if (!group.current) return;
    const live = glowRef?.current;
    const liveThrottle = live ? live.throttle : throttle, livePhase = live ? live.phase : phase;
    const active = livePhase !== 'crashed';
    if (!active) { group.current.visible = false; return; }
    const t = clock.elapsedTime;
    const power = clamp01(livePhase === 'runway' ? liveThrottle * RUNWAY_DAMPING : liveThrottle);
    const fade = Math.pow(power, 1.4);
    const burnerLevel = clamp01((liveThrottle - AFTERBURNER_START) / (1 - AFTERBURNER_START));
    const hasBurner = ports.some((port) => port.afterburner) && burnerLevel > 0;
    const pulse = 1 + 0.08 * Math.sin(t * 31) + 0.05 * Math.sin(t * 47 + 0.9);

    group.current.visible = fade > HIDE_BELOW;
    if (!group.current.visible) return;

    materials.flame.opacity = preset.flameOpacity * Math.min(1, fade + (hasBurner ? burnerLevel * 0.4 : 0)) * pulse;
    if (materials.core) materials.core.opacity = preset.coreOpacity * Math.min(1, fade * 0.8 + (hasBurner ? burnerLevel * 0.5 : 0)) * pulse;
    if (materials.ring) materials.ring.opacity = preset.ringOpacity * burnerLevel * pulse;
    materials.disc.opacity = preset.discOpacity * Math.min(1, fade + (hasBurner ? burnerLevel * 0.3 : 0));
    materials.smoke.opacity = preset.smokeOpacity * Math.min(1, fade * 1.1) * (0.9 + 0.1 * pulse);

    ports.forEach((port, index) => {
      const part = parts.current[index];
      if (!part || !part.flame) return;
      const r = port.radius;
      const seed = index * 1.7;
      const burner = port.afterburner ? burnerLevel : 0;
      const flick = 1 + 0.07 * Math.sin(t * 27 + seed) + 0.05 * Math.sin(t * 41 + seed * 2.3) + 0.03 * Math.sin(t * 13 + seed);
      const wobbleX = r * 0.03 * Math.sin(t * 17 + seed);
      const wobbleY = r * 0.03 * Math.sin(t * 23 + seed * 1.3);

      const length = r * (preset.length[0] + preset.length[1] * power + preset.afterburnerLength * burner) * flick;
      const radius = r * preset.radius * (1 + 0.3 * burner) * (0.92 + 0.08 * flick);
      part.flame.scale.set(radius, radius, length);
      part.flame.position.set(port.position[0] + wobbleX, port.position[1] + wobbleY, port.position[2]);

      if (part.core) {
        const coreRadius = r * preset.coreRadius * (1 + 0.2 * burner);
        part.core.scale.set(coreRadius, coreRadius, length * preset.coreLength);
        part.core.position.set(port.position[0] + wobbleX * 0.5, port.position[1] + wobbleY * 0.5, port.position[2]);
      }

      if (part.smoke) {
        // 연기는 불꽃 뒤에서 시작해 더 넓고 길게 퍼진다.
        const smokeRadius = radius * preset.smokeSpread * (0.95 + 0.1 * Math.sin(t * 7 + seed));
        part.smoke.scale.set(smokeRadius, smokeRadius, length * 2.1 + r * 2);
        part.smoke.position.set(port.position[0] + wobbleX * 1.6, port.position[1] + wobbleY * 1.6 + r * 0.06, port.position[2] + length * 0.55);
      }

      const discScale = r * 0.95 * (0.96 + 0.04 * flick);
      part.disc.scale.set(discScale, discScale, 1);

      part.rings.forEach((ring, k) => {
        if (!ring) return;
        ring.visible = burner > 0;
        if (!ring.visible) return;
        const spacing = r * (1.8 + k * 1.6) * (0.7 + 0.3 * burner) + r * 0.15 * Math.sin(t * 9 + k + seed);
        const ringScale = r * 0.5 * (1 + 0.08 * Math.sin(t * 29 + k * 2 + seed));
        ring.position.set(port.position[0], port.position[1], port.position[2] + spacing);
        ring.scale.set(ringScale, ringScale, 1);
      });
    });
  });

  /* geometry 와 material 은 이 컴포넌트가 직접 해제하므로 mesh 는 dispose={null} 로 둔다.
   * 이 group 은 매 프레임 위치, 크기, 불투명도가 바뀌므로 부모의 정적 병합에서 뺀다. */
  return <group ref={group} visible={false} userData={{ dynamic: true }}>
    {ports.map((port, index) => {
      const part = partAt(index);
      const nozzle = port.position;
      return <group key={index}>
        <mesh ref={(mesh) => { part.smoke = mesh; }} geometry={geometries.cone} material={materials.smoke} position={nozzle} renderOrder={-1} dispose={null} />
        <mesh ref={(mesh) => { part.flame = mesh; }} geometry={geometries.cone} material={materials.flame} position={nozzle} dispose={null} />
        {materials.core && <mesh ref={(mesh) => { part.core = mesh; }} geometry={geometries.cone} material={materials.core} position={nozzle} dispose={null} />}
        <mesh ref={(mesh) => { part.disc = mesh; }} geometry={geometries.disc} material={materials.disc} position={[nozzle[0], nozzle[1], nozzle[2] + 0.01]} dispose={null} />
        {port.afterburner && materials.ring && Array.from({ length: preset.rings }, (_, k) => (
          <mesh key={k} ref={(mesh) => { part.rings[k] = mesh; }} geometry={geometries.ring} material={materials.ring} position={nozzle} visible={false} dispose={null} />
        ))}
      </group>;
    })}
  </group>;
}
