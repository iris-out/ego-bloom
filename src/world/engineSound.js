import { IDLE_RPM, MAX_RPM } from './carGauges.js';
import { sharedNoise, audioContext, engineOut } from './sound.js';

/** 엔진 소리다. 총성이나 폭발과 달리 계속 울리며 스로틀을 따라간다.
 * 그래서 한 번 만든 노드를 계속 두고 값만 램프로 옮긴다. 매 프레임 노드를 만들면
 * 몇 초 만에 수천 개가 쌓인다.
 *
 * 음원 파일은 두지 않는다. 터빈은 낮은 울림과 높은 휘파람, 프로펠러는 날개 통과음,
 * 로터는 그 통과음으로 잡음을 때리는 박동, 피스톤은 폭발 간격이 만드는 톱니다.
 * 소리를 만드는 값(주파수와 크기) 은 engineTargets 한 곳에서 나오고 순수 함수다.
 */

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp01 = (value) => Math.max(0, Math.min(1, finite(value)));

/** 기종별 음색이다.
 * kind 는 소리를 만드는 방식이고 나머지는 그 방식이 읽는 값이다.
 * body 는 낮은 울림, whine 은 높은 쇳소리, air 는 공기가 지나는 잡음의 크기다.
 * gain 은 전체 크기이고 다른 효과음(총성 0.16~0.32) 보다 낮게 둬야 발사가 묻히지 않는다. */
export const ENGINES = Object.freeze({
  // 터빈이다. 실제 기체 안에서 들리는 소리는 높은 휘파람이 아니라 낮은 울림과 공기 소리다.
  // 휘파람은 있다는 것만 알 정도로 섞는다(mix). 크기는 지상 차량보다도 낮게 둔다.
  //
  // harmonics 는 저역 통과가 남기는 고조파 수다. 기본 주파수의 배수로 따라가야 한다.
  // 예전에는 차단이 Hz 로 고정이라 16Hz 로 도는 로터가 고조파 99개를 그대로 냈다. 그것이 앵앵거림이다.
  // sub 는 한 옥타브 아래 사인의 크기다. 엔진의 무게가 여기서 나온다.
  // airHz 는 공기 소리의 대역 중심이다. 차단과 따로 두어야 어두운 엔진도 바람은 살아 있다.
  jet: { kind: 'turbine', harmonics: 7, sub: 0.8, airHz: 900, body: 34, whine: 300, mix: 0.035, air: 0.2, gain: 0.05, idle: 0.12 },
  fighter: { kind: 'turbine', harmonics: 7, sub: 0.8, airHz: 1000, body: 38, whine: 360, mix: 0.04, air: 0.24, gain: 0.055, idle: 0.14 },
  // 요격기는 그중 가장 날카롭다. 부스트에서 휘파람이 한 옥타브 더 올라간다.
  interceptor: { kind: 'turbine', harmonics: 8, sub: 0.75, airHz: 1100, body: 40, whine: 400, mix: 0.05, air: 0.26, gain: 0.06, idle: 0.14 },
  // 폭격기는 엔진 넷이라 낮고 두껍다. 휘파람이 거의 없고 공기 소리가 가장 크다.
  bomber: { kind: 'turbine', harmonics: 6, sub: 0.95, airHz: 700, body: 24, whine: 170, mix: 0.025, air: 0.3, gain: 0.055, idle: 0.16 },
  // 프로펠러기는 날개 통과음이 전부다. 휘파람 대신 배기의 탁한 울림을 둔다.
  prop: { kind: 'prop', harmonics: 6, sub: 0.9, airHz: 620, body: 62, whine: 0, air: 0.14, gain: 0.055, idle: 0.2 },
  // 헬기는 로터가 공기를 때리는 박동이다. body 가 초당 타격 수다.
  helicopter: { kind: 'rotor', harmonics: 5, sub: 0.9, airHz: 560, body: 15, whine: 200, mix: 0.04, air: 0.22, gain: 0.06, idle: 0.3 },
  // 승용차 4기통이다. 폭발 간격이 주파수를 만든다.
  sedan: { kind: 'piston', harmonics: 7, sub: 0.55, airHz: 700, bodyIdle: 27, bodyRed: 210, whine: 0, air: 0.05, gain: 0.075, idle: 0.16 },
  // SUV 는 6기통, 오픈카는 8기통이라 세단보다 굵고 부드럽다. 트럭은 디젤 6기통이다.
  suv: { kind: 'piston', harmonics: 6, sub: 0.7, airHz: 620, bodyIdle: 32, bodyRed: 200, whine: 0, air: 0.06, gain: 0.078, idle: 0.17 },
  convertible: { kind: 'piston', harmonics: 7, sub: 0.65, airHz: 720, bodyIdle: 36, bodyRed: 240, whine: 0, air: 0.07, gain: 0.08, idle: 0.18 },
  truck: { kind: 'piston', harmonics: 5, sub: 0.95, airHz: 420, bodyIdle: 20, bodyRed: 105, whine: 0, air: 0.11, gain: 0.082, idle: 0.24 },
  // 오토바이는 2기통이라 간격이 성기고 소리가 거칠다.
  motorcycle: { kind: 'piston', harmonics: 8, sub: 0.5, airHz: 780, bodyIdle: 15, bodyRed: 125, whine: 0, air: 0.06, gain: 0.08, idle: 0.2 },
  // 전차와 자주포는 디젤이다. 기통이 많아 낮게 깔리고 배기가 탁하다.
  tank: { kind: 'piston', harmonics: 5, sub: 1, airHz: 380, bodyIdle: 22, bodyRed: 120, whine: 0, air: 0.12, gain: 0.085, idle: 0.26 },
  howitzer: { kind: 'piston', harmonics: 5, sub: 1, airHz: 360, bodyIdle: 20, bodyRed: 110, whine: 0, air: 0.12, gain: 0.085, idle: 0.26 },
  armored: { kind: 'piston', harmonics: 5, sub: 0.95, airHz: 440, bodyIdle: 24, bodyRed: 140, whine: 0, air: 0.1, gain: 0.08, idle: 0.22 },
  aa: { kind: 'piston', harmonics: 5, sub: 0.95, airHz: 440, bodyIdle: 24, bodyRed: 140, whine: 0, air: 0.1, gain: 0.08, idle: 0.22 },
});

