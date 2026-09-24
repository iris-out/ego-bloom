import { modernScreenFacets } from './modernCabinLayout.js';
import { cockpitFov, eyePoint } from '../eyePoints.js';
import { barTop, hoodEdge, ledgeEdge, ringTop, sideWall } from './gaugeClearance.js';
import { GROUND_GUNS } from '../groundWeapons.js';

/** 승용차 계열 1인칭 실내의 배치 데이터다. Three 와 React 에 의존하지 않아 단위 테스트가
 * 비율과 화각을 그대로 검사한다. RoadInteriors.jsx 가 유일한 소비자다.
 *
 * 좌표 규약이 둘이다. 좌우로 걸치는 구조 값(innerWidth, pillarX, seats.x, console.x) 의 x 는
 * 차체 중심 기준 절대 좌표이고, 그 밖의 y 와 z, 운전자 앞 조각(dials, display, wheel, vents,
 * switches, pedals) 은 전부 눈 기준 상대 좌표다. cabinLayout 의 cabin() 과 at() 이 각각 짝이다.
 *
 * 숫자는 models/Sedan.jsx, Suv.jsx, Convertible.jsx, Truck.jsx 의 외장 좌표에서 파생했다.
 * 근거는 차종마다 첫 줄 주석에 적었다. 외장을 고치면 여기도 함께 고친다. */
