/** Visual detail for the canonical riverfront plan. Positions and walkable tops
 * come from shared/riverfrontPlan; this module only adds decoration. */

export function triangleSurfaceMesh(triangles) {
  const positions = triangles.flat(2);
  return { positions, indices: Array.from({ length: positions.length / 3 }, (_, index) => index) };
}

const surfaceMaterial = kind => {
  if (kind === 'island-ground' || kind === 'lawn' || kind === 'picnic' || kind === 'shade-grove') return 'green';
  if (kind === 'terraces' || kind === 'terrace-step') return 'stone';
  if (kind === 'pavilion' || kind === 'outdoor-stage') return 'wood';
  if (kind === 'accessible-ramp' || kind === 'deck') return 'wood';
  return 'pavement';
};

const distanceToSegment = (x, z, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
};

function addTree(add, x, z, size, color) {
  add('wood', [x, 1.65, z], [.42, 3.05, .42], null, 'trunk');
  add('leaf', [x, 4.75, z], [2.2 * size, 3.15 * size, 2.2 * size], null, 'tree', 0, color);
}

function areaTrees(add, area, plan, quality) {
  if (quality === 'low') return;
  const count = quality === 'high' ? 16 : 9;
  for (let index = 0; index < count; index++) {
    const angle = index * 2.399963229728653, rim = .74 + (index % 3) * .08;
    const x = area.x + Math.cos(angle) * area.width * .5 * rim;
    const z = area.z + Math.sin(angle) * area.depth * .5 * rim;
    const nearPath = plan.paths.some(path => path.points.slice(1).some((point, segment) =>
      distanceToSegment(x, z, path.points[segment], point) < path.width / 2 + 3));
    if (!nearPath) addTree(add, x, z, .85 + index % 3 * .11, index % 4 ? '#7fa968' : '#a8b774');
  }
}

function pavilion(add, structure, index) {
  const { x, z, width, depth, height } = structure;
  const deckY = structure.groundY ?? .13;
  const tint = ['#a78f73', '#7998a0', '#ae876d'][index];
  if (deckY > .2) add('wood', [x, deckY - .14, z], [width, .25, depth]);
  // Three profiles: shallow arc, paired waves, and rising stepped canopy.
  const strips = index === 0 ? 9 : index === 1 ? 11 : 13;
  for (let strip = 0; strip < strips; strip++) {
    const fraction = (strip + .5) / strips * 2 - 1;
    const rise = index === 0 ? 1.5 * (1 - fraction * fraction)
      : index === 1 ? .75 * Math.cos(fraction * Math.PI * 2) + .75
        : Math.floor((strip / strips) * 4) * .55;
    const px = x + fraction * width * .48;
    add('roof', [px, height + rise, z], [width / strips + .08, .55, depth + 2], null, 'box', 0, tint);
    if (strip === 0 || strip === strips - 1) add('head', [px, height + rise - .32, z],
      [.14, .11, depth + 2.2], null, 'box', 0, '#ffe1a2');
  }
}

function culture(add, structure) {
  const { x, z, width, depth, height } = structure;
  add('stone', [x, .32 + height * .48, z], [width, height * .96, depth]);
  add('roof', [x, .32 + height + .18, z], [width + 3, .36, depth + 3]);
  add('glass', [x + width / 2 + .02, 3.2, z], [.1, 4.1, depth * .73], null, 'pane', Math.PI / 2);
  add('head', [x + width / 2 + .15, .65, z], [.18, .13, depth * .82], null, 'box', 0, '#ffe6ae');
}

function outdoorStage(add, structure) {
  const { x, z, width, depth, floorY } = structure;
  const slabTop = floorY - .01;
  add('wood', [x, (slabTop + .32) / 2, z], [width, slabTop - .32, depth]);
  add('roof', [x, 4.9, z + depth * .39], [width * 1.05, .35, 1.8]);
  for (const side of [-1, 1]) add('wood', [x + side * width * .47, 2.55, z + depth * .39],
    [.35, 4.3, .35]);
}

export function addRiverfrontScenery(add, plan, quality) {
  const surfaces = plan.surfaces.filter(surface => surface.kind !== 'road-bridge').map(surface => ({
    id: surface.id, material: surfaceMaterial(surface.kind), canonical: true, path: Boolean(surface.pathId),
    mesh: triangleSurfaceMesh(surface.triangles),
  }));
  for (const area of plan.areas) {
    if (['lawn', 'picnic', 'shade-grove', 'terraces'].includes(area.kind)) areaTrees(add, area, plan, quality);
    if (area.kind === 'picnic') for (let table = -1; table <= 1; table++) {
      const x = area.x + table * 10, z = area.z;
      add('wood', [x, .91, z], [3.4, .18, 1.5]);
      add('wood', [x, .48, z - 2], [3.4, .16, .55]);
      add('wood', [x, .48, z + 2], [3.4, .16, .55]);
    }
    if (area.kind === 'terraces') for (let tier = 0; tier < 3; tier++) {
      const z = area.z - 12 + tier * 11;
      for (const side of [-1, 1]) add('stone', [area.x + side * 13, .43 + tier * .13, z], [10, .25, 1.7]);
    }
  }
  for (const structure of plan.structures) {
    if (structure.kind === 'culture-hall') culture(add, structure);
    else if (structure.kind === 'pavilion') pavilion(add, structure, Number(structure.id.at(-1)) - 1);
    else if (structure.kind === 'outdoor-stage') outdoorStage(add, structure);
  }
  for (const place of plan.reservations.filter(item => item.id.startsWith('turnaround-'))) {
    add('pavement', [place.x, .17, place.z], [19, .18, 15]);
    add('road', [place.x, .27, place.z], [15, .12, 12]);
    if (quality !== 'low') for (const side of [-1, 1])
      add('marking', [place.x + side * 4.8, .35, place.z - 2.5], [.14, .02, 4.2]);
  }
  for (const obstacle of plan.obstacles) {
    const material = obstacle.kind === 'gate-post' ? 'head'
      : ['pavilion-column', 'pavilion-rail', 'pavilion-rail-post', 'deck-rail'].includes(obstacle.kind) ? 'wood' : 'stone';
    add(material, [obstacle.x, obstacle.bottom + obstacle.height / 2, obstacle.z],
      [obstacle.width, obstacle.height, obstacle.depth], null, 'box', obstacle.rotation,
      obstacle.kind === 'gate-post' ? '#ffd9a1' : undefined);
  }
  return surfaces;
}