export function engineSpec(key) {
  return ENGINES[key] || null;
}

/** 피스톤 엔진의 폭발 주파수다. 4행정이라 두 바퀴에 기통마다 한 번 터진다.
 * ENGINES 의 bodyIdle, bodyRed 를 정할 때 쓴 식이고 실행 중에는 쓰지 않는다. */
export function firingHz(rpm, cylinders) {
  return (Math.max(0, finite(rpm)) / 60) * Math.max(1, finite(cylinders, 4)) / 2;
}

/** 소리를 만드는 값이다. 순수 함수이며 WebAudio 에 의존하지 않는다.
 * input 은 { throttle, rpm, boost, shift } 이고 쓰는 값은 기종이 정한다.
 * body 와 whine 은 Hz, air 와 gain 은 0 이상의 크기다. */
export function engineTargets(key, input = {}) {
  const spec = engineSpec(key);
  if (!spec) return null;
  const throttle = clamp01(input.throttle);
  // 정지 상태에서도 공회전은 돈다. 부하는 공회전 바닥 위에서 스로틀을 따라간다.
  const load = spec.idle + (1 - spec.idle) * throttle;
  const boost = input.boost ? 1 : 0;

  if (spec.kind === 'piston') {
    // 회전계가 이미 rpm 을 만든다. 소리도 같은 값을 읽어야 계기와 귀가 어긋나지 않는다.
    const rpm = Math.max(IDLE_RPM, Math.min(MAX_RPM, finite(input.rpm, IDLE_RPM)));
    const revs = (rpm - IDLE_RPM) / Math.max(1, MAX_RPM - IDLE_RPM);
    // 변속 순간의 동력 끊김이다. 0 에서 1 이고 클수록 크게 죽는다. 회전수는 이미 기어마다
    // 떨어지지만, 잠깐 힘이 빠지지 않으면 변속이 아니라 음이 미끄러지는 것처럼 들린다.
    const cut = clamp01(input.shift);
    const body = spec.bodyIdle + revs * (spec.bodyRed - spec.bodyIdle);
    return {
      body,
      // 무게는 한 옥타브 아래 사인이 낸다. 회전이 낮을수록 두껍게 깔린다.
      sub: spec.sub * (1 - revs * 0.35),
      whine: 0,
      // 회전이 오를수록 배기가 거칠어진다. 변속 중에는 배기도 같이 죽는다.
      air: spec.air * (0.6 + revs * 0.8) * (1 - cut * 0.45),
      airHz: spec.airHz * (0.8 + revs * 0.5),
      gain: spec.gain * (0.55 + revs * 0.45 + throttle * 0.2) * (1 - cut * 0.55),
      // 차단은 기본 주파수의 배수로 따라간다. Hz 로 고정하면 회전이 낮을 때
      // 고조파가 수십 개씩 새어 나와 엔진이 아니라 벌 소리가 된다.
      cut: body * spec.harmonics * (1 - cut * 0.3),
      beat: 0,
    };
  }

  if (spec.kind === 'rotor') {
    // 로터는 회전수가 크게 변하지 않는다. 콜렉티브를 올리면 타격이 세지고 터빈이 올라간다.
    const rotorBody = spec.body * (0.86 + load * 0.22);
    return {
      body: rotorBody,
      sub: spec.sub,
      whine: spec.whine * (0.7 + load * 0.5),
      air: spec.air * (0.7 + load * 0.6),
      airHz: spec.airHz * (0.85 + load * 0.4),
      gain: spec.gain * (0.7 + load * 0.4),
      cut: rotorBody * spec.harmonics,
      // 박동 깊이다. 로터만 잡음을 때린다.
      beat: 0.85,
    };
  }

  if (spec.kind === 'prop') {
    const propBody = spec.body * (0.5 + load * 1.0);
    return {
      body: propBody,
      sub: spec.sub,
      whine: 0,
      air: spec.air * (0.5 + load * 0.9),
      airHz: spec.airHz * (0.8 + load * 0.5),
      gain: spec.gain * (0.5 + load * 0.6),
      cut: propBody * spec.harmonics,
      beat: 0.35,
    };
  }

  // 터빈이다. 부스트는 휘파람을 한 옥타브 가까이 밀어 올린다.
  // 스로틀을 올릴 때 크기보다 공기 소리가 먼저 자란다. 실제로도 추력이 붙으면 바람이 먼저 는다.
  const turbineBody = spec.body * (0.72 + load * 0.7);
  return {
    body: turbineBody,
    sub: spec.sub,
    whine: spec.whine * (0.55 + load * 1.0 + boost * 0.55),
    air: spec.air * (0.45 + load * 1.2 + boost * 0.35),
    airHz: spec.airHz * (0.8 + load * 0.6 + boost * 0.2),
    gain: spec.gain * (0.55 + load * 0.5 + boost * 0.12),
    // 차단도 기본 주파수를 따라간다. 제트의 울림은 낮고 바람은 airHz 가 따로 맡는다.
    cut: turbineBody * spec.harmonics,
    beat: 0,
  };
}

