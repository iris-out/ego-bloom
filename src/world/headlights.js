/** 전조등이다. H 를 누를 때마다 꺼짐, 하향등, 상향등, 둘 다를 차례로 돈다.
 *
 * 광원을 늘리지 않으려고 스폿 하나로 세 가지 빛을 모두 낸다. 광원 개수는 three 의
 * 셰이더 프로그램 캐시 키라서 상향등용 스폿을 따로 달면 켜는 순간 도시 재질이 통째로
 * 다시 컴파일된다. 대신 각도, 사거리, 세기, 겨누는 자리를 상태마다 바꾼다.
 *
 * three 도 React 도 모르는 순수 모듈이다. CarMode 와 RideHud 가 같이 읽는다.
 */

/** H 가 도는 차례다. 배열 순서가 곧 동작 순서다. */
export const BEAMS = Object.freeze(['off', 'low', 'high', 'both']);

const freezePoints = points => Object.freeze(points.map(point => Object.freeze(point)));
const SEDAN_HOUSING_Z = 2.534;
const SEDAN_ROW_Z = 2.537;
const rearRow = (side, centerY, innerTop, innerBottom) => {
  const halfHeight = 0.008;
  return Object.freeze({
    side, centerY,
    rear: freezePoints([
      [side * innerTop, centerY + halfHeight], [side * 0.97, centerY + halfHeight],
      [side * 0.97, centerY - halfHeight], [side * innerBottom, centerY - halfHeight],
    ]),
    wrap: freezePoints([
      [side * 0.97, centerY + halfHeight, SEDAN_ROW_Z], [side * 1.00, centerY + halfHeight, 2.29],
      [side * 1.00, centerY - halfHeight, 2.29], [side * 0.97, centerY - halfHeight, SEDAN_ROW_Z],
    ]),
  });
};

const rearHousing = side => Object.freeze({
  side,
  rear: freezePoints([
    [side * 0.34, 0.035], [side * 0.44, 0.115], [side * 0.94, 0.13],
    [side * 0.97, -0.045], [side * 0.43, -0.055],
  ]),
  wrap: freezePoints([
    [side * 0.94, 0.13, SEDAN_HOUSING_Z], [side * 1.00, 0.11, 2.29],
    [side * 1.00, -0.06, 2.29], [side * 0.97, -0.045, SEDAN_HOUSING_Z],
  ]),
});

/** 세단 정적 렌즈와 CarMode 동적 발광층이 함께 쓰는 후면 등화 좌표다. */
export const SEDAN_REAR_LIGHTS = Object.freeze({
  housingZ: SEDAN_HOUSING_Z,
  rowZ: SEDAN_ROW_Z,
  housing: Object.freeze([-1, 1].map(rearHousing)),
  rows: Object.freeze([-1, 1].flatMap(side => [
    rearRow(side, 0.092, 0.46, 0.43),
    rearRow(side, 0.040, 0.39, 0.37),
    rearRow(side, -0.012, 0.45, 0.42),
  ])),
  reverse: Object.freeze([-1, 1].map(side => Object.freeze({
    side,
    position: Object.freeze([side * 0.32, -0.015, 2.548]),
    scale: Object.freeze([0.075, 0.025, 0.012]),
  }))),
});

const frontPart = (side, x, y, width, height, kind) => Object.freeze({
  side, kind,
  position: Object.freeze([side * x, y, -2.552]),
  scale: Object.freeze([width, height, 0.008]),
});

/** 세단 정적 헤드램프와 CarMode 발광층이 함께 쓰는 독립 좌우 램프 좌표다. */
export const SEDAN_FRONT_LIGHTS = Object.freeze({
  housings: Object.freeze([-1, 1].map(side => Object.freeze({
    side,
    rear: freezePoints([
      [side * 0.56, 0.04], [side * 0.62, 0.15], [side * 0.98, 0.14],
      [side * 0.96, 0.02], [side * 0.76, -0.005], [side * 0.60, 0.015],
    ]),
  }))),
  projectors: Object.freeze([-1, 1].flatMap(side => [0.68, 0.86].map(x => Object.freeze({
    side,
    position: Object.freeze([side * x, 0.09, -2.553]),
    radius: 0.027,
  })))),
  drlSegments: Object.freeze([-1, 1].flatMap(side => [
    frontPart(side, 0.66, 0.090, 0.017, 0.086, 'vertical'),
    frontPart(side, 0.69, 0.047, 0.07, 0.016, 'horizontal'),
    frontPart(side, 0.85, 0.090, 0.017, 0.086, 'vertical'),
    frontPart(side, 0.88, 0.047, 0.07, 0.016, 'horizontal'),
  ])),
  accents: Object.freeze([-1, 1].map(side => frontPart(side, 0.77, 0.015, 0.18, 0.008, 'accent'))),
});

const SUV_FRONT_HOUSING_Z = -2.489;
const SUV_FRONT_ROW_Z = -2.500;
const SUV_FRONT_RUNTIME_Z = -2.508;
const suvFrontHousing = side => Object.freeze({
  side,
  rear: freezePoints([
    [side * 0.58, 0.20], [side * 0.64, 0.34], [side * 1.02, 0.35],
    [side * 1.04, 0.25], [side * 0.97, 0.17], [side * 0.72, 0.15],
  ]),
});
const suvFrontRow = (side, outer) => {
  const x=outer?.955:.79;
  return Object.freeze({side,rear:freezePoints([
    [side*(x-.012),.323],[side*(x+.012),.323],[side*(x-.006),.218],
    [side*(x-.045),.183],[side*(x-.14),.17],[side*(x-.14),.19],
    [side*(x-.06),.207],[side*(x-.025),.235],
  ])});
};