export const ROAD_CABINS = Object.freeze({
  // 외장: 캐빈 상자 x ±0.86, 지붕판 y 0.67..0.77, 앞유리 중심 [0,0.55,-0.98] 기울기 0.55,
  // 섀시 윗면 y -0.17. 눈 [-0.55,0.55,-0.15]. 지붕판 윗면에서 3cm 아래가 헤드라이너다.
  // 지붕은 외장 지붕판이 아니라 시야가 정한다. 외장 캐빈은 1인칭에서 숨으므로 맞출 필요가 없다.
  // 헤더 아래 모서리가 눈 위 25.2도(세단) 에 오도록 roofY 에서 앞유리 윗모서리를 거꾸로 구했다.
  sedan: Object.freeze({
    innerWidth: 1.60, dashWidth: 1.50,
    roofY: 0.26, floorY: -0.70, sillY: -0.25,
    headerHeight: 0.045, headerDepth: 0.04,
    // 대시 상단 앞 모서리는 앞유리 밑선(눈 기준 y -0.234, z -0.974) 바로 안쪽이다.
    dashTopY: -0.25, dashZ: -0.84, dashBreakY: -0.285, dashBreakZ: -0.76,
    dashFaceY: -0.52, dashFaceZ: -0.82,
    // 계기 후드 입술이다. 눈에서 계기 윗모서리로 가는 시선보다 1도 넘게 위에 둔다.
    // 입술 아래 앞모서리(hoodY - 0.02) 가 -10.6도이고 계기 윗변이 -12.4도다.
    // -0.17 이던 때는 입술이 -16.5도라 계기 윗변(-16.0도) 을 먹었다.
    hoodY: -0.10, hoodZ: -0.64,
    pillarX: 0.76, glassAngle: 0.579, bPillarZ: 0.20,
    // glass 는 앞유리 아가리다. pane 이 참이면 실내가 유리 한 장을 직접 그린다.
    // 밑선(눈 기준 -0.239, -0.976) 은 대시에 묶여 그대로 두고 윗모서리만 0.312 까지 올렸다.
    // 유리 띠가 눈 위 25.2도에서 아래 13.7도까지 38.9도다(세로 화각 72).
    glass: Object.freeze([0, 0.0215, -0.6865, 1.50, 0.620]), pane: true,
    // 옆유리는 창틀(sillY) 에서 지붕까지다. 높이 = roofY - sillY - 0.03.
    sideGlass: Object.freeze([0.815, 0.005, 0.05, 1.40, 0.48]),
    rearGlass: Object.freeze([0, 0.05, 1.30, 1.50, 0.50, -0.5]),
    // 계기 묶음이 폭 0.576 으로 대시(1.50) 의 38% 를 차지한다. 계기 아랫변이 -24.6도로
    // 화각 절반(36) 에서 11.4도 안쪽이고 스티어링 림 윗점(-26.6도) 보다 2.0도 위다.
    // -0.30 이던 때는 아랫변이 -27.7도라 림이 눈금 아래 절반을 덮었다.
    dials: Object.freeze([Object.freeze([-0.20, -0.25, -0.74]), Object.freeze([0.20, -0.25, -0.74])]),
    dialRadius: 0.088,
    display: Object.freeze([0, -0.25, -0.745, 0.19, 0.10]),
    screens: modernScreenFacets('sedan'),
    screenBackingDepth: 0.024, screenOffset: 0.018,
    // 림 윗점이 계기 아랫변보다 아래로 내려오도록 휠을 2cm 낮췄다. 앉은 운전자의 휠 중심은
    // 눈에서 0.5 안팎 아래다.
    wheel: Object.freeze({ y: -0.53, z: -0.60, radius: 0.19, tilt: -0.35, ratio: 2.2 }),
    seats: Object.freeze({ driverX: -0.52, passengerX: 0.42, y: -0.60, z: 0.12, width: 0.48, depth: 0.50, material: 'leather' }),
    console: Object.freeze({ x: -0.05, width: 0.34, top: -0.50, z: -0.10, depth: 1.20 }),
    rear: Object.freeze({ y: -0.34, z: 0.95, width: 1.50, height: 0.50 }),
    // 벤트는 대시 앞면에서, 공조 노브는 센터 스택 앞면에서 1.5cm 나온 자리다.
    vents: Object.freeze([Object.freeze([-0.17, -0.42, -0.75]), Object.freeze([0.77, -0.42, -0.75])]),
    switches: Object.freeze([Object.freeze([0.40, -0.50, -0.74]), Object.freeze([0.50, -0.50, -0.74]), Object.freeze([0.60, -0.50, -0.74])]),
    hazard: Object.freeze([0.50, -0.40, -0.74]),
    pedals: Object.freeze([-0.02, -0.62, -0.75]),
    wiper: Object.freeze({ y: -0.218, z: -0.88, length: 0.40, gap: 0.72, rest: -1.30 }),
  }),
  // 외장: 캐빈 상자 x ±0.95, 지붕판 y 0.88..0.96, 앞유리 중심 [0,0.62,-1.28] 기울기 0.42,
  // 섀시 윗면 y 0.06, 보닛 윗면 y 0.39. 눈 [-0.57,0.8,-0.2].
  // 외장 캐빈 상자 윗면은 눈 위 0.10 뿐이라 헤더가 눈 위 7도에 걸린다. 지붕을 외장에서 떼어
  // 0.30 으로 올려 헤더 아래 모서리를 21.6도에 둔다.
  suv: Object.freeze({
    innerWidth: 1.76, dashWidth: 1.66,
    roofY: 0.269, floorY: -0.78, sillY: -0.36,
    headerHeight: 0.045, headerDepth: 0.04,
    // 앞유리 면을 y=0.50(눈 기준 -0.30) 에서 만나므로 대시가 깊다. 캡 앞이 긴 SUV 의 비율이다.
    dashTopY: -0.34, dashZ: -1.13, dashBreakY: -0.385, dashBreakZ: -0.90,
    dashFaceY: -0.62, dashFaceZ: -0.94,
    // 입술 아래 앞모서리가 -9.5도, 계기 윗변이 -11.1도, 계기 화면 윗변이 -14.7도다.
    // 입술을 뒤로(-0.70 에서 -0.78) 물리면서 함께 올려 계기 윗줄 위에서 끝나게 했다.
    hoodY: -0.15, hoodZ: -0.78,
    pillarX: 0.84, glassAngle: 0.42, bPillarZ: 0.35,
    // 밑선(-0.463, -1.207) 고정, 윗모서리 0.341. 유리 띠가 42.6도다(세로 화각 70).
    glass: Object.freeze([0, -0.119, -1.0255, 1.66, 0.885]), pane: true,
    sideGlass: Object.freeze([0.895, -0.05, 0.10, 1.60, 0.65]),
    rearGlass: Object.freeze([0, -0.075, 1.87, 1.60, 0.70, -0.42]),
    // 계기를 6cm 뒤로 물려 같은 지름이 차지하는 각을 줄였다. 아랫변 -22.3도, 림 윗점 -26.1도다.
    // z 는 대시 꺾임(-0.90) 보다 눈 쪽이라 대시 상판 앞모서리가 계기 앞을 지나지 않는다.
    dials: Object.freeze([Object.freeze([-0.185, -0.30, -0.86]), Object.freeze([0.245, -0.30, -0.86])]),
    dialRadius: 0.092,
    display: Object.freeze([0, -0.32, -0.865, 0.21, 0.105]),
    screens: modernScreenFacets('suv'),
    centerScreen: modernScreenFacets('suv')[1],
    screenBackingDepth: 0.024, screenOffset: 0.018,
    wheel: Object.freeze({ y: -0.59, z: -0.66, radius: 0.195, tilt: -0.38, ratio: 2.2 }),
    seats: Object.freeze({ driverX: -0.55, passengerX: 0.50, y: -0.61, z: 0.14, width: 0.52, depth: 0.54, material: 'fabric' }),
    console: Object.freeze({ x: -0.03, width: 0.38, top: -0.52, z: -0.10, depth: 1.24 }),
    rear: Object.freeze({ y: -0.36, z: 1.05, width: 1.66, height: 0.54 }),
    vents: Object.freeze([Object.freeze([-0.18, -0.50, -0.875]), Object.freeze([0.80, -0.50, -0.875])]),
    switches: Object.freeze([Object.freeze([0.42, -0.58, -0.88]), Object.freeze([0.53, -0.58, -0.88]), Object.freeze([0.64, -0.58, -0.88])]),
    hazard: Object.freeze([0.53, -0.47, -0.88]),
    pedals: Object.freeze([-0.02, -0.70, -0.92]),
    wiper: Object.freeze({ y: -0.46, z: -1.20, length: 0.42, gap: 0.80, rest: -1.32 }),
  }),
  // 외장: 차체 윗면 y 0.05, 앞유리 밑선 [0,0.1357,-0.8207] 기울기 0.5. 눈 [-0.53,0.5,-0.05].
  // 외장 앞유리 틀(헤더 y 0.53) 은 눈높이에 걸려 1인칭에서 시야를 막으므로 캐빈 group 으로
  // 숨겼다. 실내가 같은 밑선에서 더 높은 틀을 그린다. 헤더 아래 모서리가 눈 위 0.22(33.1도) 다.
  // 지붕과 B 필러는 없다. 좌석, 롤바, 토노 커버, 외장 콘솔은 앞부분에 남아 실내가 그리지 않는다.
  convertible: Object.freeze({
    // 지붕도 문 위 틀도 없어 실내 폭을 외장 차체(반폭 1.05) 가까이 넓게 쓴다. 좁게 잡으면
    // 필러가 운전석 바로 옆에 서서 얇은 기둥이 화면을 가로지르는 판으로 보인다.
    innerWidth: 1.96, dashWidth: 1.50,
    roofY: null, floorY: -0.43, sillY: -0.30,
    dashTopY: -0.29, dashZ: -0.73, dashBreakY: -0.33, dashBreakZ: -0.58,
    dashFaceY: -0.44, dashFaceZ: -0.60,
    // 나셀형 후드다. 대시가 낮고 눈이 낮아 계기를 림 위로 내놓으면 입술도 눈 아래 5cm 까지
    // 올라온다. 입술이 -6.9도, 계기 윗변이 -8.4도다. 고전 로드스터의 비율 그대로다.
    hoodY: -0.05, hoodZ: -0.58,
    // 긴 회색 판 한 장처럼 떠 보이지 않게 짧고 얇은 캡과 매립 나셀을 따로 둔다.
    hoodLead: Object.freeze([0.035, 0.10]), hoodThickness: 0.018,
    binnacle: Object.freeze({ x: 0, y: -0.19, z: -0.705, width: 0.48, height: 0.22, depth: 0.035 }),
    // 필러는 차체 가장자리(외장 반폭 1.05) 바로 안쪽이다. 0.73 에 두면 운전석(x -0.53) 에서
    // 0.2 밖에 안 떨어져 얇은 기둥이 화면을 가로지르는 판으로 보인다.
    pillarX: 0.95, glassAngle: 0.5, bPillarZ: null,
    // 밑선은 외장 앞유리 그대로(-0.364, -0.771) 두고 윗모서리만 0.268 까지 올렸다.
    // 유리 띠가 눈 위 33.1도에서 아래 25.3도까지 58.4도다(세로 화각 74). 지붕이 없어 위가 트인다.
    glass: Object.freeze([0, -0.048, -0.598, 1.50, 0.720]), pane: true,
    // 지붕을 접었으므로 옆유리도 내려가 있다.
    sideGlass: null,
    rearGlass: null,
    deflector: Object.freeze([0, -0.06, 0.52, 0.72, 0.20]),
    // 실제 오픈카처럼 계기 둘을 림 위로 내놓았다. -0.28 이던 때는 계기 아랫변 -29.5도가
    // 림 윗점 -11.5도보다 한참 아래라 계기판이 통째로 휠 뒤에 있었다. 지금은 아랫변 -19.4도,
    // 림 윗점 -23.0도다. 계기를 뒤로(-0.62 에서 -0.68) 물려 각도 함께 줄였다.
    dials: Object.freeze([Object.freeze([-0.165, -0.17, -0.68]), Object.freeze([0.165, -0.17, -0.68])]),
    dialRadius: 0.070,
    // 화면 높이는 0.08 에서 0.12 다. 계기 지름(0.14) 안쪽이라 후드와 림 사이 창에 함께 든다.
    display: Object.freeze([0, -0.17, -0.685, 0.16, 0.12]),
    // 외장 스티어링도 캐빈 group 으로 숨겼으므로 실내가 온전한 휠을 운전자 정면에 그린다.
    // 휠을 9cm 내리고 지름을 0.18 에서 0.15 로 줄였다. 둘 다 해야 림 윗점이 계기 아래로 간다.
    wheel: Object.freeze({ x: 0, y: -0.39, z: -0.50, radius: 0.15, tilt: -0.35, ratio: 2.2 }),
    seats: null,
    console: Object.freeze({ x: -0.03, width: 0.30, top: -0.33, z: -0.16, depth: 0.92 }),
    rear: Object.freeze({ y: -0.20, z: 0.62, width: 1.44, height: 0.26 }),
    vents: Object.freeze([Object.freeze([-0.16, -0.38, -0.545]), Object.freeze([0.72, -0.38, -0.545])]),
    switches: Object.freeze([Object.freeze([0.40, -0.40, -0.56]), Object.freeze([0.50, -0.40, -0.56]), Object.freeze([0.60, -0.40, -0.56])]),
    // 대시가 얕아 비상등을 센터 스택 윗줄(대시 꺾임 -0.345 아래) 안으로 내렸다.
    hazard: Object.freeze([0.50, -0.365, -0.56]),
    pedals: Object.freeze([-0.02, -0.36, -0.68]),
    wiper: Object.freeze({ y: -0.35, z: -0.80, length: 0.34, gap: 0.62 }),
  }),
  formula: Object.freeze({
    innerWidth: 0.82, dashWidth: 0.76,
    roofY: null, floorY: -0.62, sillY: -0.22,
    dashTopY: -0.24, dashZ: -0.64, dashBreakY: -0.30, dashBreakZ: -0.48,
    dashFaceY: -0.38, dashFaceZ: -0.50,
    hoodY: -0.08, hoodZ: -0.50,
    hoodLead: Object.freeze([0.03, 0.09]), hoodThickness: 0.018,
    pillarX: 0.39, glassAngle: 0.35, bPillarZ: null,
    glass: Object.freeze([0, 0.02, -0.55, 0.70, 0.34]), pane: false,
    sideGlass: null, rearGlass: null,
    dials: Object.freeze([Object.freeze([-0.14, -0.20, -0.56]), Object.freeze([0.14, -0.20, -0.56])]),
    dialRadius: 0.055,
    display: Object.freeze([0, -0.20, -0.565, 0.18, 0.09]),
    wheel: Object.freeze({ x: 0, y: -0.385, z: -0.45, radius: 0.14, tilt: -0.28, ratio: 1.6 }),
    console: Object.freeze({ x: 0, width: 0.34, top: -0.32, z: 0.05, depth: 0.82 }),
    rear: Object.freeze({ y: -0.10, z: 0.62, width: 0.72, height: 0.50 }),
    vents: Object.freeze([]), switches: Object.freeze([]), hazard: Object.freeze([0, -0.32, -0.52]),
    pedals: Object.freeze([0, -0.56, -0.70]), wiper: null,
    halo: Object.freeze({ openHalfWidth: 0.19, postX: 0, postY: 0.18, postZ: -0.55 }),
  }),
  // 외장: 캡 상자 x ±1.15 y -0.25..1.65, 지붕판 1.64..1.80, 앞유리 [0,1.05,-3.74] 기울기 0.08,
  // 옆창 [±1.16,1.05,-2.85], 적재함 앞면 z -1.5. 눈 [-0.6,1.3,-2.2]. 캡오버라 대시가 깊다.
  // 캡오버는 앞유리가 눈에서 1.5 앞이라 지붕이 낮으면 헤더가 8도에 걸린다. 0.44 로 올려
  // 헤더 아래 모서리를 17.6도에 둔다. 외장 지붕판 윗면(눈 위 0.50) 아래라 캡 밖으로 나가지 않는다.
  truck: Object.freeze({
    innerWidth: 2.16, dashWidth: 2.05,
    roofY: 0.44, floorY: -1.05, sillY: -0.65,
    dashTopY: -0.44, dashZ: -1.54, dashBreakY: -0.44, dashBreakZ: -0.90,
    dashFaceY: -0.72, dashFaceZ: -0.92,
    // 입술 아래 앞모서리가 -11.4도, 계기 윗변이 -13.4도다. 캡오버라 대시가 깊어 입술을
    // 9cm 올려도 앞유리 아가리를 거의 먹지 않는다.
    hoodY: -0.15, hoodZ: -0.84,
    pillarX: 1.02, glassAngle: 0.08, bPillarZ: null,
    // 밑선(-0.699, -1.576) 고정, 윗모서리 0.448. 유리 띠가 41.5도다(세로 화각 68).
    glass: Object.freeze([0, -0.125, -1.530, 2.00, 1.150]), pane: true,
    sideGlass: Object.freeze([1.06, -0.105, -0.65, 1.20, 1.06]),
    // 뒤창이 없다. 적재함 앞면이 막고 있어 캡 뒷벽이 그 자리다.
    rearGlass: null,
    dials: Object.freeze([
      Object.freeze([-0.24, -0.30, -0.86]), Object.freeze([0.24, -0.30, -0.86]), Object.freeze([0.46, -0.30, -0.86]),
    ]),
    dialRadius: 0.095,
    display: Object.freeze([0, -0.30, -0.865, 0.24, 0.12]),
    wheel: Object.freeze({ y: -0.65, z: -0.72, radius: 0.23, tilt: -0.70, ratio: 2.2 }),
    seats: Object.freeze({ driverX: -0.60, passengerX: 0.60, y: -0.62, z: 0.10, width: 0.52, depth: 0.54, material: 'leather' }),
    // 엔진 덮개가 좌석 사이에 솟는다. 콘솔 자리를 대신하므로 폭과 높이가 승용차보다 크다.
    console: Object.freeze({ x: 0, width: 0.56, top: -0.66, z: -0.30, depth: 1.30 }),
    rear: Object.freeze({ y: -0.30, z: 0.48, width: 2.05, height: 0.80 }),
    // 계기 셋이 커져 오른쪽 계기가 눈 기준 0.555 까지 왔다. 센터 스택(노브 줄 둘레 ±0.19)
    // 과 겹치지 않도록 스택과 오른쪽 벤트를 0.18 씩 바깥으로 밀었다. 계기는 아랫변 -24.7도,
    // 림 윗점 -27.5도다.
    vents: Object.freeze([Object.freeze([-0.34, -0.50, -0.86]), Object.freeze([1.02, -0.50, -0.86])]),
    switches: Object.freeze([Object.freeze([0.68, -0.58, -0.86]), Object.freeze([0.80, -0.58, -0.86]), Object.freeze([0.92, -0.58, -0.86])]),
    hazard: Object.freeze([0.80, -0.49, -0.86]),
    pedals: Object.freeze([-0.02, -0.96, -1.10]),
    // 앞유리가 거의 수직이라 와이퍼 축이 유리 밑선(-0.699, -1.576) 바깥 3cm 에 선다.
    wiper: Object.freeze({ y: -0.696, z: -1.606, length: 0.62, gap: 1.00 }),
  }),
});

