import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNS, MAX_EXTENT, MIN_EXTENT, RAMP, ROAD_WIDTH, ROWS, cityExtentForCount, createUrbanPlan, districtBlocks, pointOnRoute } from '../../shared/urbanPlan.js';
import { inNature, inPond } from '../../shared/nature.js';
import { buildWorld, fillerSlots } from '../../shared/worldLayout.js';
import { beachStrips } from '../../shared/coast.js';
import { LOT_SIZES } from '../../shared/lots.js';
import { inRiverPark, inStream, inWaterBody, onIsland, riverCenter, riverClearance } from '../../shared/river.js';
import { LANDMARK_SIZE } from '../../shared/landmarks.js';
import { CIVIC_BUILDINGS } from '../../src/world/models/civicBuildings.js';
import { airportBoxes, onAirportLand } from '../../src/world/models/airportLayout.js';

/** 시드 고정 PRNG 다. tests/world/curves.test.mjs 와 같은 방식이라 결과가 매 실행 같다. */
function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

/** 점과 세그먼트 사이 최단 거리다. roadIndex 전수 검사의 기준(ground truth)이다. */
function pointSegmentDistance(seg,x,z){
  const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,lenSq=dx*dx+dz*dz;
  const t=lenSq>1e-9?Math.max(0,Math.min(1,((x-seg.x1)*dx+(z-seg.z1)*dz)/lenSq)):0;
  return Math.hypot(x-(seg.x1+dx*t),z-(seg.z1+dz*t));
}

test('city plan has rectangular districts and a hierarchical road network',()=>{
  const plan=createUrbanPlan(1600);
  assert.ok(plan.districts.length>=6);
  for(const district of plan.districts){
    assert.equal(district.shape,'rect');
    assert.ok(district.rx>0&&district.rz>0);
    assert.ok(Math.abs(district.rotation)<=.06,`${district.id} 회전이 크다`);
  }
  for(const kind of ['arterial','collector','lane','alley'])assert.ok(plan.roads.some(r=>r.kind===kind),kind);
  assert.ok(plan.roads.every(r=>['arterial','collector','lane','alley','highway'].includes(r.kind)));
  // 고속도로만 고가다. 지면 도로가 elevated 로 새면 포장이 사라진다.
  assert.ok(plan.roads.every(r=>!r.elevated||r.kind==='highway'));
  assert.ok(plan.roads.some(r=>r.kind==='highway'&&r.elevated));
  // 램프는 나들목 6 x 4 에 남북 방사선 양 끝 포탈 2 다. 방사선은 도심과 강을 고가로 지나고
  // 도시 끝에서만 지면으로 내려온다.
  assert.equal(plan.ramps.length,26);assert.equal(plan.ramps.filter(r=>r.kind==='portal').length,2);
  assert.equal(plan.roundabouts.length,2);assert.equal(plan.tunnels.length,0);assert.equal(plan.overpasses.length,0);
  for(const item of [...plan.ramps.map(r=>[r.from.x,r.from.z,r.to.x,r.to.z]),...plan.roundabouts.map(c=>[c.x,c.z,c.r]),
    ...plan.tunnels.map(t=>[t.x1,t.z1,t.x2,t.z2,t.length]),...plan.overpasses.map(o=>[o.x1,o.z1,o.x2,o.z2,o.length])])
    assert.ok(item.every(Number.isFinite));
  assert.ok(plan.roads.some(r=>r.deadEnd));
  // 곧은 격자에 사선은 순환로 모서리 호뿐이다.
  assert.ok(plan.roads.some(r=>r.arc&&Math.abs(r.angle%(Math.PI/2))>.08),'ring corner arcs');
  assert.ok(plan.parks.length>=4&&plan.plazas.length>=3&&plan.waterfront.length>=2);
  assert.ok(plan.landmarks.length>=6);
  assert.ok(plan.bridges.length>=1&&plan.bridges.every(b=>Number.isFinite(b.x)));
});

test('districts tile the city square without touching each other',()=>{
  const plan=createUrbanPlan(1600);
  for(let i=0;i<plan.districts.length;i++)for(let j=i+1;j<plan.districts.length;j++){
    const a=plan.districts[i],b=plan.districts[j];
    assert.ok(Math.abs(a.x-b.x)>=a.rx+b.rx||Math.abs(a.z-b.z)>=a.rz+b.rz,`${a.id}/${b.id}`);
  }
  const covered=plan.districts.reduce((sum,d)=>sum+4*d.rx*d.rz,0);
  assert.ok(covered/(4*plan.extent**2)>.7,`지구가 도시의 ${(covered/(4*plan.extent**2)*100).toFixed(0)}% 만 덮는다`);
});

test('every district gets its own block grid with a different shape',()=>{
  const plan=createUrbanPlan(1600);
  const shapes=plan.districts.map(d=>{
    const grid=districtBlocks(d);
    assert.ok(grid.blocks.length>0&&grid.bands.length>0);
    assert.ok(grid.blocks.some(block=>block.empty),`${d.id} 에 빈 블록이 없다`);
    return `${grid.bands.length}x${grid.bayCount}x${grid.blocks.length}`;
  });
  assert.ok(new Set(shapes).size>=4,`격자 모양이 ${new Set(shapes).size} 가지뿐이다`);
  const lots=new Set(plan.districts.flatMap(d=>districtBlocks(d).blocks.map(b=>b.lot)));
  assert.deepEqual([...lots].sort((a,b)=>a-b),[...LOT_SIZES].sort((a,b)=>a-b));
});

