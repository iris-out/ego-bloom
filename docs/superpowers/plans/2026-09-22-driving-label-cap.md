# Driving Creator Label Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 육상 차량에서 가까운 제작자 카드가 시야를 덮지 않게 화면상 최대 폭을 제한한다.

**Architecture:** 기존 Html transform sprite를 유지하고 카메라 깊이와 투영 배율로 카드 자식 DOM의 보정 scale만 계산한다. 주행 모드에만 적용하며 React state를 프레임마다 갱신하지 않는다. DOM의 원래 폭과 카메라 값으로 계산해 축소 결과를 다시 측정하는 피드백 진동을 막는다.

**Tech Stack:** React refs, R3F useFrame, Three camera matrices, 기존 drei Html, Node tests/Playwright. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-22-seoul-neighborhood-pilot-design.md`의 별도 승인된 카드 수정; 최대 폭은 280 CSS px와 화면 폭 25% 중 작은 값.

## Global Constraints

- 육상 차량에만 적용한다. 탐색·비행의 크기·거리·카드 형태는 유지한다.
- 멀리서의 가독성, 클릭 및 선택, 익명 처리, 라벨 후보 수는 유지한다.
- 프레임마다 state 또는 getBoundingClientRect를 호출하지 않는다.
- 별도 커밋으로 검증하고 푸시하지 않는다.

## Review Focus

- 카메라 근평면 또는 뒤쪽: 거대한 한 프레임 카드, NaN, Infinity가 없어야 한다.
- 화면 가장자리: 직선 거리 대신 camera-space depth를 사용한다.
- 창 크기·FOV 변경과 1/3인칭 전환: 다음 프레임부터 새 상한을 적용한다.
- 늦게 mount된 Html DOM: 최초 노출부터 제한하고 주행 종료 시 scale을 복구한다.
- 긴 이름·아바타 실패·익명 모드: 동일한 레이아웃과 선택 동작을 보존한다.

### Task 1: Screen projection clamp and runtime wiring

**Files:** modify `src/world/creatorProximity.js`, `src/world/NearbyCreators.jsx`, `tests/world/proximity.test.mjs`, `src/world/README.md`; create `tests/driving-label-cap.spec.js` and a dedicated Playwright config.

**Interfaces:** `drivingLabelScale({width,viewportWidth,pixelsPerWorldUnit,distanceFactor}) -> number in [0,1]`. width is untransformed element.offsetWidth; pixelsPerWorldUnit is computed from the active projection and camera-space depth; distanceFactor is LABEL_SCALE.drive.

- [ ] RED tests before production change:

```js
const factor=drivingLabelScale({width:380,viewportWidth:1920,
  pixelsPerWorldUnit:30,distanceFactor:70});
assert.ok(380*(70/400)*30*factor<=280+1e-6);
assert.equal(drivingLabelScale({width:380,viewportWidth:390,
  pixelsPerWorldUnit:1,distanceFactor:70}),1);
assert.equal(drivingLabelScale({width:380,viewportWidth:1920,
  pixelsPerWorldUnit:Infinity,distanceFactor:70}),0);
```

- [ ] Run `node --test tests/world/proximity.test.mjs`; confirm missing helper RED.
- [ ] Implement pure clamp and validate invalid/behind-camera input before division:

```js
export function drivingLabelScale({width,viewportWidth,pixelsPerWorldUnit,distanceFactor}) {
  if (![width,viewportWidth,pixelsPerWorldUnit,distanceFactor]
    .every(v=>Number.isFinite(v)&&v>0)) return 0;
  const projected=width*(distanceFactor/400)*pixelsPerWorldUnit;
  return Math.min(1,Math.min(280,viewportWidth*.25)/projected);
}
```

- [ ] Extract the existing ground card into a component with element and world-point refs. Preserve its markup/handlers and leave WallCard unchanged. Use ResizeObserver to cache offsetWidth at mount/resize; initial driving style is invisible until first valid scale computation.
- [ ] Each useFrame computes anchor at `[building.x, building.height+9, building.z]`, transforms it by camera.matrixWorldInverse, and uses `size.height * camera.projectionMatrix.elements[5] / (2 * depth)` for a perspective camera, without depth division for orthographic. At depth <= camera.near, set scale 0 and hide the card; don't invert negative projection. At valid depth update element.style.transform=`scale(s)` with transformOrigin center center. Non-driving mode restores transform and visibility.
- [ ] Mount/reference callback calls the same update logic immediately once element size is available, avoiding a full-size flash. No new React state in useFrame; dispose ResizeObserver on unmount. Confirm the installed drei factor/400 relationship against node_modules, not external assumptions.
- [ ] Extend unit tests for monotonic near/far behavior, 390/1440/1920 viewport widths, invalid values and exact cap. Existing reach/scale tests must still pass.
- [ ] Browser test: same mocked world and camera/vehicle probe technique as existing road browser audit; approach a short building in sedan/SUV/armored ground vehicle, at multiple depths and both views, and read getBoundingClientRect only in the test. Assert every visible ground card width <= min(280, stageWidth*.25)+1 CSS px. Check 390×844 and 1920×1080; test selection before/after drive, long name, failed image and anonymous mode. Check exploration and flight screenshots unchanged in policy.
- [ ] Run focused tests, scoped ESLint, build, browser test and fresh review. Add the projection-cap contract to README. Commit only label changes; exclude unrelated README hunks and do not push.

## Handoff

The bounded design was already approved by the user. This independent task can run alongside approved pilot implementation using Sol/high, with Astra review. No product code was changed while writing this plan.
