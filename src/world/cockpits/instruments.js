import { FLIGHT_GROUND } from '../flightPhysics.js';
import { gunOf, muzzleAim } from '../weapons.js';
import { armamentOf } from '../hardpoints.js';
import { eyePoint } from '../eyePoints.js';
import { MAX_RPM, REDLINE_RPM } from '../carGauges.js';
import { createUrbanPlan } from '../../../shared/urbanPlan.js';
import { navigationRadius, toNavigationSegment } from '../navigationMap.js';
import { BRAND_CLUSTER_SIZE, drawCoupeClassic, drawTeslaDriver, drawFerrariTach } from './brandClusters.js';

/** 계기와 HUD 가 그리는 내용이다. 순수 함수이며 Three, React 에 의존하지 않는다.
 * 캔버스 2D context 만 인자로 받으므로 단위 테스트가 그대로 호출한다.
 *
 * 규칙 하나가 이 파일 전체를 지배한다. 없는 값을 지어내지 않는다. RPM, 엔진 온도,
 * 레이더 표적처럼 시뮬레이션에 없는 수치는 그리지 않고, 알 수 없는 값은 EMPTY 로 적는다.
 * 연료는 요격기만 실제로 갖는 값이라 그 기종에서만 칸이 생긴다.
 */

/** 계기 화면 한 장의 픽셀 크기다. 평면의 실제 크기는 호출자가 정하고 여기서는 비율만 맞춘다.
 * MFD 는 실제 항공기처럼 정사각이라 따로 둔다. */
const WIDE = Object.freeze({ width: 512, height: 256 });
const SQUARE = Object.freeze({ width: 256, height: 256 });
export const DISPLAY = Object.freeze({ ...WIDE, square: SQUARE });

/** mode 에 맞는 캔버스 크기다. 정사각이 필요한 배치는 여기 한 곳에서만 정한다. */
export function displaySize(mode) {
  return BRAND_CLUSTER_SIZE[mode] || (mode === 'mfd' ? SQUARE : WIDE);
}
/** HUD 한 장의 픽셀 크기다. 정사각이라 피치 사다리의 중심이 256 이다. */
export const HUD = Object.freeze({ size: 512 });

/** 값이 없을 때 쓰는 표시다. 0 과 구별된다. */
export const EMPTY = '—';

const DEG = 180 / Math.PI;
// Number(null) and Number('') are both zero.  They mean "no telemetry" here,
// so accepting either would fabricate a zero-fuel or zero-ammunition reading.
const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

const int = (value) => (finite(value) ? String(Math.round(Number(value))) : EMPTY);
const fixed = (value, digits) => (finite(value) ? Number(value).toFixed(digits) : EMPTY);
const signed = (value) => (finite(value) ? `${Number(value) >= 0 ? '+' : ''}${Math.round(Number(value))}` : EMPTY);
/** 방위는 0 에서 359 로 감아 세 자리로 적는다. 359.8 은 360 이 아니라 000 이다. */
const compass = (value) => (finite(value)
  ? String(((Math.round(Number(value)) % 360) + 360) % 360).padStart(3, '0')
  : EMPTY);
const percent = (value) => (finite(value) ? String(Math.round(Number(value) * 100)) : EMPTY);
const label = (value) => (value === 0 || value ? String(value) : EMPTY);

/** 계기가 읽는 값이다. 전부 문자열이고 모르는 값은 EMPTY 다.
 * 단위는 상태가 주는 그대로다. 속도 km/h, 고도 m, 방위 도, 조준각은 라디안을 도로 바꾼다. */
export function instrumentReadings(status = {}) {
  const state = status || {};
  const aim = state.aim || {};
  return {
    speed: int(state.speed),
    altitude: int(state.altitude),
    heading: compass(state.heading),
    climb: signed(state.climb),
    throttle: percent(state.throttle),
    gear: label(state.gear),
    rpm: int(state.rpm),
    pitch: signed(state.pitch),
    roll: signed(state.roll),
    steer: fixed(state.steer, 2),
    azimuth: fixed(finite(aim.yaw) ? Number(aim.yaw) * DEG : null, 1),
    elevation: fixed(finite(aim.pitch) ? Number(aim.pitch) * DEG : null, 1),
    range: int(state.range),
    gun: int(state.cannonAmmo),
    missile: int(state.missileAmmo),
    bomb: int(state.bombAmmo),
    bay: typeof state.bayOpen === 'boolean' ? (state.bayOpen ? 'OPEN' : 'CLOSED') : EMPTY,
    hull: percent(state.hull),
    fuel: percent(state.fuel),
    autopilot: state.autopilot ? String(state.autopilot).toUpperCase() : EMPTY,
  };
}

