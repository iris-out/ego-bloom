# Ground Interiors, Formula Car, and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve every ground-vehicle cockpit, add a complete 300 km/h modern formula car with Space-handbrake drifting, and turn the in-ride map into a speed-aware heading-up navigator.

**Architecture:** Extend the existing data-driven vehicle contracts rather than branching around them. Keep cockpit placement in layout tables, handling in `carPhysics`, visual selection in `VehicleModel`/`cockpits`, and map geometry derived from the shared urban plan; expose pure navigation transform helpers so behavior can be unit-tested without rendering React.

**Tech Stack:** React 19, React Three Fiber, Three.js r182, SVG, Node test runner, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-09-22-ground-interiors-formula-navigation-design.md`

## Global Constraints

- Preserve all pre-existing uncommitted changes and stage only files belonging to the current task.
- Keep `VehicleModel` exhaustive with `identity.VEHICLE_KEYS`.
- Keep world coordinates sourced from `shared/worldLayout.js` and `shared/urbanPlan.js`.
- Keep moving cockpit parts outside the outer `StaticBatch`; batch only static descendants inside a dynamic group.
- Keep the single shared mirror render target and hide the cockpit during its pass.
- Use no external 3D assets, real constructor branding, or racing livery.
- Formula top speed is exactly `300 / 3.6` metres per second.
- Preserve overview-map selection, focus, airport, nature, beach, subway, and caption behavior.

## Review Focus

- A missing or invalid speed/heading/position must leave navigation finite and stable; pin this in Task 2 navigation helper tests.
- Parking around zero speed must not rotate or pulse the map; pin heading hold and zoom damping bounds in Task 2.
- Holding handbrake without steering or below drift speed must not report a drift; pin this in Task 1.
- A new vehicle key must exist in every required model, cockpit, sound, eye-point, height, art, lamp, mirror, and budget table; pin exhaustiveness in Tasks 3–5.
- Cockpit detail must not break low-quality budgets or central visibility; pin both budget ordering and clearance constraints in Tasks 4 and 5.

---

### Task 1: Data-driven formula handling and drift

**Files:**
- Modify: `src/world/carPhysics.js`
- Modify: `src/world/CarMode.jsx`
- Test: `tests/world/car.test.mjs`
- Test: `tests/world/steering.test.mjs`

**Interfaces:**
- Consumes: `stepCar(previous, input, delta, extent, buildings, kind, traffic)` and the existing `controlsRef.current` object.
- Produces: `VEHICLES.formula`, per-vehicle optional `drift` tuning, and unchanged `carStatus(state, kind)` fields including `drift`.

- [ ] **Step 1: Write failing formula speed and acceleration tests**

Add tests that assert `VEHICLES.formula.top === 300 / 3.6`, drive sedan and formula with full throttle for the same duration, and assert formula speed and initial acceleration are greater while neither exceeds its cap.

```js
test('formula reaches a 300 km/h cap and accelerates faster than road cars', () => {
  assert.equal(VEHICLES.formula.top, 300 / 3.6);
  const formula = drive(createCarState(CITY), { throttle: 1 }, 300, [], 'formula', [], CITY);
  const sedan = drive(createCarState(CITY), { throttle: 1 }, 300, [], 'sedan', [], CITY);
  assert.ok(formula.speed > sedan.speed);
  assert.ok(formula.speed <= VEHICLES.formula.top);
});
```

- [ ] **Step 2: Write failing drift entry and recovery tests**

Drive above 12 m/s, apply steering plus `handbrake`, and assert drift/yaw increase; separately assert low speed, no steering, and released handbrake do not remain drifting.

```js
test('formula handbrake enters and recovers from a controlled drift', () => {
  const fast = drive(createCarState(CITY), { throttle: 1 }, 180, [], 'formula', [], CITY);
  const sliding = drive(fast, { throttle: .4, steer: 1, handbrake: true }, 45, [], 'formula', [], CITY);
  assert.equal(sliding.drift, true);
  assert.ok(Math.abs(sliding.heading - fast.heading) > .15);
  const recovered = drive(sliding, { throttle: .4, steer: 0, handbrake: false }, 90, [], 'formula', [], CITY);
  assert.equal(recovered.drift, false);
  const parked = drive(createCarState(CITY), { steer: 1, handbrake: true }, 20, [], 'formula', [], CITY);
  assert.equal(parked.drift, false);
});
```

- [ ] **Step 3: Run the focused tests and verify red**

Run: `node --test tests/world/car.test.mjs tests/world/steering.test.mjs`

Expected: FAIL because `VEHICLES.formula` and its handling are absent.

- [ ] **Step 4: Add vehicle-tunable drift physics and formula specification**

Add formula dimensions, gears, 83.333… m/s cap, acceleration above the convertible, high braking, and optional tuning fields such as `handbrakeBrake`, `driftYaw`, `driftMinSpeed`, and `highSpeedSteer`. Replace hard-coded handbrake multipliers in `stepCar` with defaults read from the selected spec, preserving current values for existing vehicles.

- [ ] **Step 5: Map Space to formula handbrake without changing combat firing**

In `CarMode`, keep weapon Space behavior for combat vehicles. For `formula`, write `controlsRef.current.handbrake` while Space is held; keep the existing brake/touch path separate and clear the flag on keyup, blur, reset, and exit paths.

- [ ] **Step 6: Run focused and regression tests**

Run: `node --test tests/world/car.test.mjs tests/world/steering.test.mjs tests/world/ground-weapons.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit handling changes**

