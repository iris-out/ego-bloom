import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Html, KeyboardControls, useKeyboardControls, Stars } from '@react-three/drei';
import { ChevronLeft, Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { formatNumber } from '../utils/tierCalculator';
import JoystickControls from '../components/JoystickControls';

// ─── 시간대 감지 ──────────────────────────────────────────────────────────

function getKSTTimeOfDay() {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  const h = kst.getHours();
  if (h >= 21 || h < 6)  return 'night';
  if (h < 8)             return 'dawn';
  if (h < 17)            return 'day';
  return 'sunset';
}

// ─── 시간대별 설정 ────────────────────────────────────────────────────────

const SKY_PARAMS = {
  night:  { sunPosition: [0, -1, 0],       turbidity: 0.1,  rayleigh: 0.001, mieCoefficient: 0.001,  mieDirectionalG: 0.7 },
  dawn:   { sunPosition: [-200, 28, 120],  turbidity: 6,  rayleigh: 4,   mieCoefficient: 0.06,   mieDirectionalG: 0.9 },
  day:    { sunPosition: [120, 140, -180], turbidity: 10, rayleigh: 2,   mieCoefficient: 0.005,  mieDirectionalG: 0.8 },
  sunset: { sunPosition: [180, 20, -100],  turbidity: 6,  rayleigh: 4.5, mieCoefficient: 0.08,   mieDirectionalG: 0.85 },
};
const LIGHT_PARAMS = {
  night:  { ambient: 0.15, di: 0.65, dc: '#4A5B96', dp: [80, 200, -60] },
  dawn:   { ambient: 0.14,  di: 2.0,  dc: '#FF7010', dp: [-260, 16, 160] },
  day:    { ambient: 0.45,  di: 2.4,  dc: '#FFFEF0', dp: [160, 230, -260] },
  sunset: { ambient: 0.09,  di: 2.1,  dc: '#FF2200', dp: [250, 8, -50] },
};

// ─── 셰이더 정의 ──────────────────────────────────────────────────────────

// ─── 빌딩 셰이더 4종 ─────────────────────────────────────────────────────

const BLDG_VERT = `
  varying vec2 vUv;
  varying vec3 vInstanceColor;
  void main() {
    vUv = uv;
    vInstanceColor = instanceColor;
    gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// Type 0: 아파트형 — Bronze / Silver
const BLDG_FRAG_T0 = `
  varying vec2 vUv; varying vec3 vInstanceColor;
  uniform bool uIsNight; uniform vec3 uEmissiveColor; uniform float uTime;
  float rand(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
  void main() {
    vec3 wall  = uIsNight ? vec3(0.04,0.04,0.05) : vec3(0.82,0.80,0.78);
    float flY  = fract(vUv.y * 14.0);
    float slab = step(0.88, flY);
    vec3 slabC = uIsNight ? vec3(0.02,0.02,0.025) : vec3(0.58,0.56,0.54);
    float wx   = fract(vUv.x * 6.0);
    float isWin= step(0.15,wx)*step(wx,0.85)*step(0.15,flY)*step(flY,0.82)
                *step(0.02,vUv.y)*step(vUv.y,0.93);
    float top  = smoothstep(0.87,0.93,vUv.y);
    float pulse= uIsNight ? (2.1+sin(uTime*1.6)*0.4) : 1.0;
    vec3 color = mix(mix(wall,slabC,slab), vInstanceColor*pulse, top);
    if (isWin > 0.5) {
      if (uIsNight) {
        float r = rand(vec2(floor(vUv.x*6.0),floor(vUv.y*14.0))+vInstanceColor.rg);
        color = r > 0.38 ? mix(uEmissiveColor,vec3(1.0,0.92,0.72),r*0.5)*2.1 : vec3(0.005,0.005,0.008);
      } else { color = mix(color,vec3(0.62,0.74,0.88),0.65); }
    }
    gl_FragColor = vec4(color,1.0);
  }
`;

// Type 1: 오피스/커튼월 — Gold / Platinum
const BLDG_FRAG_T1 = `
  varying vec2 vUv; varying vec3 vInstanceColor;
  uniform bool uIsNight; uniform vec3 uEmissiveColor; uniform float uTime;
  float rand(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
  void main() {
    vec3 glass   = uIsNight ? vec3(0.006,0.014,0.030) : vec3(0.17,0.26,0.44);
    float px     = fract(vUv.x*8.0); float py = fract(vUv.y*24.0);
    float isFr   = max(step(0.88,px), max(step(0.88,py), max(step(0.93,vUv.x),step(vUv.x,0.07))));
    vec3 frC     = uIsNight ? vec3(0.055,0.055,0.070) : vec3(0.30,0.30,0.35);
    float top    = smoothstep(0.87,0.93,vUv.y);
    float pulse  = uIsNight ? (2.3+sin(uTime*1.9)*0.5) : 1.0;
    vec3 color   = mix(glass,frC,isFr);
    color = mix(color,vInstanceColor*pulse,top);
    if (!uIsNight && isFr < 0.5) {
      float refl = smoothstep(0.0,0.5,vUv.x)-smoothstep(0.5,1.0,vUv.x);
      color += vec3(0.04,0.07,0.11)*refl;
    }
    if (uIsNight && isFr<0.5 && top<0.1 && vUv.y>0.02) {
      float r = rand(vec2(floor(vUv.x*8.0),floor(vUv.y*24.0))+vInstanceColor.rg*0.5);
      if (r>0.42) color = mix(vec3(0.04,0.10,0.28),vec3(0.18,0.38,0.92),r*0.4)*2.6;
    }
    gl_FragColor = vec4(color,1.0);
  }
`;

// Type 2: 마천루/미러글라스 — Diamond
const BLDG_FRAG_T2 = `
  varying vec2 vUv; varying vec3 vInstanceColor;
  uniform bool uIsNight; uniform vec3 uEmissiveColor; uniform float uTime;
  float rand(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
  void main() {
    vec3 base  = uIsNight ? vec3(0.008,0.010,0.018) : vec3(0.09,0.11,0.18);
    float gx   = fract(vUv.x*10.0); float gy = fract(vUv.y*32.0);
    float isFr = max(step(0.92,gx),step(0.92,gy));
    vec3 frC   = uIsNight ? vec3(0.04,0.04,0.06) : vec3(0.22,0.24,0.30);
    float top  = smoothstep(0.84,0.92,vUv.y);
    float eg   = max(smoothstep(0.87,1.0,vUv.x),smoothstep(0.87,1.0,1.0-vUv.x));
    float pulse= uIsNight ? (2.6+sin(uTime*2.1)*0.6) : 1.2;
    vec3 color = mix(base,frC,isFr);
    color = mix(color,vInstanceColor*pulse,max(top,eg*0.6));
    if (!uIsNight && isFr<0.5) { float s=smoothstep(0.2,0.85,vUv.y); color=mix(color,vec3(0.30,0.40,0.60),s*0.55); }
    if (uIsNight && isFr<0.5 && top<0.1 && eg<0.1 && vUv.y>0.02) {
      float r = rand(vec2(floor(vUv.x*10.0),floor(vUv.y*32.0))+vInstanceColor.gb);
      if (r>0.52) color = mix(color,vec3(0.08,0.18,0.80),r*0.55)*3.2;
    }
    gl_FragColor = vec4(color,1.0);
  }
`;

// Type 3: 랜드마크/발광 — Master / Champion
const BLDG_FRAG_T3 = `
  varying vec2 vUv; varying vec3 vInstanceColor;
  uniform bool uIsNight; uniform vec3 uEmissiveColor; uniform float uTime;
  float rand(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
  void main() {
    vec3 base  = uIsNight ? vec3(0.005,0.005,0.010) : vec3(0.07,0.07,0.11);
    float px   = fract(vUv.x*4.0);
    float isEd = max(smoothstep(0.86,1.0,px),smoothstep(0.86,1.0,1.0-px));
    float ring = step(0.94,fract(vUv.y*6.0));
    float wx   = fract(vUv.x*8.0); float wy = fract(vUv.y*50.0);
    float isWin= step(0.22,wx)*step(wx,0.78)*step(0.28,wy)*step(wy,0.84)
                *step(0.02,vUv.y)*step(vUv.y,0.95);
    float top  = smoothstep(0.90,0.98,vUv.y);
    float pulse= uIsNight ? (3.2+sin(uTime*2.6)*0.9) : 1.6;
    vec3 color = base + vInstanceColor*isEd*pulse*0.85 + vInstanceColor*ring*pulse*0.45;
    color = mix(color,vInstanceColor*pulse*1.6,top);
    if (isWin>0.5) {
      if (uIsNight) {
        float r = rand(vec2(floor(vUv.x*8.0),floor(vUv.y*50.0))+vInstanceColor.rg);
        if (r>0.28) color = mix(uEmissiveColor,vInstanceColor,r)*3.8;
      } else { color = vec3(0.55,0.72,0.96); }
    }
    gl_FragColor = vec4(color,1.0);
  }
`;

const GroundShaderMaterial = {
  uniforms: {
    uIsNight: { value: false }, uGridSize: { value: 24.0 }, uRoadInterval: { value: 4.0 },
    uLamps: { value: [] }
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPosition;
    uniform bool uIsNight; uniform float uGridSize; uniform float uRoadInterval;
    uniform vec3 uLamps[30];
    void main() {
      float ax = vWorldPosition.x, az = vWorldPosition.z;
      float gx = ax / uGridSize, gz = az / uGridSize;
      bool isRoadX = abs(mod(round(gx), uRoadInterval)) < 0.1;
      bool isRoadZ = abs(mod(round(gz), uRoadInterval)) < 0.1;
      vec3 color = uIsNight ? vec3(0.003, 0.003, 0.005) : vec3(0.65, 0.65, 0.68);
      if (isRoadX || isRoadZ) {
        color = uIsNight ? vec3(0.002,0.002,0.003) : vec3(0.35,0.35,0.40);
        float dx = abs(ax - round(gx)*uGridSize), dz = abs(az - round(gz)*uGridSize);
        if ((isRoadX&&dx<0.15)||(isRoadZ&&dz<0.15)) color = uIsNight ? vec3(0.1,0.05,0.01) : vec3(0.8,0.6,0.1);
        float fx = step(0.5,fract(az*0.2)), fz = step(0.5,fract(ax*0.2));
        vec3 laneColor = uIsNight ? vec3(0.05) : vec3(0.7);
        if (isRoadX&&abs(dx-1.5)<0.05&&fx>0.5) color=laneColor;
        if (isRoadX&&abs(dx+1.5)<0.05&&fx>0.5) color=laneColor;
        if (isRoadZ&&abs(dz-1.5)<0.05&&fz>0.5) color=laneColor;
        if (isRoadZ&&abs(dz+1.5)<0.05&&fz>0.5) color=laneColor;
      }
      if (uIsNight) {
        for(int i=0; i<30; i++) {
          float d = distance(vWorldPosition, uLamps[i]);
          if (d < 50.0) {
            float intensity = pow(1.0 - (d / 50.0), 2.5);
            color += vec3(0.9, 0.7, 0.3) * intensity * 0.45;
          }
        }
      }
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const OceanShaderMaterial = {
  uniforms: { uTime: { value: 0 }, uIsNight: { value: false } },
  vertexShader: `
    uniform float uTime;
    varying float vWave;
    varying vec2 vXZ;
    void main() {
      vec3 pos = position;
      float w = sin(pos.x*0.040 + uTime*0.80)*0.90
              + sin(pos.z*0.030 + uTime*1.10)*0.60
              + sin((pos.x+pos.z)*0.025 + uTime*0.60)*0.38
              + sin(pos.x*0.090 - uTime*1.40)*0.22
              + sin(pos.z*0.070 + uTime*0.95)*0.17
              + sin((pos.x*0.6-pos.z*0.8)*0.04 + uTime*0.7)*0.12;
      pos.y += w;
      vWave = w;
      vXZ = vec2(pos.x, pos.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
    }
  `,
  fragmentShader: `
    uniform bool uIsNight; varying float vWave; varying vec2 vXZ;
    float rand(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
    void main() {
      vec3 deep    = uIsNight ? vec3(0.006,0.022,0.11) : vec3(0.00,0.14,0.40);
      vec3 shallow = uIsNight ? vec3(0.018,0.065,0.21) : vec3(0.04,0.32,0.60);
      vec3 foam    = uIsNight ? vec3(0.55,0.70,0.88)  : vec3(0.80,0.92,1.00);
      float n = (vWave + 2.4) / 4.8;
      vec3 color = mix(deep, shallow, clamp(n,0.0,1.0));
      float noise = rand(vXZ * 0.018 + vWave * 0.09);
      float foamAmt = step(0.86, n) * (0.55 + noise * 0.45);
      color = mix(color, foam, foamAmt);
      color += vec3(step(0.93, n) * noise) * (uIsNight ? 0.35 : 0.75);
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

// ─── 유틸리티 ─────────────────────────────────────────────────────────────

function seededRand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

function VoxelClouds({ weather }) {
  const isCloudy = weather === 'cloudy' || weather === 'rain' || weather === 'snow';
  const count = isCloudy ? 80 : 60;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clouds = useMemo(() => Array.from({ length: count }).map((_, i) => ({
    x: (seededRand(i*3.1) - 0.5) * 2000,
    y: isCloudy ? 60 + seededRand(i*5.7) * 40 : 150 + seededRand(i*7.3) * 50,
    z: (seededRand(i*4.2) - 0.5) * 2000,
    w: isCloudy ? 25 + seededRand(i*2.9) * 30 : 15 + seededRand(i*6.1) * 20,
    h: isCloudy ? 10 + seededRand(i*8.3) * 10 : 5 + seededRand(i*9.2) * 7,
    d: isCloudy ? 25 + seededRand(i*1.5) * 30 : 15 + seededRand(i*3.8) * 20,
    speed: 0.4 + seededRand(i*11.7) * 1.2,
  })), [isCloudy]);

  useFrame((_, delta) => {
    clouds.forEach((c, i) => {
      c.x += c.speed * delta * 4;
      if (c.x > 1000) c.x = -1000;
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.set(c.w, c.h, c.d);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const cloudColor = isCloudy ? '#888' : '#fff';
  const cloudOpacity = isCloudy ? 0.7 : 0.35;

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial color={cloudColor} transparent opacity={cloudOpacity} />
    </instancedMesh>
  );
}

// ─── 비/눈 파티클 ─────────────────────────────────────────────────────────

function RainParticles() {
  const COUNT = 2000;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: COUNT }).map((_, i) => ({
    x: (seededRand(i * 3.1) - 0.5) * 500,
    y: seededRand(i * 7.3) * 180,
    z: (seededRand(i * 5.7) - 0.5) * 500,
    speed: 55 + seededRand(i * 11.9) * 45,
  })), []);

  useFrame((_, delta) => {
    particles.forEach((p, i) => {
      p.y -= p.speed * delta;
      if (p.y < -2) {
        p.y = 180 + Math.random() * 30;
        p.x = (Math.random() - 0.5) * 500;
        p.z = (Math.random() - 0.5) * 500;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(0.06, 1.8, 0.06);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, COUNT]} frustumCulled={false}>
      <cylinderGeometry args={[0.03, 0.03, 1.8, 4]} />
      <meshBasicMaterial color="#AACCFF" transparent opacity={0.55} />
    </instancedMesh>
  );
}

function SnowParticles() {
  const COUNT = 1200;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: COUNT }).map((_, i) => ({
    x: (seededRand(i * 3.7) - 0.5) * 500,
    y: seededRand(i * 8.1) * 180,
    z: (seededRand(i * 5.2) - 0.5) * 500,
    speed: 7 + seededRand(i * 13.1) * 10,
    drift: (seededRand(i * 2.9) - 0.5) * 4,
    driftZ: (seededRand(i * 4.3) - 0.5) * 4,
    phase: seededRand(i * 6.7) * Math.PI * 2,
  })), []);

  useFrame((state, delta) => {
    particles.forEach((p, i) => {
      p.y -= p.speed * delta;
      p.x += Math.sin(state.clock.elapsedTime * 0.4 + p.phase) * p.drift * delta;
      p.z += Math.cos(state.clock.elapsedTime * 0.35 + p.phase) * p.driftZ * delta;
      if (p.y < -2) {
        p.y = 180 + Math.random() * 30;
        p.x = (Math.random() - 0.5) * 500;
        p.z = (Math.random() - 0.5) * 500;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(0.5, 0.5, 0.5);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.3, 4, 4]} />
      <meshBasicMaterial color="#EEF5FF" transparent opacity={0.85} />
    </instancedMesh>
  );
}

// ─── 달/태양 오브젝트 ─────────────────────────────────────────────────────

function Moon() {
  return (
    <group position={[1800, 3400, -4800]} scale={[25, 25, 25]}>
      <mesh>
        <sphereGeometry args={[13, 24, 24]} />
        <meshBasicMaterial color="#FFFDE8" />
      </mesh>
      {/* 달 크레이터 느낌 어두운 원 */}
      <mesh position={[3, 4, 12.5]}>
        <circleGeometry args={[2.5, 12]} />
        <meshBasicMaterial color="#E8E0C0" />
      </mesh>
      <mesh position={[-4, -2, 12.5]}>
        <circleGeometry args={[1.8, 12]} />
        <meshBasicMaterial color="#E0D8B8" />
      </mesh>
      {/* 글로우 후광 */}
      <mesh>
        <sphereGeometry args={[18, 16, 16]} />
        <meshBasicMaterial color="#FFFCE0" transparent opacity={0.07} />
      </mesh>
    </group>
  );
}

function Sun({ timeOfDay }) {
  const configs = {
    day:    { pos: [2400, 2800, -3600], color: '#FFFFFF', glowColor: '#FFF0C0', glowSize: 18 },
    dawn:   { pos: [-4000, 700, 2400],  color: '#FFEAA0', glowColor: '#FFA050', glowSize: 22 },
    sunset: { pos: [3600, 600, -2000],  color: '#FFD080', glowColor: '#FF5010', glowSize: 28 },
  };
  const cfg = configs[timeOfDay];
  if (!cfg) return null;
  return (
    <group position={cfg.pos} scale={[28, 28, 28]}>
      <mesh>
        <sphereGeometry args={[9, 32, 32]} />
        <meshBasicMaterial color={cfg.color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[12, 32, 32]} />
        <meshBasicMaterial color={cfg.color} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[cfg.glowSize * 0.7, 32, 32]} />
        <meshBasicMaterial color={cfg.glowColor} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[cfg.glowSize, 32, 32]} />
        <meshBasicMaterial color={cfg.glowColor} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[cfg.glowSize * 1.5, 32, 32]} />
        <meshBasicMaterial color={cfg.glowColor} transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── 가로수 (자연 클러스터 분포) ─────────────────────────────────────────

function ParkTrees({ timeOfDay }) {
  const isNight = timeOfDay === 'night';
  const treeData = useMemo(() => {
    const trees = [];
    const ROAD = 40;
    const RIV_MIN = 107, RIV_MAX = 213;
    for (let ci = 0; ci < 240; ci++) {
      const cx = (seededRand(ci * 7.313) - 0.5) * 860;
      const cz = (seededRand(ci * 5.179) - 0.5) * 860;
      if (cz > RIV_MIN && cz < RIV_MAX) continue;
      if (Math.abs(cx) > 500 || Math.abs(cz) > 500) continue;
      const rdx = ((cx % ROAD) + ROAD) % ROAD;
      const rdz = ((cz % ROAD) + ROAD) % ROAD;
      if ((rdx < 5 || rdx > ROAD - 5) && (rdz < 5 || rdz > ROAD - 5)) continue;
      const sz = 1 + Math.floor(seededRand(ci * 4.73) * 6);
      for (let ti = 0; ti < sz; ti++) {
        const angle  = seededRand(ci * 11.3 + ti * 2.17) * Math.PI * 2;
        const radius = seededRand(ci * 9.71 + ti * 3.59) * 10;
        const tx = cx + Math.cos(angle) * radius;
        const tz = cz + Math.sin(angle) * radius;
        if (tz > RIV_MIN && tz < RIV_MAX) continue;
        if (Math.abs(tx) > 500 || Math.abs(tz) > 500) continue;
        trees.push({
          x: tx, z: tz,
          scale:    0.55 + seededRand(ci * 13.1 + ti * 6.87) * 1.35,
          rotation: seededRand(ci * 17.9 + ti * 8.31) * Math.PI * 2,
        });
      }
    }
    return trees;
  }, []);

  const trunkRef  = useRef();
  const leavesRef = useRef();
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const count     = treeData.length;

  useEffect(() => {
    if (!trunkRef.current || !leavesRef.current || count === 0) return;
    treeData.forEach((t, i) => {
      dummy.rotation.set(0, t.rotation, 0);
      dummy.position.set(t.x, 1.0 * t.scale, t.z);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.updateMatrix();
      trunkRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, 2.9 * t.scale, t.z);
      dummy.updateMatrix();
      leavesRef.current.setMatrixAt(i, dummy.matrix);
    });
    trunkRef.current.instanceMatrix.needsUpdate  = true;
    leavesRef.current.instanceMatrix.needsUpdate = true;
  }, [treeData, dummy, count]);

  const trunkColor  = isNight ? '#2E1B0C' : '#5A3015';
  const leavesColor = isNight ? '#071507' : '#28692A';

  return (
    <>
      <instancedMesh ref={trunkRef}  args={[null, null, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.14, 0.22, 2.0, 7]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={leavesRef} args={[null, null, count]} frustumCulled={false}>
        <sphereGeometry args={[0.95, 7, 6]} />
        <meshStandardMaterial color={leavesColor} roughness={0.85} />
      </instancedMesh>
    </>
  );
}

function StreetLamps({ positions, timeOfDay }) {
  const isNight = timeOfDay === 'night';
  const count = positions.length;
  const poleRef = useRef();
  const bulbRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!poleRef.current || !bulbRef.current) return;
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 3.5, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleRef.current.setMatrixAt(i, dummy.matrix);
      
      dummy.position.set(p.x, 7.5, p.z);
      dummy.updateMatrix();
      bulbRef.current.setMatrixAt(i, dummy.matrix);
    });
    poleRef.current.instanceMatrix.needsUpdate = true;
    bulbRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, dummy]);

  const poleColor = isNight ? '#111' : '#666';
  const bulbColor = isNight ? '#FFF0B0' : '#888';
  const emissive = isNight ? '#FFC040' : '#000000';

  return (
    <>
      <instancedMesh ref={poleRef} args={[null, null, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.2, 0.3, 7]} />
        <meshStandardMaterial color={poleColor} roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={bulbRef} args={[null, null, count]} frustumCulled={false}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color={bulbColor} emissive={emissive} emissiveIntensity={isNight ? 2.5 : 0} />
      </instancedMesh>
    </>
  );
}


// ─── 산지 ────────────────────────────────────────────────────────────────

function Mountains({ timeOfDay }) {
  const isNight = timeOfDay === 'night';
  const peaks = useMemo(() => Array.from({length:28},(_,i)=>({
    x:  (seededRand(i*7.31)-0.5)*900,
    z:  -340 - seededRand(i*5.19)*360,
    h:  55 + seededRand(i*11.7)*110,
    r:  28 + seededRand(i*3.87)*40,
    seg: 6 + (i%3),
    snow: seededRand(i*11.7)*110 > 85,
  })), []);

  const rockC  = isNight ? '#1a1820' : '#5a5360';
  const snowC  = isNight ? '#b0b8c8' : '#eef2ff';
  const baseC  = isNight ? '#130f18' : '#48443e';

  return (
    <group>
      {peaks.map((p,i)=>(
        <group key={i} position={[p.x,0,p.z]}>
          {/* 산기슭 넓은 원뿔 */}
          <mesh position={[0,p.h*0.28,0]} castShadow>
            <coneGeometry args={[p.r*1.35, p.h*0.56, p.seg]} />
            <meshStandardMaterial color={baseC} roughness={0.97} />
          </mesh>
          {/* 산 몸체 */}
          <mesh position={[0,p.h*0.5,0]} castShadow>
            <coneGeometry args={[p.r, p.h, p.seg]} />
            <meshStandardMaterial color={rockC} roughness={0.95} />
          </mesh>
          {/* 눈 덮인 꼭대기 */}
          {p.snow && (
            <mesh position={[0,p.h*0.74,0]}>
              <coneGeometry args={[p.r*0.28, p.h*0.30, p.seg]} />
              <meshStandardMaterial color={snowC} roughness={0.45} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── 숲 지대 ─────────────────────────────────────────────────────────────

function ForestZone({ timeOfDay }) {
  const isNight = timeOfDay === 'night';
  const trees = useMemo(() => {
    const arr = [];
    for (let i=0; i<300; i++) {
      const x = (seededRand(i*6.13)-0.5)*720;
      const z = 290 + seededRand(i*4.77)*340;
      const sc= 0.7 + seededRand(i*9.21)*2.0;
      const ro= seededRand(i*15.3)*Math.PI*2;
      arr.push({x,z,sc,ro});
    }
    return arr;
  }, []);

  const trunkRef  = useRef();
  const leavesRef = useRef();
  const dummy = useMemo(()=>new THREE.Object3D(),[]);

  useEffect(()=>{
    if (!trunkRef.current||!leavesRef.current) return;
    trees.forEach((t,i)=>{
      dummy.position.set(t.x, 1.6*t.sc, t.z);
      dummy.scale.set(t.sc*0.35, t.sc*1.1, t.sc*0.35);
      dummy.rotation.set(0,t.ro,0); dummy.updateMatrix();
      trunkRef.current.setMatrixAt(i,dummy.matrix);
      dummy.position.set(t.x, 3.8*t.sc, t.z);
      dummy.scale.set(t.sc, t.sc*1.7, t.sc);
      dummy.updateMatrix();
      leavesRef.current.setMatrixAt(i,dummy.matrix);
    });
    trunkRef.current.instanceMatrix.needsUpdate  = true;
    leavesRef.current.instanceMatrix.needsUpdate = true;
  },[trees,dummy]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[null,null,trees.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.18,0.28,3,6]} />
        <meshStandardMaterial color={isNight?'#1a0d06':'#4a2810'} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={leavesRef} args={[null,null,trees.length]} frustumCulled={false}>
        <coneGeometry args={[1.2,3.2,7]} />
        <meshStandardMaterial color={isNight?'#041204':'#1a5218'} roughness={0.80} />
      </instancedMesh>
    </>
  );
}

// ─── 공원 지대 ────────────────────────────────────────────────────────────

function ParkZone({ timeOfDay }) {
  const isNight = timeOfDay === 'night';
  const PX=-310, PZ=-20, PW=160, PD=180;
  const grassC   = isNight ? '#0d1f0c' : '#3a7a32';
  const pathC    = isNight ? '#222028' : '#c8b898';
  const benchC   = isNight ? '#2a1808' : '#7a4820';
  const fountainC= isNight ? '#0a1828' : '#3070a8';

  const benches = useMemo(()=>Array.from({length:6},(_,i)=>({
    x: PX+(seededRand(i*5.3)-0.5)*PW*0.7,
    z: PZ+(seededRand(i*7.9)-0.5)*PD*0.7,
    rot: seededRand(i*3.1)*Math.PI*2,
  })),[]);

  return (
    <group>
      {/* 잔디 */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[PX,0.02,PZ]}>
        <planeGeometry args={[PW,PD]} />
        <meshStandardMaterial color={grassC} roughness={0.95} />
      </mesh>
      {/* 산책로 십자형 */}
      <mesh position={[PX,0.03,PZ]}><boxGeometry args={[PW,0.04,6]} /><meshStandardMaterial color={pathC} roughness={0.85} /></mesh>
      <mesh position={[PX,0.03,PZ]}><boxGeometry args={[6,0.04,PD]} /><meshStandardMaterial color={pathC} roughness={0.85} /></mesh>
      {/* 분수 */}
      <group position={[PX,0,PZ]}>
        <mesh position={[0,0.5,0]}><cylinderGeometry args={[5.5,6,1,12]} /><meshStandardMaterial color={isNight?'#181820':'#888'} roughness={0.7} /></mesh>
        <mesh position={[0,0.93,0]}><cylinderGeometry args={[5,5,0.06,12]} /><meshStandardMaterial color={fountainC} transparent opacity={0.7} roughness={0.2} /></mesh>
        <mesh position={[0,1.9,0]}><cylinderGeometry args={[0.3,0.4,2.5,8]} /><meshStandardMaterial color={isNight?'#202028':'#aaa'} roughness={0.6} /></mesh>
        {isNight && <mesh position={[0,3.6,0]}><cylinderGeometry args={[0.12,0.75,3.6,8]} /><meshStandardMaterial color={fountainC} transparent opacity={0.3} /></mesh>}
      </group>
      {/* 벤치 */}
      {benches.map((b,i)=>(
        <group key={i} position={[b.x,0,b.z]} rotation={[0,b.rot,0]}>
          <mesh position={[0,0.5,0]}><boxGeometry args={[2,0.12,0.7]} /><meshStandardMaterial color={benchC} roughness={0.9} /></mesh>
          <mesh position={[0,0.85,-0.28]}><boxGeometry args={[2,0.55,0.1]} /><meshStandardMaterial color={benchC} roughness={0.9} /></mesh>
          {[-0.8,0.8].map(dx=>(
            <mesh key={dx} position={[dx,0.25,0]}><boxGeometry args={[0.1,0.5,0.65]} /><meshStandardMaterial color={isNight?'#111':'#555'} roughness={0.7} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── 새 무리 ──────────────────────────────────────────────────────────────

function Birds({ timeOfDay }) {
  const visible = timeOfDay !== 'night';
  const COUNT = 35;
  const meshRef = useRef();
  const dummy   = useMemo(()=>new THREE.Object3D(),[]);
  const flock   = useMemo(()=>Array.from({length:COUNT},(_,i)=>({
    orbitR: 60  + seededRand(i*7.11)*120,
    orbitY: 50  + seededRand(i*5.37)*100,
    cx:     (seededRand(i*3.21)-0.5)*400,
    cz:     (seededRand(i*9.83)-0.5)*400,
    speed:  0.08+ seededRand(i*4.73)*0.18,
    phase:  seededRand(i*6.17)*Math.PI*2,
    tilt:   (seededRand(i*2.59)-0.5)*0.4,
    wing:   seededRand(i*11.3)*Math.PI*2,
  })),[]);

  useFrame(state=>{
    if (!meshRef.current||!visible) return;
    const t=state.clock.elapsedTime;
    flock.forEach((b,i)=>{
      const a=t*b.speed+b.phase;
      const flap=Math.sin(t*5+b.wing)*0.3;
      dummy.position.set(b.cx+Math.cos(a)*b.orbitR, b.orbitY+Math.sin(t*0.3+b.phase)*8, b.cz+Math.sin(a)*b.orbitR);
      dummy.rotation.set(b.tilt+flap*0.1, -a+Math.PI/2, flap);
      dummy.scale.set(1.5,0.4,3.0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i,dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate=true;
  });

  if (!visible) return null;
  return (
    <instancedMesh ref={meshRef} args={[null,null,COUNT]} frustumCulled={false}>
      <coneGeometry args={[0.5,2,4]} />
      <meshStandardMaterial color="#e8e4de" roughness={0.8} />
    </instancedMesh>
  );
}

// ─── 강변 웨이브 지오메트리 ────────────────────────────────────────────────

function makeWavyStripGeo(length, width, segs, waveAmp, seed) {
  const verts = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const x = (i / segs - 0.5) * length;
    verts.push(x, 0, 0);
    const w = Math.sin(x * 0.022 + seed) * waveAmp
            + Math.sin(x * 0.057 + seed * 1.91) * waveAmp * 0.44
            + (seededRand(i * 5.3 + Math.round(seed * 100)) - 0.5) * waveAmp * 0.38;
    verts.push(x, 0, width + w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i*2, b = i*2+1, c = (i+1)*2, d = (i+1)*2+1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function RiverBanks() {
  const grassColor = '#3D5C32';
  const stoneColor = '#747474';
  const nStoneGeo = useMemo(() => makeWavyStripGeo(1800, 5, 160, 1.9, 1.37), []);
  const nGrassGeo = useMemo(() => makeWavyStripGeo(1800, 9, 160, 2.6, 2.71), []);
  const sStoneGeo = useMemo(() => makeWavyStripGeo(1800, 5, 160, 1.9, 3.14), []);
  const sGrassGeo = useMemo(() => makeWavyStripGeo(1800, 9, 160, 2.6, 4.23), []);
  return (
    <group>
      {/* 북쪽 강변 */}
      <mesh geometry={nStoneGeo} position={[0, 0.04, 120]} rotation={[-Math.PI/2, 0, Math.PI]}>
        <meshStandardMaterial color={stoneColor} roughness={0.92} />
      </mesh>
      <mesh geometry={nGrassGeo} position={[0, 0.03, 114]} rotation={[-Math.PI/2, 0, Math.PI]}>
        <meshStandardMaterial color={grassColor} roughness={0.95} />
      </mesh>
      {/* 남쪽 강변 */}
      <mesh geometry={sStoneGeo} position={[0, 0.04, 200]} rotation={[-Math.PI/2, 0, 0]}>
        <meshStandardMaterial color={stoneColor} roughness={0.92} />
      </mesh>
      <mesh geometry={sGrassGeo} position={[0, 0.03, 206]} rotation={[-Math.PI/2, 0, 0]}>
        <meshStandardMaterial color={grassColor} roughness={0.95} />
      </mesh>
    </group>
  );
}

function GoldenGateBridge({ timeOfDay }) {
  const isNight = timeOfDay === 'night';
  const ORANGE = '#C0511A';
  const DECK_Y = 3.5;
  const DECK_LEN = 130;   // z: 95 to 225 (river z=120~200, 20 units extra each side)
  const DECK_W   = 22;
  const TOWER_Z1 = 125;   // near north bank
  const TOWER_Z2 = 195;   // near south bank
  const TOWER_H  = 58;
  const TOWER_TOP_Y = DECK_Y + TOWER_H;
  const LEG_W = 4, LEG_D = 7;
  const SAG_Y = DECK_Y + 14; // cable sag at midspan

  // Hanger positions between the two towers
  const hangers = useMemo(() => {
    const arr = [];
    for (let z = TOWER_Z1 + 7; z < TOWER_Z2; z += 7) {
      const t = (z - TOWER_Z1) / (TOWER_Z2 - TOWER_Z1);
      const cableY = TOWER_TOP_Y - (TOWER_TOP_Y - SAG_Y) * 4 * t * (1 - t);
      arr.push({ z, cableY });
    }
    return arr;
  }, []);

  // Cable segments: anchor → tower1 → midspan → tower2 → anchor
  const cablePoints = [
    { z: 97,      y: DECK_Y + 4 },
    { z: TOWER_Z1, y: TOWER_TOP_Y },
    { z: 160,     y: SAG_Y },
    { z: TOWER_Z2, y: TOWER_TOP_Y },
    { z: 223,     y: DECK_Y + 4 },
  ];

  const CABLE_X = [-DECK_W / 2 + 1.5, DECK_W / 2 - 1.5];

  return (
    <group>
      {/* Deck */}
      <mesh position={[0, DECK_Y, 160]}>
        <boxGeometry args={[DECK_W, 1.4, DECK_LEN]} />
        <meshStandardMaterial color={isNight ? '#404040' : '#787878'} roughness={0.85} />
      </mesh>

      {/* Center lane line */}
      <mesh position={[0, DECK_Y + 0.72, 160]}>
        <boxGeometry args={[0.35, 0.04, DECK_LEN - 6]} />
        <meshStandardMaterial color="#DDDD44" />
      </mesh>

      {/* Side railings */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (DECK_W / 2 - 1), DECK_Y + 2.2, 160]}>
          <boxGeometry args={[0.6, 2.0, DECK_LEN - 6]} />
          <meshStandardMaterial color={ORANGE} roughness={0.7} />
        </mesh>
      ))}

      {/* Tower 1 */}
      {[TOWER_Z1, TOWER_Z2].map((tz, ti) => (
        <group key={ti} position={[0, 0, tz]}>
          {/* Left & right legs */}
          {[-1, 1].map(s => (
            <mesh key={s} position={[s * DECK_W / 4, DECK_Y + TOWER_H / 2, 0]}>
              <boxGeometry args={[LEG_W, TOWER_H, LEG_D]} />
              <meshStandardMaterial color={ORANGE} roughness={0.65} metalness={0.2} />
            </mesh>
          ))}
          {/* Crossbeams */}
          {[0.28, 0.60].map((frac, ci) => (
            <mesh key={ci} position={[0, DECK_Y + TOWER_H * frac, 0]}>
              <boxGeometry args={[DECK_W / 2 + LEG_W, LEG_W * 0.65, LEG_D]} />
              <meshStandardMaterial color={ORANGE} roughness={0.65} />
            </mesh>
          ))}
          {isNight && (
            <pointLight position={[0, DECK_Y + TOWER_H + 3, 0]} color="#FF8833" intensity={1.0} distance={100} />
          )}
        </group>
      ))}

      {/* Suspension cables */}
      {CABLE_X.map((cx, ci) => (
        <group key={ci}>
          {cablePoints.slice(0, -1).map((p, si) => {
            const q = cablePoints[si + 1];
            const midZ = (p.z + q.z) / 2;
            const midY = (p.y + q.y) / 2;
            const dz = q.z - p.z;
            const dy = q.y - p.y;
            const len = Math.sqrt(dz * dz + dy * dy);
            // rotate cylinder (default Y-axis) to align with (dy, dz) direction in Y-Z plane
            const rotX = Math.atan2(dz, dy);
            return (
              <mesh key={si} position={[cx, midY, midZ]} rotation={[rotX, 0, 0]}>
                <cylinderGeometry args={[0.28, 0.28, len, 5]} />
                <meshStandardMaterial color="#7A3510" roughness={0.6} />
              </mesh>
            );
          })}
          {/* Hangers */}
          {hangers.map((h, hi) => {
            const hangerLen = h.cableY - DECK_Y;
            return (
              <mesh key={hi} position={[cx, DECK_Y + hangerLen / 2, h.z]}>
                <cylinderGeometry args={[0.12, 0.12, hangerLen, 4]} />
                <meshStandardMaterial color="#8B4010" roughness={0.6} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function Cars({ timeOfDay }) {
  const isNight = timeOfDay === 'night';

  // Roads at world z = 0, ±192 (GRID_SIZE*ROAD_INTERVAL=192)
  const CAR_DEFS = useMemo(() => {
    const roadZs = [-384, -192, 0, 192, 384];
    const colors = ['#CC3333','#3366CC','#DDAA22','#EEEEEE','#44AA66','#AA44CC','#DD6622'];
    const cars = [];
    roadZs.forEach((rz, ri) => {
      for (let i = 0; i < 6; i++) {
        const dir = seededRand(ri * 31 + i * 17) > 0.5 ? 1 : -1;
        cars.push({
          rz: rz + (dir > 0 ? 3.5 : -3.5), // offset for lane
          startX: (seededRand(ri * 7 + i * 5) * 2 - 1) * 900,
          speed: dir * (55 + seededRand(ri * 13 + i) * 55),
          color: colors[(ri * 6 + i) % colors.length],
        });
      }
    });
    return cars;
  }, []);

  const posRef = useRef(CAR_DEFS.map(c => c.startX));
  const groupRefs = useRef([]);

  useFrame((_, delta) => {
    CAR_DEFS.forEach((car, i) => {
      posRef.current[i] += car.speed * delta;
      if (posRef.current[i] > 1000) posRef.current[i] = -1000;
      if (posRef.current[i] < -1000) posRef.current[i] = 1000;
      if (groupRefs.current[i]) {
        groupRefs.current[i].position.x = posRef.current[i];
      }
    });
  });

  return (
    <>
      {CAR_DEFS.map((car, i) => (
        <group
          key={i}
          ref={el => { groupRefs.current[i] = el; }}
          position={[car.startX, 1.2, car.rz]}
          rotation={[0, car.speed > 0 ? 0 : Math.PI, 0]}
        >
          {/* Body */}
          <mesh>
            <boxGeometry args={[5.5, 1.8, 2.6]} />
            <meshStandardMaterial color={car.color} roughness={0.4} metalness={0.25} />
          </mesh>
          {/* Roof */}
          <mesh position={[0.3, 1.1, 0]}>
            <boxGeometry args={[3.5, 1.2, 2.4]} />
            <meshStandardMaterial color={car.color} roughness={0.4} metalness={0.25} />
          </mesh>
          {/* Windshield (front) */}
          <mesh position={[2.2, 0.9, 0]}>
            <boxGeometry args={[0.1, 1.0, 2.2]} />
            <meshStandardMaterial color="#88CCFF" roughness={0.1} metalness={0.5} transparent opacity={0.7} />
          </mesh>
          {isNight && (
            <pointLight position={[3.0, 0.5, 0]} color="#FFFFAA" intensity={0.7} distance={35} />
          )}
        </group>
      ))}
    </>
  );
}


function River({ timeOfDay }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const isNight = timeOfDay === 'night';
  
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uIsNight.value = isNight;
    }
  }, [isNight]);

  useFrame((_, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
  });

  // 강은 X축으로 길게, Z: 120 ~ 200 (중심 z: 160, 폭: 80)
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 160]}>
      <planeGeometry args={[2000, 80, 100, 10]} />
      <shaderMaterial 
        ref={materialRef} 
        {...OceanShaderMaterial} 
        uniforms={{
          ...OceanShaderMaterial.uniforms,
          uTime: { value: 0 },
          uIsNight: { value: isNight }
        }} 
      />
    </mesh>
  );
}

// ─── 빌딩 ────────────────────────────────────────────────────────────────

function getTierColor(t) {
  if (t==='champion') return '#DC2626';
  if (t==='master')   return '#9333EA';
  if (t==='diamond')  return '#2563EB';
  if (t==='platinum') return '#94A3B8';
  if (t==='gold')     return '#D97706';
  if (t==='silver')   return '#6B7280';
  if (t==='bronze')   return '#92400E';
  return '#444';
}
function getTierWidth(t) {
  if (t==='champion') return 20.0;
  if (t==='master')   return 18.0;
  if (t==='diamond')  return 16.0;
  if (t==='platinum') return 14.0;
  if (t==='gold')     return 13.0;
  if (t==='silver')   return 12.0;
  return 11.0;
}

const HEIGHT_SCALE = 3.17;
function getTierHeightMult(t) {
  if (t==='champion') return 1.35;
  if (t==='master')   return 1.25;
  if (t==='diamond')  return 1.17;
  if (t==='platinum') return 1.10;
  if (t==='gold')     return 1.06;
  if (t==='silver')   return 1.03;
  return 1.0;
}
function getTierGroup(t) {
  if (t==='master' || t==='champion') return 3; // 랜드마크
  if (t==='diamond') return 2;                   // 마천루
  if (t==='gold' || t==='platinum') return 1;    // 오피스
  return 0;                                       // 브론즈/실버: 아파트
}

function Buildings({ data, timeOfDay, cameraDistRef }) {
  const isNight = timeOfDay === 'night';

  const groups = useMemo(() => {
    const g = [[], [], [], []];
    data.forEach(b => { g[getTierGroup((b.tier_name||'').toLowerCase())].push(b); });
    return g;
  }, [data]);

  const mainRefs     = useRef([null, null, null, null]);
  const extraRefs    = useRef([null, null, null, null]);
  const materialRefs = useRef([null, null, null, null]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col   = useMemo(() => new THREE.Color(), []);

  const shaders = useMemo(() => [BLDG_FRAG_T0, BLDG_FRAG_T1, BLDG_FRAG_T2, BLDG_FRAG_T3].map(frag => ({
    vertexShader: BLDG_VERT,
    fragmentShader: frag,
    uniforms: {
      uIsNight:       { value: false },
      uEmissiveColor: { value: new THREE.Color('#FCD34D') },
      uTime:          { value: 0 },
    },
  })), []);

  useEffect(() => {
    materialRefs.current.forEach(m => { if (m?.uniforms) m.uniforms.uIsNight.value = isNight; });
  }, [isNight]);

  useFrame(state => {
    materialRefs.current.forEach(m => { if (m?.uniforms) m.uniforms.uTime.value = state.clock.elapsedTime; });
  });

  useEffect(() => {
    groups.forEach((grpData, gi) => {
      const main  = mainRefs.current[gi];
      const extra = extraRefs.current[gi];
      if (!main || grpData.length === 0) return;
      grpData.forEach((b, i) => {
        const t  = (b.tier_name||'').toLowerCase();
        const sh = b.height * HEIGHT_SCALE * getTierHeightMult(t);
        const w  = getTierWidth(t);
        dummy.position.set(b.x, sh/2, b.z);
        dummy.scale.set(w, sh, w);
        dummy.rotation.set(0,0,0);
        dummy.updateMatrix();
        main.setMatrixAt(i, dummy.matrix);
        col.set(getTierColor(t));
        main.setColorAt(i, col);
        if (extra) {
          if (gi===1) {
            const ph=sh*0.08; dummy.position.set(b.x,sh+ph/2,b.z); dummy.scale.set(w*0.55,ph,w*0.55);
          } else if (gi===2) {
            const ch=sh*0.08; dummy.position.set(b.x,sh+ch/2,b.z); dummy.scale.set(w*0.45,ch,w*0.45);
          } else if (gi===3) {
            const ah=sh*0.10; dummy.position.set(b.x,sh+ah/2,b.z); dummy.scale.set(0.8,ah,0.8);
          }
          dummy.rotation.set(0,0,0); dummy.updateMatrix();
          extra.setMatrixAt(i, dummy.matrix);
          extra.setColorAt(i, col);
        }
      });
      main.instanceMatrix.needsUpdate = true;
      if (main.instanceColor)  main.instanceColor.needsUpdate  = true;
      if (extra) { extra.instanceMatrix.needsUpdate = true; if (extra.instanceColor) extra.instanceColor.needsUpdate = true; }
    });
  }, [groups, dummy, col]);

  const [hovG, setHovG] = useState(null);
  const [hovI, setHovI] = useState(null);

  const FRAGS = [BLDG_FRAG_T0, BLDG_FRAG_T1, BLDG_FRAG_T2, BLDG_FRAG_T3];

  return (
    <>
      {groups.map((grpData, gi) => {
        if (grpData.length === 0) return null;
        return (
          <React.Fragment key={gi}>
            <instancedMesh
              ref={mesh => {
                if (mesh && !mesh.instanceColor)
                  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(grpData.length*3).fill(0.5),3);
                mainRefs.current[gi] = mesh;
              }}
              args={[null,null,grpData.length]} frustumCulled={false}
              onPointerMove={e => { e.stopPropagation(); setHovG(gi); setHovI(e.instanceId); document.body.style.cursor='default'; }}
              onPointerOut={() => { setHovG(null); setHovI(null); document.body.style.cursor='auto'; }}
            >
              <boxGeometry />
              <shaderMaterial ref={el => { materialRefs.current[gi]=el; }} attach="material" {...shaders[gi]} vertexColors />
            </instancedMesh>

            {/* 오피스 — 펜트하우스 박스 */}
            {gi===1 && (
              <instancedMesh ref={mesh=>{ if(mesh&&!mesh.instanceColor) mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(grpData.length*3).fill(0.5),3); extraRefs.current[1]=mesh; }} args={[null,null,grpData.length]} frustumCulled={false}>
                <boxGeometry /><shaderMaterial attach="material" {...shaders[1]} vertexColors />
              </instancedMesh>
            )}
            {/* 마천루 — 콘 지붕 */}
            {gi===2 && (
              <instancedMesh ref={mesh=>{ if(mesh&&!mesh.instanceColor) mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(grpData.length*3).fill(0.5),3); extraRefs.current[2]=mesh; }} args={[null,null,grpData.length]} frustumCulled={false}>
                <coneGeometry args={[1,1,8]} /><meshStandardMaterial color={isNight?'#111118':'#2a2a35'} />
              </instancedMesh>
            )}
            {/* 랜드마크 — 안테나 실린더 */}
            {gi===3 && (
              <instancedMesh ref={mesh=>{ if(mesh&&!mesh.instanceColor) mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(grpData.length*3).fill(0.5),3); extraRefs.current[3]=mesh; }} args={[null,null,grpData.length]} frustumCulled={false}>
                <cylinderGeometry args={[0.5,0.5,1,6]} />
                <meshStandardMaterial color={isNight?'#999':'#bbb'} emissive={isNight?'#9333EA':'#000'} emissiveIntensity={isNight?1.2:0} />
              </instancedMesh>
            )}
          </React.Fragment>
        );
      })}

      {groups.flatMap((grpData, gi) =>
        grpData.map((b, i) => {
          const t  = (b.tier_name||'').toLowerCase();
          const sh = b.height*HEIGHT_SCALE*getTierHeightMult(t);
          const isHov = hovG===gi && hovI===i;
          if (!isHov && !((cameraDistRef?.current??160)<200 && i<50)) return null;
          return (
            <Html key={b.id} position={[b.x,sh+4,b.z]} center style={{pointerEvents:'none'}}>
              <div className={`flex flex-col items-center transition-all duration-200 ${isHov?'scale-110':'scale-100 opacity-70'}`}>
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex flex-col items-center min-w-[60px]">
                  <span className="text-white font-bold text-[10px] whitespace-nowrap">{b.nickname}</span>
                  {isHov && <span className="text-[8px] text-white/50">{formatNumber(b.elo_score)} pt</span>}
                </div>
                <div className="w-0.5 h-3 bg-white/20" />
              </div>
            </Html>
          );
        })
      )}
    </>
  );
}

// ─── 카메라 컨트롤 ────────────────────────────────────────────────────────

function WorldControls({ joystickValues, mobileVertical, acceleration, cameraTargetRef, cameraDistRef }) {
  const { camera, gl } = useThree();
  const [, getKeys] = useKeyboardControls();
  const phi   = useRef(Math.PI / 4);
  const theta = useRef(Math.PI / 4);
  const distance = useRef(200);
  const isMouseDown = useRef(false);
  const target   = useRef(new THREE.Vector3(0, 0, 0));
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const FRICTION = 0.82;

  useEffect(() => {
    const el = gl.domElement;
    const onDown = () => isMouseDown.current = true;
    const onUp   = () => isMouseDown.current = false;
    const onMove = (e) => {
      if (isMouseDown.current) {
        theta.current -= e.movementX * 0.005;
        phi.current   -= e.movementY * 0.005;
        phi.current = Math.max(0.05, Math.min(Math.PI / 2.1, phi.current));
      }
    };
    const onWheel = (e) => {
      distance.current = Math.max(30, Math.min(2000, distance.current + e.deltaY * 0.2));
    };

    let initialTouchDist = null;
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && initialTouchDist !== null) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = initialTouchDist - currentDist;
        distance.current = Math.max(30, Math.min(2000, distance.current + delta * 0.8));
        initialTouchDist = currentDist;
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        initialTouchDist = null;
      }
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const jRotate = joystickValues.current.rotate;
    if (jRotate.x !== 0 || jRotate.y !== 0) {
      theta.current -= jRotate.x * 2.0 * delta * 60;
      phi.current   += jRotate.y * 2.0 * delta * 60;
      phi.current = Math.max(0.05, Math.min(Math.PI / 2.1, phi.current));
    }

    const keys = getKeys();
    const jMove = joystickValues.current.move;
    const inputX = (keys.right?1:0)-(keys.left?1:0)+jMove.x;
    const inputZ = (keys.forward?1:0)-(keys.back?1:0)+jMove.y;
    const inputY = (keys.up?1:0)-(keys.down?1:0)+mobileVertical.current;

    const moveVec = new THREE.Vector3();
    if (inputX || inputZ || inputY) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
      moveVec.addScaledVector(forward, inputZ).addScaledVector(right, inputX);
      moveVec.y += inputY;
      if (moveVec.length() > 0) moveVec.normalize();
    }

    if (moveVec.length() > 0) velocity.current.addScaledVector(moveVec, acceleration * delta);
    velocity.current.multiplyScalar(FRICTION);
    target.current.addScaledVector(velocity.current, delta);
    target.current.y = Math.max(0, target.current.y);

    cameraTargetRef.current.copy(target.current);
    cameraDistRef.current = distance.current;

    camera.position.set(
      target.current.x + distance.current * Math.sin(phi.current) * Math.cos(theta.current),
      target.current.y + distance.current * Math.cos(phi.current),
      target.current.z + distance.current * Math.sin(phi.current) * Math.sin(theta.current)
    );
    camera.lookAt(target.current);
  });

  return null;
}

// ─── 미니맵 ──────────────────────────────────────────────────────────────

function MiniMap({ buildings, cameraTargetRef }) {
  const canvasRef = useRef();
  const SIZE = 150, RANGE = 280;
  const TIER_COLORS = {
    champion:'#DC2626', master:'#9333EA', diamond:'#2563EB',
    platinum:'#94A3B8', gold:'#D97706', silver:'#6B7280', bronze:'#92400E'
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let id;
    function draw() {
      ctx.clearRect(0,0,SIZE,SIZE);
      ctx.fillStyle = 'rgba(5,5,15,0.88)';
      ctx.fillRect(0,0,SIZE,SIZE);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5;
      for (let r = -8; r <= 8; r++) {
        const pw = ((r*40)/RANGE+1)*0.5*SIZE;
        ctx.beginPath(); ctx.moveTo(pw,0); ctx.lineTo(pw,SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,pw); ctx.lineTo(SIZE,pw); ctx.stroke();
      }
      buildings.forEach(b => {
        const px = (b.x/RANGE+1)*0.5*SIZE, pz = (b.z/RANGE+1)*0.5*SIZE;
        if (px<0||px>SIZE||pz<0||pz>SIZE) return;
        ctx.fillStyle = TIER_COLORS[(b.tier_name||'').toLowerCase()]||'#555';
        ctx.fillRect(px-2,pz-2,4,4);
      });
      const t = cameraTargetRef.current;
      const cx = (t.x/RANGE+1)*0.5*SIZE, cz = (t.z/RANGE+1)*0.5*SIZE;
      ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx-7,cz); ctx.lineTo(cx+7,cz); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cz-7); ctx.lineTo(cx,cz+7); ctx.stroke();
      id = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(id);
  }, [buildings, cameraTargetRef]);

  return (
    <div className="absolute top-4 right-4 z-[60] rounded-xl overflow-hidden border border-white/15 shadow-lg">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      <div className="absolute bottom-1 left-0 right-0 text-center text-[8px] text-white/25 tracking-widest pointer-events-none">MINIMAP</div>
    </div>
  );
}

// ─── 조작 힌트 ───────────────────────────────────────────────────────────

function ControlHint() {
  const [opacity, setOpacity] = useState(1);
  useEffect(() => { const t = setTimeout(() => setOpacity(0), 4000); return () => clearTimeout(t); }, []);
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[60] pointer-events-none transition-opacity duration-1000" style={{ opacity }}>
      <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-5 py-2 flex items-center gap-3 text-white/50 text-[10px] tracking-wider whitespace-nowrap">
        <span><span className="text-white/75 font-medium">W/A/S/D</span> 이동</span>
        <span className="text-white/20">|</span>
        <span><span className="text-white/75 font-medium">드래그</span> 회전</span>
        <span className="text-white/20">|</span>
        <span><span className="text-white/75 font-medium">휠</span> 줌</span>
        <span className="text-white/20">|</span>
        <span><span className="text-white/75 font-medium">Space/Ctrl</span> 고도</span>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────

const QUALITY_DPR = { low:[0.5,0.8], medium:[1,1.5], high:[1,2] };
const TIME_LABELS = { day:'낮', sunset:'노을', night:'밤', dawn:'새벽' };
const WEATHER_LABELS = { clear:'맑음', cloudy:'흐림', rain:'비', snow:'눈' };

export default function WorldPage() {
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const LAMP_POSITIONS = useMemo(() => {
    const pos = [];
    const RIV_MIN = 107, RIV_MAX = 213;
    for (let ci = 0; ci < 80; ci++) {
      const cx = (seededRand(ci * 12.3) - 0.5) * 860;
      const cz = (seededRand(ci * 8.7) - 0.5) * 860;
      if (cz > RIV_MIN && cz < RIV_MAX) continue;
      if (Math.abs(cx) > 500 || Math.abs(cz) > 500) continue;
      pos.push(new THREE.Vector3(cx, 0, cz));
      if (pos.length >= 30) break;
    }
    while(pos.length < 30) pos.push(new THREE.Vector3(2000,0,2000));
    return pos;
  }, []);

  const [timeOfDay, setTimeOfDay] = useState('day');
  const [weather,   setWeather]   = useState('clear');
  const [quality,   setQuality]   = useState('medium');
  const [acceleration, setAcceleration] = useState(700);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  const joystickValues  = useRef({ move:{x:0,y:0}, rotate:{x:0,y:0} });
  const mobileVertical  = useRef(0);
  const cameraTargetRef = useRef(new THREE.Vector3(0,0,0));
  const cameraDistRef   = useRef(160);

  useEffect(() => {
    setTimeOfDay(getKSTTimeOfDay());
    fetch('/api/get-world-data').then(r=>r.json()).then(d => {
      if (d.buildings) setBuildings(d.buildings);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const isNight = timeOfDay === 'night';
  const lp = LIGHT_PARAMS[timeOfDay];
  const sp = SKY_PARAMS[timeOfDay];

  const groundMatRef = useRef();
  useEffect(() => {
    if (groundMatRef.current) {
      groundMatRef.current.uniforms.uIsNight.value = isNight;
    }
  }, [isNight]);

  const gShader = useMemo(() => ({
    ...GroundShaderMaterial,
    uniforms: { ...GroundShaderMaterial.uniforms, uIsNight:{ value:isNight }, uGridSize:{ value:48.0 }, uRoadInterval:{ value:4.0 }, uLamps: { value: LAMP_POSITIONS } }
  }), [LAMP_POSITIONS]);

  const weatherAmbientMult = weather === 'cloudy' || weather === 'rain' || weather === 'snow' ? 0.65 : 1.0;

  return (
    <KeyboardControls map={[
      { name:'forward', keys:['KeyW','ArrowUp'] },
      { name:'back',    keys:['KeyS','ArrowDown'] },
      { name:'left',    keys:['KeyA','ArrowLeft'] },
      { name:'right',   keys:['KeyD','ArrowRight'] },
      { name:'up',      keys:['Space','ShiftLeft','ShiftRight'] },
      { name:'down',    keys:['ControlLeft','ControlRight'] },
    ]}>
      <div className="w-screen h-screen relative bg-[#05050a] overflow-hidden select-none touch-none">
        <JoystickControls joystickValues={joystickValues} />

        {/* 좌상단 헤더 */}
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-3 pointer-events-none">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors pointer-events-auto shadow-lg">
            <ChevronLeft size={20} className="text-black" />
          </button>
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors pointer-events-auto shadow-lg">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          {/* 데이터 수집 안내 버튼 */}
          <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex flex-col justify-center">
            <span className="text-white text-[13px] font-bold tracking-wide">Ego-Bloom City</span>
            <span className="text-white/50 text-[9px] tracking-widest uppercase">{TIME_LABELS[timeOfDay]} · {weather !== 'clear' ? WEATHER_LABELS[weather]+' · ' : ''}{buildings.length} Creators</span>
          </div>
        </div>

        {/* 설정 패널 */}
        {isSettingsOpen && (
          <div className="absolute top-16 left-4 z-[70] w-68 bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl p-5 pointer-events-auto" style={{width:'17rem'}}>
            <h3 className="text-white font-bold text-sm mb-4">월드 설정</h3>
            <div className="flex flex-col gap-4">

              {/* 미니맵 표시 */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-white/70 text-xs">미니맵 표시</span>
                <button onClick={() => setShowMinimap(!showMinimap)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${showMinimap?'bg-purple-600':'bg-white/10'}`}>
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showMinimap?'left-6':'left-1'}`}/>
                </button>
              </div>

              {/* 시간대 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-white/70 text-xs">시간대</span>
                <div className="grid grid-cols-4 gap-1">
                  {Object.entries(TIME_LABELS).map(([k,v]) => (
                    <button key={k} onClick={() => setTimeOfDay(k)}
                      className={`py-1 rounded-lg text-[10px] font-medium transition-colors ${timeOfDay===k?'bg-purple-600 text-white':'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 날씨 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-white/70 text-xs">날씨</span>
                <div className="grid grid-cols-4 gap-1">
                  {Object.entries(WEATHER_LABELS).map(([k,v]) => (
                    <button key={k} onClick={() => setWeather(k)}
                      className={`py-1 rounded-lg text-[10px] font-medium transition-colors ${weather===k?'bg-blue-600 text-white':'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 그래픽 품질 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-white/70 text-xs">그래픽 품질</span>
                <div className="flex gap-1">
                  {[['low','낮음'],['medium','보통'],['high','높음']].map(([k,v]) => (
                    <button key={k} onClick={() => setQuality(k)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-colors ${quality===k?'bg-purple-600 text-white':'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 카메라 속도 */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex justify-between">
                  <span className="text-white/70 text-xs">카메라 속도</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { l: '느림', v: 350 },
                    { l: '보통', v: 700 },
                    { l: '빠름', v: 1200 },
                    { l: '매우빠름', v: 2000 }
                  ].map(s => (
                    <button key={s.v} onClick={() => setAcceleration(s.v)}
                      className={`py-1 rounded-lg text-[10px] font-medium transition-colors ${acceleration===s.v?'bg-purple-600 text-white':'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 미니맵 */}
        {!loading && showMinimap && <MiniMap buildings={buildings} cameraTargetRef={cameraTargetRef} />}

        {/* 조작 힌트 */}
        {!loading && <ControlHint />}

        {/* 모바일 수직 이동 버튼 — 우상단 미니맵 아래 */}
        <div className="lg:hidden absolute right-4 z-[60] flex flex-col gap-2 pointer-events-none" style={{top:'180px'}}>
          <button 
            onPointerDown={(e) => { e.preventDefault(); mobileVertical.current = 1; }} 
            onPointerUp={(e) => { e.preventDefault(); mobileVertical.current = 0; }} 
            onPointerLeave={() => mobileVertical.current = 0}
            onPointerCancel={() => mobileVertical.current = 0}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:bg-white/30 pointer-events-auto select-none"
            style={{ touchAction: 'none' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
          <button 
            onPointerDown={(e) => { e.preventDefault(); mobileVertical.current = -1; }} 
            onPointerUp={(e) => { e.preventDefault(); mobileVertical.current = 0; }} 
            onPointerLeave={() => mobileVertical.current = 0}
            onPointerCancel={() => mobileVertical.current = 0}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:bg-white/30 pointer-events-auto select-none"
            style={{ touchAction: 'none' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </button>
        </div>

        <Canvas shadows camera={{ fov: 45, near: 0.5, far: 30000 }} gl={{ antialias: true }} dpr={QUALITY_DPR[quality]}>
          <Suspense fallback={null}>
            {timeOfDay === 'night' ? (
              <color attach="background" args={['#020205']} />
            ) : (
              <Sky {...sp} />
            )}
            <ambientLight intensity={lp.ambient * weatherAmbientMult} />
            <directionalLight position={lp.dp} intensity={lp.di * weatherAmbientMult} color={lp.dc}
              castShadow shadow-mapSize={[2048, 2048]} />

            {/* 시간대별 보조 광원 */}
            {timeOfDay === 'night' && <>
              <pointLight position={[90, 170, -240]} color="#8899FF" intensity={0.7} distance={600} />
              <hemisphereLight args={['#0A1230', '#000008', 0.25]} />
            </>}
            {timeOfDay === 'dawn' && <>
              <hemisphereLight args={['#FF8030', '#180A00', 0.55]} />
              <pointLight position={[-260, 16, 160]} color="#FFAA40" intensity={1.2} distance={900} />
            </>}
            {timeOfDay === 'day' && (
              <hemisphereLight args={['#A0C4FF', '#304828', 0.45]} />
            )}
            {timeOfDay === 'sunset' && <>
              <hemisphereLight args={['#FF3800', '#120406', 0.5]} />
              <pointLight position={[250, 8, -50]} color="#FF2000" intensity={1.8} distance={1000} />
            </>}

            {/* 달/태양 */}
            {isNight && (
              <>
                <Moon />
                <Stars radius={400} depth={100} count={8000} factor={8} saturation={0} fade speed={1} />
              </>
            )}
            {!isNight && <Sun timeOfDay={timeOfDay} />}

            {/* 지면 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
              <planeGeometry args={[8000, 8000]} />
              <shaderMaterial ref={groundMatRef} attach="material" {...gShader} />
            </mesh>

            {/* 강 코너 */}
            <River timeOfDay={timeOfDay} />
            <RiverBanks />
            <GoldenGateBridge timeOfDay={timeOfDay} />
            <Cars timeOfDay={timeOfDay} />

            {/* 자연물 및 가로등 */}
            <ParkTrees timeOfDay={timeOfDay} />
            <StreetLamps positions={LAMP_POSITIONS} timeOfDay={timeOfDay} />
            {/* 지형 */}
            <Mountains timeOfDay={timeOfDay} />
            <ForestZone timeOfDay={timeOfDay} />
            <ParkZone timeOfDay={timeOfDay} />
            <Birds timeOfDay={timeOfDay} />
            <VoxelClouds weather={weather} />

            {/* 날씨 파티클 */}
            {weather === 'rain' && <RainParticles />}
            {weather === 'snow' && <SnowParticles />}

            {/* 빌딩 */}
            {!loading && (
              <Buildings
                data={buildings}
                timeOfDay={timeOfDay}
                cameraDistRef={cameraDistRef}
              />
            )}

            <WorldControls
              joystickValues={joystickValues}
              mobileVertical={mobileVertical}
              acceleration={acceleration}
              cameraTargetRef={cameraTargetRef}
              cameraDistRef={cameraDistRef}
            />
          </Suspense>
        </Canvas>

        {loading && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#05050a]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-white/50" size={32} />
              <span className="text-white/70 text-sm font-medium tracking-widest uppercase">Generating City...</span>
            </div>
          </div>
        )}

      </div>
    </KeyboardControls>
  );
}
