import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarState, stepCar } from '../../src/world/carPhysics.js';
import { validVehicle, validSelectablePlane } from '../../src/world/identity.js';
import { rideOf } from '../../src/world/rideSpecs.js';
import { validPose } from '../../src/world/multiplayer.js';
import { hasFirstPerson } from '../../src/world/eyePoints.js';
import { armamentOf } from '../../src/world/hardpoints.js';

// Forgetting a registration used to silently normalize new rides to the default.
test('new ride choices retain their identity through the picker and remote pose', () => {
  assert.equal(validVehicle('drift'), 'drift');
  assert.equal(validSelectablePlane('airship'), 'airship');
  for (const [kind,key,phase] of [['car','drift','drive'],['flight','airship','airborne']]) {
    assert.ok(rideOf(kind,key));
    assert.ok(hasFirstPerson(key));
    const pose = validPose({kind,key,phase,x:1,y:40,z:1,heading:0,pitch:0,roll:0,speed:10});
    assert.equal(pose.key,key);
  }
  assert.equal(armamentOf('airship'),null);
});

const driving = () => ({...createCarState(1000,'drift'), x: 600, z: 500, heading: 0, speed: 22});
const tickCar = (state,input,frames=1,kind='drift') => {
  for (let i=0;i<frames;i++) state=stepCar(state,input,1/60,1000,[],kind);
  return state;
};
const slip = s => Math.atan2(Math.sin((s.travelHeading ?? s.heading)-s.heading), Math.cos((s.travelHeading ?? s.heading)-s.heading));

test('handbrake initiates real sideways travel, throttle sustains it and countersteer recovers', () => {
  const initiated=tickCar(driving(),{throttle:1,steer:1,handbrake:true},45);
  assert.ok(Math.abs(slip(initiated))>.2, `slip ${slip(initiated)}`);
  const sustained=tickCar(initiated,{throttle:1,steer:.4},30);
  assert.ok(Math.abs(slip(sustained))>.15);
  const recovered=tickCar(sustained,{steer:-.5},30);
  assert.ok(Math.abs(slip(recovered))<Math.abs(slip(sustained)));
  const straight=tickCar(recovered,{},240);
  assert.ok(Math.abs(slip(straight))<.05);
});

test('ordinary convertible keeps its current travel direction and stationary drift car cannot slide', () => {
  const ordinary=tickCar(driving(),{throttle:1,steer:1,handbrake:true},45,'convertible');
  assert.equal(slip(ordinary),0);
  const stopped={...driving(),speed:0};
  const next=tickCar(stopped,{steer:1,handbrake:true},60);
  assert.equal(next.x,stopped.x); assert.equal(next.z,stopped.z);
});

test('airship physics supports independent ascent, hover, slow forward flight and safe reset', async () => {
  const air = await import('../../src/world/airshipPhysics.js').catch(()=>null);
  assert.ok(air,'airship physics must exist');
  const run=(s,input,frames=180,obstacles=[])=>{for(let i=0;i<frames;i++)s=air.stepAirship(s,input,1/60,300,obstacles);return s;};
  const home=air.createAirshipState(300);
  const raised=run(home,{pitch:1},240);
  assert.equal(raised.phase,'airborne'); assert.ok(raised.y>home.y+10);
  const settled=run(raised,{},300);
  const hover=run(settled,{},300);
  assert.ok(Math.abs(hover.y-settled.y)<.2); assert.ok(hover.speed<.1);
  const moving=run(hover,{throttle:1},600);
  assert.ok(moving.speed>10 && moving.speed<30);
  assert.ok(Math.abs(moving.y-hover.y)<.2);
  const turning=run(hover,{roll:1},120);
  assert.ok(turning.heading<0 && Math.abs(turning.heading)<1.6);
  assert.ok(Math.abs(turning.roll)<.15);
  let crash=run({...hover,x:0,z:20,y:20,vz:-10},{throttle:1},60,[{x:0,z:0,width:10,depth:10,height:50}]);
  assert.equal(crash.phase,'crashed');
  crash=run(crash,{},200); assert.equal(crash.phase,'runway');
  for(const dt of [NaN,Infinity,-1,100]) {
    const s=air.stepAirship(home,{throttle:NaN,pitch:Infinity,roll:NaN},dt,300);
    for(const key of ['x','y','z','speed','heading','pitch','roll'])assert.ok(Number.isFinite(s[key]),key);
  }
});

