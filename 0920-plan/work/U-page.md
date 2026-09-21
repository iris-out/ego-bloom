# U 화면 작업 보고

## 바꾼 것

`src/world/rideStatusStore.js` 를 새로 만들었다. `publishRideStatus`, `resetRideStatus`, `getRideStatus`,
`subscribeRideStatus` 네 개의 순수 함수와, `useSyncExternalStore` 로 구독하는 `useRideStatus(selector, isEqual)`
훅을 담았다. selector 가 뽑은 값이 이전과 같으면 이전 참조를 그대로 돌려줘, store 가 0.12~0.15초마다 갱신돼도
값이 실제로 바뀌지 않으면 구독한 컴포넌트가 재렌더되지 않는다.

`WorldPage.jsx` 에서 `rideStatus`, `throttle` state 를 지웠다. `onFlightStatus`, `onCarStatus`, `onWalkStatus`
는 `reportRide`, `reportFlight` 래퍼 없이 store 의 `publishRideStatus` 를 직접 받는다(모듈 스코프 함수라 참조가
절대 안 바뀐다). `WorldScene` 에 넘기던 인라인 `onExplore={()=>dispatch(...)}` 는 `useCallback` 으로 고정했다.
`canSwapRide` 는 `useRideStatus(selector)` 로 `phase`, `speed` 만 골라 구독해, 판정이 실제로 안 바뀌면 WorldPage
도 다시 렌더되지 않는다. `exitRide`, `launch` 는 `setRideStatus({})` 대신 `resetRideStatus()` 를 부른다.
`resetRide` 는 `setThrottle(0)` 을 지우고 `flightControls.current.throttle=0` 만 남겼다. 다음 상태 보고가
0.15초 안에 도착해 표시를 따라간다.

`RideHud.jsx` 는 `status`, `throttle` 을 prop 으로 받지 않고 내부에서 `useRideStatus()` 로 전체 객체를
구독한다. DOM 컴포넌트라 R3F 트리에 영향이 없다. throttle 은 `status.throttle` 에서 계산한다.

도보 무기 힌트 텍스트("1~4 무기")가 `walkPhysics.js` 의 `WEAPON_KEYS` 개수를 하드코딩하고 있어
`` `1~${WEAPON_KEYS.length} 무기` `` 로 바꿨다. 산탄총이 추가돼 무기가 다섯 개가 되면 문구도 따라 바뀐다.
`RideHud`, `WalkHud` 는 원래도 `WEAPON_KEYS` 를 순회해 버튼을 그려서 손댈 곳이 없었다.

`Map.jsx` 는 확인만 했다. `CameraMarker` 가 자체 `setInterval` 로 `cameraRef.current` 를 읽어 SVG 속성만
바꾸고 setState 를 쓰지 않아 페이지를 다시 렌더하지 않는다. 고칠 것이 없었다.

새 테스트 `tests/world/ride-status-store.test.mjs` 를 추가했다. publish, reset, 구독/해지, null 방어를
node:test 로 확인한다.

## 기대 효과

WorldScene 에 넘어가는 콜백 전부가 안정된 참조가 됐으니, agent R 이 `WorldScene` 을 `React.memo` 로 감싸면
탈것 상태가 갱신될 때마다 도시 3D 트리가 재조정되던 문제(초당 7~8회)가 사라진다. RideHud 는 그대로 그 주기로
다시 그려지지만 DOM 이라 비용이 3D 트리와는 다르다.

## 남은 문제

`react-hooks/refs` 규칙이 `useRideStatus` 안에서 최신 selector 를 ref 에 반영하는 줄을 막아 `eslint-disable-next-line`
으로 풀었다. `use-sync-external-store` 의 selector shim 과 같은 패턴이라 안전하다고 보지만, 더 나은 방법이
있다면 바꿀 수 있다.

WorldScene 이 아직 `React.memo` 로 감싸여 있지 않아(agent R 담당, 미완료 상태로 확인) 이번 변경만으로는
실제 재조정 횟수가 줄었는지 이 워크스트림에서 측정하지 못했다. R 의 작업이 끝난 뒤 `0920-plan/perf` 로
같이 재야 한다.

Playwright(`tests/world.spec.js`) 는 지시대로 돌리지 않았다. 104, 111, 113번째 줄의 스로틀 슬라이더
`aria-valuenow` 검증은 이제 즉시 갱신되는 로컬 state 가 아니라 FlightMode 의 다음 상태 보고(최대 0.15초)를
기다려야 값이 바뀐다. Playwright 의 `toHaveAttribute` 는 기본 5초까지 재시도하므로 통과할 것으로 보지만
직접 실행해 확인하지는 않았다.

## README 에 반영할 내용

`src/world/README.md` 의 상태 흐름 설명에 `rideStatusStore.js` 를 추가해야 한다. FlightMode, CarMode,
WalkMode 의 `onStatus` 콜백이 React state 가 아니라 이 store 로 간다는 것, HUD 는 `useRideStatus` 로
구독한다는 것, WorldPage 는 `getRideStatus()` 나 좁은 selector 로만 필요할 때 값을 읽는다는 것을 적으면 된다.
