import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';
import { cockpitTriangles, BUDGET } from '../../src/world/cockpits/triangles.js';
const models=await loadModelFixture(new URL('../../src/world/cockpits/RoadInteriors.jsx',import.meta.url).pathname);
for(const [key,name] of [['sedan','SedanInterior'],['suv','SuvInterior']])for(const quality of ['low','medium','high']){
 test(`${key} ${quality}: actual curved cabin matches triangle inventory and tier budget`,()=>{
  const root=models[name]({statusRef:{current:{}},quality});
  // Canvas-only live glass isn't mounted without document; its production surface has48 triangles.
  const actual=modelTriangles(root)+48;
  assert.equal(actual,cockpitTriangles(key,12,quality));assert.ok(actual<=BUDGET[quality]);
  root.traverse(n=>n.geometry?.dispose());
 });
}
