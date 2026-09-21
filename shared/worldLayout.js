/** Canonical compact-city placement. Lot sizes come from lots.js and the block
 * grid from urbanPlan.js, so renderer, traffic and minimap share one coordinate
 * graph and one set of lot dimensions. */
import { ALLEY, blockSlots, LOT, LOT_CHAMPION, LOT_SIZES, lotOf } from './lots.js';
import { cityExtentForCount, createUrbanPlan, districtBlocks, MAX_EXTENT, ROAD_WIDTH } from './urbanPlan.js';
import { bandAt, inHill, nodeAt, TIER_BAND } from './cityNodes.js';
import { inNature, inPond } from './nature.js';
import { riverCenter, riverClearance, riverHalf } from './river.js';
import { riverLift, riverZoneAt } from './riverZones.js';
import { LANDMARK_SIZE } from './landmarks.js';
import { beachStrips, onBeach, resortPlots } from './coast.js';

/** 강 기하는 shared/river.js 한 곳에 있다. 여기에는 티어 높이 배율만 남긴다. */
export const WORLD=Object.freeze({
  heightMultiplier:{bronze:.8,silver:1,gold:1.3,platinum:1.7,diamond:2.2,master:3,grandmaster:3.6,champion:4.2},
});

const tierKey=(row)=>String(row.tier_name||'bronze').toLowerCase();
/** 대역 escalation 순서다. 안쪽에서 바깥쪽 순이며 티어는 이 순서를 거슬러 올라가지 않는다. */
const BAND_ORDER=['civic','champ','master','trade','home'];
const fallbackBands=(key)=>{const index=BAND_ORDER.indexOf(key);return BAND_ORDER.slice(index<0?BAND_ORDER.length-1:index);};
/** 스카이라인 강조다. 다핵 배치에서 지구는 격자 장부일 뿐이라 지구로 높이를 정하면
 * 마스터가 도심 지구에, 챔피언이 외곽 지구에 설 때 티어 순서가 뒤집힌다. 핵으로 정한다.
 * 최대 비 1.30 은 가장 가까운 티어 배율 비 4.2/3.6 보다 작아 순서를 뒤집지 못한다. */
/** 핵 대역이 배경 건물 성격을 정한다. 관청가는 시청 둘레라 관공서와 광장으로 채운다. */
const BAND_DENSITY=Object.freeze({civic:'civic',champ:'tower',master:'tower',trade:'dense',home:'mixed'});
const SKYLINE_CENTRAL=1.22, SKYLINE_SUB=0.94;
const prominence=(node)=>(node==='central'?SKYLINE_CENTRAL:SKYLINE_SUB);

/** 랜드마크 둘레에 더 남겨 둘 여유다. 크기는 shared/landmarks.js 가 갖고 있다. */
const LANDMARK_MARGIN=6;
const RIVER_MARGIN=10;
/** 도로 중심선에서 필지까지 더 남겨 둘 여유다. 골목은 격자가 이미 5 를 준다. */
const ROAD_MARGIN=2;
/** 자리가 모자라면 도시를 키워 다시 깐다. */
const GROWTH_STEP=1.015, GROWTH_ATTEMPTS=60;

/** 건물이 들어가면 안 되는 축정렬 사각형이다. rx 가 Infinity 면 도시를 가로지른다.
 * 리조트 부지와 해변 띠도 회전이 0 또는 PI/2 뿐이라 같은 사각형 검사로 뺄 수 있다. */
