import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrbanPlan, ROAD_WIDTH } from '../../shared/urbanPlan.js';
import { __debug, buildWorld } from '../../shared/worldLayout.js';
import { cityHills } from '../../shared/cityNodes.js';
import { inNature } from '../../shared/nature.js';
import { inRiver, inRiverPark, inWaterBody } from '../../shared/river.js';

const EXTENTS=[1000,1600,1844,2164,3600];
const distance=(road,x,z)=>{
  const dx=road.x2-road.x1,dz=road.z2-road.z1;
  const t=Math.max(0,Math.min(1,((x-road.x1)*dx+(z-road.z1)*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-road.x1-t*dx,z-road.z1-t*dz);
};
const pathRoads=(plan,id)=>plan.roads.filter(road=>road.path===id);
const hasRoadAt=(roads,x,z)=>roads.some(road=>distance(road,x,z)<1e-5);

test('northern streets form a curved loop between existing arterials',()=>{
  for(const extent of EXTENTS){
    const plan=createUrbanPlan(extent);
    const north=plan.neighborhoods.find(item=>item.kind==='north');
    assert.ok(north,`extent ${extent}: northern neighborhood`);
    const roads=north.pathIds.flatMap(id=>pathRoads(plan,id));
    assert.ok(roads.length>=3,`extent ${extent}: curved road segments`);
    assert.ok(new Set(roads.map(road=>Math.round(road.angle*10))).size>=3,
      `extent ${extent}: road changes heading`);
    const arterial=plan.roads.filter(road=>road.kind==='arterial');
    assert.ok(hasRoadAt(arterial,roads[0].x1,roads[0].z1));
    assert.ok(hasRoadAt(arterial,roads.at(-1).x2,roads.at(-1).z2));
    assert.equal(plan.network.disconnected.length,0,`extent ${extent}: connected network`);
  }
});

test('southern diagonal runs southwest to the eastern bank and joins existing roads',()=>{
  for(const extent of EXTENTS){
    const plan=createUrbanPlan(extent);
    const south=plan.neighborhoods.find(item=>item.kind==='south');
    assert.ok(south,`extent ${extent}: southern neighborhood`);
    const roads=south.pathIds.flatMap(id=>pathRoads(plan,id));
    assert.ok(roads.length>=3);
    const start=roads[0],end=roads.at(-1);
    assert.ok(start.x1<0&&start.z1>0&&end.x2>0&&end.z2>0&&end.z2<start.z1,
      `extent ${extent}: diagonal direction`);
    const oldRoads=plan.roads.filter(road=>road.kind==='arterial'||road.path==='river-south');
    assert.ok(hasRoadAt(oldRoads,start.x1,start.z1));
    assert.ok(hasRoadAt(oldRoads,end.x2,end.z2));
    assert.equal(plan.network.disconnected.length,0,`extent ${extent}: connected network`);
  }
});

test('neighborhood roads and pocket plazas clear natural ground and driving surfaces',()=>{
  for(const extent of EXTENTS){
    const plan=createUrbanPlan(extent),newIds=new Set(plan.neighborhoods.flatMap(n=>n.pathIds));
    assert.ok(plan.neighborhoodReservations.length>0);
    for(const road of plan.roads.filter(road=>newIds.has(road.path))){
      const width=ROAD_WIDTH[road.kind],dx=road.x2-road.x1,dz=road.z2-road.z1;
      const run=Math.hypot(dx,dz),nx=-dz/run,nz=dx/run;
      for(let step=0;step<=Math.ceil(run/4);step++){
        const t=step/Math.ceil(run/4),x=road.x1+t*dx,z=road.z1+t*dz;
        for(const offset of [-width/2,0,width/2]){
          const sx=x+nx*offset,sz=z+nz*offset;
          assert.ok(!inRiver(extent,sx,sz)&&!inRiverPark(extent,sx,sz)&&!inNature(extent,sx,sz)
            &&cityHills(extent).every(hill=>Math.hypot(sx-hill.x,sz-hill.z)>hill.r),
          `extent ${extent}: unsupported corridor ${road.id}`);
          if(inWaterBody(extent,sx,sz))assert.ok(plan.bridges.some(bridge=>
            bridge.sourceRoad?.startsWith('neighborhood-')&&distance(bridge,sx,sz)<=bridge.width/2+1),
          `extent ${extent}: missing bridge beneath ${road.id}`);
          assert.ok(plan.parks.every(park=>Math.abs(sx-park.x)>=park.rx||Math.abs(sz-park.z)>=park.rz),
            `extent ${extent}: ${road.id} crosses park`);
        }
      }
    }
    for(const n of plan.neighborhoods)for(const plaza of n.plazas){
      assert.ok(plan.plazas.some(item=>item.x===plaza.x&&item.z===plaza.z&&item.r===plaza.r),
        `extent ${extent}: pocket plaza is published for scenery`);
      assert.ok(plan.roads.every(road=>distance(road,plaza.x,plaza.z)>=plaza.r+(ROAD_WIDTH[road.kind]||6)/2),
        `extent ${extent}: plaza intersects driving clearance`);
    }
  }
});

test('neighborhood geometry and creator placement are deterministic and disjoint',()=>{
  const creators=Array.from({length:300},(_,index)=>({id:`neighborhood-${index}`,tier_name:'Bronze',elo_score:3000+index}));
  for(const extent of EXTENTS){
    const first=createUrbanPlan(extent),second=createUrbanPlan(extent);
    assert.deepEqual(first.neighborhoods,second.neighborhoods);
    const roads=first.roads.filter(road=>road.path?.startsWith('neighborhood-'));
    assert.ok(roads.length>0);
    for(const pool of __debug.buildPools(first).values())for(const slot of pool){
      assert.ok(roads.every(road=>distance(road,slot.x,slot.z)>=(ROAD_WIDTH[road.kind]||8)/2+slot.lot/2),
        `extent ${extent}: creator slot overlaps neighborhood road`);
    }
  }
  const placed=buildWorld(creators);
  assert.equal(placed.length,creators.length);
});

test('every published plaza clears neighborhood driving corridors',()=>{
  for(const extent of EXTENTS){
    const plan=createUrbanPlan(extent);
    const roads=plan.roads.filter(road=>road.path?.startsWith('neighborhood-'));
    assert.ok(plan.plazas.length>=3);
    for(const plaza of plan.plazas)for(const road of roads){
      const gap=distance(road,plaza.x,plaza.z);
      assert.ok(gap>=plaza.r+ROAD_WIDTH[road.kind]/2,
        `extent ${extent}: plaza at ${plaza.x},${plaza.z} overlaps ${road.id}`);
    }
  }
});
