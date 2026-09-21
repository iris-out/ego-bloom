import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight, flightStatus, PLANES, planeSpec, SPEED_DISPLAY } from '../../src/world/flightPhysics.js';

test('jet starts stationary on the runway and zero throttle keeps it parked', () => {
  let state = createFlightState(300);
  for (let i = 0; i < 120; i++) state = stepFlight(state, {}, 1 / 60, 300);
  assert.equal(state.x, 410);
  assert.equal(state.z, 140);
  assert.equal(state.speed, 0);
  assert.equal(state.phase, 'runway');
});

test('full throttle and pitch up can take off before the runway ends', () => {
  let state = createFlightState(300);
  for (let i = 0; i < 360; i++) state = stepFlight(state, { throttle: 1, pitch: 0.5 }, 1 / 60, 300);
  assert.equal(state.phase, 'airborne');
  assert.ok(state.y > 10);
  assert.ok(state.z > -180);
});

test('leaving runway on the ground causes a crash', () => {
  const next=stepFlight({...createFlightState(300),z:-269,speed:50},{throttle:1},.05,300);
  assert.equal(next.phase,'crashed');
});

test('clamps throttle and frame time, and rejects nonfinite inputs', () => {
  for (const dt of [NaN, Infinity, -1, 100, 0.016]) {
    const state = stepFlight(createFlightState(300), { throttle: 20, pitch: NaN, roll: Infinity, yaw: -Infinity }, dt, 300);
    for (const field of ['x', 'y', 'z', 'pitch', 'roll', 'heading', 'speed', 'throttle']) assert.ok(Number.isFinite(state[field]), field);
    assert.ok(state.throttle >= 0 && state.throttle <= 1);
    assert.ok(state.speed < 2);
  }
  assert.equal(stepFlight(createFlightState(300), { throttle: -3 }, 0.016, 300).throttle, 0);
});

test('runway touchdown preserves speed and continues ground taxi', () => {
  const next=stepFlight({...createFlightState(300),phase:'airborne',z:50,y:2.15,speed:45,pitch:-.1},{throttle:.1},.05,300);
  assert.equal(next.phase,'runway');
  assert.ok(next.speed>40);
  assert.ok(next.z<50 && next.z>40);
  assert.equal(next.y,2.1);
  assert.equal(stepFlight(next,{throttle:.1},.05,300).phase,'runway');
});

test('building and off-runway ground impacts explode then respawn after three seconds',()=>{
  const obstacle={x:0,z:0,height:80};
  let state=stepFlight({...createFlightState(300),phase:'airborne',x:0,z:16,y:30,speed:100},{throttle:1},.05,300,[obstacle]);
  assert.equal(state.phase,'crashed');
  for(let i=0;i<59;i++)state=stepFlight(state,{},.05,300,[obstacle]);
  assert.equal(state.phase,'crashed');
  state=stepFlight(state,{},.05,300,[obstacle]);
  assert.equal(state.phase,'runway');assert.equal(state.z,140);assert.equal(state.speed,0);
  const ground=stepFlight({...createFlightState(300),phase:'airborne',x:0,z:0,y:2.11,pitch:-.4,speed:50},{},.05,300);
  assert.equal(ground.phase,'crashed');
});

test('outside flight area gently steers inward without teleporting',()=>{
  let state={...createFlightState(300),phase:'airborne',x:1500,z:0,y:200,speed:70,heading:-Math.PI/2};
  const first=stepFlight(state,{throttle:.6},.05,300);
  assert.ok(Math.hypot(first.x-state.x,first.z-state.z)<7);
  assert.equal(first.phase,'airborne');assert.notEqual(first.heading,state.heading);
  for(let i=0;i<900;i++)state=stepFlight(state,{throttle:.6},1/60,300);
  assert.ok(state.x<1500);assert.equal(state.phase,'airborne');
});

test('cockpit reports speed in km/h and compass clockwise degrees with pitch and bank', () => {
  const status = flightStatus({ ...createFlightState(300), speed: 50, y: 102.1, heading: -Math.PI / 2, pitch: Math.PI / 6, roll: -Math.PI / 4 });
  // 계기는 물리 속도에 SPEED_DISPLAY 를 곱해 읽는다. 50m/s 는 180km/h 가 아니라 216km/h 다.
  assert.equal(status.speed, Math.round(50 * 3.6 * SPEED_DISPLAY));
  assert.equal(status.speed, 216);
  assert.equal(status.heading, 90);
  assert.equal(status.pitch, 30);
  assert.equal(status.roll, -45);
  assert.equal(status.altitude, 100);
  assert.equal(flightStatus({ ...createFlightState(), heading: Math.PI * 6 }).heading, 0);
});

test('mobile normalized controls accelerate, rotate, climb and bank after takeoff', () => {
  let state = createFlightState(300);
  const mobile = { throttle: 0.85, pitch: 0, roll: 0, yaw: 0 };
  for (let i = 0; i < 240; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.equal(state.phase, 'runway');
  assert.ok(state.speed > 34);
  assert.ok(state.z < 140);
  mobile.pitch = 0.65;
  for (let i = 0; i < 120; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.equal(state.phase, 'airborne');
  assert.ok(state.y > 20);
  assert.ok(state.z > -170);
  mobile.roll = 0.5; mobile.yaw = 0.2;
  for (let i = 0; i < 120; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.ok(state.x > 410);
  assert.ok(flightStatus(state).heading > 0);
  const airborneSpeed = state.speed;
  mobile.throttle = 0;
  for (let i = 0; i < 60; i++) state = stepFlight(state, mobile, 1 / 60, 300);
  assert.ok(state.speed < airborneSpeed);
});

test('기종마다 최고 속도와 조종 반응이 다르다', () => {
  const run = (plane) => {
    let state = createFlightState(300);
    for (let i = 0; i < 3600; i++) state = stepFlight(state, { throttle: 1, pitch: i > 120 ? 0.4 : 0 }, 1 / 60, 300, [], plane);
    return state;
  };
  const jet = run('jet'), bomber = run('bomber'), prop = run('prop'), fighter = run('fighter');
  assert.ok(fighter.speed > jet.speed, `전투기 ${fighter.speed} 제트 ${jet.speed}`);
  assert.ok(jet.speed > bomber.speed, `제트 ${jet.speed} 폭격기 ${bomber.speed}`);
  assert.ok(bomber.speed > prop.speed, `폭격기 ${bomber.speed} 프로펠러기 ${prop.speed}`);
  assert.ok(PLANES.fighter.rollAuthority > PLANES.bomber.rollAuthority);
  assert.ok(PLANES.prop.rollAuthority > PLANES.fighter.rollAuthority, '프로펠러기가 가장 잘 구른다');
});

test('알 수 없는 기종은 제트 성능으로 떨어진다', () => {
  assert.deepEqual(planeSpec('없는기종'), PLANES.jet);
  assert.deepEqual(planeSpec(undefined), PLANES.jet);
  assert.deepEqual(planeSpec('helicopter'), PLANES.jet);
});

test('기종 인자를 생략하면 제트와 같게 난다', () => {
  const fly = (plane) => {
    let state = createFlightState(300);
    for (let i = 0; i < 600; i++) state = stepFlight(state, { throttle: 1 }, 1 / 60, 300, [], plane);
    return state.speed;
  };
  assert.equal(fly(undefined), fly('jet'));
});
