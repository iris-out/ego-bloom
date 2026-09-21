/** 배치를 공간 타일로 쪼갠다. shape-material 조합마다 instancedMesh 하나를 만들면
 * boundingSphere 가 도시 전체를 감싸 three 의 per-mesh frustum culling 이 아무 것도
 * 걸러내지 못한다. 타일로 나누면 같은 코드가 좁은 구를 만든다.
 */

/** 타일 draw call 상한. Radeon 780M 실측에서 295 call 일 때 프레임이 28ms 로 묶였고
 * 삼각형은 43만으로 여유가 있었다. 통합 GPU 는 제출 횟수에 먼저 막히므로
 * 타일을 키워 삼각형을 조금 더 내고 call 을 줄이는 쪽이 빠르다. 셀 경계가 원점에
 * 고정돼 있어 타일이 도시보다 커도 사분면 넷으로는 나뉜다. 그 아래로는 못 내려간다.
 */
export const TILE_DRAW_BUDGET = 260;
// 타일 중심에서 모서리까지의 비율. 절반 대각선이다.
const TILE_REACH = Math.SQRT1_2;

const cellId = (tx, tz) => `${tx}.${tz}`;
const axis = (value, size) => Math.floor((Number.isFinite(value) ? value : 0) / size);
const safeSize = (size) => (Number.isFinite(size) && size > 0 ? size : 1);

/** 파트가 적은 배치는 타일로 쪼개도 잘려 나갈 게 없고 셀마다 draw call 만 하나씩 더 만든다.
 * 통째로 한 번 그리는 편이 싸다. tiled 는 타일링 대상이고 whole 은 항상 켜 두는 배치다.
 */
export const WHOLE_BATCH_PARTS = 400;
export function splitBatches(batches, minParts = WHOLE_BATCH_PARTS) {
  const tiled = {}, whole = [];
  for (const [key, batch] of Object.entries(batches || {})) {
    if (batch.parts.length >= minParts) tiled[key] = batch;
    else whole.push({ key, ...batch });
  }
  return { tiled, whole };
}

/** parts 를 position 의 X/Z 로 타일에 나눈다. 반환 순서는 입력이 같으면 항상 같다. */
export function tileBatches(batches, tileSize) {
  const size = safeSize(tileSize);
  const tiles = new Map();
  for (const batch of Array.isArray(batches) ? batches : Object.values(batches || {})) {
    for (const part of batch.parts) {
      const tx = axis(part.position?.[0], size), tz = axis(part.position?.[2], size);
      const key = `${batch.shape}-${batch.material}#${cellId(tx, tz)}`;
      let tile = tiles.get(key);
      if (!tile) tiles.set(key, tile = { key, shape: batch.shape, material: batch.material, tx, tz, parts: [],
        x: (tx + 0.5) * size, z: (tz + 0.5) * size, radius: size * TILE_REACH });
      tile.parts.push(part);
    }
  }
  return [...tiles.values()];
}

/** 단계별 타일을 같은 좌표끼리 묶는다. 모든 단계를 같은 tileSize 로 쪼갠 것이어야 한다.
 * cell.levels[i] 는 i 번째 상세 단계의 타일 배치들이다.
 */
export function tileCells(levels) {
  const cells = new Map();
  const cellOf = (tile) => {
    const id = cellId(tile.tx, tile.tz);
    let cell = cells.get(id);
    if (!cell) cells.set(id, cell = { key: id, tx: tile.tx, tz: tile.tz, x: tile.x, z: tile.z, radius: tile.radius,
      levels: levels.map(() => []) });
    return cell;
  };
  levels.forEach((tiles, index) => { for (const tile of tiles) cellOf(tile).levels[index].push(tile); });
  return [...cells.values()];
}

/** 파트의 좌표와 shape-material 키를 한 번만 뽑아 둔다. 예산 맞추기가 타일 크기를
 * 바꿔 가며 열 번까지 세므로, 그때마다 배치를 다시 순회하면 15만 파트를 열 번 훑게 된다.
 */
