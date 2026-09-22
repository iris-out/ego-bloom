import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_BODY, TRAFFIC_GAP, TRAFFIC_TOP_SPEED, trafficBoxes, trafficFrame, trafficPose, trafficTrack } from '../../src/world/traffic.js';
import { hitsVehicle } from '../../src/world/carPhysics.js';
import { createUrbanPlan, pointOnRoute } from '../../shared/urbanPlan.js';

const EXTENT = 900;
/** 제작자 1000명 도시의 크기다. 경로 구성이 EXTENT 와 달라 두 도시를 같이 본다. */
const CITY = 2164;
/** 품질 high 의 차 수보다 넉넉하다. */
const CARS = 1000;
/** 시각 표본이다. 작은 값과 한 시간이 넘는 값을 섞어 표의 경계와 바퀴 수 계산을 함께 본다. */
const TIMES = [0, 0.7, 13.37, 59.9, 211.4, 987.65, 3600.5, 7777.77, 12345.6, 86399.1];

const wrap = (value) => Math.atan2(Math.sin(value), Math.cos(value));

/** 차가 탄 경로의 중심선에서 가장 가까운 점과 그 점의 경로 방위다. */
function nearestCentre(route, x, z) {
  let best = { gap: Infinity };
  for (let i = 1; i < route.points.length; i += 1) {
    const [ax, az] = route.points[i - 1], [bx, bz] = route.points[i];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const px = ax + dx * t, pz = az + dz * t, gap = Math.hypot(x - px, z - pz);
    if (gap < best.gap) best = { gap, x: px, z: pz, angle: Math.atan2(dx, dz) };
  }
  return best;
}

test('같은 시간과 같은 index 는 항상 같은 포즈를 준다', () => {
  for (const index of [0, 1, 7, 33, 104]) {
    assert.deepEqual(trafficPose(index, 12.5, EXTENT), trafficPose(index, 12.5, EXTENT));
  }
  assert.notDeepEqual(trafficPose(3, 0, EXTENT), trafficPose(3, 9, EXTENT));
});

test('모든 포즈가 유한하고 비정상 extent 와 시각을 견딘다', () => {
  for (const extent of [EXTENT, 180, 0, -5, NaN, Infinity]) {
    for (let index = 0; index < 40; index += 1) {
      for (const time of [index * 0.37, NaN, -3, 1e7]) {
        const pose = trafficPose(index, time, extent);
        assert.ok([pose.x, pose.z, pose.angle, pose.width, pose.depth, pose.braking, pose.speed].every(Number.isFinite),
          `index ${index}, extent ${extent}, time ${time} 에서 유한하지 않은 값이 나왔다`);
      }
    }
  }
});

test('우측통행이다. 직선 구간의 차는 진행 방향 오른쪽 차선에 있고 양방향이 모두 달린다', () => {
  for (const extent of [EXTENT, CITY]) {
    const plan = createUrbanPlan(extent);
    const routes = new Map([...plan.routes, ...(plan.highwayRoutes || [])].map((route) => [route.id, route]));
    let forward = 0, backward = 0, checked = 0;
    for (let index = 0; index < 300; index += 1) {
      for (const time of [0, 7.3, 41.9]) {
        const track = trafficTrack(index, time, extent);
        if (track.turning) continue;
        const pose = trafficPose(index, time, extent), centre = nearestCentre(routes.get(track.route), pose.x, pose.z);
        // 진행 방향 앞이 (sin angle, cos angle) 이므로 오른쪽은 (-cos angle, sin angle) 이다.
        const offset = (pose.x - centre.x) * -Math.cos(pose.angle) + (pose.z - centre.z) * Math.sin(pose.angle);
        assert.ok(offset > 0.5, `index ${index}, time ${time} 에서 역주행이다: ${offset.toFixed(3)}`);
        if (Math.abs(wrap(pose.angle - centre.angle)) < Math.PI / 2) forward += 1; else backward += 1;
        checked += 1;
      }
    }
    assert.ok(checked > 700, `직선 구간 표본이 ${checked} 개뿐이다`);
    assert.ok(forward > 150 && backward > 150, `양방향이 고르지 않다: ${forward}, ${backward}`);
  }
});

test('충돌 상자는 차량이 옆을 볼 때 가로와 세로가 바뀐다', () => {
  for (let index = 0; index < 200; index += 1) {
    const pose = trafficPose(index, 3.5, EXTENT);
    const long = pose.truck ? 7.4 : 4.3, wide = pose.truck ? 2.7 : 2.2;
    const sideways = Math.abs(Math.sin(pose.angle)) > 0.7;
    assert.equal(pose.width, sideways ? long : wide);
    assert.equal(pose.depth, sideways ? wide : long);
  }
});

