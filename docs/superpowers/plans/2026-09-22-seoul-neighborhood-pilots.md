# Seoul Neighborhood Pilots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 강남형·강북형 동네를 하나씩 실제 도로·필지·건물·주행에 반영하고, 사용자 확인 전에는 전체 도시로 확대하지 않는다.

**Architecture:** 기존 도시 생성 결과에서 보호할 간선·지형·공공부지를 먼저 확정한다. 순수 shared 동네 생성기가 결정적인 블록 묶음 두 곳의 내부 도로와 필지를 함께 교체하고, urbanPlan의 최종 도로·경로·색인에 합친다. worldLayout과 렌더·지도·교통은 이 결과만 소비한다.

**Tech Stack:** JavaScript ESM, React Three Fiber/Three.js, Node test runner, Playwright, 기존 인스턴스 렌더러. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-22-seoul-neighborhood-pilot-design.md`

## Global Constraints

- 이번에는 대표 동네를 북안과 남안에 하나씩 만든다.
- 전체 확대는 이번 구현의 자동 후속 단계가 아니다.
- 제작자 건물의 티어별 실루엣·높이 정책을 이번에 바꾸지 않는다.
- 밀도를 높이려고 충돌 여유나 도로 폭을 줄이지 않는다.
- 같은 extent와 입력은 항상 같은 후보를 선택한다.
- 무관한 사용자 변경은 수정·커밋하지 않는다.
- 푸시하지 않는다.
- 카드 크기 제한은 별도 계획 `2026-09-22-driving-label-cap.md`와 별도 커밋으로 실행한다.

## Review Focus

- extent 1000처럼 4블록 부지가 없는 도시: 2블록 후보도 검토하되 두 동네를 모두 생성하고 시설물을 옮기지 않는다. Task 1.
- public 공원·랜드마크 선택과 블록 캐시 순서: 동네가 기존 예약 부지를 바꾸거나 createUrbanPlan 재귀를 유발하지 않는다. Tasks 1/3.
- 신규 굽은 골목이 기존 nearRoad 검사에서 빠지는 문제: 제작자·배경 필지가 골목을 침범하지 않는다. Task 3.
- 한 경로의 중간을 잘라 같은 path ID로 묶는 문제: AI가 잘린 구간 사이를 순간이동하지 않는다. Tasks 2/3.
- 필지 몇 개를 바꿔도 전역 배치 순서와 NPC seed가 달라지는 문제: 구역 밖 변화량을 측정하고 로컬 변경을 전역 재배치로 숨기지 않는다. Tasks 3/4.

## Scope, candidate survey, and budgets

2026-09-22 읽기 전용 조사 기준 HEAD는 `e0f6b5c`다. 원본 작업 폴더에는 다른 작업의 변경이 많다. 기존 작업용 worktree도 미커밋 변경이 남아 있으므로 그대로 덮어쓰지 않는다. 실행 시 `using-git-worktrees`로 최신 HEAD에서 새 전용 worktree를 만들고, 공유 파일은 마지막에 도로 변경 hunk만 통합한다.

아래는 실제 기본 블록과 기존 예약 공간·고가/램프를 조사한 후보다. 숫자는 하드코딩할 배치가 아니라 selector의 회귀 fixture다. 정밀 충돌·필지 공급 검사에서 후보가 탈락하면 같은 우선순위의 다음 후보를 시험하고 탈락 사유를 보고한다. 모든 후보가 실패하면 동네를 생략하지 말고 설계를 재검토한다.

| extent | 북안: 중심 (x,z), 크기 | 남안: 중심 (x,z), 크기 | 인접 대로 |
| --- | --- | --- | --- |
| 1000 | central (-168,-316), 224×112 | oldtown (-530,160), 240×120 | 양쪽 art-ns-0 |
| 1600 | oldtown (-733.5,-492), 240×240 | oldtown (-733.5,308), 240×120 | 양쪽 art-ns-0 |
| 2164 | riverside (889.86,-337.6), 240×240 | oldtown (-1009.86,374.4), 240×240 | art-ns-1 / art-ns-0 |
| 3600 | central (-1019.3333,-764), 240×240 | civic (-1353.5,1548), 240×240 | 양쪽 art-ns-0 |

기존 지구 이름이 아니라 `riverBank`로 남북을 판정한다. 작은 도시 북안 후보는 기존 104 크기 필지를 포함하므로 제작자 공급 손실을 반드시 먼저 검증한다. 이 후보를 무조건 확정해 전역 배치를 밀어내지 않는다.

조사 시 empty-building medium scenery 파트 수는 extent 순서대로 16562/29310/46249/105286이었다. 단일 실행 plan 생성 시간은 236/169/317/880ms, scenery는 112/105/139/280ms였으며 확정 성능 기준은 아니다. 실행 시작 시 같은 머신의 격리 baseline에서 5회 중앙값을 다시 잰다.

실행 중단 기준: 동일 입력의 extent 증가 >1.5%, 시범 구역 밖 제작자 위치 변경 >5%, 전체 정적 파트 증가 >15%, 고정 카메라의 draw call 증가 >10%, idle 머신 5회 중앙값의 생성 시간 또는 주행 프레임 시간 증가 >20%. 기준을 넘으면 통과 조건을 완화하지 말고 후보/밀도를 축소하고 다시 검증한다. 실제 동시 편집 때문에 비교가 오염되면 격리 baseline을 사용한다.

## File ownership and interfaces

- Create `shared/neighborhoods.js`: 후보 선정·로컬 도로/필지·안전한 영역 절단. urbanPlan을 import하지 않는 순수 함수.
- Modify `shared/urbanPlan.js`: 기본 생성 이후 pilot 합성, 캐시된 지구 블록의 최종 버전, 경로·bridge source index·roadIndex 재확정.
- Modify `shared/worldLayout.js`: 기본 blockSlots와 explicit pilot plots를 한 목록으로 소비; 골목 포함 예약; creator/NPC 배치 일치.
- Modify `src/world/UrbanScenery.js`: pilot NPC 정책·작은 광장 렌더; 기존 npcPlacements를 렌더와 solids가 공유.
- Modify `src/world/models/npcBuildings.js` only if existing options cannot express street-facing orientation; 새 모델군은 만들지 않는다.
- Modify `src/world/README.md`: pilot 계약·변경 영향 표.
- Create focused tests under `tests/world/` and `tests/neighborhoods.spec.js`; create a dedicated Playwright config rather than overwrite the concurrently edited world.spec.js.

공통 API (단계별 전달 계약):

```js
// Point=[number,number]; Bounds={x,z,rx,rz}; kinds are existing road kinds.
// Draft={extent,districts,grids,roads,ramps,parks,plazas,landmarks,hills,ponds,streams}
// Site={id,style:'north'|'south',district,bounds,sourceBlockIds,arterialId,gates}
// Gate={point:Point,roadId:string}; at least two distinct real boundary connections.
// Plot={id,x,z,lot,rotation,district,neighborhood,usage:'creator'|'background',density}
// Pilot={...Site,roads,routes,plots,plaza:null|Bounds,tour:Point[],metrics}
selectPilotSites(draft) // -> Site[2], throws descriptive Error when neither form fits
buildPilot(site, {roadWidths}) // -> Pilot; widths come from ROAD_WIDTH in caller
clipRoadOutsideBounds(road,bounds) // -> 0..2 retained segments, no input mutation
pilotPlotClear(plot,roads,clearance=2) // -> boolean, full lot bounds not centre only
// task 3 defines this shared consumption boundary in worldLayout.js:
districtPlotSlots(district) // -> iterable {x,z,lot,blockId,rotation,usage,density,neighborhood}
```

### Task 1: Deterministic, land-safe pilot selection

**Files:** create `shared/neighborhoods.js`, `tests/world/neighborhood-sites.test.mjs`.

**Consumes:** Draft and existing river/nature/landmark geometry; no React, worldLayout, or urbanPlan import from neighborhoods.
**Produces:** `selectPilotSites(draft)`, Site metadata and two actual boundary gates per site.

- [ ] Write RED tests from baseline plan/grid input, including extent 1000 and permutation of district/block arrays.

```js
import * as neighborhood from '../../shared/neighborhoods.js';
const sites = neighborhood.selectPilotSites(draft);
assert.deepEqual(sites.map(s=>s.style).sort(), ['north','south']);
assert.ok(sites.every(s=>s.gates.length>=2 && s.sourceBlockIds.length>=2));
assert.deepEqual(neighborhood.selectPilotSites({...draft,
  districts:[...draft.districts].reverse()}), sites);
