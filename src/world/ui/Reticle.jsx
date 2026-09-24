import { armamentOf } from '../hardpoints.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { angleToScreen, dropLadder, reticleOf } from '../reticle.js';
import { aimNow, getAimScreen } from '../aimScreenStore.js';
import { HitFlash, KillFlash } from './HitMarker.jsx';

/** 전투 탈것의 조준선이다. 탄도와 생김새는 reticle.js 가 정하고 여기서는 그 값을
 * 픽셀 좌표로 옮겨 SVG 하나로 그린다. 계산을 이 파일에 두지 않는다.
 *
 * 고정 크기 SVG 를 절대 배치한다. viewBox 를 화면에 맞추면 종횡비에 따라 눈금 간격이
 * 틀어져 탄착점과 어긋난다. 세로 화각만 픽셀로 바꾸면 되므로 화면 높이만 읽는다.
 *
 * 자리는 화면 중앙이 아니라 포구가 실제로 가리키는 곳이다. CarMode 와 FlightMode 가
 * aimScreenStore 에 매 프레임 픽셀을 써 두고 여기서 rAF 루프로 읽어 루트 div 의 transform 만
 * 직접 바꾼다. 상태로 올리면 HUD 전체가 프레임마다 다시 렌더된다. */

const DEFAULT_FOV = 62;
/** 중앙 십자의 팔 길이와 가운데 빈 칸이다. 탄착점을 가리지 않을 만큼만 띄운다. */
const ARM = 12;
const GAP = 5;
/** 차량 조준선이 목표 자리를 따라잡는 빠르기다. 비행 조준선은 탄도 위치를 그대로 표시한다. */
const FOLLOW = 18;
/** 이 시간(ms) 넘게 새 값이 없으면 화면 중앙으로 돌아간다. 탈것에서 내렸거나 아직 첫 프레임이다. */
const STALE = 500;

function useViewportHeight() {
  const [height, setHeight] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight));
  useEffect(() => {
    const read = () => setHeight(window.innerHeight);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return height;
}

/** store 의 픽셀을 루트 div 의 transform 으로 옮기는 rAF 루프다. 비행 조준선은 즉시 붙고,
 * 차량 조준선은 지수 감쇠로 따라가 포탑 움직임을 부드럽게 보인다. */
function useAimFollow(active, immediate = false) {
  const root = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    let frame = 0, last = 0, x = null, y = null;
    const tick = (time) => {
      frame = requestAnimationFrame(tick);
      const node = root.current;
      if (!node) return;
      const aim = getAimScreen();
      // 묵은 값은 버린다. 조준선을 쓰지 않는 탈것으로 갈아타면 그대로 얼어붙는다.
      const fresh = aim.at > 0 && aimNow() - aim.at < STALE;
      const toX = fresh ? aim.x : window.innerWidth / 2;
      const toY = fresh ? aim.y : window.innerHeight / 2;
      const dt = last ? Math.min(0.1, (time - last) / 1000) : 0;
      last = time;
      if (immediate || x === null || !dt) { x = toX; y = toY; }
      else {
        const follow = 1 - Math.exp(-dt * FOLLOW);
        x += (toX - x) * follow; y += (toY - y) * follow;
      }
      // 정수로 맞춰 1.2px 선이 반 픽셀에 걸치지 않게 한다.
      node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      // 카메라 뒤를 겨누면 화면에 맺힐 자리가 없다. 가장자리에 붙여 두면 거짓말이 된다.
      node.style.visibility = fresh && aim.behind ? 'hidden' : '';
      node.dataset.clamped = fresh && aim.clamped ? 'true' : 'false';
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, immediate]);
  return root;
}

