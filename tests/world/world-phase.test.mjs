import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTDOWN_MS, COUNTDOWN_STEP_MS, acceptsInput, countdownStep, createWorldPhase, worldPhaseReducer } from '../../src/world/worldPhase.js';

const reduce = (state, ...actions) => actions.reduce(worldPhaseReducer, state);

test('처음 상태는 전경이고 입력을 받지 않는다', () => {
  const start = createWorldPhase();
  assert.equal(start.phase, 'establishing');
  assert.equal(start.ride, null);
  assert.equal(acceptsInput(start), false);
});

test('둘러보기는 자유 카메라를 연다', () => {
  const state = reduce(createWorldPhase(), { type: 'explore' });
  assert.equal(state.phase, 'exploring');
  assert.equal(acceptsInput(state), true);
});

test('선택 시트는 열고 닫아도 직전 카메라 상태로 돌아간다', () => {
  const explored = reduce(createWorldPhase(), { type: 'explore' });
  const opened = worldPhaseReducer(explored, { type: 'openPicker' });
  assert.equal(opened.phase, 'selecting');
  assert.equal(acceptsInput(opened), false);
  assert.equal(worldPhaseReducer(opened, { type: 'closePicker' }).phase, 'exploring');
  const fromStill = worldPhaseReducer(createWorldPhase(), { type: 'openPicker' });
  assert.equal(worldPhaseReducer(fromStill, { type: 'closePicker' }).phase, 'establishing');
});

test('타임어택으로 출발하면 mode 가 남고 모르는 값은 버린다', () => {
  const picking = reduce(createWorldPhase(), { type: 'openPicker' });
  const attack = worldPhaseReducer(picking, { type: 'launch', ride: { kind: 'car', key: 'tank', mode: 'timeAttack' }, now: 5 });
  assert.deepEqual(attack.ride, { kind: 'car', key: 'tank', mode: 'timeAttack' });
  const odd = worldPhaseReducer(picking, { type: 'launch', ride: { kind: 'car', key: 'tank', mode: 'cheat' }, now: 5 });
  assert.equal(odd.ride.mode, null);
});

test('출발하면 카운트다운을 거쳐 조종으로 간다', () => {
  const picking = reduce(createWorldPhase(), { type: 'openPicker' });
  const counting = worldPhaseReducer(picking, { type: 'launch', ride: { kind: 'flight', key: 'jet' }, now: 1000 });
  assert.equal(counting.phase, 'countdown');
  assert.deepEqual(counting.ride, { kind: 'flight', key: 'jet', mode: null });
  assert.equal(counting.countdownStartedAt, 1000);
  assert.equal(acceptsInput(counting), false);
  const driving = worldPhaseReducer(counting, { type: 'countdownDone' });
  assert.equal(driving.phase, 'driving');
  assert.equal(acceptsInput(driving), true);
});

test('카운트다운 단계는 0.5초마다 올라가고 1.5초에 GO 다', () => {
  const counting = reduce(createWorldPhase(), { type: 'openPicker' },
    { type: 'launch', ride: { kind: 'car', key: 'sedan' }, now: 0 });
  assert.equal(COUNTDOWN_STEP_MS, 500);
  assert.equal(COUNTDOWN_MS, 1500);
  assert.equal(countdownStep(counting, 0), 0);
  assert.equal(countdownStep(counting, 499), 0);
  assert.equal(countdownStep(counting, 500), 1);
  assert.equal(countdownStep(counting, 1400), 2);
  assert.equal(countdownStep(counting, 1500), 3);
  assert.equal(countdownStep(counting, 9000), 3);
});

test('조종을 끝내면 자유 카메라로 돌아가고 탈것이 비워진다', () => {
  const driving = reduce(createWorldPhase(), { type: 'openPicker' },
    { type: 'launch', ride: { kind: 'walk', key: 'walk' }, now: 0 }, { type: 'countdownDone' });
  const exited = worldPhaseReducer(driving, { type: 'exitRide' });
  assert.equal(exited.phase, 'exploring');
  assert.equal(exited.ride, null);
});

test('잘못된 전이는 상태를 바꾸지 않는다', () => {
  const start = createWorldPhase();
  assert.equal(worldPhaseReducer(start, { type: 'countdownDone' }), start);
  assert.equal(worldPhaseReducer(start, { type: 'exitRide' }), start);
  assert.equal(worldPhaseReducer(start, { type: 'nope' }), start);
  const bad = worldPhaseReducer(start, { type: 'launch', ride: null, now: 0 });
  assert.equal(bad, start);
});

test('활주로에 세운 비행기는 선택 시트를 열어 기종을 바꾸고, 취소하면 타던 기체로 돌아간다', () => {
  let state = { phase: 'driving', ride: { kind: 'flight', key: 'jet' }, countdownStartedAt: 0, resumePhase: 'exploring' };
  state = worldPhaseReducer(state, { type: 'openPicker' });
  assert.equal(state.phase, 'selecting');
  assert.equal(state.resumePhase, 'driving');
  const cancelled = worldPhaseReducer(state, { type: 'closePicker' });
  assert.equal(cancelled.phase, 'driving');
  assert.deepEqual(cancelled.ride, { kind: 'flight', key: 'jet' }, '취소는 타던 기체를 그대로 돌려준다');
  const swapped = worldPhaseReducer(state, { type: 'launch', ride: { kind: 'flight', key: 'fighter' }, now: 10 });
  assert.equal(swapped.phase, 'countdown');
  assert.deepEqual(swapped.ride, { kind: 'flight', key: 'fighter', mode: null });
});

test('카운트다운과 선택 중에는 시트를 다시 열지 못한다', () => {
  for (const phase of ['countdown', 'selecting']) {
    const state = { phase, ride: null, countdownStartedAt: 0, resumePhase: 'exploring' };
    assert.equal(worldPhaseReducer(state, { type: 'openPicker' }).phase, phase);
  }
});