test('traffic routes are continuous, deterministic and sample finite poses',()=>{
  const a=createUrbanPlan(1600),b=createUrbanPlan(1600);
  assert.deepEqual(a,b);
  assert.ok(a.routes.length>=8);
  for(const route of a.routes){
    assert.ok(route.points.length>=2);
    for(const t of [0,.1,.5,.99,1.7]){
      const pose=pointOnRoute(route,t);
      assert.ok([pose.x,pose.z,pose.angle].every(Number.isFinite));
    }
  }
});

test('pointOnRoute 가 꼭짓점에서 방위를 이웃 현과 보간해 튀지 않는다',()=>{
  // 직각으로 꺾이는 합성 경로다. 현 하나짜리 각도를 그대로 쓰면 꼭짓점에서 PI/2 만큼 튄다.
  const route={points:[[0,0],[100,0],[100,100]]};
  const chordDiff=Math.PI/2;
  const before=pointOnRoute(route,.49).angle,after=pointOnRoute(route,.51).angle;
  const jump=Math.abs(before-after);
  assert.ok(jump<chordDiff,`꼭짓점 앞뒤 각도차 ${jump.toFixed(4)} 가 현 각도차 ${chordDiff.toFixed(4)} 이상이다`);
});

test('occupied radius adapts to creator count inside the clamped range',()=>{
  assert.ok(cityExtentForCount(0)===MIN_EXTENT);
  assert.ok(cityExtentForCount(572)<cityExtentForCount(1000));
  // 씨앗값은 성장 루프가 멎는 실제 extent 바로 아래여야 한다. 넘으면 도시가 필요보다 커진다.
  assert.ok(cityExtentForCount(1000)<2300,`1000명 extent ${cityExtentForCount(1000)}`);
  assert.equal(createUrbanPlan(200).extent,MIN_EXTENT);
  assert.equal(createUrbanPlan(99999).extent,MAX_EXTENT);
});

test('plan.nodes 가 7개이고 plan.hills 가 3개다',()=>{
  const plan=createUrbanPlan(1600);
  assert.equal(plan.nodes.length,7);
  assert.equal(plan.hills.length,3);
  const central=plan.nodes.find(n=>n.id==='central');
  assert.ok(central&&central.primary);
});

test('plan.subway.lines 가 3개이고 모든 역이 도시 경계 안이다',()=>{
  const plan=createUrbanPlan(1600);
  assert.equal(plan.subway.lines.length,3);
  for(const line of plan.subway.lines)for(const station of line.stations)
    assert.ok(Math.abs(station.x)<=plan.extent&&Math.abs(station.z)<=plan.extent,`${line.id} 의 역이 경계 밖이다`);
});

test('plan.interchanges 가 8개이고 IC 6, JC 2 다',()=>{
  const plan=createUrbanPlan(1600);
  assert.equal(plan.interchanges.length,8);
  assert.equal(plan.interchanges.filter(n=>n.kind==='IC').length,6);
  assert.equal(plan.interchanges.filter(n=>n.kind==='JC').length,2);
});

test('간선은 지구 사이 여백 세 줄뿐이고 어떤 블록도 지나지 않는다',()=>{
  for(const extent of [1400,1766,2164]){
    const plan=createUrbanPlan(extent),e=plan.extent;
    const ids=new Set(plan.roads.filter(r=>r.kind==='arterial').map(r=>r.path));
    assert.deepEqual([...ids].sort(),['art-ew-0','art-ns-0','art-ns-1']);
    for(const road of plan.roads.filter(r=>r.kind==='arterial')){
      const onColumn=[COLUMNS[1],COLUMNS[2]].some(c=>Math.abs(road.x1-c*e)<1e-6&&Math.abs(road.x2-c*e)<1e-6);
      const onRow=Math.abs(road.z1-ROWS[1]*e)<1e-6&&Math.abs(road.z2-ROWS[1]*e)<1e-6;
      assert.ok(onColumn||onRow,`extent ${extent}: ${road.id} 가 여백 밖이다`);
    }
    // 간선 중심선이 블록 사각형 안을 지나면 그 블록의 필지가 잘려 나간다.
    for(const district of plan.districts)for(const block of districtBlocks(district).blocks){
      const half=block.pitch/2;
      for(const road of plan.roads.filter(r=>r.kind==='arterial')){
        const insideX=Math.min(road.x1,road.x2)<block.x+half&&Math.max(road.x1,road.x2)>block.x-half;
        const insideZ=Math.min(road.z1,road.z2)<block.z+half&&Math.max(road.z1,road.z2)>block.z-half;
        assert.ok(!(insideX&&insideZ),`extent ${extent}: ${road.id} 가 ${district.id} 블록을 지난다`);
      }
    }
  }
});

