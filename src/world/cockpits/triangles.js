/** 콕핏 실내의 삼각형 예산이다. 카메라가 실내에 있을 때만 마운트하므로 도시
 * 예산과 겹치지 않지만, 저사양 기기에서 프레임을 지키려면 상한이 필요하다.
 * 이 파일은 Three 나 React 에 의존하지 않는다. 단위 테스트가 그대로 읽는다. */
export const BUDGET = Object.freeze({ low: 1800, medium: 4500, high: 9000 });

/** 원기둥은 옆면 2n 에 뚜껑 2n 이다. 원판은 n, 토러스는 radial x tubular x 2 다.
 * 뚜껑을 연 원기둥(후드, 캐노피 반원통, 기어봉 축)은 옆면뿐이라 2n 이다.
 * 잘라낸 토러스(캐노피 활 프레임)도 분할 수는 그대로라 온전한 토러스와 같은 식을 쓴다. */
export const TRI = Object.freeze({
  box: () => 12,
  plane: () => 2,
  cylinder: (segments) => segments * 4,
  cylinderOpen: (segments) => segments * 2,
  cone: (segments) => segments * 2,
  circle: (segments) => segments,
  torus: (radial, tubular) => radial * tubular * 2,
  torusArc: (radial, tubular) => radial * tubular * 2,
  sphere: (width, height) => width * height * 2,
  lathe: (points, segments) => (points - 1) * segments * 2,
});

export const DIAL_SEGMENTS = 20;

/** 계기 하나의 기본 눈금 수다. 눈금은 평면 한 장(2 삼각형)이라 계기당 24 만 더한다.
 * 조각이 가장 많은 폭격기도 1526 로 low 1800 안에 들어 12 를 기본값으로 둔다.
 * 박스 눈금은 계기당 144 라 계기가 많은 기종이 예산을 넘는다. */
export const DIAL_TICKS = 12;

const DIAL_BODY = TRI.circle(DIAL_SEGMENTS) + TRI.cylinder(DIAL_SEGMENTS) + TRI.box();
const TICK = TRI.plane();

// 조각 하나의 비용이다. parts.jsx 가 같은 geometry 인자를 쓴다.
export const PART = Object.freeze({
  dialBody: DIAL_BODY,
  tick: TICK,
  dial: DIAL_BODY + DIAL_TICKS * TICK,
  panel: TRI.box(),
  lever: TRI.box() * 3,
  stick: TRI.box() * 3,
  yoke: TRI.torus(8, 20) + TRI.box() * 4,
  // 계기 화면은 베젤 박스 하나와 캔버스 평면 하나다. 글자는 텍스처라 삼각형을 쓰지 않는다.
  display: TRI.box() + TRI.plane(),
  // 전투기 HUD 는 유리에 덧그리는 평면 한 장이다. 베젤이 없다.
  hud: TRI.plane(),
  // 기종별 스위치 명판은 공유 캔버스 텍스처를 붙인 평면 한 장이다.
  placard: TRI.plane(),
  // 거울은 테두리 박스 하나와 거울면 평면 하나다. 거울면은 뒤 카메라 텍스처를 잘라 쓴다.
  mirror: TRI.box() + TRI.plane(),

  // 아래는 parts.jsx 가 실제로 그리는 조각 수를 그대로 센 값이다. 기본 prop 기준이고
  // 끌 수 있는 부분(노브 pointer, 좌석 헤드레스트와 볼스터)도 켜진 값으로 잡았다.
  // mid 계기 한 벌이다. 바깥 금속 링(온전한 열린 원통), 위만 덮는 반원통 챙(분할 절반),
  // 덮개 유리 원판 셋이다.
  dialHood: TRI.cylinderOpen(DIAL_SEGMENTS) + TRI.cylinderOpen(DIAL_SEGMENTS / 2) + TRI.circle(DIAL_SEGMENTS),
  knob: TRI.cylinder(8) + TRI.box(),
  toggle: TRI.box() * 2,
  button: TRI.box() * 2,
  seat: TRI.box() * 5,
  // 손 하나가 손등, 손가락, 엄지, 손목, 소매 다섯 상자라 두 손이면 열이다.
  hands: TRI.box() * 10,
  stickHand: TRI.box() * 5,
  // 페달 하나 값이다. 실내가 개수를 곱해 적는다.
  pedal: TRI.box() * 2,
  // 받침과 슬롯만이다. 레버는 실내가 따로 센다.
  quadrant: TRI.box() * 2,
  gearLever: TRI.box() * 2 + TRI.cylinderOpen(6),
  attitudeBall: TRI.sphere(12, 8) + TRI.torus(6, 16) + TRI.box() * 2,
  glass: TRI.plane(),
  canopyArc: TRI.torusArc(6, 12),
  canopyShell: TRI.cylinderOpen(12),
  shade: TRI.plane(),
  // 암과 블레이드가 한 짝이고 두 짝이 함께 쓸린다.
  wipers: TRI.box() * 4,
  bolt: TRI.cylinder(6),
  grabHandle: TRI.box() * 3,
});

