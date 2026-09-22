/** 도시 그래프의 단일 출처. 지구는 직사각형이고 격자 퀼트처럼 붙어 있으며
 * 지구 사이 여백에는 간선이 곧게 지난다. district 의 rx, rz 는 반지름이 아니라
 * 직사각형의 반폭과 반깊이다. 필드 이름은 UrbanScenery 와 Map 이 읽으므로
 * 바꾸지 않는다. 블록 격자는 districtBlocks 하나가 만들고 도로와 배치가
 * 같은 결과를 다시 계산해 쓴다. 나들목, 램프, 로터리, 교량은 좌표를 박지 않고
 * 도로가 실제로 만나는 자리에서 파생한다. */
import { ALLEY, blockPitch, LOT, LOT_CHAMPION, LOT_LARGE, lotsPerBlock } from './lots.js';
import { cityHills, cityNodes } from './cityNodes.js';
import { createSegmentIndex } from './curves.js';
import { RIVER_ROAD, inRiver, inRiverPark, inWaterBody, riverCenter, riverHalf, riverIslands, riverParkWidth, riverSamples, riverStreams } from './river.js';
import { LANDMARK_SIZE } from './landmarks.js';
import { NATURE_ARC_RADIUS, NATURE_CORNER, inNature, natureCorners, naturePonds } from './nature.js';
import { riverZoneAt } from './riverZones.js';
import { LOOP_HALF_RATIO, highwayLoop, highwayRadials, highwayStraightHalf, interchanges as buildInterchanges, subwayNetwork } from './transit.js';
import { buildRoadNetwork, surfaceConnectors, surfaceEdgeSeams } from './roadNetwork.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const segment=(a,b,kind='lane',extra={})=>({x1:a[0],z1:a[1],x2:b[0],z2:b[1],kind,
  angle:Math.atan2(b[1]-a[1],b[0]-a[0]),length:Math.hypot(b[0]-a[0],b[1]-a[1]),...extra});
const wrapAngle=(d)=>{let x=d%(Math.PI*2);if(x>Math.PI)x-=Math.PI*2;if(x<-Math.PI)x+=Math.PI*2;return x;};
/** joinIn, joinOut 은 이웃 선분과의 방향차다. null 이면 경로의 끝이거나 다른 도로와의
 * 교차점이다. 차선 도색이 그 자리만 비우고 완만한 이음매는 이어 붙이는 판단에 쓴다. */
const path=(points,kind,extra={})=>{
  const segments=points.slice(1).map((point,index)=>segment(points[index],point,kind,{path:extra.id,...extra}));
  for(let i=0;i<segments.length;i++){
    segments[i].joinIn=i?Math.abs(wrapAngle(segments[i].angle-segments[i-1].angle)):null;
    segments[i].joinOut=i<segments.length-1?Math.abs(wrapAngle(segments[i+1].angle-segments[i].angle)):null;
  }
  return segments;
};
const hashText=(text)=>{let value=2166136261;for(const char of String(text))value=Math.imul(value^char.charCodeAt(0),16777619);value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;return value>>>0;};
/** 새로 넣는 이면도로·골목이 강이나 강변 공원을 지르는지 본다. 짧은 선분이라
 * 양 끝과 중점 표본이면 충분하다. 걸리면 그 구간은 통째로 뺀다. */
const crossesWater=(e,x1,z1,x2,z2,width=0)=>{
  const dx=x2-x1,dz=z2-z1,run=Math.hypot(dx,dz)||1,nx=-dz/run,nz=dx/run,half=width/2;
  for(let i=0;i<=10;i++){
    const t=i/10,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;
    for(const offset of half?[0,-half,half]:[0])
      if(inWaterBody(e,x+nx*offset,z+nz*offset)||inRiverPark(e,x+nx*offset,z+nz*offset))return true;
  }
  return false;
};

export const ROAD_WIDTH=Object.freeze({arterial:22,collector:15,lane:10,alley:6,highway:28});
/** 고가 순환 고속도로의 상판 높이다. roadStructures 의 기본값과 맞춘다. */
export const HIGHWAY_DECK=14;
/** 고가도로 상판을 층으로 나누는 간격이다. 상판 두께 1.2 에 밑면 보 1.1 과 난간 1.1 이
 * 붙어 한 상판이 차지하는 세로 폭이 3.4 다. 그보다 커야 두 상판이 서로를 뚫지 않는다. */
export const DECK_STEP=4;
/** 이웃한 두 지구 사각형 사이의 여백. 가운데로 간선이 지난다. */
export const GUTTER=36;
/** 지구 사각형 테두리에서 블록까지의 안쪽 여백이다. */
export const EDGE=10;
/** 베이 사이 지선 도로가 지나는 통로 폭이다. */
export const LANE_GAP=18;
/** 베이 하나의 목표 폭. 지구가 넓으면 베이가 늘어난다. */
const BAY_TARGET=520;
/** 나들목 램프다. 밑동은 간선 노면 위에서 간선과 나란히 출발하고, 평면은 3차 베지어
 * 한 줄로 돌아 고속도로와 나란해지며, 종단은 양 끝에 종단곡선을 둔 사다리꼴 경사다.
 * 꼭대기에서는 상판 가장자리를 따라가는 가감속 테이퍼가 폭을 좁히며 본선에 붙는다.
 * 값은 모두 절대 길이다. 도시가 작아 순환로 직선 구간이 모자라면 reach 를 줄이고
 * 대신 spread 를 늘려 경사를 지킨다(rampAlignment). */
export const RAMP=Object.freeze({
  width:ROAD_WIDTH.arterial*.7,
  /** 램프 중심선이 간선 중심선에서 옆으로 비킨 거리다. 바깥선이 간선 바깥선과 맞는다. */
  lateral:(ROAD_WIDTH.arterial-ROAD_WIDTH.arterial*.7)/2,
  /** 램프 꼭대기 중심선이 고속도로 중심선에서 떨어진 거리다. 안쪽선이 상판 가장자리에 닿는다. */
  beside:ROAD_WIDTH.highway/2+ROAD_WIDTH.arterial*.35,
  /** 나들목에서 램프 꼭대기까지 고속도로 방향 거리다. 직선 구간이 짧으면 줄어든다. */
  reach:190,minReach:104,
  /** 상판 가장자리를 따라가는 가감속 테이퍼 길이와 그 끝 폭이다. */
  merge:60,tipWidth:.9,
  /** 순환로 직선 구간 끝에서 남기는 여유다. 테이퍼가 모서리 호로 넘어가지 않게 막는다. */
  edge:16,
  /** 밑동이 고속도로 중심선에서 떨어진 거리다. 경사를 맞추려고 이 범위에서 고른다. */
  spread:96,maxSpread:360,
  /** 종단곡선 길이와 최대 종단 경사다. 경사는 8% 를 넘지 않게 잡는다. */
  ease:34,maxGrade:.078,
  /** 밑동에서 노면 높이 그대로 달리는 거리다. 간선 포장 위를 벗어난 뒤에 오르기
   * 시작해야 램프가 간선을 낮게 덮지 않는다. */
  hold:56,
  /** 밑동을 간선 노면보다 살짝 낮춰 겹치는 자리에서 면이 싸우지 않게 한다. */
  sink:.04,
  /** 평면 선형 표본 수다. 렌더는 품질에 따라 이 점들을 솎아 쓴다. */
  steps:20,mergeSteps:4,
});
/** 베지어 손잡이 길이 비율이다. 원호에 가까우면서 양 끝 접선이 도로와 정확히 맞는다. */
const RAMP_HANDLE=.58;

const cubicAt=(p0,c1,c2,p3,t)=>{
  const mt=1-t,a=mt*mt*mt,b=3*mt*mt*t,c=3*mt*t*t,e=t*t*t;
  return [a*p0[0]+b*c1[0]+c*c2[0]+e*p3[0],a*p0[1]+b*c1[1]+c*c2[1]+e*p3[1]];
};

/** 나들목 로컬 좌표(u=고속도로 방향, v=그 옆)의 평면 선형이다. 밑동에서는 접선이
 * v 축(간선)과, 꼭대기에서는 u 축(고속도로)과 정확히 나란하다. */
function rampCurve(spread,reach,steps){
  const p0=[RAMP.lateral,spread],p3=[reach,RAMP.beside];
  const c1=[RAMP.lateral,spread-RAMP_HANDLE*(spread-RAMP.beside)];
  const c2=[reach-RAMP_HANDLE*(reach-RAMP.lateral),RAMP.beside];
  const out=[];
  for(let i=0;i<=steps;i++)out.push(cubicAt(p0,c1,c2,p3,i/steps));
  return out;
}

const polyLength=(points)=>{
  let sum=0;
  for(let i=1;i<points.length;i++)sum+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  return sum;
};

/** 양 끝에 포물선 종단곡선을 둔 사다리꼴 경사다. 최대 경사는 가운데 등경사 구간의
 * grade 하나뿐이라 양 끝에서 턱이 지지 않는다. */
function rampHeight(along,length,rise,base,ease){
  const e=Math.min(ease,length/2),grade=rise/Math.max(1e-6,length-e);
  if(along<=e)return base+grade*along*along/(2*e);
  if(along>=length-e)return base+rise-grade*(length-along)*(length-along)/(2*e);
  return base+grade*(along-e/2);
}

/** 램프 하나의 3차원 폴리라인이다. 점은 [x, z, y, width, transverse?] 이고 선택적
 * transverse 는 roadRibbon 이 쓸 수평 [x,z] 단면 방향이다. 메시, 노면 표본,
 * 가드레일, 교각, 건물 제외 색인이 모두 이 한 배열을 읽는다.
 * d 는 고속도로 방향(±1), s 는 고속도로 어느 쪽에서 오르는지(±1), room 은 나들목에서
 * 순환로 직선 구간 끝까지 d 방향으로 남은 거리다. */
