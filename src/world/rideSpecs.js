import { AIRSHIP } from './airshipPhysics.js';
import { VEHICLES } from './carPhysics.js';
import { PLANES } from './flightPhysics.js';
import { HOVER_COLLECTIVE, ROTOR_THRUST } from './rotorPhysics.js';
import { SELECTABLE_PLANE_KEYS, PLANE_META, VEHICLE_KEYS, VEHICLE_META } from './identity.js';
import { RUN_SPEED } from './walkPhysics.js';

/** 선택 카드의 막대는 물리 상수에서 파생한다. 손으로 적은 숫자를 두지 않으므로
 * carPhysics 나 flightPhysics 를 고치면 카드가 따라 움직인다. */
const unit = (value, max) => Math.max(0, Math.min(1, value / max));

// 막대가 가득 차는 기준이다. 화면 표시용이고 물리 한계와는 다르다.
const TOP_SPEED = 200, TOP_AGILITY = 2.4;
// 실속 속도가 낮을수록 안정적이다. 45 를 넘으면 0 으로 본다.
const STALL_FLOOR = 28, STALL_CEIL = 45;

function flightRide(key) {
  const meta = PLANE_META[key];
  if (key === 'airship') return { kind: 'flight', key, ...meta, bars: { speed: unit(AIRSHIP.maxSpeed, TOP_SPEED), agility: unit(AIRSHIP.turnRate, TOP_AGILITY), stability: 1 } };
  if (key === 'helicopter') {
    // 헬기는 고정익 표에 없다. 로터 추력과 호버 콜렉티브로 값을 만든다.
    return { kind: 'flight', key, ...meta,
      bars: {
        speed: unit(60, TOP_SPEED),
        agility: unit(1.9, TOP_AGILITY),
        stability: unit(1 - HOVER_COLLECTIVE, 1) * 0.5 + unit(ROTOR_THRUST, 40) * 0.5,
      } };
  }
  const spec = PLANES[key];
  return { kind: 'flight', key, ...meta,
    bars: {
      speed: unit(spec.maxSpeed, TOP_SPEED),
      agility: unit(spec.rollAuthority, TOP_AGILITY),
      stability: unit(STALL_CEIL - spec.stallSpeed, STALL_CEIL - STALL_FLOOR),
    } };
}

function carRide(key) {
  const spec = VEHICLES[key];
  return { kind: 'car', key, ...VEHICLE_META[key],
    bars: {
      speed: unit(spec.top, VEHICLES.motorcycle.top),
      agility: unit(spec.steerRate, VEHICLES.motorcycle.steerRate),
      // 접지력이 높고 차체가 덜 기울수록 안정적이다.
      stability: unit(spec.grip, 1) * 0.6 + unit(1 - spec.lean, 1) * 0.4,
    } };
}

const walkRide = {
  kind: 'walk', key: 'walk', ko: '도보', code: 'WLK',
  eyebrow: 'EGO FOOT / ON FOOT', note: '내려서 걷는다. 무기를 들 수 있다.',
  bars: { speed: unit(RUN_SPEED, TOP_SPEED), agility: 1, stability: 1 },
};

export const RIDE_GROUPS = Object.freeze([
  { key: 'flight', ko: '항공기', rides: SELECTABLE_PLANE_KEYS.map(flightRide) },
  { key: 'car', ko: '차량', rides: VEHICLE_KEYS.map(carRide) },
  { key: 'walk', ko: '도보', rides: [walkRide] },
]);

export const RIDE_GROUP_KEYS = RIDE_GROUPS.map((group) => group.key);

export function rideOf(kind, key) {
  const group = RIDE_GROUPS.find((entry) => entry.key === kind);
  return group?.rides.find((ride) => ride.key === key) || null;
}
