/** 공항 시설 좌표를 한 곳에 모은 순수 데이터 모듈이다. Airport.jsx(시각), FlightMode.jsx(비행 장애물),
 * CarMode.jsx(차량 장애물)가 모두 이 목록을 읽는다. 좌표는 공항 중심(로컬 원점) 기준이고
 * 활주로 중심선(x=0)을 기준으로 터미널 단지는 서쪽(음수 x)에 몰려 있다.
 * 세계 좌표 변환은 FlightMode 가 예전부터 쓰던 거울 변환과 같다:
 * world.x = side*(extent+AIRPORT_OFFSET) + side*local.x, world.z = side*local.z (side: 동쪽 1, 서쪽 -1).
 */
import { AIRPORT_ROAD_END, AIRPORT_ROAD_Z } from '../../../shared/urbanPlan.js';

export const AIRPORT_OFFSET = 110;

export function airportCenter(extent, side = 1) {
  return { x: side * (extent + AIRPORT_OFFSET), z: 0 };
}

/** 활주로, 유도로, 주차장은 바닥일 뿐이라 충돌 상자를 만들지 않는다.
 * 관문과 바람자루도 차나 비행기를 막을 만큼 크지 않다. */
export const FACILITIES = [
  { key: 'runway', x: 0, z: 0, w: 28, d: 540, h: 0, kind: 'runway' },
  { key: 'taxiway', x: -25, z: 0, w: 10, d: 500, h: 0, kind: 'taxiway' },
  { key: 'terminal', x: -65, z: 40, w: 26, d: 160, h: 17.2, kind: 'building' },
  { key: 'pier', x: -44, z: 90, w: 6, d: 140, h: 8.5, kind: 'building' },
  { key: 'tower', x: -72, z: -75, w: 10, d: 10, h: 41.6, kind: 'building' },
  { key: 'canopy', x: -65, z: -46, w: 26, d: 14, h: 14, kind: 'building' },
  { key: 'hangar-1', x: -93, z: -233, w: 34, d: 34, h: 14, kind: 'building' },
  { key: 'hangar-2', x: -93, z: -191, w: 34, d: 34, h: 14, kind: 'building' },
  { key: 'cargo', x: -95, z: 190, w: 30, d: 80, h: 10, kind: 'building' },
  { key: 'fuel-1', x: -140, z: -140, r: 8, h: 9, kind: 'tank' },
  { key: 'fuel-2', x: -140, z: -120, r: 8, h: 9, kind: 'tank' },
  { key: 'fuel-3', x: -140, z: -100, r: 8, h: 9, kind: 'tank' },
  { key: 'fire-station', x: -138, z: -49, w: 24, d: 22, h: 7, kind: 'building' },
  { key: 'radar', x: -139, z: -179, w: 22, d: 22, h: 12, kind: 'building' },
  { key: 'parking', x: -105, z: -10, w: 40, d: 60, h: 0, kind: 'ground' },
  { key: 'gate', x: -190, z: 30, w: 6, d: 6, h: 3, kind: 'gate' },
  { key: 'windsock', x: -30, z: 250, w: 1, d: 1, h: 6, kind: 'marker' },
  // 헬리패드는 로컬 (-55,-60) 이다. 터미널 단지와 함께 서쪽으로 20 밀렸다.
  { key: 'helipad', x: -55, z: -60, w: 22, d: 22, h: 0, kind: 'pad' },
];

const SOLID_KINDS = new Set(['building', 'tank']);

/** FlightMode 와 CarMode 가 함께 읽는 충돌 상자다. 동서 공항 모두를 세계 좌표로 낸다. */
export function airportBoxes(extent) {
  const solids = FACILITIES.filter((facility) => SOLID_KINDS.has(facility.kind));
  return [1, -1].flatMap((side) => solids.map((box) => ({
    x: side * (extent + AIRPORT_OFFSET) + side * box.x,
    z: side * box.z,
    height: box.h,
    width: box.kind === 'tank' ? box.r * 2 : box.w,
    depth: box.kind === 'tank' ? box.r * 2 : box.d,
  })));
}

/** 공항로. 관문(-190)에서 주차장을 지나 터미널 앞까지 z=30 을 곧게 잇는다.
 * 끝점은 urbanPlan 과 같은 값을 읽는다. 예전 끝점(-45) 은 터미널 밑을 지나
 * 차가 건물에 막히게 되자 도로가 건물을 관통하는 것이 드러났다. */
export const AIRPORT_ROAD = { localX0: -190, localX1: AIRPORT_ROAD_END, z: AIRPORT_ROAD_Z };

/** 차량 드라이브 출발점. 공항로 위, 터미널 앞이다. heading = PI/2 이면
 * forward = (-sin h, -cos h) = (-1, 0) 이라 -x 쪽, 즉 도시를 향해 선다. */
export function carSpawn(extent) {
  return { x: extent + AIRPORT_OFFSET - 105, z: 30, heading: Math.PI / 2 };
}

/** 도보 출발점. 예전 값(로컬 -60,-50)은 canopy 상자(로컬 x -78~-52, z -53~-39) 안이라
 * 걷기 시작 즉시 사방이 막혔다. 유도로(로컬 x -30~-20)와 터미널 단지(로컬 x -78 이하) 사이의
 * 빈 apron 으로 옮긴다. 가장 가까운 상자(canopy)까지도 x 축으로 12 떨어져 있다. */
export function walkSpawn(extent) {
  return { x: extent + AIRPORT_OFFSET - 40, z: -46, heading: Math.PI / 2 };
}

/** 공항 땅이다. 활주로 중심선에서 서쪽으로 west, 동쪽으로 east 만큼이고 남북으로 halfDepth 다.
 * 터미널 단지와 격납고, 연료, 레이더가 서쪽으로 늘어서 땅이 서쪽으로 길다. Airport.jsx 와 Ocean 의
 * 선반이 같은 값을 읽는다. */
export const AIRPORT_GROUND = { west: 160, east: 70, halfDepth: 300 };
/** 둑이다. 도시 땅끝에서 공항 땅까지 공항로를 받친다. Ocean 의 선반과 같은 값이다. */
export const CAUSEWAY = { x0: -25, x1: 80, z: 30, halfWidth: 16 };

/** 도시 밖에서 차가 설 수 있는 뭍인지 본다. 동서 공항 땅과 동쪽 둑만 뭍이다. */
export function onAirportLand(extent, x, z) {
  for (const side of [1, -1]) {
    const cx = side * (extent + AIRPORT_OFFSET);
    // 서쪽 공항은 거울상이라 로컬 x 의 부호가 뒤집힌다.
    const local = (x - cx) * side;
    if (local >= -AIRPORT_GROUND.west && local <= AIRPORT_GROUND.east && Math.abs(z) <= AIRPORT_GROUND.halfDepth) return true;
  }
  return x >= extent + CAUSEWAY.x0 && x <= extent + CAUSEWAY.x1 && Math.abs(z - CAUSEWAY.z) <= CAUSEWAY.halfWidth;
}