function partIndex(batches) {
  const list = Array.isArray(batches) ? batches : Object.values(batches || {});
  let count = 0;
  for (const batch of list) count += batch.parts.length;
  const x = new Float64Array(count), z = new Float64Array(count), key = new Int32Array(count);
  const keys = new Map();
  let at = 0;
  for (const batch of list) {
    const name = `${batch.shape}-${batch.material}`;
    let id = keys.get(name);
    if (id === undefined) keys.set(name, id = keys.size);
    for (const part of batch.parts) {
      const position = part.position;
      x[at] = Number.isFinite(position?.[0]) ? position[0] : 0;
      z[at] = Number.isFinite(position?.[2]) ? position[2] : 0;
      key[at] = id;
      at += 1;
    }
  }
  return { x, z, key, count, keyCount: keys.size };
}

// 셀 좌표 한 쌍을 숫자 하나로 접는다. 문자열 키를 만들지 않으려는 것이다.
const CELL_BIAS = 1 << 15, CELL_SPAN = 1 << 16;
const packCell = (tx, tz) => (tx + CELL_BIAS) * CELL_SPAN + (tz + CELL_BIAS);
const popcount = (value) => { let bits = value, total = 0; while (bits) { bits &= bits - 1; total += 1; } return total; };

/** 셀마다 등장하는 shape-material 가짓수를 센다. 그 수가 그 셀의 draw call 이다.
 * 키가 32가지 이하면 비트 하나로 모아 Set 할당을 피한다.
 */
function cellKeyCounts(index, size) {
  const counts = new Map();
  if (index.keyCount <= 32) {
    const masks = new Map();
    for (let i = 0; i < index.count; i += 1) {
      const id = packCell(axis(index.x[i], size), axis(index.z[i], size));
      masks.set(id, (masks.get(id) || 0) | (1 << index.key[i]));
    }
    for (const [id, mask] of masks) counts.set(id, popcount(mask));
    return counts;
  }
  const sets = new Map();
  for (let i = 0; i < index.count; i += 1) {
    const id = packCell(axis(index.x[i], size), axis(index.z[i], size));
    let keys = sets.get(id);
    if (!keys) sets.set(id, keys = new Set());
    keys.add(index.key[i]);
  }
  for (const [id, keys] of sets) counts.set(id, keys.size);
  return counts;
}

/** 한 화면에 동시에 켜질 수 있는 draw call 을 어림한다.
 * 근거리 반지름 안의 타일만 상세 배치를 그리고 나머지는 far 배치를 그린다.
 * 가장 배치가 많은 타일들이 한꺼번에 근거리에 들어온 경우를 최악으로 잡는다.
 */
function estimateFromIndex(near, tileSize, lodRadius, far) {
  const size = safeSize(tileSize);
  const nearCounts = cellKeyCounts(near, size);
  if (!nearCounts.size) return 0;
  const farCounts = far ? cellKeyCounts(far, size) : nearCounts;
  const reach = (Math.max(0, lodRadius) + size * TILE_REACH) / size;
  const budget = Math.ceil(Math.PI * reach * reach);
  // 상세로 켜졌을 때 가장 비싼 셀들이 한꺼번에 반경 안에 들어온 경우를 최악으로 잡는다.
  const extra = [...nearCounts].map(([id, keys]) => keys - (farCounts.get(id) ?? 0)).sort((a, b) => b - a);
  let calls = 0;
  for (const keys of farCounts.values()) calls += keys;
  for (let i = 0; i < Math.min(extra.length, budget); i++) calls += Math.max(0, extra[i]);
  return calls;
}

/** 먼 단계도 같은 모델이라 조합 수가 상자 몇 개로 줄지 않는다. 실제 far 배치를 넘겨
 * 세야 예산이 맞는다. 넘기지 않으면 near 와 같다고 보수적으로 잡는다.
 */
