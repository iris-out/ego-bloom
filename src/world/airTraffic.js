import { flightBoundary } from './flightPhysics.js';

/** 도시 상공을 도는 AI 항공기다. 순수 함수이며 Three, React, 네트워크에 의존하지 않는다.
 * traffic.js 와 계약이 같다. 시간만 주면 같은 배치가 나오므로 상태를 들고 있지 않고,
 * 렌더와 피격 판정이 같은 식을 쓰며 모든 브라우저가 같은 하늘을 본다.
 *
 * 비전투 기체만 띄운다. 이쪽에서 쏘는 일은 없고 맞기만 한다.
 */

/** 궤도에 올리는 기종이다. 무장이 있는 기체는 넣지 않는다. */
export const AIR_TRAFFIC_PLANES = Object.freeze(['jet', 'helicopter']);

/** 격추에 필요한 탄수다. 피해량이 아니라 맞은 횟수로 센다. */
/** 대공포는 12발, 전차와 자주포는 직격 두 발, 장갑차 기관포는 16발이다.
 * 항공 무장은 기관총 14발, 미사일 2발이다. */
export const AIR_HITS = Object.freeze({ cannon: 14, missile: 2, bomb: 1, aa: 12, tank: 2, howitzer: 2, armored: 16 });

/** 기종별 피격 반경(구) 과 순항 속도다. 상자를 쓰면 기체가 기울 때 판정이 어긋난다. */
const SPEC = Object.freeze({
  jet: { radius: 7, speed: 49.6, bank: 0.22, label: '제트기' },
  helicopter: { radius: 5, speed: 20.8, bank: 0.09, label: '헬기' },
});

/** 격추된 기체가 다시 궤도에 오르기까지의 시간이다. 하늘이 비지 않게 한다. */
export const AIR_RESPAWN = 25;
/** 격추 폭발이 보이는 시간이다. 이 동안은 기체를 숨기고 불덩이만 그린다. */
export const AIR_WRECK_LIFE = 3;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function airPlaneOf(index) {
  return AIR_TRAFFIC_PLANES[Math.abs(Math.round(finite(index))) % 3 === 0 ? 1 : 0];
}

export function airSpecOf(plane) {
  return SPEC[plane] || SPEC.jet;
}

/** 한 기체의 자세다. 반지름이 다른 원 궤도를 일정 속도로 돈다.
 * 기수는 -Z 를 보고 회전은 YXZ 다. FlightMode 의 기체와 같은 규약이다. */
export function airTrafficPose(index, time, extent) {
  const slot = Math.abs(Math.round(finite(index)));
  const plane = airPlaneOf(slot), spec = airSpecOf(plane);
  const limit = flightBoundary(extent);
  // 고리를 일곱 겹으로 나눠 겹치지 않게 한다. 안쪽 고리가 도심 바로 위다.
  const ring = limit * (0.18 + (slot % 7) * 0.085);
  const direction = slot % 2 ? 1 : -1;
  // 각속도는 선속도를 반지름으로 나눈 값이다. 안쪽 고리가 더 빨리 한 바퀴를 돈다.
  const omega = direction * spec.speed / Math.max(1, ring);
  const theta = omega * finite(time) + slot * 2.399963;
  // 고도는 기종과 슬롯이 정하고 아주 느린 파동으로만 오르내린다. 궤도를 흔들지 않는다.
  const base = plane === 'helicopter' ? 44 + (slot % 4) * 22 : 145 + (slot % 6) * 46;
  const y = base + Math.sin(finite(time) * 0.11 + slot) * (plane === 'helicopter' ? 4 : 9);
  // 원 궤도의 접선 방향이 기수다. 진행 방향이 -Z 이므로 heading 은 theta 에서 90도 돌아간다.
  const heading = theta - direction * Math.PI / 2;
  return {
    index: slot, plane, key: plane, label: spec.label, radius: spec.radius,
    x: Math.sin(theta) * ring, y, z: Math.cos(theta) * ring,
    heading, pitch: 0, roll: direction * spec.bank,
  };
}

