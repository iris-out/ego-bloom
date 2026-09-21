import { ROAD_WIDTH } from '../../shared/urbanPlan.js';

/** 현재 층과 이어지는 노면만 고른다. 고가 밑을 지나는 차를 위층으로 끌어올리지 않는다.
 * 매 프레임 차마다 부르므로 후보 배열과 정렬 없이 가장 가까운 하나만 들고 돈다. */
const GROUND = Object.freeze({ top: .33, slope: 0, dx: 0, dz: 0 });
const found = { top: .33, slope: 0, dx: 0, dz: 0 };

export function roadSurface(plan, x, z, previousTop = .33) {
  let best = Infinity;
  const sample = (ax, az, bx, bz, y1, y2, width) => {
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    if (!length) return;
    const t = ((x - ax) * dx + (z - az) * dz) / (length * length);
    if (t < -.002 || t > 1.002) return;
    if (Math.abs((x - ax) * dz - (z - az) * dx) / length > width / 2) return;
    const top = y1 + (y2 - y1) * Math.max(0, Math.min(1, t)) + .6;
    const away = Math.abs(top - previousTop);
    if (away >= 1 || away >= best) return;
    best = away;
    found.top = top; found.slope = (y2 - y1) / length; found.dx = dx / length; found.dz = dz / length;
  };
  for (const road of plan.roads) {
    if (!road.elevated) continue;
    const y = road.deckY ?? plan.highwayDeck;
    sample(road.x1, road.z1, road.x2, road.z2, y, y, ROAD_WIDTH[road.kind] || 28);
  }
  for (const ramp of plan.ramps || []) {
    // 그린 폴리라인과 같은 배열을 읽는다. 조각마다 점의 폭을 그대로 쓴다.
    const line = ramp.points;
    if (!line) {
      sample(ramp.from.x, ramp.from.z, ramp.to.x, ramp.to.z, ramp.from.y, ramp.to.y, ramp.width || 15.4);
      if (ramp.merge) sample(ramp.to.x, ramp.to.z, ramp.merge.x, ramp.merge.z, ramp.to.y, ramp.to.y, ramp.width || 15.4);
      continue;
    }
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1], b = line[i];
      sample(a[0], a[1], b[0], b[1], a[2], b[2], Math.max(a[3], b[3]) || ramp.width || 15.4);
    }
  }
  return best < Infinity ? found : GROUND;
}
