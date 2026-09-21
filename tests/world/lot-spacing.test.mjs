import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, SEAT_SHRINK, vacantSlots } from '../../shared/worldLayout.js';
import { createUrbanPlan, ROAD_WIDTH } from '../../shared/urbanPlan.js';
import { LOT_SIZES } from '../../shared/lots.js';
import { LANDMARK_SIZE } from '../../shared/landmarks.js';

/** 실제 제작자 572명의 티어 분포다. 챔피언은 250M ELO 이상이라 드물다. */
const MIX=[['Champion',31],['Master',79],['Diamond',118],['Platinum',98],['Gold',109],['Silver',39],['Bronze',98]];
const SCORES={Champion:3.9e8,Master:6e7,Diamond:2.5e7,Platinum:9e5,Gold:9e4,Silver:2e4,Bronze:3e3};

function creators(count){
  const total=MIX.reduce((sum,[,n])=>sum+n,0),rows=[];
  for(const [tier,share] of MIX){
    const many=Math.round(count*share/total);
    for(let i=0;i<many&&rows.length<count;i++)rows.push({id:`${tier}-${i}`,nickname:`${tier} ${i}`,
      tier_name:tier,elo_score:SCORES[tier]+i});
  }
  for(let i=rows.length;i<count;i++)rows.push({id:`filler-${i}`,tier_name:'Bronze',elo_score:1000+i});
  return rows;
}

const pointSegment=(px,pz,road)=>{
  const dx=road.x2-road.x1,dz=road.z2-road.z1,len=dx*dx+dz*dz;
  const t=len?Math.max(0,Math.min(1,((px-road.x1)*dx+(pz-road.z1)*dz)/len)):0;
  return Math.hypot(px-(road.x1+dx*t),pz-(road.z1+dz*t));
};
const pointBox=(px,pz,cx,cz,half)=>Math.hypot(Math.max(Math.abs(px-cx)-half,0),Math.max(Math.abs(pz-cz)-half,0));
/** 필지 사각형과 도로 중심선 사이의 정확한 거리다. 떨어져 있으면 최솟값은
 * 한쪽의 꼭짓점에서 나온다. */
function boxToRoad(cx,cz,half,road){
  const corners=[[cx-half,cz-half],[cx+half,cz-half],[cx-half,cz+half],[cx+half,cz+half]];
  return Math.min(pointBox(road.x1,road.z1,cx,cz,half),pointBox(road.x2,road.z2,cx,cz,half),
    ...corners.map(([x,z])=>pointSegment(x,z,road)));
}

function audit(count){
  const city=buildWorld(creators(count)),vacant=vacantSlots(creators(count));
  const extent=city[0].cityExtent,plan=createUrbanPlan(extent);
  const lots=[...city.map(b=>({x:b.x,z:b.z,lot:b.lot})),...vacant.map(v=>({x:v.x,z:v.z,lot:v.lot}))];
  return {city,vacant,extent,plan,lots};
}