export function rampAlignment(node,d,s,room,deckY=HIGHWAY_DECK){
  const along=(u,v)=>node.axis==='ns'?[node.x+d*u,node.z+s*v]:[node.x+s*v,node.z+d*u];
  const reach=clamp(room-RAMP.merge-RAMP.edge,RAMP.minReach,RAMP.reach);
  const base=-.27-RAMP.sink,rise=deckY-base;
  // 경사를 지키는 가장 짧은 spread 를 고른다. 곡선 길이는 spread 에 대해 단조 증가다.
  const need=RAMP.hold+rise/RAMP.maxGrade+RAMP.ease;
  let low=RAMP.spread,high=RAMP.maxSpread;
  if(polyLength(rampCurve(high,reach,RAMP.steps))>need){
    for(let i=0;i<24;i++){
      const mid=(low+high)/2;
      if(polyLength(rampCurve(mid,reach,RAMP.steps))>=need)high=mid;else low=mid;
    }
  }
  const spread=high;
  const curve=rampCurve(spread,reach,RAMP.steps),length=polyLength(curve);
  const climb=Math.max(1,length-RAMP.hold);
  const points=[];
  let travelled=0;
  for(let i=0;i<curve.length;i++){
    if(i)travelled+=Math.hypot(curve[i][0]-curve[i-1][0],curve[i][1]-curve[i-1][1]);
    const [x,z]=along(curve[i][0],curve[i][1]);
    const y=travelled<=RAMP.hold?base:rampHeight(travelled-RAMP.hold,climb,rise,base,RAMP.ease);
    points.push([x,z,y,RAMP.width]);
  }
  // 가감속 테이퍼다. 안쪽선을 상판 가장자리에 붙인 채 폭만 줄여 본선에 스며든다.
  const deckHalf=ROAD_WIDTH.highway/2;
  const highwayTransverse=node.axis==='ns'?[0,d]:[-d,0];
  // 곡선의 마지막 단면부터 본선 법선에 고정해야 폭이 줄어도 안쪽선이 상판 경계를
  // 정확히 공유한다. 그 전 곡선 단면은 roadRibbon 의 miter 를 그대로 쓴다.
  points[points.length-1][4]=highwayTransverse;
  for(let i=1;i<=RAMP.mergeSteps;i++){
    const t=i/RAMP.mergeSteps,width=RAMP.width+(RAMP.tipWidth-RAMP.width)*t;
    const [x,z]=along(reach+RAMP.merge*t,deckHalf+width/2);
    points.push([x,z,deckY,width,highwayTransverse]);
  }
  const top=points[curve.length-1],end=points[points.length-1];
  // 테이퍼에서 본선 쪽을 가리키는 단위 벡터다. 렌더가 그쪽 난간을 비워 차가 합류한다.
  const inward=node.axis==='ns'?[0,-s]:[-s,0];
  return {
    points,kind:'ic',width:RAMP.width,spread,reach,length,inward,
    grade:rise/Math.max(1e-6,climb-Math.min(RAMP.ease,climb/2)),
    from:{x:points[0][0],z:points[0][1],y:points[0][2]},
    to:{x:top[0],z:top[1],y:top[2]},
    merge:{x:end[0],z:end[1],y:end[2]},
  };
}

/** 방사선 고가가 도시 끝에서 지면으로 내려오는 경사로다. 램프와 같은 종단곡선을 써서
 * 상판에서 노면까지 턱 없이 이어진다. axis 는 'z' 하나뿐이라 x 는 line 에 고정한다. */
export function portalAlignment(line,side,start,end,deckY=HIGHWAY_DECK,width=ROAD_WIDTH.highway,steps=12){
  const run=Math.abs(end-start),base=-.27,rise=deckY-base;
  const ease=Math.min(RAMP.ease,run*.18);
  const points=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,travelled=run*t;
    // start 가 상판, end 가 지면이라 높이는 거꾸로 읽는다.
    points.push([line,side*(start+(end-start)*t),rampHeight(run-travelled,run,rise,base,ease),width]);
  }
  const first=points[0],last=points[points.length-1];
  return {
    points,kind:'portal',width,length:run,grade:rise/Math.max(1e-6,run-ease),
    from:{x:first[0],z:first[1],y:first[2]},
    to:{x:last[0],z:last[1],y:last[2]},
  };
}
/** 방사선 고가가 도시 끝에서 지면으로 내려오는 경사로의 목표 길이다. JC 교차면에서
 * PORTAL_CLEAR 만큼 떨어진 뒤에 내려가기 시작한다. 방사선 끝은 늘리지 않는다.
 * 끝을 도시 밖으로 밀면 경사는 완만해지지만 지상 도로가 없는 자리에 내려앉는다. */
const PORTAL_RAMP=230, PORTAL_CLEAR=40;
/** 공항로가 외곽 순환로에 붙는 z 다. Ocean 의 둑 선반과 airportLayout 의 공항로가 같은 값을 쓴다. */
export const AIRPORT_ROAD_Z=30;
/** 공항로의 공항 쪽 끝이다. 공항 중심 기준 로컬 x 다. 터미널(로컬 x -65, 폭 26) 앞에서 끊어야
 * 포장이 건물 밑을 지나지 않는다. models/airportLayout.js 의 AIRPORT_ROAD 가 이 값을 읽는다. */
export const AIRPORT_ROAD_END=-84;
/** 공항 중심의 x 여유다. models/airportLayout.js 의 AIRPORT_OFFSET 과 같다. */
const AIRPORT_OFFSET=110;

/** 도시 사각형을 3열 3행으로 자르고 두 칸을 합쳐 크기가 다른 일곱 지구를 만든다. */
export const COLUMNS=[-.97,-.33,.33,.97], ROWS=[-.97,-.40,.25,.97];
const cell=(c0,r0,c1,r1)=>({
  x:(COLUMNS[c0]+COLUMNS[c1+1])/2,z:(ROWS[r0]+ROWS[r1+1])/2,
  rx:(COLUMNS[c1+1]-COLUMNS[c0])/2,rz:(ROWS[r1+1]-ROWS[r0])/2,
});

export const DISTRICT_TEMPLATES=Object.freeze([
  {id:'central',name:'센트럴',rotation:0,color:'#d8d2bf',density:'tower',...cell(1,1,1,1)},
  {id:'oldtown',name:'구시가지',rotation:.02,color:'#d4c3aa',density:'dense',...cell(0,1,0,1)},
  {id:'garden',name:'가든',rotation:-.025,color:'#bdcaa6',density:'open',...cell(2,2,2,2)},
  {id:'arts',name:'아트',rotation:.03,color:'#d7bfae',density:'dense',...cell(0,0,0,0)},
  {id:'harbor',name:'하버',rotation:-.012,color:'#b9c9c3',density:'mixed',...cell(1,0,2,0)},
  {id:'civic',name:'시빅',rotation:.008,color:'#d5d4c5',density:'open',...cell(0,2,1,2)},
  {id:'riverside',name:'리버사이드',rotation:-.02,color:'#c7d2b3',density:'mixed',...cell(2,1,2,1)},
]);

/** 지구마다 필지 등급을 섞는 순서가 다르다. 한 밴드는 한 등급만 쓴다.
 * 밴드 하나가 내는 건물 수가 등급마다 달라(챔피언 3, 대형 8, 일반 12 안팎)
 * 밴드 비율은 곧 공급 비율이다. 실제 티어 분포가 일반 78%, 대형 19%, 챔피언 3% 이므로
 * 그 비율을 맞춘다. 어긋나면 남는 등급이 땅만 먹고 모자란 등급이 도시를 키운다. */
const BAND_PATTERNS=Object.freeze({
  central:[LOT_CHAMPION,LOT_LARGE,LOT,LOT_LARGE,LOT,LOT],
  oldtown:[LOT,LOT,LOT_CHAMPION,LOT,LOT_LARGE,LOT],
  garden:[LOT,LOT_LARGE,LOT,LOT],
  arts:[LOT,LOT,LOT_LARGE,LOT,LOT],
  harbor:[LOT_LARGE,LOT,LOT,LOT_CHAMPION,LOT,LOT],
  civic:[LOT,LOT_LARGE,LOT,LOT_CHAMPION,LOT,LOT],
  riverside:[LOT_LARGE,LOT,LOT_CHAMPION,LOT,LOT],
});

export const MIN_EXTENT=1000, MAX_EXTENT=3600;

/** 필지와 골목이 먹는 넓이는 인원에 비례하므로 반쪽 폭은 제곱근을 따른다.
 * 상수항은 지구 테두리와 대로가 인원과 무관하게 먹는 몫이다. 계수는 실제 배치가
 * 성립하는 최소값 바로 아래로 잡아, 남은 차이는 성장 루프가 한두 걸음에 메우게 한다. */
export function cityExtentForCount(count){
  return Math.round(clamp(520+52*Math.sqrt(Math.max(0,Number(count)||0)),MIN_EXTENT,MAX_EXTENT));
}

/** districtBlocks 와 createUrbanPlan 은 순수 함수라 같은 입력이면 같은 결과다.
 * traffic 이 차량 한 대마다 매 프레임 plan 을 물어보므로 캐시가 없으면
 * 초당 수만 번 도시 그래프를 다시 만든다. 반환값을 고쳐 쓰는 호출자는 없어야 한다.
 */
const blockCache=new WeakMap(),planCache=new Map(),PLAN_CACHE_MAX=4;

/** 지구 하나의 직교 블록 격자다. 베이(세로 지선으로 나뉜 구획) 안에서
 * 등급별 밴드가 z 방향으로 쌓이고 남는 자투리는 비운다. */
