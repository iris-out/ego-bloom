/** Pure canonical road topology. The renderer keeps the original road array, while
 * this module splits its geometry at real same-height joins so routing, clearance,
 * and diagnostics can share stable nodes and links. */

const EPS=1e-6;
const NODE_EPS=1e-5;
const RAMP_HANDOFF_EPS=.05;
const CELL=96;
const WIDTH=Object.freeze({arterial:22,collector:15,lane:10,alley:6,highway:28,ramp:15.4});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const pointAt=(line,t)=>({
  x:line.x1+(line.x2-line.x1)*t,
  z:line.z1+(line.z2-line.z1)*t,
  y:line.y1+(line.y2-line.y1)*t,
});
const levelOf=(road)=>road.elevated?'elevated':road.tunnel?'tunnel':'ground';
const heightOf=(road)=>Number.isFinite(road.deckY)?road.deckY+.6:Number.isFinite(road.y)?road.y:.33;
const coordinateKey=(x,z,y)=>`${Math.round(x/NODE_EPS)}:${Math.round(z/NODE_EPS)}:${Math.round(y/NODE_EPS)}`;

function primitive(road,index,part=0,points=null){
  const a=points?.[part]?[points[part][0],points[part][1],points[part][2]+.6,points[part][3]]
    :[road.x1,road.z1,heightOf(road),road.width];
  const b=points?.[part+1]?[points[part+1][0],points[part+1][1],points[part+1][2]+.6,points[part+1][3]]
    :[road.x2,road.z2,heightOf(road),road.width];
  const sourceId=String(road.id||road.path||`${road.kind||'road'}-${index}`);
  return {
    x1:a[0],z1:a[1],y1:Number.isFinite(a[2])?a[2]:heightOf(road),
    x2:b[0],z2:b[1],y2:Number.isFinite(b[2])?b[2]:heightOf(road),
    width:Number.isFinite(a[3])&&Number.isFinite(b[3])?Math.min(a[3],b[3]):(road.width||WIDTH[road.kind]||8),
    kind:road.kind||'road',level:levelOf(road),source:road,sourceId,index,part,
    id:`${sourceId}:${index}:${part}`,
  };
}

function primitivesOf(roads,ramps){
  const lines=roads.map((road,index)=>primitive(road,index));
  for(const [rampIndex,ramp] of ramps.entries()){
    const points=ramp.points||[[ramp.from.x,ramp.from.z,ramp.from.y,ramp.width],[ramp.to.x,ramp.to.z,ramp.to.y,ramp.width]];
    for(let part=0;part<points.length-1;part++){
      const line=primitive({...ramp,id:`ramp-${rampIndex}`,kind:'ramp'},roads.length+rampIndex,part,points);
      line.level='ramp';lines.push(line);
    }
  }
  return lines;
}

function makeSpatialIndex(lines,cell=CELL){
  const buckets=new Map(),key=(x,z)=>`${x}:${z}`;
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    const x0=Math.floor(Math.min(line.x1,line.x2)/cell),x1=Math.floor(Math.max(line.x1,line.x2)/cell);
    const z0=Math.floor(Math.min(line.z1,line.z2)/cell),z1=Math.floor(Math.max(line.z1,line.z2)/cell);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      const id=key(x,z);(buckets.get(id)||buckets.set(id,[]).get(id)).push(index);
    }
  }
  return buckets;
}

