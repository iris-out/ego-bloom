import test from 'node:test';
import assert from 'node:assert/strict';
import { wiperPhase } from '../../src/world/cockpits/wiperMotion.js';
import { installSimulationClock } from '../../src/world/simulationClock.js';
test('rain wiper phase freezes through pause and resumes without a wall-time jump',()=>{
 let paused=false;const clock={elapsedTime:0,getDelta(){this.elapsedTime+=.1;return .1;}};
 const restore=installSimulationClock(clock,()=>paused);clock.getDelta();const before=wiperPhase('rain',clock.elapsedTime);
 paused=true;for(let i=0;i<100;i++)clock.getDelta();assert.equal(wiperPhase('rain',clock.elapsedTime),before);
 paused=false;clock.getDelta();assert.ok(Math.abs(wiperPhase('rain',clock.elapsedTime)-before-.1/1.4)<1e-10);restore();
 assert.equal(wiperPhase('clear',10),0);
});
