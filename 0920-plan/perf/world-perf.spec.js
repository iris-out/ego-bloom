import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { buildWorld } from '../../shared/worldLayout.js';

/** 오픈월드 장면별 성능 측정. 결과는 results/<PERF_LABEL>.json 에 남는다.
 * PERF_SCENES=orbit,walk,car,flight 로 장면을 고르고 PERF_SECONDS 로 표본 길이를 정한다. */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LABEL = process.env.PERF_LABEL || 'run';
const SECONDS = Number(process.env.PERF_SECONDS) || 6;
const SCENES = (process.env.PERF_SCENES || 'orbit,walk,car,flight').split(',');
const QUALITY = process.env.PERF_QUALITY || 'medium';
const [VW, VH] = (process.env.PERF_VIEWPORT || '1440x900').split('x').map(Number);
const SAVE_PROFILE = !!process.env.PERF_SAVE_PROFILE;
// 시간대는 KST 실시간을 따른다. 밤에는 가로등 조명이 켜져 비용이 달라지므로 고정해서 잰다.
const TIME = process.env.PERF_TIME || '';

const tiers = ['Champion', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
const buildings = buildWorld(Array.from({ length: 1000 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  nickname: `제작자 ${i}`, handle: `creator${i}`,
  elo_score: (1000 - i) * 100000, tier_name: tiers[i % 7],
})));

const probe = () => {
  const perf = window.__perf = { frames: [], longTasks: [], links: 0, commits: {}, names: {}, busy: 0 };
  // React devtools hook 자리에 commit 계수기를 끼운다. react-dom 과 R3F reconciler 가 따로 inject 한다.
  let nextId = 1;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers: new Map(),
    inject(internals) { const id = nextId++; perf.names[id] = internals?.rendererPackageName || `r${id}`; return id; },
    onCommitFiberRoot(id) { perf.commits[id] = (perf.commits[id] || 0) + 1; },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, onScheduleFiberRoot() {}, checkDCE() {},
  };
  new PerformanceObserver((list) => perf.longTasks.push(...list.getEntries().map((e) => Math.round(e.duration))))
    .observe({ type: 'longtask', buffered: true });
  // 해상도 자동 조절이 캔버스를 다시 잡을 때마다 센다. 주행 중 잦으면 그대로 끊김이 된다.
  perf.resizes = [];
  const watchCanvas = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) { setTimeout(watchCanvas, 150); return; }
    let last = `${canvas.width}x${canvas.height}`;
    new MutationObserver(() => {
      const now = `${canvas.width}x${canvas.height}`;
      if (now !== last) { last = now; perf.resizes.push({ at: Math.round(performance.now()), size: now }); }
    }).observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  };
  watchCanvas();
  const counter = { draw: 0, tri: 0 };
  const P = window.WebGL2RenderingContext.prototype;
  const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { fn(a); return o.apply(this, a); }; };
  wrap('drawElements', (a) => { counter.draw++; counter.tri += a[1] / 3; });
  wrap('drawArrays', (a) => { counter.draw++; counter.tri += a[2] / 3; });
  wrap('drawElementsInstanced', (a) => { counter.draw++; counter.tri += (a[1] / 3) * a[4]; });
  wrap('drawArraysInstanced', (a) => { counter.draw++; counter.tri += (a[2] / 3) * a[3]; });
  wrap('linkProgram', () => { perf.links++; });
  // rAF 콜백 안에서 쓴 시간을 모은다. R3F 의 렌더 루프가 여기 들어간다.
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); try { cb(t); } finally { perf.busy += performance.now() - s; } });
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    perf.frames.push({ dt: now - last, draw: counter.draw, tri: counter.tri, busy: perf.busy });
    counter.draw = 0; counter.tri = 0; perf.busy = 0; last = now;
    raf(tick);
  };
  raf(tick);
};


/** 측정 중 다른 브라우저(사용자의 Chrome 등) 가 GPU 를 같이 쓰면 숫자가 몇 배씩 흔들린다.
 * 우리 Chromium 이 아닌 gpu-process 들의 CPU 시간을 표본 앞뒤로 읽어 경쟁 정도를 남긴다. */