```bash
git add src/world/carPhysics.js src/world/CarMode.jsx tests/world/car.test.mjs tests/world/steering.test.mjs
git commit -m "feat: add formula handling and handbrake drift"
```

### Task 2: Pure navigation projection and zoom model

**Files:**
- Create: `src/world/navigationMap.js`
- Create: `tests/world/navigation-map.test.mjs`

**Interfaces:**
- Produces: `navigationRadius(speedKmh): number`, `stableHeading(previous, next, speedKmh): number`, `toNavigationPoint(point, pose, radius): { x, y, visible }`, and `tierMarker(tier): { shape, size }`.
- Consumers: Task 6 `WorldMap.jsx`.

- [ ] **Step 1: Write failing zoom and invalid-input tests**

```js
test('navigation radius grows monotonically from 75m to 300m', () => {
  const samples = [0, 30, 80, 160, 300].map(navigationRadius);
  assert.equal(samples[0], 75);
  assert.equal(samples.at(-1), 300);
  for (let i = 1; i < samples.length; i += 1) assert.ok(samples[i] >= samples[i - 1]);
  assert.equal(navigationRadius(Number.NaN), 75);
});

test('invalid coordinates never produce non-finite SVG positions', () => {
  const p = toNavigationPoint({ x: NaN, z: Infinity }, { x: 0, z: 0, heading: 0 }, 100);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.equal(p.visible, false);
});
```

- [ ] **Step 2: Write failing heading-up, parked-heading, culling, and tier tests**

Assert a point in front maps above the player, right maps right after rotation, outside-radius points are hidden, heading stays unchanged below 2 km/h, and all creator tiers return distinct marker descriptions.

- [ ] **Step 3: Run the test and verify red**

Run: `node --test tests/world/navigation-map.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 4: Implement the pure helpers**

Use finite fallbacks, a monotonic clamped interpolation over 0–300 km/h, a player anchor near `{ x: 50, y: 66 }`, and a rotation matching `carStatus.heading`. Return visibility with a small overscan margin so strokes do not pop at the edge.

- [ ] **Step 5: Run the helper tests**

Run: `node --test tests/world/navigation-map.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit navigation math**

```bash
git add src/world/navigationMap.js tests/world/navigation-map.test.mjs
git commit -m "feat: add heading-up navigation projection"
```

### Task 3: Register the formula vehicle end to end

