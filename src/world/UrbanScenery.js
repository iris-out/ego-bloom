/** Shared urban-plan renderer. This is the only place that turns the canonical
 * road/district graph into scenery; traffic and the minimap consume that graph
 * directly rather than reconstructing a grid. */
import { createUrbanPlan, districtBlocks, ROAD_WIDTH as PLAN_ROAD_WIDTH } from '../../shared/urbanPlan.js';
import { roadClearance } from '../../shared/roadClearance.js';
import { addElevatedRoad, addOverpass, addRamp, addRoadFurniture, LANE_PLAN, roadMarkings } from './models/roadStructures.js';
import { fillerSlots } from '../../shared/worldLayout.js';
import { ALLEY } from '../../shared/lots.js';
import { LANDMARK_SIZE } from '../../shared/landmarks.js';
import { LEVELS } from '../../shared/elevation.js';
import { addNpcBuilding, MAX_FILL as NPC_FILL, NPC_OPEN, NPC_PLAN, pickNpcKind } from './models/npcBuildings.js';
import { createBatches, partFootprint } from './cityModels.js';
import { CIVIC_BUILDINGS } from './models/civicBuildings.js';
import { addBeach, addParasol, addPier, addResort } from './models/coastModels.js';
import { addBridge, addCrosswalk, addInterchange, addSubwayEntrance } from './models/transitModels.js';
import { beachStrips, parasols, piers, resortPlots } from '../../shared/coast.js';
import { inRiverPark, inWaterBody, riverLandSpans, riverSurfaceMesh } from '../../shared/river.js';
import { guardrails, lampSpots, streetTrees } from './roadFurniture.js';

const ROAD_WIDTH=PLAN_ROAD_WIDTH;
/** 충돌 상자를 만들 부재의 최소 높이와 최소 평면 폭이다. 이보다 낮거나 가늘면 타고 넘거나 스친다. */
const MASS_HEIGHT=4, MASS_SPAN=2.5;
/** 랜드마크 부재의 충돌 여유다. 건물 기본값(3) 은 부재 하나짜리 상자에는 너무 두껍다. */
const MASS_MARGIN=1;
/** 배경 건물 충돌 상자의 높이와 여유다. 높이는 판정에 쓰이는 값일 뿐이고 실제 층수와는 무관하다.
 * 여유가 크면 골목이 사라지므로 제작자 건물(3) 보다 좁게 잡는다. */
const NPC_HEIGHT=12, NPC_MARGIN=1;
/** 횡단보도를 교차로 중심에서 물리는 거리다. 교차로 상판 위에 얹히면 선이 겹쳐 읽히지 않는다. */
const CROSSWALK_SETBACK=ROAD_WIDTH.arterial/2+4;
// 블록 포장판 두께와 높이다. 지구 바닥판 윗면(-.13+.19=.06) 보다 위, 보도 윗면(LEVELS.PAVEMENT_TOP)
// 에 맞춰 깊이 싸움 없이 보도와 높이를 맞춘다.
const BLOCK_PAVEMENT_H=.16, BLOCK_PAVEMENT_Y=LEVELS.PAVEMENT_TOP-BLOCK_PAVEMENT_H/2;
const triangleNormalY=([a,b,c])=>(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);

/** Canonical ramp faces become one indexed world-space mesh. Top faces share one
 * vertex pool; underside and each perimeter quad use separate pools so their
 * normals stay sharp without reintroducing internal triangle walls. */
export function rampSurfaceMesh(faces){
  const ordered=[...faces.filter(face=>triangleNormalY(face.triangle)>1e-9),
    ...faces.filter(face=>triangleNormalY(face.triangle)<=1e-9)];
  const topIndexCount=ordered.findIndex(face=>triangleNormalY(face.triangle)<=1e-9);
  const positions=[],indices=[],groups=new Map();
  for(const [faceIndex,face] of ordered.entries()){
    const normalY=triangleNormalY(face.triangle);
    const group=normalY>1e-9?'top':face.group??face.face??faceIndex;
    let vertices=groups.get(group);
    if(!vertices){vertices=new Map();groups.set(group,vertices);}
    for(const point of face.triangle){
      const key=point.join(',');
      let index=vertices.get(key);
      if(index===undefined){index=positions.length/3;positions.push(...point);vertices.set(key,index);}
      indices.push(index);
    }
  }
  return {positions,indices,topIndexCount:(topIndexCount<0?ordered.length:topIndexCount)*3};
}
/** 도로 점유 검사에 넣을 실제 부재의 수직 구간과 평면 반경이다. tree 는 단위 구가 아니라
 * 반지름 1 인 icosahedron 이므로 scale.y 전체가 위아래 반경이고, trunk 는 높이 1 원기둥이다. */
