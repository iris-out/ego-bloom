import { cockpitFov } from '../eyePoints.js';
import { hoodEdge, ringTop } from './gaugeClearance.js';

/** 항공기 실내의 배치 상수와 계기 문구다. Three 와 React 에 의존하지 않아 단위 테스트가 그대로 읽는다.
 *
 * 좌표는 전부 눈(eyePoints.js) 기준 상대값이고 three 규약을 따른다. x 가 오른쪽, y 가 위,
 * 진행 방향이 -z 다. 기체 로컬 좌표는 AircraftCockpits.jsx 의 deck() 이 눈 좌표를 더해 만든다.
 * 캐노피 치수는 외장 모델(models/*.jsx) 의 캐노피 구 안쪽에서 역산했다. 실내 조각이 그 구를
 * 넘으면 1인칭에서 기체 바깥으로 삐져나온다. */

/** 계기판을 뒤로 눕히는 각이다. 약 15도. three 회전은 rotation.x = -PANEL_TILT 로 준다.
 * x 축 +회전은 판의 법선을 아래로 돌려 눈에서 멀어지게 하므로 부호가 반대여야 한다. */
export const PANEL_TILT = 0.26;

/** 눈금판 숫자다. 마지막 숫자가 max 와 같아야 바늘과 숫자가 맞는다. dialFace 는 숫자를
 * 스윕 전체에 고르게 뿌리고 바늘은 value/max 로 도는데, 둘이 어긋나면 눈금이 거짓말을 한다.
 * offset 이 있는 계기는 숫자도 그만큼 내려 적는다(V/S 0 이 한가운데다). */