export function districtBlocks(district){
  const cached=blockCache.get(district);
  if(cached)return cached;
  const built=buildDistrictBlocks(district);
  blockCache.set(district,built);
  return built;
}

function buildDistrictBlocks(district){
  const left=district.x-district.rx+EDGE,right=district.x+district.rx-EDGE;
  const bottom=district.z-district.rz+EDGE,top=district.z+district.rz-EDGE;
  const width=right-left,depth=top-bottom;
  const pattern=BAND_PATTERNS[district.id]||[LOT,LOT_LARGE,LOT];
  const maxPitch=Math.max(...pattern.map(blockPitch));
  // 두 칸을 합친 지구는 안쪽으로 여백 간선이 지난다. 그 선에서 격자를 갈라 간선 양옆에
  // EDGE 만큼 보도를 남긴다. 그래야 간선이 베이를 비스듬히 자르지 않는다.
  const spans=[];
  {
    let x0=left;
    if(Number.isFinite(district.extent))for(const column of [COLUMNS[1],COLUMNS[2]]){
      const line=column*district.extent;
      if(line<=x0+maxPitch||line>=right-maxPitch)continue;
      spans.push([x0,line-GUTTER/2-EDGE]);x0=line+GUTTER/2+EDGE;
    }
    spans.push([x0,right]);
  }
  // 베이 폭이 블록 간격의 배수에서 멀면 열마다 자투리가 남는다. 지면판의 10% 를 넘던
  // 낭비라 목표 폭에 가까운 값이 아니라 자투리가 가장 적은 개수를 고른다.
  const bays=[];
  for(const [spanLeft,spanRight] of spans){
    const spanWidth=spanRight-spanLeft;
    const leftover=(count)=>{
      const each=(spanWidth-(count-1)*LANE_GAP)/count;
      if(each<maxPitch)return Infinity;
      return count*pattern.reduce((sum,lot)=>{const pitch=blockPitch(lot);return sum+(each%pitch)*pitch;},0);
    };
    const prefer=Math.max(1,Math.min(4,Math.round(spanWidth/BAY_TARGET)));
    // 두 베이가 들어가는 구간에는 지선을 하나는 남긴다. 격자만 있고 도로가 없으면 도시로 안 읽힌다.
    const least=spanWidth>=5*maxPitch?2:1;
    let count=Math.max(prefer,least),best=Infinity;
    for(let candidate=least;candidate<=4;candidate++){
      // 같은 자투리면 목표 폭에 가까운 쪽을 쓴다. 지선이 하나는 남도록 편차에 작은 벌점을 준다.
      const value=leftover(candidate)+Math.abs(candidate-prefer)*spanWidth*2;
      if(value<best){best=value;count=candidate;}
    }
    const each=(spanWidth-(count-1)*LANE_GAP)/count;
    // lane 은 이 베이의 왼쪽 경계에 지선을 긋는지다. 구간의 첫 베이는 지구 가장자리나 간선에 붙는다.
    for(let bay=0;bay<count;bay++)bays.push({x0:spanLeft+bay*(each+LANE_GAP),width:each,lane:bay>0});
  }
  const bayCount=bays.length,bayWidth=bays[0].width;
  const bands=[],blocks=[];
  for(let index=0,z=bottom;;index++){
    // 다음 등급이 안 들어가도 더 작은 등급이 들어가면 계속 쌓는다. 지구 위쪽 자투리를 줄인다.
    let lot=pattern[index%pattern.length],pitch=blockPitch(lot),skips=0;
    const narrow=Math.min(...bays.map(bay=>bay.width));
    while((z+pitch>top||narrow<pitch)&&skips<pattern.length-1){
      skips++;lot=pattern[(index+skips)%pattern.length];pitch=blockPitch(lot);
    }
    if(z+pitch>top||narrow<pitch)break;
    const band={index,z0:z,lot,pitch,bays:[]};
    for(let bay=0;bay<bayCount;bay++){
      const columns=Math.floor(bays[bay].width/pitch),start=bays[bay].x0+(bays[bay].width-columns*pitch)/2;
      band.bays.push({x0:bays[bay].x0,start,columns});
      for(let column=0;column<columns;column++)blocks.push({
        x:start+pitch*(column+.5),z:z+pitch/2,lot,pitch,bay,column,band:index,empty:false,
      });
    }
    bands.push(band);
    z+=pitch;
  }
  // 모서리 자연지대에 중심이 걸린 블록은 아예 만들지 않는다. empty 로 두면 공원이나
  // 랜드마크 후보가 되어 산 속에 시청이 선다.
  const kept=Number.isFinite(district.extent)?blocks.filter(block=>!inNature(district.extent,block.x,block.z)):blocks;
  // 블록 몇 개를 통째로 비워 공원, 광장, 랜드마크 부지로 쓴다. 지구 id 로 고른다.
  if(kept.length>4){
    const holes=Math.max(3,Math.round(kept.length/11)),seed=hashText(district.id)%997;
    for(let i=0;i<holes;i++)kept[Math.floor((i+seed/997)*kept.length/holes)%kept.length].empty=true;
  }
  return {left,right,bottom,top,bayCount,bayWidth,bays,bands,blocks:kept,depth,width};
}

/** 빈 블록을 결정적으로 골라 공원, 광장, 랜드마크에 나눠 준다. */
function shareHoles(holes,count,used){
  const picked=[];
  for(let i=0;i<count&&used.size<holes.length;i++){
    const start=Math.min(holes.length-1,Math.floor((i+.5)*holes.length/count));
    for(let step=0;step<holes.length;step++){
      const probe=(start+step)%holes.length;
      if(used.has(probe))continue;
      used.add(probe);picked.push(holes[probe]);break;
    }
  }
  return picked;
}

export function createUrbanPlan(requestedExtent=1400){
  const extent=clamp(Math.round(requestedExtent),MIN_EXTENT,MAX_EXTENT);
  const hit=planCache.get(extent);
  if(hit)return hit;
  const plan=buildUrbanPlan(extent);
  if(planCache.size>=PLAN_CACHE_MAX)planCache.delete(planCache.keys().next().value);
  planCache.set(extent,plan);
  return plan;
}

/** 두 선분이 안쪽에서 만나는 점이다. 끝점끼리 닿는 것은 교차로 치지 않는다. */
function crossPoint(a,b,margin=.01){
  const rx=a.x2-a.x1,rz=a.z2-a.z1,sx=b.x2-b.x1,sz=b.z2-b.z1;
  const den=rx*sz-rz*sx;
  if(Math.abs(den)<1e-9)return null;
  const qx=b.x1-a.x1,qz=b.z1-a.z1;
  const t=(qx*sz-qz*sx)/den,u=(qx*rz-qz*rx)/den;
  if(t<margin||t>1-margin||u<margin||u>1-margin)return null;
  return {t,u,x:a.x1+rx*t,z:a.z1+rz*t};
}

/** 선분이 원이나 축 정렬 사각형 안에 드는 t 구간이다. 안 걸리면 null 이다. */
function holeSpan(road,hole){
  const dx=road.x2-road.x1,dz=road.z2-road.z1;
  if(hole.r!==undefined){
    const fx=road.x1-hole.x,fz=road.z1-hole.z,a=dx*dx+dz*dz,b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-hole.r*hole.r;
    const disc=b*b-4*a*c;
    if(!a||disc<=0)return null;
    const root=Math.sqrt(disc),t0=(-b-root)/(2*a),t1=(-b+root)/(2*a);
    return t1<=0||t0>=1?null:[Math.max(0,t0),Math.min(1,t1)];
  }
  let t0=0,t1=1;
  for(const [p,d,lo,hi] of [[road.x1,dx,hole.x-hole.hx,hole.x+hole.hx],[road.z1,dz,hole.z-hole.hz,hole.z+hole.hz]]){
    if(Math.abs(d)<1e-9){if(p<=lo||p>=hi)return null;continue;}
    const a=(lo-p)/d,b=(hi-p)/d;
    t0=Math.max(t0,Math.min(a,b));t1=Math.min(t1,Math.max(a,b));
    if(t0>=t1)return null;
  }
  return [t0,t1];
}

/** 선분에서 구멍(원 { x, z, r } 또는 사각형 { x, z, hx, hz }) 안에 드는 부분을 걷어낸 조각들이다.
 * minLength 보다 짧게 남는 토막은 버린다. 막다른 길 표시는 원래 끝점이 남은 조각만 갖는다. */
export function clipRoad(road,holes,minLength=6){
  const cuts=holes.map(hole=>holeSpan(road,hole)).filter(Boolean).sort((a,b)=>a[0]-b[0]);
  if(!cuts.length)return [road];
  const keep=[];let from=0;
  for(const [t0,t1] of cuts){if(t0>from)keep.push([from,t0]);from=Math.max(from,t1);}
  if(from<1)keep.push([from,1]);
  const dx=road.x2-road.x1,dz=road.z2-road.z1;
  return keep.filter(([t0,t1])=>(t1-t0)*road.length>=minLength).map(([t0,t1],index)=>{
    const {deadEnd,...rest}=road;
    return {...rest,...(deadEnd&&t1===1?{deadEnd}:{}),id:index?`${road.id}-${index}`:road.id,
      ...(t0>0?{deadEndIn:'constraint'}:{}),...(t1<1?{deadEndOut:'constraint'}:{}),
      x1:road.x1+dx*t0,z1:road.z1+dz*t0,x2:road.x1+dx*t1,z2:road.z1+dz*t1,length:road.length*(t1-t0)};
  });
}