function clearPart(clearance,position,scale,shape='box',source=null){
  const [width,depth]=partFootprint(shape,scale);
  const radius=shape==='trunk'||shape==='tree'?Math.max(width,depth)/2:Math.hypot(width,depth)/2;
  const verticalRadius=shape==='tree'?Math.abs(scale[1]):Math.abs(scale[1])/2;
  return clearance.columnClear(position[0],position[2],radius,position[1]-verticalRadius,position[1]+verticalRadius,source);
}
const clearTree=(clearance,trunkPosition,trunkScale,crownPosition,crownScale)=>
  clearPart(clearance,trunkPosition,trunkScale,'trunk')&&clearPart(clearance,crownPosition,crownScale,'tree');
const addSegment=(add,material,road,width,y=.24,height=.12,color)=>{
  const x=(road.x1+road.x2)/2,z=(road.z1+road.z2)/2,rotation=Math.atan2(road.x2-road.x1,road.z2-road.z1);
  add(material,[x,y,z],[width,height,road.length],null,'box',rotation,color);
};

/** 도로가 강이나 지천을 지나는 구간을 잘라 낸 뭍 구간 목록이다. 물 위 구간은 다리가
 * 대신 잇는다. 다리 없는 도하는 urban-plan 테스트가 막는다. */
function landSpans(extent,road){
  return riverLandSpans(extent,road);
}

/** 뭍 구간 하나를 원래 도로와 같은 모양의 객체로 만든다. roadMarkings 가 length 와
 * 양 끝 좌표를 읽으므로 그대로 채워 준다. */
function spanRoad(road,t0,t1){
  const x1=road.x1+(road.x2-road.x1)*t0,z1=road.z1+(road.z2-road.z1)*t0;
  const x2=road.x1+(road.x2-road.x1)*t1,z2=road.z1+(road.z2-road.z1)*t1;
  return {...road,x1,z1,x2,z2,length:Math.hypot(x2-x1,z2-z1)};
}

/** 도심을 지나는 고속도로 터널이다. 벽과 복개 언덕을 땅 위에 세우면 가로지르는 지상
 * 도로를 막으므로, 양 끝 포탈만 세우고 그 사이는 지면 높이의 녹지 띠(복개 공원)로 덮는다.
 * 물 위 구간은 아무것도 그리지 않는다. 강 밑을 지나는 것으로 본다. */
function addCoveredHighway(add,tunnel,extent,quality,clearance){
  const width=tunnel.width??ROAD_WIDTH.highway,cover=width*1.5;
  const rotation=Math.atan2(tunnel.x2-tunnel.x1,tunnel.z2-tunnel.z1);
  const ux=Math.sin(rotation),uz=Math.cos(rotation),px=-uz,pz=ux;
  for(const [t0,t1] of landSpans(extent,tunnel)){
    const piece=spanRoad(tunnel,t0,t1);
    if(piece.length<4)continue;
    add('green',[(piece.x1+piece.x2)/2,.06,(piece.z1+piece.z2)/2],[cover,.14,piece.length],null,'box',rotation,'#8fae74');
    if(quality==='low')continue;
    const trees=Math.floor(piece.length/26);
    for(let i=0;i<trees;i++){
      const t=(i+.5)/trees,x=piece.x1+(piece.x2-piece.x1)*t,z=piece.z1+(piece.z2-piece.z1)*t;
      const side=i%2?1:-1;
      const tx=x+px*cover*.36*side,tz=z+pz*cover*.36*side;
      if(!clearTree(clearance,[tx,1.5,tz],[.4,3,.4],[tx,4.6,tz],[2,3,2]))continue;
      add('wood',[tx,1.5,tz],[.4,3,.4],null,'trunk');
      add('leaf',[tx,4.6,tz],[2,3,2],null,'tree',i*.31);
    }
  }
  // 포탈이다. 지면에 뚫린 검은 입과 돌 테두리로 도로가 땅속으로 들어가는 것을 보인다.
  for(const end of [0,1]){
    const ex=end?tunnel.x2:tunnel.x1,ez=end?tunnel.z2:tunnel.z1,inward=end?-1:1;
    const fx=ex+ux*6*inward,fz=ez+uz*6*inward;
    add('dark',[fx,.3,fz],[width,.5,12],null,'box',rotation);
    add('stone',[fx,3.4,fz],[width*1.15,1.2,4],null,'box',rotation);
    for(const side of [-1,1])add('stone',[fx+px*(width/2+.6)*side,1.8,fz+pz*(width/2+.6)*side],[1.2,3.6,4],null,'box',rotation);
  }
}

/** 산과 자연지대의 언덕 한 덩이다. 눌러 편 구 위에 초록 정수리를 얹는다. */
function mound(add,x,z,radius,height,color){
  // hill 은 단위 반지름 구다. scale 의 x, z 가 곧 반지름이다. 초록 정수리는 조금 높게
  // 얹어 꼭대기와 등성이는 풀, 아래 치마는 흙으로 읽히게 한다.
  add('ground',[x,height*.32,z],[radius,height,radius],null,'hill');
  add('green',[x,height*.45,z],[radius*.74,height*.95,radius*.74],null,'hill',0,color);
}