function reservations(plan){
  const e=plan.extent,list=[];
  // 강과 강변 공원, 강변도로를 한 덩어리로 비운다. 중심선이 굽어 있으므로 x 를 잘라
  // 조각마다 사각형을 놓는다. 조각 폭을 간격보다 넓게 잡아 사이에 틈이 없게 한다.
  const RIVER_STEPS=72, slice=(2*e)/RIVER_STEPS;
  for(let i=0;i<=RIVER_STEPS;i++){
    const x=-e+slice*i,center=riverCenter(e,x);
    for(const side of [-1,1]){
      const reach=riverClearance(e,x,side);
      const inner=riverHalf(e,x),mid=center+side*(inner+(reach-inner)/2);
      list.push({x,z:mid,rx:slice*0.62,rz:(reach-inner)/2+RIVER_MARGIN});
    }
    list.push({x,z:center,rx:slice*0.62,rz:riverHalf(e,x)+RIVER_MARGIN});
  }
  // 지천도 같은 물이다.
  for(const stream of plan.streams||[]){
    const mid=(stream.z1+stream.z2)/2;
    list.push({x:stream.x,z:mid,rx:stream.width/2+RIVER_MARGIN,rz:Math.abs(stream.z2-stream.z1)/2});
  }
  for(const park of plan.parks)list.push({x:park.x,z:park.z,rx:park.rx,rz:park.rz});
  // 연못과 호수도 비운다. 타원이지만 외접 사각형이면 충분히 넉넉하다.
  for(const pond of plan.ponds||[])list.push({x:pond.x,z:pond.z,rx:pond.rx+6,rz:pond.rz+6});
  for(const plaza of plan.plazas)list.push({x:plaza.x,z:plaza.z,rx:plaza.r,rz:plaza.r});
  for(const circle of plan.roundabouts||[])list.push({x:circle.x,z:circle.z,rx:circle.r+8,rz:circle.r+8});
  // 랜드마크마다 제 크기만큼 비운다. 한 값으로 뭉뚱그리면 시청 둘레에 건물이 파고든다.
  for(const mark of plan.landmarks){
    const [width,depth]=LANDMARK_SIZE[mark.key]||[148,148];
    list.push({x:mark.x,z:mark.z,rx:width/2+LANDMARK_MARGIN,rz:depth/2+LANDMARK_MARGIN});
  }
  for(const resort of resortPlots(plan.extent))list.push({x:resort.x,z:resort.z,rx:resort.size/2,rz:resort.size/2});
  for(const strip of beachStrips(plan.extent)){
    const rx=strip.angle===0?strip.length/2:strip.width/2,rz=strip.angle===0?strip.width/2:strip.length/2;
    list.push({x:strip.x,z:strip.z,rx,rz});
  }
  return list;
}

const blocked=(reserved,x,z,lot)=>reserved.some(r=>Math.abs(x-r.x)<r.rx+lot/2&&Math.abs(z-r.z)<r.rz+lot/2);
/** 산, 모서리 자연지대, 연못은 어떤 건물도 서지 않는 땅이다. 세 검사를 한 번에 한다. */
const barred=(plan,x,z)=>inHill(plan.hills,x,z)||inNature(plan.extent,x,z)||inPond(plan,x,z);

/** 선분이 여유만큼 부풀린 필지 사각형을 지나는지 본다. 모서리에서는 실제 거리보다
 * 조금 크게 잡히므로 통과한 필지는 도로에서 확실히 떨어져 있다. */
function crosses(road,x,z,half){
  let near=0,far=1;
  const origin=[road.x1-x,road.z1-z],delta=[road.x2-road.x1,road.z2-road.z1];
  for(let axis=0;axis<2;axis++){
    if(Math.abs(delta[axis])<1e-9){if(Math.abs(origin[axis])>half)return false;continue;}
    const a=(-half-origin[axis])/delta[axis],b=(half-origin[axis])/delta[axis];
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
    if(near>far)return false;
  }
  return true;
}

/** 도로 폭 중 가장 넓은 값의 절반이다. roadIndex 질의 반경을 안전하게 잡는 데 쓴다. */
const MAX_ROAD_HALF=Math.max(...Object.values(ROAD_WIDTH))/2;

/** plan.roadIndex 로 후보만 추려 정확한 통과 검사(crosses)를 돌린다. 곡선 간선이라
 * 세그먼트가 늘어난 만큼 전수 검사 대신 격자 색인을 쓴다. 골목은 색인에 없어 검사에서 빠진다.
 * skipElevated 를 켜면 고가(highway) 도로는 통과 검사에서 뺀다. 고가 밑 자리를 찾을 때
 * "지상 도로만 없으면 된다"는 판정에 쓴다. */
function nearRoad(plan,x,z,lot,{skipElevated=false}={}){
  const radius=lot/2+MAX_ROAD_HALF+ROAD_MARGIN;
  return plan.roadIndex.near(x,z,radius).some(road=>{
    if(skipElevated&&road.elevated)return false;
    return crosses(road,x,z,lot/2+(ROAD_WIDTH[road.kind]||8)/2+ROAD_MARGIN);
  });
}

