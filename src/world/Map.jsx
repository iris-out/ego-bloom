import { useEffect, useMemo, useRef } from 'react';
import { getWorldBounds } from '../../shared/worldLayout.js';
import { createUrbanPlan } from '../../shared/urbanPlan.js';
import { bridgeSegment } from '../../shared/bridgeGeometry.js';
import { beachStrips } from '../../shared/coast.js';
import { mapPoint } from './data';
import { CREATOR_TIERS } from '../design/tiers';

const CAMERA_MARKER_INTERVAL = 250; // ms. 초당 4회 정도로 현재 위치 원만 갱신한다.

const ORIGIN_REF = { current: { x: 0, z: 0 } };

// [x, z] 점 목록을 지도 좌표계의 SVG path 문자열로 편다. 강 곡선과 지하철 노선이 같이 쓴다.
const pathFromPoints = (points, bounds) => points.map((p, index) => {
  const m = mapPoint({ x: p[0], z: p[1] }, bounds);
  return `${index === 0 ? 'M' : 'L'}${m.x} ${m.y}`;
}).join('');

// 해변 띠 사각형의 네 꼭짓점을 지도 좌표로 편다. angle 0 이면 x 축을 따라 눕고, 아니면 z 축을 따라 눕는다.
function beachPolygon(strip, bounds) {
  const halfLen = strip.length / 2, halfWide = strip.width / 2;
  const corners = strip.angle === 0
    ? [[strip.x - halfLen, strip.z - halfWide], [strip.x + halfLen, strip.z - halfWide], [strip.x + halfLen, strip.z + halfWide], [strip.x - halfLen, strip.z + halfWide]]
    : [[strip.x - halfWide, strip.z - halfLen], [strip.x + halfWide, strip.z - halfLen], [strip.x + halfWide, strip.z + halfLen], [strip.x - halfWide, strip.z + halfLen]];
  return corners.map(([x, z]) => { const m = mapPoint({ x, z }, bounds); return `${m.x},${m.y}`; }).join(' ');
}

const NATURE_ARC_STEPS = 16;

// 모서리 자연지대(산, 계곡, 사구, 호수) 사분원을 부채꼴 폴리곤으로 편다. 중심에서 두 반지름
// 사이 호를 원점 쪽으로 그리면 자연지대가 도시 안쪽을 향하는 모양이 된다.
function natureFanPoints(corner, bounds) {
  const { x, z, r } = corner;
  const dx = x >= 0 ? -1 : 1, dz = z >= 0 ? -1 : 1;
  const centre = mapPoint({ x, z }, bounds);
  const arc = Array.from({ length: NATURE_ARC_STEPS + 1 }, (_, i) => {
    const theta = (i / NATURE_ARC_STEPS) * (Math.PI / 2);
    const point = mapPoint({ x: x + dx * r * Math.cos(theta), z: z + dz * r * Math.sin(theta) }, bounds);
    return `${point.x},${point.y}`;
  });
  return `${centre.x},${centre.y} ${arc.join(' ')}`;
}

// 현재 위치 원을 SVG 밖 컴포넌트로 떼어, 카메라가 움직여도 정적 레이어(도로 126개 등)가 다시 그려지지 않게 한다.
function CameraMarker({ cameraRef = ORIGIN_REF, bounds }) {
  const circleRef = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const point = mapPoint(cameraRef.current, bounds);
      const node = circleRef.current;
      if (!node) return;
      node.setAttribute('cx', String(Math.max(1, Math.min(99, point.x))));
      node.setAttribute('cy', String(Math.max(1, Math.min(99, point.y))));
    }, CAMERA_MARKER_INTERVAL);
    return () => clearInterval(timer);
  }, [cameraRef, bounds]);
  return <circle ref={circleRef} r="1.3" fill="var(--fg)" stroke="var(--bg)" strokeWidth=".5" />;
}

