/** 곡선 폴리라인 헬퍼다. 도로는 이미 꺾은선(폴리라인)이라 여기서는 꼭짓점을
 * 둥글리는 계산, 방위 보간, 세그먼트 근접 검사용 격자 색인만 만든다.
 * Three, React, 브라우저 API 에 의존하지 않는 순수 함수다.
 * 각도 규약은 urbanPlan.js 의 pointOnRoute 와 같다. Math.atan2(dx, dz) 이고
 * 0 이면 +Z(dz>0, dx=0), PI/2 면 +X 를 본다.
 */

/** 두 점을 비율 t 로 잇는다. */
const lerpPoint=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

/** 각도 차이를 [-PI, PI] 로 접는다. 보간과 연속성 판정에 쓴다. */
const angleDiff=(from,to)=>{
  let diff=(to-from)%(Math.PI*2);
  if(diff>Math.PI)diff-=Math.PI*2;
  if(diff<-Math.PI)diff+=Math.PI*2;
  return diff;
};

/** 최단 방향으로 두 각도를 비율 t 로 잇는다. */
const lerpAngle=(from,to,t)=>from+angleDiff(from,to)*t;

/** 두 각도의 최단 방향 평균이다. 꼭짓점 좌우 현을 이을 때 쓴다. */
const averageAngle=(a,b)=>lerpAngle(a,b,.5);

/** points[index] -> points[index+1] 현의 진행 방위다. pointOnRoute 와 같은 규약이다. */
const chordAngle=(points,index)=>Math.atan2(points[index+1][0]-points[index][0],points[index+1][1]-points[index][1]);

/** 2차 베지어를 steps+1 개의 [x, z] 로 편다. 첫 점은 a, 끝 점은 b 와 정확히 같다. */
export function quadratic(a,control,b,steps){
  const n=Math.max(1,Math.trunc(steps)||1),out=[];
  for(let i=0;i<=n;i++){
    const t=i/n,mt=1-t;
    out.push([mt*mt*a[0]+2*mt*t*control[0]+t*t*b[0],mt*mt*a[1]+2*mt*t*control[1]+t*t*b[1]]);
  }
  return out;
}

/** 꺾은선 하나의 꼭짓점 하나를 둥글릴 때 각 변에서 잘라내는 비율이다.
 * 인접한 두 변에서 각자 이 비율만큼만 잘라내므로 합쳐도 변 하나를 넘지 않는다. */
const CORNER_CUT=.35;

/** 꺾은선의 각 꼭짓점을 둥글려 곡선 점 목록으로 바꾼다. 끝점은 유지한다.
 * 점이 2개 이하면(꼭짓점이 없으면) 원본을 그대로 복사해 돌려준다. */
export function smoothPath(points,steps){
  if(!Array.isArray(points)||points.length<3)return (points||[]).map(p=>[p[0],p[1]]);
  const out=[[points[0][0],points[0][1]]];
  for(let i=1;i<points.length-1;i++){
    const prev=points[i-1],curr=points[i],next=points[i+1];
    const lenPrev=Math.hypot(curr[0]-prev[0],curr[1]-prev[1]);
    const lenNext=Math.hypot(next[0]-curr[0],next[1]-curr[1]);
    const cut=Math.min(lenPrev,lenNext)*CORNER_CUT;
    const from=lenPrev>1e-9?lerpPoint(curr,prev,cut/lenPrev):[curr[0],curr[1]];
    const to=lenNext>1e-9?lerpPoint(curr,next,cut/lenNext):[curr[0],curr[1]];
    const arc=quadratic(from,curr,to,steps);
    out.push(from);
    for(let k=1;k<arc.length-1;k++)out.push(arc[k]);
    out.push(to);
  }
  out.push([points[points.length-1][0],points[points.length-1][1]]);
  return out;
}

/** 모서리 원호다. 고속도로 순환선처럼 중심과 반지름, 시작과 끝 방위(라디안)를 안다.
 * from 에서 to 까지 최단 방향으로 steps+1 개의 [x, z] 를 돌려준다. */
export function arcCorner(centre,radius,from,to,steps){
  const n=Math.max(1,Math.trunc(steps)||1),sweep=angleDiff(from,to),out=[];
  for(let i=0;i<=n;i++){
    const angle=from+sweep*(i/n);
    out.push([centre[0]+radius*Math.sin(angle),centre[1]+radius*Math.cos(angle)]);
  }
  return out;
}

/** index 번째 현 위의 비율 t 에서의 진행 방위다. 이웃 현과 최단 방향으로 평균 내
 * 꼭짓점 경계에서 두 현이 만나는 값이 정확히 일치하게 해 방위가 튀지 않는다. */
export function angleAt(points,index,t){
  const segCount=points.length-1,i=Math.max(0,Math.min(segCount-1,Math.trunc(index))),localT=Math.max(0,Math.min(1,t));
  const current=chordAngle(points,i);
  if(localT<=.5){
    const prev=i>0?chordAngle(points,i-1):current;
    return lerpAngle(averageAngle(prev,current),current,localT/.5);
  }
  const next=i<segCount-1?chordAngle(points,i+1):current;
  return lerpAngle(current,averageAngle(current,next),(localT-.5)/.5);
}

/** 도로 세그먼트를 균일 격자에 넣는 색인이다. near(x, z, radius) 는 그 반경 안에
 * 들어올 수 있는 세그먼트만 돌려주는 광역 필터다(정확한 거리 계산은 호출자 몫이다).
 * 세그먼트는 자신의 경계 상자가 걸치는 모든 칸에 등록하고, near 는 질의 상자가
 * 걸치는 모든 칸을 모아 합집합을 돌려준다. 두 상자가 실수 좌표에서 겹치면 같은
 * 정수 칸을 반드시 공유하므로(겹치는 실수점 하나의 floor 가 둘 다에 속한다),
 * 전수 검사로 나올 세그먼트를 하나도 놓치지 않는다. */
export function createSegmentIndex(segments,cell){
  const size=Math.max(1e-6,Number(cell)||1),buckets=new Map(),key=(ix,iz)=>`${ix},${iz}`;
  const list=Array.isArray(segments)?segments:[];
  for(const seg of list){
    const minX=Math.min(seg.x1,seg.x2),maxX=Math.max(seg.x1,seg.x2);
    const minZ=Math.min(seg.z1,seg.z2),maxZ=Math.max(seg.z1,seg.z2);
    const ix0=Math.floor(minX/size),ix1=Math.floor(maxX/size),iz0=Math.floor(minZ/size),iz1=Math.floor(maxZ/size);
    for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){
      const k=key(ix,iz);
      (buckets.get(k)||buckets.set(k,[]).get(k)).push(seg);
    }
  }
  return {
    near(x,z,radius){
      const ix0=Math.floor((x-radius)/size),ix1=Math.floor((x+radius)/size);
      const iz0=Math.floor((z-radius)/size),iz1=Math.floor((z+radius)/size);
      const seen=new Set(),out=[];
      for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){
        const bucket=buckets.get(key(ix,iz));
        if(!bucket)continue;
        for(const seg of bucket){
          if(seen.has(seg))continue;
          seen.add(seg);
          out.push(seg);
        }
      }
      return out;
    },
  };
}