function intersections(a,b){
  const rx=a.x2-a.x1,rz=a.z2-a.z1,sx=b.x2-b.x1,sz=b.z2-b.z1;
  const den=rx*sz-rz*sx,qx=b.x1-a.x1,qz=b.z1-a.z1;
  if(Math.abs(den)>EPS){
    const t=(qx*sz-qz*sx)/den,u=(qx*rz-qz*rx)/den;
    if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)return [[clamp(t,0,1),clamp(u,0,1)]];
    return [];
  }
  // Parallel roads join only where an endpoint lies on the other centerline.
  // Projecting both directions makes contained overlaps independent of input order.
  const out=[];
  const add=(t,u)=>{
    t=clamp(t,0,1);u=clamp(u,0,1);
    if(!out.some(([at,au])=>Math.abs(at-t)<=EPS&&Math.abs(au-u)<=EPS))out.push([t,u]);
  };
  const project=(x,z,line)=>{
    const dx=line.x2-line.x1,dz=line.z2-line.z1,len=dx*dx+dz*dz;
    const t=len?((x-line.x1)*dx+(z-line.z1)*dz)/len:0;
    return {t,gap:Math.hypot(x-(line.x1+dx*t),z-(line.z1+dz*t))};
  };
  for(const [t,x,z] of [[0,a.x1,a.z1],[1,a.x2,a.z2]]){
    const hit=project(x,z,b);if(hit.t>=-EPS&&hit.t<=1+EPS&&hit.gap<=EPS)add(t,hit.t);
  }
  for(const [u,x,z] of [[0,b.x1,b.z1],[1,b.x2,b.z2]]){
    const hit=project(x,z,a);if(hit.t>=-EPS&&hit.t<=1+EPS&&hit.gap<=EPS)add(hit.t,u);
  }
  return out;
}

const differentGrade=(a,b,t,u)=>Math.abs((a.y1+(a.y2-a.y1)*t)-(b.y1+(b.y2-b.y1)*u))>NODE_EPS;

function rampSeams(lines){
  const seams=[];
  const roadLines=lines.filter(line=>line.kind!=='ramp');
  const rampLines=lines.filter(line=>line.kind==='ramp');
  const rampGroups=new Map();
  for(const line of rampLines)(rampGroups.get(line.index)||rampGroups.set(line.index,[]).get(line.index)).push(line);
  for(const group of rampGroups.values()){
    group.sort((a,b)=>a.part-b.part);
    for(const [line,t] of [[group[0],0],[group[group.length-1],1]]){
      const point=pointAt(line,t);let best=null;
      for(const road of roadLines){
        const dx=road.x2-road.x1,dz=road.z2-road.z1,len=dx*dx+dz*dz||1;
        const u=clamp(((point.x-road.x1)*dx+(point.z-road.z1)*dz)/len,0,1);
        const at=pointAt(road,u),distance=Math.hypot(point.x-at.x,point.z-at.z);
        const width=line.width+road.width;
        if(Math.abs(point.y-at.y)>RAMP_HANDOFF_EPS||distance>width/2+.05)continue;
        if(!best||distance<best.distance)best={road,u,at,distance};
      }
      if(best&&best.distance>EPS)seams.push({
        x1:point.x,z1:point.z,y1:point.y,x2:best.at.x,z2:best.at.z,y2:best.at.y,
        width:Math.min(line.width,best.road.width),kind:'ramp',level:'ramp',
        source:line.source,sourceId:line.sourceId,index:line.index,part:`seam-${t}`,id:`${line.sourceId}:${line.index}:seam-${t}`,
      });
    }
  }
  return seams;
}