test('어느 차도 한 프레임에 최고 속도보다 멀리 움직이지 않는다. 순간이동이 없다', () => {
  const dt = 1 / 60, limit = TRAFFIC_TOP_SPEED * dt + 1e-6;
  for (const extent of [EXTENT, CITY]) {
    let worst = 0;
    for (const time of TIMES) {
      for (let index = 0; index < CARS; index += 1) {
        const a = trafficPose(index, time, extent), b = trafficPose(index, time + dt, extent);
        const moved = Math.hypot(b.x - a.x, b.z - a.z);
        worst = Math.max(worst, moved);
        assert.ok(moved <= limit, `차 ${index} 가 ${time} 초에 한 프레임 ${moved.toFixed(3)} 움직였다`);
        assert.ok(a.speed <= TRAFFIC_TOP_SPEED + 1e-9, `차 ${index} 속도 ${a.speed}`);
        // 기수도 튀지 않는다. 유턴의 가장 빠른 회전도 한 프레임에 0.05rad 아래다.
        assert.ok(Math.abs(wrap(b.angle - a.angle)) < 0.1, `차 ${index} 의 기수가 ${time} 초에 튀었다`);
      }
    }
    assert.ok(worst > TRAFFIC_TOP_SPEED * dt * 0.5, `가장 빠른 차도 한 프레임 ${worst} 뿐이다`);
  }
});

test('한 차선 띠 안의 차는 앞차와 차 길이보다 넉넉히 떨어져 있고 슬롯이 겹치지 않는다', () => {
  // 트럭 길이가 7.4 이므로 중심 사이 9 면 트럭끼리도 닿지 않는다.
  const MIN_GAP = 9;
  assert.ok(TRAFFIC_GAP >= MIN_GAP);
  for (const extent of [EXTENT, CITY]) {
    const slots = new Set();
    for (let index = 0; index < CARS; index += 1) {
      const track = trafficTrack(index, 0, extent), key = `${track.band}#${track.slot}`;
      assert.ok(!slots.has(key), `차 ${index} 가 다른 차와 같은 슬롯 ${key} 에 앉았다`);
      slots.add(key);
    }
    for (const time of [...TIMES, 33.3, 505.05]) {
      const bands = new Map();
      for (let index = 0; index < CARS; index += 1) {
        const track = trafficTrack(index, time, extent);
        if (!bands.has(track.band)) bands.set(track.band, []);
        bands.get(track.band).push({ index, along: track.along, length: track.length });
      }
      for (const [band, cars] of bands) {
        if (cars.length < 2) continue;
        cars.sort((p, q) => p.along - q.along);
        cars.forEach((car, i) => {
          const next = cars[(i + 1) % cars.length];
          const gap = i + 1 < cars.length ? next.along - car.along : next.along + car.length - car.along;
          assert.ok(gap >= MIN_GAP, `${band} 에서 차 ${car.index} 와 ${next.index} 사이가 ${time} 초에 ${gap.toFixed(2)} 다`);
        });
      }
    }
  }
});

test('차선 길이가 긴 경로가 차를 더 많이 받고 앞 번호만으로도 고르게 퍼진다', () => {
  const plan = createUrbanPlan(CITY);
  for (const count of [200, 900]) {
    const cars = new Map(), lengths = new Map();
    for (let index = 0; index < count; index += 1) {
      const track = trafficTrack(index, 0, CITY);
      cars.set(track.route, (cars.get(track.route) || 0) + 1);
      lengths.set(track.band, track.length);
    }
    const laneLength = new Map();
    for (const [band, length] of lengths) {
      const route = band.slice(0, band.indexOf(':'));
      laneLength.set(route, (laneLength.get(route) || 0) + length);
    }
    const total = [...laneLength.values()].reduce((sum, length) => sum + length, 0);
    for (const route of plan.routes) {
      const length = laneLength.get(route.id) || 0;
      // 긴 경로만 비율을 본다. 짧은 경로는 몇 대 차이로도 비율이 크게 흔들린다.
      if (length < total * 0.04) continue;
      const share = (cars.get(route.id) || 0) / count, expected = length / total;
      assert.ok(share > expected * 0.6 && share < expected * 1.5,
        `${count} 대 중 ${route.id} 가 ${(share * 100).toFixed(1)}% 를 받았다. 차선 길이 비율은 ${(expected * 100).toFixed(1)}% 다`);
    }
    const ring = cars.get('ring') || 0, airport = cars.get('airport-road-east') || 0;
    assert.ok(ring > airport * 10, `순환로 ${ring} 대, 공항로 ${airport} 대`);
  }
});