/** 피치 사다리의 눈금이다. 화면 중심이 (256, 256) 이고 y 는 아래로 커진다.
 * 기수를 들면 수평선이 화면 아래로 내려가므로 pitch 가 커질수록 y 가 커진다.
 * roll 은 눈금 전체를 화면 중심에서 회전시킨다. 바깥 수평선과 같은 방향으로 기운다. */
export function hudLadder(pitch = 0, roll = 0) {
  const centre = HUD.size / 2;
  const pitchDegrees = finite(pitch) ? Number(pitch) * DEG : 0;
  const bank = finite(roll) ? Number(roll) : 0;
  const cos = Math.cos(bank), sin = Math.sin(bank);
  return LADDER_STEPS.map((degrees) => {
    const dy = (pitchDegrees - degrees) * HUD_PIXELS_PER_DEGREE;
    const span = degrees === 0 ? HUD_HORIZON_SPAN : HUD_MARK_SPAN;
    const point = (x) => ({ x: centre + x * cos - dy * sin, y: centre + x * sin + dy * cos });
    return { degrees, dy, span, left: point(-span), right: point(span) };
  });
}

/** 사다리 눈금 간격이다. 화면 반쪽(256px) 이 약 25도다. */
const HUD_PIXELS_PER_DEGREE = 10.2;
const HUD_HORIZON_SPAN = 190, HUD_MARK_SPAN = 78;
const LADDER_STEPS = [-30, -20, -10, 0, 10, 20, 30];

/** 계기 화면의 바탕이다. 야간이든 주간이든 같은 어두운 판에 accent 색 글자를 올린다. */
function background(ctx, width, height) {
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#1d2730';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);
}

/** 이름과 값 한 쌍이다. 이름은 작게 위, 값은 크게 아래다. 라벨은 흐린 회색, 값은 accent 라
 * 둘의 대비가 크다. box 를 주면 값 뒤에 옅은 칸을 먼저 깔아 칸 경계가 보이게 한다. */
function readout(ctx, text, value, x, y, size = 46, unit = '', box = 0) {
  if (box > 0) {
    ctx.fillStyle = '#121d26';
    ctx.fillRect(x - 6, y + 8, box, size + 10);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#93aab7';
  ctx.font = '700 22px monospace';
  ctx.fillText(text, x, y);
  ctx.fillStyle = ctx.accentColour || '#83eda0';
  ctx.font = `700 ${size}px monospace`;
  ctx.fillText(value, x, y + size + 4);
  if (unit) {
    ctx.fillStyle = '#7d93a0';
    ctx.font = '20px monospace';
    ctx.fillText(unit, x + size * 2.6, y + size + 2);
  }
}

/** 가로 막대 게이지다. ratio 가 0 에서 1 이며 값이 없으면 빈 막대만 그린다. */
function bar(ctx, x, y, width, height, ratio, accent) {
  ctx.fillStyle = '#16202a';
  ctx.fillRect(x, y, width, height);
  const fill = finite(ratio) ? Math.max(0, Math.min(1, Number(ratio))) : 0;
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, width * fill, height);
}

/** 원호 게이지다. 계기 바늘과 같은 7시에서 5시 240도를 쓴다.
 * 값이 없으면 바탕 호와 눈금만 남기고 채우지 않는다. 0 처럼 보이면 안 된다. */
const GAUGE_SWEEP = 4.19;
const gaugeAngle = (ratio) => ratio * GAUGE_SWEEP - GAUGE_SWEEP / 2 - Math.PI / 2;

function arcGauge(ctx, x, y, radius, ratio, accent) {
  ctx.lineWidth = 11;
  ctx.strokeStyle = '#18222b';
  ctx.beginPath();
  ctx.arc(x, y, radius, gaugeAngle(0), gaugeAngle(1));
  ctx.stroke();
  if (finite(ratio)) {
    const fill = Math.max(0, Math.min(1, Number(ratio)));
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, radius, gaugeAngle(0), gaugeAngle(fill));
    ctx.stroke();
  }
  ctx.strokeStyle = '#3c4d59';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let step = 0; step <= 12; step++) {
    const angle = gaugeAngle(step / 12);
    const inner = radius - (step % 3 === 0 ? 20 : 11);
    ctx.moveTo(x + Math.cos(angle) * (radius - 8), y + Math.sin(angle) * (radius - 8));
    ctx.lineTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
  }
  ctx.stroke();
}

/** 세단 와이드 계기판의 꺾인 세로 트랙이다. 좌우를 같은 점에서 거울상으로 만들어
 * 두 게이지가 정확히 마주 보게 한다. fill 은 실제 값 비율만큼 아래에서 올라온다. */