/** 모서리 점을 중심으로 한 호의 안쪽 점들이다. 시작과 끝은 호출자가 이미 갖고 있다. */
function arcInside(cx,cz,r,from,to,steps){
  const a0=Math.atan2(from[1]-cz,from[0]-cx),a1=Math.atan2(to[1]-cz,to[0]-cx);
  const sweep=wrapAngle(a1-a0),out=[];
  for(let i=1;i<steps;i++){const a=a0+sweep*i/steps;out.push([cx+r*Math.cos(a),cz+r*Math.sin(a)]);}
  return out;
}

/** 경로의 점 목록에 다른 경로와의 교차점을 끼워 넣는다. 차량이 교차로에서 방위를
 * 섞고 렌더러가 교차로 도색을 비울 수 있게 한다. */
function withCrossings(points,others,minGap=2){
  const out=[points[0]];
  for(let i=1;i<points.length;i++){
    const a={x1:points[i-1][0],z1:points[i-1][1],x2:points[i][0],z2:points[i][1]};
    const hits=[];
    for(const other of others){
      const hit=crossPoint(a,other);
      if(hit)hits.push(hit);
    }
    hits.sort((p,q)=>p.t-q.t);
    for(const hit of hits){
      const last=out[out.length-1];
      if(Math.hypot(hit.x-last[0],hit.z-last[1])<minGap)continue;
      if(Math.hypot(hit.x-points[i][0],hit.z-points[i][1])<minGap)continue;
      out.push([hit.x,hit.z]);
    }
    out.push(points[i]);
  }
  return out;
}