/** 값이 튀지 않게 옮기는 시간(초) 이다. 짧으면 스로틀을 움직일 때 소리가 계단처럼 끊긴다. */
const GLIDE = 0.12;
/** 시동과 정지에 쓰는 페이드다. 갑자기 켜고 끄면 딱 소리가 난다. */
const FADE = 0.25;

/** set 이 실제로 AudioParam 예약을 거는 최소 간격이다. CarMode, FlightMode 는 매 프레임(16ms)
 * set 을 부르므로 이 제한이 없으면 초당 수천 번 cancelScheduledValues 가 걸려 GLIDE 가 끝까지
 * 돌지 못한다. GLIDE 보다 짧게 둬야 다음 예약이 이전 램프 위에 겹쳐 이어지고, 소리가 주기마다
 * 계단처럼 끊기지 않는다. */
const MIN_APPLY_INTERVAL = 0.05;
/** 이 이하 절대값은 0 에 가깝다고 본다. exponentialRampToValueAtTime 은 0 을 받지 못해 모든 목표값에
 * 바닥(1e-4 안팎) 을 깔아 두는데, 그 구간에서는 상대 오차가 잡음처럼 튀어 절대 오차로 비교한다. */
const NEAR_ZERO = 1e-3;
/** 절대값이 NEAR_ZERO 를 넘는 값끼리는 이 비율 이상 벌어져야 다시 램프를 건다. */
const CHANGE_RATIO = 0.01;

