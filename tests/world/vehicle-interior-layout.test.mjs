import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKE_CLUSTER, GUNNER_CONSOLES, ROAD_CABINS, groundGaugeRig } from '../../src/world/cockpits/vehicleInteriorLayout.js';
import { aircraftGaugeRig } from '../../src/world/cockpits/aircraftDetail.js';
import { FOV_MARGIN, gaugeFaults, gaugeSpan } from '../../src/world/cockpits/gaugeClearance.js';
import { NEAR_COCKPIT, cockpitFov, eyePoint } from '../../src/world/eyePoints.js';
import { GROUND_GUNS } from '../../src/world/groundWeapons.js';
import { VEHICLE_SHAPES } from '../../src/world/models/carGeometry.js';

const COMBAT_KEYS = ['tank', 'howitzer', 'armored', 'aa'];
/** 눈에서 본 내림각이다(road cabin 절의 drop 과 같은 식). 세로 화각의 절반과 비교한다. */
const gunnerDrop = (dy, dz) => Math.atan2(Math.abs(dy), Math.abs(dz)) * 180 / Math.PI;

const ROAD_KEYS = ['sedan', 'suv', 'convertible', 'truck'];
const PLANE_KEYS = ['jet', 'bomber', 'prop', 'fighter', 'interceptor', 'helicopter'];

/** 눈에서 본 내림각이다. 조각의 반높이까지 더해 가장자리가 화면 밖으로 나가는지 본다. */
const drop = (dy, dz, half = 0) => Math.atan2(Math.abs(dy) + half, Math.abs(dz)) * 180 / Math.PI;

test('road cabins keep their own trim, vents, and switch bank', () => {
  for (const key of ROAD_KEYS) {
    const cabin = ROAD_CABINS[key];
    assert.ok(cabin, `${key} cabin layout`);
    assert.equal(cabin.vents.length, 2, `${key} has two readable dash vents`);
    assert.ok(cabin.switches.length >= 3, `${key} has a physical switch bank`);
    // 벤트와 공조 노브는 대시 앞면과 센터 스택 위에 있어야 한다. 눈보다 아래, 앞유리보다 뒤다.
    for (const control of [...cabin.vents, ...cabin.switches, cabin.hazard]) {
      assert.ok(control[1] < 0, `${key} 조작부가 눈높이 위에 있다`);
      assert.ok(control[2] > cabin.dashZ && control[2] < -NEAR_COCKPIT,
        `${key} 조작부 z ${control[2]} 가 대시 구간 밖이다`);
    }
  }
  assert.notDeepEqual(ROAD_CABINS.sedan.vents, ROAD_CABINS.truck.vents,
    'truck does not inherit the sedan vent arrangement');
});

test('세단 페달은 뒤로 이동한 카울의 실내 쪽에 남는다', () => {
  const cowlZ = VEHICLE_SHAPES.sedan.windshield[0][2];
  const pedalZ = eyePoint('sedan')[2] + ROAD_CABINS.sedan.pedals[2];
  assert.ok(pedalZ >= cowlZ + 0.1,
    `pedal z ${pedalZ} must stay at least 10 cm behind cowl ${cowlZ}`);
});

test('세단 디지털 화면 면은 대시 꺾임의 가장 앞쪽보다 운전자 쪽에 있다', () => {
  const cabin = ROAD_CABINS.sedan;
  const dashFront = cabin.dashBreakZ + 0.025;
  for (const screen of cabin.screens) {
    const screenFace = screen.z + cabin.screenOffset + 0.008;
    assert.ok(screenFace > dashFront + 0.01,
      `${screen.id} face ${screenFace} is not clear of dash front ${dashFront}`);
  }
});

test('대시와 문 안쪽 판이 캐빈 폭 안에 든다', () => {
  for (const key of ROAD_KEYS) {
    const cabin = ROAD_CABINS[key];
    assert.ok(cabin.dashWidth < cabin.innerWidth,
      `${key} 대시 폭 ${cabin.dashWidth} 가 캐빈 안쪽 폭 ${cabin.innerWidth} 를 넘는다`);
    assert.ok(cabin.pillarX * 2 <= cabin.innerWidth,
      `${key} A 필러가 문 안쪽 판보다 바깥에 있다`);
    // 계기 묶음 전체도 캐빈 폭 안이다. 계기는 눈 기준이라 운전석 x 를 더해 비교한다.
    const edge = Math.max(...cabin.dials.map((dial) => Math.abs(dial[0]))) + cabin.dialRadius;
    assert.ok(edge * 2 < cabin.innerWidth, `${key} 계기 묶음이 캐빈 폭을 넘는다`);
  }
});

