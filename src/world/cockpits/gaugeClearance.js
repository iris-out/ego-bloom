/** 계기가 화면 안에 온전히 보이는지 좌표만으로 판정한다. three 와 React 에 기대지 않아
 * 단위 테스트가 그대로 읽는다. 계기 크기를 바꾸면 여기 각이 따라 바뀌므로, 다음에 누가
 * 지름을 키워도 잘림이 테스트에서 먼저 걸린다.
 *
 * 좌표는 전부 눈 기준이고 three 규약을 따른다. x 가 오른쪽, y 가 위, 눈 앞이 -z 다.
 * 각은 도이고 아래와 왼쪽이 음수다. */

const DEG = 180 / Math.PI;

/** 눈에서 본 각이다. offset 은 x 또는 y, depth 는 z 다. */
export function angleOf(offset, depth) {
  return Math.atan2(offset, Math.abs(depth)) * DEG;
}

/** 화각 절반에서 안쪽으로 남길 여유다. 이만큼을 남기지 않으면 창 비율이 조금만 달라져도
 * 계기 아랫변이 화면 밖으로 나간다. */
export const FOV_MARGIN = 3;
/** 가림 조각(후드 입술, 스티어링 림, 핸들바, 대시 모서리, 바스켓 벽) 과 계기 사이 최소 각이다. */
export const OCCLUDER_MARGIN = 1;
/** 세로 화각에서 가로 화각을 구할 때 쓰는 가장 좁은 창 비율이다. 4:3 창에서도 계기가
 * 좌우로 잘리지 않아야 한다. */
export const NARROW_ASPECT = 4 / 3;

/** 계기 하나가 화면에서 차지하는 각 범위다. radius 를 주면 원판, halfWidth/halfHeight 를
 * 주면 사각 화면이다. 판정 기준은 원판의 끝점(중심에서 반지름만큼 위아래) 이다. */
export function gaugeSpan(gauge) {
  const halfWidth = gauge.halfWidth ?? gauge.radius;
  const halfHeight = gauge.halfHeight ?? gauge.radius;
  const { x = 0, y, z } = gauge;
  return {
    id: gauge.id,
    top: angleOf(y + halfHeight, z), bottom: angleOf(y - halfHeight, z),
    right: angleOf(x + halfWidth, z), left: angleOf(x - halfWidth, z),
    depth: Math.abs(z),
  };
}

/** 위에서 내려오는 차양이다. 눈에 가장 가까운 아래 모서리 (y, z) 가 경계다.
 * 후드 입술, 코 덮개, 계기판 코밍이 여기 해당한다. */
export function hoodEdge(id, y, z, xRange) {
  return Object.freeze({
    id, axis: 'elevation', side: 'over', angle: angleOf(y, z), depth: Math.abs(z),
    span: Object.freeze([angleOf(xRange[0], z), angleOf(xRange[1], z)]),
  });
}

/** 아래에서 올라오는 모서리다. 대시 모서리, 계기판 아랫단, 바스켓 앞벽 윗단이다. */
export function ledgeEdge(id, y, z, xRange) {
  return Object.freeze({
    id, axis: 'elevation', side: 'under', angle: angleOf(y, z), depth: Math.abs(z),
    span: Object.freeze([angleOf(xRange[0], z), angleOf(xRange[1], z)]),
  });
}

/** 고리의 가장 높은 실루엣 점이다. 스티어링 림과 핸들바 고리가 여기 해당한다.
 * tilt 는 고리를 x 축으로 눕힌 각이고 radius 는 튜브 바깥까지다. */
export function ringTop(id, { x = 0, y, z, radius, tilt = 0 }) {
  const topY = y + radius * Math.cos(tilt), topZ = z + radius * Math.sin(tilt);
  return Object.freeze({
    id, axis: 'elevation', side: 'under', angle: angleOf(topY, topZ), depth: Math.abs(topZ),
    span: Object.freeze([angleOf(x - radius, topZ), angleOf(x + radius, topZ)]),
  });
}

/** 가로 막대다. 핸들바 가로대처럼 높이가 있는 조각의 윗면이 경계다. */
export function barTop(id, { y, z, halfHeight, xRange }) {
  return ledgeEdge(id, y + halfHeight, z, xRange);
}

/** z 에 평행한 옆벽이다. 계기가 이 평면 바깥에 있으면 벽에 묻힌다. 벽까지 거리는 계기마다
 * 다른 z 에서 재야 하므로 경계각을 그때 구한다. */
export function sideWall(id, planeX, side) {
  return Object.freeze({ id, axis: 'azimuth', side, plane: planeX });
}

function overlaps(a, b) {
  return Math.max(a[0], b[0]) < Math.min(a[1], b[1]);
}

/** rig 하나를 검사해 어긋난 것만 돌려준다. 빈 배열이면 계기가 전부 온전히 보인다.
 * rig = { fovHalf, gauges: [{ id, x, y, z, radius }], occluders: [...] } 다. */
export function gaugeFaults(rig) {
  const faults = [];
  const vLimit = rig.fovHalf - FOV_MARGIN;
  const hLimit = Math.atan((rig.aspect || NARROW_ASPECT) * Math.tan(rig.fovHalf / DEG)) * DEG - FOV_MARGIN;
  for (const gauge of rig.gauges) {
    const span = gaugeSpan(gauge);
    if (span.bottom < -vLimit) faults.push(fault(gauge.id, 'fov-bottom', span.bottom, -vLimit));
    if (span.top > vLimit) faults.push(fault(gauge.id, 'fov-top', span.top, vLimit));
    if (span.left < -hLimit) faults.push(fault(gauge.id, 'fov-left', span.left, -hLimit));
    if (span.right > hLimit) faults.push(fault(gauge.id, 'fov-right', span.right, hLimit));
    for (const blocker of rig.occluders) {
      const miss = blocked(span, gauge, blocker);
      if (miss) faults.push(miss);
    }
  }
  return faults;
}

function fault(gauge, rule, got, need) {
  return { gauge, rule, got: round(got), need: round(need) };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/** 가림 조각 하나가 계기를 먹는지 본다. 먹지 않으면 null 이다. */
function blocked(span, gauge, blocker) {
  if (blocker.axis === 'azimuth' && blocker.plane !== undefined) {
    const edge = angleOf(blocker.plane, gauge.z);
    if (blocker.side === 'under' && span.left < edge + OCCLUDER_MARGIN) {
      return fault(span.id, `${blocker.id}-left`, span.left, edge + OCCLUDER_MARGIN);
    }
    if (blocker.side === 'over' && span.right > edge - OCCLUDER_MARGIN) {
      return fault(span.id, `${blocker.id}-right`, span.right, edge - OCCLUDER_MARGIN);
    }
    return null;
  }
  // 계기보다 깊은 조각은 계기 뒤에 있어 가리지 못한다. 좌우로 긴 모서리라 거리가 아니라
  // 깊이(z) 로 앞뒤를 가린다.
  if (blocker.depth >= span.depth) return null;
  if (blocker.span && !overlaps(blocker.span, [span.left, span.right])) return null;
  if (blocker.side === 'over' && span.top > blocker.angle - OCCLUDER_MARGIN) {
    return fault(span.id, `${blocker.id}-top`, span.top, blocker.angle - OCCLUDER_MARGIN);
  }
  if (blocker.side === 'under' && span.bottom < blocker.angle + OCCLUDER_MARGIN) {
    return fault(span.id, `${blocker.id}-bottom`, span.bottom, blocker.angle + OCCLUDER_MARGIN);
  }
  return null;
}
