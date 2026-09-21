/** 조준선의 화면 좌표를 React 밖에 둔 store 다. CarMode 와 FlightMode 가 매 프레임 여기에 쓰고
 * DOM 조준선이 requestAnimationFrame 루프에서 읽는다. 프레임마다 state 로 올리면 HUD 전체가
 * 같은 주기로 다시 렌더된다. rideStatusStore 와 달리 구독자도 두지 않는다. 읽는 쪽이 이미
 * 프레임 루프를 돌고 있어 알림이 필요 없다. */

// 같은 객체를 계속 덮어쓴다. 프레임마다 새 객체를 만들면 60Hz 로 쓰레기가 쌓인다.
const aim = { x: 0, y: 0, behind: true, clamped: false, at: 0 };

/** 쓰는 쪽과 읽는 쪽이 같은 시계를 봐야 값이 얼마나 묵었는지 잴 수 있다.
 * performance 가 없는 환경(node 테스트) 에서는 Date 로 떨어진다. */
export function aimNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

export function setAimScreen(next) {
  aim.x = Number.isFinite(next?.x) ? next.x : 0;
  aim.y = Number.isFinite(next?.y) ? next.y : 0;
  aim.behind = !!next?.behind;
  aim.clamped = !!next?.clamped;
  aim.at = Number.isFinite(next?.at) ? next.at : aimNow();
  return aim;
}

/** 탈것에서 내릴 때 부른다. at 이 0 이면 읽는 쪽이 값을 버리고 화면 중앙으로 돌아간다. */
export function clearAimScreen() {
  aim.behind = true; aim.clamped = false; aim.at = 0;
}

export function getAimScreen() {
  return aim;
}