```

- [ ] Run `node --test tests/world/neighborhood-sites.test.mjs`; confirm missing API assertion failure.
- [ ] Enumerate same-pitch adjacent 2×2, 2×1, 1×2 occupied base-block groups; never select empty public-space blocks. Stable source key is `${district.id}-${block.band}-${block.bay}-${block.column}`.
- [ ] Reject footprints touching water, river park, nature, hill, landmark, pond, existing public plaza/park, highway or ramp reservation. Use rectangle/segment intersection and conservative bounds, not the survey's sample-only water check. Require whole bounds on the same bank. Check all border intersections with existing roads; reject any candidate that requires moving a protected arterial/collector.
- [ ] Rank eligible candidates by distance from bounds to the nearest north-south arterial + `0.15*Math.abs(z)` + 180 for a 2-block group; tie by district ID, z, x. Stable identities are `pilot-north` and `pilot-south`, independent of creator input order.

```js
const compare = (a,b) => a.score-b.score
  || a.district.localeCompare(b.district) || a.bounds.z-b.bounds.z
  || a.bounds.x-b.bounds.x;
const chosen = ['north','south'].map(style => candidates
  .filter(candidate=>candidate.style===style).sort(compare)[0]);
if (chosen.some(site=>!site)) throw new Error('No safe two-bank pilot sites');
```

- [ ] Derive gates from actual boundary intersections with existing lane/alley roads; retain all necessary boundary crossings, select two separated entries for the tour, and record connecting IDs. Do not draw a straight connector through intervening buildings.
- [ ] Test protected-area rejection, no candidate failure, two distinct gates, reversed input, and all four extents; compare selected candidate differences with the survey.
- [ ] Scoped lint, review and commit only this deliverable after tests pass.

### Task 2: Distinct local road layouts and explicit plots

**Files:** modify `shared/neighborhoods.js`; create `tests/world/neighborhood-geometry.test.mjs`.
**Consumes:** Site, ROAD_WIDTH. **Produces:** `buildPilot`, `clipRoadOutsideBounds`, `pilotPlotClear`, Pilot.

- [ ] Write RED tests for both styles on 240×240 and minimum 224×112 bounds. Check finite nonzero segments, loop continuity, two gate attachments, non-overlapping lots, and preservation of source inputs.

```js
const pilot = neighborhood.buildPilot(site,{roadWidths:ROAD_WIDTH});
assert.ok(pilot.roads.length>0 && pilot.plots.length>0);
assert.deepEqual(pilot.tour[0],pilot.tour.at(-1));
assert.ok(pilot.plots.every(plot=>neighborhood.pilotPlotClear(plot,pilot.roads)));
assert.ok(pilot.roads.every(r=>Number.isFinite(r.length)&&r.length>0));
```

- [ ] Run `node --test tests/world/neighborhood-geometry.test.mjs`; confirm RED.
- [ ] South: retain the outside 6-lane arterial, create a straight lane through the site and parallel back alley; connect ends into a loop through existing border roads. Keep uniform street-facing setbacks and at least one uninterrupted local straight at least 60% of the longer site dimension.
- [ ] North: make a closed local loop around a small unbuilt plaza and two offset connecting alleys. Alternate T junctions, not a full crossing grid. Use fixed-seed cubic control points for gentle bends; sample at maximum 4 world-unit spacing, with zero-length pieces removed. Keep minimum curvature radius 12 for driven loop turns; adapt small sites by reducing branch count, never road width.

```js
// Only local normalized coordinates are template constants; map through bounds.
const world = ([u,v]) => [site.bounds.x+u*site.bounds.rx,
  site.bounds.z+v*site.bounds.rz];
