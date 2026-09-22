import { ROAD_WIDTH } from '../../shared/urbanPlan.js';
import { roadRibbon } from '../../shared/roadRibbon.js';

/** 현재 층과 이어지는 노면만 고른다. 고가 밑을 지나는 차를 위층으로 끌어올리지 않는다.
 * 매 프레임 차마다 부르므로 후보 배열과 정렬 없이 가장 가까운 하나만 들고 돈다. */
const GROUND = Object.freeze({ top: .33, slope: 0, dx: 0, dz: 0 });
const found = { top: .33, slope: 0, dx: 0, dz: 0 };
const rampTriangleCache = new WeakMap();
const FOOTPRINT_EPSILON = 1e-5;

function rampTriangles(ramp, line) {
  const previous = rampTriangleCache.get(ramp);
  if (previous?.line === line) return previous.triangles;
  const triangles = [];
  for (const span of roadRibbon(line, { width: ramp.width || 15.4, offsetY: .6 }).spans) {
    const lineDx = span.b[0] - span.a[0], lineDz = span.b[2] - span.a[2];
    const lineLengthSq = lineDx * lineDx + lineDz * lineDz;
    for (const triangle of span.triangles) {
      const [a, b, c] = triangle;
      const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(denominator) < 1e-12) continue;
      const aX = (b[2] - c[2]) / denominator, aZ = (c[0] - b[0]) / denominator;
      const bX = (c[2] - a[2]) / denominator, bZ = (a[0] - c[0]) / denominator;
      const cX = -aX - bX, cZ = -aZ - bZ;
      const aC = -aX * c[0] - aZ * c[2], bC = -bX * c[0] - bZ * c[2], cC = 1 - aC - bC;
      const gradientX = a[1] * aX + b[1] * bX + c[1] * cX;
      const gradientZ = a[1] * aZ + b[1] * bZ + c[1] * cZ;
      const slope = Math.hypot(gradientX, gradientZ);
      triangles.push({
        minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]),
        minZ: Math.min(a[2], b[2], c[2]), maxZ: Math.max(a[2], b[2], c[2]),
        aX, aZ, aC, bX, bZ, bC, cX, cZ, cC,
        aTolerance: FOOTPRINT_EPSILON * Math.hypot(aX, aZ),
        bTolerance: FOOTPRINT_EPSILON * Math.hypot(bX, bZ),
        cTolerance: FOOTPRINT_EPSILON * Math.hypot(cX, cZ),
        topX: gradientX, topZ: gradientZ, topC: a[1] * aC + b[1] * bC + c[1] * cC,
        flatTop: slope < 1e-12 ? a[1] : null,
        slope, dx: slope ? gradientX / slope : 0, dz: slope ? gradientZ / slope : 0,
        lineX: span.a[0], lineZ: span.a[2], lineDx, lineDz, lineLengthSq,
      });
    }
  }
  rampTriangleCache.set(ramp, { line, triangles });
  return triangles;
}

export function roadSurface(plan, x, z, previousTop = .33) {
  let bestDistance = Infinity, bestAway = Infinity;
  const sample = (ax, az, bx, bz, y1, y2, width1, width2 = width1, capStart = 0, capEnd = 0) => {
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    if (!length) return;
    const t = ((x - ax) * dx + (z - az) * dz) / (length * length);
    if (t < -(capStart + FOOTPRINT_EPSILON) / length
      || t > 1 + (capEnd + FOOTPRINT_EPSILON) / length) return;
    const along = Math.max(0, Math.min(1, t));
    const distance = Math.abs((x - ax) * dz - (z - az) * dx) / length;
    // 직선 고가와 points 없는 legacy ramp 의 선형 폭이다. 폴리라인 ramp 는 아래의
    // canonical triangle 경로를 써 화면에 없는 노면을 만들지 않는다.
    const width = (width1 + width2) / 2;
    if (distance > width / 2 + FOOTPRINT_EPSILON) return;
    const top = y1 + (y2 - y1) * along + .6;
    const away = Math.abs(top - previousTop);
    // 가까운 현재 층만 후보로 둔 뒤 중심선까지의 거리로 폴리라인 조각을 고른다.
    // 높이 차이만 우선하면 직각 합류점의 이전 조각 폭 안에서 높이가 잠시 고정된다.
    if (away >= 1 || distance > bestDistance + 1e-9
      || (Math.abs(distance - bestDistance) <= 1e-9 && away >= bestAway)) return;
    bestDistance = distance; bestAway = away;
    found.top = top; found.slope = (y2 - y1) / length; found.dx = dx / length; found.dz = dz / length;
  };
  for (const road of plan.roads) {
    if (!road.elevated) continue;
    const y = road.deckY ?? plan.highwayDeck;
    const width = road.width ?? ROAD_WIDTH[road.kind] ?? 28;
    sample(road.x1, road.z1, road.x2, road.z2, y, y, width, width,
      Math.max(0, road.capStart || 0), Math.max(0, road.capEnd || 0));
  }
  for (const ramp of plan.ramps || []) {
    // 그린 폴리라인과 같은 배열을 읽는다. 조각마다 점의 폭을 그대로 쓴다.
    const line = ramp.points;
    if (!line) {
      sample(ramp.from.x, ramp.from.z, ramp.to.x, ramp.to.z, ramp.from.y, ramp.to.y, ramp.width || 15.4);
      if (ramp.merge) sample(ramp.to.x, ramp.to.z, ramp.merge.x, ramp.merge.z, ramp.to.y, ramp.to.y, ramp.width || 15.4);
      continue;
    }
    for (const triangle of rampTriangles(ramp, line)) {
      if (x < triangle.minX - FOOTPRINT_EPSILON || x > triangle.maxX + FOOTPRINT_EPSILON
        || z < triangle.minZ - FOOTPRINT_EPSILON || z > triangle.maxZ + FOOTPRINT_EPSILON) continue;
      const a = triangle.aX * x + triangle.aZ * z + triangle.aC;
      const b = triangle.bX * x + triangle.bZ * z + triangle.bC;
      const c = triangle.cX * x + triangle.cZ * z + triangle.cC;
      if (a < -triangle.aTolerance || b < -triangle.bTolerance || c < -triangle.cTolerance) continue;
      const top = triangle.flatTop ?? triangle.topX * x + triangle.topZ * z + triangle.topC;
      const away = Math.abs(top - previousTop);
      let along = ((x - triangle.lineX) * triangle.lineDx + (z - triangle.lineZ) * triangle.lineDz)
        / triangle.lineLengthSq;
      along = Math.max(0, Math.min(1, along));
      const lineX = triangle.lineX + triangle.lineDx * along;
      const lineZ = triangle.lineZ + triangle.lineDz * along;
      const distance = Math.hypot(x - lineX, z - lineZ);
      if (away >= 1 || distance > bestDistance + 1e-9
        || (Math.abs(distance - bestDistance) <= 1e-9 && away >= bestAway)) continue;
      bestDistance = distance; bestAway = away;
      found.top = top; found.slope = triangle.slope; found.dx = triangle.dx; found.dz = triangle.dz;
    }
  }
  return bestDistance < Infinity ? found : GROUND;
}