test('지상 도로끼리 폭 안에서 나란히 겹치는 구간이 없다',()=>{
  const parallel=(a,b)=>{const d=Math.abs(((a.angle-b.angle)%Math.PI+Math.PI)%Math.PI);return d<.05||Math.abs(d-Math.PI)<.05;};
  for(const extent of [1400,1766,2164]){
    const plan=createUrbanPlan(extent);
    const big=plan.roads.filter(r=>!r.elevated&&!r.tunnel&&r.kind!=='alley');
    for(let i=0;i<big.length;i++)for(let j=i+1;j<big.length;j++){
      const r=big[i],s=big[j];
      if((r.path||r.id)===(s.path||s.id)||!parallel(r,s))continue;
      const gap=Math.min(Math.max(pointSegmentDistance(r,s.x1,s.z1),pointSegmentDistance(r,s.x2,s.z2)),
        Math.max(pointSegmentDistance(s,r.x1,r.z1),pointSegmentDistance(s,r.x2,r.z2)));
      if(gap>=(ROAD_WIDTH[r.kind]+ROAD_WIDTH[s.kind])/2)continue;
      const ux=Math.cos(r.angle),uz=Math.sin(r.angle);
      const pr=[r.x1*ux+r.z1*uz,r.x2*ux+r.z2*uz].sort((a,b)=>a-b),ps=[s.x1*ux+s.z1*uz,s.x2*ux+s.z2*uz].sort((a,b)=>a-b);
      const shared=Math.min(pr[1],ps[1])-Math.max(pr[0],ps[0]);
      assert.ok(shared<20,`extent ${extent}: ${r.id} 와 ${s.id} 가 ${shared.toFixed(0)} 만큼 겹친다`);
    }
  }
});

test('나들목은 간선과 순환 고속도로가 실제로 만나는 자리이고 램프가 상판 옆에 닿는다',()=>{
  for(const extent of [1400,1766,2164]){
    const plan=createUrbanPlan(extent);
    const elevated=plan.roads.filter(r=>r.elevated),arterials=plan.roads.filter(r=>r.kind==='arterial');
    assert.equal(plan.interchanges.length,8);
    for(const node of plan.interchanges){
      const onHighway=Math.min(...elevated.map(r=>pointSegmentDistance(r,node.x,node.z)));
      assert.ok(onHighway<1,`extent ${extent}: ${node.ko} 이 고속도로에서 ${onHighway.toFixed(1)} 떨어졌다`);
      if(node.kind==='JC'){assert.equal(node.ramps.length,0);continue;}
      const onArterial=Math.min(...arterials.map(r=>pointSegmentDistance(r,node.x,node.z)));
      assert.ok(onArterial<1,`extent ${extent}: ${node.ko} 이 간선에서 ${onArterial.toFixed(1)} 떨어졌다`);
      assert.equal(node.ramps.length,4);
      for(const ramp of node.ramps){
        // 꼭대기는 상판 가장자리에 닿는다(중심선에서 상판 반폭 + 램프 반폭).
        const top=Math.min(...elevated.map(r=>pointSegmentDistance(r,ramp.to.x,ramp.to.z)));
        assert.ok(Math.abs(top-RAMP.beside)<1,`extent ${extent}: 램프 꼭대기가 상판에서 ${top.toFixed(1)}`);
        // 밑동은 간선 노면 안이다. 중심선에서 램프가 옆으로 비킨 만큼만 떨어진다.
        const foot=Math.min(...arterials.map(r=>pointSegmentDistance(r,ramp.from.x,ramp.from.z)));
        assert.ok(Math.abs(foot-RAMP.lateral)<1,`extent ${extent}: 램프 밑동이 간선에서 ${foot.toFixed(1)}`);
        assert.equal(ramp.to.y,plan.highwayDeck);assert.ok(Math.abs(ramp.from.y+.27+RAMP.sink)<1e-9);
        // 가감속 테이퍼 끝은 상판 가장자리 안쪽으로 스며든다.
        const merge=Math.min(...elevated.map(r=>pointSegmentDistance(r,ramp.merge.x,ramp.merge.z)));
        assert.ok(merge-RAMP.tipWidth/2<=ROAD_WIDTH.highway/2+.05,`extent ${extent}: 램프 합류점이 본선에서 ${merge.toFixed(1)}`);
        assert.ok(ramp.reach<=RAMP.reach&&ramp.spread<=RAMP.maxSpread);
      }
    }
    // 포탈은 방사선 양 끝 둘뿐이고 상판에서 지면까지 이어진다.
    const portals=plan.ramps.filter(r=>r.kind==='portal');
    assert.equal(portals.length,2);
    for(const portal of portals){
      assert.equal(portal.from.y,plan.highwayDeck);
      assert.ok(Math.abs(portal.to.y+.27)<1e-9);
      const deck=Math.min(...elevated.map(r=>pointSegmentDistance(r,portal.from.x,portal.from.z)));
      assert.ok(deck<.05,`extent ${extent}: 포탈 시작이 상판에서 ${deck.toFixed(2)}`);
    }
  }
});

