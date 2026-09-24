import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, createEngineVoice, engineSpec, engineTargets, firingHz } from '../../src/world/engineSound.js';
import { IDLE_RPM, MAX_RPM } from '../../src/world/carGauges.js';
import { PLANE_KEYS, VEHICLE_KEYS } from '../../src/world/identity.js';

test('모든 탈것에 엔진 소리가 있다', () => {
  for (const key of [...PLANE_KEYS, ...VEHICLE_KEYS]) {
    assert.ok(engineSpec(key), `${key} 엔진`);
    assert.ok(engineTargets(key, { throttle: 0.5, rpm: 3000 }), `${key} 목표값`);
  }
  assert.equal(engineSpec('walk'), null, '도보는 엔진이 없다');
  assert.equal(engineTargets('walk', {}), null);
});

test('스로틀을 올리면 소리가 높고 커진다', () => {
  for (const key of Object.keys(ENGINES)) {
    if (key === 'electric') continue; // EV has no idle voice and its tone follows speed.
    const idle = engineTargets(key, { throttle: 0, rpm: IDLE_RPM });
    const full = engineTargets(key, { throttle: 1, rpm: MAX_RPM });
    assert.ok(full.body >= idle.body, `${key} 주파수 ${idle.body} -> ${full.body}`);
    assert.ok(full.gain > idle.gain, `${key} 크기 ${idle.gain} -> ${full.gain}`);
    assert.ok(full.cut > idle.cut, `${key} 밝기 ${idle.cut} -> ${full.cut}`);
  }
});

test('모든 값이 유한하고 양수이며 비정상 입력을 견딘다', () => {
  const inputs = [{}, { throttle: NaN, rpm: NaN }, { throttle: -5, rpm: -900 }, { throttle: 9, rpm: 1e9 }];
  for (const key of Object.keys(ENGINES)) {
    for (const input of inputs) {
      const target = engineTargets(key, input);
      for (const field of ['body', 'sub', 'whine', 'air', 'airHz', 'gain', 'cut', 'beat']) {
        assert.ok(Number.isFinite(target[field]), `${key} ${field} 가 유한하다`);
        assert.ok(target[field] >= 0, `${key} ${field} 가 음수가 아니다`);
      }
      assert.ok(target.body > 0, `${key} 공회전에도 소리가 돈다`);
    }
  }
});

test('엔진 소리가 서로 다른 음역을 쓴다', () => {
  const full = (key) => engineTargets(key, { throttle: 1, rpm: MAX_RPM });
  // 폭격기는 가장 낮고 요격기는 가장 높다.
  assert.ok(full('bomber').body < full('interceptor').body, '폭격기가 더 낮다');
  assert.ok(full('interceptor').whine > full('jet').whine, '요격기가 더 날카롭다');
  // 헬기는 박동이 있고 제트는 없다.
  assert.ok(full('helicopter').beat > 0, '헬기는 로터 박동이 있다');
  assert.equal(full('jet').beat, 0, '제트는 박동이 없다');
  assert.equal(full('sedan').whine, 0, '피스톤 엔진은 휘파람이 없다');
});

test('부스트는 요격기 휘파람만 올린다', () => {
  const plain = engineTargets('interceptor', { throttle: 1 });
  const boosted = engineTargets('interceptor', { throttle: 1, boost: true });
  assert.ok(boosted.whine > plain.whine, `부스트 ${boosted.whine} 순항 ${plain.whine}`);
  assert.ok(boosted.gain > plain.gain);
  // 부스트가 없는 기종은 값이 그대로다.
  assert.deepEqual(engineTargets('sedan', { throttle: 1, rpm: 3000, boost: true }),
    engineTargets('sedan', { throttle: 1, rpm: 3000 }));
});

test('디젤은 낮게 깔리되 회전 전 구간에서 음이 움직인다', () => {
  // 예전에는 기통 수로 계산한 값을 상한으로 잘라, 12기통이 회전 전 구간에서 같은 음을 냈다.
  // 그러면 변속이 소리로 드러나지 않는다.
  const low = engineTargets('tank', { throttle: 1, rpm: IDLE_RPM });
  const high = engineTargets('tank', { throttle: 1, rpm: MAX_RPM });
  assert.ok(high.body > low.body * 2, `전차 ${low.body} -> ${high.body}Hz`);
  assert.ok(high.body < engineTargets('sedan', { throttle: 1, rpm: MAX_RPM }).body, '승용차보다 낮다');
  // 4기통 3000rpm 은 100Hz 다. 표를 정할 때 쓴 식이다.
  assert.equal(firingHz(3000, 4), 100);
});

test('모든 피스톤 엔진이 회전에 따라 음이 오른다', () => {
  for (const [key, spec] of Object.entries(ENGINES)) {
    if (spec.kind !== 'piston') continue;
    assert.ok(spec.bodyRed > spec.bodyIdle, `${key} 레드존이 공회전보다 높다`);
    const low = engineTargets(key, { throttle: 1, rpm: IDLE_RPM });
    const high = engineTargets(key, { throttle: 1, rpm: MAX_RPM });
    assert.ok(high.body > low.body * 1.8, `${key} ${low.body} -> ${high.body}Hz`);
  }
});

