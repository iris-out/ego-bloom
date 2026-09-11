// All city parts become instances of a small set of shared, lit geometries.
export const TIER_COLORS = {
  bronze: '#C98B5E', silver: '#B8C0CC', gold: '#E8C04A', platinum: '#6FD3C8',
  diamond: '#6AA8FF', master: '#C58CFF', champion: '#FF6B5B',
};

export const QUALITY = {
  low: { dpr: 1, floors: 3, trees: 0.25, shadows: false, particles: 100, cars: 12 },
  medium: { dpr: 1.5, floors: 6, trees: 0.55, shadows: true, particles: 240, cars: 24 },
  high: { dpr: 2, floors: 10, trees: 1, shadows: true, particles: 450, cars: 40 },
};

export function createBatches() {
  const batches = {};
  return {
    batches,
    add(material, position, scale, owner = null, shape = 'box', rotation = 0, color) {
      const key = `${shape}-${material}`;
      (batches[key] ||= { shape, material, parts: [] }).parts.push({ position, scale, owner, rotation, color });
    },
  };
}

export function buildArchitecture(buildings, quality = 'medium') {
  const { batches, add } = createBatches();
  const budget = QUALITY[quality] || QUALITY.medium;
  for (const building of buildings) {
    const { x, z, id } = building;
    const h = Number.isFinite(building.height) && building.height > 0 ? Math.min(220, building.height) : 12;
    const tier = String(building.tier_name || 'bronze').toLowerCase();
    const accent = TIER_COLORS[tier] || TIER_COLORS.bronze;
    const part = (mat, dx, y, dz, w, height, d, shape = 'box', rotation = 0) =>
      add(mat, [x + dx, y + 0.5, z + dz], [w, height, d], id, shape, rotation, mat === 'accent' ? accent : undefined);
    const block = (dx, base, w, height, d, mat = 'stone') => part(mat, dx, base + height / 2, 0, w, height, d);
    const windows = (dx, base, w, height, d) => {
      const floors = Math.min(budget.floors, Math.max(2, Math.floor(height / 3.3)));
      for (let f = 0; f < floors; f++) {
        const y = base + 1.6 + f * (height - 2) / floors;
        // Long recessed glazing alternates with stone mullions and slab lines.
        part('glass', dx, y, d / 2 + 0.03, w - 1.4, 1.05, 0.12);
        part('glass', dx, y, -d / 2 - 0.03, w - 1.4, 1.05, 0.12);
        part('glass', dx + w / 2 + 0.03, y, 0, 0.12, 1.05, d - 1.4);
        part('glass', dx - w / 2 - 0.03, y, 0, 0.12, 1.05, d - 1.4);
      }
    };
    part('pavement', 0, -0.05, 0, 27, 0.4, 27);
    block(0, 0, 18, 2.1, 18);
    part('dark', 0, 1.9, 9.1, 3, 2.3, 0.18);
    part('accent', 0, 3.2, 10, 5.5, 0.35, 2);

    if (tier === 'bronze' || !(tier in TIER_COLORS)) {
      block(0, 2, 16, h - 4, 14, 'brick');
      windows(0, 2, 16, h - 4, 14);
      part('accent', 0, h - 1.8, 0, 17, 1.2, 15);
      part('roof', 0, h - 0.1, 0, 17.5, 3, 15.5, 'gable');
      part('brick', 4, h + 0.6, -3, 1.6, 3.4, 1.6);
      if (quality !== 'low') for (const dx of [-5, 0, 5]) part('brick', dx, h / 2, 7.15, 0.45, h - 5, 0.35);
    } else if (tier === 'silver') {
      block(0, 2, 13, h - 3, 13);
      windows(0, 2, 13, h - 4, 13);
      for (let y = 5; y < h - 2; y += quality === 'low' ? 6 : 4) {
        part('accent', 0, y, 7.4, 15, 0.4, 3.2);
        part('stone', 0, y + 0.65, 8.8, 15, 1, 0.28);
      }
      part('accent', 0, h - 0.5, 0, 15, 0.8, 15);
      part('roof', -2, h, -2, 5, 1, 5);
      part('green', 3.6, h + 0.3, -1, 3.5, 0.65, 9);
      part('green', -2, h + 0.3, 4.6, 8, 0.65, 2);
    } else if (tier === 'gold') {
      const steps = [[0, 16, h * 0.43], [h * 0.43, 12, h * 0.31], [h * 0.74, 8, h * 0.22]];
      for (const [base, width, height] of steps) {
        block(0, 2 + base, width, height, width, 'sand');
        windows(0, base + 2, width, height, width);
        part('accent', 0, base + height + 2, 0, width + 1, 0.65, width + 1);
      }
    } else if (tier === 'platinum') {
      for (let level = 0; level < 4; level++) {
        const height = (h - 3) / 4, width = 17 - level * 2.5, base = 2 + level * height;
        block(-level * 0.8, base, width, height, width, 'stone');
        windows(-level * 0.8, base, width, height, width);
        part('accent', -level * 0.8, base + height, 0, width + 0.7, 0.65, width + 0.7);
        part('green', -level * 0.8 + width / 2 - 0.9, base + height + 0.5, 0, 1, 0.8, width - 2);
      }
    } else if (tier === 'diamond') {
      part('blueglass', 0, h * 0.44, 0, 8.7, h * 0.82, 8.7, 'octagon', Math.PI / 8);
      part('accent', 0, h * 0.85, 0, 8.85, 0.6, 8.85, 'octagon', Math.PI / 8);
      part('blueglass', 0, h * 0.93, 0, 8.7, h * 0.16, 8.7, 'spire', Math.PI / 8);
      for (let j = 0; j < 8; j++) {
        const angle = j * Math.PI / 4 + Math.PI / 8;
        part('accent', Math.sin(angle) * 8.05, h * 0.44, Math.cos(angle) * 8.05, 0.2, h * 0.8, 0.2);
      }
      for (let y = 5; y < h * 0.8; y += quality === 'low' ? 9 : 5) part('glass', 0, y, 0, 8.8, 0.45, 8.8, 'octagon', Math.PI / 8);
    } else if (tier === 'master') {
      for (const dx of [-5.3, 5.3]) {
        const height = h * (dx < 0 ? 0.9 : 0.98);
        block(dx, 2, 7.4, height, 12, 'violet');
        windows(dx, 2, 7.4, height - 1, 12);
        part('accent', dx, height + 2, 0, 8.2, 0.8, 12.8);
        part('accent', dx - 3.6, height / 2 + 2, 6.1, 0.35, height, 0.35);
      }
      part('accent', 0, h * 0.7, 0, 5, 3, 5);
      part('glass', 0, h * 0.7, 2.55, 5, 1.7, 0.15);
    } else if (tier === 'champion') {
      block(0, 2, 17, h * 0.18, 17, 'sand');
      block(0, h * 0.18 + 2, 12.5, h * 0.6, 12.5, 'stone');
      windows(0, h * 0.18 + 2, 12.5, h * 0.56, 12.5);
      part('accent', 0, h * 0.8, 0, 9.6, 3, 9.6, 'octagon');
      for (let j = 0; j < 5; j++) {
        const angle = j * Math.PI * 2 / 5;
        part('accent', Math.sin(angle) * 6.7, h * 0.9, Math.cos(angle) * 6.7, 2.3, h * 0.19, 2.3, 'spire');
      }
      part('sand', 0, h * 0.9, 0, 3, h * 0.2, 3, 'spire');
      for (const dx of [-6.6, 6.6]) part('accent', dx, h * 0.47, 6.3, 0.5, h * 0.59, 0.5);
    }
    if (quality !== 'low') {
      part('dark', -8.6, 0.6, 10.6, 3.4, 0.3, 1);
      part('wood', -8.6, 1, 10.6, 3.6, 0.3, 1.1);
      part('wood', -8.6, 1.6, 10.95, 3.6, 0.8, 0.25);
    }
  }
  return batches;
}
