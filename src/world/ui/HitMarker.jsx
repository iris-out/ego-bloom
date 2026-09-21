/** 명중, 격추 표식 공용 조각이다. Reticle(대공포, 전투기 기관총) 과 FpsCrosshair(도보,
 * 저격 조준경) 가 함께 쓴다. count 를 key 로 걸어 값이 바뀔 때만 다시 마운트하고 수명은
 * CSS 애니메이션이 맡는다. 타이머를 두지 않는다. count 가 0 이거나 숫자가 아니면 아무것도
 * 그리지 않는다(첫 렌더에서 뜨지 않고, 이미 뜬 값이 그대로면 다시 뜨지 않는다).
 *
 * 부모는 조준점을 기준으로 한 0 크기 상자여야 한다(.wui-reticle, .wui-fps-aim, .wui-scope
 * 가 이미 그렇게 돼 있다). 색은 world-ui.css 의 토큰과 기존 조준선 관례를 따른다. */

/** 중심에서 바깥으로 뻗는 X 자 사선 네 개를 만든다. reach 가 팔 끝, gap 이 중심의 빈 칸이다. */
function crossArms(reach, gap) {
  return [
    [-reach, -reach, -gap, -gap],
    [reach, -reach, gap, -gap],
    [-reach, reach, -gap, gap],
    [reach, reach, gap, gap],
  ];
}

const HIT_ARMS = crossArms(9, 3);
const KILL_ARMS = crossArms(12, 4);

/** 해골 실루엣이다. 곡선 없이 직선과 evenodd 구멍만 써서 작은 크기에서도 깨지지 않는다.
 * 첫 하위 경로가 머리와 턱, 나머지 세 개가 눈 두 개와 코 구멍이다. */
const SKULL_D = 'M5,2 L11,2 L13,4 L13,8 L11,10 L11,11 L10,11 L10,12 L9,12 L9,13 L7,13 L7,12 L6,12 '
  + 'L6,11 L5,11 L5,10 L3,8 L3,4 Z M5,5 L7,5 L7,7 L5,7 Z M9,5 L11,5 L11,7 L9,7 Z M7.3,8 L8.7,8 L8,9.5 Z';

/** 적기에 한 발 맞을 때마다 짧게 뜨는 흰 표식이다. 오버워치의 히트마커를 잇는다. */
export function HitFlash({ count }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return <svg key={n} className="wui-hitmark wui-hitmark-hit" width="24" height="24"
    viewBox="-12 -12 24 24" aria-hidden="true">
    {HIT_ARMS.map((arm, i) => <line key={i} x1={arm[0]} y1={arm[1]} x2={arm[2]} y2={arm[3]} />)}
  </svg>;
}

/** 격추, 파괴 때 뜨는 표식이다. 빨간 X 자와 그 위로 떠올랐다 사라지는 작은 해골을 함께 낸다.
 * 도보, 탈것, 저격 조준경 어디서든 kills 가 오르면 같은 모양이 뜬다. */
export function KillFlash({ count }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return <span key={n} className="wui-killmark" aria-hidden="true">
    <svg className="wui-hitmark wui-hitmark-kill" width="32" height="32" viewBox="-16 -16 32 32">
      {KILL_ARMS.map((arm, i) => <line key={i} x1={arm[0]} y1={arm[1]} x2={arm[2]} y2={arm[3]} />)}
    </svg>
    <svg className="wui-killmark-skull" width="16" height="16" viewBox="0 0 16 16">
      <path d={SKULL_D} fillRule="evenodd" />
    </svg>
  </span>;
}