export default function Reticle({ kind, rideKey, status = {} }) {
  const spec = reticleOf(kind, rideKey);
  const height = useViewportHeight();
  const root = useAimFollow(!!spec, kind === 'flight');
  const fov = Number.isFinite(status.fov) ? status.fov : DEFAULT_FOV;

  const marks = useMemo(() => {
    if (!spec?.ladder?.length) return [];
    // 화면 아래로 넘어가는 눈금은 읽을 수 없으니 버린다.
    const limit = height / 2 - 40;
    return dropLadder(rideKey, spec.ladder)
      .map((mark) => ({ range: mark.range, y: Math.round(angleToScreen(mark.angle, fov, height)) }))
      .filter((mark) => Number.isFinite(mark.y) && mark.y > 0 && mark.y <= limit);
  }, [spec, rideKey, fov, height]);

  if (!spec) return null;

  const ring = spec.ring ? Math.round(Math.max(0, angleToScreen(spec.ring, fov, height))) : 0;
  const deepest = marks.length ? marks[marks.length - 1].y : 0;
  // 좌표를 정수로 맞춰 선이 반 픽셀에 걸치지 않게 한다.
  const cx = Math.round(Math.max(ring + 30, 58));
  const cy = Math.round(Math.max(deepest + 34, ring + 26, 46));
  const width = cx * 2, svgHeight = cy * 2;

  const impact = status.impact === 'building' || status.impact === 'none' ? status.impact : 'ground';
  const dry = status.cannonAmmo === 0;
  const hasRange = Number.isFinite(status.range);
  const footTop = Math.max(34, deepest + 22);

  // 적기에 명중한 누적 수와 격추, 파괴 누적 수다. 값이 바뀔 때만 표식이 다시 돈다.
  const hits = Number(status.airHits) || 0;
  const kills = Number(status.kills) || 0;
  // 배율 조준경을 쓰는 탈것만 배율 눈금을 그린다.
  const magnified = Array.isArray(status.scopeSteps) && Number.isFinite(status.scope);
  // 조준경 암전은 조준선 밖에 둔다. transform 이 걸린 조상은 position:fixed 자손의 기준
  // 상자가 되는데 조준선 껍데기는 크기가 0 이라 안에 두면 암전이 사라진다.
  return <>
    {magnified && status.scoped && <div className="wui-vehicle-scope" aria-hidden="true"><span /></div>}
    <div ref={root} className="wui-reticle" data-impact={impact} aria-hidden="true">
      <svg className="wui-reticle-svg" width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`}>
        {spec.type === 'pipper'
          ? <circle cx={cx} cy={cy} r="1.8" className="wui-reticle-dot" />
          : <g className="wui-reticle-cross">
            <line x1={cx - GAP - ARM} y1={cy} x2={cx - GAP} y2={cy} />
            <line x1={cx + GAP} y1={cy} x2={cx + GAP + ARM} y2={cy} />
            <line x1={cx} y1={cy - GAP - ARM} x2={cx} y2={cy - GAP} />
            <line x1={cx} y1={cy + GAP} x2={cx} y2={cy + GAP + ARM} />
          </g>}

        {ring > 0 && <circle cx={cx} cy={cy} r={ring} className="wui-reticle-ring"
          data-dash={spec.type === 'autocannon' ? 'true' : 'false'} data-dry={dry ? 'true' : 'false'} />}

        {/* 미사일 표식이다. 남아 있으면 사거리 원 양옆에 날개를 둔다. */}
        {kind === 'flight' && armamentOf(rideKey)?.missile?.length > 0 && spec.type === 'pipper' && Number.isFinite(status.missileAmmo) && <g className="wui-reticle-msl"
          data-dry={status.missileAmmo > 0 ? 'false' : 'true'}>
          <line x1={cx - ring - 7} y1={cy} x2={cx - ring - 2} y2={cy} />
          <line x1={cx + ring + 2} y1={cy} x2={cx + ring + 7} y2={cy} />
        </g>}

        {marks.map((mark) => <g key={mark.range} className="wui-reticle-mark">
          <line x1={cx - 9} y1={cy + mark.y} x2={cx + 9} y2={cy + mark.y} />
          <text x={cx + 13} y={cy + mark.y + 3.5}>{mark.range}</text>
        </g>)}

        <text x={cx + GAP + ARM + 6} y={cy - 10} className="wui-reticle-label">{spec.label}</text>
      {/* 분당 발사 수다. 연사 무기만 적는다. 눈금이 아니라 제원이라 조준선 아래 작은 글씨로 둔다. */}
      {status.roundsPerMinute > 200 && <text x={cx + GAP + ARM + 6} y={cy + 16} className="wui-reticle-label">{status.roundsPerMinute} RPM</text>}
      </svg>

      {/* 적기에 맞으면 조준선 중심에 흰 X 자가 한 번 번쩍인다. 격추, 파괴하면 빨간 X 자와
          해골이 함께 뜬다. 둘 다 누적 수를 key 로 걸어 값이 바뀔 때만 다시 마운트된다. */}
      <HitFlash count={hits} />
      <KillFlash count={kills} />

      {(hasRange || status.zoomed || magnified) && <div className="wui-reticle-foot" style={{ top: `${footTop}px` }}>
        {hasRange && <span className="wui-reticle-range">{Math.round(status.range)}M</span>}
        {/* 배율 조준경은 고정 ZOOM 대신 현재 배율을 적는다. V 로 단계를 올린다. */}
        {magnified ? <span className="wui-reticle-zoom" aria-label={`조준경 ${status.scope}배`}>{status.scope}X<kbd>V</kbd></span>
          : status.zoomed && <span className="wui-reticle-zoom">ZOOM</span>}
      </div>}
    </div>
  </>;
}
