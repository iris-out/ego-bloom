/** 도보 모드의 소리다. 음원 파일을 두지 않고 WebAudio 로 그때그때 만든다.
 * 파일을 받지 않으므로 번들이 커지지 않고 첫 발이 늦게 나가지도 않는다.
 *
 * 브라우저는 사용자가 화면을 누르기 전에는 소리를 내주지 않는다. 첫 발사가 곧 그 조작이라
 * 재생 직전에 context 를 깨운다. WebAudio 가 없는 환경(서버 렌더, 테스트)에서는 조용히 아무것도 하지 않는다.
 *
 * 일회성 효과음은 모두 `voice()` 로 자리를 받아 효과음 버스를 탄다. 규칙은 `soundLimits.js` 에 있다.
 */

import { createVoiceState, planVoice } from './soundLimits.js';

/** 총성 한 발의 길이(초) 와 무기별 음색이다. cut 은 저역 통과 차단 주파수(Hz),
 * body 는 총열이 우는 낮은 음의 주파수다. 굵고 낮을수록 큰 총이다. */
const SHOTS = {
  pistol: { life: 0.16, cut: 2600, body: 180, gain: 0.22 },
  smg: { life: 0.1, cut: 3200, body: 230, gain: 0.16 },
  sniper: { life: 0.42, cut: 1500, body: 96, gain: 0.32 },
  fist: { life: 0.09, cut: 900, body: 130, gain: 0.12 },
  // life 를 길게, cut 을 낮게 잡아 다른 총보다 굵고 낮은 총성을 낸다.
  shotgun: { life: 0.24, cut: 1800, body: 130, gain: 0.3 },
};

let context = null;
let noise = null;
let effects = null;
let engine = null;
let limits = createVoiceState();
// planVoice 가 준 id 를 그 소리의 입구 GainNode 로 잇는다. 합치기와 밀어내기가 이 표를 읽는다.
const slots = new Map();

