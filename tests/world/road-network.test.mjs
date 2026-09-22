import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadNetwork } from '../../shared/roadNetwork.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';

const EPS=1e-6;
const ROAD_HALF=14;

function intersection(a,b){
  const rx=a.x2-a.x1,rz=a.z2-a.z1,sx=b.x2-b.x1,sz=b.z2-b.z1;
  const den=rx*sz-rz*sx;
  if(Math.abs(den)<EPS)return null;
  const qx=b.x1-a.x1,qz=b.z1-a.z1;
  const t=(qx*sz-qz*sx)/den,u=(qx*rz-qz*rx)/den;
  return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{t,u}:null;
}

function touches(a,b){
  if(intersection(a,b))return true;
  const ends=(road)=>[[road.x1,road.z1],[road.x2,road.z2]];
  return ends(a).some(([x,z])=>ends(b).some(([qx,qz])=>Math.hypot(x-qx,z-qz)<=EPS));
}

function groundComponents(roads){
  const ground=roads.filter(road=>!road.elevated&&!road.tunnel);
  const parent=ground.map((_,index)=>index);
  const find=(index)=>parent[index]===index?index:(parent[index]=find(parent[index]));
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const cell=128,buckets=new Map(),pairSet=new Set();
  for(let index=0;index<ground.length;index++){
    const road=ground[index];
    const x0=Math.floor(Math.min(road.x1,road.x2)/cell),x1=Math.floor(Math.max(road.x1,road.x2)/cell);
    const z0=Math.floor(Math.min(road.z1,road.z2)/cell),z1=Math.floor(Math.max(road.z1,road.z2)/cell);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      const key=`${x}:${z}`;(buckets.get(key)??buckets.set(key,[]).get(key)).push(index);
    }
  }
  for(const bucket of buckets.values())for(let a=0;a<bucket.length;a++)for(let b=a+1;b<bucket.length;b++){
    const i=bucket[a],j=bucket[b],key=i<j?`${i}:${j}`:`${j}:${i}`;
    if(pairSet.has(key))continue;pairSet.add(key);
    if(touches(ground[i],ground[j]))join(i,j);
  }
  const components=new Map();
  ground.forEach((road,index)=>(components.get(find(index))??components.set(find(index),[]).get(find(index))).push(road));
  return [...components.values()];
}

test('canonical network keeps grade-separated crossings apart and uses stable link ids',()=>{
  const roads=[
    {id:'surface',x1:-20,z1:0,x2:20,z2:0,kind:'collector',length:40},
    {id:'deck',x1:0,z1:-20,x2:0,z2:20,kind:'highway',length:40,elevated:true,deckY:14},
  ];
  const first=buildRoadNetwork({roads,ramps:[]});
  const second=buildRoadNetwork({roads:roads.map(road=>({...road})),ramps:[]});
  assert.equal(first.components.length,2);
  assert.equal(first.links.some(link=>link.x1===0&&link.z1===0),false,
    'a grade-separated crossing must not create a junction');
  assert.deepEqual(first.links.map(link=>link.id),second.links.map(link=>link.id));
});

test('nearby deck heights do not fabricate a crossing or average source elevations',()=>{
  const network=buildRoadNetwork({roads:[
    {id:'lower',x1:-20,z1:0,x2:20,z2:0,kind:'highway',elevated:true,deckY:14},
    {id:'upper',x1:0,z1:-20,x2:0,z2:20,kind:'highway',elevated:true,deckY:14.7},
  ]});
  assert.equal(network.components.length,2);
  assert.deepEqual([...new Set(network.links.flatMap(link=>[link.y1,link.y2]))].sort((a,b)=>a-b),[14.6,15.299999999999999]);
  assert.equal(network.nodes.some(node=>Math.abs(node.x)<EPS&&Math.abs(node.z)<EPS),false,
    'different-height centerlines must not gain an incidental crossing node');
});

test('an intentionally sunk ramp foot uses an explicit seam without changing either source height',()=>{
  const network=buildRoadNetwork({
    roads:[{id:'ground',x1:-20,z1:0,x2:20,z2:0,kind:'arterial'}],
    ramps:[{points:[[0,3,-.31,15.4],[0,23,14,15.4]]}],
  });
  assert.equal(network.components.length,1);
  assert.ok(network.links.some(link=>link.kind==='ramp'&&
    Math.abs(link.y1-.29)<EPS&&Math.abs(link.y2-.33)<EPS),
  'the handoff link must retain the rendered ramp and road surface heights');
  assert.ok(network.links.filter(link=>link.kind==='arterial')
    .every(link=>Math.abs(link.y1-.33)<EPS&&Math.abs(link.y2-.33)<EPS));
});