/** 고가 상판 바로 아래 자리다. 지상 도로에는 안 걸리는데 고가를 포함하면 걸린다.
 * 즉 이 자리를 막은 것은 고가 하나뿐이다. */
function underHighwayDeck(plan,x,z,lot){
  return nearRoad(plan,x,z,lot)&&!nearRoad(plan,x,z,lot,{skipElevated:true});
}

/** 이미 잡힌 필지와 축정렬 사각형이 겹치는지 본다. 격자를 믿지 않는 마지막 관문이다. */
function createOccupancy(){
  const size=LOT_CHAMPION+ALLEY,taken=new Map();
  const key=(ix,iz)=>`${ix},${iz}`;
  return {
    fits(x,z,lot){
      const ix=Math.floor(x/size),iz=Math.floor(z/size);
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const other of taken.get(key(ix+dx,iz+dz))||[]){
        const need=(lot+other.lot)/2;
        if(Math.abs(x-other.x)<need&&Math.abs(z-other.z)<need)return false;
      }
      return true;
    },
    claim(x,z,lot){
      const id=key(Math.floor(x/size),Math.floor(z/size));
      (taken.get(id)||taken.set(id,[]).get(id)).push({x,z,lot});
    },
  };
}

/** 핵, 대역, 등급별 필지 목록이다. 키는 `${node}|${band}|${size}` 다. district 격자가
 * 물리적 칸을 정하지만 어떤 티어가 설 수 있는지는 그 칸이 속한 핵의 대역이 정한다.
 * 핵 밖(nodeAt 이 null), 산 안, 도로 위인 칸은 후보에서 뺀다. 대역 안에서는 핵
 * 중심에 가까운 자리부터 쓴다. 핵 단위로 쪼개 둬야 챔피언 escalation 을 한 핵
 * 안으로 가둘 때와 나머지 티어가 모든 핵을 함께 쓸 때 같은 자리를 두 번 내주지 않는다. */
function buildPools(plan){
  const reserved=reservations(plan),occupancy=createOccupancy(),pools=new Map();
  for(const district of plan.districts){
    for(const block of districtBlocks(district).blocks){
      if(block.empty)continue;
      const blockId=`${district.id}-${block.band}-${block.bay}-${block.column}`;
      for(const [sx,sz] of blockSlots(block.lot)){
        const x=block.x+sx,z=block.z+sz;
        if(blocked(reserved,x,z,block.lot)||barred(plan,x,z))continue;
        const hit=nodeAt(plan.nodes,x,z);
        if(!hit)continue;
        if(nearRoad(plan,x,z,block.lot)||!occupancy.fits(x,z,block.lot))continue;
        const band=bandAt(hit.node,hit.d);
        // 관청가는 ZETA 시청과 중앙 공원 자리다. 제작자도 NPC 도 여기 짓지 않는다.
        // 후보 목록에 넣어 두면 배치가 실패했을 때 예비 경로가 광장을 내준다.
        if(band.key==='civic')continue;
        occupancy.claim(x,z,block.lot);
        const poolKey=`${hit.node.id}|${band.key}|${block.lot}`;
        (pools.get(poolKey)||pools.set(poolKey,[]).get(poolKey)).push({x,z,lot:block.lot,blockId,
          blockRotation:district.rotation,district:district.id,node:hit.node.id,band:band.key,d:hit.d});
      }
    }
  }
  for(const bucket of pools.values())
    bucket.sort((a,b)=>a.d-b.d||a.blockId.localeCompare(b.blockId)||a.x-b.x||a.z-b.z);
  return pools;
}

/** champ 대역에서 시작하는 티어(챔피언, 그랜드마스터)는 도심 핵 하나에서만 산다.
 * 대역이 바깥으로 넘어가도(champ -> master -> trade -> home) 다른 핵으로는 넘어가지
 * 않는다. 그 외 티어는 모든 핵을 함께 쓴다. */
