import test from 'node:test';
import assert from 'node:assert/strict';
import { AIM_LIMITS, aimAtPoint, aimGroundWeapon, createGroundArsenal, isCombatVehicle, stepGroundWeapons } from '../../src/world/groundWeapons.js';

test('combat vehicle aim follows pointer deltas and clamps elevation',()=>{
  assert.equal(isCombatVehicle('tank'),true);assert.equal(isCombatVehicle('sedan'),false);
  assert.equal(isCombatVehicle('aa'),true);
  // 1인칭에서는 포탑이 곧 시점이라 시점 조작 규약을 따른다.
  // 오른쪽으로 끌면(dx 양수) 오른쪽을 보고 그때 yaw 는 줄어든다. 위로 끌면(dy 음수) 위를 본다.
  const aim=aimGroundWeapon({yaw:0,pitch:0},100,-1000,'tank');
  assert.ok(aim.yaw<-.3,`오른쪽 드래그 yaw ${aim.yaw}`);
  assert.equal(aim.pitch,.5,'전차 앙각 상한');
  // 기종이 앙각 한계를 정한다. 대공포는 같은 입력에서 훨씬 높이 든다.
  assert.equal(aimGroundWeapon({yaw:0,pitch:0},0,-1000,'aa').pitch,1.45);
  assert.equal(aimGroundWeapon({yaw:0,pitch:0},0,1000,'tank').pitch,-.12,'전차 부각 하한');
});

test('space or click request spawns a shell and cooldown prevents spam',()=>{
  const args={dt:.016,fire:true,pose:{x:0,y:1.2,z:20,heading:0},aim:{yaw:0,pitch:0},vehicle:'tank'};
  const fired=stepGroundWeapons(createGroundArsenal(),args);assert.equal(fired.shells.length,1);assert.ok(fired.cooldown>1);
  assert.equal(stepGroundWeapons(fired,args).shells.length,1);
});

test('ground shell destroys an AI traffic target and creates a blast',()=>{
  let state=createGroundArsenal(),hits=[];
  for(let i=0;i<80&&!hits.length;i++){state=stepGroundWeapons(state,{dt:.05,fire:i===0,pose:{x:0,y:1.2,z:20,heading:0},aim:{yaw:0,pitch:0},vehicle:'tank',traffic:[{index:4,x:0,z:-15,width:4,depth:7}]});hits=state.hits;}
  assert.equal(hits[0]?.index,4);assert.ok(state.blasts.length>0);
});

test('포탑은 지정한 월드 지점을 향한다', () => {
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  // heading 0 은 -Z 를 본다. 정면 지점은 상대 yaw 0 이다.
  const ahead = aimAtPoint(pose, { x: 0, y: 0, z: -50 }, 'tank');
  assert.ok(Math.abs(ahead.yaw) < 1e-6, `정면 yaw ${ahead.yaw}`);

  // 오른쪽(+X) 지점은 차체 기준 시계 방향이다.
  const right = aimAtPoint(pose, { x: 50, y: 0, z: -50 }, 'tank');
  assert.ok(Math.abs(right.yaw - (-Math.PI / 4)) < 1e-6, `오른쪽 yaw ${right.yaw}`);

  const left = aimAtPoint(pose, { x: -50, y: 0, z: -50 }, 'tank');
  assert.ok(Math.abs(left.yaw - Math.PI / 4) < 1e-6, `왼쪽 yaw ${left.yaw}`);
});

test('차체가 돌아가도 포탑은 같은 지점을 본다', () => {
  const target = { x: 0, y: 0, z: -80 };
  const straight = aimAtPoint({ x: 0, y: 1.2, z: 0, heading: 0 }, target, 'tank');
  const turned = aimAtPoint({ x: 0, y: 1.2, z: 0, heading: 0.7 }, target, 'tank');
  // 차체가 0.7 돌면 포탑 상대각이 0.7 만큼 반대로 돌아 같은 지점을 유지한다.
  assert.ok(Math.abs((turned.yaw + 0.7) - straight.yaw) < 1e-6,
    `heading 0.7 에서 yaw ${turned.yaw}`);
});

