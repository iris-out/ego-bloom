import ModelFinish from './ModelFinish.jsx';
import Sedan from './Sedan';
import Motorcycle from './Motorcycle';
import Tank from './Tank';
import Howitzer from './Howitzer';
import ArmoredCar from './ArmoredCar';
import AntiAir from './AntiAir';
import Suv from './Suv';
import Convertible from './Convertible';
import DriftCar from './DriftCar.jsx';
import Coupe from './Coupe';
import Supercar from './Supercar';
import Electric from './Electric';
import Truck from './Truck';
import Formula from './Formula';
import { validVehicle } from '../identity.js';

/** 지상 차량의 시각 원본을 고른다. 주행, 주차, 원격 차량이 모두 이곳을 거친다.
 * 모든 차량은 같은 계약을 지킨다. 앞이 -Z, 좌우가 X, 바퀴 최하단이 y -0.9 다.
 * 바퀴 회전은 모델이 스스로 돌린다. wheelsRef 가 있으면 조향과 속도를 매 프레임 직접
 * 읽고(aimRef 와 같은 계약), 없으면 steer/speed props(원격 차량 등)로 대신한다.
 * firstPerson 은 각 모델에 그대로 넘긴다. 모델이 캐빈 group 을 숨기고 실내가 대신 그린다.
 * scoped 도 같이 넘긴다. 전투 차량이 조준경을 켜면 같은 캐빈 group 을 숨겨 카메라가 포신
 * 앞으로 나가는 동안 장갑이 화면에 들어오지 않게 한다.
 */
// Keep this exhaustive with VEHICLE_KEYS. validVehicle deliberately accepts every
// key, so omitting one here turns Model into undefined and crashes Canvas.
const MODELS = { drift: DriftCar, sedan: Sedan, motorcycle: Motorcycle, suv: Suv, convertible: Convertible, coupe: Coupe, supercar: Supercar, electric: Electric, formula: Formula, truck: Truck, tank: Tank, howitzer: Howitzer, armored: ArmoredCar, aa: AntiAir };

export default function VehicleModel({ vehicle, wheelsRef, steer = 0, speed = 0, turretYaw = 0, barrelPitch = 0, aimRef, firstPerson = false, scoped = false }) {
  const Model = MODELS[validVehicle(vehicle)];
  return <ModelFinish version={`${vehicle}:${firstPerson}:${scoped}`}><Model wheelsRef={wheelsRef} steer={steer} speed={speed} turretYaw={turretYaw} barrelPitch={barrelPitch} aimRef={aimRef} firstPerson={firstPerson} scoped={scoped} /></ModelFinish>;
}