const CENTRAL_ONLY_START=new Set(['champ']);
/** 관청가만 빼고 전부 연다. 광장에는 어떤 경우에도 짓지 않는다. */
const LAST_RESORT_BANDS=BAND_ORDER.filter(band=>band!=='civic');

/** 모든 건물에 자리를 준다. TIER_BAND 가 정한 대역부터 찾고 다 차면 한 단계 바깥
 * 대역으로만 넘어간다. 안쪽 대역으로는 절대 넘어가지 않는다. 하나라도 모자라면
 * null 을 돌려 도시를 키우게 한다. */
function assign(rows,plan,pools){
  const nodeIds=plan.nodes.map(n=>n.id),cursors=new Map(),placed=[];
  for(const row of rows){
    const key=tierKey(row),lot=lotOf(key),startBand=TIER_BAND[key]||'home';
    const bands=fallbackBands(startBand);
    // 도심을 먼저 다 쓰고 그래도 모자라면 다른 핵으로 넘긴다. 배치 실패는 도시 전체를
    // 예비 경로로 떨어뜨려 광장에까지 건물을 세우므로 선호보다 성공이 우선이다.
    const rounds=CENTRAL_ONLY_START.has(startBand)?[['central'],nodeIds]:[nodeIds];
    let claimed=null;
    // 마지막 수단으로 안쪽 대역까지 연다. 조닝은 선호이지 절대 규칙이 아니다.
    // 이걸 막으면 챔피언 필지가 모자란 표본에서 도시가 상한까지 커진다.
    const attempts=[...rounds.map(scope=>({scope,bands})),{scope:nodeIds,bands:LAST_RESORT_BANDS}];
    for(const {scope,bands:tryBands} of attempts){
    for(const band of tryBands){
      for(const size of LOT_SIZES){
        if(size<lot)continue;
        for(const node of scope){
          const poolKey=`${node}|${band}|${size}`,pool=pools.get(poolKey)||[],cursor=cursors.get(poolKey)||0;
          if(cursor>=pool.length)continue;
          cursors.set(poolKey,cursor+1);claimed=pool[cursor];break;
        }
        if(claimed)break;
      }
      if(claimed)break;
    }
    if(claimed)break;
    }
    if(!claimed)return null;
    placed.push({district:claimed.district,slot:claimed});
  }
  return {placed,cursors};
}

function sortedRows(records){
  const unique=new Map();
  for(const row of records||[]){
    if(typeof row?.id!=='string'||!row.id)continue;
    const score=Math.max(0,Number(row.elo_score)||0);
    if(!unique.has(row.id)||score>unique.get(row.id).elo_score)unique.set(row.id,{...row,elo_score:score});
  }
  return [...unique.values()].sort((a,b)=>b.elo_score-a.elo_score||a.id.localeCompare(b.id)).slice(0,1000);
}

/** 도시를 한 번 깐다. 자리가 모자라면 extent 를 키워 다시 깐다. */
function layoutCity(records){
  const rows=sortedRows(records);
  let extent=cityExtentForCount(rows.length),plan=createUrbanPlan(extent),pools=buildPools(plan);
  let filled=assign(rows,plan,pools);
  for(let attempt=1;attempt<GROWTH_ATTEMPTS&&!filled&&extent<MAX_EXTENT;attempt++){
    extent=Math.min(MAX_EXTENT,Math.round(extent*GROWTH_STEP));
    plan=createUrbanPlan(extent);
    pools=buildPools(plan);
    filled=assign(rows,plan,pools);
  }
  const spare=[...pools.values()].flatMap(pool=>pool.map(slot=>({district:slot.district,slot})));
  return {rows,plan,pools,placed:filled?filled.placed:spare,cursors:filled?filled.cursors:new Map()};
}

