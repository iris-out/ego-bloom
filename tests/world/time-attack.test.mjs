import test from 'node:test';
import assert from 'node:assert/strict';
import { addTimeAttackScore, armTimeAttack, createTimeAttack, formatTimeAttack, stepTimeAttack, timeAttackView, TIME_ATTACK_SECONDS } from '../../src/world/timeAttack.js';

test('판을 걸면 첫 프레임이 시작 시각을 찍는다', () => {
  const armed = armTimeAttack();
  assert.equal(armed.phase, 'arming');
  const running = stepTimeAttack(armed, 42);
  assert.equal(running.phase, 'running');
  assert.equal(running.startedAt, 42);
  assert.equal(timeAttackView(running).remaining, TIME_ATTACK_SECONDS);
});

test('점수는 달리는 중에만 오른다', () => {
  assert.equal(addTimeAttackScore(createTimeAttack(), 1).score, 0, '걸지 않았으면 세지 않는다');
  let run = stepTimeAttack(armTimeAttack(), 0);
  run = addTimeAttackScore(run, 1);
  run = addTimeAttackScore(run, 2);
  assert.equal(run.score, 3);
  const done = stepTimeAttack(run, TIME_ATTACK_SECONDS);
  assert.equal(done.phase, 'done');
  assert.equal(addTimeAttackScore(done, 5).score, 3, '끝난 뒤에는 오르지 않는다');
});

test('3분이 지나면 끝나고 점수가 남는다', () => {
  let run = addTimeAttackScore(stepTimeAttack(armTimeAttack(), 10), 7);
  run = stepTimeAttack(run, 10 + TIME_ATTACK_SECONDS - 0.5);
  assert.equal(run.phase, 'running');
  assert.equal(timeAttackView(run).remaining, 1);
  run = stepTimeAttack(run, 10 + TIME_ATTACK_SECONDS);
  assert.deepEqual(timeAttackView(run), { phase: 'done', score: 7, remaining: 0 });
});

test('시계는 분과 초로 읽는다', () => {
  assert.equal(formatTimeAttack(TIME_ATTACK_SECONDS), '03:00');
  assert.equal(formatTimeAttack(61), '01:01');
  assert.equal(formatTimeAttack(0), '00:00');
  assert.equal(formatTimeAttack(NaN), '00:00');
});

test('이상한 값을 넣어도 무너지지 않는다', () => {
  assert.equal(stepTimeAttack(null, 1).phase, 'off');
  const running = stepTimeAttack(armTimeAttack(), 100);
  const skipped = stepTimeAttack(running, NaN);
  assert.equal(skipped.phase, 'running', '시각이 이상하면 그 프레임을 건너뛴다');
  assert.equal(skipped.startedAt, 100, '시작 시각이 흔들리지 않는다');
  assert.equal(addTimeAttackScore(stepTimeAttack(armTimeAttack(), 0), -3).score, 0);
  assert.equal(timeAttackView(null).phase, 'off');
});