function executiveChevron(ctx, side, ratio, fill) {
  const mirror = (x) => side < 0 ? x : WIDE.width - x;
  const points = [[232, 30], [188, 128], [232, 226], [210, 226], [164, 128], [210, 30]];
  const path = () => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(mirror(x), y) : ctx.moveTo(mirror(x), y));
    ctx.closePath();
  };
  path();
  ctx.fillStyle = '#111a22';
  ctx.fill();
  if (finite(ratio)) {
    const amount = Math.max(0, Math.min(1, Number(ratio)));
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = fill;
    ctx.fillRect(156, 226 - 196 * amount, WIDE.width - 312, 196 * amount);
    ctx.restore();
  }
  path();
  ctx.strokeStyle = '#c6d2d9';
  ctx.lineWidth = 4;
  ctx.stroke();
  // 안쪽 cyan 선은 은색 외곽과 겹치지 않아 작은 화면에서도 꺾인 윤곽을 남긴다.
  ctx.beginPath();
  [[218, 40], [176, 128], [218, 216]].forEach(([x, y], index) =>
    index ? ctx.lineTo(mirror(x), y) : ctx.moveTo(mirror(x), y));
  ctx.strokeStyle = side < 0 ? '#7895a4' : '#66d3e6';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = '#71828c';
  ctx.lineWidth = 2;
  for (const y of [48, 101, 155, 208]) {
    const from = mirror(201), to = mirror(216);
    ctx.beginPath(); ctx.moveTo(from, y); ctx.lineTo(to, y); ctx.stroke();
  }
}

/** 긴 오류값도 화면 밖으로 밀려나지 않게 숫자의 자릿수만큼 글자를 줄인다. */
function executiveFont(value, normal, medium, compact) {
  const length = String(value).length;
  return length <= 3 ? normal : length <= 5 ? medium : compact;
}

/** 센서가 비정상적으로 큰 유한값을 보내도 물리 화면에서 읽을 수 있는 짧은 표기로 남긴다. */
function executiveNumber(value) {
  if (!finite(value)) return EMPTY;
  const number = Number(value);
  return Math.abs(number) >= 1e7
    ? number.toExponential(0).replace('e+', 'e')
    : String(Math.round(number));
}

/** 사격 통제 화면의 격자다. 거리감을 주는 배경일 뿐 눈금이 아니다. */
function grid(ctx, width, height, step = 32) {
  ctx.strokeStyle = '#132029';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = step; y < height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
}

let roadPlanExtent;
let roadPlanValue;
function roadPlan(extent) {
  if (extent !== roadPlanExtent) {
    roadPlanExtent = extent;
    roadPlanValue = createUrbanPlan(extent);
  }
  return roadPlanValue;
}