export function buildWorld(records){
  const {rows,plan,placed}=layoutCity(records);
  const ranges=new Map();
  for(const row of rows){const key=tierKey(row),log=Math.log10(Math.max(1,row.elo_score)),range=ranges.get(key)||[Infinity,-Infinity];ranges.set(key,[Math.min(range[0],log),Math.max(range[1],log)]);}
  return rows.map((row,rank)=>{
    const key=tierKey(row),seat=placed[rank]||placed[rank%Math.max(1,placed.length)];
    const log=Math.log10(Math.max(1,row.elo_score)),[min,max]=ranges.get(key),within=max>min?(log-min)/(max-min):.5;
    const baseHeight=Math.max(12,Math.min(70,12+(log-3)*9)*(.7+.6*within));
    // 곱한 뒤에 260 으로 자르면 챔피언과 마스터가 둘 다 상한에 걸려 높이가 같아진다.
    // 티어 배율을 곱하기 전에 자르면 티어 순서가 항상 남는다. 챔피언 배율 4.2 가
    // 상한 260 을 그대로 쓰도록 밑값 상한을 260/4.2 로 잡는다.
    const MAX_HEIGHT=260,TOP_MULTIPLIER=Math.max(...Object.values(WORLD.heightMultiplier));
    // 강 대역이 높이 인상을 정한다. 북안은 눌러 저층 구시가지로, 남안 아파트 띠는 올려
    // 강변에 같은 높이가 늘어서게 만든다. 티어 배율을 곱하기 전에 상한을 걸어야 순서가 남는다.
    const lift=riverLift(plan.extent,seat.slot.x,seat.slot.z);
    const mass=Math.min(MAX_HEIGHT/TOP_MULTIPLIER,baseHeight*prominence(seat.slot.node)*lift);
    const height=mass*(WORLD.heightMultiplier[key]??1);
    return {...row,rank:rank+1,lot:lotOf(key),x:seat.slot.x,z:seat.slot.z,cityExtent:plan.extent,
      district:seat.district,blockId:seat.slot.blockId,blockRotation:seat.slot.blockRotation,
      node:seat.slot.node,band:seat.slot.band,baseHeight,height};
  });
}


/** 자리 하나에 무엇이 들어갈 수 있는지 본다. 온전한 필지가 들어가면 그대로 쓰고,
 * 도로에 걸리면 필지를 단계적으로 줄여 여덟 방향으로 비켜 본다. 아무것도 안 들어가면
 * null 이다. 줄인 필지는 도로에서 물러난 자투리 땅이라 작은 배경 건물만 선다.
 */
export const SEAT_SHRINK=Object.freeze([0.62,0.44,0.3]);
function fitSeat(plan,occupancy,x,z,lot){
  if(!nearRoad(plan,x,z,lot)&&occupancy.fits(x,z,lot))return {x,z,lot};
  for(const ratio of SEAT_SHRINK){
    const small=Math.round(lot*ratio),step=(lot-small)/2;
    // 귀퉁이 넷과 변 넷을 본다. 곡선 간선이 비스듬히 지나면 한쪽 변만 살아남는 자리가 많다.
    for(const [dx,dz] of [[-step,-step],[step,-step],[-step,step],[step,step],
      [0,-step],[0,step],[-step,0],[step,0]]){
      const sx=x+dx,sz=z+dz;
      if(barred(plan,sx,sz)||nearRoad(plan,sx,sz,small)||!occupancy.fits(sx,sz,small))continue;
      return {x:sx,z:sz,lot:small};
    }
  }
  return null;
}

/** 제작자가 안 쓰는 남은 격자다. 예전에는 핵 밖만 봤는데 핵 안에서도 제작자 후보
 * 목록(buildPools) 에 못 들어간 자리가 495개 비어 있었다. 관청가 대역은 아예 제외돼
 * 시청 둘레가 통째로 빈 포장이었고, 도로에 가까워 탈락한 자리도 그대로 남았다.
 * 이제 핵 안팎을 모두 훑고 그 자리의 대역이 성격을 정한다. 이미 잡힌 자리는 occupancy
 * 가 걸러 준다. 밀도 어휘는 npcBuildings 가 읽는다.
 */
