import ModelFinish from './ModelFinish.jsx';
import Jet from './Jet';
import Airship from './Airship.jsx';
import Bomber from './Bomber';
import PropFighter from './PropFighter';
import Fighter from './Fighter';
import Interceptor from './Interceptor';
import Helicopter from './Helicopter';
import EngineGlow from './EngineGlow';
import { validPlane } from '../identity.js';

/** Chooses the aircraft silhouette a pilot selected. Parked, local and remote
 * aircraft all go through here so one key maps to exactly one visual source.
 * Every model shares the Jet contract: origin at the fuselage center, nose toward
 * -Z, wings along X, wheel bottoms at about -1.9 for FLIGHT_GROUND=2.1.
 * glowRef 가 있으면(FlightMode 조종 중) throttle/phase/bay 를 매 프레임 직접 읽는다
 * (VehicleModel 의 wheelsRef 와 같은 계약). 없으면(주기, 원격 기체) 아래 props 를 쓴다.
 * firstPerson 은 모델에 그대로 넘긴다. EngineGlow 는 캐노피와 무관해 받지 않는다.
 */
const MODELS = { airship: Airship, jet: Jet, bomber: Bomber, prop: PropFighter, fighter: Fighter, interceptor: Interceptor, shotgun: Interceptor, helicopter: Helicopter };

/** bay 는 폭격기 폭탄창이 열린 정도(0~1) 다. 다른 기종은 무시한다.
 * throttle 은 프로펠러 회전과 배기에 함께 쓰인다. */
export default function PlaneModel({ plane, glowRef, throttle = 0, phase = 'runway', bay = 0, firstPerson = false }) {
  const key = validPlane(plane);
  const Model = MODELS[key];
  return <><ModelFinish version={`${key}:${firstPerson}`}><Model glowRef={glowRef} throttle={throttle} phase={phase} bay={bay} firstPerson={firstPerson} /></ModelFinish><EngineGlow plane={key} glowRef={glowRef} throttle={throttle} phase={phase} /></>;
}
