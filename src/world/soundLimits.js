/** 한 종류의 소리를 아주 짧은 간격 안에 여러 번 부를 때의 규칙이다.
 * 차 다섯 대가 한 프레임에 터지면 같은 폭발음이 다섯 겹으로 쌓여 찢어진다.
 * 여기서 합칠 창과 동시 발성 상한을 정하고 WebAudio 는 전혀 모른다.
 *
 * merge 는 합칠 창(초), voices 는 동시 발성 상한, life 는 소리가 차지하는 길이(초),
 * fade 는 오래된 소리를 밀어낼 때의 페이드(초), max 와 curve 는 합칠 때의 이득이다. */
export const VOICE_RULES = Object.freeze({
  boom: { merge: 0.035, voices: 3, life: 1.5, fade: 0.12, max: 1.7, curve: 0.45 },
  // 내가 터지는 소리는 합치지 않는다. 남의 폭발에 묻히면 안 되는 소리다.
  boomSelf: { merge: 0, voices: 1, life: 2.6, fade: 0.18, max: 1, curve: 0 },
  tick: { merge: 0.02, voices: 4, life: 0.06, fade: 0.02, max: 1.4, curve: 0.4 },
  hit: { merge: 0.035, voices: 2, life: 0.15, fade: 0.04, max: 1.3, curve: 0.4 },
  cannon: { merge: 0.02, voices: 4, life: 0.06, fade: 0.02, max: 1.2, curve: 0.3 },
  shot: { merge: 0.02, voices: 3, life: 0.42, fade: 0.05, max: 1.2, curve: 0.3 },
  tankShot: { merge: 0.03, voices: 2, life: 0.34, fade: 0.06, max: 1.3, curve: 0.4 },
  // 소닉붐은 한 번 넘을 때 한 번뿐이라 짧은 기계음과 자리를 다투면 안 된다.
  sonic: { merge: 0, voices: 1, life: 1.25, fade: 0.1, max: 1, curve: 0 },
  // 이 규칙을 쓰는 소리 중 가장 긴 미사일 발사음이 0.42초다. 길게 잡으면 빈자리에 대고 밀어낸다.
  once: { merge: 0, voices: 4, life: 0.45, fade: 0.1, max: 1, curve: 0 },
});

const ruleOf = (kind) => VOICE_RULES[kind] || VOICE_RULES.once;

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

export function createVoiceState() {
  return { pending: {}, active: [], nextId: 1 };
}

/** 합친 소리의 이득이다. 개수에 비례하지 않는다. 세 대가 같이 터져도 한 대의 1.6배다.
 * 그대로 더하면 셋이 세 배가 되어 출력에서 잘린다. */
export function mergeGain(count, rule) {
  const spec = rule || VOICE_RULES.once;
  const n = Math.max(1, Math.floor(finite(count, 1)));
  const level = Math.min(finite(spec.max, 1), Math.pow(n, finite(spec.curve, 0)));
  return level > 0 ? level : 1;
}

/** 다음 한 번을 어떻게 낼지 정한다. 순수 함수다.
 * 반환은 { state, plan } 이고 plan 은 { id, gain, startAt, merged, steal } 이다.
 * merged 가 true 면 예약해 둔 소리의 이득만 올리고 노드를 새로 만들지 않는다.
 * plan.gain 은 어떤 경우에도 0 이 아니다. 소리가 사라지지 않는다. */
export function planVoice(state, kind, now) {
  const base = state || createVoiceState();
  const rule = ruleOf(kind);
  const at = finite(now, 0);
  // 만료는 타이머가 아니라 부를 때마다 센다. 순수하게 남기려면 이 방법뿐이다.
  const alive = (base.active || []).filter((voice) => voice.endsAt > at);

  const pending = base.pending || {};
  const waiting = pending[kind];
  if (waiting && waiting.startAt > at) {
    const count = waiting.count + 1;
    const gain = mergeGain(count, rule);
    return {
      state: {
        ...base,
        pending: { ...pending, [kind]: { ...waiting, count, gain } },
        active: alive.map((voice) => (voice.id === waiting.id ? { ...voice, gain } : voice)),
      },
      plan: { id: waiting.id, gain, startAt: waiting.startAt, merged: true, steal: null },
    };
  }

  const id = base.nextId || 1;
  const startAt = at + finite(rule.merge, 0);
  const gain = mergeGain(1, rule);
  // 자리를 세는 것도 밀어내는 것도 같은 kind 안에서만 한다. 폭발이 총성을 지우지 않는다.
  const sameKind = alive.filter((voice) => voice.kind === kind);
  let steal = null;
  let kept = alive;
  if (sameKind.length >= rule.voices) {
    const victim = sameKind.reduce((old, voice) => (voice.startAt < old.startAt ? voice : old));
    steal = { id: victim.id, fade: finite(rule.fade, 0) };
    kept = alive.filter((voice) => voice.id !== victim.id);
  }

  const fresh = { id, kind, startAt, endsAt: startAt + finite(rule.life, 0), gain, count: 1 };
  return {
    state: {
      pending: { ...pending, [kind]: fresh },
      active: [...kept, fresh],
      nextId: id + 1,
    },
    plan: { id, gain, startAt, merged: false, steal },
  };
}
