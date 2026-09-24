/** 도시를 가로지르는 큰 강의 단일 출처다. 물 판정, 렌더, 미니맵, 교량, 배치 예약이
 * 전부 이 파일의 함수를 읽는다. 예전에는 평평한 riverZ 상수 하나였는데 그러면 강에 붙은
 * 공원과 주거와 상가가 전부 가로 줄무늬로 보인다. 중심선을 굽혀 두면 띠가 같이 휘어
 * 줄무늬가 사라진다.
 *
 * 좌표는 extent 비율로 잡는다. 도시가 커지거나 작아져도 같은 모양이 나온다.
 * 난수를 쓰지 않으므로 같은 extent 는 항상 같은 강이 된다.
 */

/** 사행(蛇行) 진폭과 반폭이다. MEANDER 두 개를 겹쳐 주기가 다른 굽이를 만든다.
 * HALF_BASE 는 extent 1844 에서 폭 210, 지도 가로의 5.7% 다. 한강이 서울 폭에서
 * 차지하는 3~4% 보다 조금 넓게 잡아야 작은 지도에서 강으로 읽힌다. */
export const RIVER = Object.freeze({
  meanderA: 0.085, waveA: 1.0, phaseA: 0.6,
  meanderB: 0.035, waveB: 2.7, phaseB: 2.1,
  halfBase: 0.0569, halfSwing: 0.0184, waveHalf: 1.7, phaseHalf: 1.2,
});

/** 강변 공원 띠의 폭이다. 북안은 좁고 남안은 넓다. 같은 거리에서 다른 것이 보여야
 * 강북과 강남이 다른 도시로 읽힌다. 폭이 x 를 따라 변해서 넓어진 자리가 큰 공원,
 * 좁아진 자리가 절벽이 된다. 값은 extent 비율이다. 절대값으로 두면 작은 도시에서
 * 공원 띠가 지도보다 넓어져 설 땅이 없어진다. extent 1844 에서 북안 60~130,
 * 남안 180~330 이다. */
export const RIVER_PARK = Object.freeze({
  northMin: 0.0325, northSwing: 0.0380, northWave: 2.3, northPhase: 0.4,
  southMin: 0.0976, southSwing: 0.0813, southWave: 1.9, southPhase: 2.6,
});

/** 강변도로 폭이다. 공원 띠 바로 바깥에 붙는다. 역시 extent 비율이며
 * extent 1844 에서 북안 30, 남안 34 다. */
export const RIVER_ROAD = Object.freeze({ north: 0.0163, south: 0.0184 });

const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const span = (extent) => Math.max(1, finite(extent, 1844));

/** 강 중심선의 z 다. 평균이 0 이라 강이 지도 한가운데를 지난다. */
export function riverCenter(extent, x) {
  const e = span(extent), t = finite(x, 0) / e;
  return RIVER.meanderA * e * Math.sin(Math.PI * t * RIVER.waveA + RIVER.phaseA)
    + RIVER.meanderB * e * Math.sin(Math.PI * t * RIVER.waveB + RIVER.phaseB);
}

/** 그 x 에서의 강 반폭이다. */
export function riverHalf(extent, x) {
  const e = span(extent), t = finite(x, 0) / e;
  return RIVER.halfBase * e + RIVER.halfSwing * e * Math.sin(Math.PI * t * RIVER.waveHalf + RIVER.phaseHalf);
}

/** 강가에서 얼마나 떨어졌는지 본다. side 는 북안이 -1, 남안이 1 이고
 * offset 은 강 가장자리에서의 거리다. 물 위면 offset 이 음수다. */
export function riverBank(extent, x, z) {
  const center = riverCenter(extent, x), half = riverHalf(extent, x);
  const delta = finite(z, 0) - center;
  return { side: delta < 0 ? -1 : 1, offset: Math.abs(delta) - half, delta, center, half };
}

export function inRiver(extent, x, z) {
  return riverBank(extent, x, z).offset < 0;
}

/** 그 x, 그 안에서의 강변 공원 폭이다. */
export function riverParkWidth(extent, x, side) {
  const e = span(extent), t = finite(x, 0) / e;
  if (side < 0) {
    return e * (RIVER_PARK.northMin
      + RIVER_PARK.northSwing * (0.5 + 0.5 * Math.sin(Math.PI * t * RIVER_PARK.northWave + RIVER_PARK.northPhase)));
  }
  return e * (RIVER_PARK.southMin
    + RIVER_PARK.southSwing * (0.5 + 0.5 * Math.sin(Math.PI * t * RIVER_PARK.southWave + RIVER_PARK.southPhase)));
}