/** SUV 정적/동적 헤드램프가 공유하는 좌우 독립형 두 줄 좌표다. */
export const SUV_FRONT_LIGHTS = Object.freeze({
  housingZ: SUV_FRONT_HOUSING_Z,
  rowZ: SUV_FRONT_ROW_Z,
  runtimeRowZ: SUV_FRONT_RUNTIME_Z,
  housings: Object.freeze([-1, 1].map(suvFrontHousing)),
  rows: Object.freeze([-1, 1].flatMap(side => [suvFrontRow(side, true), suvFrontRow(side, false)])),
});

const SUV_REAR_HOUSING_Z = 2.478;
const SUV_REAR_ROW_Z = 2.486;
const SUV_REAR_RUNTIME_Z = 2.494;
const suvRearHousing = side => Object.freeze({
  side,
  rear: freezePoints([
    [side * 0.40, 0.20], [side * 0.43, 0.35], [side * 0.86, 0.36],
    [side * 0.98, 0.36], [side * 1.05, 0.33], [side * 1.03, 0.15],
    [side * 0.94, 0.17], [side * 0.82, 0.22],
  ]),
});
const suvRearRow = (side, centerY, hookY) => {
  const halfHeight = 0.009;
  return Object.freeze({
    side, centerY,
    rear: freezePoints([
      [side * 0.40, centerY + halfHeight], [side * 0.85, centerY + halfHeight],
      [side * 0.97, hookY + halfHeight], [side * 0.99, hookY - halfHeight],
      [side * 0.86, centerY - halfHeight], [side * 0.40, centerY - halfHeight],
    ]),
  });
};

/** SUV 정적 렌즈와 CarMode 브레이크/후진 발광층이 공유하는 후면 좌표다. */
export const SUV_REAR_LIGHTS = Object.freeze({
  housingZ: SUV_REAR_HOUSING_Z,
  rowZ: SUV_REAR_ROW_Z,
  runtimeRowZ: SUV_REAR_RUNTIME_Z,
  housings: Object.freeze([-1, 1].map(suvRearHousing)),
  rows: Object.freeze([-1, 1].flatMap(side => [
    suvRearRow(side, 0.31, 0.34),
    suvRearRow(side, 0.24, 0.19),
  ])),
  reverse: Object.freeze([-1, 1].map(side => Object.freeze({
    side,
    position: Object.freeze([side * 0.30, 0.17, 2.488]),
    scale: Object.freeze([0.075, 0.024, 0.010]),
  }))),
});

export function rearLampIntensity(braking, night) {
  return braking ? 3.4 : night ? 1.1 : 0.1;
}

export function reverseLampIntensity(reversing) {
  return reversing ? 2.8 : 0;
}

export const BEAM_KO = Object.freeze({
  off: '꺼짐', low: '하향등', high: '상향등', both: '하향 + 상향',
});

/** 빛의 모양이다. `reach` 와 `drop` 은 전조등 위치를 기준으로 겨누는 자리다.
 * 하향등은 가까운 노면을 넓게 내리비추고, 상향등은 멀리 좁게 곧게 나간다.
 * `lamp` 는 램프 상자의 발광 세기라 밖에서 보이는 밝기와 같이 간다.
 *
 * `decay` 를 1 로 둔다. three 의 기본값 2 는 역제곱이라 코앞만 타고 20m 만 나가도 꺼진다.
 * 1 이면 거리에 반비례해 먼 노면까지 빛이 남는다. 물리적으로 정확하지는 않지만
 * 밤 도로를 달릴 때 필요한 그림이다. */
export const BEAM_CONE = Object.freeze({
  off:  Object.freeze({ angle: 0.75, distance: 0,   intensity: 0,   decay: 1, penumbra: 0.45, reach: 26,  drop: 1.1,  lamp: 0.18 }),
  low:  Object.freeze({ angle: 0.75, distance: 130, intensity: 70,  decay: 1, penumbra: 0.45, reach: 26,  drop: 1.1,  lamp: 3.4 }),
  high: Object.freeze({ angle: 0.5,  distance: 340, intensity: 150, decay: 1, penumbra: 0.3,  reach: 115, drop: 0.26, lamp: 4.6 }),
  both: Object.freeze({ angle: 0.75, distance: 340, intensity: 200, decay: 1, penumbra: 0.4,  reach: 80,  drop: 0.5,  lamp: 5.4 }),
});

export function beamCone(beam) {
  return BEAM_CONE[beam] || BEAM_CONE.off;
}

export function isBeamOn(beam) {
  return beam !== 'off' && Object.hasOwn(BEAM_CONE, beam);
}

export function nextBeam(beam) {
  const at = BEAMS.indexOf(beam);
  return BEAMS[(at + 1) % BEAMS.length];
}

export function beamLabel(beam) {
  return BEAM_KO[beam] || BEAM_KO.off;
}

/** 탈것에 타거나 시간대가 바뀔 때의 처음 상태다. 밤에는 하향등이 켜진 채로 시작한다. */
export function defaultBeam(night) {
  return night ? 'low' : 'off';
}
