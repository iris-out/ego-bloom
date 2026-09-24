import { riverCenter, riverHalf, riverParkWidth, riverStreams, inRiver, inWaterBody } from './river.js';
import { bridgeSegment, onBridge } from './bridgeGeometry.js';

// The existing river park mesh tops out at .13. Canonical destination floors
// and walking ribbons sit above it in distinct layers so logarithmic depth
// rendering cannot hide coplanar fragments of a path.
const LAND_Y = 0.19;
const AREA_Y = 0.16;
const DECK_Y = 0.32;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function rectangleTriangles(x, z, width, depth, y) {
  const a = [x - width / 2, y, z - depth / 2], b = [x + width / 2, y, z - depth / 2];
  const c = [x + width / 2, y, z + depth / 2], d = [x - width / 2, y, z + depth / 2];
  return [[a, c, b], [a, d, c]];
}

/** A ribbon is triangulated once; the path, renderer and walk query share it. */
export function pathTriangles(points, width) {
  const triangles = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    const p = [a[0] + nx, a[2], a[1] + nz], q = [a[0] - nx, a[2], a[1] - nz];
    const r = [b[0] + nx, b[2], b[1] + nz], s = [b[0] - nx, b[2], b[1] - nz];
    triangles.push([p, r, q], [q, r, s]);
  }
  return triangles;
}

function distanceToRoad(x, z, road) {
  const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length2 = dx * dx + dz * dz;
  const t = length2 ? clamp(((x - road.x1) * dx + (z - road.z1) * dz) / length2, 0, 1) : 0;
  return Math.hypot(x - road.x1 - t * dx, z - road.z1 - t * dz);
}

function usableSite(extent, x, z, width, depth, roads, bridges, ponds) {
  const corners = [[0, 0], [-width / 2, -depth / 2], [width / 2, -depth / 2],
    [-width / 2, depth / 2], [width / 2, depth / 2]];
  if (corners.some(([dx, dz]) => inWaterBody(extent, x + dx, z + dz))) return false;
  if (roads.some(road => !road.elevated && !road.tunnel
    && distanceToRoad(x, z, road) < Math.hypot(width, depth) / 2 + 8)) return false;
  if (bridges.some(bridge => Math.abs(bridge.x - x) < width / 2 + bridge.width / 2 + 10
    && Math.abs(bridge.z - z) < depth / 2 + bridge.length / 2 + 10)) return false;
  if (ponds.some(pond => Math.abs(pond.x - x) < pond.rx + width / 2 + 5
    && Math.abs(pond.z - z) < pond.rz + depth / 2 + 5)) return false;
  return true;
}

function islandTriangles(island, y) {
  const center = [island.x, y, island.z], polygon = island.polygon;
  return polygon.map((point, index) => [center,
    [polygon[(index + 1) % polygon.length][0], y, polygon[(index + 1) % polygon.length][1]],
    [point[0], y, point[1]]]);
}