/** 기종별 계기 눈금 수다. 계기가 많은 기종은 여기와 Dial 의 ticks prop 을 함께 줄인다.
 * 적어두지 않은 기종은 기본값을 쓴다. */
export const COCKPIT_DIAL_TICKS = Object.freeze({});

export function dialTicks(key) {
  const count = COCKPIT_DIAL_TICKS[key];
  return Number.isFinite(count) ? count : DIAL_TICKS;
}

const dialCost = (ticks) => DIAL_BODY + Math.max(2, ticks) * TICK;

const sum = (counts, ticks) => Object.entries(counts)
  .reduce((total, [part, amount]) => total + (part === 'dial' ? dialCost(ticks) : PART[part]) * amount, 0);

/** 기종별 조각 수다. 콕핏 파일의 구성과 맞춘다. 조각을 더하거나 빼면 여기도 고친다. */
export const COCKPIT_PARTS = Object.freeze({
  jet: { panel: 16, dial: 6, stick: 1, lever: 1, display: 1, placard: 1 },
  bomber: { panel: 20, dial: 6, yoke: 1, lever: 2, display: 2, placard: 1 },
  prop: { panel: 19, dial: 6, stick: 1, lever: 1, display: 1, placard: 1 },
  // HUD combiner 틀 네 줄이 전부 low 로 내려와(예전에는 좌우 둘이 medium) panel 이 둘 늘었다.
  fighter: { panel: 20, dial: 1, stick: 1, lever: 1, display: 2, hud: 1, placard: 1 },
  interceptor: { panel: 19, dial: 3, stick: 1, lever: 1, display: 1, hud: 1, placard: 1 },
  helicopter: { panel: 19, dial: 6, stick: 1, lever: 1, display: 1, placard: 1 },
  sedan: { panel: 19, yoke: 1, dial: 2, display: 1, mirror: 3 },
  suv: { panel: 21, yoke: 1, dial: 2, display: 1, mirror: 3 },
  convertible: { panel: 17, yoke: 1, dial: 2, display: 1, mirror: 3 },
  truck: { panel: 24, yoke: 1, dial: 3, display: 1, mirror: 3 },
  // 나셀 하나, 손(손등+손가락+엄지) 여섯, 전완 둘, 레버 둘, 스로틀 하나, 무릎 둘이 panel 14개다.
  // 계기 둘 다 numbers 와 hood 를 쓰므로 dialHood 를 따로 더한다. 거울은 좌우 둘뿐이다.
  // 윈드스크린 유리 한 장(glass) 은 외장의 불투명 판 둘을 1인칭에서 대신한다.
  motorcycle: { panel: 14, dial: 2, dialHood: 2, display: 1, mirror: 2, glass: 1 },
  // round 2: 벽을 GUNNER_CONSOLES 의 walls(AABB 목록, 외장 포탑 상자 기준) 로 다시 만들었다.
  // 바닥, 지붕에 옆, 뒤, 앞벽 넷(위 아래 좌우, 가운데가 조준경 개구부) 을 더해 panel 9다.
  // 포미(블록, 가드 둘) + 조종 핸들(바, 그립 둘) 이 panel 3 늘어 12, 조준경(OpticFrame 둘 +
  // 이마 받침 + 표식 레일) 이 11 이라 합쳐 panel 26이다. knob 은 핸들 노브 둘, grabHandle 은
  // 포미 손잡이 하나다. 계기는 numbers 를 쓰므로 ticks 대신 dialBody 로 센다(방위, rpm, 속도 셋).
  tank: { panel: 26, knob: 2, grabHandle: 1, dialBody: 3, display: 1 },
  // 전차와 같은 구성(벽 9 + 포미 3 + 핸들 3 + 조준경 11 = 26) 에 장전기 트레이 panel 하나,
  // 계기 하나(앙각) 가 늘었다.
  howitzer: { panel: 27, knob: 2, grabHandle: 1, dialBody: 4, display: 1 },
  // 무인 포탑 바스켓을 버리고 운전석 위 큐폴라로 바꿨다(round 1). 슬릿 8장이 glass, 슬릿
  // 사이 기둥 8개와 해치 뚜껑, 대시가 panel 10이다. 큐폴라 링(canopyArc), 좌석(seat),
  // 사격 통제 화면(display), 방위 다이얼(dialBody), 조이스틱(stick), 스티어링(yoke) 이 하나씩이다.
  armored: { panel: 10, glass: 8, canopyArc: 1, seat: 1, display: 1, dialBody: 1, stick: 1, yoke: 1 },
  // round 2: 앞벽 자체를 walls 목록에서 뺐다(이전 frontOpen 의 각도 부호가 뒤집혀 있었다).
  // 바닥 + 옆, 뒤벽 셋이 panel 4, 뒤쪽 절반 지붕(지붕이 천장창을 덮던 문제를 고쳤다) 이 하나,
  // 정면창과 천장창 사이 프레임이 하나, 포미(쌍열, 손잡이 없음) 셋, 조종 핸들 셋이라 panel
  // 12다. glass 는 앞창, 천장창(SkyWindow) 둘과 반사식 조준경 유리 하나로 3, canopyArc 는
  // 그 조준경 링(항상 보인다) 하나다. knob 은 조종 핸들 둘과 포신 뿌리 둘이 넷이다. 지붕이
  // 절반뿐이라 해치 링, 손잡이(BasketWalls 의 high 몫) 는 없다.
  // 왼쪽 벽은 불투명 판 하나가 아니라 관측창이다. 유리 한 장에 프레임 네 줄이라 panel 이 셋 늘었다.
  aa: { panel: 15, glass: 4, canopyArc: 1, knob: 4, dialBody: 4, display: 1 },
});

