import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';
const families={
 Sedan:[1.20,2.58,1.29],Suv:[1.26,2.53,1.85],Convertible:[1.20,2.45,.85],Formula:[1.30,3.01,.62],Truck:[1.53,3.88,2.14],Motorcycle:[.55,1.57,.70],
 Tank:[1.82,4.65,2.23],Howitzer:[2.00,4.72,2.38],ArmoredCar:[1.30,4.28,2.03],AntiAir:[1.30,3.89,1.90],
 Jet:[10.02,6.13,3.11],Fighter:[6.14,8.98,3.94],Interceptor:[4.83,5.63,2.03],Bomber:[15.03,11.43,4.68],PropFighter:[5.83,6.77,1.83],Helicopter:[6.63,8.97,3.39],
};
const air=new Set(['Jet','Fighter','Interceptor','Bomber','PropFighter','Helicopter']);
for(const [name,[halfWidth,halfLength,height]] of Object.entries(families)){
 test(`${name}: actual authored mesh stays finite, supported and inside its accessory envelope`,async()=>{
  const {default:Model}=await loadModelFixture(new URL(`../../src/world/models/${name}.jsx`,import.meta.url).pathname);
  const root=Model({});root.updateMatrixWorld(true);const bounds=new THREE.Box3();let shells=0;
  root.traverse(node=>{const g=node.geometry;if(!g)return;const p=g.attributes.position;for(const value of p.array)assert.ok(Number.isFinite(value),`${name} non-finite vertex`);g.computeBoundingBox();bounds.union(g.boundingBox.clone().applyMatrix4(node.matrixWorld));if(p.count>100)shells++;});
  // Convertible mounts its complete 2+2 cabin in exterior view (23,870 triangles).
  const triangleLimit=name==='Convertible'?25000:21000;
  assert.ok(shells>0);assert.ok(modelTriangles(root)<triangleLimit,`${name} unbounded mesh growth`);
  assert.ok(bounds.min.x>=-halfWidth&&bounds.max.x<=halfWidth,`${name} width changed`);
  assert.ok(bounds.min.z>=-halfLength&&bounds.max.z<=halfLength,`${name} length changed`);
  assert.ok(bounds.max.y<=height,`${name} height changed`);
  assert.ok(Math.abs(bounds.min.y-(air.has(name)?-1.9:-.9))<(air.has(name)?.06:.001),`${name} loses ground support: ${bounds.min.y}`);
  root.traverse(node=>node.geometry?.dispose());
 });
}