test('앙각은 기종별 상한과 하한을 지킨다', () => {
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  for (const vehicle of ['tank', 'howitzer', 'armored']) {
    const limits = AIM_LIMITS[vehicle].pitch;
    const up = aimAtPoint(pose, { x: 0, y: 900, z: -2 }, vehicle);
    const down = aimAtPoint(pose, { x: 0, y: -900, z: -2 }, vehicle);
    assert.ok(up.pitch <= limits[1] + 1e-9, `${vehicle} 최대 앙각 ${up.pitch}`);
    assert.ok(down.pitch >= limits[0] - 1e-9, `${vehicle} 최소 앙각 ${down.pitch}`);
  }
  // 자주포는 곡사포라 전차보다 높이 든다.
  assert.ok(AIM_LIMITS.howitzer.pitch[1] > AIM_LIMITS.tank.pitch[1]);
});

test('상대 yaw 는 항상 -PI 와 PI 사이로 감긴다', () => {
  for (const heading of [-6, -3, 0, 3, 6, 12]) {
    for (const angle of [0, 1, 2, 3, 4, 5]) {
      const target = { x: Math.sin(angle) * 40, y: 0, z: Math.cos(angle) * 40 };
      const aim = aimAtPoint({ x: 0, y: 1.2, z: 0, heading }, target, 'tank');
      assert.ok(aim.yaw >= -Math.PI - 1e-9 && aim.yaw <= Math.PI + 1e-9,
        `heading ${heading} angle ${angle} 에서 yaw ${aim.yaw}`);
    }
  }
});

test('잘못된 값에서는 조준을 바꾸지 않는다', () => {
  const pose = { x: 0, y: 1.2, z: 0, heading: 0.3 };
  const zero = aimAtPoint(pose, null, 'tank');
  assert.ok(Number.isFinite(zero.yaw) && Number.isFinite(zero.pitch));
  const nan = aimAtPoint(pose, { x: NaN, y: 0, z: NaN }, 'tank');
  assert.ok(Number.isFinite(nan.yaw) && Number.isFinite(nan.pitch));
  // 차체 위치와 같은 지점은 방향이 없다. 정면으로 둔다.
  const same = aimAtPoint(pose, { x: 0, y: 1.2, z: 0 }, 'tank');
  assert.ok(Math.abs(same.yaw) < 1e-6);
});

test('발사 방향은 새 조준을 그대로 쓴다', () => {
  const pose = { x: 0, y: 1.2, z: 0, heading: 0 };
  const aim = aimAtPoint(pose, { x: 60, y: 0, z: -60 }, 'tank');
  const fired = stepGroundWeapons(createGroundArsenal(), { dt: 1 / 60, fire: true, pose, aim, vehicle: 'tank' });
  assert.equal(fired.shells.length, 1);
  const shell = fired.shells[0];
  // 목표는 +X, -Z 쪽이다. 포탄도 그 방향으로 나가야 한다.
  assert.ok(shell.vx > 0, `vx ${shell.vx}`);
  assert.ok(shell.vz < 0, `vz ${shell.vz}`);
});

/** 포구 앞 도로를 메운 AI 차량이다. 세로 범위는 traffic.js 가 주는 것과 같다. */
function roadCars(from = -10, to = -500, step = 6) {
  const cars = [];
  for (let z = from; z > to; z -= step) cars.push({ index: cars.length, x: 0, z, y: 0.31, width: 2.2, depth: 4.3, height: 1.6 });
  return cars;
}

function fireGround(vehicle, pitch, traffic, frames = 240, firing = 1) {
  const pose = { x: 0, y: 1.21, z: 0, heading: 0 };
  let state = createGroundArsenal(), hits = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    state = stepGroundWeapons(state, { dt: 1 / 60, fire: frame < firing, pose, aim: { yaw: 0, pitch }, vehicle, traffic });
    hits += state.hits.length;
  }
  return hits;
}

test('하늘을 겨눈 대공포는 도로 위 차를 부수지 않는다', () => {
  const traffic = roadCars();
  // 앙각 60도로 서른 발을 쏴도 지상 차량은 한 대도 맞지 않는다.
  assert.equal(fireGround('aa', Math.PI / 3, traffic, 240, 30), 0);
  // 거의 수직도 같다.
  assert.equal(fireGround('aa', 1.4, traffic, 240, 30), 0);
  // 같은 차를 수평으로 겨누면 낙차가 차체 높이까지 내려와 부순다.
  assert.ok(fireGround('aa', 0, traffic) > 0, '수평 사격이 한 대도 못 맞혔다');
});

test('전차포도 하늘로 쏘면 도로 위 차를 부수지 않는다', () => {
  const traffic = roadCars();
  assert.equal(fireGround('tank', 0.5, traffic), 0, '최대 앙각 사격이 차를 부쉈다');
  assert.ok(fireGround('tank', 0, traffic) > 0, '수평 사격이 한 대도 못 맞혔다');
});