function buildUrbanPlan(extent){
  const e=extent;
  const C=COLUMNS.map(v=>v*e),R=ROWS.map(v=>v*e);
  // districtBlocks 가 자연지대를 걸러야 하므로 지구가 제 extent 를 들고 다닌다.
  const districts=DISTRICT_TEMPLATES.map(d=>({...d,shape:'rect',extent:e,x:d.x*e,z:d.z*e,
    rx:Math.max(80,d.rx*e-GUTTER/2),rz:Math.max(80,d.rz*e-GUTTER/2)}));
  const grids=new Map(districts.map(d=>[d.id,districtBlocks(d)]));
  const nodes=cityNodes(e),hills=cityHills(e),nature=natureCorners(e);
  const streams=riverStreams(e);
  // 산 덩이는 반지름 r 까지 그려지므로 도로 가장자리가 그 안에 들어오면 안 된다.
  const hillHoles=(width)=>hills.map(hill=>({x:hill.x,z:hill.z,r:hill.r+width/2+2}));

  const roads=[];
  const addPath=(points,kind,id,extra={})=>{const segs=path(points,kind,{id,...extra});roads.push(...segs);return segs;};
  // 작은 도시에서는 동쪽 공항의 레이더·연료 시설이 e*.96 안쪽까지 들어온다.
  // 순환로를 최소 70 안쪽에 두되 큰 도시의 기존 비율은 그대로 유지한다.
  const border=Math.min(e*.96,e-70),HX=e*LOOP_HALF_RATIO;
  // 강변도로 띠(river.js 의 RIVER_ROAD) 한가운데를 지나는 강변 집산로의 z 다.
  const riverRoadZ=(x,side)=>riverCenter(e,x)+side*(riverHalf(e,x)+riverParkWidth(e,x,side)
    +e*(side<0?RIVER_ROAD.north:RIVER_ROAD.south)/2);

  // 외곽 순환로다. 네 모서리는 자연지대 경계 바로 바깥의 오목한 호로 돈다. 직선과
  // 오목 호는 직각으로 만나므로 사이에 볼록 fillet 을 넣어 반전 곡선으로 잇는다.
  const corner=NATURE_CORNER*e,arcR=NATURE_ARC_RADIUS*e,fillet=e*.08;
  // fillet 원은 가장자리 직선에 접하고 오목 호 원과 바깥에서 접한다. k 는 직선이 끝나는 자리다.
  const k=corner-Math.sqrt((arcR+fillet)**2-(fillet+corner-border)**2);
  const ringCorner=(sx,sz)=>{
    const cn=[sx*corner,sz*corner],p1=[sx*k,sz*border],f1=[sx*k,sz*(border-fillet)];
    const t1=[cn[0]+(f1[0]-cn[0])*arcR/(arcR+fillet),cn[1]+(f1[1]-cn[1])*arcR/(arcR+fillet)];
    // 모서리에서 도심으로 향하는 대각선에 대해 거울상을 만들면 반대쪽 fillet 이 나온다.
    const dx=-sx/Math.SQRT2,dz=-sz/Math.SQRT2;
    const mirror=([x,z])=>{const u=x-cn[0],v=z-cn[1],d=2*(u*dx+v*dz);return [cn[0]+d*dx-u,cn[1]+d*dz-v];};
    const p2=mirror(p1),f2=mirror(f1),t2=mirror(t1);
    const points=[p1,...arcInside(f1[0],f1[1],fillet,p1,t1,4),t1,...arcInside(cn[0],cn[1],arcR,t1,t2,6),t2,
      ...arcInside(f2[0],f2[1],fillet,t2,p2,4),p2];
    // 북동과 남서는 가로변에서 세로변으로, 남동과 북서는 그 반대로 지난다.
    return sx*sz<0?points:points.reverse();
  };
  const sideStops=(values)=>[...values].filter(v=>Math.abs(v)<k-1).sort((a,b)=>a-b);
  const northX=sideStops([C[1],C[2]]),eastZ=sideStops([R[1],riverRoadZ(border,-1),riverRoadZ(border,1),AIRPORT_ROAD_Z]);
  const southX=sideStops([C[1],C[2]]).reverse(),westZ=sideStops([R[1],riverRoadZ(-border,-1),riverRoadZ(-border,1)]).reverse();
  const ringPoints=[[-k,-border],...northX.map(x=>[x,-border]),...ringCorner(1,-1),
    ...eastZ.map(z=>[border,z]),...ringCorner(1,1),
    ...southX.map(x=>[x,border]),...ringCorner(-1,1),
    ...westZ.map(z=>[-border,z]),...ringCorner(-1,-1)];
  const ringSegs=addPath(ringPoints,'collector','ring');
  for(const seg of ringSegs){
    const mx=(seg.x1+seg.x2)/2,mz=(seg.z1+seg.z2)/2;
    seg.arc=Math.abs(Math.abs(mx)-border)>1&&Math.abs(Math.abs(mz)-border)>1;
  }

  // 여백 간선 셋이다. 남북 둘은 순환 고속도로, 동서 간선, 강변 집산로와 만나는 z 에서
  // 잘라 교차로를 만들고, 동서 하나는 남북 간선과 고속도로에서 자른다.
  const arterialStops=[];
  for(const [index,x] of [C[1],C[2]].entries()){
    // 순환로와 같은 중심선 점에서 끝내 실제 교차로 노드를 공유한다.
    const zs=[-border,-HX,R[1],riverRoadZ(x,-1),riverRoadZ(x,1),HX,border].sort((a,b)=>a-b);
    addPath(zs.map(z=>[x,z]),'arterial',`art-ns-${index}`);
    arterialStops.push(...zs.slice(1,-1).map(z=>[x,z]));
  }
  {
    const xs=[-border,-HX,C[1],C[2],HX,border];
    addPath(xs.map(x=>[x,R[1]]),'arterial','art-ew-0');
    arterialStops.push(...xs.slice(1,-1).map(x=>[x,R[1]]));
  }
  // 간선 안쪽 점은 전부 교차로다. 도색을 비우고 횡단보도를 놓게 join 을 끝처럼 둔다.
  const crossingKey=(x,z)=>`${Math.round(x)}:${Math.round(z)}`;
  const crossings=new Set(arterialStops.map(([x,z])=>crossingKey(x,z)));
  for(const [x,z] of [...northX.map(x=>[x,-border]),...southX.map(x=>[x,border]),
    ...eastZ.map(z=>[border,z]),...westZ.map(z=>[-border,z])])crossings.add(crossingKey(x,z));
  for(const seg of roads){
    if(seg.kind!=='arterial'&&seg.path!=='ring')continue;
    if(crossings.has(crossingKey(seg.x1,seg.z1)))seg.joinIn=null;
    if(crossings.has(crossingKey(seg.x2,seg.z2)))seg.joinOut=null;
  }

  // 강변 집산로 한 쌍이다. 강변 공원 바깥 강변도로 띠를 따라 순환로에서 순환로까지 간다.
  const RIVER_STEP=e*.05;
  for(const side of [-1,1]){
    const pts=[];
    for(let x=-border;x<border-1;x+=RIVER_STEP)pts.push([x,riverRoadZ(x,side)]);
    pts.push([border,riverRoadZ(border,side)]);
    addPath(pts,'collector',side<0?'river-north':'river-south');
  }

  // 공항로다. 동쪽 순환로에 T 자로 붙어 둑을 건너 터미널 앞까지 간다. 서쪽은 해변과
  // 강 하구가 막고 있어 도로를 두지 않는다.
  addPath([[border,AIRPORT_ROAD_Z],[e+AIRPORT_OFFSET+AIRPORT_ROAD_END,AIRPORT_ROAD_Z]],'collector','airport-road-east');

  for(const d of districts){
    const grid=grids.get(d.id);
    const safeLaneX=(raw,z0,z1)=>{
      let x=raw;
      for(const stream of streams){
        if(Math.max(z0,z1)<Math.min(stream.z1,stream.z2)||Math.min(z0,z1)>Math.max(stream.z1,stream.z2))continue;
        const clearance=stream.width/2+ROAD_WIDTH.lane/2+.1,distance=x-stream.x;
        if(Math.abs(distance)>=clearance)continue;
        const shifted=stream.x+(distance<=0?-clearance:clearance);
        const room=(LANE_GAP-ROAD_WIDTH.lane)/2;
        x=clamp(shifted,raw-room,raw+room);
      }
      return x;
    };
    const laneXs=grid.bays.map((bay,index)=>index?safeLaneX(bay.x0-LANE_GAP/2,grid.bottom-(EDGE+7),grid.top+(EDGE+7)):null);
    // 베이 사이 지선이다. 양 끝을 EDGE 만큼 더 늘려 여백 간선 가장자리나 순환로에 닿게 한다.
    // 자연지대나 물에 들어가는 쪽 끝은 그 경계에서 자른다.
    for(let bay=1;bay<grid.bayCount;bay++){
      if(!grid.bays[bay].lane)continue;
      const x=laneXs[bay];
      let z0=grid.bottom-(EDGE+7),z1=grid.top+(EDGE+7);
      const wet=(z)=>inWaterBody(e,x-ROAD_WIDTH.lane/2,z)||inWaterBody(e,x+ROAD_WIDTH.lane/2,z)||inNature(e,x,z);
      while(z0<z1&&wet(z0))z0+=8;
      while(z1>z0&&wet(z1))z1-=8;
      if(z1-z0<40)continue;
      // 산을 지나면 둘로 끊는다. 조각마다 경로 id 를 달리해야 차량이 산을 건너뛰지 않는다.
      const lane=segment([x,z0],[x,z1],'lane');
      clipRoad(lane,hillHoles(ROAD_WIDTH.lane),40).forEach((piece,index)=>
        addPath([[piece.x1,piece.z1],[piece.x2,piece.z2]],'lane',`${d.id}-lane-${bay}${index?`-${index}`:''}`,{district:d.id}));
    }
    // 띠 경계 골목은 베이의 남는 폭과 지선 통로의 중심까지 이어진다. 필지에서 4 떨어진
    // 예전 끝점은 골목 반폭 3 과 1 만큼 벌어져 보였고 그래프도 끊겼다.
    const addAlleyRow=(band,z,suffix=band.index)=>{
      for(let bay=0;bay<grid.bayCount;bay++){
        const slot=band.bays[bay];
        for(let column=0;column<slot.columns;column++){
          const x0=column?slot.start+band.pitch*column:(bay?laneXs[bay]:slot.x0);
          const x1=column===slot.columns-1?(bay<grid.bayCount-1?laneXs[bay+1]:slot.x0+grid.bays[bay].width)
            : slot.start+band.pitch*(column+1);
          if(crossesWater(e,x0,z,x1,z,ROAD_WIDTH.alley)||inNature(e,(x0+x1)/2,z))continue;
          roads.push(segment([x0,z],[x1,z],'alley',{district:d.id,id:`${d.id}-alley-${suffix}-${bay}-${column}`}));
        }
      }
    };
    for(const band of grid.bands){
      addAlleyRow(band,band.z0);
      // 블록 열 사이 세로 샛길이다. 띠마다 블록 간격이 달라 한 띠 안에서만 긋는다.
      for(let bay=0;bay<grid.bayCount;bay++){
        const slot=band.bays[bay];
        for(let column=1;column<slot.columns;column++){
          const x=slot.start+band.pitch*column,z0=band.z0;
          // 강 대역이 골목 성격을 가른다. 구시가지·재래 상가는 막다른 길 없이 촘촘히 뚫고
          // 아파트 단지는 막다른 길을 늘려 단지 내부 도로처럼 성기게 남긴다.
          const zone=riverZoneAt(e,x,band.z0+band.pitch/2);
          const dense=zone&&(zone.key==='oldtown'||zone.key==='nshop');
          const sparse=zone&&zone.key==='apt';
          const rawDead=(band.index*3+bay*2+column)%5===2;
          const dead=dense?false:sparse?(rawDead||(band.index+column)%2===0):rawDead;
          const z1=band.z0+band.pitch*(dead?.55:1);
          if(crossesWater(e,x,z0,x,z1,ROAD_WIDTH.alley)||inNature(e,x,(z0+z1)/2))continue;
          roads.push(segment([x,z0],[x,z1],'alley',
            {district:d.id,id:`${d.id}-cross-${band.index}-${bay}-${column}`,...(dead?{deadEnd:true}:{})}));
        }
      }
    }
    const lastBand=grid.bands[grid.bands.length-1];
    if(lastBand)addAlleyRow(lastBand,lastBand.z0+lastBand.pitch,'top');
    // 2x2 로 묶인 블록은 안에 필지 네 개가 붙어 있다. 그 사이를 실제 골목으로 갈라야
    // 위에서 봤을 때 건물 덩어리 사이가 빈 포장으로 뭉개지지 않는다. 챔피언 블록은
    // 필지가 하나뿐이라 대상이 아니다. 아파트 단지 대역은 세로 진입로 하나만 남긴다.
    for(const block of grid.blocks){
      if(block.empty||lotsPerBlock(block.lot)<2)continue;
      const half=block.pitch/2;
      if(half<=0)continue;
      const zone=riverZoneAt(e,block.x,block.z),apt=zone&&zone.key==='apt';
      if(!crossesWater(e,block.x,block.z-half,block.x,block.z+half,ROAD_WIDTH.alley))
        roads.push(segment([block.x,block.z-half],[block.x,block.z+half],'alley',
          {district:d.id,id:`${d.id}-inner-v-${block.band}-${block.bay}-${block.column}`,
            deadEndIn:'courtyard-access',deadEndOut:'courtyard-access'}));
      if(!apt&&!crossesWater(e,block.x-half,block.z,block.x+half,block.z,ROAD_WIDTH.alley))
        roads.push(segment([block.x-half,block.z],[block.x+half,block.z],'alley',
          {district:d.id,id:`${d.id}-inner-h-${block.band}-${block.bay}-${block.column}`,
            deadEndIn:'courtyard-access',deadEndOut:'courtyard-access'}));
    }
    // 블록 격자 양옆의 예약 여백을 지구 진입 지선으로 쓴다. 모든 띠 경계 골목이 이
    // 중심선에 실제로 닿으므로 작은 도시에서도 lane 등급이 사라지지 않는다.
    const rowStops=[...new Set(grid.bands.flatMap(band=>[band.z0,band.z0+band.pitch]))].sort((a,b)=>a-b);
    for(const [side,x] of [['west',grid.left],['east',grid.right]])for(let index=1;index<rowStops.length;index++){
      const z0=rowStops[index-1],z1=rowStops[index],mid=(z0+z1)/2;
      if(crossesWater(e,x,z0,x,z1,ROAD_WIDTH.lane)||inNature(e,x,z0)||inNature(e,x,mid)||inNature(e,x,z1))continue;
      const lane=segment([x,z0],[x,z1],'lane',{district:d.id,id:`${d.id}-boundary-${side}-${index-1}`});
      const duplicates=roads.some(road=>{
        if(road.elevated||road.tunnel||road.kind==='alley')return false;
        const turn=Math.abs(wrapAngle(lane.angle-road.angle));
        if(Math.min(turn,Math.abs(Math.PI-turn))>.05)return false;
        const dx=road.x2-road.x1,dz=road.z2-road.z1,len=dx*dx+dz*dz||1;
        const distance=([px,pz])=>{
          const t=clamp(((px-road.x1)*dx+(pz-road.z1)*dz)/len,0,1);
          return Math.hypot(px-(road.x1+dx*t),pz-(road.z1+dz*t));
        };
        return Math.max(distance([lane.x1,lane.z1]),distance([lane.x2,lane.z2]))
          <(ROAD_WIDTH.lane+(ROAD_WIDTH[road.kind]||8))/2;
      });
      if(duplicates)continue;
      clipRoad(lane,hillHoles(ROAD_WIDTH.lane),20).forEach((piece,pieceIndex)=>roads.push({
        ...piece,id:pieceIndex?`${lane.id}-${pieceIndex}`:lane.id,path:pieceIndex?`${lane.id}-${pieceIndex}`:lane.id,
      }));
    }
  }

  // 고속도로는 도시를 한 바퀴 도는 고가 순환로다. path 를 주지 않아 AI 차량 경로에서 빠진다.
  const loopPoints=highwayLoop(e);
  const highwayRoutes=[{id:'highway-loop',kind:'highway',elevated:true,deckY:HIGHWAY_DECK,
    points:loopPoints.map(point=>[point[0],point[1]])}];
  const highwayLoopRoads=[];
  for(let i=1;i<loopPoints.length;i++){
    const road=segment(loopPoints[i-1],loopPoints[i],'highway',{elevated:true,deckY:HIGHWAY_DECK,id:`highway-${i}`});
    highwayLoopRoads.push(road);roads.push(road);
  }
  for(let index=0;index<highwayLoopRoads.length;index++){
    const previous=highwayLoopRoads[(index-1+highwayLoopRoads.length)%highwayLoopRoads.length];
    const road=highwayLoopRoads[index],next=highwayLoopRoads[(index+1)%highwayLoopRoads.length];
    road.capStart=ROAD_WIDTH.highway/2*Math.tan(Math.abs(wrapAngle(road.angle-previous.angle))/2);
    road.capEnd=ROAD_WIDTH.highway/2*Math.tan(Math.abs(wrapAngle(next.angle-road.angle))/2);
  }
  // 남북 방사선 하나다. 실제 굴착 지형이 없으므로 도심과 강도 한 단 높은 고가로
  // 연속해서 지난다. 지상에 복개 상자를 얹어 터널처럼 보이게 하지 않는다.
  const radialDeck=HIGHWAY_DECK;
  const tunnels=[],ramps=[];
  // 방사선 고가는 양 끝이 허공에서 잘리면 안 된다. JC 교차면을 지난 뒤부터 지면까지
  // 내려오는 포탈 경사로를 달아 지상 도로망에 닿게 한다.
  for(const radial of highwayRadials(e)){
    const [,,south]=radial.points,minDeck=e*LOOP_HALF_RATIO+PORTAL_CLEAR;
    const tip=Math.abs(south[1]),deckEnd=Math.max(minDeck,tip-PORTAL_RAMP);
    roads.push(segment([0,-deckEnd],[0,deckEnd],'highway',
      {elevated:true,deckY:radialDeck,id:radial.id,capStart:0,capEnd:0}));
    for(const side of [-1,1])ramps.push(portalAlignment(0,side,deckEnd,tip,radialDeck));
  }

  // 나들목은 간선이 순환 고속도로를 넘는 여섯 자리, 분기점은 방사선이 넘는 두 자리다.
  // 다이아몬드형이라 램프 넷이 고속도로와 나란히 간선 가장자리에서 상판 옆까지 오른다.
  // 램프는 상판 가장자리를 따라 테이퍼로 붙으므로 순환로 직선 구간 안에 들어가야 한다.
  const straightHalf=highwayStraightHalf(e);
  const interchanges=buildInterchanges(e,{ns:[C[1],C[2]],ew:[R[1]],jc:[0]}).map(node=>{
    if(node.kind!=='IC')return {...node,ramps:[]};
    const list=[];
    // u 는 고속도로 방향, v 는 그 옆이다. 남북 간선이면 고속도로가 동서로 달린다.
    const at=node.axis==='ns'?node.x:node.z;
    for(const d of [-1,1])for(const s of [-1,1])
      list.push(rampAlignment(node,d,s,straightHalf-d*at,HIGHWAY_DECK));
    return {...node,ramps:list};
  });
  for(const node of interchanges)ramps.push(...node.ramps);
  // 고가 난간은 합류 테이퍼와 JC 교차면에서 끊는다. 구간상의 0..1 비율로 저장해
  // 렌더러가 긴 난간을 열린 조각들로 나눌 수 있게 한다.
  const elevated=roads.filter(road=>road.elevated);
  const projection=(road,point)=>{
    const dx=road.x2-road.x1,dz=road.z2-road.z1,lenSq=dx*dx+dz*dz;
    const t=lenSq?Math.max(0,Math.min(1,((point.x-road.x1)*dx+(point.z-road.z1)*dz)/lenSq)):0;
    return {t,x:road.x1+dx*t,z:road.z1+dz*t,distance:Math.hypot(point.x-(road.x1+dx*t),point.z-(road.z1+dz*t))};
  };
  const openRail=(road,side,from,to)=>{(road.railOpenings??=[]).push({side,from:Math.min(from,to),to:Math.max(from,to)});};
  for(const node of interchanges){
    if(node.kind==='IC')for(const ramp of node.ramps){
      const road=elevated.slice().sort((a,b)=>projection(a,ramp.merge).distance-projection(b,ramp.merge).distance)[0];
      const top=projection(road,ramp.to),mergePoint=projection(road,ramp.merge);
      const dx=road.x2-road.x1,dz=road.z2-road.z1,length=Math.hypot(dx,dz),px=-dz/length,pz=dx/length;
      const side=(ramp.to.x-top.x)*px+(ramp.to.z-top.z)*pz>=0?1:-1;
      const margin=RAMP.width/length;
      openRail(road,side,top.t-margin,mergePoint.t+margin);
    }else{
      for(const road of elevated){
        const at=projection(road,node);if(at.distance>1)continue;
        const half=(ROAD_WIDTH.highway*.65)/Math.hypot(road.x2-road.x1,road.z2-road.z1);
        for(const side of [-1,1])openRail(road,side,at.t-half,at.t+half);
      }
    }
  }
  // 로터리는 간선끼리 만나는 두 자리다.
  const roundabouts=[C[1],C[2]].map(x=>({x,z:R[1],r:44}));
  const overpasses=[];

  // 강은 하나다. 모든 소비자가 shared/river.js 한 곳을 읽는다. 중심선이 굽어 있으므로
  // 미니맵과 렌더도 같은 표본을 쓴다.
  const riverLine=riverSamples(e,64);
  // 교량은 실제로 도로가 강을 건너는 자리에서 뽑는다. 중심선이 곡선이라 선분을 잘라
  // 부호가 바뀌는 자리를 찾는다.
  const BRIDGE_MERGE=40, CROSS_STEPS=32;
  const crossingsAtRiver=[];
  /** 도로가 강폭 안에 들어와 있는 구간의 가운데 x 다. 강을 따라 달리는 강변도로까지
   * 다리로 만들면 안 되므로, 젖은 구간이 그 자리 강폭의 네 배를 넘으면 건너는 것이 아니라고 본다. */
  const wetCrossing=(span,road)=>{
    let first=-1,last=-1;
    for(let step=0;step<=CROSS_STEPS;step++){
      const t=step/CROSS_STEPS;
      const sx=road.x1+(road.x2-road.x1)*t, sz=road.z1+(road.z2-road.z1)*t;
      if(!inWaterBody(span,sx,sz))continue;
      if(first<0)first=step;
      last=step;
    }
    if(first<0)return null;
    const length=Math.hypot(road.x2-road.x1,road.z2-road.z1);
    const wet=length*(last-first+1)/CROSS_STEPS;
    const mid=(first+last)/2/CROSS_STEPS;
    const mx=road.x1+(road.x2-road.x1)*mid;
    const mz=road.z1+(road.z2-road.z1)*mid;
    return wet>riverHalf(span,mx)*4?null:{x:mx,z:mz};
  };
  for(const road of roads){
    if(road.elevated||road.tunnel||road.kind==='alley')continue;
    let crossing=null;
    let previous=road.z1-riverCenter(e,road.x1);
    for(let step=1;step<=CROSS_STEPS;step++){
      const t=step/CROSS_STEPS;
      const sx=road.x1+(road.x2-road.x1)*t, sz=road.z1+(road.z2-road.z1)*t;
      const current=sz-riverCenter(e,sx);
      if(previous===0||previous*current<0){
        let lo=(step-1)/CROSS_STEPS,hi=t;
        for(let iteration=0;iteration<32;iteration++){
          const mid=(lo+hi)/2,mx=road.x1+(road.x2-road.x1)*mid,mz=road.z1+(road.z2-road.z1)*mid;
          const value=mz-riverCenter(e,mx);
          if(previous*value<=0)hi=mid;else lo=mid;
        }
        const at=(lo+hi)/2;
        crossing={x:road.x1+(road.x2-road.x1)*at,z:road.z1+(road.z2-road.z1)*at};
        break;
      }
      previous=current;
    }
    // 중심선을 넘지 않고 강폭 안으로만 들어왔다 나가는 도로도 물 위를 지난다.
    // 젖은 구간이 지천 폭 정도로 짧으면 지천교가 맡으므로 강 교량은 세우지 않는다.
    if(crossing===null){
      const wetPoint=wetCrossing(e,road);
      if(wetPoint!==null&&inRiverPark(e,wetPoint.x,riverCenter(e,wetPoint.x)+riverHalf(e,wetPoint.x)+1)
        &&!streams.some(s=>Math.abs(s.x-wetPoint.x)<s.width))crossing=wetPoint;
    }
    if(crossing===null||!Number.isFinite(crossing.x)||Math.abs(crossing.x)>e)continue;
    const near=crossingsAtRiver.find(entry=>Math.abs(entry.x-crossing.x)<BRIDGE_MERGE);
    if(near){
      // 가까운 두 도로를 한 다리로 합칠 때는 두 자리를 모두 덮도록 상판을 넓힌다.
      near.min=Math.min(near.min,crossing.x);near.max=Math.max(near.max,crossing.x);
      const width=ROAD_WIDTH[road.kind]||8;
      if(width>near.width){near.width=width;near.x=crossing.x;near.z=crossing.z;near.road=road;}
      continue;
    }
    crossingsAtRiver.push({x:crossing.x,z:crossing.z,min:crossing.x,max:crossing.x,
      width:ROAD_WIDTH[road.kind]||8,kind:road.kind,road});
  }
  crossingsAtRiver.sort((a,b)=>a.x-b.x);
  // 간선 교량 두 곳을 사장교로 세운다. 나머지는 거더교다.
  const widest=[...crossingsAtRiver].sort((a,b)=>b.width-a.width||a.x-b.x).slice(0,2);
  const bridgeFromRoad=(road,x,z,length,extra={})=>{
    const dx=road.x2-road.x1,dz=road.z2-road.z1,run=Math.hypot(dx,dz)||1;
    const ux=dx/run,uz=dz/run;
    return {x,z,x1:x-ux*length/2,z1:z-uz*length/2,x2:x+ux*length/2,z2:z+uz*length/2,
      axis:Math.abs(ux)>=Math.abs(uz)?'x':'z',length,...extra};
  };
  const bridges=crossingsAtRiver.map((entry,index)=>{
    const run=Math.hypot(entry.road.x2-entry.road.x1,entry.road.z2-entry.road.z1)||1;
    const alongZ=Math.max(.2,Math.abs(entry.road.z2-entry.road.z1)/run);
    const length=(riverHalf(e,entry.x)*2+70)/alongZ;
    return bridgeFromRoad(entry.road,entry.x,entry.z,length,{axis:'z',
      width:Math.max(26,entry.width+10,entry.max-entry.min+entry.width+10),
      big:widest.includes(entry),ko:`${index+1}번 교량`,sourceRoad:entry.road.id||entry.road.path,
      _sourceRoad:entry.road,
    });
  });
  // 지천교다. 지천을 가로지르는 지상 도로마다 지천 폭에 맞춘 짧은 거더교를 놓는다.
  // 상판이 x 방향으로 뻗으므로 axis 가 'x' 다.
  for(const stream of streams){
    const zLo=Math.min(stream.z1,stream.z2),zHi=Math.max(stream.z1,stream.z2);
    for(const road of roads){
      if(road.elevated||road.tunnel||road.kind==='alley')continue;
      const lo=Math.min(road.x1,road.x2),hi=Math.max(road.x1,road.x2);
      // 지천 x 가 두 도로 조각의 공유 꼭짓점과 같아도 하나의 실제 횡단이다.
      if(lo>stream.x+1e-6||hi<stream.x-1e-6||hi-lo<stream.width)continue;
      const t=(stream.x-road.x1)/(road.x2-road.x1),z=road.z1+(road.z2-road.z1)*t;
      if(z<zLo||z>zHi||inRiver(e,stream.x,z))continue;
      if(bridges.some(b=>b.axis==='x'&&Math.abs(b.x-stream.x)<1&&Math.abs(b.z-z)<(ROAD_WIDTH[road.kind]||8)))continue;
      bridges.push(bridgeFromRoad(road,stream.x,z,stream.width+40,{axis:'x',width:(ROAD_WIDTH[road.kind]||8)+6,
        big:false,ko:`${stream.id} 지천교`,sourceRoad:road.id||road.path,_sourceRoad:road}));
    }
  }

  // 램프 중심선은 렌더·노면·교각·필지 예약이 함께 쓰는 단일 폴리라인이다.
  const rampSegments=ramps.flatMap(ramp=>{
    const kind=ramp.kind==='portal'?'highway':'collector';
    const line=ramp.points||[[ramp.from.x,ramp.from.z],[ramp.to.x,ramp.to.z]];
    return line.slice(1).map((point,index)=>({...segment([line[index][0],line[index][1]],[point[0],point[1]],kind),id:'ramp'}));
  });

  const holes=[];
  for(const d of districts)for(const block of grids.get(d.id).blocks)if(block.empty)holes.push({...block,district:d.id});
  // 빈 블록은 격자가 고른 것이라 강을 모른다. 물과 강변 공원에 걸치는 블록을 빼야
  // 시청이 강 위에 서지 않는다. 블록 한 변이 150 을 넘으므로 네 귀퉁이까지 본다.
  const onLand=(block)=>{
    const reach=block.pitch/2;
    return ![[0,0],[-reach,-reach],[reach,-reach],[-reach,reach],[reach,reach]]
      .some(([dx,dz])=>inWaterBody(e,block.x+dx,block.z+dz)||inRiverPark(e,block.x+dx,block.z+dz));
  };
  const wide=holes.filter(block=>block.lot!==LOT_CHAMPION&&onLand(block)),used=new Set();
  const inner=(block)=>block.pitch/2-ALLEY/2;
  // 랜드마크는 제 크기만큼 도로에서 물러나야 한다. 고가도 교각과 상판이 건물을 뚫으므로 넣는다.
  // 골목은 자리를 정한 뒤 평면 안쪽만 잘라 낸다. 그 자리에서 가장 가까운 도로 가장자리까지의 거리다.
  const reservationRoads=[...roads,...rampSegments];
  const roadRoom=(block)=>reservationRoads.reduce((room,road)=>{
    if(road.kind==='alley')return room;
    const dx=road.x2-road.x1,dz=road.z2-road.z1,len=dx*dx+dz*dz;
    const t=len?Math.max(0,Math.min(1,((block.x-road.x1)*dx+(block.z-road.z1)*dz)/len)):0;
    return Math.min(room,Math.hypot(block.x-(road.x1+dx*t),block.z-(road.z1+dz*t))-(ROAD_WIDTH[road.kind]||8)/2);
  },Infinity);
  // 랜드마크는 돌리지 않고 세우므로 평면 사각형 그대로 도로와 겹치는지 본다.
  const clearOfSurface=(block,key)=>{
    const [width,depth]=LANDMARK_SIZE[key]||[148,148];
    return !reservationRoads.some(road=>{
      if(road.kind==='alley')return false;
      const pad=(ROAD_WIDTH[road.kind]||8)/2;
      return holeSpan(road,{x:block.x,z:block.z,hx:width/2+pad,hz:depth/2+pad})!==null;
    });
  };
  const landmarkKeys=['station','library','stadium','fire','hospital','school','park'];
  // 시청은 강 북쪽 도심에 세운다. 도시의 얼굴이라 자리를 아무 데나 주지 않는다.
  const north=wide.filter(block=>block.z<riverCenter(e,block.x));
  // 북안에 빈자리가 없는 작은 도시는 남안의 빈자리를 쓴다. 도로 위에 세우는 것보다 낫다.
  const clearNorth=north.filter(block=>clearOfSurface(block,'cityhall'));
  const clearAny=clearNorth.length?clearNorth:wide.filter(block=>clearOfSurface(block,'cityhall'));
  const cityhallBlock=clearAny.length
    ? clearAny.slice().sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)
      ||a.district.localeCompare(b.district)||a.x-b.x||a.z-b.z)[0]
    : (north.length?north:wide).slice().sort((a,b)=>roadRoom(b)-roadRoom(a)
      ||a.district.localeCompare(b.district)||a.x-b.x||a.z-b.z)[0];
  const cityhall=cityhallBlock?[{key:'cityhall',x:cityhallBlock.x,z:cityhallBlock.z,district:cityhallBlock.district}]:[];
  if(cityhallBlock)used.add(wide.indexOf(cityhallBlock));
  const landmarks=[...cityhall,...landmarkKeys.map((key)=>{
    // 빈자리가 없으면 그 랜드마크는 짓지 않는다. 도로 위에 세우면 차선이 건물을 뚫는다.
    const room=wide.filter((block,index)=>!used.has(index)&&clearOfSurface(block,key));
    const [block]=shareHoles(room,1,new Set());
    if(!block)return null;
    used.add(wide.indexOf(block));
    return {key,x:block.x,z:block.z,district:block.district};
  }).filter(Boolean)];
  // 랜드마크는 블록 여러 개를 덮으므로 이웃 블록의 골목이 건물 밑을 지난다. 평면 안쪽을 잘라 낸다.
  // 산 덩이 밑의 골목도 같이 걷는다. 여유 5 는 골목 보도 반폭이다.
  const alleyHoles=[...hillHoles(ROAD_WIDTH.alley),...landmarks.map(mark=>{
    const [width,depth]=LANDMARK_SIZE[mark.key]||[148,148];
    return {x:mark.x,z:mark.z,hx:width/2+5,hz:depth/2+5};
  })];
  const removedAlleyEnds=[];
  const clipped=roads.flatMap(road=>{
    if(road.kind!=='alley')return [road];
    const pieces=clipRoad(road,alleyHoles);
    if(!pieces.length)removedAlleyEnds.push([road.x1,road.z1],[road.x2,road.z2]);
    return pieces;
  });
  // 한 골목 조각이 공공 부지 안에 완전히 들어가 사라지면 clipRoad 가 남길 조각이 없어
  // 이웃 조각에 잘린 이유를 옮길 수 없다. 공유 끝점에 명시적으로 제약 사유를 넘긴다.
  for(const road of clipped){
    if(road.kind!=='alley')continue;
    if(removedAlleyEnds.some(([x,z])=>Math.hypot(road.x1-x,road.z1-z)<1e-5))road.deadEndIn='constraint';
    if(removedAlleyEnds.some(([x,z])=>Math.hypot(road.x2-x,road.z2-z)<1e-5))road.deadEndOut='constraint';
  }
  roads.splice(0,roads.length,...clipped);
  // 자연·물·공공 부지를 피하면서 끊긴 지구 격자를 가장 큰 지상망에 붙인다. 후보는
  // roadNetwork 가 실제 컴포넌트 끝점에서 만들고, 이곳은 도시 제약만 판정한다.
  const connectorClear=(candidate)=>{
    const dx=candidate.x2-candidate.x1,dz=candidate.z2-candidate.z1,run=Math.hypot(dx,dz)||1;
    const nx=-dz/run,nz=dx/run;
    for(let step=0;step<=24;step++){
      const t=step/24,x=candidate.x1+(candidate.x2-candidate.x1)*t,z=candidate.z1+(candidate.z2-candidate.z1)*t;
      for(const offset of [0,-ROAD_WIDTH.lane/2,ROAD_WIDTH.lane/2]){
        const sx=x+nx*offset,sz=z+nz*offset;
        if(inWaterBody(e,sx,sz)||inRiverPark(e,sx,sz)||inNature(e,sx,sz))return false;
        if(hills.some(hill=>Math.hypot(sx-hill.x,sz-hill.z)<hill.r+2))return false;
        if(landmarks.some(mark=>{
          const [width,depth]=LANDMARK_SIZE[mark.key]||[148,148];
          return Math.abs(sx-mark.x)<width/2&&Math.abs(sz-mark.z)<depth/2;
        }))return false;
      }
    }
    return true;
  };
  const surfaceRoads=roads.filter(road=>!road.elevated&&!road.tunnel);
  const surfaceTopology=buildRoadNetwork({roads:surfaceRoads});
  const surfaceLinkById=new Map(surfaceTopology.links.map(link=>[link.id,link]));
  // 포장은 맞닿지만 중심선이 끝난 기존 경계는 짧은 실제 연결 조각으로 메운다. 폭 합보다
  // 먼 끝은 여기서 연결됐다고 간주하지 않는다.
  const seamAdditions=surfaceEdgeSeams(surfaceRoads,{graph:surfaceTopology,canConnect:connectorClear});
  for(const [index,seam] of seamAdditions.entries()){
    const id=`surface-seam-${index}`;
    roads.push(segment([seam.x1,seam.z1],[seam.x2,seam.z2],'lane',{id,path:id,access:true}));
  }
  const additions=surfaceConnectors(surfaceRoads,{graph:surfaceTopology,canConnect:connectorClear,maxDistance:260});
  for(const [index,connector] of additions.entries()){
    const id=`access-${index}`;
    roads.push(segment([connector.x1,connector.z1],[connector.x2,connector.z2],'lane',{id,path:id,access:true}));
  }
  // 행/교차 골목의 남은 끝은 생성 시 물·자연·공공 부지 때문에 해당 예약 통로가
  // 생략된 곳이다. 내부 courtyard 도로는 생성할 때부터 별도 사유를 갖는다.
  for(const end of surfaceTopology.openEnds){
    if(end.kind!=='alley'||end.intentional)continue;
    const link=surfaceLinkById.get(end.link),road=surfaceRoads[link?.sourceIndex];
    if(!road)continue;
    if(seamAdditions.some(seam=>Math.hypot(end.x-seam.x1,end.z-seam.z1)<1e-5))continue;
    const atIn=Math.hypot(end.x-road.x1,end.z-road.z1)<1e-5;
    const reason=road.deadEndIn||road.deadEndOut||'constraint-corridor';
    if(atIn)road.deadEndIn=reason;else road.deadEndOut=reason;
  }
  for(const bridge of bridges){bridge.sourceRoadIndex=roads.indexOf(bridge._sourceRoad);delete bridge._sourceRoad;}
  const parks=shareHoles(wide,4,used).map((block,index)=>({x:block.x,z:block.z,rx:inner(block),rz:inner(block),
    kind:['central','oldtown','garden','arts'][index]||'central'}));
  const plazas=shareHoles(wide,3,used).map(block=>({x:block.x,z:block.z,r:Math.min(44,inner(block))}));

  // 연못이다. 자연지대의 호수와 골짜기 못, 공원마다 하나, 남안 강변 습지 셋이다.
  // 강변 습지는 물이나 다리 자리에 겹치면 뺀다.
  const ponds=[...naturePonds(e)];
  for(const park of parks)ponds.push({x:park.x,z:park.z,rx:park.rx*.22,rz:park.rz*.22,kind:'pond'});
  for(const fx of [-.5,.1,.6]){
    const x=fx*e,z=riverCenter(e,x)+riverHalf(e,x)+riverParkWidth(e,x,1)*.55;
    if(inWaterBody(e,x,z)||bridges.some(b=>Math.abs(b.x-x)<60))continue;
    ponds.push({x,z,rx:e*.035,rz:e*.02,kind:'marsh'});
  }

  const waterfront=[
    {points:[[-e*.76,-e*.93],[-e*.1,-e*.96],[e*.7,-e*.92]],kind:'promenade'},
    {points:[[e*.26,-e*.93],[e*.33,-e*.96],[e*.42,-e*.93]],kind:'marina'},
  ];
  // 차량 경로다. 골목과 고가를 뺀 모든 지상 경로가 들어가고, 다른 경로와 만나는 점을
  // 중간점으로 끼워 교차로에서 방위를 섞는다. 두 점짜리 곧은 길도 경로다.
  const routeIds=[...new Set(roads.filter(r=>r.path&&r.kind!=='alley'&&!r.elevated&&!r.tunnel).map(r=>r.path))];
  const routeRoads=roads.filter(r=>r.kind!=='alley'&&!r.elevated&&!r.tunnel);
  const routes=routeIds.map(id=>{
    const own=roads.filter(r=>r.path===id);
    const points=own.flatMap((r,i)=>i?[[r.x2,r.z2]]:[[r.x1,r.z1],[r.x2,r.z2]]);
    return {id,points:withCrossings(points,routeRoads.filter(r=>r.path!==id))};
  }).filter(r=>r.points.length>=2);
  // 골목은 격자가 스스로 비운 자리라 근접 색인에서 뺀다. worldLayout 의 nearRoad 와 같은 규칙이다.
  // 램프는 도로가 아니지만 그 밑에 건물이 서면 안 되므로 색인에만 지상 도로로 넣는다.
  // 곡선이므로 그린 폴리라인을 그대로 조각내야 안쪽 곡선에 건물이 파고들지 않는다.
  const roadIndex=createSegmentIndex([...roads.filter(r=>r.kind!=='alley'),...rampSegments],LOT_CHAMPION+ALLEY);
  const subway=subwayNetwork(e);
  const plan={extent,riverZ:riverCenter(e,0),districts,roads,bridges,parks,plazas,waterfront,landmarks,routes,highwayRoutes,
    ramps,roundabouts,tunnels,overpasses,highwayDeck:HIGHWAY_DECK,
    nodes,hills,nature,ponds,airportRoads:[{side:1,points:[[border,AIRPORT_ROAD_Z],[e+AIRPORT_OFFSET+AIRPORT_ROAD_END,AIRPORT_ROAD_Z]]}],
    subway,interchanges,roadIndex,riverLine,
    islands:riverIslands(e),streams};
  let network;
  Object.defineProperty(plan,'network',{enumerable:true,get:()=>network??=(buildRoadNetwork({roads,ramps}))});
  return plan;
}

