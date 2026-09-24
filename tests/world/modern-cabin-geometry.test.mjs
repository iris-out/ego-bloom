import test from 'node:test';
import assert from 'node:assert/strict';
import { curvedDisplayGeometry, steeringRimGeometry, MODERN_DISPLAYS } from '../../src/world/cockpits/modernCabinGeometry.js';

test('curved display is one continuous UV surface with forward facing normals',()=>{
  const g=curvedDisplayGeometry(1.02,.2,.06),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.x-.51)<1e-6);assert.ok(g.boundingBox.min.z>=0);assert.ok(g.boundingBox.max.z<=.060001);
  for(let i=0;i<p.count;i++){assert.ok(n.getZ(i)>.9);assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1);assert.ok(uv.getY(i)>=0&&uv.getY(i)<=1);}
  assert.ok(g.index.count/3<=64);g.dispose();
});
test('flattened steering rim preserves its lateral radius without obstructing screen',()=>{const g=steeringRimGeometry(.19,32);g.computeBoundingBox();assert.ok(g.boundingBox.min.y>-.19);assert.ok(g.boundingBox.max.x<.212);assert.ok(g.boundingBox.max.y<.213);g.dispose();});
test('G60 and G45 panels remain below road view with model specific placements',()=>{for(const spec of Object.values(MODERN_DISPLAYS)){assert.ok(spec.y+spec.height/2<-.14);assert.ok(spec.z<-.65);assert.ok(spec.width<1.2);}assert.notEqual(MODERN_DISPLAYS.sedan.z,MODERN_DISPLAYS.suv.z);});
