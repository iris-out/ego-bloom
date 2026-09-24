import { MAX_RPM, REDLINE_RPM } from '../carGauges.js';

// Canvas dimensions follow the physical screen proportions in the three cabins.
export const BRAND_CLUSTER_SIZE = Object.freeze({
  coupeClassic: Object.freeze({ width: 512, height: 218 }),
  teslaDriver: Object.freeze({ width: 512, height: 202 }),
  ferrariTach: Object.freeze({ width: 512, height: 229 }),
});

const valid = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const clamp = (value, max) => Math.max(0, Math.min(max, value));
const display = value => valid(value) ? String(Math.round(Number(value))) : '—';
const gear = value => value === null || value === undefined || value === '' ? '—' : String(value).slice(0, 2);
const angle = ratio => Math.PI * .78 + clamp(ratio, 1) * Math.PI * 1.44;

function face(ctx, x, y, radius, fill, ring) {
  ctx.beginPath(); ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = '#080a0c'; ctx.fill();
  ctx.strokeStyle = ring; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#667078'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
}

function ticks(ctx, x, y, radius, count, color, redFrom = count + 1) {
  for (let index = 0; index <= count; index++) {
    const a = angle(index / count);
    const major = index % 2 === 0;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (radius - (major ? 15 : 10)), y + Math.sin(a) * (radius - (major ? 15 : 10)));
    ctx.lineTo(x + Math.cos(a) * (radius - 5), y + Math.sin(a) * (radius - 5));
    ctx.strokeStyle = index >= redFrom ? '#e94d40' : color;
    ctx.lineWidth = major ? 2.6 : 1.5;
    ctx.stroke();
  }
}

function needle(ctx, x, y, radius, value, max, color) {
  if (!valid(value)) return;
  const a = angle(Number(value) / max);
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * 12, y - Math.sin(a) * 12);
  ctx.lineTo(x + Math.cos(a) * (radius - 22), y + Math.sin(a) * (radius - 22));
  ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

