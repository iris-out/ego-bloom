/** Pure ribbon geometry shared by road rendering, clearance, and physics. Input
 * points are [x,z,y,width,transverse?], where transverse is an optional canonical
 * horizontal [x,z] direction. All returned geometry uses world [x,y,z]. */

const EPS=1e-9;
const MITER_LIMIT=4;

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=(v)=>Math.hypot(v[0],v[1],v[2]);

function horizontalDirection(points,index,step){
  for(let next=index+step;next>=0&&next<points.length;next+=step){
    const dx=step<0?points[index][0]-points[next][0]:points[next][0]-points[index][0];
    const dz=step<0?points[index][1]-points[next][1]:points[next][1]-points[index][1];
    const run=Math.hypot(dx,dz);
    if(run>EPS)return [dx/run,dz/run];
  }
  return null;
}

function transverse(points,index,halfWidth){
  const explicit=points[index]?.[4];
  if(Array.isArray(explicit)&&Number.isFinite(explicit[0])&&Number.isFinite(explicit[1])){
    const run=Math.hypot(explicit[0],explicit[1]);
    if(run>EPS)return [explicit[0]*halfWidth/run,explicit[1]*halfWidth/run];
  }
  const incoming=horizontalDirection(points,index,-1),outgoing=horizontalDirection(points,index,1);
  if(!incoming&&!outgoing)return [halfWidth,0];
  if(!incoming)return [-outgoing[1]*halfWidth,outgoing[0]*halfWidth];
  if(!outgoing)return [-incoming[1]*halfWidth,incoming[0]*halfWidth];
  const before=[-incoming[1],incoming[0]],after=[-outgoing[1],outgoing[0]];
  let mx=before[0]+after[0],mz=before[1]+after[1],run=Math.hypot(mx,mz);
  if(run<=EPS){mx=before[0];mz=before[1];run=1;}
  mx/=run;mz/=run;
  let alignment=mx*before[0]+mz*before[1];
  if(alignment<0){mx=-mx;mz=-mz;alignment=-alignment;}
  const reach=Math.min(halfWidth/Math.max(alignment,EPS),halfWidth*MITER_LIMIT);
  return [mx*reach,mz*reach];
}

const normalY=([a,b,c])=>(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
const triangleArea2=([a,b,c])=>length(cross(sub(b,a),sub(c,a)));
const faceUp=(triangle)=>normalY(triangle)<0?[triangle[0],triangle[2],triangle[1]]:triangle;

export function roadRibbon(points,{width=15.4,inset=0,offsetY=0}={}){
  const source=Array.isArray(points)?points:[];
  const sections=source.map((point,index)=>{
    const sourceWidth=Number.isFinite(point[3])?point[3]:width;
    const effectiveWidth=Math.max(0,sourceWidth-2*inset),half=effectiveWidth/2;
    const center=[point[0],point[2]+offsetY,point[1]],offset=transverse(source,index,half);
    return {center,left:[center[0]+offset[0],center[1],center[2]+offset[1]],
      right:[center[0]-offset[0],center[1],center[2]-offset[1]],width:effectiveWidth};
  });
  const spans=[];
  for(let index=1;index<sections.length;index++){
    const previous=sections[index-1],next=sections[index];
    if(Math.hypot(next.center[0]-previous.center[0],next.center[2]-previous.center[2])<=EPS)continue;
    const candidates=[faceUp([previous.left,next.left,previous.right]),faceUp([previous.right,next.left,next.right])];
    const triangles=candidates.filter(triangle=>triangleArea2(triangle)>EPS);
    spans.push({a:previous.center,b:next.center,leftA:previous.left,rightA:previous.right,
      leftB:next.left,rightB:next.right,triangles});
  }
  return {sections,spans,triangles:spans.flatMap(span=>span.triangles)};
}
