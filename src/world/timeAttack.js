/** 타임어택 한 판이다. 판정은 순수 함수로 두고 화면과 조종 코드는 store 를 통해 읽는다.
 * 시계는 R3F 의 clock.elapsedTime 하나만 쓴다. setInterval 을 쓰면 탭이 백그라운드에 갔다
 * 올 때 남은 시간이 실제 경과와 어긋난다.
 */

/** 한 판의 길이다. */
export const TIME_ATTACK_SECONDS = 180;

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

export function createTimeAttack() {
  return { phase: 'off', startedAt: 0, score: 0, elapsed: 0 };
}

/** 판을 걸어 둔다. 시작 시각은 첫 프레임이 찍는다. 화면 시계와 조종 루프 시계가 달라
 * 여기서 시각을 받아 두면 남은 시간이 어긋난다. */
export function armTimeAttack() {
  return { phase: 'arming', startedAt: 0, score: 0, elapsed: 0 };
}

/** 시간을 흘린다. 판이 끝나면 phase 가 done 이 되고 점수는 그대로 남는다. */
export function stepTimeAttack(state, now) {
  if (!state) return createTimeAttack();
  // 시각이 이상하면 이번 프레임을 건너뛴다. 0 으로 보면 남은 시간이 통째로 되살아난다.
  if (!Number.isFinite(now)) return state;
  if (state.phase === 'arming') return { ...state, phase: 'running', startedAt: finite(now), elapsed: 0 };
  if (state.phase !== 'running') return state;
  const elapsed = Math.max(0, finite(now) - state.startedAt);
  if (elapsed >= TIME_ATTACK_SECONDS) return { ...state, phase: 'done', elapsed: TIME_ATTACK_SECONDS };
  return { ...state, elapsed };
}

/** 부순 만큼 점수를 올린다. 달리는 중이 아니면 점수를 세지 않는다. */
export function addTimeAttackScore(state, count = 1) {
  if (!state || state.phase !== 'running') return state || createTimeAttack();
  const added = Math.max(0, Math.round(finite(count)));
  return added ? { ...state, score: state.score + added } : state;
}

/** 화면이 읽는 값이다. 남은 시간은 초 단위로 올림해 1초가 두 번 보이지 않게 한다. */
export function timeAttackView(state) {
  const run = state || createTimeAttack();
  const remaining = Math.max(0, TIME_ATTACK_SECONDS - finite(run.elapsed));
  return { phase: run.phase, score: run.score, remaining: run.phase === 'done' ? 0 : Math.ceil(remaining) };
}

/** mm:ss 다. */
export function formatTimeAttack(seconds) {
  const total = Math.max(0, Math.round(finite(seconds)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