function audio() {
  if (context) return context;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/** 잡음 한 토막이다. 총성의 파열음이 여기서 나온다. 한 번 만들어 두고 계속 쓴다. */
function noiseBuffer(ctx) {
  if (noise) return noise;
  const frames = Math.floor(ctx.sampleRate * 0.5);
  noise = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = noise.getChannelData(0);
  // 난수를 쓰지만 버퍼를 한 번만 만든다. 발사마다 파형이 바뀌지는 않는다.
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

function ready() {
  const ctx = audio();
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume?.();
  return ctx;
}

/** 일회성 효과음 전용 버스다. 폭발 여러 개가 겹쳐도 출력에서 잘리지 않게 리미터를 건다.
 * 엔진은 이 버스를 타지 않는다. 물리면 폭발마다 엔진이 눌려 들린다.
 * 임계는 클리핑 바로 아래에 둔다. 낮게 잡으면 폭발 한 번에도 걸려 큰 소리만 작아지고
 * 그동안 총성과 틱까지 같이 눌린다. 합친 이득(최대 1.7배) 도 그때는 들리지 않는다. */
function effectOut(ctx) {
  if (effects && effects.context === ctx) return effects;
  effects = ctx.createGain();
  effects.gain.value = 0.9;
  let tail = effects;
  try {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    effects.connect(limiter);
    tail = limiter;
  } catch {
    // 리미터가 없는 환경이면 버스만 쓴다.
  }
  tail.connect(ctx.destination);
  return effects;
}

/** 엔진처럼 계속 울리는 소리의 입구다. 리미터를 거치지 않는다. */
export function engineOut(ctx) {
  if (engine && engine.context === ctx) return engine;
  engine = ctx.createGain();
  engine.gain.value = 1;
  engine.connect(ctx.destination);
  return engine;
}

/** 소리 한 번의 자리를 잡는다. null 이면 이번 호출은 노드를 만들지 않는다.
 * 각 play 함수는 음색을 그대로 두고 출구와 시작 시각만 여기서 받는다. */
function voice(kind) {
  const ctx = ready();
  if (!ctx) return null;
  const { state, plan } = planVoice(limits, kind, ctx.currentTime);
  limits = state;
  if (plan.steal) {
    // 밀려나는 소리는 끊지 않고 눕힌다. 바로 끊으면 딱 소리가 난다.
    const old = slots.get(plan.steal.id);
    if (old) {
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setValueAtTime(Math.max(1e-4, old.gain.value), ctx.currentTime);
      old.gain.exponentialRampToValueAtTime(1e-4, ctx.currentTime + plan.steal.fade);
    }
    slots.delete(plan.steal.id);
  }
  if (plan.merged) {
    // 이미 예약해 둔 소리를 조금 크게 만들고 끝낸다. 노드를 새로 만들지 않는다.
    slots.get(plan.id)?.gain.setValueAtTime(plan.gain, ctx.currentTime);
    return null;
  }
  const out = ctx.createGain();
  out.gain.setValueAtTime(plan.gain, ctx.currentTime);
  out.connect(effectOut(ctx));
  slots.set(plan.id, out);
  return { ctx, out, at: plan.startAt, id: plan.id };
}

/** 마지막 소스가 끝나면 슬롯을 놓는다. Map 이 계속 자라지 않게 한다. */
function release(node, slot) {
  node.onended = () => {
    slot.out.disconnect();
    // closeAudio 뒤 늦게 오는 onended 가 새 context 의 같은 번호를 지우지 않게 주인일 때만 놓는다.
    if (slots.get(slot.id) === slot.out) slots.delete(slot.id);
  };
}

/** 엔진 소리처럼 계속 울리는 소리가 같은 context 를 쓰도록 내보낸다.
 * context 를 둘로 나누면 브라우저가 하나만 깨워 한쪽이 조용해진다. */
export function audioContext() {
  return ready();
}

/** 잡음 버퍼도 나눠 쓴다. 엔진마다 0.5초 버퍼를 새로 만들 이유가 없다. */
export function sharedNoise(ctx) {
  return noiseBuffer(ctx || audio());
}

/** 총성이다. 파열음(잡음)과 총열의 낮은 울림을 함께 낸다. */
export function playShot(weapon = 'pistol') {
  const slot = voice('shot');
  if (!slot) return;
  const { ctx, out } = slot;
  const spec = SHOTS[weapon] || SHOTS.pistol;
  const now = slot.at;

  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(ctx);
  crack.playbackRate.value = 1;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(spec.cut, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, spec.cut * 0.12), now + spec.life);
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(spec.gain, now);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.life);
  crack.connect(filter).connect(crackGain).connect(out);
  crack.start(now);
  crack.stop(now + spec.life);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(spec.body, now);
  body.frequency.exponentialRampToValueAtTime(spec.body * 0.45, now + spec.life * 0.8);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(spec.gain * 0.8, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.life * 0.9);
  body.connect(bodyGain).connect(out);
  body.start(now);
  body.stop(now + spec.life);
  release(body, slot);
}

/** 짧은 기계음이다. 빈 탄창(dry), 재장전 완료(load), 손전등 스위치(click), 무기 전환(switch) 이 음만 다르다. */
export function playClick(kind = 'click') {
  const slot = voice('once');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  const pitch = kind === 'dry' ? 320 : kind === 'load' ? 520 : kind === 'switch' ? 640 : 760;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(pitch, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + 0.07);
  release(osc, slot);
}

/** 펌프 산탄총이 쏜 직후 포어엔드를 당겼다 미는 기계음이다. 쏜 시각을 기준으로
 * 0.18초, 0.30초 뒤에 달칵 소리 두 번을 예약해, 반동이 잦아드는 동안 슬라이드가
 * 왕복하는 느낌을 준다. playHit 처럼 시간차 예약이라 setTimeout 이 필요 없다. */
export function playPumpRack() {
  const slot = voice('once');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  let last = null;
  [[0.18, 260], [0.3, 200]].forEach(([delay, pitch]) => {
    const start = now + delay;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(pitch, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.06);
    last = osc;
  });
  if (last) release(last, slot);
}

/** 명중 확인음이다. 차가 사라진 순간에 한 번, 짧게 두 음을 올려 친다.
 * 조준경 안에서도 쐈다는 확신이 들도록 총성보다 높고 또렷한 음역을 쓴다. */
export function playHit() {
  const slot = voice('hit');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  let last = null;
  [1180, 1560].forEach((pitch, index) => {
    const start = now + index * 0.05;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.1);
    last = osc;
  });
  if (last) release(last, slot);
}

/** 발소리다. 달릴 때와 걸을 때 세기만 다르다. WalkMode 가 보폭 주기로 부른다.
 * 낮은 잡음 펄스 하나라 총성, 명중음과 겹쳐도 묻히지 않는다. */
