import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Euler, Vector3 } from 'three';
import { addBridge } from '../../src/world/models/transitModels.js';
import { buildArchitecture } from '../../src/world/cityModels.js';

test('bridge stays connect a pylon head to the deck on both crossing axes', () => {
  for (const axis of ['x', 'z']) {
    const parts=[];
    addBridge((material,position,scale,owner,shape,rotation)=>parts.push({material,position,scale,shape,rotation}),
      { x:0,z:0,width:40,length:240,big:true,axis },'medium');
    const pylons=parts.filter(p=>p.shape==='box'&&p.scale[0]===1.6&&p.scale[1]>10);
    const cables=parts.filter(p=>p.shape==='cylinder'&&p.scale[0]===.1);
    assert.ok(cables.length>0);
    for (const cable of cables) {
      assert.ok(Array.isArray(cable.rotation),'stay must slope to the tower');
      const rotation=new Matrix4().makeRotationFromEuler(new Euler(...cable.rotation,'YXZ'));
      const a=new Vector3(0,-cable.scale[1]/2,0).applyMatrix4(rotation).add(new Vector3(...cable.position));
      const b=new Vector3(0,cable.scale[1]/2,0).applyMatrix4(rotation).add(new Vector3(...cable.position));
      const top=a.y>b.y?a:b,base=a.y>b.y?b:a;
      assert.ok(pylons.some(p=>Math.hypot(top.x-p.position[0],top.z-p.position[2])<.001),'cable terminates on a tower');
      assert.ok(base.y>.2&&base.y<1,'cable foot terminates at deck');
      assert.ok(Math.hypot(top.x-base.x,top.z-base.z)>2);
    }
  }
});

test('Seoul shopfronts have instanced readable sign faces with stable owner and finite transforms',()=>{
  const input=[{id:'shop-street',tier_name:'bronze',x:0,z:0,height:18,model_variant:0}];
  const a=buildArchitecture(input,'medium');
  assert.deepEqual(a,buildArchitecture(input,'medium'));
  const signs=Object.values(a).filter(b=>b.material==='shopfront').flatMap(b=>b.parts);
  assert.ok(signs.length>=4,'colored blank boxes need readable sign faces');
  assert.ok(signs.every(p=>p.owner==='shop-street'&&p.position.every(Number.isFinite)&&p.scale.every(v=>v>0)));
});