/** 선분이 구를 지나는지 본다. 발사체 한 걸음과 기체 피격 구의 판정이다. */
export function hitsSphere(from, to, target) {
  const range = finite(target?.radius);
  if (range <= 0) return false;
  const dx = finite(to?.x) - finite(from?.x), dy = finite(to?.y) - finite(from?.y), dz = finite(to?.z) - finite(from?.z);
  const fx = finite(from?.x) - finite(target?.x), fy = finite(from?.y) - finite(target?.y), fz = finite(from?.z) - finite(target?.z);
  const c = fx * fx + fy * fy + fz * fz - range * range;
  // 시작점이 이미 구 안이면 맞은 것이다.
  if (c <= 0) return true;
  const a = dx * dx + dy * dy + dz * dz;
  if (a <= 1e-9) return false;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const enter = (-b - Math.sqrt(disc)) / (2 * a);
  return enter >= 0 && enter <= 1;
}

/** 주인공 기체 주변의 AI 항공기만 추린다. 격추된 기체는 빼고 준다. */
export function airTrafficTargets(count, time, extent, near, radius = 900, downed = null) {
  const targets = [];
  const total = Math.max(0, Math.round(finite(count)));
  for (let i = 0; i < total; i += 1) {
    if (downed?.has(i)) continue;
    const pose = airTrafficPose(i, time, extent);
    if (near && Math.hypot(pose.x - finite(near.x), pose.y - finite(near.y), pose.z - finite(near.z)) > radius) continue;
    targets.push(pose);
  }
  return targets;
}

/** 두 기체가 서로의 구에 닿았는지 본다. 닿으면 그 목표를 준다.
 * 상자를 쓰면 기체가 기울 때 판정이 어긋나므로 포탄과 같은 구를 쓴다. */
export function collidesWith(self, targets = []) {
  const reach = finite(self?.radius);
  if (reach <= 0 || !Number.isFinite(self?.x)) return null;
  for (const target of targets) {
    const gap = Math.hypot(finite(target.x) - finite(self.x), finite(target.y) - finite(self.y), finite(target.z) - finite(self.z));
    if (gap < reach + finite(target.radius)) return target;
  }
  return null;
}

/** 한 방에 떨어뜨린다. 공중 충돌은 탄수를 쌓지 않고 바로 격추다. */
export function downAirTraffic(combat, index, now = 0) {
  const slot = Math.abs(Math.round(finite(index)));
  if (combat.downed.has(slot)) return false;
  combat.damage.delete(slot);
  combat.downed.set(slot, finite(now));
  combat.kills += 1;
  combat.label = airSpecOf(airPlaneOf(slot)).label;
  return true;
}

/** 격추 진행도를 담는 그릇이다. FlightMode 가 쓰고 AirTraffic 이 읽는다.
 * damage 는 index -> 0(멀쩡)~1(격추) 이고 downed 는 index -> 격추 시각이다. */
export function createAirCombat() {
  return { damage: new Map(), downed: new Map(), kills: 0, label: '' };
}

/** 명중 한 발을 적용한다. 상태를 제자리에서 고치고 격추 여부를 준다.
 * Map 두 개를 매 발마다 새로 만들면 연사 중에 쓰레기가 쌓인다. */
export function applyAirHit(combat, { index, weapon, now = 0 } = {}) {
  const slot = Math.abs(Math.round(finite(index)));
  if (combat.downed.has(slot)) return { downed: false, total: 1 };
  const step = 1 / Math.max(1, finite(AIR_HITS[weapon], 1));
  const total = (combat.damage.get(slot) || 0) + step;
  if (total < 0.999) {
    combat.damage.set(slot, total);
    return { downed: false, total };
  }
  combat.damage.delete(slot);
  combat.downed.set(slot, finite(now));
  combat.kills += 1;
  combat.label = airSpecOf(airPlaneOf(slot)).label;
  return { downed: true, total: 1 };
}

/** 격추된 지 오래된 기체를 다시 띄운다. 폭발이 끝난 뒤에도 한동안 자리를 비워 둔다. */
export function reviveAirTraffic(combat, now = 0) {
  for (const [slot, at] of combat.downed) {
    if (finite(now) - finite(at) >= AIR_RESPAWN) combat.downed.delete(slot);
  }
  return combat;
}

/** 격추된 기체의 남은 폭발 시간이다. 0 이면 폭발이 끝났고 자리만 비어 있다. */
export function wreckAge(combat, index, now = 0) {
  const at = combat.downed.get(index);
  if (at === undefined) return null;
  const age = finite(now) - finite(at);
  return age < AIR_WRECK_LIFE ? age : null;
}