function foreignGpuTicks() {
  if (os.platform() !== 'linux') return 0;
  let ticks = 0;
  for (const pid of fs.readdirSync('/proc').filter((name) => /^\d+$/.test(name))) {
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      // 측정용 Chromium 은 빼고 다른 브라우저의 GPU 프로세스만 센다.
      const exe = cmd.split('\0')[0];
      if (!cmd.includes('--type=gpu-process') || /chromium/.test(exe) || !/(chrome|firefox|msedge|brave)$/.test(exe)) continue;
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
      ticks += Number(stat[11]) + Number(stat[12]);
    } catch { /* 프로세스가 사라졌으면 건너뛴다 */ }
  }
  return ticks;
}

function summarizeProfile(profile, top = 18) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0)));
  const total = [...self.values()].reduce((a, b) => a + b, 0) || 1;
  const grouped = new Map();
  for (const [id, micros] of self) {
    const frame = byId.get(id).callFrame;
    const file = frame.url ? frame.url.split('/').pop().replace(/-[\w-]{8}\.js$/, '.js') : '';
    const key = `${frame.functionName || '(anon)'} ${file}${frame.url ? `:${frame.lineNumber + 1}` : ''}`;
    grouped.set(key, (grouped.get(key) || 0) + micros);
  }
  return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([key, micros]) => `${(micros / total * 100).toFixed(1).padStart(5)}% ${key}`);
}

