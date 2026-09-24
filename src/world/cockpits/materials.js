import * as THREE from 'three';

/** 실내 어디서나 쓰는 단위 상자 geometry 다. parts.jsx 밖에서 mesh 를 직접 그려야 할 때
 * (재질이 바뀌어 StaticBatch 대상에서 빼야 하는 조각 등) 이것을 쓴다. */
export const BOX = new THREE.BoxGeometry(1, 1, 1);

/** seed 를 넣으면 늘 같은 수열을 주는 난수다. 모델과 텍스처에 Math.random 을 쓰면
 * 새로 고칠 때마다 무늬가 바뀌어 스크린샷 비교가 불가능해진다. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 가죽과 직물, 플라스틱 표면의 결이다. 색은 재질의 color 가 정하고 이 텍스처는 밝기만
 * 0.82 에서 1.0 사이로 흔든다. 평균이 0.91 이라 팔레트 색은 그만큼 밝게 잡아 둔다.
 * colorSpace 를 두지 않는다. sRGB 로 읽으면 같은 값이 선형 0.65 까지 내려가 실내가 어두워진다.
 * document 가 없는 환경(단위 테스트) 에서는 텍스처 없이 색만 쓴다. */
function grainTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(128, 128);
  const random = mulberry32(0x5eed01);
  for (let i = 0; i < image.data.length; i += 4) {
    const level = Math.round((0.82 + random() * 0.18) * 255);
    image.data[i] = level; image.data[i + 1] = level; image.data[i + 2] = level; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

const GRAIN = grainTexture();
const BUMP = 0.003;
const grained = (options) => (GRAIN ? { ...options, map: GRAIN, bumpMap: GRAIN, bumpScale: BUMP } : options);

/** 캔버스 한 장으로 만드는 세로 그라데이션 알파다. 위가 짙고 아래로 사라진다.
 * 대시 밑, 발밑, 문 아래 접촉 그림자에 쓴다. 광원을 더하지 않고 음영만 그리는 값싼 방법이다. */
function shadeAlpha() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const SHADE_ALPHA = shadeAlpha();

/** 콕핏 실내가 공유하는 재질이다. 모듈 스코프에서 한 번 만들고 전 기종이 함께 쓴다.
 * 컴포넌트마다 새로 만들면 draw call 이 기종 수만큼 늘어난다.
 * emissive 색은 생성 시점에 박아둔다. applyPalette 는 이 색과 intensity 만 고친다. */
export const MAT = {
  shell: new THREE.MeshStandardMaterial(grained({ color: '#2b2f36', emissive: '#2b2f36', emissiveIntensity: 0.18, roughness: 0.82, metalness: 0.08 })),
  trim: new THREE.MeshStandardMaterial({ color: '#3c424b', emissive: '#3c424b', emissiveIntensity: 0.08, roughness: 0.6, metalness: 0.3 }),
  face: new THREE.MeshStandardMaterial({ color: '#12161c', emissive: '#2c4036', emissiveIntensity: 0, roughness: 0.55 }),
  glow: new THREE.MeshStandardMaterial({ color: '#1a1f27', emissive: '#4d6f53', emissiveIntensity: 0.55, roughness: 0.5 }),
  needle: new THREE.MeshStandardMaterial({ color: '#f0c04a', emissive: '#f0c04a', emissiveIntensity: 0.35, roughness: 0.4 }),
  grip: new THREE.MeshStandardMaterial(grained({ color: '#1d2026', emissive: '#1d2026', emissiveIntensity: 0.06, roughness: 0.95 })),
  glass: new THREE.MeshStandardMaterial({ color: '#7f98a8', transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.4 }),

  leather: new THREE.MeshStandardMaterial(grained({ color: '#3a2e26', emissive: '#3a2e26', emissiveIntensity: 0.08, roughness: 0.85 })),
  fabric: new THREE.MeshStandardMaterial(grained({ color: '#3d3f44', emissive: '#3d3f44', emissiveIntensity: 0.08, roughness: 0.95 })),
  metal: new THREE.MeshStandardMaterial({ color: '#8b9096', emissive: '#8b9096', emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 1 }),
  // 눈에 닿지 않는 틈과 바닥이다. 검은 구멍으로 보여야 할 자리라 발광이 없다.
  dark: new THREE.MeshStandardMaterial({ color: '#0d1013', roughness: 1 }),
  // 앞유리와 캐노피다. 양면이라 안에서도 바깥에서도 같은 두께로 보인다.
  glassTint: new THREE.MeshStandardMaterial({ color: '#9fb4c2', transparent: true, opacity: 0.10, depthWrite: false, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide }),
  // 계기 덮개 유리다. 눈금판 위에 한 장 덮어 반사면을 만든다. 눈금 숫자가 비쳐야 하므로
  // 불투명도를 낮게 둔다. 0.22 는 작은 계기에서 눈금판을 뿌옇게 덮었다.
  screenGlass: new THREE.MeshStandardMaterial({ color: '#b8c7d2', transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.08, metalness: 0.2 }),
  // HUD combiner 유리다. 실제 combiner 는 녹색 상만 반사하는 코팅이라 유리 자체가 옅게
  // 녹색을 띤다. 틀만 남고 유리가 보이지 않던 문제를 이 한 장이 고친다.
  hudGlass: new THREE.MeshStandardMaterial({ color: '#8fc9a4', transparent: true, opacity: 0.14, depthWrite: false, roughness: 0.06, metalness: 0.25, side: THREE.DoubleSide }),
  warn: new THREE.MeshStandardMaterial({ color: '#b3402a', emissive: '#b3402a', emissiveIntensity: 0.3, roughness: 0.5 }),
  // emissive 가 없으면 아래를 향한 면(포탑 바스켓 지붕 밑면 등) 이 하늘 대신 바닥 hemisphere
  // 색(올리브 도시 바닥) 을 받아 흰 방염 도장이 올리브색으로 보인다. intensity 는 낮과 밤
  // 둘 다에서 자연스럽도록 낮게 뒀다(PANEL_EMISSIVE 표에 없는 고정값이라 밤에도 그대로다).
  white: new THREE.MeshStandardMaterial({ color: '#d8d9d4', emissive: '#d8d9d4', emissiveIntensity: 0.18, roughness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: '#c99a7a', roughness: 0.7 }),
  sleeve: new THREE.MeshStandardMaterial({ color: '#2f3338', roughness: 0.9 }),
  shade: new THREE.MeshBasicMaterial({
    color: '#000000', transparent: true, opacity: 0.55, depthWrite: false,
    side: THREE.DoubleSide, ...(SHADE_ALPHA ? { alphaMap: SHADE_ALPHA } : {}),
  }),
};

/** 계기 발광의 낮값과 밤값이다. 밤 ambient 가 0.2 까지 떨어지므로 낮값의 네 배쯤 올려야
 * 바늘과 화면이 보인다. face 는 원판이 검은 구멍으로 보이지 않을 만큼만 올린다.
 * 더 올리면 바늘과 원판의 명도가 붙어 판독이 어려워진다. */
const PANEL_EMISSIVE = Object.freeze({
  glow: [0.55, 2.2],
  needle: [0.35, 1.6],
  face: [0, 0.16],
});

/** MAT 밖에서 만든 발광 재질(캔버스 눈금판, 스위치 캡) 이 밤낮을 함께 따르도록 등록한다.
 * 재질을 캐시해 두고 쓰는 쪽이 등록하며, 등록 시점의 밤낮 상태를 바로 반영한다. */
const REGISTERED = new Map();
let nightNow = false;

export function registerPanelEmissive(material, day, night) {
  REGISTERED.set(material, [day, night]);
  material.emissiveIntensity = nightNow ? night : day;
  return material;
}

/** 밤이면 계기 발광을 올린다. 재질은 공유 객체이므로 새로 만들지 않고 값만 고친다.
 * 호출자가 언마운트 때 setNightPanels(false) 로 낮값을 되돌려야 한다. */
export function setNightPanels(night) {
  nightNow = !!night;
  const level = nightNow ? 1 : 0;
  for (const [key, levels] of Object.entries(PANEL_EMISSIVE)) MAT[key].emissiveIntensity = levels[level];
  for (const [material, levels] of REGISTERED) material.emissiveIntensity = levels[level];
}

/** 탈것별 실내 색이다. 여섯 재질만 바꾼다. 나머지(계기, 유리, 고무, 살색)는 전 기종 공통이다.
 * GRAIN 이 밝기를 평균 0.91 로 낮추므로 실제로 보고 싶은 색보다 한 단계 밝게 잡았다. */
const DEFAULT_PALETTE = Object.freeze({ shell: '#2b2f36', trim: '#3c424b', grip: '#1d2026', leather: '#3a2e26', fabric: '#3d3f44', metal: '#8b9096' });

export const PALETTES = Object.freeze({
  // 승용차는 가죽과 직물이 보이게 한다. 대시는 반사를 줄인 검정이다.
  sedan: Object.freeze({ shell: '#23262b', trim: '#3a4048', grip: '#1b1d21', leather: '#51433d', fabric: '#272c32', metal: '#8e949b' }),
  suv: Object.freeze({ shell: '#2a2d33', trim: '#40454d', grip: '#1d2024', leather: '#40382f', fabric: '#4a4d52', metal: '#888e95' }),
  // 오픈카만 은색 트림이다. 지붕이 없어 실내가 그대로 햇빛을 받는다.
  convertible: Object.freeze({ shell: '#2b2621', trim: '#9aa0a6', grip: '#221e1a', leather: '#6e2f24', fabric: '#4a4038', metal: '#a8aeb4' }),
  formula: Object.freeze({ shell: '#22272e', trim: '#4a535e', grip: '#101318', leather: '#24282e', fabric: '#30363e', metal: '#8e989f' }),
  // 트럭은 가죽이 아니라 검정 비닐이고 대시만 짙은 청색이다.
  truck: Object.freeze({ shell: '#2a3340', trim: '#3f4a58', grip: '#1c1e22', leather: '#1c1e22', fabric: '#3a4049', metal: '#98a0a8' }),
  motorcycle: Object.freeze({ shell: '#1a1c20', trim: '#2e3238', grip: '#141619', leather: '#26221f', fabric: '#2a2d31', metal: '#9aa0a6' }),
  // 전투 차량은 전투실 벽만 방염 흰색이고 기계 부분은 올리브다.
  tank: Object.freeze({ shell: '#d6d7d2', trim: '#4b5540', grip: '#1e2018', leather: '#3b3529', fabric: '#4a4f3e', metal: '#7d8471' }),
  howitzer: Object.freeze({ shell: '#d2d3ce', trim: '#4b5540', grip: '#1e2018', leather: '#3b3529', fabric: '#4a4f3e', metal: '#767d6a' }),
  armored: Object.freeze({ shell: '#cfd0cb', trim: '#47513d', grip: '#1c1e17', leather: '#38332a', fabric: '#464b3b', metal: '#79806d' }),
  aa: Object.freeze({ shell: '#cbccc7', trim: '#47513d', grip: '#1c1e17', leather: '#38332a', fabric: '#464b3b', metal: '#747b69' }),
  // 항공기는 기종 세대가 드러나게 나눈다. 제트는 중회색, 전투기는 더 짙은 회색에 검정이다.
  jet: Object.freeze({ shell: '#5c6067', trim: '#44484f', grip: '#1c1f24', leather: '#2b2e33', fabric: '#3c4047', metal: '#949aa1' }),
  fighter: Object.freeze({ shell: '#35393f', trim: '#25282d', grip: '#15171a', leather: '#24262a', fabric: '#2f3238', metal: '#8a9097' }),
  // 프로펠러기는 2차대전기 interior green 이다.
  prop: Object.freeze({ shell: '#4f6b4a', trim: '#3d5439', grip: '#241f19', leather: '#46372a', fabric: '#4a5742', metal: '#8f9691' }),
  // 요격기는 RLM 66 계열 회색이다.
  interceptor: Object.freeze({ shell: '#4a4c4e', trim: '#37393b', grip: '#1b1c1e', leather: '#2e2f31', fabric: '#3d3f41', metal: '#90969c' }),
  bomber: Object.freeze({ shell: '#5a6358', trim: '#434b41', grip: '#1e211c', leather: '#3a3228', fabric: '#4a5147', metal: '#8d948a' }),
  helicopter: Object.freeze({ shell: '#1f2226', trim: '#4a4f56', grip: '#131518', leather: '#2a2d31', fabric: '#33373c', metal: '#8e949b' }),
});

/** 발광은 색의 0.12 배다. 실내가 그림자에 들어가도 조각 경계가 보이게 하는 최소값이고,
 * 더 올리면 밤에 실내가 스스로 빛나 바깥 도시보다 밝아진다. */
const EMISSIVE_RATIO = 0.12;
const PALETTE_KEYS = Object.keys(DEFAULT_PALETTE);

/** 탈것 하나의 색을 공유 재질에 적는다. 재질 객체를 바꾸지 않으므로 이미 합쳐진
 * StaticBatch mesh 도 같은 재질을 계속 쓴다. 없는 키는 기본 팔레트로 되돌린다. */
export function applyPalette(rideKey) {
  const palette = PALETTES[rideKey] || DEFAULT_PALETTE;
  for (const key of PALETTE_KEYS) {
    const material = MAT[key];
    const hex = palette[key] || DEFAULT_PALETTE[key];
    material.color.set(hex);
    material.emissive.set(hex);
    material.emissiveIntensity = EMISSIVE_RATIO;
  }
}