/** 강변 공원 안인지 본다. 배치가 이 자리를 비운다. */
export function inRiverPark(extent, x, z) {
  const bank = riverBank(extent, x, z);
  return bank.offset >= 0 && bank.offset < riverParkWidth(extent, x, bank.side);
}

/** 강변도로 안인지 본다. 공원 바깥에 붙는 띠다. */
export function onRiverRoad(extent, x, z) {
  const bank = riverBank(extent, x, z);
  if (bank.offset < 0) return false;
  const park = riverParkWidth(extent, x, bank.side);
  const road = span(extent) * (bank.side < 0 ? RIVER_ROAD.north : RIVER_ROAD.south);
  return bank.offset >= park && bank.offset < park + road;
}

/** 공원과 강변도로까지 합쳐 건물이 못 들어가는 폭이다. */
export function riverClearance(extent, x, side) {
  return riverHalf(extent, x) + riverParkWidth(extent, x, side)
    + span(extent) * (side < 0 ? RIVER_ROAD.north : RIVER_ROAD.south);
}

/** 미니맵과 렌더가 쓰는 중심선 폴리라인이다. steps 가 클수록 곡선이 매끄럽다. */
export function riverSamples(extent, steps = 48) {
  const e = span(extent), count = Math.max(2, Math.round(steps)), points = [];
  for (let i = 0; i <= count; i++) {
    const x = -e + (2 * e * i) / count;
    points.push([x, riverCenter(e, x)]);
  }
  return points;
}

/** 강을 렌더할 때 쓰는 사각 조각들이다. 중심선을 따라 잘라 각 조각의 중심, 폭, 길이,
 * 회전을 준다. angle 은 도로 조각과 같은 규약이다. 즉 scale 을 [폭, 높이, 길이] 로 주고
 * 이 각으로 Y 축 회전을 걸면 상자의 국소 +Z 가 흐름 방향을 향한다. */
export function riverSegments(extent, steps = 40) {
  const e = span(extent), count = Math.max(2, Math.round(steps)), out = [];
  for (let i = 0; i < count; i++) {
    const x1 = -e + (2 * e * i) / count, x2 = -e + (2 * e * (i + 1)) / count;
    const z1 = riverCenter(e, x1), z2 = riverCenter(e, x2);
    const width = riverHalf(e, (x1 + x2) / 2) * 2;
    // 이웃한 조각 사이에 틈이 생기지 않도록 길이를 조금 늘려 겹친다.
    const length = Math.hypot(x2 - x1, z2 - z1) * 1.06;
    out.push({
      x: (x1 + x2) / 2, z: (z1 + z2) / 2, width, length,
      angle: Math.atan2(x2 - x1, z2 - z1),
    });
  }
  return out;
}

/** 강과 강변 공원을 하나의 연속된 삼각형 띠로 만든다. positions 는 Three BufferGeometry에
 * 바로 넣을 수 있는 XYZ 목록이고, 각 단면의 두 점을 공유하므로 조각 사이에 틈이 없다. */
export function riverSurfaceMesh(extent, kind = 'water', side = 0, steps = 96) {
  const e=span(extent),count=Math.max(2,Math.round(steps)),positions=[],indices=[];
  const y=kind==='water'?.18:kind==='park'?.13:.08;
  for(let i=0;i<=count;i++){
    const x=-e+2*e*i/count,center=riverCenter(e,x),half=riverHalf(e,x);
    let z0,z1;
    if(kind==='park'){
      const bankSide=side<0?-1:1,outer=half+riverParkWidth(e,x,bankSide);
      z0=center+bankSide*half;z1=center+bankSide*outer;
    }else{
      const reach=half+(kind==='bank'?9:0);
      z0=center-reach;z1=center+reach;
    }
    positions.push(x,y,z0,x,y,z1);
    if(i<count){
      const a=i*2,b=a+1,c=a+2,d=a+3;
      if(kind==='park'&&side<0)indices.push(a,c,b,b,c,d);
      else indices.push(a,b,c,b,d,c);
    }
  }
  return {positions,indices};
}

