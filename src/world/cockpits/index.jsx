import { useLayoutEffect } from 'react';
import { BomberCockpit, FighterCockpit, HelicopterCockpit, InterceptorCockpit, JetCockpit, PropCockpit } from './AircraftCockpits.jsx';
import { AntiAirInterior, ArmoredInterior, ConvertibleInterior, HowitzerInterior, MotorcycleInterior, SedanInterior, SuvInterior, TankInterior, TruckInterior } from './VehicleInteriors.jsx';
import { applyPalette, setNightPanels } from './materials.js';
import StaticBatch from '../StaticBatch.jsx';

/** 탈것 키 하나를 실내 하나로 잇는 선택기다. PlaneModel.jsx 와 같은 역할이다.
 * 카메라가 실내에 있을 때만 마운트한다. 호출자가 언마운트를 책임진다. */
const COCKPITS = {
  jet: JetCockpit, bomber: BomberCockpit, prop: PropCockpit, fighter: FighterCockpit,
  interceptor: InterceptorCockpit, helicopter: HelicopterCockpit,
  sedan: SedanInterior, motorcycle: MotorcycleInterior, suv: SuvInterior, convertible: ConvertibleInterior, truck: TruckInterior,
  tank: TankInterior, howitzer: HowitzerInterior, armored: ArmoredInterior, aa: AntiAirInterior,
};

/** statusRef 는 CarMode/FlightMode 가 0.15초마다 값만 바꿔 넣는 ref 다. React 상태가
 * 아니므로 실내는 status 가 바뀌어도 다시 렌더하지 않고, 계기와 바늘이 매 프레임 스스로
 * 그 ref 를 읽는다. aimRef 는 전투 차량 포탑용, controlsRef 는 항공기 조종간용이다.
 * 정적인 대시보드·계기판·좌석은 StaticBatch 가 한 데 합쳐 draw call 을 줄인다. 바늘,
 * 스티어링, 조종간, 화면, 포탑 표식처럼 매 프레임 움직이는 조각은 각자
 * userData={{ dynamic: true }} 로 스스로를 빼 둔다. */
export default function Cockpit({ rideKey, statusRef, controlsRef, poseRef, aimRef, night = false, quality = 'medium', weather = 'clear' }) {
  // 공유 재질을 고치는 부수효과라 마운트 여부와 무관하게 같은 순서로 돈다.
  // 언마운트에서 낮값으로 되돌리지 않으면 다음에 낮에 탔을 때 밤값이 남는다. applyPalette 는
  // rideKey 가 바뀔 때마다 다시 불러야 색이 이전 탈것 것으로 남지 않는다.
  useLayoutEffect(() => {
    setNightPanels(night);
    applyPalette(rideKey);
    return () => setNightPanels(false);
  }, [night, rideKey]);
  const Interior = COCKPITS[rideKey];
  if (!Interior) return null;
  // Cockpit 은 탈것이 바뀌어도 같은 컴포넌트 인스턴스로 남고 Interior 만 바뀐다.
  // StaticBatch 는 마운트 때 한 번만 합치므로 version 을 rideKey, night 에 묶어 탈것이
  // 바뀌거나 밤낮이 바뀔 때마다(장갑차·대공포 페리스코프처럼 night 로 재질이 바뀌는
  // 조각이 있다) 이전 병합을 풀고 다시 합치게 한다.
  return <StaticBatch version={`${rideKey}:${night}`}>
    <Interior statusRef={statusRef} controlsRef={controlsRef} poseRef={poseRef}
      aimRef={aimRef} night={night} quality={quality} weather={weather} />
  </StaticBatch>;
}
