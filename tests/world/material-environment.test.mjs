import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, Texture } from 'three';
import { retainMaterialEnvironment } from '../../src/world/models/materialEnvironment.js';
test('shared material keeps its environment when either sibling unmounts',()=>{
 for(const order of [[0,1],[1,0]]){
  const material=new MeshStandardMaterial(),texture=new Texture();
  const releases=[retainMaterialEnvironment(material,texture),retainMaterialEnvironment(material,texture)];
  releases[order[0]]();assert.equal(material.envMap,texture);assert.equal(material.envMapIntensity,.55);
  releases[order[1]]();assert.equal(material.envMap,null);assert.equal(material.envMapIntensity,1);
  releases[0]();assert.equal(material.envMap,null);material.dispose();texture.dispose();
 }
});
test('different renderer leases never restore a previously released environment',()=>{
 const material=new MeshStandardMaterial(),original=new Texture(),a=new Texture(),b=new Texture();material.envMap=original;material.envMapIntensity=.8;
 const releaseA=retainMaterialEnvironment(material,a),releaseB=retainMaterialEnvironment(material,b);
 releaseA();assert.equal(material.envMap,b);releaseB();assert.equal(material.envMap,original);assert.equal(material.envMapIntensity,.8);
 material.dispose();for(const texture of [original,a,b])texture.dispose();
});
