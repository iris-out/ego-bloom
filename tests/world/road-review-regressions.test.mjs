import test from 'node:test';
import assert from 'node:assert/strict';
import { roadClearance } from '../../shared/roadClearance.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { lampSpots, streetTrees } from '../../src/world/roadFurniture.js';
import { addElevatedRoad } from '../../src/world/models/roadStructures.js';
import { roadSurface } from '../../src/world/roadSurface.js';
import { hitsBuilding } from '../../src/world/solidIndex.js';
import { addBridge } from '../../src/world/models/transitModels.js';

const collect=(road,options)=>{
  const parts=[];
  addElevatedRoad((material,position,scale,owner,shape,rotation)=>parts.push({material,position,scale,rotation}),road,options);
  return parts;
};

test('bridge towers move along the deck when a connecting lane crosses their station',()=>{
  const bridge={x1:0,z1:-100,x2:0,z2:100,width:26,big:true};
  const crossing={x1:-100,z1:-36,x2:100,z2:-36,kind:'lane'};
  const solids=[];
  addBridge(()=>{},bridge,'medium',{clearance:roadClearance({roads:[crossing],bridges:[bridge]}),
    onPylon:solid=>solids.push(solid)});
  assert.equal(solids.length,4,'a legal nearby tower station should retain the bridge towers');
  for(let x=-30;x<=30;x++)for(const offset of [-3.8,0,3.8]){
    const point={x,z:-36+offset,y:1.21};
    assert.equal(solids.some(s=>hitsBuilding(point,point,s)),false,`tower blocks x${x} lane${offset}`);
  }
});

test('pier placement reserves the whole padded collision box beside a ground lane',()=>{
  const road={x1:0,z1:0,x2:0,z2:200,kind:'highway',elevated:true,deckY:14};
  const ground={x1:-100,z1:65,x2:100,z2:65,kind:'collector'};
  const solids=[];
  collect(road,{width:28,height:14,quality:'medium',pierSpacing:50,
    clearance:roadClearance({roads:[road,ground]}),onPier:solid=>solids.push(solid)});
  assert.ok(solids.length>0,'all supports disappeared');
  for(let x=-100;x<=100;x+=2)for(const offset of [-6.3,0,6.3]){
    const point={x,z:65+offset,y:1.21};
    assert.equal(solids.some(s=>hitsBuilding(point,point,s)),false,`blocked road x${x} offset${offset}`);
  }
});

test('full lamp column cannot protrude through a ramp above its base',()=>{
  const plan={roads:[{x1:-100,z1:0,x2:100,z2:0,kind:'collector'}],
    ramps:[{points:[[-76,-20,4,12],[-76,20,4,12]]}]};
  assert.equal(lampSpots(plan,'medium').spots.some(p=>Math.abs(p.x+76)<.01&&Math.abs(p.z-9.1)<.01),false);
});

test('vertical clearance permits high ground canopies but excludes raised-road canopy overlap',()=>{
  const road={x1:0,z1:-100,x2:0,z2:100,kind:'collector'};
  const ground=roadClearance({roads:[road]});
  assert.equal(ground.columnClear(0,0,2.1,3.1,6.3),true);
  const raised=roadClearance({roads:[],ramps:[{points:[[0,-100,4,12],[0,100,4,12]]}]});
  assert.equal(raised.columnClear(0,0,2.1,3.1,6.3),false);
  assert.equal(raised.columnClear(0,0,.2,0,1),true,'short object can remain well below the deck');
});

test('tree crown uses the actual unit-sphere radius, not half its Y scale',()=>{
  const main={x1:-100,z1:0,x2:100,z2:0,kind:'collector'};
  const crossing={x1:-90,z1:10,x2:-90,z2:100,kind:'alley'};
  const plan={roads:[main,crossing]},clearance=roadClearance(plan);
  for(const part of streetTrees(plan,'medium')){
    if(part[0]!=='leaf')continue;
    const [x,y,z]=part[1],scale=part[2];
    assert.equal(clearance.columnClear(x,z,Math.max(scale[0],scale[2]),y-scale[1],y+scale[1]),true);
  }
});

test('deck-mounted lamps retain their supporting road but clear a crossing road',()=>{
  const road={x1:0,z1:0,x2:0,z2:200,kind:'highway',elevated:true,deckY:14};
  const options={width:28,height:14,quality:'medium'};
  const bare=collect(road,options).filter(p=>p.material==='lamp');
  const alone=collect(road,{...options,clearance:roadClearance({roads:[road]})}).filter(p=>p.material==='lamp');
  assert.ok(bare.length>0);
  assert.equal(alone.length,bare.length);
  const z=bare[0].position[2];
  const cross={x1:-100,z1:z,x2:100,z2:z,kind:'highway',elevated:true,deckY:14};
  const cut=collect(road,{...options,clearance:roadClearance({roads:[road,cross]})}).filter(p=>p.material==='lamp');
  assert.ok(cut.length<alone.length,'crossing road did not clear mounted lamps');
});

test('elevated deck boxes and physical support consume canonical absolute caps',()=>{
  const road={x1:0,z1:0,x2:0,z2:100,kind:'highway',elevated:true,deckY:14,capStart:2,capEnd:4};
  const plan={roads:[road]};
  for(const quality of ['low','medium','high']){
    const deck=collect(road,{width:28,height:14,quality}).find(p=>p.material==='road');
    assert.deepEqual(deck.position,[0,14,51]);
    assert.equal(deck.scale[2],106);
    assert.equal(roadSurface(plan,0,-1,14.6).top,14.6);
    assert.equal(roadSurface(plan,0,103,14.6).top,14.6);
    assert.equal(roadSurface(plan,0,105,14.6).top,.33);
  }
});

test('both highway lanes have visible physical support through every loop joint',()=>{
  for(const extent of [1000,1600,3600]){
    const plan=createUrbanPlan(extent),roads=plan.roads.filter(r=>/^highway-\d+$/.test(r.id));
    const decks=roads.map(r=>collect(r,{width:28,height:14,quality:'low'}).find(p=>p.material==='road'));
    for(let i=0;i<roads.length;i++){
      const a=roads[i],b=roads[(i+1)%roads.length];
      const angleA=Math.atan2(a.x2-a.x1,a.z2-a.z1),angleB=Math.atan2(b.x2-b.x1,b.z2-b.z1);
      let turn=angleB-angleA;
      while(turn>Math.PI)turn-=2*Math.PI;
      while(turn<-Math.PI)turn+=2*Math.PI;
      for(const offset of [-10.5,-3.5,3.5,10.5]){
        const angle=angleA+turn/2,x=a.x2-Math.cos(angle)*offset,z=a.z2+Math.sin(angle)*offset;
        assert.equal(roadSurface(plan,x,z,14.6).top,14.6,`extent${extent} joint${i} offset${offset}`);
        assert.ok(decks.some(d=>{
          const dx=x-d.position[0],dz=z-d.position[2],c=Math.cos(d.rotation),s=Math.sin(d.rotation);
          return Math.abs(c*dx-s*dz)<=d.scale[0]/2+1e-5&&Math.abs(s*dx+c*dz)<=d.scale[2]/2+1e-5;
        }),'physical support has no rendered deck');
      }
    }
  }
});
