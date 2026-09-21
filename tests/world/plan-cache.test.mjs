import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrbanPlan, districtBlocks, pointOnRoute } from '../../shared/urbanPlan.js';
import { trafficPose, trafficBoxes, trafficFrame } from '../../src/world/traffic.js';

/** 차량 한 대마다 매 프레임 도시 그래프를 다시 만들던 회귀를 막는다.
 * Radeon 780M 에서 이 낭비 하나가 medium 1000명 프레임을 43ms 로 묶었다.
 */
const EXTENT = 1821;

test('같은 extent 의 도시 그래프는 다시 만들지 않고 같은 객체를 돌려준다', () => {
  const first = createUrbanPlan(EXTENT);
  assert.equal(createUrbanPlan(EXTENT), first);
  // clamp 를 거친 뒤의 값이 같으면 같은 그래프다.
  assert.equal(createUrbanPlan(EXTENT + 0.4), first);
  assert.notEqual(createUrbanPlan(EXTENT + 200), first);
  assert.equal(createUrbanPlan(EXTENT), first, '캐시가 다른 extent 때문에 밀려나면 안 된다');
});

test('지구 블록 격자도 지구마다 한 번만 만든다', () => {
  const plan = createUrbanPlan(EXTENT);
  for (const district of plan.districts) {
    assert.equal(districtBlocks(district), districtBlocks(district));
  }
});

test('경로 길이 표를 매번 다시 재지 않는다', () => {
  const route = createUrbanPlan(EXTENT).routes[0];
  const a = pointOnRoute(route, 0.25), b = pointOnRoute(route, 0.25);
  assert.deepEqual(a, b);
  assert.ok([a.x, a.z, a.angle].every(Number.isFinite));
});

test('차량 1000대의 한 프레임 계산이 예산 안에 들어온다', () => {
  // JIT 워밍업을 먼저 돌린다. 재는 것은 정상 상태의 비용이다. 60fps 예산은 16.7ms 다.
  for (let warm = 0; warm < 20000; warm += 1) trafficPose(warm % 1000, warm / 60, EXTENT);
  const started = performance.now();
  for (let frame = 0; frame < 20; frame += 1) {
    for (let car = 0; car < 1000; car += 1) trafficPose(car, frame / 60, EXTENT);
  }
  const perFrame = (performance.now() - started) / 20;
  // 캐시가 빠지면 한 프레임이 100ms 를 넘는다. 3ms 는 다른 테스트와 같이 돌 때의 흔들림을 감안한 선이다.
  assert.ok(perFrame < 3, `차량 1000대 한 프레임 ${perFrame.toFixed(2)}ms`);
});

test('한 프레임 차량 표(trafficFrame) 1000대가 예산 안에 들어온다', () => {
  // 렌더러와 도보, 주행, 비행 판정이 모두 이 표 하나를 읽는다. 첫 호출은 경로 표를 만들므로 워밍업에 넣는다.
  for (let warm = 0; warm < 300; warm += 1) trafficFrame(1000, warm / 60, EXTENT);
  const started = performance.now();
  for (let frame = 0; frame < 60; frame += 1) trafficFrame(1000, 10 + frame / 60, EXTENT);
  const perFrame = (performance.now() - started) / 60;
  assert.ok(perFrame < 1.5, `trafficFrame 1000대 한 프레임 ${perFrame.toFixed(3)}ms`);
  // 같은 시각을 여러 소비자가 다시 부르면 계산하지 않고 같은 객체를 준다.
  const first = trafficFrame(1000, 99, EXTENT);
  const again = performance.now();
  for (let call = 0; call < 1000; call += 1) trafficFrame(1000, 99, EXTENT);
  assert.equal(trafficFrame(1000, 99, EXTENT), first);
  assert.ok((performance.now() - again) / 1000 < 0.05, '같은 시각의 표를 다시 계산했다');
});

test('주변 차량 추리기도 같은 그래프를 재사용한다', () => {
  const near = { x: 0, z: 0 };
  const boxes = trafficBoxes(200, 1.5, EXTENT, near, 400);
  assert.ok(boxes.every((box) => Number.isFinite(box.x) && Number.isFinite(box.z)));
  assert.deepEqual(boxes, trafficBoxes(200, 1.5, EXTENT, near, 400));
});
