import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_GROUND, VEHICLES, carStatus, createCarState, hitsVehicle, inWater, stepCar, vehicleSpec } from '../../src/world/carPhysics.js';
import { trafficBoxes, trafficPose } from '../../src/world/traffic.js';
import { bump, createHealth, repair } from '../../src/world/health.js';
import { WORLD } from '../../shared/worldLayout.js';
import { ROWS, cityExtentForCount, createUrbanPlan } from '../../shared/urbanPlan.js';
import { riverCenter } from '../../shared/river.js';

/** 강 판정은 실제 도시 크기에서만 맞다. 살아 있는 규격에서 끌어온다. */
const CITY = cityExtentForCount(1000);
/** 다리에서 충분히 떨어진 강 위의 x 를 고른다. 다리 위치는 도로망이 정한다. */
const offRiver = (plan) => {
  for (let x = 0; x < plan.extent; x += 10) {
    for (const side of [x, -x]) if (plan.bridges.every((bridge) => Math.abs(side - bridge.x) > 60)) return side;
  }
  return 0;
};

/** 출발 지점은 동쪽 공항 터미널 앞이고 도시를 향해(서쪽) 선다. 기수 방향 앞과 오른쪽의 점이다. */
const forward = (home, d) => ({ x: home.x - Math.sin(home.heading) * d, z: home.z - Math.cos(home.heading) * d });
const beside = (home, d, side) => ({ x: home.x - Math.sin(home.heading) * d + Math.cos(home.heading) * side, z: home.z - Math.cos(home.heading) * d - Math.sin(home.heading) * side });
/** 물에서 먼 마른 길이다. 동서 여백 간선 위에서 서쪽을 본다. 오래 달리는 검사가 쓴다. */
const dryRoad = (extent) => ({ ...createCarState(extent), x: 0, z: ROWS[1] * extent, heading: Math.PI / 2 });
const drive = (state, input, frames = 60, buildings = [], kind = 'sedan', traffic = [], extent = 300) => {
  let next = state;
  for (let i = 0; i < frames; i++) next = stepCar(next, input, 1 / 60, extent, buildings, kind, traffic);
  return next;
};

test('가속하면 최고 속도에 수렴하고 오토바이가 세단보다 빠르다', () => {
  // 출발 지점은 공항 앞 짧은 둑이라 5초를 달리면 도시로 들어간다. 여백 간선 위에서 잰다.
  const away = dryRoad(CITY);
  const sedan = drive(away, { throttle: 1 }, 300, [], 'sedan', [], CITY);
  const bike = drive(away, { throttle: 1 }, 300, [], 'motorcycle', [], CITY);
  assert.ok(sedan.speed > 20 && sedan.speed <= VEHICLES.sedan.top, `세단 속도 ${sedan.speed}`);
  assert.ok(bike.speed > sedan.speed, `오토바이 ${bike.speed} 세단 ${sedan.speed}`);
  assert.equal(sedan.y, CAR_GROUND);
});

test('포뮬러는 300km/h로 제한되고 같은 시간에 기존 도로 차량보다 빠르게 가속한다', () => {
  const away = dryRoad(CITY);
  const formula = drive(away, { throttle: 1 }, 300, [], 'formula', [], CITY);
  const convertible = drive(away, { throttle: 1 }, 300, [], 'convertible', [], CITY);
  assert.equal(VEHICLES.formula.top, 300 / 3.6, '물리 최고속도가 정확히 300km/h다');
  assert.ok(formula.speed > convertible.speed, `포뮬러 ${formula.speed} 오픈카 ${convertible.speed}`);
  assert.ok(formula.speed <= 300 / 3.6, `포뮬러가 ${formula.speed * 3.6}km/h로 제한을 넘었다`);
  const capped = drive({ ...away, speed: 300 / 3.6 }, { throttle: 1 }, 120, [], 'formula', [], CITY);
  assert.ok(carStatus(capped, 'formula').speed <= 300, `표시 속도 ${carStatus(capped, 'formula').speed}`);
});

test('브레이크는 차를 완전히 세우고 후진은 기어 R 로 보인다', () => {
  const rolling = drive(createCarState(300), { throttle: 1 }, 240);
  const stopped = drive(rolling, { brake: true }, 240);
  assert.equal(stopped.speed, 0);
  const reversing = drive(createCarState(300), { reverse: 1 }, 120);
  assert.ok(reversing.speed < 0);
  assert.equal(carStatus(reversing).gear, 'R');
  assert.equal(carStatus(rolling).gear, rolling.gear);
  assert.equal(carStatus(rolling).speed, Math.round(rolling.speed * 3.6));
});