test('모든 램프가 끊기지 않고 경사와 꺾임 한계를 지킨다',()=>{
  for(const extent of [1400,1766,2164,3600]){
    const plan=createUrbanPlan(extent);
    const ground=plan.roads.filter(r=>!r.elevated&&!r.tunnel&&r.kind!=='alley');
    const elevated=plan.roads.filter(r=>r.elevated);
    const halfOf=(road)=>(ROAD_WIDTH[road.kind]||8)/2;
    for(const [index,ramp] of plan.ramps.entries()){
      const line=ramp.points;
      assert.ok(Array.isArray(line)&&line.length>=3,`램프 ${index} 에 폴리라인이 없다`);
      // 점마다 [x, z, y, width, transverse?] 의 필수값이 유한하고 폭은 양수다.
      for(const point of line){
        assert.ok(point.length===4||point.length===5);
        assert.ok(point.slice(0,4).every(Number.isFinite)&&point[3]>0);
        if(point.length===5){
          assert.ok(Array.isArray(point[4])&&point[4].length===2&&point[4].every(Number.isFinite));
          assert.ok(Math.abs(Math.hypot(...point[4])-1)<1e-9);
        }
      }
      let grade=0,kink=0;
      for(let i=1;i<line.length;i++){
        const run=Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);
        assert.ok(run>1e-6,`램프 ${index} 에 길이 0 인 조각이 있다`);
        grade=Math.max(grade,Math.abs(line[i][2]-line[i-1][2])/run);
        if(i<line.length-1){
          const a=Math.atan2(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);
          const b=Math.atan2(line[i+1][0]-line[i][0],line[i+1][1]-line[i][1]);
          let diff=(b-a)%(Math.PI*2);
          if(diff>Math.PI)diff-=Math.PI*2;
          if(diff<-Math.PI)diff+=Math.PI*2;
          kink=Math.max(kink,Math.abs(diff));
        }
      }
      assert.ok(grade<=RAMP.maxGrade+1e-6,`extent ${extent} 램프 ${index} 경사 ${(grade*100).toFixed(2)}%`);
      assert.ok(kink<=.28,`extent ${extent} 램프 ${index} 꺾임 ${(kink*180/Math.PI).toFixed(1)}도`);
      if(ramp.kind==='portal'){
        // 포탈은 상판 끝에서 시작해 지면 도로 높이로 끝난다.
        const deck=Math.min(...elevated.map(r=>pointSegmentDistance(r,line[0][0],line[0][1])));
        assert.ok(deck<.05,`포탈 시작이 상판에서 ${deck.toFixed(2)}`);
        assert.ok(Math.abs(line[line.length-1][2]+.27)<1e-9);
        continue;
      }
      // IC 램프: 밑동이 지상 도로 노면 안에 있고 첫 조각 접선이 그 도로와 거의 나란하다.
      const first=line[0],last=line[line.length-1];
      let footGap=Infinity,footAngle=0;
      for(const road of ground){
        const gap=pointSegmentDistance(road,first[0],first[1])-halfOf(road);
        if(gap<footGap){footGap=gap;footAngle=Math.atan2(road.x2-road.x1,road.z2-road.z1);}
      }
      assert.ok(footGap<=.05,`extent ${extent} 램프 ${index} 밑동이 도로에서 ${footGap.toFixed(2)} 떴다`);
      const start=Math.atan2(line[1][0]-first[0],line[1][1]-first[1]);
      let off=Math.abs((start-footAngle)%(Math.PI*2));
      if(off>Math.PI)off=Math.PI*2-off;
      assert.ok(Math.min(off,Math.PI-off)<=.12,`extent ${extent} 램프 ${index} 밑동 접선이 ${(Math.min(off,Math.PI-off)*180/Math.PI).toFixed(1)}도 어긋났다`);
      // 꼭대기와 테이퍼 끝은 상판 가장자리에 맞닿는다. 램프 반폭까지 빼도 틈이 없다.
      for(const point of [line[line.length-1-RAMP.mergeSteps],last]){
        let edge=Infinity;
        for(const road of elevated)edge=Math.min(edge,pointSegmentDistance(road,point[0],point[1])-halfOf(road)-point[3]/2);
        assert.ok(edge<=.05,`extent ${extent} 램프 ${index} 가 상판에서 ${edge.toFixed(2)} 떴다`);
      }
    }
  }
});

test('램프 폴리라인은 오르막만 있고 한 조각의 높이 차가 작다',()=>{
  const plan=createUrbanPlan(1766);
  for(const ramp of plan.ramps){
    const line=ramp.points,up=ramp.kind!=='portal';
    let step=0;
    for(let i=1;i<line.length;i++){
      const dy=(up?1:-1)*(line[i][2]-line[i-1][2]);
      assert.ok(dy>=-1e-9,`램프가 도중에 ${up?'내려간다':'올라간다'}`);
      step=Math.max(step,Math.abs(dy));
    }
    // 한 조각이 벌어지는 높이는 조각 길이 * 최대 경사를 넘지 않는다.
    const longest=Math.max(...line.slice(1).map((p,i)=>Math.hypot(p[0]-line[i][0],p[1]-line[i][1])));
    assert.ok(step<=longest*RAMP.maxGrade+1e-6,`한 조각 높이 차 ${step.toFixed(3)}`);
  }
});