/** Build a height-aware graph from road centerlines and ramp polylines. */
export function buildRoadNetwork({roads=[],ramps=[]}={}){
  const lines=primitivesOf(roads,ramps);
  lines.push(...rampSeams(lines));
  const cuts=lines.map(()=>[0,1]),joinPoints=new Map(),buckets=makeSpatialIndex(lines),pairs=new Set();
  const cutKey=(index,t)=>`${index}:${Math.round(clamp(t,0,1)*1e9)}`;
  for(const members of buckets.values())for(let a=0;a<members.length;a++)for(let b=a+1;b<members.length;b++){
    const i=members[a],j=members[b];if(i===j)continue;
    const pair=i<j?`${i}:${j}`:`${j}:${i}`;if(pairs.has(pair))continue;pairs.add(pair);
    // Consecutive pieces from the same source already share endpoints; treating
    // them normally keeps those endpoints in the graph without special cases.
    for(const [t,u] of intersections(lines[i],lines[j])){
      if(differentGrade(lines[i],lines[j],t,u))continue;
      cuts[i].push(t);cuts[j].push(u);
      const a=pointAt(lines[i],t),b=pointAt(lines[j],u);
      const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
      joinPoints.set(cutKey(i,t),{x,z,y:a.y});joinPoints.set(cutKey(j,u),{x,z,y:b.y});
    }
  }
  const nodes=[],nodeByKey=new Map(),links=[],lineByLink=new Map();
  const nodeFor=(point)=>{
    const key=coordinateKey(point.x,point.z,point.y);
    let node=nodeByKey.get(key);
    if(!node){node={id:`node-${key}`,x:point.x,z:point.z,y:point.y,links:[]};nodeByKey.set(key,node);nodes.push(node);}
    return node;
  };
  for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
    const line=lines[lineIndex];
    const ordered=cuts[lineIndex].map(t=>clamp(t,0,1)).sort((a,b)=>a-b)
      .filter((t,index,list)=>index===0||Math.abs(t-list[index-1])>EPS);
    for(let part=1;part<ordered.length;part++){
      const ta=ordered[part-1],tb=ordered[part];
      const a=joinPoints.get(cutKey(lineIndex,ta))||pointAt(line,ta);
      const b=joinPoints.get(cutKey(lineIndex,tb))||pointAt(line,tb);
      if(Math.hypot(b.x-a.x,b.z-a.z)<EPS)continue;
      const from=nodeFor(a),to=nodeFor(b),link={
        id:`link-${line.id}-${part-1}`,from:from.id,to:to.id,
        x1:a.x,z1:a.z,y1:a.y,x2:b.x,z2:b.z,y2:b.y,
        kind:line.kind,level:line.level,width:line.width,sourceId:line.sourceId,sourceIndex:line.index,
      };
      links.push(link);lineByLink.set(link.id,line);from.links.push(link.id);to.links.push(link.id);
    }
  }
  const nodeMap=new Map(nodes.map(node=>[node.id,node]));
  const linkMap=new Map(links.map(link=>[link.id,link]));
  const adjacency=new Map(nodes.map(node=>[node.id,[]]));
  for(const link of links){adjacency.get(link.from).push(link.to);adjacency.get(link.to).push(link.from);}
  const components=[];const seen=new Set();
  for(const node of nodes){
    if(seen.has(node.id))continue;
    const stack=[node.id],memberNodes=[];seen.add(node.id);
    while(stack.length){const id=stack.pop();memberNodes.push(id);for(const next of adjacency.get(id))if(!seen.has(next)){seen.add(next);stack.push(next);}}
    const memberLinks=new Set(memberNodes.flatMap(id=>nodeMap.get(id).links));
    components.push({id:`component-${components.length}`,nodes:memberNodes,links:[...memberLinks]});
  }
  components.sort((a,b)=>b.links.length-a.links.length||a.id.localeCompare(b.id));
  const primary=components[0]||null;
  const openEnds=nodes.filter(node=>node.links.length===1).map(node=>{
    const link=linkMap.get(node.links[0]);
    const line=lineByLink.get(link.id);
    const atOut=line&&Math.hypot(node.x-line.x2,node.z-line.z2)<=EPS;
    const intentional=Boolean(line?.source?.deadEndReason||(atOut&&line?.source?.deadEnd)||(!atOut&&line?.source?.deadEndIn)||(atOut&&line?.source?.deadEndOut));
    return {node:node.id,x:node.x,z:node.z,y:node.y,kind:link.kind,link:link.id,intentional,
      reason:line?.source?.deadEndReason||line?.source?.deadEndIn||line?.source?.deadEndOut||(atOut&&line?.source?.deadEnd?'designed':null)};
  });
  return {nodes,links,components,primaryComponent:primary?.id||null,disconnected:components.slice(1),openEnds};
}

/** Find one real centerline connector from every detached surface component to
 * the largest component. Callers decide whether a proposed corridor is legal
 * (water, nature, and public-site rules stay outside this geometry module). */