export function estimateDrawCalls(batches, tileSize, lodRadius, farBatches) {
  return estimateFromIndex(partIndex(batches), tileSize, lodRadius, farBatches ? partIndex(farBatches) : null);
}

/** 도시 크기에서 타일 크기를 유도하고, 예산을 넘으면 타일을 키운다.
 * extent 가 커져도 근거리 작업 집합이 예산 안에 들어오도록 스스로 조정한다.
 */
export function fitTileSize(batches, extent, lodRadius, budget = TILE_DRAW_BUDGET, farBatches) {
  const near = partIndex(batches);
  const far = farBatches ? partIndex(farBatches) : null;
  let size = Math.max(1, Number(extent) || 0) / 8;
  for (let step = 0; step < 10; step++) {
    if (estimateFromIndex(near, size, lodRadius, far) <= budget) break;
    size *= 1.5;
  }
  return size;
}

/* ---- 그림자 caster ----
 * 본 화면 배치는 그림자를 던지지 않고, 그림자 패스에는 절두체 근처 파트만 shape 별 instancedMesh
 * 하나씩으로 다시 담아 그린다. 깊이 패스는 색을 보지 않으므로 재질이 달라도 한 번에 그린다.
 * 본 화면 타일(한 변 2000 안팎) 과 도시 전체 배치를 그림자에 그대로 넣으면 절두체 밖 파트까지 그린다.
 */

/** 그림자를 던지지 않는 재질이다. 바닥으로 깔리거나 투명하거나 picking 용이다. */
export const NO_CAST_MATERIALS = Object.freeze(['pavement', 'ground', 'road', 'glass', 'water', 'pick']);
/** caster 격자 칸 크기다. 그림자 절두체가 움직이면 칸 단위로 들어오고 나간다. */
export const CASTER_CELL = 64;
// 이보다 얇고 낮게 깔린 조각의 그림자는 normalBias(0.3) 안에 묻혀 화면에 나오지 않는다.
const FLAT_HEIGHT = 0.3, FLAT_TOP = 0.8;
const UPRIGHT_SHAPES = new Set(['box', 'octagon', 'cylinder']);

function flatOnGround(shape, part) {
  if (Array.isArray(part.rotation) || !UPRIGHT_SHAPES.has(shape)) return false;
  const height = Math.abs(part.scale[1]);
  return height < FLAT_HEIGHT && part.position[1] + height / 2 < FLAT_TOP;
}

/** 배치 목록에서 그림자를 던질 파트를 칸과 shape 로 나눈다. 칸마다 파트를 감싸는 구를 둔다.
 * 반지름은 회전과 원시 도형의 단위(폭 1 또는 반지름 1)와 무관하게 넉넉히 잡는다. */
export function buildCasterIndex(batchLists, cell = CASTER_CELL) {
  const size = safeSize(cell);
  const cells = new Map(), shapes = new Set();
  for (const batch of batchLists) {
    if (!batch?.parts?.length || NO_CAST_MATERIALS.includes(batch.material)) continue;
    const shape = batch.shape, upright = UPRIGHT_SHAPES.has(shape);
    for (const part of batch.parts) {
      const position = part.position, scale = part.scale;
      const x = position[0], y = position[1], z = position[2], sx = scale[0], sy = scale[1], sz = scale[2];
      if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz))) continue;
      // 기울인 파트는 높이 방향도 옆으로 눕는다. 세 축을 다 넣어 잡는다.
      const tilted = Array.isArray(part.rotation);
      if (upright && !tilted && flatOnGround(shape, part)) continue;
      const tx = Math.floor(x / size), tz = Math.floor(z / size), id = packCell(tx, tz);
      let slot = cells.get(id);
      if (!slot) cells.set(id, slot = { id, x: (tx + 0.5) * size, z: (tz + 0.5) * size, bottom: Infinity, top: -Infinity, reach: 0, byShape: {} });
      const reach = tilted ? Math.sqrt(sx * sx + sy * sy + sz * sz) : Math.sqrt(sx * sx + sz * sz);
      const rise = tilted ? reach : Math.abs(sy);
      if (y - rise < slot.bottom) slot.bottom = y - rise;
      if (y + rise > slot.top) slot.top = y + rise;
      const dx = x - slot.x, dz = z - slot.z, far = Math.sqrt(dx * dx + dz * dz) + reach;
      if (far > slot.reach) slot.reach = far;
      const list = slot.byShape[shape];
      if (list) list.push(part); else slot.byShape[shape] = [part];
      shapes.add(shape);
    }
  }
  const list = [...cells.values()];
  for (const slot of list) {
    slot.y = (slot.top + slot.bottom) / 2;
    slot.radius = Math.hypot(slot.reach, (slot.top - slot.bottom) / 2);
  }
  return { cell: size, shapes: [...shapes].sort(), cells: list };
}

