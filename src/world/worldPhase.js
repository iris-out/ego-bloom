/** 오픈월드 진입 상태 기계다. 카메라, Three, React 에 의존하지 않는다.
 * WorldPage 는 이 리듀서의 결과를 렌더에만 쓴다. */

export const PHASES = ['establishing', 'exploring', 'selecting', 'countdown', 'driving'];
export const COUNTDOWN_STEP_MS = 500;
export const COUNTDOWN_MS = COUNTDOWN_STEP_MS * 3;

const RIDE_KINDS = ['flight', 'car', 'walk'];

export function createWorldPhase() {
  return { phase: 'establishing', ride: null, countdownStartedAt: 0, resumePhase: 'establishing' };
}

/** 선택 시트를 닫으면 열기 직전 상태로 돌아간다. 주행 중에도 열 수 있다.
 * 활주로에 세운 비행기의 기종을 바꾸는 길이며, 취소하면 타던 기체로 돌아간다.
 * 공중에서 열어도 되는지는 리듀서가 알 수 없으므로 호출하는 화면이 막는다. */
const PICKER_FROM = ['establishing', 'exploring', 'driving'];
function openPicker(state) {
  if (!PICKER_FROM.includes(state.phase)) return state;
  return { ...state, phase: 'selecting', resumePhase: state.phase };
}

function launch(state, action) {
  if (state.phase !== 'selecting') return state;
  const ride = action.ride;
  if (!ride || !RIDE_KINDS.includes(ride.kind) || typeof ride.key !== 'string' || !ride.key) return state;
  return {
    ...state,
    phase: 'countdown',
    // mode 는 타임어택으로 출발했는지만 가린다. 모르는 값은 버린다.
    ride: { kind: ride.kind, key: ride.key, mode: ride.mode === 'timeAttack' ? 'timeAttack' : null },
    countdownStartedAt: Number.isFinite(action.now) ? action.now : 0,
  };
}

export function worldPhaseReducer(state, action) {
  switch (action?.type) {
    case 'explore':
      return state.phase === 'establishing' ? { ...state, phase: 'exploring' } : state;
    case 'openPicker':
      return openPicker(state);
    case 'closePicker':
      return state.phase === 'selecting' ? { ...state, phase: state.resumePhase } : state;
    case 'launch':
      return launch(state, action);
    case 'countdownDone':
      return state.phase === 'countdown' ? { ...state, phase: 'driving' } : state;
    case 'exitRide':
      return state.phase === 'driving' || state.phase === 'countdown'
        ? { ...state, phase: 'exploring', ride: null, countdownStartedAt: 0, resumePhase: 'exploring' }
        : state;
    default:
      return state;
  }
}

/** 전경 정지와 선택 시트, 카운트다운 중에는 조작 입력을 버린다. */
export function acceptsInput(state) {
  return state.phase === 'exploring' || state.phase === 'driving';
}

/** 0,1,2 는 각각 3,2,1 이고 3 은 GO 다. */
export function countdownStep(state, now) {
  if (state.phase !== 'countdown') return 3;
  const elapsed = Math.max(0, (Number.isFinite(now) ? now : 0) - state.countdownStartedAt);
  return Math.min(3, Math.floor(elapsed / COUNTDOWN_STEP_MS));
}
