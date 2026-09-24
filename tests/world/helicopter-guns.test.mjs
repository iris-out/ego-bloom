import { helicopterGunPulse } from '../../src/world/models/helicopterGunMotion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { armamentOf } from '../../src/world/hardpoints.js';
import { CANNON, createArsenal, gunOf, muzzleAim, stepWeapons, toWorld } from '../../src/world/weapons.js';
import { createHealth, damageOf, hurt, isArmed } from '../../src/world/health.js';
import { hudPresentation } from '../../src/world/ui/hudPresentation.js';
import { airImpact, reticleOf } from '../../src/world/reticle.js';
import { createRemoteCombat, stepRemoteCombat } from '../../src/world/remoteCombat.js';
import { loadModelFixture } from './model-mount-fixture.mjs';
const pose={x:0,y:100,z:0,pitch:0,roll:0,heading:0,speed:0,phase:'airborne'};
const options=(over={})=>({plane:'helicopter',pose,mounts:armamentOf('helicopter'),fire:{cannon:true},dt:0,...over});
test('helicopter has two symmetric MG hardpoints, existing ammunition and combat HUD',()=>{
 const mounts=armamentOf('helicopter');assert.equal(mounts?.cannon.length,2);assert.equal(mounts.cannon[0][0],-mounts.cannon[1][0]);assert.equal(mounts.missile,undefined);assert.equal(mounts.bomb,undefined);
 assert.equal(gunOf('helicopter').speed,CANNON.speed);assert.equal(isArmed('flight','helicopter'),true);assert.ok(createHealth('flight','helicopter').max>0);
 const hud=hudPresentation('flight','helicopter','first',{hull:1});assert.equal(hud.showCannon,true);assert.equal(hud.showHull,true);assert.equal(hud.showMissiles,false);assert.ok(reticleOf('flight','helicopter'));
});
test('each helicopter trigger volley spawns left/right rounds and spends two rounds',()=>{
 const state=stepWeapons(createArsenal('helicopter'),options());assert.equal(state.projectiles.length,2);assert.equal(state.shots,2);assert.equal(state.cannonAmmo,CANNON.ammo-2);
 state.projectiles.forEach((bullet,i)=>{const mount=armamentOf('helicopter').cannon[i];assert.deepEqual([bullet.x,bullet.y-pose.y,bullet.z],mount);const aim=muzzleAim(mount,armamentOf('helicopter').converge);assert.ok(Math.abs(bullet.vx-aim[0]*CANNON.speed)<1e-9);});
 const dry=stepWeapons({...createArsenal('helicopter'),cannonAmmo:1},options());assert.equal(dry.projectiles.length,1);assert.equal(dry.cannonAmmo,0);
 const grounded=stepWeapons(createArsenal('helicopter'),options({pose:{...pose,phase:'runway'},dt:.05}));assert.equal(grounded.projectiles.length,0);
});
test('helicopter rounds use existing cannon hits, damage and blast effects',()=>{
 const initial=stepWeapons(createArsenal('helicopter'),options());const b=initial.projectiles[0];
 const hit=stepWeapons(initial,options({dt:.02,fire:{},airTargets:[{index:9,x:b.x+b.vx*.02,y:b.y+b.vy*.02,z:b.z+b.vz*.02,radius:.8}]}));
 assert.ok(hit.airHits.some(h=>h.index===9));assert.ok(hit.blasts.length>0);const health=createHealth('flight','fighter');assert.equal(hurt(health,damageOf('cannon'),1).hp,health.hp-16);
});
test('remote helicopter firing counters reproduce both muzzle positions',()=>{
 const peer={...pose,kind:'flight',key:'helicopter',id:'heli',life:1,shots:0};const baseline=stepRemoteCombat(createRemoteCombat(),{peers:[peer],dt:0});
 const state=stepRemoteCombat(baseline,{peers:[{...peer,shots:2}],dt:0});assert.equal(state.shells.length,2);assert.ok(state.shells[0].x<0&&state.shells[1].x>0);
});
test('actual helicopter model retains two gun muzzles at the firing hardpoints in first person',async()=>{
 const {default:Model}=await loadModelFixture(new URL('../../src/world/models/Helicopter.jsx',import.meta.url).pathname);
 for(const firstPerson of [false,true]){const root=Model({firstPerson});root.updateMatrixWorld(true);const muzzles=[];root.traverse(n=>{if(n.userData.part==='helicopter-gun-muzzle')muzzles.push(n);});assert.equal(muzzles.length,2);
  for(let i=0;i<2;i++){const actual=muzzles[i].getWorldPosition(new THREE.Vector3());const expected=new THREE.Vector3(...armamentOf('helicopter').cannon[i]);assert.ok(actual.distanceTo(expected)<1e-7);const direction=new THREE.Vector3(0,0,-1).applyQuaternion(muzzles[i].getWorldQuaternion(new THREE.Quaternion()));assert.ok(direction.distanceTo(new THREE.Vector3(...muzzleAim(armamentOf('helicopter').cannon[i],armamentOf('helicopter').converge)))<1e-7);let n=muzzles[i];while(n){assert.notEqual(n.visible,false);n=n.parent;}}
 }
 const turned={...pose,heading:.8,pitch:.25,roll:-.3};for(const mount of armamentOf('helicopter').cannon){const p=toWorld(turned,mount);assert.ok(Object.values(p).every(Number.isFinite));}
});