/** 선분에서 물을 제외한 t 구간이다. 고정 표본 수 대신 월드 거리 기준으로 훑고, 물/뭍
 * 전환점은 이분 탐색해 긴 도로와 짧은 도로가 같은 경계 정밀도를 갖게 한다. */
export function riverLandSpans(extent, line, maxStep = 8) {
  const length = Math.hypot(line.x2-line.x1,line.z2-line.z1);
  const count = Math.max(1,Math.ceil(length/Math.max(1,maxStep))), spans=[];
  const wetAt=(t)=>inWaterBody(extent,line.x1+(line.x2-line.x1)*t,line.z1+(line.z2-line.z1)*t);
  let previousT=0,previousWet=wetAt(0),start=previousWet?null:0;
  for(let i=1;i<=count;i++){
    const t=i/count,wet=wetAt(t);
    if(wet!==previousWet){
      let lo=previousT,hi=t;
      for(let n=0;n<24;n++){
        const mid=(lo+hi)/2;
        if(wetAt(mid)===previousWet)lo=mid;else hi=mid;
      }
      const edge=(lo+hi)/2;
      if(previousWet){start=edge;}else if(start!==null){spans.push([start,edge]);start=null;}
    }
    previousT=t;previousWet=wet;
  }
  if(!previousWet&&start!==null)spans.push([start,1]);
  return spans;
}

/** 강 안의 섬이다. 강이 단조롭게 이어지는 것을 끊고 눈에 띄는 자리를 만든다.
 * x 는 extent 비율, rx 와 rz 도 extent 비율이다. */
const ISLANDS = Object.freeze([
  { id: 'yeoui', x: -0.42, rx: 0.105, rz: 0.040 },
  { id: 'nodeul', x: 0.30, rx: 0.072, rz: 0.028 },
]);
const islandCache = new Map();

export function riverIslands(extent) {
  const e = span(extent);
  if (islandCache.has(e)) return islandCache.get(e);
  const islands = ISLANDS.map((island) => {
    const x = island.x * e, z = riverCenter(e, x), rx = island.rx * e, rz = island.rz * e;
    return { id: island.id, x, z, rx, rz, polygon: Array.from({ length: 24 }, (_, index) => {
      const angle = index * Math.PI * 2 / 24;
      return [x + Math.cos(angle) * rx, z + Math.sin(angle) * rz];
    }) };
  });
  if (islandCache.size >= 16) islandCache.delete(islandCache.keys().next().value);
  islandCache.set(e, islands);
  return islands;
}

export function inIslandPolygon(island, x, z) {
  const polygon = island?.polygon;
  if (!polygon?.length) return false;
  if (Math.abs(x - island.x) > island.rx || Math.abs(z - island.z) > island.rz) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function onIsland(extent, x, z) {
  for (const island of riverIslands(extent)) {
    if (inIslandPolygon(island, x, z)) return island;
  }
  return null;
}

/** 강으로 흘러드는 지천이다. 세로로 흘러 가로 띠를 직각으로 자른다.
 * side 가 -1 이면 북쪽 지도 끝에서 강까지, 1 이면 강에서 남쪽 지도 끝까지다. */
const STREAMS = Object.freeze([
  { id: 'jungnang', x: -0.72, side: -1, width: 0.0184 },
  // 도심 축(x 0 근처) 과 출발 지점을 피해 남안 지천을 오른쪽으로 물린다.
  { id: 'tan', x: 0.24, side: 1, width: 0.0184 },
  { id: 'anyang', x: 0.66, side: -1, width: 0.0163 },
]);

export function riverStreams(extent) {
  const e = span(extent);
  return STREAMS.map((stream) => ({
    id: stream.id, x: stream.x * e, side: stream.side, width: stream.width * e,
    z1: stream.side < 0 ? -e : riverCenter(e, stream.x * e),
    z2: stream.side < 0 ? riverCenter(e, stream.x * e) : e,
  }));
}

export function inStream(extent, x, z) {
  for (const stream of riverStreams(extent)) {
    if (Math.abs(x - stream.x) > stream.width / 2) continue;
    if (z >= Math.min(stream.z1, stream.z2) && z <= Math.max(stream.z1, stream.z2)) return stream;
  }
  return null;
}

/** 물 위인지 본다. 강, 지천, 섬을 한 번에 본다. 섬은 물이 아니다. */
export function inWaterBody(extent, x, z) {
  if (onIsland(extent, x, z)) return false;
  return inRiver(extent, x, z) || Boolean(inStream(extent, x, z));
}