/** 등급을 올릴 때 더 붙는 조각이다. COCKPIT_PARTS 가 low 구성이고 여기는 추가분만 적는다.
 * medium 은 유리, 좌석, 손, 후드, 노브, 접촉 그림자다. high 는 소품과 활 프레임까지다.
 * 실내 파일이 자기 기종 행만 채운다. 비어 있으면 그 등급에서 low 와 같은 구성이다. */
export const QUALITY_PARTS = Object.freeze({
  // 항공기 여섯은 medium 에서 캐노피 유리와 활 프레임, 사출좌석과 벨트와 무릎, 조종간과
  // 스로틀을 쥔 손, 페달, 쿼드런트, 숫자 눈금판과 후드, 구형 자세계가 붙는다.
  // 음수는 low 조각을 대체한 것이다. dial -1 은 6홀 가운데 위(ATT) 가 자세계로 바뀐 몫,
  // tick 음수는 숫자 눈금판을 쓰는 계기가 mesh 눈금을 버린 몫(계기당 12개)이다.
  // panel 은 캐노피 레일 둘, 좌석 판 셋 대신 벨트 둘과 무릎 둘, 기어 손잡이 캡, 코 덮개다.
  jet: {
    medium: { panel: 5, shade: 5, canopyShell: 1, canopyArc: 2, grabHandle: 1, seat: 1, toggle: 4, knob: 2, stickHand: 2, quadrant: 1, gearLever: 1, pedal: 2, display: 1, attitudeBall: 1, dial: -1, tick: -60, dialHood: 5 },
    high: { canopyArc: 1, bolt: 6, button: 6 },
  },
  // 폭격기는 부기장석 좌석과 요크가 하나씩 더 있고 스로틀이 4발이라 레버가 둘 늘어난다.
  // 캐노피가 납작해 반원통과 활 프레임 대신 평면 유리 지붕(glass 셋 중 하나) 과 가로
  // 프레임(panel) 을 쓴다. high 의 토글 여섯과 로터리 둘은 오버헤드이고 프레임이 한 줄 더 붙는다.
  bomber: {
    medium: { panel: 6, glass: 3, shade: 4, grabHandle: 1, seat: 2, toggle: 4, knob: 2, hands: 1, yoke: 1, quadrant: 1, lever: 2, stickHand: 1, gearLever: 1, pedal: 2, attitudeBall: 1, dial: -1, tick: -60, dialHood: 5 },
    high: { panel: 1, bolt: 6, button: 6, toggle: 6, knob: 2 },
  },
  // 프로펠러기는 활 프레임이 앞뒤 둘뿐이라 high 에서 늘지 않는다. 나침반 노브가 하나 더 있고
  // 고정식 랜딩기어라 기어 레버가 없다. 쿼드런트 레버는 스로틀, 혼합비, 프로펠러 피치 셋이다.
  prop: {
    medium: { panel: 4, shade: 5, canopyShell: 1, canopyArc: 2, grabHandle: 1, seat: 1, toggle: 4, knob: 3, stickHand: 2, quadrant: 1, lever: 2, pedal: 2, attitudeBall: 1, dial: -1, tick: -60, dialHood: 5 },
    high: { bolt: 6, button: 6 },
  },
  // 전투기는 combiner 아래 그림자가 더 붙고, high 의 버튼 열여덟은 회로 차단기 여섯과
  // UFC 키패드 열둘이다. combiner 틀 네 줄은 low 로 내려갔다.
  fighter: {
    medium: { panel: 5, shade: 6, canopyShell: 1, canopyArc: 2, grabHandle: 1, seat: 1, toggle: 4, knob: 2, stickHand: 2, quadrant: 1, gearLever: 1, pedal: 2, attitudeBall: 1, tick: -12, dialHood: 1 },
    high: { canopyArc: 1, bolt: 6, button: 18 },
  },
  // 요격기는 medium 에서 GUNS 화면이 한 장 늘고 캐노피가 좁아 활 프레임이 둘뿐이다.
  // combiner 틀 네 줄은 low 로 내려갔다.
  // 코 덮개는 두지 않는다. 외장 노즈가 앞에 보이는 데다 덮개 앞 모서리가 계기 윗변 1도 위까지
  // 올라와 속도, 고도, 연료 계기를 위협했다.
  interceptor: {
    medium: { panel: 4, shade: 6, canopyShell: 1, canopyArc: 2, grabHandle: 1, seat: 1, toggle: 4, knob: 2, stickHand: 2, quadrant: 1, gearLever: 1, pedal: 2, display: 1, attitudeBall: 1, tick: -36, dialHood: 3 },
    high: { bolt: 6, button: 6 },
  },
  // 헬기는 기어 레버와 코 덮개가 없고 대신 문 창 둘(glass 2), 콜렉티브 트위스트 그립(knob)
  // 과 오버헤드 엔진 레버 둘이 있다. 앞유리 평면은 캐노피 반원통과 겹쳐 뿌연 사각형이
  // 하나 더 생기므로 두지 않는다. panel 넷 중 하나는 외장 대신 실내가 세우는 중앙 기둥이다.
  helicopter: {
    medium: { panel: 4, shade: 5, canopyShell: 1, canopyArc: 2, grabHandle: 1, seat: 1, toggle: 4, knob: 3, stickHand: 2, quadrant: 1, lever: 2, pedal: 2, glass: 2, display: 1, attitudeBall: 1, dial: -1, tick: -60, dialHood: 5 },
    high: { canopyArc: 1, bolt: 6, button: 6, toggle: 6 },
  },
  // 승용차 medium 은 유리(앞옆뒤), 좌석 둘, 스티어링을 쥔 손, 계기 후드, 벤트와 공조 노브,
  // 비상등과 창 스위치, 접촉 그림자 여섯, 와이퍼, 페달 둘, 기어 레버, 그리고 판 스물이다.
  // 판 스물은 팔걸이와 도어 포켓과 컬럼 덮개 여섯에 이번에 더한 열넷(A 필러와 헤더 천 마감
  // 셋, 문 어깨 라인과 포켓 입구 넷, 대시 이음선과 글로브박스 윤곽 넷, 센터 스택 베젤과
  // 송풍구와 안쪽 면 일곱 중 스토크 둘을 high 에서 옮긴 몫) 이다. 스피커 원 둘이 노브로
  // 늘었다. high 는 선바이저, 룸미러 하우징, 뒷좌석 방석, 문 손잡이, 컵홀더다. 계기는 숫자
  // 눈금판을 써 mesh 눈금이 없으므로 low 의 dial 행이 계기당 24 씩 크게 잡혀 있다.
  sedan: {
    medium: { panel: 28, glass: 4, seat: 2, hands: 1, dialHood: 2, knob: 7, button: 3, shade: 6, wipers: 1, pedal: 2, gearLever: 1 },
    high: { panel: 6, grabHandle: 2, knob: 2 },
  },
  // SUV 는 A 필러 손잡이가 하나 더 붙는다.
  suv: {
    medium: { panel: 28, glass: 4, seat: 2, hands: 1, dialHood: 2, knob: 7, button: 3, shade: 6, wipers: 1, pedal: 2, gearLever: 1 },
    high: { panel: 6, grabHandle: 3, knob: 2 },
  },
  // 오픈카는 좌석만 외장이 그린다. 유리는 앞유리와 좌석 뒤 바람막이 둘이고,
  // 지붕이 없어 헤드라이너 그림자와 선바이저가 빠진다.
  convertible: {
    medium: { panel: 28, glass: 2, hands: 1, dialHood: 2, knob: 7, button: 3, shade: 5, wipers: 1, pedal: 2, gearLever: 1 },
    high: { panel: 4, grabHandle: 2, knob: 2 },
  },
  // 트럭은 콘솔 대신 엔진 덮개라 medium 판이 둘 적고, 마커등 토글 셋과 계기 후드 셋이 있다.
  // high 는 서류 상자, 컵홀더 둘, 옆창 손잡이 둘, 캡 뒷벽 볼트 넷이다.
  truck: {
    medium: { panel: 26, glass: 3, seat: 2, hands: 1, dialHood: 3, knob: 7, button: 3, shade: 6, wipers: 1, pedal: 2, gearLever: 1, toggle: 3 },
    high: { panel: 5, grabHandle: 4, knob: 2, bolt: 4 },
  },
  motorcycle: { medium: {}, high: {} },
  // medium: 계기 후드(dialHood, 다이얼 수만큼), 포탄 거치대(knob, 캡 panel), 지붕 안쪽
  // 페리스코프 블록의 유리(glass, GlassPane), 그리고 벽 보강 리브 여섯과 천장 환기구, 등
  // 여덟 판에 배선 관(knob) 하나와 뒷벽 볼트 줄(bolt) 여섯. high: 해치 링(canopyArc), 손잡이(grabHandle),
  // 조준경 배율 손잡이와 소화기, 무전기, 볼트 줄, 그물망 판(knob, panel, toggle, bolt).
  tank: { medium: { dialHood: 3, knob: 7, panel: 17, glass: 3, bolt: 6 }, high: { canopyArc: 1, grabHandle: 1, knob: 4, panel: 2, toggle: 2, bolt: 6 } },
  howitzer: { medium: { dialHood: 4, knob: 9, panel: 16, bolt: 6 }, high: { canopyArc: 1, grabHandle: 1, knob: 4, panel: 2, toggle: 2, bolt: 6 } },
  // 큐폴라는 medium 에서 방위 다이얼 후드 하나만 켠다. high 는 해치 손잡이(grabHandle) 와
  // 큐폴라 링 볼트 넷(bolt) 이다.
  armored: { medium: { dialHood: 1 }, high: { grabHandle: 1, bolt: 4 } },
  // 대공포 반사식 링은 항상 보이므로(low 로 옮김) medium 에는 계기 후드, 포탄 거치대, 벽
  // 보강 리브 여섯, 배선 관, 볼트 줄이 남는다. 지붕이 뒤쪽 절반뿐이라(BasketWalls roof=false)
  // 천장 환기구와 등, 해치 링, 손잡이가 없다. high 는 반사식
  // 조준경 배율 손잡이와 소화기, 무전기, 볼트 줄, 그물망 판뿐이다(knob, panel, toggle, bolt).
  aa: { medium: { dialHood: 4, knob: 7, panel: 12, bolt: 6 }, high: { knob: 4, panel: 2, toggle: 2, bolt: 6 } },
});

/** 기종의 삼각형 수다. ticks 를 주면 그 눈금 수로 다시 센다.
 * quality 가 medium 이상이면 그 등급까지의 추가분을 누적한다. */
export function cockpitTriangles(key, ticks = dialTicks(key), quality = 'low') {
  const parts = COCKPIT_PARTS[key];
  if (!parts) return undefined;
  const extra = QUALITY_PARTS[key] || {};
  let total = sum(parts, ticks);
  if (quality === 'medium' || quality === 'high') total += sum(extra.medium || {}, ticks);
  if (quality === 'high') total += sum(extra.high || {}, ticks);
  return total;
}

export const COCKPIT_TRIANGLES = Object.freeze(
  Object.fromEntries(Object.keys(COCKPIT_PARTS).map((key) => [key, cockpitTriangles(key)])),
);

/** 인자 순서는 (key, quality, ticks) 다. 등급마다 예산과 조각 수가 함께 바뀐다. */
export function withinBudget(key, quality = 'medium', ticks = dialTicks(key)) {
  const level = BUDGET[quality] ? quality : 'medium';
  const count = cockpitTriangles(key, ticks, level);
  return Number.isFinite(count) && count <= BUDGET[level];
}