/** 자연지대 안쪽의 점이다. 모서리에서 도시 쪽으로 반경 비율 (inX, inZ) 만큼 들어온다. */
const inward=(corner,inX,inZ)=>({x:corner.x-Math.sign(corner.x)*corner.r*inX,z:corner.z-Math.sign(corner.z)*corner.r*inZ});
/** 자연지대 안에 결정적으로 나무를 흩뿌린다. 경계 안쪽만 쓴다. */
function scatterTrees(add,corner,count,size,color,seed,clearance){
  for(let i=0;i<count;i++){
    const a=(i*2.399+seed),r=.12+((i*7+seed*3)%11)/11*.78;
    const x=corner.x-Math.sign(corner.x)*corner.r*r*Math.abs(Math.cos(a));
    const z=corner.z-Math.sign(corner.z)*corner.r*r*Math.abs(Math.sin(a));
    if(Math.hypot(x-corner.x,z-corner.z)>corner.r*.92)continue;
    if(!clearTree(clearance,[x,1.6,z],[.45,3.2,.45],[x,5+size,z],[2.4*size,3.8*size,2.4*size]))continue;
    add('wood',[x,1.6,z],[.45,3.2,.45],null,'trunk');
    add('leaf',[x,5+size,z],[2.4*size,3.8*size,2.4*size],null,'tree',i*.2,color);
  }
}

/** 모서리 자연지대 넷이다. 주제마다 지형이 다르고 모두 사분원 안에서 끝난다. */
function addNature(add,corner,ponds,quality,clearance){
  const dense=quality==='high'?1:quality==='medium'?.7:.4;
  if(corner.theme==='mountain'){
    // 봉우리 셋과 능선. 가장 큰 봉우리에는 돌 정수리를 얹는다.
    for(const [ix,iz,r,h] of [[.42,.42,.22,60],[.62,.26,.15,42],[.24,.64,.14,36],[.5,.55,.11,26]]){
      const p=inward(corner,ix,iz);mound(add,p.x,p.z,corner.r*r,h,'#7d9a62');
    }
    const top=inward(corner,.42,.42);add('stone',[top.x,52,top.z],[corner.r*.08,16,corner.r*.08],null,'cone');
    scatterTrees(add,corner,Math.round(48*dense),.9,'#5f8a56',1,clearance);
  }else if(corner.theme==='valley'){
    // 낮은 언덕 둘 사이로 계류가 흐르고 못 둘에 고인다.
    for(const [ix,iz,r,h] of [[.28,.62,.2,26],[.66,.24,.18,22]]){const p=inward(corner,ix,iz);mound(add,p.x,p.z,corner.r*r,h,'#8fb172');}
    const a=inward(corner,.72,.68),b=inward(corner,.18,.14);
    const len=Math.hypot(b.x-a.x,b.z-a.z),rot=Math.atan2(b.x-a.x,b.z-a.z);
    add('bank',[(a.x+b.x)/2,-.01,(a.z+b.z)/2],[14,.18,len],null,'box',rot);
    add('water',[(a.x+b.x)/2,.1,(a.z+b.z)/2],[8,.16,len],null,'box',rot);
    scatterTrees(add,corner,Math.round(60*dense),1,'#9fbb6d',2,clearance);
  }else if(corner.theme==='dune'){
    // 모래 언덕과 갯벌 못, 갈대.
    for(const [ix,iz,r,h] of [[.3,.3,.16,9],[.55,.25,.12,7],[.25,.6,.13,8],[.6,.6,.1,6]]){
      const p=inward(corner,ix,iz);add('sand',[p.x,h*.3,p.z],[corner.r*r,h,corner.r*r],null,'hill');
    }
    const pool=inward(corner,.45,.5);
    add('bank',[pool.x,-.01,pool.z],[corner.r*.34,.18,corner.r*.26],null,'octagon');
    add('water',[pool.x,.1,pool.z],[corner.r*.3,.16,corner.r*.22],null,'octagon');
    for(let i=0;i<Math.round(30*dense);i++){
      const a=i*.7,x=pool.x+Math.cos(a)*corner.r*(.3+(i%3)*.03),z=pool.z+Math.sin(a)*corner.r*(.22+(i%3)*.03);
      const position=[x,1.2,z],scale=[.2,2.4,.2];
      if(clearPart(clearance,position,scale,'trunk'))add('wood',position,scale,null,'trunk',0,'#c7b56a');
    }
    scatterTrees(add,corner,Math.round(14*dense),.7,'#a6bd7c',3,clearance);
  }else{
    // 호수 공원. 호수는 plan.ponds 가 내고 여기서는 잔디, 데크, 나무를 둔다.
    add('green',[inward(corner,.5,.5).x,.05,inward(corner,.5,.5).z],[corner.r*1.1,.12,corner.r*1.1],null,'octagon',0,'#91b67a');
    const lake=ponds.find(p=>p.kind==='lake');
    if(lake){
      const deck={x:lake.x-lake.rx*.9,z:lake.z};
      add('wood',[deck.x,.5,deck.z],[lake.rx*.5,.4,lake.rz*.3],null,'box');
      for(let i=0;i<6;i++)add('wood',[deck.x-lake.rx*.22+i*lake.rx*.09,.9,deck.z-lake.rz*.16],[.3,1.2,.3]);
    }
    scatterTrees(add,corner,Math.round(40*dense),1,undefined,4,clearance);
  }
}