export function surfaceConnectors(roads,{canConnect=()=>true,maxDistance=220,graph=buildRoadNetwork({roads})}={}){
  if(graph.components.length<2)return [];
  const linkById=new Map(graph.links.map(link=>[link.id,link]));
  const sourceIndexes=(component)=>new Set(component.links.map(id=>linkById.get(id)?.sourceIndex).filter(Number.isInteger));
  const attached=sourceIndexes(graph.components[0]),connectors=[],buckets=makeSpatialIndex(roads);
  const nearby=(point)=>{
    const indexes=new Set();
    const x0=Math.floor((point.x-maxDistance)/CELL),x1=Math.floor((point.x+maxDistance)/CELL);
    const z0=Math.floor((point.z-maxDistance)/CELL),z1=Math.floor((point.z+maxDistance)/CELL);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const index of buckets.get(`${x}:${z}`)||[])
      if(attached.has(index))indexes.add(index);
    return indexes;
  };
  const endpoints=(indexes)=>[...indexes].flatMap(index=>{
    const road=roads[index];
    return [{x:road.x1,z:road.z1,index,side:'in'},{x:road.x2,z:road.z2,index,side:'out'}];
  });
  for(const component of graph.components.slice(1)){
    const detached=sourceIndexes(component);let best=null;
    for(const point of endpoints(detached)){
      const source=roads[point.index];
      const reason=point.side==='in'?source.deadEndIn:source.deadEndOut;
      if(point.side==='out'&&source.deadEnd||reason==='constraint')continue;
      for(const targetIndex of nearby(point)){
        const target=roads[targetIndex];
        const dx=target.x2-target.x1,dz=target.z2-target.z1,len=dx*dx+dz*dz||1;
        const t=clamp(((point.x-target.x1)*dx+(point.z-target.z1)*dz)/len,0,1);
        const x=target.x1+dx*t,z=target.z1+dz*t,distance=Math.hypot(x-point.x,z-point.z);
        if(distance<=EPS||distance>maxDistance)continue;
        const axisAligned=Math.abs(x-point.x)<=EPS||Math.abs(z-point.z)<=EPS;
        const candidate={x1:point.x,z1:point.z,x2:x,z2:z,length:distance,axisAligned,component:component.id};
        if(!canConnect(candidate,source,target))continue;
        if(!best||(axisAligned&&!best.axisAligned)||(axisAligned===best.axisAligned&&distance<best.length))best=candidate;
      }
    }
    if(!best)continue;
    connectors.push(best);
    for(const index of detached)attached.add(index);
  }
  return connectors;
}

/** Short centerline seams for road surfaces whose paved widths already touch. */
export function surfaceEdgeSeams(roads,{canConnect=()=>true,graph=buildRoadNetwork({roads})}={}){
  const linkById=new Map(graph.links.map(link=>[link.id,link])),buckets=makeSpatialIndex(roads);
  const reach=(WIDTH.alley+Math.max(...Object.values(WIDTH)))/2+.05,seams=[];
  for(const end of graph.openEnds){
    if(end.kind!=='alley'||end.intentional)continue;
    const link=linkById.get(end.link),source=roads[link?.sourceIndex];if(!source)continue;
    const candidates=new Set();
    const x0=Math.floor((end.x-reach)/CELL),x1=Math.floor((end.x+reach)/CELL);
    const z0=Math.floor((end.z-reach)/CELL),z1=Math.floor((end.z+reach)/CELL);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const index of buckets.get(`${x}:${z}`)||[])candidates.add(index);
    let best=null;
    for(const targetIndex of candidates){
      const target=roads[targetIndex];if(target===source||target.kind==='alley')continue;
      const dx=target.x2-target.x1,dz=target.z2-target.z1,len=dx*dx+dz*dz||1;
      const t=clamp(((end.x-target.x1)*dx+(end.z-target.z1)*dz)/len,0,1);
      const x=target.x1+dx*t,z=target.z1+dz*t,distance=Math.hypot(x-end.x,z-end.z);
      if(distance<=EPS||distance>(WIDTH.alley+(WIDTH[target.kind]||8))/2+.05)continue;
      const candidate={x1:end.x,z1:end.z,x2:x,z2:z,length:distance};
      if(!canConnect(candidate,source,target)||best&&best.length<=distance)continue;
      best=candidate;
    }
    if(best)seams.push(best);
  }
  return seams;
}