test('모든 차량은 실제 단수와 RPM으로 자동 변속한다', () => {
  const expectedGears = { sedan: 6, motorcycle: 6, suv: 6, convertible: 6, formula: 8, truck: 6, tank: 5, howitzer: 5, armored: 6 };
  for (const [kind, gears] of Object.entries(expectedGears)) {
    const spec = vehicleSpec(kind);
    let state = { ...createCarState(CITY), heading: Math.PI, speed: spec.top * 0.88, gear: 1, rpm: 6200 };
    for (let frame = 0; frame < 90; frame += 1) state = stepCar(state, { throttle: 1 }, 1 / 60, CITY, [], kind);
    const status = carStatus(state, kind);
    assert.ok(Number.isInteger(status.gear) && status.gear > 1 && status.gear <= gears, `${kind} 단수 ${status.gear}`);
    assert.ok(Number.isFinite(status.rpm) && status.rpm >= 800 && status.rpm <= 8000, `${kind} RPM ${status.rpm}`);
    assert.equal(status.redline, status.rpm >= 6800, `${kind} 레드존 상태`);
  }
});

test('멈춰 있으면 조향해도 돌지 않고 달릴 때만 방향이 바뀐다', () => {
  const still = drive(createCarState(300), { steer: 1 }, 60);
  assert.equal(still.heading, createCarState(300).heading);
  // 강에서 멀리 떨어진 도로에서 굴린다. 달리다 물에 빠지면 조향과 기울기가 초기화된다.
  const away = dryRoad(CITY);
  const turning = drive(drive(away, { throttle: 1 }, 120, [], 'sedan', [], CITY), { throttle: 0.6, steer: 1 }, 120, [], 'sedan', [], CITY);
  assert.ok(Math.abs(turning.heading) > 0.2, `선회 ${turning.heading}`);
  // 네 바퀴 차는 선회해도 차체가 기울지 않는다. 두 바퀴인 오토바이만 기운다.
  assert.equal(turning.lean, 0);
  const bike = drive(drive(away, { throttle: 1 }, 120, [], 'motorcycle', [], CITY), { throttle: 0.6, steer: 1 }, 120, [], 'motorcycle', [], CITY);
  assert.ok(Math.abs(bike.lean) > 0.05, `오토바이 기울기 ${bike.lean}`);
});

test('핸드브레이크는 덜 세우는 대신 뒤를 흘려 더 많이 돌린다', () => {
  const rolling = { ...createCarState(300), x: 6, z: 270, heading: 0, speed: 30, steer: 1 };
  const normal = drive(rolling, { throttle: 0.4, steer: 1 }, 45);
  const drifting = drive(rolling, { throttle: 0.4, steer: 1, handbrake: true }, 45);
  assert.ok(Math.abs(drifting.heading) > Math.abs(normal.heading), `드리프트 ${drifting.heading} 일반 ${normal.heading}`);
  assert.equal(drifting.drift, true);
  const braked = drive(rolling, { steer: 0, brake: true }, 45);
  assert.ok(braked.speed < drive(rolling, { steer: 0, handbrake: true }, 45).speed + 0.001, '풋브레이크가 더 잘 선다');
});

test('포뮬러 핸드브레이크는 달리며 조향할 때만 드리프트하고 놓으면 회복한다', () => {
  const away = { ...dryRoad(CITY), speed: 24, heading: Math.PI / 2 };
  const sliding = drive(away, { throttle: 0.4, steer: 1, handbrake: true }, 45, [], 'formula', [], CITY);
  assert.equal(sliding.drift, true);
  assert.ok(Math.abs(sliding.heading - away.heading) > 0.15, `선회량 ${sliding.heading - away.heading}`);
  const recovered = drive(sliding, { throttle: 0.4, steer: 0, handbrake: false }, 90, [], 'formula', [], CITY);
  assert.equal(recovered.drift, false);
  const parked = drive(dryRoad(CITY), { steer: 1, handbrake: true }, 20, [], 'formula', [], CITY);
  assert.equal(parked.drift, false, '정차 중에는 드리프트가 아니다');
  const straight = drive(away, { steer: 0, handbrake: true }, 20, [], 'formula', [], CITY);
  assert.equal(straight.drift, false, '조향하지 않으면 드리프트가 아니다');
});