/** 연못과 호수다. 물 윗면은 강과 같은 높이고 둑과 물가 돌, 갈대를 두른다. */
function addPond(add,pond,quality,clearance){
  add('bank',[pond.x,-.01,pond.z],[pond.rx+8,.18,pond.rz+8],null,'octagon');
  add('water',[pond.x,.1,pond.z],[pond.rx,.16,pond.rz],null,'octagon');
  if(quality==='low')return;
  const stones=pond.kind==='lake'?12:6;
  for(let i=0;i<stones;i++){
    const a=i*Math.PI*2/stones+.3,x=pond.x+Math.cos(a)*(pond.rx+4),z=pond.z+Math.sin(a)*(pond.rz+4);
    if(i%2)add('stone',[x,.5,z],[2.2,.7,1.6],null,'box',a);
    else{
      const position=[x,1.1,z],scale=[.18,2.2,.18];
      if(clearPart(clearance,position,scale,'trunk'))add('wood',position,scale,null,'trunk',0,'#b9b07a');
    }
  }
}

export function buildUrbanScenery(buildings,extent,quality='medium',gallery=false){
  const {batches,add}=createBatches(),plan=createUrbanPlan(extent);
  const rampFaces=[];
  const addRoadTriangle=(triangle,surface={})=>rampFaces.push({triangle,...surface});
  const surfaces=[
    {material:'bank',mesh:riverSurfaceMesh(extent,'bank')},
    {material:'water',mesh:riverSurfaceMesh(extent,'water')},
    {material:'green',mesh:riverSurfaceMesh(extent,'park',-1)},
    {material:'green',mesh:riverSurfaceMesh(extent,'park',1)},
  ];
  // 차가 부딪히면 멈추는 구조물이다. 자리를 만드는 쪽이 알려 주므로 여기서 모으기만 한다.
  const obstacles=[];
  /** 부재를 그리면서 몸통이면 충돌 상자도 같이 만든다. 낮은 바닥판과 가는 깃대는 뺀다.
   * 필지 전체를 상자 하나로 막으면 시청 광장과 학교 운동장까지 벽이 된다. */
  const blockedDecor=new Set(),pendingDecorTrunks=new Map(),pendingTreeTrunks=new Map();
  const decorKey=([x,,z])=>`${x.toFixed(4)}:${z.toFixed(4)}`;
  const clearDecor=(material,position,scale,owner,shape='box',rotation,color)=>{
    const key=decorKey(position);
    if(shape==='trunk'&&material==='wood'){
      if(!clearPart(clearance,position,scale,shape)){blockedDecor.add(key);return;}
      pendingDecorTrunks.set(key,[material,position,scale,owner,shape,rotation,color]);return;
    }else if(shape==='tree'){
      const trunk=pendingDecorTrunks.get(key);pendingDecorTrunks.delete(key);
      if(blockedDecor.has(key)||!clearPart(clearance,position,scale,shape))return;
      if(trunk)add(...trunk);
    }else if(material==='dark'&&scale[1]>=3&&Math.max(scale[0],scale[2])<=1.2){
      if(!clearPart(clearance,position,scale,shape)){blockedDecor.add(key);return;}
    }else if(material==='lamp'&&blockedDecor.has(key))return;
    add(material,position,scale,owner,shape,rotation,color);
  };
  const massWatch=(material,position,scale,owner,shape='box',rotation,color)=>{
    const key=decorKey(position),bottom=position[1]-(shape==='tree'?scale[1]:scale[1]/2);
    // Civic tree builders emit the trunk immediately before the crown. Buffer wood
    // trunks until the crown has also passed its real icosahedron volume check, so a
    // crown-only ramp overlap does not leave either unsafe foliage or a bare trunk.
    if(shape==='trunk'&&material==='wood'){
      if(clearPart(clearance,position,scale,shape))pendingTreeTrunks.set(key,[material,position,scale,owner,shape,rotation,color]);
      else blockedDecor.add(key);
      return;
    }
    if(shape==='tree'){
      const trunk=pendingTreeTrunks.get(key);pendingTreeTrunks.delete(key);
      if(blockedDecor.has(key)||!clearPart(clearance,position,scale,shape)){blockedDecor.add(key);return;}
      if(trunk)add(...trunk);
      add(material,position,scale,owner,shape,rotation,color);
      return;
    }
    const lowObstacle=shape==='trunk'||(material==='dark'&&scale[1]>=3&&Math.max(scale[0],scale[2])<=1.2&&bottom<3);
    if(lowObstacle&&!clearPart(clearance,position,scale,shape)){
      blockedDecor.add(key);return;
    }
    if(blockedDecor.has(key)&&(shape==='tree'||material==='lamp'))return;
    add(material,position,scale,owner,shape,rotation,color);
    const [px,py,pz]=position,[,height]=scale;
    if(!(height>=MASS_HEIGHT))return;
    const [width,depth]=partFootprint(shape,scale);
    if(Math.min(width,depth)<MASS_SPAN)return;
    obstacles.push({x:px,z:pz,height:py+height/2,width,depth,rotation:rotation||0,margin:MASS_MARGIN});
  };
  // 가로등 자리다. StreetLamps 가 카메라와 가까운 몇 개만 골라 실제 광원을 켠다.
  const lampSpotList=[];
  // 노면, 램프, 교량의 같은 캐시를 모든 구조물과 조경 생성기가 공유한다.
  const clearance=roadClearance(plan);
  add('ground',[0,-2,0],[extent*2+70,4,extent*2+70]);
  // 산 덩이와 랜드마크 바닥판 밑의 블록 포장판이다. 가려지거나 바닥판과 겹쳐 깜박이므로 깔지 않는다.
  const underCover=(x,z,half)=>(plan.hills||[]).some(hill=>
    Math.hypot(Math.max(0,Math.abs(x-hill.x)-half),Math.max(0,Math.abs(z-hill.z)-half))<hill.r*.95)
    ||(!gallery&&plan.landmarks.some(mark=>{
      const [width,depth]=LANDMARK_SIZE[mark.key]||[148,148];
      return Math.abs(x-mark.x)<width/2+half&&Math.abs(z-mark.z)<depth/2+half;
    }));
  // 지구가 직사각형이면 rx, rz 는 반폭과 반깊이다. 윗면을 기본 판보다 확실히 올려 지구 색이 보이게 한다.
  for(const district of plan.districts){
    const rect=district.shape==='rect';
    add('ground',[district.x,-.13,district.z],rect?[district.rx*2,.38,district.rz*2]:[district.rx*1.7,.38,district.rz*1.7],
      null,rect?'box':'octagon',district.rotation,district.color);
    // 블록마다 포장판을 깐다. 공원, 광장, 랜드마크로 비운 블록(empty)은 각자의 바닥을 따로 그리므로 뺀다.
    // pitch 보다 ALLEY 만큼 작게 깔아 블록 사이 골목이 지구 바탕색으로 남는다.
    for(const block of districtBlocks(district).blocks){
      if(block.empty)continue;
      // 강, 지천, 강변 공원 위에는 깔지 않는다. 네 귀퉁이까지 본다.
      const reach=block.pitch/2;
      if([[0,0],[-reach,-reach],[reach,-reach],[-reach,reach],[reach,reach]]
        .some(([dx,dz])=>inWaterBody(extent,block.x+dx,block.z+dz)||inRiverPark(extent,block.x+dx,block.z+dz)))continue;
      const size=block.pitch-ALLEY;
      if(underCover(block.x,block.z,size/2))continue;
      add('pavement',[block.x,BLOCK_PAVEMENT_Y,block.z],[size,BLOCK_PAVEMENT_H,size]);
    }
  }
  // 강, 강턱, 강변 공원은 공유 꼭짓점을 쓰는 연속 삼각형 띠다. 회전 상자 조각의 바깥
  // 굽이에 생기던 톱니 모양 틈 없이 물 판정과 같은 양안을 따른다.
  // 지천도 같은 물이다. 세로로 흘러 가로 띠를 끊는다.
  for(const stream of plan.streams){
    const mid=(stream.z1+stream.z2)/2, length=Math.abs(stream.z2-stream.z1);
    add('bank',[stream.x,-.01,mid],[stream.width+14,.18,length]);
    add('water',[stream.x,.1,mid],[stream.width,.16,length]);
  }
  // 강 안의 섬은 물 위로 올라온 땅이다.
  for(const island of plan.islands){
    add('ground',[island.x,.16,island.z],[island.rx,.3,island.rz],null,'octagon');
    add('green',[island.x,.26,island.z],[island.rx*.75,.12,island.rz*.75],null,'octagon');
  }
  // 산은 예전에 배치만 비우고 그리지 않아 평평한 빈 땅이었다. 이제 언덕 덩이로 세운다.
  for(const hill of plan.hills||[]){
    mound(add,hill.x,hill.z,hill.r*.95,hill.r*.34,'#7f9c63');
    for(const [ox,oz,f] of [[.45,.2,.5],[-.35,.4,.42],[.1,-.5,.38]])mound(add,hill.x+hill.r*ox,hill.z+hill.r*oz,hill.r*f,hill.r*.2,'#88a66c');
  }
  for(const corner of plan.nature||[])addNature(add,corner,plan.ponds||[],quality,clearance);
  for(const pond of plan.ponds||[])addPond(add,pond,quality,clearance);

  for(const road of plan.roads){
    const width=ROAD_WIDTH[road.kind]||8;
    // 터널 구간은 땅속이다. 복개 띠와 포탈은 tunnels 가 따로 그린다.
    if(road.tunnel)continue;
    // 고가 구간은 지면에 포장을 깔지 않는다. 상판과 교각은 roadStructures 가 만든다.
    if(road.elevated){addElevatedRoad(add,road,{width,height:road.deckY??plan.highwayDeck,quality,
      pierSpacing:quality==='high'?52:quality==='medium'?78:130,
      clearance,sourceRoad:road,onPier:(pier)=>obstacles.push(pier)});continue;}
    // 물 위는 건너뛴다. 도로 하나가 통째로 마른 땅이면 자르지 않고 그대로 그린다.
    const spans=landSpans(extent,road);
    if(!spans.length)continue;
    const pieces=spans.length===1&&spans[0][0]===0&&spans[0][1]===1
      ? [road] : spans.map(([t0,t1])=>spanRoad(road,t0,t1));
    for(const piece of pieces){
      if(piece.length<1)continue;
      addSegment(add,'pavement',piece,width+4,.12,.22);
      addSegment(add,'road',piece,width,.27,.12,road.kind==='alley'?'#87908c':undefined);
      // 중앙선은 노랑 실선, 차선 구분선과 가장자리선은 흰 점선이다. 표는 roadStructures 에 있다.
      for(const mark of roadMarkings(piece,{width,quality,clearance}))add(mark.material,mark.position,mark.scale,null,'box',mark.rotation,mark.color);
    }
    // 횡단보도는 경로 끝과 교차점(join 이 null 인 곳) 에만 깐다. 대로와 집산로만 놓아 조각 수를 묶는다.
    if(quality!=='low'&&(road.kind==='arterial'||road.kind==='collector')){
      for(const [end,join] of [[0,road.joinIn],[1,road.joinOut]]){
        if(join!==null&&join!==undefined)continue;
        const rotation=Math.atan2(road.x2-road.x1,road.z2-road.z1);
        const ux=Math.sin(rotation),uz=Math.cos(rotation),setback=end?-CROSSWALK_SETBACK:CROSSWALK_SETBACK;
        const point={x:end?road.x2:road.x1,z:end?road.z2:road.z1};
        if(inWaterBody(extent,point.x+ux*setback,point.z+uz*setback))continue;
        addCrosswalk(add,{x:point.x+ux*setback,z:point.z+uz*setback,rotation,width},quality);
      }
    }
    if(road.deadEnd){
      add('marking',[road.x2,.36,road.z2],[width*.65,.05,.35],null,'box',Math.atan2(road.x2-road.x1,road.z2-road.z1));
    }
  }
  // 나들목 램프는 addInterchange 가 그린다. 여기서는 고속도로가 터널로 내려가는 경사로만 놓는다.
  for(const ramp of (plan.ramps||[]).filter(r=>r.kind==='portal'))
    addRamp(add,ramp.from,ramp.to,{points:ramp.points,width:ramp.width??ROAD_WIDTH.highway,quality,
      clearance,sourceRoad:ramp,onPier:(pier)=>obstacles.push(pier),addRoadTriangle});
  for(const tunnel of plan.tunnels||[])addCoveredHighway(add,tunnel,extent,quality,clearance);
  for(const over of plan.overpasses||[])addOverpass(add,over,{width:over.width,quality,clearance,sourceRoad:over});
  for(const circle of plan.roundabouts||[]){
    add('pavement',[circle.x,.26,circle.z],[circle.r,.2,circle.r],null,'octagon');
    add('road',[circle.x,.3,circle.z],[circle.r*.94,.14,circle.r*.94],null,'octagon');
    // legacy 로터리 레코드는 실제 원형 링크가 아니라 직선 간선 교차점이다. 중앙 섬이나
    // 원형 연석으로 통행을 막지 않고, canonical 중심/반경만 열린 교차면에 쓴다.
    // 사방 진입로의 횡단보도는 접속 도로가 여백 간선이라 동서남북이다.
    if(quality!=='low')for(let i=0;i<4;i++){
      const rotation=i*Math.PI/2;
      const x=circle.x+Math.sin(rotation)*(circle.r+CROSSWALK_SETBACK),z=circle.z+Math.cos(rotation)*(circle.r+CROSSWALK_SETBACK);
      addCrosswalk(add,{x,z,rotation,width:ROAD_WIDTH.arterial},quality);
    }
  }
  // 대로 중앙분리대는 medium 부터 켠다. 잔 기둥까지 깔면 비용이 커서 high 만 기둥을 세운다.
  if(quality!=='low')for(const road of plan.roads){
    if(road.kind!=='arterial'||road.length<120)continue;
    addRoadFurniture(add,road,{width:ROAD_WIDTH.arterial,median:true,quality,clearance});
  }
  for(const bridge of plan.bridges)addBridge(add,bridge,quality,{clearance,onPylon:(pylon)=>obstacles.push(pylon)});
  for(const node of plan.interchanges)addInterchange(add,node,quality,{clearance,
    onPier:(pier)=>obstacles.push(pier),addRoadTriangle});
  for(const line of plan.subway.lines)for(const station of line.stations)
    addSubwayEntrance(add,{...station,color:line.color},quality);

  // 섬 가장자리 해변, 파라솔, 잔교, 리조트다. shared/coast.js 가 좌표를 낸다.
  for(const strip of beachStrips(extent))addBeach(clearDecor,strip,quality);
  for(const spot of parasols(extent,quality))addParasol(clearDecor,spot,quality);
  for(const pier of piers(extent))addPier(clearDecor,pier,quality);
  for(const plot of resortPlots(extent))addResort(clearDecor,plot,quality);

  for(const park of plan.parks){
    // rx/rz 는 빈 블록의 반폭·반깊이다. box 는 단위 폭이므로 정확히 두 배만 준다.
    add('green',[park.x,.25,park.z],[park.rx*2,.35,park.rz*2],null,'box',0,park.kind==='garden'?'#91b67a':'#789f70');
    for(let i=0;i<10;i++){
      const a=i*2.399,r=(.25+(i%4)*.16),x=park.x+Math.cos(a)*park.rx*r,z=park.z+Math.sin(a)*park.rz*r;
      if(clearTree(clearance,[x,1.6,z],[.45,3.2,.45],[x,5,z],[2.5,3.6,2.5])){
        add('wood',[x,1.6,z],[.45,3.2,.45],null,'trunk');add('leaf',[x,5,z],[2.5,3.6,2.5],null,'tree',i*.2);
      }
      if(i%3===0)add('stone',[x+3,.55,z],[3,.35,1]);
    }
  }
  for(const plaza of plan.plazas){
    add('pavement',[plaza.x,.28,plaza.z],[plaza.r,.18,plaza.r],null,'octagon');
    add('stone',[plaza.x,.7,plaza.z],[plaza.r*.16,.8,plaza.r*.16],null,'cylinder');
    add('water',[plaza.x,1.12,plaza.z],[plaza.r*.13,.12,plaza.r*.13],null,'cylinder');
  }

  if(!gallery){
    for(const mark of plan.landmarks){
      const model=CIVIC_BUILDINGS[mark.key];
      // 몸통만 막는다. 필지 크기로 막으면 시청 광장이나 소공원 잔디까지 벽이 된다.
      // 무엇이 몸통인지는 부재를 보고 정한다. 모델이 바뀌면 이 상자도 따라 바뀐다.
      if(model){
        model.build(massWatch,mark.x,mark.z,quality);
        // Defensive flush for a future civic prop that uses a wood trunk without a crown.
        for(const part of pendingTreeTrunks.values())add(...part);
        pendingTreeTrunks.clear();
      }
      else{
        add('pavement',[mark.x,.22,mark.z],[52,.3,42]);
        massWatch(mark.key==='police'?'stone':'sand',[mark.x,8,mark.z],[30,15,24]);
        add('accent',[mark.x,16,mark.z],[32,1,26],null,'box',0,mark.key==='police'?'#557ba0':'#c9ad5e');
        add('glass',[mark.x,7.5,mark.z+12.1],[20,5,.15],null,'pane');
      }
    }
  }

  const treeStride=quality==='low'?5:quality==='medium'?3:2;
  buildings.forEach((building,index)=>{
    if(index%treeStride)return;
    const turn=building.blockRotation||0,side=index%2?1:-1,x=building.x+Math.cos(turn)*side*14,z=building.z+Math.sin(turn)*side*14;
    if(inWaterBody(extent,x,z))return;
    if(!clearTree(clearance,[x,1.5,z],[.42,3,.42],[x,4.7,z],[2.1,3.2,2.1]))return;
    add('wood',[x,1.5,z],[.42,3,.42],null,'trunk');add('leaf',[x,4.7,z],[2.1,3.2,2.1],null,'tree',index*.17,index%5===0?'#a6bd7c':undefined);
  });
  // 가로등, 가로수, 가드레일은 roadFurniture 의 등급별 간격표가 낸다.
  const lamps=lampSpots(plan,quality,{clearance});
  for(const part of lamps.parts)add(...part);
  lampSpotList.push(...lamps.spots);
  for(const part of streetTrees(plan,quality,{clearance}))add(...part);
  const rails=guardrails(plan,quality,{clearance});
  for(const part of rails.parts)add(...part);
  obstacles.push(...rails.solids);
  // 광장과 공원에도 조명을 둔다. 가로등이 도로에만 있어 광장이 캄캄했다.
  for(const plaza of plan.plazas){
    for(let i=0;i<4;i++){
      const angle=i*Math.PI/2+.4,px=plaza.x+Math.cos(angle)*plaza.r*.72,pz=plaza.z+Math.sin(angle)*plaza.r*.72;
      if(!clearPart(clearance,[px,2.4,pz],[.2,4.8,.2],'box'))continue;
      add('dark',[px,2.4,pz],[.2,4.8,.2]);add('lamp',[px,4.95,pz],[.7,.34,.7]);
      add('glow',[px,.36,pz],[8,.02,8],null,'octagon');
      lampSpotList.push({x:px,z:pz,y:4.95});
    }
  }
  if(rampFaces.length)surfaces.push({material:'road',category:'ramp-road',source:'roadRibbon',mesh:rampSurfaceMesh(rampFaces)});
  return {batches,plan,surfaces,obstacles,lamps:lampSpotList};
}