async function sample(page, cdp, label, results) {
  await page.evaluate(() => { window.__perf.frames.length = 0; window.__perf.links = 0; window.__perf.commits = {}; window.__perf.longTasks.length = 0; });
  const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const foreign0 = foreignGpuTicks();
  await cdp.send('Profiler.start');
  await page.waitForTimeout(SECONDS * 1000);
  const foreignPct = +(((foreignGpuTicks() - foreign0) / 100 / SECONDS) * 100).toFixed(0);
  const { profile } = await cdp.send('Profiler.stop');
  const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const r = await page.evaluate(() => {
    const perf = window.__perf;
    const f = perf.frames.filter((x) => x.dt > 0 && x.dt < 3000);
    const n = f.length || 1;
    const sum = (k) => f.reduce((a, b) => a + b[k], 0);
    const dts = f.map((x) => x.dt).sort((a, b) => a - b);
    const at = (q) => +dts[Math.min(n - 1, Math.floor(n * q))].toFixed(1);
    const commits = Object.fromEntries(Object.entries(perf.commits).map(([id, c]) => [perf.names[id] || id, c]));
    return {
      fps: +(1000 / (sum('dt') / n)).toFixed(1), dtP50: at(0.5), dtP95: at(0.95), dtP99: at(0.99), dtMax: +dts[n - 1].toFixed(1),
      jank: f.filter((x) => x.dt > 33).length, rafBusyMs: +(sum('busy') / n).toFixed(2),
      draw: Math.round(sum('draw') / n), triK: +(sum('tri') / n / 1000).toFixed(0), links: perf.links,
      longTasks: perf.longTasks.length, commits, resizes: perf.resizes.length,
    };
  });
  const span = SECONDS;
  r.scriptPct = +(((after.ScriptDuration - before.ScriptDuration) / span) * 100).toFixed(1);
  r.stylePct = +((((after.RecalcStyleDuration - before.RecalcStyleDuration) + (after.LayoutDuration - before.LayoutDuration)) / span) * 100).toFixed(1);
  r.heapMB = +(after.JSHeapUsedSize / 1048576).toFixed(0);
  r.foreignGpuPct = foreignPct;
  r.top = summarizeProfile(profile);
  if (SAVE_PROFILE) {
    const dir = path.join(HERE, 'results', 'profiles');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${LABEL}-${label}.cpuprofile`), JSON.stringify(profile));
  }
  results[label] = r;
  const { top, ...line } = r;
  console.log(`PERF ${label} ${JSON.stringify(line)}\n  ${top.slice(0, 12).join('\n  ')}`);
}

async function boot(page) {
  await page.goto('/world');
  await page.locator('.world-stage[data-ready="true"]').waitFor({ timeout: 180000 });
  if (QUALITY !== 'medium' || TIME) {
    await page.getByRole('tab', { name: '설정' }).click();
    if (QUALITY !== 'medium') await page.getByLabel('그래픽 품질').selectOption(QUALITY);
    if (TIME) await page.getByLabel('시간대').selectOption(TIME);
    await page.getByRole('button', { name: '설정 닫기' }).click();
  }
  await page.waitForTimeout(2500);
}

async function ride(page, group, name, ready) {
  await page.getByRole('button', { name: '드라이브 시작, 단축키 스페이스바' }).click();
  const sheet = page.getByRole('dialog', { name: '탈것 선택' });
  await sheet.getByRole('tab', { name: new RegExp(group) }).click();
  await sheet.getByRole('button', { name: new RegExp(name) }).first().click();
  await sheet.getByRole('button', { name: '출발' }).click();
  await page.locator(ready).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
}

test('world perf', async ({ page }) => {
  const results = { meta: { label: LABEL, seconds: SECONDS, quality: QUALITY, time: TIME || 'kst', viewport: `${VW}x${VH}`, at: new Date().toISOString() } };
  await page.route('**/api/get-world-data', (r) => r.fulfill({ json: { buildings } }));
  await page.addInitScript(probe);
  // 실험 빌드만 읽는 구성요소 끄기 목록이다. 일반 빌드에서는 아무 일도 하지 않는다.
  await page.addInitScript((off) => { window.__perfOff = new Set(off ? off.split(',') : []); }, process.env.PERF_OFF || '');
  // 실험 빌드에서만 읽는다. LOD 전환을 멈춰 그 비용을 가려낸다.
  await page.addInitScript((flag) => { window.__noLod = flag === '1'; }, process.env.PERF_NO_LOD || '');
  await page.setViewportSize({ width: VW, height: VH });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });

  const t0 = Date.now();
  await boot(page);
  const info = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', longTasks: window.__perf.longTasks.filter((d) => d > 60), links: window.__perf.links };
  });
  results.boot = { readyMs: Date.now() - t0, ...info };
  console.log(`PERF boot ${JSON.stringify(results.boot)}`);

  if (SCENES.includes('orbit')) await sample(page, cdp, 'orbit_idle', results);

  if (SCENES.includes('walk') || SCENES.includes('walkidle')) {
    await ride(page, '도보', '도보', '.wui-fps');
    await sample(page, cdp, 'walk_idle', results);
  }
  if (SCENES.includes('walk')) {
    await page.keyboard.press('Digit3');
    await page.keyboard.down('KeyW');
    await page.mouse.move(VW / 2, VH / 2);
    await page.mouse.down();
    const sweep = (async () => { for (let i = 0; i < SECONDS * 20; i++) { await page.mouse.move(VW / 2 + Math.sin(i / 6) * VW * 0.15, VH / 2 + Math.cos(i / 9) * 40); await page.waitForTimeout(50); } })();
    await sample(page, cdp, 'walk_move_fire', results);
    await sweep;
    await page.mouse.up();
    await page.keyboard.up('KeyW');
    if (SCENES.includes('shotgun')) {
      // 산탄총은 한 번 누를 때 한 발이다. 펌프 간격보다 조금 길게 눌렀다 떼며 돌아본다.
      await page.keyboard.press('Digit5');
      await page.waitForTimeout(600);
      const volley = (async () => { for (let i = 0; i < SECONDS * 2; i++) {
        await page.mouse.move(VW / 2 + Math.sin(i / 3) * VW * 0.12, VH / 2);
        await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(440);
      } })();
      await sample(page, cdp, 'walk_shotgun', results);
      await volley;
    }
  }

  if (SCENES.includes('car')) {
    await boot(page);
    await ride(page, '차량', '세단', '.wui-hud-centre');
    await page.keyboard.down('KeyW');
    await sample(page, cdp, 'car3_drive', results);
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(1500);
    await sample(page, cdp, 'car1_drive', results);
    await page.keyboard.up('KeyW');
  }

  if (SCENES.includes('flight')) {
    await boot(page);
    await ride(page, '항공기', '라이트 제트', '.wui-hud-centre');
    await page.getByRole('slider', { name: /비행기 스로틀/ }).press('Home');
    await page.waitForTimeout(4000);
    await sample(page, cdp, 'flight_takeoff', results);
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(1500);
    await sample(page, cdp, 'flight1', results);
  }

  const dir = path.join(HERE, 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${LABEL}.json`), JSON.stringify(results, null, 2));
});