test('빠를수록 조향이 둔해지고 오토바이가 세단보다 민첩하다', () => {
  // 강 반대쪽으로 달려 마른 땅에서 잰다. 물에 빠지면 조향과 기울기가 초기화된다.
  const base = drive(dryRoad(CITY), { throttle: 1 }, 300, [], 'sedan', [], CITY);
  const turn = (speed, kind) => drive({ ...base, speed, heading: Math.PI / 2, steer: 0 },
    { throttle: 0.3, steer: 1 }, 60, [], kind, [], CITY);
  const slow = turn(12, 'sedan'), fast = turn(55, 'sedan');
  assert.ok(Math.abs(slow.heading - Math.PI / 2) > Math.abs(fast.heading - Math.PI / 2));
  const bike = turn(30, 'motorcycle'), car = turn(30, 'sedan');
  assert.ok(Math.abs(bike.heading - Math.PI / 2) > Math.abs(car.heading - Math.PI / 2));
});

test('AI 차와 부딪힌 민간 차는 터지지 않고 그 자리에 선다', () => {
  const home=createCarState(300),ahead = { index: 1, ...forward(home, 20), width: 2.2, depth: 4.3 };
  let state={...home,speed:20},bumps=0;
  for(let i=0;i<240;i++){state=stepCar(state,{throttle:1},1/60,300,[],'sedan',[ahead]);if(state.bumped)bumps+=1;}
  assert.equal(state.phase, 'drive', '민간 차끼리는 터지지 않는다');
  assert.ok(bumps > 0, '세게 박은 것은 알린다');
  // 천천히 닿으면 막히기만 하고 차체는 깎이지 않는다.
  const creep = stepCar({ ...home, speed: 2, x: ahead.x + Math.sin(home.heading) * 3, z: ahead.z + Math.cos(home.heading) * 3 },
    { throttle: 1 }, 1 / 60, 300, [], 'sedan', [ahead]);
  assert.equal(creep.bumped, false, '기어가는 접촉은 세지 않는다');
  assert.match(state.message, /충돌/);
  // AI 차를 뚫고 지나가지 않는다. 앞차보다 뒤에 남는다.
  const travelled = Math.hypot(state.x - home.x, state.z - home.z);
  assert.ok(travelled < 20, `앞차를 지나 ${travelled.toFixed(1)} 까지 갔다`);
});

test('건물에 부딪히면 터지지 않고 막히며 전투 차량은 AI 차를 부순다', () => {
  // 목표물은 출발 지점 바로 앞에 둔다. 스폰이 옮겨져도 따라오게 상대 좌표로 잡는다.
  const home = createCarState(300);
  const building = { ...forward(home, 40), height: 30, width: 20, depth: 20 };
  const blocked = drive({ ...home, speed: 40 }, { throttle: 1 }, 120, [building]);
  assert.equal(blocked.phase, 'drive');
  assert.equal(blocked.speed, 0);
  assert.match(blocked.message, /막혔다/);
  assert.equal(carStatus(blocked).gear, 1, '막히면 1단으로 돌아간다');
  assert.equal(carStatus(blocked).rpm, 800, '막히면 공회전으로 내려간다');

  const ahead = { index: 3, ...forward(home, 20), width: 2.2, depth: 4.3 };
  const tank = drive({ ...home, speed: 20 }, { throttle: 1 }, 120, [], 'tank', [ahead]);
  assert.equal(tank.phase, 'drive');
  assert.ok(tank.kills.length >= 1, '민간 차를 부순다');
  assert.equal(tank.kills[0].index, 3);
  const civilian = drive({ ...home, speed: 30 }, { throttle: 1 }, 60, [], 'sedan', [ahead]);
  assert.equal(civilian.phase, 'drive', '민간 차는 부딪혀도 터지지 않는다');
});

test('섬 밖으로 나가면 바다에 빠진다', () => {
  const offshore = stepCar({ ...createCarState(300), z: -330, speed: 60 }, { throttle: 1 }, 0.05, 300);
  assert.equal(offshore.phase, 'sinking');
});

