import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldPhase, worldPhaseReducer, sessionPolicy, countdownStep } from '../../src/world/worldPhase.js';
import { installSimulationClock, releaseWorldControls } from '../../src/world/simulationClock.js';
import { armTimeAttack, stepTimeAttack, timeAttackView } from '../../src/world/timeAttack.js';

const reduce = (state, ...actions) => actions.reduce(worldPhaseReducer, state);
const enter = mode => reduce(createWorldPhase(), { type: 'enterSession', mode });
const drive = mode => reduce(enter(mode), { type: 'openPicker' }, { type: 'launch', ride: {kind:'car',key:'tank'}, now:0 }, {type:'countdownDone'});

test('menu and single never enable multiplayer; leaving shared session disables it', () => {
  assert.deepEqual(sessionPolicy(createWorldPhase()), { multiplayer:false, paused:false, inputBlocked:true });
  assert.equal(sessionPolicy(enter('single')).multiplayer, false);
  const multi=enter('multi');
  assert.equal(sessionPolicy(multi).multiplayer, true);
  assert.deepEqual(worldPhaseReducer(multi,{type:'leaveSession'}),createWorldPhase());
  assert.equal(sessionPolicy(worldPhaseReducer(multi,{type:'leaveSession'})).multiplayer,false);
  assert.equal(worldPhaseReducer(createWorldPhase(),{type:'enterSession',mode:'unexpected'}).session,null);
});

test('single menu freezes simulation and preserves the mounted ride phase', () => {
  const riding=drive('single');
  const paused=worldPhaseReducer(riding,{type:'openMenu',now:100});
  assert.equal(paused.phase,'driving');
  assert.equal(paused.ride,riding.ride);
  assert.deepEqual(sessionPolicy(paused),{multiplayer:false,paused:true,inputBlocked:true});
  assert.equal(sessionPolicy(worldPhaseReducer(paused,{type:'closeMenu',now:10000})).inputBlocked,false);
});

test('shared menu blocks local inputs while simulation and room remain active', () => {
  const opened=worldPhaseReducer(drive('multi'),{type:'openMenu',now:100});
  assert.deepEqual(sessionPolicy(opened),{multiplayer:true,paused:false,inputBlocked:true});
  assert.equal(opened.phase,'driving');
});

test('single countdown excludes menu time, shared countdown continues', () => {
  for(const mode of ['single','multi']){
    let state=reduce(enter(mode),{type:'openPicker'},{type:'launch',ride:{kind:'flight',key:'jet'},now:1000});
    state=worldPhaseReducer(state,{type:'openMenu',now:1500});
    state=worldPhaseReducer(state,{type:'closeMenu',now:6500});
    assert.equal(countdownStep(state,6500),mode==='single'?1:3);
  }
});

test('one shared clock freezes traffic time and time attack without a resume jump', () => {
  let real=0, previous=0, paused=false;
  const clock={elapsedTime:0,getDelta(){const delta=real-previous;previous=real;this.elapsedTime+=delta;return delta;}};
  const original=clock.getDelta;
  const restore=installSimulationClock(clock,()=>paused);
  let attack=stepTimeAttack(armTimeAttack(),clock.elapsedTime);
  real=10;assert.equal(clock.getDelta(),10);attack=stepTimeAttack(attack,clock.elapsedTime);
  assert.equal(timeAttackView(attack).remaining,170);
  paused=true;
  for(real=11;real<=600;real++){assert.equal(clock.getDelta(),0);attack=stepTimeAttack(attack,clock.elapsedTime);}
  assert.equal(clock.elapsedTime,10);
  assert.equal(timeAttackView(attack).remaining,170);
  paused=false;real=600.016;
  assert.ok(Math.abs(clock.getDelta()-.016)<1e-9);
  assert.ok(Math.abs(clock.elapsedTime-10.016)<1e-9);
  restore();assert.equal(clock.getDelta,original);
});

test('releasing menu inputs clears all held actions but preserves control counters', () => {
  const controls={throttle:1,fire:true,fireCannon:true,fireMissile:true,fireBomb:true,run:true,aim:true,autopilot:true,forward:1,lookYaw:1,resetNonce:4,reloadNonce:2,weapon:'sniper'};
  releaseWorldControls(controls);
  for(const key of ['fire','fireCannon','fireMissile','fireBomb','run','aim','autopilot'])assert.equal(controls[key],false,key);
  for(const key of ['throttle','forward','lookYaw'])assert.equal(controls[key],0,key);
  assert.equal(controls.weapon,null);
  assert.equal(controls.resetNonce,4);assert.equal(controls.reloadNonce,2);
});


test('audio preference updates existing engine output and pause silences it', async () => {
  const { engineOut, setWorldAudio } = await import('../../src/world/sound.js');
  const context={destination:{},createGain(){return {context:this,gain:{value:1},connect(){}};}};
  setWorldAudio({volume:.4});
  const output=engineOut(context);
  assert.equal(output.gain.value,.4);
  setWorldAudio({volume:.7,paused:true});assert.equal(output.gain.value,0);
  setWorldAudio({volume:.7,paused:false});assert.equal(output.gain.value,.7);
  setWorldAudio({volume:0});assert.equal(output.gain.value,0);
  setWorldAudio();
});