test('계기와 계기 화면이 세로 화각 안에 다 들어온다', () => {
  for (const key of ROAD_KEYS) {
    const cabin = ROAD_CABINS[key];
    const half = cockpitFov(key) / 2;
    for (const [, dy, dz] of cabin.dials) {
      assert.ok(drop(dy, dz, cabin.dialRadius) < half,
        `${key} 계기 아랫변이 화각 ${half} 도 밖이다`);
    }
    const [, dy, dz, , height] = cabin.display;
    assert.ok(drop(dy, dz, height / 2) < half, `${key} 계기 화면 아랫변이 화각 밖이다`);
    // 후드 입술은 눈에서 계기 윗모서리로 가는 시선보다 위에 있어야 계기를 가리지 않는다.
    const top = cabin.dials[0];
    const sight = (Math.abs(top[1]) - cabin.dialRadius) / Math.abs(top[2]);
    assert.ok(Math.abs(cabin.hoodY) < Math.abs(cabin.hoodZ) * sight,
      `${key} 계기 후드가 계기 윗부분을 가린다`);
  }
});

test('계기가 근접면보다 멀고 팔 닿는 거리 안에 있다', () => {
  for (const key of ROAD_KEYS) {
    const cabin = ROAD_CABINS[key];
    for (const [, , dz] of cabin.dials) {
      assert.ok(Math.abs(dz) > NEAR_COCKPIT, `${key} 계기가 근접면 ${NEAR_COCKPIT} 안쪽이라 잘린다`);
      assert.ok(Math.abs(dz) < 0.95, `${key} 계기가 ${Math.abs(dz)} 로 너무 멀다`);
    }
    // 스티어링은 계기보다 눈에 가깝고, 그래도 근접면보다는 멀다.
    assert.ok(Math.abs(cabin.wheel.z) < Math.abs(cabin.dials[0][2]), `${key} 스티어링이 계기보다 멀다`);
    assert.ok(Math.abs(cabin.wheel.z) - cabin.wheel.radius > NEAR_COCKPIT,
      `${key} 스티어링 림이 근접면에 닿는다`);
  }
});

test('지붕이 눈 위로 머리 공간을 남기고 오픈카만 지붕이 없다', () => {
  for (const key of ROAD_KEYS) {
    const { roofY, floorY } = ROAD_CABINS[key];
    if (roofY === null) {
      assert.equal(key, 'convertible', `${key} 는 지붕이 있어야 한다`);
    } else {
      assert.ok(roofY >= 0.1, `${key} 지붕이 눈 위 ${roofY} 라 머리에 닿는다`);
    }
    assert.ok(floorY < -0.4, `${key} 바닥이 눈에서 ${floorY} 라 너무 높다`);
  }
});

test('네 차가 서로 다른 비율을 가진다', () => {
  const widths = ROAD_KEYS.map((key) => ROAD_CABINS[key].innerWidth);
  assert.equal(new Set(widths).size, ROAD_KEYS.length, '캐빈 폭이 겹치는 차가 있다');
  // 트럭이 가장 넓고 높으며, 오픈카는 지붕이 없고 바닥이 가장 얕다.
  assert.ok(ROAD_CABINS.truck.innerWidth > ROAD_CABINS.suv.innerWidth);
  assert.ok(ROAD_CABINS.suv.innerWidth > ROAD_CABINS.sedan.innerWidth);
  assert.ok(ROAD_CABINS.truck.floorY < ROAD_CABINS.sedan.floorY);
  assert.ok(ROAD_CABINS.convertible.floorY > ROAD_CABINS.sedan.floorY);
  assert.equal(ROAD_CABINS.truck.dials.length, 3, '트럭은 나침반까지 계기가 셋이다');
  assert.equal(ROAD_CABINS.convertible.seats, null, '오픈카 좌석은 외장이 그린다');
  assert.equal(ROAD_CABINS.convertible.sideGlass, null, '지붕을 접었으므로 옆유리가 없다');
});