test('both MG flashes/recoil follow shot counters, decay, and freeze when paused',()=>{
 for(const index of [0,1]){const idle={shots:0,remaining:0},firing=helicopterGunPulse(idle,2,.016,index);assert.equal(firing.remaining,.055);assert.equal(helicopterGunPulse(firing,2,0,index),firing);assert.ok(helicopterGunPulse(firing,2,.016,index).remaining<firing.remaining);}
 assert.equal(helicopterGunPulse({shots:0,remaining:0},1,.016,0).remaining,.055);
 assert.equal(helicopterGunPulse({shots:0,remaining:0},1,.016,1).remaining,0);
});

test('helicopter aim prediction respects the same map range as its actual rounds',()=>{
 const extent=180, wall=z=>[{x:0,z,width:30,depth:6,height:140}], far=wall(-300);
 const predicted=airImpact({...pose,key:'helicopter'},'cannon',far,extent);
 assert.equal(predicted.hit,'none');assert.ok(predicted.range<=200.001);
 assert.equal(airImpact({...pose,key:'helicopter'},'cannon',wall(-150),extent).hit,'building');
 let state=stepWeapons(createArsenal('helicopter'),options({extent})),blasts=0;
 for(let frame=0;frame<80;frame++){state=stepWeapons(state,options({extent,dt:1/60,fire:{},obstacles:far}));blasts+=state.blasts.length;}
 assert.equal(state.projectiles.length,0);assert.equal(blasts,0);
});

 test('remote helicopter rounds inherit flight speed and expire at the local cannon range',()=>{
 const extent=180;
 for(const speed of [0,32]) {
  const peer={...pose,speed,kind:'flight',key:'helicopter',id:'heli',life:1,shots:0};
  const baseline=stepRemoteCombat(createRemoteCombat(),{peers:[peer],dt:0,extent});
  const firedPeer={...peer,shots:2};
  const initial=stepRemoteCombat(baseline,{peers:[firedPeer],dt:0,extent});
  const local=stepWeapons(createArsenal('helicopter'),options({extent,pose:{...pose,speed}}));
  initial.shells.forEach((shell,i)=>{for(const axis of ['vx','vy','vz'])assert.ok(Math.abs(shell[axis]-local.projectiles[i][axis])<1e-9);});
  for(const [z,expected] of [[-150,32],[-300,0]]){
   let state=initial,damage=0;
   for(let frame=0;frame<100;frame++){state=stepRemoteCombat(state,{peers:[firedPeer],self:{kind:'flight',key:'fighter',x:0,y:100,z,radius:7,life:1},dt:1/60,extent});damage+=state.damage;}
   assert.equal(damage,expected);assert.equal(state.shells.length,0);
  }
 }
});