/** 제작자가 쓰지 않은 필지를 배경 건물과 열린 공간으로 채운다. 종류는 지구 성격과
 * 필지 좌표에서 결정적으로 고른다. owner 를 주는 것은 거리별 상세 축소가 건물 단위로
 * 동작하게 하기 위한 것이고 picking 대상은 아니다.
 */
export function buildNpcBuildings(buildings, quality = 'medium') {
  const { batches, add } = createBatches();
  for (const spot of npcPlacements(buildings)) {
    const tag = (material, position, scale, _owner, shape, rotation, color) =>
      add(material, position, scale, spot.owner, shape, rotation, color);
    addNpcBuilding(tag, spot.kind, spot.x, spot.z, { lot: spot.lot, rotation: spot.rotation, quality, seed: spot.seed });
  }
  return batches;
}

/** 배경 건물 한 채가 설 자리다. 그리는 쪽과 충돌 상자를 만드는 쪽이 같은 목록을 읽어야
 * 보이는 건물과 막히는 자리가 어긋나지 않는다. */
function npcPlacements(buildings) {
  const spots = [];
  fillerSlots(buildings).forEach((slot, index) => {
    const seed = Math.round(slot.x * 7 + slot.z * 13) + index;
    // 자리 크기를 같이 넘겨 그 자리를 채울 수 있는 종류가 뽑히게 한다.
    const target = slot.lot * 0.88;
    const kind = pickNpcKind(seed, { density: slot.density, lot: target });
    // 작은 종류는 한 자리에 여러 채를 놓는다. 상가 한 채가 52 짜리 자리에 혼자 서면
    // 나머지가 빈 포장으로 남는다. 서울 골목도 한 필지에 점포 두세 개가 붙는다.
    const plan = NPC_PLAN[kind] || 30;
    const per = Math.max(1, Math.min(2, Math.floor(target / (plan * 1.18))));
    const cell = target / per, offset = (per - 1) * cell / 2;
    const cos = Math.cos(slot.rotation), sin = Math.sin(slot.rotation);
    for (let ix = 0; ix < per; ix++) for (let iz = 0; iz < per; iz++) {
      const dx = ix * cell - offset, dz = iz * cell - offset;
      spots.push({
        kind, density: slot.density, owner: `npc-${index}`, lot: cell * 0.94, rotation: slot.rotation,
        seed: seed + ix * 7 + iz * 13, x: slot.x + dx * cos - dz * sin, z: slot.z + dx * sin + dz * cos,
      });
    }
  });
  return spots;
}

/** 배경 건물의 충돌 상자다. 공터와 주차장, 작은 공원은 몸통이 없으므로 빼고,
 * 나머지는 도면 폭(NPC_PLAN) 에 자리에 맞춘 배율을 곱한 만큼만 막는다.
 * 자리 전체를 막으면 건물 사이 골목과 주차장 진입로까지 벽이 된다. */
export function npcSolids(buildings) {
  const solids = [];
  for (const spot of npcPlacements(buildings)) {
    if (NPC_OPEN.has(spot.kind)) continue;
    const plan = NPC_PLAN[spot.kind] || 30;
    const span = plan * Math.min(NPC_FILL, spot.lot / plan);
    const underDeck=spot.density==='deck';
    solids.push({ x: spot.x, z: spot.z, height: underDeck?5.5:NPC_HEIGHT, width: span, depth: span,
      rotation: spot.rotation, margin: NPC_MARGIN, ...(underDeck?{roofMargin:0}:null) });
  }
  return solids;
}