test('변속 순간에는 힘이 빠진다', () => {
  for (const key of ['sedan', 'tank', 'aa']) {
    const steady = engineTargets(key, { throttle: 1, rpm: 5000 });
    const shifting = engineTargets(key, { throttle: 1, rpm: 5000, shift: 1 });
    assert.ok(shifting.gain < steady.gain * 0.5, `${key} 크기 ${steady.gain} -> ${shifting.gain}`);
    assert.ok(shifting.air < steady.air, `${key} 배기도 같이 죽는다`);
    assert.ok(shifting.cut < steady.cut, `${key} 잠깐 탁해진다`);
    // 음높이는 회전수가 정한다. 끊김이 음을 옮기지는 않는다.
    assert.equal(shifting.body, steady.body);
    // 끊김이 풀리면 원래대로 돌아온다.
    assert.deepEqual(engineTargets(key, { throttle: 1, rpm: 5000, shift: 0 }), steady);
  }
  // 터빈과 로터는 변속이 없다. 값이 그대로다.
  for (const key of ['jet', 'helicopter', 'prop']) {
    assert.deepEqual(engineTargets(key, { throttle: 1, shift: 1 }), engineTargets(key, { throttle: 1 }));
  }
});

test('WebAudio 가 없으면 조용히 넘어간다', () => {
  // 테스트 환경에는 window 가 없다. 핸들은 있어야 하고 불러도 터지지 않아야 한다.
  const voice = createEngineVoice('jet');
  assert.equal(typeof voice.set, 'function');
  assert.equal(typeof voice.stop, 'function');
  voice.set({ throttle: 1 });
  voice.stop();
  voice.stop();
  const none = createEngineVoice('walk');
  none.set({ throttle: 1 });
  none.stop();
});

test('저역 통과가 기본 주파수를 따라가 고조파가 새지 않는다', () => {
  // 차단을 Hz 로 고정하면 회전이 낮은 엔진이 고조파를 수십 개씩 낸다. 그것이 앵앵거림이다.
  for (const key of Object.keys(ENGINES)) {
    if (key === 'electric') continue;
    for (const rpm of [IDLE_RPM, 3000, MAX_RPM]) {
      const target = engineTargets(key, { throttle: 1, rpm });
      const overtones = target.cut / target.body;
      assert.ok(overtones <= 9, `${key} rpm ${rpm} 에서 고조파 ${overtones.toFixed(0)} 개`);
      assert.ok(overtones >= 4, `${key} rpm ${rpm} 에서 너무 어둡다 ${overtones.toFixed(0)}`);
    }
  }
});

test('electric drive is silent at rest and gains only speed-dependent motor and wind tone', () => {
  assert.equal(engineSpec('electric').kind, 'electric');
  const idle = engineTargets('electric', { speed: 0, power: 0 });
  const rolling = engineTargets('electric', { speed: 24, power: .5 });
  assert.equal(idle.gain, 0);
  assert.equal(idle.air, 0);
  assert.ok(rolling.gain > 0 && rolling.whine > idle.whine && rolling.air > 0);
  assert.deepEqual(engineTargets('electric', { speed: 24, power: .5, shift: 1 }), rolling);
});

test('한 옥타브 아래 저역이 엔진에 무게를 준다', () => {
  for (const key of Object.keys(ENGINES)) {
    if (key === 'electric') continue;
    const target = engineTargets(key, { throttle: 1, rpm: 3000 });
    assert.ok(target.sub > 0, `${key} 서브가 있다`);
    assert.ok(target.sub <= 1, `${key} 서브가 1 을 넘지 않는다`);
  }
  // 큰 엔진일수록 두껍다. 폭격기와 전차가 승용차보다 무겁다.
  const weight = (key) => engineTargets(key, { throttle: 1, rpm: 3000 }).sub;
  assert.ok(weight('bomber') > weight('jet'), '폭격기가 제트보다 두껍다');
  assert.ok(weight('tank') > weight('sedan'), '전차가 승용차보다 두껍다');
});

test('공기 대역은 저역 차단과 따로 간다', () => {
  // 예전에는 공기 대역이 차단의 0.8배로 묶여 있어 몸통을 어둡게 하면 바람까지 죽었다.
  // 지금은 기종마다 비율이 다르다. 하나로 묶여 있으면 이 값이 모두 같다.
  const ratios = Object.keys(ENGINES).map((key) => {
    const target = engineTargets(key, { throttle: 1, rpm: MAX_RPM });
    return Math.round((target.airHz / target.cut) * 100);
  });
  assert.ok(new Set(ratios).size > 3, `비율이 ${new Set(ratios).size} 가지뿐이다`);
  // 항공기는 몸통이 어둡고 바람이 크다. 바람이 차단 위에 있어야 제트로 들린다.
  for (const key of ['jet', 'fighter', 'bomber', 'interceptor', 'helicopter', 'prop']) {
    const target = engineTargets(key, { throttle: 1 });
    assert.ok(target.airHz > target.cut, `${key} 바람 ${target.airHz.toFixed(0)} 이 차단 ${target.cut.toFixed(0)} 보다 위다`);
  }
});
