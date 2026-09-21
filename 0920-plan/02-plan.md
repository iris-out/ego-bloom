# 02. 계획

`01-problems.md` 의 측정과 두 조사 문서(`research-rendering.md`, `research-traffic-shotgun.md`) 를 바탕으로 세운 계획이다. 작업을 다섯 흐름으로 나누고 파일 소유를 겹치지 않게 정했다. 흐름 사이에 오가는 모양은 아래 공용 계약 절에 고정한다.

## 목표

- 지상 시점(도보, 차량, 비행 이륙) 의 프레임 시간을 줄이고 멈춤(p95, p99) 을 없앤다. 측정은 `0920-plan/perf/world-perf.spec.js` 로 개선 전 빌드와 개선 후 빌드를 같은 시간대에 번갈아 잰다.
- AI 차량이 같은 차선에서 겹치지 않고, 커브와 교차로에서 감속하고, 경로 끝에서 순간이동하지 않게 한다. 위치는 지금처럼 (차 번호, 시간, 도시 크기) 의 순수 함수로 남긴다.
- 1인칭 실내와 계기판의 draw call 과 재렌더를 줄이고 첫 진입 셰이더 멈춤을 없앤다.
- 도보 렉을 없애고 산탄총을 넣는다.

## 측정에서 얻은 우선순위

외부 GPU 경쟁이 없는 조건(2차 실험) 에서 도보 정지는 50.9fps 였고 rAF 안 시간이 13.9ms 로 CPU 가 병목이었다. 공항과 AI 항공기를 끄면(draw 555 에서 285) 68.6fps, 여기에 그림자까지 끄면(draw 221) 87.2fps 다. 하늘과 바다만 꺼도(draw 17 감소) 62fps 라 화면 전체를 덮는 셰이더 비용도 있다. 사용자 Chrome 이 같은 GPU 를 쓰던 1차 측정에서는 같은 장면이 4~9fps 로 떨어졌다. 여러 탭이나 다른 3D 앱과 GPU 를 나눠 쓰는 실제 사용 환경에서는 화소 비용과 draw call 이 모두 크게 부풀어 오른다는 뜻이다.

1. draw call 줄이기(공항, AI 항공기, 총 모델, 실내, 그림자 패스)
2. 그림자 패스의 caster 줄이기와 갱신 빈도 낮추기
3. 한 프레임에 한 번만 도는 교통 계산, 건물 충돌 격자
4. React 재렌더 없애기(탈것 상태 store, ref 기반 이펙트)
5. 셰이더 미리 컴파일과 조명 개수 고정
6. GPU 가 밀릴 때 해상도를 자동으로 낮추는 안전망

## 이미 넣은 공용 기반(메인 세션)

- `src/world/solidIndex.js`: `hitsBuilding` 을 할당 없이 다시 쓰고, 배열마다 48 단위 격자를 캐시하는 `hitsAnyBuilding(from, to, buildings)` 를 더했다. 도보, 차량, 비행, 헬기, 포탄, 원격 포탄, 조준선 미리보기의 `buildings.some(hitsBuilding)` 9곳을 바꿨다. `flightPhysics` 는 `hitsBuilding` 을 다시 내보낸다. 테스트 `tests/world/solid-index.test.mjs` 가 무작위 선분 4000개에서 선형 탐색과 답이 같은지 본다.
- `src/world/staticBatch.js`, `src/world/StaticBatch.jsx`: 움직이지 않는 자식 mesh 를 재질 속성이 같은 것끼리 한 geometry 로 합친다. 움직이는 가지는 `userData={{ dynamic: true }}` group 으로 감싸 뺀다. 테스트 `tests/world/static-batch.test.mjs`.
- `src/world/TrafficCars.jsx`: `WorldScene.jsx` 안의 `Cars` 를 파일로 떼어 냈다. 동작은 아직 그대로다.

## 공용 계약

### 교통 snapshot (흐름 T 가 만든다)

```
trafficPose(index, time, extent) -> { index, x, z, angle, truck, braking, speed, width, depth }
trafficFrame(count, time, extent) -> { count, time, x, z, angle, braking, speed: Float64Array, truck: Uint8Array }
trafficBoxes(count, time, extent, near, radius) -> pose[]   // 인자와 반환 모양은 지금과 같다
```

구현은 Float64Array 로 갔다. `trafficBoxes` 의 값이 `trafficPose` 와 비트까지 같아야 기존 테스트가 선다. 같은 (count, time, extent) 로 한 프레임에 여러 번 불러도 계산은 한 번이다. 돌려주는 객체는 다음 호출이 덮어쓰므로 받은 자리에서 읽는다. `trafficBoxes` 는 `trafficFrame` 을 읽어 반경 안 차만 객체로 만든다. 도보, 차량, 비행은 호출을 바꾸지 않아도 빨라진다.