const LAYOUTS = {
  coupeClassic(ctx, read, accent, { status = {} } = {}) { drawCoupeClassic(ctx, status); },
  teslaDriver(ctx, read, accent, { status = {} } = {}) { drawTeslaDriver(ctx, status); },
  ferrariTach(ctx, read, accent, { status = {} } = {}) { drawFerrariTach(ctx, status); },
  /** 여섯 칸 계기다. 실제 항공기 6홀 배치와 같은 순서로 이름과 숫자를 적는다. */
  sixpack(ctx, read, accent) {
    const cells = [
      ['SPD', read.speed, 'KM/H'], ['ALT', read.altitude, 'M'], ['HDG', read.heading, ''],
      ['V/S', read.climb, 'M/S'], ['PITCH', read.pitch, 'DEG'], ['THR', read.throttle, '%'],
    ];
    cells.forEach((cell, index) => {
      const x = 28 + (index % 3) * 164;
      const y = 44 + Math.floor(index / 3) * 112;
      ctx.fillStyle = '#111b22';
      ctx.fillRect(x - 12, y - 26, 148, 96);
      // 칸 테두리다. 여섯 칸이 한 판에 번진 것처럼 보이지 않게 경계를 긋는다.
      ctx.strokeStyle = '#27353f';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 12, y - 26, 148, 96);
      readout(ctx, cell[0], cell[1], x, y, 38, cell[2]);
    });
    ctx.fillStyle = accent;
  },

  /** 주 비행 표시다. 왼쪽 속도, 오른쪽 고도, 가운데 자세와 방위다. */
  flight(ctx, read, accent) {
    readout(ctx, 'SPD KM/H', read.speed, 26, 48, 54);
    readout(ctx, 'ALT M', read.altitude, 330, 48, 54);
    readout(ctx, 'HDG', read.heading, 200, 48, 54);
    readout(ctx, 'V/S M/S', read.climb, 26, 170, 40);
    readout(ctx, 'PITCH', read.pitch, 200, 170, 40);
    // 연료가 있는 기종만 연료를 적는다. 없는 기종은 그 자리에 뱅크각을 둔다.
    if (read.fuel === EMPTY) readout(ctx, 'ROLL', read.roll, 330, 170, 40);
    else readout(ctx, 'FUEL %', read.fuel, 330, 170, 40);
    ctx.fillStyle = accent;
  },

  /** 항법 표시다. 표적이나 웨이포인트를 만들지 않는다. 자동비행 상태와 방위만 적는다. */
  nav(ctx, read, accent) {
    readout(ctx, 'HDG', read.heading, 26, 48, 54);
    readout(ctx, 'ALT M', read.altitude, 220, 48, 54);
    readout(ctx, 'AUTOPILOT', read.autopilot, 26, 170, 34);
    readout(ctx, 'THR %', read.throttle, 300, 170, 34);
    bar(ctx, 26, 232, 460, 10, Number(read.throttle) / 100, accent);
  },

  /** 무장 표시다. 잔탄이 0 이면 0 이라고 적는다. 남은 것처럼 보이게 하지 않는다. */
  stores(ctx, read, accent) {
    readout(ctx, 'GUN', read.gun, 26, 48, 54);
    readout(ctx, 'MSL', read.missile, 220, 48, 54);
    readout(ctx, 'RNG M', read.range, 26, 170, 40);
    readout(ctx, 'HULL %', read.hull, 300, 170, 40);
    ctx.fillStyle = accent;
  },

  /** 미사일 하드포인트가 없는 기종의 무장 페이지다. 기관포·거리·기체 상태만 쓴다. */
  guns(ctx, read, accent) {
    readout(ctx, 'GUN', read.gun, 26, 48, 54);
    readout(ctx, 'RNG M', read.range, 220, 48, 40);
    readout(ctx, 'HULL %', read.hull, 26, 170, 40);
    ctx.fillStyle = accent;
  },

  /** 폭격기의 폭탄창 화면이다. 폭격기는 기관포·미사일을 가진 전투기로 보이면 안 된다.
   * bombAmmo 와 bayOpen 은 무장 시뮬레이션이 실제로 보내는 값만 쓴다. */
  bombs(ctx, read, accent) {
    readout(ctx, 'BOMB', read.bomb, 26, 48, 54);
    readout(ctx, 'BAY', read.bay, 220, 48, 38);
    readout(ctx, 'RNG M', read.range, 26, 170, 40);
    readout(ctx, 'HULL %', read.hull, 300, 170, 40);
    ctx.fillStyle = accent;
  },

  /** 승용차 계기다. 큰 속도와 기어, 방위다. */
  car(ctx, read, accent) {
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.font = '112px monospace';
    ctx.fillText(read.speed, 30, 150);
    ctx.fillStyle = '#6f8794';
    ctx.font = '24px monospace';
    ctx.fillText('KM/H', 34, 190);
    readout(ctx, 'GEAR', read.gear, 300, 48, 54);
    readout(ctx, 'RPM', read.rpm, 300, 158, 40);
  },

  /** A single-speed EV has a signed traction/regen value, never engine RPM. */
  electricCluster(ctx, read, accent, { status = {} } = {}) {
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.font = '112px monospace';
    ctx.fillText(read.speed, 28, 151);
    ctx.fillStyle = '#90a8b3';
    ctx.font = '24px monospace';
    ctx.fillText('KM/H', 34, 192);
    readout(ctx, 'DRIVE', read.gear === 'R' ? 'R' : 'D', 308, 45, 50);
    const power = finite(status.power) ? Math.max(-1, Math.min(1, Number(status.power))) : null;
    const name = power === null ? 'POWER' : power < 0 ? 'REGEN' : 'POWER';
    const value = power === null ? EMPTY : String(Math.round(Math.abs(power) * 100));
    readout(ctx, name, value, 308, 150, 44);
    ctx.fillStyle = '#273944';
    ctx.fillRect(308, 220, 172, 10);
    if (power !== null) {
      ctx.fillStyle = power < 0 ? '#64c9d5' : accent;
      ctx.fillRect(308, 220, Math.abs(power) * 172, 10);
    }
  },

  /** 오토바이 계기다. 원형 속도계 하나와 보조 숫자다. */
  bike(ctx, read, accent) {
    ctx.beginPath();
    ctx.arc(150, 128, 104, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a3a46';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '86px monospace';
    ctx.fillText(read.speed, 150, 148);
    ctx.fillStyle = '#6f8794';
    ctx.font = '22px monospace';
    ctx.fillText('KM/H', 150, 186);
    readout(ctx, 'GEAR', read.gear, 320, 62, 46);
    readout(ctx, 'RPM', read.rpm, 320, 166, 34);
  },

  /** 지상 전투 차량의 사격 통제 표시다. 포탑 상대각, 앙각, 탄착 거리, 내구도다. */
  ground(ctx, read, accent) {
    readout(ctx, 'AZ DEG', read.azimuth, 26, 44, 44);
    readout(ctx, 'EL DEG', read.elevation, 250, 44, 44);
    readout(ctx, 'RNG M', read.range, 26, 152, 40);
    readout(ctx, 'SPD', read.speed, 250, 152, 40);
    bar(ctx, 26, 228, 460, 12, Number(read.hull) / 100, accent);
  },

  /** 승용차 계기판이다. 왼쪽은 원호 게이지를 두른 큰 속도, 오른쪽은 기어와 회전수다.
   * 주행 거리는 시뮬레이션에 없는 값이라 칸을 만들지 않는다. */
  cluster(ctx, read, accent, { status = {} } = {}) {
    const top = Number(status.top);
    const scale = finite(top) && top > 0 ? top : 240;
    const speed = Number(read.speed);
    // 속도는 왼쪽으로 몰고 원호 게이지를 그 둘레에 크게 두른다. 오른쪽 절반은 기어와 회전수다.
    arcGauge(ctx, 146, 126, 112, finite(speed) ? speed / scale : null, accent);

    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '700 98px monospace';
    ctx.fillText(read.speed, 146, 146);
    ctx.fillStyle = '#93aab7';
    ctx.font = '700 24px monospace';
    ctx.fillText('KM/H', 146, 188);

    // 두 영역을 세로줄 한 줄로 나눈다. 숫자가 서로 다른 계기임을 그 줄이 말한다.
    ctx.fillStyle = '#1d2b36';
    ctx.fillRect(282, 26, 2, 204);

    readout(ctx, 'GEAR', read.gear, 312, 44, 82);
    readout(ctx, 'RPM', read.rpm, 312, 168, 36);
    const revs = Number(read.rpm);
    // 레드존 위는 경고색이다. 회전계 눈금 끝은 carGauges 의 MAX_RPM 과 같은 값을 쓴다.
    bar(ctx, 312, 224, 176, 12, finite(revs) ? revs / MAX_RPM : null,
      finite(revs) && revs >= REDLINE_RPM ? '#e05a3a' : accent);
  },

  /** 세단 전용 executive cluster 다. 참조 화면의 마주 보는 꺾인 게이지 비례만 가져오고,
   * 시뮬레이션에 없는 배터리·음악·ePower·주행거리 정보는 만들지 않는다. */
  executiveCluster(ctx, read, accent, { status = {} } = {}) {
    const speed = finite(status.speed) ? Number(status.speed) : null;
    // carStatus 의 top 은 m/s, speed 는 km/h 다. 같은 단위로 바꾼 뒤 비율을 낸다.
    const top = finite(status.top) && Number(status.top) > 0 ? Number(status.top) * 3.6 : null;
    const rpm = finite(status.rpm) ? Number(status.rpm) : null;
    const shownSpeed = executiveNumber(status.speed);
    const shownRpm = executiveNumber(status.rpm);
    const shownGear = read.gear.length <= 3 ? read.gear : EMPTY;
    executiveChevron(ctx, -1, speed !== null && top ? speed / top : null, '#c88855');
    executiveChevron(ctx, 1, rpm !== null ? rpm / MAX_RPM : null, '#317e91');

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e9f0f3';
    ctx.textAlign = 'left';
    ctx.font = `700 ${executiveFont(shownSpeed, 60, 46, 34)}px monospace`;
    ctx.fillText(shownSpeed, 108, 207, 76);
    ctx.fillStyle = '#91a5af';
    ctx.font = '700 18px monospace';
    ctx.fillText('KM/H', 110, 232);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e9f0f3';
    ctx.font = `700 ${executiveFont(shownGear, 64, 48, 36)}px monospace`;
    ctx.fillText(shownGear, 404, 207, 64);

    // 중앙은 실제 엔진 회전수와 방위만 남겨 작은 물리 화면에서도 숫자가 뭉치지 않는다.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#728995';
    ctx.font = '700 17px monospace';
    ctx.fillText('RPM', 256, 72);
    ctx.fillStyle = '#d9e4e9';
    ctx.font = `700 ${executiveFont(shownRpm, 30, 25, 20)}px monospace`;
    ctx.fillText(shownRpm, 256, 105, 68);
    ctx.fillStyle = '#728995';
    ctx.font = '700 17px monospace';
    ctx.fillText('HDG', 256, 160);
    ctx.fillStyle = accent;
    ctx.font = '700 28px monospace';
    ctx.fillText(read.heading, 256, 193, 64);
  },

  /** 실제 도시 도로 그래프를 차량 진행방향이 위인 간이 지도로 그린다. extent/좌표가 없으면
   * 가짜 도로를 만들지 않고 데이터 없음만 표시한다. */
  roadnav(ctx, read, accent, { status = {} } = {}) {
    ctx.fillStyle = '#0d1820';
    ctx.fillRect(14, 18, 484, 220);
    if (![status.extent, status.x, status.z, status.heading].every(finite)) {
      readout(ctx, 'NAV', EMPTY, 28, 54, 46);
      return;
    }
    const extent = Number(status.extent), x = Number(status.x), z = Number(status.z), heading = Number(status.heading);
    if (extent <= 0) {
      readout(ctx, 'NAV', EMPTY, 28, 54, 46);
      return;
    }
    const pose = { x, z, heading }, radius = navigationRadius(status.speed);
    const plan = roadPlan(extent);
    ctx.save();
    ctx.beginPath();
    ctx.rect(14, 18, 484, 220);
    ctx.clip();
    ctx.strokeStyle = '#314754';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (const road of plan.roads) {
      const segment = toNavigationSegment({ x: road.x1, z: road.z1 }, { x: road.x2, z: road.z2 }, pose, radius);
      if (!segment.visible) continue;
      ctx.moveTo(14 + segment.a.x * 4.84, 18 + segment.a.y * 2.20);
      ctx.lineTo(14 + segment.b.x * 4.84, 18 + segment.b.y * 2.20);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(256, 138); ctx.lineTo(244, 166); ctx.lineTo(256, 158); ctx.lineTo(268, 166); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = '700 22px monospace'; ctx.fillText('NAV', 26, 44);
    ctx.textAlign = 'right'; ctx.fillText('HDG', 402, 44); ctx.fillText(read.heading, 486, 44);
  },

  /** 정사각 다기능 표시다. 테두리 안쪽에 버튼 눈금 스무 개를 두고 제목이 페이지를 고른다.
   * 내용은 기존 flight/stores/guns/nav 와 같은 값이며 배치만 정사각에 맞춘다. */
  mfd(ctx, read, accent, { title = 'FLT' } = {}) {
    const size = SQUARE.width;
    // 테두리 버튼 눈금 스무 개다. 굵고 밝아야 가장자리에서 버튼으로 읽힌다.
    ctx.fillStyle = '#4a5d6b';
    for (let index = 0; index < 5; index++) {
      const along = 28 + index * 50;
      ctx.fillRect(along - 13, 5, 26, 8);
      ctx.fillRect(along - 13, size - 13, 26, 8);
      ctx.fillRect(5, along - 13, 8, 26);
      ctx.fillRect(size - 13, along - 13, 8, 26);
    }
    const page = String(title || 'FLT').toUpperCase();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d3e0e7';
    ctx.font = '700 24px monospace';
    ctx.fillText(page, size / 2, 38);
    // 제목 아래 가로줄이다. 제목과 값 칸을 나눈다.
    ctx.fillStyle = '#3a4d5a';
    ctx.fillRect(24, 46, size - 48, 2);

    const pages = {
      STORES: [['GUN', read.gun, ''], ['MSL', read.missile, ''], ['RNG', read.range, 'M'], ['HULL', read.hull, '%']],
      GUNS: [['GUN', read.gun, ''], ['RNG', read.range, 'M'], ['HULL', read.hull, '%']],
      NAV: [['HDG', read.heading, ''], ['ALT', read.altitude, 'M'], ['A/P', read.autopilot, ''], ['THR', read.throttle, '%']],
      FLT: [['SPD', read.speed, 'KM/H'], ['ALT', read.altitude, 'M'], ['HDG', read.heading, ''], ['V/S', read.climb, 'M/S']],
    };
    const cells = pages[page] || pages.FLT;
    cells.forEach((cell, index) => {
      // 값 칸 폭은 106 이다. 더 키우면 단위 글자가 옆 칸 라벨을 침범한다.
      readout(ctx, cell[0], cell[1], 26 + (index % 2) * 114, 70 + Math.floor(index / 2) * 84, 30, cell[2], 106);
    });
    ctx.fillStyle = accent;
  },

  /** 전투 차량의 사격 통제 화면이다. 위 테이프가 포탑 방위, 아래 막대가 차체 내구도다.
   * 방위를 모르면 테이프에 숫자를 적지 않는다. 0 도를 가리키는 것처럼 보이면 안 된다. */
  fcs(ctx, read, accent) {
    grid(ctx, WIDE.width, WIDE.height);
    const centre = WIDE.width / 2;
    ctx.fillStyle = '#101b22';
    ctx.fillRect(26, 20, WIDE.width - 52, 46);
    ctx.strokeStyle = '#384c59';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 20, WIDE.width - 52, 46);

    const azimuth = Number(read.azimuth);
    if (finite(azimuth)) {
      // 눈금 간격을 3.2 에서 5.0 픽셀로 넓혀 숫자끼리 붙지 않게 한다. 대신 테이프가 담는
      // 범위가 좁아지므로 ±50도만 그린다.
      const perDegree = 5.0;
      const base = Math.round(azimuth / 10) * 10;
      ctx.textAlign = 'center';
      for (let offset = -50; offset <= 50; offset += 10) {
        const degrees = base + offset;
        const x = centre + (degrees - azimuth) * perDegree;
        if (x < 36 || x > WIDE.width - 36) continue;
        const major = ((degrees % 30) + 30) % 30 === 0;
        ctx.fillStyle = major ? '#c3d3dc' : '#6f8794';
        ctx.fillRect(x - 1, 24, 2, major ? 15 : 9);
        if (!major) continue;
        ctx.font = '700 17px monospace';
        ctx.fillText(compass(degrees), x, 60);
      }
    }
    // 가운데 눈금이 지금 포신이 보는 쪽이다. 현재 방위 숫자를 그 위 상자에 넣어 읽게 한다.
    ctx.fillStyle = '#0a1319';
    ctx.fillRect(centre - 44, 68, 88, 28);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(centre - 44, 68, 88, 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '700 22px monospace';
    ctx.fillText(finite(azimuth) ? compass(azimuth) : EMPTY, centre, 90);
    ctx.fillRect(centre - 2, 16, 4, 20);

    readout(ctx, 'AZ DEG', read.azimuth, 26, 118, 44);
    readout(ctx, 'EL DEG', read.elevation, 200, 118, 44);
    readout(ctx, 'RNG M', read.range, 374, 118, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#93aab7';
    ctx.font = '700 22px monospace';
    ctx.fillText('HULL', 26, 224);
    bar(ctx, 104, 208, 382, 16, Number(read.hull) / 100, accent);
  },

  /** 폭격기 폭탄창 화면이다. 왼쪽 도식은 스물네 칸 중 남은 폭탄만 채운다.
   * 남은 수를 모르면 빈 칸만 그린다. 가득 찬 것처럼 보이면 안 된다. */
  bay(ctx, read, accent) {
    ctx.strokeStyle = '#2a3a46';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 42, 200, 158);

    const loaded = Number(read.bomb);
    for (let slot = 0; slot < 24; slot++) {
      const x = 58 + (slot % 4) * 44;
      const y = 56 + Math.floor(slot / 4) * 24;
      if (finite(loaded) && slot < loaded) {
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, 30, 14);
      } else {
        ctx.strokeStyle = '#26333d';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, 29, 13);
      }
    }

    // 문 두 짝이다. 열리면 바깥으로 벌어져 도식 밖으로 나간다.
    const open = read.bay === 'OPEN';
    ctx.fillStyle = '#1d2730';
    ctx.fillRect(open ? 14 : 40, open ? 208 : 204, open ? 82 : 100, 10);
    ctx.fillRect(open ? 158 : 140, open ? 208 : 204, open ? 82 : 100, 10);

    readout(ctx, 'BOMB', read.bomb, 292, 48, 54);
    readout(ctx, 'BAY', read.bay, 292, 152, 34);
    readout(ctx, 'RNG M', read.range, 412, 152, 34);
    ctx.fillStyle = accent;
  },
};