test('앞유리 헤더가 눈 위 18도 이상에서 시야를 연다', () => {
  // 차종별 헤더 깊이만큼 눈 쪽으로 들어온 아래 모서리가 아가리 위끝이다.
  for (const key of ROAD_KEYS) {
    const cabin = ROAD_CABINS[key];
    const headerIn = cabin.headerDepth ?? 0.10;
    const [, gy, gz, , height] = cabin.glass;
    const half = height / 2, angle = cabin.glassAngle;
    const topY = gy + half * Math.cos(angle), topZ = gz + half * Math.sin(angle);
    const lipY = topY - headerIn * Math.sin(angle), lipZ = topZ + headerIn * Math.cos(angle);
    const up = Math.atan2(lipY, Math.abs(lipZ)) * 180 / Math.PI;
    // 캡오버 트럭만 앞유리가 눈에서 1.5 앞이라 같은 지붕 높이에서 각이 작다.
    const floor = key === 'truck' ? 17 : 18;
    assert.ok(up >= floor, `${key} 헤더가 눈 위 ${up.toFixed(1)} 도라 시야를 막는다`);
    assert.ok(up < cockpitFov(key) / 2, `${key} 헤더가 화각 밖이라 틀이 보이지 않는다`);
    // 지붕이 있으면 헤더 아랫모서리가 헤드라이너 높이와 같아야 천장과 틀이 이어진다.
    if (cabin.roofY !== null) assert.ok(Math.abs(lipY - cabin.roofY) < 0.01, `${key} 헤더와 천장이 어긋난다`);
  }
});

test('세단 계기 검사는 실제 두 디지털 화면을 사용하고 낡은 원형 계기를 쓰지 않는다', () => {
  assert.equal(ROAD_CABINS.sedan.screens[0].mode, 'executiveCluster');
  assert.equal(ROAD_CABINS.sedan.screens[1].mode, 'roadnav');
  assert.equal(ROAD_CABINS.suv.centerScreen.mode, 'roadnav');
  const rig = groundGaugeRig('sedan');
  assert.deepEqual(rig.gauges.map(gauge => gauge.id), ['sedan-driver', 'sedan-center']);
  for (const gauge of rig.gauges) {
    assert.equal(gauge.radius, undefined, `${gauge.id} 가 원형 계기로 남아 있다`);
    assert.ok(gauge.halfWidth > 0.2 && gauge.halfHeight > 0.08, `${gauge.id} 화면 사각형이 잘못됐다`);
  }
  assert.deepEqual(gaugeFaults(rig), []);
});

test('전투 차량 pivot 이 GROUND_GUNS.turret 과 같다', () => {
  // CarMode 가 basket group 을 이 값으로 둔다. GUNNER_CONSOLES 가 다른 값을 쓰면 실내가
  // 포탑 회전축과 다른 자리에서 돌아 포신과 어긋난다.
  for (const key of COMBAT_KEYS) {
    assert.deepEqual(GUNNER_CONSOLES[key].pivot, GROUND_GUNS[key].turret, `${key} pivot 이 GROUND_GUNS 와 다르다`);
    assert.deepEqual(
      GUNNER_CONSOLES[key].eyeInBasket,
      eyePoint(key).map((value, index) => value - GROUND_GUNS[key].turret[index]),
      `${key} eyeInBasket 이 눈 - pivot 이 아니다`,
    );
  }
});

test('전투 차량 계기와 계기 화면이 세로 화각 안에 다 들어온다', () => {
  for (const key of COMBAT_KEYS) {
    const console = GUNNER_CONSOLES[key];
    const half = cockpitFov(key) / 2;
    for (const [, dy, dz] of console.dials) {
      assert.ok(gunnerDrop(dy, dz) < half, `${key} 계기가 화각 ${half} 도 밖이다`);
    }
    for (const entry of [console.display, console.display2, console.elevationDial]) {
      if (!entry) continue;
      assert.ok(gunnerDrop(entry[1], entry[2]) < half, `${key} 화면이나 앙각 계기가 화각 밖이다`);
    }
  }
});

