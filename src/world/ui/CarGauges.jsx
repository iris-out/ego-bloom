import { MAX_RPM, REDLINE_RPM, gaugeTicks, needleAngle, tachometer } from '../carGauges.js';

/** 3인칭 주행 계기다. 화면 왼쪽 아래에 속도계와 회전계 두 개를 나란히 둔다.
 * 숫자와 바늘 각도는 carGauges.js 가 정한다. 여기서는 SVG 로 옮기기만 한다.
 *
 * 회전수는 주행 물리에 없는 값이라 속도에서 만든 파생값이다. 계기 이름 옆에 그 사실을 적는다.
 */

const SIZE = 104, CENTRE = 50, RADIUS = 40;

function polar(angle, radius) {
  const radians = (angle * Math.PI) / 180;
  return { x: CENTRE + Math.cos(radians) * radius, y: CENTRE + Math.sin(radians) * radius };
}

/** 계기 하나다. 눈금과 바늘, 가운데 숫자를 그린다. warn 은 경고 구간 시작 비율이다. */
function Gauge({ label, unit, value, max, ticks = 6, warn = null, digits = 0 }) {
  const marks = gaugeTicks(max, ticks);
  const angle = needleAngle(value, max);
  const tip = polar(angle, RADIUS - 8);
  const reading = Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  return <div className="wui-gauge">
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="meter"
      aria-label={`${label} ${reading}${unit}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number(value) || 0}>
      <circle cx={CENTRE} cy={CENTRE} r={RADIUS} className="wui-gauge-face" />
      {marks.map((mark) => {
        const outer = polar(mark.angle, RADIUS - 2);
        const inner = polar(mark.angle, RADIUS - 10);
        const hot = warn !== null && mark.value >= warn;
        return <g key={mark.value}>
          <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className={hot ? 'wui-gauge-tick-warn' : 'wui-gauge-tick'} />
          <text x={polar(mark.angle, RADIUS - 18).x} y={polar(mark.angle, RADIUS - 18).y + 3} className="wui-gauge-mark">
            {max > 1000 ? Math.round(mark.value / 1000) : mark.value}
          </text>
        </g>;
      })}
      <line x1={CENTRE} y1={CENTRE} x2={tip.x} y2={tip.y} className="wui-gauge-needle" />
      <circle cx={CENTRE} cy={CENTRE} r="3.5" className="wui-gauge-hub" />
    </svg>
    <b>{reading}</b>
    <span>{label}<i>{unit}</i></span>
  </div>;
}

export default function CarGauges({ status = {} }) {
  const speed = Math.max(0, Math.round(Number(status.speed) || 0));
  // top 은 m/s 다. 계기는 km/h 로 읽으므로 눈금 끝도 km/h 로 맞춘다.
  const top = Math.max(40, Math.round((Number(status.top) || 62) * 3.6));
  const fallback = tachometer(speed, top);
  const rpm = Number.isFinite(Number(status.rpm)) ? Number(status.rpm) : fallback.rpm;
  const gear = status.gear === 'R' ? 'R' : (Number.isInteger(status.gear) ? status.gear : fallback.gear);

  return <div className="wui-gauges" aria-label="주행 계기">
    <Gauge label="SPEED" unit="km/h" value={speed} max={top} ticks={7} />
    <Gauge label="RPM" unit="×1000" value={rpm} max={MAX_RPM} ticks={9} warn={REDLINE_RPM} />
    <div className="wui-gauges-side">
      <span className="wui-gauges-gear" data-reverse={gear === 'R' ? 'true' : 'false'}>
        <b>{gear}</b>{gear === 'R' ? '후진' : '단'}
      </span>
      <span className="wui-gauges-heading"><b>{String(Math.round(Number(status.heading) || 0)).padStart(3, '0')}</b>HDG</span>
      {status.braking && <span className="wui-gauges-brake">BRAKE</span>}
    </div>
  </div>;
}