**Files:**
- Modify: `src/world/identity.js`
- Modify: `src/world/rideSpecs.js`
- Modify: `src/world/eyePoints.js`
- Modify: `src/world/engineSound.js`
- Modify: `src/world/groundWeapons.js`
- Modify: `src/world/CarMode.jsx`
- Modify: `src/world/models/VehicleModel.jsx`
- Modify: `src/world/cockpits/index.jsx`
- Modify: `src/world/cockpits/mirrorLayout.js`
- Modify: `src/world/cockpits/triangles.js`
- Modify: `src/world/cockpits/materials.js`
- Modify: `src/world/ui/rideArt.jsx`
- Test: `tests/world/car.test.mjs`
- Test: `tests/world/first-person.test.mjs`
- Test: `tests/world/mirrors.test.mjs`
- Test: `tests/world/cockpit-budget.test.mjs`
- Test: `tests/world/ride-specs.test.mjs`

**Interfaces:**
- Consumes: `VEHICLES.formula` from Task 1.
- Produces: the `formula` key across every exhaustive vehicle registry; temporary model/cockpit imports are completed by Tasks 4 and 5 in the same branch before full-suite verification.

- [ ] **Step 1: Add failing registry exhaustiveness assertions**

Extend the existing loops so they assert `VEHICLE_KEYS.includes('formula')`, `VEHICLE_META.formula.ko === '포뮬러'`, a finite unique eye point, sound preset, positive hull height, lamp reach, mirror camera, picker art, cockpit parts, and model/cockpit mapping.

- [ ] **Step 2: Run focused tests and verify red**

Run: `node --test tests/world/ride-specs.test.mjs tests/world/first-person.test.mjs tests/world/mirrors.test.mjs tests/world/cockpit-budget.test.mjs tests/world/car.test.mjs`

Expected: FAIL on the missing `formula` key.

- [ ] **Step 3: Add formula metadata and registry entries**

Use code `F1`, Korean label `포뮬러`, a low/reclined eye point, a road-car FOV around 72 degrees, a high-rev engine preset, a low hull height, forward/rear lamp positions matching the new body, three mirrors, a graphite/accent cockpit palette, and initial triangle budget entries.

- [ ] **Step 4: Run focused tests**

Run the Step 2 command. Expected: registry assertions PASS; imports may remain red only until Tasks 4 and 5 add the concrete components.

- [ ] **Step 5: Commit the registries together with the concrete components**

Do not make an intermediate commit that leaves `VehicleModel` or `Cockpit` importing nonexistent files. Stage this task with Tasks 4 and 5 for the commit described in Task 5.

### Task 4: Build the modern low-poly formula exterior

**Files:**
- Create: `src/world/models/Formula.jsx`
- Modify: `src/world/models/carGeometry.js`
- Modify: `src/world/models/VehicleModel.jsx`
- Modify: `src/world/cockpits/triangles.js`
- Create: `tests/world/formula-model.test.mjs`

**Interfaces:**
- Consumes: standard vehicle model props `{ wheelsRef, steer, speed, firstPerson }` and shared wheel helpers.
- Produces: default `Formula` model honoring front `-Z`, wheel-bottom `y=-0.9`, dynamic wheel animation, and a hideable first-person camera-intersection group.

- [ ] **Step 1: Write a failing source-contract test**

Assert that `Formula.jsx` exports a model, includes four dynamic wheel hubs, calls the shared steering-angle helper, has named groups or data for halo/front wing/rear wing/suspension/sidepods, and exposes the same first-person visibility contract as existing road models.

- [ ] **Step 2: Run the contract test and verify red**