test('조준경 접안이 근접면보다 멀고 0.45 보다 가깝다', () => {
  // GunnerSight/ReflectorSight 는 GUNNER_CONSOLES[key].sight.distance 만큼 눈 앞에 둔다.
  // aa 는 round 1 에서 정확히 0.45(눈 앞 0.45 의 반사식 링) 로 정해져 <= 로 본다. 큐폴라로
  // 바뀐 armored 는 직사 조준경이 없어 sight 가 없다.
  for (const key of ['tank', 'howitzer', 'aa']) {
    const { sight } = GUNNER_CONSOLES[key];
    assert.ok(sight.distance > NEAR_COCKPIT, `${key} 조준경이 근접면 안쪽이다`);
    assert.ok(sight.distance <= 0.45, `${key} 조준경이 ${sight.distance} 로 너무 멀다`);
  }
});

test('접안 틀 안쪽 반각이 화각 반각의 0.5 이상이다', () => {
  // GunnerSight 의 OpticFrame(아이컵, 대물) 개구부다. 반각이 화각 반각의 절반보다 좁으면
  // 틀 자체가 중앙 시야를 가린다(전차 조준경 하우징이 화각 26도 폭을 막던 사고 재발 방지).
  // aa 의 반사식 링은 열린 바스켓(SkyWindow) 안의 작은 조준 보조물이라 이 비율로 재지 않는다.
  for (const key of ['tank', 'howitzer']) {
    const { sight } = GUNNER_CONSOLES[key];
    const half = cockpitFov(key) / 2;
    const openAngle = Math.atan2(sight.halfWidth, sight.distance) * 180 / Math.PI;
    assert.ok(openAngle >= half * 0.5, `${key} 접안 반각 ${openAngle} 이 화각 반각의 절반보다 좁다`);
  }
});

test('포탑 지붕 안쪽 판이 눈 위 0.1 이상이다', () => {
  for (const key of COMBAT_KEYS) {
    assert.ok(GUNNER_CONSOLES[key].roofY >= 0.1, `${key} 지붕이 눈 위 ${GUNNER_CONSOLES[key].roofY} 라 머리에 닿는다`);
  }
});

test('장갑차는 무인 포탑 축이 아니라 큐폴라 콘솔 데이터를 갖는다', () => {
  // round 1 에서 무인 포탑 바스켓을 버리고 운전석 위 큐폴라로 바꿨다. periscopes 대신
  // cupolaRadius, 사격 통제 화면, 방위 다이얼 하나를 갖는다.
  const desk = GUNNER_CONSOLES.armored;
  assert.ok(desk.cupolaRadius > 0.15 && desk.cupolaRadius < 0.4, `큐폴라 반지름 ${desk.cupolaRadius} 이 비현실적이다`);
  assert.equal(desk.periscopes, undefined, '무인 포탑 페리스코프 데이터가 남아 있다');
  assert.equal(desk.dials.length, 1, '큐폴라 계기는 방위 다이얼 하나다');
});

/** GUNNER_CONSOLES[key].walls(AABB 목록) 의 바깥 경계다. ArmorInteriors.jsx 의 wallsBounds
 * 와 같은 식이다. */
function wallsBounds(walls) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const wall of walls) {
    xMin = Math.min(xMin, wall.x[0]); xMax = Math.max(xMax, wall.x[1]);
    yMin = Math.min(yMin, wall.y[0]); yMax = Math.max(yMax, wall.y[1]);
    zMin = Math.min(zMin, wall.z[0]); zMax = Math.max(zMax, wall.z[1]);
  }
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}

/** 광선 하나가 AABB 하나와 [0, maxDist] 안에서 만나는지 본다(표준 slab 판정). ray, box 는
 * {x,y,z} 형태다. */
function rayHitsBox(origin, dir, box, maxDist) {
  let tmin = 0, tmax = maxDist;
  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis], d = dir[axis], [lo, hi] = box[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return false;
      continue;
    }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** 눈에서 -z 로 ±12도 원뿔 안의 표본 광선 9개다(중심, 상하좌우, 대각). tan(12도) 를 그대로
 * 수평/수직 성분에 곱해 방향을 만든다(정확한 12도 원뿔은 아니지만 상하좌우와 네 대각을
 * 골고루 표본으로 삼는 것이 목적이다). */