/** 전투 차량 포탑 바스켓 콘솔이다. CarMode 가 Cockpit 을 pivot(GROUND_GUNS[vehicle].turret)
 * 에 두고 aim.yaw 로 돌리는 group 으로 감싸므로(포탑과 함께 도는 바스켓), ArmorInteriors 의
 * 모든 조각은 eyePoint 가 아니라 이 pivot 을 원점으로 둔 좌표를 쓴다. eyeInBasket 이 그 기준
 * 눈 위치(눈 - pivot)이고, ArmorInteriors 의 basket(vehicle, offset) 헬퍼가 여기 더한다.
 * pivot 은 GROUND_GUNS 와 같은 값을 그대로 읽어 두 표가 어긋나지 않는다. */
function gunnerConsole(vehicle, extra) {
  const pivot = GROUND_GUNS[vehicle].turret;
  const eye = eyePoint(vehicle);
  const eyeInBasket = [eye[0] - pivot[0], eye[1] - pivot[1], eye[2] - pivot[2]];
  return Object.freeze({ pivot: Object.freeze([...pivot]), eyeInBasket: Object.freeze(eyeInBasket), ...extra });
}

/** 접안 틀 안쪽 반각이 화각 반각의 0.6 이 되도록 반폭을 구한다(테스트는 0.5 이상만 요구해
 * 여유를 둔다). distance 는 눈에서 틀까지 거리, fovDeg 는 그 기종의 1인칭 세로 화각(도) 이다. */
