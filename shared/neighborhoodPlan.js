/** Connected surface streets fitted to the existing arterial and district grid. */
import { cityHills } from './cityNodes.js';
import { inNature } from './nature.js';
import { inRiver, inRiverPark, inWaterBody, riverStreams } from './river.js';

const WIDTH={arterial:22,collector:15,lane:10,alley:6,highway:28};
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5;
const pointOn=(road,t)=>[road.x1+(road.x2-road.x1)*t,road.z1+(road.z2-road.z1)*t];
const closest=(road,point)=>{
  const dx=road.x2-road.x1,dz=road.z2-road.z1,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((point[0]-road.x1)*dx+(point[1]-road.z1)*dz)/length)):0;
  const at=pointOn(road,t);
  return {point:at,distance:Math.hypot(point[0]-at[0],point[1]-at[1])};
};
const distanceToRoads=(roads,point)=>roads.reduce((best,road)=>Math.min(best,closest(road,point).distance-(WIDTH[road.kind]||10)/2),Infinity);

function surfaceClear(extent,streams,hills,x,z){
  if(inNature(extent,x,z)||inRiver(extent,x,z)||inRiverPark(extent,x,z))return false;
  if(hills.some(hill=>Math.hypot(x-hill.x,z-hill.z)<hill.r+2))return false;
  if(!inWaterBody(extent,x,z))return true;
  // The urban plan builds a bridge from each actual stream crossing below.
  return streams.some(stream=>Math.abs(x-stream.x)<stream.width/2+1
    &&z>=Math.min(stream.z1,stream.z2)&&z<=Math.max(stream.z1,stream.z2));
}

function corridorClear(extent,streams,hills,points,width){
  for(let i=1;i<points.length;i++){
    const [x1,z1]=points[i-1],[x2,z2]=points[i];
    const dx=x2-x1,dz=z2-z1,run=Math.hypot(dx,dz);
    if(run<1e-5)return false;
    const nx=-dz/run,nz=dx/run,steps=Math.ceil(run/4);
    for(let step=0;step<=steps;step++)for(const offset of [-width/2,0,width/2]){
      const t=step/steps;
      if(!surfaceClear(extent,streams,hills,x1+dx*t+nx*offset,z1+dz*t+nz*offset))return false;
    }
  }
  return true;
}

function smoothPath(anchors,spacing){
  const points=[anchors[0]];
  for(let i=0;i<anchors.length-1;i++){
    const a=anchors[Math.max(0,i-1)],b=anchors[i],c=anchors[i+1],d=anchors[Math.min(anchors.length-1,i+2)];
    const count=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/spacing));
    for(let j=1;j<=count;j++){
      const t=j/count,t2=t*t,t3=t2*t;
      points.push([0,1].map(axis=>.5*((2*b[axis])+(-a[axis]+c[axis])*t
        +(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t2
        +(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t3)));
    }
  }
  return points;
}

function roadPath(points,kind,id){
  return points.slice(1).map((to,index)=>{
    const from=points[index],dx=to[0]-from[0],dz=to[1]-from[1];
    return {id:`${id}-${index}`,path:id,kind,x1:from[0],z1:from[1],x2:to[0],z2:to[1],
      angle:Math.atan2(dz,dx),length:Math.hypot(dx,dz)};
  });
}

