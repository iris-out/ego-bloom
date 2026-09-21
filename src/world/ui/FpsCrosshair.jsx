import { usesRedDot } from '../weaponSights.js';
import { weaponSpec } from '../walkPhysics.js';
import { KillFlash } from './HitMarker.jsx';

/** 도보 모드의 조준선이다. 벌어짐은 walkPhysics 의 crosshairSpread 가 정하고
 * 여기서는 그 0~1 값을 픽셀 간격으로 옮겨 그린다. 계산을 이 파일에 두지 않는다.
 *
 * 저격총을 정조준하면 십자 대신 조준경을 씌운다. 격추 표식(HitMarker.jsx 의 KillFlash)은
 * 처치 수를 key 로 걸어 다시 마운트될 때마다 CSS 애니메이션이 한 번 돌고 사라진다. 도보는
 * 한 발 명중을 세지 않으므로 흰 명중 표식은 달지 않는다. 타이머를 두지 않는다.
 * 피격 방향 표식은 상태의 hurt 가 스스로 줄어드는 값이라 그대로 불투명도로 쓴다.
 * 기관단총을 정조준하면 십자 대신 도트 사이트 점 하나를 띄운다.
 * 산탄총은 십자 대신 pellet 이 퍼지는 자리를 원형 고리로 보여준다.
 */

/** 십자 팔 하나의 길이와 가장 좁을 때, 가장 넓을 때의 빈 칸이다. */
const ARM = 9, GAP_MIN = 4, GAP_MAX = 26;
/** 이 값보다 옅은 피격 표식은 그리지 않는다. */
const HURT_FLOOR = 0.06;
/** 산탄총 고리 반지름이다. pelletSpread(라디안) 를 화면 픽셀 폭으로 옮긴다.
 * 십자보다 눈에 띄게 넓어야 pellet 이 퍼진다는 것이 한눈에 보인다. */
const SHOTGUN_RADIUS_MIN = 30, SHOTGUN_RADIUS_MAX = 30 + weaponSpec('shotgun').pelletSpread * 260;

const ARMS = [
  { key: 'up', axis: 'y', sign: -1 },
  { key: 'down', axis: 'y', sign: 1 },
  { key: 'left', axis: 'x', sign: -1 },
  { key: 'right', axis: 'x', sign: 1 },
];

/** 저격 조준경이다. 바깥을 덮고 가는 십자와 거리 눈금만 남긴다. 명중하면 kills 가 바뀌어
 * 테두리가 한 번 붉게 번쩍인다. 화면을 총기 뷰모델 없이 이 조준경 하나로만 채운다. */
function Scope({ kills = 0 }) {
  return <div className="wui-scope" aria-hidden="true">
    <span className="wui-scope-mask" />
    {kills > 0 && <span key={kills} className="wui-scope-flash" />}
    <svg className="wui-scope-glass" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
      <circle cx="100" cy="100" r="98" className="wui-scope-ring" />
      <line x1="2" y1="100" x2="86" y2="100" />
      <line x1="114" y1="100" x2="198" y2="100" />
      <line x1="100" y1="2" x2="100" y2="86" />
      <line x1="100" y1="114" x2="100" y2="198" />
      <circle cx="100" cy="100" r="1.6" className="wui-scope-dot" />
      {[-40, -20, 20, 40].map((offset) => <line key={offset} x1="96" y1={100 + offset} x2="104" y2={100 + offset} />)}
    </svg>
  </div>;
}

/** 기관단총 도트 사이트다. 정조준하면 십자 대신 이 점 하나만 남는다.
 * 점은 총의 조준기 렌즈에 맺힌 것이라 산포에 따라 벌어지지 않는다. 고리는 렌즈 테두리다. */
function RedDot() {
  return <div className="wui-reddot" aria-hidden="true">
    <span className="wui-reddot-ring" />
    <span className="wui-reddot-core" />
  </div>;
}

/** 산탄총 조준선이다. pellet 이 퍼지는 자리를 원 하나로 보여준다. 십자의 벌어짐 값(0~1)
 * 을 그대로 써서 정조준, 이동, 반동에 따라 십자처럼 좁아지고 넓어진다.
 * 새 CSS 클래스를 만들지 않고 기존 wui-fps-dot 과 인라인 스타일만 쓴다. */
function PelletRing({ spread }) {
  const diameter = (SHOTGUN_RADIUS_MIN + Math.max(0, Math.min(1, spread)) * (SHOTGUN_RADIUS_MAX - SHOTGUN_RADIUS_MIN)) * 2;
  return <div className="wui-fps-cross" aria-hidden="true">
    <span className="wui-fps-dot" />
    <span style={{
      position: 'absolute', left: '50%', top: '50%', width: diameter, height: diameter,
      transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '2px solid currentColor',
      boxShadow: '0 0 0 1px color-mix(in srgb, var(--bg) 75%, transparent)',
    }} />
  </div>;
}

export default function FpsCrosshair({ spread = 0, aiming = false, weapon = 'pistol', hurt = 0, hurtFrom = 0, kills = 0 }) {
  const scoped = aiming && weapon === 'sniper';
  // 도트 사이트는 정조준에서만 뜬다. 허리 사격은 그대로 십자다.
  const dotted = aiming && usesRedDot(weapon);
  const pelleted = weapon === 'shotgun';
  const gap = Math.round(GAP_MIN + Math.max(0, Math.min(1, spread)) * (GAP_MAX - GAP_MIN));
  const wounded = Math.max(0, Math.min(1, hurt));

  return <div className="wui-fps-aim" aria-hidden="true" data-scoped={scoped ? 'true' : 'false'}>
    {scoped ? <Scope kills={kills} /> : dotted ? <RedDot /> : pelleted ? <PelletRing spread={spread} />
      : <div className="wui-fps-cross" data-aiming={aiming ? 'true' : 'false'}>
      <span className="wui-fps-dot" />
      {ARMS.map((arm) => <span key={arm.key} className="wui-fps-arm" data-axis={arm.axis}
        style={arm.axis === 'y'
          ? { height: ARM, transform: `translate(-50%, ${arm.sign * gap - (arm.sign < 0 ? ARM : 0)}px)` }
          : { width: ARM, transform: `translate(${arm.sign * gap - (arm.sign < 0 ? ARM : 0)}px, -50%)` }} />)}
    </div>}

    {/* 격추, 처치 표식이다. 조준경을 포함한 모든 조준선 모양 위에 공통으로 뜬다. */}
    <KillFlash count={kills} />

    {wounded > HURT_FLOOR && <span className="wui-fps-hurt"
      style={{ opacity: wounded, transform: `rotate(${hurtFrom * 180 / Math.PI}deg)` }}>
      <i />
    </span>}
  </div>;
}
