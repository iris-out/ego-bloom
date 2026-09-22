# Ground Interiors, Formula Car, and Navigation Design

## Goal

Raise the first-person quality of every ground vehicle, remove cockpit occlusion and overlap defects, replace the in-ride full-city thumbnail with a useful heading-up navigation view, and add a complete modern formula car. The result must retain the world's low-poly visual language and its current rendering budget.

Success means:

- every ground vehicle has a readable, distinct interior at its normal first-person FOV;
- steering wheels, gauges, mirrors, frames, weapons, and the camera near plane do not visibly intersect;
- the in-ride map centers the player, rotates with heading, and changes scale smoothly with speed;
- nearby roads and tier-coded buildings remain legible at every navigation scale;
- the new formula car has a detailed exterior and cockpit, reaches 300 km/h, accelerates faster than existing road cars, and can drift with the Space handbrake;
- the existing full-city map and behavior of existing vehicles remain available and compatible.

## Scope and constraints

This work covers the four enclosed road cabins, the convertible, motorcycle, four combat-vehicle interiors, and the new formula car. Aircraft cockpits are out of scope except where shared components must remain compatible.

The implementation follows the existing ownership boundaries:

- `shared/worldLayout.js` and `shared/urbanPlan.js` remain the sources of building and road coordinates.
- `cockpits/` owns visual interiors but not input or vehicle state.
- `carPhysics.js` owns handling and transmission behavior.
- `VehicleModel` remains exhaustive with `identity.VEHICLE_KEYS`.
- dynamic needles, wheels, steering, and hands remain outside the outer static batch; static children of a dynamic group may use an inner batch.
- mirrors continue to share one low-resolution rear render and do not render the cockpit in the mirror pass.
- no real constructor branding or copyrighted racing livery is introduced.

Existing uncommitted work in the checkout is user-owned and must be preserved. Changes should be localized and staged selectively.

## Architecture

### 1. Interior layout and occlusion safety

`vehicleInteriorLayout.js` remains the numeric source for ground cockpit placement. It gains a formula layout and any missing clearance metadata needed to describe steering-wheel, gauge, screen, frame, and sight envelopes. Shared test helpers project those envelopes from the configured eye point and FOV, then check:

- vertical and horizontal FOV containment;
- near-plane clearance;
- minimum separation between steering rim, gauge faces, screens, and opaque trim;
- an unobstructed central forward cone for road and combat vehicles;
- vehicle-specific cabin bounds.

The render components consume those values rather than duplicating coordinates. Visual detail is improved with existing shared geometries and materials: layered dashboards, recessed instrument binnacles, bezels, vents, switch banks, console seams, door cards, pedals, seat bolsters, structural ribs, periscope frames, and restrained emissive indicators. Detail levels continue to gate optional pieces so low quality remains cheap.

Combat interiors preserve their distinct stations: tank and howitzer optics, armored cupola, and anti-air open sight. Refinement must not widen collision geometry or change weapon aim contracts.

### 2. Formula vehicle

The vehicle key is `formula`, with Korean display name `포뮬러`. It is added through the full existing vehicle contract:

- identity and ride metadata;
- physics specification, collision footprint, health height, sound, lamps, eye point, and FOV;
- exterior model selection and cockpit selection;
- render prewarming, triangle budgets, picker art, mirrors, and tests.

The exterior is a fictional current-generation, low-floor open-wheel machine with a tapered nose, multi-element front wing, exposed wishbones, large slick tires, sculpted sidepods, floor edge, engine cover, rear wing, diffuser suggestion, rear light, and halo. Repeated pieces reuse geometry/materials and static batching. Wheels remain dynamic under the standard wheel contract.

The cockpit uses a low reclined eye point, halo frame outside the central sight line, padded cockpit rim, compact rectangular steering wheel, integrated speed/gear/RPM display, shift lights, pedals, and side mirrors. The first-person exterior hides only pieces that would intersect the camera, not the full vehicle.

### 3. Formula handling and controls

The physics top speed is `300 / 3.6` metres per second. Formula acceleration is above every civilian four-wheel vehicle while preserving the existing drag model. Steering response is strong at low and medium speeds but progressively limited near maximum speed to avoid instant high-speed spins.

Space maps to `handbrake` for the formula car. The normal service-brake control remains available through the existing reverse/brake path. Handbrake behavior uses the existing rear-lock concept but gains vehicle-tunable drift parameters rather than a formula-only branch:

- rear grip reduction while held;
- yaw gain based on speed and steering input;
- partial speed loss rather than an immediate stop;
- drift activation and recovery thresholds;
- smooth heading recovery when released.