function sightHalfWidth(distance, fovDeg) {
  return distance * Math.tan((fovDeg / 2) * 0.6 * (Math.PI / 180));
}

/** AABB 반쪽 폭 상수다. 벽 두께(0.03) 를 중심 좌표 양쪽에 나눈 값이다. */
const WALL_T = 0.015;
/** 축 하나를 따라 벽 한 장의 AABB 를 만든다. axis 가 'x' 면 x 를 그 값 ±WALL_T 로 얇게 두고
 * 나머지 두 축은 [min,max] 그대로 쓴다. glass 가 참이면 그 자리를 관측창으로 그리고 계기
 * 가림 판정에서도 뺀다. 좁은 포탑에서는 불투명 벽 한 장이 화면 3분의 1을 먹는다. */
function wallBox(axis, at, aRange, bRange, glass = false) {
  const thin = Object.freeze([at - WALL_T, at + WALL_T]);
  if (axis === 'x') return Object.freeze({ glass, x: thin, y: Object.freeze([...aRange]), z: Object.freeze([...bRange]) });
  return Object.freeze({ glass, x: Object.freeze([...aRange]), y: Object.freeze([...bRange]), z: thin });
}

/** 전차, 자주포 앞벽의 조준경 개구부 넷(위 아래 왼쪽 오른쪽) 이다. 개구부는 눈에서 ±14도
 * 원뿔이 frontZ 를 지나는 사각형(half) 보다 넓어야 한다(정확히는 half 를 그대로 쓴다.
 * 호출자가 미리 tan(14도) x 거리보다 크게 잡아 둔다). eyeX, eyeY 가 개구부 중심이다. */
