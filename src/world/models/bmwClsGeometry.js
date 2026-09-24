import * as THREE from 'three';
import { loftBody } from './carGeometry.js';

const CARS = {
  convertible: {
    nose: -2.40, tail: 2.40, sill: -.62, shoulder: .13, bodyWidth: 1.065,
    wheels: [-1.52, 1.37], radius: .40, wheelY: -.50,
    hood: [
      { z: -2.40, width: .96, lowerY: -.58, shoulderY: -.02, topWidth: .83, topY: .14, crown: .025 },
      { z: -2.16, width: 1.02, lowerY: -.62, shoulderY: .08, topWidth: .85, topY: .22, crown: .034 },
      { z: -1.45, width: 1.04, lowerY: -.62, shoulderY: .12, topWidth: .84, topY: .25, crown: .036 },
      { z: -1.04, width: 1.015, lowerY: -.61, shoulderY: .14, topWidth: .82, topY: .19, crown: .024 },
    ],
    deck: [
      { z: 1.34, width: 1.04, lowerY: -.62, shoulderY: .18, topWidth: .80, topY: .20, crown: .020 },
      { z: 1.80, width: 1.055, lowerY: -.62, shoulderY: .17, topWidth: .88, topY: .21, crown: .018 },
      { z: 2.29, width: .97, lowerY: -.58, shoulderY: .06, topWidth: .86, topY: .18, crown: .014 },
      { z: 2.40, width: .93, lowerY: -.54, shoulderY: .02, topWidth: .83, topY: .13, crown: .008 },
    ],
  },
  coupe: {
    nose: -2.51, tail: 2.51, sill: -.62, shoulder: .18, bodyWidth: 1.095,
    wheels: [-1.55, 1.43], radius: .42, wheelY: -.48,
    hood: [
      { z: -2.51, width: .96, lowerY: -.57, shoulderY: -.01, topWidth: .87, topY: .14, crown: .018 },
      { z: -2.26, width: 1.02, lowerY: -.62, shoulderY: .08, topWidth: .88, topY: .19, crown: .025 },
      { z: -1.55, width: 1.065, lowerY: -.62, shoulderY: .17, topWidth: .87, topY: .25, crown: .028 },
      { z: -1.09, width: 1.04, lowerY: -.62, shoulderY: .20, topWidth: .86, topY: .22, crown: .015 },
    ],
    deck: [
      { z: 1.50, width: 1.04, lowerY: -.62, shoulderY: .19, topWidth: .84, topY: .18, crown: .013 },
      { z: 1.93, width: 1.07, lowerY: -.62, shoulderY: .15, topWidth: .91, topY: .19, crown: .015 },
      { z: 2.25, width: 1.01, lowerY: -.59, shoulderY: .11, topWidth: .91, topY: .20, crown: .012 },
      { z: 2.51, width: .94, lowerY: -.54, shoulderY: .01, topWidth: .85, topY: .12, crown: .008 },
    ],
  },
};

function sample(rows, z) {
  if (z <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    if (z <= rows[i][0]) {
      const t = (z - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]);
      return rows[i - 1][1] * (1 - t) + rows[i][1] * t;
    }
  }
  return rows.at(-1)[1];
}

function sideSkin(spec) {
  const positions = [], indices = [];
  const zCount = 96, yCount = 8;
  const upper = [
    [spec.nose, .025], [spec.wheels[0] - .38, .105],
    [spec.wheels[0] + .42, spec.shoulder],
    [spec.wheels[1] - .43, spec.shoulder + .025],
    [spec.wheels[1] + .41, .135], [spec.tail, .015],
  ];
  const width = [
    [spec.nose, .94], [spec.wheels[0], spec.bodyWidth],
    [-1.00, spec.bodyWidth - .02], [1.20, spec.bodyWidth - .01],
    [spec.wheels[1], spec.bodyWidth], [spec.tail, .93],
  ];
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= zCount; i++) {
      const z = spec.nose + (spec.tail - spec.nose) * i / zCount;
      let lower = spec.sill;
      for (const wheelZ of spec.wheels) {
        const dz = z - wheelZ, cut = spec.radius + .052;
        if (Math.abs(dz) < cut) lower = Math.max(lower, spec.wheelY + Math.sqrt(cut * cut - dz * dz));
      }
      const top = sample(upper, z);
      for (let j = 0; j <= yCount; j++) {
        const t = j / yCount;
        const y = lower + (top - lower) * t;
        const flare = spec.wheels.reduce((sum, wheelZ) => sum + .024 * Math.exp(-(((z - wheelZ) / .38) ** 2)), 0);
        const convex = .04 * Math.sin(Math.PI * t) + flare * Math.sin(Math.PI * t);
        positions.push(side * (sample(width, z) - .055 * (1 - t) ** 2 + convex), y, z);
      }
    }
    for (let i = 0; i < zCount; i++) for (let j = 0; j < yCount; j++) {
      const a = base + i * (yCount + 1) + j, b = a + 1, c = a + yCount + 1, d = c + 1;
      if (side === 1) indices.push(a, b, d, a, d, c);
      else indices.push(a, d, b, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createBmwClsBody(key) {
  const spec = CARS[key];
  if (!spec) throw new Error(`Unknown body: ${key}`);
  const floor = new THREE.BoxGeometry(1.78, .065, key === 'coupe' ? 2.59 : 2.38);
  floor.translate(0, -.653, key === 'coupe' ? .205 : .15);
  return {
    hood: loftBody(spec.hood),
    deck: loftBody(spec.deck),
    sides: sideSkin(spec),
    floor,
  };
}
