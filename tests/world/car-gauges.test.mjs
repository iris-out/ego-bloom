import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_BANDS, IDLE_RPM, MAX_RPM, SHIFT_RPM, gaugeTicks, needleAngle, tachometer } from '../../src/world/carGauges.js';

test('멈춰 있으면 1단 공회전이고 속도가 오르면 단수가 올라간다', () => {
  const stop = tachometer(0, 200);
  assert.equal(stop.gear, 1);
  assert.equal(stop.rpm, IDLE_RPM);

  const gears = [10, 60, 100, 140, 190].map((speed) => tachometer(speed, 200).gear);
  assert.deepEqual(gears, [1, 2, 3, 4, 5]);
  assert.equal(tachometer(200, 200).gear, GEAR_BANDS.length);
});

test('단 안에서 회전수가 오르고 변속하면 떨어진다', () => {
  const top = 200;
  const low = tachometer(top * 0.2, top);   // 1단 끝
  const shifted = tachometer(top * 0.24, top); // 2단 시작
  assert.equal(low.gear, 1);
  assert.equal(shifted.gear, 2);
  assert.ok(low.rpm > shifted.rpm, `변속 전 ${low.rpm}, 변속 후 ${shifted.rpm}`);
  assert.ok(tachometer(top, top).rpm >= SHIFT_RPM - 1, '최고 속도에서 변속 회전수에 닿는다');
  assert.ok(tachometer(top * 2, top).rpm <= MAX_RPM, '눈금을 넘지 않는다');
});

test('후진과 비정상 입력에도 계기가 숫자를 낸다', () => {
  for (const [speed, top] of [[-40, 200], [NaN, 200], [50, NaN], [50, 0], [Infinity, 200]]) {
    const read = tachometer(speed, top);
    assert.ok(Number.isFinite(read.rpm) && read.rpm >= IDLE_RPM, `rpm ${read.rpm}`);
    assert.ok(Number.isInteger(read.gear) && read.gear >= 1);
  }
  // 후진은 속도의 크기만 본다. 바늘이 음수로 돌지 않는다.
  assert.equal(tachometer(-40, 200).rpm, tachometer(40, 200).rpm);
});

test('바늘 각도와 눈금이 왼쪽 끝에서 오른쪽 끝으로 간다', () => {
  assert.equal(needleAngle(0, 100), -215);
  assert.equal(needleAngle(100, 100), 35);
  assert.equal(needleAngle(200, 100), 35, '최대를 넘어도 끝에서 멈춘다');
  assert.ok(Number.isFinite(needleAngle(NaN, NaN)));

  const ticks = gaugeTicks(8000, 9);
  assert.equal(ticks.length, 9);
  assert.equal(ticks[0].value, 0);
  assert.equal(ticks[8].value, 8000);
  assert.ok(ticks.every((tick) => Number.isFinite(tick.angle)));
});
