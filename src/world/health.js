/** 탈것의 체력이다. 순수 함수이며 Three, React, 네트워크에 의존하지 않는다.
 * 무기 피해는 무장한 탈것만 받는다. 세단과 오토바이 같은 민간 차량은 표에 없어
 * 전차가 겨눠도 아무 일이 없다.
 * 민간 지상 차량도 부딪힘 내구도는 갖는다. 무기에는 다치지 않고 차끼리 부딪힐 때만 깎인다.
 */

/** 차체 내구도다. 전차가 가장 단단하고 장갑차가 가장 약하다.
 * 전차포 세 발, 자주포 두 발이면 전차가 터지는 값이다. */
export const HULL = Object.freeze({ tank: 1400, howitzer: 900, armored: 700, aa: 620, fighter: 500, prop: 320, bomber: 900, interceptor: 380, shotgun: 380, helicopter: 500 });

/** 무기별 한 발 피해다. 키는 발사체가 들고 다니는 weapon 값과 같다. */
export const DAMAGE = Object.freeze({ tank: 480, howitzer: 700, armored: 60, aa: 45, cannon: 16, shotgun: 7.2, missile: 420, bomb: 700 });

/** 마지막 피격 후 이 시간이 지나면 차체가 스스로 수리된다. 초당 최대 체력의 비율로 찬다. */
export const REPAIR_DELAY = 8, REPAIR_RATE = 0.06;

/** 민간 지상 차량의 부딪힘 내구도다. 한 번에 20 씩 깎여 다섯 번이면 선다. */
export const ROAD_HULL = 100;
/** 한 번 부딪힐 때 깎이는 양과 그 뒤 다시 깎이지 않는 시간이다. 연석을 긁듯 스쳐도
 * 프레임마다 깎이면 한 번의 접촉으로 차가 선다. */
export const BUMP_DAMAGE = 20, BUMP_GRACE = 1.3;
/** 부딪힘 내구도의 회복이다. 무기 피해(8초, 초당 6%) 보다 늦게, 천천히 찬다. */
export const BUMP_REPAIR_DELAY = 20, BUMP_REPAIR_RATE = 0.04;

/** 지상 차량 종류다. 무장 여부와 상관없이 부딪힘 판정을 받는다. */
const ROAD_KINDS = new Set(['car']);

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** 무장 여부는 탈것 종류와 키가 함께 정한다. 같은 key 가 다른 kind 에 있지는 않지만
 * 호출자가 kind 를 넘기므로 계약을 분명히 둔다. */
export function isArmed(kind, key) {
  // 무장한 기체만 체력을 갖는다. 헬기는 좌우 기관총과 전투기급 내구도를 갖는다.
  if (kind === 'flight') return ['fighter', 'prop', 'bomber', 'interceptor', 'shotgun', 'helicopter'].includes(key);
  if (kind === 'car') return ['tank', 'howitzer', 'armored', 'aa'].includes(key);
  return false;
}

export function createHealth(kind, key) {
  const armed = isArmed(kind, key);
  // 민간 지상 차량은 무기에 다치지 않지만 부딪힘 내구도는 갖는다.
  const max = armed ? HULL[key] : ROAD_KINDS.has(kind) ? ROAD_HULL : 0;
  return {
    kind, key, max, hp: max, armed, wrecked: false,
    lastHitAt: -Infinity, lastBumpAt: -Infinity,
    repairDelay: armed ? REPAIR_DELAY : BUMP_REPAIR_DELAY,
    repairRate: armed ? REPAIR_RATE : BUMP_REPAIR_RATE,
  };
}

/** 공격자가 목표를 부술 수 있는지 본다. 무장하지 않은 탈것은 목표가 되지 않는다.
 * 목표가 무장했는지만 보면 된다. 비무장 탈것은 쏠 무기가 없어 공격자가 될 수 없다. */
export function canHarm(target) {
  return Boolean(target && target.armed && target.max > 0 && !target.wrecked);
}

export function damageOf(weapon) {
  return finite(DAMAGE[weapon], 0);
}

/** 피해를 적용한다. 체력이 0 이 되면 wrecked 가 되고 더 깎이지 않는다. */
export function hurt(health, amount, now = 0) {
  if (!canHarm(health)) return health;
  const hit = Math.max(0, finite(amount));
  if (hit <= 0) return health;
  const hp = Math.max(0, health.hp - hit);
  return { ...health, hp, lastHitAt: finite(now), wrecked: hp <= 0 };
}

/** 차끼리 부딪힌 피해다. 무장 여부와 상관없이 지상 차량이면 받는다. 한 번 받으면
 * BUMP_GRACE 동안 다시 깎이지 않는다. 벽이나 차에 붙어 있는 동안 계속 깎이지 않게 한다. */
export function bump(health, now = 0) {
  if (!health || health.max <= 0 || health.wrecked) return health;
  const at = finite(now);
  if (at - finite(health.lastBumpAt, -Infinity) < BUMP_GRACE) return health;
  const hp = Math.max(0, health.hp - BUMP_DAMAGE);
  return { ...health, hp, lastHitAt: at, lastBumpAt: at, wrecked: hp <= 0 };
}

/** 무적 시간이 남아 있으면 참이다. 화면이 깜빡임으로 알릴 때 쓴다. */
export function bumpGuarded(health, now = 0) {
  return Boolean(health) && finite(now) - finite(health.lastBumpAt, -Infinity) < BUMP_GRACE;
}

/** 시간이 지나면 차체를 수리한다. 부서진 차체는 수리하지 않는다. 탑승을 다시 해야 한다.
 * 기다리는 시간과 차는 속도는 탈것마다 다르다. 부딪힘만 받는 민간 차량이 더 늦게, 천천히 찬다. */
export function repair(health, dt = 0, now = 0) {
  if (!health || health.max <= 0 || health.wrecked) return health;
  if (health.hp >= health.max) return health;
  const delay = finite(health.repairDelay, REPAIR_DELAY), rate = finite(health.repairRate, REPAIR_RATE);
  if (finite(now) - finite(health.lastHitAt, -Infinity) < delay) return health;
  const step = Math.max(0, Math.min(finite(dt), 0.05));
  return { ...health, hp: Math.min(health.max, health.hp + health.max * rate * step) };
}

/** 0 에서 1 이다. 무장하지 않은 탈것은 게이지를 그리지 않으므로 null 을 준다. */
export function hullRatio(health) {
  if (!health || health.max <= 0) return null;
  return Math.max(0, Math.min(1, health.hp / health.max));
}

/** 월드의 다른 대상 위에 뜨는 체력바는 피해가 있을 때만 표시한다. */
export function showDamagedHealthBar(ratio) {
  return Number.isFinite(ratio) && ratio >= 0 && ratio < 1;
}
