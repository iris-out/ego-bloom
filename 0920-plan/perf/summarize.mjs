import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** compare.sh 가 남긴 before/after 결과를 장면별 중앙값으로 묶어 표로 찍는다.
 * 외부 GPU 경쟁이 있던 표본(foreignGpuPct > 5) 은 빼고 몇 개를 뺐는지 적는다. */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [label, rounds = '2'] = process.argv.slice(2);
const FIELDS = ['fps', 'dtP50', 'dtP95', 'dtP99', 'rafBusyMs', 'draw', 'triK', 'links'];
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const load = (side) => Array.from({ length: Number(rounds) }, (_, i) => {
  const file = path.join(HERE, 'results', `${label}-${side}-${i + 1}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}).filter(Boolean);

const sides = { before: load('before'), after: load('after') };
const scenes = [...new Set(Object.values(sides).flat().flatMap((run) => Object.keys(run).filter((k) => !['meta', 'boot'].includes(k))))];
const rows = [];
for (const scene of scenes) {
  const row = { scene };
  for (const [side, runs] of Object.entries(sides)) {
    const clean = runs.map((run) => run[scene]).filter((sample) => sample && !(sample.foreignGpuPct > 5));
    row[`${side}N`] = clean.length;
    for (const field of FIELDS) row[`${side}.${field}`] = median(clean.map((sample) => sample[field]));
  }
  rows.push(row);
}
const header = ['장면', 'n', ...FIELDS.map((f) => `${f} 전`), ...FIELDS.map((f) => `${f} 후`)];
console.log(`| ${header.join(' | ')} |`);
console.log(`|${header.map(() => '---').join('|')}|`);
for (const row of rows) {
  const cells = [row.scene, `${row.beforeN}/${row.afterN}`,
    ...FIELDS.map((f) => row[`before.${f}`]), ...FIELDS.map((f) => row[`after.${f}`])];
  console.log(`| ${cells.map((c) => (typeof c === 'number' ? +c.toFixed(1) : c)).join(' | ')} |`);
}
fs.writeFileSync(path.join(HERE, 'results', `${label}-summary.json`), JSON.stringify(rows, null, 2));
