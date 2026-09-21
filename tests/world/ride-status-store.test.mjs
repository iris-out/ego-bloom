import test from 'node:test';
import assert from 'node:assert/strict';
import { getRideStatus, publishRideStatus, resetRideStatus, subscribeRideStatus } from '../../src/world/rideStatusStore.js';

test('publishRideStatus 는 즉시 getRideStatus 로 읽힌다', () => {
  publishRideStatus({ phase: 'runway', speed: 12 });
  assert.deepEqual(getRideStatus(), { phase: 'runway', speed: 12 });
});

test('publishRideStatus 는 구독자 전원을 부른다', () => {
  let a = 0, b = 0;
  const unsubA = subscribeRideStatus(() => { a += 1; });
  const unsubB = subscribeRideStatus(() => { b += 1; });
  publishRideStatus({ phase: 'airborne' });
  assert.equal(a, 1);
  assert.equal(b, 1);
  unsubA();
  publishRideStatus({ phase: 'crashed' });
  assert.equal(a, 1, '구독을 끊으면 더는 불리지 않는다');
  assert.equal(b, 2);
  unsubB();
});

test('resetRideStatus 는 빈 값으로 되돌리고 구독자에게 알린다', () => {
  publishRideStatus({ phase: 'runway', speed: 3 });
  let calls = 0;
  const unsub = subscribeRideStatus(() => { calls += 1; });
  resetRideStatus();
  assert.deepEqual(getRideStatus(), {});
  assert.equal(calls, 1);
  unsub();
});

test('publishRideStatus 에 값을 주지 않으면 빈 값으로 취급한다', () => {
  publishRideStatus(null);
  assert.deepEqual(getRideStatus(), {});
});