test('IC 합류와 JC 교차 자리에는 고가 본선 난간 개구부가 있다',()=>{
  const plan=createUrbanPlan(1766),elevated=plan.roads.filter(r=>r.elevated);
  const openings=elevated.flatMap(r=>(r.railOpenings||[]).map(opening=>({road:r,opening})));
  assert.ok(openings.length>=plan.interchanges.length*2);
  for(const {opening} of openings){
    assert.ok(opening.from>=0&&opening.to<=1&&opening.from<opening.to);
    assert.ok(opening.side===-1||opening.side===1);
  }
});

test('남북 방사선은 가짜 도심 터널 없이 연속된 고가도로다',()=>{
  const plan=createUrbanPlan(1766);
  assert.equal(plan.tunnels.length,0);
  const radial=plan.roads.filter(r=>r.id?.startsWith('radial-ns'));
  assert.ok(radial.length>=1&&radial.every(r=>r.kind==='highway'&&r.elevated));
  assert.ok(radial.every(r=>r.deckY===plan.highwayDeck),'방사선과 순환로 높이가 달라 JC가 끊겼다');
  const ordered=radial.slice().sort((a,b)=>Math.min(a.z1,a.z2)-Math.min(b.z1,b.z2));
  for(let i=1;i<ordered.length;i++) assert.ok(Math.abs(Math.max(ordered[i-1].z1,ordered[i-1].z2)-Math.min(ordered[i].z1,ordered[i].z2))<1);
});

test('모든 지상 경로가 routes 에 있고 교차점이 중간점으로 들어간다',()=>{
  const plan=createUrbanPlan(1766);
  const ids=new Set(plan.roads.filter(r=>r.path&&!r.elevated&&!r.tunnel&&r.kind!=='alley').map(r=>r.path));
  for(const id of ids)assert.ok(plan.routes.some(route=>route.id===id),`${id} 가 routes 에 없다`);
  const ns=plan.routes.find(route=>route.id==='art-ns-0');
  const ring=plan.routes.find(route=>route.id==='ring');
  // 남북 간선은 동서 간선, 순환 고속도로(교차 아님), 강변 집산로 둘과 만난다. 동서 간선과의 교차점이 있어야 한다.
  assert.ok(ns.points.some(([x,z])=>Math.abs(x-COLUMNS[1]*1766)<1&&Math.abs(z-ROWS[1]*1766)<1));
  assert.ok(ring.points.length>=20);
});

test('공항로가 동쪽 순환로에 붙고 공항 땅까지 간다',()=>{
  const plan=createUrbanPlan(1766),e=plan.extent;
  const road=plan.roads.filter(r=>r.path==='airport-road-east');
  assert.ok(road.length>=1);
  const ring=plan.roads.filter(r=>r.path==='ring');
  assert.ok(Math.min(...ring.map(r=>pointSegmentDistance(r,road[0].x1,road[0].z1)))<1,'공항로가 순환로에 안 붙는다');
  // 끝점은 터미널 앞이다. 예전에는 터미널 밑을 지나 건물을 관통했다.
  const far=Math.max(road[0].x2,road[0].x1);
  assert.ok(onAirportLand(e,far,30),'공항로 끝이 공항 땅이 아니다');
  assert.ok(far>e,'공항로가 도시 밖으로 나가지 않는다');
  assert.equal(plan.airportRoads.length,1);
});

test('자연지대와 연못 안에는 제작자 건물도 배경 건물도 서지 않는다',()=>{
  const rows=Array.from({length:574},(_,i)=>({id:`c-${i}`,tier_name:['Bronze','Silver','Gold','Platinum','Diamond','Master','Champion'][i%7],elo_score:1000+i*13}));
  const city=buildWorld(rows),plan=createUrbanPlan(city[0].cityExtent);
  assert.equal(plan.nature.length,4);assert.ok(plan.ponds.length>=7);
  for(const b of city){
    assert.equal(inNature(plan.extent,b.x,b.z),false,`${b.id} 가 자연지대다`);
    assert.equal(inPond(plan,b.x,b.z),false,`${b.id} 가 연못 위다`);
  }
  for(const slot of fillerSlots(city)){
    assert.equal(inNature(plan.extent,slot.x,slot.z),false,'배경 건물이 자연지대다');
    assert.equal(inPond(plan,slot.x,slot.z),false,'배경 건물이 연못 위다');
  }
  // 자연지대 안을 지나는 지상 도로는 순환로 호와 골목 없는 빈 땅뿐이다.
  for(const road of plan.roads){
    if(road.path==='ring'||road.elevated)continue;
    const mx=(road.x1+road.x2)/2,mz=(road.z1+road.z2)/2;
    assert.equal(inNature(plan.extent,mx,mz),false,`${road.id} 가 자연지대를 지난다`);
  }
});

test('곡선 간선의 이웃 현 사이 방향 변화가 모두 0.5 라디안 미만이다',()=>{
  const plan=createUrbanPlan(1600);
  const wrap=(d)=>{let x=d%(Math.PI*2);if(x>Math.PI)x-=Math.PI*2;if(x<-Math.PI)x+=Math.PI*2;return x;};
  const curvedIds=[...new Set(plan.roads.filter(r=>r.path&&(r.path==='ring'||r.path.startsWith('river-'))).map(r=>r.path))];
  for(const id of curvedIds){
    const segs=plan.roads.filter(r=>r.path===id);
    for(let i=1;i<segs.length;i++)
      assert.ok(Math.abs(wrap(segs[i].angle-segs[i-1].angle))<0.5,`${id} 의 세그먼트 ${i} 에서 방향이 튄다`);
  }
});