/** DirectionalLight 그림자 카메라의 직교 절두체다. WorldScene.SunLight 가 빛을 초점에서
 * direction*distance 에 두고 초점을 바라보게 하므로 같은 식으로 기저를 만든다. */
export function casterFrustum({ x, z, half, far, direction, distance = 320, near = 1 }) {
  const [dx, dy, dz] = direction;
  const length = Math.hypot(dx, dy, dz) || 1;
  const bx = dx / length, by = dy / length, bz = dz / length;
  // three 의 lookAt 과 같이 x 축은 up 과 빛 방향의 외적이다. 해가 천정에 있으면 X 축을 쓴다.
  let rx = bz, rz = -bx;
  const flat = Math.hypot(rx, rz);
  if (flat < 1e-6) { rx = 1; rz = 0; } else { rx /= flat; rz /= flat; }
  return {
    lx: x + dx * distance, ly: dy * distance, lz: z + dz * distance,
    fx: -bx, fy: -by, fz: -bz,
    rx, ry: 0, rz,
    // y 축은 빛 방향과 x 축의 외적이다.
    ux: by * rz, uy: bz * rx - bx * rz, uz: -by * rx,
    half, near, far,
  };
}

/** 구가 절두체(와 margin)에 닿는지 본다. three 의 절두체 판정과 같은 보수적 판정이다. */
export function sphereInCasterFrustum(frustum, cx, cy, cz, radius, margin = 0) {
  const vx = cx - frustum.lx, vy = cy - frustum.ly, vz = cz - frustum.lz;
  const pad = radius + margin;
  const depth = vx * frustum.fx + vy * frustum.fy + vz * frustum.fz;
  if (depth < frustum.near - pad || depth > frustum.far + pad) return false;
  if (Math.abs(vx * frustum.rx + vz * frustum.rz) > frustum.half + pad) return false;
  return Math.abs(vx * frustum.ux + vy * frustum.uy + vz * frustum.uz) <= frustum.half + pad;
}

export function selectCasterCells(index, frustum, margin = 0) {
  return index.cells.filter((slot) => sphereInCasterFrustum(frustum, slot.x, slot.y, slot.z, slot.radius, margin));
}

/** 파트 하나의 행렬을 out[offset..offset+15] 에 쓴다. WorldScene.Instances 와 같은 변환이다
 * (배열 회전은 YXZ, 숫자는 Y 축). Object3D 를 거치지 않아 수만 개를 바로 쓴다. */