function ramp(param, value, now, seconds = GLIDE) {
  if (!param) return;
  const safe = Math.max(1e-4, finite(value));
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(1e-4, param.value), now);
  param.exponentialRampToValueAtTime(safe, now + seconds);
}

/** prev 대비 next 가 의미 있게 바뀌었는지다. prev 가 없으면(처음 적용) 항상 바뀐 것으로 본다. */
function changedEnough(prev, next) {
  if (prev == null) return true;
  const diff = Math.abs(next - prev);
  if (Math.abs(prev) <= NEAR_ZERO || Math.abs(next) <= NEAR_ZERO) return diff > NEAR_ZERO;
  return diff / Math.abs(prev) > CHANGE_RATIO;
}

/** 엔진 목소리 하나를 만든다. 반환된 핸들의 set 으로 값을 바꾸고 stop 으로 끈다.
 * WebAudio 가 없거나 모르는 기종이면 아무것도 하지 않는 핸들을 준다. */
export function createEngineVoice(key) {
  const spec = engineSpec(key);
  const ctx = spec ? audioContext() : null;
  if (!ctx) return { set() {}, stop() {} };

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(1e-4, now);
  // 엔진은 효과음 리미터를 거치지 않는다. 물리면 폭발마다 엔진이 눌려 들린다.
  master.connect(engineOut(ctx));

  // 몸통이다. 피스톤과 프로펠러는 톱니가 폭발과 날개 통과를 잘 흉내 낸다.
  // 터빈은 낮은 울림이라 삼각파를 쓴다. 로터는 몸통을 소리로 내지 않고 잡음을 때리는 데만 쓴다.
  const body = ctx.createOscillator();
  body.type = spec.kind === 'turbine' ? 'triangle' : 'sawtooth';
  const bodyCut = ctx.createBiquadFilter();
  bodyCut.type = 'lowpass';
  bodyCut.Q.value = 0.9;
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(spec.kind === 'rotor' ? 1e-4 : 0.34, now);
  body.connect(bodyCut).connect(bodyGain).connect(master);
  body.start(now);

  // 한 옥타브 아래 사인이다. 엔진의 무게가 여기서 나온다. 톱니 하나만 쓰면
  // 저역이 비어 소리가 얇고 앵앵거린다. 사인이라 고조파를 더하지 않고 몸집만 키운다.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(1e-4, now);
  sub.connect(subGain).connect(master);
  sub.start(now);

  // 휘파람이다. 터빈과 로터만 쓴다.
  let whine = null, whineGain = null;
  if (spec.whine > 0) {
    whine = ctx.createOscillator();
    whine.type = 'sine';
    whineGain = ctx.createGain();
    // 섞는 양이다. 터빈에서 이 값이 크면 진공청소기 소리가 난다.
    whineGain.gain.setValueAtTime(spec.mix ?? 0.16, now);
    whine.connect(whineGain).connect(master);
    whine.start(now);
  }

  // 공기다. 잡음을 걸러 배기와 바람을 만든다.
  const air = ctx.createBufferSource();
  air.buffer = sharedNoise(ctx);
  air.loop = true;
  const airCut = ctx.createBiquadFilter();
  airCut.type = 'bandpass';
  airCut.frequency.setValueAtTime(700, now);
  airCut.Q.value = 0.6;
  const airGain = ctx.createGain();
  airGain.gain.setValueAtTime(0.1, now);
  air.connect(airCut).connect(airGain).connect(master);
  air.start(now);

  // 박동이다. 로터와 프로펠러만 쓴다. 몸통 주파수로 공기 크기를 때린다.
  const beat = ctx.createOscillator();
  beat.type = 'sine';
  const beatDepth = ctx.createGain();
  beatDepth.gain.setValueAtTime(0, now);
  beat.connect(beatDepth).connect(airGain.gain);
  beat.start(now);

  let stopped = false;
  // set 이 실제로 예약을 건 시각과 그때 건 목표값이다. 다음 호출은 이 값과 비교해
  // 주기와 변화폭을 함께 판단한다. stop 은 이 상태를 거치지 않고 곧장 예약한다.
  let lastApplyAt = -Infinity;
  const lastApplied = {};

  return {
    /** input 은 { throttle, rpm, boost, shift } 다. 매 프레임 불러도 된다. 노드를 새로 만들지 않는다.
     * 실제 AudioParam 예약은 MIN_APPLY_INTERVAL 마다, 그리고 값이 의미 있게 바뀐 파라미터에만 건다. */
    set(input) {
      if (stopped) return;
      const target = engineTargets(key, input);
      if (!target) return;
      const at = ctx.currentTime;
      if (at - lastApplyAt < MIN_APPLY_INTERVAL) return;
      lastApplyAt = at;

      const apply = (field, param, value) => {
        if (!param || !changedEnough(lastApplied[field], value)) return;
        ramp(param, value, at);
        lastApplied[field] = value;
      };

      apply('body', body.frequency, Math.max(8, target.body));
      apply('cut', bodyCut.frequency, Math.max(40, target.cut));
      // 서브는 늘 한 옥타브 아래다. 로터는 16Hz 대라 8Hz 가 되므로 바닥을 둔다.
      apply('subFreq', sub.frequency, Math.max(18, target.body / 2));
      apply('subGain', subGain.gain, Math.max(1e-4, target.sub * 0.5));
      apply('whineFreq', whine?.frequency, Math.max(20, target.whine));
      // 공기 대역은 차단과 따로 간다. 몸통이 어두워도 바람은 살아 있어야 한다.
      apply('airHz', airCut.frequency, Math.max(200, target.airHz));
      apply('airGain', airGain.gain, Math.max(0.004, target.air));
      // 박동 깊이는 공기 크기에 비례한다. 공기가 작으면 때려도 들리지 않는다.
      apply('beatGain', beatDepth.gain, Math.max(1e-4, target.air * target.beat));
      if (target.beat > 0) apply('beatFreq', beat.frequency, Math.max(3, target.body));
      // 전체 크기도 다른 값과 같은 속도로 옮긴다. FADE 는 시동과 정지에만 쓴다.
      // 여기서 FADE 를 쓰면 0.1초 남짓한 변속 끊김이 뭉개져 들리지 않는다.
      apply('masterGain', master.gain, Math.max(0.002, target.gain));
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const at = ctx.currentTime;
      // 꺼질 때도 램프를 준다. 바로 끊으면 딱 소리가 난다.
      ramp(master.gain, 0.0001, at, FADE);
      for (const node of [body, sub, whine, air, beat]) node?.stop?.(at + FADE + 0.05);
      setTimeout(() => {
        for (const node of [master, bodyGain, bodyCut, subGain, airGain, airCut, beatDepth, whineGain]) node?.disconnect?.();
      }, (FADE + 0.2) * 1000);
    },
  };
}