Run: `node --test tests/world/formula-model.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the exterior from shared primitives**

Construct the tapered monocoque, nose, front-wing elements/endplates, sidepods, floor, engine cover, halo, rear wing, diffuser block, exposed wishbones, mirrors, and four slick wheels. Reuse module-scoped geometries/materials and `StaticBatch`; keep wheel groups dynamic. Hide only the camera-intersecting headrest/halo-rear pieces in first person.

- [ ] **Step 4: Wire `Formula` into `VehicleModel` and update its budget**

Add the import and `formula: Formula` mapping, then make the formula triangle budget reflect the actual repeated parts at low/medium/high detail.

- [ ] **Step 5: Run model, vehicle, and budget tests**

Run: `node --test tests/world/formula-model.test.mjs tests/world/car.test.mjs tests/world/cockpit-budget.test.mjs`

Expected: PASS for exterior contracts and budgets.

### Task 5: Build formula cockpit and refine every ground interior

**Files:**
- Create: `src/world/cockpits/FormulaInterior.jsx`
- Modify: `src/world/cockpits/index.jsx`
- Modify: `src/world/cockpits/vehicleInteriorLayout.js`
- Modify: `src/world/cockpits/RoadInteriors.jsx`
- Modify: `src/world/cockpits/MotorcycleInterior.jsx`
- Modify: `src/world/cockpits/ArmorInteriors.jsx`
- Modify: `src/world/cockpits/parts.jsx`
- Modify: `src/world/cockpits/materials.js`
- Modify: `src/world/cockpits/triangles.js`
- Test: `tests/world/vehicle-interior-layout.test.mjs`
- Test: `tests/world/cockpit-budget.test.mjs`
- Test: `tests/world/instruments.test.mjs`

**Interfaces:**
- Consumes: `statusRef.current` fields `speed`, `rpm`, `gear`, `steer`, `heading`, and `drift`; formula registry entries from Task 3.
- Produces: `FormulaInterior` and clearance-safe layout data for all ground cockpits.

- [ ] **Step 1: Add failing formula and cross-vehicle clearance tests**

Add `formula` to `ROAD_KEYS` or the all-ground list as appropriate. Assert its halo central opening remains outside the central forward cone, wheel and display are beyond `NEAR_COCKPIT`, gauges fit the FOV, and the steering/display envelopes do not overlap. Extend all-ground tests to require clearance metadata for every vehicle key.

Add a convertible-specific regression asserting the instrument hood has a shallow thickness, sits behind the instrument faces, connects to the dash top without a visible vertical gap, and does not overlap the steering rim projection. This catches the floating oversized slab visible in the supplied first-person screenshot.

- [ ] **Step 2: Add failing detail and budget assertions**

Require formula primary display, shift-light row, compact yoke, halo, three mirrors, and quality-ordered optional detail. Require civilian cabins to retain two vents and three switches, motorcycle primary instruments, and combat primary optics/screens.

- [ ] **Step 3: Run cockpit tests and verify red**

Run: `node --test tests/world/vehicle-interior-layout.test.mjs tests/world/cockpit-budget.test.mjs tests/world/instruments.test.mjs`

Expected: FAIL on formula and any newly asserted clearance metadata.

- [ ] **Step 4: Implement `FormulaInterior`**

Build cockpit rim, halo, padded sides, compact rectangular yoke with hands, integrated digital instrument surface, shift lights, pedals, seat bolsters, and mirrors. Keep the yoke/hands in one dynamic inner batch and keep display updates imperative through `statusRef`.

- [ ] **Step 5: Refine civilian, motorcycle, and combat interiors**

Adjust the layout data first, then consume it in renderers. Add only detail that improves silhouette or readability: recessed binnacles, layered dash faces, door-card seams, distinct console shapes, structural ribs, optic bezels, and restrained indicator lamps. Move occluding pieces instead of hiding essential controls.

For the convertible, replace the single thick floating hood slab with a thin dashboard cap plus a recessed instrument binnacle. Lower and move the cap forward enough to join the red dash top, keep the three instrument surfaces readable, and leave the wheel/hands below their lower edge.

- [ ] **Step 6: Run cockpit and mirror tests**

Run: `node --test tests/world/vehicle-interior-layout.test.mjs tests/world/cockpit-budget.test.mjs tests/world/instruments.test.mjs tests/world/mirrors.test.mjs tests/world/first-person.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the complete formula visual slice and cockpit refinements**

```bash
git add src/world/identity.js src/world/rideSpecs.js src/world/eyePoints.js src/world/engineSound.js src/world/groundWeapons.js src/world/CarMode.jsx src/world/models/VehicleModel.jsx src/world/models/Formula.jsx src/world/models/carGeometry.js src/world/cockpits src/world/ui/rideArt.jsx tests/world/formula-model.test.mjs tests/world/vehicle-interior-layout.test.mjs tests/world/cockpit-budget.test.mjs tests/world/instruments.test.mjs tests/world/mirrors.test.mjs tests/world/first-person.test.mjs tests/world/ride-specs.test.mjs tests/world/car.test.mjs
git commit -m "feat: add detailed formula car and ground interiors"
```