### Blast 의 시간 (흐름 C 가 만든다)

```
<Blast kind x y z life size age={number} />          // 지금 방식. 부모가 매 렌더 age 를 넘긴다
<Blast kind x y z life size ageOf={() => number} />  // 새 방식. Blast 가 매 프레임 ageOf() 를 읽어 스스로 갱신한다
```

새 방식을 쓰는 부모는 폭발 목록이 바뀔 때만 다시 렌더한다. `WalkMode`(흐름 W) 와 `AirTraffic`(흐름 R) 은 새 방식으로 옮긴다.

### 탈것 상태 store (흐름 U 가 만든다)

```
src/world/rideStatusStore.js
  publishRideStatus(status)            // FlightMode, CarMode, WalkMode 가 부르는 onStatus 가 여기로 간다
  useRideStatus(selector?)             // HUD 가 useSyncExternalStore 로 구독한다
```

`WorldPage` 는 탈것 상태를 state 로 들지 않는다. `WorldScene` 에 넘기는 콜백과 객체는 모두 안정된 참조여야 한다.

### 셰이더 미리 컴파일 (흐름 R 이 만든다)

도시가 준비된 뒤 한가할 때 `gl.compileAsync` 로 실내, 총, 폭발, 예광, 손전등 켠 상태의 프로그램을 미리 만든다. 흐름 C 와 W 는 자기 재질을 모듈 스코프에 두어 미리 컴파일 대상에서 찾을 수 있게 한다.

## 작업 흐름

| 흐름 | 담당 모델 | 소유 파일 | 할 일 |
|---|---|---|---|
| T 교통 | Opus | `traffic.js`, `TrafficCars.jsx`, `tests/world/traffic.test.mjs`, `tests/world/plan-cache.test.mjs` | 결정적 속도 프로파일 교통 모델, 한 프레임 snapshot, 행렬 직접 기록 렌더 |
| R 렌더 | Opus | `WorldScene.jsx`, `SkyEffects.jsx`, `Ocean.jsx`, `StreetLamps.jsx`, `AirTraffic.jsx`, `models/Airport.jsx`, `cityTiles.js`, `UrbanScenery.js`, `shaders/*`, 새 `ShaderPrewarm.jsx`, 새 `AdaptiveResolution.jsx` | draw call, 그림자, 조명 개수, 미리 컴파일, 해상도 안전망 |
| C 실내 | Sonnet | `CarMode.jsx`, `FlightMode.jsx`, `cockpits/*`, `models/Blast.jsx`, `models/Projectiles.jsx`, `RemoteCombat.jsx` | 실내 정적 병합, 계기 ref 구동, 이펙트 ref 구동, Blast `ageOf` |
| W 도보 | Sonnet | `WalkMode.jsx`, `walkPhysics.js`, `models/WeaponView.jsx`, `weaponSights.js`, `weaponMotion.js`, `sound.js`, `ui/WalkHud.jsx`, `ui/FpsCrosshair.jsx`, `VehicleHealthBar.jsx` | 도보 렉 제거, 총 모델 병합, 산탄총 |
| U 화면 | Sonnet | `src/routes/WorldPage.jsx`, `ui/RideHud.jsx` 와 나머지 `ui/*`, 새 `rideStatusStore.js` | 탈것 상태 store, 안정된 콜백, HUD 구독 |

`src/world/README.md`, `CLAUDE.md`, 이 폴더의 결과 문서는 메인 세션이 마지막에 한 번에 고친다. 각 흐름은 `0920-plan/work/<흐름>.md` 에 바꾼 것, 잰 숫자, 남은 문제를 남긴다.

### T 교통 설계

- 경로마다 회로(circuit) 를 만든다. 열린 경로는 끝에서 반원으로 유턴해 반대 차선으로 돌아오는 한 바퀴이고, 닫힌 경로(순환로) 는 방향마다 따로 한 바퀴다. 순간이동이 사라진다.
- 차선 띠(band) 마다 속도 프로파일 하나를 공유한다. 곡률에서 `v = min(v0, sqrt(aLat / kappa))`, 교차로 앞뒤 감속, 앞뒤 두 번 훑어 가속과 감속 한계를 건다. 누적 시간 표를 뒤집어 위치를 찾는다.
- 한 띠 안의 차는 같은 프로파일을 시간만 어긋나게 탄다. 시간 차가 고정이라 앞차를 뚫고 지나가지 않는다.
- 차 번호는 도시 전체 차선 길이에 고르게 뿌린다. 긴 경로는 차를 많이, 짧은 경로는 적게 받는다. 품질이 낮아 차가 적어도 앞 번호들만으로 고르게 퍼진다. 배치는 차 수(count) 에 기대지 않는다.
- 브레이크등은 프로파일의 실제 감속으로 켠다.
- 한 프레임 계산은 1000대 1ms 안이 목표다.

