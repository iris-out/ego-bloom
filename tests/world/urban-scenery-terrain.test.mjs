import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUrbanScenery } from '../../src/world/UrbanScenery.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { LANDMARK_SIZE } from '../../shared/landmarks.js';
import { inWaterBody, riverCenter, riverHalf, riverLandSpans, riverSurfaceMesh } from '../../shared/river.js';

test('강 렌더 조각은 물 판정의 양쪽 경계를 끊김 없이 덮는다',()=>{
  const extent=1600,steps=96,mesh=riverSurfaceMesh(extent,'water',0,steps);
  assert.equal(mesh.positions.length,(steps+1)*6);
  assert.equal(mesh.indices.length,steps*6);
  for(let i=0;i<=steps;i++){
    const at=i*6,x=mesh.positions[at];
    assert.ok(Math.abs(mesh.positions[at+2]-(riverCenter(extent,x)-riverHalf(extent,x)))<1e-9);
    assert.ok(Math.abs(mesh.positions[at+5]-(riverCenter(extent,x)+riverHalf(extent,x)))<1e-9);
    if(i<steps)assert.deepEqual(mesh.indices.slice(i*6,i*6+6),[i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2]);
  }
});

test('강 표면 높이는 기존 상단 높이를 유지하고 모든 삼각형이 위를 향한다',()=>{
  const expected={bank:.08,water:.18,park:.13};
  for(const kind of Object.keys(expected))for(const side of kind==='park'?[-1,1]:[0]){
    const mesh=riverSurfaceMesh(1600,kind,side,8);
    for(let i=1;i<mesh.positions.length;i+=3)assert.equal(mesh.positions[i],expected[kind]);
    for(let i=0;i<mesh.indices.length;i+=3){
      const [a,b,c]=mesh.indices.slice(i,i+3).map((index)=>index*3);
      const abx=mesh.positions[b]-mesh.positions[a],abz=mesh.positions[b+2]-mesh.positions[a+2];
      const acx=mesh.positions[c]-mesh.positions[a],acz=mesh.positions[c+2]-mesh.positions[a+2];
      assert.ok(abz*acx-abx*acz>0,`${kind} side=${side} 삼각형이 아래를 향한다`);
    }
  }
});

test('섬 렌더 반지름은 물리 판정 반지름과 같다',()=>{
  const { batches,plan }=buildUrbanScenery([],1600,'low');
  for(const island of plan.islands){
    const ground=batches['octagon-ground'].parts.find((part)=>part.position[0]===island.x&&part.position[2]===island.z);
    const green=batches['octagon-green'].parts.find((part)=>part.position[0]===island.x&&part.position[2]===island.z);
    assert.deepEqual(ground.scale,[island.rx,.3,island.rz]);
    assert.deepEqual(green.scale,[island.rx*.75,.12,island.rz*.75]);
    assert.equal(ground.position[1],.16);
    assert.equal(green.position[1],.26);
    assert.ok(green.position[1]+green.scale[1]/2<.33,'섬 잔디가 도로 위로 솟는다');
    assert.ok(green.position[1]+green.scale[1]/2>ground.position[1]+ground.scale[1]/2,'섬 잔디가 땅에 묻힌다');
  }
});

test('긴 도로의 뭍 구간은 좁은 지천도 건너뛰고 경계에서 멈춘다',()=>{
  const extent=1600,line={x1:-extent,z1:-1200,x2:extent,z2:-1200};
  const spans=riverLandSpans(extent,line);
  assert.ok(spans.length>=3,'북안의 좁은 지천 둘이 뭍 구간을 갈라야 한다');
  for(const [t0,t1] of spans){
    for(let i=1;i<10;i++){
      const t=t0+(t1-t0)*i/10,x=line.x1+(line.x2-line.x1)*t;
      assert.equal(inWaterBody(extent,x,line.z1),false,`뭍 도로가 물을 덮는다: x=${x}`);
    }
  }
  for(let i=0;i<spans.length-1;i++){
    const t=(spans[i][1]+spans[i+1][0])/2,x=line.x1+(line.x2-line.x1)*t;
    assert.equal(inWaterBody(extent,x,line.z1),true,`지천 틈이 도로로 메워진다: x=${x}`);
  }
});

test('공원 녹지는 예약된 빈 블록의 정확한 크기만 차지한다',()=>{
  const { batches, plan }=buildUrbanScenery([],1600,'medium');
  const greens=batches['box-green'].parts;
  for(const park of plan.parks){
    const part=greens.find((green)=>green.position[0]===park.x&&green.position[2]===park.z
      &&green.position[1]===.25);
    assert.ok(part,`공원 ${park.kind} 바닥이 없다`);
    assert.deepEqual(part.scale,[park.rx*2,.35,park.rz*2],`공원 ${park.kind} 이 도로까지 번진다`);
  }
});

test('산 덩이와 랜드마크 바닥판 밑에는 블록 포장판을 깔지 않는다',()=>{
  const extent=2164,plan=createUrbanPlan(extent);
  const {batches}=buildUrbanScenery([],extent,'low');
  const blocks=Object.values(batches).filter(batch=>batch.shape==='box'&&batch.material==='pavement')
    .flatMap(batch=>batch.parts).filter(part=>Math.abs(part.position[1]-.15)<.01);
  assert.ok(blocks.length>0,'블록 포장판이 하나도 없다');
  for(const part of blocks){
    const [x,,z]=part.position,half=part.scale[0]/2;
    for(const hill of plan.hills)
      assert.ok(Math.hypot(Math.max(0,Math.abs(x-hill.x)-half),Math.max(0,Math.abs(z-hill.z)-half))>=hill.r*.95,'산 밑에 포장판이 깔렸다');
    for(const mark of plan.landmarks){
      const [width,depth]=LANDMARK_SIZE[mark.key];
      assert.ok(Math.abs(x-mark.x)>=width/2+half||Math.abs(z-mark.z)>=depth/2+half,`${mark.key} 밑에 포장판이 깔렸다`);
    }
  }
});