/** 경로 길이는 경로마다 고정이다. 차량 한 대마다 매 프레임 다시 재지 않는다. */
const routeLengths=new WeakMap();
function lengthsOf(route){
  let entry=routeLengths.get(route);
  if(entry)return entry;
  const lengths=route.points.slice(1).map((p,i)=>Math.hypot(p[0]-route.points[i][0],p[1]-route.points[i][1]));
  // 현마다 방위를 한 번만 잰다. 차량 한 대가 매 프레임 pointOnRoute 를 부르므로
  // 여기서 atan2 를 미리 털어 두지 않으면 1000 대 기준 프레임 예산을 넘는다.
  const angles=route.points.slice(1).map((p,i)=>Math.atan2(p[0]-route.points[i][0],p[1]-route.points[i][1]));
  // 꼭짓점에서 이어 붙일 이웃 현의 중간 방위다. 최단 방향으로 섞는다.
  const joints=angles.map((angle,i)=>{
    const next=i+1<angles.length?angles[i+1]:angle;
    return angle+Math.atan2(Math.sin(next-angle),Math.cos(next-angle))/2;
  });
  // 누적 길이다. 곡선 간선은 경로당 현이 스무 개를 넘어 선형 탐색이 차량 수만큼 곱해진다.
  const offsets=new Float64Array(lengths.length+1);
  for(let i=0;i<lengths.length;i++)offsets[i+1]=offsets[i]+lengths[i];
  entry={lengths,angles,joints,offsets,total:offsets[lengths.length]||1};
  routeLengths.set(route,entry);
  return entry;
}