function type(ctx, value, x, y, size, color, align = 'center', maxWidth) {
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px sans-serif`;
  ctx.fillText(value, x, y, maxWidth);
}

export function drawCoupeClassic(ctx, status = {}) {
  const speed = valid(status.speed) ? Math.max(0, Number(status.speed)) : null;
  const rated = valid(status.top) && Number(status.top) > 0 ? Number(status.top) * 3.6 : 280;
  const top = Math.max(240, Math.ceil(rated / 40) * 40);
  const rpm = valid(status.rpm) ? Math.max(0, Number(status.rpm)) : null;
  for (const [x, value, maximum, unit] of [[137, speed, top, 'KM/H'], [375, rpm, MAX_RPM, 'RPM']]) {
    face(ctx, x, 110, 86, '#0e1318', '#c6cbd0');
    ticks(ctx, x, 110, 86, 20, '#d5d8d9', unit === 'RPM' ? Math.ceil(REDLINE_RPM / MAX_RPM * 20) : 21);
    for (let step = 0; step <= 4; step++) {
      const a = angle(step / 4);
      const number = unit === 'RPM' ? String(step * 2) : String(Math.round(maximum * step / 4));
      type(ctx, number, x + Math.cos(a) * 61, 114 + Math.sin(a) * 61, 13,
        unit === 'RPM' && step === 4 ? '#e9685e' : '#c9ced0');
    }
    needle(ctx, x, 110, 86, value, maximum, '#f05b47');
    type(ctx, unit === 'RPM' && value !== null ? (value / 1000).toFixed(1) : display(value), x, 143, 29, '#f5f4ed', 'center', 90);
    type(ctx, unit === 'RPM' ? '×1000 RPM' : unit, x, 164, 12, '#9ea8ae');
  }
  ctx.fillStyle = '#111d25'; ctx.fillRect(222, 48, 68, 124);
  ctx.strokeStyle = '#6e8795'; ctx.lineWidth = 1.5; ctx.strokeRect(222, 48, 68, 124);
  type(ctx, 'GEAR', 256, 77, 13, '#a1b5bf');
  type(ctx, gear(status.gear), 256, 114, 34, '#eaf2f5');
  type(ctx, 'HDG', 256, 140, 12, '#a1b5bf');
  type(ctx, valid(status.heading) ? String(((Math.round(Number(status.heading)) % 360) + 360) % 360).padStart(3, '0') : '—', 256, 160, 19, '#d9e8ef');
}

export function drawTeslaDriver(ctx, status = {}) {
  // The curved lane graphic is a decorative vehicle orientation cue. It conveys no sensor state.
  ctx.strokeStyle = '#1d3945'; ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(256 + side * 52, 187);
    ctx.bezierCurveTo(256 + side * 42, 139, 256 + side * 31, 98, 256 + side * 24, 45);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(244, 160); ctx.bezierCurveTo(243, 149, 244, 132, 249, 119);
  ctx.quadraticCurveTo(256, 111, 263, 119);
  ctx.bezierCurveTo(268, 132, 269, 149, 268, 160);
  ctx.quadraticCurveTo(267, 177, 256, 178);
  ctx.quadraticCurveTo(245, 177, 244, 160);
  ctx.closePath(); ctx.fillStyle = '#b5c6cc'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(248, 136); ctx.quadraticCurveTo(256, 129, 264, 136);
  ctx.lineTo(265, 150); ctx.quadraticCurveTo(256, 154, 247, 150);
  ctx.closePath(); ctx.fillStyle = '#476371'; ctx.fill();
  ctx.fillStyle = '#1b2d36';
  for (const wheelX of [239, 270]) for (const wheelY of [141, 164]) ctx.fillRect(wheelX, wheelY, 3, 8);
  ctx.fillStyle = '#be4c4c'; ctx.fillRect(247, 172, 4, 2); ctx.fillRect(261, 172, 4, 2);
  type(ctx, display(status.speed), 103, 119, 86, '#f0f6f7', 'center', 166);
  type(ctx, 'KM/H', 103, 148, 20, '#8ba7b1');
  type(ctx, 'DRIVE', 408, 69, 17, '#8ba7b1');
  type(ctx, gear(status.gear), 408, 120, 58, '#edf4f5');
  ctx.fillStyle = '#243b45'; ctx.fillRect(344, 160, 128, 6);
  const power = valid(status.power) ? Math.max(-1, Math.min(1, Number(status.power))) : null;
  ctx.fillStyle = '#67808b'; ctx.fillRect(408, 154, 2, 18);
  if (power !== null) {
    ctx.fillStyle = power < 0 ? '#5dbb87' : '#e7eef0';
    const length = Math.abs(power) * 62;
    ctx.fillRect(power < 0 ? 408 - length : 410, 160, length, 6);
  }
  type(ctx, power === null ? 'POWER —' : `${power < 0 ? 'REGEN' : 'POWER'} ${Math.round(Math.abs(power) * 100)}%`, 408, 194, 15, '#a8c4ce');
}

export function drawFerrariTach(ctx, status = {}) {
  const x = 256, y = 117, radius = 101;
  face(ctx, x, y, radius, '#edca36', '#35383a');
  const dialMax = valid(status.dialMaxRpm) && Number(status.dialMaxRpm) > 0 ? Number(status.dialMaxRpm) : 10000;
  const engineMax = valid(status.maxRpm) && Number(status.maxRpm) > 0 ? Number(status.maxRpm) : 8500;
  const redline = valid(status.redlineRpm) ? Number(status.redlineRpm) : 8000;
  ticks(ctx, x, y, radius, 40, '#343031', Math.ceil(redline / dialMax * 40));
  for (let mark = 0; mark <= 10; mark++) {
    const a = angle(mark / 10);
    type(ctx, String(mark * dialMax / 10000), x + Math.cos(a) * 72, y + Math.sin(a) * 72 + 5, 15,
      mark * dialMax / 10 >= redline ? '#a21e1a' : '#302a21');
  }
  const rpm = valid(status.rpm) ? clamp(Number(status.rpm), engineMax) : null;
  needle(ctx, x, y, radius, rpm, dialMax, '#d21d23');
  ctx.fillStyle = '#2b2926'; ctx.fillRect(228, 153, 56, 36);
  type(ctx, gear(status.gear), x, 181, 30, '#f6e8c5');
  type(ctx, 'SPEED', 76, 83, 17, '#aeb3b1');
  type(ctx, display(status.speed), 76, 135, 55, '#f4f2e8', 'center', 130);
  type(ctx, 'KM/H', 76, 164, 16, '#aeb3b1');
  type(ctx, 'RPM', 439, 83, 17, '#aeb3b1');
  type(ctx, rpm === null ? '—' : display(rpm), 439, 137, 34, '#f4f2e8');
  type(ctx, '×1000', x, 207, 14, '#463a25');
}