function routeBounds(roads){
  const xs=roads.flatMap(road=>[road.x1,road.x2]),zs=roads.flatMap(road=>[road.z1,road.z2]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  return {x:(minX+maxX)/2,z:(minZ+maxZ)/2,rx:(maxX-minX)/2,rz:(maxZ-minZ)/2};
}

function roadReservations(roads){
  const result=[];
  for(const road of roads){
    const count=Math.ceil(road.length/36),width=(WIDTH[road.kind]||10)/2+2;
    for(let index=0;index<count;index++){
      const a=pointOn(road,index/count),b=pointOn(road,(index+1)/count);
      result.push({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,
        rx:Math.abs(a[0]-b[0])/2+width,rz:Math.abs(a[1]-b[1])/2+width});
    }
  }
  return result;
}

function pocketPlaza(extent,roads,route,streams,hills){
  const radius=12;
  for(let index=Math.floor(route.length/2),attempt=0;attempt<route.length;attempt++){
    const mid=route[(index+attempt)%route.length];
    const center=[(mid.x1+mid.x2)/2,(mid.z1+mid.z2)/2];
    const nx=-Math.sin(mid.angle),nz=Math.cos(mid.angle);
    for(const offset of [42,-42,60,-60,80,-80,105,-105]){
      const point=[center[0]+nx*offset,center[1]+nz*offset];
      if(distanceToRoads(roads,point)<radius+4)continue;
      if([[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>
        !surfaceClear(extent,streams,hills,point[0]+dx,point[1]+dz)))continue;
      return [{x:point[0],z:point[1],r:radius}];
    }
  }
  return [];
}

function adaptAlleys(roads,newRoads){
  const removed=[],retained=[];
  for(const road of roads){
    if(road.kind!=='alley'){retained.push(road);continue;}
    // A local row completely covered by the new paving is redundant. Keep its
    // cross streets, which can meet the new street at their existing junction.
    const replaced=newRoads.some(next=>{
      const turn=Math.abs(Math.atan2(Math.sin(road.angle-next.angle),Math.cos(road.angle-next.angle)));
      if(Math.min(turn,Math.PI-turn)>.26)return false;
      return [[road.x1,road.z1],[road.x2,road.z2]].every(point=>closest(next,point).distance<WIDTH[next.kind]/2);
    });
    (replaced?removed:retained).push(road);
  }
  if(!removed.length)return retained;
  const access=[];
  for(const road of retained.filter(item=>item.kind==='alley'))for(const endpoint of [[road.x1,road.z1],[road.x2,road.z2]]){
    if(!removed.some(old=>closest(old,endpoint).distance<1e-5))continue;
    const nearest=newRoads.map(next=>closest(next,endpoint)).sort((a,b)=>a.distance-b.distance)[0];
    if(!nearest||nearest.distance<1e-5||nearest.distance>24)continue;
    if(access.some(item=>near([item.x1,item.z1],endpoint)))continue;
    const [x2,z2]=nearest.point,dx=x2-endpoint[0],dz=z2-endpoint[1];
    access.push({id:`neighborhood-access-${access.length}`,kind:'alley',x1:endpoint[0],z1:endpoint[1],
      x2,z2,angle:Math.atan2(dz,dx),length:Math.hypot(dx,dz)});
  }
  return [...retained,...access];
}

/** Build deterministic neighborhood roads from real arterial and district endpoints. */
export function createNeighborhoodPlan({extent,roads,districts}){
  const streams=riverStreams(extent),hills=cityHills(extent);
  const endpoint=(path,z)=>{
    const candidates=roads.filter(road=>road.path===path).flatMap(road=>[[road.x1,road.z1],[road.x2,road.z2]]);
    return candidates.sort((a,b)=>Math.abs(a[1]-z)-Math.abs(b[1]-z)||a[0]-b[0])[0];
  };
  const northA=endpoint('art-ns-0',-.75*extent),northB=endpoint('art-ns-1',-.75*extent);
  const southA=endpoint('art-ns-0',.75*extent);
  const civic=districts.find(district=>district.id==='civic');
  const southLane=roads.filter(road=>road.kind==='lane'&&road.district===civic?.id&&road.id?.includes('boundary-east'))
    .flatMap(road=>[[road.x1,road.z1],[road.x2,road.z2]])
    .sort((a,b)=>Math.abs(a[1]-.4*extent)-Math.abs(b[1]-.4*extent))[0];
  if(!northA||!northB||!southA||!southLane)throw new Error('Neighborhood arterial or lane anchor is missing');
  const northAnchors=[northA,[-.23*extent,-.79*extent],[-.1*extent,-.81*extent],
    [.04*extent,-.8*extent],[.18*extent,-.76*extent],northB];
  const southAnchors=[southA,[-.15*extent,.70*extent],[.06*extent,.59*extent],
    [.23*extent,.47*extent],southLane,[northB[0],southLane[1]]];
  const northern=smoothPath(northAnchors,Math.max(16,extent/70));
  const southern=smoothPath(southAnchors,Math.max(16,extent/70));
  if(!corridorClear(extent,streams,hills,northern,WIDTH.lane)
    ||!corridorClear(extent,streams,hills,southern,WIDTH.collector))
    throw new Error(`No supported neighborhood road corridor at extent ${extent}`);
  const northRoads=roadPath(northern,'lane','neighborhood-north-loop');
  const southRoads=roadPath(southern,'collector','neighborhood-south-diagonal');
  const allNew=[...northRoads,...southRoads];
  const allRoads=adaptAlleys(roads,allNew).concat(allNew);
  const neighborhoods=[
    {id:'north',kind:'north',bounds:routeBounds(northRoads),pathIds:['neighborhood-north-loop'],
      plazas:pocketPlaza(extent,allRoads,northRoads,streams,hills)},
    {id:'south',kind:'south',bounds:routeBounds(southRoads),pathIds:['neighborhood-south-diagonal'],
      plazas:pocketPlaza(extent,allRoads,southRoads,streams,hills)},
  ];
  const reservations=[...roadReservations(allNew),...neighborhoods.flatMap(n=>n.plazas.map(p=>({x:p.x,z:p.z,rx:p.r,rz:p.r})))];
  return {roads:allRoads,neighborhoods,reservations};
}