### Task 6: Render the in-ride heading-up navigator

**Files:**
- Modify: `src/world/Map.jsx`
- Modify: `src/routes/WorldPage.jsx`
- Modify: `src/world/ui/RideHud.jsx`
- Modify: `src/world/ui/world-ui.css`
- Modify: `src/world/world.css`
- Test: `tests/world/navigation-map.test.mjs`
- Test: `tests/world.spec.js`

**Interfaces:**
- Consumes: Task 2 helpers, `cameraRef.current { x, z }`, and ride status `{ speed, heading }`.
- Produces: `WorldMap` prop `mode="overview" | "navigation"`, defaulting to `overview`.

- [ ] **Step 1: Add failing presentation and compatibility tests**

Assert navigation copy contains `주행 내비`, renders a heading chevron and scale label, omits interactive teleport captions, and overview retains `도시 전체 지도`, selection, and click behavior. Add a browser assertion that the ride HUD map has navigation mode.

- [ ] **Step 2: Run tests and verify red**

Run: `node --test tests/world/navigation-map.test.mjs`

Run: `npx playwright test tests/world.spec.js --grep "map"`

Expected: navigation presentation assertions FAIL while overview tests remain green.

- [ ] **Step 3: Split overview and navigation rendering inside `WorldMap`**

Keep shared plan/building preprocessing memoized. Preserve the current overview SVG untouched behind the default mode. For navigation, transform road endpoints/buildings with Task 2 helpers, cull them, render road casing plus centerlines, use tier shapes/colors, and anchor the player chevron near the lower center.

- [ ] **Step 4: Connect ride status without subscribing the Three tree**

Have the DOM map subscribe to `useRideStatus` only in its own component boundary. Read position from `cameraRef`, damp radius/heading locally, and update at the existing HUD cadence. Pass `mode="navigation"` for the `RideHud` map in `WorldPage`; leave the non-driving map at its default.

- [ ] **Step 5: Add responsive navigation styling**

Keep the analog-gauge raised placement, make the navigation panel rectangular rather than square, guarantee readable contrast, and add breakpoints that prevent overlap with car gauges, hull, weapon controls, and touch controls.

- [ ] **Step 6: Run navigation unit and browser tests**

Run the Step 2 commands. Expected: PASS.

- [ ] **Step 7: Commit navigation UI**

```bash
git add src/world/Map.jsx src/routes/WorldPage.jsx src/world/ui/RideHud.jsx src/world/ui/world-ui.css src/world/world.css src/world/navigationMap.js tests/world/navigation-map.test.mjs tests/world.spec.js
git commit -m "feat: add speed-aware heading-up navigation"
```

### Task 7: Integrate, inspect, and verify the complete change

**Files:**
- Modify if required by verified defects only: files already listed in Tasks 1–6
- Modify: `src/world/README.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a documented, buildable, visually verified feature set.

- [ ] **Step 1: Document the new vehicle and navigation contracts**

Update the module and change-impact tables with `formula`, `navigationMap.js`, navigation mode, and the data-driven drift fields. Record that Space is formula handbrake and combat Space remains fire.

- [ ] **Step 2: Run all world unit tests**

Run: `npm run test:world:unit`

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Run lint and production build**

Run: `npm run lint`

Run: `npm run build`

Expected: both commands exit 0.

- [ ] **Step 4: Run the focused world browser suite**

Run: `npm run test:world`

Expected: all configured world Playwright tests PASS.

- [ ] **Step 5: Inspect representative screenshots**

Start the production preview, then capture desktop screenshots of formula third person, formula first person, one civilian cabin, motorcycle, combat interior, low-speed navigation, and high-speed navigation. Check: no clipped primary gauges, no opaque geometry in the central driving cone, no mirror/cabin overlap, legible road casing, correct tier colors/shapes, player below center, and visibly wider high-speed scale.

- [ ] **Step 6: Run final diff checks**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; unrelated pre-existing changes remain unstaged and intact.

- [ ] **Step 7: Commit documentation and any verified final corrections**

```bash
git add src/world/README.md
git commit -m "docs: document formula vehicle and navigation"
```
