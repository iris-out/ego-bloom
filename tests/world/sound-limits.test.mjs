import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_RULES, createVoiceState, mergeGain, planVoice } from '../../src/world/soundLimits.js';

/** 호출을 차례로 흘려 보내고 계획만 모은다. WebAudio 는 쓰지 않는다. */
function run(calls, state = createVoiceState()) {
  const plans = [];
  let current = state;
  for (const [kind, now] of calls) {
    const result = planVoice(current, kind, now);
    current = result.state;
    plans.push(result.plan);
  }
  return { state: current, plans };
}

test('같은 프레임의 폭발 셋이 소리 하나로 합쳐진다', () => {
  const { plans } = run([['boom', 0], ['boom', 0], ['boom', 0]]);
  assert.equal(plans[0].merged, false, '첫 소리는 새로 난다');
  assert.equal(plans[1].merged, true);
  assert.equal(plans[2].merged, true);
  assert.equal(plans[1].id, plans[0].id, '같은 소리를 키운다');
  assert.equal(plans[2].id, plans[0].id);
  assert.ok(plans[2].gain > plans[0].gain, `이득이 커진다 ${plans[0].gain} -> ${plans[2].gain}`);
  assert.ok(plans[2].gain <= VOICE_RULES.boom.max, '상한을 넘지 않는다');
});

test('한 프레임 뒤는 합치고 합칠 창을 넘기면 새 소리다', () => {
  const late = VOICE_RULES.boom.merge + 0.01;
  const { plans } = run([['boom', 0], ['boom', 1 / 60], ['boom', late]]);
  assert.equal(plans[1].merged, true, '16.7ms 뒤는 같은 소리다');
  assert.equal(plans[2].merged, false, '35ms 를 넘기면 새 소리다');
  assert.notEqual(plans[2].id, plans[0].id);
});

test('동시 발성 상한을 넘으면 오래된 소리를 밀어내고 새 소리는 반드시 난다', () => {
  const { plans } = run([['boom', 0], ['boom', 0.1], ['boom', 0.2], ['boom', 0.3]]);
  assert.equal(plans.filter((plan) => plan.steal).length, 1, '상한 전에는 밀어내지 않는다');
  const last = plans[3];
  assert.equal(last.merged, false);
  assert.ok(last.gain > 0, '새 소리는 언제나 난다');
  assert.equal(last.steal.id, plans[0].id, '가장 이른 소리가 밀려난다');
  assert.equal(last.steal.fade, VOICE_RULES.boom.fade);
});

test('수명이 지난 소리는 자리를 다시 내준다', () => {
  const first = run([['boom', 0], ['boom', 0.1], ['boom', 0.2]]);
  const after = VOICE_RULES.boom.life + 0.25;
  const next = planVoice(first.state, 'boom', after);
  assert.equal(next.plan.steal, null, '만료된 소리는 밀어낼 것도 없다');
  assert.equal(next.state.active.length, 1, '만료된 소리는 사라진다');
});

test('어떤 호출 순서에서도 소리가 사라지지 않는다', () => {
  const kinds = Object.keys(VOICE_RULES);
  let state = createVoiceState();
  for (let i = 0; i < 400; i++) {
    const kind = kinds[i % kinds.length];
    const now = (i % 7) * 0.013 + Math.floor(i / 7) * 0.05;
    const { state: next, plan } = planVoice(state, kind, now);
    state = next;
    assert.ok(plan.gain > 0, `${kind} 이득 ${plan.gain}`);
    assert.ok(Number.isFinite(plan.startAt), `${kind} 시작 시각`);
  }
});

test('시간이 비정상이어도 던지지 않고 유한한 시작 시각을 준다', () => {
  let state = createVoiceState();
  for (const now of [NaN, undefined, -5, 1e6, 1, Infinity]) {
    const result = planVoice(state, 'boom', now);
    state = result.state;
    assert.ok(Number.isFinite(result.plan.startAt), `${now} 에서 유한하다`);
    assert.ok(result.plan.gain > 0);
  }
});

test('내가 터지는 소리는 합쳐지지도 남의 폭발에 밀려나지도 않는다', () => {
  const { state, plans } = run([['boomSelf', 0], ['boomSelf', 0]]);
  assert.equal(plans[0].merged, false);
  assert.equal(plans[1].merged, false, '합치지 않는다');

  const mine = run([['boomSelf', 0]]);
  const others = run([['boom', 0.1], ['boom', 0.2], ['boom', 0.3], ['boom', 0.4]], mine.state);
  for (const plan of others.plans) {
    assert.notEqual(plan.steal?.id, mine.plans[0].id, '남의 폭발이 내 폭발을 밀어내지 않는다');
  }
  assert.ok(others.state.active.some((voice) => voice.kind === 'boomSelf'), '내 폭발이 남아 있다');
  assert.ok(state.active.length >= 1);
});

test('합친 이득은 개수에 비례하지 않는다', () => {
  const rule = VOICE_RULES.boom;
  assert.equal(mergeGain(1, rule), 1);
  assert.ok(mergeGain(3, rule) < 3 * mergeGain(1, rule), '셋이 세 배가 되지 않는다');
  assert.equal(mergeGain(50, rule), rule.max, '아무리 많아도 상한이다');
  assert.equal(mergeGain(NaN, rule), 1, '이상한 개수는 하나로 본다');
  assert.equal(mergeGain(2, VOICE_RULES.once), 1, '합치지 않는 규칙은 이득이 그대로다');
});

test('소닉붐은 짧은 기계음 여러 번에 밀려나지 않는다', () => {
  let state = createVoiceState();
  const sonic = planVoice(state, 'sonic', 40);
  state = sonic.state;
  const stolen = [];
  for (let i = 1; i <= 5; i += 1) {
    const next = planVoice(state, 'once', 40 + i * 0.1);
    state = next.state;
    if (next.plan.steal) stolen.push(next.plan.steal.id);
  }
  assert.ok(!stolen.includes(sonic.plan.id), '음속 돌파는 한 번뿐인 사건이라 자리를 뺏기면 안 된다');
});