const CONE_SAMPLES = [[0, 0], [0, 1], [0, -1], [-1, 0], [1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function coneRays(eye) {
  const tan12 = Math.tan(12 * Math.PI / 180);
  return CONE_SAMPLES.map(([dx, dy]) => ({
    origin: { x: eye[0], y: eye[1], z: eye[2] },
    dir: { x: dx * tan12, y: dy * tan12, z: -1 },
  }));
}

test('바스켓 벽이 있는 전투 차량 셋은 눈이 벽 안에 있고 중앙 ±12도 원뿔이 3m 안에서 벽에 막히지 않는다', () => {
  // GUNNER_CONSOLES 의 walls(AABB 목록) 를 직접 광선과 부딪혀 본다. armored 는 슬릿이 유리라
  // walls 목록이 없다(불투명 벽 자체가 없다).
  for (const key of ['tank', 'howitzer', 'aa']) {
    const { walls, eyeInBasket } = GUNNER_CONSOLES[key];
    const { xMin, xMax, zMin, zMax } = wallsBounds(walls);
    assert.ok(eyeInBasket[0] > xMin && eyeInBasket[0] < xMax, `${key} 눈이 벽 x 범위 밖이다`);
    assert.ok(eyeInBasket[2] > zMin && eyeInBasket[2] < zMax, `${key} 눈이 벽 z 범위 밖이다`);
    for (const ray of coneRays(eyeInBasket)) {
      for (const wall of walls) {
        assert.equal(rayHitsBox(ray.origin, ray.dir, wall, 3), false,
          `${key} 중앙 ±12도 원뿔 광선(${ray.dir.x.toFixed(2)}, ${ray.dir.y.toFixed(2)}) 이 3m 안에서 벽에 막힌다`);
      }
    }
  }
});

/** 15종 전부다. 계기가 화면 안에 온전히 보이는지 한 자리에서 검사한다. */
const ALL_KEYS = [...ROAD_KEYS, 'formula', 'motorcycle', ...COMBAT_KEYS, ...PLANE_KEYS];
const rigOf = (key) => groundGaugeRig(key) || aircraftGaugeRig(key);

test('탈것 16종의 계기가 모두 세로 화각 안에 들어오고 가림 조각에 먹히지 않는다', () => {
  // 화각 절반에서 3도, 가림 조각에서 1도를 남긴다. 계기 지름을 키우면 이 검사가 먼저 깨지므로
  // WP13 에서 계기를 키웠다가 아래가 잘린 일이 다시 나지 않는다.
  assert.equal(ALL_KEYS.length, 16, '탈것이 16종이 아니다');
  for (const key of ALL_KEYS) {
    const rig = rigOf(key);
    assert.ok(rig, `${key} 계기 배치 데이터가 없다`);
    assert.ok(rig.gauges.length > 0, `${key} 계기 목록이 비었다`);
    const faults = gaugeFaults(rig);
    assert.deepEqual(faults, [], `${key} 계기가 잘린다: ${JSON.stringify(faults)}`);
  }
});

test('계기 아랫변이 화각 절반에서 3도 이상 안쪽이다', () => {
  for (const key of ALL_KEYS) {
    const rig = rigOf(key);
    const limit = rig.fovHalf - FOV_MARGIN;
    for (const gauge of rig.gauges) {
      const span = gaugeSpan(gauge);
      assert.ok(span.bottom >= -limit,
        `${key} ${span.id} 아랫변 ${span.bottom.toFixed(1)}도가 한계 ${(-limit).toFixed(1)}도 밖이다`);
    }
  }
});

test('가림 조각 목록이 후드, 림, 대시, 핸들바, 바스켓 벽을 실제로 담는다', () => {
  // 목록이 비면 위 검사가 화각만 보고 통과한다. 차종마다 무엇을 검사해야 하는지 못박는다.
  const expected = {
    sedan: ['rim', 'dash'], suv: ['rim', 'dash'],
    convertible: ['hood', 'rim', 'dash'], truck: ['hood', 'rim', 'dash'],
    formula: ['hood', 'rim', 'dash'],
    motorcycle: ['bar'],
    tank: ['wallL', 'wallR', 'front'], howitzer: ['wallL', 'wallR', 'front'], aa: ['wallR'],
    bomber: ['deck', 'yoke'], prop: ['deck', 'sight'], jet: ['deck'],
    fighter: ['deck', 'combiner'], interceptor: ['sight', 'combiner'],
  };
  for (const [key, ids] of Object.entries(expected)) {
    const have = new Set(rigOf(key).occluders.map((blocker) => blocker.id));
    for (const id of ids) assert.ok(have.has(id), `${key} 가림 목록에 ${id} 가 없다`);
  }
  // 큐폴라(장갑차) 와 헬기는 눈앞을 막는 조각이 없다. 빈 목록이 맞다.
  assert.deepEqual(groundGaugeRig('armored').occluders, [], '장갑차 큐폴라에는 가림 조각이 없다');
  assert.deepEqual(aircraftGaugeRig('helicopter').occluders, [], '헬기 코에는 덮개가 없다');
});

test('포뮬러 계기와 휠은 낮은 콕핏 안에서 서로 겹치지 않는다', () => {
  const spec = ROAD_CABINS.formula;
  assert.ok(spec, '포뮬러 실내 배치가 없다');
  assert.equal(spec.dials.length, 2);
  assert.ok(Math.abs(spec.wheel.z) > NEAR_COCKPIT);
  assert.ok(Math.abs(spec.display[2]) > NEAR_COCKPIT);
  assert.ok(spec.halo.openHalfWidth >= 0.16 && spec.halo.postX === 0, '헤일로 중앙 개구부가 너무 좁다');
  assert.deepEqual(gaugeFaults(groundGaugeRig('formula')), []);
});

test('오픈카 대시는 얇은 후드와 뒤로 물린 계기 나셀로 이어진다', () => {
  const spec = ROAD_CABINS.convertible;
  assert.ok(spec.hoodThickness <= 0.02, `후드 두께 ${spec.hoodThickness}`);
  assert.ok(Math.hypot(...spec.hoodLead) < 0.14, '후드가 눈앞의 큰 떠 있는 판처럼 길다');
  assert.ok(spec.binnacle.z < spec.dials[0][2], '나셀이 계기 앞을 가린다');
  const binnacleTop = spec.binnacle.y + spec.binnacle.height / 2;
  assert.ok(Math.abs(spec.hoodY - binnacleTop) <= 0.04, '후드와 계기 나셀 사이가 떠 있다');
  assert.deepEqual(gaugeFaults(groundGaugeRig('convertible')), []);
});

test('계기를 키우면 잘림 검사가 실제로 걸린다', () => {
  // 위 검사가 늘 통과하는 빈 검사가 아님을 보인다. 지름을 세 배로 늘리면 아래가 잘려야 한다.
  for (const key of ['sedan', 'tank', 'helicopter']) {
    const rig = rigOf(key);
    const swollen = {
      ...rig,
      gauges: rig.gauges.map((gauge) => ({
        ...gauge,
        radius: gauge.radius === undefined ? undefined : gauge.radius * 3,
        halfHeight: gauge.halfHeight === undefined ? undefined : gauge.halfHeight * 3,
      })),
    };
    assert.ok(gaugeFaults(swollen).length > 0, `${key} 계기를 키워도 검사가 잡지 못한다`);
  }
});

test('대공포 왼쪽 벽이 관측창이라 계기를 가리지 않는다', () => {
  // 불투명 판이면 눈 옆 30도에 선 흰 벽 한 장이 화면 3분의 1을 민무늬로 덮는다.
  const left = GUNNER_CONSOLES.aa.walls.find((wall) => wall.x[1] < 0);
  assert.ok(left?.glass, '대공포 왼쪽 벽이 아직 불투명하다');
  assert.equal(GUNNER_CONSOLES.aa.walls.filter((wall) => wall.glass).length, 1, '유리로 바꾼 벽은 왼쪽 하나다');
});

test('오토바이 계기가 핸들바보다 크고 나셀 안에 든다', () => {
  const bike = BIKE_CLUSTER;
  // WP13 이 다른 차 계기를 키우는 동안 오토바이만 0.058 로 남아 화면에서 가장 작았다.
  assert.ok(bike.speed.radius >= 0.075, `속도계 반지름 ${bike.speed.radius} 가 아직 작다`);
  assert.ok(bike.rpm.radius < bike.speed.radius, '회전계는 속도계보다 작다');
  const span = Math.abs(bike.speed.x) + bike.speed.radius + Math.abs(bike.rpm.x) + bike.rpm.radius;
  assert.ok(span <= bike.nacelle[0], `계기 묶음 ${span.toFixed(3)} 이 나셀 폭 ${bike.nacelle[0]} 을 넘는다`);
  assert.ok(bike.speed.radius * 2 <= bike.nacelle[1], '계기가 나셀 높이를 넘는다');
});
