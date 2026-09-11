import { useMemo } from 'react';
import { getWorldBounds, WORLD } from '../../shared/worldLayout.js';
import { mapPoint } from './data';
import { CREATOR_TIERS } from '../design/tiers';

export default function WorldMap({buildings, selected, camera, onFocus, onSelect}) {
  const bounds=useMemo(()=>getWorldBounds(buildings),[buildings]);
  const paths=useMemo(()=> {
    const groups={};
    for (const b of buildings) {
      const p=mapPoint(b,bounds), tier=(b.tier_name||'bronze').toLowerCase();
      groups[tier]=(groups[tier]||'')+`M${p.x-0.35},${p.y-0.35}h.7v.7h-.7z`;
    }
    return groups;
  },[buildings,bounds]);
  const target=mapPoint(camera,bounds);
  const selection=selected ? mapPoint(selected,bounds) : null;
  const river=mapPoint({x:0,z:WORLD.riverZ},bounds).y;
  const visit=(event)=> {
    const rect=event.currentTarget.getBoundingClientRect();
    const x=bounds.minX+(event.clientX-rect.left)/rect.width*(bounds.maxX-bounds.minX);
    const z=bounds.minZ+(event.clientY-rect.top)/rect.height*(bounds.maxZ-bounds.minZ);
    let closest=null, distance=Infinity;
    for (const b of buildings) {
      const d=Math.hypot(b.x-x,b.z-z);
      if(d<distance){closest=b;distance=d;}
    }
    if(closest && distance<(bounds.maxX-bounds.minX)*.035) onSelect(closest);
    else onFocus({x,z});
  };
  return <section className="world-map" aria-label="도시 전체 지도">
    <div className="world-map-heading"><span>도시 전체 지도</span><span>N ↑</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="전체 제작자 위치. 지도를 누르면 해당 위치로 이동합니다." onClick={visit}>
      <rect width="100" height="100" fill="var(--surface-2)" />
      <path d={`M0 ${river}H100`} stroke="var(--t-platinum)" strokeWidth="2" opacity=".3" />
      {CREATOR_TIERS.map(t=><path key={t.key} d={paths[t.key]||''} fill={`var(${t.cssVar})`} />)}
      {selection && <circle cx={selection.x} cy={selection.y} r="2.2" fill="none" stroke="var(--accent-ink)" strokeWidth=".8" />}
      <circle cx={Math.max(1,Math.min(99,target.x))} cy={Math.max(1,Math.min(99,target.y))} r="1.3" fill="var(--fg)" stroke="var(--bg)" strokeWidth=".5" />
    </svg>
    <span className="world-map-caption">지도를 눌러 이동 · 원은 선택한 건물</span>
  </section>;
}