function piercedFront(frontZ, xRange, yRange, eyeX, eyeY, half) {
  const apTop = eyeY + half, apBottom = eyeY - half, apLeft = eyeX - half, apRight = eyeX + half;
  return [
    wallBox('z', frontZ, xRange, Object.freeze([apTop, yRange[1]])), // 위
    wallBox('z', frontZ, xRange, Object.freeze([yRange[0], apBottom])), // 아래
    wallBox('z', frontZ, Object.freeze([xRange[0], apLeft]), Object.freeze([apBottom, apTop])), // 왼쪽
    wallBox('z', frontZ, Object.freeze([apRight, xRange[1]]), Object.freeze([apBottom, apTop])), // 오른쪽
  ];
}

export const GUNNER_CONSOLES = Object.freeze({
  tank: gunnerConsole('tank', {
    // 접안 틀까지 거리다. near(0.05) 와 근접 조각 상한(0.45) 사이를 지킨다.
    // 반폭은 화각 42도(반각 21도) 의 0.6 배가 지나가는 크기다: 0.35 * tan(12.6도) = 0.078.
    sight: Object.freeze({ distance: 0.35, halfWidth: sightHalfWidth(0.35, 42), halfHeight: sightHalfWidth(0.35, 42) }),
    // 화각이 42도로 가장 좁아 계기 자리가 가장 빠듯하다. 눈 아래 0.20, 앞 0.62 이던 때는
    // 아랫변이 -22.4도라 화각 절반(21) 밖으로 나가 아래 절반이 화면 밖에서 잘렸다.
    // 0.16 으로 올리고 0.13 뒤로 물려 아랫변이 -16.0도, 윗변이 -8.0도다.
    // x 는 왼쪽 바스켓 벽(눈 기준 -0.285) 과 가로 화각 오른쪽 끝 사이에 줄지어 넣었다.
    display: Object.freeze([0.21, -0.16, -0.75, 0.22, 0.11]),
    dials: Object.freeze([[-0.205, -0.16, -0.75], [-0.085, -0.16, -0.75], [0.04, -0.16, -0.75]]),
    // 눈 위 지붕 안쪽 판까지 높이다. round 2 에서 0.14 로는 앞벽 개구부(반각 0.199) 가 지붕에
    // 닿아 0.24 로 올렸다(여유 0.04). 전차는 그래도 낮고 좁은 바스켓이다.
    roofY: 0.24,
    // 포탑 안쪽 상자(외장 [0,0.2,0] scale [1.7,0.45,2.0], WP5a) 에서 벽을 잡았다. 안쪽 치수에서
    // 0.05 를 빼(x_half 0.825, z_half 0.975) 눈(eyeInBasket [-0.5,0.30,0.45]) 을 안에 둔다.
    // 실제로는 앞벽을 외장 맨틀릿(전면 경사판 z -0.678..-1.222) 보다 한참 안쪽(z -0.35) 으로
    // 당겼다. 개구부 반각(눈 앞 0.8 에서 0.199) 이 지붕까지 들어가려면 그래야 한다. pivot 기준
    // 원값(좌표는 basket() 을 거치지 않는다, ArmorInteriors.jsx 의 BasketWalls 참고).
    walls: Object.freeze([
      wallBox('x', -0.80, [-0.40, 0.54], [-0.35, 0.90]),
      wallBox('x', 0.80, [-0.40, 0.54], [-0.35, 0.90]),
      wallBox('z', 0.90, [-0.80, 0.80], [-0.40, 0.54]),
      ...piercedFront(-0.35, [-0.80, 0.80], [-0.40, 0.54], -0.5, 0.30, 0.22),
    ]),
  }),
  howitzer: gunnerConsole('howitzer', {
    // 화각 40도(반각 20도) 의 0.6 배: 0.35 * tan(12도) = 0.074.
    sight: Object.freeze({ distance: 0.35, halfWidth: sightHalfWidth(0.35, 40), halfHeight: sightHalfWidth(0.35, 40) }),
    // 화각 40도로 전차 다음으로 좁다. 같은 이유로 0.03 올리고 0.22 뒤로 물렸다.
    // 아랫변 -13.4도, 윗변 -6.7도다. 계기 다섯이 한 줄에 들어가야 해 왼쪽 벽을 0.92 에서
    // 0.94(외장 포탑 x_half 0.95 안쪽) 로 넓혀 왼쪽 계기 자리를 2cm 벌었다.
    display: Object.freeze([0.25, -0.16, -0.90, 0.22, 0.11]),
    dials: Object.freeze([[-0.265, -0.16, -0.90], [-0.145, -0.16, -0.90], [-0.025, -0.16, -0.90]]),
    // 앙각 눈금 0~60도다. AIM_LIMITS.howitzer.pitch 최대(1.05rad, 약 60도) 와 맞춘다.
    elevationDial: Object.freeze([0.085, -0.16, -0.90]),
    // tank 와 같은 이유로 0.20 에서 0.34 로 올렸다(개구부 반각 0.299, 여유 0.04).
    roofY: 0.34,
    // 포탑 안쪽 상자(외장 [0,0.5,0] scale [1.9,1.0,2.6]) 기준. x_half 0.92(개구부 반폭 0.32 가
    // 눈 [-0.58] 기준 -0.90 까지 나가 0.925 안쪽으로 조금 좁혔다), 앞벽은 전면 마운트
    // (z -1.066..-1.634) 보다 한참 안쪽(z -0.50) 이다.
    walls: Object.freeze([
      wallBox('x', -0.94, [-0.53, 0.66], [-0.50, 1.15]),
      wallBox('x', 0.94, [-0.53, 0.66], [-0.50, 1.15]),
      wallBox('z', 1.15, [-0.94, 0.94], [-0.53, 0.66]),
      ...piercedFront(-0.50, [-0.94, 0.94], [-0.53, 0.66], -0.58, 0.32, 0.32),
    ]),
  }),
  // 장갑차는 무인 포탑 바스켓이 아니라 운전석 위 큐폴라다(round 1 항목 2). pivot/eyeInBasket
  // 은 GROUND_GUNS.armored.turret 과 데이터를 맞추려고 그대로 남겨 두지만(포탑은 실제로
  // 그 축으로 돈다), 실내 좌표는 basket() 대신 ArmorInteriors 의 hull()(eyePoint 기준, 회전
  // 없음) 을 쓴다. 무인 포탑은 눈 뒤 오른쪽이라 뒤를 돌아보면 보인다. 슬릿 8장이 유리라
  // walls 목록(불투명 벽) 을 두지 않는다.
  armored: gunnerConsole('armored', {
    // 큐폴라 반지름이다. 슬릿 8개와 해치 링 크기를 정한다.
    cupolaRadius: 0.28,
    // 사격 통제 화면과 방위 다이얼이다. 눈 아래 0.34, 앞 0.52 이던 때는 아랫변이 -36.9도라
    // 화각 절반(34) 밖이었다. 0.24 로 올리고 0.16 뒤로 물려 아랫변이 -23.1도다.
    display: Object.freeze([0.17, -0.24, -0.68, 0.20, 0.10]),
    dials: Object.freeze([[-0.16, -0.24, -0.68]]),
    // 해치 뚜껑 판이다. 눈 위 0.16.
    roofY: 0.16,
  }),
  aa: gunnerConsole('aa', {
    // 반사식 조준기 링이다. 눈 앞 0.45, 반지름 0.07 인 얇은 금속 링(round 1 항목 3).
    sight: Object.freeze({ distance: 0.45, halfWidth: 0.07, halfHeight: 0.07 }),
    // 정면이 완전히 열려(walls 에 앞벽이 없다, SkyWindow 가 유리로 채운다) 계기를 그
    // 안쪽에 둔다. 눈 앞 0.35 는 너무 가까워 아랫변이 -36.1도로 화각 절반(33) 밖이었다.
    // 0.46 까지 물리고 0.04 올려 아랫변이 -25.1도다. 그보다 더 물리면 포탑 몸통 앞면
    // (눈 기준 -0.475) 밖으로 나간다.
    display: Object.freeze([0.22, -0.16, -0.46, 0.22, 0.11]),
    dials: Object.freeze([[-0.20, -0.16, -0.46], [-0.08, -0.16, -0.46], [0.04, -0.16, -0.46]]),
    // 대공포는 거의 수직까지 든다(AIM_LIMITS.aa.pitch 최대 1.45rad, 약 83도). 0~90도 눈금이다.
    // 다섯 번째 계기라 한 줄에 더 들어갈 자리가 없어 화면 위 눈높이 옆에 따로 걸었다.
    elevationDial: Object.freeze([0.20, -0.02, -0.46]),
    roofY: 0.16,
    // 포탑 몸통 상자(외장 [0,0.3,0.1] scale [1.3,0.5,1.5]) 기준. x_half 0.60, z 는 -0.625(앞,
    // 열림) ..0.78(뒤). 앞벽이 없어 옆, 뒤 셋뿐이다(round 2 항목 1, isFrontArc 부호 버그를
    // 아예 없앴다, 이 목록에 앞벽 자체가 없다).
    // 왼쪽 벽은 눈에서 0.28 밖에 안 떨어져 불투명하면 눈 옆 30도부터 화면 왼쪽을 민무늬
    // 흰 판으로 덮는다. 포탑을 더 넓힐 수 없으므로 그 자리를 관측창으로 바꿨다.
    walls: Object.freeze([
      wallBox('x', -0.60, [-0.09, 0.72], [-0.625, 0.78], true),
      wallBox('x', 0.60, [-0.09, 0.72], [-0.625, 0.78]),
      wallBox('z', 0.78, [-0.60, 0.60], [-0.09, 0.72]),
    ]),
  }),
});