### R 렌더 할 일

- `WorldScene` 을 memo 로 감싸고 `City` 의 콜백을 안정시킨다.
- picking 상자 재질을 `visible = false` 로 둔다. three 의 raycast 는 재질 가시성을 보지 않으므로 클릭은 그대로 된다(확인 필요).
- 그림자: caster 를 가까운 타일로 제한하고, 정적인 도시만 그리는 그림자 맵은 초점이 일정 거리 이상 움직일 때만 다시 그린다. 움직이는 탈것의 그림자가 늦지 않게 한다.
- 공항 둘(draw 180) 과 AI 항공기(draw 90) 를 `StaticBatch` 나 instancing 으로 줄인다.
- 밤 가로등 pointLight 는 개수를 고정하고 쓰지 않는 자리는 세기 0 으로 둔다.
- 하늘과 바다의 화면 전체 비용을 줄인다.
- 정적인 도시 객체는 `matrixAutoUpdate = false` 로 둔다.
- `renderer.debug.checkShaderErrors` 를 production 에서 끄고, `ShaderPrewarm` 으로 미리 컴파일한다.
- `AdaptiveResolution`: 프레임 시간이 계속 예산을 넘으면 dpr 을 단계적으로 낮추고, 여유가 생기면 되돌린다.

### C 실내 할 일

- `CarMode`, `FlightMode` 의 `setOrdnance`, `setLive`, `setCockpitStatus`, `setWheels`, `setAimView` 를 ref 로 옮긴다. 실내는 status ref 를 useFrame 에서 읽는다.
- 실내 정적 부품과 계기 눈금을 `StaticBatch` 로 합친다. 바늘과 조종간은 dynamic 으로 뺀다.
- 계기 화면(`InstrumentDisplay`) 은 ref 를 읽어 정해진 주기로만 다시 그린다.
- `Blast` 에 `ageOf` 를 더하고 `Projectiles` 를 ref 구동으로 바꾼다.

### W 도보 할 일

- `Blasts` 와 피해 막대를 ref 구동으로 바꾼다. `setGun` 은 무기가 바뀔 때만 부른다.
- 총 모델을 `StaticBatch` 로 합친다(draw 59 에서 한 자릿수).
- 산탄총: 조사 문서의 표를 따른다. pellet 9개의 결정적 패턴, 관형 탄창에 한 발씩 넣는 재장전을 사격으로 끊기, 펌프 동작과 소리, 5번 키.

### U 화면 할 일

- `rideStatusStore` 를 만들고 `WorldPage` 의 `rideStatus`, `throttle` state 를 옮긴다.
- `WorldScene` 에 넘기는 인라인 함수(`onExplore` 등) 를 `useCallback` 으로 고정한다.
- HUD(`RideHud` 와 그 자식) 는 store 를 구독한다. 무기 버튼에 산탄총 자리를 둔다.

## 순서와 시간 배분

사용자는 10시간 안에 끝내되 5시간 사용량 한도를 넘지 않기를 바란다. 에이전트를 한 번에 많이 띄우지 않는다.

1. 01:10~03:10 측정, 조사, 공용 기반, 문서(끝남)
2. 03:15~ 흐름 다섯을 한 번에 띄운다. Opus 둘, Sonnet 셋이다.
3. 흐름이 끝나는 대로 메인 세션이 단위 테스트, lint, 빌드, 측정으로 확인한다.
4. 코드 리뷰 에이전트 하나로 전체 변경을 한 번 본다. 고칠 것을 고친다.
5. 개선 전후를 같은 시간대에 번갈아 재고 `03-results.md` 를 쓴다. README 와 CLAUDE.md 를 고친다.

## 검증

- `npm run test:world:unit`, 바뀐 파일의 `npx eslint`, `npm run build`
- `npm run test:world`(Playwright, 빌드 산출물로 돈다)
- `0920-plan/perf` 측정. 외부 GPU 경쟁(`foreignGpuPct`) 이 높은 표본은 버리고 다시 잰다.