test('contained collinear roads connect independent of input order',()=>{
  const outer={id:'outer',x1:-100,z1:0,x2:100,z2:0,kind:'lane'};
  const inner={id:'inner',x1:-20,z1:0,x2:20,z2:0,kind:'lane'};
  assert.equal(buildRoadNetwork({roads:[outer,inner]}).components.length,1);
  assert.equal(buildRoadNetwork({roads:[inner,outer]}).components.length,1);
});

test('all supported extents have lanes and one canonical vehicle network',()=>{
  for(const extent of [1000,1600,2164,3600]){
    const plan=createUrbanPlan(extent);
    assert.ok(plan.roads.some(road=>road.kind==='lane'),`extent ${extent} has no lane`);
    assert.equal(plan.network.disconnected.length,0,
      `extent ${extent}: disconnected ${plan.network.disconnected.map(part=>part.id).join(', ')}`);
    assert.ok(plan.network.nodes.length>0&&plan.network.links.length>=plan.roads.length);
    assert.ok(plan.network.links.every(link=>typeof link.id==='string'&&link.from&&link.to));
  }
});

test('all six arterial termini are direct ring junctions at every supported extent',()=>{
  for(const extent of [1000,1600,2164,3600]){
    const plan=createUrbanPlan(extent),links=new Map(plan.network.links.map(link=>[link.id,link]));
    const groups=Map.groupBy(plan.roads.filter(road=>road.kind==='arterial'),road=>road.path);
    for(const [path,roads] of groups){
      const counts=new Map(),point=new Map();
      for(const road of roads)for(const [x,z] of [[road.x1,road.z1],[road.x2,road.z2]]){
        const key=`${Math.round(x/EPS)}:${Math.round(z/EPS)}`;
        counts.set(key,(counts.get(key)||0)+1);point.set(key,[x,z]);
      }
      const termini=[...counts].filter(([,count])=>count===1).map(([key])=>point.get(key));
      assert.equal(termini.length,2,`extent ${extent}: ${path} termini`);
      for(const [x,z] of termini){
        const node=plan.network.nodes.find(candidate=>Math.hypot(candidate.x-x,candidate.z-z)<EPS&&Math.abs(candidate.y-.33)<EPS);
        assert.ok(node,`extent ${extent}: ${path} has no ground endpoint node at ${x}, ${z}`);
        const paths=new Set(node.links.map(id=>plan.roads[links.get(id).sourceIndex]?.path));
        assert.ok(paths.has(path)&&paths.has('ring'),
          `extent ${extent}: ${path} terminus ${x}, ${z} is not a direct ring junction`);
      }
    }
  }
});

test('generated ground roads retain their source surface height at ramp crossings',()=>{
  const plan=createUrbanPlan(1000);
  for(const link of plan.network.links){
    const road=plan.roads[link.sourceIndex];
    if(road&&!road.elevated&&!road.tunnel){
      assert.equal(link.y1,.33,`${road.id||road.path} y1 was blended at ${link.x1}, ${link.z1}`);
      assert.equal(link.y2,.33,`${road.id||road.path} y2 was blended at ${link.x2}, ${link.z2}`);
    }
  }
});

test('every retained alley is geometrically attached to the surface network',()=>{
  for(const extent of [1000,1600,2164,3600]){
    const components=groundComponents(createUrbanPlan(extent).roads);
    for(const component of components){
      const alleys=component.filter(road=>road.kind==='alley');
      if(!alleys.length)continue;
      assert.ok(component.some(road=>road.kind!=='alley'),
        `extent ${extent}: alley component ${alleys[0].id} has no exact street join`);
    }
  }
});

