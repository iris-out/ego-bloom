import test from 'node:test';
import assert from 'node:assert/strict';
import { POLICY, createResolutionTrack, stepResolution } from '../../src/world/adaptiveResolution.js';

/** 합성 프레임 열을 넣고 바뀐 dpr 을 시각과 함께 기록한다. next 는 지금 dpr 을 보고 다음 프레임 시간을 준다. */
function run(track, seconds, next, piloting = false, from = 0) {
  const changes = [];
  let now = from, dpr = track.dpr;
  while (now - from < seconds) {
    const dt = next(dpr, now);
    now += dt;
    const result = stepResolution(track, dt, now, piloting);
    if (result.dpr !== dpr) { changes.push({ at: now, dpr: result.dpr }); dpr = result.dpr; }
  }
  return { changes, dpr, now };
}

const fixed = (dt) => () => dt;

test('첫 warmup 초 안에는 어떤 입력에도 dpr 이 바뀌지 않는다', () => {
  for (const dt of [0.008, 0.021, 0.173, 0.5]) {
    const track = createResolutionTrack(1);
    const { changes } = run(track, POLICY.warmup - 0.05, fixed(dt));
    assert.equal(changes.length, 0, `${dt}초 프레임`);
  }
});

test('실측 분포(21.3ms 와 173ms 섞임) 60초에 변경이 3회를 넘지 않는다', () => {
  const track = createResolutionTrack(1);
  let i = 0;
  // 20초 표본의 실측이다. 프레임 500개 가운데 144개가 33ms 를 넘었다.
  const { changes } = run(track, 60, () => { i += 1; return i % 7 < 2 ? 0.173 : 0.0213; });
  assert.ok(changes.length <= 3, `변경 ${changes.length}회`);
});

test('어떤 입력에서도 두 변경 사이가 cooldown 보다 좁지 않다', () => {
  const cases = [fixed(0.05), fixed(0.2), (dpr) => (dpr > 0.9 ? 0.05 : 0.02),
    (dpr, now) => (Math.floor(now * 3) % 2 ? 0.034 : 0.03)];
  for (const shape of cases) {
    const track = createResolutionTrack(1);
    const { changes } = run(track, 180, shape);
    for (let i = 1; i < changes.length; i += 1) {
      assert.ok(changes[i].at - changes[i - 1].at >= POLICY.cooldown - 1e-9,
        `간격 ${(changes[i].at - changes[i - 1].at).toFixed(2)}초`);
    }
  }
});

test('임계값 근처를 오가는 입력에도 전환 횟수가 상한 안에 묶인다', () => {
  const track = createResolutionTrack(1);
  let i = 0;
  const { changes } = run(track, 240, () => { i += 1; return i % 3 ? 0.0335 : 0.0325; });
  assert.ok(changes.length <= POLICY.maxChanges, `변경 ${changes.length}회`);
});

test('내림이 넘김 비율을 못 낮추면 되돌리고 그 뒤로는 바뀌지 않는다', () => {
  const track = createResolutionTrack(1);
  // 화소 수와 무관하게 늘 50ms 다. 실측의 scriptPct 가 높은 주행 장면이 이 경우다.
  const { changes, dpr } = run(track, 120, fixed(0.05));
  assert.equal(changes.length, 2, '내림 한 번과 되돌림 한 번뿐이다');
  assert.ok(changes[0].dpr < 1);
  assert.equal(changes[1].dpr, 1);
  assert.equal(dpr, 1);
  assert.equal(track.locked, true);
});

test('내림이 효과가 있으면 되돌리지 않고 계속 밀리면 한 단 더 내려간다', () => {
  const track = createResolutionTrack(1);
  let i = 0;
  // 화소 수에 묶인 장면이다. 한 단 내리면 절반만 넘고 두 단 내리면 다 들어온다.
  const { changes, dpr } = run(track, 120, (current) => {
    i += 1;
    if (current > 0.95) return 0.05;
    if (current > 0.8) return i % 2 ? 0.05 : 0.02;
    return 0.02;
  }, true);
  assert.ok(changes.length >= 2, `변경 ${changes.length}회`);
  assert.equal(dpr, POLICY.floor, '바닥까지 두 단이다');
  assert.ok(changes.every((change) => change.dpr <= 1));
});

test('조종 중에는 여유가 아무리 커도 올리지 않는다', () => {
  const track = createResolutionTrack(1);
  const dropped = run(track, 12, fixed(0.05), true);
  assert.equal(dropped.changes.length, 1);
  const lowered = dropped.dpr;
  assert.ok(lowered < 1);
  const quiet = run(track, 20, fixed(0.008), true, dropped.now);
  assert.equal(quiet.changes.length, 0, '조종 중에는 올리지 않는다');
  assert.equal(quiet.dpr, lowered);
  const free = run(track, 40, fixed(0.008), false, quiet.now);
  assert.equal(free.dpr, 1, '조감 카메라에서는 되돌린다');
});

test('품질 등급이 정한 dpr 을 넘지 않고 바닥 아래로도 내려가지 않는다', () => {
  const track = createResolutionTrack(1.5);
  let i = 0;
  const { changes } = run(track, 300, () => { i += 1; return i % 5 ? 0.2 : 0.004; });
  for (const change of changes) {
    assert.ok(change.dpr <= 1.5 + 1e-9, `${change.dpr} 가 등급 상한을 넘었다`);
    assert.ok(change.dpr >= 1.5 * POLICY.floor - 1e-9, `${change.dpr} 가 바닥 아래다`);
  }
});

test('값이 이상하면 아무것도 하지 않는다', () => {
  const track = createResolutionTrack(1);
  assert.equal(stepResolution(track, NaN, 1).dpr, 1);
  assert.equal(stepResolution(track, 0.02, NaN).dpr, 1);
});
