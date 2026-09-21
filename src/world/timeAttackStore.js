import { useSyncExternalStore } from 'react';
import { addTimeAttackScore, armTimeAttack, createTimeAttack, stepTimeAttack, timeAttackView } from './timeAttack.js';

/** 타임어택 한 판을 React state 밖에 둔다. 점수와 남은 시간을 R3F 프레임 루프가 쓰고
 * HUD 만 구독한다. WorldPage state 로 들면 도시 트리가 매초 다시 조정된다.
 * 판정은 timeAttack.js 의 순수 함수가 하고 여기서는 들고 알리기만 한다. */

let run = createTimeAttack();
let view = timeAttackView(run);
const listeners = new Set();

function publish() {
  const next = timeAttackView(run);
  // 남은 초와 점수, 단계가 그대로면 알리지 않는다. 매 프레임 알리면 HUD 가 60Hz 로 다시 그려진다.
  if (next.phase === view.phase && next.score === view.score && next.remaining === view.remaining) return;
  view = next;
  listeners.forEach((listener) => listener());
}

/** 카운트다운이 끝나면 부른다. 시작 시각은 첫 프레임이 찍는다. */
export function beginTimeAttack() {
  run = armTimeAttack();
  publish();
}

export function endTimeAttack() {
  run = createTimeAttack();
  publish();
}

/** 프레임마다 부른다. 판이 끝나는 순간도 여기서 잡힌다. */
export function tickTimeAttack(now) {
  run = stepTimeAttack(run, now);
  publish();
}

/** 탈것이나 항공기를 부순 만큼 부른다. */
export function scoreTimeAttack(count = 1) {
  run = addTimeAttackScore(run, count);
  publish();
}

export function getTimeAttack() {
  return view;
}

export function isTimeAttackRunning() {
  return run.phase === 'running' || run.phase === 'arming';
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTimeAttack() {
  return useSyncExternalStore(subscribe, getTimeAttack, getTimeAttack);
}