export function playStep(running = false) {
  const slot = voice('once');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(running ? 92 : 78, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(running ? 0.05 : 0.032, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + 0.1);
  release(osc, slot);
}

/** 폭발 음색이다. life 는 꼬리까지 포함한 길이(초), sub 는 배를 때리는 저역의 시작
 * 주파수(Hz), cut 은 파열음 저역 통과의 시작 차단 주파수(Hz) 다. 멀리서 남의 차가
 * 터지는 소리(car)보다 내가 탄 것이 터지는 소리(self)가 길고 낮고 크다. */
const BOOMS = {
  car: { life: 1.5, sub: 84, cut: 2200, gain: 0.34 },
  self: { life: 2.6, sub: 62, cut: 1700, gain: 0.5 },
  // 차끼리 부딪힌 소리다. 터지는 것이 아니라 짧고 둔하게 한 번 친다.
  bump: { life: 0.42, sub: 96, cut: 900, gain: 0.3 },
};

/** 폭발음이다. 세 겹으로 쌓는다. 앞머리의 날카로운 파열, 저역으로 쓸려 내려가는
 * 몸통 잡음, 그리고 배를 때리는 사인 저역이다. 실제 폭발이 그렇듯 파열은 순간이고
 * 잡음 꼬리가 길게 남는다. 음원 파일 없이 WebAudio 로만 만든다.
 *
 * 한 프레임에 여러 대가 터져도 소리는 하나다. 겹치기는 `soundLimits` 가 막는다.
 */
export function playBoom(kind = 'car') {
  const slot = voice(kind === 'self' ? 'boomSelf' : 'boom');
  if (!slot) return;
  const { ctx, out } = slot;
  const spec = BOOMS[kind] || BOOMS.car;
  const now = slot.at;

  // 파열. 넓은 대역이 8분의 1초 만에 사라진다. 터진 순간을 알리는 것은 이 소리다.
  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(ctx);
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'highpass';
  crackFilter.frequency.setValueAtTime(900, now);
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(spec.gain * 0.9, now);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  crack.connect(crackFilter).connect(crackGain).connect(out);
  crack.start(now);
  crack.stop(now + 0.15);

  // 몸통. 같은 잡음을 느리게 재생해 굵게 만들고 차단 주파수를 끌어내려 멀어지게 한다.
  const body = ctx.createBufferSource();
  body.buffer = noiseBuffer(ctx);
  body.playbackRate.value = 0.42;
  body.loop = true;
  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'lowpass';
  bodyFilter.Q.value = 0.7;
  bodyFilter.frequency.setValueAtTime(spec.cut, now);
  bodyFilter.frequency.exponentialRampToValueAtTime(110, now + spec.life);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.linearRampToValueAtTime(spec.gain, now + 0.02);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.life);
  body.connect(bodyFilter).connect(bodyGain).connect(out);
  body.start(now);
  body.stop(now + spec.life);

  // 저역. 주파수를 절반 아래로 떨어뜨려 배를 때리는 느낌을 만든다.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(spec.sub, now);
  sub.frequency.exponentialRampToValueAtTime(spec.sub * 0.42, now + spec.life * 0.7);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(spec.gain * 1.1, now);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.life * 0.75);
  sub.connect(subGain).connect(out);
  sub.start(now);
  sub.stop(now + spec.life * 0.8);
  release(body, slot);
}

/** 비행기 기관총, 기관포 한 발이다. 연사 중에도 서로 뭉개지지 않도록 도보 총성보다 훨씬 짧고 건조하다. */
export function playCannon() {
  const slot = voice('cannon');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2200, now);
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  crack.connect(filter).connect(gain).connect(out);
  crack.start(now);
  crack.stop(now + 0.06);
  release(crack, slot);
}

/** 미사일 발사음이다. 점화한 잡음이 빠르게 높은 대역으로 쓸려 올라가며 멀어진다. */
export function playMissileLaunch() {
  const slot = voice('once');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  const whoosh = ctx.createBufferSource();
  whoosh.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(500, now);
  filter.frequency.exponentialRampToValueAtTime(3800, now + 0.35);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  whoosh.connect(filter).connect(gain).connect(out);
  whoosh.start(now);
  whoosh.stop(now + 0.42);
  release(whoosh, slot);
}