/** 오토바이 계기 나셀이다. models/Motorcycle.jsx 의 frontGroup(steerGroup) 과 같은 pivot 을
 * 쓰므로 좌표가 그 group 로컬이다. 계기가 핸들바 가로대 위로 올라오도록 나셀째 위로 올리고
 * 눈 쪽으로 당겼다. bar 는 그 가로대(반지름 0.03 실린더) 자리이고 가림 판정의 기준이다. */
export const BIKE_CLUSTER = Object.freeze({
  steerPivotZ: -1.2,
  position: Object.freeze([0, 0.51, 0.70]),
  rotation: Object.freeze([-0.5, 0, 0]),
  nacelle: Object.freeze([0.50, 0.20, 0.02]),
  speed: Object.freeze({ x: -0.17, radius: 0.075 }),
  rpm: Object.freeze({ x: 0.16, radius: 0.065 }),
  display: Object.freeze([0, -0.005, 0.16, 0.08]),
  bar: Object.freeze({ y: 0.42, z: 0.78, radius: 0.03, halfSpan: 0.40 }),
  // 외장 윈드스크린 두 판을 캐빈 group 으로 숨기고 실내가 유리 한 장으로 다시 세운다.
  // 자리와 기울기는 그 판(models/Motorcycle.jsx) 과 같다.
  windscreen: Object.freeze({ y: 0.50, z: 0.36, width: 0.46, height: 0.30, tilt: -0.45 }),
});