export default function WorldMap({buildings, selected, cameraRef, onFocus, onSelect, onAirport, compact=false}) {
  const bounds=useMemo(()=>getWorldBounds(buildings),[buildings]);
  const extent=Math.max(180,...buildings.map(b=>b.cityExtent||Math.max(Math.abs(b.x),Math.abs(b.z))+40));
  const plan=useMemo(()=>createUrbanPlan(extent),[extent]);

  // 정적 레이어: bounds 와 plan 이 바뀔 때만 다시 만든다. 선택 표시와 현재 위치만 자주 바뀐다.
  const staticLayers=useMemo(()=>{
    const paths={};
    for (const b of buildings) {
      const p=mapPoint(b,bounds), tier=(b.tier_name||'bronze').toLowerCase();
      paths[tier]=(paths[tier]||'')+`M${p.x-0.35},${p.y-0.35}h.7v.7h-.7z`;
    }
    return {
      paths,
      river: pathFromPoints(plan.riverLine,bounds),
      airports: [1,-1].map(side=>({side,point:mapPoint({x:side*(extent+110),z:0},bounds)})),
      districts: plan.districts.map(d=>{const p=mapPoint(d,bounds),edge=mapPoint({x:d.x+d.rx,z:d.z+d.rz},bounds);return {id:d.id,cx:p.x,cy:p.y,rx:Math.abs(edge.x-p.x),ry:Math.abs(edge.y-p.y),color:d.color};}),
      roads: plan.roads.filter(road=>road.kind!=='highway').map(road=>({a:mapPoint({x:road.x1,z:road.z1},bounds),b:mapPoint({x:road.x2,z:road.z2},bounds),kind:road.kind})),
      highways: plan.roads.filter(road=>road.kind==='highway').map(road=>({a:mapPoint({x:road.x1,z:road.z1},bounds),b:mapPoint({x:road.x2,z:road.z2},bounds),tunnel:!!road.tunnel})),
      ramps: (plan.ramps||[]).map(ramp=>{
        const points=Array.isArray(ramp.points)&&ramp.points.length>=2
          ? ramp.points
          : [[ramp.from.x,ramp.from.z],[ramp.to.x,ramp.to.z],...(ramp.merge?[[ramp.merge.x,ramp.merge.z]]:[])];
        return {d:pathFromPoints(points,bounds),kind:ramp.kind};
      }),
      bridges: (plan.bridges||[]).map(bridge=>{
        const segment=bridgeSegment(bridge);
        return {a:mapPoint({x:segment.x1,z:segment.z1},bounds),b:mapPoint({x:segment.x2,z:segment.z2},bounds),big:!!bridge.big};
      }),
      subway: plan.subway.lines.map(line=>({id:line.id,color:line.color,d:pathFromPoints(line.points,bounds)})),
      beaches: beachStrips(extent).map(strip=>beachPolygon(strip,bounds)),
      parks: plan.parks.map(park=>mapPoint(park,bounds)),
      landmarks: plan.landmarks.map(mark=>mapPoint(mark,bounds)),
      // 아직 나들목 재설계가 끝나지 않은 plan 을 받아도 지도가 깨지지 않도록 없으면 빈 배열로 둔다.
      nature: (plan.nature||[]).map(corner=>({key:corner.key,points:natureFanPoints(corner,bounds)})),
      ponds: (plan.ponds||[]).map(pond=>{
        const p=mapPoint(pond,bounds),edge=mapPoint({x:pond.x+pond.rx,z:pond.z+pond.rz},bounds);
        return {cx:p.x,cy:p.y,rx:Math.abs(edge.x-p.x),ry:Math.abs(edge.y-p.y)};
      }),
    };
  },[buildings,bounds,plan,extent]);

  const selection=selected ? mapPoint(selected,bounds) : null;
  const visit=(event)=> {
    const rect=event.currentTarget.getBoundingClientRect();
    const x=bounds.minX+(event.clientX-rect.left)/rect.width*(bounds.maxX-bounds.minX);
    const z=bounds.minZ+(event.clientY-rect.top)/rect.height*(bounds.maxZ-bounds.minZ);
    if(Math.abs(Math.abs(x)-(extent+110))<40 && Math.abs(z)<275){onAirport?.();return;}
    let closest=null, distance=Infinity;
    for (const b of buildings) {
      const d=Math.hypot(b.x-x,b.z-z);
      if(d<distance){closest=b;distance=d;}
    }
    if(closest && distance<(bounds.maxX-bounds.minX)*.035) onSelect(closest);
    else onFocus({x,z});
  };
  return <section className={compact?"world-map world-map-compact":"world-map"} aria-label="도시 전체 지도">
    <div className="world-map-heading"><span>도시 전체 지도</span><span>N ↑</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="전체 제작자 위치. 지도를 누르면 해당 위치로 이동합니다." onClick={visit}>
      <rect width="100" height="100" fill="var(--surface-2)" />
      {staticLayers.nature.map(n=><polygon key={n.key} points={n.points} fill="var(--nature)" opacity=".18"/>)}
      {staticLayers.beaches.map((points,index)=><polygon key={index} points={points} fill="var(--t-bronze)" opacity=".25"/>)}
      {staticLayers.districts.map(d=><ellipse key={d.id} cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry} fill={d.color} opacity=".12"/>)}
      <path d={staticLayers.river} fill="none" stroke="var(--t-platinum)" strokeWidth="1.1" opacity=".4" />
      {staticLayers.ponds.map((p,index)=><ellipse key={index} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill="var(--t-platinum)" opacity=".35"/>)}
      {staticLayers.roads.map((road,index)=><path key={index} d={`M${road.a.x} ${road.a.y}L${road.b.x} ${road.b.y}`} stroke="var(--fg-3)" strokeWidth={road.kind==='arterial'?'.75':road.kind==='collector'?'.45':'.22'} opacity={road.kind==='alley'?'.28':'.48'}/>)}
      {staticLayers.highways.map((road,index)=><path key={index} d={`M${road.a.x} ${road.a.y}L${road.b.x} ${road.b.y}`} stroke="var(--warn)" strokeWidth="1.1" opacity=".6" strokeDasharray={road.tunnel?'1.6 1.1':undefined}/>)}
      {staticLayers.ramps.map((ramp,index)=><path key={`ramp-${index}`} d={ramp.d} fill="none" stroke="var(--warn)" strokeWidth={ramp.kind==='portal'?'.8':'.55'} opacity=".72"/>)}
      {staticLayers.bridges.map((bridge,index)=><path key={`bridge-${index}`} d={`M${bridge.a.x} ${bridge.a.y}L${bridge.b.x} ${bridge.b.y}`} fill="none" stroke="var(--fg-2)" strokeWidth={bridge.big?'1.35':'.9'} opacity=".9"/>)}
      {staticLayers.subway.map(line=><path key={line.id} d={line.d} fill="none" stroke={line.color} strokeWidth=".55" opacity=".85"/>)}
      {staticLayers.parks.map((p,index)=><circle key={index} cx={p.x} cy={p.y} r="1.8" fill="#789f70" opacity=".75"/>)}
      {staticLayers.landmarks.map((p,index)=><rect key={index} x={p.x-.7} y={p.y-.7} width="1.4" height="1.4" rx=".3" fill="var(--fg-2)"/>)}
      {CREATOR_TIERS.map(t=><path key={t.key} d={staticLayers.paths[t.key]||''} fill={`var(${t.cssVar})`} />)}
      {staticLayers.airports.map(({side,point})=><g key={side}>
        <rect x={point.x-1} y={point.y-16} width="2" height="32" fill="var(--fg-3)"/>
        <text x={point.x} y={point.y-18} textAnchor="middle" fontSize="3.5" fill="var(--fg-2)">AIR</text>
      </g>)}
      {selection && <circle cx={selection.x} cy={selection.y} r="2.2" fill="none" stroke="var(--accent-ink)" strokeWidth=".8" />}
      <CameraMarker cameraRef={cameraRef} bounds={bounds} />
    </svg>
    <span className="world-map-caption">지도를 눌러 이동 · 원은 선택한 건물</span>
  </section>;
}
