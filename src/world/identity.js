// 조종사 닉네임과 기체 선택은 브라우저에만 남는다. Supabase 테이블에 쌓지 않는다.
const STORAGE_KEY = 'eb-world-pilot';

// 3D 모델은 planes/ 에 있고, 여기에는 2D UI 가 쓰는 이름만 둔다.
export const PLANE_META = {
  jet: { ko: '라이트 제트', code: 'JET', eyebrow: 'EGO AIR / LIGHT JET', note: '가볍고 민첩한 기본 기체다.' },
  fighter: { ko: '전투기', code: 'FTR', eyebrow: 'EGO AIR / FIGHTER', note: '삼각익에 쌍수직미익을 단 군용기다.' },
  prop: { ko: '프로펠러 전투기', code: 'PRP', eyebrow: 'EGO AIR / PROP FIGHTER', note: '기관총만 달았지만 연사가 가장 빠르다.' },
  interceptor: { ko: '요격기', code: 'ITC', eyebrow: 'EGO AIR / INTERCEPTOR', note: '연료를 쓰는 작은 제트다. Shift 로 1080km/h, Q 로 켜는 강화 부스트는 1340km/h 까지 낸다.' },
  shotgun: { ko: '샷거너', code: 'SGN', eyebrow: 'EGO AIR / SHOTGUNNER', note: '요격기 동체를 공유하는 2연장 산탄 전투기다. 한 번 누르면 팡-팡 발사한다.' },
  bomber: { ko: '폭격기', code: 'BMR', eyebrow: 'EGO AIR / BOMBER', note: '폭탄창을 열고 아래로 폭탄을 떨군다.' },
  helicopter: { ko: '헬기', code: 'HEL', eyebrow: 'EGO AIR / HELICOPTER', note: '방향키로 로터 출력을 올려 수직으로 뜬다.' },
};
export const PLANE_KEYS = Object.keys(PLANE_META);

// 지상 차량은 비행기와 따로 고른다. 모드를 바꿔도 각각의 선택이 남는다.
export const VEHICLE_META = {
  sedan: { ko: '세단', code: 'SDN', eyebrow: 'EGO ROAD / SEDAN', note: '안정적이고 접지력이 좋은 4도어다.' },
  suv: { ko: 'SUV', code: 'SUV', eyebrow: 'EGO ROAD / SUV', note: '차고가 높아 시야가 넓고 무겁게 달린다.' },
  convertible: { ko: '오픈카', code: 'CNV', eyebrow: 'EGO ROAD / CONVERTIBLE', note: '지붕을 연 2도어다. 가볍고 빠르지만 바람을 다 맞는다.' },
  formula: { ko: '포뮬러', code: 'F1', eyebrow: 'EGO FORMULA / OPEN WHEEL', note: '300km/h까지 가속하는 현대식 오픈휠 머신이다. Space로 드리프트한다.' },
  truck: { ko: '트럭', code: 'TRK', eyebrow: 'EGO ROAD / TRUCK', note: '적재함을 단 캡오버 트럭이다. 느리고 회전 반경이 크다.' },
  motorcycle: { ko: '오토바이', code: 'MTC', eyebrow: 'EGO ROAD / MOTORCYCLE', note: '가볍고 빠르지만 접지력이 낮다.' },
  tank: { ko: '전차', code: 'TNK', eyebrow: 'EGO ARMOR / TANK', note: '직사포를 쏘는 주력전차다. 느리지만 단단하다.' },
  howitzer: { ko: '자주포', code: 'SPG', eyebrow: 'EGO ARMOR / HOWITZER', note: '곡사포로 멀리 있는 목표를 때린다.' },
  armored: { ko: '장갑차', code: 'APC', eyebrow: 'EGO ARMOR / APC', note: '장전이 빠른 기관포를 단 차륜형이다.' },
  aa: { ko: '대공포', code: 'AAA', eyebrow: 'EGO ARMOR / ANTI-AIR', note: '분당 300발을 퍼붓는 대공 자주포다. 2배에서 8배까지 조준경을 당긴다.' },
};
export const VEHICLE_KEYS = Object.keys(VEHICLE_META);
export const NAME_MAX = 12;

export function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  // 제어문자와 방향 지정 문자를 지운다. 다른 사람 화면에 그대로 그려지는 값이다.
  return value.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

export function defaultName(id) {
  const suffix = String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
  return `Player ${suffix || '0000'}`;
}

/** 닉네임은 브라우저마다 한 번 정해지고 바뀌지 않는다. 남이 보는 이름이라 임의 입력을 받지 않는다. */
export function makeName() {
  const tag = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase();
  return `Player ${tag.padEnd(4, '0')}`;
}

export function displayName(id, name) {
  return sanitizeName(name) || defaultName(id);
}

export function validPlane(value) {
  return PLANE_KEYS.includes(value) ? value : PLANE_KEYS[0];
}

export function validVehicle(value) {
  return VEHICLE_KEYS.includes(value) ? value : VEHICLE_KEYS[0];
}

export function loadIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const identity = { name: sanitizeName(parsed?.name) || makeName(), plane: validPlane(parsed?.plane), vehicle: validVehicle(parsed?.vehicle) };
    if (!sanitizeName(parsed?.name)) saveIdentity(identity);
    return identity;
  } catch {
    return { name: makeName(), plane: PLANE_KEYS[0], vehicle: VEHICLE_KEYS[0] };
  }
}

export function saveIdentity(identity) {
  const value = { name: sanitizeName(identity?.name), plane: validPlane(identity?.plane), vehicle: validVehicle(identity?.vehicle) };
  // 저장이 막힌 브라우저에서도 이번 세션은 그대로 쓴다.
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* 무시한다 */ }
  return value;
}

/** 제작자 미공개일 때 건물 카드에 쓰는 이름이다. 순위를 번호로 쓴다.
 * 순위가 없으면 id 에서 번호를 만든다. 같은 제작자는 늘 같은 번호다. */
export function creatorAlias(building) {
  const rank = Number(building?.rank);
  if (Number.isFinite(rank) && rank > 0) return `사용자 ${Math.round(rank)}`;
  const id = String(building?.id || '');
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  return `사용자 ${hash}`;
}