export function composePart(part, out, offset) {
  const [px, py, pz] = part.position, [sx, sy, sz] = part.scale, rotation = part.rotation;
  if (Array.isArray(rotation)) {
    // Euler YXZ 를 풀어 쓴 회전 행렬이다. three 의 Matrix4.makeRotationFromEuler 와 같다.
    const a = Math.cos(rotation[0]), b = Math.sin(rotation[0]);
    const c = Math.cos(rotation[1]), d = Math.sin(rotation[1]);
    const e = Math.cos(rotation[2]), f = Math.sin(rotation[2]);
    const ce = c * e, cf = c * f, de = d * e, df = d * f;
    out[offset] = (ce + df * b) * sx; out[offset + 1] = a * f * sx; out[offset + 2] = (cf * b - de) * sx; out[offset + 3] = 0;
    out[offset + 4] = (de * b - cf) * sy; out[offset + 5] = a * e * sy; out[offset + 6] = (df + ce * b) * sy; out[offset + 7] = 0;
    out[offset + 8] = a * d * sz; out[offset + 9] = -b * sz; out[offset + 10] = a * c * sz; out[offset + 11] = 0;
  } else {
    const angle = Number(rotation) || 0, c = Math.cos(angle), s = Math.sin(angle);
    out[offset] = c * sx; out[offset + 1] = 0; out[offset + 2] = -s * sx; out[offset + 3] = 0;
    out[offset + 4] = 0; out[offset + 5] = sy; out[offset + 6] = 0; out[offset + 7] = 0;
    out[offset + 8] = s * sz; out[offset + 9] = 0; out[offset + 10] = c * sz; out[offset + 11] = 0;
  }
  out[offset + 12] = px; out[offset + 13] = py; out[offset + 14] = pz; out[offset + 15] = 1;
}

/** 고른 칸들에서 shape 하나의 파트 수를 센다. */
export function countCasters(cells, shape) {
  let total = 0;
  for (const slot of cells) total += slot.byShape[shape]?.length || 0;
  return total;
}

/** 고른 칸들의 shape 파트 행렬을 out 앞에서부터 채우고 개수를 돌려준다. */
export function fillCasters(cells, shape, out) {
  let at = 0;
  for (const slot of cells) {
    const parts = slot.byShape[shape];
    if (!parts) continue;
    for (const part of parts) { composePart(part, out, at * 16); at += 1; }
  }
  return at;
}

/* ---- 정적 행렬 ----
 * 움직이지 않는 가지는 행렬을 한 번만 계산해 두고 매 프레임 다시 만들지 않는다.
 * 장면 루트의 matrixAutoUpdate 도 꺼야 자식에게 강제 갱신이 내려가지 않는다(WorldScene).
 */

/** root 아래를 지금 자세로 고정한다. userData.dynamic 가지는 건너뛴다. props 로 자세가 바뀌면
 * 호출자가 다시 불러야 한다. */
export function freezeStatic(root) {
  if (!root) return;
  const walk = (node) => {
    if (node !== root && node.userData?.dynamic) return;
    node.updateMatrix();
    node.matrixAutoUpdate = false;
    for (const child of node.children) walk(child);
  };
  walk(root);
}

/** root 아래 노드의 자세와 보임, 재질의 움직이는 값을 적어 둔다. 몇 프레임 뒤 markMoved 로
 * 비교해 스스로 움직이는 가지(로터, 배기 불꽃)를 찾는다. */
export function snapshotPoses(root) {
  const poses = new Map();
  root.traverse((node) => {
    const material = node.material && !Array.isArray(node.material) ? node.material : null;
    poses.set(node, [
      node.position.x, node.position.y, node.position.z,
      node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
      node.scale.x, node.scale.y, node.scale.z, node.visible ? 1 : 0,
      material ? material.opacity : 0, material?.emissiveIntensity ?? 0,
    ]);
  });
  return poses;
}

/** snapshot 이후 달라진 노드에 userData.dynamic 을 단다. 표시된 노드 수를 돌려준다. */
export function markMoved(root, poses, epsilon = 1e-6) {
  let moved = 0;
  const now = snapshotPoses(root);
  for (const [node, after] of now) {
    const before = poses.get(node);
    if (node === root) continue;
    if (!before || after.some((value, i) => Math.abs(value - before[i]) > epsilon)) {
      node.userData.dynamic = true;
      moved += 1;
    }
  }
  return moved;
}