export function createRiverfrontPlan({ extent, roads = [], bridges = [], ponds = [], islands = [] }) {
  const e = Math.max(1, extent), areas = [], paths = [], surfaces = [], structures = [];
  const obstacles = [], vehicleBarriers = [], reservations = [];
  const diagnostics = { skippedCandidates: [], bridgeCrossings: [] };
  const addFixture = (id, kind, x, bottom, z, width, height, depth, margin = 0) => {
    obstacles.push({ id, kind, x, z, width, depth, rotation: 0,
      bottom, height, margin, roofMargin: 0 });
  };
  const riverRoads = roads.filter(road => road.path === 'river-south' && !road.elevated);
  const roadZ = x => {
    const segment = riverRoads.find(road => x >= Math.min(road.x1, road.x2) && x <= Math.max(road.x1, road.x2));
    if (!segment) return riverCenter(e, x) + riverHalf(e, x) + riverParkWidth(e, x, 1) + e * .0184 / 2;
    const t = (x - segment.x1) / (segment.x2 - segment.x1);
    return segment.z1 + t * (segment.z2 - segment.z1);
  };
  const addPath = (id, kind, points, width = 5) => {
    const path = { id, kind, access: 'pedestrian', width, points };
    paths.push(path);
    surfaces.push({ id: `surface-${id}`, kind, pathId: id, triangles: pathTriangles(points, width) });
    return path;
  };
  const addVehicleGate = (id, x, z, ux, uz, width, pathId = id) => {
    const run = Math.hypot(ux, uz) || 1, alongX = ux / run, alongZ = uz / run;
    const px = -alongZ, pz = alongX;
    // The paired visible posts leave 1.9 m at the centre for a walker. A car's
    // centre-line collision needs its own full-width box because solidIndex does
    // not expand that line by vehicle width. Walkers never receive this box.
    for (const side of [-1, 1]) obstacles.push({ id: `gate-post-${id}-${side}`, kind: 'gate-post',
      x: x + side * px * 1.25, z: z + side * pz * 1.25,
      width: .6, depth: .6, rotation: 0, bottom: 0, height: 1.8,
      margin: 0, roofMargin: 0 });
    vehicleBarriers.push({ id: `vehicle-gate-${id}`, gateId: id, kind: 'vehicle-gate', pathId,
      x, z, width: width + 1, depth: 1.2, rotation: Math.atan2(alongX, alongZ),
      bottom: 0, height: 2.4, margin: 0, roofMargin: 0 });
  };
  const addArea = (id, kind, x, z, width, depth, y = AREA_Y) => {
    const area = { id, kind, x, z, width, depth, rotation: 0, height: y, size: [width, depth] };
    areas.push(area);
    surfaces.push({ id: `surface-${id}`, kind, areaId: id, triangles: rectangleTriangles(x, z, width, depth, y) });
    reservations.push({ id: `reserve-${id}`, x, z, rx: width / 2 + 5, rz: depth / 2 + 5 });
    return area;
  };
  const bankZ = (x, side) => riverCenter(e, x) + side * (riverHalf(e, x) + 14);
  const gateRoadClear = (x, z) => roads.every(road => road.elevated || road.tunnel
    || distanceToRoad(x, z, road) > 18);

  // Existing road bridge slabs are walkable at their exact visible road-top height.
  for (const [index, bridge] of bridges.entries()) {
    const segment = bridgeSegment(bridge);
    surfaces.push({ id: `surface-road-bridge-${index}`, kind: 'road-bridge', bridgeIndex: index,
      triangles: pathTriangles([[segment.x1, segment.z1, .33], [segment.x2, segment.z2, .33]], segment.width) });
  }

  // Sample both banks at a fixed density and add real pedestrian decks over tributaries.
  for (const side of [-1, 1]) {
    const bank = side < 0 ? 'north' : 'south', points = [];
    const samples = 96;
    for (let i = 0; i <= samples; i++) {
      const x = -e * .9 + e * 1.8 * i / samples;
      if (riverStreams(e).some(stream => stream.side === side
        && Math.abs(stream.x - x) < stream.width / 2 + 9)) continue;
      points.push([x, bankZ(x, side), LAND_Y]);
    }
    for (const stream of riverStreams(e).filter(stream => stream.side === side)) {
      const outer = stream.width / 2 + 9, inner = stream.width / 2 + 1;
      for (const [offset, y] of [[-outer, LAND_Y], [-inner, DECK_Y], [inner, DECK_Y], [outer, LAND_Y]]) {
        const x = stream.x + offset;
        if (Math.abs(x) < e * .9) points.push([x, bankZ(x, side), y]);
      }
      diagnostics.bridgeCrossings.push(stream.id);
      for (const direction of [-1, 1]) {
        let gateX = stream.x + direction * (outer + 4);
        for (let shift = 0; shift <= 72; shift += 4) {
          const candidate = stream.x + direction * (outer + 4 + shift);
          if (gateRoadClear(candidate, bankZ(candidate, side))) { gateX = candidate; break; }
        }
        addVehicleGate(`stream-${stream.id}-${direction}`, gateX, bankZ(gateX, side), 1, 0, 6, `bank-${bank}`);
      }
    }
    points.sort((a, b) => a[0] - b[0]);
    addPath(`bank-${bank}`, 'promenade', points, 6);
  }

  const site = (id, kind, preferred, side, width, depth, offset) => {
    for (let step = 0; step <= 26; step++) {
      for (const direction of step ? [1, -1] : [1]) {
        const x = clamp(preferred + direction * step * e * .024, -e * .85, e * .85);
        const z = riverCenter(e, x) + side * (riverHalf(e, x) + riverParkWidth(e, x, side) * offset);
        if (!usableSite(e, x, z, width, depth, roads, bridges, ponds)) continue;
        return addArea(id, kind, x, z, width, depth);
      }
    }
    diagnostics.skippedCandidates.push(id);
    return null;
  };

  const lawn = site('south-lawn', 'lawn', -.53 * e, 1, 65, 52, .48);
  const picnic = site('south-picnic', 'picnic', -.24 * e, 1, 45, 38, .50);
  const grove = site('south-grove', 'shade-grove', .05 * e, 1, 62, 48, .56);
  const terraces = site('south-terraces', 'terraces', .51 * e, 1, 50, 45, .52);
  for (const area of [lawn, picnic, grove, terraces].filter(Boolean)) {
    addPath(`access-${area.id}`, 'access', [[area.x, bankZ(area.x, 1), LAND_Y],
      [area.x, area.z, LAND_Y], [area.x, roadZ(area.x), LAND_Y]], 5);
    reservations.push({ id: `turnaround-${area.id}`, x: area.x, z: roadZ(area.x) - 9, rx: 12, rz: 9 });
  }
  if (terraces) {
    surfaces.push({ id: 'surface-terrace-middle', kind: 'terrace-step', areaId: terraces.id,
      triangles: rectangleTriangles(terraces.x + 1, terraces.z + 4, 37, 15, .39) });
    surfaces.push({ id: 'surface-terrace-upper', kind: 'terrace-step', areaId: terraces.id,
      triangles: rectangleTriangles(terraces.x + 1, terraces.z + 14, 31, 10, .65) });
    addPath('terrace-bypass', 'accessible-ramp', [[terraces.x - 22, terraces.z - 17, LAND_Y],
      [terraces.x - 28, terraces.z + 1, .39], [terraces.x - 22, terraces.z + 17, .65],
      [terraces.x + 1, terraces.z + 17, .65]], 4);
  }

  const west = islands.find(island => island.id === 'yeoui') || islands[0];
  const culture = islands.find(island => island.id === 'nodeul') || islands[1];
  for (const [island, kind] of [[west, 'west-greenery'], [culture, 'culture-island']]) {
    if (!island) continue;
    areas.push({ id: kind, kind, x: island.x, z: island.z, width: island.rx * 2, depth: island.rz * 2,
      rotation: 0, height: DECK_Y, size: [island.rx * 2, island.rz * 2], polygon: island.polygon });
    surfaces.push({ id: `surface-${kind}`, kind: 'island-ground', areaId: kind, triangles: islandTriangles(island, DECK_Y) });
    reservations.push({ id: `reserve-${kind}`, x: island.x, z: island.z, rx: island.rx + 5, rz: island.rz + 5 });
    const south = bankZ(island.x, 1), shore = island.z + island.rz * .84;
    addPath(`island-link-${island.id}`, 'deck', [[island.x, south, LAND_Y],
      [island.x, south - 9, DECK_Y], [island.x, shore, DECK_Y], [island.x, island.z, DECK_Y]], 6);
    addVehicleGate(`island-link-${island.id}`, island.x, south - 6, 0, -1, 6);
    structures.push({ id: `island-deck-${island.id}`, kind: 'pedestrian-deck', x: island.x,
      z: (south + shore) / 2, width: 6, depth: south - shore, size: [6, south - shore],
      rotation: 0, height: DECK_Y, pathId: `island-link-${island.id}` });
  }
  if (culture) {
    const north = bankZ(culture.x, -1), shore = culture.z - culture.rz * .84;
    addPath('island-link-nodeul-north', 'deck', [[culture.x, north, LAND_Y],
      [culture.x, north + 9, DECK_Y], [culture.x, shore, DECK_Y],
      [culture.x, culture.z, DECK_Y]], 6);
    addVehicleGate('island-link-nodeul-north', culture.x, north + 6, 0, 1, 6);
    structures.push({ id: 'island-deck-nodeul-north', kind: 'pedestrian-deck', x: culture.x,
      z: (north + shore) / 2, width: 6, depth: shore - north, size: [6, shore - north],
      rotation: 0, height: DECK_Y, pathId: 'island-link-nodeul-north' });
    const venueWidth = Math.min(55, culture.rx * .50), venueDepth = Math.min(25, culture.rz * .65);
    const venueX = culture.x - culture.rx * .48;
    structures.push({ id: 'culture-hall', kind: 'culture-hall', x: venueX,
      z: culture.z, width: venueWidth, depth: venueDepth, size: [venueWidth, venueDepth], rotation: 0, height: 9 });
    obstacles.push({ id: 'solid-culture-hall', kind: 'culture-hall', x: venueX, z: culture.z,
      width: venueWidth, depth: venueDepth, rotation: 0, bottom: DECK_Y, height: 9,
      margin: 0, roofMargin: 0 });
    const stage = { id: 'culture-stage', kind: 'outdoor-stage',
      x: venueX + venueWidth * .82, z: culture.z,
      width: venueWidth * .38, depth: venueDepth * .64,
      floorY: DECK_Y + .25 };
    structures.push(stage);
    surfaces.push({ id: 'surface-culture-stage', kind: 'outdoor-stage',
      areaId: stage.id, triangles: rectangleTriangles(stage.x, stage.z, stage.width, stage.depth, stage.floorY) });
    reservations.push({ id: 'reserve-culture-hall', x: venueX, z: culture.z,
      rx: venueWidth / 2 + 4, rz: venueDepth / 2 + 4 });
  }

  // Three different-sized water pavilions form one compact cluster just east of
  // Nodeul. All floor samples must be river water and clear road bridge slabs.
  const pavilionWidths = [24, 32, 40], pavilionOffsets = [-44, -8, 36];
  const pavilionCandidate = centerX => pavilionWidths.map((width, index) => {
    const x = centerX + pavilionOffsets[index];
    return { x, z: riverCenter(e, x) + riverHalf(e, x) - 35, width, depth: width * .72 };
  });
  const pavilionClear = places => places.every(place => {
    const samples = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dz =>
      [place.x + dx * place.width / 2, place.z + dz * place.depth / 2]));
    if (place.x + place.width / 2 > e * .9) return false;
    if (samples.some(([x, z]) => !inRiver(e, x, z) || !inWaterBody(e, x, z))) return false;
    if (bridges.some(bridge => samples.some(([x, z]) => onBridge(bridge, x, z, 10)))) return false;
    if (roads.some(road => !road.elevated && !road.tunnel
      && distanceToRoad(place.x, place.z, road) < Math.hypot(place.width, place.depth) / 2 + 20)) return false;
    if (ponds.some(pond => Math.abs(pond.x - place.x) < pond.rx + place.width / 2 + 5
      && Math.abs(pond.z - place.z) < pond.rz + place.depth / 2 + 5)) return false;
    return true;
  });
  const firstCenter = (culture ? culture.x + culture.rx : e * .372) + 100;
  let pavilionPlaces = null;
  for (let shift = 0; shift <= Math.min(400, e * .3); shift += 20) {
    const places = pavilionCandidate(firstCenter + shift);
    if (pavilionClear(places)) { pavilionPlaces = places; break; }
  }
  if (!pavilionPlaces) throw new Error(`No water pavilion cluster clears river infrastructure at extent ${e}`);
  const pavilions = pavilionPlaces.map((place, index) => {
    const id = `south-pavilion-${index + 1}`;
    const area = addArea(id, 'pavilion', place.x, place.z, place.width, place.depth, DECK_Y);
    structures.push({ ...area, kind: 'pavilion', height: 7 + index * 1.5, groundY: DECK_Y });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      addFixture(`column-${id}-${sx}-${sz}`, 'pavilion-column',
        place.x + sx * (place.width / 2 - 1.3), DECK_Y,
        place.z + sz * (place.depth / 2 - 1.3), .48, 7 + index * 1.5 - DECK_Y, .48);
    }
    for (const side of [-1, 1]) {
      const railZ = place.z + side * (place.depth / 2 - .4);
      const railHalf = (place.width - 3) / 2;
      const spans = index === 0 && side === 1
        ? [[-railHalf, -3], [3, railHalf]] : [[-railHalf, railHalf]];
      for (const [spanIndex, [start, end]] of spans.entries()) {
        addFixture(`rail-${id}-${side}-${spanIndex}`, 'pavilion-rail',
          place.x + (start + end) / 2, DECK_Y + .68, railZ, end - start, .12, .12, .42);
        for (const [postIndex, offset] of [start, end].entries()) {
          addFixture(`rail-post-${id}-${side}-${spanIndex}-${postIndex}`, 'pavilion-rail-post',
            place.x + offset, DECK_Y, railZ, .14, .9, .14, .42);
        }
      }
    }
    const bank = bankZ(place.x, 1);
    addPath(`pavilion-access-${index + 1}`, 'access', [[place.x, bank, LAND_Y],
      [place.x, roadZ(place.x), LAND_Y]], 5);
    reservations.push({ id: `turnaround-${id}`, x: place.x, z: roadZ(place.x) - 9, rx: 12, rz: 9 });
    return area;
  });
  const first = pavilions[0], firstBank = bankZ(first.x, 1);
  addPath('pavilion-link-1', 'deck', [[first.x, firstBank, LAND_Y],
    [first.x, firstBank - 9, DECK_Y], [first.x, first.z, DECK_Y]], 5);
  addVehicleGate('pavilion-link-1', first.x, firstBank - 6, 0, -1, 5);
  for (let index = 1; index < pavilions.length; index++) {
    const from = pavilions[index - 1], to = pavilions[index];
    addPath(`pavilion-link-${index + 1}`, 'deck', [[from.x, from.z, DECK_Y],
      [to.x, to.z, DECK_Y]], 5);
  }
  for (const deck of structures.filter(item => item.kind === 'pedestrian-deck')) {
    for (const side of [-1, 1]) addFixture(`rail-${deck.id}-${side}`, 'deck-rail',
      deck.x + side * 3.4, DECK_Y + .55, deck.z,
      .15, .14, deck.depth - 2, .42);
  }

  // Short bollards guard only the edges of an entrance. The central five metres stay open.
  for (const reservation of reservations.filter(item => item.id.startsWith('turnaround-'))) {
    for (const side of [-1, 1]) obstacles.push({ id: `bollard-${reservation.id}-${side}`, kind: 'bollard',
      x: reservation.x + side * 3.8, z: reservation.z, width: .55, depth: .55,
      rotation: 0, bottom: 0, height: 1.8, margin: 0, roofMargin: 0 });
  }
  return { areas, paths, surfaces, structures, obstacles, vehicleBarriers, reservations, diagnostics };
}
