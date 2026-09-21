import { useCallback, useRef, useSyncExternalStore } from 'react';

/** 탈것 상태를 React state 밖에 둔 외부 store 다. FlightMode, CarMode, WalkMode 가
 * 0.12~0.15초마다 부르는 onStatus 콜백이 여기로 모인다. WorldPage 가 이 값을 state 로 들면
 * 도시 전체 R3F 트리가 같은 주기로 재조정되므로, HUD 만 useSyncExternalStore 로 구독한다.
 * throttle 도 별도 state 가 아니라 status.throttle 에서 선택자로 뽑아 쓴다. */

let status = {};
const listeners = new Set();

export function publishRideStatus(next) {
  status = next || {};
  listeners.forEach((listener) => listener());
}

/** 탈것에서 내릴 때 부른다. 다음 탑승의 HUD 가 이전 상태를 잠깐 보여주지 않게 비운다. */
export function resetRideStatus() {
  publishRideStatus({});
}

export function getRideStatus() {
  return status;
}

export function subscribeRideStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const identity = (value) => value;

/** selector 로 뽑은 값이 isEqual 로 같으면 이전 참조를 그대로 돌려줘 불필요한 재렌더를 막는다.
 * selector, isEqual 은 매 렌더 새로 만들어져도 된다. ref 로 최신 값만 따라간다. */
export function useRideStatus(selector = identity, isEqual = Object.is) {
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  const selectedRef = useRef();
  const hasSelectedRef = useRef(false);
  // useSyncExternalStore 는 같은 렌더 안에서 getSnapshot 을 바로 부른다. effect 로 미루면 한 박자
  // 늦은 selector 를 읽으므로, 렌더 중에 최신 값을 ref 에 직접 반영한다.
  // eslint-disable-next-line react-hooks/refs -- 위 주석 참고. use-sync-external-store 셀렉터 shim 과 같은 패턴이다.
  selectorRef.current = selector; isEqualRef.current = isEqual;

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(status);
    if (hasSelectedRef.current && isEqualRef.current(selectedRef.current, next)) {
      return selectedRef.current;
    }
    hasSelectedRef.current = true;
    selectedRef.current = next;
    return next;
  }, []);

  return useSyncExternalStore(subscribeRideStatus, getSnapshot, getSnapshot);
}