for(const count of [572,1000]){
  test(`${count}명 도시에서 어떤 두 부지도 겹치지 않는다`,()=>{
    const {lots}=audit(count);
    const cell=200,grid=new Map(),key=(a,b)=>`${a},${b}`;
    lots.forEach((lot,index)=>{const id=key(Math.floor(lot.x/cell),Math.floor(lot.z/cell));
      (grid.get(id)||grid.set(id,[]).get(id)).push(index);});
    for(let i=0;i<lots.length;i++){
      const a=lots[i],gx=Math.floor(a.x/cell),gz=Math.floor(a.z/cell);
      for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(const j of grid.get(key(gx+dx,gz+dz))||[]){
        if(j<=i)continue;
        const b=lots[j],need=(a.lot+b.lot)/2;
        assert.ok(Math.abs(a.x-b.x)>=need-1e-6||Math.abs(a.z-b.z)>=need-1e-6,
          `${a.x},${a.z} 와 ${b.x},${b.z} 의 부지가 겹친다`);
      }
    }
  });

  test(`${count}명 도시에서 부지가 도로 폭만큼 물러나 있다`,()=>{
    const {lots,plan}=audit(count);
    for(const lot of lots){
      const half=lot.lot/2;
      for(const road of plan.roads){
        // 고가는 상판이 머리 위로 지난다. 그 아래는 주차장과 야적장이 들어서는 자리라
        // 평면상 겹치는 것이 정상이다. 지상 도로만 검사한다.
        if(road.elevated)continue;
        const reach=half+ROAD_WIDTH[road.kind]/2+2;
        if(Math.min(road.x1,road.x2)-reach>lot.x||Math.max(road.x1,road.x2)+reach<lot.x)
          if(Math.min(road.z1,road.z2)-reach>lot.z||Math.max(road.z1,road.z2)+reach<lot.z)continue;
        const margin=road.kind==='alley'?.5:2;
        assert.ok(boxToRoad(lot.x,lot.z,half,road)>=ROAD_WIDTH[road.kind]/2+margin,
          `${lot.x},${lot.z} 가 ${road.kind} 도로에 붙어 있다`);
      }
    }
  });

  test(`${count}명 도시에서 부지가 공원, 광장, 랜드마크 예약 구역을 침범하지 않는다`,()=>{
    const {lots,plan}=audit(count);
    const zones=[...plan.parks.map(p=>({x:p.x,z:p.z,rx:p.rx,rz:p.rz})),
      ...plan.plazas.map(p=>({x:p.x,z:p.z,rx:p.r,rz:p.r})),
      // 랜드마크마다 크기가 다르다. 한 값으로 뭉뚱그리면 시청은 헐겁고 소공원은 빡빡해진다.
      ...plan.landmarks.map(m=>{const [w,d]=LANDMARK_SIZE[m.key]||[148,148];return {x:m.x,z:m.z,rx:w/2,rz:d/2};})];
    for(const lot of lots)for(const zone of zones)assert.ok(
      Math.abs(lot.x-zone.x)>=zone.rx+lot.lot/2-1e-6||Math.abs(lot.z-zone.z)>=zone.rz+lot.lot/2-1e-6,
      `${lot.x},${lot.z} 가 예약 구역과 겹친다`);
  });

  test(`${count}명 도시에서 지구 직사각형이 서로 겹치지 않는다`,()=>{
    const {plan}=audit(count);
    for(let i=0;i<plan.districts.length;i++)for(let j=i+1;j<plan.districts.length;j++){
      const a=plan.districts[i],b=plan.districts[j];
      assert.ok(Math.abs(a.x-b.x)>=a.rx+b.rx-1e-6||Math.abs(a.z-b.z)>=a.rz+b.rz-1e-6,`${a.id} 와 ${b.id} 가 겹친다`);
    }
  });

  test(`${count}명 배치와 빈 슬롯은 입력 순서와 무관하게 같다`,()=>{
    const rows=creators(count);
    assert.deepEqual(buildWorld([...rows].reverse()),buildWorld(rows));
    assert.deepEqual(vacantSlots([...rows].reverse()),vacantSlots(rows));
  });
}

test('빈 슬롯은 배경 건물을 고를 수 있는 정보를 담는다',()=>{
  const vacant=vacantSlots(creators(572));
  assert.ok(vacant.length>0);
  for(const slot of vacant){
    // 큰길에 잘린 자투리 자리는 필지를 줄여 앉히므로 등급 표에 없는 크기가 나온다.
    // 줄인 값은 원래 등급의 55% 이고 그보다 작아지지는 않는다.
    assert.ok(LOT_SIZES.includes(slot.lot)
      || LOT_SIZES.some((size)=>SEAT_SHRINK.some((ratio)=>slot.lot===Math.round(size*ratio))),
      `모르는 필지 ${slot.lot}`);
    // density 는 npcBuildings 의 DENSITY_WEIGHTS 키다. 강 대역이 apartment 를,
    // 관청가가 civic 을 쓴다.
    assert.ok(['tower','dense','mixed','open','deck','apartment','civic'].includes(slot.density),
      `모르는 density ${slot.density}`);
    assert.ok(typeof slot.district==='string'&&slot.district.length>0);
    assert.ok([slot.x,slot.z,slot.rotation].every(Number.isFinite));
  }
});