function fringeSlots(plan,occupancy,reserved){
  const strips=beachStrips(plan.extent),plots=resortPlots(plan.extent),slots=[];
  for(const district of plan.districts)for(const block of districtBlocks(district).blocks){
    if(block.empty)continue;
    for(const [sx,sz] of blockSlots(block.lot)){
      const x=block.x+sx,z=block.z+sz;
      if(blocked(reserved,x,z,block.lot)||barred(plan,x,z))continue;
      if(strips.some(strip=>onBeach(strip,x,z)))continue;
      if(plots.some(plot=>Math.abs(x-plot.x)<plot.size/2&&Math.abs(z-plot.z)<plot.size/2))continue;
      // 곡선 간선이 블록을 비스듬히 지나면 온전한 필지가 안 들어간다. 그런 자리는
      // 필지를 줄여 도로 반대쪽으로 비켜 세운다. 서울에서도 큰길에 잘린 자투리 땅에는
      // 작은 건물이 선다. 그냥 버리면 313 자리가 빈 포장으로 남는다.
      const seat=fitSeat(plan,occupancy,x,z,block.lot);
      if(!seat)continue;
      occupancy.claim(seat.x,seat.z,seat.lot);
      // 핵 안이면 그 핵의 대역이, 밖이면 강까지의 거리가 성격을 정한다.
      const hit=nodeAt(plan.nodes,seat.x,seat.z);
      const band=hit?bandAt(hit.node,hit.d):null;
      const zone=hit?null:riverZoneAt(plan.extent,seat.x,seat.z);
      slots.push({x:seat.x,z:seat.z,lot:seat.lot,rotation:district.rotation,district:district.id,
        density:band?BAND_DENSITY[band.key]||'mixed':zone?.density||'open',
        blockId:`${district.id}-fringe-${block.band}-${block.bay}-${block.column}`,
        cityExtent:plan.extent,node:hit?hit.node.id:null,band:band?band.key:zone?.key||'fringe'});
    }
  }
  return slots;
}

/** 고가 상판 아래 자리다. 지상 도로에는 안 걸리고 고가에만 걸린 자리이며, 실제 도시가
 * 고가 밑에 주차장과 야적장을 두는 것과 같다. density 'deck' 은 npcBuildings 가
 * 상판을 뚫지 않는 낮은 종류만 고르게 하는 신호다. 제작자 건물은 높이가 ELO 로 정해져
 * 상판을 뚫으므로 여기에는 세우지 않는다.
 */
function deckSlots(plan,occupancy,reserved){
  const strips=beachStrips(plan.extent),plots=resortPlots(plan.extent),slots=[];
  for(const district of plan.districts)for(const block of districtBlocks(district).blocks){
    if(block.empty)continue;
    for(const [sx,sz] of blockSlots(block.lot)){
      const x=block.x+sx,z=block.z+sz;
      if(blocked(reserved,x,z,block.lot)||barred(plan,x,z))continue;
      if(strips.some(strip=>onBeach(strip,x,z)))continue;
      if(plots.some(plot=>Math.abs(x-plot.x)<plot.size/2&&Math.abs(z-plot.z)<plot.size/2))continue;
      if(!underHighwayDeck(plan,x,z,block.lot)||!occupancy.fits(x,z,block.lot))continue;
      occupancy.claim(x,z,block.lot);
      slots.push({x,z,lot:block.lot,rotation:district.rotation,district:district.id,density:'deck',
        blockId:`${district.id}-deck-${block.band}-${block.bay}-${block.column}`,
        cityExtent:plan.extent,node:null,band:'deck'});
    }
  }
  return slots;
}

/** 제작자가 쓰지 않고 남은 필지다. NPC 배경 건물이 채울 자리이며 건물 부지,
 * 도로, 공원, 광장, 랜드마크와 겹치지 않는 규칙은 제작자 건물과 같다. */
export function vacantSlots(records){
  const {plan,pools,cursors,placed}=layoutCity(records);
  const byId=new Map(plan.districts.map(d=>[d.id,d]));
  const vacant=[];
  for(const [key,pool] of pools){
    for(let index=cursors.get(key)||0;index<pool.length;index++){
      const slot=pool[index],district=byId.get(slot.district);
      vacant.push({x:slot.x,z:slot.z,lot:slot.lot,rotation:district.rotation,district:district.id,
        density:district.density,blockId:slot.blockId,cityExtent:plan.extent,node:slot.node,band:slot.band});
    }
  }
  const occupancy=createOccupancy();
  // 제작자가 앉은 자리를 먼저 잡는다. 예전에는 fringeSlots 가 핵 안을 건너뛰어 겹칠 일이
  // 없었지만, 이제 핵 안도 훑으므로 이 자리를 안 잡으면 배경 건물이 제작자 위에 선다.
  for(const seat of placed||[])occupancy.claim(seat.slot.x,seat.slot.z,seat.slot.lot);
  for(const slot of vacant)occupancy.claim(slot.x,slot.z,slot.lot);
  const reserved=reservations(plan);
  for(const slot of fringeSlots(plan,occupancy,reserved))vacant.push(slot);
  for(const slot of deckSlots(plan,occupancy,reserved))vacant.push(slot);
  return vacant;
}