const southSpine = [[-.8,-.3],[.8,-.3]].map(world);
const northGuide = [[-.72,-.55],[-.2,-.55],[.1,-.22],[.72,-.22]].map(world);
// Connect guides to actual site.gates, fillet loop corners, reserve the resulting
// full-width road envelopes BEFORE laying out plots. Guides are not final gates.
```

- [ ] Fill safe remaining rectangles with existing LOT_SIZES for creator-compatible plots; use smaller 24/30/36 background-only lots in residual street frontage. Keep creator plot sizes unchanged and preserve full collision margins. Greedily test plot rectangles against every pilot road, plaza and previously accepted plot; order candidate plots by stable local row/column IDs.
- [ ] Clip old interior lane/alley pieces with Liang–Barsky rectangle intervals. Preserve outside pieces with unique suffix IDs and split path IDs: a two-piece remainder cannot be one continuous AI path. Boundary-collinear roads are retained once, not duplicated. If a road exits and reenters, every component remains separate.

```js
const pieces=neighborhood.clipRoadOutsideBounds(
  {id:'across',path:'across',x1:-200,z1:0,x2:200,z2:0,kind:'lane'},
  {x:0,z:0,rx:100,rz:100});
assert.equal(pieces.length,2);
assert.notEqual(pieces[0].path,pieces[1].path);
assert.deepEqual(pieces.map(r=>[r.x1,r.x2]),[[-200,-100],[100,200]]);
```

- [ ] Validate with independent segment intersections and `buildRoadNetwork` over local+border roads: actual cycle exists, entries connect, no disconnected slivers. Ensure north has greater junction density per area and shorter median block spans than south; do not assert differences only from metadata labels.
- [ ] Run geometry and site tests, scoped lint, review and commit.

### Task 3: Integrate pilot roads and lots without global re-layout surprises

**Files:** `shared/urbanPlan.js`, `shared/worldLayout.js`; create `tests/world/neighborhood-layout.test.mjs`.
**Consumes:** Tasks 1–2. **Produces:** `plan.neighborhoods`, final `districtBlocks(d).pilotPlots`, shared `districtPlotSlots` consumption.

- [ ] Write RED integrated tests: two neighborhoods exist for all extents; pilot roads appear in plan.roads/network; buildWorld preserves every ID; fillerSlots does not regenerate removed base lots.

```js
for(const extent of [1000,1600,2164,3600]) {
  const plan=createUrbanPlan(extent);
  assert.equal(plan.neighborhoods.length,2);
  for(const n of plan.neighborhoods)
    assert.ok(n.roads.every(r=>plan.roads.some(actual=>actual.id===r.id)));
  assert.equal(createUrbanPlan(extent),plan);
}
```

- [ ] Run the new test and confirm missing neighborhoods RED.
- [ ] Add pilot finalization after existing public-space reservations are known, before final routes/roadIndex/plan are published. Pass an explicit Draft into the pure selector; do not call createUrbanPlan from inside selection.
- [ ] Keep original public-space choices unchanged. Keep references to bridge source road objects before cutting local roads and recalculate sourceRoadIndex afterward. Reject pilot overlap with protected bridge spans rather than silently discard a bridge source.
- [ ] Replace selected base blocks in each affected district's block cache with `{...grid, blocks:remainingBlocks, pilotPlots}` only once during plan construction. Leave band/bay data and other districts unchanged. Public consumers see final grids; local baseline inputs must not be mutated while evaluating candidate alternatives.
- [ ] Replace interior roads, append pilot roads, then rebuild final connection checks and routes. Reuse existing surface connection logic, but accept only boundary-local repairs. Rebuild roadIndex with pilot alleys included because grid spacing no longer guarantees they are clear of lots.

```js
const indexedRoads=roads.filter(r=>r.kind!=='alley'||r.neighborhood);
const roadIndex=createSegmentIndex([...indexedRoads,...rampSegments],LOT_CHAMPION+ALLEY);
// Every Pilot road carries neighborhood: site.id; normal base alleys retain old behavior.
```

- [ ] Make all four worldLayout slot consumers (buildPools, fringeSlots, deckSlots, openBlockSlots) use the common districtPlotSlots iterator, including explicit plots. Background-only plots cannot enter creator pools. Preserve creator slot sorting/tiers, occupancy and reservation filtering. `vacantSlots` and `fillerSlots` must agree about pilot locations and usage.

```js
// Explicit plot IDs become the same blockId field used by existing consumers.
for(const plot of districtBlocks(district).pilotPlots||[]) yield {
  x:plot.x,z:plot.z,lot:plot.lot,blockId:plot.id,rotation:plot.rotation,
  usage:plot.usage,density:plot.density,neighborhood:plot.neighborhood,
};
// The iterator also yields ordinary blockSlots with usage:'creator', and retains
// each source block's empty flag so openBlockSlots does not lose public-space semantics.
```
- [ ] Add diagnostics comparing baseline vs pilot for 0/1/200/572/1000 mixed-tier creators: count, extent, moved creators inside/outside pilots, pool capacity by lot size. Compare input reversed order too. If growth/movement budgets fail, try the next eligible candidate pair instead of broadening the city or weakening assertions.
- [ ] Run new tests plus layout, lot-spacing, urban-plan, road-network, road-review-regressions, road-surface, bridge-traversal, traffic, traffic-yield and navigation-map tests. Check middle-cut route components cannot teleport and bridge source indices still identify their original road geometry. Review and commit.

### Task 4: Make the two streets read differently without new model families

**Files:** `src/world/UrbanScenery.js`, `src/world/models/npcBuildings.js` if necessary, `src/world/README.md`; create `tests/world/neighborhood-scenery.test.mjs`.
**Consumes:** explicit plot metadata. **Produces:** rendered neighborhood frontage and matching npcSolids; all road visuals still use canonical plan.roads.

- [ ] Write RED tests collecting actual model parts and solids, not checking source strings: north background frontage is denser than south, no solid intersects a pilot carriageway, and low/medium/high preserve passable space.
- [ ] Run `node --test tests/world/neighborhood-scenery.test.mjs`; confirm RED.
- [ ] Propagate neighborhood/density/rotation fields through fillerSlots. For north select existing shop/cornerShop/streetShop/rowhouse kinds, align faces to streets, and use the compact plots from Task 2. For south select existing office/complexShop/streetShop kinds with consistent setbacks. Do not change creator building heights or global density weights.
- [ ] Keep npcPlacements as the only per-building placement source for rendering and npcSolids. Pilot seeds use stable plot ID and local index, not the global filler array index. Removing old pilot lots may shift the existing global seed index outside pilots: measure this separately from creator movement, and preserve legacy outside-slot ordinals where the baseline slot survives. Do not change the global seeding algorithm as an unrelated cleanup. Add an outside-plot seed regression fixture before adjusting iteration order.

```js
// Add a local helper, avoiding a dependency on urbanPlan's private hashText.
const hashText=(value)=>{let h=2166136261;for(const c of String(value))
  h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
// legacyNpcIndex is the surviving slot's baseline ordinal, carried by fillerSlots.
const seed=slot.neighborhood ? hashText(slot.blockId)
  : Math.round(slot.x*7+slot.z*13)+(slot.legacyNpcIndex??index);
```

- [ ] Render the small plaza as an existing pavement/open-space primitive inside its reserved bounds, with furniture outside the driven loop. Reuse existing materials and batching. Do not add DOM labels or real Light instances for the pilot.
- [ ] Document plan.neighborhoods, explicit slots, road-index inclusion and future expansion gate in tracked src/world/README.md. Run city-detail/npc-buildings/solids/tiles/road-clearance tests and scoped lint. Review and commit.

### Task 5: Whole-world verification and user-ready pilot tour

**Files:** create `tests/neighborhoods.spec.js`, `playwright.neighborhoods.config.js`; optionally create `tests/helpers/neighborhoodWorld.mjs` for isolated test-only scene/vehicle probes.
**Consumes:** final canonical plan and actual app. **Produces:** repeatable browser checks, screenshots and metrics in test-results or /tmp, not production debug UI.

- [ ] Use the existing Playwright world launch settings with a dedicated port and testMatch. Mock /api/get-world-data deterministically with the 200-creator fixture. Capture JS errors and wait for world-stage data-ready=true.
- [ ] Reuse the established read-only React devtools/R3F probe pattern from `/tmp/ego-road-browser-0922.mjs` in a test helper; locate camera and driven vehicle refs without adding global production API. Place the test vehicle at canonical neighborhood tour points, not hardcoded world coordinates.
- [ ] Test south loop, bridge transit and north loop using real controls and stepCar. Assert progress, drive phase, no terrain-height jumps, no collider/water trap. Exercise sedan and SUV; document that oversized vehicles need not traverse every alley.

```js
// Assert actual browser state after each driven leg, not a screenshot alone.
expect(result.phase).toBe('drive');
expect(result.distance).toBeGreaterThan(1);
expect(result.blocked).toBe(false);
expect(result.pageErrors).toEqual([]);
```

- [ ] Take aerial/map/vehicle-height images for both pilots with same time/quality/viewport; take baseline comparison before implementation in the isolated baseline. Record coordinates and entry-road IDs in completion report.
- [ ] Measure 5-run generation medians and fixed-camera part/draw-call/frame-time comparisons without running heavy tests simultaneously. Apply the budgets above. Verify four extents and all three quality modes, full-width road sweeps and building bounds, not road centres alone.
- [ ] Run `node --test --test-concurrency=1 tests/world/*.test.mjs`, changed-file ESLint, `npm run build`, then dedicated browser suite. If a test fails, investigate rather than loosen its limit. Existing performance tests can be affected by concurrent browser load; run them idle.
- [ ] Fresh Astra whole-change review after Sol/high implementation and task-local reviews. Fix Important/Critical findings, re-run affected checks and verify final main-worktree integration preserves unrelated changes.
- [ ] Stage only pilot hunks/files, inspect index, commit locally and do not push. Report pilot results, approved card fix in its separate commit, and explicitly ask the user to judge before any full-city expansion.

## Execution handoff / self-review

- Spec coverage: two sites, actual road contrast, explicit lots, shared graph, tier preservation, density, connectivity, AI, quality, measurements, user review and no-push are assigned above.
- All five Review Focus cases have owning tasks and test cases. Exact site coordinates are measured candidate fixtures, not runtime constants or proof of final drivability.
- No product code has been changed for this plan. Existing main-worktree changes belong to other work and are excluded.
- Preserve chosen model roles: Astra for design/review; Sol/high for approved implementation. Task 1 → 2 → 3 are sequential dependencies. Card task can run independently; Task 4 starts only after Task 3's metadata contract is verified.
- User must confirm this implementation plan before pilot implementation under the current writing-plans workflow.
