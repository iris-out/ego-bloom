import test from 'node:test';
import assert from 'node:assert/strict';
import { roadSurface } from '../../src/world/roadSurface.js';
import { createUrbanPlan, cityExtentForCount } from '../../shared/urbanPlan.js';
import { CAR_GROUND, createCarState, stepCar } from '../../src/world/carPhysics.js';

const plan={highwayDeck:14,roads:[{x1:-100,z1:0,x2:100,z2:0,kind:'highway',elevated:true,deckY:14}],ramps:[{from:{x:0,z:100,y:-.27},to:{x:0,z:0,y:14},width:10}]};
test('램프 높이가 연속적으로 오르며 고가 노면에 이어진다',()=>{
  let top=.33;
  for(let z=100;z>=0;z--){top=roadSurface(plan,0,z,top).top;assert.ok(Math.abs(top-(.33+14.27*(100-z)/100))<1e-8);}
  assert.equal(roadSurface(plan,50,0,top).top,14.6);
});
test('고가 아래 지상 차량은 상판으로 순간 이동하지 않는다',()=>{
  assert.equal(roadSurface(plan,50,0,.33).top,.33);
});

test('실제 도시 IC의 지상 진입부터 본선 합류까지 노면이 연결된다',()=>{
  const city=createUrbanPlan(cityExtentForCount(1000));
  for(const ramp of city.ramps.filter(r=>r.kind==='ic')){
    // 그린 폴리라인 위를 1m 간격으로 훑는다. 메시와 노면 표본이 같은 배열을 읽는다.
    let top=ramp.points[0][2]+.6;
    for(let i=1;i<ramp.points.length;i++){
      const a=ramp.points[i-1],b=ramp.points[i];
      const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
      for(let s=0;s<=steps;s++){
        const t=s/steps,next=roadSurface(city,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,top);
        assert.ok(next.top>=top-1e-9,'램프 노면이 도중에 내려간다');
        assert.ok(next.top-top<.2,'연속 노면');top=next.top;
      }
    }
    assert.ok(Math.abs(top-city.highwayDeck-.6)<1e-8);
  }
});

test('방사선 포탈 경사로도 상판에서 지면까지 노면이 이어진다',()=>{
  const city=createUrbanPlan(cityExtentForCount(1000));
  const portals=city.ramps.filter(r=>r.kind==='portal');
  assert.equal(portals.length,2);
  for(const ramp of portals){
    let top=ramp.points[0][2]+.6;
    assert.ok(Math.abs(top-city.highwayDeck-.6)<1e-8,'포탈은 상판 높이에서 시작한다');
    for(let i=1;i<ramp.points.length;i++){
      const a=ramp.points[i-1],b=ramp.points[i];
      const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
      for(let s=0;s<=steps;s++){
        const t=s/steps,next=roadSurface(city,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,top);
        assert.ok(top-next.top<.2,'연속 노면');top=next.top;
      }
    }
    assert.ok(Math.abs(top-.33)<1e-8,`포탈 끝이 노면이 아니라 ${top}`);
  }
});

test('차량 물리가 실제 진입 램프 경사와 높이를 따른다',()=>{
  const extent=cityExtentForCount(1000),city=createUrbanPlan(extent),ramp=city.ramps.find(r=>r.kind==='ic');
  // 램프 위쪽 등경사 구간은 고속도로와 나란한 직선이다. 그 자리에서 접선 방향으로 달린다.
  const at=Math.floor((ramp.points.length-1)*.6),here=ramp.points[at],next=ramp.points[at+1];
  const dx=next[0]-here[0],dz=next[1]-here[1];
  let state={...createCarState(extent),x:here[0],z:here[1],y:CAR_GROUND+here[2]+.27,
    heading:Math.atan2(-dx,-dz),speed:12};
  const startY=state.y;
  for(let i=0;i<120;i++)state=stepCar(state,{throttle:.3},1/60,extent,[],'sedan',[]);
  assert.equal(state.phase,'drive');
  assert.ok(state.y>startY+1,`램프를 오르지 못했다 ${startY.toFixed(2)} -> ${state.y.toFixed(2)}`);
  assert.ok(state.roadPitch>0);
});