test('AI 차량과 부딪히면 막히고 옆 차선을 스치는 것은 사고가 아니다', () => {
  const home = createCarState(300);
  const ahead = { ...forward(home, 20), width: 2.2, depth: 4.3 };
  const head = drive({ ...home, speed: 30 }, { throttle: 1 }, 60, [], 'sedan', [ahead]);
  assert.equal(head.phase, 'drive');
  // 앞차 앞에서 막힌다. 20 만큼 떨어져 있었으므로 그 안에 남는다.
  assert.ok(Math.hypot(head.x - home.x, head.z - home.z) < 20);
  const nextLane = { ...beside(home, 20, -7.2), width: 2.2, depth: 4.3 };
  const passing = drive({ ...home, speed: 30 }, { throttle: 1 }, 60, [], 'sedan', [nextLane]);
  assert.equal(passing.phase, 'drive');
  assert.ok(Math.hypot(passing.x - home.x, passing.z - home.z) > 20, '옆 차선은 그대로 지나간다');
  assert.equal(hitsVehicle({ x: 0, z: 10 }, { x: 0, z: 0 }, { x: 0, z: 0, width: 2.2, depth: 4.3 }), true);
  assert.equal(hitsVehicle({ x: 9, z: 10 }, { x: 9, z: 0 }, { x: 0, z: 0, width: 2.2, depth: 4.3 }), false);
});

test('탄은 차 높이 안을 지날 때만 맞는다', () => {
  const box = { x: 0, y: 0.31, z: 0, width: 2.2, depth: 4.3, height: 1.6 };
  // 차체 높이를 수평으로 가르는 탄은 맞는다.
  assert.equal(hitsVehicle({ x: 0, y: 1.2, z: 10 }, { x: 0, y: 1.2, z: -10 }, box, 0.8), true);
  // 차 위 200m 를 지나는 탄은 수평 경로가 겹쳐도 맞지 않는다.
  assert.equal(hitsVehicle({ x: 0, y: 200, z: 10 }, { x: 0, y: 200, z: -10 }, box, 0.8), false);
  // 지붕 바로 위 3m 도 맞지 않는다.
  assert.equal(hitsVehicle({ x: 0, y: 5, z: 10 }, { x: 0, y: 5, z: -10 }, box, 0.8), false);
  // 위에서 내려와 차를 뚫고 땅으로 가는 탄은 한 걸음 안에서도 맞는다.
  assert.equal(hitsVehicle({ x: 0, y: 6, z: 6 }, { x: 0, y: -1, z: -2 }, box, 0.8), true);
  // 차 밑은 맞지 않는다. 세로 여유는 수평 여유와 따로 둔다.
  assert.equal(hitsVehicle({ x: 0, y: -3, z: 10 }, { x: 0, y: -3, z: -10 }, box, 0.8), false);
  // 높이를 주지 않은 상자는 예전처럼 세로를 보지 않는다.
  const flat = { x: 0, y: 0.31, z: 0, width: 2.2, depth: 4.3 };
  assert.equal(hitsVehicle({ x: 0, y: 200, z: 10 }, { x: 0, y: 200, z: -10 }, flat, 0.8), true);
});

test('AI 차량 배치는 시간만으로 결정되고 주변만 추린다', () => {
  const first = trafficPose(7, 12.5, 300), again = trafficPose(7, 12.5, 300);
  assert.deepEqual(first, again);
  assert.ok(Number.isFinite(first.x) && Number.isFinite(first.z));
  const near = trafficBoxes(60, 12.5, 300, { x: first.x, z: first.z }, 40);
  assert.ok(near.length >= 1 && near.length < 60);
  for (const box of near) assert.ok(Math.abs(box.x - first.x) <= 40 && Math.abs(box.z - first.z) <= 40);
});

