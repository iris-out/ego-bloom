/** 미사일 포착 네모의 화면 좌표를 React 밖에 둔 store 다. FlightMode 가 매 프레임 여기에 쓰고
 * DOM 네모가 requestAnimationFrame 루프에서 읽는다. aimScreenStore 와 같은 계약이라
 * 구독자를 두지 않는다. 읽는 쪽이 이미 프레임 루프를 돌고 있다. */

// 같은 객체를 계속 덮어쓴다. 프레임마다 새 객체를 만들면 60Hz 로 쓰레기가 쌓인다.
const lock = { x: 0, y: 0, progress: 0, locked: false, range: 0, behind: true, at: 0 };

export function lockNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

export function setLockScreen(next) {
  lock.x = Number.isFinite(next?.x) ? next.x : 0;
  lock.y = Number.isFinite(next?.y) ? next.y : 0;
  lock.progress = Math.max(0, Math.min(1, Number(next?.progress) || 0));
  lock.locked = !!next?.locked;
  lock.range = Math.max(0, Math.round(Number(next?.range) || 0));
  lock.behind = !!next?.behind;
  lock.at = Number.isFinite(next?.at) ? next.at : lockNow();
  return lock;
}

/** 목표를 놓았거나 탈것에서 내릴 때 부른다. at 이 0 이면 읽는 쪽이 네모를 지운다. */
export function clearLockScreen() {
  lock.progress = 0; lock.locked = false; lock.behind = true; lock.at = 0;
}

export function getLockScreen() {
  return lock;
}
