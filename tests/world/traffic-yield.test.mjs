import test from 'node:test';
import assert from 'node:assert/strict';
import { nextYieldLag, yieldBrake, YIELD_BRAKE_ZONE, YIELD_CATCHUP, YIELD_GAP, YIELD_LANE, YIELD_MAX, YIELD_REACH } from '../../src/world/trafficYield.js';
import { clearTrafficYield, trafficFrame, trafficPose, updateTrafficYield } from '../../src/world/traffic.js';

const EXTENT = 900, COUNT = 200;
/** +z 로 달리는 차 한 대다. 앞은 (sin angle, cos angle) 이므로 angle 0 이면 +z 다. */
const car = (gap) => ({ x: 0, z: 0, angle: 0, speed: 10, depth: 4.3 });
const player = (gap) => ({ x: 0, z: gap, width: 2.2, depth: 4.6 });

test('앞차가 가까울수록 세게 잡고 간격 안에서는 완전히 선다', () => {
  const half = 4.3 / 2 + 4.6 / 2;
  assert.equal(yieldBrake(car(), player(half + YIELD_GAP + YIELD_BRAKE_ZONE + 1)), 0, '멀면 그냥 간다');
  assert.ok(yieldBrake(car(), player(half + YIELD_GAP + YIELD_BRAKE_ZONE - 0.5)) < 0.1, '멀리서 살짝 잡기 시작한다');
  assert.equal(yieldBrake(car(), player(half + YIELD_GAP)), 1, '간격에 닿으면 완전히 선다');
  assert.equal(yieldBrake(car(), player(half + 0.5)), 1, '코앞이면 완전히 선다');
  assert.equal(yieldBrake(car(), player(-half)), 0, '지나쳐 뒤에 두면 다시 간다');
  const middle = yieldBrake(car(), player(half + YIELD_GAP + YIELD_BRAKE_ZONE / 2));
  assert.ok(middle > 0.3 && middle < 0.7, `중간에서 ${middle}`);
});

test('뒤나 옆 차선에 있는 차에는 서지 않는다', () => {
  assert.equal(yieldBrake(car(), { x: 0, z: -10, width: 2.2, depth: 4.6 }), 0, '뒤는 보지 않는다');
  assert.equal(yieldBrake(car(), { x: YIELD_LANE + 4, z: 10, width: 2.2, depth: 4.6 }), 0, '옆 차선은 보지 않는다');
  assert.equal(yieldBrake(null, player(10)), 0);
  assert.equal(yieldBrake(car(), null), 0);
});

test('늦춤은 한 걸음에 dt 보다 커지지 않고 앞이 비면 되돌아온다', () => {
  const stuck = player(6);
  let lag = 0;
  for (let i = 0; i < 1500; i += 1) lag = nextYieldLag(lag, car(), stuck, 1 / 60);
  assert.equal(lag, YIELD_MAX, '오래 막히면 상한에서 멈춘다');
  // 한 걸음에 dt 보다 많이 늦추면 차가 뒤로 간다.
  assert.ok(nextYieldLag(0, car(), stuck, 1 / 60) <= 1 / 60 + 1e-9);
  const freed = nextYieldLag(lag, car(), { x: 1e6, z: 1e6 }, 1 / 60);
  assert.ok(freed < lag && freed >= lag - YIELD_CATCHUP / 60 - 1e-9, '천천히 따라붙는다');
  assert.equal(nextYieldLag(0, car(), { x: 1e6, z: 1e6 }, 1 / 60), 0, '0 아래로 내려가지 않는다');
});

test('내 차가 서 있으면 뒤차가 뒤에 서고 떠나면 다시 달린다', () => {
  clearTrafficYield();
  let time = 30;
  trafficFrame(COUNT, time, EXTENT);
  const first = trafficPose(3, time, EXTENT);
  const ahead = { x: first.x + Math.sin(first.angle) * 20, z: first.z + Math.cos(first.angle) * 20, width: 2.2, depth: 4.6 };
  for (let i = 0; i < 300; i += 1) {
    updateTrafficYield(ahead, 1 / 60);
    time += 1 / 60;
    trafficFrame(COUNT, time, EXTENT);
  }
  const held = trafficPose(3, time, EXTENT);
  const gap = (ahead.x - held.x) * Math.sin(held.angle) + (ahead.z - held.z) * Math.cos(held.angle);
  assert.ok(gap > 6 && gap < 20, `앞차와 ${gap.toFixed(1)} 만큼 떨어져 선다`);
  assert.ok(held.speed < 1, `속도가 ${held.speed.toFixed(2)} 로 떨어진다`);
  assert.ok(held.braking > 0.5, '브레이크등이 켜진다');
  clearTrafficYield();
  const freed = trafficPose(3, time, EXTENT);
  assert.ok(freed.speed > 1, '늦춤을 풀면 다시 달린다');
});

test('한 축만 멀어도 판정을 건너뛴다', () => {
  clearTrafficYield();
  let time = 30;
  trafficFrame(COUNT, time, EXTENT);
  const car = trafficPose(3, time, EXTENT);
  // 같은 줄에 있지만 한 축으로 반경 밖이다. 도로가 축에 나란한 도시에서 가장 흔한 자리다.
  const far = { x: car.x, z: car.z + YIELD_REACH * 3, width: 2.2, depth: 4.6 };
  for (let i = 0; i < 120; i += 1) {
    updateTrafficYield(far, 1 / 60);
    time += 1 / 60;
    trafficFrame(COUNT, time, EXTENT);
  }
  const free = trafficPose(3, time, EXTENT);
  assert.ok(free.speed > 1, `멀리 있는 차는 늦추지 않는다 (속도 ${free.speed.toFixed(2)})`);
  clearTrafficYield();
});