export const SIX_PACK_DIALS = Object.freeze([
  // 6홀 중 가장 빠른 기종(전투기 652km/h) 까지 읽으면 된다. 620 은 100 단위로 떨어지지 않아 600 으로 맞췄다.
  { field: 'speed', label: 'SPD', unit: 'KM/H', max: 600, numbers: [0, 100, 200, 300, 400, 500, 600] },
  { field: 'pitch', label: 'ATT', unit: 'DEG', max: 90, offset: 45, numbers: [-45, -30, -15, 0, 15, 30, 45] },
  // 상승 한계가 지면 기준 1000m(flightPhysics CEILING) 라 900 눈금은 천장 아래에서 멎는다.
  { field: 'altitude', label: 'ALT', unit: 'M', max: 1000, numbers: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { field: 'climb', label: 'V/S', unit: 'M/S', max: 120, offset: 60, numbers: [-60, -40, -20, 0, 20, 40, 60] },
  { field: 'heading', label: 'HDG', unit: 'DEG', max: 360, numbers: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360] },
  { field: 'throttle', label: 'THR', unit: '%', max: 100, multiplier: 100, numbers: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
]);

/** 6홀에 없는 기종 전용 계기다. 요격기 연료계와 전투기 예비 속도계가 여기 있다. */
export const SPECIAL_DIALS = Object.freeze({
  speed700: { field: 'speed', label: 'SPD', unit: 'KM/H', max: 700, numbers: [0, 100, 200, 300, 400, 500, 600, 700] },
  // 요격기는 강화 부스트에서 계기 1340km/h 까지 올라간다. 1400 이면 바늘이 끝에 붙지 않는다.
  speed1400: { field: 'speed', label: 'SPD', unit: 'KM/H', max: 1400, numbers: [0, 200, 400, 600, 800, 1000, 1200, 1400] },
  altitude: { field: 'altitude', label: 'ALT', unit: 'M', max: 1000, numbers: [0, 200, 400, 600, 800, 1000] },
  fuel: { field: 'fuel', label: 'FUEL', unit: '%', max: 100, multiplier: 100, danger: 0.2, redline: 0.2, numbers: [0, 20, 40, 60, 80, 100] },
});

/** 한 장의 캔버스에 그리는 스위치 명판이다. 입력 상태를 흉내 내지 않고 기능만 적는다. */
export const AIRCRAFT_PLACARDS = Object.freeze({
  jet: { title: 'SYSTEMS', labels: ['BAT', 'GEN', 'NAV', 'PITOT'] },
  bomber: { title: 'BAY CTRL', labels: ['BAY', 'SAFE', 'LIGHTS', 'TRIM'] },
  prop: { title: 'ENGINE', labels: ['MAG', 'PROP', 'MIX', 'PITOT'] },
  fighter: { title: 'HOTAS', labels: ['ARM', 'RADAR', 'IFF', 'CHAFF'] },
  interceptor: { title: 'BOOST', labels: ['FUEL', 'BOOST', 'ARM', 'PITOT'] },
  helicopter: { title: 'ROTOR', labels: ['HYD', 'GOV', 'NAV', 'LIGHTS'] },
});

/** 실제 hardpoint 에 미사일이 없는 기종은 어떤 화면에도 MSL 을 적지 않는다. */
export const GUN_ONLY_PLANES = Object.freeze(['prop', 'interceptor', 'shotgun']);

/** 명판 한 장의 실제 크기와 캔버스 안 라벨 칸 좌표다. placardMaterial 이 같은 값으로 그린다.
 * 토글 스위치를 라벨 칸마다 하나씩 세우려면 캔버스 픽셀을 평면 좌표로 바꿔야 한다. */
export const PLACARD = Object.freeze({
  width: 0.30, height: 0.14,
  canvas: Object.freeze({ width: 256, height: 112, x: 9, y: 32, cell: [116, 29], stepX: 122, stepY: 36 }),
});

/** 명판 위에 세울 토글 네 개의 위치다. 명판을 눕혀 놓으므로 평면의 위쪽(+y) 이 앞(-z) 으로 간다.
 * 반환값은 명판 중심 기준 [x, z] 다. */
export function placardToggles() {
  const { width, height, canvas } = PLACARD;
  return [0, 1, 2, 3].map((index) => {
    const column = index % 2, row = Math.floor(index / 2);
    const u = (canvas.x + column * canvas.stepX + canvas.cell[0] * 0.5) / canvas.width;
    const v = (canvas.y + row * canvas.stepY + canvas.cell[1] * 0.5) / canvas.height;
    return [(u - 0.5) * width, -(0.5 - v) * height];
  });
}

/** 기종별 실내 뼈대다. 값은 모두 눈 기준이다.
 * canopy: 유리 반원통의 중심과 반지름, 길이, 활 프레임이 설 z.
 * panel: 계기판 판의 중심과 기울기, 반폭, 반높이. 계기는 이 판 위 좌표로 얹는다.
 * tub: 바닥 높이, 뒤 격벽 z, 옆 벽의 반폭과 윗선.
 * seat: 방석 윗면 한가운데. side: 팔걸이 콘솔의 윗면.
 * deck: 코 위 덮개. 외장 동체 lathe 는 면이 한 겹이라 조종석 안에서는 뒷면이 잘려 보이지 않는다.
 *       그래서 기수를 실내가 직접 그린다. 높이는 코밍 윗선보다 각이 작아야 보인다.
 *       코밍은 눈에서 5~9도 아래에 있으므로 덮개를 그보다 멀리, 조금만 낮게 눕혀 둔다. */
/** 배치 검산이다. 각은 눈에서 잰 내림각 atan(-y / -z) 이고 화각 절반은 eyePoints 의
 * cockpitFov/2 다. 계기 최하단이 화각 절반을 넘으면 그 계기는 화면 밖에서 잘린다.
 * 같은 검산을 aircraftGaugeRig 와 gaugeClearance 가 코드로 다시 한다. 화각 절반에서
 * 3도, 가림 조각에서 1도를 남긴다.
 *
 * 기종        계기 최하단  화각 절반  여유   계기 윗변  가림 조각
 * jet          32.0          36.0     4.0      13.2      코 덮개 11.4
 * bomber       29.2          34.0     4.8      10.8      코 덮개 8.8, 요크 림 33.5
 * prop         28.7          34.0     5.3      11.7      코 덮개 9.7, Revi 하우징 8.7
 * fighter      31.0          37.0     6.0      13.3      코 덮개 11.6, combiner 11.1
 * interceptor  28.3          35.0     6.7       9.3      조준기 마운트 7.2, combiner 7.4
 * helicopter   27.2          35.0     7.8      11.6      없음
 *
 * 폭격기는 아랫줄이 요크 림(눈 아래 25.2도) 에 걸려 세 개 다 반쯤 가려 있었다. 요크를
 * 0.48 에서 0.60 으로 내려 림 윗점이 33.5도가 됐고 아랫줄(29.2도) 아래로 내려갔다.
 * 헬기는 아랫줄 여유가 0.3도뿐이라 창 비율이 조금만 달라져도 잘렸다. 계기판을 0.04 올리고
 * 0.06 뒤로 물려 7.8도로 벌렸다. 프로펠러기와 요격기도 같은 이유로 물렸고, 계기판을
 * 물리면 윗변이 올라오므로 코 덮개도 함께 올렸다.
 *
 * 덮개 앞 모서리는 계기 윗변보다 1.2도 이상 위에서 끝난다. 요격기는 그 여유가 없어
 * 덮개를 빼고 외장 노즈에 맡겼다. 덮개가 계기 윗변까지 내려오면 계기판이 통째로 사라진다. */
export const COCKPIT_FRAME = Object.freeze({
  // 캐노피 구 [0,0.74,-3.5] scale[0.82,0.6,1.85], 눈 [0,1.02,-3.4]
  jet: Object.freeze({
    // 셸 앞 끝(-1.36) 을 앞유리 틀(-1.40) 보다 뒤에 둔다. 앞서면 유리 끝면이 틀 앞에 드러나
    // 눈 옆에서 회색 띠로 보인다.
    canopy: { x: 0, y: -0.28, z: -0.20, radius: 0.52, length: 2.32, arcs: [-1.20, 0.00, 0.90] },
    windscreen: -1.40,
    panel: { y: -0.34, z: -0.80, tilt: PANEL_TILT, halfWidth: 0.50, halfHeight: 0.17 },
    tub: { floor: -0.92, rear: 0.46, halfWidth: 0.49, wallTop: -0.26 },
    seat: { x: 0, y: -0.70, z: 0.16, width: 0.46, depth: 0.46, height: 0.62 },
    side: { x: 0.385, y: -0.55, z: -0.14, width: 0.16, length: 0.80 },
    stick: { x: 0, y: -0.80, z: -0.30 },
    throttle: { x: -0.38, y: -0.52, z: -0.24 },
    pedals: { x: 0, y: -0.84, z: -0.60 },
    // 계기를 키워 계기 윗변이 13.8 에서 13.1 도로 올라왔다. 덮개도 7cm 앞으로 밀어
    // 앞 모서리를 12.2 에서 11.4 도로 올린다. 덮개 띠와 계기 사이 여유가 1.7 도다.
    deck: { y: -0.18, z: -1.82, width: 1.00, depth: 1.60 },
  }),
  // 캐노피 구 [0,1.32,-5.6] scale[1.1,0.62,2.4], 눈 [-0.46,1.35,-5.6]. 기장석이 왼쪽이라 실내 중심이 +0.46 이다.
  bomber: Object.freeze({
    // 폭격기만 캐노피가 납작하고 넓다(외장 구가 반폭 1.1 에 반높이 0.62). 반원통은 벽까지
    // 닿으려면 반지름 1.02 가 되어 외장 구 위로 0.4 나 솟는다. 그래서 폭격기만 평면 유리
    // 지붕(flat) 을 쓴다. 지붕 높이 0.20 은 벽선(중심에서 1.02) 에서 잰 외장 구 윗면 0.203
    // 바로 아래다. 지붕이 벽까지 한 장으로 덮으므로 어깨 판이 필요 없다.
    // 앞뒤 모서리는 외장 구 밖으로 나가지만 그 구는 1인칭에서 숨으므로 보이지 않는다.
    canopy: { x: 0.46, y: 0.20, z: -0.10, radius: 1.02, length: 2.40, arcs: [-1.10, -0.05, 0.95], flat: true },
    // 옆 창은 동체 벽 윗단(눈 아래 0.26) 에서 유리 지붕(눈 위 0.20) 까지다. 벽, 창, 지붕이
    // 빈틈 없이 이어져 왼쪽을 봐도 바깥이 새지 않는다.
    window: { y: -0.03, height: 0.46, length: 1.40 },
    panel: { y: -0.32, z: -0.86, tilt: PANEL_TILT, halfWidth: 1.00, halfHeight: 0.19, x: 0.42 },
    tub: { floor: -1.05, rear: 0.62, halfWidth: 1.02, wallTop: -0.26, x: 0.46 },
    seat: { x: 0, y: -0.74, z: 0.18, width: 0.50, depth: 0.50, height: 0.66 },
    side: { x: 0.405, y: -0.52, z: -0.20, width: 0.26, length: 0.52 },
    // 요크를 눈 아래 0.48, 앞 0.56 에 둔다. 앞이 0.44 이면 전완 끝이 눈앞 0.20 까지 와서
    // 화면 오른쪽 아래를 22도나 차지했다. 0.56 이면 0.34 앞이라 9도로 줄고 휠 윗선이 26.6도다.
    yoke: { x: 0, y: -0.60, z: -0.56, radius: 0.18 },
    throttle: { x: 0.46, y: -0.50, z: -0.30 },
    pedals: { x: 0, y: -0.94, z: -0.62 },
    // 오버헤드는 유리 지붕(0.20) 바로 아래 0.15 에 매단다. 눈 뒤 0.05~0.35 라 프레임 -0.05 와
    // 0.95 사이이고 위를 봐도 하늘 절반을 덮지 않는다.
    overhead: { x: 0.46, y: 0.15, z: 0.20, width: 0.50, depth: 0.30 },
    deck: { y: -0.13, z: -2.10, width: 1.60, depth: 2.20 },
  }),
  // 버블 캐노피 [0,0.62,-0.6] scale[0.6,0.52,1.3], 눈 [0,0.62,-0.7]. 눈이 캐노피 한가운데다.
  prop: Object.freeze({
    canopy: { x: 0, y: -0.06, z: 0.10, radius: 0.45, length: 2.10, arcs: [-0.92, 1.02] },
    panel: { y: -0.30, z: -0.80, tilt: PANEL_TILT, halfWidth: 0.38, halfHeight: 0.165 },
    tub: { floor: -0.86, rear: 0.44, halfWidth: 0.43, wallTop: -0.06 },
    seat: { x: 0, y: -0.66, z: 0.14, width: 0.42, depth: 0.44, height: 0.58 },
    side: { x: 0.335, y: -0.50, z: -0.12, width: 0.14, length: 0.72 },
    stick: { x: 0, y: -0.78, z: -0.26 },
    throttle: { x: -0.34, y: -0.46, z: -0.22 },
    pedals: { x: 0, y: -0.80, z: -0.58 },
    // Revi 조준기다. 유리 중심이 눈높이(0도) 라 조준선과 탄착 표식이 한자리에 있다.
    // 유리는 0.72m 앞에서 7.2도 폭이고 하우징은 유리 바로 아래(윗면이 유리 밑변) 코밍 위에 앉는다.
    // 하우징이 가리는 띠는 눈 아래 8.0~9.5도뿐이라 카울(3~11.6도) 과 프로펠러가 그대로 보인다.
    sight: { y: 0, z: -0.72, width: 0.09, height: 0.09, tilt: 0.13, housing: [0.10, 0.06, 0.12] },
    // 자석 나침반이다. 코밍 밑을 따라가되 가운데가 아니라 오른쪽에 붙인다. 가운데에 두면
    // 눈 아래 8~13도라 카울과 프로펠러가 보이는 자리를 그대로 가린다. 지금은 오른쪽 21도다.
    compass: { x: 0.26, up: 0.115, out: 0.12, radius: 0.03 },
    // 단발기 카울링이다. 눈에서 3~10도 아래를 채워 조준선은 비우고 코는 보이게 한다.
    deck: { y: -0.125, z: -1.88, width: 0.90, depth: 2.00 },
  }),
  // 캐노피 구(외부 좌표) [0,0.84,-3.696] 반지름 [0.784,0.784,2.128], 눈 [0,1.16,-2.9]
  fighter: Object.freeze({
    canopy: { x: 0, y: -0.22, z: -0.18, radius: 0.50, length: 2.70, arcs: [-1.20, 0.10, 1.12] },
    panel: { y: -0.33, z: -0.80, tilt: PANEL_TILT, halfWidth: 0.44, halfHeight: 0.17 },
    tub: { floor: -0.96, rear: 0.48, halfWidth: 0.47, wallTop: -0.20 },
    seat: { x: 0, y: -0.72, z: 0.18, width: 0.46, depth: 0.46, height: 0.64 },
    side: { x: 0.365, y: -0.54, z: -0.12, width: 0.16, length: 0.84 },
    stick: { x: 0, y: -0.82, z: -0.28 },
    throttle: { x: -0.38, y: -0.50, z: -0.22 },
    pedals: { x: 0, y: -0.88, z: -0.62 },
    deck: { y: -0.17, z: -1.85, width: 0.95, depth: 1.80 },
  }),
  // 캐노피 구 [0,0.62,-1.9] scale[0.44,0.4,1.1], 눈 [0,0.86,-2.4]. 가장 좁은 캐노피다.
  interceptor: Object.freeze({
    canopy: { x: 0, y: -0.24, z: 0.32, radius: 0.37, length: 1.80, arcs: [-0.54, 1.10] },
    panel: { y: -0.30, z: -0.86, tilt: PANEL_TILT, halfWidth: 0.38, halfHeight: 0.21 },
    tub: { floor: -0.90, rear: 0.42, halfWidth: 0.36, wallTop: -0.24 },
    seat: { x: 0, y: -0.68, z: 0.14, width: 0.40, depth: 0.44, height: 0.60 },
    side: { x: 0.265, y: -0.52, z: -0.12, width: 0.14, length: 0.76 },
    stick: { x: 0, y: -0.78, z: -0.26 },
    throttle: { x: -0.30, y: -0.48, z: -0.22 },
    pedals: { x: 0, y: -0.82, z: -0.58 },
    // 외장 앞유리 틀 Block[0,0.66,-2.9] 가 눈 기준 [0,-0.20,-0.50] 에 그대로 보인다.
    // 조준기는 combiner 유리 아랫단에 붙는 작은 마운트뿐이다. 예전의 0.19 x 0.07 하우징은
    // 눈 아래 5~15도를 가려 계기판 윗줄(11.3도) 을 덮었다. 지금은 아랫변이 10.3도에서 끝난다.
    sight: { y: -0.045, z: -0.44, housing: [0.09, 0.014, 0.10] },
  }),
  // 노즈 캐노피 구 [0,0.6,-3.9] scale[1.15,0.95,1.6], 눈 [0.38,0.92,-3.6]. 기장이 오른쪽이다.
  helicopter: Object.freeze({
    canopy: { x: -0.38, y: -0.30, z: -0.26, radius: 0.92, length: 2.30, arcs: [-1.02, -0.10, 0.80] },
    panel: { y: -0.30, z: -0.84, tilt: PANEL_TILT, halfWidth: 0.44, halfHeight: 0.165 },
    tub: { floor: -1.10, rear: 0.58, halfWidth: 0.92, wallTop: -0.30, x: -0.38, noseTop: -0.80 },
    seat: { x: 0, y: -0.72, z: 0.16, width: 0.48, depth: 0.48, height: 0.62 },
    side: { x: 0.43, y: -0.56, z: -0.10, width: 0.16, length: 0.70 },
    stick: { x: 0, y: -0.86, z: -0.24 },
    collective: { x: -0.42, y: -0.80, z: -0.06 },
    pedals: { x: 0, y: -0.96, z: -0.60 },
    overhead: { x: -0.38, y: 0.42, z: -0.10, width: 0.74, depth: 0.40 },
    // 발밑 유리다. 계기판 아랫변에서 코 아래로 흘러내리는 경사창이라 앞 격벽 자리를 대신한다.
    chin: { y: -0.63, z: -0.89, width: 0.52, depth: 0.42, tilt: 0.95 },
    door: { x: 0.52, y: -0.28, z: 0.08, width: 0.46, height: 0.46 },
  }),
});

/** 판 위 좌표(x, 위쪽 up, 판에서 튀어나온 out) 를 눈 기준 좌표로 바꾼다.
 * 판을 뒤로 tilt 만큼 눕혔으므로 위로 갈수록 앞(-z) 으로, 튀어나올수록 위(+y) 로 간다. */
export function panelPlace(panel, x, up, out = 0) {
  const cos = Math.cos(panel.tilt), sin = Math.sin(panel.tilt);
  return [x + (panel.x || 0), panel.y + up * cos + out * sin, panel.z - up * sin + out * cos];
}

/** 계기를 판에서 얼마나 띄울지다. 판(받침) 은 이보다 뒤에 있어야 아랫줄을 가리지 않는다. */
export const INSTRUMENT_OUT = 0.022;
/** 받침 판의 두께와 중심이다. 계기 원판보다 먼 z 에 두는 것이 이번 작업의 핵심 수정이다. */
export const BOARD_OUT = -0.03, BOARD_THICK = 0.05;

const dialSlot = (spec, x, up, radius, tier = 'low') => ({
  id: spec.label, kind: 'dial', spec, x, up, radius, halfWidth: radius, halfHeight: radius, tier,
});
// 자세계는 베젤 토러스(반지름 1.07) 와 기준 날개가 구보다 넓다. 그만큼 키워 잡는다.
const ballSlot = (x, up, radius, tier = 'mid') => ({
  id: 'ATT', kind: 'ball', x, up, radius, halfWidth: radius * 1.1, halfHeight: radius * 1.1, tier,
});
const screenSlot = (id, x, up, width, height, mode, title = '', tier = 'low') => ({
  id, kind: 'screen', x, up, halfWidth: width / 2, halfHeight: height / 2, width, height, mode, title, tier,
});

/** 6홀 배치다. 윗줄이 속도, 자세, 고도이고 아랫줄이 상승률, 방위, 출력이다.
 * 가운데 위는 실제 항공기와 같이 자세계라 mid 이상에서 구형 자세계로 바뀐다. */
function sixPack({ columns, rows, radius, centre = 0 }) {
  return SIX_PACK_DIALS.map((dial, index) => {
    const x = centre + ((index % 3) - 1) * columns, up = index < 3 ? rows : -rows;
    if (dial.label !== 'ATT') return dialSlot(dial, x, up, radius);
    // low 에서는 자세도 바늘 계기 하나다. mid 에서 같은 자리를 구형 자세계가 대신한다.
    return { ...dialSlot(dial, x, up, radius), tier: 'low-only', ball: ballSlot(x, up, radius) };
  });
}

const PANEL_SLOTS = Object.freeze({
  jet: [
    ...sixPack({ columns: 0.145, rows: 0.075, radius: 0.068 }),
    screenSlot('FLIGHT', -0.33, -0.005, 0.26, 0.13, 'flight'),
    screenSlot('NAV', 0.33, -0.005, 0.26, 0.13, 'nav', '', 'mid'),
  ],
  // 판 중심이 기장석과 부기장석 사이(눈 기준 x +0.42) 라 6홀은 판 왼쪽 끝, 기장 눈앞이다.
  bomber: [
    ...sixPack({ columns: 0.150, rows: 0.078, radius: 0.068, centre: -0.42 }),
    screenSlot('FLIGHT', -0.02, 0.065, 0.26, 0.13, 'flight'),
    screenSlot('BAY', -0.02, -0.075, 0.26, 0.13, 'bay'),
  ],
  prop: [
    ...sixPack({ columns: 0.130, rows: 0.062, radius: 0.064 }),
    screenSlot('GUNS', 0.27, -0.060, 0.18, 0.09, 'guns'),
  ],
  fighter: [
    ballSlot(0, 0.075, 0.058),
    dialSlot(SPECIAL_DIALS.speed700, 0, -0.075, 0.060),
    screenSlot('FLT', -0.17, -0.010, 0.20, 0.20, 'mfd', 'FLT'),
    screenSlot('STORES', 0.17, -0.010, 0.20, 0.20, 'mfd', 'STORES'),
  ],
  interceptor: [
    dialSlot(SPECIAL_DIALS.speed1400, -0.21, 0.095, 0.062),
    ballSlot(-0.07, 0.095, 0.056),
    dialSlot(SPECIAL_DIALS.altitude, 0.07, 0.095, 0.062),
    dialSlot(SPECIAL_DIALS.fuel, 0.21, 0.095, 0.062),
    screenSlot('FLT', -0.10, -0.070, 0.16, 0.16, 'mfd', 'FLT'),
    screenSlot('GUNS', 0.10, -0.070, 0.16, 0.16, 'mfd', 'GUNS', 'mid'),
  ],
  helicopter: [
    ...sixPack({ columns: 0.125, rows: 0.062, radius: 0.058 }),
    screenSlot('FLIGHT', 0.30, -0.005, 0.24, 0.12, 'flight'),
    screenSlot('NAV', -0.30, -0.005, 0.24, 0.12, 'nav', '', 'mid'),
  ],
});

/** 기종의 계기 자리다. tier 가 'low-only' 인 칸은 mid 이상에서 ball 로 바뀐다. */
export function panelSlots(plane) {
  return PANEL_SLOTS[plane] || [];
}

/** 화각 검사용으로 mid 이상에서 실제로 그려지는 모든 계기를 편다. */
export function visibleSlots(plane) {
  return panelSlots(plane).flatMap((slot) => (slot.ball ? [slot.ball] : [slot]));
}

/** combiner 유리와 그 위에 덧그리는 HUD 평면이다. 평면이 유리보다 크면 상이 허공에 뜬다.
 * 유리 크기는 사다리가 잘리지 않을 만큼만 키우고 평면은 유리와 같은 크기로 맞춘다. */
export const HUD_COMBINER = Object.freeze({
  fighter: Object.freeze({
    position: [0, 0.03, -0.52], tilt: 0.16,
    glass: [0.30, 0.24], plane: [0.30, 0.24], frame: 0.010, weapons: 'stores',
  }),
  // 요격기는 유리 반사식 조준기라 combiner 가 작다. 사다리 평면도 같이 줄인다.
  interceptor: Object.freeze({
    position: [0, 0.05, -0.46], tilt: 0.12,
    glass: [0.24, 0.20], plane: [0.22, 0.18], frame: 0.009, weapons: 'guns',
  }),
});

/** 실제 기종의 계기 조명 색이다. 전투기는 호박색, 헬기는 야시경과 맞추는 녹색,
 * 폭격기와 제트는 흰색에 가까운 호박색, 프로펠러기는 옅은 호박색이다. */
export const LAMP_COLOUR = Object.freeze({
  jet: '#fff0d2', bomber: '#fff0d2', prop: '#ffd9a8',
  fighter: '#ffb25c', interceptor: '#ffb25c', helicopter: '#74d69a',
});

/** 화면 글자 색이다. 계기 조명과 같은 계열로 맞춘다. */
export const SCREEN_ACCENT = Object.freeze({
  jet: '#ffd18a', bomber: '#9fe8ff', prop: '#ffd18a',
  fighter: '#8cf7a6', interceptor: '#9fe8ff', helicopter: '#74d69a',
});

/** 계기판 받침 판의 두께 절반이다. PanelBoard 가 두께 BOARD_THICK 로 그린다. */
const BOARD_HALF = BOARD_THICK / 2;
/** 코 덮개(NoseDeck) 판의 두께 절반이다. AircraftCockpits 의 scale y 0.05 와 같다. */
const DECK_HALF = 0.025;
/** Yoke 의 림 토러스는 반지름 1 에 튜브 0.09 라 바깥이 1.09 배다. */
const RIM_OUTER = 1.09;
/** Yoke 를 눕히는 기본 각이다. parts.jsx 의 Yoke 기본값과 같아야 한다. */
const YOKE_TILT = -0.35;

/** 기종별 가림 조각이다. 계기보다 눈에 가까우면서 계기 원판과 각이 겹치면 계기를 먹는다.
 * 코 덮개는 위에서 내려오는 차양이고 요크 림은 아래에서 올라오는 고리다. */
function aircraftOccluders(plane, frame) {
  const list = [];
  if (frame.deck) {
    // 덮개의 눈에 가장 가까운 아래 모서리가 경계다. 판 뒤끝(큰 z) 의 밑면이다.
    const near = frame.deck.z + frame.deck.depth / 2, half = frame.deck.width / 2;
    list.push(hoodEdge('deck', frame.deck.y - DECK_HALF, near, [-half, half]));
  }
  if (frame.yoke) {
    list.push(ringTop('yoke', {
      x: frame.yoke.x, y: frame.yoke.y, z: frame.yoke.z,
      radius: frame.yoke.radius * RIM_OUTER, tilt: YOKE_TILT,
    }));
  }
  if (frame.sight?.housing) {
    // Revi 하우징은 유리 밑변에 윗면을 맞춰 걸고, 요격기 마운트는 주어진 y 가 중심이다.
    const [width, height] = frame.sight.housing;
    const centre = frame.sight.height === undefined
      ? frame.sight.y
      : frame.sight.y - frame.sight.height / 2 - height / 2;
    list.push(hoodEdge('sight', centre - height / 2, frame.sight.z + 0.03, [-width / 2, width / 2]));
  }
  const hud = HUD_COMBINER[plane];
  if (hud) {
    // combiner 아래 프레임 한 줄이다. 유리는 비치지만 틀은 막는다.
    const [width, height] = hud.glass;
    const y = hud.position[1] - (height / 2) * Math.cos(hud.tilt) - hud.frame;
    const z = hud.position[2] + (height / 2) * Math.sin(hud.tilt);
    list.push(hoodEdge('combiner', y, z, [-width / 2, width / 2]));
  }
  return list;
}

/** 기종 하나의 계기 검사 재료다. gaugeClearance 의 gaugeFaults 가 그대로 읽는다.
 * 계기 자리는 panelSlots 가 아니라 visibleSlots 를 쓴다. mid 이상에서 실제로 그려지는
 * 것만 봐야 자세계가 구로 바뀐 뒤의 크기를 잰다. */
export function aircraftGaugeRig(plane) {
  const frame = COCKPIT_FRAME[plane];
  if (!frame) return null;
  const { panel } = frame;
  const gauges = visibleSlots(plane).map((slot) => {
    const [x, y, z] = panelPlace(panel, slot.x, slot.up, INSTRUMENT_OUT);
    return { id: `${plane}-${slot.id}`, x, y, z, halfWidth: slot.halfWidth, halfHeight: slot.halfHeight };
  });
  return { vehicle: plane, fovHalf: cockpitFov(plane) / 2, gauges, occluders: aircraftOccluders(plane, frame) };
}

/** 계기판 받침 판의 아랫변이다. 계기가 이 판 밖으로 삐져나오면 배경에 떠 보인다. */
export function panelFoot(plane) {
  const { panel } = COCKPIT_FRAME[plane];
  return panelPlace(panel, 0, -panel.halfHeight - BOARD_HALF, BOARD_OUT);
}