/** 격자가 일부러 비워 둔 블록이다. 광장과 쌈지 공원이 들어갈 자리이며
 * 제작자 건물과 같은 겹침 규칙을 통과한 자리만 돌려준다. */
function openBlockSlots(plan,occupancy){
  const reserved=reservations(plan),slots=[];
  for(const district of plan.districts)for(const block of districtBlocks(district).blocks){
    if(!block.empty)continue;
    for(const [sx,sz] of blockSlots(block.lot)){
      const x=block.x+sx,z=block.z+sz;
      if(blocked(reserved,x,z,block.lot)||barred(plan,x,z)||nearRoad(plan,x,z,block.lot)||!occupancy.fits(x,z,block.lot))continue;
      occupancy.claim(x,z,block.lot);
      // 일부러 비운 블록도 강 대역을 따른다. 쌈지 공원과 광장이 그 동네 성격에 맞게 선다.
      const zone=riverZoneAt(plan.extent,x,z);
      slots.push({x,z,lot:block.lot,rotation:district.rotation,district:district.id,
        density:zone?.density||'open',band:zone?.key||'open',
        blockId:`${district.id}-open-${block.band}-${block.bay}-${block.column}`});
    }
  }
  return slots;
}

/** 이미 배치된 건물 목록만 보고 남은 필지를 되찾는다. 같은 extent 로 같은 격자를 다시 깔고
 * 좌표가 겹치는 자리를 뺀다. 티어 표기가 서버와 달라도 좌표로 맞추므로 어긋나지 않는다. */
export function fillerSlots(buildings){
  const extent=Number(buildings?.[0]?.cityExtent);
  if(!Number.isFinite(extent)||extent<=0)return [];
  const plan=createUrbanPlan(extent),byId=new Map(plan.districts.map(d=>[d.id,d]));
  const used=new Set((buildings||[]).map(b=>`${Number(b.x).toFixed(2)},${Number(b.z).toFixed(2)}`));
  const spare=[],occupancy=createOccupancy();
  for(const building of buildings||[])occupancy.claim(Number(building.x)||0,Number(building.z)||0,Number(building.lot)||LOT);
  for(const pool of buildPools(plan).values()){
    for(const slot of pool){
      if(used.has(`${slot.x.toFixed(2)},${slot.z.toFixed(2)}`))continue;
      const district=byId.get(slot.district);
      occupancy.claim(slot.x,slot.z,slot.lot);
      spare.push({x:slot.x,z:slot.z,lot:slot.lot,rotation:district.rotation,district:district.id,
        density:district.density,blockId:slot.blockId,cityExtent:extent,node:slot.node,band:slot.band});
    }
  }
  const reserved=reservations(plan);
  for(const slot of openBlockSlots(plan,occupancy))spare.push({...slot,cityExtent:extent});
  // 렌더러가 읽는 것은 이 함수뿐이다. vacantSlots 와 같은 세 갈래를 채워야
  // 핵 밖 지구와 고가 밑이 화면에서 빈 땅으로 남지 않는다.
  for(const slot of fringeSlots(plan,occupancy,reserved))spare.push(slot);
  for(const slot of deckSlots(plan,occupancy,reserved))spare.push(slot);
  return spare;
}

export function getWorldBounds(buildings){
  const radius=Math.max(220,...(buildings||[]).map(b=>Math.max(Math.abs(Number(b.x)||0),Math.abs(Number(b.z)||0))+(Number.isFinite(b.lot)?b.lot/2:20)))+75;
  return{minX:-radius,maxX:radius,minZ:-radius,maxZ:radius};
}

export const __debug={buildPools,assign,sortedRows,fringeSlots,deckSlots,underHighwayDeck};