test('차 수가 달라도 같은 번호의 차는 같은 자리에 있다', () => {
  const few = trafficFrame(120, 42.5, CITY);
  const small = { x: few.x.slice(0, 120), z: few.z.slice(0, 120), angle: few.angle.slice(0, 120), truck: few.truck.slice(0, 120) };
  // 다른 시각을 한 번 불러 캐시를 비운다. 900 대를 처음부터 다시 계산하게 한다.
  trafficFrame(10, 1, CITY);
  const many = trafficFrame(900, 42.5, CITY);
  assert.equal(many.count, 900);
  for (let i = 0; i < 120; i += 1) {
    assert.equal(many.x[i], small.x[i]); assert.equal(many.z[i], small.z[i]);
    assert.equal(many.angle[i], small.angle[i]); assert.equal(many.truck[i], small.truck[i]);
  }
});

test('trafficFrame 은 trafficPose 와 같은 값을 주고 같은 인자로는 다시 계산하지 않는다', () => {
  const frame = trafficFrame(400, 77.25, CITY);
  for (let i = 0; i < 400; i += 1) {
    const pose = trafficPose(i, 77.25, CITY);
    assert.equal(frame.x[i], pose.x); assert.equal(frame.z[i], pose.z); assert.equal(frame.angle[i], pose.angle);
    assert.equal(frame.speed[i], pose.speed); assert.equal(frame.braking[i], pose.braking);
    assert.equal(frame.truck[i] === 1, pose.truck);
  }
  const x = frame.x;
  assert.equal(trafficFrame(400, 77.25, CITY), frame);
  assert.equal(frame.x, x, '같은 인자인데 배열을 새로 만들었다');
  assert.equal(trafficFrame(0, 77.25, CITY).count, 0);
});

test('트럭은 바깥 차선에만 서고 전체의 일부다', () => {
  let trucks = 0;
  for (let index = 0; index < CARS; index += 1) {
    const pose = trafficPose(index, 0, CITY);
    if (!pose.truck) continue;
    trucks += 1;
    assert.ok(trafficTrack(index, 0, CITY).outer, `트럭 ${index} 가 안쪽 차선에 있다`);
  }
  assert.ok(trucks > CARS * 0.1 && trucks < CARS * 0.3, `트럭이 ${trucks} 대다`);
});

test('브레이크 값은 0 과 1 사이이고 실제로 감속할 때만 켜진다', () => {
  let braking = 0;
  for (let index = 0; index < 400; index += 1) {
    const time = index * 0.21, pose = trafficPose(index, time, EXTENT);
    assert.ok(pose.braking >= 0 && pose.braking <= 1, `브레이크 값이 범위 밖이다: ${pose.braking}`);
    assert.equal(pose.braking, trafficPose(index, time, EXTENT).braking);
    if (pose.braking <= 0) continue;
    braking += 1;
    assert.ok(trafficPose(index, time + 1e-3, EXTENT).speed <= pose.speed + 1e-9, `차 ${index} 는 브레이크를 밟는데 빨라진다`);
  }
  // 직선이 대부분이므로 브레이크를 밟는 차는 소수여야 한다. 전부 밟거나 전혀 안 밟으면 판정이 죽은 것이다.
  assert.ok(braking > 0 && braking < 200, `브레이크를 밟는 차가 ${braking} 대다`);
});

test('유턴과 교차로에서 느려지고 곧은 길에서는 제 속도를 낸다', () => {
  let turning = 0, cruising = 0;
  for (let index = 0; index < CARS; index += 1) {
    for (const time of [5, 250, 4000]) {
      const track = trafficTrack(index, time, CITY), pose = trafficPose(index, time, CITY);
      assert.ok(pose.speed >= track.v0 * 0.35 - 1e-9, `차 ${index} 가 바닥 속도보다 느리다: ${pose.speed}`);
      assert.ok(pose.speed <= track.v0 + 1e-9, `차 ${index} 가 제한 속도를 넘었다: ${pose.speed}`);
      if (track.turning) { turning += 1; assert.ok(pose.speed <= track.v0 * 0.5 + 1e-9, `유턴하는 차 ${index} 가 ${pose.speed} 로 돈다`); }
      if (pose.speed > track.v0 * 0.99) cruising += 1;
    }
  }
  assert.ok(turning > 0, '유턴하는 차가 한 대도 없다');
  assert.ok(cruising > CARS, `제 속도를 내는 차가 ${cruising} 번뿐이다`);
});

test('주변 추리기는 반경 안의 차량만 주고 index 를 유지한다', () => {
  const near = { x: 0, z: 0 };
  const boxes = trafficBoxes(300, 2.5, EXTENT, near, 120);
  assert.ok(boxes.length < 300);
  for (const box of boxes) {
    assert.ok(Math.abs(box.x - near.x) <= 120 && Math.abs(box.z - near.z) <= 120);
    assert.deepEqual(box, trafficPose(box.index, 2.5, EXTENT));
  }
  assert.deepEqual(boxes, trafficBoxes(300, 2.5, EXTENT, near, 120));
  assert.equal(trafficBoxes(0, 2.5, EXTENT, near, 120).length, 0);
  // near 가 없으면 전부 준다.
  assert.equal(trafficBoxes(50, 2.5, EXTENT).length, 50);
});