test('plan.roadIndex.near(x, z, r) 가 전수 검사 결과를 모두 포함한다',()=>{
  const plan=createUrbanPlan(1600);
  const rand=mulberry32(20260913),radius=30;
  const guarded=plan.roads.filter(r=>r.kind!=='alley');
  for(let i=0;i<100;i++){
    const x=(rand()*2-1)*plan.extent,z=(rand()*2-1)*plan.extent;
    const brute=guarded.filter(seg=>pointSegmentDistance(seg,x,z)<=radius);
    const near=new Set(plan.roadIndex.near(x,z,radius));
    for(const seg of brute)assert.ok(near.has(seg),`(${x.toFixed(1)},${z.toFixed(1)}) 에서 세그먼트를 놓쳤다`);
  }
});

test('고속도로는 모두 고가이고 path 가 없다',()=>{
  const plan=createUrbanPlan(1600);
  const highways=plan.roads.filter(r=>r.kind==='highway');
  assert.ok(highways.length>0);
  assert.ok(highways.every(r=>r.elevated===true));
  assert.ok(highways.every(r=>!r.tunnel));
  assert.ok(highways.every(r=>!r.path));
});

test('해변 띠는 지상 도로의 포장 영역을 침범하지 않는다',()=>{
  // 해변이 도로 위까지 넓어지면 항공 시점에서 긴 모래 상판이 도로를 덮어 보인다.
  for(const extent of [1000,1600,2311,3600]){
    const plan=createUrbanPlan(extent);
    for(const strip of beachStrips(extent))for(const road of plan.roads){
      // 공항로는 둑 위로 해변을 건넌다.
      if(road.elevated||String(road.path||'').startsWith('airport-road'))continue;
      const half=(ROAD_WIDTH[road.kind]||8)/2;
      for(let step=0;step<=32;step++){
        const t=step/32,x=road.x1+(road.x2-road.x1)*t,z=road.z1+(road.z2-road.z1)*t;
        const along=strip.angle===0?x-strip.x:z-strip.z;
        const across=strip.angle===0?z-strip.z:x-strip.x;
        assert.ok(Math.abs(along)>strip.length/2+half||Math.abs(across)>strip.width/2+half,
          `extent ${extent}: ${road.id} 가 ${strip.edge} 해변을 지난다`);
      }
    }
  }
});

test('교량은 도로가 강을 건너는 자리에 서고 건너는 도로를 하나도 빠뜨리지 않는다',()=>{
  // 예전에는 고정 비율 다섯 곳에 박혀 있어 도로가 다리 없는 물 위를 지났다.
  // 그 위를 달리는 차는 물에 빠진다.
  for(const extent of [1400,1600,2311,3600]){
    const plan=createUrbanPlan(extent);
    assert.ok(plan.bridges.length>0,`extent ${extent} 에 교량이 없다`);
    assert.equal(plan.bridges.filter(bridge=>bridge.big).length,2,`extent ${extent} 사장교 수`);
    for(const bridge of plan.bridges.filter(b=>b.axis!=='x')){
      // 중심선이 굽어 있으므로 그 x 에서의 중심선과 맞아야 한다.
      assert.ok(Math.abs(bridge.z-riverCenter(plan.extent,bridge.x))<1e-6,'교량이 강 중심선을 벗어났다');
      assert.ok(bridge.width>=26,`교량 폭 ${bridge.width}`);
    }
    // 도로를 잘라 중심선 부호가 바뀌는 자리를 찾는다. 그 자리마다 다리가 있어야 한다.
    for(const road of plan.roads){
      if(road.elevated||road.tunnel||road.kind==='alley')continue;
      const STEPS=24;
      let previous=road.z1-riverCenter(plan.extent,road.x1),x=null;
      for(let step=1;step<=STEPS;step++){
        const t=step/STEPS;
        const sx=road.x1+(road.x2-road.x1)*t,sz=road.z1+(road.z2-road.z1)*t;
        const current=sz-riverCenter(plan.extent,sx);
        if(previous===0||previous*current<0){x=sx;break;}
        previous=current;
      }
      if(x===null||!Number.isFinite(x)||Math.abs(x)>plan.extent)continue;
      assert.ok(plan.bridges.some(bridge=>Math.abs(x-bridge.x)<bridge.width/2+30),
        `extent ${extent} 의 ${road.kind} 가 x ${x.toFixed(0)} 에서 다리 없이 강을 건넌다`);
    }
  }
});

test('강은 한 벌이다. 미니맵 선과 물 판정이 같은 곡선을 쓴다',()=>{
  // 미니맵이 다른 곡선을 쓰면 지도에서는 다리 위인데 실제로는 물에 빠진다.
  const plan=createUrbanPlan(2311);
  for(const [x,z] of plan.riverLine)assert.ok(Math.abs(z-riverCenter(plan.extent,x))<1e-9);
  // 중심선 위는 반드시 물이고 강변 여유 밖은 반드시 뭍이다.
  for(let x=-plan.extent;x<=plan.extent;x+=137){
    const center=riverCenter(plan.extent,x);
    assert.equal(inWaterBody(plan.extent,x,center),!onIsland(plan.extent,x,center));
    for(const side of [-1,1]){
      const dry=center+side*(riverClearance(plan.extent,x,side)+5);
      // 지천이 지나는 자리는 강변 밖이라도 물이다. 그 x 는 건너뛴다.
      if(inStream(plan.extent,x,dry))continue;
      assert.equal(inWaterBody(plan.extent,x,dry),false,`x ${x} 쪽 강변 밖이 물이다`);
    }
  }
});