/** 전투 차량 계기 원판 반지름이다. ArmorInteriors 의 Dial 과 같은 값을 써야 검사한 각이
 * 화면 각과 같다. */
export const ARMOR_DIAL = Object.freeze({ main: 0.055, bearing: 0.05 });

/** 계기 후드 판의 두께 절반이다. RoadInteriors 의 Dashboard 가 scale y 0.04 로 그린다. */
const HOOD_HALF = 0.02;
/** 대시 상판의 두께 절반이다. 같은 곳에서 scale y 0.05 로 그린다. */
const PAD_HALF = 0.025;
/** Yoke 의 림 토러스는 반지름 1 에 튜브 0.09 라 바깥이 1.09 배다. */
const RIM_OUTER = 1.09;

/** 승용차 네 대의 계기와 가림 조각이다. gaugeClearance 의 gaugeFaults 가 그대로 읽는다. */
function roadRig(vehicle) {
  const spec = ROAD_CABINS[vehicle];
  const gauges = vehicle === 'sedan'
    ? spec.screens.map(screen => ({
      id: `sedan-${screen.id}`, x: screen.x, y: screen.y, z: screen.z + spec.screenOffset + 0.008,
      halfWidth: screen.width / 2, halfHeight: screen.height / 2,
    }))
    : spec.dials.map(([x, y, z], index) => ({ id: `${vehicle}-dial${index}`, x, y, z, radius: spec.dialRadius }));
  if (vehicle !== 'sedan') {
    const [dx, dy, dz, width, height] = spec.display;
    gauges.push({ id: `${vehicle}-display`, x: dx, y: dy, z: dz, halfWidth: width / 2, halfHeight: height / 2 });
  }
  const xs = spec.dials.map((dial) => dial[0]);
  const hoodSpan = [Math.min(...xs) - spec.dialRadius - 0.02, Math.max(...xs) + spec.dialRadius + 0.02];
  // 대시 상판은 차체 중심 기준이라 운전석 x 만큼 옮겨야 눈 기준 좌우각이 된다.
  const eyeX = eyePoint(vehicle)[0];
  const dashSpan = [-spec.dashWidth / 2 - eyeX, spec.dashWidth / 2 - eyeX];
  const wheel = spec.wheel;
  return {
    vehicle, aspect: vehicle === 'sedan' ? 16 / 9 : undefined,
    gauges,
    occluders: [
      ...(['sedan', 'suv'].includes(vehicle) ? [] : [hoodEdge('hood', spec.hoodY - HOOD_HALF, spec.hoodZ, hoodSpan)]),
      ringTop('rim', { x: wheel.x || 0, y: wheel.y, z: wheel.z, radius: wheel.radius * RIM_OUTER, tilt: wheel.tilt }),
      ledgeEdge('dash', spec.dashBreakY + PAD_HALF, spec.dashBreakZ, dashSpan),
    ],
  };
}