Defaults reproduce current handling for existing vehicles. Formula-specific values provide controllable slides without granting lateral teleportation or ignoring collision checks.

### 4. Navigation map

`WorldMap` supports two explicit presentations:

- `overview`: the current north-up, full-city, interactive map used outside a ride;
- `navigation`: a non-teleporting, heading-up local view used by `RideHud`.

Navigation subscribes only its DOM subtree to ride status. Static road and building data stays memoized. The player transform updates at the existing low UI cadence rather than forcing the Three scene to rerender.

The navigation camera uses a continuous, damped visible radius:

- near standstill: about 75 metres;
- ordinary city speed: about 140 metres;
- motorway and formula speed: up to about 300 metres.

The exact interpolation is monotonic and clamped, with damping to prevent zoom pumping during gear changes. Below a small movement threshold, heading is held at the last reliable value so the map does not twitch while parked.

World coordinates are transformed into local player coordinates, rotated so the vehicle heading points upward, then mapped into the SVG viewport. Roads receive a dark casing and a lighter center stroke, with arterial/highway emphasis. Buildings are culled outside the local radius and rendered with tier-specific color and silhouette:

- bronze: small square;
- silver: diamond;
- gold: hexagon or emphasized square;
- platinum: ringed marker;
- diamond: prominent star-like or double-ring marker.

The player marker sits slightly below center to show more road ahead. A heading chevron replaces the overview position dot. A compact scale readout and `주행 내비` heading replace the full-city caption. The overview map preserves selection, teleport, airport, nature, beach, subway, and caption behavior.

## Visual behavior

The cockpit remains matte and low-poly but gains deliberate material separation: dark soft-touch dashboard surfaces, slightly brighter hard trim, muted metal, low-emission displays, and subtle glass reflections. Detail comes from silhouette, recesses, layering, and purposeful controls rather than tiny meshes.

The formula palette uses a deep graphite body with one strong existing theme accent and light neutral sponsor-like geometric blocks without text or logos. Interior display colors match existing cockpit instrumentation. The vehicle must read clearly in daylight, night lighting, and the picker thumbnail.

The navigation panel keeps the existing purple HUD frame but reduces decorative density. Map contrast is prioritized over translucency. It must not overlap the analog gauges, hull bar, weapon controls, or mobile touch controls at supported breakpoints.

## Data flow

1. `CarMode` reads keyboard/touch controls and calls `stepCar` with service brake and handbrake as separate inputs.
2. `stepCar` applies the selected vehicle's data-driven handling and emits speed, heading, drift, gear, and RPM.
3. `CarMode` publishes the normal ride status without causing the R3F tree to subscribe to DOM state.
4. `RideHud` renders the navigation-mode `WorldMap` while driving.
5. `WorldMap` memoizes the urban graph and building markers, then transforms/culls them using speed, heading, and current position.
6. Cockpit instruments continue reading `statusRef` imperatively per frame.

## Error handling and fallbacks

- Unknown vehicle keys continue to fall back through existing identity validation.
- Missing tier names render as bronze.
- Invalid speed, heading, or position uses the last valid navigation transform and ultimately the origin fallback.
- An empty building list hides the map as today.
- Browsers without a usable 2D canvas keep the existing material fallbacks for instrument textures.
- Low graphics quality removes optional cockpit detail but never primary gauges, controls, the halo, or navigation roads.

## Testing and verification

Test-first changes cover:

- formula identity exhaustiveness and selection metadata;
- exact 300 km/h speed cap, faster acceleration, gearing, steering stability, handbrake drift entry/recovery, and unchanged existing-vehicle defaults;
- formula collision dimensions, health height, wheel contracts, eye point, FOV, mirrors, and cockpit triangle budget;
- all ground cockpit FOV, near-plane, overlap, and central-cone constraints;
- navigation zoom monotonicity and clamps;
- heading-up coordinate transforms, parked-heading stability, culling, tier marker selection, and overview compatibility;
- relevant existing car, first-person, mirror, instrument, and world-map tests.

Verification includes the world unit suite, lint, production build, and browser screenshots at representative desktop dimensions. Visual checks cover third-person formula exterior, formula first-person cockpit, at least one civilian cabin, one motorcycle, one combat interior, low-speed navigation, and high-speed navigation.

## Non-goals

- racing rules, lap timing, DRS, ERS, pit stops, tire wear, and damage simulation;
- route finding or turn-by-turn destination guidance;
- replacing the urban plan or full-city overview map;
- photorealistic meshes or external 3D assets;
- changing aircraft handling or cockpit design.