/** 계기 화면 한 장을 그린다. mode 가 배치를, status 가 숫자를 정한다.
 * accent 는 기종별 계기 색이고 title 은 MFD 페이지 이름이다.
 * 없는 mode 는 아무것도 그리지 않는다. */
export function drawInstrument(ctx, mode, status = {}, accent = '#83eda0', title = '') {
  const layout = LAYOUTS[mode];
  if (!layout) return;
  const read = instrumentReadings(status);
  const size = displaySize(mode);
  background(ctx, size.width, size.height);
  ctx.accentColour = accent;
  ctx.textBaseline = 'alphabetic';
  layout(ctx, read, accent, { title, status: status || {} });
}

/** 전투기 HUD 한 장이다. telemetry 는 물리 상태 그대로라 속도는 m/s, 각은 라디안이다.
 * 단위 변환을 여기 한 곳에서만 한다. status 는 0.15초마다 오는 잔탄과 탄착 거리다. */
export function drawFlightHud(ctx, telemetry = {}, status = {}, weapons = 'stores', plane = 'fighter') {
  const size = HUD.size, centre = size / 2;
  const pose = telemetry || {};
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = HUD_INK;
  ctx.fillStyle = HUD_INK;
  ctx.lineWidth = 2;
  ctx.textBaseline = 'middle';

  // 피치 사다리와 수평선이다. 화면 밖으로 나간 눈금은 그리지 않는다.
  for (const mark of hudLadder(pose.pitch, pose.roll)) {
    if (!Number.isFinite(mark.left.y) || (mark.left.y < -40 && mark.right.y < -40)) continue;
    if (mark.left.y > size + 40 && mark.right.y > size + 40) continue;
    ctx.beginPath();
    ctx.moveTo(mark.left.x, mark.left.y);
    ctx.lineTo(mark.right.x, mark.right.y);
    ctx.stroke();
    if (mark.degrees !== 0) {
      ctx.textAlign = 'right';
      ctx.font = '18px monospace';
      ctx.fillText(String(mark.degrees), mark.left.x - 8, mark.left.y);
    }
  }

  // guns HUD 는 기체 중심 기호를 현재 거리의 탄도와 시차에 맞춰 옮긴다. 포구가 눈보다
  // 낮고 탄이 비행 중 낙하하므로, 고정된 기수 표식은 실제 탄도보다 위에 남는다.
  const gun = weapons === 'guns' ? gunOf(plane) : null;
  const mounts = weapons === 'guns' ? armamentOf(plane) : null;
  const mount = mounts?.cannon?.[0];
  const [, eyeY, eyeZ] = eyePoint(plane) || [0, 0, 0];
  const range = Number(status.range);
  const aimRange = Number.isFinite(range) && range > 0 ? range : 0;
  const projectileSpeed = Math.max(1, Number(pose.speed) || 0) + (gun?.speed || 0);
  const flight = gun && aimRange > 0 ? aimRange / projectileSpeed : 0;
  const [, aimY, aimZ] = mount && mounts ? muzzleAim(mount, mounts.converge) : [0, 0, -1];
  const shotY = mount && aimRange > 0
    ? mount[1] + aimY * aimRange - 0.5 * (gun?.gravity || 0) * flight * flight
    : eyeY;
  const shotZ = mount && aimRange > 0 ? mount[2] + aimZ * aimRange : eyeZ - 1;
  // combiner 유리는 눈에서 0.46m, 높이 0.18m다. 월드 각도를 유리 위 픽셀로 옮긴다.
  const aimAngle = gun && aimRange > 0 ? Math.atan2(shotY - eyeY, eyeZ - shotZ) : 0;
  const aimPixel = centre - aimAngle * (0.46 / 0.18) * size;
  ctx.beginPath();
  ctx.moveTo(centre - 46, aimPixel); ctx.lineTo(centre - 16, aimPixel);
  ctx.moveTo(centre + 16, aimPixel); ctx.lineTo(centre + 46, aimPixel);
  ctx.moveTo(centre, aimPixel - 10); ctx.lineTo(centre, aimPixel + 10);
  ctx.stroke();

  const speed = Number.isFinite(Number(pose.speed)) ? Math.round(Number(pose.speed) * 3.6) : null;
  const altitude = Number.isFinite(Number(pose.y)) ? Math.max(0, Math.round(Number(pose.y) - FLIGHT_GROUND)) : null;
  const heading = Number.isFinite(Number(pose.heading)) ? -Number(pose.heading) * DEG : null;
  const read = instrumentReadings({
    speed, altitude, heading, climb: pose.climb, throttle: pose.throttle,
    cannonAmmo: status.cannonAmmo, missileAmmo: status.missileAmmo, range: status.range,
  });

  ctx.font = '34px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(read.speed, centre - 120, centre);
  ctx.textAlign = 'left';
  ctx.fillText(read.altitude, centre + 120, centre);
  ctx.font = '18px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('KM/H', centre - 120, centre + 28);
  ctx.textAlign = 'left';
  ctx.fillText('M', centre + 120, centre + 28);

  // 방위 테이프다. 가운데 눈금이 현재 기수다.
  ctx.textAlign = 'center';
  ctx.font = '30px monospace';
  ctx.fillText(read.heading, centre, 54);
  ctx.beginPath();
  ctx.moveTo(centre - 150, 76); ctx.lineTo(centre + 150, 76);
  ctx.moveTo(centre, 76); ctx.lineTo(centre, 88);
  ctx.stroke();

  // 아래 줄은 상승률, 스로틀, 무장, 탄착 거리다. 없는 값은 EMPTY 로 남는다.
  ctx.font = '22px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`V/S ${read.climb}`, 40, size - 96);
  ctx.fillText(`THR ${read.throttle}`, 40, size - 62);
  ctx.fillText(`GUN ${read.gun}`, 40, size - 28);
  ctx.textAlign = 'right';
  if (weapons === 'guns') ctx.fillText(`HULL ${read.hull}`, size - 40, size - 62);
  else ctx.fillText(`MSL ${read.missile}`, size - 40, size - 62);
  ctx.fillText(`RNG ${read.range}`, size - 40, size - 28);
}

/** HUD 는 한 색이다. 실제 combiner 처럼 녹색 한 가지로만 그린다. */
const HUD_INK = '#8cf7a6';