test('createUrbanPlan(1500) 을 두 번 부르면 같은 객체가 나온다',()=>{
  assert.equal(createUrbanPlan(1500),createUrbanPlan(1500));
});

test('기존 필드가 전부 살아 있다',()=>{
  const plan=createUrbanPlan(1600);
  for(const key of ['districts','landmarks','parks','plazas','routes','ramps','roundabouts','tunnels','overpasses','riverZ','highwayDeck'])
    assert.ok(key in plan,`${key} 가 사라졌다`);
});

/** 선분과 축 정렬 사각형 사이의 거리다. 표본으로 재므로 짧은 도로 조각에도 충분하다. */
const segmentToRect=(road,cx,cz,hx,hz)=>{
  let best=Infinity;
  for(let i=0;i<=64;i++){
    const t=i/64,x=road.x1+(road.x2-road.x1)*t,z=road.z1+(road.z2-road.z1)*t;
    best=Math.min(best,Math.hypot(Math.max(0,Math.abs(x-cx)-hx),Math.max(0,Math.abs(z-cz)-hz)));
  }
  return best;
};

test('랜드마크 평면 위로는 골목, 고가를 포함해 어떤 도로도 지나지 않고 시청은 강 북쪽에 선다',()=>{
  // 예전에는 시청 평면(300x260)이 블록 두세 개를 덮어 이웃 블록의 골목이 건물 밑을 지났고,
  // 여유 검사가 고가를 빼고 긴 변 절반의 원으로 재서 모서리와 고가 교각이 파고들었다.
  for(const extent of [1000,1400,1957,2164,2400,3000,3233]){
    const plan=createUrbanPlan(extent);
    const cityhall=plan.landmarks.find(mark=>mark.key==='cityhall');
    assert.ok(cityhall,'시청이 없다');
    if(extent>=1400)assert.ok(cityhall.z<riverCenter(extent,cityhall.x),`extent ${extent} 시청이 강 남쪽에 섰다`);
    for(const mark of plan.landmarks){
      assert.equal(inWaterBody(extent,mark.x,mark.z),false,`${mark.key} 가 물 위다`);
      assert.equal(inRiverPark(extent,mark.x,mark.z),false,`${mark.key} 가 강변 공원이다`);
      const [width,depth]=LANDMARK_SIZE[mark.key];
      for(const road of plan.roads){
        const gap=segmentToRect(road,mark.x,mark.z,width/2,depth/2)-ROAD_WIDTH[road.kind]/2;
        assert.ok(gap>=-0.5,`extent ${extent} 의 ${mark.key} 를 ${road.kind}${road.elevated?'(고가)':''} 가 지난다 (${gap.toFixed(1)})`);
      }
    }
  }
});

test('낮은 램프의 주행 폭 안에는 랜드마크가 서지 않는다',()=>{
  // extent 1594 의 civic 공공건물이 ramp 4 저고도 구간을 막았던 회귀다. 도로만
  // 예약하고 같은 폴리라인에서 파생한 램프를 랜드마크 후보 검사에서 빠뜨리면 재현된다.
  const plan=createUrbanPlan(1594);
  for(const ramp of plan.ramps)for(let index=1;index<ramp.points.length;index++){
    const a=ramp.points[index-1],b=ramp.points[index];
    if(Math.min(a[2],b[2])>12)continue;
    const road={x1:a[0],z1:a[1],x2:b[0],z2:b[1]};
    const half=Math.max(a[3],b[3])/2;
    for(const mark of plan.landmarks){
      const [width,depth]=LANDMARK_SIZE[mark.key];
      const gap=segmentToRect(road,mark.x,mark.z,width/2,depth/2)-half;
      assert.ok(gap>=0,`${mark.key} 가 ramp ${plan.ramps.indexOf(ramp)} 저고도 구간을 막는다 (${gap.toFixed(1)})`);
    }
  }
});