/** 두 방위를 최단 방향으로 섞는다. PI 를 넘어 도는 쪽으로 가지 않는다. */
const blend=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;

/** 이음매에서 방위를 섞는 거리다. 차 길이(트럭 7.4) 보다 넉넉히 크고, 교차로 하나를
 * 빠져나오는 동안 끝나야 한다. */
const BLEND_REACH=14;

export function pointOnRoute(route,progress){
  const {lengths,angles,joints,offsets,total}=lengthsOf(route);
  const target=((progress%1)+1)%1*total;
  // 누적 길이에서 이진 탐색한다. 현이 스무 개 넘는 곡선 경로에서 선형 탐색보다 빠르다.
  let low=0,high=lengths.length-1;
  while(low<high){const mid=(low+high+1)>>1;if(offsets[mid]<=target)low=mid;else high=mid-1;}
  const index=low;
  const length=lengths[index]||1;
  const a=route.points[index],b=route.points[index+1],t=(target-offsets[index])/length;
  // 꼭짓점마다 방위가 튀므로 이음매 앞뒤로만 섞는다. 예전에는 현 절반씩 섞어서,
  // 간선이 직각으로 꺾이면서 현이 길어지자 차가 수백 단위 앞부터 비스듬히 섰다.
  // 섞는 거리는 월드 단위 고정이라 현 길이와 무관하다.
  const own=angles[index],reach=Math.min(BLEND_REACH,length/2),run=target-offsets[index];
  let angle=own;
  if(index>0&&run<reach)angle=blend(joints[index-1],own,run/reach);
  else if(run>length-reach)angle=blend(own,joints[index],(run-(length-reach))/reach);
  return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,angle};
}

