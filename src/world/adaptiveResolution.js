/** 렌더 해상도(dpr) 를 내릴지 올릴지 정하는 순수 판정이다. three, React, DOM 에 기대지 않아
 * 단위 테스트가 합성 프레임 열을 그대로 넣는다. 그리는 쪽은 AdaptiveResolution.jsx 다.
 *
 * 평균이 아니라 최근 창에서 예산을 넘긴 프레임의 비율로 본다. 평균은 긴 프레임 하나에 끌려가
 * 임계값 근처에서 떨리고, 한 번의 전환이 캔버스 버퍼를 다시 잡아 100ms 넘게 멈춘다.
 * 그래서 전환 자체를 세션당 몇 번으로 묶는 것이 목표다.
 */

export const POLICY = Object.freeze({
  /** 이 시간을 넘긴 프레임을 "넘김" 으로 센다. 30fps 한 프레임이다. */
  budget: 0.033,
  /** 넘김 비율을 세는 창(초) 이다. */
  window: 3,
  /** 내림은 넘김 비율이 이 값 이상으로 dropHold 초 이어질 때다. */
  dropRatio: 0.35, dropHold: 2.5,
  /** 올림은 넘김 비율이 이 값 미만으로 raiseHold 초 이어질 때다. 내림 기준과 7배를 벌려
   * 같은 상태가 두 조건을 동시에 만족하지 못하게 한다. */
  raiseRatio: 0.05, raiseHold: 15,
  /** 한 번 바꾸면 이만큼 다시 바꾸지 않는다. 세션당 변경은 maxChanges 회까지다. */
  cooldown: 8, maxChanges: 3,
  /** 한 단 내리는 비율과 바닥이다. 바닥 0.75 는 화소 56% 다. 그보다 내리면 흐림이 눈에 띈다. */
  step: 0.87, floor: 0.75,
  /** 도시 업로드와 미리 컴파일이 끝나기 전 프레임은 판정에 넣지 않는다. */
  warmup: 8,
  /** 내림 뒤 review 초의 넘김 비율이 gain 만큼 좋아지지 않으면 화소 수에 묶인 장면이 아니다.
   * 직전 dpr 로 한 번 되돌리고 고정한다. */
  review: 3, gain: 0.08,
  /** 올린 뒤 이 안에 다시 내려야 하면 그 세션에서는 올리기를 끈다. */
  bounce: 20,
  /** 한 표본의 상한이다. 탭 전환 같은 긴 멈춤을 프레임 하나로 본다. */
  sample: 0.25,
  /** 창을 담는 링 버퍼의 칸 수다. 3초 창이 이보다 길어지면 최근 칸만 본다. */
  slots: 512,
});

export function createResolutionTrack(base, policy = POLICY) {
  const dpr = Number.isFinite(base) && base > 0 ? base : 1;
  return {
    policy, base: dpr, dpr,
    at: new Float64Array(policy.slots), over: new Uint8Array(policy.slots),
    head: 0, size: 0, overs: 0,
    start: NaN, changed: -Infinity, changes: 0,
    dropFor: 0, raiseFor: 0,
    review: null, pending: null,
    raisedAt: -Infinity, raiseOff: false, locked: false,
  };
}

function push(track, now, over) {
  const slots = track.at.length;
  if (track.size === slots) {
    const tail = (track.head - track.size + slots) % slots;
    track.overs -= track.over[tail]; track.size -= 1;
  }
  track.at[track.head] = now; track.over[track.head] = over;
  track.overs += over; track.size += 1;
  track.head = (track.head + 1) % slots;
}

function evict(track, until) {
  const slots = track.at.length;
  while (track.size > 1) {
    const tail = (track.head - track.size + slots) % slots;
    if (track.at[tail] >= until) break;
    track.overs -= track.over[tail]; track.size -= 1;
  }
}

function commit(track, dpr, now) {
  track.dpr = dpr; track.changed = now; track.changes += 1;
  track.dropFor = 0; track.raiseFor = 0;
  return { track, dpr };
}

const round = (value) => Math.round(value * 100) / 100;

/** 한 단 내린 값이다. 바닥에서 한 단 안쪽이면 바로 바닥으로 내린다. 그래야 내려갈 자리가
 * 두 단이고 세션당 변경 상한 3회와 맞는다. */
function stepDown(dpr, floor, step) {
  const next = round(dpr * step);
  return next <= floor * 1.06 ? floor : Math.max(floor, next);
}

/** 프레임 시간 하나를 넣고 이번 프레임에 쓸 dpr 을 받는다. track 은 링 버퍼를 들고 있어
 * 그 자리에서 고쳐 쓰고 같은 객체를 돌려준다. piloting 이 참이면 올리지 않는다. */
export function stepResolution(track, sample, now, piloting = false) {
  const p = track.policy;
  if (!Number.isFinite(now) || !Number.isFinite(sample)) return { track, dpr: track.dpr };
  if (!Number.isFinite(track.start)) track.start = now;
  const dt = Math.min(Math.max(sample, 0), p.sample);
  push(track, now, dt > p.budget ? 1 : 0);
  evict(track, now - p.window);
  if (now - track.start < p.warmup) return { track, dpr: track.dpr };

  const ratio = track.size ? track.overs / track.size : 0;
  const check = track.review;
  if (check && now >= check.until) {
    track.review = null;
    if (check.before - ratio <= p.gain) track.pending = check.from;
  }
  track.dropFor = ratio >= p.dropRatio ? track.dropFor + dt : 0;
  track.raiseFor = ratio < p.raiseRatio ? track.raiseFor + dt : 0;

  if (track.locked) return { track, dpr: track.dpr };
  if (now - track.changed < p.cooldown) return { track, dpr: track.dpr };
  if (track.pending != null) {
    const back = track.pending;
    track.pending = null; track.locked = true;
    return commit(track, back, now);
  }
  if (track.changes >= p.maxChanges) return { track, dpr: track.dpr };

  const floor = track.base * p.floor;
  if (track.dropFor >= p.dropHold && track.dpr > floor + 0.005) {
    if (now - track.raisedAt < p.bounce) track.raiseOff = true;
    track.review = { until: now + p.review, before: ratio, from: track.dpr };
    return commit(track, stepDown(track.dpr, floor, p.step), now);
  }
  if (!piloting && !track.raiseOff && track.raiseFor >= p.raiseHold && track.dpr < track.base - 0.005) {
    track.raisedAt = now;
    return commit(track, Math.min(track.base, round(track.dpr / p.step)), now);
  }
  return { track, dpr: track.dpr };
}
