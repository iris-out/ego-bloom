import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt, arcCorner, createSegmentIndex, quadratic, smoothPath } from '../../shared/curves.js';

/** 시드 고정 PRNG 다. Math.random() 을 쓰지 않아 200개 좌표가 매 실행 같다. */
function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

/** 점과 세그먼트 사이 최단 거리다. 전수 검사의 기준(ground truth)이다. */
function pointSegmentDistance(seg,x,z){
  const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,lenSq=dx*dx+dz*dz;
  const t=lenSq>1e-9?Math.max(0,Math.min(1,((x-seg.x1)*dx+(z-seg.z1)*dz)/lenSq)):0;
  return Math.hypot(x-(seg.x1+dx*t),z-(seg.z1+dz*t));
}

const bruteNear=(segments,x,z,radius)=>segments.filter(seg=>pointSegmentDistance(seg,x,z)<=radius);

test('quadratic 은 steps+1 개의 점을 내고 양 끝이 입력과 같다',()=>{
  const points=quadratic([0,0],[10,20],[30,0],6);
  assert.equal(points.length,7);
  assert.deepEqual(points[0],[0,0]);
  assert.deepEqual(points[points.length-1],[30,0]);
});

test('제어점이 두 끝의 중점이면 결과가 직선 위에 놓인다',()=>{
  const a=[0,0],b=[40,20],control=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const points=quadratic(a,control,b,10);
  for(const [x,z] of points){
    // (b-a) 와 (점-a) 의 외적이 0 이면 직선 위에 있다는 뜻이다.
    const cross=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);
    assert.ok(Math.abs(cross)<1e-9,`(${x},${z}) 가 직선에서 벗어났다`);
  }
});

test('smoothPath 는 끝점을 유지하고 점 수가 늘어난다',()=>{
  const points=[[0,0],[100,0],[100,100]];
  const smoothed=smoothPath(points,8);
  assert.deepEqual(smoothed[0],points[0]);
  assert.deepEqual(smoothed[smoothed.length-1],points[points.length-1]);
  assert.ok(smoothed.length>points.length,`점이 ${smoothed.length}개로 늘지 않았다`);
});

test('smoothPath 는 원본 꺾은선보다 방향 변화가 작다',()=>{
  const points=[[0,0],[100,0],[100,100]];
  const turnAt=(list,index)=>{
    const a=chordAngleOf(list[index-1],list[index]),b=chordAngleOf(list[index],list[index+1]);
    return Math.abs(wrap(b-a));
  };
  function chordAngleOf(p,q){return Math.atan2(q[0]-p[0],q[1]-p[1]);}
  function wrap(d){let x=d%(Math.PI*2);if(x>Math.PI)x-=Math.PI*2;if(x<-Math.PI)x+=Math.PI*2;return x;}
  const originalTurn=turnAt(points,1);
  const smoothed=smoothPath(points,8);
  let maxTurn=0;
  for(let i=1;i<smoothed.length-1;i++)maxTurn=Math.max(maxTurn,turnAt(smoothed,i));
  assert.ok(maxTurn<originalTurn,`곡선의 최대 방향 변화 ${maxTurn} 가 원본 ${originalTurn} 보다 크거나 같다`);
});

test('angleAt 은 직선 폴리라인에서는 어디서나 같은 값을 낸다',()=>{
  const points=[[0,0],[0,50],[0,100],[0,150]];
  const expected=angleAt(points,0,0);
  for(let index=0;index<points.length-1;index++)
    for(const t of [0,.25,.5,.75,1])
      assert.ok(Math.abs(angleAt(points,index,t)-expected)<1e-9,`index=${index} t=${t}`);
});

test('angleAt 은 꼭짓점을 지날 때 연속이다',()=>{
  const points=[[0,0],[100,0],[100,100]];
  const before=angleAt(points,0,1),after=angleAt(points,1,0);
  assert.ok(Math.abs(before-after)<1e-9,'꼭짓점 경계에서 값이 갈라진다');
  const chordDiff=Math.abs(angleAt(points,1,.5)-angleAt(points,0,.5));
  const eps=1e-4;
  const jump=Math.abs(angleAt(points,0,1-eps)-angleAt(points,1,eps));
  assert.ok(jump<chordDiff,`경계 근처 차이 ${jump} 가 현 하나의 각도 차이 ${chordDiff} 보다 작지 않다`);
});

test('angleAt 은 atan2(dx, dz) 규약을 지킨다',()=>{
  const points=[[0,0],[10,0]];
  assert.ok(Math.abs(angleAt(points,0,.5)-Math.PI/2)<1e-9);
});

test('arcCorner 는 steps+1 개의 점을 내고 반지름을 지킨다',()=>{
  const centre=[10,20],radius=15,points=arcCorner(centre,radius,0,Math.PI/2,6);
  assert.equal(points.length,7);
  for(const [x,z] of points)assert.ok(Math.abs(Math.hypot(x-centre[0],z-centre[1])-radius)<1e-9);
  assert.ok(Math.abs(points[0][0]-centre[0])<1e-9&&Math.abs(points[0][1]-(centre[1]+radius))<1e-9);
});

// 세그먼트 200개를 넓은 영역에 흩어 색인의 recall(8번)과 pruning(9번)을 함께 본다.
const rand=mulberry32(20260913);
const SPREAD=1500;
const segments=Array.from({length:80},(_,i)=>{
  const x1=(rand()*2-1)*SPREAD,z1=(rand()*2-1)*SPREAD;
  const len=20+rand()*80,angle=rand()*Math.PI*2;
  return {x1,z1,x2:x1+Math.cos(angle)*len,z2:z1+Math.sin(angle)*len,kind:'lane'};
});
const index=createSegmentIndex(segments,50);
const QUERY_RADIUS=30;
const queries=Array.from({length:200},()=>[(rand()*2-1)*SPREAD,(rand()*2-1)*SPREAD]);

test('createSegmentIndex.near 는 전수 검사 결과를 반드시 포함한다',()=>{
  for(const [x,z] of queries){
    const brute=bruteNear(segments,x,z,QUERY_RADIUS);
    const near=new Set(index.near(x,z,QUERY_RADIUS));
    for(const seg of brute)assert.ok(near.has(seg),`(${x.toFixed(1)},${z.toFixed(1)}) 에서 세그먼트를 놓쳤다`);
  }
});

test('createSegmentIndex.near 는 전수보다 적게 돌려준다',()=>{
  let totalNear=0,queriesWithFewer=0;
  for(const [x,z] of queries){
    const near=index.near(x,z,QUERY_RADIUS);
    totalNear+=near.length;
    if(near.length<segments.length)queriesWithFewer++;
  }
  const avgReturned=totalNear/queries.length;
  assert.ok(avgReturned<segments.length,`평균 반환 ${avgReturned} 가 전체 세그먼트 수 ${segments.length} 보다 적지 않다`);
  assert.ok(queriesWithFewer>queries.length*.9,`가지치기가 된 질의가 ${queriesWithFewer}/${queries.length} 뿐이다`);
});