/** 교각이 설 수 있는지 보는 지상 도로 색인이다. roadIndex 는 골목을 빼고 고가도로를
 * 넣은 필지 배치용이라 교각 판정에는 쓸 수 없다. 여기서는 반대로 골목까지 넣고
 * 고가도로를 뺀다. 색인은 plan 에 붙여 두므로 도시당 한 번만 만든다. */
const SURFACE_CELL=80;

export function surfaceRoadIndex(plan){
  if(plan.surfaceIndex)return plan.surfaceIndex;
  plan.surfaceIndex=createSegmentIndex(plan.roads.filter(road=>!road.elevated),SURFACE_CELL);
  return plan.surfaceIndex;
}

/** 점이 지상 도로 가장자리에서 margin 만큼 떨어져 있는지 본다. 참이면 교각을 세워도 된다. */
export function clearOfRoads(index,x,z,margin=0){
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  // 가장 넓은 지상 도로(대로 22) 의 반폭에 여유를 더한 값이 탐색 반경이다.
  const reach=ROAD_WIDTH.arterial/2+margin;
  for(const road of index.near(x,z,reach)){
    const dx=road.x2-road.x1,dz=road.z2-road.z1;
    const len2=dx*dx+dz*dz||1;
    const t=Math.max(0,Math.min(1,((x-road.x1)*dx+(z-road.z1)*dz)/len2));
    const gap=Math.hypot(x-(road.x1+dx*t),z-(road.z1+dz*t));
    if(gap<(ROAD_WIDTH[road.kind]||8)/2+margin)return false;
  }
  return true;
}
