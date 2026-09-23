/** Capped, nearby creator overlays. Flight cards measure aircraft-to-building
 * distance (not camera distance), never steal flight input, and fade per frame.
 */
import {useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {proxyThumbnailUrl} from '../utils/imageUtils';
import {getCreatorTierMeta} from '../design/tiers';
import {creatorDistance,creatorCardOpacity,creatorLabelAnchor,labelReach,LABEL_SCALE} from './creatorProximity';
import {lotSizeOf,MASS_LOT_RATIO} from './cityModels';
import {hitsAnyBuilding} from './solidIndex.js';
import {pickLabelIds} from './labelCandidates.js';
import {creatorAlias} from './identity.js';

/** 비행 중에는 카드를 건물 벽면에 붙인다. 기체가 다가온 면을 골라 그 벽에 세우고
 * 거리에 따라 서서히 드러낸다. 벽면 반폭에서 0.4 만큼 띄워 z-fighting 을 피한다.
 */
function WallCard({building,aircraft,anonymous}) {
 const group=useRef(), element=useRef();
 const offset=lotSizeOf(building)*MASS_LOT_RATIO/2+0.4;
 // 카드는 Html 안에 한 박자 늦게 붙는다. 붙는 순간 지금 거리의 투명도를 넣어 두지 않으면
 // 다음 프레임까지 투명한 카드가 한 장 떠 있는다.
 const attach=node=>{
  element.current=node;
  if(node)node.style.opacity=creatorCardOpacity(creatorDistance(aircraft.current,building),'flight');
 };
 useFrame(()=>{
  const position=aircraft.current;
  if(!position||!group.current)return;
  const dx=position.x-building.x, dz=position.z-building.z;
  const sideways=Math.abs(dx)>Math.abs(dz);
  const nx=sideways?Math.sign(dx)||1:0, nz=sideways?0:Math.sign(dz)||1;
  group.current.position.set(building.x+nx*offset,Math.min(building.height*0.62,Math.max(9,position.y-6)),building.z+nz*offset);
  group.current.rotation.set(0,Math.atan2(nx,nz),0);
  if(element.current)element.current.style.opacity=creatorCardOpacity(creatorDistance(position,building),'flight');
 });
 // 미공개면 사진과 닉네임, ELO 를 가리고 티어와 번호만 남긴다.
 const avatar=!anonymous&&building.profile_image_url?proxyThumbnailUrl(building.profile_image_url,192):null;
 const name=anonymous?creatorAlias(building):(building.nickname||building.handle);
 const tier=getCreatorTierMeta(building.tier_name);
 return <group ref={group}>
  <Html transform distanceFactor={26} zIndexRange={[19,1]} style={{pointerEvents:'none'}}>
   <div ref={attach} className="world-wall-creator" style={{opacity:0,borderColor:tier?`var(${tier.cssVar})`:undefined}} aria-label={`${name} 제작자 카드`}>
    {avatar?<img src={avatar} alt="" width="192" height="192" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>
      :<span className="world-flight-avatar">{anonymous?'?':(building.nickname||building.handle||'?').slice(0,1)}</span>}
    <div>
     <strong>{name}</strong>
     <span style={{color:tier?`var(${tier.cssVar})`:undefined}}>{tier?.ko||building.tier_name}</span>
     {!anonymous&&<small>ELO {new Intl.NumberFormat('ko-KR').format(Number(building.elo_score)||0)}</small>}
    </div>
   </div>
  </Html>
 </group>;
}

function GroundCard({ building, driving, selected, onSelect, avatar, name, tier, anonymous }) {
 const group = useRef();
 const facadeOffset = driving ? lotSizeOf(building)*MASS_LOT_RATIO/2+0.4 : 0;
 const initial = creatorLabelAnchor(null, building, driving ? 'drive' : 'explore', facadeOffset);
 useFrame(({camera})=>{
  if(!group.current)return;
  const point=creatorLabelAnchor(camera.position,building,driving?'drive':'explore',facadeOffset);
  group.current.position.set(point.x,point.y,point.z);
 });
 return <group ref={group} position={[initial.x,initial.y,initial.z]}>
  <Html transform={!driving} sprite={!driving} center={driving} distanceFactor={driving ? undefined : LABEL_SCALE.explore} zIndexRange={[20, 1]}>
   <button type="button" className="world-building-label" data-driving={driving || undefined} data-selected={selected || undefined}
    style={{borderBottomColor:tier?`var(${tier.cssVar})`:undefined}}
    onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect?.(building); }}
    aria-label={`${name} 선택`}>
    {avatar ? <img className="world-building-avatar" src={avatar} alt="" width="144" height="144" loading="lazy" draggable="false" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
      : <span className="world-building-avatar" aria-hidden="true">{anonymous?'?':(name?.slice(0, 1)||'?')}</span>}
    <span className="world-building-text">
     <span className="world-building-name">{name}</span>
     <span className="world-building-tier" style={{color:tier?`var(${tier.cssVar})`:undefined}}>{tier?.ko||building.tier_name}</span>
    </span>
   </button>
  </Html>
 </group>;
}

