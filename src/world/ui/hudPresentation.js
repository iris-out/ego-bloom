import { isCombatVehicle } from '../groundWeapons.js';
import { isArmed } from '../health.js';
import { armamentOf } from '../hardpoints.js';

/** One policy for showing actual mode data. It never manufactures status values. */
export function hudPresentation(kind, rideKey, view, status = {}) {
  const walking = kind === 'walk';
  const flight = kind === 'flight';
  const car = kind === 'car';
  const firstPerson = view === 'first';
  const combatCar = car && isCombatVehicle(rideKey);
  const mounts = flight ? armamentOf(rideKey) : null;
  const combatFlight = flight && isArmed(kind, rideKey);
  return {
    walking, flight, car, firstPerson, combatCar, combatFlight,
    // 민간 차량도 충돌 내구도가 있으므로 차종과 무관하게 보고된 차체 게이지를 표시한다.
    showHull: (car || combatFlight) && Number.isFinite(status.hull),
    showCarGauges: car && !firstPerson,
    showFlightReadouts: flight && !firstPerson,
    showCannon: Boolean(mounts?.cannon),
    showMissiles: Boolean(mounts?.missile),
    showBombs: Boolean(mounts?.bomb),
    showRange: (combatCar || Boolean(mounts)) && Number.isFinite(status.range),
  };
}