test('wide aircraft collision clearance reaches adjacent spatial cells and explicit-margin obstacles', async () => {
  const {hitsAnyBuilding}=await import('../../src/world/solidIndex.js');
  const obstacles=Array.from({length:30},(_,i)=>({x:200+i*60,z:200,width:2,depth:2,height:10}));
  obstacles.push({x:51,z:0,width:1,depth:1,height:10,margin:0,roofMargin:0});
  assert.equal(hitsAnyBuilding({x:46,y:8,z:0},{x:46,y:8,z:0},obstacles,null,{margin:0,roofMargin:0,radius:5}),true);
});

test('holding throttle and handbrake through a drift sheds some speed without abruptly stopping', () => {
  const start=driving();
  const sliding=tickCar(start,{throttle:1,steer:1,handbrake:true},60);
  assert.ok(sliding.speed<start.speed-2, `must slow: ${start.speed} -> ${sliding.speed}`);
  assert.ok(sliding.speed>start.speed-9, `must keep rolling: ${sliding.speed}`);
  assert.ok(sliding.drift);
});

test('normal steering never initiates a slide without the handbrake', () => {
  const normal=tickCar(driving(),{throttle:1,steer:.8},120);
  assert.ok(Math.abs(slip(normal))<.02, `normal grip slip ${slip(normal)}`);
  assert.equal(normal.drift,false);
  const start=tickCar(driving(),{throttle:1,steer:1,handbrake:true},45);
  const recovered=tickCar(start,{steer:-.5},90);
  const turn=tickCar(recovered,{throttle:1,steer:.8},90);
  assert.ok(Math.abs(slip(turn))<.02,'grip must stay restored after recovery');
});

test('rotated obstacle clearance has the same result in the spatial index', async () => {
  const {hitsAnyBuilding,hitsBuilding}=await import('../../src/world/solidIndex.js');
  const obstacle={x:50,z:0,width:2,depth:2,height:20,rotation:Math.PI/4,margin:0,roofMargin:0};
  const point={x:42,y:8,z:0}, clearance={margin:0,roofMargin:0,radius:5};
  const distant=Array.from({length:30},(_,i)=>({x:200+i*60,z:200,width:2,depth:2,height:10}));
  assert.equal(hitsBuilding(point,point,obstacle,clearance),true);
  assert.equal(hitsAnyBuilding(point,point,[obstacle,...distant],null,clearance),true);
});

test('airship launches clear of airport structures and sightseeing autopilot climbs before cruising', async () => {
  const {createAirshipState,stepAirship,stepAirshipAutopilot}=await import('../../src/world/airshipPhysics.js');
  const {airportBoxes}=await import('../../src/world/models/airportLayout.js');
  for(const extent of [180,300,1000]) {
    const obstacles=airportBoxes(extent);
    let s=createAirshipState(extent), ap={mode:'depart',elapsed:0};
    for(let i=0;i<600;i++) {
      const guided=stepAirshipAutopilot(ap,s,{extent,dt:.05});ap=guided.ap;
      s=stepAirship(s,guided.input,.05,extent,obstacles);
      assert.notEqual(s.phase,'crashed');
    }
    assert.equal(s.phase,'airborne');assert.ok(s.y>100);assert.ok(s.speed>5);
  }
});

test('opening menus releases the touch handbrake as well as steering', async () => {
  const {releaseWorldControls}=await import('../../src/world/simulationClock.js');
  const controls={handbrake:true,steer:1,throttle:1};
  releaseWorldControls(controls);
  assert.equal(controls.handbrake,false);
});
