import * as THREE from 'three';

/** 앞유리와 캐노피에 쓰는 알파 텍스처다. parts.jsx 가 컴포넌트만 내보내야 해서
 * 캔버스를 그리는 함수는 이 파일에 둔다. 알파가 밝을수록 유리가 진해진다. */

const SIZE = 128;

/** seed 하나로 같은 무늬를 만든다. 얼룩과 빗방울이 새로 고칠 때마다 달라지면 화면 비교가 불가능하다. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 마른 유리의 얼룩이다. 바탕을 0.8 쯤 두고 닦인 자국만 1 에 가깝게 올린다. */
export function drawSmudge(ctx) {
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const random = mulberry32(0x1d0c);
  for (let i = 0; i < 9; i++) {
    const x = random() * SIZE, y = random() * SIZE, r = 9 + random() * 22;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, 'rgba(255,255,255,0.55)');
    blob.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** 빗방울이다. t 는 초 단위 시간이고 seed 는 창마다 다른 무늬를 만든다.
 * 프레임마다 부르지 않는다. GlassPane 이 0.15초 주기로만 부른다. */
export function drawRain(ctx, seed = 0, t = 0) {
  drawSmudge(ctx);
  const random = mulberry32((Number(seed) || 0) + 0x7a11);
  const time = Number(t) || 0;
  for (let i = 0; i < 44; i++) {
    const x = random() * SIZE;
    const speed = 0.16 + random() * 0.5;
    const drop = 1.8 + random() * 3.2;
    const y = ((((random() + time * speed) % 1) + 1) % 1) * SIZE;
    ctx.fillStyle = '#fbfbfb';
    ctx.beginPath();
    ctx.arc(x, y, drop, 0, Math.PI * 2);
    ctx.fill();
    // 흘러내린 자국은 물방울 위로 남는다.
    ctx.fillRect(x - drop * 0.3, y - drop * 3.6, drop * 0.6, drop * 3.6);
  }
}

/** 알파맵만 다른 유리 재질 한 벌이다. 모듈 스코프에서 한 번 만들어 전 기종이 함께 쓴다.
 * document 가 없는 환경에서는 null 이고 GlassPane 이 민 유리로 돌아간다. */
function glassVariant(draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshStandardMaterial({
    color: '#9fb4c2', transparent: true, opacity: 0.12, depthWrite: false,
    roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, alphaMap: texture,
  });
  return { canvas, ctx, texture, material };
}

export const GLASS_SMUDGE = glassVariant(drawSmudge);
export const GLASS_RAIN = glassVariant((ctx) => drawRain(ctx, 0, 0));

/** 빗방울 캔버스를 다시 그린다. 창이 여럿이어도 캔버스는 한 장이고 시간만 보므로
 * 같은 프레임에서는 누가 불러도 같은 그림이다. */
export function refreshRain(time) {
  if (!GLASS_RAIN) return;
  drawRain(GLASS_RAIN.ctx, 0, time);
  GLASS_RAIN.texture.needsUpdate = true;
}