/** 라벨 하나는 drei Html 이라 매 프레임 DOM 에 transform 을 쓴다. 주행 중에는 그 수를 절반으로
 * 줄이고 후보도 절반 주기로만 다시 고른다. 빠르게 지나가는 동안 여섯 개는 읽히지도 않는다. */
export default function NearbyLabels({ buildings, selectedId, onSelect, pickMesh, resources, flightMode, aircraft, driving = false, anonymous = false }) {
  const [visibleIds, setVisibleIds] = useState([]);
  const lastUpdate = useRef(-1), signature = useRef('');
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), projected: new THREE.Vector3() }), []);
  const records = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastUpdate.current < (driving ? 0.3 : 0.25) || !pickMesh.current) return;
    lastUpdate.current = clock.elapsedTime;
    const anchorOf = (building) => {
      if(flightMode)return scratch.point.set(building.x,Math.min(building.height+7,Math.max(8,(aircraft.current?.y||0)+8)),building.z);
      const facadeOffset=driving?lotSizeOf(building)*MASS_LOT_RATIO/2+0.4:0;
      const point=creatorLabelAnchor(camera.position,building,driving?'drive':'explore',facadeOffset);
      return scratch.point.set(point.x,point.y,point.z);
    };
    const ids = pickLabelIds({
      buildings, anchorOf,
      distanceOf: (building) => flightMode ? creatorDistance(aircraft.current, building) : camera.position.distanceTo(anchorOf(building)),
      // 거리 규칙은 creatorProximity 한 곳에 있다. 비행, 주행, 탐색이 각각 다르다.
      reachOf: (building) => labelReach(flightMode ? 'flight' : driving ? 'drive' : 'explore', building.height),
      project: (point) => scratch.projected.copy(point).project(camera),
      // picking mesh 에 광선을 쏘면 광선마다 상자 1000개를 다 보므로 충돌 격자로 선분만 검사한다.
      isOccluded: (point, building) => hitsAnyBuilding(camera.position, point, buildings, building),
      limit: flightMode ? 3 : driving ? 3 : 6, selectedId,
    });
    const nextSignature = JSON.stringify(ids);
    if (nextSignature !== signature.current) { signature.current = nextSignature; setVisibleIds(ids); }
  });
  return visibleIds.map((id) => {
    const building = records.get(id);
    if (!building) return null;
    const avatar = !anonymous && typeof building.profile_image_url === 'string' ? proxyThumbnailUrl(building.profile_image_url, 192) : null;
    const name = anonymous ? creatorAlias(building) : (building.nickname || building.handle);
    const tier = getCreatorTierMeta(building.tier_name);
    if(flightMode)return <WallCard key={`flight-${id}`} building={building} aircraft={aircraft} anonymous={anonymous}/>;
    return <group key={id}>
      {!driving&&<mesh geometry={resources.geometries.box} material={resources.materials.dark} position={[building.x, building.height + 4.5, building.z]} scale={[0.16, 5, 0.16]} dispose={null} />}
      <GroundCard building={building} driving={driving} selected={id===selectedId} onSelect={onSelect}
        avatar={avatar} name={name} tier={tier} anonymous={anonymous}/>
    </group>;
  });
}