test('intentional dead ends stay attached and unmarked open alley ends are absent',()=>{
  const allowedReasons=new Set(['designed','constraint','constraint-corridor','courtyard-access']);
  for(const extent of [1000,1600,2164,3600]){
    const plan=createUrbanPlan(extent);
    const alleyNodes=new Map();
    const key=(x,z)=>`${Math.round(x/EPS)}:${Math.round(z/EPS)}`;
    for(const road of plan.roads.filter(road=>road.kind==='alley')){
      for(const [x,z] of [[road.x1,road.z1],[road.x2,road.z2]])alleyNodes.set(key(x,z),(alleyNodes.get(key(x,z))||0)+1);
    }
    const dead=plan.roads.filter(road=>road.kind==='alley'&&road.deadEnd);
    assert.ok(dead.length>0,`extent ${extent}: no intentional dead ends`);
    for(const road of dead)assert.equal(alleyNodes.get(key(road.x2,road.z2)),1,
      `extent ${extent}: ${road.id} dead-end tip is not terminal`);
    const open=plan.network.openEnds.filter(end=>end.kind==='alley');
    assert.equal(open.filter(end=>!end.intentional).length,0,
      `extent ${extent}: unmarked alley ends`);
    const links=new Map(plan.network.links.map(link=>[link.id,link]));
    const nodes=new Map(plan.network.nodes.map(node=>[node.id,node]));
    for(const end of open){
      assert.ok(allowedReasons.has(end.reason),`extent ${extent}: unexplained ${end.reason}`);
      // 막다른 끝에서 후진하면 골목 링크만 따라가더라도 결국 lane 이상 도로에 닿는다.
      const queue=[end.node],seen=new Set(queue);let escaped=false;
      while(queue.length&&!escaped){
        const node=nodes.get(queue.shift());
        for(const id of node.links){
          const link=links.get(id);if(link.kind!=='alley'){escaped=true;break;}
          const next=link.from===node.id?link.to:link.from;
          if(!seen.has(next)){seen.add(next);queue.push(next);}
        }
      }
      assert.ok(escaped,`extent ${extent}: ${end.reason} dead end cannot reverse to a street`);
    }
  }
});

test('bridges expose oriented endpoints derived from their supporting roads',()=>{
  for(const extent of [1000,1600,2164,3600]){
    const plan=createUrbanPlan(extent);
    for(const bridge of plan.bridges){
    for(const field of ['x1','z1','x2','z2'])assert.ok(Number.isFinite(bridge[field]),`${bridge.ko} ${field}`);
    assert.ok(Math.hypot(bridge.x2-bridge.x1,bridge.z2-bridge.z1)>0,`${bridge.ko} has zero-length deck`);
    assert.ok(Math.abs((bridge.x1+bridge.x2)/2-bridge.x)<EPS&&Math.abs((bridge.z1+bridge.z2)/2-bridge.z)<EPS,
      `${bridge.ko} legacy center differs from endpoints`);
    const source=plan.roads[bridge.sourceRoadIndex];
    assert.ok(source,`${bridge.ko} has no supporting road`);
    const dx=source.x2-source.x1,dz=source.z2-source.z1,run=Math.hypot(dx,dz)||1;
    const centerGap=Math.abs(dx*(source.z1-bridge.z)-dz*(source.x1-bridge.x))/run;
    const directionGap=Math.abs(dx*(bridge.z2-bridge.z1)-dz*(bridge.x2-bridge.x1))/run;
    assert.ok(centerGap<.05&&directionGap<.05,`${bridge.ko} is not derived from ${bridge.sourceRoad}`);
    }
  }
});

test('highway route contract exposes only the closed elevated loop',()=>{
  const plan=createUrbanPlan(1600);
  assert.equal(plan.highwayRoutes.length,1);
  const [route]=plan.highwayRoutes;
  assert.equal(route.kind,'highway');
  assert.equal(route.elevated,true);
  assert.equal(route.deckY,plan.highwayDeck);
  assert.ok(route.points.length>8);
  assert.deepEqual(route.points[0],route.points.at(-1));
});

test('closed highway loop publishes exact neighboring-angle end caps',()=>{
  const plan=createUrbanPlan(1600);
  const loop=plan.roads.filter(road=>/^highway-\d+$/.test(road.id));
  assert.ok(loop.length>8);
  const wrap=(angle)=>Math.atan2(Math.sin(angle),Math.cos(angle));
  for(let index=0;index<loop.length;index++){
    const previous=loop[(index-1+loop.length)%loop.length],road=loop[index],next=loop[(index+1)%loop.length];
    const start=ROAD_HALF*Math.tan(Math.abs(wrap(road.angle-previous.angle))/2);
    const end=ROAD_HALF*Math.tan(Math.abs(wrap(next.angle-road.angle))/2);
    assert.ok(Math.abs(road.capStart-start)<1e-9,`${road.id} start cap`);
    assert.ok(Math.abs(road.capEnd-end)<1e-9,`${road.id} end cap`);
  }
  assert.ok(plan.roads.filter(road=>road.id==='radial-ns').every(road=>road.capStart===0&&road.capEnd===0));
});