test('지천과 나란한 지선은 차도 가장자리까지 물에서 벗어난다',()=>{
  // extent 1594 harbor-lane-3 의 중심은 뭍이지만 동쪽 차로 3.8 만큼이 안양천에 잠겼다.
  const plan=createUrbanPlan(1594),road=plan.roads.find(item=>item.id==='harbor-lane-3');
  assert.ok(road,'회귀 지선이 없다');
  const dx=road.x2-road.x1,dz=road.z2-road.z1,run=Math.hypot(dx,dz),nx=-dz/run,nz=dx/run;
  for(let along=0;along<=1;along+=.01)for(const side of [-1,1]){
    const x=road.x1+dx*along+nx*side*(ROAD_WIDTH.lane/2-.1);
    const z=road.z1+dz*along+nz*side*(ROAD_WIDTH.lane/2-.1);
    assert.equal(inWaterBody(plan.extent,x,z),false,`lane edge submerged at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
});

test('지천이 강변도로 꼭짓점을 지나도 짧은 교량이 생긴다',()=>{
  // 1750/3600 에서는 river-south 표본 꼭짓점 x 가 tan 지천 x 와 정확히 같다.
  for(const extent of [1750,3600]){
    const plan=createUrbanPlan(extent),stream=plan.streams.find(item=>item.id==='tan');
    const crossing=plan.roads.find(road=>road.path==='river-south'
      &&([[road.x1,road.z1],[road.x2,road.z2]].some(([x,z])=>Math.abs(x-stream.x)<1e-6
        &&z>=Math.min(stream.z1,stream.z2)&&z<=Math.max(stream.z1,stream.z2))));
    assert.ok(crossing,`extent ${extent}: 꼭짓점 교차 도로가 없다`);
    const vertex=[[crossing.x1,crossing.z1],[crossing.x2,crossing.z2]].find(([x])=>Math.abs(x-stream.x)<1e-6);
    assert.ok(plan.bridges.some(bridge=>bridge.axis==='x'&&Math.hypot(bridge.x-vertex[0],bridge.z-vertex[1])<1),
      `extent ${extent}: 꼭짓점 지천교가 없다`);
  }
});

test('작은 도시 외곽 순환로는 공항 시설 평면을 침범하지 않는다',()=>{
  const extent=1000,plan=createUrbanPlan(extent),boxes=airportBoxes(extent);
  for(const road of plan.roads.filter(item=>item.path==='ring'))for(const box of boxes){
    const gap=segmentToRect(road,box.x,box.z,box.width/2+3,box.depth/2+3)-ROAD_WIDTH.collector/2;
    assert.ok(gap>=0,`ring 이 공항 시설 ${box.x.toFixed(0)}, ${box.z.toFixed(0)} 을 침범한다 (${gap.toFixed(1)})`);
  }
});

test('배치가 읽는 랜드마크 크기표가 렌더러 모델과 같다',()=>{
  // 두 표가 어긋나면 건물은 큰데 자리는 작게 잡혀 도로와 이웃 건물이 파고든다.
  for(const [key,size] of Object.entries(LANDMARK_SIZE)){
    assert.deepEqual(size,CIVIC_BUILDINGS[key].size,`${key} 크기가 다르다`);
  }
  for(const key of Object.keys(CIVIC_BUILDINGS)){
    assert.ok(LANDMARK_SIZE[key],`${key} 가 shared/landmarks.js 에 없다`);
  }
});

test('산은 강과 지상 도로에서 떨어져 있다',()=>{
  // 예전에는 산이 강 위와 간선 위에 걸쳐 있어서 덩어리가 강을 막고 도로를 삼켰다.
  const pointToSegment=(px,pz,road)=>{
    const dx=road.x2-road.x1,dz=road.z2-road.z1,len=dx*dx+dz*dz;
    const t=len?Math.max(0,Math.min(1,((px-road.x1)*dx+(pz-road.z1)*dz)/len)):0;
    return Math.hypot(px-(road.x1+dx*t),pz-(road.z1+dz*t));
  };
  for(const extent of [1400,1957,2400,3000,3233]){
    const plan=createUrbanPlan(extent);
    assert.equal(plan.hills.length,3);
    for(const hill of plan.hills){
      assert.equal(inWaterBody(extent,hill.x,hill.z),false,'산이 물 위다');
      // 산 가장자리가 강변 여유(강, 둔치, 강변도로) 안으로 들어오면 안 된다.
      assert.ok(Math.abs(hill.z-riverCenter(extent,hill.x))
        >=riverClearance(extent,hill.x,hill.z<riverCenter(extent,hill.x)?-1:1)+hill.r,
        `extent ${extent} 의 산이 강에 닿는다`);
      // 산 덩이는 반지름 r 까지 그려진다. 골목과 고가도 그 안에 들어오면 덩이에 묻힌다.
      for(const road of plan.roads){
        assert.ok(pointToSegment(hill.x,hill.z,road)-ROAD_WIDTH[road.kind]/2>=hill.r,
          `extent ${extent} 의 산이 ${road.kind} 를 삼킨다`);
      }
    }
  }
});

test('산에 끊긴 지선은 조각마다 다른 경로라 차량이 산을 건너뛰지 않는다',()=>{
  // 한 경로 안에서 이웃한 두 점이 산을 가로지르면 차가 덩이를 뚫고 지난다.
  for(const extent of [1400,2164,3000]){
    const plan=createUrbanPlan(extent);
    for(const route of plan.routes)for(let i=1;i<route.points.length;i++){
      const [x1,z1]=route.points[i-1],[x2,z2]=route.points[i];
      for(const hill of plan.hills){
        const dx=x2-x1,dz=z2-z1,len=dx*dx+dz*dz;
        const t=len?Math.max(0,Math.min(1,((hill.x-x1)*dx+(hill.z-z1)*dz)/len)):0;
        assert.ok(Math.hypot(hill.x-(x1+dx*t),hill.z-(z1+dz*t))>=hill.r,`extent ${extent} 경로 ${route.id} 가 산을 지난다`);
      }
    }
  }
});
