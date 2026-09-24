import * as THREE from 'three';

/** Monotone cubic interpolation: rounded longitudinal surfaces without exceeding
 * any authored station's envelope. Unlike Catmull-Rom this cannot swell the bounds. */
export function smoothProfile(rows, steps = 5) {
  const slopes = rows.slice(1).map(([v, x], i) => (v - rows[i][0]) / (x - rows[i][1]));
  const tangents = rows.map((_, i) => i === 0 ? slopes[0] : i === rows.length - 1 ? slopes.at(-1)
    : slopes[i - 1] * slopes[i] <= 0 ? 0 : 2 / (1 / slopes[i - 1] + 1 / slopes[i]));
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const [a, x0] = rows[i], [b, x1] = rows[i + 1], dx = x1 - x0;
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const v = (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * dx * tangents[i]
        + (-2 * t3 + 3 * t2) * b + (t3 - t2) * dx * tangents[i + 1];
      out.push([Math.max(Math.min(a, b), Math.min(Math.max(a, b), v)), x0 + dx * t]);
    }
  }
  out.push([...rows.at(-1)]);
  return out;
}

/** Closed smooth rings with separately indexed end caps: cap normals never bend
 * the side highlights. All inputs and outputs are local coordinates. */
export function ringSurface(rings, cap = true) {
  const stride = rings[0].length, positions = rings.flat(2), indices = [];
  for (let r = 0; r < rings.length - 1; r++) for (let j = 0; j < stride; j++) {
    const a = r * stride + j, b = r * stride + (j + 1) % stride, c = a + stride, d = b + stride;
    indices.push(a, b, d, a, d, c);
  }
  if (cap) for (const [r, reverse] of [[0, true], [rings.length - 1, false]]) {
    const start = positions.length / 3, ring = rings[r];
    positions.push(...ring.flat());
    const center = ring.reduce((sum, p) => sum.map((v, i) => v + p[i] / stride), [0, 0, 0]);
    const c = positions.length / 3; positions.push(...center);
    for (let j = 0; j < stride; j++) {
      const a = start + j, b = start + (j + 1) % stride;
      indices.push(...(reverse ? [c, b, a] : [c, a, b]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Elliptical / superelliptical fuselage or body with independent width, height,
 * vertical center and squareness at each station. Default is an organic ellipse. */
export function sectionShell(stations, { segments = 32, steps = 5, cap = true } = {}) {
  const keys = ['rx', 'ry', 'cy', 'power'];
  const rows = Object.fromEntries(keys.map(key => [key, smoothProfile(stations.map(s => [s[key] ?? (key === 'power' ? 2 : 0), s.z]), steps)]));
  const rings = rows.rx.map(([rx, z], i) => {
    const ry = rows.ry[i][0], cy = rows.cy[i][0], exponent = 2 / rows.power[i][0];
    return Array.from({ length: segments }, (_, j) => {
      const angle = j * Math.PI * 2 / segments, c = Math.cos(angle), s = Math.sin(angle);
      return [rx * Math.sign(c) * Math.abs(c) ** exponent, cy + ry * Math.sign(s) * Math.abs(s) ** exponent, z];
    });
  });
  return ringSurface(rings, cap);
}

/** NACA-style closed airfoil. Cosine chord spacing resolves the round leading
 * edge; the trailing edge meets at a thin seam. Stations may add dihedral/camber. */
export function airfoilGeometry(stations, { chordSteps = 20, spanSteps = 4 } = {}) {
  const rows = [];
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < spanSteps; j++) {
    const t = j / spanSteps, a = stations[i], b = stations[i + 1];
    rows.push(Object.fromEntries(['x', 'front', 'back', 'thickness', 'y', 'camber'].map(k => [k, (a[k] || 0) * (1 - t) + (b[k] || 0) * t])));
  }
  rows.push(stations.at(-1));
  const rings = rows.map(s => {
    const ring = [];
    // Each edge is included once, sharing normals at the rounded leading edge.
    for (let j = 0; j < chordSteps * 2; j++) {
      const upper = j <= chordSteps, u = upper ? j / chordSteps : (2 * chordSteps - j) / chordSteps;
      const t = (1 - Math.cos(Math.PI * u)) / 2;
      const shape = (0.2969 * Math.sqrt(t) - .126 * t - .3516 * t ** 2 + .2843 * t ** 3 - .1036 * t ** 4) / .1;
      ring.push([s.x, (s.y || 0) + (s.camber || 0) * Math.sin(Math.PI * t) + (upper ? 1 : -1) * s.thickness * shape / 2, s.front + (s.back - s.front) * t]);
    }
    return ring;
  });
  return ringSurface(rings);
}

/** Open engine skin plus rolled lip and recessed inner barrel. No front disk. */
export function ductGeometry({ radius = .6, length = 2, wall = .07 } = {}) {
  const r = radius, h = length / 2;
  const points = [[r*.8,h],[r*.94,h*.7],[r,h*.05],[r*.94,-h*.85],[r*.9,-h],[r-wall,-h],[r-wall*1.2,-h*.87],[r*.8-wall,-h*.2]];
  const g = new THREE.LatheGeometry(points.map(([a,b]) => new THREE.Vector2(a,b)), 32);
  g.rotateX(Math.PI / 2); return g;
}

/** A rounded tire shoulder, flat tread and bead are one rotational surface. */
export function tireGeometry(radius, width) {
  const r = radius, w = width / 2;
  const profile = [[r*.58,-w*.87],[r*.76,-w],[r*.9,-w*.94],[r*.98,-w*.68],[r,-w*.32],[r,w*.32],[r*.98,w*.68],[r*.9,w*.94],[r*.76,w],[r*.58,w*.87]];
  const g = new THREE.LatheGeometry(profile.map(([a,b]) => new THREE.Vector2(a,b)), 32);
  g.normalizeNormals(); return g;
}

/** Smooth full lathe before slicing into cockpit visibility regions. */
export function fuselageGeometry(profile, start = -Infinity, end = Infinity, flatten = 1) {
  const rows = smoothProfile(profile, 6);
  const at = z => {
    const next = rows.findIndex(r => r[1] >= z);
    if (next <= 0) return rows[0][0];
    const [a,x] = rows[next - 1], [b,y] = rows[next];
    return a + (b-a)*(z-x)/(y-x);
  };
  const clipped = rows.filter(([,z])=>z>start&&z<end);
  if (Number.isFinite(start)) clipped.unshift([at(start),start]);
  if (Number.isFinite(end)) clipped.push([at(end),end]);
  const g = new THREE.LatheGeometry(clipped.map(([r,z])=>new THREE.Vector2(r,z)),32);
  g.rotateX(Math.PI/2);g.scale(1,flatten,1);return g;
}

/** Both halves as a single source geometry, correcting mirrored winding. */
export function pairedAirfoil(stations, options) {
  const g = airfoilGeometry(stations, options), mirrored = g.clone().scale(-1, 1, 1);
  const ix=mirrored.index.array;
  for(let i=0;i<ix.length;i+=3) [ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
  const positions=[...g.attributes.position.array,...mirrored.attributes.position.array];
  const normals=[...g.attributes.normal.array,...mirrored.attributes.normal.array];
  const indices=[...g.index.array,...mirrored.index.array].map((v,i)=>i<g.index.count?v:v+g.attributes.position.count);
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));out.setIndex(indices);
  g.dispose();mirrored.dispose();return out;
}