test('AI 차량 상자는 도로 상판부터 지붕까지의 세로 범위를 갖는다', () => {
  const boxes = trafficBoxes(600, 4.25, EXTENT);
  const car = boxes.find((box) => !box.truck), truck = boxes.find((box) => box.truck);
  assert.ok(car && truck, '승용차와 트럭이 모두 있다');
  for (const box of [car, truck]) {
    assert.equal(box.y, TRAFFIC_BODY.base);
    assert.ok(box.height > 1.5, `높이 ${box.height}`);
  }
  assert.ok(truck.height > car.height, `트럭 ${truck.height} 승용차 ${car.height}`);
  // 같은 상자를 hitsVehicle 에 그대로 넘긴다. 차 위 200m 는 명중이 아니고 차체 높이는 명중이다.
  const over = (box, y) => hitsVehicle({ x: box.x, y, z: box.z + 40 }, { x: box.x, y, z: box.z - 40 }, box, 0.8);
  assert.equal(over(car, 200), false);
  assert.equal(over(car, 1), true);
  assert.equal(over(truck, 200), false);
  assert.equal(over(truck, 3), true);
});

test('점 두 개짜리 직선 경로는 어디서나 유한한 포즈를 준다', () => {
  const route = { id: 'synthetic-straight', points: [[0, 0], [500, 0]] };
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const pose = pointOnRoute(route, progress);
    assert.ok([pose.x, pose.z, pose.angle].every(Number.isFinite));
    assert.ok(Math.abs(pose.z) < 1e-9, `직선 경로가 z=0 을 벗어났다: ${pose.z}`);
  }
});

test('index 는 시간과 extent 가 달라져도 항상 같은 경로 선택으로 되돌아간다', () => {
  for (const extent of [900, 1400, 1766, 2164]) {
    for (const index of [0, 5, 42]) {
      const a = trafficPose(index, 3, extent), b = trafficPose(index, 3, extent);
      assert.deepEqual(a, b);
      assert.equal(a.index, index);
    }
  }
});

test('createUrbanPlan(1766) 의 모든 경로가 유한한 포즈를 낸다', () => {
  const plan = createUrbanPlan(1766);
  assert.ok(plan.routes.length > 0);
  for (const route of plan.routes) {
    for (let i = 0; i < 10; i += 1) {
      const pose = pointOnRoute(route, i / 10);
      assert.ok([pose.x, pose.z, pose.angle].every(Number.isFinite),
        `경로 ${route.id} 진행률 ${i / 10} 에서 유한하지 않은 값이 나왔다`);
    }
  }
});

test('차량은 자기 차선 위에 서고 기수가 진행 방향을 본다',()=>{
  // 예전에는 이음매 방위를 현 절반씩 섞어서, 간선이 직각으로 꺾이며 현이 길어지자
  // 차가 교차로 수백 단위 앞에서부터 비스듬히 섰다.
  const extent=1957,plan=createUrbanPlan(extent);
  const toSegment=(px,pz,road)=>{
    const dx=road.x2-road.x1,dz=road.z2-road.z1,len=dx*dx+dz*dz;
    const t=len?Math.max(0,Math.min(1,((px-road.x1)*dx+(pz-road.z1)*dz)/len)):0;
    return Math.hypot(px-(road.x1+dx*t),pz-(road.z1+dz*t));
  };
  const ground=plan.roads.filter(road=>road.kind!=='alley');
  for(let index=0;index<240;index+=1)for(const time of [0,7,19,41]){
    const pose=trafficPose(index,time,extent);
    const away=Math.min(...ground.map(road=>toSegment(pose.x,pose.z,road)));
    assert.ok(away<=14,`차 ${index} 가 도로에서 ${away.toFixed(1)} 벗어났다`);
  }
  for(let index=0;index<200;index+=1){
    const a=trafficPose(index,10,extent),b=trafficPose(index,10.25,extent);
    const moved=Math.hypot(b.x-a.x,b.z-a.z);
    if(moved<0.2)continue;
    const heading=Math.atan2(b.x-a.x,b.z-a.z);
    const diff=Math.abs(Math.atan2(Math.sin(heading-a.angle),Math.cos(heading-a.angle)));
    // 후진하는 차는 없다. 유턴도 앞으로 돌며 끝난다.
    assert.ok(diff<=0.35,`차 ${index} 의 기수가 진행 방향과 ${diff.toFixed(2)} 라디안 어긋났다`);
  }
});