/** 전투 차량 넷이다. 가림 조각은 바스켓 옆벽과 앞벽 개구부 아랫단이다. 좌표는 pivot 기준이라
 * eyeInBasket 을 빼 눈 기준으로 옮긴다. */
function gunnerRig(vehicle) {
  const desk = GUNNER_CONSOLES[vehicle];
  const [eyeX, eyeY, eyeZ] = desk.eyeInBasket;
  const gauges = desk.dials.map(([x, y, z], index) => ({
    id: `${vehicle}-dial${index}`, x, y, z,
    radius: index < 2 && desk.dials.length > 1 ? ARMOR_DIAL.main : ARMOR_DIAL.bearing,
  }));
  if (desk.elevationDial) {
    const [x, y, z] = desk.elevationDial;
    gauges.push({ id: `${vehicle}-elev`, x, y, z, radius: ARMOR_DIAL.bearing });
  }
  for (const [key, screen] of [['display', desk.display], ['display2', desk.display2]]) {
    if (!screen) continue;
    const [x, y, z, width, height] = screen;
    gauges.push({ id: `${vehicle}-${key}`, x, y, z, halfWidth: width / 2, halfHeight: height / 2 });
  }
  const occluders = [];
  if (desk.walls) {
    const sides = desk.walls.filter((wall) => !wall.glass && wall.x[1] - wall.x[0] <= WALL_T * 2 + 1e-6);
    const left = Math.max(...sides.map((wall) => wall.x[1]).filter((value) => value < eyeX));
    const right = Math.min(...sides.map((wall) => wall.x[0]).filter((value) => value > eyeX));
    if (Number.isFinite(left)) occluders.push(sideWall('wallL', left - eyeX, 'under'));
    if (Number.isFinite(right)) occluders.push(sideWall('wallR', right - eyeX, 'over'));
    // 앞벽 개구부 아랫단이다. piercedFront 가 만든 아래 조각의 윗변이고 계기보다 앞에 선다.
    const front = desk.walls.filter((wall) => !wall.glass && wall.z[1] - wall.z[0] <= WALL_T * 2 + 1e-6 && wall.z[0] - eyeZ < 0);
    const ledge = front.filter((wall) => wall.y[1] < eyeY);
    for (const wall of ledge) {
      occluders.push(ledgeEdge('front', wall.y[1] - eyeY, wall.z[1] - eyeZ, [wall.x[0] - eyeX, wall.x[1] - eyeX]));
    }
  }
  return { vehicle, gauges, occluders };
}

/** 오토바이다. 나셀은 steerGroup 안에 있으므로 pivot z 를 더해 차체 좌표로 옮긴 뒤 눈을 뺀다. */
function bikeRig() {
  const eye = eyePoint('motorcycle');
  const bike = BIKE_CLUSTER;
  const toEye = ([x, y, z]) => [x - eye[0], y + bike.position[1] - eye[1], z + bike.position[2] + bike.steerPivotZ - eye[2]];
  const gauges = [];
  for (const [id, dial] of [['speed', bike.speed], ['rpm', bike.rpm]]) {
    const [x, y, z] = toEye([dial.x, 0, 0]);
    gauges.push({ id: `motorcycle-${id}`, x, y, z, radius: dial.radius });
  }
  const [sx, sy, width, height] = bike.display;
  const [dxe, dye, dze] = toEye([sx, sy, 0]);
  gauges.push({ id: 'motorcycle-display', x: dxe, y: dye, z: dze, halfWidth: width / 2, halfHeight: height / 2 });
  const bar = bike.bar;
  return {
    vehicle: 'motorcycle',
    gauges,
    occluders: [barTop('bar', {
      y: bar.y - eye[1], z: bar.z + bike.steerPivotZ - eye[2], halfHeight: bar.radius,
      xRange: [-bar.halfSpan, bar.halfSpan],
    })],
  };
}

/** 지상 탈것 아홉 종의 계기 검사 재료다. 없는 키에는 null 을 준다. */
export function groundGaugeRig(vehicle) {
  const build = ROAD_CABINS[vehicle] ? roadRig : GUNNER_CONSOLES[vehicle] ? gunnerRig : vehicle === 'motorcycle' ? bikeRig : null;
  if (!build) return null;
  return { fovHalf: cockpitFov(vehicle) / 2, ...build(vehicle) };
}