/** 전차, 자주포, 장갑차의 직사포다. 총성보다 훨씬 낮고 굵어 한 발의 무게가 느껴진다.
 * 잡음이 급격히 저역으로 쓸려 내려가는 파열에, 배를 때리는 사인 저역을 겹친다. */
export function playTankShot() {
  const slot = voice('tankShot');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(160, now + 0.3);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.32, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  crack.connect(filter).connect(gain).connect(out);
  crack.start(now);
  crack.stop(now + 0.34);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, now);
  sub.frequency.exponentialRampToValueAtTime(35, now + 0.25);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.28, now);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  sub.connect(subGain).connect(out);
  sub.start(now);
  sub.stop(now + 0.3);
  release(crack, slot);
}

/** 폭격기가 폭탄을 떨어뜨리는 순간의 기계음이다. 폭발음(playBoom)과는 다른,
 * 창이 열리며 무게가 빠지는 둔탁한 소리다. */
export function playBombDrop() {
  const slot = voice('once');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + 0.15);
  release(osc, slot);
}

/** 월드를 떠날 때 오디오 장치를 놓는다. 탭이 살아 있는 동안 context 를 쥐고 있지 않는다.
 * 버스와 슬롯도 함께 놓는다. 남겨 두면 닫힌 context 의 노드를 다시 쓴다. */
export function closeAudio() {
  if (!context) return;
  context.close?.();
  context = null;
  noise = null;
  effects = null;
  engine = null;
  slots.clear();
  limits = createVoiceState();
}

/** 음속을 넘는 순간의 소닉붐이다. 폭발음과 달리 파열이 한 번 크게 치고 긴 저역이 뒤로 끌린다.
 * 한 번 넘을 때 한 번만 울린다. 반복 재생은 호출자가 막는다. */
export function playSonicBoom() {
  const slot = voice('sonic');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;

  // 파열. 넓은 대역이 짧게 친다. 이 소리가 '쾅' 을 만든다.
  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(ctx);
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'bandpass';
  crackFilter.frequency.setValueAtTime(420, now);
  crackFilter.frequency.exponentialRampToValueAtTime(90, now + 0.5);
  crackFilter.Q.value = 0.6;
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.0001, now);
  crackGain.gain.linearRampToValueAtTime(0.55, now + 0.012);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  crack.connect(crackFilter).connect(crackGain).connect(out);
  crack.start(now);
  crack.stop(now + 0.95);

  // 저역. 천천히 내려가며 배를 누른다. 폭발보다 길게 끈다.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(78, now);
  sub.frequency.exponentialRampToValueAtTime(26, now + 1.1);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.linearRampToValueAtTime(0.5, now + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  sub.connect(subGain).connect(out);
  sub.start(now);
  sub.stop(now + 1.25);
  release(sub, slot);
}

/** 명중 표시음이다. 분당 300발로 때릴 때 겹쳐도 뭉개지지 않게 아주 짧고 건조하다.
 * playHit 의 두 음짜리 종소리와 달리 여기서는 한 번에 한 틱만 친다. */
export function playTick() {
  const slot = voice('tick');
  if (!slot) return;
  const { ctx, out } = slot;
  const now = slot.at;

  // 금속을 때리는 짧은 파열이다. 고역만 남겨 배경 엔진 소리 위로 떠오르게 한다.
  const snap = ctx.createBufferSource();
  snap.buffer = noiseBuffer(ctx);
  const shape = ctx.createBiquadFilter();
  shape.type = 'highpass';
  shape.frequency.setValueAtTime(2400, now);
  const level = ctx.createGain();
  level.gain.setValueAtTime(0.13, now);
  level.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  snap.connect(shape).connect(level).connect(out);
  snap.start(now);
  snap.stop(now + 0.06);

  // 음정 하나를 얹어 '틱' 으로 들리게 한다. 잡음만 쓰면 바스락 소리에 그친다.
  const ping = ctx.createOscillator();
  ping.type = 'square';
  ping.frequency.setValueAtTime(2100, now);
  ping.frequency.exponentialRampToValueAtTime(1500, now + 0.04);
  const pingGain = ctx.createGain();
  pingGain.gain.setValueAtTime(0.055, now);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  ping.connect(pingGain).connect(out);
  ping.start(now);
  ping.stop(now + 0.06);
  release(ping, slot);
}