test('강에 빠지면 가라앉고 다리 위에서는 멀쩡하다', () => {
  // 강 위치와 다리 간격은 도시 규격에서 끌어온다. 규격이 바뀌면 따라온다.
  // 강은 도시 한복판이라 실제 도시 크기로 판정해야 한다. 작은 extent 로는 바다로 잡힌다.
  const span = CITY;
  const plan=createUrbanPlan(span);
  const bridgeX=plan.bridges[0].x,offBridge=offRiver(plan);
  // 중심선이 굽어 있으므로 그 x 에서의 강 한가운데를 쓴다.
  const river = stepCar({ ...createCarState(span), x: offBridge, z: riverCenter(span, offBridge), speed: 20 }, { throttle: 1 }, 0.05, span);
  assert.equal(river.phase, 'sinking');
  assert.match(river.message, /물/);
  let sinking = river;
  for (let i = 0; i < 20; i++) sinking = stepCar(sinking, { throttle: 1 }, 0.05, span);
  assert.ok(sinking.y < CAR_GROUND, `가라앉는 높이 ${sinking.y}`);
  assert.ok(Math.abs(sinking.speed) < Math.abs(river.speed));
  for (let i = 0; i < 60; i++) sinking = stepCar(sinking, {}, 0.05, span);
  assert.equal(sinking.phase, 'drive');
  const bridge = stepCar({ ...createCarState(span), x: bridgeX, z: riverCenter(span, bridgeX), speed: 20 }, { throttle: 1 }, 0.05, span);
  assert.equal(bridge.phase, 'drive');
  assert.equal(inWater(bridgeX, riverCenter(span, bridgeX), span), false, '다리 위다');
  assert.equal(inWater(offBridge, riverCenter(span, offBridge), span), true, '다리 사이는 강물이다');
  // 공항 땅(x extent+110 둘레, |z| 300 안) 과 둑은 뭍이다. 그 밖은 바다다.
  assert.equal(inWater(span + 100, 0, span), false, '공항 땅은 뭍이다');
  assert.equal(inWater(span + 5, 30, span), false, '둑 위는 뭍이다');
  assert.equal(inWater(span + 100, 400, span), true, '섬 밖은 바다다');
  assert.equal(inWater(span + 50, 400, span), true, '둑 옆 바다는 바다다');
});

test('출발 지점은 동쪽 공항 앞 공항로 위이고 도시를 향한다', () => {
  const home = createCarState(CITY);
  assert.equal(inWater(home.x, home.z, CITY), false, '출발 지점이 물이다');
  assert.ok(home.x > CITY, '공항 쪽이다');
  assert.equal(home.heading, Math.PI / 2, '서쪽(도시)을 본다');
  const plan = createUrbanPlan(CITY), road = plan.roads.filter((r) => r.path === 'airport-road-east');
  assert.ok(road.some((r) => Math.abs(r.z1 - home.z) < 1 && home.x >= Math.min(r.x1, r.x2) && home.x <= Math.max(r.x1, r.x2)), '공항로 위가 아니다');
});

test('알 수 없는 차종과 비정상 입력을 견딘다', () => {
  assert.equal(vehicleSpec('ufo'), VEHICLES.sedan);
  for (const dt of [NaN, Infinity, -1, 100, 0.016]) {
    const state = stepCar(createCarState(300), { throttle: 9, steer: NaN, reverse: Infinity }, dt, 300, [], 'ufo');
    for (const field of ['x', 'z', 'heading', 'speed', 'steer', 'lean']) assert.ok(Number.isFinite(state[field]), field);
  }
  assert.equal(stepCar({ ...createCarState(300), x: NaN }, {}, 0.016, 300).x, createCarState(300).x);
});

test('차끼리 부딪히면 차체가 깎이고 다 깎이면 그때 선다', () => {
  // CarMode 가 하는 일을 그대로 따라 한다. stepCar 는 알리고 health 가 깎는다.
  const home = createCarState(300);
  let state = { ...home, speed: 20 }, car = createHealth('car', 'sedan'), time = 0;
  const ahead = { index: 1, ...forward(home, 12), width: 2.2, depth: 4.3, speed: 0 };
  const hits = [];
  for (let i = 0; i < 60 * 12; i += 1) {
    state = stepCar(state, { throttle: 1 }, 1 / 60, 300, [], 'sedan', [ahead]);
    if (state.bumped) {
      const before = car;
      car = bump(car, time);
      if (car !== before) hits.push(+car.hp.toFixed(0));
    }
    car = repair(car, 1 / 60, time);
    time += 1 / 60;
    // 부딪혀 멈추면 뒤로 물러났다가 다시 밀고 들어간다.
    if (state.speed <= 0.1) state = { ...state, speed: 12 };
  }
  assert.deepEqual(hits, [80, 60, 40, 20, 0], '한 번에 20 씩 깎인다');
  assert.equal(car.wrecked, true);
  assert.equal(state.phase, 'drive', 'stepCar 는 터뜨리지 않는다. 부수는 것은 부르는 쪽이다');
});
